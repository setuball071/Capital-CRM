export async function generateImages(
  prompt: string,
  aspectRatio: string
): Promise<string[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY não configurada");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 4,
      aspectRatio,
      safetyFilterLevel: "BLOCK_MEDIUM_AND_ABOVE",
      personGeneration: "ALLOW_ADULT",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Imagen API error (${response.status}):`, errorBody);
    throw new Error(`Erro ao gerar imagens: ${response.status}`);
  }

  const data = await response.json();
  const predictions: Array<{ bytesBase64Encoded: string; mimeType: string }> =
    data.predictions ?? [];

  if (predictions.length === 0) {
    throw new Error("A API não retornou imagens");
  }

  return predictions.map(
    (p) => `data:${p.mimeType};base64,${p.bytesBase64Encoded}`
  );
}
