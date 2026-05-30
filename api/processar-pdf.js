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

    var prompt = `Leia este pedido com MUITO CUIDADO e extraia TODOS os itens sem excecao.
Retorne APENAS um JSON valido, sem texto antes ou depois, sem markdown.

{
  "cliente": {
    "nome": "nome completo da empresa",
    "cnpj": "apenas numeros",
    "endereco": "rua e numero",
    "cidade": "nome da cidade",
    "cep": "apenas numeros",
    "telefone": "apenas numeros",
    "email": "email completo"
  },
  "pedido": {
    "numero": "numero do pedido",
    "condicao_pagamento": "ex: 30/60/90 ou 30 dias",
    "previsao_entrega": "DD/MM/YYYY",
    "total_pares": 0,
    "valor_total": 0,
    "marca": "disney ou ferracini",
    "tipo_tabela": "varejo ou rede",
    "percentual_comissao": 10,
    "itens": [
      {
        "ref": "codigo ex MSP32DY",
        "descricao": "descricao ou cor",
        "pares": 0,
        "unitario": 0,
        "total": 0,
        "grade": {"20": 1, "21": 1, "22": 2}
      }
    ]
  }
}

REGRAS IMPORTANTES:
- Extraia TODOS os itens, nao pule nenhum
- Para cada item, leia a linha de numeros e a linha de quantidades logo abaixo
- Disney/Dyan: grade infantil 20-35. Ferracini: grade adulta 37-47
- valor_total = total liquido ou subtotal do pedido
- marca = "ferracini" se for pedido Ferracini, senao "disney"
- tipo_tabela: se o pedido mencionar "rede" ou tabela especial use "rede", senao use "varejo"
- percentual_comissao: Disney varejo=10, Disney rede=5, Ferracini normal=6, Ferracini especial=4`;

    var contentType = mediaType === "application/pdf" ? "document" : "image";
    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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
    if(!response.ok) return res.status(500).json({error: data.error ? data.error.message : "Erro na API"});
    var texto = data.content[0].text.replace(/```json|```/g, "").trim();
    var resultado = JSON.parse(texto);
    return res.status(200).json(resultado);

  } catch(e) {
    console.error("Erro:", e);
    return res.status(500).json({error: "Erro ao processar: " + e.message});
  }
}
