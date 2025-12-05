import OpenAI from "openai";

// Using Replit AI Integrations - no separate API key required
// This uses the environment variables provided by Replit
export const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});
