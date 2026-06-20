import OpenAI from "openai";

// Fora do Replit usamos uma chave OpenAI própria (OPENAI_API_KEY) com a baseURL
// padrão (api.openai.com). Mantemos o fallback para a integração do Replit
// (AI_INTEGRATIONS_*) para o app seguir funcionando enquanto rodamos os dois
// ambientes em paralelo durante a migração.
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL:
    process.env.OPENAI_BASE_URL ||
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    undefined,
});
