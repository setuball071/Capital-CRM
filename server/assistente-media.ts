import { ocrClient, ocrModel, openai } from "./openaiClient";
import { toFile } from "openai";

function extAudio(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

/**
 * Transcreve áudio. Se houver GEMINI_API_KEY usa o Gemini (REST inline_data);
 * senão cai no OpenAI Whisper (o Capital CRM usa OPENAI_API_KEY, sem Gemini).
 */
export async function transcreverAudio(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
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
    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || "")
        .join("") ?? ""
    ).trim();
  }

  // Fallback OpenAI Whisper
  const file = await toFile(buffer, `audio.${extAudio(mimeType)}`, { type: mimeType });
  const tr = await openai.audio.transcriptions.create({
    file,
    model: process.env.WHISPER_MODEL || "whisper-1",
    language: "pt",
  });
  return (tr.text || "").trim();
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
