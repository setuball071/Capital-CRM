import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, inArray, sql, ilike, gte, lte, isNotNull } from "drizzle-orm";
import {
  users,
  banks,
  agreements,
  coefficientTables,
  simulations,
  roteirosBancarios,
  clientesPessoa,
  clientesVinculo,
  clientesFolhaMes,
  clientesContratos,
  clientContacts,
  clientesTelefones,
  clientSnapshots,
  basesImportadas,
  pedidosLista,
  pricingSettings,
  progressoLicoes,
  vendedoresAcademia,
  quizTentativas,
  roleplaySessoes,
  roleplayAvaliacoes,
  abordagensGeradas,
  salesCampaigns,
  salesLeads,
  salesLeadAssignments,
  salesLeadEvents,
  userPermissions,
  leadSchedules,
  leadContacts,
  leadInteractions,
  teams,
  teamMembers,
  aiPrompts,
  personalTasks,
  convenios,
  nomenclaturas,
  DEFAULT_ROLEPLAY_PROMPT,
  type User,
  type InsertUser,
  type Bank,
  type InsertBank,
  type Agreement,
  type InsertAgreement,
  type CoefficientTable,
  type InsertCoefficientTable,
  type Simulation,
  type InsertSimulation,
  type RoteiroBancario,
  type RoteiroImportItem,
  type ClientePessoa,
  type InsertClientePessoa,
  type ClienteVinculo,
  type ClienteFolhaMes,
  type InsertClienteFolhaMes,
  type ClienteContrato,
  type InsertClienteContrato,
  type ClientContact,
  type ClienteTelefone,
  type ClientSnapshot,
  type BaseImportada,
  type InsertBaseImportada,
  type PedidoLista,
  type InsertPedidoLista,
  type FiltrosPedidoLista,
  type PricingSettings,
  type InsertPricingSettings,
  type ProgressoLicao,
  type InsertProgressoLicao,
  type VendedorAcademia,
  type InsertVendedorAcademia,
  type QuizTentativa,
  type InsertQuizTentativa,
  type RoleplaySessao,
  type InsertRoleplaySessao,
  type RoleplayAvaliacao,
  type InsertRoleplayAvaliacao,
  type AbordagemGerada,
  type InsertAbordagemGerada,
  type SalesCampaign,
  type InsertSalesCampaign,
  type SalesLead,
  type InsertSalesLead,
  type SalesLeadAssignment,
  type InsertSalesLeadAssignment,
  type SalesLeadEvent,
  type InsertSalesLeadEvent,
  type UserPermission,
  type InsertUserPermission,
  type LeadSchedule,
  type InsertLeadSchedule,
  type LeadContact,
  type InsertLeadContact,
  type LeadInteraction,
  type InsertLeadInteraction,
  type Team,
  type InsertTeam,
  type TeamMember,
  type InsertTeamMember,
  type AiPrompt,
  type InsertAiPrompt,
  type PersonalTask,
  type InsertPersonalTask,
  type Convenio,
} from "@shared/schema";

