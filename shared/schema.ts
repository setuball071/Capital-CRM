import { z } from "zod";

// Client data schema
export const clientDataSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { 
    message: "CPF deve estar no formato 000.000.000-00" 
  }),
  agreement: z.string().min(1, { message: "Selecione um convênio" }),
});

export type ClientData = z.infer<typeof clientDataSchema>;

// Operation data schema
export const operationDataSchema = z.object({
  monthlyPayment: z.number()
    .positive({ message: "Parcela deve ser maior que zero" })
    .max(1000000, { message: "Valor muito alto" }),
  outstandingBalance: z.number()
    .positive({ message: "Saldo devedor deve ser maior que zero" })
    .max(10000000, { message: "Saldo muito alto" }),
  bank: z.string().min(1, { message: "Selecione um banco" }),
  term: z.number()
    .int({ message: "Prazo deve ser um número inteiro" })
    .positive({ message: "Selecione um prazo" })
    .max(360, { message: "Prazo máximo é 360 meses" }),
  coefficientTable: z.string().min(1, { message: "Selecione uma tabela" }),
});

export type OperationData = z.infer<typeof operationDataSchema>;

// Complete simulation input
export const simulationInputSchema = z.object({
  client: clientDataSchema,
  operation: operationDataSchema,
});

export type SimulationInput = z.infer<typeof simulationInputSchema>;

// Coefficient table entry
export interface CoefficientEntry {
  bank: string;
  term: number;
  table: string;
  coefficient: number;
}

// Simulation result
export interface SimulationResult {
  totalContractValue: number;
  clientRefund: number;
  coefficient: number;
}

// Predefined coefficient tables
export const coefficientTables: CoefficientEntry[] = [
  // Banco do Brasil - Tabela A
  { bank: "Banco do Brasil", term: 12, table: "Tabela A", coefficient: 0.0875 },
  { bank: "Banco do Brasil", term: 24, table: "Tabela A", coefficient: 0.0462 },
  { bank: "Banco do Brasil", term: 36, table: "Tabela A", coefficient: 0.0324 },
  { bank: "Banco do Brasil", term: 48, table: "Tabela A", coefficient: 0.0256 },
  { bank: "Banco do Brasil", term: 60, table: "Tabela A", coefficient: 0.0216 },
  { bank: "Banco do Brasil", term: 72, table: "Tabela A", coefficient: 0.0189 },
  { bank: "Banco do Brasil", term: 84, table: "Tabela A", coefficient: 0.0169 },
  
  // Banco do Brasil - Tabela B
  { bank: "Banco do Brasil", term: 12, table: "Tabela B", coefficient: 0.0892 },
  { bank: "Banco do Brasil", term: 24, table: "Tabela B", coefficient: 0.0478 },
  { bank: "Banco do Brasil", term: 36, table: "Tabela B", coefficient: 0.0338 },
  { bank: "Banco do Brasil", term: 48, table: "Tabela B", coefficient: 0.0268 },
  { bank: "Banco do Brasil", term: 60, table: "Tabela B", coefficient: 0.0227 },
  { bank: "Banco do Brasil", term: 72, table: "Tabela B", coefficient: 0.0199 },
  { bank: "Banco do Brasil", term: 84, table: "Tabela B", coefficient: 0.0178 },
  
  // Caixa Econômica Federal - Tabela A
  { bank: "Caixa Econômica Federal", term: 12, table: "Tabela A", coefficient: 0.0881 },
  { bank: "Caixa Econômica Federal", term: 24, table: "Tabela A", coefficient: 0.0468 },
  { bank: "Caixa Econômica Federal", term: 36, table: "Tabela A", coefficient: 0.0329 },
  { bank: "Caixa Econômica Federal", term: 48, table: "Tabela A", coefficient: 0.0261 },
  { bank: "Caixa Econômica Federal", term: 60, table: "Tabela A", coefficient: 0.0221 },
  { bank: "Caixa Econômica Federal", term: 72, table: "Tabela A", coefficient: 0.0193 },
  { bank: "Caixa Econômica Federal", term: 84, table: "Tabela A", coefficient: 0.0173 },
  
  // Bradesco - Tabela A
  { bank: "Bradesco", term: 12, table: "Tabela A", coefficient: 0.0886 },
  { bank: "Bradesco", term: 24, table: "Tabela A", coefficient: 0.0472 },
  { bank: "Bradesco", term: 36, table: "Tabela A", coefficient: 0.0333 },
  { bank: "Bradesco", term: 48, table: "Tabela A", coefficient: 0.0264 },
  { bank: "Bradesco", term: 60, table: "Tabela A", coefficient: 0.0224 },
  { bank: "Bradesco", term: 72, table: "Tabela A", coefficient: 0.0196 },
  { bank: "Bradesco", term: 84, table: "Tabela A", coefficient: 0.0176 },
];

// Available options
export const agreements = [
  "INSS",
  "Governo Federal",
  "Governo Estadual",
  "Governo Municipal",
  "Forças Armadas",
];

export const banks = [
  "Banco do Brasil",
  "Caixa Econômica Federal",
  "Bradesco",
];

export const availableTerms = [12, 24, 36, 48, 60, 72, 84];
