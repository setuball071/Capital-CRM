import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, inArray } from "drizzle-orm";
import {
  users,
  agreements,
  coefficientTables,
  simulations,
  type User,
  type InsertUser,
  type Agreement,
  type InsertAgreement,
  type CoefficientTable,
  type InsertCoefficientTable,
  type Simulation,
  type InsertSimulation,
} from "@shared/schema";

// Use neon-http for serverless/edge environments
const queryClient = neon(process.env.DATABASE_URL!);
const db = drizzle(queryClient);

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
}

export const storage = new DbStorage();
