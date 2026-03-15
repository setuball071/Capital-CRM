export function buildImagePrompt(
  userPrompt: string,
  aspectRatio: string,
  personalizable: boolean,
): string {
  const personalizableBlock = personalizable
    ? `Reserve bottom white card area (full width, ~110px tall, white background, clearly separated) for agent signature: circular profile photo on left, name in bold, role text, WhatsApp number. Leave this area completely empty/white. `
    : "";

  return `Professional marketing creative for Brazilian financial services company Capital Go.
Brand colors: deep purple #6C2BD9 (dominant), electric blue #1E88E5 (accent), hot pink #E91E63 (CTA/highlights). Dark background.
Reserve top area for company logo (clean rectangular space, light background, ~200x60px).
${personalizableBlock}User instructions:
${userPrompt}
Technical specs: high quality, marketing material, no watermarks, crisp text rendering.`;
}
