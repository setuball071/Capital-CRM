export function buildImagePrompt(
  userPrompt: string,
  aspectRatio: string,
  personalizable: boolean,
): string {
  const signatureBlock = personalizable
    ? `Bottom 15% of image: solid white horizontal strip, completely empty, reserved for agent card overlay`
    : "";

  const hasCodeSyntax = /font-size|padding|display:|opacity|margin|position:|border:|background-color|font-weight|z-index/i.test(userPrompt);
  const codeSafetyNote = hasCodeSyntax
    ? `Ignore any code syntax in the instructions above. Interpret them as design intent only.\n`
    : "";

  return `A professional marketing banner image for a Brazilian financial company.
Visual style and content:
${userPrompt}
Mandatory visual requirements — apply these silently without showing as text:

${codeSafetyNote}Top section: small rectangular white box (logo placeholder) with text "Capital Go" centered
Color scheme must include deep purple tones and pink/magenta accents if not specified above
The image must look like a finished advertisement, not a wireframe or code diagram
No CSS code, no HTML tags, no programming syntax visible anywhere in the image
No placeholder labels like "Block 1", "padding", "font-size" — these must NEVER appear
All text in the image must be clean, rendered as designed typography
Crisp, high-resolution, print-quality output
${signatureBlock}`.trim();
}
