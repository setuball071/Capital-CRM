import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import {
  loginSchema,
  registerSchema,
  insertAgreementSchema,
  insertCoefficientTableSchema,
  type User,
} from "@shared/schema";

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

      // Set session
      req.session.userId = user.id;

      // Don't send password hash to client
      const { passwordHash: _, ...userWithoutPassword } = user;

      return res.json({
        message: "Login realizado com sucesso",
        user: userWithoutPassword,
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

  // ===== USERS ROUTES =====
  
  // Get users (hierarchical: master sees all, coordenador sees their team)
  app.get("/api/users", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      let users: User[];
      
      if (req.user!.role === "master") {
        // Master sees all users
        users = await storage.getAllUsers();
      } else if (req.user!.role === "coordenacao") {
        // Coordenador sees only their team (vendedores) + themselves
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
  app.put("/api/users/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { password, ...updateData } = req.body;

      let dataToUpdate = updateData;

      // If password is being updated, hash it
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        dataToUpdate = { ...updateData, passwordHash };
      }

      const user = await storage.updateUser(id, dataToUpdate);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const { passwordHash: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error:", error);
      return res.status(500).json({ message: "Erro ao atualizar usuário" });
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

  const httpServer = createServer(app);
  return httpServer;
}
