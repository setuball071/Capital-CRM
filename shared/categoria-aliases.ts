export const CATEGORIA_ALIASES: Record<string, string> = {
  "ARQ. UPAG": "UPAG",
  "ARQ_UPAG": "UPAG",
  "UPAG": "UPAG",
  "ORGAO": "ORGAO",
  "ÓRGÃO": "ORGAO",
  "TIPO_CONTRATO": "TIPO_CONTRATO",
  "TIPO CONTRATO": "TIPO_CONTRATO",
  "UF": "UF",
  "OUTRO": "OUTRO",
};

export const CANONICAL_CATEGORIAS = ["ORGAO", "TIPO_CONTRATO", "UPAG", "UF", "OUTRO"] as const;
export type CategoriaCanonical = typeof CANONICAL_CATEGORIAS[number];

export function normalizeCategoria(categoria: string): CategoriaCanonical {
  const normalized = categoria.trim().toUpperCase();
  const canonical = CATEGORIA_ALIASES[normalized];
  if (canonical && CANONICAL_CATEGORIAS.includes(canonical as CategoriaCanonical)) {
    return canonical as CategoriaCanonical;
  }
  return "OUTRO";
}

export function getCategoriaDisplayName(categoria: string): string {
  const displayNames: Record<string, string> = {
    "ORGAO": "Órgão",
    "TIPO_CONTRATO": "Tipo Contrato",
    "UPAG": "UPAG",
    "UF": "UF",
    "OUTRO": "Outro",
  };
  const normalized = normalizeCategoria(categoria);
  return displayNames[normalized] || categoria;
}

export function matchesCategoria(value: string, target: CategoriaCanonical): boolean {
  return normalizeCategoria(value) === target;
}
