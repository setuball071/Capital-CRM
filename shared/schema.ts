import { pgTable, serial, text, varchar, decimal, integer, bigint, boolean, timestamp, jsonb, uniqueIndex, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== DATABASE TABLES =====

// ===== MULTI-TENANT WHITE-LABEL SYSTEM =====

// Tenants table - stores each white-label environment
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(), // e.g., "goldcard", "consigcore"
  name: varchar("name", { length: 255 }).notNull(), // Display name
  logoUrl: varchar("logo_url", { length: 500 }), // Logo menu lateral
  logoLoginUrl: varchar("logo_login_url", { length: 500 }), // Logo tela de login
  faviconUrl: varchar("favicon_url", { length: 500 }),
  logoHeight: integer("logo_height").default(64), // Altura da logo no menu lateral (px)
  slogan: varchar("slogan", { length: 255 }), // Slogan/subtítulo exibido no login
  fontFamily: varchar("font_family", { length: 100 }).default("Inter"), // Fonte base
  themeJson: jsonb("theme_json"), // { primaryColor, secondaryColor, loginBgColor, etc }
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(), // Rastrear última modificação de branding
});

// Tenant Audit Log - track all branding changes
export const tenantAuditLog = pgTable("tenant_audit_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 50 }).notNull(), // BRANDING_UPDATE, LOGO_UPLOAD, ADMIN_UPDATE
  changedFields: jsonb("changed_fields"), // { field: { before: old, after: new } }
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TenantAuditLog = typeof tenantAuditLog.$inferSelect;

// Tenant Domains - maps domains to tenants
export const tenantDomains = pgTable("tenant_domains", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull().unique(), // e.g., "goldcarddigital.com.br"
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Convenios - lista padronizada de convênios por tenant
export const convenios = pgTable("convenios", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  code: varchar("code", { length: 50 }).notNull(), // Valor normalizado (SIAPE, INSS, GOV SP)
  label: varchar("label", { length: 50 }).notNull(), // Valor exibido
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  tenantCodeIdx: uniqueIndex("idx_convenios_tenant_code").on(table.tenantId, table.code),
}));

export const insertConvenioSchema = createInsertSchema(convenios, {
  label: z.string().min(2, "Mínimo 2 caracteres").max(40, "Máximo 40 caracteres"),
}).omit({ id: true, createdAt: true, code: true, tenantId: true });

export type Convenio = typeof convenios.$inferSelect;
export type InsertConvenio = z.infer<typeof insertConvenioSchema>;

// User Tenants - links users to their allowed tenants
export const userTenants = pgTable("user_tenants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  roleInTenant: varchar("role_in_tenant", { length: 50 }).default("vendedor"), // Override role per tenant if needed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas for tenant system
export const insertTenantSchema = createInsertSchema(tenants, {
  key: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/, "Key must be lowercase alphanumeric with dashes/underscores"),
  name: z.string().min(1).max(255),
}).omit({ id: true, createdAt: true });

export const insertTenantDomainSchema = createInsertSchema(tenantDomains, {
  domain: z.string().min(1).max(255),
}).omit({ id: true, createdAt: true });

export const insertUserTenantSchema = createInsertSchema(userTenants).omit({ id: true, createdAt: true });

// Types for tenant system
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export type TenantDomain = typeof tenantDomains.$inferSelect;
export type InsertTenantDomain = z.infer<typeof insertTenantDomainSchema>;

export type UserTenant = typeof userTenants.$inferSelect;
export type InsertUserTenant = z.infer<typeof insertUserTenantSchema>;

// Theme schema for validation
export const tenantThemeSchema = z.object({
  primaryColor: z.string().optional(), // Cor primária (botões, menus)
  secondaryColor: z.string().optional(), // Cor secundária (destaques)
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(), // Cor de texto principal
  borderColor: z.string().optional(), // Cor de bordas/divisórias
  successColor: z.string().optional(), // Cor de status sucesso
  errorColor: z.string().optional(), // Cor de status erro
  warningColor: z.string().optional(), // Cor de status alerta
  headerColor: z.string().optional(),
  sidebarColor: z.string().optional(),
  loginBgColor: z.string().optional(), // Cor de fundo da tela de login
  loginBgImage: z.string().optional(), // Imagem de fundo do login (URL)
  sidebarBgColor: z.string().optional(), // Cor de fundo do menu lateral
  sidebarFontColor: z.string().optional(), // Cor da fonte do menu lateral
  // Gradientes CSS (strings CSS geradas)
  sidebarGradient: z.string().optional(), // CSS gradient para sidebar (ex: linear-gradient(135deg, #FF6B00 0%, #FF1493 50%, #9C27B0 100%))
  loginGradient: z.string().optional(), // CSS gradient para tela de login
  primaryGradient: z.string().optional(), // Gradiente primário para botões
  useSidebarGradient: z.boolean().optional(), // Usar gradiente no sidebar
  useLoginGradient: z.boolean().optional(), // Usar gradiente no login
  // Configurações estruturadas dos gradientes (para editor visual)
  sidebarGradientConfig: z.object({
    stops: z.array(z.object({
      color: z.string(),
      position: z.number(),
    })),
    direction: z.string(),
  }).optional(),
  loginGradientConfig: z.object({
    stops: z.array(z.object({
      color: z.string(),
      position: z.number(),
    })),
    direction: z.string(),
  }).optional(),
  // Tipografia avançada
  fontSize: z.string().optional(), // Tamanho da fonte (px ou rem)
  fontWeight: z.string().optional(), // Peso da fonte (400, 500, 600, 700)
  fontColor: z.string().optional(), // Cor da fonte principal
  customFontUrl: z.string().optional(), // URL de fonte externa (Google Fonts)
  welcomeText: z.string().optional(), // Texto de boas-vindas
  footerText: z.string().optional(), // Texto do rodapé
  showSlogan: z.boolean().optional(), // Exibir ou ocultar slogan
  showSystemName: z.boolean().optional(), // Exibir ou ocultar nome do sistema na tela de login
  // Metadados de edição
  lastEditedBy: z.string().optional(), // Nome do usuário que editou
  lastEditedAt: z.string().optional(), // Data/hora da última edição
});

export type TenantTheme = z.infer<typeof tenantThemeSchema>;

// Schema para atualização de personalização visual
export const tenantBrandingSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255),
  slogan: z.string().max(255).optional(),
  fontFamily: z.string().optional(),
  themeJson: tenantThemeSchema.optional(),
});

export type TenantBranding = z.infer<typeof tenantBrandingSchema>;

// ===== USER SYSTEM =====

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
  isMaster: boolean("is_master").notNull().default(false), // Master users can access all tenants
  horarioAcessoInicio: time("horario_acesso_inicio"), // Ex: "08:00"
  horarioAcessoFim: time("horario_acesso_fim"), // Ex: "18:00"
  diasAcessoPermitidos: text("dias_acesso_permitidos"), // JSON array Ex: ["seg", "ter", "qua", "qui", "sex"]
  restringirPorIp: boolean("restringir_por_ip").default(false),
  ipsPermitidos: text("ips_permitidos"), // JSON array Ex: ["192.168.1.100", "192.168.1.101"]
  employeeId: integer("employee_id"), // References employees(id) - FK constraint exists in DB
  metaMensal: decimal("meta_mensal", { precision: 12, scale: 2 }),
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
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
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
  observacoes: z.string().optional().default(""),
});

// Schema for limites operacionais
export const limitesOperacionaisSchema = z.object({
  prazo_minimo_meses: z.number().nullable(),
  prazo_maximo_meses: z.number().nullable(),
  parcela_minima: z.number().nullable(),
  valor_minimo_liberado: z.string().optional().default(""),
  margem_especifica: z.string().optional().default(""),
  margem_negativa_permitida: z.boolean().nullable(),
  descricao_margem_negativa: z.string().optional().default(""),
});

// Schema for portal de acesso
export const portalAcessoSchema = z.object({
  orgao_ou_segmento: z.string().optional().default(""),
  nome_portal: z.string().optional().default(""),
  link_portal: z.string().optional().default(""),
  instrucoes_acesso: z.string().optional().default(""),
  observacoes: z.string().optional().default(""),
});

// Schema for flags operacionais (boolean indicators)
export const flagsOperacionaisSchema = z.object({
  aceita_spc_serasa: z.boolean().nullable(),
  aceita_acao_judicial: z.boolean().nullable(),
  aceita_margem_zerada: z.boolean().nullable(),
  aceita_margem_negativa: z.boolean().nullable(),
  aceita_clt: z.boolean().nullable(),
  aceita_temporario: z.boolean().nullable(),
  aceita_pensionista_temporario: z.boolean().nullable(),
  aceita_procuracao: z.boolean().nullable(),
  aceita_analfabeto: z.boolean().nullable(),
  exige_senha_averbacao: z.boolean().nullable(),
  pagamento_somente_conta_contracheque: z.boolean().nullable(),
});

// Schema for limites por subgrupo
export const limiteSubgrupoSchema = z.object({
  subgrupo: z.string().optional().default(""),
  prazo_maximo_meses: z.number().nullable(),
  idade_maxima: z.number().nullable(),
  margem_seguranca: z.string().optional().default(""),
  tabela_especifica: z.string().optional().default(""),
  observacoes: z.string().optional().default(""),
});

// Schema for perguntas frequentes mapeadas
export const perguntaFrequenteSchema = z.object({
  pergunta: z.string().optional().default(""),
  resposta: z.string().optional().default(""),
});

// Schema for metadados de busca (AI search optimization)
export const metadadosBuscaSchema = z.object({
  produto: z.string().optional().default(""),
  convenio_principal: z.string().optional().default(""),
  publico_chave: z.array(z.string()).optional().default([]),
  risco_operacional: z.string().optional().default(""),
  complexidade_operacional: z.string().optional().default(""),
  exige_analise_manual: z.boolean().nullable(),
});

// Schema for dados field in roteiro bancário (complete structure)
export const roteiroDadosSchema = z.object({
  publico_alvo: z.array(z.string()).optional().default([]),
  publico_nao_atendido: z.array(z.string()).optional().default([]),
  faixas_idade: z.array(faixaIdadeSchema).optional().default([]),
  limites_operacionais: limitesOperacionaisSchema.optional(),
  documentacao_obrigatoria: z.array(z.string()).optional().default([]),
  portais_acesso: z.array(portalAcessoSchema).optional().default([]),
  regras_especiais: z.array(z.string()).optional().default([]),
  detalhes_adicionais: z.array(z.string()).optional().default([]),
  flags_operacionais: flagsOperacionaisSchema.optional(),
  limites_por_subgrupo: z.array(limiteSubgrupoSchema).optional().default([]),
  perguntas_frequentes_mapeadas: z.array(perguntaFrequenteSchema).optional().default([]),
  metadados_busca: metadadosBuscaSchema.optional(),
});

