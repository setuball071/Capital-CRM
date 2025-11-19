import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
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
  getCoefficientTablesByBank(bank: string): Promise<CoefficientTable[]>;
  getCoefficientTablesByBankAndTerm(bank: string, termMonths: number): Promise<CoefficientTable[]>;
  getCoefficientTable(id: number): Promise<CoefficientTable | undefined>;
  createCoefficientTable(table: InsertCoefficientTable): Promise<CoefficientTable>;
  updateCoefficientTable(id: number, data: Partial<InsertCoefficientTable>): Promise<CoefficientTable | undefined>;
  deleteCoefficientTable(id: number): Promise<void>;
  
  // Simulations
  getAllSimulations(): Promise<Simulation[]>;
  getSimulationsByUser(userId: number): Promise<Simulation[]>;
  createSimulation(simulation: InsertSimulation): Promise<Simulation>;
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
}

export const storage = new DbStorage();
