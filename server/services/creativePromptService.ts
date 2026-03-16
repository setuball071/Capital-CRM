// ─── CSS / code patterns to strip (entire line) ──────────────────────────────
const CSS_PROPS = [
  "font-size:", "font-weight:", "font-family:", "padding:", "margin:",
  "display:", "position:", "opacity:", "color:", "background:", "border:",
  "border-radius:", "radius:", "transform:", "transition:", "top:", "left:",
  "right:", "bottom:", "width:", "height:", "z-index:", "flex-", "grid-",
];

const CODE_TOKENS = ["{", "}", "//", "/*", "*/", "=>", "px;", "em;", "%;"];

const SYMBOL_ONLY_RE = /^[\s!@#$%^&*()\-=+[\]|<>,.?/\\;:'"~`]+$/;
const LONE_HEX_RE = /^\s*#[0-9a-fA-F]{3,8}\s*\d*\s*$/;

function stripCodeLines(text: string): string {
  const lines = text.split("\n");
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // preserve blank lines

    const lower = trimmed.toLowerCase();

    if (CSS_PROPS.some((p) => lower.includes(p))) return false;
    if (CODE_TOKENS.some((t) => trimmed.includes(t))) return false;
    if (SYMBOL_ONLY_RE.test(trimmed)) return false;
    if (LONE_HEX_RE.test(trimmed)) return false;

    return true;
  });

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Gemini rewrite ───────────────────────────────────────────────────────────
const GEMINI_SYSTEM =
  "You are a creative director converting user descriptions into clean visual " +
  "prompts for an AI image generator. Rewrite the input as a clear, descriptive " +
  "visual prompt in English. Focus on: colors, layout, typography style, mood, " +
  "visual elements. Remove any code syntax. Keep brand names and Portuguese text " +
  "values (like headlines) as-is but describe them visually. Maximum 150 words. " +
  "Return only the rewritten prompt, no explanations.";

async function rewriteWithGemini(text: string): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: GEMINI_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.4 },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini rewrite returned ${res.status}`);
  }

  const data = await res.json();
  const rewritten = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!rewritten) throw new Error("Empty Gemini response");
  return rewritten;
}

// ─── Public: sanitize + optionally rewrite ────────────────────────────────────
export async function sanitizePrompt(userPrompt: string): Promise<string> {
  const sanitized = stripCodeLines(userPrompt) || userPrompt;

  try {
    return await rewriteWithGemini(sanitized);
  } catch (err: any) {
    console.warn("[sanitizePrompt] Gemini rewrite failed, using sanitized text:", err?.message);
    return sanitized;
  }
}

// ─── Brand Config type ────────────────────────────────────────────────────────
export interface BrandConfig {
  systemPrompt?: string;
  logoBase64?: string;
}

// ─── Build final prompt for Imagen ───────────────────────────────────────────
export function buildImagePrompt(
  userPrompt: string,
  aspectRatio: string,
  personalizable: boolean,
  brandConfig?: BrandConfig,
): string {
  const signatureBlock = personalizable
    ? `Bottom 15% of image: solid white horizontal strip, completely empty, reserved for agent card overlay`
    : "";

  const brandDirectives = brandConfig?.systemPrompt?.trim()
    ? `BRAND DIRECTIVES (always follow these):\n${brandConfig.systemPrompt.trim()}\n\n`
    : "";

  const logoHint = brandConfig?.logoBase64
    ? `The company logo is provided as reference — place it prominently in the top-left or top-center area of the image.\n`
    : `Top section: small rectangular white box (logo placeholder) with the brand name centered\n`;

  return `${brandDirectives}USER REQUEST:
${userPrompt}

Technical requirements — apply these silently:
${logoHint}Color scheme must include deep purple tones and pink/magenta accents if not specified above
The image must look like a finished advertisement, not a wireframe or code diagram
No CSS code, no HTML tags, no programming syntax visible anywhere in the image
No placeholder labels like "Block 1", "padding", "font-size" — these must NEVER appear
All text in the image must be clean, rendered as designed typography
Crisp, high-resolution, print-quality output
${signatureBlock}`.trim();
}