// Schema for individual roteiro in import (complete structure)
export const roteiroImportItemSchema = z.object({
  banco: z.string().min(1, { message: "Banco é obrigatório" }),
  convenio: z.string().min(1, { message: "Convênio é obrigatório" }),
  segmento: z.string().optional().default(""),
  tipo_operacao: z.string().optional().default("Não especificado"),
  publico_alvo: z.array(z.string()).optional().default([]),
  publico_nao_atendido: z.array(z.string()).optional().default([]),
  faixas_idade: z.array(faixaIdadeSchema).optional().default([]),
  limites_operacionais: limitesOperacionaisSchema.optional(),
  documentacao_obrigatoria: z.array(z.string()).optional().default([]),
  portais_acesso: z.array(portalAcessoSchema).optional().default([]),
  regras_especiais: z.array(z.string()).optional().default([]),
  detalhes_adicionais: z.array(z.string()).optional().default([]),
  flags_operacionais: flagsOperacionaisSchema.optional(),
  limites_por_subgrupo: z.array(limiteSubgrupoSchema).optional().default([]),
  perguntas_frequentes_mapeadas: z.array(perguntaFrequenteSchema).optional().default([]),
  metadados_busca: metadadosBuscaSchema.optional(),
});

// Schema for import JSON request
export const roteirosImportSchema = z.object({
  roteiros: z.array(roteiroImportItemSchema).min(1, { message: "Pelo menos um roteiro é necessário" }),
});

export type RoteiroImportItem = z.infer<typeof roteiroImportItemSchema>;
export type RoteirosImport = z.infer<typeof roteirosImportSchema>;
export type RoteiroDados = z.infer<typeof roteiroDadosSchema>;
export type FlagsOperacionais = z.infer<typeof flagsOperacionaisSchema>;
export type LimiteSubgrupo = z.infer<typeof limiteSubgrupoSchema>;
export type PerguntaFrequente = z.infer<typeof perguntaFrequenteSchema>;
export type MetadadosBusca = z.infer<typeof metadadosBuscaSchema>;

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

// Login validation: accepts 4-digit numeric code (new) OR email (legacy)
const loginValidator = z.string().refine(
  (val) => {
    // Check if it's a 4-digit numeric code
    if (/^\d{4}$/.test(val)) return true;
    // Check if it's a valid email (legacy support)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val);
  },
  { message: "Login deve ser um código de 4 dígitos ou email válido" }
);

export const loginSchema = z.object({
  email: loginValidator,
  password: z.string().min(1, { message: "Senha é obrigatória" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  email: loginValidator,
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

// Categorias de nomenclatura
export const NOMENCLATURA_CATEGORIA = ["ORGAO", "TIPO_CONTRATO", "UPAG", "UF", "OUTRO"] as const;
export type NomenclaturaCategoria = typeof NOMENCLATURA_CATEGORIA[number];

// Tabela de nomenclaturas - lookup de códigos para nomes (órgãos, UPAGs, etc.)
export const nomenclaturas = pgTable("nomenclaturas", {
  id: serial("id").primaryKey(),
  categoria: varchar("categoria", { length: 50 }).notNull(), // ORGAO, TIPO_CONTRATO, UPAG, UF, OUTRO
  codigo: varchar("codigo", { length: 100 }).notNull(), // Código do item (ex: "20114" para órgão)
  nome: varchar("nome", { length: 255 }).notNull(), // Nome descritivo (ex: "MINISTERIO DA FAZENDA")
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  categoriaCodIdx: uniqueIndex("idx_nomenclatura_categoria_codigo").on(table.categoria, table.codigo),
}));

export const insertNomenclaturaSchema = createInsertSchema(nomenclaturas, {
  categoria: z.enum(NOMENCLATURA_CATEGORIA),
  codigo: z.string().min(1, { message: "Código é obrigatório" }),
  nome: z.string().min(1, { message: "Nome é obrigatório" }),
}).omit({ id: true, createdAt: true });

export type Nomenclatura = typeof nomenclaturas.$inferSelect;
export type InsertNomenclatura = z.infer<typeof insertNomenclaturaSchema>;

// 1) clientes_pessoa - Dados fixos do indivíduo
// Chave única composta: (tenant_id, cpf) para isolamento multi-tenant
export const clientesPessoa = pgTable("clientes_pessoa", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // Multi-tenant
  cpf: varchar("cpf", { length: 14 }), // CPF como TEXT (preserva zeros)
  matricula: varchar("matricula", { length: 50 }).notNull(), // Matrícula como TEXT (preserva zeros)
  nome: varchar("nome", { length: 255 }),
  orgaodesc: varchar("orgaodesc", { length: 255 }),
  orgaocod: varchar("orgaocod", { length: 50 }),
  undpagadoradesc: varchar("undpagadoradesc", { length: 255 }),
  undpagadoracod: varchar("undpagadoracod", { length: 50 }),
  upag: varchar("upag", { length: 100 }), // unidade pagadora
  natureza: varchar("natureza", { length: 100 }),
  sitFunc: varchar("sit_func", { length: 100 }), // ativo, pensionista, aposentado etc.
  convenio: varchar("convenio", { length: 100 }),
  uf: varchar("uf", { length: 100 }),
  municipio: varchar("municipio", { length: 150 }),
  dataNascimento: timestamp("data_nascimento"), // data de nascimento do cliente
  telefonesBase: jsonb("telefones_base"), // TELEFONE 1..5 em array (legado)
  // Nomes descritivos do órgão/upag (para exibição)
  orgaoNomePessoa: varchar("orgao_nome_pessoa", { length: 255 }), // Nome do órgão vinculado à pessoa
  upagNomePessoa: varchar("upag_nome_pessoa", { length: 255 }), // Nome da UPAG vinculada à pessoa
  // Dados bancários do cliente (banco onde recebe salário)
  bancoCodigo: varchar("banco_codigo", { length: 20 }),
  bancoNome: varchar("banco_nome", { length: 100 }), // Nome do banco para exibição
  agencia: varchar("agencia", { length: 20 }),
  conta: varchar("conta", { length: 30 }),
  baseTagUltima: varchar("base_tag_ultima", { length: 100 }),
  // === CAMPOS DINÂMICOS (margens atuais) ===
  margemEmprestimoAtual: decimal("margem_emprestimo_atual", { precision: 12, scale: 2 }),
  margemCartaoAtual: decimal("margem_cartao_atual", { precision: 12, scale: 2 }),
  margem5Atual: decimal("margem_5_atual", { precision: 12, scale: 2 }),
  situacaoFuncionalAtual: varchar("situacao_funcional_atual", { length: 100 }),
  salarioBrutoAtual: decimal("salario_bruto_atual", { precision: 12, scale: 2 }),
  salarioLiquidoAtual: decimal("salario_liquido_atual", { precision: 12, scale: 2 }),
  lastSource: varchar("last_source", { length: 100 }), // fonte da última atualização
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
  extrasPessoa: jsonb("extras_pessoa"), // tudo que não for mapeado diretamente
  // Rastreabilidade para exclusão em cascata
  importRunId: integer("import_run_id"), // Link ao import que criou/atualizou
  // Observações/notas de atendimento
  notes: text("notes"), // Histórico de observações do cliente
  // === DADOS DE ENDEREÇO ===
  endereco: varchar("endereco", { length: 255 }), // Logradouro
  cidade: varchar("cidade", { length: 150 }),
  enderecoUf: varchar("endereco_uf", { length: 2 }), // UF do endereço (separado do UF do órgão)
  cep: varchar("cep", { length: 10 }),
}, (table) => ({
  // Chave única: CPF - uma pessoa por CPF
  pessoaCpfIdx: uniqueIndex("idx_pessoa_cpf").on(table.cpf),
}));

// 2) clientes_vinculo - Vínculos CPF + Matrícula + Órgão (âncora de cruzamento)
// IMPORTANTE: A chave única é (tenant_id, cpf, matricula, orgao) para isolamento multi-tenant
export const clientesVinculo = pgTable("clientes_vinculo", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull(), // CPF padStart 11
  matricula: varchar("matricula", { length: 50 }).notNull(), // Matrícula como texto
  pessoaId: integer("pessoa_id").references(() => clientesPessoa.id, { onDelete: "cascade" }),
  convenio: varchar("convenio", { length: 100 }),
  orgao: varchar("orgao", { length: 255 }).notNull().default("DESCONHECIDO"), // Órgão é parte da chave única
  upag: varchar("upag", { length: 100 }),
  rjur: varchar("rjur", { length: 50 }), // Regime jurídico
  sitFunc: varchar("sit_func", { length: 100 }), // Situação funcional (ATIVO, APOSENTADO, etc)
  ativo: boolean("ativo").notNull().default(true),
  primeiraImportacao: timestamp("primeira_importacao").notNull().defaultNow(),
  ultimaAtualizacao: timestamp("ultima_atualizacao").notNull().defaultNow(),
  extrasVinculo: jsonb("extras_vinculo"), // Ex: { "instituidor": "0654321" } para pensionistas
  // Rastreabilidade para exclusão
  importRunId: integer("import_run_id"), // Link ao import que criou/atualizou
  baseTag: varchar("base_tag", { length: 100 }), // Tag da base para cascata
}, (table) => ({
  // Chave única multi-tenant: (tenant_id, cpf, matricula, orgao)
  vinculoUnique: uniqueIndex("idx_vinculo_unique").on(table.tenantId, table.cpf, table.matricula, table.orgao),
}));

// 3) clientes_folha_mes - Dados agregados da folha por competência
// IMPORTANTE: vinculoId é a chave de relacionamento (vinculo = cpf+matricula+orgao)
// ÍNDICE ÚNICO: (vinculo_id, competencia) - para ON CONFLICT no fast import
export const clientesFolhaMes = pgTable("clientes_folha_mes", {
  id: serial("id").primaryKey(),
  pessoaId: integer("pessoa_id").references(() => clientesPessoa.id, { onDelete: "cascade" }).notNull(),
  vinculoId: integer("vinculo_id").references(() => clientesVinculo.id, { onDelete: "cascade" }), // Referência ao vínculo específico
  competencia: timestamp("competencia").notNull(), // Ex: 2025-11-01
  // Margem 5% (nova - era 30% antes)
  margemBruta5: decimal("margem_bruta_5", { precision: 12, scale: 2 }),
  margemUtilizada5: decimal("margem_utilizada_5", { precision: 12, scale: 2 }),
  margemSaldo5: decimal("margem_saldo_5", { precision: 12, scale: 2 }),
  // Margem Benefício 5%
  margemBeneficioBruta5: decimal("margem_beneficio_bruta_5", { precision: 12, scale: 2 }),
  margemBeneficioUtilizada5: decimal("margem_beneficio_utilizada_5", { precision: 12, scale: 2 }),
  margemBeneficioSaldo5: decimal("margem_beneficio_saldo_5", { precision: 12, scale: 2 }),
  // Margem 35%
  margemBruta35: decimal("margem_bruta_35", { precision: 12, scale: 2 }),
  margemUtilizada35: decimal("margem_utilizada_35", { precision: 12, scale: 2 }),
  margemSaldo35: decimal("margem_saldo_35", { precision: 12, scale: 2 }),
  // Margem 70%
  margemBruta70: decimal("margem_bruta_70", { precision: 12, scale: 2 }),
  margemUtilizada70: decimal("margem_utilizada_70", { precision: 12, scale: 2 }),
  margemSaldo70: decimal("margem_saldo_70", { precision: 12, scale: 2 }),
  margemCartaoCreditoSaldo: decimal("margem_cartao_credito_saldo", { precision: 12, scale: 2 }),
  margemCartaoBeneficioSaldo: decimal("margem_cartao_beneficio_saldo", { precision: 12, scale: 2 }),
  // Rendimentos
  salarioBruto: decimal("salario_bruto", { precision: 12, scale: 2 }),
  descontosBrutos: decimal("descontos_brutos", { precision: 12, scale: 2 }),
  salarioLiquido: decimal("salario_liquido", { precision: 12, scale: 2 }),
  creditos: decimal("creditos", { precision: 12, scale: 2 }),
  debitos: decimal("debitos", { precision: 12, scale: 2 }),
  liquido: decimal("liquido", { precision: 12, scale: 2 }),
  sitFuncNoMes: varchar("sit_func_no_mes", { length: 100 }),
  baseTag: varchar("base_tag", { length: 100 }),
  importRunId: integer("import_run_id"), // Link ao import que criou/atualizou - para exclusão em cascata
  extrasFolha: jsonb("extras_folha"),
}, (table) => ({
  // Chave única: (vinculo_id, competencia) - uma folha por vínculo por mês
  folhaMesUnique: uniqueIndex("idx_folha_mes_unique").on(table.vinculoId, table.competencia),
}));

// Status de contrato
export const CONTRACT_STATUS = ["ATIVO", "ENCERRADO"] as const;
export type ContractStatus = typeof CONTRACT_STATUS[number];

// 3) clientes_contratos - Cada linha de contrato/cartão/margem
// Chave única: (pessoaId, banco, numeroContrato) - identifica contrato unicamente por pessoa+banco+número
export const clientesContratos = pgTable("clientes_contratos", {
  id: serial("id").primaryKey(),
  pessoaId: integer("pessoa_id").references(() => clientesPessoa.id, { onDelete: "cascade" }).notNull(),
  vinculoId: integer("vinculo_id").references(() => clientesVinculo.id, { onDelete: "set null" }), // Vínculo CPF+Matrícula+Órgão
  tipoContrato: varchar("tipo_contrato", { length: 50 }), // "consignado", "cartao", "outro", etc.
  banco: varchar("banco", { length: 100 }), // BANCO_DO_EMPRESTIMO da planilha
  valorParcela: decimal("valor_parcela", { precision: 12, scale: 2 }),
  saldoDevedor: decimal("saldo_devedor", { precision: 12, scale: 2 }),
  parcelasRestantes: integer("parcelas_restantes"), // prazo remanescente da planilha
  parcelasPagas: integer("parcelas_pagas"), // parcelas já pagas
  prazoTotal: integer("prazo_total"), // prazo total do contrato
  numeroContrato: varchar("numero_contrato", { length: 100 }), // identificador do contrato
  status: varchar("status", { length: 20 }).notNull().default("ATIVO"), // ATIVO, ENCERRADO
  startedAt: timestamp("started_at"), // data início do contrato
  endedAt: timestamp("ended_at"), // data encerramento (se encerrado)
  competencia: timestamp("competencia"),
  baseTag: varchar("base_tag", { length: 100 }),
  importRunId: integer("import_run_id"), // Link ao import que criou/atualizou - para exclusão em cascata
  dadosBrutos: jsonb("dados_brutos"), // linha completa da planilha
}, (table) => ({
  // Chave única: (pessoa_id, numero_contrato) - um contrato é único por pessoa+número
  pessoaContratoIdx: uniqueIndex("idx_contratos_pessoa_contrato").on(table.pessoaId, table.numeroContrato),
}));

// 4) client_contacts - Contatos do cliente (telefones, emails)
export const clientContacts = pgTable("client_contacts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientesPessoa.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // phone, email
  value: varchar("value", { length: 255 }).notNull(),
  label: varchar("label", { length: 100 }), // Etiqueta opcional (ex: "Whatsapp", "Trabalho")
  isPrimary: boolean("is_primary").default(false), // Contato principal
  isManual: boolean("is_manual").default(false), // Telefone adicionado manualmente (Hot)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Rastreabilidade para exclusão
  importRunId: integer("import_run_id"), // Link ao import que criou
  baseTag: varchar("base_tag", { length: 100 }), // Tag da base para cascata
}, (table) => ({
  // Chave única: (client_id, type, value) - evita duplicatas de contato
  contactsUnique: uniqueIndex("idx_contacts_unique").on(table.clientId, table.type, table.value),
}));

