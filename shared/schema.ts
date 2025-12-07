import { pgTable, serial, text, varchar, decimal, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== DATABASE TABLES =====

// User roles enum - includes legacy roles (master, coordenacao) and new roles (atendimento, operacional)
export const USER_ROLES = ["master", "coordenacao", "atendimento", "operacional", "vendedor"] as const;
export type UserRole = typeof USER_ROLES[number];

// Role labels for display
export const ROLE_LABELS: Record<UserRole, string> = {
  master: "Administrador",
  coordenacao: "Coordenador",
  atendimento: "Atendimento",
  operacional: "Operacional",
  vendedor: "Vendedor",
};

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("vendedor"), // 'admin', 'coordenador', 'atendimento', 'operacional', 'vendedor'
  managerId: integer("manager_id").references(() => users.id, { onDelete: "set null" }), // For vendedor -> coordenador hierarchy
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Banks table - stores bank-specific configurations
export const banks = pgTable("banks", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  // Percentual de ajuste aplicado sobre o saldo devedor (ex: 2.5 = 2,5%)
  ajusteSaldoPercentual: decimal("ajuste_saldo_percentual", { precision: 5, scale: 2 }).notNull().default("0"),
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

// Roteiros Bancários - stores banking scripts/guides for operations
export const roteirosBancarios = pgTable("roteiros_bancarios", {
  id: serial("id").primaryKey(),
  banco: varchar("banco", { length: 100 }).notNull(),
  convenio: varchar("convenio", { length: 150 }).notNull(),
  segmento: varchar("segmento", { length: 50 }),
  tipoOperacao: varchar("tipo_operacao", { length: 50 }).notNull(),
  dados: jsonb("dados").notNull(), // Stores all additional data as JSONB
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== INSERT SCHEMAS =====

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email({ message: "Email inválido" }),
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  passwordHash: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
  role: z.enum(USER_ROLES, { message: "Role inválido" }),
}).omit({ id: true, createdAt: true });

export const insertBankSchema = createInsertSchema(banks, {
  name: z.string().min(1, { message: "Nome do banco é obrigatório" }),
  ajusteSaldoPercentual: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= -100 && num <= 100;
    },
    { message: "Ajuste de saldo deve ser entre -100% e 100%" }
  ).default("0"),
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

// Schema for faixa de idade in roteiro bancário
export const faixaIdadeSchema = z.object({
  idade_minima: z.number().nullable(),
  idade_maxima: z.number().nullable(),
  limite_parcela: z.number().nullable(),
  observacoes: z.string().optional(),
});

// Schema for limites operacionais
export const limitesOperacionaisSchema = z.object({
  prazo_minimo_meses: z.number().nullable(),
  prazo_maximo_meses: z.number().nullable(),
  parcela_minima: z.number().nullable(),
  valor_minimo_liberado: z.string().optional(),
  margem_especifica: z.string().optional(),
  margem_negativa_permitida: z.boolean().nullable(),
  descricao_margem_negativa: z.string().optional(),
});

// Schema for portal de acesso
export const portalAcessoSchema = z.object({
  orgao_ou_segmento: z.string().optional(),
  nome_portal: z.string().optional(),
  link_portal: z.string().optional(),
  instrucoes_acesso: z.string().optional(),
  observacoes: z.string().optional(),
});

// Schema for dados field in roteiro bancário
export const roteiroDadosSchema = z.object({
  publico_alvo: z.array(z.string()).optional(),
  publico_nao_atendido: z.array(z.string()).optional(),
  faixas_idade: z.array(faixaIdadeSchema).optional(),
  limites_operacionais: limitesOperacionaisSchema.optional(),
  documentacao_obrigatoria: z.array(z.string()).optional(),
  portais_acesso: z.array(portalAcessoSchema).optional(),
  regras_especiais: z.array(z.string()).optional(),
  detalhes_adicionais: z.array(z.string()).optional(),
});

// Schema for individual roteiro in import
export const roteiroImportItemSchema = z.object({
  banco: z.string().min(1, { message: "Banco é obrigatório" }),
  convenio: z.string().min(1, { message: "Convênio é obrigatório" }),
  segmento: z.string().optional(),
  tipo_operacao: z.string().optional().default("Não especificado"),
  publico_alvo: z.array(z.string()).optional(),
  publico_nao_atendido: z.array(z.string()).optional(),
  faixas_idade: z.array(faixaIdadeSchema).optional(),
  limites_operacionais: limitesOperacionaisSchema.optional(),
  documentacao_obrigatoria: z.array(z.string()).optional(),
  portais_acesso: z.array(portalAcessoSchema).optional(),
  regras_especiais: z.array(z.string()).optional(),
  detalhes_adicionais: z.array(z.string()).optional(),
});

// Schema for import JSON request
export const roteirosImportSchema = z.object({
  roteiros: z.array(roteiroImportItemSchema).min(1, { message: "Pelo menos um roteiro é necessário" }),
});

export type RoteiroImportItem = z.infer<typeof roteiroImportItemSchema>;
export type RoteirosImport = z.infer<typeof roteirosImportSchema>;
export type RoteiroDados = z.infer<typeof roteiroDadosSchema>;

// ===== SELECT TYPES =====

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Bank = typeof banks.$inferSelect;
export type InsertBank = z.infer<typeof insertBankSchema>;

export type Agreement = typeof agreements.$inferSelect;
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;

export type CoefficientTable = typeof coefficientTables.$inferSelect;
export type InsertCoefficientTable = z.infer<typeof insertCoefficientTableSchema>;

export type Simulation = typeof simulations.$inferSelect;
export type InsertSimulation = z.infer<typeof insertSimulationSchema>;

export type RoteiroBancario = typeof roteirosBancarios.$inferSelect;

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
  role: z.enum(USER_ROLES, { message: "Role inválido" }),
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

// ===== BASE DE CLIENTES TABLES =====

// Status for bases importadas
export const BASE_STATUS = ["processando", "concluida", "erro"] as const;
export type BaseStatus = typeof BASE_STATUS[number];

// Status for pedidos lista
export const PEDIDO_STATUS = ["pendente", "aprovado", "processando", "concluido", "cancelado"] as const;
export type PedidoStatus = typeof PEDIDO_STATUS[number];

// 1) clientes_pessoa - Dados fixos do indivíduo (1 pessoa = 1 matrícula)
export const clientesPessoa = pgTable("clientes_pessoa", {
  id: serial("id").primaryKey(),
  cpf: varchar("cpf", { length: 14 }),
  matricula: varchar("matricula", { length: 50 }).notNull().unique(),
  nome: varchar("nome", { length: 255 }),
  orgaodesc: varchar("orgaodesc", { length: 255 }),
  orgaocod: varchar("orgaocod", { length: 50 }),
  undpagadoradesc: varchar("undpagadoradesc", { length: 255 }),
  undpagadoracod: varchar("undpagadoracod", { length: 50 }),
  natureza: varchar("natureza", { length: 100 }),
  sitFunc: varchar("sit_func", { length: 100 }), // ativo, pensionista, aposentado etc.
  convenio: varchar("convenio", { length: 100 }),
  uf: varchar("uf", { length: 2 }),
  municipio: varchar("municipio", { length: 150 }),
  telefonesBase: jsonb("telefones_base"), // TELEFONE 1..5 em array
  baseTagUltima: varchar("base_tag_ultima", { length: 100 }),
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
  extrasPessoa: jsonb("extras_pessoa"), // tudo que não for mapeado diretamente
});

// 2) clientes_folha_mes - Dados agregados da folha por competência
export const clientesFolhaMes = pgTable("clientes_folha_mes", {
  id: serial("id").primaryKey(),
  pessoaId: integer("pessoa_id").references(() => clientesPessoa.id, { onDelete: "cascade" }).notNull(),
  competencia: timestamp("competencia").notNull(), // Ex: 2025-11-01
  margemBruta30: decimal("margem_bruta_30", { precision: 12, scale: 2 }),
  margemUtilizada30: decimal("margem_utilizada_30", { precision: 12, scale: 2 }),
  margemSaldo30: decimal("margem_saldo_30", { precision: 12, scale: 2 }),
  margemBruta35: decimal("margem_bruta_35", { precision: 12, scale: 2 }),
  margemUtilizada35: decimal("margem_utilizada_35", { precision: 12, scale: 2 }),
  margemSaldo35: decimal("margem_saldo_35", { precision: 12, scale: 2 }),
  margemBruta70: decimal("margem_bruta_70", { precision: 12, scale: 2 }),
  margemUtilizada70: decimal("margem_utilizada_70", { precision: 12, scale: 2 }),
  margemSaldo70: decimal("margem_saldo_70", { precision: 12, scale: 2 }),
  margemCartaoCreditoSaldo: decimal("margem_cartao_credito_saldo", { precision: 12, scale: 2 }),
  margemCartaoBeneficioSaldo: decimal("margem_cartao_beneficio_saldo", { precision: 12, scale: 2 }),
  creditos: decimal("creditos", { precision: 12, scale: 2 }),
  debitos: decimal("debitos", { precision: 12, scale: 2 }),
  liquido: decimal("liquido", { precision: 12, scale: 2 }),
  sitFuncNoMes: varchar("sit_func_no_mes", { length: 100 }),
  baseTag: varchar("base_tag", { length: 100 }),
  extrasFolha: jsonb("extras_folha"),
});

// 3) clientes_contratos - Cada linha de contrato/cartão/margem
export const clientesContratos = pgTable("clientes_contratos", {
  id: serial("id").primaryKey(),
  pessoaId: integer("pessoa_id").references(() => clientesPessoa.id, { onDelete: "cascade" }).notNull(),
  tipoContrato: varchar("tipo_contrato", { length: 50 }), // "consignado", "cartao", "outro", etc.
  banco: varchar("banco", { length: 100 }),
  valorParcela: decimal("valor_parcela", { precision: 12, scale: 2 }),
  competencia: timestamp("competencia"),
  baseTag: varchar("base_tag", { length: 100 }),
  dadosBrutos: jsonb("dados_brutos"), // linha completa da planilha
});

// 4) bases_importadas - Controle de importações
export const basesImportadas = pgTable("bases_importadas", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }),
  baseTag: varchar("base_tag", { length: 100 }).notNull(),
  convenio: varchar("convenio", { length: 100 }),
  competencia: timestamp("competencia"),
  totalLinhas: integer("total_linhas").default(0),
  status: varchar("status", { length: 20 }).notNull().default("processando"), // processando, concluida, erro
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
});

