// Normaliza convênio removendo acentos, espaços extras e convertendo para uppercase
export function normalizeConvenio(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ") // múltiplos espaços -> 1 espaço
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toUpperCase();
}