// 4b) clientes_telefones - Telefones normalizados do cliente
// Chave única: (pessoa_id, telefone) - evita duplicatas
export const clientesTelefones = pgTable("clientes_telefones", {
  id: serial("id").primaryKey(),
  pessoaId: integer("pessoa_id").references(() => clientesPessoa.id, { onDelete: "cascade" }).notNull(),
  telefone: varchar("telefone", { length: 20 }).notNull(), // Telefone normalizado (apenas dígitos)
  tipo: varchar("tipo", { length: 20 }), // celular, fixo, whatsapp, comercial (opcional)
  principal: boolean("principal").default(false), // Telefone_1 = true, demais = false
  createdAt: timestamp("created_at").notNull().defaultNow(),
  importRunId: integer("import_run_id"), // Rastreabilidade
  baseTag: varchar("base_tag", { length: 100 }),
}, (table) => ({
  pessoaTelefoneIdx: uniqueIndex("idx_clientes_telefones_pessoa_tel").on(table.pessoaId, table.telefone),
}));

// 5) client_snapshots - Histórico de atualizações para auditoria
export const clientSnapshots = pgTable("client_snapshots", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientesPessoa.id, { onDelete: "cascade" }).notNull(),
  referenceDate: timestamp("reference_date").notNull(),
  fonte: varchar("fonte", { length: 100 }).notNull(), // higienizacao, importacao, etc
  situacaoFuncional: varchar("situacao_funcional", { length: 100 }),
  margemEmprestimo: decimal("margem_emprestimo", { precision: 12, scale: 2 }),
  margemCartao: decimal("margem_cartao", { precision: 12, scale: 2 }),
  margem5: decimal("margem_5", { precision: 12, scale: 2 }),
  salarioBruto: decimal("salario_bruto", { precision: 12, scale: 2 }),
  salarioLiquido: decimal("salario_liquido", { precision: 12, scale: 2 }),
  dadosExtras: jsonb("dados_extras"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 6) bases_importadas - Controle de importações (legado - use import_runs para novos imports)
export const basesImportadas = pgTable("bases_importadas", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // Multi-tenant
  importRunId: integer("import_run_id"), // Link ao novo sistema (FK adicionada via migration)
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
  // Precificação por PACOTES
  nomePacote: varchar("nome_pacote", { length: 100 }), // ex: "Pacote 2000"
  custoEstimado: decimal("custo_estimado", { precision: 12, scale: 2 }),
  custoFinal: decimal("custo_final", { precision: 12, scale: 2 }),
  statusFinanceiro: varchar("status_financeiro", { length: 20 }), // pendente, confirmado
  // Arquivo gerado
  arquivoPath: varchar("arquivo_path", { length: 500 }),
  arquivoGeradoEm: timestamp("arquivo_gerado_em"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
});

// 6) pricing_settings - Configuração de preços para pedidos de lista (legado)
export const pricingSettings = pgTable("pricing_settings", {
  id: serial("id").primaryKey(),
  precoAncoraMin: decimal("preco_ancora_min", { precision: 12, scale: 4 }).notNull().default("1.0000"), // preço total para qtd_ancora_min registros
  qtdAncoraMin: integer("qtd_ancora_min").notNull().default(1), // normalmente 1
  precoAncoraMax: decimal("preco_ancora_max", { precision: 12, scale: 2 }).notNull().default("2000.00"), // preço total para qtd_ancora_max registros
  qtdAncoraMax: integer("qtd_ancora_max").notNull().default(1000000), // ex: 1.000.000
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
});