// 5) pedidos_lista - Pedidos de exportação de lista
export const pedidosLista = pgTable("pedidos_lista", {
  id: serial("id").primaryKey(),
  coordenadorId: integer("coordenador_id").references(() => users.id, { onDelete: "set null" }),
  filtrosUsados: jsonb("filtros_usados"),
  quantidadeRegistros: integer("quantidade_registros").default(0),
  tipo: varchar("tipo", { length: 50 }).default("exportacao_base"),
  status: varchar("status", { length: 20 }).notNull().default("pendente"), // pendente, aprovado, processando, concluido, cancelado
  // Precificação
  precoUnitario: decimal("preco_unitario", { precision: 12, scale: 4 }),
  custoEstimado: decimal("custo_estimado", { precision: 12, scale: 2 }),
  custoFinal: decimal("custo_final", { precision: 12, scale: 2 }),
  statusFinanceiro: varchar("status_financeiro", { length: 20 }), // pendente, confirmado
  // Arquivo gerado
  arquivoPath: varchar("arquivo_path", { length: 500 }),
  arquivoGeradoEm: timestamp("arquivo_gerado_em"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
});

// ===== INSERT SCHEMAS FOR BASE DE CLIENTES =====

export const insertClientePessoaSchema = createInsertSchema(clientesPessoa, {
  matricula: z.string().min(1, { message: "Matrícula é obrigatória" }),
}).omit({ id: true, atualizadoEm: true });

export const insertClienteFolhaMesSchema = createInsertSchema(clientesFolhaMes, {
  pessoaId: z.number().positive({ message: "Pessoa é obrigatória" }),
}).omit({ id: true });

export const insertClienteContratoSchema = createInsertSchema(clientesContratos, {
  pessoaId: z.number().positive({ message: "Pessoa é obrigatória" }),
}).omit({ id: true });

export const insertBaseImportadaSchema = createInsertSchema(basesImportadas, {
  baseTag: z.string().min(1, { message: "Tag da base é obrigatória" }),
}).omit({ id: true, criadoEm: true, atualizadoEm: true });

export const insertPedidoListaSchema = createInsertSchema(pedidosLista, {}).omit({ id: true, criadoEm: true, atualizadoEm: true });

// ===== SELECT TYPES FOR BASE DE CLIENTES =====

export type ClientePessoa = typeof clientesPessoa.$inferSelect;
export type InsertClientePessoa = z.infer<typeof insertClientePessoaSchema>;

export type ClienteFolhaMes = typeof clientesFolhaMes.$inferSelect;
export type InsertClienteFolhaMes = z.infer<typeof insertClienteFolhaMesSchema>;

export type ClienteContrato = typeof clientesContratos.$inferSelect;
export type InsertClienteContrato = z.infer<typeof insertClienteContratoSchema>;

export type BaseImportada = typeof basesImportadas.$inferSelect;
export type InsertBaseImportada = z.infer<typeof insertBaseImportadaSchema>;

export type PedidoLista = typeof pedidosLista.$inferSelect;
export type InsertPedidoLista = z.infer<typeof insertPedidoListaSchema>;

// ===== FILTROS PARA PEDIDOS LISTA =====

export const filtrosPedidoListaSchema = z.object({
  // Filtros de pessoa
  convenio: z.string().optional(),
  orgao: z.string().optional(),
  uf: z.string().optional(),
  idade_min: z.number().optional(),
  idade_max: z.number().optional(),
  sit_func: z.string().optional(),
  // Filtros de margem 30%
  margem_30_min: z.number().optional(),
  margem_30_max: z.number().optional(),
  // Filtros de margem 35%
  margem_35_min: z.number().optional(),
  margem_35_max: z.number().optional(),
  // Filtros de margem 70%
  margem_70_min: z.number().optional(),
  margem_70_max: z.number().optional(),
  // Filtros de margem cartão crédito (5%)
  margem_cartao_credito_min: z.number().optional(),
  margem_cartao_credito_max: z.number().optional(),
  // Filtros de margem cartão benefício (5%)
  margem_cartao_beneficio_min: z.number().optional(),
  margem_cartao_beneficio_max: z.number().optional(),
  // Filtros de contrato
  banco: z.string().optional(),
  parcela_min: z.number().optional(),
  parcela_max: z.number().optional(),
});

export type FiltrosPedidoLista = z.infer<typeof filtrosPedidoListaSchema>;
