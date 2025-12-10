import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, inArray, sql, ilike, gte, lte } from "drizzle-orm";
import {
  users,
  banks,
  agreements,
  coefficientTables,
  simulations,
  roteirosBancarios,
  clientesPessoa,
  clientesFolhaMes,
  clientesContratos,
  basesImportadas,
  pedidosLista,
  pricingSettings,
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
  type ClienteFolhaMes,
  type InsertClienteFolhaMes,
  type ClienteContrato,
  type InsertClienteContrato,
  type BaseImportada,
  type InsertBaseImportada,
  type PedidoLista,
  type InsertPedidoLista,
  type FiltrosPedidoLista,
  type PricingSettings,
  type InsertPricingSettings,
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
  getClientesByMatricula(matricula: string, convenio?: string): Promise<ClientePessoa[]>;
  getClientePessoaById(id: number): Promise<ClientePessoa | undefined>;
  getClientesByCpf(cpf: string, convenio?: string): Promise<ClientePessoa[]>;
  createClientePessoa(data: InsertClientePessoa): Promise<ClientePessoa>;
  updateClientePessoa(id: number, data: Partial<InsertClientePessoa>): Promise<ClientePessoa | undefined>;
  searchClientesPessoa(filtros: FiltrosPedidoLista): Promise<{ clientes: ClientePessoa[]; total: number }>;
  getDistinctConveniosClientes(): Promise<string[]>;
  getDistinctOrgaosClientes(): Promise<string[]>;
  getDistinctUfsClientes(): Promise<string[]>;
  
  // Clientes Folha Mês
  createClienteFolhaMes(data: InsertClienteFolhaMes): Promise<ClienteFolhaMes>;
  getFolhaMesByPessoaId(pessoaId: number): Promise<ClienteFolhaMes[]>;
  
  // Clientes Contratos
  createClienteContrato(data: InsertClienteContrato): Promise<ClienteContrato>;
  updateClienteContrato(id: number, data: Partial<InsertClienteContrato>): Promise<ClienteContrato | undefined>;
  getContratosByPessoaId(pessoaId: number): Promise<ClienteContrato[]>;
  
  // Bases Importadas
  getAllBasesImportadas(): Promise<BaseImportada[]>;
  getBaseImportada(id: number): Promise<BaseImportada | undefined>;
  getBaseByStatus(status: string): Promise<BaseImportada | undefined>;
  createBaseImportada(data: InsertBaseImportada): Promise<BaseImportada>;
  updateBaseImportada(id: number, data: Partial<InsertBaseImportada>): Promise<BaseImportada | undefined>;
  deleteBaseImportada(id: number, baseTag: string): Promise<{ deletedFolhas: number; deletedContratos: number; deletedPessoas: number }>;
  
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

  async getClientesByMatricula(matricula: string, convenio?: string): Promise<ClientePessoa[]> {
    const conditions = [eq(clientesPessoa.matricula, matricula)];
    if (convenio) {
      conditions.push(ilike(clientesPessoa.convenio, convenio));
    }
    return await db.select().from(clientesPessoa).where(and(...conditions));
  }

  async getClientePessoaById(id: number): Promise<ClientePessoa | undefined> {
    const [cliente] = await db.select().from(clientesPessoa).where(eq(clientesPessoa.id, id));
    return cliente;
  }

  async getClientesByCpf(cpf: string, convenio?: string): Promise<ClientePessoa[]> {
    // Remove formatting from CPF (dots and dashes)
    const cleanCpf = cpf.replace(/\D/g, "");
    // Compare by removing non-digits from stored CPF as well (handles both formatted and unformatted storage)
    if (convenio) {
      return await db.select()
        .from(clientesPessoa)
        .where(and(
          sql`regexp_replace(${clientesPessoa.cpf}, '[^0-9]', '', 'g') = ${cleanCpf}`,
          ilike(clientesPessoa.convenio, convenio)
        ));
    }
    return await db.select()
      .from(clientesPessoa)
      .where(sql`regexp_replace(${clientesPessoa.cpf}, '[^0-9]', '', 'g') = ${cleanCpf}`);
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
      filtros.banco || filtros.parcela_min !== undefined || filtros.parcela_max !== undefined
    );

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

    // If we need joins, use parameterized SQL query for safety
    if (needsFolhaJoin || needsContratoJoin) {
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

      // Margem 30% conditions (parameterized)
      if (filtros.margem_30_min !== undefined) {
        whereConditions.push(sql`folha.margem_saldo_30 >= ${filtros.margem_30_min}`);
      }
      if (filtros.margem_30_max !== undefined) {
        whereConditions.push(sql`folha.margem_saldo_30 <= ${filtros.margem_30_max}`);
      }

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
      if (filtros.parcela_min !== undefined) {
        whereConditions.push(sql`c.valor_parcela >= ${filtros.parcela_min}`);
      }
      if (filtros.parcela_max !== undefined) {
        whereConditions.push(sql`c.valor_parcela <= ${filtros.parcela_max}`);
      }

      // Combine WHERE conditions
      let whereSql = sql``;
      if (whereConditions.length > 0) {
        whereSql = sql`WHERE ${whereConditions.reduce((acc, cond, i) => 
          i === 0 ? cond : sql`${acc} AND ${cond}`
        )}`;
      }

      // Build final query with all parameterized parts
      const query = sql`
        SELECT DISTINCT p.*
        FROM clientes_pessoa p
        ${folhaJoinSql}
        ${contratoJoinSql}
        ${whereSql}
      `;

      const result = await db.execute(query);
      const clientes = result.rows as ClientePessoa[];
      
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
    const result = await db.select({ orgaodesc: clientesPessoa.orgaodesc }).from(clientesPessoa);
    const uniqueOrgaos = [...new Set(result.map(r => r.orgaodesc).filter(Boolean))];
    return uniqueOrgaos.sort() as string[];
  }

  async getDistinctUfsClientes(): Promise<string[]> {
    const result = await db.select({ uf: clientesPessoa.uf }).from(clientesPessoa);
    const uniqueUfs = [...new Set(result.map(r => r.uf).filter(Boolean))];
    return uniqueUfs.sort() as string[];
  }

  // Clientes Folha Mês
  async createClienteFolhaMes(data: InsertClienteFolhaMes): Promise<ClienteFolhaMes> {
    const [newFolha] = await db.insert(clientesFolhaMes).values(data).returning();
    return newFolha;
  }

  async getFolhaMesByPessoaId(pessoaId: number): Promise<ClienteFolhaMes[]> {
    return await db.select()
      .from(clientesFolhaMes)
      .where(eq(clientesFolhaMes.pessoaId, pessoaId))
      .orderBy(sql`${clientesFolhaMes.competencia} DESC`);
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

  async deleteBaseImportada(id: number, baseTag: string): Promise<{ deletedFolhas: number; deletedContratos: number; deletedPessoas: number }> {
    console.log(`[Storage] Deleting base ${id} with tag ${baseTag}`);
    
    // 1. Delete folhas with this baseTag
    const folhasResult = await db.delete(clientesFolhaMes)
      .where(eq(clientesFolhaMes.baseTag, baseTag))
      .returning({ id: clientesFolhaMes.id });
    const deletedFolhas = folhasResult.length;
    console.log(`[Storage] Deleted ${deletedFolhas} folhas`);
    
    // 2. Delete contratos with this baseTag
    const contratosResult = await db.delete(clientesContratos)
      .where(eq(clientesContratos.baseTag, baseTag))
      .returning({ id: clientesContratos.id });
    const deletedContratos = contratosResult.length;
    console.log(`[Storage] Deleted ${deletedContratos} contratos`);
    
    // 3. Delete orphaned pessoas - those whose last base was this one AND have no remaining folhas/contratos
    // First get IDs of pessoas to delete (avoid subquery issues)
    const pessoasToCheck = await db.select({ id: clientesPessoa.id })
      .from(clientesPessoa)
      .where(eq(clientesPessoa.baseTagUltima, baseTag));
    
    let deletedPessoas = 0;
    for (const pessoa of pessoasToCheck) {
      // Check if this pessoa has any remaining folhas or contratos
      const [hasData] = await db.select({ count: sql<number>`count(*)` })
        .from(clientesFolhaMes)
        .where(eq(clientesFolhaMes.pessoaId, pessoa.id));
      
      const [hasContratos] = await db.select({ count: sql<number>`count(*)` })
        .from(clientesContratos)
        .where(eq(clientesContratos.pessoaId, pessoa.id));
      
      // Convert to number (Neon returns strings)
      const folhaCount = Number(hasData?.count) || 0;
      const contratoCount = Number(hasContratos?.count) || 0;
      
      if (folhaCount === 0 && contratoCount === 0) {
        await db.delete(clientesPessoa).where(eq(clientesPessoa.id, pessoa.id));
        deletedPessoas++;
      }
    }
    console.log(`[Storage] Deleted ${deletedPessoas} orphaned pessoas`);
    
    // 4. Delete the base record itself
    await db.delete(basesImportadas).where(eq(basesImportadas.id, id));
    console.log(`[Storage] Deleted base record ${id}`);
    
    return { deletedFolhas, deletedContratos, deletedPessoas };
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
}

export const storage = new DbStorage();
