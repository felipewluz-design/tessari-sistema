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

    var prompt = "Leia este pedido e retorne APENAS um JSON com este formato exato, sem texto antes ou depois:\n{\"cliente\":{\"nome\":\"\",\"cnpj\":\"\",\"endereco\":\"\",\"cidade\":\"\",\"cep\":\"\",\"telefone\":\"\",\"email\":\"\"},\"pedido\":{\"numero\":\"\",\"condicao_pagamento\":\"\",\"previsao_entrega\":\"\",\"total_pares\":0,\"valor_total\":0,\"marca\":\"disney\",\"itens\":[{\"ref\":\"\",\"descricao\":\"\",\"pares\":0,\"unitario\":0,\"grade\":{}}]}}";

    var contentType = mediaType === "application/pdf" ? "document" : "image";
    var msgContent = [
      { type: contentType, source: { type: "base64", media_type: mediaType, data: base64 } },
      { type: "text", text: prompt }
    ];

    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: msgContent }]
      })
    });

    var data = await response.json();
    if(!response.ok) return res.status(500).json({error: data.error ? data.error.message : "Erro na API"});

    var texto = data.content[0].text.replace(/```json|```/g, "").trim();
    var resultado = JSON.parse(texto);
    return res.status(200).json(resultado);

  } catch(e) {
    console.error("Erro processar PDF:", e);
    return res.status(500).json({error: "Erro ao processar arquivo: " + e.message});
  }
}
