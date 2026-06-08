export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();
  if(req.method !== "POST") return res.status(405).json({error: "Method not allowed"});
  try {
    var body = req.body;
    var base64 = body.base64;
    var mediaType = body.mediaType || "application/pdf";
    if(!base64) return res.status(400).json({error: "Arquivo nao enviado"});
    var contentType = "document";
    if(mediaType === "application/pdf") {
      contentType = "document";
    } else if(mediaType.startsWith("image/")) {
      contentType = "image";
      if(mediaType !== "image/jpeg" && mediaType !== "image/png" && mediaType !== "image/gif" && mediaType !== "image/webp") {
        mediaType = "image/jpeg";
      }
    }
    var prompt = `Leia este pedido com MUITO CUIDADO e extraia TODOS os dados.
Retorne APENAS um JSON valido, sem texto antes ou depois, sem markdown.
{
  "cliente": {
    "nome": "",
    "cnpj": "apenas numeros",
    "endereco": "",
    "cidade": "",
    "cep": "apenas numeros",
    "telefone": "apenas numeros",
    "email": ""
  },
  "pedido": {
    "numero": "",
    "condicao_pagamento": "ex: 30 ou 60/90/120",
    "previsao_entrega": "DD/MM/YYYY ou vazio",
    "previsao_faturamento": "ex: 1a quinzena julho/2026 ou vazio",
    "total_pares": 0,
    "valor_total": 0,
    "marca": "disney ou ferracini",
    "tipo_tabela": "varejo ou rede",
    "percentual_comissao_faturamento": 0,
    "percentual_comissao_duplicata": 0,
    "percentual_comissao_total": 0,
    "itens": [
      {
        "ref": "",
        "descricao": "",
        "pares": 0,
        "unitario": 0,
        "total": 0,
        "grade": {"20": 1, "21": 2}
      }
    ]
  }
}
REGRAS:
- Extraia TODOS os itens sem pular nenhum
- Para cada item leia a linha de numeros e a linha de quantidades logo abaixo
- Disney/Dyan: grade infantil 20-35. Ferracini: grade adulta 37-47
- valor_total = total liquido (apos desconto)
- marca = ferracini se for Ferracini, senao disney
- tipo_tabela = rede se mencionar rede ou tabela especial, senao varejo
- Se for Ferracini: leia os campos C. FAT. % e C. DUP. % e coloque em percentual_comissao_faturamento e percentual_comissao_duplicata. percentual_comissao_total = soma dos dois
- Se for Disney: percentual_comissao_total = 10 se varejo, 5 se rede
- previsao_faturamento: se for Ferracini, leia o campo "PREVISAO DE FATURAMENTO" ou "1a Quinz" etc
- previsao_entrega: se for Disney, leia "Prev. Entrega"`;
    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: [
            { type: contentType, source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: prompt }
          ]
        }]
      })
    });
    var data = await response.json();
    if(!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return res.status(500).json({error: data.error ? data.error.message : "Erro na API"});
    }
    var texto = data.content[0].text.replace(/```json|```/g, "").trim();
    try {
      var resultado = JSON.parse(texto);
      return res.status(200).json(resultado);
    } catch(e) {
      console.error("Parse error:", texto.substring(0,200));
      return res.status(500).json({error: "Erro ao interpretar resposta"});
    }
  } catch(e) {
    console.error("Erro:", e);
    return res.status(500).json({error: "Erro: " + e.message});
  }
}
