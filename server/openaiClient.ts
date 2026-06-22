import OpenAI from "openai";

// Provedor de IA para visão/OCR.
// - Se GEMINI_API_KEY estiver definida, usamos o Google Gemini pelo endpoint
//   COMPATÍVEL com OpenAI (o mesmo SDK funciona) — tem free tier e não exige cartão.
// - Senão, usamos OpenAI (OPENAI_API_KEY) ou a integração do Replit (legado).
//
// IMPORTANTE: o SDK lança erro no construtor se a apiKey for vazia. Como o OCR é
// opcional, usamos um placeholder quando não há chave — o app sobe normalmente e
// apenas as chamadas de OCR falham até a chave real ser configurada.
const geminiKey = process.env.GEMINI_API_KEY;
const openaiKey =
  process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

export const aiProvider: "gemini" | "openai" = geminiKey ? "gemini" : "openai";

export const openai = new OpenAI({
  apiKey: geminiKey || openaiKey || "sk-missing-openai-key",
  baseURL: geminiKey
    ? "https://generativelanguage.googleapis.com/v1beta/openai/"
    : process.env.OPENAI_BASE_URL ||
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
      undefined,
});

// Modelo de visão usado no OCR. Configurável por env (OCR_MODEL); default por provedor.
export const ocrModel =
  process.env.OCR_MODEL ||
  (aiProvider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini");
