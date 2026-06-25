// api/processar-pdf.js
// Vercel serverless function — processa PDF ou imagem via Claude Sonnet 4.6
// Extrai dados do pedido automaticamente

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base64, tipo, mimeType } = req.body;

  if (!base64) {
    return res.status(400).json({ error: 'base64 obrigatório' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });
  }

  const isPdf = tipo === 'pdf' || mimeType === 'application/pdf';

  const contentPart = isPdf
    ? {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64
        }
      }
    : {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType || 'image/jpeg',
          data: base64
        }
      };

  const prompt = `Você é um assistente que extrai dados de pedidos comerciais de calçados.

Analise este documento (pedido de venda ou confirmação de pedido) e extraia as seguintes informações.

Retorne SOMENTE um JSON válido, sem nenhum texto antes ou depois, sem markdown, sem blocos de código.

Formato exato do JSON:
{
  "marca": "nome da marca (ex: Nike, Adidas, Ferracini)",
  "cliente": "nome ou razão social do cliente/loja",
  "numero_pedido": "número ou código do pedido",
  "pares": número inteiro de pares ou null,
  "valor_total": número decimal do valor total em reais ou null,
  "comissao_percentual": número decimal da % de comissão ou null,
  "comissao_valor": número decimal do valor de comissão em reais ou null,
  "condicao_pagamento": "ex: 30/60/90 dias ou à vista",
  "previsao_faturamento": "data em formato YYYY-MM-DD ou null",
  "data_pedido": "data de emissão do pedido em formato YYYY-MM-DD ou null",
  "cliente_cidade": "cidade do cliente comprador ou null",
  "cliente_uf": "estado/UF do cliente comprador (2 letras) ou null",
  "cliente_cnpj": "CNPJ do cliente comprador (apenas números) ou null",
  "cliente_telefone": "telefone do cliente comprador ou null",
  "observacoes": "informações adicionais relevantes ou null"
}

Regras:
- Se não encontrar um campo, use null
- Valores monetários devem ser números (ex: 1500.00, não "R$ 1.500,00")
- cliente: é o COMPRADOR do pedido — nome da loja, pessoa física ou razão social de quem está comprando. NUNCA use o nome da empresa emissora do formulário, da representação comercial ou do vendedor como cliente. Em pedidos manuscritos, procure campos como "Razão Social", "Cliente", "Comprador", "Loja". O vendedor/representante nunca é o cliente.
- marca: é a marca dos produtos vendidos (ex: Disney, Ferracini, Nike, Adidas). NUNCA use o nome da representação comercial ou distribuidora como marca.
- comissao_percentual é APENAS a comissão do representante comercial (campo "comissão rep", "% comissão", "comissão" explícita). NUNCA use "C. DUP.", "C. FAT.", "desconto de duplicata", "desconto de faturamento" ou qualquer desconto do cliente como comissão — esses são descontos comerciais, não comissão do rep. Se não houver comissão explícita do representante, retorne null.
- condicao_pagamento: extraia o prazo de pagamento (ex: "30/60/90 dias"), ignorando percentuais de desconto
- previsao_faturamento: procure por "previsão de faturamento", "prev. fat.", "data entrega" — retorne em formato YYYY-MM-DD
- Se o documento não parecer ser um pedido, retorne todos os campos como null mas mantenha a estrutura`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              contentPart,
              { type: 'text', text: prompt }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'Erro ao processar com IA', details: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Limpar e parsear JSON
    const clean = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let resultado;
    try {
      resultado = JSON.parse(clean);
    } catch(e) {
      // Tentar extrair JSON do texto
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        resultado = JSON.parse(match[0]);
      } else {
        throw new Error('JSON inválido retornado pela IA');
      }
    }

    return res.status(200).json(resultado);

  } catch(e) {
    console.error('Erro processar-pdf:', e);
    return res.status(500).json({
      error: 'Erro ao processar documento',
      message: e.message
    });
  }
}
