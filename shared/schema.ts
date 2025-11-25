import { pgTable, serial, text, varchar, decimal, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== DATABASE TABLES =====

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("vendedor"), // 'vendedor', 'coordenacao', or 'master'
  managerId: integer("manager_id").references(() => users.id, { onDelete: "set null" }), // For vendedor -> coordenador hierarchy
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Agreements table
export const agreements = pgTable("agreements", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Coefficient tables
export const coefficientTables = pgTable("coefficient_tables", {
  id: serial("id").primaryKey(),
  agreementId: integer("agreement_id").references(() => agreements.id, { onDelete: "cascade" }).notNull(),
  operationType: varchar("operation_type", { length: 50 }).notNull().default("credit_card"), // 'credit_card', 'benefit_card', 'consignado'
  bank: varchar("bank", { length: 255 }).notNull(),
  termMonths: integer("term_months").notNull(),
  tableName: varchar("table_name", { length: 255 }).notNull(),
  coefficient: decimal("coefficient", { precision: 12, scale: 10 }).notNull(),
  safetyMargin: decimal("safety_margin", { precision: 5, scale: 2 }).notNull().default("0"),
  marginType: varchar("margin_type", { length: 20 }).notNull().default("percentual"), // 'percentual' or 'fixo'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Simulations history
export const simulations = pgTable("simulations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  agreementId: integer("agreement_id").references(() => agreements.id),
  agreementName: varchar("agreement_name", { length: 255 }), // Denormalized for history
  operationType: varchar("operation_type", { length: 50 }).notNull(), // 'credit_card', 'benefit_card', 'consignado'
  bank: varchar("bank", { length: 255 }).notNull(),
  termMonths: integer("term_months").notNull(),
  tableName: varchar("table_name", { length: 255 }).notNull(),
  coefficient: decimal("coefficient", { precision: 12, scale: 10 }).notNull(),
  monthlyPayment: decimal("monthly_payment", { precision: 12, scale: 2 }).notNull(),
  outstandingBalance: decimal("outstanding_balance", { precision: 12, scale: 2 }).notNull(),
  totalContractValue: decimal("total_contract_value", { precision: 12, scale: 2 }).notNull(),
  clientRefund: decimal("client_refund", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== INSERT SCHEMAS =====

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email({ message: "Email inválido" }),
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  passwordHash: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
  role: z.enum(["vendedor", "coordenacao", "master"], { message: "Role deve ser 'vendedor', 'coordenacao' ou 'master'" }),
}).omit({ id: true, createdAt: true });

export const insertAgreementSchema = createInsertSchema(agreements, {
  name: z.string().min(1, { message: "Nome é obrigatório" }),
}).omit({ id: true, createdAt: true });

export const insertCoefficientTableSchema = createInsertSchema(coefficientTables, {
  agreementId: z.number().positive({ message: "Convênio é obrigatório" }),
  operationType: z.enum(["credit_card", "benefit_card", "consignado"], { message: "Tipo de operação é obrigatório" }),
  bank: z.string().min(1, { message: "Banco é obrigatório" }),
  termMonths: z.number().int().min(12, { message: "Prazo mínimo é 12 meses" }).max(140, { message: "Prazo máximo é 140 meses" }),
  tableName: z.string().min(1, { message: "Nome da tabela é obrigatório" }),
  coefficient: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Coeficiente deve ser um número positivo",
  }),
  safetyMargin: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: "Margem de segurança deve ser um número não-negativo" }
  ),
  marginType: z.enum(["percentual", "fixo"]).default("percentual"),
}).omit({ id: true, createdAt: true });

export const insertSimulationSchema = createInsertSchema(simulations, {
  clientName: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  monthlyPayment: z.string().refine((val) => parseFloat(val) > 0, { message: "Parcela deve ser positiva" }),
  outstandingBalance: z.string().refine((val) => parseFloat(val) > 0, { message: "Saldo deve ser positiva" }),
}).omit({ id: true, createdAt: true });

// ===== SELECT TYPES =====

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Agreement = typeof agreements.$inferSelect;
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;

export type CoefficientTable = typeof coefficientTables.$inferSelect;
export type InsertCoefficientTable = z.infer<typeof insertCoefficientTableSchema>;

export type Simulation = typeof simulations.$inferSelect;
export type InsertSimulation = z.infer<typeof insertSimulationSchema>;

// ===== AUTHENTICATION SCHEMAS =====

export const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(1, { message: "Senha é obrigatória" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
  role: z.enum(["vendedor", "coordenacao", "master"], { message: "Role deve ser 'vendedor', 'coordenacao' ou 'master'" }),
  managerId: z.number().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ===== FRONTEND SCHEMAS (for calculator) =====

export const clientDataSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  agreementId: z.number().positive({ message: "Selecione um convênio" }),
});

export type ClientData = z.infer<typeof clientDataSchema>;

export const operationDataSchema = z.object({
  operationType: z.enum(["credit_card", "benefit_card", "consignado"], {
    errorMap: () => ({ message: "Selecione um tipo de operação" }),
  }),
  monthlyPayment: z.number()
    .positive({ message: "Parcela deve ser maior que zero" })
    .max(1000000, { message: "Valor muito alto" }),
  outstandingBalance: z.number()
    .positive({ message: "Saldo devedor deve ser maior que zero" })
    .max(10000000, { message: "Saldo muito alto" }),
  bank: z.string().min(1, { message: "Selecione um banco" }),
  termMonths: z.number()
    .int({ message: "Prazo deve ser um número inteiro" })
    .positive({ message: "Selecione um prazo" })
    .max(360, { message: "Prazo máximo é 360 meses" }),
  coefficientTableId: z.number().positive({ message: "Selecione uma tabela" }),
});

export type OperationData = z.infer<typeof operationDataSchema>;

export const simulationInputSchema = z.object({
  client: clientDataSchema,
  operation: operationDataSchema,
});

export type SimulationInput = z.infer<typeof simulationInputSchema>;

// Simulation result (frontend)
export interface SimulationResult {
  totalContractValue: number;
  clientRefund: number;
  coefficient: number;
}