// 7) pacotes_preco - Tabela de pacotes de preços editáveis
export const pacotesPreco = pgTable("pacotes_preco", {
  id: serial("id").primaryKey(),
  quantidadeMaxima: integer("quantidade_maxima").notNull(),
  nomePacote: varchar("nome_pacote", { length: 100 }).notNull(),
  preco: decimal("preco", { precision: 10, scale: 2 }).notNull(),
  ordem: integer("ordem").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
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

export const insertPricingSettingsSchema = createInsertSchema(pricingSettings, {
  precoAncoraMin: z.string().or(z.number()).transform(v => String(v)),
  precoAncoraMax: z.string().or(z.number()).transform(v => String(v)),
  qtdAncoraMin: z.number().int().positive(),
  qtdAncoraMax: z.number().int().positive(),
}).omit({ id: true, atualizadoEm: true });

export const insertPacotePrecoSchema = createInsertSchema(pacotesPreco, {
  quantidadeMaxima: z.number().int().positive(),
  nomePacote: z.string().min(1),
  preco: z.string().or(z.number()).transform(v => String(v)),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
}).omit({ id: true, atualizadoEm: true });

export const updatePacotePrecoSchema = z.object({
  quantidadeMaxima: z.number().int().positive().optional(),
  nomePacote: z.string().min(1).optional(),
  preco: z.number().positive().optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});

// ===== SELECT TYPES FOR BASE DE CLIENTES =====

export type ClientePessoa = typeof clientesPessoa.$inferSelect;
export type InsertClientePessoa = z.infer<typeof insertClientePessoaSchema>;

export type ClienteFolhaMes = typeof clientesFolhaMes.$inferSelect;
export type InsertClienteFolhaMes = z.infer<typeof insertClienteFolhaMesSchema>;

export type ClienteContrato = typeof clientesContratos.$inferSelect;
export type InsertClienteContrato = z.infer<typeof insertClienteContratoSchema>;

export type ClientContact = typeof clientContacts.$inferSelect;
export type ClienteTelefone = typeof clientesTelefones.$inferSelect;
export type InsertClienteTelefone = typeof clientesTelefones.$inferInsert;
export type ClientSnapshot = typeof clientSnapshots.$inferSelect;

export type BaseImportada = typeof basesImportadas.$inferSelect;
export type InsertBaseImportada = z.infer<typeof insertBaseImportadaSchema>;

export type PedidoLista = typeof pedidosLista.$inferSelect;
export type InsertPedidoLista = z.infer<typeof insertPedidoListaSchema>;

export type PricingSettings = typeof pricingSettings.$inferSelect;
export type InsertPricingSettings = z.infer<typeof insertPricingSettingsSchema>;

export type PacotePreco = typeof pacotesPreco.$inferSelect;
export type InsertPacotePreco = z.infer<typeof insertPacotePrecoSchema>;
export type UpdatePacotePreco = z.infer<typeof updatePacotePrecoSchema>;

// ===== FILTROS PARA PEDIDOS LISTA =====

export const filtrosPedidoListaSchema = z.object({
  // Filtros de contexto (base para filtrar contratos)
  base_tag: z.string().optional(),
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
  bancos: z.array(z.string()).optional(),
  tipos_contrato: z.array(z.string()).optional(),
  parcela_min: z.number().optional(),
  parcela_max: z.number().optional(),
  // Filtro de parcelas restantes
  parcelas_restantes_min: z.number().optional(),
  parcelas_restantes_max: z.number().optional(),
  // Filtro de quantidade de contratos
  qtd_contratos_min: z.number().optional(),
  qtd_contratos_max: z.number().optional(),
});

export type FiltrosPedidoLista = z.infer<typeof filtrosPedidoListaSchema>;

// ===== ACADEMIA CONSIGONE =====

// Progresso de lições do vendedor
export const progressoLicoes = pgTable("progresso_licoes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  licaoId: varchar("licao_id", { length: 10 }).notNull(), // "1.1", "1.2", etc.
  nivelId: integer("nivel_id").notNull(), // 1-5
  concluida: boolean("concluida").notNull().default(false),
  respostasAtividade: text("respostas_atividade"), // Resposta da atividade prática
  concluidaEm: timestamp("concluida_em"),
});

// Perfil do vendedor na Academia
export const vendedoresAcademia = pgTable("vendedores_academia", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  nivelAtual: integer("nivel_atual").notNull().default(1), // 1-5
  quizAprovado: boolean("quiz_aprovado").notNull().default(false),
  quizAprovadoEm: timestamp("quiz_aprovado_em"),
  totalSimulacoes: integer("total_simulacoes").notNull().default(0),
  notaMediaGlobal: decimal("nota_media_global", { precision: 4, scale: 2 }),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
});

