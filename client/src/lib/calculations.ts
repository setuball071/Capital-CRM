import type { OperationData, SimulationResult, CoefficientEntry } from "@shared/schema";
import { coefficientTables } from "@shared/schema";

/**
 * Get coefficient for a specific bank, term, and table combination
 */
export function getCoefficient(
  bank: string,
  term: number,
  table: string
): number {
  const entry = coefficientTables.find(
    (c) => c.bank === bank && c.term === term && c.table === table
  );
  return entry?.coefficient || 0;
}

/**
 * Get available tables for a specific bank and term
 */
export function getAvailableTables(bank: string, term: number): string[] {
  const tables = coefficientTables
    .filter((c) => c.bank === bank && c.term === term)
    .map((c) => c.table);
  return [...new Set(tables)];
}

/**
 * Calculate simulation result using coefficient table
 * 
 * Formula:
 * - Principal (Total Contract Value) = Monthly Payment / Coefficient
 * - Client Refund = Principal - Outstanding Balance
 * 
 * The coefficient determines how much loan principal each R$1 of monthly payment can support.
 * For example, with coefficient 0.0216 and payment R$ 1,000:
 * - Principal = 1000 / 0.0216 = R$ 46,296.30
 * - If outstanding balance is R$ 40,000, client refund = R$ 6,296.30
 */
export function calculateSimulation(operation: OperationData): SimulationResult {
  const coefficient = getCoefficient(
    operation.bank,
    operation.term,
    operation.coefficientTable
  );

  if (coefficient === 0) {
    return {
      totalContractValue: 0,
      clientRefund: 0,
      coefficient: 0,
    };
  }

  // Calculate principal (total contract value) from monthly payment and coefficient
  const principal = operation.monthlyPayment / coefficient;
  
  // Total contract value is the calculated principal
  const totalContractValue = principal;
  
  // Client refund is the difference between principal and outstanding balance
  const clientRefund = principal - operation.outstandingBalance;

  return {
    totalContractValue,
    clientRefund,
    coefficient,
  };
}
