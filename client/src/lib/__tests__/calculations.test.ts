import { calculateSimulation, getCoefficient, getAvailableTables } from '../calculations';
import type { OperationData } from '@shared/schema';

describe('getCoefficient', () => {
  it('should return correct coefficient for valid bank, term, and table', () => {
    const coefficient = getCoefficient('Banco do Brasil', 60, 'Tabela A');
    expect(coefficient).toBe(0.0216);
  });

  it('should return 0 for invalid combination', () => {
    const coefficient = getCoefficient('Invalid Bank', 60, 'Tabela A');
    expect(coefficient).toBe(0);
  });
});

describe('getAvailableTables', () => {
  it('should return available tables for a bank and term', () => {
    const tables = getAvailableTables('Banco do Brasil', 60);
    expect(tables).toContain('Tabela A');
    expect(tables).toContain('Tabela B');
    expect(tables.length).toBe(2);
  });

  it('should return empty array for invalid bank', () => {
    const tables = getAvailableTables('Invalid Bank', 60);
    expect(tables).toEqual([]);
  });
});

describe('calculateSimulation', () => {
  it('should calculate correct principal and refund', () => {
    const operation: OperationData = {
      monthlyPayment: 1000,
      outstandingBalance: 40000,
      bank: 'Banco do Brasil',
      term: 60,
      coefficientTable: 'Tabela A',
    };

    const result = calculateSimulation(operation);

    // With coefficient 0.0216, principal = 1000 / 0.0216 = 46,296.30
    expect(result.totalContractValue).toBeCloseTo(46296.30, 1);
    expect(result.clientRefund).toBeCloseTo(6296.30, 1);
    expect(result.coefficient).toBe(0.0216);
  });

  it('should calculate correct refund when balance is higher than principal', () => {
    const operation: OperationData = {
      monthlyPayment: 500,
      outstandingBalance: 50000,
      bank: 'Caixa Econômica Federal',
      term: 24,
      coefficientTable: 'Tabela A',
    };

    const result = calculateSimulation(operation);

    // With coefficient 0.0468, principal = 500 / 0.0468 = 10,683.76
    expect(result.totalContractValue).toBeCloseTo(10683.76, 1);
    // Refund is negative (client owes more)
    expect(result.clientRefund).toBeCloseTo(-39316.24, 1);
  });

  it('should return zeros when coefficient is not found', () => {
    const operation: OperationData = {
      monthlyPayment: 1000,
      outstandingBalance: 40000,
      bank: 'Invalid Bank',
      term: 60,
      coefficientTable: 'Tabela A',
    };

    const result = calculateSimulation(operation);

    expect(result.totalContractValue).toBe(0);
    expect(result.clientRefund).toBe(0);
    expect(result.coefficient).toBe(0);
  });
});
