// Contador de dias úteis para portabilidade (a partir da DATA CIP)
// Conta apenas dias úteis (segunda a sexta); feriados não são considerados.

export function parseCipDate(s?: string | null): Date | null {
  if (!s) return null;
  let y: number, m: number, d: number;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    [y, m, d] = s.slice(0, 10).split("-").map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    [d, m, y] = s.slice(0, 10).split("/").map(Number);
  } else {
    return null;
  }
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

// Dias úteis decorridos APÓS `start` até `end` (inclusive end)
export function businessDaysBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) count++;
  }
  return count;
}

export type CipState = "ok" | "near" | "due";
export interface CipInfo {
  elapsed: number;   // dias úteis decorridos
  dayNum: number;    // limitado ao total
  total: number;
  state: CipState;
  label: string;     // ex.: "CIP 3/5 dias úteis"
}

// total = prazo padrão de 5 dias úteis
export function cipInfo(dataCip?: string | null, total = 5): CipInfo | null {
  const start = parseCipDate(dataCip);
  if (!start) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const elapsed = businessDaysBetween(start, today);
  const dayNum = Math.min(elapsed, total);
  let state: CipState = "ok";
  if (elapsed >= total) state = "due";
  else if (elapsed >= total - 2) state = "near"; // 3º/4º dia útil → alerta
  const label = state === "due" ? `CIP ${total}+ dias úteis` : `CIP ${dayNum}/${total} dias úteis`;
  return { elapsed, dayNum, total, state, label };
}
