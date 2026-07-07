import { ocrClient, ocrModel } from "./openaiClient";

/** Transcreve áudio via Gemini REST (inline_data) — mesmo padrão do WhatsApp CRM. */
export async function transcreverAudio(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY não configurada — áudio requer Gemini");
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Transcreva este áudio em português do Brasil. Responda SOMENTE com a transcrição, sem comentários.",
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: buffer.toString("base64"),
                },
              },
            ],
          },
        ],
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini áudio: HTTP ${res.status}`);
  const data: any = await res.json();
  const texto =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || "")
      .join("") ?? "";
  return texto.trim();
}

/** Extrai texto/conteúdo de imagem (print, comunicado, tabela) via visão. */
export async function extrairTextoImagem(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const completion = await ocrClient.chat.completions.create({
    model: ocrModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extraia TODO o texto e as informações relevantes desta imagem (comunicado, tabela ou print de sistema bancário). Responda SOMENTE com o conteúdo extraído, organizado em português.",
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}` },
          },
        ],
      },
    ],
    max_tokens: 3000,
  });
  return (completion.choices[0]?.message?.content || "").trim();
}
