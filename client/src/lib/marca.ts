// Cor e nome da marca do ambiente em JavaScript.
//
// O CSS ja resolve a marca por variavel, mas quem desenha PDF (jsPDF) precisa
// dos numeros. Lemos a propria variavel --primary que o TenantThemeProvider
// aplicou, para nao existir uma segunda fonte de verdade que possa divergir.

/** Converte "H S% L%" em [r, g, b]. */
export function hslParaRgb(hsl: string): [number, number, number] | null {
  const p = hsl.trim().split(/\s+/);
  if (p.length < 3) return null;
  const h = parseFloat(p[0]);
  const s = parseFloat(p[1]) / 100;
  const l = parseFloat(p[2]) / 100;
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/** Cor primaria do ambiente em RGB. Cai no roxo antigo se o tema nao carregou. */
export function corMarcaRgb(): [number, number, number] {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim();
    return hslParaRgb(v) || [108, 43, 217];
  } catch {
    return [108, 43, 217];
  }
}

/** Cor primaria em #RRGGBB. */
export function corMarcaHex(): string {
  const [r, g, b] = corMarcaRgb();
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/**
 * Cor primaria em rgba() com a transparencia pedida.
 *
 * Existe para os documentos que o sistema gera como ARQUIVO SEPARADO (proposta
 * em PDF, impressao): eles nao enxergam as variaveis de CSS do app, entao a cor
 * precisa ir escrita por extenso no HTML, resolvida na hora da exportacao.
 */
export function corMarcaRgba(alpha: number): string {
  const [r, g, b] = corMarcaRgb();
  return `rgba(${r},${g},${b},${alpha})`;
}
