import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { z } from "zod";
import { storage } from "./storage";
import {
  loginSchema,
  registerSchema,
  insertBankSchema,
  insertAgreementSchema,
  insertCoefficientTableSchema,
  insertSimulationSchema,
  roteirosImportSchema,
  filtrosPedidoListaSchema,
  insertPricingSettingsSchema,
  type User,
  type InsertCoefficientTable,
  USER_ROLES,
  type UserRole,
  type FiltrosPedidoLista,
  type PricingSettings,
} from "@shared/schema";
import * as XLSX from "xlsx";
import multer from "multer";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Configure multer for large file uploads
const uploadDir = path.join(os.tmpdir(), "goldcard-uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: 800 * 1024 * 1024, // 800MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".xlsx", ".xls", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de arquivo inválido. Use .xlsx, .xls ou .csv"));
    }
  },
});

// Schema for updating users
const updateUserSchema = z.object({
  name: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(USER_ROLES).optional(),
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

// Helper to check if user has one of the allowed roles
function hasRole(user: User | undefined, allowedRoles: UserRole[]): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role as UserRole);
}

// Master only middleware (full access - admin)
function requireMaster(req: Request, res: Response, next: NextFunction) {
  if (!hasRole(req.user, ["master"])) {
    return res.status(403).json({ message: "Acesso negado - apenas administradores" });
  }
  next();
}

