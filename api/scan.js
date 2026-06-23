// /api/scan.js — función serverless de Vercel.
// Recibe la imagen del ticket desde el navegador, llama a la API de Anthropic
// usando la clave guardada en las variables de entorno (nunca expuesta al cliente),
// y devuelve el ticket ya separado en productos + categorías.

const SYSTEM_PROMPT =
  "Eres un asistente que analiza fotos de tickets de compra y extrae cada producto. " +
  "Para cada línea identifica: name (nombre simple en español), price (número, sin símbolos), " +
  'category (una exacta de: "Comida", "Bebidas", "Snacks y Dulces", "Hogar", "Cuidado Personal", "Mascotas", "Otros"), ' +
  "essential (true si es compra necesaria, false si es impulso o gasto chico no esencial). " +
  "Responde SOLO un JSON válido sin texto adicional ni backticks, con esta forma exacta: " +
  '{"store": "nombre o \'Ticket\'", "items": [{"name": "", "price": 0, "category": "", "essential": true}]}. ' +
  'Si la imagen no es un ticket legible responde {"error": "No pude leer este ticket. Intenta con una foto más clara."}';

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(200).json({
      error: "El escaneo automático todavía no está activado. Usa 'agregar a mano' mientras tanto.",
    });
    return;
  }

  const { image, mediaType } = req.body || {};
  if (!image) {
    res.status(400).json({ error: "No llegó ninguna imagen." });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
              { type: "text", text: "Analiza este ticket." },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    const parsed = JSON.parse(text);
    res.status(200).json(parsed);
  } catch (err) {
    console.error("Error en /api/scan:", err);
    res.status(200).json({ error: "Algo falló leyendo el ticket. Prueba de nuevo." });
  }
};
