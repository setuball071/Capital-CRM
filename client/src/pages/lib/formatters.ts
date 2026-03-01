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
