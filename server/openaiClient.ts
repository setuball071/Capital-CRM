import OpenAI from "openai";

// Fora do Replit usamos uma chave OpenAI própria (OPENAI_API_KEY) com a baseURL
// padrão (api.openai.com). Mantemos o fallback para a integração do Replit
// (AI_INTEGRATIONS_*) para o app seguir funcionando enquanto rodamos os dois
// ambientes em paralelo durante a migração.
//
// IMPORTANTE: o SDK da OpenAI lança erro no construtor se a apiKey for vazia.
// Como o OCR é opcional, NÃO podemos derrubar o app inteiro no boot por falta
// da chave. Usamos um placeholder quando ela não está configurada — o app sobe
// normalmente e apenas as chamadas de OCR falham até a chave real ser definida.
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
