// ============================================================
// AI TEMPORARILY DISABLED FOR COST CONTROL
// To re-enable, uncomment the code below and remove the mock
// ============================================================

// import OpenAI from "openai";

// Using Replit AI Integrations - no separate API key required
// This uses the environment variables provided by Replit
// export const openai = new OpenAI({
//   baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
//   apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
// });

// Mock openai that throws error on any usage
export const openai = {
  chat: {
    completions: {
      create: async () => {
        throw new Error("AI temporarily disabled for cost control");
      }
    }
  }
} as any;
