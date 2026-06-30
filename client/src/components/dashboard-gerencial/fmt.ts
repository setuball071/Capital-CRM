export const fmtMoeda = (v: number) =>
  "R$ " +
  (Number(v) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtNum = (v: number) => (Number(v) || 0).toLocaleString("pt-BR");

export const fmtPercent = (v: number) =>
  ((Number(v) || 0) * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + "%";

// variação percentual atual vs anterior (ex.: +12,5% / -3,0%); null se base 0
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return (atual - anterior) / anterior;
}
