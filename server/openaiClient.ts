import OpenAI from "openai";

// Cliente OpenAI COMPARTILHADO — usado por funções de IA legadas (roteiros, Nina,
// roleplay, abordagens, etc.). Usa OPENAI_API_KEY (ou a integração do Replit como legado).
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

// Cliente do OCR (visão). Provedor flexível:
//  - Se GEMINI_API_KEY estiver definida → Google Gemini (endpoint compatível com OpenAI, free tier).
//  - Senão → OpenAI (OPENAI_API_KEY), modelo gpt-4o-mini.
// Basta trocar a env no Railway para alternar o provedor — sem mexer no código.
const geminiKey = process.env.GEMINI_API_KEY;
export const ocrProvider: "gemini" | "openai" = geminiKey ? "gemini" : "openai";

export const ocrClient = geminiKey
  ? new OpenAI({
      apiKey: geminiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    })
  : openai;

// Modelo de visão do OCR (configurável por OCR_MODEL); default por provedor.
// Default = modelo GRANDE de cada provedor: RG brasileiro (guilhochê, fonte fina,
// texto sobre imagem) derrubava os modelos "mini"/"flash" — eles alucinavam nomes
// e datas plausíveis em vez de admitir que não leram. Custo por documento é
// centavos; dado inventado em proposta custa a venda.
export const ocrModel =
  process.env.OCR_MODEL || (geminiKey ? "gemini-2.5-pro" : "gpt-4o");
