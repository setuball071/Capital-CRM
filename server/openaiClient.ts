import OpenAI from "openai";

// Cliente OpenAI COMPARTILHADO — usado por funções de IA legadas (roteiros, Nina,
// roleplay, abordagens, etc.). Mantém OPENAI_API_KEY / integração Replit.
// Placeholder evita derrubar o boot quando não há chave (as chamadas só falham).
const openaiApiKey =
  process.env.OPENAI_API_KEY ||
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
  "sk-missing-openai-key";

export const openai = new OpenAI({
  apiKey: openaiApiKey,
  baseURL:
    process.env.OPENAI_BASE_URL ||
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    undefined,
});

// Cliente DEDICADO ao OCR — Google Gemini (free tier) pelo endpoint COMPATÍVEL com
// OpenAI (o mesmo SDK funciona). Isolado do cliente acima para garantir o OCR
// independentemente das demais funções de IA. Configure GEMINI_API_KEY no ambiente.
const geminiApiKey = process.env.GEMINI_API_KEY || "missing-gemini-key";

export const geminiOcr = new OpenAI({
  apiKey: geminiApiKey,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

// Modelo de visão do OCR (configurável por OCR_MODEL).
// gemini-2.5-flash tem free tier COM visão (confirmado); gemini-2.0-flash não.
export const ocrModel = process.env.OCR_MODEL || "gemini-2.5-flash";
