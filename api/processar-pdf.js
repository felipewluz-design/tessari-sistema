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
    "marca": "nome exato da marca/fabricante encontrado no documento",
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
        "grade": {"36": 1, "37": 2}
      }
    ]
  }
}
REGRAS:
- Extraia TODOS os itens sem pular nenhum
- marca: coloque o nome da marca/fabricante exatamente como aparece no documento (ex: Nike, Ferracini, Adidas, Puma). Nao invente — use o que esta escrito
- Para cada item leia a grade de tamanhos e quantidades
- valor_total = total liquido (apos desconto se houver)
- Se o documento tiver campos C. FAT. % e C. DUP. %: preencha percentual_comissao_faturamento e percentual_comissao_duplicata. percentual_comissao_total = soma dos dois
- Se o documento tiver apenas um percentual de comissao, coloque em percentual_comissao_total
- Se nao houver percentual de comissao no documento, deixe todos como 0
- previsao_faturamento: leia o campo "PREVISAO DE FATURAMENTO" se existir
- previsao_entrega: leia campo de previsao de entrega se existir
- total_pares: some todos os pares de todos os itens
- Para grade: use os numeros dos tamanhos como chave e a quantidade como valor. Ex: {"36":2,"37":3,"38":2}`;

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
