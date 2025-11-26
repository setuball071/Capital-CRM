import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { z } from "zod";
import { storage } from "./storage";
import {
  loginSchema,
  registerSchema,
  insertAgreementSchema,
  insertCoefficientTableSchema,
  insertSimulationSchema,
  type User,
  type InsertCoefficientTable,
} from "@shared/schema";

// Schema for updating users
const updateUserSchema = z.object({
  name: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["vendedor", "coordenacao", "master"]).optional(),
  managerId: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict(); // Reject extra fields

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session: any; // Express session already configured in server/index.ts
    }
  }
}

// Auth middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Usuário não encontrado ou inativo" });
  }

  req.user = user;
  next();
}

// Master role middleware
function requireMaster(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "master") {
    return res.status(403).json({ message: "Acesso negado - apenas administradores" });
  }
  next();
}

// Coordenacao or Master middleware
function requireManagerAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== "master" && req.user.role !== "coordenacao")) {
    return res.status(403).json({ message: "Acesso negado - apenas coordenadores ou administradores" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== AUTH ROUTES =====
  
  // Create user (master creates all, coordenador creates only vendedor)
  app.post("/api/users", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const { name, email, password, role, managerId } = result.data;

      // Check permissions based on current user role
      if (req.user!.role === "coordenacao") {
        // Coordenador can only create vendedor
        if (role !== "vendedor") {
          return res.status(403).json({ 
            message: "Coordenadores só podem criar usuários de venda" 
          });
        }
        // Vendedor must be linked to this coordenador
        if (managerId && managerId !== req.user!.id) {
          return res.status(403).json({ 
            message: "Você só pode criar vendedores em sua equipe" 
          });
        }
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Determine managerId
      let finalManagerId = managerId;
      if (role === "vendedor" && req.user!.role === "coordenacao") {
        // If coordenador is creating vendedor, link to themselves
        finalManagerId = req.user!.id;
      }

      // Create user
      const user = await storage.createUser({
        name,
        email,
        passwordHash,
        role,
        managerId: finalManagerId,
      });

      // Don't send password hash to client
      const { passwordHash: _, ...userWithoutPassword } = user;

      return res.status(201).json({
        message: "Usuário criado com sucesso",
        user: userWithoutPassword,
      });
    } catch (error) {
      console.error("Create user error:", error);
      return res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const { email, password } = result.data;

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Usuário inativo" });
      }

      // Check password
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      // Set session and save it
      req.session.userId = user.id;
      
      // Save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }

        // Don't send password hash to client
        const { passwordHash: _, ...userWithoutPassword } = user;

        return res.json({
          message: "Login realizado com sucesso",
          user: userWithoutPassword,
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logout realizado com sucesso" });
    });
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const { passwordHash: _, ...userWithoutPassword } = req.user!;
    return res.json({ user: userWithoutPassword });
  });

  // ===== AGREEMENTS ROUTES =====
  
  // Get all active agreements (public for calculator)
  app.get("/api/agreements", async (req, res) => {
    try {
      const agreements = await storage.getActiveAgreements();
      return res.json(agreements);
    } catch (error) {
      console.error("Get agreements error:", error);
      return res.status(500).json({ message: "Erro ao buscar convênios" });
    }
  });

  // Get all agreements (master only)
  app.get("/api/agreements/all", requireAuth, requireMaster, async (req, res) => {
    try {
      const agreements = await storage.getAllAgreements();
      return res.json(agreements);
    } catch (error) {
      console.error("Get all agreements error:", error);
      return res.status(500).json({ message: "Erro ao buscar convênios" });
    }
  });

  // Create agreement (master only)
  app.post("/api/agreements", requireAuth, requireMaster, async (req, res) => {
    try {
      const result = insertAgreementSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const agreement = await storage.createAgreement(result.data);
      return res.status(201).json(agreement);
    } catch (error) {
      console.error("Create agreement error:", error);
      return res.status(500).json({ message: "Erro ao criar convênio" });
    }
  });

  // Update agreement (master only)
  app.put("/api/agreements/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertAgreementSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const agreement = await storage.updateAgreement(id, result.data);
      if (!agreement) {
        return res.status(404).json({ message: "Convênio não encontrado" });
      }

      return res.json(agreement);
    } catch (error) {
      console.error("Update agreement error:", error);
      return res.status(500).json({ message: "Erro ao atualizar convênio" });
    }
  });

  // Delete agreement (master only)
  app.delete("/api/agreements/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAgreement(id);
      return res.json({ message: "Convênio deletado com sucesso" });
    } catch (error) {
      console.error("Delete agreement error:", error);
      return res.status(500).json({ message: "Erro ao deletar convênio" });
    }
  });

  // ===== COEFFICIENT TABLES ROUTES =====
  
  // Get active coefficient tables (public for calculator)
  app.get("/api/coefficient-tables", async (req, res) => {
    try {
      const { bank, term } = req.query;
      
      if (bank && term) {
        const tables = await storage.getCoefficientTablesByBankAndTerm(
          bank as string,
          parseInt(term as string)
        );
        return res.json(tables);
      } else if (bank) {
        const tables = await storage.getCoefficientTablesByBank(bank as string);
        return res.json(tables);
      } else {
        const tables = await storage.getActiveCoefficientTables();
        return res.json(tables);
      }
    } catch (error) {
      console.error("Get coefficient tables error:", error);
      return res.status(500).json({ message: "Erro ao buscar tabelas" });
    }
  });

  // Get all coefficient tables (master only)
  app.get("/api/coefficient-tables/all", requireAuth, requireMaster, async (req, res) => {
    try {
      const tables = await storage.getAllCoefficientTables();
      return res.json(tables);
    } catch (error) {
      console.error("Get all coefficient tables error:", error);
      return res.status(500).json({ message: "Erro ao buscar tabelas" });
    }
  });

  // Create coefficient table (master only)
  app.post("/api/coefficient-tables", requireAuth, requireMaster, async (req, res) => {
    try {
      const result = insertCoefficientTableSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const table = await storage.createCoefficientTable(result.data);
      return res.status(201).json(table);
    } catch (error) {
      console.error("Create coefficient table error:", error);
      return res.status(500).json({ message: "Erro ao criar tabela" });
    }
  });

  // Update coefficient table (master only)
  app.put("/api/coefficient-tables/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertCoefficientTableSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const table = await storage.updateCoefficientTable(id, result.data);
      if (!table) {
        return res.status(404).json({ message: "Tabela não encontrada" });
      }

      return res.json(table);
    } catch (error) {
      console.error("Update coefficient table error:", error);
      return res.status(500).json({ message: "Erro ao atualizar tabela" });
    }
  });

  // Delete coefficient table (master only)
  app.delete("/api/coefficient-tables/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCoefficientTable(id);
      return res.json({ message: "Tabela deletada com sucesso" });
    } catch (error) {
      console.error("Delete coefficient table error:", error);
      return res.status(500).json({ message: "Erro ao deletar tabela" });
    }
  });

  // Bulk delete coefficient tables (master only)
  app.post("/api/coefficient-tables/bulk-delete", requireAuth, requireMaster, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs inválidos" });
      }

      const deletePromises = ids.map((id: number) => storage.deleteCoefficientTable(id));
      await Promise.all(deletePromises);

      return res.json({ 
        message: "Tabelas deletadas com sucesso",
        count: ids.length
      });
    } catch (error) {
      console.error("Bulk delete coefficient tables error:", error);
      return res.status(500).json({ message: "Erro ao deletar tabelas" });
    }
  });

  // ===== USERS ROUTES =====
  
  // Get users (hierarchical: master sees all, coordenador sees their team)
  // REGRAS DE VISIBILIDADE:
  // - Admin (master): Vê todos os usuários do sistema
  // - Coordenador: Vê apenas ele mesmo + vendedores da sua equipe (managerId = coordenador.id)
  //   NÃO vê outros admins, outros coordenadores, nem vendedores de outras equipes
  app.get("/api/users", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      let users: User[];
      
      if (req.user!.role === "master") {
        // Master sees all users
        users = await storage.getAllUsers();
      } else if (req.user!.role === "coordenacao") {
        // Coordenador sees only their team (vendedores with managerId = this coordinator's id) + themselves
        const teamUsers = await storage.getUsersByManager(req.user!.id);
        users = [req.user!, ...teamUsers];
      } else {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Remove password hashes
      const usersWithoutPasswords = users.map(({ passwordHash: _, ...user }) => user);
      return res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Get users error:", error);
      return res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  // Get all coordenadores (for selecting manager when creating vendedor)
  app.get("/api/users/coordenadores", requireAuth, requireMaster, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const coordenadores = allUsers.filter(u => u.role === "coordenacao" && u.isActive);
      const withoutPasswords = coordenadores.map(({ passwordHash: _, ...user }) => user);
      return res.json(withoutPasswords);
    } catch (error) {
      console.error("Get coordenadores error:", error);
      return res.status(500).json({ message: "Erro ao buscar coordenadores" });
    }
  });

  // Update user
  app.put("/api/users/:id", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate input
      const validationResult = updateUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validationResult.error.errors,
        });
      }

      const validatedData = validationResult.data;
      
      // Fetch target user
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Check permissions
      if (req.user!.role === "coordenacao") {
        // Coordinators can only edit themselves or their direct reports
        const canEdit = targetUser.id === req.user!.id || targetUser.managerId === req.user!.id;
        if (!canEdit) {
          return res.status(403).json({ message: "Você só pode editar seu próprio perfil ou membros da sua equipe" });
        }
        
        // Coordinators cannot change role or managerId
        if (validatedData.role !== undefined || validatedData.managerId !== undefined) {
          return res.status(403).json({ message: "Você não pode alterar a função ou coordenador de usuários" });
        }
      }

      // Build update object from validated data
      let dataToUpdate: any = {};
      if (validatedData.name !== undefined) dataToUpdate.name = validatedData.name;
      if (validatedData.email !== undefined) dataToUpdate.email = validatedData.email;
      if (validatedData.isActive !== undefined) dataToUpdate.isActive = validatedData.isActive;
      
      // Only master can change role and managerId
      if (req.user!.role === "master") {
        if (validatedData.role !== undefined) dataToUpdate.role = validatedData.role;
        if (validatedData.managerId !== undefined) dataToUpdate.managerId = validatedData.managerId;
      }

      // Hash password if provided
      if (validatedData.password) {
        const passwordHash = await bcrypt.hash(validatedData.password, 10);
        dataToUpdate.passwordHash = passwordHash;
      }

      // Reject empty updates
      if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ message: "Nenhuma alteração fornecida" });
      }

      const updatedUser = await storage.updateUser(id, dataToUpdate);
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error:", error);
      return res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate ID is a valid number
      if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }
      
      // Cannot delete yourself
      if (id === req.user!.id) {
        return res.status(403).json({ message: "Você não pode excluir sua própria conta" });
      }
      
      // Fetch target user
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Check permissions
      if (req.user!.role === "coordenacao") {
        // Coordinators can only delete vendedores from their team
        if (targetUser.role !== "vendedor" || targetUser.managerId !== req.user!.id) {
          return res.status(403).json({ message: "Você só pode excluir vendedores da sua equipe" });
        }
      }

      // Delete user
      await storage.deleteUser(id);
      return res.json({ message: "Usuário excluído com sucesso" });
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // ===== SIMULATIONS ROUTES =====
  
  // Get user's simulations
  app.get("/api/simulations", requireAuth, async (req, res) => {
    try {
      const simulations = await storage.getSimulationsByUser(req.user!.id);
      return res.json(simulations);
    } catch (error) {
      console.error("Get simulations error:", error);
      return res.status(500).json({ message: "Erro ao buscar simulações" });
    }
  });

  // Get all simulations (master only)
  app.get("/api/simulations/all", requireAuth, requireMaster, async (req, res) => {
    try {
      const simulations = await storage.getAllSimulations();
      return res.json(simulations);
    } catch (error) {
      console.error("Get all simulations error:", error);
      return res.status(500).json({ message: "Erro ao buscar simulações" });
    }
  });

  // Create simulation
  app.post("/api/simulations", requireAuth, async (req, res) => {
    try {
      const simulation = await storage.createSimulation({
        ...req.body,
        userId: req.user!.id,
      });
      return res.status(201).json(simulation);
    } catch (error) {
      console.error("Create simulation error:", error);
      return res.status(500).json({ message: "Erro ao criar simulação" });
    }
  });

  // ===== AGREEMENTS ROUTES =====
  
  // Get all agreements
  app.get("/api/agreements", requireAuth, async (req, res) => {
    try {
      const agreements = await storage.getAllAgreements();
      return res.json(agreements);
    } catch (error) {
      console.error("Get agreements error:", error);
      return res.status(500).json({ message: "Erro ao buscar convênios" });
    }
  });

  // Get active agreements
  app.get("/api/agreements/active", requireAuth, async (req, res) => {
    try {
      const agreements = await storage.getActiveAgreements();
      return res.json(agreements);
    } catch (error) {
      console.error("Get active agreements error:", error);
      return res.status(500).json({ message: "Erro ao buscar convênios ativos" });
    }
  });

  // Create agreement (master only)
  app.post("/api/agreements", requireAuth, requireMaster, async (req, res) => {
    try {
      const result = insertAgreementSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.format(),
        });
      }

      const agreement = await storage.createAgreement(result.data);
      return res.status(201).json(agreement);
    } catch (error) {
      console.error("Create agreement error:", error);
      return res.status(500).json({ message: "Erro ao criar convênio" });
    }
  });

  // Update agreement (master only)
  app.patch("/api/agreements/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const result = insertAgreementSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.format(),
        });
      }

      const agreement = await storage.updateAgreement(id, result.data);
      if (!agreement) {
        return res.status(404).json({ message: "Convênio não encontrado" });
      }

      return res.json(agreement);
    } catch (error) {
      console.error("Update agreement error:", error);
      return res.status(500).json({ message: "Erro ao atualizar convênio" });
    }
  });

  // Delete agreement (master only)
  app.delete("/api/agreements/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      await storage.deleteAgreement(id);
      return res.json({ message: "Convênio excluído com sucesso" });
    } catch (error) {
      console.error("Delete agreement error:", error);
      return res.status(500).json({ message: "Erro ao excluir convênio" });
    }
  });

  // ===== COEFFICIENT TABLES ROUTES =====
  
  // Get all coefficient tables
  app.get("/api/coefficient-tables", requireAuth, async (req, res) => {
    try {
      const tables = await storage.getAllCoefficientTables();
      return res.json(tables);
    } catch (error) {
      console.error("Get coefficient tables error:", error);
      return res.status(500).json({ message: "Erro ao buscar tabelas de coeficientes" });
    }
  });

  // Get coefficient tables by agreement
  app.get("/api/coefficient-tables/by-agreement/:agreementId", requireAuth, async (req, res) => {
    try {
      const agreementId = parseInt(req.params.agreementId);
      if (isNaN(agreementId)) {
        return res.status(400).json({ message: "ID de convênio inválido" });
      }

      const tables = await storage.getCoefficientTablesByAgreement(agreementId);
      return res.json(tables);
    } catch (error) {
      console.error("Get coefficient tables by agreement error:", error);
      return res.status(500).json({ message: "Erro ao buscar tabelas de coeficientes" });
    }
  });

  // Create coefficient table (master only)
  app.post("/api/coefficient-tables", requireAuth, requireMaster, async (req, res) => {
    try {
      const result = insertCoefficientTableSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.format(),
        });
      }

      const table = await storage.createCoefficientTable(result.data);
      return res.status(201).json(table);
    } catch (error) {
      console.error("Create coefficient table error:", error);
      return res.status(500).json({ message: "Erro ao criar tabela de coeficiente" });
    }
  });

  // Bulk import coefficient tables (master only)
  app.post("/api/coefficient-tables/bulk-import", requireAuth, requireMaster, async (req, res) => {
    try {
      const { tables } = req.body;

      if (!Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ message: "Nenhuma tabela para importar" });
      }

      const validatedTables: InsertCoefficientTable[] = [];
      const errors: any[] = [];

      for (let i = 0; i < tables.length; i++) {
        const result = insertCoefficientTableSchema.safeParse(tables[i]);
        if (!result.success) {
          errors.push({
            row: i + 1,
            errors: result.error.format(),
          });
        } else {
          validatedTables.push(result.data);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          message: "Algumas linhas contêm erros",
          errors,
        });
      }

      const createdTables = await storage.createCoefficientTablesBulk(validatedTables);
      return res.status(201).json({
        message: `${createdTables.length} tabelas importadas com sucesso`,
        count: createdTables.length,
        tables: createdTables,
      });
    } catch (error) {
      console.error("Bulk import coefficient tables error:", error);
      return res.status(500).json({ message: "Erro ao importar tabelas" });
    }
  });

  // Update coefficient table (master only)
  app.patch("/api/coefficient-tables/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const result = insertCoefficientTableSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.format(),
        });
      }

      const table = await storage.updateCoefficientTable(id, result.data);
      if (!table) {
        return res.status(404).json({ message: "Tabela não encontrada" });
      }

      return res.json(table);
    } catch (error) {
      console.error("Update coefficient table error:", error);
      return res.status(500).json({ message: "Erro ao atualizar tabela de coeficiente" });
    }
  });

  // Delete coefficient table (master only)
  app.delete("/api/coefficient-tables/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      await storage.deleteCoefficientTable(id);
      return res.json({ message: "Tabela de coeficiente excluída com sucesso" });
    } catch (error) {
      console.error("Delete coefficient table error:", error);
      return res.status(500).json({ message: "Erro ao excluir tabela de coeficiente" });
    }
  });

  // ===== CALCULATOR HIERARCHY ROUTES =====
  
  // Get operation types by agreement
  app.get("/api/calculator/operation-types", requireAuth, async (req, res) => {
    try {
      const agreementId = parseInt(req.query.agreementId as string);
      if (isNaN(agreementId)) {
        return res.status(400).json({ message: "ID de convênio inválido" });
      }

      const operationTypes = await storage.getOperationTypesByAgreement(agreementId);
      return res.json(operationTypes);
    } catch (error) {
      console.error("Get operation types error:", error);
      return res.status(500).json({ message: "Erro ao buscar tipos de operação" });
    }
  });

  // Get banks by agreement and operation type
  app.get("/api/calculator/banks", requireAuth, async (req, res) => {
    try {
      const agreementId = parseInt(req.query.agreementId as string);
      const operationType = req.query.operationType as string;

      if (isNaN(agreementId) || !operationType) {
        return res.status(400).json({ message: "Parâmetros inválidos" });
      }

      const banks = await storage.getBanksByAgreementAndOperationType(agreementId, operationType);
      return res.json(banks);
    } catch (error) {
      console.error("Get banks error:", error);
      return res.status(500).json({ message: "Erro ao buscar bancos" });
    }
  });

  // Get terms by agreement, operation type and bank
  app.get("/api/calculator/terms", requireAuth, async (req, res) => {
    try {
      const agreementId = parseInt(req.query.agreementId as string);
      const operationType = req.query.operationType as string;
      const bank = req.query.bank as string;

      if (isNaN(agreementId) || !operationType || !bank) {
        return res.status(400).json({ message: "Parâmetros inválidos" });
      }

      const terms = await storage.getTermsByAgreementOperationTypeAndBank(agreementId, operationType, bank);
      return res.json(terms);
    } catch (error) {
      console.error("Get terms error:", error);
      return res.status(500).json({ message: "Erro ao buscar prazos" });
    }
  });

  // Get tables by agreement, operation type, bank and term
  app.get("/api/calculator/tables", requireAuth, async (req, res) => {
    try {
      const agreementId = parseInt(req.query.agreementId as string);
      const operationType = req.query.operationType as string;
      const bank = req.query.bank as string;
      const termMonths = parseInt(req.query.termMonths as string);

      if (isNaN(agreementId) || !operationType || !bank || isNaN(termMonths)) {
        return res.status(400).json({ message: "Parâmetros inválidos" });
      }

      const tables = await storage.getTablesByAgreementOperationTypeBankAndTerm(agreementId, operationType, bank, termMonths);
      return res.json(tables);
    } catch (error) {
      console.error("Get tables error:", error);
      return res.status(500).json({ message: "Erro ao buscar tabelas" });
    }
  });

  // ===== SIMULATIONS ROUTES =====
  
  // Create a simulation
  app.post("/api/simulations", requireAuth, async (req, res) => {
    try {
      const result = insertSimulationSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const simulation = await storage.createSimulation({
        ...result.data,
        userId: req.user!.id,
      });

      return res.json(simulation);
    } catch (error) {
      console.error("Create simulation error:", error);
      return res.status(500).json({ message: "Erro ao salvar simulação" });
    }
  });

  // Get all simulations (master only)
  app.get("/api/simulations", requireAuth, requireMaster, async (req, res) => {
    try {
      const simulations = await storage.getAllSimulations();
      return res.json(simulations);
    } catch (error) {
      console.error("Get simulations error:", error);
      return res.status(500).json({ message: "Erro ao buscar simulações" });
    }
  });

  // Get statistics for admin dashboard (master only)
  app.get("/api/simulations/stats", requireAuth, requireMaster, async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const [
        filteredSimulationsWithUser,
        users,
        bankRanking,
        agreementRanking,
        termRanking,
        operationTypeRanking,
      ] = await Promise.all([
        storage.getRecentSimulationsWithUser(undefined, startDate, endDate),
        storage.getAllUsers(),
        storage.getRankingByBank(startDate, endDate),
        storage.getRankingByAgreement(startDate, endDate),
        storage.getRankingByTerm(startDate, endDate),
        storage.getRankingByOperationType(startDate, endDate),
      ]);

      // Safety checks for undefined/null values
      const safeSimulations = filteredSimulationsWithUser || [];
      const safeUsers = users || [];

      // Calculate stats by user using filtered simulations
      const statsByUser = safeUsers.map(user => {
        const userSimulations = safeSimulations.filter(s => s.userId === user.id);
        
        // Convert string values to numbers for proper aggregation
        const totalContractValue = userSimulations.reduce((sum, s) => {
          const value = typeof s.totalContractValue === 'string' 
            ? parseFloat(s.totalContractValue) 
            : (s.totalContractValue as any);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);

        const totalClientRefund = userSimulations.reduce((sum, s) => {
          const value = typeof s.clientRefund === 'string' 
            ? parseFloat(s.clientRefund) 
            : (s.clientRefund as any);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);
        
        return {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          simulationCount: userSimulations.length,
          totalContractValue,
          totalClientRefund,
          lastSimulation: userSimulations.length > 0 
            ? userSimulations[userSimulations.length - 1].createdAt 
            : null,
        };
      });

      // Recent simulations for display (limit if provided)
      const recentSimulations = limit 
        ? safeSimulations.slice(0, limit)
        : safeSimulations;

      // Calculate overall stats from filtered data
      const totalSimulations = safeSimulations.length;
      const stats = {
        totalSimulations,
        statsByUser: statsByUser.filter(s => s.simulationCount > 0),
        recentSimulations,
        rankings: {
          byBank: bankRanking || [],
          byAgreement: agreementRanking || [],
          byTerm: termRanking || [],
          byOperationType: operationTypeRanking || [],
        },
      };

      return res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
