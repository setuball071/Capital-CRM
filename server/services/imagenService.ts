import OpenAI from "openai";
import type { CreativeFormData } from "./creativePromptService";
import { buildImagePrompt, getAspectRatioForFormat } from "./creativePromptService";

// Uses real OpenAI key for DALL-E image generation
const openaiDalle = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerationResult {
  imageUrls: string[];
  promptUsed: string;
}

export async function generateCreativeImages(
  formData: CreativeFormData
): Promise<GenerationResult> {
  const prompt = buildImagePrompt(formData);
  const size = getAspectRatioForFormat(formData.formato) as
    | "1024x1024"
    | "1024x1792"
    | "1792x1024";

  const imageUrls: string[] = [];

  // DALL-E 3 generates 1 image per request — we call it 4 times for the grid
  const requests = [1, 2, 3, 4].map(() =>
    openaiDalle.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      response_format: "b64_json",
      quality: "standard",
    })
  );

  const results = await Promise.all(requests);

  for (const result of results) {
    const b64 = result.data[0]?.b64_json;
    if (b64) {
      imageUrls.push(`data:image/png;base64,${b64}`);
    }
  }

  return { imageUrls, promptUsed: prompt };
}