// Use neon-http for serverless/edge environments
const queryClient = neon(process.env.DATABASE_URL!);
export const db = drizzle(queryClient);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<InsertUser, "isActive">): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByManager(managerId: number): Promise<User[]>;
  getActiveUsers(): Promise<User[]>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  
  // Banks
  getAllBanks(): Promise<Bank[]>;
  getActiveBanks(): Promise<Bank[]>;
  getBank(id: number): Promise<Bank | undefined>;
  getBankByName(name: string): Promise<Bank | undefined>;
  createBank(bank: InsertBank): Promise<Bank>;
  updateBank(id: number, data: Partial<InsertBank>): Promise<Bank | undefined>;
  deleteBank(id: number): Promise<void>;
  
  // Agreements
  getAllAgreements(): Promise<Agreement[]>;
  getActiveAgreements(): Promise<Agreement[]>;
  getAgreement(id: number): Promise<Agreement | undefined>;
  createAgreement(agreement: InsertAgreement): Promise<Agreement>;
  updateAgreement(id: number, data: Partial<InsertAgreement>): Promise<Agreement | undefined>;
  deleteAgreement(id: number): Promise<void>;
  
  // Coefficient Tables
  getAllCoefficientTables(): Promise<CoefficientTable[]>;
  getActiveCoefficientTables(): Promise<CoefficientTable[]>;
  getCoefficientTablesByAgreement(agreementId: number): Promise<CoefficientTable[]>;
  getOperationTypesByAgreement(agreementId: number): Promise<string[]>;
  getBanksByAgreementAndOperationType(agreementId: number, operationType: string): Promise<string[]>;
  getTermsByAgreementOperationTypeAndBank(agreementId: number, operationType: string, bank: string): Promise<number[]>;
  getTablesByAgreementOperationTypeBankAndTerm(agreementId: number, operationType: string, bank: string, termMonths: number): Promise<CoefficientTable[]>;
  getCoefficientTablesByBank(bank: string): Promise<CoefficientTable[]>;
  getCoefficientTablesByBankAndTerm(bank: string, termMonths: number): Promise<CoefficientTable[]>;
  getCoefficientTable(id: number): Promise<CoefficientTable | undefined>;
  createCoefficientTable(table: InsertCoefficientTable): Promise<CoefficientTable>;
  createCoefficientTablesBulk(tables: InsertCoefficientTable[]): Promise<CoefficientTable[]>;
  updateCoefficientTable(id: number, data: Partial<InsertCoefficientTable>): Promise<CoefficientTable | undefined>;
  deleteCoefficientTable(id: number): Promise<void>;
  
  // Simulations
  getAllSimulations(): Promise<Simulation[]>;
  getSimulationsByUser(userId: number): Promise<Simulation[]>;
  createSimulation(simulation: InsertSimulation): Promise<Simulation>;
  
  // Simulation Statistics
  getRankingByBank(startDate?: string, endDate?: string, userIds?: number[]): Promise<{ bank: string; count: number }[]>;
  getRankingByAgreement(startDate?: string, endDate?: string, userIds?: number[]): Promise<{ agreementName: string; count: number }[]>;
  getRankingByTerm(startDate?: string, endDate?: string, userIds?: number[]): Promise<{ termMonths: number; count: number }[]>;
  getRankingByOperationType(startDate?: string, endDate?: string, userIds?: number[]): Promise<{ operationType: string; count: number }[]>;
  getRecentSimulationsWithUser(limit?: number, startDate?: string, endDate?: string, userIds?: number[]): Promise<Array<Simulation & { userName: string }>>;
  getSimulationsByUserIds(userIds: number[]): Promise<Simulation[]>;
  
  // Roteiros Bancários
  getActiveRoteiros(): Promise<RoteiroBancario[]>;
  getRoteiro(id: number): Promise<RoteiroBancario | undefined>;
  searchRoteiros(convenio?: string, tipoOperacao?: string, idade?: number): Promise<RoteiroBancario[]>;
  importRoteiros(roteiros: RoteiroImportItem[]): Promise<{ created: number; combos: string[] }>;
  updateRoteiroMetadata(id: number, data: { banco?: string; convenio?: string; segmento?: string | null; tipoOperacao?: string }): Promise<RoteiroBancario | undefined>;
  searchRoteirosIA(filters: { convenio?: string | null; segmento?: string | null; tipoOperacao?: string | null; idade?: number | null; palavrasChave?: string[] }): Promise<RoteiroBancario[]>;
  getDistinctConvenios(): Promise<string[]>;
  getDistinctTiposOperacao(): Promise<string[]>;
  deleteRoteiro(id: number): Promise<void>;
  
  // ===== BASE DE CLIENTES =====
  
  // Clientes Pessoa
  getClientePessoaByMatricula(matricula: string): Promise<ClientePessoa | undefined>;
  getClientesByMatricula(matricula: string, tenantId: number, convenio?: string, baseTag?: string): Promise<ClientePessoa[]>;
  getClientePessoaById(id: number): Promise<ClientePessoa | undefined>;
  getClientesByCpf(cpf: string, tenantId: number, convenio?: string, baseTag?: string): Promise<ClientePessoa[]>;
  createClientePessoa(data: InsertClientePessoa): Promise<ClientePessoa>;
  updateClientePessoa(id: number, data: Partial<InsertClientePessoa>): Promise<ClientePessoa | undefined>;
  searchClientesPessoa(filtros: FiltrosPedidoLista): Promise<{ clientes: ClientePessoa[]; total: number }>;
  getDistinctConveniosClientes(): Promise<string[]>;
  getDistinctOrgaosClientes(): Promise<string[]>;
  getOrgaosWithCodigo(): Promise<{ codigo: string; nome: string }[]>;
  getDistinctUfsClientes(): Promise<string[]>;
  getDistinctBancosClientes(): Promise<string[]>;
  getDistinctTiposContratoClientes(): Promise<string[]>;
  
  // Clientes Vínculos
  getVinculosByPessoaId(pessoaId: number): Promise<ClienteVinculo[]>;
  getVinculoById(id: number): Promise<ClienteVinculo | undefined>;
  
  // Dados Complementares
  upsertDadosComplementaresPorCpf(cpf: string, tenantId: number, payload: {
    nome?: string | null;
    dataNascimento?: Date | string | null;
    bancoCodigo?: string | null;
    agencia?: string | null;
    conta?: string | null;
    telefone1?: string | null;
    telefone2?: string | null;
    telefone3?: string | null;
  }): Promise<{ pessoasAtualizadas: number; telefonesInseridos: number }>;
  
  // Clientes Telefones
  getTelefonesByPessoaId(pessoaId: number): Promise<ClienteTelefone[]>;
  
  // Clientes Folha Mês
  createClienteFolhaMes(data: InsertClienteFolhaMes): Promise<ClienteFolhaMes>;
  upsertClienteFolhaMes(data: InsertClienteFolhaMes): Promise<ClienteFolhaMes>;
  getFolhaMesByPessoaId(pessoaId: number): Promise<ClienteFolhaMes[]>;
  getFolhaMesByVinculoId(vinculoId: number): Promise<ClienteFolhaMes[]>;
  
  // Clientes Contratos
  createClienteContrato(data: InsertClienteContrato): Promise<ClienteContrato>;
  updateClienteContrato(id: number, data: Partial<InsertClienteContrato>): Promise<ClienteContrato | undefined>;
  getContratosByPessoaId(pessoaId: number): Promise<ClienteContrato[]>;
  getContratosByVinculoId(vinculoId: number): Promise<ClienteContrato[]>;
  
  // Bases Importadas
  getAllBasesImportadas(): Promise<BaseImportada[]>;
  getBaseImportada(id: number): Promise<BaseImportada | undefined>;
  getBaseByStatus(status: string): Promise<BaseImportada | undefined>;
  createBaseImportada(data: InsertBaseImportada): Promise<BaseImportada>;
  updateBaseImportada(id: number, data: Partial<InsertBaseImportada>): Promise<BaseImportada | undefined>;
  deleteBaseImportada(id: number, baseTag: string, tenantId?: number, importRunId?: number | null): Promise<{ deletedFolhas: number; deletedContratos: number; deletedVinculos: number; deletedContacts: number; deletedPessoas: number }>;
  
  // Pedidos Lista
  getAllPedidosLista(): Promise<PedidoLista[]>;
  getPedidosListaByUser(userId: number): Promise<PedidoLista[]>;
  getPedidoLista(id: number): Promise<PedidoLista | undefined>;
  createPedidoLista(data: InsertPedidoLista): Promise<PedidoLista>;
  updatePedidoLista(id: number, data: Partial<InsertPedidoLista>): Promise<PedidoLista | undefined>;
  getAllPedidosListaWithUser(): Promise<Array<PedidoLista & { coordenadorNome: string; coordenadorEmail: string }>>;
  updatePedidoListaStatus(id: number, status: string): Promise<PedidoLista | undefined>;
  
  // Pricing Settings
  getPricingSettings(): Promise<PricingSettings | undefined>;
  updatePricingSettings(data: Partial<InsertPricingSettings>): Promise<PricingSettings>;
  
  // ===== ACADEMIA CONSIGONE =====
  
  // Progresso de Lições
  getProgressoLicoesByUser(userId: number): Promise<ProgressoLicao[]>;
  getProgressoLicao(userId: number, licaoId: string): Promise<ProgressoLicao | undefined>;
  upsertProgressoLicao(data: InsertProgressoLicao): Promise<ProgressoLicao>;
  countLicoesConcluidas(userId: number, nivelId: number): Promise<number>;
  
  // Vendedor Academia
  getVendedorAcademia(userId: number): Promise<VendedorAcademia | undefined>;
  upsertVendedorAcademia(data: InsertVendedorAcademia): Promise<VendedorAcademia>;
  getAllVendedoresAcademia(): Promise<VendedorAcademia[]>;
  
  // Quiz
  createQuizTentativa(data: InsertQuizTentativa): Promise<QuizTentativa>;
  getQuizTentativasByUser(userId: number): Promise<QuizTentativa[]>;
  
  // Roleplay Sessões
  createRoleplaySessao(data: InsertRoleplaySessao): Promise<RoleplaySessao>;
  getRoleplaySessao(id: number): Promise<RoleplaySessao | undefined>;
  updateRoleplaySessao(id: number, data: Partial<InsertRoleplaySessao>): Promise<RoleplaySessao | undefined>;
  getRoleplaySessoesByUser(userId: number): Promise<RoleplaySessao[]>;
  
  // Roleplay Avaliações
  createRoleplayAvaliacao(data: InsertRoleplayAvaliacao): Promise<RoleplayAvaliacao>;
  getRoleplayAvaliacoesBySessao(sessaoId: number): Promise<RoleplayAvaliacao[]>;
  
  // Abordagens
  createAbordagemGerada(data: InsertAbordagemGerada): Promise<AbordagemGerada>;
  getAbordagensByUser(userId: number): Promise<AbordagemGerada[]>;
  
  // Convenios (lista padronizada por tenant)
  getConvenios(tenantId: number): Promise<Convenio[]>;
  upsertConvenio(tenantId: number, code: string, label: string): Promise<Convenio>;
  
  // ===== CRM DE VENDAS =====
  
  // Campanhas (with tenant filtering - pass null for master/all tenants)
  getAllSalesCampaigns(tenantId?: number | null): Promise<SalesCampaign[]>;
  getSalesCampaign(id: number, tenantId?: number | null): Promise<SalesCampaign | undefined>;
  createSalesCampaign(data: InsertSalesCampaign): Promise<SalesCampaign>;
  updateSalesCampaign(id: number, data: Partial<InsertSalesCampaign>, tenantId?: number | null): Promise<SalesCampaign | undefined>;
  deleteSalesCampaign(id: number, tenantId?: number | null): Promise<void>;
  
  // Leads
  getSalesLeadsByCampaign(campaignId: number): Promise<SalesLead[]>;
  createSalesLead(data: InsertSalesLead): Promise<SalesLead>;
  createSalesLeadsBulk(leads: InsertSalesLead[]): Promise<number>;
  getSalesLead(id: number): Promise<SalesLead | undefined>;
  getUnassignedLeads(campaignId: number, limit: number): Promise<SalesLead[]>;
  
  // Assignments
  createSalesLeadAssignment(data: InsertSalesLeadAssignment): Promise<SalesLeadAssignment>;
  getNextAssignment(userId: number, campaignId?: number): Promise<SalesLeadAssignment | undefined>;
  updateSalesLeadAssignment(id: number, data: Partial<InsertSalesLeadAssignment>): Promise<SalesLeadAssignment | undefined>;
  getAssignmentsByUser(userId: number, campaignId?: number): Promise<SalesLeadAssignment[]>;
  getAssignmentWithLead(assignmentId: number): Promise<{ assignment: SalesLeadAssignment; lead: SalesLead } | undefined>;
  countAssignmentsByStatus(userId: number): Promise<{ status: string; count: number }[]>;
  getMaxOrdemFila(userId: number, campaignId: number): Promise<number>;
  
  // Events
  createSalesLeadEvent(data: InsertSalesLeadEvent): Promise<SalesLeadEvent>;
  getEventsByAssignment(assignmentId: number): Promise<SalesLeadEvent[]>;
  
  // User Permissions
  getUserPermissions(userId: number): Promise<UserPermission[]>;
  setUserPermissions(userId: number, permissions: { module: string; canView: boolean; canEdit: boolean; canDelegate?: boolean }[]): Promise<void>;
  hasModuleAccess(userId: number, module: string): Promise<boolean>;
  hasModuleEditAccess(userId: number, module: string): Promise<boolean>;
  
  // Lead Schedules
  createSchedule(data: InsertLeadSchedule): Promise<LeadSchedule>;
  getSchedulesByUser(userId: number, status?: string): Promise<LeadSchedule[]>;
  updateSchedule(id: number, data: Partial<InsertLeadSchedule>): Promise<LeadSchedule | undefined>;
  getScheduleWithLead(scheduleId: number): Promise<{ schedule: LeadSchedule; assignment: SalesLeadAssignment; lead: SalesLead; campaign: SalesCampaign } | undefined>;
  
  // Distribution stats
  getDistributionStats(campaignId: number): Promise<{ userId: number; userName: string; total: number; novo: number; emAtendimento: number; concluido: number }[]>;
  returnLeadsToPool(assignmentIds: number[]): Promise<number>;
  transferLeads(fromUserId: number, toUserId: number, campaignId: number, quantidade: number): Promise<number>;
  
  // Lead Contacts
  getContactsByLead(leadId: number): Promise<LeadContact[]>;
  createContact(data: InsertLeadContact): Promise<LeadContact>;
  updateContact(id: number, data: Partial<InsertLeadContact>): Promise<LeadContact | undefined>;
  deleteContact(id: number): Promise<void>;
  setContactAsPrimary(contactId: number, leadId: number): Promise<void>;
  getDistinctContactLabels(): Promise<string[]>;
  getContactsByLabel(label: string): Promise<{ leadId: number; leadNome: string; cpf: string | null; contactId: number; value: string; label: string }[]>;
  
  // Lead Interactions
  createLeadInteraction(data: InsertLeadInteraction): Promise<LeadInteraction>;
  getInteractionsByLead(leadId: number): Promise<LeadInteraction[]>;
  
  // Queue management
  getNextLeadInQueue(userId: number, campaignId?: number): Promise<{ lead: SalesLead; assignment: SalesLeadAssignment; campaign: SalesCampaign } | undefined>;
  updateLeadMarker(leadId: number, marker: string, motivo?: string, retornoEm?: Date, tipoContato?: string): Promise<SalesLead | undefined>;
  
  // ===== CRM SYNC METHODS =====
  getClientePessoaByCpf(cpf: string): Promise<ClientePessoa | undefined>;
  upsertClientByCpf(data: InsertClientePessoa): Promise<ClientePessoa>;
  syncClientContracts(pessoaId: number, contratos: InsertClienteContrato[]): Promise<void>;
  createClientSnapshot(data: { clientId: number; referenceDate: Date; fonte: string; situacaoFuncional?: string; margemEmprestimo?: string; margemCartao?: string; margem5?: string; salarioBruto?: string; salarioLiquido?: string; dadosExtras?: any }): Promise<ClientSnapshot>;
  createCampaignFromFilter(filtros: FiltrosPedidoLista, nome: string, userId: number): Promise<{ campaign: SalesCampaign; leadsCreated: number }>;
  
  // ===== KANBAN PESSOAL =====
  getPersonalTasksByUser(userId: number): Promise<PersonalTask[]>;
  getPersonalTask(id: number, userId: number): Promise<PersonalTask | undefined>;
  createPersonalTask(data: InsertPersonalTask): Promise<PersonalTask>;
  updatePersonalTask(id: number, userId: number, data: Partial<InsertPersonalTask>): Promise<PersonalTask | undefined>;
  deletePersonalTask(id: number, userId: number): Promise<void>;
  reorderPersonalTasks(userId: number, column: string, taskIds: number[]): Promise<void>;
  countTasksInColumn(userId: number, column: string): Promise<number>;
  
  // ===== TEAMS & AI PROMPTS =====
  getAllTeams(): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(data: InsertTeam): Promise<Team>;
  updateTeam(id: number, data: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<void>;
  
  getTeamMembersByTeam(teamId: number): Promise<TeamMember[]>;
  getTeamMemberByUser(userId: number): Promise<TeamMember | undefined>;
  createTeamMember(data: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: number, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMemberByUser(userId: number): Promise<void>;
  
  getActiveRoleplayPrompt(userId: number): Promise<{ prompt: AiPrompt; scope: "global" | "team" }>;
  getGlobalRoleplayPrompts(): Promise<AiPrompt[]>;
  getTeamRoleplayPrompts(teamId: number): Promise<AiPrompt[]>;
  saveRoleplayPrompt(type: string, scope: "global" | "team", teamId: number | null, promptText: string, userId: number): Promise<AiPrompt>;
  resetTeamRoleplayPrompt(teamId: number): Promise<void>;
}

export class DbStorage implements IStorage {
  // ===== USERS =====
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: Omit<InsertUser, "isActive">): Promise<User> {
    const [newUser] = await db.insert(users).values({
      ...user,
      isActive: true,
    }).returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByManager(managerId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.managerId, managerId));
  }

  async getActiveUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true));
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ===== BANKS =====
  
  async getAllBanks(): Promise<Bank[]> {
    return await db.select().from(banks);
  }

  async getActiveBanks(): Promise<Bank[]> {
    return await db.select().from(banks).where(eq(banks.isActive, true));
  }

  async getBank(id: number): Promise<Bank | undefined> {
    const [bank] = await db.select().from(banks).where(eq(banks.id, id));
    return bank;
  }

  async getBankByName(name: string): Promise<Bank | undefined> {
    const [bank] = await db.select().from(banks).where(eq(banks.name, name));
    return bank;
  }

  async createBank(bank: InsertBank): Promise<Bank> {
    const [newBank] = await db.insert(banks).values({
      ...bank,
      isActive: true,
    }).returning();
    return newBank;
  }

  async updateBank(id: number, data: Partial<InsertBank>): Promise<Bank | undefined> {
    const [updated] = await db.update(banks)
      .set(data)
      .where(eq(banks.id, id))
      .returning();
    return updated;
  }

  async deleteBank(id: number): Promise<void> {
    await db.delete(banks).where(eq(banks.id, id));
  }

  // ===== AGREEMENTS =====
  
  async getAllAgreements(): Promise<Agreement[]> {
    return await db.select().from(agreements);
  }

  async getActiveAgreements(): Promise<Agreement[]> {
    return await db.select().from(agreements).where(eq(agreements.isActive, true));
  }

  async getAgreement(id: number): Promise<Agreement | undefined> {
    const [agreement] = await db.select().from(agreements).where(eq(agreements.id, id));
    return agreement;
  }

  async createAgreement(agreement: InsertAgreement): Promise<Agreement> {
    const [newAgreement] = await db.insert(agreements).values(agreement).returning();
    return newAgreement;
  }

  async updateAgreement(id: number, data: Partial<InsertAgreement>): Promise<Agreement | undefined> {
    const [updated] = await db.update(agreements)
      .set(data)
      .where(eq(agreements.id, id))
      .returning();
    return updated;
  }

  async deleteAgreement(id: number): Promise<void> {
    await db.delete(agreements).where(eq(agreements.id, id));
  }

  // ===== COEFFICIENT TABLES =====
  
  async getAllCoefficientTables(): Promise<CoefficientTable[]> {
    return await db.select().from(coefficientTables);
  }

  async getActiveCoefficientTables(): Promise<CoefficientTable[]> {
    return await db.select().from(coefficientTables).where(eq(coefficientTables.isActive, true));
  }

  async getCoefficientTablesByAgreement(agreementId: number): Promise<CoefficientTable[]> {
    return await db.select().from(coefficientTables)
      .where(and(
        eq(coefficientTables.agreementId, agreementId),
        eq(coefficientTables.isActive, true)
      ));
  }

  async getOperationTypesByAgreement(agreementId: number): Promise<string[]> {
    const tables = await db.select().from(coefficientTables)
      .where(and(
        eq(coefficientTables.agreementId, agreementId),
        eq(coefficientTables.isActive, true)
      ));
    const uniqueTypes = [...new Set(tables.map(t => t.operationType))];
    return uniqueTypes.sort();
  }

  async getBanksByAgreementAndOperationType(agreementId: number, operationType: string): Promise<string[]> {
    const tables = await db.select().from(coefficientTables)
      .where(and(
        eq(coefficientTables.agreementId, agreementId),
        eq(coefficientTables.operationType, operationType),
        eq(coefficientTables.isActive, true)
      ));
    const uniqueBanks = [...new Set(tables.map(t => t.bank))];
    return uniqueBanks.sort();
  }

  async getTermsByAgreementOperationTypeAndBank(agreementId: number, operationType: string, bank: string): Promise<number[]> {
    const tables = await db.select().from(coefficientTables)
      .where(and(
        eq(coefficientTables.agreementId, agreementId),
        eq(coefficientTables.operationType, operationType),
        eq(coefficientTables.bank, bank),
        eq(coefficientTables.isActive, true)
      ));
    const uniqueTerms = [...new Set(tables.map(t => t.termMonths))];
    return uniqueTerms.sort((a, b) => a - b);
  }

  async getTablesByAgreementOperationTypeBankAndTerm(agreementId: number, operationType: string, bank: string, termMonths: number): Promise<CoefficientTable[]> {
    return await db.select().from(coefficientTables)
      .where(and(
        eq(coefficientTables.agreementId, agreementId),
        eq(coefficientTables.operationType, operationType),
        eq(coefficientTables.bank, bank),
        eq(coefficientTables.termMonths, termMonths),
        eq(coefficientTables.isActive, true)
      ));
  }

  async getCoefficientTablesByBank(bank: string): Promise<CoefficientTable[]> {
    return await db.select().from(coefficientTables)
      .where(and(
        eq(coefficientTables.bank, bank),
        eq(coefficientTables.isActive, true)
      ));
  }

  async getCoefficientTablesByBankAndTerm(bank: string, termMonths: number): Promise<CoefficientTable[]> {
    return await db.select().from(coefficientTables)
      .where(and(
        eq(coefficientTables.bank, bank),
        eq(coefficientTables.termMonths, termMonths),
        eq(coefficientTables.isActive, true)
      ));
  }

  async getCoefficientTable(id: number): Promise<CoefficientTable | undefined> {
    const [table] = await db.select().from(coefficientTables).where(eq(coefficientTables.id, id));
    return table;
  }

  async createCoefficientTable(table: InsertCoefficientTable): Promise<CoefficientTable> {
    const [newTable] = await db.insert(coefficientTables).values(table).returning();
    return newTable;
  }

  async createCoefficientTablesBulk(tables: InsertCoefficientTable[]): Promise<CoefficientTable[]> {
    if (tables.length === 0) {
      return [];
    }
    const newTables = await db.insert(coefficientTables).values(tables).returning();
    return newTables;
  }

  async updateCoefficientTable(id: number, data: Partial<InsertCoefficientTable>): Promise<CoefficientTable | undefined> {
    const [updated] = await db.update(coefficientTables)
      .set(data)
      .where(eq(coefficientTables.id, id))
      .returning();
    return updated;
  }

  async deleteCoefficientTable(id: number): Promise<void> {
    await db.delete(coefficientTables).where(eq(coefficientTables.id, id));
  }

  // ===== SIMULATIONS =====
  
  async getAllSimulations(): Promise<Simulation[]> {
    return await db.select().from(simulations);
  }

  async getSimulationsByUser(userId: number): Promise<Simulation[]> {
    return await db.select().from(simulations).where(eq(simulations.userId, userId));
  }

  async createSimulation(simulation: InsertSimulation): Promise<Simulation> {
    const [newSimulation] = await db.insert(simulations).values(simulation).returning();
    return newSimulation;
  }

  // ===== SIMULATION STATISTICS =====
  
  async getRankingByBank(startDate?: string, endDate?: string, userIds?: number[]): Promise<{ bank: string; count: number }[]> {
    let query = `SELECT bank, COUNT(*)::int as count FROM simulations`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    
    if (startDate) {
      params.push(startDate);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`created_at <= $${params.length}`);
    }
    if (userIds && userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...userIds);
      conditions.push(`user_id IN (${placeholders})`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY bank ORDER BY count DESC`;
    
    const result = await queryClient(query, params);
    return result as { bank: string; count: number }[];
  }

  async getRankingByAgreement(startDate?: string, endDate?: string, userIds?: number[]): Promise<{ agreementName: string; count: number }[]> {
    let query = `SELECT agreement_name as "agreementName", COUNT(*)::int as count FROM simulations`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    
    if (startDate) {
      params.push(startDate);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`created_at <= $${params.length}`);
    }
    if (userIds && userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...userIds);
      conditions.push(`user_id IN (${placeholders})`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY agreement_name ORDER BY count DESC`;
    
    const result = await queryClient(query, params);
    return result as { agreementName: string; count: number }[];
  }

  async getRankingByTerm(startDate?: string, endDate?: string, userIds?: number[]): Promise<{ termMonths: number; count: number }[]> {
    let query = `SELECT term_months as "termMonths", COUNT(*)::int as count FROM simulations`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    
    if (startDate) {
      params.push(startDate);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`created_at <= $${params.length}`);
    }
    if (userIds && userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...userIds);
      conditions.push(`user_id IN (${placeholders})`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY term_months ORDER BY count DESC`;
    
    const result = await queryClient(query, params);
    return result as { termMonths: number; count: number }[];
  }

  async getRankingByOperationType(startDate?: string, endDate?: string, userIds?: number[]): Promise<{ operationType: string; count: number }[]> {
    let query = `SELECT operation_type as "operationType", COUNT(*)::int as count FROM simulations`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    
    if (startDate) {
      params.push(startDate);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`created_at <= $${params.length}`);
    }
    if (userIds && userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...userIds);
      conditions.push(`user_id IN (${placeholders})`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY operation_type ORDER BY count DESC`;
    
    const result = await queryClient(query, params);
    return result as { operationType: string; count: number }[];
  }

  async getRecentSimulationsWithUser(limit?: number, startDate?: string, endDate?: string, userIds?: number[]): Promise<Array<Simulation & { userName: string }>> {
    let query = `
      SELECT 
        s.id,
        s.user_id as "userId",
        s.client_name as "clientName",
        s.agreement_id as "agreementId",
        s.agreement_name as "agreementName",
        s.operation_type as "operationType",
        s.bank,
        s.term_months as "termMonths",
        s.table_name as "tableName",
        s.coefficient,
        s.monthly_payment as "monthlyPayment",
        s.outstanding_balance as "outstandingBalance",
        s.total_contract_value as "totalContractValue",
        s.client_refund as "clientRefund",
        s.created_at as "createdAt",
        u.name as "userName"
      FROM simulations s
      LEFT JOIN users u ON s.user_id = u.id
    `;
    
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    
    if (startDate) {
      params.push(startDate);
      conditions.push(`s.created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`s.created_at <= $${params.length}`);
    }
    if (userIds && userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...userIds);
      conditions.push(`s.user_id IN (${placeholders})`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY s.created_at DESC`;
    
    if (limit && limit > 0) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }
    
    console.log("[STORAGE] getRecentSimulationsWithUser - Query:", query);
    console.log("[STORAGE] getRecentSimulationsWithUser - Params:", params);
    
    const result = await queryClient(query, params);
    console.log("[STORAGE] getRecentSimulationsWithUser - Result:", Array.isArray(result) ? result.length : 0);
    return result as Array<Simulation & { userName: string }>;
  }

  async getSimulationsByUserIds(userIds: number[]): Promise<Simulation[]> {
    if (userIds.length === 0) {
      return [];
    }
    return await db.select().from(simulations).where(inArray(simulations.userId, userIds));
  }

  // ===== ROTEIROS BANCÁRIOS =====
  
  async getActiveRoteiros(): Promise<RoteiroBancario[]> {
    return await db.select().from(roteirosBancarios).where(eq(roteirosBancarios.ativo, true));
  }

  async getRoteiro(id: number): Promise<RoteiroBancario | undefined> {
    const [roteiro] = await db.select().from(roteirosBancarios).where(eq(roteirosBancarios.id, id));
    return roteiro;
  }

  async searchRoteiros(convenio?: string, tipoOperacao?: string, idade?: number): Promise<RoteiroBancario[]> {
    const conditions = [eq(roteirosBancarios.ativo, true)];
    
    if (convenio) {
      conditions.push(eq(roteirosBancarios.convenio, convenio));
    }
    if (tipoOperacao) {
      conditions.push(eq(roteirosBancarios.tipoOperacao, tipoOperacao));
    }
    
    const roteiros = await db.select().from(roteirosBancarios).where(and(...conditions));
    
    // Filter by age if provided
    if (idade !== undefined && idade !== null) {
      return roteiros.filter(roteiro => {
        const dados = roteiro.dados as any;
        const faixasIdade = dados?.faixas_idade;
        
        // If no faixas_idade, consider age as accepted
        if (!faixasIdade || !Array.isArray(faixasIdade) || faixasIdade.length === 0) {
          return true;
        }
        
        // Check if age falls within any faixa
        return faixasIdade.some((faixa: any) => {
          const idadeMin = faixa.idade_minima ?? 0;
          const idadeMax = faixa.idade_maxima ?? 999;
          return idade >= idadeMin && idade <= idadeMax;
        });
      });
    }
    
    return roteiros;
  }

  async importRoteiros(roteiros: RoteiroImportItem[]): Promise<{ created: number; combos: string[] }> {
    const combos: string[] = [];
    let created = 0;
    
    for (const roteiro of roteiros) {
      // Handle empty tipo_operacao - use default value
      const tipoOperacao = roteiro.tipo_operacao && roteiro.tipo_operacao.trim() !== "" 
        ? roteiro.tipo_operacao 
        : "Não especificado";
      
      const combo = `${roteiro.banco}|${roteiro.convenio}|${tipoOperacao}`;
      
      // Deactivate existing records with same combo
      await db.update(roteirosBancarios)
        .set({ ativo: false, updatedAt: new Date() })
        .where(and(
          eq(roteirosBancarios.banco, roteiro.banco),
          eq(roteirosBancarios.convenio, roteiro.convenio),
          eq(roteirosBancarios.tipoOperacao, tipoOperacao)
        ));
      
      // Extract dados from roteiro
      const dados = {
        publico_alvo: roteiro.publico_alvo || [],
        publico_nao_atendido: roteiro.publico_nao_atendido || [],
        faixas_idade: roteiro.faixas_idade || [],
        limites_operacionais: roteiro.limites_operacionais || {},
        documentacao_obrigatoria: roteiro.documentacao_obrigatoria || [],
        portais_acesso: roteiro.portais_acesso || [],
        regras_especiais: roteiro.regras_especiais || [],
        detalhes_adicionais: roteiro.detalhes_adicionais || [],
      };
      
      // Insert new record
      await db.insert(roteirosBancarios).values({
        banco: roteiro.banco,
        convenio: roteiro.convenio,
        segmento: roteiro.segmento || null,
        tipoOperacao: tipoOperacao,
        dados: dados,
        ativo: true,
      });
      
      combos.push(combo);
      created++;
    }
    
    return { created, combos };
  }

  async getDistinctConvenios(): Promise<string[]> {
    const roteiros = await db.select().from(roteirosBancarios).where(eq(roteirosBancarios.ativo, true));
    const uniqueConvenios = [...new Set(roteiros.map(r => r.convenio))];
    return uniqueConvenios.sort();
  }

  async getDistinctTiposOperacao(): Promise<string[]> {
    const roteiros = await db.select().from(roteirosBancarios).where(eq(roteirosBancarios.ativo, true));
    const uniqueTipos = [...new Set(roteiros.map(r => r.tipoOperacao))];
    return uniqueTipos.sort();
  }

  async updateRoteiroMetadata(id: number, data: { banco?: string; convenio?: string; segmento?: string | null; tipoOperacao?: string }): Promise<RoteiroBancario | undefined> {
    const updateData: any = { updatedAt: new Date() };
    
    if (data.banco !== undefined) updateData.banco = data.banco;
    if (data.convenio !== undefined) updateData.convenio = data.convenio;
    if (data.segmento !== undefined) updateData.segmento = data.segmento;
    if (data.tipoOperacao !== undefined) updateData.tipoOperacao = data.tipoOperacao;
    
    const [updated] = await db.update(roteirosBancarios)
      .set(updateData)
      .where(eq(roteirosBancarios.id, id))
      .returning();
    
    return updated;
  }

  async searchRoteirosIA(filters: { convenio?: string | null; segmento?: string | null; tipoOperacao?: string | null; idade?: number | null; palavrasChave?: string[] }): Promise<RoteiroBancario[]> {
    const conditions = [eq(roteirosBancarios.ativo, true)];
    
    if (filters.convenio) {
      conditions.push(sql`LOWER(${roteirosBancarios.convenio}) LIKE LOWER(${'%' + filters.convenio + '%'})`);
    }
    if (filters.segmento) {
      conditions.push(sql`LOWER(${roteirosBancarios.segmento}) LIKE LOWER(${'%' + filters.segmento + '%'})`);
    }
    if (filters.tipoOperacao) {
      conditions.push(eq(roteirosBancarios.tipoOperacao, filters.tipoOperacao));
    }
    
    let roteiros = await db.select().from(roteirosBancarios).where(and(...conditions));
    
    // Filter by age if provided
    if (filters.idade !== undefined && filters.idade !== null) {
      roteiros = roteiros.filter(roteiro => {
        const dados = roteiro.dados as any;
        const faixasIdade = dados?.faixas_idade;
        
        if (!faixasIdade || !Array.isArray(faixasIdade) || faixasIdade.length === 0) {
          return true;
        }
        
        return faixasIdade.some((faixa: any) => {
          const idadeMin = faixa.idade_minima ?? 0;
          const idadeMax = faixa.idade_maxima ?? 999;
          return filters.idade! >= idadeMin && filters.idade! <= idadeMax;
        });
      });
    }
    
    // Filter by keywords in dados JSONB field
    if (filters.palavrasChave && filters.palavrasChave.length > 0) {
      roteiros = roteiros.filter(roteiro => {
        const dadosStr = JSON.stringify(roteiro.dados).toLowerCase();
        const bancoStr = roteiro.banco.toLowerCase();
        const convenioStr = roteiro.convenio.toLowerCase();
        const segmentoStr = (roteiro.segmento || '').toLowerCase();
        const tipoStr = roteiro.tipoOperacao.toLowerCase();
        const fullText = `${bancoStr} ${convenioStr} ${segmentoStr} ${tipoStr} ${dadosStr}`;
        
        return filters.palavrasChave!.some(keyword => 
          fullText.includes(keyword.toLowerCase())
        );
      });
    }
    
    return roteiros;
  }

  async deleteRoteiro(id: number): Promise<void> {
    await db.delete(roteirosBancarios).where(eq(roteirosBancarios.id, id));
  }

  // ===== BASE DE CLIENTES =====

  // Clientes Pessoa
  async getClientePessoaByMatricula(matricula: string): Promise<ClientePessoa | undefined> {
    const [cliente] = await db.select().from(clientesPessoa).where(eq(clientesPessoa.matricula, matricula));
    return cliente;
  }

  async getClientesByMatricula(matricula: string, tenantId: number, convenio?: string, baseTag?: string): Promise<ClientePessoa[]> {
    // CRÍTICO: Sempre filtrar por tenant_id para isolamento multi-tenant
    const conditions = [
      eq(clientesPessoa.matricula, matricula),
      eq(clientesPessoa.tenantId, tenantId)
    ];
    if (convenio) {
      conditions.push(ilike(clientesPessoa.convenio, convenio));
    }
    if (baseTag) {
      conditions.push(eq(clientesPessoa.baseTagUltima, baseTag));
    }
    // Sistema usa hard delete - registros deletados são fisicamente removidos
    const results = await db.select().from(clientesPessoa).where(and(...conditions));
    console.log(`[getClientesByMatricula] tenant=${tenantId}, matricula="${matricula}", found=${results.length}`);
    return results;
  }

  async getClientePessoaById(id: number): Promise<ClientePessoa | undefined> {
    const [cliente] = await db.select().from(clientesPessoa).where(eq(clientesPessoa.id, id));
    return cliente;
  }

  async getClientesByCpf(cpf: string, tenantId: number, convenio?: string, baseTag?: string): Promise<ClientePessoa[]> {
    // Remove formatting from CPF (dots and dashes) and normalize to 11 digits
    const cleanCpf = cpf.replace(/\D/g, "").padStart(11, "0");
    
    // CRÍTICO: Sempre filtrar por tenant_id para isolamento multi-tenant
    const conditions = [
      eq(clientesPessoa.cpf, cleanCpf),
      eq(clientesPessoa.tenantId, tenantId)
    ];
    
    if (convenio) {
      conditions.push(ilike(clientesPessoa.convenio, convenio));
    }
    if (baseTag) {
      conditions.push(eq(clientesPessoa.baseTagUltima, baseTag));
    }
    
    const results = await db.select()
      .from(clientesPessoa)
      .where(and(...conditions));
    console.log(`[getClientesByCpf] tenant=${tenantId}, cpf="${cleanCpf}", found=${results.length}`);
    return results;
  }

  async createClientePessoa(data: InsertClientePessoa): Promise<ClientePessoa> {
    const [newCliente] = await db.insert(clientesPessoa).values(data).returning();
    return newCliente;
  }

  async updateClientePessoa(id: number, data: Partial<InsertClientePessoa>): Promise<ClientePessoa | undefined> {
    const [updated] = await db.update(clientesPessoa)
      .set({ ...data, atualizadoEm: new Date() })
      .where(eq(clientesPessoa.id, id))
      .returning();
    return updated;
  }

  async searchClientesPessoa(filtros: FiltrosPedidoLista): Promise<{ clientes: ClientePessoa[]; total: number }> {
    // Check if we need folha or contrato joins
    const needsFolhaJoin = !!(
      filtros.margem_30_min !== undefined || filtros.margem_30_max !== undefined ||
      filtros.margem_35_min !== undefined || filtros.margem_35_max !== undefined ||
      filtros.margem_70_min !== undefined || filtros.margem_70_max !== undefined ||
      filtros.margem_cartao_credito_min !== undefined || filtros.margem_cartao_credito_max !== undefined ||
      filtros.margem_cartao_beneficio_min !== undefined || filtros.margem_cartao_beneficio_max !== undefined
    );
    
    const needsContratoJoin = !!(
      filtros.banco || filtros.tipo_contrato || filtros.parcela_min !== undefined || filtros.parcela_max !== undefined
    );
    
    const needsContratoCountFilter = filtros.qtd_contratos_min !== undefined || filtros.qtd_contratos_max !== undefined;

    // Build pessoa conditions
    const pessoaConditions: any[] = [];
    
    if (filtros.convenio) {
      pessoaConditions.push(ilike(clientesPessoa.convenio, `%${filtros.convenio}%`));
    }
    if (filtros.orgao) {
      pessoaConditions.push(ilike(clientesPessoa.orgaodesc, `%${filtros.orgao}%`));
    }
    if (filtros.uf) {
      pessoaConditions.push(eq(clientesPessoa.uf, filtros.uf));
    }
    if (filtros.sit_func) {
      pessoaConditions.push(ilike(clientesPessoa.sitFunc, `%${filtros.sit_func}%`));
    }

    // If we need joins or count filter, use parameterized SQL query for safety
    if (needsFolhaJoin || needsContratoJoin || needsContratoCountFilter) {
      // Build parameterized query using Drizzle's sql tagged template
      const folhaJoinSql = needsFolhaJoin ? sql`
        INNER JOIN LATERAL (
          SELECT * FROM clientes_folha_mes f
          WHERE f.pessoa_id = p.id
          ORDER BY f.competencia DESC
          LIMIT 1
        ) folha ON true
      ` : sql``;
      
      const contratoJoinSql = needsContratoJoin ? sql`
        INNER JOIN clientes_contratos c ON c.pessoa_id = p.id
      ` : sql``;

      // Build WHERE conditions using parameterized values (safe from SQL injection)
      const whereConditions: ReturnType<typeof sql>[] = [];

      // Pessoa conditions (parameterized)
      if (filtros.convenio) {
        whereConditions.push(sql`p.convenio ILIKE ${'%' + filtros.convenio + '%'}`);
      }
      if (filtros.orgao) {
        whereConditions.push(sql`p.orgaodesc ILIKE ${'%' + filtros.orgao + '%'}`);
      }
      if (filtros.uf) {
        whereConditions.push(sql`p.uf = ${filtros.uf}`);
      }
      if (filtros.sit_func) {
        whereConditions.push(sql`p.sit_func ILIKE ${'%' + filtros.sit_func + '%'}`);
      }

      // Margem 5% conditions (era margem_30 na UI, mas é margem_saldo_5 no banco)
      // Obs: O schema atual usa margem_saldo_5, não margem_saldo_30

      // Margem 35% conditions (parameterized)
      if (filtros.margem_35_min !== undefined) {
        whereConditions.push(sql`folha.margem_saldo_35 >= ${filtros.margem_35_min}`);
      }
      if (filtros.margem_35_max !== undefined) {
        whereConditions.push(sql`folha.margem_saldo_35 <= ${filtros.margem_35_max}`);
      }

      // Margem 70% conditions (parameterized)
      if (filtros.margem_70_min !== undefined) {
        whereConditions.push(sql`folha.margem_saldo_70 >= ${filtros.margem_70_min}`);
      }
      if (filtros.margem_70_max !== undefined) {
        whereConditions.push(sql`folha.margem_saldo_70 <= ${filtros.margem_70_max}`);
      }

      // Margem cartão crédito conditions (parameterized)
      if (filtros.margem_cartao_credito_min !== undefined) {
        whereConditions.push(sql`folha.margem_cartao_credito_saldo >= ${filtros.margem_cartao_credito_min}`);
      }
      if (filtros.margem_cartao_credito_max !== undefined) {
        whereConditions.push(sql`folha.margem_cartao_credito_saldo <= ${filtros.margem_cartao_credito_max}`);
      }

      // Margem cartão benefício conditions (parameterized)
      if (filtros.margem_cartao_beneficio_min !== undefined) {
        whereConditions.push(sql`folha.margem_cartao_beneficio_saldo >= ${filtros.margem_cartao_beneficio_min}`);
      }
      if (filtros.margem_cartao_beneficio_max !== undefined) {
        whereConditions.push(sql`folha.margem_cartao_beneficio_saldo <= ${filtros.margem_cartao_beneficio_max}`);
      }

      // Contrato conditions (parameterized)
      if (filtros.banco) {
        whereConditions.push(sql`c.banco ILIKE ${'%' + filtros.banco + '%'}`);
      }
      if (filtros.tipo_contrato) {
        whereConditions.push(sql`c.tipo_contrato ILIKE ${'%' + filtros.tipo_contrato + '%'}`);
      }
      if (filtros.parcela_min !== undefined) {
        whereConditions.push(sql`c.valor_parcela >= ${filtros.parcela_min}`);
      }
      if (filtros.parcela_max !== undefined) {
        whereConditions.push(sql`c.valor_parcela <= ${filtros.parcela_max}`);
      }
      
      // Filtro de quantidade de contratos via subquery
      if (filtros.qtd_contratos_min !== undefined || filtros.qtd_contratos_max !== undefined) {
        const minContratos = filtros.qtd_contratos_min ?? 0;
        const maxContratos = filtros.qtd_contratos_max;
        
        if (maxContratos !== undefined) {
          whereConditions.push(sql`(
            SELECT COUNT(*) FROM clientes_contratos cc 
            WHERE cc.pessoa_id = p.id
          ) BETWEEN ${minContratos} AND ${maxContratos}`);
        } else {
          whereConditions.push(sql`(
            SELECT COUNT(*) FROM clientes_contratos cc 
            WHERE cc.pessoa_id = p.id
          ) >= ${minContratos}`);
        }
      }

      // Combine WHERE conditions
      let whereSql = sql``;
      if (whereConditions.length > 0) {
        whereSql = sql`WHERE ${whereConditions.reduce((acc, cond, i) => 
          i === 0 ? cond : sql`${acc} AND ${cond}`
        )}`;
      }

      // Build final query with all parameterized parts
      // Include folha fields for frontend display when folha join is used
      const selectFields = needsFolhaJoin 
        ? sql`p.*, 
              folha.margem_saldo_5 as margem_5,
              folha.margem_saldo_35 as margem_35,
              folha.margem_saldo_70 as margem_70,
              folha.margem_cartao_credito_saldo,
              folha.margem_cartao_beneficio_saldo`
        : sql`p.*, 
              NULL::numeric as margem_5,
              NULL::numeric as margem_35,
              NULL::numeric as margem_70,
              NULL::numeric as margem_cartao_credito_saldo,
              NULL::numeric as margem_cartao_beneficio_saldo`;

      const query = sql`
        SELECT DISTINCT ${selectFields}
        FROM clientes_pessoa p
        ${folhaJoinSql}
        ${contratoJoinSql}
        ${whereSql}
      `;

      const result = await db.execute(query);
      const clientes = result.rows as (ClientePessoa & { 
        margem_5: string | null;
        margem_35: string | null;
        margem_70: string | null;
        margem_cartao_credito_saldo: string | null;
        margem_cartao_beneficio_saldo: string | null;
      })[];
      
      return { clientes, total: clientes.length };
    } else {
      // Simple query without joins using Drizzle's query builder
      let clientes: ClientePessoa[];
      if (pessoaConditions.length > 0) {
        clientes = await db.select().from(clientesPessoa).where(and(...pessoaConditions));
      } else {
        clientes = await db.select().from(clientesPessoa);
      }
      
      return { clientes, total: clientes.length };
    }
  }

  async getDistinctConveniosClientes(): Promise<string[]> {
    const result = await db.select({ convenio: clientesPessoa.convenio }).from(clientesPessoa);
    const uniqueConvenios = [...new Set(result.map(r => r.convenio).filter(Boolean))];
    return uniqueConvenios.sort() as string[];
  }

  async getDistinctOrgaosClientes(): Promise<string[]> {
    // Busca nomenclaturas de órgãos cadastradas (nomes completos)
    const nomenclaturasResult = await db.select({ nome: nomenclaturas.nome })
      .from(nomenclaturas)
      .where(and(
        eq(nomenclaturas.categoria, "ORGAO"),
        eq(nomenclaturas.ativo, true)
      ));
    
    if (nomenclaturasResult.length > 0) {
      // Retorna nomes das nomenclaturas ordenados alfabeticamente
      return nomenclaturasResult
        .map(r => r.nome)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")) as string[];
    }
    
    // Fallback: busca da tabela de pessoas se não houver nomenclaturas
    const result = await db.select({ orgaodesc: clientesPessoa.orgaodesc }).from(clientesPessoa);
    const uniqueOrgaos = [...new Set(result.map(r => r.orgaodesc).filter(Boolean))];
    return uniqueOrgaos.sort() as string[];
  }

  async getOrgaosWithCodigo(): Promise<{ codigo: string; nome: string }[]> {
    // Busca nomenclaturas de órgãos com código e nome
    const nomenclaturasResult = await db.select({ 
      codigo: nomenclaturas.codigo, 
      nome: nomenclaturas.nome 
    })
      .from(nomenclaturas)
      .where(and(
        eq(nomenclaturas.categoria, "ORGAO"),
        eq(nomenclaturas.ativo, true)
      ));
    
    if (nomenclaturasResult.length > 0) {
      return nomenclaturasResult
        .filter(r => r.codigo && r.nome)
        .map(r => ({ codigo: r.codigo!, nome: r.nome! }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }
    
    // Fallback: busca da tabela de pessoas (usa orgaodesc como código e nome)
    const result = await db.select({ orgaodesc: clientesPessoa.orgaodesc }).from(clientesPessoa);
    const uniqueOrgaos = [...new Set(result.map(r => r.orgaodesc).filter(Boolean))];
    return uniqueOrgaos.sort().map(org => ({ codigo: org!, nome: org! }));
  }

  async getDistinctUfsClientes(): Promise<string[]> {
    const result = await db.select({ uf: clientesPessoa.uf }).from(clientesPessoa);
    const uniqueUfs = [...new Set(result.map(r => r.uf).filter(Boolean))];
    return uniqueUfs.sort() as string[];
  }

  async getDistinctBancosClientes(): Promise<string[]> {
    // Funcao auxiliar para normalizar nomes (remover acentos, uppercase, trim)
    const normalizarNome = (nome: string): string => {
      return nome
        .toUpperCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[().,\-]/g, " ") // Remove pontuacao
        .replace(/\s+/g, " ") // Normaliza espacos
        .replace(/\s*S\.?A\.?\s*/gi, "") // Remove S.A., SA
        .replace(/\s*LTDA\.?\s*/gi, "") // Remove LTDA
        .trim();
    };
    
    // Busca lista de bancos válidos da tabela de nomenclaturas (fonte autoritativa)
    const nomenclaturasResult = await db.select({ nome: nomenclaturas.nome })
      .from(nomenclaturas)
      .where(and(
        eq(nomenclaturas.categoria, "BANCO"),
        eq(nomenclaturas.ativo, true)
      ));
    
    // Mapeia nomes normalizados para nomes originais da nomenclatura
    const bancosValidosMap = new Map<string, string>();
    nomenclaturasResult.forEach(r => {
      if (r.nome) {
        bancosValidosMap.set(normalizarNome(r.nome), r.nome);
      }
    });
    
    // Se não houver nomenclaturas, usa lista hardcoded como fallback
    if (bancosValidosMap.size === 0) {
      const bancosHardcoded = [
        "BANCO DO BRASIL", "BANCO SANTANDER", "CAIXA ECONOMICA FEDERAL", 
        "BANCO BRADESCO", "BANCO ITAU", "BANCO BMG", "BANCO PAN", 
        "BANCO FIBRA", "BANCO PINE", "BANCO DAYCOVAL", "BANCO CETELEM",
        "SICOOB", "SICREDI", "BANCO MERCANTIL DO BRASIL", "BANCO SAFRA",
        "BANCO VOTORANTIM", "BANCO INTER", "C6 BANK", "NUBANK",
        "BANCO ORIGINAL", "BTG PACTUAL", "BANCO MODAL", "BANCO DIGIMAIS",
        "BANCO DIGIO", "BANCO ALFA", "AGIBANK", "BRB", "BANRISUL",
        "BNB", "BANPARA", "BANESTES", "BANCO ITAUBANK", "BANCO BONSUCESSO",
        "BANCO BANDEPE", "BANCO ARBI", "BANCO BARI", "BANCO ABC BRASIL",
        "BANCO INDUSTRIAL DO BRASIL", "BANCO INDUSTRIAL", "BANCO RENDIMENTO",
        "BANCO SOFISA", "BANCO TRIANGULO", "BANCO PARANA", "BANCO CCB BRASIL",
        "ICATU", "BANCO OURINVEST", "PICPAY", "MERCADO PAGO", "PAGBANK",
        "STONE", "BANCO SEMEAR", "FACTA FINANCEIRA", "BANCO MASTER",
        "BANCO RIBEIRAO PRETO", "BANCO ITAU BBA", "BANK OF AMERICA",
        "CREFISA", "CREDITAS", "WILL BANK", "NEON"
      ];
      bancosHardcoded.forEach(b => bancosValidosMap.set(normalizarNome(b), b));
    }
    
    // Busca bancos distintos dos contratos do cliente
    const contratosResult = await db.select({ banco: clientesContratos.banco })
      .from(clientesContratos);
    const bancosNosContratos = [...new Set(contratosResult.map(r => r.banco).filter(Boolean))];
    
    // Filtra e mapeia bancos dos contratos para nomes padronizados
    const bancosResultado = new Set<string>();
    
    bancosNosContratos.forEach(banco => {
      if (!banco) return;
      const bancoNormalizado = normalizarNome(banco);
      
      // Busca correspondencia exata primeiro
      if (bancosValidosMap.has(bancoNormalizado)) {
        bancosResultado.add(bancosValidosMap.get(bancoNormalizado)!);
        return;
      }
      
      // Busca correspondencia parcial (nome do banco contem ou esta contido)
      for (const [normKey, nomeOriginal] of bancosValidosMap) {
        if (bancoNormalizado.includes(normKey) || normKey.includes(bancoNormalizado)) {
          bancosResultado.add(nomeOriginal);
          return;
        }
      }
    });
    
    // Se não houver resultados, retorna todos os bancos válidos da nomenclatura
    if (bancosResultado.size === 0) {
      return [...bancosValidosMap.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    
    return [...bancosResultado].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  async getDistinctTiposContratoClientes(): Promise<string[]> {
    const result = await db.select({ tipoContrato: clientesContratos.tipoContrato }).from(clientesContratos);
    const uniqueTipos = [...new Set(result.map(r => r.tipoContrato).filter(Boolean))];
    return uniqueTipos.sort() as string[];
  }

  // Clientes Folha Mês
  async createClienteFolhaMes(data: InsertClienteFolhaMes): Promise<ClienteFolhaMes> {
    const [newFolha] = await db.insert(clientesFolhaMes).values(data).returning();
    return newFolha;
  }

  async upsertClienteFolhaMes(data: InsertClienteFolhaMes): Promise<ClienteFolhaMes> {
    // Busca folha existente por vinculoId + competência (chave única correta)
    // Se não tem vinculoId, fallback para pessoaId + competência + baseTag (legado)
    let existing: ClienteFolhaMes[] = [];
    
    if (data.vinculoId) {
      existing = await db.select()
        .from(clientesFolhaMes)
        .where(and(
          eq(clientesFolhaMes.vinculoId, data.vinculoId),
          eq(clientesFolhaMes.competencia, data.competencia!)
        ))
        .limit(1);
    } else {
      // Fallback legado para imports antigos sem vinculoId
      existing = await db.select()
        .from(clientesFolhaMes)
        .where(and(
          eq(clientesFolhaMes.pessoaId, data.pessoaId!),
          eq(clientesFolhaMes.competencia, data.competencia!),
          eq(clientesFolhaMes.baseTag, data.baseTag!)
        ))
        .limit(1);
    }

    if (existing.length > 0) {
      const old = existing[0];
      
      // Merge extrasFolha se ambos existirem
      let mergedExtras = data.extrasFolha;
      if (old.extrasFolha && data.extrasFolha) {
        mergedExtras = { ...old.extrasFolha as object, ...data.extrasFolha as object };
      } else if (old.extrasFolha && !data.extrasFolha) {
        // Preserve existing extras if new data has null
        mergedExtras = old.extrasFolha;
      }

      // Só atualiza campos que têm valores não-nulos (preserva dados existentes)
      const updateData: Record<string, any> = { extrasFolha: mergedExtras };
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined && key !== 'extrasFolha' && key !== 'pessoaId' && key !== 'id') {
          updateData[key] = value;
        }
      }

      const [updated] = await db.update(clientesFolhaMes)
        .set(updateData)
        .where(eq(clientesFolhaMes.id, old.id))
        .returning();
      return updated;
    }

    const [newFolha] = await db.insert(clientesFolhaMes).values(data).returning();
    return newFolha;
  }

  async getFolhaMesByPessoaId(pessoaId: number): Promise<ClienteFolhaMes[]> {
    return await db.select()
      .from(clientesFolhaMes)
      .where(eq(clientesFolhaMes.pessoaId, pessoaId))
      .orderBy(sql`${clientesFolhaMes.competencia} DESC`);
  }
  
  async getFolhaMesByVinculoId(vinculoId: number): Promise<ClienteFolhaMes[]> {
    return await db.select()
      .from(clientesFolhaMes)
      .where(eq(clientesFolhaMes.vinculoId, vinculoId))
      .orderBy(sql`${clientesFolhaMes.competencia} DESC`);
  }

  // Clientes Vínculos
  async getVinculosByPessoaId(pessoaId: number): Promise<ClienteVinculo[]> {
    return await db.select()
      .from(clientesVinculo)
      .where(eq(clientesVinculo.pessoaId, pessoaId))
      .orderBy(sql`${clientesVinculo.ultimaAtualizacao} DESC`);
  }
  
  async getVinculoById(id: number): Promise<ClienteVinculo | undefined> {
    const [vinculo] = await db.select()
      .from(clientesVinculo)
      .where(eq(clientesVinculo.id, id));
    return vinculo;
  }

  // Dados Complementares
  async upsertDadosComplementaresPorCpf(
    cpf: string,
    tenantId: number,
    payload: {
      nome?: string | null;
      dataNascimento?: Date | string | null;
      bancoCodigo?: string | null;
      agencia?: string | null;
      conta?: string | null;
      telefone1?: string | null;
      telefone2?: string | null;
      telefone3?: string | null;
    }
  ): Promise<{ pessoasAtualizadas: number; telefonesInseridos: number }> {
    // Normalizar CPF: apenas dígitos, padStart 11
    const cpfNorm = cpf.replace(/\D/g, "").padStart(11, "0");
    
    if (cpfNorm.length !== 11) {
      return { pessoasAtualizadas: 0, telefonesInseridos: 0 };
    }

    // Buscar todas as pessoas com esse CPF no tenant
    const pessoas = await db.select()
      .from(clientesPessoa)
      .where(and(
        eq(clientesPessoa.cpf, cpfNorm),
        eq(clientesPessoa.tenantId, tenantId)
      ));

    if (pessoas.length === 0) {
      return { pessoasAtualizadas: 0, telefonesInseridos: 0 };
    }

    // Função para normalizar data de nascimento (aceita DD/MM/AAAA e AAAA-MM-DD)
    function parseDataNascimento(val: Date | string | null | undefined): Date | null {
      if (!val) return null;
      if (val instanceof Date) return val;
      
      const str = String(val).trim();
      if (!str) return null;
      
      // Formato DD/MM/AAAA
      const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (brMatch) {
        const [, dia, mes, ano] = brMatch;
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      }
      
      // Formato AAAA-MM-DD (ISO)
      const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        const [, ano, mes, dia] = isoMatch;
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      }
      
      // Tentar parse padrão
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    // Montar objeto de atualização apenas com campos não vazios
    const updateData: Record<string, any> = {};
    
    // Nome: só atualiza se vier preenchido (não sobrescreve com vazio)
    if (payload.nome !== undefined && payload.nome !== null && String(payload.nome).trim()) {
      updateData.nome = String(payload.nome).trim();
    }
    
    const dataNasc = parseDataNascimento(payload.dataNascimento);
    if (dataNasc) {
      updateData.dataNascimento = dataNasc;
    }
    
    // Banco, agencia, conta: preservar como text (mantém zeros à esquerda)
    if (payload.bancoCodigo !== undefined && payload.bancoCodigo !== null && String(payload.bancoCodigo).trim()) {
      updateData.bancoCodigo = String(payload.bancoCodigo).trim();
    }
    if (payload.agencia !== undefined && payload.agencia !== null && String(payload.agencia).trim()) {
      updateData.agencia = String(payload.agencia).trim();
    }
    if (payload.conta !== undefined && payload.conta !== null && String(payload.conta).trim()) {
      updateData.conta = String(payload.conta).trim();
    }

    let pessoasAtualizadas = 0;

    // Atualizar clientes_pessoa se houver dados
    if (Object.keys(updateData).length > 0) {
      updateData.atualizadoEm = new Date();
      
      for (const pessoa of pessoas) {
        await db.update(clientesPessoa)
          .set(updateData)
          .where(eq(clientesPessoa.id, pessoa.id));
        pessoasAtualizadas++;
      }
    }

    // Processar telefones: extrair, normalizar e deduplicar
    // telefone1 = principal, telefone2/3 = não principal
    const telefonesComPrincipal: { telefone: string; principal: boolean }[] = [];
    const telefonesVistos = new Set<string>();
    
    const telefonesRaw = [
      { val: payload.telefone1, principal: true },
      { val: payload.telefone2, principal: false },
      { val: payload.telefone3, principal: false },
    ];
    
    for (const { val, principal } of telefonesRaw) {
      if (!val || !String(val).trim()) continue;
      
      const telNorm = String(val).replace(/\D/g, ""); // Apenas dígitos
      if (telNorm.length < 8) continue; // Mínimo 8 dígitos
      
      // Deduplicar
      if (telefonesVistos.has(telNorm)) continue;
      telefonesVistos.add(telNorm);
      
      telefonesComPrincipal.push({ telefone: telNorm, principal });
    }

    let telefonesInseridos = 0;

    // Inserir telefones para cada pessoa (ON CONFLICT ignora duplicatas)
    for (const pessoa of pessoas) {
      for (const { telefone, principal } of telefonesComPrincipal) {
        try {
          await db.insert(clientesTelefones)
            .values({
              pessoaId: pessoa.id,
              telefone,
              tipo: telefone.length === 11 ? "celular" : "fixo",
              principal,
            })
            .onConflictDoNothing();
          telefonesInseridos++;
        } catch (err) {
          // Ignorar erros de duplicata
        }
      }
    }

    return { pessoasAtualizadas, telefonesInseridos };
  }

  // Clientes Telefones
  async getTelefonesByPessoaId(pessoaId: number): Promise<ClienteTelefone[]> {
    return await db.select()
      .from(clientesTelefones)
      .where(eq(clientesTelefones.pessoaId, pessoaId))
      .orderBy(sql`${clientesTelefones.principal} DESC, ${clientesTelefones.createdAt} DESC`);
  }

  // Clientes Contratos
  async createClienteContrato(data: InsertClienteContrato): Promise<ClienteContrato> {
    const [newContrato] = await db.insert(clientesContratos).values(data).returning();
    return newContrato;
  }

  async updateClienteContrato(id: number, data: Partial<InsertClienteContrato>): Promise<ClienteContrato | undefined> {
    const [updated] = await db.update(clientesContratos)
      .set(data)
      .where(eq(clientesContratos.id, id))
      .returning();
    return updated;
  }

  async getContratosByPessoaId(pessoaId: number): Promise<ClienteContrato[]> {
    return await db.select()
      .from(clientesContratos)
      .where(eq(clientesContratos.pessoaId, pessoaId))
      .orderBy(sql`${clientesContratos.competencia} DESC`);
  }

  async getContratosByVinculoId(vinculoId: number): Promise<ClienteContrato[]> {
    return await db.select()
      .from(clientesContratos)
      .where(eq(clientesContratos.vinculoId, vinculoId))
      .orderBy(sql`${clientesContratos.competencia} DESC`);
  }

  // Bases Importadas
  async getAllBasesImportadas(): Promise<BaseImportada[]> {
    return await db.select().from(basesImportadas).orderBy(sql`${basesImportadas.criadoEm} DESC`);
  }

  async getBaseImportada(id: number): Promise<BaseImportada | undefined> {
    const [base] = await db.select().from(basesImportadas).where(eq(basesImportadas.id, id));
    return base;
  }

  async getBaseByStatus(status: string): Promise<BaseImportada | undefined> {
    const [base] = await db.select().from(basesImportadas).where(eq(basesImportadas.status, status));
    return base;
  }

  async createBaseImportada(data: InsertBaseImportada): Promise<BaseImportada> {
    const [newBase] = await db.insert(basesImportadas).values(data).returning();
    return newBase;
  }

  async updateBaseImportada(id: number, data: Partial<InsertBaseImportada>): Promise<BaseImportada | undefined> {
    const [updated] = await db.update(basesImportadas)
      .set({ ...data, atualizadoEm: new Date() })
      .where(eq(basesImportadas.id, id))
      .returning();
    return updated;
  }

  async deleteBaseImportada(id: number, baseTag: string, tenantId?: number, importRunId?: number | null): Promise<{ deletedFolhas: number; deletedContratos: number; deletedVinculos: number; deletedContacts: number; deletedPessoas: number }> {
    // Primeiro, buscar a base para obter o tenantId real (não confiar em parâmetro)
    const [baseRecord] = await db.select().from(basesImportadas).where(eq(basesImportadas.id, id));
    
    // Usar tenantId da base como fonte autoritativa, fallback para parâmetro
    const effectiveTenantId = baseRecord?.tenantId || tenantId;
    
    if (!effectiveTenantId) {
      console.error(`[Storage] ERROR: Cannot delete base ${id} - no tenantId found (base or param)`);
      throw new Error("Tenant ID obrigatório para exclusão de base");
    }
    
    console.log(`[Storage] Starting TRANSACTIONAL cascading delete for base ${id} (tenant: ${effectiveTenantId}, tag: ${baseTag}, importRun: ${importRunId})`);
    
    // Usar uma única query SQL com CTEs para garantir atomicidade total
    // Todas as operações são feitas em uma única transação implícita do PostgreSQL
    // IMPORTANTE: Filtra por tenant_id para garantir isolamento multi-tenant
    const result = await db.execute(sql`
      WITH 
      -- Identificar pessoas do tenant (para filtrar deletes)
      tenant_pessoas AS (
        SELECT id FROM clientes_pessoa 
        WHERE tenant_id = ${effectiveTenantId}
      ),
      -- 1. Deletar folhas da base_tag que pertencem a pessoas do tenant
      deleted_folhas AS (
        DELETE FROM clientes_folha_mes 
        WHERE base_tag = ${baseTag}
          AND pessoa_id IN (SELECT id FROM tenant_pessoas)
        RETURNING id
      ),
      -- 2. Deletar contratos da base_tag que pertencem a pessoas do tenant
      deleted_contratos AS (
        DELETE FROM clientes_contratos 
        WHERE base_tag = ${baseTag}
          AND pessoa_id IN (SELECT id FROM tenant_pessoas)
        RETURNING id
      ),
      -- 3. Deletar contacts da base_tag que pertencem a pessoas do tenant
      -- NOTA: client_contacts usa client_id (não pessoa_id) como FK para clientes_pessoa
      deleted_contacts AS (
        DELETE FROM client_contacts 
        WHERE base_tag = ${baseTag}
          AND client_id IN (SELECT id FROM tenant_pessoas)
        RETURNING id
      ),
      -- 4. Deletar vinculos da base_tag que pertencem ao tenant
      deleted_vinculos AS (
        DELETE FROM clientes_vinculo 
        WHERE base_tag = ${baseTag}
          AND tenant_id = ${effectiveTenantId}
        RETURNING id
      ),
      -- 5. Deletar pessoas órfãs do tenant (sem folhas, contratos, vinculos OU contacts restantes)
      -- NOTA: client_contacts usa client_id como FK
      deleted_pessoas AS (
        DELETE FROM clientes_pessoa 
        WHERE tenant_id = ${effectiveTenantId}
          AND NOT EXISTS (SELECT 1 FROM clientes_folha_mes WHERE pessoa_id = clientes_pessoa.id)
          AND NOT EXISTS (SELECT 1 FROM clientes_contratos WHERE pessoa_id = clientes_pessoa.id)
          AND NOT EXISTS (SELECT 1 FROM clientes_vinculo WHERE pessoa_id = clientes_pessoa.id)
          AND NOT EXISTS (SELECT 1 FROM client_contacts WHERE client_id = clientes_pessoa.id)
        RETURNING id
      ),
      -- 6. Deletar a base importada (apenas se pertence ao tenant correto)
      deleted_base AS (
        DELETE FROM bases_importadas 
        WHERE id = ${id} AND (tenant_id = ${effectiveTenantId} OR tenant_id IS NULL)
        RETURNING id
      ),
      -- 7. Deletar import_run fisicamente (já que todos dependentes foram removidos)
      -- Isso garante consistência: não existem registros apontando para import_run deletado
      deleted_import_run AS (
        DELETE FROM import_runs 
        WHERE id = ${importRunId || 0} AND ${importRunId || 0} > 0
          AND base_id = ${id}
        RETURNING id
      )
      -- Retornar os counts de cada operação
      SELECT 
        (SELECT COUNT(*) FROM deleted_folhas) as folhas_count,
        (SELECT COUNT(*) FROM deleted_contratos) as contratos_count,
        (SELECT COUNT(*) FROM deleted_contacts) as contacts_count,
        (SELECT COUNT(*) FROM deleted_vinculos) as vinculos_count,
        (SELECT COUNT(*) FROM deleted_pessoas) as pessoas_count,
        (SELECT COUNT(*) FROM deleted_base) as base_count,
        (SELECT COUNT(*) FROM deleted_import_run) as import_run_deleted
    `);
    
    // Extrair counts do resultado
    const row = result.rows?.[0] as any || {};
    const deletedFolhas = Number(row.folhas_count) || 0;
    const deletedContratos = Number(row.contratos_count) || 0;
    const deletedContacts = Number(row.contacts_count) || 0;
    const deletedVinculos = Number(row.vinculos_count) || 0;
    const deletedPessoas = Number(row.pessoas_count) || 0;
    const importRunDeleted = Number(row.import_run_deleted) || 0;
    
    console.log(`[Storage] TRANSACTIONAL DELETE completed for base ${id} (tenant ${effectiveTenantId}):`);
    console.log(`  - Folhas: ${deletedFolhas}`);
    console.log(`  - Contratos: ${deletedContratos}`);
    console.log(`  - Contacts: ${deletedContacts}`);
    console.log(`  - Vinculos: ${deletedVinculos}`);
    console.log(`  - Pessoas órfãs: ${deletedPessoas}`);
    console.log(`  - Import run deleted: ${importRunDeleted}`);
    
    return { deletedFolhas, deletedContratos, deletedVinculos, deletedContacts, deletedPessoas };
  }

  // Pedidos Lista
  async getAllPedidosLista(): Promise<PedidoLista[]> {
    return await db.select().from(pedidosLista).orderBy(sql`${pedidosLista.criadoEm} DESC`);
  }

  async getPedidosListaByUser(userId: number): Promise<PedidoLista[]> {
    return await db.select().from(pedidosLista)
      .where(eq(pedidosLista.coordenadorId, userId))
      .orderBy(sql`${pedidosLista.criadoEm} DESC`);
  }

  async getPedidoLista(id: number): Promise<PedidoLista | undefined> {
    const [pedido] = await db.select().from(pedidosLista).where(eq(pedidosLista.id, id));
    return pedido;
  }

  async createPedidoLista(data: InsertPedidoLista): Promise<PedidoLista> {
    const [newPedido] = await db.insert(pedidosLista).values(data).returning();
    return newPedido;
  }

  async updatePedidoLista(id: number, data: Partial<InsertPedidoLista>): Promise<PedidoLista | undefined> {
    const [updated] = await db.update(pedidosLista)
      .set({ ...data, atualizadoEm: new Date() })
      .where(eq(pedidosLista.id, id))
      .returning();
    return updated;
  }

  async getAllPedidosListaWithUser(): Promise<Array<PedidoLista & { coordenadorNome: string; coordenadorEmail: string }>> {
    const result = await db
      .select({
        id: pedidosLista.id,
        coordenadorId: pedidosLista.coordenadorId,
        filtrosUsados: pedidosLista.filtrosUsados,
        quantidadeRegistros: pedidosLista.quantidadeRegistros,
        tipo: pedidosLista.tipo,
        status: pedidosLista.status,
        nomePacote: pedidosLista.nomePacote,
        custoEstimado: pedidosLista.custoEstimado,
        custoFinal: pedidosLista.custoFinal,
        statusFinanceiro: pedidosLista.statusFinanceiro,
        arquivoPath: pedidosLista.arquivoPath,
        arquivoGeradoEm: pedidosLista.arquivoGeradoEm,
        criadoEm: pedidosLista.criadoEm,
        atualizadoEm: pedidosLista.atualizadoEm,
        coordenadorNome: users.name,
        coordenadorEmail: users.email,
      })
      .from(pedidosLista)
      .leftJoin(users, eq(pedidosLista.coordenadorId, users.id))
      .orderBy(sql`${pedidosLista.criadoEm} DESC`);
    
    return result.map(r => ({
      ...r,
      coordenadorNome: r.coordenadorNome || 'Desconhecido',
      coordenadorEmail: r.coordenadorEmail || '',
    }));
  }

  async updatePedidoListaStatus(id: number, status: string): Promise<PedidoLista | undefined> {
    const [updated] = await db.update(pedidosLista)
      .set({ status, atualizadoEm: new Date() })
      .where(eq(pedidosLista.id, id))
      .returning();
    return updated;
  }

  // ===== PRICING SETTINGS =====

  async getPricingSettings(): Promise<PricingSettings | undefined> {
    const [settings] = await db.select().from(pricingSettings).limit(1);
    return settings;
  }

  async updatePricingSettings(data: Partial<InsertPricingSettings>): Promise<PricingSettings> {
    // Check if settings exist
    const existing = await this.getPricingSettings();
    
    if (existing) {
      // Update existing
      const [updated] = await db.update(pricingSettings)
        .set({ ...data, atualizadoEm: new Date() })
        .where(eq(pricingSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new with defaults
      const [created] = await db.insert(pricingSettings)
        .values({
          precoAncoraMin: data.precoAncoraMin || "1.0000",
          qtdAncoraMin: data.qtdAncoraMin || 1,
          precoAncoraMax: data.precoAncoraMax || "2000.00",
          qtdAncoraMax: data.qtdAncoraMax || 1000000,
        })
        .returning();
      return created;
    }
  }

  // ===== ACADEMIA CONSIGONE =====

  async getProgressoLicoesByUser(userId: number): Promise<ProgressoLicao[]> {
    return await db.select().from(progressoLicoes).where(eq(progressoLicoes.userId, userId));
  }

  async getProgressoLicao(userId: number, licaoId: string): Promise<ProgressoLicao | undefined> {
    const [progresso] = await db.select().from(progressoLicoes)
      .where(and(eq(progressoLicoes.userId, userId), eq(progressoLicoes.licaoId, licaoId)));
    return progresso;
  }

  async upsertProgressoLicao(data: InsertProgressoLicao): Promise<ProgressoLicao> {
    const existing = await this.getProgressoLicao(data.userId, data.licaoId);
    if (existing) {
      const [updated] = await db.update(progressoLicoes)
        .set({ ...data, concluidaEm: data.concluida ? new Date() : null })
        .where(eq(progressoLicoes.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(progressoLicoes)
        .values({ ...data, concluidaEm: data.concluida ? new Date() : null })
        .returning();
      return created;
    }
  }

  async countLicoesConcluidas(userId: number, nivelId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(progressoLicoes)
      .where(and(
        eq(progressoLicoes.userId, userId),
        eq(progressoLicoes.nivelId, nivelId),
        eq(progressoLicoes.concluida, true)
      ));
    return Number(result[0]?.count || 0);
  }

  async getVendedorAcademia(userId: number): Promise<VendedorAcademia | undefined> {
    const [vendedor] = await db.select().from(vendedoresAcademia)
      .where(eq(vendedoresAcademia.userId, userId));
    return vendedor;
  }

  async upsertVendedorAcademia(data: InsertVendedorAcademia): Promise<VendedorAcademia> {
    const existing = await this.getVendedorAcademia(data.userId);
    if (existing) {
      const [updated] = await db.update(vendedoresAcademia)
        .set({ ...data, atualizadoEm: new Date() })
        .where(eq(vendedoresAcademia.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(vendedoresAcademia)
        .values(data)
        .returning();
      return created;
    }
  }

  async getAllVendedoresAcademia(): Promise<VendedorAcademia[]> {
    return await db.select().from(vendedoresAcademia);
  }

  async createQuizTentativa(data: InsertQuizTentativa): Promise<QuizTentativa> {
    const [created] = await db.insert(quizTentativas).values(data).returning();
    return created;
  }

  async getQuizTentativasByUser(userId: number): Promise<QuizTentativa[]> {
    return await db.select().from(quizTentativas)
      .where(eq(quizTentativas.userId, userId))
      .orderBy(sql`${quizTentativas.criadoEm} DESC`);
  }

  async createRoleplaySessao(data: InsertRoleplaySessao): Promise<RoleplaySessao> {
    const [created] = await db.insert(roleplaySessoes).values(data).returning();
    return created;
  }

  async getRoleplaySessao(id: number): Promise<RoleplaySessao | undefined> {
    const [sessao] = await db.select().from(roleplaySessoes).where(eq(roleplaySessoes.id, id));
    return sessao;
  }

  async updateRoleplaySessao(id: number, data: Partial<InsertRoleplaySessao>): Promise<RoleplaySessao | undefined> {
    const [updated] = await db.update(roleplaySessoes)
      .set(data)
      .where(eq(roleplaySessoes.id, id))
      .returning();
    return updated;
  }

  async getRoleplaySessoesByUser(userId: number): Promise<RoleplaySessao[]> {
    return await db.select().from(roleplaySessoes)
      .where(eq(roleplaySessoes.userId, userId))
      .orderBy(sql`${roleplaySessoes.criadoEm} DESC`);
  }

  async createRoleplayAvaliacao(data: InsertRoleplayAvaliacao): Promise<RoleplayAvaliacao> {
    const [created] = await db.insert(roleplayAvaliacoes).values(data).returning();
    return created;
  }

  async getRoleplayAvaliacoesBySessao(sessaoId: number): Promise<RoleplayAvaliacao[]> {
    return await db.select().from(roleplayAvaliacoes)
      .where(eq(roleplayAvaliacoes.sessaoId, sessaoId))
      .orderBy(sql`${roleplayAvaliacoes.criadoEm} DESC`);
  }

  async createAbordagemGerada(data: InsertAbordagemGerada): Promise<AbordagemGerada> {
    const [created] = await db.insert(abordagensGeradas).values(data).returning();
    return created;
  }

  async getAbordagensByUser(userId: number): Promise<AbordagemGerada[]> {
    return await db.select().from(abordagensGeradas)
      .where(eq(abordagensGeradas.userId, userId))
      .orderBy(sql`${abordagensGeradas.criadoEm} DESC`);
  }
  
  // Convenios (lista padronizada por tenant)
  async getConvenios(tenantId: number): Promise<Convenio[]> {
    return await db.select().from(convenios)
      .where(eq(convenios.tenantId, tenantId))
      .orderBy(sql`${convenios.label} ASC`);
  }
  
  async upsertConvenio(tenantId: number, code: string, label: string): Promise<Convenio> {
    const [result] = await db.insert(convenios)
      .values({ tenantId, code, label })
      .onConflictDoUpdate({
        target: [convenios.tenantId, convenios.code],
        set: { label },
      })
      .returning();
    return result;
  }
  
  // ===== CRM DE VENDAS =====
  
  async getAllSalesCampaigns(tenantId?: number | null): Promise<SalesCampaign[]> {
    // If tenantId is null or undefined, return all campaigns (for master users)
    // If tenantId is a number, filter by that tenant
    if (tenantId !== null && tenantId !== undefined) {
      return await db.select().from(salesCampaigns)
        .where(eq(salesCampaigns.tenantId, tenantId))
        .orderBy(sql`${salesCampaigns.createdAt} DESC`);
    }
    return await db.select().from(salesCampaigns)
      .orderBy(sql`${salesCampaigns.createdAt} DESC`);
  }
  
  async getSalesCampaign(id: number, tenantId?: number | null): Promise<SalesCampaign | undefined> {
    const conditions = [eq(salesCampaigns.id, id)];
    if (tenantId !== null && tenantId !== undefined) {
      conditions.push(eq(salesCampaigns.tenantId, tenantId));
    }
    const [campaign] = await db.select().from(salesCampaigns)
      .where(and(...conditions));
    return campaign;
  }
  
  async createSalesCampaign(data: InsertSalesCampaign): Promise<SalesCampaign> {
    const [created] = await db.insert(salesCampaigns).values(data).returning();
    return created;
  }
  
  async updateSalesCampaign(id: number, data: Partial<InsertSalesCampaign>, tenantId?: number | null): Promise<SalesCampaign | undefined> {
    const conditions = [eq(salesCampaigns.id, id)];
    if (tenantId !== null && tenantId !== undefined) {
      conditions.push(eq(salesCampaigns.tenantId, tenantId));
    }
    const [updated] = await db.update(salesCampaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return updated;
  }
  
  async deleteSalesCampaign(id: number, tenantId?: number | null): Promise<void> {
    const conditions = [eq(salesCampaigns.id, id)];
    if (tenantId !== null && tenantId !== undefined) {
      conditions.push(eq(salesCampaigns.tenantId, tenantId));
    }
    await db.delete(salesCampaigns).where(and(...conditions));
  }
  
  async getSalesLeadsByCampaign(campaignId: number): Promise<SalesLead[]> {
    return await db.select().from(salesLeads)
      .where(eq(salesLeads.campaignId, campaignId))
      .orderBy(sql`${salesLeads.createdAt} DESC`);
  }
  
  async createSalesLead(data: InsertSalesLead): Promise<SalesLead> {
    const [created] = await db.insert(salesLeads).values(data).returning();
    return created;
  }
  
  async createSalesLeadsBulk(leads: InsertSalesLead[]): Promise<number> {
    if (leads.length === 0) return 0;
    const BATCH_SIZE = 500;
    let inserted = 0;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      await db.insert(salesLeads).values(batch);
      inserted += batch.length;
    }
    return inserted;
  }
  
  async getSalesLead(id: number): Promise<SalesLead | undefined> {
    const [lead] = await db.select().from(salesLeads).where(eq(salesLeads.id, id));
    return lead;
  }
  
  async getUnassignedLeads(campaignId: number, limit: number): Promise<SalesLead[]> {
    // Leads that don't have an active assignment
    const assignedLeadIds = db.select({ leadId: salesLeadAssignments.leadId })
      .from(salesLeadAssignments)
      .where(eq(salesLeadAssignments.campaignId, campaignId));
    
    return await db.select().from(salesLeads)
      .where(and(
        eq(salesLeads.campaignId, campaignId),
        sql`${salesLeads.id} NOT IN (SELECT lead_id FROM sales_lead_assignments WHERE campaign_id = ${campaignId})`
      ))
      .limit(limit);
  }
  
  async createSalesLeadAssignment(data: InsertSalesLeadAssignment): Promise<SalesLeadAssignment> {
    const [created] = await db.insert(salesLeadAssignments).values(data).returning();
    return created;
  }
  
  async getNextAssignment(userId: number, campaignId?: number): Promise<SalesLeadAssignment | undefined> {
    let query = db.select().from(salesLeadAssignments)
      .where(and(
        eq(salesLeadAssignments.userId, userId),
        eq(salesLeadAssignments.status, "novo")
      ))
      .orderBy(sql`${salesLeadAssignments.ordemFila} ASC`)
      .limit(1);
    
    if (campaignId) {
      query = db.select().from(salesLeadAssignments)
        .where(and(
          eq(salesLeadAssignments.userId, userId),
          eq(salesLeadAssignments.campaignId, campaignId),
          eq(salesLeadAssignments.status, "novo")
        ))
        .orderBy(sql`${salesLeadAssignments.ordemFila} ASC`)
        .limit(1);
    }
    
    const [assignment] = await query;
    return assignment;
  }
  
  async updateSalesLeadAssignment(id: number, data: Partial<InsertSalesLeadAssignment>): Promise<SalesLeadAssignment | undefined> {
    const [updated] = await db.update(salesLeadAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(salesLeadAssignments.id, id))
      .returning();
    return updated;
  }
  
  async getAssignmentsByUser(userId: number, campaignId?: number): Promise<SalesLeadAssignment[]> {
    if (campaignId) {
      return await db.select().from(salesLeadAssignments)
        .where(and(
          eq(salesLeadAssignments.userId, userId),
          eq(salesLeadAssignments.campaignId, campaignId)
        ))
        .orderBy(sql`${salesLeadAssignments.ordemFila} ASC`);
    }
    return await db.select().from(salesLeadAssignments)
      .where(eq(salesLeadAssignments.userId, userId))
      .orderBy(sql`${salesLeadAssignments.ordemFila} ASC`);
  }
  
  async getAssignmentWithLead(assignmentId: number): Promise<{ assignment: SalesLeadAssignment; lead: SalesLead } | undefined> {
    const [assignment] = await db.select().from(salesLeadAssignments)
      .where(eq(salesLeadAssignments.id, assignmentId));
    
    if (!assignment) return undefined;
    
    const [lead] = await db.select().from(salesLeads)
      .where(eq(salesLeads.id, assignment.leadId));
    
    if (!lead) return undefined;
    
    return { assignment, lead };
  }
  
  async countAssignmentsByStatus(userId: number): Promise<{ status: string; count: number }[]> {
    const result = await db.select({
      status: salesLeadAssignments.status,
      count: sql<number>`count(*)::int`
    })
      .from(salesLeadAssignments)
      .where(eq(salesLeadAssignments.userId, userId))
      .groupBy(salesLeadAssignments.status);
    return result;
  }
  
  async getMaxOrdemFila(userId: number, campaignId: number): Promise<number> {
    const [result] = await db.select({
      maxOrdem: sql<number>`COALESCE(MAX(${salesLeadAssignments.ordemFila}), 0)::int`
    })
      .from(salesLeadAssignments)
      .where(and(
        eq(salesLeadAssignments.userId, userId),
        eq(salesLeadAssignments.campaignId, campaignId)
      ));
    return result?.maxOrdem || 0;
  }
  
  async createSalesLeadEvent(data: InsertSalesLeadEvent): Promise<SalesLeadEvent> {
    const [created] = await db.insert(salesLeadEvents).values(data).returning();
    return created;
  }
  
  async getEventsByAssignment(assignmentId: number): Promise<SalesLeadEvent[]> {
    return await db.select().from(salesLeadEvents)
      .where(eq(salesLeadEvents.assignmentId, assignmentId))
      .orderBy(sql`${salesLeadEvents.createdAt} DESC`);
  }
  
  // ===== USER PERMISSIONS =====
  
  async getUserPermissions(userId: number): Promise<UserPermission[]> {
    return await db.select().from(userPermissions)
      .where(eq(userPermissions.userId, userId));
  }
  
  async setUserPermissions(userId: number, permissions: { module: string; canView: boolean; canEdit: boolean; canDelegate?: boolean }[]): Promise<void> {
    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
    if (permissions.length > 0) {
      await db.insert(userPermissions).values(
        permissions.map(p => ({ userId, module: p.module, canView: p.canView, canEdit: p.canEdit, canDelegate: p.canDelegate ?? false }))
      );
    }
  }
  
  async hasModuleAccess(userId: number, module: string): Promise<boolean> {
    const [perm] = await db.select().from(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.module, module)));
    return perm?.canView === true;
  }

  async hasModuleEditAccess(userId: number, module: string): Promise<boolean> {
    const [perm] = await db.select().from(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.module, module)));
    return perm?.canEdit === true;
  }
  
  // ===== LEAD SCHEDULES =====
  
  async createSchedule(data: InsertLeadSchedule): Promise<LeadSchedule> {
    const [created] = await db.insert(leadSchedules).values(data).returning();
    return created;
  }
  
  async getSchedulesByUser(userId: number, status?: string): Promise<LeadSchedule[]> {
    if (status) {
      return await db.select().from(leadSchedules)
        .where(and(eq(leadSchedules.userId, userId), eq(leadSchedules.status, status)))
        .orderBy(sql`${leadSchedules.dataHora} ASC`);
    }
    return await db.select().from(leadSchedules)
      .where(eq(leadSchedules.userId, userId))
      .orderBy(sql`${leadSchedules.dataHora} ASC`);
  }
  
  async updateSchedule(id: number, data: Partial<InsertLeadSchedule>): Promise<LeadSchedule | undefined> {
    const [updated] = await db.update(leadSchedules).set(data).where(eq(leadSchedules.id, id)).returning();
    return updated;
  }
  
  async getScheduleWithLead(scheduleId: number): Promise<{ schedule: LeadSchedule; assignment: SalesLeadAssignment; lead: SalesLead; campaign: SalesCampaign } | undefined> {
    const [schedule] = await db.select().from(leadSchedules).where(eq(leadSchedules.id, scheduleId));
    if (!schedule) return undefined;
    
    const [assignment] = await db.select().from(salesLeadAssignments).where(eq(salesLeadAssignments.id, schedule.assignmentId));
    if (!assignment) return undefined;
    
    const [lead] = await db.select().from(salesLeads).where(eq(salesLeads.id, assignment.leadId));
    if (!lead) return undefined;
    
    const [campaign] = await db.select().from(salesCampaigns).where(eq(salesCampaigns.id, assignment.campaignId));
    if (!campaign) return undefined;
    
    return { schedule, assignment, lead, campaign };
  }
  
  // ===== DISTRIBUTION STATS =====
  
  async getDistributionStats(campaignId: number): Promise<{ userId: number; userName: string; total: number; novo: number; emAtendimento: number; concluido: number }[]> {
    const assignments = await db.select({
      userId: salesLeadAssignments.userId,
      status: salesLeadAssignments.status,
    }).from(salesLeadAssignments)
      .where(eq(salesLeadAssignments.campaignId, campaignId));
    
    const userIds = [...new Set(assignments.map(a => a.userId))];
    if (userIds.length === 0) return [];
    
    const userList = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds));
    
    const userMap = new Map(userList.map(u => [u.id, u.name]));
    
    const stats: Map<number, { userId: number; userName: string; total: number; novo: number; emAtendimento: number; concluido: number }> = new Map();
    
    for (const a of assignments) {
      if (!stats.has(a.userId)) {
        stats.set(a.userId, { userId: a.userId, userName: userMap.get(a.userId) || "Desconhecido", total: 0, novo: 0, emAtendimento: 0, concluido: 0 });
      }
      const s = stats.get(a.userId)!;
      s.total++;
      if (a.status === "novo") s.novo++;
      else if (a.status === "em_atendimento") s.emAtendimento++;
      else if (["vendido", "concluido", "descartado", "sem_interesse"].includes(a.status)) s.concluido++;
    }
    
    return Array.from(stats.values());
  }
  
  async returnLeadsToPool(assignmentIds: number[]): Promise<number> {
    if (assignmentIds.length === 0) return 0;
    await db.delete(salesLeadAssignments).where(inArray(salesLeadAssignments.id, assignmentIds));
    return assignmentIds.length;
  }
  
  async transferLeads(fromUserId: number, toUserId: number, campaignId: number, quantidade: number): Promise<number> {
    const leadsToTransfer = await db.select().from(salesLeadAssignments)
      .where(and(
        eq(salesLeadAssignments.userId, fromUserId),
        eq(salesLeadAssignments.campaignId, campaignId),
        inArray(salesLeadAssignments.status, ["novo", "em_atendimento"])
      ))
      .limit(quantidade);
    
    if (leadsToTransfer.length === 0) return 0;
    
    const ids = leadsToTransfer.map(l => l.id);
    let ordemFila = await this.getMaxOrdemFila(toUserId, campaignId);
    
    for (const id of ids) {
      ordemFila++;
      await db.update(salesLeadAssignments).set({ userId: toUserId, ordemFila }).where(eq(salesLeadAssignments.id, id));
    }
    
    return ids.length;
  }
  
  // ===== LEAD CONTACTS =====
  
  async getContactsByLead(leadId: number): Promise<LeadContact[]> {
    return await db.select().from(leadContacts).where(eq(leadContacts.leadId, leadId));
  }
  
  async createContact(data: InsertLeadContact): Promise<LeadContact> {
    // Se for principal, remove principal dos outros
    if (data.isPrimary) {
      await db.update(leadContacts)
        .set({ isPrimary: false })
        .where(and(eq(leadContacts.leadId, data.leadId), eq(leadContacts.isPrimary, true)));
    }
    const [created] = await db.insert(leadContacts).values(data).returning();
    return created;
  }
  
  async updateContact(id: number, data: Partial<InsertLeadContact>): Promise<LeadContact | undefined> {
    const [updated] = await db.update(leadContacts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leadContacts.id, id))
      .returning();
    return updated;
  }
  
  async deleteContact(id: number): Promise<void> {
    await db.delete(leadContacts).where(eq(leadContacts.id, id));
  }
  
  async setContactAsPrimary(contactId: number, leadId: number): Promise<void> {
    // Remove primary de todos do lead
    await db.update(leadContacts)
      .set({ isPrimary: false })
      .where(eq(leadContacts.leadId, leadId));
    // Define o novo como primary
    await db.update(leadContacts)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(leadContacts.id, contactId));
  }
  
  async getDistinctContactLabels(): Promise<string[]> {
    const result = await db.selectDistinct({ label: leadContacts.label }).from(leadContacts);
    return result.map(r => r.label);
  }
  
  async getContactsByLabel(label: string): Promise<{ leadId: number; leadNome: string; cpf: string | null; contactId: number; value: string; label: string }[]> {
    const result = await db.select({
      leadId: salesLeads.id,
      leadNome: salesLeads.nome,
      cpf: salesLeads.cpf,
      contactId: leadContacts.id,
      value: leadContacts.value,
      label: leadContacts.label,
    })
      .from(leadContacts)
      .innerJoin(salesLeads, eq(leadContacts.leadId, salesLeads.id))
      .where(and(eq(leadContacts.type, "phone"), eq(leadContacts.label, label)));
    return result;
  }
  
  // ===== LEAD INTERACTIONS =====
  
  async createLeadInteraction(data: InsertLeadInteraction): Promise<LeadInteraction> {
    const [created] = await db.insert(leadInteractions).values(data).returning();
    return created;
  }
  
  async getInteractionsByLead(leadId: number): Promise<LeadInteraction[]> {
    return await db.select().from(leadInteractions)
      .where(eq(leadInteractions.leadId, leadId))
      .orderBy(sql`${leadInteractions.createdAt} DESC`);
  }
  
  // ===== QUEUE MANAGEMENT =====
  
  async getNextLeadInQueue(userId: number, campaignId?: number): Promise<{ lead: SalesLead; assignment: SalesLeadAssignment; campaign: SalesCampaign } | undefined> {
    const conditions = [
      eq(salesLeadAssignments.userId, userId),
      inArray(salesLeadAssignments.status, ["novo", "em_atendimento"])
    ];
    
    if (campaignId) {
      conditions.push(eq(salesLeadAssignments.campaignId, campaignId));
    }
    
    const [assignment] = await db.select().from(salesLeadAssignments)
      .where(and(...conditions))
      .orderBy(sql`${salesLeadAssignments.ordemFila} ASC`)
      .limit(1);
    
    if (!assignment) return undefined;
    
    const [lead] = await db.select().from(salesLeads).where(eq(salesLeads.id, assignment.leadId));
    if (!lead) return undefined;
    
    const [campaign] = await db.select().from(salesCampaigns).where(eq(salesCampaigns.id, assignment.campaignId));
    if (!campaign) return undefined;
    
    return { lead, assignment, campaign };
  }
  
  async updateLeadMarker(leadId: number, marker: string, motivo?: string, retornoEm?: Date, tipoContato?: string): Promise<SalesLead | undefined> {
    const updateData: any = {
      leadMarker: marker,
      ultimoContatoEm: new Date(),
      updatedAt: new Date(),
    };
    
    if (motivo !== undefined) updateData.motivo = motivo;
    if (retornoEm !== undefined) updateData.retornoEm = retornoEm;
    if (tipoContato !== undefined) updateData.ultimoTipoContato = tipoContato;
    
    const [updated] = await db.update(salesLeads)
      .set(updateData)
      .where(eq(salesLeads.id, leadId))
      .returning();
    return updated;
  }
  
  // ===== CRM SYNC METHODS =====
  
  async getClientePessoaByCpf(cpf: string): Promise<ClientePessoa | undefined> {
    const [cliente] = await db.select().from(clientesPessoa).where(eq(clientesPessoa.cpf, cpf));
    return cliente;
  }
  
  async upsertClientByCpf(data: InsertClientePessoa): Promise<ClientePessoa> {
    if (!data.cpf) {
      const [created] = await db.insert(clientesPessoa).values(data).returning();
      return created;
    }
    
    const existing = await this.getClientePessoaByCpf(data.cpf);
    if (existing) {
      const [updated] = await db.update(clientesPessoa)
        .set({
          ...data,
          atualizadoEm: new Date(),
        })
        .where(eq(clientesPessoa.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(clientesPessoa).values(data).returning();
    return created;
  }
  
  async syncClientContracts(pessoaId: number, contratos: InsertClienteContrato[]): Promise<void> {
    await db.delete(clientesContratos).where(eq(clientesContratos.pessoaId, pessoaId));
    
    if (contratos.length > 0) {
      await db.insert(clientesContratos).values(contratos);
    }
  }
  
  async createClientSnapshot(data: { clientId: number; referenceDate: Date; fonte: string; situacaoFuncional?: string; margemEmprestimo?: string; margemCartao?: string; margem5?: string; salarioBruto?: string; salarioLiquido?: string; dadosExtras?: any }): Promise<ClientSnapshot> {
    const [created] = await db.insert(clientSnapshots).values({
      clientId: data.clientId,
      referenceDate: data.referenceDate,
      fonte: data.fonte,
      situacaoFuncional: data.situacaoFuncional,
      margemEmprestimo: data.margemEmprestimo,
      margemCartao: data.margemCartao,
      margem5: data.margem5,
      salarioBruto: data.salarioBruto,
      salarioLiquido: data.salarioLiquido,
      dadosExtras: data.dadosExtras,
    }).returning();
    return created;
  }
  
  async createCampaignFromFilter(filtros: FiltrosPedidoLista, nome: string, userId: number): Promise<{ campaign: SalesCampaign; leadsCreated: number }> {
    const { clientes } = await this.searchClientesPessoa(filtros);
    
    const [campaign] = await db.insert(salesCampaigns).values({
      nome,
      descricao: `Campanha gerada por filtro com ${clientes.length} clientes`,
      status: "ativa",
      createdBy: userId,
      filtrosJson: filtros as any,
      totalLeads: clientes.length,
      leadsDisponiveis: clientes.length,
    }).returning();
    
    let leadsCreated = 0;
    for (const cliente of clientes) {
      const telefones = Array.isArray(cliente.telefonesBase) ? cliente.telefonesBase : [];
      await db.insert(salesLeads).values({
        campaignId: campaign.id,
        nome: cliente.nome || "Sem nome",
        cpf: cliente.cpf,
        telefone1: telefones[0] || null,
        telefone2: telefones[1] || null,
        telefone3: telefones[2] || null,
        uf: cliente.uf,
        baseClienteId: cliente.id,
      });
      leadsCreated++;
    }
    
    return { campaign, leadsCreated };
  }
  
  // ===== TEAMS & AI PROMPTS =====
  
  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(teams.name);
  }
  
  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }
  
  async createTeam(data: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(data).returning();
    return created;
  }
  
  async updateTeam(id: number, data: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updated] = await db.update(teams).set(data).where(eq(teams.id, id)).returning();
    return updated;
  }
  
  async deleteTeam(id: number): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }
  
  async getTeamMembersByTeam(teamId: number): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  }
  
  async getTeamMemberByUser(userId: number): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
    return member;
  }
  
  async createTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    const [created] = await db.insert(teamMembers).values(data).returning();
    return created;
  }
  
  async updateTeamMember(id: number, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const [updated] = await db.update(teamMembers).set(data).where(eq(teamMembers.id, id)).returning();
    return updated;
  }
  
  async deleteTeamMemberByUser(userId: number): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.userId, userId));
  }
  
  async getActiveRoleplayPrompt(userId: number): Promise<{ prompt: AiPrompt; scope: "global" | "team" }> {
    const userMembership = await this.getTeamMemberByUser(userId);
    
    if (userMembership) {
      const [teamPrompt] = await db.select().from(aiPrompts)
        .where(and(
          eq(aiPrompts.type, "roleplay"),
          eq(aiPrompts.scope, "team"),
          eq(aiPrompts.teamId, userMembership.teamId),
          eq(aiPrompts.isActive, true)
        ));
      
      if (teamPrompt) {
        return { prompt: teamPrompt, scope: "team" };
      }
    }
    
    const [globalPrompt] = await db.select().from(aiPrompts)
      .where(and(
        eq(aiPrompts.type, "roleplay"),
        eq(aiPrompts.scope, "global"),
        eq(aiPrompts.isActive, true)
      ));
    
    if (globalPrompt) {
      return { prompt: globalPrompt, scope: "global" };
    }
    
    const [newGlobalPrompt] = await db.insert(aiPrompts).values({
      type: "roleplay",
      scope: "global",
      teamId: null,
      promptText: DEFAULT_ROLEPLAY_PROMPT,
      version: 1,
      isActive: true,
      updatedByUserId: null,
    }).returning();
    
    return { prompt: newGlobalPrompt, scope: "global" };
  }
  
  async getGlobalRoleplayPrompts(): Promise<AiPrompt[]> {
    return await db.select().from(aiPrompts)
      .where(and(
        eq(aiPrompts.type, "roleplay"),
        eq(aiPrompts.scope, "global")
      ))
      .orderBy(sql`${aiPrompts.version} DESC`);
  }
  
  async getTeamRoleplayPrompts(teamId: number): Promise<AiPrompt[]> {
    return await db.select().from(aiPrompts)
      .where(and(
        eq(aiPrompts.type, "roleplay"),
        eq(aiPrompts.scope, "team"),
        eq(aiPrompts.teamId, teamId)
      ))
      .orderBy(sql`${aiPrompts.version} DESC`);
  }
  
  async saveRoleplayPrompt(type: string, scope: "global" | "team", teamId: number | null, promptText: string, userId: number): Promise<AiPrompt> {
    let currentVersion = 0;
    
    if (scope === "global") {
      await db.update(aiPrompts)
        .set({ isActive: false })
        .where(and(
          eq(aiPrompts.type, type),
          eq(aiPrompts.scope, "global"),
          eq(aiPrompts.isActive, true)
        ));
      
      const [lastVersion] = await db.select({ version: aiPrompts.version })
        .from(aiPrompts)
        .where(and(
          eq(aiPrompts.type, type),
          eq(aiPrompts.scope, "global")
        ))
        .orderBy(sql`${aiPrompts.version} DESC`)
        .limit(1);
      
      currentVersion = lastVersion?.version || 0;
    } else if (teamId) {
      await db.update(aiPrompts)
        .set({ isActive: false })
        .where(and(
          eq(aiPrompts.type, type),
          eq(aiPrompts.scope, "team"),
          eq(aiPrompts.teamId, teamId),
          eq(aiPrompts.isActive, true)
        ));
      
      const [lastVersion] = await db.select({ version: aiPrompts.version })
        .from(aiPrompts)
        .where(and(
          eq(aiPrompts.type, type),
          eq(aiPrompts.scope, "team"),
          eq(aiPrompts.teamId, teamId)
        ))
        .orderBy(sql`${aiPrompts.version} DESC`)
        .limit(1);
      
      currentVersion = lastVersion?.version || 0;
    }
    
    const [created] = await db.insert(aiPrompts).values({
      type,
      scope,
      teamId,
      promptText,
      version: currentVersion + 1,
      isActive: true,
      updatedByUserId: userId,
    }).returning();
    
    return created;
  }
  
  async resetTeamRoleplayPrompt(teamId: number): Promise<void> {
    await db.update(aiPrompts)
      .set({ isActive: false })
      .where(and(
        eq(aiPrompts.type, "roleplay"),
        eq(aiPrompts.scope, "team"),
        eq(aiPrompts.teamId, teamId),
        eq(aiPrompts.isActive, true)
      ));
  }
  
  // ===== KANBAN PESSOAL =====
  
  async getPersonalTasksByUser(userId: number): Promise<PersonalTask[]> {
    return await db.select().from(personalTasks)
      .where(eq(personalTasks.userId, userId))
      .orderBy(personalTasks.orderIndex);
  }
  
  async getPersonalTask(id: number, userId: number): Promise<PersonalTask | undefined> {
    const [task] = await db.select().from(personalTasks)
      .where(and(
        eq(personalTasks.id, id),
        eq(personalTasks.userId, userId)
      ));
    return task;
  }
  
  async createPersonalTask(data: InsertPersonalTask): Promise<PersonalTask> {
    // Get the max order index for this user's column
    const [maxOrder] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(order_index), -1)` })
      .from(personalTasks)
      .where(and(
        eq(personalTasks.userId, data.userId),
        eq(personalTasks.column, data.column || "backlog")
      ));
    
    const [created] = await db.insert(personalTasks).values({
      ...data,
      orderIndex: (maxOrder?.maxOrder ?? -1) + 1,
    }).returning();
    return created;
  }
  
  async updatePersonalTask(id: number, userId: number, data: Partial<InsertPersonalTask>): Promise<PersonalTask | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    
    // If moving to "concluido", set completedAt
    if (data.column === "concluido") {
      updateData.completedAt = new Date();
    }
    
    const [updated] = await db.update(personalTasks)
      .set(updateData)
      .where(and(
        eq(personalTasks.id, id),
        eq(personalTasks.userId, userId)
      ))
      .returning();
    return updated;
  }
  
  async deletePersonalTask(id: number, userId: number): Promise<void> {
    await db.delete(personalTasks)
      .where(and(
        eq(personalTasks.id, id),
        eq(personalTasks.userId, userId)
      ));
  }
  
  async reorderPersonalTasks(userId: number, column: string, taskIds: number[]): Promise<void> {
    // Update order_index for each task in the given order
    for (let i = 0; i < taskIds.length; i++) {
      await db.update(personalTasks)
        .set({ orderIndex: i, column, updatedAt: new Date() })
        .where(and(
          eq(personalTasks.id, taskIds[i]),
          eq(personalTasks.userId, userId)
        ));
    }
  }
  
  async countTasksInColumn(userId: number, column: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(personalTasks)
      .where(and(
        eq(personalTasks.userId, userId),
        eq(personalTasks.column, column)
      ));
    return result?.count ?? 0;
  }
}

export const storage = new DbStorage();
