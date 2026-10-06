/**
 * Format number as Brazilian currency (R$)
 * Example: 1234.56 => "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format CPF with mask
 * Example: "12345678900" => "123.456.789-00"
 */
export function formatCPF(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
}

/**
 * Parse CPF string to formatted value
 */
export function parseCPF(value: string): string {
  return formatCPF(value);
}

/**
 * Parse Brazilian currency string to number
 * Example: "R$ 1.234,56" => 1234.56
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Parse Brazilian currency string or number to number (robust version)
 * Handles: number, string with R$, string with Brazilian format (1.234,56)
 * Examples: 
 *   301.86 => 301.86
 *   "301.86" => 301.86  
 *   "R$ 301,86" => 301.86
 *   "1.530.480,77" => 1530480.77
 *   "R$ 1.234,56" => 1234.56
 */
export function parseCurrencyBR(value: unknown): number {
  // Already a number
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  
  // Null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  const str = String(value).trim();
  
  // Check if it's a simple numeric string (like "301.86" from API)
  // This handles cases where backend returns numeric strings with dot as decimal
  if (/^-?\d+\.?\d*$/.test(str)) {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }
  
  // Handle Brazilian format: remove R$, remove thousand separators (.), replace decimal comma with dot
  const cleaned = str
    .replace(/[^\d,.-]/g, '')  // Keep only digits, comma, dot, minus
    .replace(/\./g, '')         // Remove thousand separators (dots)
    .replace(',', '.');         // Replace decimal comma with dot
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Data de nascimento sem armadilha de fuso.
 *
 * O servidor no Railway roda em UTC e manda `1973-03-15T00:00:00.000Z`. Como o
 * navegador aqui esta em UTC-3, `new Date(raw).toLocaleDateString('pt-BR')`
 * devolvia `14/03/1973` -- um dia a menos, SEMPRE. (ROBERTO FRANCISCO DE
 * OLIVEIRA, CPF 666.637.334-00, 06/10/2026.)
 *
 * A saida certa e ler ano, mes e dia do proprio texto, sem criar Date e sem
 * conversao de fuso. Aceita ISO (`1973-03-15...`) e BR (`15/03/1973`).
 */
export function parseDataNascimento(
  raw: string | Date | null | undefined,
): { dia: number; mes: number; ano: number } | null {
  if (!raw) return null;
  const txt = raw instanceof Date ? raw.toISOString() : String(raw);
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { ano: +iso[1], mes: +iso[2], dia: +iso[3] };
  const br = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return { dia: +br[1], mes: +br[2], ano: +br[3] };
  return null;
}

/** `1973-03-15T00:00:00.000Z` ou `15/03/1973` -> `15/03/1973`. */
export function formatDataNascimento(raw: string | Date | null | undefined): string {
  const d = parseDataNascimento(raw);
  if (!d) return '-';
  return `${String(d.dia).padStart(2, '0')}/${String(d.mes).padStart(2, '0')}/${d.ano}`;
}

/** Idade em anos completos hoje, pela mesma leitura sem fuso. */
export function calcularIdade(raw: string | Date | null | undefined): number | null {
  const d = parseDataNascimento(raw);
  if (!d) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.ano;
  const mesHoje = hoje.getMonth() + 1;
  if (mesHoje < d.mes || (mesHoje === d.mes && hoje.getDate() < d.dia)) idade--;
  return idade;
}
