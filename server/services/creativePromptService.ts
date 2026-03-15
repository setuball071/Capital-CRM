export type CreativeFormat = "square" | "portrait" | "story" | "banner";
export type CreativeStyle = "fotorrealista" | "moderno_clean" | "bold_typographic";

export interface CreativeFormData {
  tema: string;
  convenio: string;
  formato: CreativeFormat;
  headline: string;
  examples: Array<{ label: string; value: string }>;
  cta: string;
  style: CreativeStyle;
}

const STYLE_MAP: Record<CreativeStyle, string> = {
  fotorrealista:
    "cinematic lighting, real people smiling, professional photography style, photorealistic rendering",
  moderno_clean:
    "flat design, geometric shapes, minimal layout, clean lines, modern UI aesthetic",
  bold_typographic:
    "typography-focused, strong contrast, editorial layout, bold sans-serif fonts",
};

const FORMAT_LABEL: Record<CreativeFormat, string> = {
  square: "1:1 post",
  portrait: "4:5 portrait",
  story: "9:16 story",
  banner: "4:5 banner",
};

export function buildImagePrompt(formData: CreativeFormData): string {
  const styleDesc = STYLE_MAP[formData.style];

  let examplesBlock = "";
  if (formData.examples && formData.examples.length > 0) {
    const items = formData.examples
      .map((e) => `"${e.label}: ${e.value}"`)
      .join(", ");
    examplesBlock = `Display financial highlight badges inside the creative showing: ${items}. `;
  }

  const prompt = `Professional financial services advertisement for Brazilian consignado credit company. ${styleDesc}. Color palette: deep purple (#6C2BD9) as primary, electric blue (#1E88E5) and vibrant pink (#E91E63) as accent colors on dark background. Logo area reserved at top center. Main headline in large bold white text: "${formData.headline}". Subtitle text: "${formData.convenio} - ${formData.tema}". ${examplesBlock}CTA button prominently displayed: "${formData.cta}". Bottom area: clean space reserved for agent signature. Format: ${FORMAT_LABEL[formData.formato]}. High quality marketing material, no watermarks, no text errors, professional design, suitable for Brazilian financial services company.`;

  return prompt;
}

export function getAspectRatioForFormat(formato: CreativeFormat): string {
  const map: Record<CreativeFormat, string> = {
    square: "1:1",
    portrait: "4:5",
    story: "9:16",
    banner: "4:5",
  };
  return map[formato] ?? "1:1";
}
