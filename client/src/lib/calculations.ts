import type { CoefficientTable } from "@shared/schema";

/**
 * Calcula a parcela líquida considerando o tipo de margem de segurança
 * 
 * @param valorParcelaBruta - Valor bruto da parcela mensal
 * @param tipoMargem - Tipo de margem: 'percentual' ou 'fixo'
 * @param margemSeguranca - Valor da margem (percentual ou valor fixo em R$)
 * @returns Valor da parcela após desconto da margem
 */
export function calcularParcelaComMargem(
  valorParcelaBruta: number,
  tipoMargem: 'percentual' | 'fixo',
  margemSeguranca: number
): number {23
  let desconto: number;
  
  if (tipoMargem === 'fixo') {
    // Desconto é o valor fixo em reais
    desconto = margemSeguranca;
  } else {
    // Desconto é um percentual da parcela bruta
    desconto = valorParcelaBruta * (margemSeguranca / 100);
  }
  
  const valorParcelaFinal = valorParcelaBruta - desconto;
  
  // Garantir que a parcela final não seja negativa
  return Math.max(0, valorParcelaFinal);
}

/**
 * Calcula o saldo final ajustado com base no percentual de ajuste do banco
 * 
 * @param saldoDevedor - Saldo devedor original informado pelo cliente
 * @param ajustePercentual - Percentual de ajuste configurado para o banco (pode ser negativo ou positivo)
 * @returns Saldo final ajustado
 */
export function calcularSaldoFinalAjustado(
  saldoDevedor: number,
  ajustePercentual: number
): number {
  // O ajuste pode ser positivo (aumentar saldo) ou negativo (diminuir saldo)
  const ajuste = saldoDevedor * (ajustePercentual / 100);
  const saldoFinal = saldoDevedor + ajuste;
  
  // O saldo final não pode ser negativo
  return Math.max(0, saldoFinal);
}

/**
 * Calculate simulation result using coefficient from database
 * 
 * Formula:
 * - Principal (Total Contract Value) = Monthly Payment / Coefficient
 * - Client Refund = Principal - Outstanding Balance (adjusted by bank's balance adjustment percentage)
 */
export function calculateSimulation(
  monthlyPayment: number,
  outstandingBalance: number,
  coefficient: number,
  ajusteSaldoPercentual: number = 0
) {
  if (coefficient === 0) {
    return {
      totalContractValue: 0,
      clientRefund: 0,
      saldoFinal: outstandingBalance,
    };
  }

  // Calculate principal (total contract value) from monthly payment and coefficient
  const principal = monthlyPayment / coefficient;
  
  // Total contract value is the calculated principal
  const totalContractValue = principal;
  
  // Calculate adjusted final balance
  const saldoFinal = calcularSaldoFinalAjustado(outstandingBalance, ajusteSaldoPercentual);
  
  // Client refund is the difference between principal and adjusted outstanding balance
  const clientRefund = principal - saldoFinal;

  return {
    totalContractValue,
    clientRefund,
    saldoFinal,
  };
}

/**
 * Get unique banks from coefficient tables
 */
export function getUniqueBanks(tables: CoefficientTable[]): string[] {
  const banks = tables.map((t) => t.bank);
  return Array.from(new Set(banks)).sort();
}

/**
 * Get unique terms for a specific bank
 */
export function getTermsForBank(tables: CoefficientTable[], bank: string): number[] {
  const terms = tables
    .filter((t) => t.bank === bank)
    .map((t) => t.termMonths);
  return Array.from(new Set(terms)).sort((a, b) => a - b);
}

/**
 * Get available tables for a specific bank and term
 */
export function getTablesForBankAndTerm(
  tables: CoefficientTable[],
  bank: string,
  termMonths: number
): CoefficientTable[] {
  return tables.filter((t) => t.bank === bank && t.termMonths === termMonths);
}
