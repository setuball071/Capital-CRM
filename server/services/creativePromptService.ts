export function buildImagePrompt(
  userPrompt: string,
  aspectRatio: string,
  personalizable: boolean,
): string {
  const signatureBlock = personalizable
    ? `Reserve bottom white card area (full width, ~110px tall, white background, completely empty) for agent signature overlay. No text, no elements in this zone.`
    : "";

  return `${userPrompt}

Technical requirements (do not override the above):

Image format: ${aspectRatio} vertical orientation
High quality, sharp rendering, no watermarks
Brand: Capital Go (if not specified otherwise in prompt above)
${signatureBlock}`.trim();
}