// Tentativas de quiz
export const quizTentativas = pgTable("quiz_tentativas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  respostas: jsonb("respostas").notNull(), // { perguntaId: respostaEscolhida }
  acertos: integer("acertos").notNull(),
  total: integer("total").notNull(),
  aprovado: boolean("aprovado").notNull(),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// Prompts das personas para Modo Níveis (1-5)
export const roleplayNivelPrompts = pgTable("roleplay_nivel_prompts", {
  id: serial("id").primaryKey(),
  nivel: integer("nivel").notNull(), // 1 a 5
  nome: varchar("nome", { length: 100 }).notNull(), // "Maria das Graças", etc
  descricao: varchar("descricao", { length: 255 }), // "Cliente Receptivo"
  promptCompleto: text("prompt_completo").notNull(), // Prompt da persona
  criteriosAprovacao: jsonb("criterios_aprovacao").notNull().default([]), // Lista de critérios
  notaMinima: decimal("nota_minima", { precision: 3, scale: 1 }).notNull().default("7.0"), // 7.0 ou 8.0
  tempoLimiteMinutos: integer("tempo_limite_minutos"), // 10, 15, 20
  isActive: boolean("is_active").notNull().default(true),
  podeCustomizar: boolean("pode_customizar").notNull().default(false), // futuro: permitir edição
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Sessões de roleplay
export const roleplaySessoes = pgTable("roleplay_sessoes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  nivelTreinado: integer("nivel_treinado").notNull(), // Nível durante a sessão
  modo: varchar("modo", { length: 20 }).notNull().default("livre"), // 'livre' ou 'niveis'
  status: varchar("status", { length: 20 }).notNull().default("ativa"), // ativa, finalizada
  historicoConversa: jsonb("historico_conversa").notNull().default([]), // Array de mensagens
  cenario: text("cenario"), // Cenário customizado pelo usuário
  totalMensagens: integer("total_mensagens").notNull().default(0), // Contador de mensagens do corretor
  aprovado: boolean("aprovado").default(false), // Se passou no nível (Modo Níveis)
  notaFinal: decimal("nota_final", { precision: 4, scale: 2 }), // Nota final da sessão
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  finalizadoEm: timestamp("finalizado_em"),
});

// Histórico de Feedbacks IA gerados pelo admin
export const feedbacksIAHistorico = pgTable("feedbacks_ia_historico", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // Vendedor avaliado
  geradoPorId: integer("gerado_por_id").references(() => users.id, { onDelete: "set null" }), // Admin que gerou
  notaGeral: decimal("nota_geral", { precision: 4, scale: 2 }).notNull(),
  resumo: text("resumo").notNull(),
  pontosFortes: jsonb("pontos_fortes").notNull().default([]),
  areasDesenvolvimento: jsonb("areas_desenvolvimento").notNull().default([]),
  recomendacoes: jsonb("recomendacoes").notNull().default([]),
  proximosPassos: jsonb("proximos_passos").notNull().default([]),
  metricas: jsonb("metricas"), // Métricas coletadas no momento do feedback
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// Avaliações de roleplay pela IA
export const roleplayAvaliacoes = pgTable("roleplay_avaliacoes", {
  id: serial("id").primaryKey(),
  sessaoId: integer("sessao_id").references(() => roleplaySessoes.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  falaCorretor: text("fala_corretor").notNull(),
  notaGlobal: decimal("nota_global", { precision: 4, scale: 2 }).notNull(),
  notaHumanizacao: decimal("nota_humanizacao", { precision: 4, scale: 2 }),
  notaConsultivo: decimal("nota_consultivo", { precision: 4, scale: 2 }),
  notaClareza: decimal("nota_clareza", { precision: 4, scale: 2 }),
  notaVenda: decimal("nota_venda", { precision: 4, scale: 2 }),
  comentarioGeral: text("comentario_geral"),
  pontosFortes: jsonb("pontos_fortes").default([]), // Array de strings
  pontosMelhorar: jsonb("pontos_melhorar").default([]), // Array de strings
  nivelSugerido: integer("nivel_sugerido"),
  nivelAvaliado: integer("nivel_avaliado"), // Nível que foi avaliado (Modo Níveis)
  aprovadoProximoNivel: boolean("aprovado_proximo_nivel").default(false),
  criteriosAtendidos: jsonb("criterios_atendidos").default({}), // Critérios do nível atendidos
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// Abordagens geradas pela IA
export const abordagensGeradas = pgTable("abordagens_geradas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  canal: varchar("canal", { length: 20 }).notNull(), // whatsapp, ligacao
  tipoCliente: varchar("tipo_cliente", { length: 50 }).notNull(), // cliente_negativado, cliente_antigo, novo_servidor, indicacao
  produtoFoco: varchar("produto_foco", { length: 50 }).notNull(), // compra_divida, cartao, consignado
  contexto: text("contexto"),
  aberturaResumida: text("abertura_resumida"),
  objetivoAbordagem: text("objetivo_abordagem"),
  perguntasConsultivas: jsonb("perguntas_consultivas").default([]),
  exploracaoDor: text("exploracao_dor"),
  propostaValor: text("proposta_valor"),
  gatilhosUsados: jsonb("gatilhos_usados").default([]),
  scriptLigacao: text("script_ligacao"),
  scriptWhatsapp: text("script_whatsapp"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// ===== INSERT SCHEMAS ACADEMIA =====

export const insertProgressoLicaoSchema = createInsertSchema(progressoLicoes).omit({
  id: true,
});

export const insertVendedorAcademiaSchema = createInsertSchema(vendedoresAcademia).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertQuizTentativaSchema = createInsertSchema(quizTentativas).omit({
  id: true,
  criadoEm: true,
});

export const insertRoleplayNivelPromptSchema = createInsertSchema(roleplayNivelPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleplaySessaoSchema = createInsertSchema(roleplaySessoes).omit({
  id: true,
  criadoEm: true,
});

export const insertRoleplayAvaliacaoSchema = createInsertSchema(roleplayAvaliacoes).omit({
  id: true,
  criadoEm: true,
});

export const insertAbordagemGeradaSchema = createInsertSchema(abordagensGeradas).omit({
  id: true,
  criadoEm: true,
});

export const insertFeedbackIAHistoricoSchema = createInsertSchema(feedbacksIAHistorico).omit({
  id: true,
  criadoEm: true,
});

// ===== TYPES ACADEMIA =====

export type ProgressoLicao = typeof progressoLicoes.$inferSelect;
export type InsertProgressoLicao = z.infer<typeof insertProgressoLicaoSchema>;

export type VendedorAcademia = typeof vendedoresAcademia.$inferSelect;
export type InsertVendedorAcademia = z.infer<typeof insertVendedorAcademiaSchema>;

export type QuizTentativa = typeof quizTentativas.$inferSelect;
export type InsertQuizTentativa = z.infer<typeof insertQuizTentativaSchema>;

export type RoleplayNivelPrompt = typeof roleplayNivelPrompts.$inferSelect;
export type InsertRoleplayNivelPrompt = z.infer<typeof insertRoleplayNivelPromptSchema>;

export type RoleplaySessao = typeof roleplaySessoes.$inferSelect;
export type InsertRoleplaySessao = z.infer<typeof insertRoleplaySessaoSchema>;

export type RoleplayAvaliacao = typeof roleplayAvaliacoes.$inferSelect;
export type InsertRoleplayAvaliacao = z.infer<typeof insertRoleplayAvaliacaoSchema>;

export type AbordagemGerada = typeof abordagensGeradas.$inferSelect;
export type InsertAbordagemGerada = z.infer<typeof insertAbordagemGeradaSchema>;

export type FeedbackIAHistorico = typeof feedbacksIAHistorico.$inferSelect;
export type InsertFeedbackIAHistorico = z.infer<typeof insertFeedbackIAHistoricoSchema>;

// ===== SCHEMAS DE REQUISIÇÃO TREINADOR IA =====

// Estilos de tom para abordagem IA
export const TOM_ABORDAGEM = {
  consultiva_acolhedora: "Consultiva / Acolhedora - Tom humano, empático, sem pressão. Boa para clientes sensíveis, negativados, desconfiados.",
  direta_objetiva: "Direta / Objetiva - Linha reta, focada em benefício prático. Boa para clientes ocupados ou servidores públicos.",
  persuasiva_profissional: "Persuasiva Profissional - Usa prova social, ancoragem, autoridade. Tom de especialista que sabe o que está falando.",
  alta_conversao: "Alta Conversão / Agressiva Controlada - Ataca dor real, cria urgência saudável. Boa para clientes que enrolam.",
  ultra_premium: "Ultra Premium / Especialista - Tom consultor premium, estilo 'private banker'. Ideal para servidores antigos, salário alto.",
} as const;

export type TomAbordagem = keyof typeof TOM_ABORDAGEM;

export const treinadorRequestSchema = z.object({
  modo: z.enum(["roleplay_cliente", "avaliacao_roleplay", "abordagem_ia"]),
  vendedorId: z.string().optional(),
  nomeVendedor: z.string().optional(),
  nivelAtual: z.number().min(1).max(5).default(1),
  contexto: z.string().optional(),
  falaCorretor: z.string().optional(), // Para roleplay_cliente e avaliacao_roleplay
  canal: z.enum(["whatsapp", "ligacao"]).optional(), // Para abordagem_ia
  tipoCliente: z.enum(["cliente_negativado", "cliente_antigo", "novo_servidor", "indicacao"]).optional(),
  produtoFoco: z.enum(["compra_divida", "cartao", "consignado"]).optional(),
  historicoResumido: z.string().optional(),
  sessaoId: z.number().optional(), // Para continuar roleplay existente
  avaliarResposta: z.boolean().optional(), // Para avaliação inline por resposta
  tom: z.enum(["consultiva_acolhedora", "direta_objetiva", "persuasiva_profissional", "alta_conversao", "ultra_premium"]).optional(), // Estilo da abordagem
  cenario: z.string().optional(), // Cenário específico para roleplay (ex: "cliente disse que vai pensar")
  tipoModo: z.enum(["livre", "niveis"]).optional(), // Modo de roleplay: livre (customizável) ou niveis (progressão estruturada)
  nivelPromptId: z.number().optional(), // ID do prompt de nível para Modo Níveis
});

export type TreinadorRequest = z.infer<typeof treinadorRequestSchema>;

// ===== CRM DE VENDAS =====

// Campanhas de vendas
export const salesCampaigns = pgTable("sales_campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // Multi-tenant: nullable for migration
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  origem: varchar("origem", { length: 100 }),
  convenio: varchar("convenio", { length: 100 }),
  uf: varchar("uf", { length: 10 }),
  status: varchar("status", { length: 20 }).notNull().default("ativa"), // ativa, pausada, encerrada
  totalLeads: integer("total_leads").notNull().default(0),
  leadsDisponiveis: integer("leads_disponiveis").notNull().default(0),
  leadsDistribuidos: integer("leads_distribuidos").notNull().default(0),
  filtrosJson: jsonb("filtros_json"), // Filtros usados para criar a campanha (auditoria)
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Leads brutos vinculados a campanhas
// Marcadores de lead (status único do lead)
export const LEAD_MARKERS = [
  "NOVO",
  "EM_ATENDIMENTO",
  "INTERESSADO",
  "AGUARDANDO_RETORNO",
  "PROPOSTA_ENVIADA",
  "VENDIDO",
  "NAO_ATENDE",
  "TELEFONE_INVALIDO",
  "ENGANO",
  "SEM_INTERESSE",
  "RETORNAR_DEPOIS",
  "TRANSFERIR",
] as const;

export type LeadMarker = typeof LEAD_MARKERS[number];

// Labels para exibição dos marcadores
export const LEAD_MARKER_LABELS: Record<LeadMarker, string> = {
  NOVO: "Novo",
  EM_ATENDIMENTO: "Em Atendimento",
  INTERESSADO: "Interessado",
  AGUARDANDO_RETORNO: "Aguardando Retorno",
  PROPOSTA_ENVIADA: "Proposta Enviada",
  VENDIDO: "Vendido",
  NAO_ATENDE: "Não Atende",
  TELEFONE_INVALIDO: "Telefone Inválido",
  ENGANO: "Engano",
  SEM_INTERESSE: "Sem Interesse",
  RETORNAR_DEPOIS: "Retornar Depois",
  TRANSFERIR: "Transferir",
};

// Marcadores que requerem motivo
export const MARKERS_REQUIRING_MOTIVO: LeadMarker[] = [
  "NAO_ATENDE",
  "TELEFONE_INVALIDO",
  "ENGANO",
  "SEM_INTERESSE",
  "TRANSFERIR",
];

// Tipos de contato
export const TIPOS_CONTATO_LEAD = ["ligacao", "whatsapp", "outro"] as const;
export type TipoContatoLead = typeof TIPOS_CONTATO_LEAD[number];

export const salesLeads = pgTable("sales_leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // Multi-tenant: nullable for migration
  campaignId: integer("campaign_id").references(() => salesCampaigns.id, { onDelete: "cascade" }).notNull(),
  cpf: varchar("cpf", { length: 14 }),
  nome: varchar("nome", { length: 255 }).notNull(),
  telefone1: varchar("telefone_1", { length: 20 }),
  telefone2: varchar("telefone_2", { length: 20 }),
  telefone3: varchar("telefone_3", { length: 20 }),
  email: varchar("email", { length: 255 }),
  cidade: varchar("cidade", { length: 150 }),
  uf: varchar("uf", { length: 10 }),
  observacoes: text("observacoes"),
  baseClienteId: integer("base_cliente_id").references(() => clientesPessoa.id, { onDelete: "set null" }),
  leadMarker: varchar("lead_marker", { length: 30 }).notNull().default("NOVO"),
  retornoEm: timestamp("retorno_em"),
  motivo: varchar("motivo", { length: 255 }),
  ultimoContatoEm: timestamp("ultimo_contato_em"),
  ultimoTipoContato: varchar("ultimo_tipo_contato", { length: 30 }),
  currentMargin: decimal("current_margin", { precision: 12, scale: 2 }),
  currentProposal: decimal("current_proposal", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Fila de atribuição de leads para vendedores
export const salesLeadAssignments = pgTable("sales_lead_assignments", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => salesLeads.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  campaignId: integer("campaign_id").references(() => salesCampaigns.id, { onDelete: "cascade" }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("novo"), // novo, em_atendimento, concluido, sem_contato, sem_interesse, vendido, descartado
  ordemFila: integer("ordem_fila").notNull().default(0),
  dataPrimeiroAtendimento: timestamp("data_primeiro_atendimento"),
  dataUltimoAtendimento: timestamp("data_ultimo_atendimento"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Histórico de eventos/interações com o lead (legado)
export const salesLeadEvents = pgTable("sales_lead_events", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").references(() => salesLeadAssignments.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  tipo: varchar("tipo", { length: 30 }).notNull(), // ligacao, whatsapp, email, visita
  resultado: varchar("resultado", { length: 50 }), // sem_resposta, agendado, proposta_enviada, fechou
  observacao: text("observacao"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Histórico de interações com o lead (novo sistema de marcadores)
export const leadInteractions = pgTable("lead_interactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // Multi-tenant: nullable for migration
  leadId: integer("lead_id").references(() => salesLeads.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }).notNull(),
  tipoContato: varchar("tipo_contato", { length: 30 }).notNull(), // ligacao, whatsapp, outro
  leadMarker: varchar("lead_marker", { length: 30 }).notNull(),
  motivo: varchar("motivo", { length: 255 }),
  observacao: text("observacao"),
  retornoEm: timestamp("retorno_em"),
  contactId: integer("contact_id").references(() => leadContacts.id, { onDelete: "set null" }),
  margemValor: decimal("margem_valor", { precision: 12, scale: 2 }),
  propostaValorEstimado: decimal("proposta_valor_estimado", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Configurações de pipeline do usuário (ordem das colunas)
export const userPipelineSettings = pgTable("user_pipeline_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  columnOrder: jsonb("column_order"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserPipelineSettingsSchema = createInsertSchema(userPipelineSettings).omit({
  id: true,
  updatedAt: true,
});

export type UserPipelineSettings = typeof userPipelineSettings.$inferSelect;
export type InsertUserPipelineSettings = z.infer<typeof insertUserPipelineSettingsSchema>;

export const insertLeadInteractionSchema = createInsertSchema(leadInteractions).omit({
  id: true,
  createdAt: true,
});

export type LeadInteraction = typeof leadInteractions.$inferSelect;
export type InsertLeadInteraction = z.infer<typeof insertLeadInteractionSchema>;

// ===== INSERT SCHEMAS CRM VENDAS =====

export const insertSalesCampaignSchema = createInsertSchema(salesCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesLeadSchema = createInsertSchema(salesLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesLeadAssignmentSchema = createInsertSchema(salesLeadAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesLeadEventSchema = createInsertSchema(salesLeadEvents).omit({
  id: true,
  createdAt: true,
});

// ===== TYPES CRM VENDAS =====

export type SalesCampaign = typeof salesCampaigns.$inferSelect;
export type InsertSalesCampaign = z.infer<typeof insertSalesCampaignSchema>;

export type SalesLead = typeof salesLeads.$inferSelect;
export type InsertSalesLead = z.infer<typeof insertSalesLeadSchema>;

export type SalesLeadAssignment = typeof salesLeadAssignments.$inferSelect;
export type InsertSalesLeadAssignment = z.infer<typeof insertSalesLeadAssignmentSchema>;

export type SalesLeadEvent = typeof salesLeadEvents.$inferSelect;
export type InsertSalesLeadEvent = z.infer<typeof insertSalesLeadEventSchema>;

// Status do lead assignment
export const LEAD_STATUS = {
  novo: "Novo",
  em_atendimento: "Em Atendimento",
  sem_contato: "Sem Contato",
  sem_interesse: "Sem Interesse",
  agendar_retorno: "Agendar Retorno",
  proposta_enviada: "Proposta Enviada",
  vendido: "Vendido",
  descartado: "Descartado",
  concluido: "Concluído",
} as const;

export type LeadStatus = keyof typeof LEAD_STATUS;

// Tipos de contato
export const TIPOS_CONTATO = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  visita: "Visita",
} as const;

export type TipoContato = keyof typeof TIPOS_CONTATO;

// ===== USER PERMISSIONS =====

// Module list - ordered to match sidebar menu
// Removed: modulo_compra_lista (future sub-permission of modulo_base_clientes)
// Removed: modulo_crm_vendas_campanhas, modulo_crm_vendas_atendimento (reorganized into modulo_alpha)
// Removed: modulo_config_precos (future sub-permission of modulo_config_usuarios)
export const MODULE_LIST = [
  "modulo_simulador",        // Simuladores
  "modulo_roteiros",         // Operacional
  "modulo_base_clientes",    // Base de Clientes
  "modulo_config_usuarios",  // Administração
  "modulo_academia",         // Treinamento
  "modulo_alpha",            // ALPHA (new - consolidates CRM features)
] as const;

export type ModuleName = typeof MODULE_LIST[number];

// Sub-items for each module - granular permission control
// Format: module.subitem (e.g., "modulo_simulador.simulador_compra")
export const MODULE_SUB_ITEMS = {
  modulo_simulador: [
    { key: "simulador_compra", label: "Simulador de Compra" },
    { key: "simulador_amortizacao", label: "Simulador de Amortização" },
    { key: "simulador_portabilidade", label: "Simulador de Portabilidade" },
  ],
  modulo_roteiros: [
    { key: "convenios", label: "Convênios" },
    { key: "bancos", label: "Bancos" },
    { key: "tabelas_coeficientes", label: "Tabelas de Coeficientes" },
    { key: "roteiros_bancarios", label: "Roteiros Bancários" },
  ],
  modulo_base_clientes: [
    { key: "consulta", label: "Consulta de Clientes" },
    { key: "importacao", label: "Importação de Bases" },
    { key: "compra_lista", label: "Compra de Lista" },
  ],
  modulo_config_usuarios: [
    { key: "usuarios", label: "Gestão de Usuários" },
    { key: "ambientes", label: "Gestão de Ambientes" },
    { key: "precos", label: "Configuração de Preços" },
  ],
  modulo_academia: [
    { key: "fundamentos", label: "Fundamentos" },
    { key: "quiz", label: "Quiz" },
    { key: "roleplay", label: "Role Play" },
    { key: "scripts", label: "Scripts de Venda" },
    { key: "dashboard", label: "Dashboard Admin" },
  ],
  modulo_alpha: [
    { key: "campanhas", label: "Campanhas" },
    { key: "atendimento", label: "Atendimento" },
    { key: "pipeline", label: "Pipeline" },
    { key: "consulta", label: "Consulta" },
    { key: "agenda", label: "Agenda" },
    { key: "gestao_pipeline", label: "Gestão Pipeline" },
  ],
} as const;

// Helper type for sub-item keys
export type SubItemKey<M extends ModuleName> = typeof MODULE_SUB_ITEMS[M][number]["key"];

// Module labels for display
export const MODULE_LABELS: Record<ModuleName, string> = {
  modulo_simulador: "Simuladores",
  modulo_roteiros: "Operacional",
  modulo_base_clientes: "Base de Clientes",
  modulo_config_usuarios: "Administração",
  modulo_academia: "Treinamento",
  modulo_alpha: "ALPHA",
};

// Helper to get full permission key (module.subitem)
export function getSubItemPermissionKey(module: ModuleName, subItem: string): string {
  return `${module}.${subItem}`;
}

// Helper to parse permission key into module and subItem
export function parsePermissionKey(key: string): { module: string; subItem: string | null } {
  const parts = key.split(".");
  if (parts.length === 2) {
    return { module: parts[0], subItem: parts[1] };
  }
  return { module: key, subItem: null };
}

export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  canView: boolean("can_view").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelegate: boolean("can_delegate").notNull().default(false),
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({
  id: true,
});

export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;


// ===== LEAD SCHEDULES (AGENDAMENTOS) =====

export const leadSchedules = pgTable("lead_schedules", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").references(() => salesLeadAssignments.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  dataHora: timestamp("data_hora").notNull(),
  observacao: text("observacao"),
  status: varchar("status", { length: 30 }).notNull().default("pendente"), // pendente, realizado, cancelado
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadScheduleSchema = createInsertSchema(leadSchedules).omit({
  id: true,
  createdAt: true,
});

export type LeadSchedule = typeof leadSchedules.$inferSelect;
export type InsertLeadSchedule = z.infer<typeof insertLeadScheduleSchema>;

// ===== LEAD CONTACTS (CONTATOS DO LEAD) =====

export const leadContacts = pgTable("lead_contacts", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => salesLeads.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 20 }).notNull().default("phone"), // phone, email, address
  label: varchar("label", { length: 100 }), // opcional - legado
  value: varchar("value", { length: 255 }).notNull(), // telefone/email/endereco
  isPrimary: boolean("is_primary").notNull().default(false),
  isManual: boolean("is_manual").notNull().default(false), // Telefone adicionado manualmente (Hot)
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeadContactSchema = createInsertSchema(leadContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LeadContact = typeof leadContacts.$inferSelect;
export type InsertLeadContact = z.infer<typeof insertLeadContactSchema>;

// Labels de contato comuns (legado - mantido para compatibilidade)
export const CONTACT_LABELS = [
  "WhatsApp",
  "Ligação",
  "Recado",
  "Esposa",
  "Esposo",
  "Filho(a)",
  "Comercial",
  "Residencial",
  "Urgente",
  "Trabalho",
] as const;

// ===== TEAMS & AI PROMPTS (Role Play Option 2) =====

// Teams table - equipes de vendas
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // Multi-tenant: nullable for migration
  name: varchar("name", { length: 255 }).notNull(),
  managerUserId: integer("manager_user_id").references(() => users.id, { onDelete: "set null" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Team Members - associação usuários <-> equipes
export const TEAM_ROLES = ["coordinator", "seller"] as const;
export type TeamRole = typeof TEAM_ROLES[number];

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleInTeam: varchar("role_in_team", { length: 20 }).notNull().default("seller"), // coordinator, seller
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI Prompts - prompts versionados para Role Play
export const AI_PROMPT_SCOPES = ["global", "team"] as const;
export type AiPromptScope = typeof AI_PROMPT_SCOPES[number];

export const aiPrompts = pgTable("ai_prompts", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // 'roleplay'
  scope: varchar("scope", { length: 20 }).notNull(), // 'global' | 'team'
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }), // null para global
  variante: varchar("variante", { length: 50 }), // identificador da variante (receptivo, indeciso, etc)
  descricaoVariante: text("descricao_variante"), // descrição amigável da variante
  promptText: text("prompt_text").notNull(),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schemas
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
});

export const insertAiPromptSchema = createInsertSchema(aiPrompts).omit({
  id: true,
  updatedAt: true,
});

// Types
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

export type AiPrompt = typeof aiPrompts.$inferSelect;
export type InsertAiPrompt = z.infer<typeof insertAiPromptSchema>;

// ===== KANBAN PESSOAL =====

// Colunas do Kanban
export const KANBAN_COLUMNS = ["backlog", "a_fazer", "em_execucao", "aguardando", "concluido"] as const;
export type KanbanColumn = typeof KANBAN_COLUMNS[number];

export const KANBAN_COLUMN_LABELS: Record<KanbanColumn, string> = {
  backlog: "Backlog",
  a_fazer: "A Fazer",
  em_execucao: "Em Execução",
  aguardando: "Aguardando",
  concluido: "Concluído",
};

// Prioridades
export const TASK_PRIORITIES = ["alta", "media", "baixa"] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// Tags
export const TASK_TAGS = ["trabalho", "estrategia", "sistema", "financeiro", "pessoal", "familia", "saude"] as const;
export type TaskTag = typeof TASK_TAGS[number];

export const TASK_TAG_LABELS: Record<TaskTag, string> = {
  trabalho: "Trabalho",
  estrategia: "Estratégia",
  sistema: "Sistema/Tecnologia",
  financeiro: "Financeiro",
  pessoal: "Pessoal",
  familia: "Família",
  saude: "Saúde",
};

// Personal Tasks table
export const personalTasks = pgTable("personal_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  column: varchar("column", { length: 20 }).notNull().default("backlog"), // backlog, a_fazer, em_execucao, aguardando, concluido
  priority: varchar("priority", { length: 10 }).notNull().default("media"), // alta, media, baixa
  tag: varchar("tag", { length: 20 }).notNull().default("trabalho"), // trabalho, estrategia, sistema, financeiro, pessoal, familia, saude
  orderIndex: integer("order_index").notNull().default(0), // For ordering within column
  dueDate: timestamp("due_date"), // Optional deadline
  blockedBy: varchar("blocked_by", { length: 255 }), // Who/what is blocking
  blockedReason: text("blocked_reason"), // Why it's blocked
  completedAt: timestamp("completed_at"), // When task was completed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema
export const insertPersonalTaskSchema = createInsertSchema(personalTasks, {
  title: z.string().min(1).max(500),
  column: z.enum(KANBAN_COLUMNS).default("backlog"),
  priority: z.enum(TASK_PRIORITIES).default("media"),
  tag: z.enum(TASK_TAGS).default("trabalho"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

// Types
export type PersonalTask = typeof personalTasks.$inferSelect;
export type InsertPersonalTask = z.infer<typeof insertPersonalTaskSchema>;

// ===== IMPORT SYSTEM FOR MASSIVE SCALE =====

// Status de import run
export const IMPORT_RUN_STATUS = ["pendente", "processando", "pausado", "concluido", "erro", "cancelado"] as const;
export type ImportRunStatus = typeof IMPORT_RUN_STATUS[number];

// Tipos de import
export const IMPORT_TYPES = ["folha", "d8", "contatos", "base_geral"] as const;
export type ImportType = typeof IMPORT_TYPES[number];

// Tabela import_runs - Controle de jobs de importação
export const importRuns = pgTable("import_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  tipoImport: varchar("tipo_import", { length: 50 }).notNull().default("base_geral"), // folha, d8, contatos, base_geral
  competencia: timestamp("competencia"), // Para tipo folha
  banco: varchar("banco", { length: 100 }), // Para tipo d8
  layoutD8: varchar("layout_d8", { length: 20 }), // "servidor" ou "pensionista" para tipo d8
  arquivoOrigem: varchar("arquivo_origem", { length: 500 }),
  arquivoPath: varchar("arquivo_path", { length: 500 }), // Caminho do arquivo no servidor para streaming
  arquivoTamanhoBytes: integer("arquivo_tamanho_bytes"),
  status: varchar("status", { length: 20 }).notNull().default("pendente"), // pendente, processando, pausado, concluido, erro, cancelado
  processedRows: integer("processed_rows").notNull().default(0),
  totalRows: integer("total_rows").notNull().default(0),
  successRows: integer("success_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  chunkSize: integer("chunk_size").notNull().default(10000), // Tamanho do batch (5k-20k)
  currentChunk: integer("current_chunk").notNull().default(0), // Chunk atual para retomada
  offsetAtual: integer("offset_atual").notNull().default(0), // Offset em bytes para retomada de streaming
  baseTag: varchar("base_tag", { length: 100 }),
  convenio: varchar("convenio", { length: 100 }),
  maxLinhasExecucao: integer("max_linhas_execucao").default(1000000), // Limite de linhas por execução (1M)
  errorMessage: text("error_message"), // Mensagem de erro geral se falhar
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  pausedAt: timestamp("paused_at"), // Quando foi pausado para retomada
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tabela import_errors - Erros de linhas individuais
export const importErrors = pgTable("import_errors", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").references(() => importRuns.id, { onDelete: "cascade" }).notNull(),
  rowNumber: integer("row_number").notNull(), // Número da linha no arquivo original
  cpf: varchar("cpf", { length: 14 }), // CPF da linha (se disponível)
  matricula: varchar("matricula", { length: 50 }), // Matrícula da linha (se disponível)
  errorType: varchar("error_type", { length: 50 }).notNull(), // validation, database, parsing, etc.
  errorMessage: text("error_message").notNull(),
  rawPayload: jsonb("raw_payload"), // Linha completa do arquivo para debug
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Status de linha importada
export const IMPORT_ROW_STATUS = ["ok", "erro"] as const;
export type ImportRowStatus = typeof IMPORT_ROW_STATUS[number];

// Tabela import_run_rows - Rastreia TODAS as linhas importadas (sucesso ou erro)
export const importRunRows = pgTable("import_run_rows", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").references(() => importRuns.id, { onDelete: "cascade" }).notNull(),
  rowNumber: integer("row_number").notNull(), // Número da linha no arquivo original (1-based)
  cpf: varchar("cpf", { length: 14 }), // CPF da linha (se disponível)
  matricula: varchar("matricula", { length: 50 }), // Matrícula da linha (se disponível)
  status: varchar("status", { length: 10 }).notNull().default("ok"), // 'ok' ou 'erro'
  errorMessage: text("error_message"), // Mensagem de erro (se status='erro')
  rawData: jsonb("raw_data"), // Dados originais da linha como JSON
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schema for import_run_rows
export const insertImportRunRowSchema = createInsertSchema(importRunRows, {
  status: z.enum(IMPORT_ROW_STATUS).default("ok"),
}).omit({ id: true, createdAt: true });

// Types for import_run_rows
export type ImportRunRow = typeof importRunRows.$inferSelect;
export type InsertImportRunRow = z.infer<typeof insertImportRunRowSchema>;

// D8 layout types
export const D8_LAYOUTS = ["servidor", "pensionista"] as const;
export type D8Layout = typeof D8_LAYOUTS[number];

// Insert schemas
export const insertImportRunSchema = createInsertSchema(importRuns, {
  tipoImport: z.enum(IMPORT_TYPES).default("base_geral"),
  layoutD8: z.enum(D8_LAYOUTS).optional(),
  chunkSize: z.number().int().min(1000).max(50000).default(10000),
  maxLinhasExecucao: z.number().int().min(100000).max(10000000).default(1000000),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  processedRows: true, 
  successRows: true, 
  errorRows: true,
  currentChunk: true,
  offsetAtual: true,
  startedAt: true,
  completedAt: true,
  pausedAt: true,
});

// Insert schema for clientes_vinculo
export const insertClienteVinculoSchema = createInsertSchema(clientesVinculo, {
  cpf: z.string().min(11).max(14),
  matricula: z.string().min(1).max(50),
}).omit({ id: true, primeiraImportacao: true, ultimaAtualizacao: true });

export type ClienteVinculo = typeof clientesVinculo.$inferSelect;
export type InsertClienteVinculo = z.infer<typeof insertClienteVinculoSchema>;

export const insertImportErrorSchema = createInsertSchema(importErrors).omit({
  id: true,
  createdAt: true,
});

// Types
export type ImportRun = typeof importRuns.$inferSelect;
export type InsertImportRun = z.infer<typeof insertImportRunSchema>;

export type ImportError = typeof importErrors.$inferSelect;
export type InsertImportError = z.infer<typeof insertImportErrorSchema>;

// Tabela split_runs - Controle de jobs de split TXT→CSV incremental
export const splitRuns = pgTable("split_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("pendente"), // pendente, processando, pausado, concluido, erro
  currentPart: integer("current_part").notNull().default(0),
  linesInCurrentPart: integer("lines_in_current_part").notNull().default(0),
  byteOffset: bigint("byte_offset", { mode: "number" }).notNull().default(0),
  totalParts: integer("total_parts").default(0),
  totalLinesProcessed: integer("total_lines_processed").notNull().default(0),
  linesPerPart: integer("lines_per_part").notNull().default(100000),
  outputFolder: varchar("output_folder", { length: 500 }),
  errorMessage: text("error_message"),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSplitRunSchema = createInsertSchema(splitRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentPart: true,
  linesInCurrentPart: true,
  byteOffset: true,
  totalParts: true,
  totalLinesProcessed: true,
});

export type SplitRun = typeof splitRuns.$inferSelect;
export type InsertSplitRun = z.infer<typeof insertSplitRunSchema>;

// Tabela csv_split_runs - Controle de jobs de split CSV incremental (mantém header)
export const csvSplitRuns = pgTable("csv_split_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }),
  baseName: varchar("base_name", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("pendente"), // pendente, processando, pausado, concluido, erro
  currentPart: integer("current_part").notNull().default(0),
  lineOffset: bigint("line_offset", { mode: "number" }).notNull().default(0),
  headerLine: text("header_line"),
  totalParts: integer("total_parts").default(0),
  totalLinesProcessed: integer("total_lines_processed").notNull().default(0),
  linesPerPart: integer("lines_per_part").notNull().default(100000),
  outputFolder: varchar("output_folder", { length: 500 }),
  errorMessage: text("error_message"),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCsvSplitRunSchema = createInsertSchema(csvSplitRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentPart: true,
  lineOffset: true,
  headerLine: true,
  totalParts: true,
  totalLinesProcessed: true,
});

export type CsvSplitRun = typeof csvSplitRuns.$inferSelect;
export type InsertCsvSplitRun = z.infer<typeof insertCsvSplitRunSchema>;

// ===== STAGING TABLES FOR FAST BULK IMPORT =====
// These tables have NO indexes and are optimized for COPY operations

// Staging table for Folha imports
export const stagingFolha = pgTable("staging_folha", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").notNull(),
  cpf: varchar("cpf", { length: 14 }),
  matricula: varchar("matricula", { length: 50 }),
  nome: varchar("nome", { length: 255 }),
  orgaodesc: varchar("orgaodesc", { length: 255 }),
  upag: varchar("upag", { length: 50 }),
  uf: varchar("uf", { length: 2 }),
  municipio: varchar("municipio", { length: 100 }),
  baseCalc: decimal("base_calc", { precision: 15, scale: 2 }),
  margem5Bruta: decimal("margem_5_bruta", { precision: 15, scale: 2 }),
  margem5Utilizada: decimal("margem_5_utilizada", { precision: 15, scale: 2 }),
  margem5Saldo: decimal("margem_5_saldo", { precision: 15, scale: 2 }),
  margemBeneficio5Bruta: decimal("margem_beneficio_5_bruta", { precision: 15, scale: 2 }),
  margemBeneficio5Utilizada: decimal("margem_beneficio_5_utilizada", { precision: 15, scale: 2 }),
  margemBeneficio5Saldo: decimal("margem_beneficio_5_saldo", { precision: 15, scale: 2 }),
  margem35Bruta: decimal("margem_35_bruta", { precision: 15, scale: 2 }),
  margem35Utilizada: decimal("margem_35_utilizada", { precision: 15, scale: 2 }),
  margem35Saldo: decimal("margem_35_saldo", { precision: 15, scale: 2 }),
  margem70Bruta: decimal("margem_70_bruta", { precision: 15, scale: 2 }),
  margem70Utilizada: decimal("margem_70_utilizada", { precision: 15, scale: 2 }),
  margem70Saldo: decimal("margem_70_saldo", { precision: 15, scale: 2 }),
  margemCartaoCreditoSaldo: decimal("margem_cartao_credito_saldo", { precision: 15, scale: 2 }),
  margemCartaoBeneficioSaldo: decimal("margem_cartao_beneficio_saldo", { precision: 15, scale: 2 }),
  creditos: decimal("creditos", { precision: 15, scale: 2 }),
  debitos: decimal("debitos", { precision: 15, scale: 2 }),
  liquido: decimal("liquido", { precision: 15, scale: 2 }),
  excQtd: integer("exc_qtd"),
  excSoma: decimal("exc_soma", { precision: 15, scale: 2 }),
  rjur: varchar("rjur", { length: 50 }),
  sitFunc: varchar("sit_func", { length: 50 }),
  margem: decimal("margem", { precision: 15, scale: 2 }),
  instituidor: varchar("instituidor", { length: 255 }),
  rowNum: integer("row_num"),
  processed: boolean("processed").default(false),
  errorMessage: text("error_message"),
});

// Staging table for D8 (contracts) imports
export const stagingD8 = pgTable("staging_d8", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").notNull(),
  cpf: varchar("cpf", { length: 14 }),
  matricula: varchar("matricula", { length: 50 }),
  nome: varchar("nome", { length: 255 }),
  natureza: varchar("natureza", { length: 50 }),
  orgao: varchar("orgao", { length: 20 }),
  banco: varchar("banco", { length: 100 }),
  numeroContrato: varchar("numero_contrato", { length: 100 }),
  tipoContrato: varchar("tipo_contrato", { length: 100 }),
  valorParcela: decimal("valor_parcela", { precision: 15, scale: 2 }),
  saldoDevedor: decimal("saldo_devedor", { precision: 15, scale: 2 }),
  prazoRemanescente: integer("prazo_remanescente"),
  prazoTotal: integer("prazo_total"),
  situacaoContrato: varchar("situacao_contrato", { length: 50 }),
  dataInicio: varchar("data_inicio", { length: 20 }),
  dataFim: varchar("data_fim", { length: 20 }),
  mInstituidor: varchar("m_instituidor", { length: 50 }),
  cpfInstituidor: varchar("cpf_instituidor", { length: 14 }),
  rowNum: integer("row_num"),
  processed: boolean("processed").default(false),
  errorMessage: text("error_message"),
});

// Staging table for Contatos imports
export const stagingContatos = pgTable("staging_contatos", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").notNull(),
  cpf: varchar("cpf", { length: 20 }),
  telefone1: varchar("telefone_1", { length: 20 }),
  telefone2: varchar("telefone_2", { length: 20 }),
  telefone3: varchar("telefone_3", { length: 20 }),
  telefone4: varchar("telefone_4", { length: 20 }),
  telefone5: varchar("telefone_5", { length: 20 }),
  email: varchar("email", { length: 255 }),
  email2: varchar("email_2", { length: 255 }),
  endereco: text("endereco"),
  cidade: varchar("cidade", { length: 100 }),
  uf: varchar("uf", { length: 2 }),
  cep: varchar("cep", { length: 10 }),
  dataNascimento: varchar("data_nascimento", { length: 20 }),
  bancoNome: varchar("banco_nome", { length: 100 }),
  agencia: varchar("agencia", { length: 20 }),
  conta: varchar("conta", { length: 30 }),
  rowNum: integer("row_num"),
  processed: boolean("processed").default(false),
  errorMessage: text("error_message"),
});

export type StagingFolha = typeof stagingFolha.$inferSelect;
export type StagingD8 = typeof stagingD8.$inferSelect;
export type StagingContatos = typeof stagingContatos.$inferSelect;

// Default Role Play prompt
export const DEFAULT_ROLEPLAY_PROMPT = `Você é um CLIENTE SERVIDOR PÚBLICO REALISTA em uma simulação de atendimento de crédito consignado.
Regras obrigatórias:

Não repetir a mesma objeção mais de duas vezes seguidas.

A cada 1-2 respostas do consultor, mudar o foco da dúvida ou aprofundar outro aspecto.

Não insistir em "não vou conseguir pagar". No consignado o desconto é em folha. O medo real é decisão errada, taxa, parcela desconfortável, arrependimento, confiança, timing e comparação.

Evoluir a conversa (início dúvida genérica, meio específico, fim decisão ou avanço).
Varie os focos (um por resposta): taxa, parcela/conforto, comparação, arrependimento, uso do dinheiro, momento de vida, clareza nos números, confiança no consultor.
Tom: humano, curto, natural, sem termos técnicos e sem repetir frases.`;

// ===== EMPLOYEES & COMMERCIAL TEAMS SYSTEM =====

// Employees table - cadastro geral de funcionários
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }), // Se tiver acesso ao sistema
  
  // Dados Pessoais
  nomeCompleto: varchar("nome_completo", { length: 200 }).notNull(),
  cpf: varchar("cpf", { length: 11 }).notNull(),
  rg: varchar("rg", { length: 20 }),
  rgEstado: varchar("rg_estado", { length: 2 }),
  rgEmissao: varchar("rg_emissao", { length: 10 }),
  dataNascimento: varchar("data_nascimento", { length: 10 }),
  nacionalidade: varchar("nacionalidade", { length: 50 }),
  naturalidade: varchar("naturalidade", { length: 100 }),
  naturalidadeEstado: varchar("naturalidade_estado", { length: 2 }),
  raca: varchar("raca", { length: 30 }),
  grauInstrucao: varchar("grau_instrucao", { length: 50 }),
  emailCorporativo: varchar("email_corporativo", { length: 100 }),
  emailPessoal: varchar("email_pessoal", { length: 100 }),
  telefone: varchar("telefone", { length: 20 }),
  celular: varchar("celular", { length: 20 }),
  enderecoCompleto: text("endereco_completo"),
  bairro: varchar("bairro", { length: 100 }),
  cep: varchar("cep", { length: 8 }),
  cidade: varchar("cidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  
  // Dados Familiares
  nomePai: varchar("nome_pai", { length: 200 }),
  nomeMae: varchar("nome_mae", { length: 200 }),
  nomeConjuge: varchar("nome_conjuge", { length: 200 }),
  estadoCivil: varchar("estado_civil", { length: 20 }),
  quantidadeFilhos: integer("quantidade_filhos").default(0),
  
  // Documentos (CTPS, Título de Eleitor, PIS)
  ctpsNumero: varchar("ctps_numero", { length: 20 }),
  ctpsSerie: varchar("ctps_serie", { length: 10 }),
  ctpsEstado: varchar("ctps_estado", { length: 2 }),
  tituloEleitor: varchar("titulo_eleitor", { length: 20 }),
  tituloZona: varchar("titulo_zona", { length: 10 }),
  tituloSecao: varchar("titulo_secao", { length: 10 }),
  pis: varchar("pis", { length: 20 }),
  
  // Exame Admissional
  clinicaExame: varchar("clinica_exame", { length: 150 }),
  codigoCnes: varchar("codigo_cnes", { length: 20 }),
  medicoExame: varchar("medico_exame", { length: 150 }),
  crmMedico: varchar("crm_medico", { length: 20 }),
  dataExame: varchar("data_exame", { length: 10 }),
  dataVencimentoExame: varchar("data_vencimento_exame", { length: 10 }),
  
  // Dados Profissionais
  cargo: varchar("cargo", { length: 100 }),
  departamento: varchar("departamento", { length: 100 }), // RH, TI, Financeiro, Comercial, Marketing, Operacional
  tipoContrato: varchar("tipo_contrato", { length: 10 }), // CLT ou PJ
  dataAdmissao: varchar("data_admissao", { length: 10 }),
  dataDemissao: varchar("data_demissao", { length: 10 }),
  status: varchar("status", { length: 20 }).default("ativo"), // ativo, ferias, afastado, demitido
  salarioBase: decimal("salario_base", { precision: 10, scale: 2 }),
  adicionalSalarial: decimal("adicional_salarial", { precision: 10, scale: 2 }),
  
  // Horários de Trabalho
  horarioEntrada1: varchar("horario_entrada_1", { length: 5 }),
  horarioSaida1: varchar("horario_saida_1", { length: 5 }),
  horarioEntrada2: varchar("horario_entrada_2", { length: 5 }),
  horarioSaida2: varchar("horario_saida_2", { length: 5 }),
  horarioSabadoEntrada: varchar("horario_sabado_entrada", { length: 5 }),
  horarioSabadoSaida: varchar("horario_sabado_saida", { length: 5 }),
  
  // Benefícios e Descanso
  valeTransporte: boolean("vale_transporte"),
  valeRefeicao: boolean("vale_refeicao"),
  descansoSabado: boolean("descanso_sabado"),
  descansoDomingo: boolean("descanso_domingo"),
  
  // Período de Experiência
  periodoExperiencia: varchar("periodo_experiencia", { length: 20 }),
  renovacaoExperiencia: varchar("renovacao_experiencia", { length: 20 }),
  
  // Assinatura do Contrato
  cidadeAssinatura: varchar("cidade_assinatura", { length: 100 }),
  dataAssinatura: varchar("data_assinatura", { length: 10 }),
  
  // Dados Bancários
  banco: varchar("banco", { length: 100 }),
  agencia: varchar("agencia", { length: 10 }),
  conta: varchar("conta", { length: 20 }),
  tipoConta: varchar("tipo_conta", { length: 20 }),
  pix: varchar("pix", { length: 100 }),
  
  // Documentos (caminhos dos arquivos)
  documentoCpf: varchar("documento_cpf", { length: 255 }),
  documentoRg: varchar("documento_rg", { length: 255 }),
  documentoCtps: varchar("documento_ctps", { length: 255 }),
  documentoComprovanteResidencia: varchar("documento_comprovante_residencia", { length: 255 }),
  documentoContrato: varchar("documento_contrato", { length: 255 }),
  documentoOutros: jsonb("documento_outros"), // Array de caminhos
  
  // Acesso ao Sistema
  visaoBanco: varchar("visao_banco", { length: 10 }), // TODOS, SIAPE, INSS
  
  // Controle
  observacoes: text("observacoes"),
  criadoPor: integer("criado_por").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employees, {
  nomeCompleto: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(200),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos"),
  emailCorporativo: z.string().email("Email inválido").optional().nullable(),
  celular: z.string().optional().nullable(),
  visaoBanco: z.enum(["TODOS", "SIAPE", "INSS"]).optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

// Commercial Teams table - equipes comerciais
export const commercialTeams = pgTable("commercial_teams", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  nomeEquipe: varchar("nome_equipe", { length: 100 }).notNull(),
  descricao: text("descricao"),
  coordenadorId: integer("coordenador_id").references(() => employees.id, { onDelete: "set null" }),
  ativa: boolean("ativa").default(true),
  metaMensal: decimal("meta_mensal", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCommercialTeamSchema = createInsertSchema(commercialTeams, {
  nomeEquipe: z.string().min(2, "Nome da equipe deve ter pelo menos 2 caracteres").max(100),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type CommercialTeam = typeof commercialTeams.$inferSelect;
export type InsertCommercialTeam = z.infer<typeof insertCommercialTeamSchema>;

// Commercial Team Members table - membros das equipes comerciais
export const commercialTeamMembers = pgTable("commercial_team_members", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => commercialTeams.id, { onDelete: "cascade" }).notNull(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  funcaoEquipe: varchar("funcao_equipe", { length: 50 }), // coordenador, subcoordenador, assistente, vendedor, operacional
  ativo: boolean("ativo").default(true),
  
  // Remuneração
  tipoRemuneracao: varchar("tipo_remuneracao", { length: 50 }), // salario_fixo, salario_variavel, premiacao_meta
  percentualComissao: decimal("percentual_comissao", { precision: 5, scale: 2 }),
  valorFixoAdicional: decimal("valor_fixo_adicional", { precision: 10, scale: 2 }),
  percentualMeta: decimal("percentual_meta", { precision: 5, scale: 2 }),
  
  dataEntrada: varchar("data_entrada", { length: 10 }),
  dataSaida: varchar("data_saida", { length: 10 }),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCommercialTeamMemberSchema = createInsertSchema(commercialTeamMembers).omit({ id: true, createdAt: true, updatedAt: true });

export type CommercialTeamMember = typeof commercialTeamMembers.$inferSelect;
export type InsertCommercialTeamMember = z.infer<typeof insertCommercialTeamMemberSchema>;

// Vendedor Contratos table - contratos fechados pelos vendedores (produção)
export const vendedorContratos = pgTable("vendedor_contratos", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  vendedorId: integer("vendedor_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  clienteNome: varchar("cliente_nome", { length: 255 }).notNull(),
  clienteCpf: varchar("cliente_cpf", { length: 14 }),
  banco: varchar("banco", { length: 100 }),
  convenio: varchar("convenio", { length: 100 }),
  tipoOperacao: varchar("tipo_operacao", { length: 100 }),
  prazo: integer("prazo"),
  valorContrato: decimal("valor_contrato", { precision: 12, scale: 2 }).notNull(),
  valorParcela: decimal("valor_parcela", { precision: 10, scale: 2 }),
  valorTroco: decimal("valor_troco", { precision: 10, scale: 2 }),
  dataContrato: timestamp("data_contrato").notNull().defaultNow(),
  status: varchar("status", { length: 50 }).notNull().default("pendente"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVendedorContratoSchema = createInsertSchema(vendedorContratos).omit({ id: true, createdAt: true, updatedAt: true });

export type VendedorContrato = typeof vendedorContratos.$inferSelect;
export type InsertVendedorContrato = z.infer<typeof insertVendedorContratoSchema>;