// Master, Atendimento or Operacional middleware (can view/manage coefficient tables and agreements)
function requireTableAccess(req: Request, res: Response, next: NextFunction) {
  if (!hasRole(req.user, ["master", "atendimento", "operacional"])) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

// Users management access middleware (master, atendimento, coordenacao)
function requireUserManagementAccess(req: Request, res: Response, next: NextFunction) {
  if (!hasRole(req.user, ["master", "atendimento", "coordenacao"])) {
    return res.status(403).json({ message: "Acesso negado - você não tem permissão para gerenciar usuários" });
  }
  next();
}

// Legacy alias for backward compatibility
const requireManagerAccess = requireUserManagementAccess;

// ===== PRICING CALCULATION =====

interface PricingResult {
  precoTotal: number;
  precoUnitario: number;
}

/**
 * Calcula o preço de uma lista de registros com interpolação linear no preço unitário
 * 
 * Modelo de precificação:
 * - V1 (qtdAncoraMin) registros custam P1 (precoAncoraMin) por registro
 * - V2 (qtdAncoraMax) registros custam P2 (precoAncoraMax) por registro
 * - Para quantidades entre V1 e V2: interpolação linear no preço unitário
 * - Para quantidades <= V1: usa preço unitário P1
 * - Para quantidades > V2: usa preço unitário P2
 * 
 * Fórmula: precoUnitario = P1 - ((V - V1) / (V2 - V1)) * (P1 - P2)
 * 
 * @param qtdRegistros - Quantidade de registros
 * @param settings - Configurações de preço com âncoras (P1, P2 são preços unitários)
 */
function calculateListPrice(qtdRegistros: number, settings: PricingSettings): PricingResult {
  if (qtdRegistros <= 0) {
    return { precoTotal: 0, precoUnitario: 0 };
  }
  
  const q1 = settings.qtdAncoraMin;
  const p1 = parseFloat(settings.precoAncoraMin); // Preço UNITÁRIO para q1 registros
  const q2 = settings.qtdAncoraMax;
  const p2 = parseFloat(settings.precoAncoraMax); // Preço UNITÁRIO para q2 registros
  
  let precoUnitario: number;
  
  if (qtdRegistros <= q1) {
    // Usa o preço unitário da âncora mínima
    precoUnitario = p1;
  } else if (qtdRegistros <= q2) {
    // Interpolação linear no preço UNITÁRIO entre as âncoras
    // Fórmula: precoUnitario = P1 - ((V - V1) / (V2 - V1)) * (P1 - P2)
    precoUnitario = p1 - ((qtdRegistros - q1) / (q2 - q1)) * (p1 - p2);
  } else {
    // Usa o preço unitário da âncora máxima para quantidades acima de q2
    precoUnitario = p2;
  }
  
  // Calcula o preço total = quantidade * preço unitário
  const precoTotal = qtdRegistros * precoUnitario;
  
  return {
    precoTotal: Math.round(precoTotal * 100) / 100, // Round to 2 decimals
    precoUnitario: Math.round(precoUnitario * 10000) / 10000, // Round to 4 decimals
  };
}

// Default pricing settings (used when no settings exist in DB)
// Preços unitários: P1=R$0.20 para V1=100 registros, P2=R$0.10 para V2=1000 registros
const DEFAULT_PRICING_SETTINGS = {
  qtdAncoraMin: 100,
  precoAncoraMin: "0.2000", // R$0.20 por registro
  qtdAncoraMax: 1000,
  precoAncoraMax: "0.1000", // R$0.10 por registro
};

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== AUTH ROUTES =====
  
  // Create user with role-based permissions:
  // - admin: can create any user
  // - atendimento: can create any user EXCEPT admin
  // - coordenador: can only create vendedor linked to themselves
  app.post("/api/users", requireAuth, requireUserManagementAccess, async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const { name, email, password, role, managerId } = result.data;
      const currentUserRole = req.user!.role as UserRole;

      // Permission checks based on current user role
      if (currentUserRole === "coordenacao") {
        // Coordenacao can only create vendedor
        if (role !== "vendedor") {
          return res.status(403).json({ 
            message: "Coordenadores só podem criar vendedores" 
          });
        }
        // Vendedor must be linked to this coordenador (or will be auto-linked)
        if (managerId && managerId !== req.user!.id) {
          return res.status(403).json({ 
            message: "Você só pode criar vendedores em sua equipe" 
          });
        }
      } else if (currentUserRole === "atendimento") {
        // Atendimento cannot create master (admin)
        if (role === "master") {
          return res.status(403).json({ 
            message: "Você não tem permissão para criar administradores" 
          });
        }
      }
      // master has no restrictions

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Determine managerId - auto-link vendedor to coordenacao if created by coordenacao
      let finalManagerId = managerId;
      if (role === "vendedor" && currentUserRole === "coordenacao") {
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

  // ===== BANKS ROUTES =====
  
  // Get all active banks (public for calculator)
  app.get("/api/banks", async (req, res) => {
    try {
      const bankList = await storage.getActiveBanks();
      return res.json(bankList);
    } catch (error) {
      console.error("Get banks error:", error);
      return res.status(500).json({ message: "Erro ao buscar bancos" });
    }
  });

  // Get bank by name (public for calculator)
  app.get("/api/banks/by-name/:name", async (req, res) => {
    try {
      const bank = await storage.getBankByName(req.params.name);
      if (!bank) {
        // If bank not found, return default config with 0% adjustment
        return res.json({ 
          name: req.params.name, 
          ajusteSaldoPercentual: "0",
          isActive: true 
        });
      }
      return res.json(bank);
    } catch (error) {
      console.error("Get bank by name error:", error);
      return res.status(500).json({ message: "Erro ao buscar banco" });
    }
  });

  // Get all banks (master only)
  app.get("/api/banks/all", requireAuth, requireMaster, async (req, res) => {
    try {
      const bankList = await storage.getAllBanks();
      return res.json(bankList);
    } catch (error) {
      console.error("Get all banks error:", error);
      return res.status(500).json({ message: "Erro ao buscar bancos" });
    }
  });

  // Create bank (master only)
  app.post("/api/banks", requireAuth, requireMaster, async (req, res) => {
    try {
      const result = insertBankSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      // Check if bank name already exists
      const existing = await storage.getBankByName(result.data.name);
      if (existing) {
        return res.status(400).json({ message: "Já existe um banco com esse nome" });
      }

      const bank = await storage.createBank(result.data);
      return res.status(201).json(bank);
    } catch (error) {
      console.error("Create bank error:", error);
      return res.status(500).json({ message: "Erro ao criar banco" });
    }
  });

  // Update bank (master only)
  app.put("/api/banks/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertBankSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const bank = await storage.updateBank(id, result.data);
      if (!bank) {
        return res.status(404).json({ message: "Banco não encontrado" });
      }

      return res.json(bank);
    } catch (error) {
      console.error("Update bank error:", error);
      return res.status(500).json({ message: "Erro ao atualizar banco" });
    }
  });

  // Delete bank (master only)
  app.delete("/api/banks/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBank(id);
      return res.json({ message: "Banco deletado com sucesso" });
    } catch (error) {
      console.error("Delete bank error:", error);
      return res.status(500).json({ message: "Erro ao deletar banco" });
    }
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
  
  // Get users with role-based visibility:
  // - admin: sees all users
  // - atendimento: sees all users
  // - coordenador: sees only themselves + vendedores whose managerId equals their id
  // - operacional/vendedor: blocked (no access to user management)
  app.get("/api/users", requireAuth, requireUserManagementAccess, async (req, res) => {
    try {
      let users: User[];
      const currentUserRole = req.user!.role as UserRole;
      
      if (currentUserRole === "master" || currentUserRole === "atendimento") {
        // Master and atendimento see all users
        users = await storage.getAllUsers();
      } else if (currentUserRole === "coordenacao") {
        // Coordenacao sees only themselves + their vendedores
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
  // Accessible by master and atendimento (they can assign vendedores to coordenadores)
  app.get("/api/users/coordenadores", requireAuth, async (req, res) => {
    try {
      if (!hasRole(req.user, ["master", "atendimento"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const allUsers = await storage.getAllUsers();
      const coordenadores = allUsers.filter(u => u.role === "coordenacao" && u.isActive);
      const withoutPasswords = coordenadores.map(({ passwordHash: _, ...user }) => user);
      return res.json(withoutPasswords);
    } catch (error) {
      console.error("Get coordenadores error:", error);
      return res.status(500).json({ message: "Erro ao buscar coordenadores" });
    }
  });

  // Update user with role-based permissions:
  // - admin: can update any user
  // - atendimento: can update any user EXCEPT admins
  // - coordenador: can only update themselves or their vendedores (no role/managerId changes)
  app.put("/api/users/:id", requireAuth, requireUserManagementAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserRole = req.user!.role as UserRole;
      
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

      const targetUserRole = targetUser.role as UserRole;

      // Check permissions based on current user role
      if (currentUserRole === "coordenacao") {
        // Coordenacao can only edit themselves or their vendedores
        const canEdit = targetUser.id === req.user!.id || 
          (targetUserRole === "vendedor" && targetUser.managerId === req.user!.id);
        if (!canEdit) {
          return res.status(403).json({ message: "Você só pode editar seu próprio perfil ou vendedores da sua equipe" });
        }
        
        // Coordenacao cannot change role or managerId
        if (validatedData.role !== undefined || validatedData.managerId !== undefined) {
          return res.status(403).json({ message: "Você não pode alterar a função ou coordenador de usuários" });
        }
      } else if (currentUserRole === "atendimento") {
        // Atendimento cannot edit master (admins)
        if (targetUserRole === "master") {
          return res.status(403).json({ message: "Você não tem permissão para editar administradores" });
        }
        // Atendimento cannot change role to master
        if (validatedData.role === "master") {
          return res.status(403).json({ message: "Você não pode promover usuários a administrador" });
        }
      }
      // master has no restrictions

      // Build update object from validated data
      let dataToUpdate: any = {};
      if (validatedData.name !== undefined) dataToUpdate.name = validatedData.name;
      if (validatedData.email !== undefined) dataToUpdate.email = validatedData.email;
      if (validatedData.isActive !== undefined) dataToUpdate.isActive = validatedData.isActive;
      
      // Only master and atendimento can change role and managerId
      if (currentUserRole === "master" || currentUserRole === "atendimento") {
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

  // Delete user with role-based permissions:
  // - admin: can delete any user (except themselves)
  // - atendimento: can delete any user EXCEPT admins
  // - coordenador: can only delete vendedores from their team
  app.delete("/api/users/:id", requireAuth, requireUserManagementAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserRole = req.user!.role as UserRole;
      
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

      const targetUserRole = targetUser.role as UserRole;

      // Check permissions based on current user role
      if (currentUserRole === "coordenacao") {
        // Coordenacao can only delete vendedores from their team
        if (targetUserRole !== "vendedor" || targetUser.managerId !== req.user!.id) {
          return res.status(403).json({ message: "Você só pode excluir vendedores da sua equipe" });
        }
      } else if (currentUserRole === "atendimento") {
        // Atendimento cannot delete master (admins)
        if (targetUserRole === "master") {
          return res.status(403).json({ message: "Você não tem permissão para excluir administradores" });
        }
      }
      // master has no restrictions (except self-delete which is already checked)

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
      console.log("[SIMULATION] Creating simulation for user:", req.user!.id, req.user!.email);
      console.log("[SIMULATION] Request body:", JSON.stringify(req.body, null, 2));
      
      const result = insertSimulationSchema.safeParse(req.body);
      
      if (!result.success) {
        console.log("[SIMULATION] Validation failed:", result.error.errors);
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const simulation = await storage.createSimulation({
        ...result.data,
        userId: req.user!.id,
      });

      console.log("[SIMULATION] Created successfully:", simulation.id);
      return res.json(simulation);
    } catch (error) {
      console.error("[SIMULATION] Create error:", error);
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

  // Get statistics for dashboard (hierarchical: master sees all, coordenador sees team, vendedor sees own)
  // REGRAS DE VISIBILIDADE:
  // - Admin (master): Vê estatísticas de TODOS os usuários
  // - Coordenador: Vê estatísticas da sua equipe (ele + vendedores)
  // - Vendedor: Vê apenas suas próprias estatísticas
  app.get("/api/simulations/stats", requireAuth, async (req, res) => {
    try {
      console.log("[STATS] Request from user:", req.user!.id, req.user!.email, "role:", req.user!.role);
      
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      console.log("[STATS] Filters - startDate:", startDate, "endDate:", endDate);

      // Determine which userIds to include based on role
      let userIds: number[] | undefined;
      let relevantUsers: User[];

      if (req.user!.role === "master") {
        // Master sees all - no filter
        userIds = undefined;
        relevantUsers = await storage.getAllUsers();
        console.log("[STATS] Master user - showing all users, total:", relevantUsers.length);
      } else if (req.user!.role === "coordenacao") {
        // Coordenador sees their team (themselves + their vendedores)
        const teamUsers = await storage.getUsersByManager(req.user!.id);
        userIds = [req.user!.id, ...teamUsers.map(u => u.id)];
        relevantUsers = [req.user!, ...teamUsers];
      } else {
        // Vendedor sees only their own stats
        userIds = [req.user!.id];
        relevantUsers = [req.user!];
      }

      const [
        filteredSimulationsWithUser,
        bankRanking,
        agreementRanking,
        termRanking,
        operationTypeRanking,
      ] = await Promise.all([
        storage.getRecentSimulationsWithUser(undefined, startDate, endDate, userIds),
        storage.getRankingByBank(startDate, endDate, userIds),
        storage.getRankingByAgreement(startDate, endDate, userIds),
        storage.getRankingByTerm(startDate, endDate, userIds),
        storage.getRankingByOperationType(startDate, endDate, userIds),
      ]);

      // Safety checks for undefined/null values
      const safeSimulations = filteredSimulationsWithUser || [];
      
      console.log("[STATS] Found simulations:", safeSimulations.length);
      if (safeSimulations.length > 0) {
        console.log("[STATS] First simulation:", JSON.stringify(safeSimulations[0], null, 2));
      }

      // Calculate stats by user using filtered simulations
      const statsByUser = relevantUsers.map(user => {
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

  // ===== ROTEIROS BANCÁRIOS ROUTES =====
  
  // Middleware for roteiros access (master, atendimento, operacional only)
  function requireRoteirosAccess(req: Request, res: Response, next: NextFunction) {
    if (!hasRole(req.user, ["master", "atendimento", "operacional"])) {
      return res.status(403).json({ message: "Acesso negado - você não tem permissão para acessar roteiros bancários" });
    }
    next();
  }

  // Get all active roteiros
  app.get("/api/roteiros", requireAuth, requireRoteirosAccess, async (req, res) => {
    try {
      const roteiros = await storage.getActiveRoteiros();
      return res.json(roteiros);
    } catch (error) {
      console.error("Get roteiros error:", error);
      return res.status(500).json({ message: "Erro ao buscar roteiros bancários" });
    }
  });

  // Helper function to generate contextual suggestions for next queries
  const generateSuggestions = (
    topicos: string[], 
    filters: { convenio: string | null; tipo_operacao: string | null; idade: number | null }, 
    moduloId: string
  ): string[] => {
    const sugestoes: string[] = [];

    // Base suggestions based on topics
    const suggestionMap: Record<string, string[]> = {
      "idade": [
        filters.convenio ? `Qual o limite de parcela para ${filters.idade || "essa"} idade no ${filters.convenio}?` : "Qual o limite de parcela para essa idade?",
        "Quais bancos têm o maior prazo?",
      ],
      "convenio": [
        `Quais operações são permitidas no ${filters.convenio || "convênio"}?`,
        `Algum banco tem regra especial para ${filters.convenio || "este convênio"}?`,
        "Há limite de idade?",
      ],
      "operacao": [
        "Quanto libera em média?",
        "Pode fazer compra de dívida junto?",
        "Quais bancos aceitam essa operação?",
      ],
      "portal": [
        "Como acessar o portal oficial?",
        "Onde consultar margem?",
        "Como gerar autorização?",
      ],
      "documentacao": [
        "Posso enviar documentos digitalizados?",
        "Quais documentos são obrigatórios?",
      ],
    };

    // Add suggestions based on topics
    for (const topico of topicos) {
      const topicoSugestoes = suggestionMap[topico.toLowerCase()] || [];
      sugestoes.push(...topicoSugestoes);
    }

    // Add module-specific suggestions
    switch (moduloId) {
      case "modulo_1":
        if (!filters.convenio) sugestoes.push("Me diga o convênio: GOV SP, SIAPE, INSS...");
        if (!filters.tipo_operacao) sugestoes.push("Qual tipo de operação você precisa?");
        break;
      case "modulo_2":
        sugestoes.push("Quais bancos ainda atendem esse perfil?");
        break;
      case "modulo_4":
        sugestoes.push("Como faço para enviar os documentos?");
        break;
      case "modulo_7":
        sugestoes.push("Qual a melhor operação para esse convênio?");
        break;
    }

    // Limit to 3 unique suggestions
    const uniqueSugestoes = [...new Set(sugestoes)];
    return uniqueSugestoes.slice(0, 3);
  };

  // AI-powered intelligent search for roteiros (MUST be before :id route)
  app.get("/api/roteiros/ia-search", requireAuth, requireRoteirosAccess, async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== "string" || q.trim() === "") {
        return res.status(400).json({ message: "Consulta não pode estar vazia" });
      }

      // Use shared OpenAI client (Replit AI Integrations)
      const { openai } = await import("./openaiClient");

      // System prompt for AI query interpreter with module detection
      const systemPrompt = `Você é um interpretador de consultas para um sistema de ROTEIROS BANCÁRIOS de crédito consignado.

Receberá uma frase digitada pelo usuário e precisa:
1) Extrair filtros de busca
2) Detectar qual MÓDULO de resposta ativar
3) Sugerir tópicos para próximas perguntas

MÓDULOS DISPONÍVEIS (detecte baseado na consulta):
- modulo_1: "comparacao_bancos" - Ativa quando: consulta só com idade, ou "quais bancos", ou "comparar bancos", ou busca genérica por perfil
- modulo_2: "explicacao_regras" - Ativa quando: "por que", "motivo", "não atende", "por qual razão", "explique"
- modulo_3: "melhor_operacao" - Ativa quando: "qual operação", "melhor operação", "o que é melhor", "crédito novo ou refin"
- modulo_4: "documentacao" - Ativa quando: "documentação", "docs", "documentos", "quais documentos"
- modulo_5: "fluxo_operacional" - Ativa quando: "como faz", "fluxo", "passo a passo", "como fazer operação"
- modulo_6: "detectar_inconsistencias" - Sempre verificar automaticamente se roteiros encontrados estão incompletos
- modulo_7: "resumo_geral" - Ativa quando: "resumo", "o que posso fazer", "quais operações", "visão geral"

Responda SEMPRE e SOMENTE com um JSON válido no seguinte formato:

{
  "convenio": null,
  "segmento": null,
  "tipo_operacao": null,
  "idade": null,
  "palavras_chave": [],
  "modulo": {
    "id": "modulo_1",
    "label": "Comparação entre bancos",
    "confidence": 0.8
  },
  "sugestoes_topicos": []
}

REGRAS DE FILTROS:

1) "convenio":
   - "gov sp" / "governo de são paulo" / "spprev" -> "GOV SP"
   - "siape" / "governo federal" / "federal" -> "SIAPE" ou "Governo Federal"
   - "inss" / "aposentado" -> "INSS"
   - Se não fique claro, use null

2) "segmento":
   - Use se houver indicação clara
   - Caso contrário, null

3) "tipo_operacao" (sempre snake_case minúsculas):
   - "credito_novo" | "refin" | "compra_divida" | "compra_cartao_beneficio" | "cartao_beneficio" | "cartao_consignado"
   - Se não possível saber, null

4) "idade":
   - Número que pareça idade (ex.: 60, 71, 74)
   - Se não houver, null

5) "palavras_chave":
   - Termos relevantes em minúsculas: "portal", "margem", "limite", "parcela", "averbacao", etc.

REGRAS DE DETECÇÃO DE MÓDULO:

6) "modulo":
   - id: um dos valores modulo_1 a modulo_7
   - label: descrição curta do módulo
   - confidence: 0.0 a 1.0 (quão certo você está)
   
   Prioridade de detecção:
   a) Se tem "por que", "motivo", "não atende" -> modulo_2 (explicacao_regras)
   b) Se tem "documentação", "docs", "documentos" -> modulo_4 (documentacao)
   c) Se tem "como faz", "fluxo", "passo a passo" -> modulo_5 (fluxo_operacional)
   d) Se tem "qual operação", "melhor operação", "crédito novo ou refin" -> modulo_3 (melhor_operacao)
   e) Se tem "resumo", "o que posso", "quais operações" -> modulo_7 (resumo_geral)
   f) Se tem só idade ou "quais bancos" ou busca genérica -> modulo_1 (comparacao_bancos)
   g) Se nenhum acima e há filtros -> modulo_1 (comparacao_bancos) como fallback

7) "sugestoes_topicos" (para UI sugerir próximas perguntas):
   - Se detectou idade: adicionar "idade"
   - Se detectou convênio: adicionar "convenio"
   - Se detectou tipo_operacao: adicionar "operacao"
   - Se mencionou portal: adicionar "portal"
   - Se é documentação: adicionar "documentacao"
   - Máximo 3 tópicos

FORMATO:
- Devolva APENAS o JSON, sem texto antes ou depois
- Não explique o que fez
- Não coloque comentários`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: q.trim() }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(502).json({ message: "Erro ao interpretar consulta - resposta vazia da IA" });
      }

      // Schema for validating AI response with module detection
      const moduloSchema = z.object({
        id: z.string().default("modulo_1"),
        label: z.string().default("Comparação entre bancos"),
        confidence: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0.5)]).default(0.5),
      });

      const defaultModulo = { id: "modulo_1", label: "Comparação entre bancos", confidence: 0.5 };

      const aiResponseSchema = z.object({
        convenio: z.string().nullable().optional().default(null),
        segmento: z.string().nullable().optional().default(null),
        tipo_operacao: z.string().nullable().optional().default(null),
        idade: z.union([z.number(), z.string().transform(v => parseInt(v) || null)]).nullable().optional().default(null),
        palavras_chave: z.array(z.string()).optional().default([]),
        modulo: moduloSchema.optional().default(defaultModulo),
        sugestoes_topicos: z.array(z.string()).optional().default([]),
      }).passthrough();

      let parsedContent: unknown;
      try {
        parsedContent = JSON.parse(content);
      } catch {
        console.error("AI response parse error:", content);
        return res.status(502).json({ message: "Erro ao interpretar resposta da IA - JSON inválido" });
      }

      const validationResult = aiResponseSchema.safeParse(parsedContent);
      if (!validationResult.success) {
        console.error("AI response validation error:", validationResult.error, "Content:", parsedContent);
        return res.status(502).json({ message: "Erro ao interpretar resposta da IA - formato inválido" });
      }

      const filters = {
        convenio: validationResult.data.convenio || null,
        segmento: validationResult.data.segmento || null,
        tipo_operacao: validationResult.data.tipo_operacao || null,
        idade: validationResult.data.idade ?? null,
        palavras_chave: validationResult.data.palavras_chave || [],
      };

      // Ensure robust module fallback
      const defaultModuloFallback = { id: "modulo_1", label: "Comparação entre bancos", confidence: 0.5 };
      const rawModulo = validationResult.data.modulo;
      const modulo = (rawModulo && rawModulo.id) ? rawModulo : defaultModuloFallback;
      
      // Normalize suggestion topics to lowercase
      const sugestoes_topicos = (validationResult.data.sugestoes_topicos || [])
        .map((t: string) => t.toLowerCase().trim())
        .filter((t: string) => t.length > 0);

      // Search roteiros with interpreted filters
      const roteiros = await storage.searchRoteirosIA({
        convenio: filters.convenio,
        segmento: filters.segmento,
        tipoOperacao: filters.tipo_operacao,
        idade: filters.idade,
        palavrasChave: filters.palavras_chave || [],
      });

      // Return results with resumo for each roteiro
      const results = roteiros.map(roteiro => {
        const dados = roteiro.dados as any;
        return {
          id: roteiro.id,
          banco: roteiro.banco,
          convenio: roteiro.convenio,
          segmento: roteiro.segmento,
          tipo_operacao: roteiro.tipoOperacao,
          updated_at: roteiro.updatedAt,
          resumo: {
            publico_alvo: (dados.publico_alvo || []).slice(0, 3),
            faixas_idade: (dados.faixas_idade || []).slice(0, 2),
            portais: (dados.portais_acesso || []).slice(0, 2).map((p: any) => p.nome_portal || "Portal"),
          }
        };
      });

      // Generate module-specific response prompt
      const getRespondentePrompt = (moduloId: string) => {
        const basePrompt = `Você é um especialista em crédito consignado que responde de forma CLARA, DIRETA e HUMANA sobre roteiros bancários.

Você receberá:
1) A consulta original do usuário (texto livre).
2) Uma lista de roteiros bancários em JSON, com campos como banco, convenio, segmento, tipo_operacao e dados.

Estilo da resposta:
- Frases curtas, objetivas.
- Tom de consultor humano e amigável.
- Máximo de 3-4 parágrafos curtos.
- Nunca invente informações que não estejam nos dados.
- Nunca devolva JSON, apenas texto em português.

`;

        const modulePrompts: Record<string, string> = {
          "modulo_1": basePrompt + `MÓDULO: COMPARAÇÃO ENTRE BANCOS

Sua missão: Comparar os bancos disponíveis para o perfil do cliente.

O que incluir na resposta:
- Liste os bancos que atendem o perfil (ex.: "Para esse perfil, os bancos NEO, BMG e PAN atendem.")
- Compare brevemente: qual libera maior parcela, qual tem menos documentação, qual tem prazo mais alto
- Se só tiver idade, peça o convênio para refinar a busca
- Destaque diferenças relevantes entre os bancos

Exemplo:
"Para 60 anos no SIAPE, encontrei 3 bancos disponíveis: NEO, BMG e PAN. O NEO libera maior parcela, o BMG exige menos documentos e o PAN oferece o maior prazo. Me conta mais sobre o valor que você precisa para eu indicar o melhor."`,

          "modulo_2": basePrompt + `MÓDULO: EXPLICAÇÃO DE REGRAS ESPECÍFICAS

Sua missão: Explicar por que algo não atende ou quais são as regras específicas.

O que incluir na resposta:
- Explique a regra encontrada nos roteiros de forma clara
- Se houver limite de idade, explique exatamente qual é
- Se houver limite de parcela, mencione o valor
- Se houver restrição de público, liste quem não é atendido
- Se a informação não existir nos roteiros, diga claramente: "Não encontrei essa regra específica nos roteiros disponíveis."

Exemplo:
"No GOV SP, acima de 71 anos e 10 meses o limite de parcela cai para R$ 1.600,00 e muitos bancos não aceitam. Por isso esse perfil tem menos opções. Verifiquei aqui que apenas o banco X ainda atende, com algumas restrições."`,

          "modulo_3": basePrompt + `MÓDULO: QUAL OPERAÇÃO É MELHOR (RECOMENDAÇÃO)

Sua missão: Recomendar qual tipo de operação é mais vantajoso para o perfil.

O que incluir na resposta:
- Compare as operações disponíveis (crédito novo, refin, cartão benefício, etc.)
- Considere: prazo, margem, idade, limites
- Recomende a operação mais vantajosa com justificativa
- Se faltar informação, peça mais detalhes sobre o objetivo do cliente

Exemplo:
"Para SIAPE com 60 anos, entre crédito novo e refin, o refin costuma liberar mais valor porque mantém o prazo original do contrato. Mas se você não tem contrato ativo, crédito novo é o caminho. Me conta: você já tem algum contrato de consignado?"`,

          "modulo_4": basePrompt + `MÓDULO: CHECKLIST DE DOCUMENTAÇÃO

Sua missão: Listar os documentos necessários para a operação.

O que incluir na resposta:
- Liste os documentos encontrados nos roteiros (campo documentacao_necessaria)
- Organize em formato de lista simples
- Mencione se há documentos específicos por banco
- Se não encontrar documentação nos roteiros, diga: "Não encontrei a lista de documentos nos roteiros. Recomendo consultar diretamente o banco."

Exemplo:
"Para SIAPE refin, os documentos necessários são:
• RG ou CNH (frente e verso)
• Contracheque atualizado (últimos 3 meses)
• Extrato de consignações
• Termo digital de autorização"`,

          "modulo_5": basePrompt + `MÓDULO: PASSO A PASSO / FLUXO OPERACIONAL

Sua missão: Explicar o fluxo da operação passo a passo.

O que incluir na resposta:
- Descreva as etapas do fluxo operacional
- Inclua: acesso ao portal, consulta de margem, geração de autorização, envio de docs, averbação
- Use numeração para facilitar o entendimento
- Mencione os portais de acesso se disponíveis nos roteiros

Exemplo:
"Para fazer a operação SIAPE cartão benefício:
1. Acesse o portal SiapeNet
2. Consulte a margem disponível do cliente
3. Gere a autorização digital
4. Anexe os documentos necessários
5. Envie para averbação
O prazo médio de liberação é de 3 a 5 dias úteis."`,

          "modulo_6": basePrompt + `MÓDULO: DETECÇÃO DE INCONSISTÊNCIAS

Sua missão: Identificar se os roteiros estão incompletos ou faltam informações importantes.

O que incluir na resposta:
- Verifique se os roteiros têm todas as informações necessárias
- Liste quais campos estão faltando (ex.: sem faixas de idade, sem documentação, sem portais)
- Sugira que o usuário revise o PDF original do banco
- Seja construtivo, não apenas crítico

Exemplo:
"Encontrei algumas inconsistências nos roteiros:
• O roteiro do banco X não tem regras de prazo definidas
• O roteiro do banco Y não lista os documentos necessários
• Não há informação sobre portais de acesso
Recomendo revisar os PDFs originais desses bancos para completar as informações."`,

          "modulo_7": basePrompt + `MÓDULO: RESUMO GERAL DO CONVÊNIO/BANCO

Sua missão: Dar uma visão completa do que é possível fazer no convênio ou banco.

O que incluir na resposta:
- Quem é atendido (público-alvo)
- Quem não é atendido
- Tipos de operação disponíveis
- Limites por idade (se houver)
- Documentos necessários (resumo)
- Portais oficiais

Exemplo:
"Para o convênio GOV SP, veja o resumo:
• Público atendido: Servidores ativos e aposentados do Estado de SP
• Não atendidos: Pensionistas menores, servidores em estágio probatório
• Operações: Crédito novo, refin, cartão benefício
• Limite de idade: Até 71 anos parcela normal, acima de 71 limite de R$ 1.600
• Portal: SPPREV (spprev.sp.gov.br)"`
        };

        return modulePrompts[moduloId] || modulePrompts["modulo_1"];
      };

      const respondentePrompt = getRespondentePrompt(modulo.id);

      let respostaHumana = "";
      try {
        // Prepare roteiros data for AI (simplified version with key info)
        const roteirosParaIA = roteiros.slice(0, 5).map(r => {
          const dados = r.dados as any;
          return {
            banco: r.banco,
            convenio: r.convenio,
            segmento: r.segmento,
            tipo_operacao: r.tipoOperacao,
            faixas_idade: dados.faixas_idade || [],
            publico_alvo: dados.publico_alvo || [],
            limite_parcela: dados.limite_parcela,
            margem: dados.margem,
            prazos: dados.prazos || [],
          };
        });

        const humanResponse = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: respondentePrompt },
            { 
              role: "user", 
              content: `Consulta do usuário: "${q.trim()}"

Filtros interpretados: ${JSON.stringify(filters, null, 2)}

Roteiros encontrados (${roteiros.length} total, mostrando até 5):
${JSON.stringify(roteirosParaIA, null, 2)}`
            }
          ],
          max_completion_tokens: 800,
        });

        respostaHumana = humanResponse.choices[0]?.message?.content || "";
      } catch (humanError) {
        console.error("Error generating human response:", humanError);
        // Continue without human response if it fails
        respostaHumana = "";
      }

      // Generate suggestions based on topics and context
      const sugestoes = generateSuggestions(sugestoes_topicos, filters, modulo.id);

      return res.json({
        query: q,
        filters_interpreted: filters,
        modulo: modulo,
        results,
        total: results.length,
        resposta: respostaHumana,
        sugestoes,
      });
    } catch (error: any) {
      console.error("AI search error:", error);
      
      // Handle specific OpenAI errors
      if (error?.message?.includes("429") || error?.message?.includes("rate limit")) {
        return res.status(429).json({ message: "Serviço de IA temporariamente indisponível. Tente novamente em alguns segundos." });
      }
      if (error?.message?.includes("timeout")) {
        return res.status(504).json({ message: "Tempo limite excedido ao consultar IA. Tente novamente." });
      }
      
      return res.status(500).json({ message: "Erro ao processar pesquisa inteligente" });
    }
  });

  // Get single roteiro by ID
  app.get("/api/roteiros/:id", requireAuth, requireRoteirosAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const roteiro = await storage.getRoteiro(id);
      if (!roteiro) {
        return res.status(404).json({ message: "Roteiro não encontrado" });
      }
      
      return res.json(roteiro);
    } catch (error) {
      console.error("Get roteiro error:", error);
      return res.status(500).json({ message: "Erro ao buscar roteiro" });
    }
  });

  // Search roteiros with filters
  app.get("/api/roteiros/search", requireAuth, requireRoteirosAccess, async (req, res) => {
    try {
      const { convenio, tipoOperacao, idade } = req.query;
      
      const idadeNum = idade ? parseInt(idade as string) : undefined;
      
      const roteiros = await storage.searchRoteiros(
        convenio as string | undefined,
        tipoOperacao as string | undefined,
        idadeNum
      );
      
      return res.json(roteiros);
    } catch (error) {
      console.error("Search roteiros error:", error);
      return res.status(500).json({ message: "Erro ao pesquisar roteiros" });
    }
  });

  // Get distinct convenios for filter
  app.get("/api/roteiros/filters/convenios", requireAuth, requireRoteirosAccess, async (req, res) => {
    try {
      const convenios = await storage.getDistinctConvenios();
      return res.json(convenios);
    } catch (error) {
      console.error("Get convenios error:", error);
      return res.status(500).json({ message: "Erro ao buscar convênios" });
    }
  });

  // Get distinct tipos de operacao for filter
  app.get("/api/roteiros/filters/tipos-operacao", requireAuth, requireRoteirosAccess, async (req, res) => {
    try {
      const tipos = await storage.getDistinctTiposOperacao();
      return res.json(tipos);
    } catch (error) {
      console.error("Get tipos operacao error:", error);
      return res.status(500).json({ message: "Erro ao buscar tipos de operação" });
    }
  });

  // Import roteiros from JSON
  app.post("/api/roteiros/importar-json", requireAuth, requireRoteirosAccess, async (req, res) => {
    try {
      const result = roteirosImportSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "JSON inválido",
          errors: result.error.errors,
        });
      }

      const importResult = await storage.importRoteiros(result.data.roteiros);
      
      return res.json({
        message: `Importação concluída: ${importResult.created} roteiro(s) criado(s)`,
        created: importResult.created,
        combos: importResult.combos,
      });
    } catch (error) {
      console.error("Import roteiros error:", error);
      return res.status(500).json({ message: "Erro ao importar roteiros" });
    }
  });

  // Update roteiro metadata (banco, convenio, segmento, tipo_operacao)
  const updateRoteiroSchema = z.object({
    banco: z.string().min(1).optional(),
    convenio: z.string().min(1).optional(),
    segmento: z.union([z.string(), z.null()]).optional(),
    tipo_operacao: z.enum([
      "credito_novo",
      "refin",
      "compra_divida",
      "compra_cartao_beneficio",
      "cartao_beneficio",
      "cartao_consignado",
      "nao_especificado",
      "Não especificado"
    ]).optional(),
  }).refine(
    (data) => data.banco || data.convenio || data.segmento !== undefined || data.tipo_operacao,
    { message: "Pelo menos um campo deve ser fornecido para atualização" }
  );

  app.put("/api/roteiros/:id", requireAuth, requireRoteirosAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const existingRoteiro = await storage.getRoteiro(id);
      if (!existingRoteiro) {
        return res.status(404).json({ message: "Roteiro não encontrado" });
      }

      const result = updateRoteiroSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const updateData: { banco?: string; convenio?: string; segmento?: string | null; tipoOperacao?: string } = {};
      if (result.data.banco) updateData.banco = result.data.banco;
      if (result.data.convenio) updateData.convenio = result.data.convenio;
      if (result.data.segmento !== undefined) updateData.segmento = result.data.segmento;
      if (result.data.tipo_operacao) updateData.tipoOperacao = result.data.tipo_operacao;

      const updated = await storage.updateRoteiroMetadata(id, updateData);
      
      if (!updated) {
        return res.status(500).json({ message: "Erro ao atualizar roteiro" });
      }

      // Return response in snake_case to match frontend expectations
      return res.json({
        id: updated.id,
        banco: updated.banco,
        convenio: updated.convenio,
        segmento: updated.segmento,
        tipo_operacao: updated.tipoOperacao,
        dados: updated.dados,
        updated_at: updated.updatedAt,
      });
    } catch (error) {
      console.error("Update roteiro error:", error);
      return res.status(500).json({ message: "Erro ao atualizar roteiro" });
    }
  });

  // Delete roteiro (only master, atendimento, operacional can delete)
  app.delete("/api/roteiros/:id", requireAuth, requireRoteirosAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const existingRoteiro = await storage.getRoteiro(id);
      if (!existingRoteiro) {
        return res.status(404).json({ message: "Roteiro não encontrado" });
      }

      await storage.deleteRoteiro(id);
      
      return res.json({ message: "Roteiro excluído com sucesso" });
    } catch (error) {
      console.error("Delete roteiro error:", error);
      return res.status(500).json({ message: "Erro ao excluir roteiro" });
    }
  });

  // ===== BASE DE CLIENTES ROUTES =====

  // Mapping SIAPE columns to database fields
  const SIAPE_COLUMN_MAP: Record<string, string> = {
    // Pessoa
    "CPF": "cpf",
    "MATRICULA": "matricula",
    "NOME": "nome",
    "ORGAODESC": "orgaodesc",
    "ORGAO_DESC": "orgaodesc",
    "ORGAOCOD": "orgaocod",
    "ORGAO_COD": "orgaocod",
    "UNDPAGADORADESC": "undpagadoradesc",
    "UND_PAGADORA_DESC": "undpagadoradesc",
    "UNDPAGADORACOD": "undpagadoracod",
    "UND_PAGADORA_COD": "undpagadoracod",
    "NATUREZA": "natureza",
    "SITUACAO_FUNCIONAL": "sit_func",
    "SIT_FUNC": "sit_func",
    "SIT FUNC": "sit_func",
    "CONVENIO": "convenio",
    "UF": "uf",
    "MUNICIPIO": "municipio",
    // Margens
    "BRUTA 30%": "margem_bruta_30",
    "UTILZ 30%": "margem_utilizada_30",
    "SALDO 30%": "margem_saldo_30",
    "BRUTA 35%": "margem_bruta_35",
    "UTILZ 35%": "margem_utilizada_35",
    "SALDO 35%": "margem_saldo_35",
    "BRUTA 70%": "margem_bruta_70",
    "UTILZ 70%": "margem_utilizada_70",
    "SALDO 70%": "margem_saldo_70",
    "MARGEM CARTAO CREDITO SALDO": "margem_cartao_credito_saldo",
    "MARGEM CARTAO CREDITO": "margem_cartao_credito_saldo",
    "SALDO CARTAO CREDITO": "margem_cartao_credito_saldo",
    "MARGEM 5% CREDITO": "margem_cartao_credito_saldo",
    "MARGEM CARTAO BENEFICIO SALDO": "margem_cartao_beneficio_saldo",
    "MARGEM CARTAO BENEFICIO": "margem_cartao_beneficio_saldo",
    "SALDO CARTAO BENEFICIO": "margem_cartao_beneficio_saldo",
    "MARGEM 5% BENEFICIO": "margem_cartao_beneficio_saldo",
    "CREDITOS": "creditos",
    "CRÉDITOS": "creditos",
    "DEBITOS": "debitos",
    "DÉBITOS": "debitos",
    "LIQUIDO": "liquido",
    "LÍQUIDO": "liquido",
    // Telefones
    "TELEFONE 1": "telefone_1",
    "TELEFONE 2": "telefone_2",
    "TELEFONE 3": "telefone_3",
    "TELEFONE 4": "telefone_4",
    "TELEFONE 5": "telefone_5",
    // Contrato
    "BANCO": "banco",
    "VALOR_PARCELA": "valor_parcela",
    "VALOR PARCELA": "valor_parcela",
  };

  // Normalize column name for matching
  function normalizeColumnName(col: string): string {
    return col.toUpperCase().trim().replace(/\s+/g, " ");
  }

  // Parse decimal value from string
  function parseDecimal(value: any): string | null {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value).replace(/[^\d,.-]/g, "").replace(",", ".");
    const num = parseFloat(str);
    return isNaN(num) ? null : num.toFixed(2);
  }

  // Process import job asynchronously
  async function processImportJob(
    baseId: number,
    data: any[],
    convenio: string,
    competencia: Date,
    baseTag: string
  ) {
    let totalLinhas = 0;
    
    try {
      // Get header mapping
      const headers = data[0] ? Object.keys(data[0]) : [];
      const headerMap: Record<string, string> = {};
      
      for (const header of headers) {
        const normalized = normalizeColumnName(header);
        if (SIAPE_COLUMN_MAP[normalized]) {
          headerMap[header] = SIAPE_COLUMN_MAP[normalized];
        }
      }

      // Process each row
      for (const row of data) {
        try {
          // Extract matricula (required)
          let matricula: string | null = null;
          for (const [col, field] of Object.entries(headerMap)) {
            if (field === "matricula") {
              matricula = String(row[col] || "").trim();
              break;
            }
          }
          
          if (!matricula) continue; // Skip rows without matricula
          
          // Build pessoa data
          const pessoaData: Record<string, any> = {
            matricula,
            convenio,
            baseTagUltima: baseTag,
          };
          
          // Build folha data
          const folhaData: Record<string, any> = {
            competencia,
            baseTag,
          };
          
          // Build telefones array
          const telefones: string[] = [];
          
          // Build extras
          const extrasPessoa: Record<string, any> = {};
          const extrasFolha: Record<string, any> = {};
          
          // Map row values to data structures
          for (const [col, value] of Object.entries(row)) {
            const field = headerMap[col];
            
            if (field) {
              // Pessoa fields
              if (["cpf", "nome", "orgaodesc", "orgaocod", "undpagadoradesc", "undpagadoracod", "natureza", "sit_func", "uf", "municipio"].includes(field)) {
                pessoaData[field === "sit_func" ? "sitFunc" : field] = String(value || "").trim() || null;
              }
              // Folha fields (margens)
              else if (field.startsWith("margem_") || ["creditos", "debitos", "liquido"].includes(field)) {
                const dbField = field.replace(/_/g, "").replace("margem", "margem");
                const camelField = field.split("_").map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join("");
                folhaData[camelField] = parseDecimal(value);
              }
              // Telefones
              else if (field.startsWith("telefone_")) {
                const tel = String(value || "").trim();
                if (tel) telefones.push(tel);
              }
            } else {
              // Extra fields
              extrasPessoa[col] = value;
            }
          }
          
          pessoaData.telefonesBase = telefones;
          pessoaData.extrasPessoa = extrasPessoa;
          folhaData.extrasFolha = extrasFolha;
          
          // Upsert pessoa (find by matricula, create or update)
          let pessoa = await storage.getClientePessoaByMatricula(matricula);
          
          if (pessoa) {
            // Update existing
            pessoa = await storage.updateClientePessoa(pessoa.id, pessoaData as any);
          } else {
            // Create new
            pessoa = await storage.createClientePessoa(pessoaData as any);
          }
          
          if (pessoa) {
            // Create folha record
            await storage.createClienteFolhaMes({
              pessoaId: pessoa.id,
              competencia,
              margemBruta30: folhaData.margemBruta30,
              margemUtilizada30: folhaData.margemUtilizada30,
              margemSaldo30: folhaData.margemSaldo30,
              margemBruta35: folhaData.margemBruta35,
              margemUtilizada35: folhaData.margemUtilizada35,
              margemSaldo35: folhaData.margemSaldo35,
              margemBruta70: folhaData.margemBruta70,
              margemUtilizada70: folhaData.margemUtilizada70,
              margemSaldo70: folhaData.margemSaldo70,
              creditos: folhaData.creditos,
              debitos: folhaData.debitos,
              liquido: folhaData.liquido,
              sitFuncNoMes: pessoaData.sitFunc || null,
              baseTag,
              extrasFolha: folhaData.extrasFolha,
            } as any);
            
            // Create contrato record (each row is a contract)
            let banco: string | null = null;
            let valorParcela: string | null = null;
            
            for (const [col, field] of Object.entries(headerMap)) {
              if (field === "banco") banco = String(row[col] || "").trim() || null;
              if (field === "valor_parcela") valorParcela = parseDecimal(row[col]);
            }
            
            await storage.createClienteContrato({
              pessoaId: pessoa.id,
              tipoContrato: "desconhecido",
              banco,
              valorParcela,
              competencia,
              baseTag,
              dadosBrutos: row,
            } as any);
            
            totalLinhas++;
          }
        } catch (rowError) {
          console.error("[Import] Row error:", rowError);
        }
      }
      
      // Update base status
      await storage.updateBaseImportada(baseId, {
        totalLinhas,
        status: "concluida",
      });
      
      console.log(`[Import] Base ${baseId} completed with ${totalLinhas} rows`);
    } catch (error) {
      console.error("[Import] Job error:", error);
      await storage.updateBaseImportada(baseId, {
        status: "erro",
      });
    }
  }

  // GET bases importadas - Master only
  app.get("/api/bases", requireAuth, requireMaster, async (req, res) => {
    try {
      const bases = await storage.getAllBasesImportadas();
      return res.json(bases);
    } catch (error) {
      console.error("Get bases error:", error);
      return res.status(500).json({ message: "Erro ao buscar bases" });
    }
  });

  // POST importar base - Master only (Multipart upload for large files)
  app.post("/api/bases/importar", requireAuth, requireMaster, (req, res, next) => {
    // Wrap multer to handle file size errors gracefully
    upload.single("arquivo")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ 
            message: "O arquivo excede o limite de tamanho permitido (máximo 800MB)" 
          });
        }
        return res.status(400).json({ message: err.message || "Erro no upload do arquivo" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const file = req.file;
      const { convenio, competencia, nome_base } = req.body;
      
      if (!file || !convenio || !competencia) {
        // Clean up file if exists
        if (file) fs.unlinkSync(file.path);
        return res.status(400).json({ 
          message: "Arquivo, convênio e competência são obrigatórios" 
        });
      }

      // Check if there's already a base being processed
      const existingProcessing = await storage.getBaseByStatus("processando");
      if (existingProcessing) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        return res.status(409).json({ 
          message: "Já existe uma base em processamento. Aguarde a conclusão antes de iniciar uma nova importação." 
        });
      }

      console.log(`[Import] Received file: ${file.originalname}, size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

      // Parse competencia to date (format: YYYY-MM)
      const [year, month] = competencia.split("-");
      const competenciaDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      
      // Generate base tag
      const baseTag = `${convenio.toUpperCase().replace(/\s+/g, "_")}_${competencia}`;
      
      // Create base record with status "processando"
      const base = await storage.createBaseImportada({
        nome: nome_base || `Importação ${convenio} - ${competencia}`,
        baseTag,
        convenio,
        competencia: competenciaDate,
        status: "processando",
      });
      
      // Start async streaming processing (fire-and-forget with error handling)
      processStreamingImportJob(base.id, file.path, convenio, competenciaDate, baseTag).catch(async (err) => {
        console.error("[Import] Unhandled error in streaming job:", err);
        try {
          await storage.updateBaseImportada(base.id, { status: "erro" });
        } catch (e) {
          console.error("[Import] Failed to update base status on error:", e);
        }
      });
      
      return res.json({
        message: "Importação iniciada",
        baseId: base.id,
        baseTag,
        fileName: file.originalname,
        fileSize: file.size,
      });
    } catch (error) {
      console.error("Import error:", error);
      // Clean up file on error
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(500).json({ message: "Erro ao importar base" });
    }
  });

  // Streaming import processor for large files
  async function processStreamingImportJob(
    baseId: number,
    filePath: string,
    convenio: string,
    competencia: Date,
    baseTag: string
  ) {
    let totalLinhas = 0;
    let processedRows = 0;
    
    try {
      console.log(`[Import] Starting streaming import for base ${baseId}`);
      
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === ".csv") {
        // Use XLSX for CSV (still in-memory but CSVs are smaller)
        const workbook = XLSX.readFile(filePath);
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        // Process with existing function
        await processImportJob(baseId, data, convenio, competencia, baseTag);
      } else {
        // Use ExcelJS streaming for Excel files
        const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
          sharedStrings: "cache",
          hyperlinks: "ignore",
          worksheets: "emit",
          styles: "ignore",
        });
        
        let headers: string[] = [];
        let headerMap: Record<string, string> = {};
        let isFirstRow = true;
        
        for await (const worksheetReader of workbookReader) {
          console.log(`[Import] Processing worksheet: ${(worksheetReader as any).name || "Sheet"}`);
          
          for await (const row of worksheetReader) {
            if (isFirstRow) {
              // First row contains headers
              const rowValues = (row.values as any[]) || [];
              headers = rowValues.slice(1).map((v: any) => String(v || ""));
              
              for (const header of headers) {
                const normalized = normalizeColumnName(header);
                if (SIAPE_COLUMN_MAP[normalized]) {
                  headerMap[header] = SIAPE_COLUMN_MAP[normalized];
                }
              }
              
              isFirstRow = false;
              continue;
            }
            
            try {
              // Get row values (skip first element as it's undefined)
              const rowValues = (row.values as any[]) || [];
              const values = rowValues.slice(1);
              
              // Build row object
              const rowData: Record<string, any> = {};
              headers.forEach((header, index) => {
                rowData[header] = values[index];
              });
              
              // Extract matricula (required)
              let matricula: string | null = null;
              for (const [col, field] of Object.entries(headerMap)) {
                if (field === "matricula") {
                  matricula = String(rowData[col] || "").trim();
                  break;
                }
              }
              
              if (!matricula) continue; // Skip rows without matricula
              
              // Build pessoa data
              const pessoaData: Record<string, any> = {
                matricula,
                convenio,
                baseTagUltima: baseTag,
              };
              
              // Build folha data
              const folhaData: Record<string, any> = {
                competencia,
                baseTag,
              };
              
              // Build telefones array
              const telefones: string[] = [];
              const extrasPessoa: Record<string, any> = {};
              const extrasFolha: Record<string, any> = {};
              
              // Map row values to data structures
              for (const [col, value] of Object.entries(rowData)) {
                const field = headerMap[col];
                
                if (field) {
                  // Pessoa fields
                  if (["cpf", "nome", "orgaodesc", "orgaocod", "undpagadoradesc", "undpagadoracod", "natureza", "sit_func", "uf", "municipio"].includes(field)) {
                    pessoaData[field === "sit_func" ? "sitFunc" : field] = String(value || "").trim() || null;
                  }
                  // Folha fields (margens)
                  else if (field.startsWith("margem_") || ["creditos", "debitos", "liquido"].includes(field)) {
                    const camelField = field.split("_").map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join("");
                    folhaData[camelField] = parseDecimal(value);
                  }
                  // Telefones
                  else if (field.startsWith("telefone_")) {
                    const tel = String(value || "").trim();
                    if (tel) telefones.push(tel);
                  }
                } else {
                  extrasPessoa[col] = value;
                }
              }
              
              pessoaData.telefonesBase = telefones;
              pessoaData.extrasPessoa = extrasPessoa;
              folhaData.extrasFolha = extrasFolha;
              
              // Upsert pessoa
              let pessoa = await storage.getClientePessoaByMatricula(matricula);
              
              if (pessoa) {
                pessoa = await storage.updateClientePessoa(pessoa.id, pessoaData as any);
              } else {
                pessoa = await storage.createClientePessoa(pessoaData as any);
              }
              
              if (pessoa) {
                // Create folha record
                await storage.createClienteFolhaMes({
                  pessoaId: pessoa.id,
                  competencia,
                  margemBruta30: folhaData.margemBruta30,
                  margemUtilizada30: folhaData.margemUtilizada30,
                  margemSaldo30: folhaData.margemSaldo30,
                  margemBruta35: folhaData.margemBruta35,
                  margemUtilizada35: folhaData.margemUtilizada35,
                  margemSaldo35: folhaData.margemSaldo35,
                  margemBruta70: folhaData.margemBruta70,
                  margemUtilizada70: folhaData.margemUtilizada70,
                  margemSaldo70: folhaData.margemSaldo70,
                  margemCartaoCreditoSaldo: folhaData.margemCartaoCreditoSaldo,
                  margemCartaoBeneficioSaldo: folhaData.margemCartaoBeneficioSaldo,
                  creditos: folhaData.creditos,
                  debitos: folhaData.debitos,
                  liquido: folhaData.liquido,
                  sitFuncNoMes: pessoaData.sitFunc || null,
                  baseTag,
                  extrasFolha: folhaData.extrasFolha,
                } as any);
                
                // Create contrato record
                let banco: string | null = null;
                let valorParcela: string | null = null;
                
                for (const [col, field] of Object.entries(headerMap)) {
                  if (field === "banco") banco = String(rowData[col] || "").trim() || null;
                  if (field === "valor_parcela") valorParcela = parseDecimal(rowData[col]);
                }
                
                await storage.createClienteContrato({
                  pessoaId: pessoa.id,
                  tipoContrato: "desconhecido",
                  banco,
                  valorParcela,
                  competencia,
                  baseTag,
                  dadosBrutos: rowData,
                } as any);
                
                totalLinhas++;
              }
              
              processedRows++;
              
              // Log progress every 1000 rows
              if (processedRows % 1000 === 0) {
                console.log(`[Import] Base ${baseId}: Processed ${processedRows} rows, imported ${totalLinhas}`);
              }
            } catch (rowError) {
              console.error("[Import] Row error:", rowError);
            }
          }
          
          // Only process first worksheet
          break;
        }
      }
      
      // Update base status
      await storage.updateBaseImportada(baseId, {
        totalLinhas,
        status: "concluida",
      });
      
      console.log(`[Import] Base ${baseId} completed with ${totalLinhas} rows`);
    } catch (error) {
      console.error("[Import] Streaming job error:", error);
      await storage.updateBaseImportada(baseId, {
        status: "erro",
      });
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(filePath);
        console.log(`[Import] Cleaned up temp file: ${filePath}`);
      } catch (e) {
        console.error("[Import] Failed to clean up temp file:", e);
      }
    }
  }

  // GET filtros disponíveis para clientes
  app.get("/api/clientes/filtros", requireAuth, async (req, res) => {
    try {
      const convenios = await storage.getDistinctConveniosClientes();
      const orgaos = await storage.getDistinctOrgaosClientes();
      const ufs = await storage.getDistinctUfsClientes();
      
      return res.json({ convenios, orgaos, ufs });
    } catch (error) {
      console.error("Get filtros error:", error);
      return res.status(500).json({ message: "Erro ao buscar filtros" });
    }
  });

  // GET convênios disponíveis para consulta de clientes
  app.get("/api/clientes/filtros/convenios", requireAuth, async (req, res) => {
    try {
      const convenios = await storage.getDistinctConveniosClientes();
      return res.json(convenios);
    } catch (error) {
      console.error("Get convenios error:", error);
      return res.status(500).json({ message: "Erro ao buscar convênios" });
    }
  });

  // GET consulta de cliente por CPF ou matrícula - Todos os usuários autenticados
  app.get("/api/clientes/consulta", requireAuth, async (req, res) => {
    try {
      const { cpf, matricula, convenio } = req.query;
      
      // Validate at least one search parameter is provided
      if (!cpf && !matricula) {
        return res.status(400).json({ 
          message: "Informe CPF ou matrícula para realizar a consulta" 
        });
      }
      
      let tipoBusca: "cpf" | "matricula";
      let termo: string;
      let resultados: any[] = [];
      const convenioFiltro = convenio ? String(convenio).trim() : null;
      
      // Priority: matricula > cpf
      if (matricula) {
        tipoBusca = "matricula";
        termo = String(matricula).trim();
        
        // Use new method that supports convenio filter and returns array
        const clientes = await storage.getClientesByMatricula(termo, convenioFiltro || undefined);
        resultados = clientes.map(cliente => ({
          pessoa_id: cliente.id,
          cpf: cliente.cpf,
          matricula: cliente.matricula,
          nome: cliente.nome,
          convenio: cliente.convenio,
          orgao: cliente.orgaodesc,
          uf: cliente.uf,
          municipio: cliente.municipio,
          sit_func: cliente.sitFunc,
        }));
      } else if (cpf) {
        tipoBusca = "cpf";
        // Clean CPF (remove dots and dashes)
        termo = String(cpf).replace(/\D/g, "");
        
        // Validate CPF has exactly 11 digits
        if (termo.length !== 11) {
          return res.status(400).json({ 
            message: "CPF inválido. O CPF deve ter 11 dígitos." 
          });
        }
        
        // Pass convenio filter if provided
        const clientes = await storage.getClientesByCpf(termo, convenioFiltro || undefined);
        resultados = clientes.map(cliente => ({
          pessoa_id: cliente.id,
          cpf: cliente.cpf,
          matricula: cliente.matricula,
          nome: cliente.nome,
          convenio: cliente.convenio,
          orgao: cliente.orgaodesc,
          uf: cliente.uf,
          municipio: cliente.municipio,
          sit_func: cliente.sitFunc,
        }));
      } else {
        return res.status(400).json({ message: "Parâmetro inválido" });
      }
      
      return res.json({
        tipo_busca: tipoBusca,
        termo,
        convenio_filtro: convenioFiltro,
        resultados,
      });
    } catch (error) {
      console.error("Consulta cliente error:", error);
      return res.status(500).json({ message: "Erro ao consultar cliente" });
    }
  });

  // GET detalhes completos de um cliente - Todos os usuários autenticados
  app.get("/api/clientes/:pessoaId", requireAuth, async (req, res) => {
    try {
      const pessoaId = parseInt(req.params.pessoaId);
      
      if (isNaN(pessoaId)) {
        return res.status(400).json({ message: "ID de pessoa inválido" });
      }
      
      // Get pessoa
      const pessoa = await storage.getClientePessoaById(pessoaId);
      if (!pessoa) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Get folha data (all competencias, ordered by most recent)
      const folhaRegistros = await storage.getFolhaMesByPessoaId(pessoaId);
      
      // Get contratos
      const contratos = await storage.getContratosByPessoaId(pessoaId);
      
      // Build response
      const folhaAtual = folhaRegistros.length > 0 ? folhaRegistros[0] : null;
      const folhaHistorico = folhaRegistros.slice(1, 13); // Last 12 months (excluding current)
      
      return res.json({
        pessoa: {
          id: pessoa.id,
          cpf: pessoa.cpf,
          matricula: pessoa.matricula,
          nome: pessoa.nome,
          convenio: pessoa.convenio,
          orgao: pessoa.orgaodesc,
          orgaocod: pessoa.orgaocod,
          undpagadoradesc: pessoa.undpagadoradesc,
          undpagadoracod: pessoa.undpagadoracod,
          natureza: pessoa.natureza,
          sit_func: pessoa.sitFunc,
          uf: pessoa.uf,
          municipio: pessoa.municipio,
          telefones_base: pessoa.telefonesBase || [],
          base_tag_ultima: pessoa.baseTagUltima,
          extras_pessoa: pessoa.extrasPessoa,
        },
        folha: {
          atual: folhaAtual ? {
            competencia: folhaAtual.competencia,
            margem_bruta_30: folhaAtual.margemBruta30 ? parseFloat(folhaAtual.margemBruta30) : null,
            margem_utilizada_30: folhaAtual.margemUtilizada30 ? parseFloat(folhaAtual.margemUtilizada30) : null,
            margem_saldo_30: folhaAtual.margemSaldo30 ? parseFloat(folhaAtual.margemSaldo30) : null,
            margem_bruta_35: folhaAtual.margemBruta35 ? parseFloat(folhaAtual.margemBruta35) : null,
            margem_utilizada_35: folhaAtual.margemUtilizada35 ? parseFloat(folhaAtual.margemUtilizada35) : null,
            margem_saldo_35: folhaAtual.margemSaldo35 ? parseFloat(folhaAtual.margemSaldo35) : null,
            margem_bruta_70: folhaAtual.margemBruta70 ? parseFloat(folhaAtual.margemBruta70) : null,
            margem_utilizada_70: folhaAtual.margemUtilizada70 ? parseFloat(folhaAtual.margemUtilizada70) : null,
            margem_saldo_70: folhaAtual.margemSaldo70 ? parseFloat(folhaAtual.margemSaldo70) : null,
            creditos: folhaAtual.creditos ? parseFloat(folhaAtual.creditos) : null,
            debitos: folhaAtual.debitos ? parseFloat(folhaAtual.debitos) : null,
            liquido: folhaAtual.liquido ? parseFloat(folhaAtual.liquido) : null,
            base_tag: folhaAtual.baseTag,
            extras_folha: folhaAtual.extrasFolha,
          } : null,
          historico: folhaHistorico.map(f => ({
            competencia: f.competencia,
            margem_saldo_30: f.margemSaldo30 ? parseFloat(f.margemSaldo30) : null,
            liquido: f.liquido ? parseFloat(f.liquido) : null,
            base_tag: f.baseTag,
          })),
        },
        contratos: contratos.map(c => ({
          id: c.id,
          tipo_contrato: c.tipoContrato,
          banco: c.banco,
          valor_parcela: c.valorParcela ? parseFloat(c.valorParcela) : null,
          competencia: c.competencia,
          base_tag: c.baseTag,
          dados_brutos: c.dadosBrutos,
        })),
        higienizacao: null, // Reserved for Part 3
      });
    } catch (error) {
      console.error("Get cliente details error:", error);
      return res.status(500).json({ message: "Erro ao buscar detalhes do cliente" });
    }
  });

  // ===== PRICING SETTINGS ENDPOINTS =====

  // GET pricing settings - Master only
  app.get("/api/pricing-settings", requireAuth, requireMaster, async (req, res) => {
    try {
      let settings = await storage.getPricingSettings();
      
      // If no settings exist, create default ones
      if (!settings) {
        settings = await storage.updatePricingSettings({
          precoAncoraMin: DEFAULT_PRICING_SETTINGS.precoAncoraMin,
          qtdAncoraMin: DEFAULT_PRICING_SETTINGS.qtdAncoraMin,
          precoAncoraMax: DEFAULT_PRICING_SETTINGS.precoAncoraMax,
          qtdAncoraMax: DEFAULT_PRICING_SETTINGS.qtdAncoraMax,
        });
      }
      
      // Generate example prices for display
      const exampleQuantities = [1, 10, 100, 1000, 10000, 100000, settings.qtdAncoraMax];
      const examples = exampleQuantities.map(qty => ({
        quantidade: qty,
        ...calculateListPrice(qty, settings!),
      }));
      
      return res.json({
        settings: {
          precoAncoraMin: settings.precoAncoraMin,
          qtdAncoraMin: settings.qtdAncoraMin,
          precoAncoraMax: settings.precoAncoraMax,
          qtdAncoraMax: settings.qtdAncoraMax,
          atualizadoEm: settings.atualizadoEm,
        },
        examples,
      });
    } catch (error) {
      console.error("Get pricing settings error:", error);
      return res.status(500).json({ message: "Erro ao buscar configurações de preços" });
    }
  });

  // PUT pricing settings - Master only
  app.put("/api/pricing-settings", requireAuth, requireMaster, async (req, res) => {
    try {
      const result = insertPricingSettingsSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }
      
      const settings = await storage.updatePricingSettings(result.data);
      
      // Generate example prices for display
      const exampleQuantities = [1, 10, 100, 1000, 10000, 100000, settings.qtdAncoraMax];
      const examples = exampleQuantities.map(qty => ({
        quantidade: qty,
        ...calculateListPrice(qty, settings),
      }));
      
      return res.json({
        message: "Configurações atualizadas com sucesso",
        settings: {
          precoAncoraMin: settings.precoAncoraMin,
          qtdAncoraMin: settings.qtdAncoraMin,
          precoAncoraMax: settings.precoAncoraMax,
          qtdAncoraMax: settings.qtdAncoraMax,
          atualizadoEm: settings.atualizadoEm,
        },
        examples,
      });
    } catch (error) {
      console.error("Update pricing settings error:", error);
      return res.status(500).json({ message: "Erro ao atualizar configurações de preços" });
    }
  });

  // ===== PEDIDOS LISTA ENDPOINTS =====

  // POST simular pedido de lista - Coordenador or Master
  app.post("/api/pedidos-lista/simular", requireAuth, async (req, res) => {
    try {
      // Only coordenacao and master can access
      if (!hasRole(req.user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const result = filtrosPedidoListaSchema.safeParse(req.body.filtros || req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Filtros inválidos",
          errors: result.error.errors,
        });
      }

      const filtros = result.data;
      const { clientes, total } = await storage.searchClientesPessoa(filtros);
      
      // Get pricing settings for cost calculation
      let settings = await storage.getPricingSettings();
      if (!settings) {
        settings = await storage.updatePricingSettings(DEFAULT_PRICING_SETTINGS);
      }
      
      const pricing = calculateListPrice(total, settings);
      
      // Return preview (first 10), total, and pricing
      return res.json({
        total,
        custoEstimado: pricing.precoTotal,
        precoUnitario: pricing.precoUnitario,
        preview: clientes.slice(0, 10).map(c => ({
          matricula: c.matricula,
          nome: c.nome,
          cpf: c.cpf ? `***${c.cpf.slice(-4)}` : null, // Mask CPF
          convenio: c.convenio,
          orgao: c.orgaodesc,
          uf: c.uf,
          sit_func: c.sitFunc,
        })),
      });
    } catch (error) {
      console.error("Simulate pedido error:", error);
      return res.status(500).json({ message: "Erro ao simular pedido" });
    }
  });

  // POST criar pedido de lista - Coordenador or Master
  app.post("/api/pedidos-lista", requireAuth, async (req, res) => {
    try {
      // Only coordenacao and master can access
      if (!hasRole(req.user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const result = filtrosPedidoListaSchema.safeParse(req.body.filtros || req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Filtros inválidos",
          errors: result.error.errors,
        });
      }

      const filtros = result.data;
      const { total } = await storage.searchClientesPessoa(filtros);
      
      // Get pricing settings for dynamic cost calculation
      let settings = await storage.getPricingSettings();
      if (!settings) {
        settings = await storage.updatePricingSettings(DEFAULT_PRICING_SETTINGS);
      }
      
      const pricing = calculateListPrice(total, settings);
      
      // Create pedido
      const pedido = await storage.createPedidoLista({
        coordenadorId: req.user!.id,
        filtrosUsados: filtros,
        quantidadeRegistros: total,
        tipo: "exportacao_base",
        status: "pendente",
        precoUnitario: String(pricing.precoUnitario),
        custoEstimado: String(pricing.precoTotal),
        statusFinanceiro: "pendente",
      });
      
      return res.json({
        message: "Pedido criado com sucesso",
        pedido: {
          id: pedido.id,
          quantidade: total,
          status: pedido.status,
          criadoEm: pedido.criadoEm,
        },
      });
    } catch (error) {
      console.error("Create pedido error:", error);
      return res.status(500).json({ message: "Erro ao criar pedido" });
    }
  });

  // GET pedidos de lista
  app.get("/api/pedidos-lista", requireAuth, async (req, res) => {
    try {
      // Only coordenacao and master can access
      if (!hasRole(req.user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      let pedidos;
      
      if (req.user!.role === "master") {
        // Master sees all
        pedidos = await storage.getAllPedidosLista();
      } else {
        // Coordenador sees only their own
        pedidos = await storage.getPedidosListaByUser(req.user!.id);
      }
      
      return res.json(pedidos);
    } catch (error) {
      console.error("Get pedidos error:", error);
      return res.status(500).json({ message: "Erro ao buscar pedidos" });
    }
  });

  // ===== ADMIN PEDIDOS LISTA - MASTER ONLY =====
  
  // GET /api/pedidos-lista/admin - Lista todos os pedidos com info do coordenador
  app.get("/api/pedidos-lista/admin", requireAuth, async (req, res) => {
    try {
      // Only master can access admin view
      if (!hasRole(req.user, ["master"])) {
        return res.status(403).json({ message: "Acesso negado - apenas master" });
      }

      const pedidos = await storage.getAllPedidosListaWithUser();
      
      return res.json(pedidos.map(p => ({
        id: p.id,
        coordenador_id: p.coordenadorId,
        coordenador_nome: p.coordenadorNome,
        coordenador_email: p.coordenadorEmail,
        filtros_usados: p.filtrosUsados,
        quantidade_registros: p.quantidadeRegistros,
        tipo: p.tipo,
        status: p.status,
        preco_unitario: p.precoUnitario,
        custo_estimado: p.custoEstimado,
        custo_final: p.custoFinal,
        status_financeiro: p.statusFinanceiro,
        arquivo_path: p.arquivoPath,
        arquivo_gerado_em: p.arquivoGeradoEm,
        criado_em: p.criadoEm,
        atualizado_em: p.atualizadoEm,
      })));
    } catch (error) {
      console.error("Get pedidos admin error:", error);
      return res.status(500).json({ message: "Erro ao buscar pedidos" });
    }
  });

  // POST /api/pedidos-lista/:id/aprovar - Aprovar pedido (MASTER only)
  app.post("/api/pedidos-lista/:id/aprovar", requireAuth, async (req, res) => {
    try {
      // Only master can approve
      if (!hasRole(req.user, ["master"])) {
        return res.status(403).json({ message: "Acesso negado - apenas master" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const pedido = await storage.getPedidoLista(id);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido não encontrado" });
      }

      if (pedido.status !== "pendente") {
        return res.status(400).json({ message: `Pedido já está com status: ${pedido.status}` });
      }

      // Update status to "aprovado" first
      await storage.updatePedidoListaStatus(id, "aprovado");
      
      // Start async file generation (fire-and-forget)
      generatePedidoListaFile(id, pedido).catch(async (err) => {
        console.error("[PedidoLista] Error generating file:", err);
        try {
          await storage.updatePedidoLista(id, { status: "erro" });
        } catch (e) {
          console.error("[PedidoLista] Failed to update status on error:", e);
        }
      });
      
      return res.json({
        message: "Pedido aprovado com sucesso. O arquivo está sendo gerado.",
        pedido: { id, status: "aprovado" },
      });
    } catch (error) {
      console.error("Approve pedido error:", error);
      return res.status(500).json({ message: "Erro ao aprovar pedido" });
    }
  });

  // Function to generate CSV file for approved pedido
  async function generatePedidoListaFile(pedidoId: number, pedido: any) {
    console.log(`[PedidoLista] Starting file generation for pedido ${pedidoId}`);
    
    try {
      // Ensure exports directory exists
      const exportsDir = path.join(os.tmpdir(), "exports");
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }
      
      // Get filtered clients using stored filters
      const filtros = pedido.filtrosUsados || {};
      const { clientes } = await storage.searchClientesPessoa(filtros);
      
      console.log(`[PedidoLista] Found ${clientes.length} clients for pedido ${pedidoId}`);
      
      // Get folha data for each client
      const clientesComFolha = await Promise.all(
        clientes.map(async (cliente) => {
          const folhas = await storage.getFolhaMesByPessoaId(cliente.id);
          const folhaAtual = folhas.length > 0 ? folhas[0] : null;
          return { ...cliente, folhaAtual };
        })
      );
      
      // Generate CSV content
      const headers = [
        "CPF", "Matricula", "Nome", "Convenio", "Orgao", "UF", "Municipio",
        "Situacao Funcional", "Telefones",
        "Margem 70%", "Margem 35%", "Margem Cartao Credito 5%", "Margem Cartao Beneficio 5%",
        "Liquido"
      ];
      
      const rows = clientesComFolha.map(c => [
        c.cpf || "",
        c.matricula || "",
        c.nome || "",
        c.convenio || "",
        c.orgaodesc || "",
        c.uf || "",
        c.municipio || "",
        c.sitFunc || "",
        (c.telefonesBase || []).join("; "),
        c.folhaAtual?.margemSaldo70 || "",
        c.folhaAtual?.margemSaldo35 || "",
        c.folhaAtual?.margemCartaoCredito5 || "",
        c.folhaAtual?.margemCartaoBeneficio5 || "",
        c.folhaAtual?.liquido || "",
      ]);
      
      // Create CSV string
      const csvContent = [
        headers.join(";"),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      ].join("\n");
      
      // Write file
      const fileName = `lista-clientes-${pedidoId}-${Date.now()}.csv`;
      const filePath = path.join(exportsDir, fileName);
      fs.writeFileSync(filePath, "\ufeff" + csvContent, "utf-8"); // BOM for Excel compatibility
      
      console.log(`[PedidoLista] File generated: ${filePath}`);
      
      // Update pedido with file info
      await storage.updatePedidoLista(pedidoId, {
        arquivoPath: filePath,
        arquivoGeradoEm: new Date(),
        status: "processado",
        custoFinal: pedido.custoEstimado, // Set custo_final = custo_estimado by default
      });
      
      console.log(`[PedidoLista] Pedido ${pedidoId} updated with file path`);
      
      // TODO: Implement cleanup routine for files older than 30 days
      
    } catch (error) {
      console.error(`[PedidoLista] Error generating file for pedido ${pedidoId}:`, error);
      await storage.updatePedidoLista(pedidoId, { status: "erro" });
      throw error;
    }
  }

  // GET /api/pedidos-lista/:id/download - Download generated file
  app.get("/api/pedidos-lista/:id/download", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const pedido = await storage.getPedidoLista(id);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido não encontrado" });
      }

      // Check access: owner (coordenador) or master
      const isOwner = pedido.coordenadorId === req.user!.id;
      const isMaster = hasRole(req.user, ["master"]);
      
      if (!isOwner && !isMaster) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Check if file is ready
      if (pedido.status !== "processado" || !pedido.arquivoPath) {
        return res.status(400).json({ 
          message: pedido.status === "aprovado" 
            ? "O arquivo ainda está sendo gerado. Aguarde alguns instantes."
            : "Arquivo não disponível para download" 
        });
      }

      // Check if file exists
      if (!fs.existsSync(pedido.arquivoPath)) {
        return res.status(404).json({ message: "Arquivo não encontrado no servidor" });
      }

      // Send file
      const fileName = `lista-clientes-${id}.csv`;
      res.download(pedido.arquivoPath, fileName);
      
    } catch (error) {
      console.error("Download pedido error:", error);
      return res.status(500).json({ message: "Erro ao baixar arquivo" });
    }
  });

  // POST /api/pedidos-lista/:id/rejeitar - Rejeitar pedido (MASTER only)
  app.post("/api/pedidos-lista/:id/rejeitar", requireAuth, async (req, res) => {
    try {
      // Only master can reject
      if (!hasRole(req.user, ["master"])) {
        return res.status(403).json({ message: "Acesso negado - apenas master" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const pedido = await storage.getPedidoLista(id);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido não encontrado" });
      }

      if (pedido.status !== "pendente") {
        return res.status(400).json({ message: `Pedido já está com status: ${pedido.status}` });
      }

      const updated = await storage.updatePedidoListaStatus(id, "rejeitado");
      
      return res.json({
        message: "Pedido rejeitado com sucesso",
        pedido: updated,
      });
    } catch (error) {
      console.error("Reject pedido error:", error);
      return res.status(500).json({ message: "Erro ao rejeitar pedido" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
