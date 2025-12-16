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
  updatePacotePrecoSchema,
  pacotesPreco,
  treinadorRequestSchema,
  vendedoresAcademia,
  quizTentativas,
  roleplaySessoes,
  roleplayAvaliacoes,
  abordagensGeradas,
  progressoLicoes,
  feedbacksIAHistorico,
  users,
  teams,
  teamMembers,
  aiPrompts,
  salesCampaigns,
  salesLeads,
  salesLeadAssignments,
  salesLeadEvents,
  leadInteractions,
  clientesPessoa,
  insertSalesCampaignSchema,
  insertSalesLeadSchema,
  LEAD_STATUS,
  LEAD_MARKERS,
  TIPOS_CONTATO,
  MODULE_LIST,
  type User,
  type InsertCoefficientTable,
  type InsertSalesLead,
  USER_ROLES,
  type UserRole,
  type FiltrosPedidoLista,
  type PricingSettings,
} from "@shared/schema";
import { db } from "./storage";
import { eq, asc, and, sql, inArray } from "drizzle-orm";
import * as XLSX from "xlsx";
import multer from "multer";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import Papa from "papaparse";

// Configure multer for file uploads using memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for large base imports
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

// Users management access middleware (master, atendimento, coordenacao, or users with modulo_config_usuarios canEdit permission)
async function requireUserManagementAccess(req: Request, res: Response, next: NextFunction) {
  // Master, atendimento, coordenacao have access by role
  if (hasRole(req.user, ["master", "atendimento", "coordenacao"])) {
    return next();
  }
  
  // Check if user has modulo_config_usuarios permission with canEdit
  if (req.user) {
    const hasConfigEditAccess = await storage.hasModuleEditAccess(req.user.id, "modulo_config_usuarios");
    if (hasConfigEditAccess) {
      return next();
    }
  }
  
  return res.status(403).json({ message: "Acesso negado - você não tem permissão para gerenciar usuários" });
}

// Legacy alias for backward compatibility
const requireManagerAccess = requireUserManagementAccess;

// Academia access middleware (master, atendimento, operacional)
function requireAcademiaAccess(req: Request, res: Response, next: NextFunction) {
  if (!hasRole(req.user, ["master", "atendimento", "operacional", "coordenacao"])) {
    return res.status(403).json({ message: "Acesso negado - você não tem permissão para acessar o Treinamento" });
  }
  next();
}

// Module access middleware - checks if user has permission to access a specific module
function requireModuleAccess(module: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }
    
    // Master has access to all modules
    if (req.user.role === "master") {
      return next();
    }
    
    const hasAccess = await storage.hasModuleAccess(req.user.id, module);
    if (!hasAccess) {
      return res.status(403).json({ message: "Acesso negado - você não tem permissão para acessar este módulo" });
    }
    next();
  };
}

// ===== PRICING CALCULATION - MODELO DE PACOTES =====

interface PacotePrecoData {
  quantidadeMaxima: number;
  nomePacote: string;
  preco: number;
}

interface PricingResult {
  precoTotal: number;
  nomePacote: string;
  quantidadePacote: number;
}

// Fallback pacotes caso o banco de dados não tenha dados
const PACOTES_PRECO_DEFAULT: PacotePrecoData[] = [
  { quantidadeMaxima: 100,    nomePacote: "Pacote 100",    preco: 37.90 },
  { quantidadeMaxima: 300,    nomePacote: "Pacote 300",    preco: 67.90 },
  { quantidadeMaxima: 500,    nomePacote: "Pacote 500",    preco: 97.90 },
  { quantidadeMaxima: 1000,   nomePacote: "Pacote 1000",   preco: 187.90 },
  { quantidadeMaxima: 2000,   nomePacote: "Pacote 2000",   preco: 297.90 },
  { quantidadeMaxima: 3000,   nomePacote: "Pacote 3000",   preco: 397.90 },
  { quantidadeMaxima: 5000,   nomePacote: "Pacote 5000",   preco: 597.90 },
  { quantidadeMaxima: 10000,  nomePacote: "Pacote 10000",  preco: 997.90 },
];

/**
 * Busca pacotes do banco de dados (com fallback para default)
 */
async function fetchPacotesFromDb(): Promise<PacotePrecoData[]> {
  try {
    const result = await db
      .select()
      .from(pacotesPreco)
      .where(eq(pacotesPreco.ativo, true))
      .orderBy(asc(pacotesPreco.ordem), asc(pacotesPreco.quantidadeMaxima));
    
    if (result.length === 0) {
      return PACOTES_PRECO_DEFAULT;
    }
    
    return result.map(p => ({
      quantidadeMaxima: p.quantidadeMaxima,
      nomePacote: p.nomePacote,
      preco: parseFloat(p.preco),
    }));
  } catch (error) {
    console.error("Error fetching pacotes from db:", error);
    return PACOTES_PRECO_DEFAULT;
  }
}

/**
 * Calcula o preço de uma lista usando o modelo de PACOTES
 * 
 * Regra:
 * 1. Se Q <= 0: não permite gerar pedido
 * 2. Encontra o primeiro pacote onde Q <= quantidade_maxima
 * 3. Retorna o preço fixo desse pacote
 * 4. Se Q > maior pacote: usa o maior pacote (pode ser ajustado depois)
 * 
 * @param qtdRegistros - Quantidade real de registros
 * @param pacotes - Lista de pacotes (opcional, busca do banco se não fornecido)
 */
async function calculatePackagePrice(qtdRegistros: number, pacotes?: PacotePrecoData[]): Promise<PricingResult> {
  if (qtdRegistros <= 0) {
    return { precoTotal: 0, nomePacote: "", quantidadePacote: 0 };
  }
  
  const pacotesAtivos = pacotes || await fetchPacotesFromDb();
  
  // Encontra o primeiro pacote que atende a quantidade
  for (const pacote of pacotesAtivos) {
    if (qtdRegistros <= pacote.quantidadeMaxima) {
      return {
        precoTotal: pacote.preco,
        nomePacote: pacote.nomePacote,
        quantidadePacote: pacote.quantidadeMaxima,
      };
    }
  }
  
  // Se exceder todos os pacotes, usa o maior pacote
  const maiorPacote = pacotesAtivos[pacotesAtivos.length - 1];
  return {
    precoTotal: maiorPacote.preco,
    nomePacote: maiorPacote.nomePacote,
    quantidadePacote: maiorPacote.quantidadeMaxima,
  };
}

// Função para obter todos os pacotes (para exibição na tela de config)
async function getPacotesPreco(): Promise<PacotePrecoData[]> {
  return fetchPacotesFromDb();
}

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

  // Bulk deactivate coefficient tables (master only)
  app.post("/api/coefficient-tables/bulk-deactivate", requireAuth, requireMaster, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs inválidos" });
      }

      const updatePromises = ids.map((id: number) => 
        storage.updateCoefficientTable(id, { isActive: false })
      );
      await Promise.all(updatePromises);

      return res.json({ 
        message: "Tabelas desativadas com sucesso",
        count: ids.length
      });
    } catch (error) {
      console.error("Bulk deactivate coefficient tables error:", error);
      return res.status(500).json({ message: "Erro ao desativar tabelas" });
    }
  });

  // ===== USERS ROUTES =====
  
  // Get users with role-based visibility:
  // - master: sees all users
  // - atendimento: sees all users
  // - coordenador: sees only themselves + vendedores whose managerId equals their id
  // - users with modulo_config_usuarios permission: sees all non-master users
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
        // Users with modulo_config_usuarios permission can see all non-master users
        const hasConfigEditAccess = await storage.hasModuleEditAccess(req.user!.id, "modulo_config_usuarios");
        if (hasConfigEditAccess) {
          const allUsers = await storage.getAllUsers();
          // Filter out master users - non-master managers cannot see/manage masters
          users = allUsers.filter(u => u.role !== "master");
        } else {
          return res.status(403).json({ message: "Acesso negado" });
        }
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

  // ===== USER PERMISSIONS ROUTES =====

  // Get list of available modules
  app.get("/api/permissions/modules", requireAuth, async (req, res) => {
    try {
      return res.json(MODULE_LIST);
    } catch (error) {
      console.error("Get modules error:", error);
      return res.status(500).json({ message: "Erro ao buscar lista de módulos" });
    }
  });

  // Get current user's permissions (for delegation purposes)
  app.get("/api/permissions/my", requireAuth, async (req, res) => {
    try {
      const permissions = await storage.getUserPermissions(req.user!.id);
      return res.json(permissions);
    } catch (error) {
      console.error("Get my permissions error:", error);
      return res.status(500).json({ message: "Erro ao buscar suas permissões" });
    }
  });

  // Get user permissions
  app.get("/api/users/:id/permissions", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }

      // Check if user exists
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const permissions = await storage.getUserPermissions(id);
      return res.json(permissions);
    } catch (error) {
      console.error("Get user permissions error:", error);
      return res.status(500).json({ message: "Erro ao buscar permissões do usuário" });
    }
  });

  // Set user permissions (master or users with modulo_config_usuarios + canEdit)
  app.put("/api/users/:id/permissions", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserRole = req.user!.role as UserRole;
      const isMaster = currentUserRole === "master";
      
      if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }

      // Check if user exists
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Validate request body
      const permissionsSchema = z.array(z.object({
        module: z.string().refine(m => MODULE_LIST.includes(m as any), { message: "Módulo inválido" }),
        canView: z.boolean(),
        canEdit: z.boolean(),
        canDelegate: z.boolean().optional().default(false),
      }));

      const result = permissionsSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      // For non-master users, check if they have Config. Usuários with canEdit
      if (!isMaster) {
        const currentUserPermissions = await storage.getUserPermissions(req.user!.id);
        const configUsuariosPermission = currentUserPermissions.find(p => p.module === "modulo_config_usuarios");
        
        if (!configUsuariosPermission?.canEdit) {
          return res.status(403).json({ message: "Acesso negado - você não tem permissão para editar usuários" });
        }
        
        // Get modules that the current user can delegate
        const delegatableModules = currentUserPermissions
          .filter(p => p.canDelegate)
          .map(p => p.module);
        
        // Filter permissions to only include delegatable modules (non-master users can't set canDelegate)
        const filteredPermissions = result.data
          .filter(p => delegatableModules.includes(p.module))
          .map(p => ({ ...p, canDelegate: false })); // Non-master users can never grant canDelegate
        
        // Merge with existing permissions for non-delegatable modules
        const existingPermissions = await storage.getUserPermissions(id);
        const nonDelegatableExisting = existingPermissions
          .filter(p => !delegatableModules.includes(p.module));
        
        const finalPermissions = [...nonDelegatableExisting, ...filteredPermissions];
        await storage.setUserPermissions(id, finalPermissions);
      } else {
        // Master can set all permissions including canDelegate
        await storage.setUserPermissions(id, result.data);
      }
      
      // Return updated permissions
      const updatedPermissions = await storage.getUserPermissions(id);
      return res.json(updatedPermissions);
    } catch (error) {
      console.error("Set user permissions error:", error);
      return res.status(500).json({ message: "Erro ao definir permissões do usuário" });
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

  // Complete column mapping for import (includes official template + legacy aliases)
  const COLUMN_MAP: Record<string, string> = {
    // IDENTIFICAÇÃO (template oficial + legado)
    "CPF": "cpf",
    "MATRICULA": "matricula",
    "MATRÍCULA": "matricula",
    "CONVENIO": "convenio",
    "CONVÊNIO": "convenio",
    "ORGAO": "orgaodesc",
    "ÓRGÃO": "orgaodesc",
    "ORGAODESC": "orgaodesc",
    "ORGAO_DESC": "orgaodesc",
    "ORGÃO_DESC": "orgaodesc",
    "UF": "uf",
    "ESTADO": "uf",
    "MUNICIPIO": "municipio",
    "MUNICÍPIO": "municipio",
    "SITUACAO_FUNCIONAL": "sit_func",
    "SITUAÇÃO_FUNCIONAL": "sit_func",
    "SIT_FUNC": "sit_func",
    "SIT FUNC": "sit_func",
    "SITUACAO FUNCIONAL": "sit_func",
    "SITUAÇÃO FUNCIONAL": "sit_func",
    "NOME": "nome",
    "NOME_COMPLETO": "nome",
    "NOME COMPLETO": "nome",
    "DATA_NASCIMENTO": "data_nascimento",
    "DATA NASCIMENTO": "data_nascimento",
    "DT_NASCIMENTO": "data_nascimento",
    // CONTATO
    "TELEFONE_1": "telefone_1",
    "TELEFONE 1": "telefone_1",
    "TELEFONE1": "telefone_1",
    "TELEFONE_2": "telefone_2",
    "TELEFONE 2": "telefone_2",
    "TELEFONE2": "telefone_2",
    "TELEFONE_3": "telefone_3",
    "TELEFONE 3": "telefone_3",
    "TELEFONE3": "telefone_3",
    "TELEFONE_4": "telefone_4",
    "TELEFONE 4": "telefone_4",
    "TELEFONE_5": "telefone_5",
    "TELEFONE 5": "telefone_5",
    "EMAIL": "email",
    "E-MAIL": "email",
    // DADOS BANCÁRIOS DO SALÁRIO
    "BANCO_SALARIO": "banco_salario",
    "BANCO SALARIO": "banco_salario",
    "BANCO": "banco_salario",
    "AGENCIA_SALARIO": "agencia_salario",
    "AGENCIA SALARIO": "agencia_salario",
    "AGENCIA": "agencia_salario",
    "AGÊNCIA": "agencia_salario",
    "CONTA_SALARIO": "conta_salario",
    "CONTA SALARIO": "conta_salario",
    "CONTA": "conta_salario",
    "UPAG": "upag",
    "UNIDADE_PAGADORA": "upag",
    "UNIDADE PAGADORA": "upag",
    // IDADE
    "IDADE": "idade",
    // RENDIMENTOS
    "SALARIO_BRUTO": "salario_bruto",
    "SALARIO BRUTO": "salario_bruto",
    "BRUTO": "salario_bruto",
    "DESCONTOS_BRUTOS": "descontos_brutos",
    "DESCONTOS BRUTOS": "descontos_brutos",
    "TOTAL_DESCONTOS": "descontos_brutos",
    "TOTAL DESCONTOS": "descontos_brutos",
    "SALARIO_LIQUIDO": "salario_liquido",
    "SALARIO LIQUIDO": "salario_liquido",
    // MARGENS 70%
    "MARGEM_70_BRUTA": "margem_70_bruta",
    "MARGEM 70 BRUTA": "margem_70_bruta",
    "BRUTA 70%": "margem_70_bruta",
    "MARGEM_70_UTILIZADA": "margem_70_utilizada",
    "MARGEM 70 UTILIZADA": "margem_70_utilizada",
    "UTILZ 70%": "margem_70_utilizada",
    "MARGEM_70_SALDO": "margem_70_saldo",
    "MARGEM 70 SALDO": "margem_70_saldo",
    "SALDO 70%": "margem_70_saldo",
    // MARGENS 35%
    "MARGEM_35_BRUTA": "margem_35_bruta",
    "MARGEM 35 BRUTA": "margem_35_bruta",
    "BRUTA 35%": "margem_35_bruta",
    "BRUTA 30%": "margem_35_bruta",
    "MARGEM_35_UTILIZADA": "margem_35_utilizada",
    "MARGEM 35 UTILIZADA": "margem_35_utilizada",
    "UTILZ 35%": "margem_35_utilizada",
    "UTILZ 30%": "margem_35_utilizada",
    "MARGEM_35_SALDO": "margem_35_saldo",
    "MARGEM 35 SALDO": "margem_35_saldo",
    "SALDO 35%": "margem_35_saldo",
    "SALDO 30%": "margem_35_saldo",
    // MARGEM CARTÃO CRÉDITO
    "MARGEM_CARTAO_CREDITO_BRUTA": "margem_cartao_credito_bruta",
    "MARGEM CARTAO CREDITO BRUTA": "margem_cartao_credito_bruta",
    "MARGEM_CARTAO_CREDITO_UTILIZADA": "margem_cartao_credito_utilizada",
    "MARGEM CARTAO CREDITO UTILIZADA": "margem_cartao_credito_utilizada",
    "MARGEM_CARTAO_CREDITO_SALDO": "margem_cartao_credito_saldo",
    "MARGEM CARTAO CREDITO SALDO": "margem_cartao_credito_saldo",
    "MARGEM CARTAO CREDITO": "margem_cartao_credito_saldo",
    "SALDO CARTAO CREDITO": "margem_cartao_credito_saldo",
    "MARGEM 5% CREDITO": "margem_cartao_credito_saldo",
    // MARGEM CARTÃO BENEFÍCIO
    "MARGEM_CARTAO_BENEFICIO_BRUTA": "margem_cartao_beneficio_bruta",
    "MARGEM CARTAO BENEFICIO BRUTA": "margem_cartao_beneficio_bruta",
    "MARGEM_CARTAO_BENEFICIO_UTILIZADA": "margem_cartao_beneficio_utilizada",
    "MARGEM CARTAO BENEFICIO UTILIZADA": "margem_cartao_beneficio_utilizada",
    "MARGEM_CARTAO_BENEFICIO_SALDO": "margem_cartao_beneficio_saldo",
    "MARGEM CARTAO BENEFICIO SALDO": "margem_cartao_beneficio_saldo",
    "MARGEM CARTAO BENEFICIO": "margem_cartao_beneficio_saldo",
    "SALDO CARTAO BENEFICIO": "margem_cartao_beneficio_saldo",
    "MARGEM 5% BENEFICIO": "margem_cartao_beneficio_saldo",
    // FOLHA AGREGADOS
    "CREDITOS": "creditos",
    "CRÉDITOS": "creditos",
    "DEBITOS": "debitos",
    "DÉBITOS": "debitos",
    "LIQUIDO": "liquido",
    "LÍQUIDO": "liquido",
    // CONTRATOS
    "BANCO_EMPRESTIMO": "banco_emprestimo",
    "BANCO EMPRESTIMO": "banco_emprestimo",
    "BANCO DO EMPRESTIMO": "banco_emprestimo",
    "BANCO_DO_EMPRESTIMO": "banco_emprestimo",
    "VALOR_PARCELA": "valor_parcela",
    "VALOR PARCELA": "valor_parcela",
    "SALDO_DEVEDOR": "saldo_devedor",
    "SALDO DEVEDOR": "saldo_devedor",
    "PRAZO_REMANESCENTE": "prazo_remanescente",
    "PRAZO REMANESCENTE": "prazo_remanescente",
    "PARCELAS_RESTANTES": "prazo_remanescente",
    "PARCELAS RESTANTES": "prazo_remanescente",
    "NUMERO_CONTRATO": "numero_contrato",
    "NUMERO CONTRATO": "numero_contrato",
    "NR_CONTRATO": "numero_contrato",
    "TIPO_PRODUTO": "tipo_produto",
    "TIPO PRODUTO": "tipo_produto",
    "TIPO_OPERACAO": "tipo_produto",
    "TIPO OPERACAO": "tipo_produto",
    "TIPO_CONTRATO": "tipo_produto",
    "SITUACAO_CONTRATO": "situacao_contrato",
    "SITUACAO CONTRATO": "situacao_contrato",
  };

  function normalizeCol(col: string): string {
    // Normaliza para maiúsculas mas mantém espaços para permitir matching com aliases que usam espaço
    return col.toUpperCase().trim().replace(/\s+/g, " ");
  }

  function parseNum(value: any): string | null {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value).replace(/[^\d,.-]/g, "").replace(",", ".");
    const num = parseFloat(str);
    return isNaN(num) ? null : num.toFixed(2);
  }

  // Função para normalizar valores monetários - preserva vazios como null
  function normalizeMoney(value: any): string | null {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value).trim().replace(/[^\d,.-]/g, "").replace(",", ".");
    if (str === "" || str === "." || str === "-") return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : num.toFixed(2);
  }

  // Função para parsear data de nascimento
  function parseDate(value: any): Date | null {
    if (value === null || value === undefined || value === "") return null;
    // Tenta vários formatos comuns
    const str = String(value).trim();
    // Formato DD/MM/YYYY
    const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Formato YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Tenta parsing padrão
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date;
  }

  // Background import processor for large files
  async function processImportInBackground(
    data: any[],
    baseId: number,
    baseTag: string,
    convenio: string,
    competenciaDate: Date
  ) {
    console.log(`[Import-BG] Starting background processing for base ${baseId}, ${data.length} rows`);
    
    const headers = data[0] ? Object.keys(data[0]) : [];
    const headerMap: Record<string, string> = {};
    
    for (const header of headers) {
      const normalized = normalizeCol(header);
      if (COLUMN_MAP[normalized]) {
        headerMap[header] = COLUMN_MAP[normalized];
      }
    }

    console.log(`[Import-BG] Mapped columns:`, Object.keys(headerMap).length);

    let totalLinhas = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        let matricula: string | null = null;
        for (const [col, field] of Object.entries(headerMap)) {
          if (field === "matricula") {
            matricula = String(row[col] || "").trim();
            break;
          }
        }
        
        if (!matricula) continue;
        
        const pessoaData: Record<string, any> = {
          matricula,
          convenio,
          baseTagUltima: baseTag,
        };
        
        const folhaData: Record<string, any> = {
          competencia: competenciaDate,
          baseTag,
        };
        
        const telefones: string[] = [];
        
        const contratoData: Record<string, any> = {
          competencia: competenciaDate,
          baseTag,
        };
        
        for (const [col, value] of Object.entries(row)) {
          const field = headerMap[col];
          
          if (!field) continue;
          
          if (["cpf", "nome", "orgaodesc", "sit_func", "uf", "municipio", "email"].includes(field)) {
            const key = field === "sit_func" ? "sitFunc" : field;
            pessoaData[key] = String(value || "").trim() || null;
          }
          else if (field === "banco_salario") {
            pessoaData.bancoCodigo = String(value || "").trim() || null;
          }
          else if (field === "agencia_salario") {
            pessoaData.agencia = String(value || "").trim() || null;
          }
          else if (field === "conta_salario") {
            pessoaData.conta = String(value || "").trim() || null;
          }
          else if (field === "upag") {
            pessoaData.upag = String(value || "").trim() || null;
          }
          else if (field === "data_nascimento") {
            pessoaData.dataNascimento = parseDate(value);
          }
          else if (field === "salario_bruto") {
            folhaData.salarioBruto = normalizeMoney(value);
          }
          else if (field === "descontos_brutos") {
            folhaData.descontosBrutos = normalizeMoney(value);
          }
          else if (field === "salario_liquido") {
            folhaData.salarioLiquido = normalizeMoney(value);
          }
          else if (field.startsWith("margem_")) {
            const parts = field.split("_");
            let camelField = parts[0];
            for (let j = 1; j < parts.length; j++) {
              camelField += parts[j].charAt(0).toUpperCase() + parts[j].slice(1);
            }
            folhaData[camelField] = parseNum(value);
          }
          else if (field.startsWith("telefone_")) {
            const tel = String(value || "").trim();
            if (tel) telefones.push(tel);
          }
          else if (field === "banco_emprestimo") {
            contratoData.banco = String(value || "").trim() || null;
          }
          else if (field === "valor_parcela") {
            contratoData.valorParcela = parseNum(value);
          }
          else if (field === "saldo_devedor") {
            contratoData.saldoDevedor = parseNum(value);
          }
          else if (field === "prazo_remanescente") {
            const prazo = parseInt(String(value || "0"), 10);
            contratoData.parcelasRestantes = isNaN(prazo) ? null : prazo;
          }
          else if (field === "numero_contrato") {
            contratoData.numeroContrato = String(value || "").trim() || null;
          }
          else if (field === "tipo_produto") {
            contratoData.tipoContrato = String(value || "").trim() || null;
          }
        }
        
        pessoaData.telefonesBase = telefones;
        
        const pessoasEncontradas = await storage.getClientesByMatricula(matricula, convenio);
        let pessoa = pessoasEncontradas[0];
        
        if (pessoa) {
          pessoa = await storage.updateClientePessoa(pessoa.id, pessoaData as any);
        } else {
          pessoa = await storage.createClientePessoa(pessoaData as any);
        }
        
        if (pessoa) {
          await storage.createClienteFolhaMes({
            pessoaId: pessoa.id,
            competencia: competenciaDate,
            margemBruta70: folhaData.margem70Bruta,
            margemUtilizada70: folhaData.margem70Utilizada,
            margemSaldo70: folhaData.margem70Saldo,
            margemBruta35: folhaData.margem35Bruta,
            margemUtilizada35: folhaData.margem35Utilizada,
            margemSaldo35: folhaData.margem35Saldo,
            margemCartaoCreditoSaldo: folhaData.margemCartaoCreditoSaldo,
            margemCartaoBeneficioSaldo: folhaData.margemCartaoBeneficioSaldo,
            salarioBruto: folhaData.salarioBruto || null,
            descontosBrutos: folhaData.descontosBrutos || null,
            salarioLiquido: folhaData.salarioLiquido || null,
            sitFuncNoMes: pessoaData.sitFunc || null,
            baseTag,
          } as any);
          
          if (contratoData.banco || contratoData.valorParcela || contratoData.numeroContrato) {
            const contratosExistentes = await storage.getContratosByPessoaId(pessoa.id);
            
            const contratoExistente = contratosExistentes.find(c => 
              c.numeroContrato === contratoData.numeroContrato && contratoData.numeroContrato
            );
            
            if (contratoExistente) {
              const updateData: Record<string, any> = {
                baseTag,
                dadosBrutos: row,
              };
              if (contratoData.tipoContrato) updateData.tipoContrato = contratoData.tipoContrato;
              if (contratoData.banco) updateData.banco = contratoData.banco;
              if (contratoData.valorParcela !== null) updateData.valorParcela = contratoData.valorParcela;
              if (contratoData.saldoDevedor !== null) updateData.saldoDevedor = contratoData.saldoDevedor;
              if (contratoData.parcelasRestantes !== null) updateData.parcelasRestantes = contratoData.parcelasRestantes;
              updateData.competencia = competenciaDate;
              
              await storage.updateClienteContrato(contratoExistente.id, updateData as any);
            } else {
              await storage.createClienteContrato({
                pessoaId: pessoa.id,
                tipoContrato: contratoData.tipoContrato || "consignado",
                banco: contratoData.banco,
                valorParcela: contratoData.valorParcela,
                saldoDevedor: contratoData.saldoDevedor,
                parcelasRestantes: contratoData.parcelasRestantes,
                numeroContrato: contratoData.numeroContrato,
                competencia: competenciaDate,
                baseTag,
                dadosBrutos: row,
              } as any);
            }
          }
          
          totalLinhas++;
        }
        
        // Log progress every 1000 rows for large files
        if ((i + 1) % 1000 === 0) {
          console.log(`[Import-BG] Processed ${i + 1}/${data.length} rows, imported ${totalLinhas}`);
          // Update base with partial progress
          await storage.updateBaseImportada(baseId, {
            totalLinhas,
          });
        }
      } catch (rowError) {
        console.error("[Import-BG] Row error:", rowError);
      }
    }
    
    // Update base status to completed
    await storage.updateBaseImportada(baseId, {
      totalLinhas,
      status: "concluida",
    });
    
    console.log(`[Import-BG] Base ${baseId} completed with ${totalLinhas} rows`);
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

  // DELETE base importada - Master only
  app.delete("/api/bases/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      // Get the base to check status and get baseTag
      const base = await storage.getBaseImportada(id);
      
      if (!base) {
        return res.status(404).json({ message: "Base não encontrada" });
      }
      
      // Don't allow deletion if still processing
      if (base.status === "processando") {
        return res.status(400).json({ 
          message: "Não é possível excluir uma base em processamento. Aguarde a conclusão." 
        });
      }
      
      console.log(`[Delete Base] User ${req.user?.id} (${req.user?.email}) deleting base ${id}: ${base.nome}`);
      
      // Delete base and all related data
      const result = await storage.deleteBaseImportada(id, base.baseTag);
      
      console.log(`[Delete Base] Completed: ${result.deletedFolhas} folhas, ${result.deletedContratos} contratos, ${result.deletedPessoas} pessoas removed`);
      
      return res.json({
        message: "Base excluída com sucesso",
        deletedFolhas: result.deletedFolhas,
        deletedContratos: result.deletedContratos,
        deletedPessoas: result.deletedPessoas,
      });
    } catch (error) {
      console.error("Delete base error:", error);
      return res.status(500).json({ message: "Erro ao excluir base" });
    }
  });

  // POST importar base - Master only - Background processing for large files
  app.post("/api/bases/import", requireAuth, requireMaster, upload.single("arquivo"), async (req, res) => {
    try {
      const file = req.file;
      const { convenio, competencia, nome_base } = req.body;
      
      if (!file || !convenio || !competencia) {
        return res.status(400).json({ 
          message: "Arquivo, convênio e competência são obrigatórios" 
        });
      }

      const fileSizeMB = file.size / 1024 / 1024;
      console.log(`[Import] Received file: ${file.originalname}, size: ${fileSizeMB.toFixed(2)} MB`);

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

      console.log(`[Import] Created base ${base.id} with tag ${baseTag}`);
      
      // Parse file - use PapaParse for CSV (much faster for large files)
      const ext = path.extname(file.originalname).toLowerCase();
      let data: any[] = [];
      
      if (ext === ".csv") {
        console.log(`[Import] Parsing CSV with PapaParse...`);
        const csvString = file.buffer.toString("utf-8");
        const parsed = Papa.parse(csvString, { 
          header: true,
          skipEmptyLines: true,
          delimiter: "", // auto-detect
        });
        data = parsed.data as any[];
        console.log(`[Import] CSV parsed: ${data.length} rows`);
      } else {
        console.log(`[Import] Parsing Excel with XLSX...`);
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        console.log(`[Import] Excel parsed: ${data.length} rows`);
      }

      console.log(`[Import] Parsed ${data.length} rows from file`);

      // For large files (>50k rows), process in background and return immediately
      const isLargeFile = data.length > 50000;
      
      if (isLargeFile) {
        console.log(`[Import] Large file detected (${data.length} rows), processing in background...`);
        
        // Return immediately for large files
        res.json({
          message: "Importação iniciada em segundo plano",
          baseId: base.id,
          baseTag,
          status: "processando",
          totalRows: data.length,
          fileName: file.originalname,
          isBackground: true,
        });
        
        // Process in background (don't await)
        processImportInBackground(data, base.id, baseTag, convenio, competenciaDate).catch(err => {
          console.error(`[Import] Background processing error:`, err);
        });
        
        return;
      }

      // Build header mapping
      const headers = data[0] ? Object.keys(data[0]) : [];
      const headerMap: Record<string, string> = {};
      
      for (const header of headers) {
        const normalized = normalizeCol(header);
        if (COLUMN_MAP[normalized]) {
          headerMap[header] = COLUMN_MAP[normalized];
        }
      }

      console.log(`[Import] Mapped columns:`, Object.keys(headerMap).length);

      let totalLinhas = 0;

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Extract matricula (required)
          let matricula: string | null = null;
          for (const [col, field] of Object.entries(headerMap)) {
            if (field === "matricula") {
              matricula = String(row[col] || "").trim();
              break;
            }
          }
          
          if (!matricula) continue;
          
          // Build pessoa data
          const pessoaData: Record<string, any> = {
            matricula,
            convenio,
            baseTagUltima: baseTag,
          };
          
          // Build folha data
          const folhaData: Record<string, any> = {
            competencia: competenciaDate,
            baseTag,
          };
          
          // Build telefones array
          const telefones: string[] = [];
          
          // Build contrato data
          const contratoData: Record<string, any> = {
            competencia: competenciaDate,
            baseTag,
          };
          
          // Map row values
          for (const [col, value] of Object.entries(row)) {
            const field = headerMap[col];
            
            if (!field) continue;
            
            // PESSOA FIELDS
            if (["cpf", "nome", "orgaodesc", "sit_func", "uf", "municipio", "email"].includes(field)) {
              const key = field === "sit_func" ? "sitFunc" : field;
              pessoaData[key] = String(value || "").trim() || null;
            }
            else if (field === "banco_salario") {
              pessoaData.bancoCodigo = String(value || "").trim() || null;
            }
            else if (field === "agencia_salario") {
              pessoaData.agencia = String(value || "").trim() || null;
            }
            else if (field === "conta_salario") {
              pessoaData.conta = String(value || "").trim() || null;
            }
            else if (field === "upag") {
              pessoaData.upag = String(value || "").trim() || null;
            }
            else if (field === "data_nascimento") {
              pessoaData.dataNascimento = parseDate(value);
            }
            else if (field === "idade") {
              // Idade ignorada para persistência (calculamos a partir da data de nascimento)
              // Mas podemos salvar no extras_pessoa se quisermos
            }
            // RENDIMENTOS (campos monetários - usam normalizeMoney)
            else if (field === "salario_bruto") {
              folhaData.salarioBruto = normalizeMoney(value);
            }
            else if (field === "descontos_brutos") {
              folhaData.descontosBrutos = normalizeMoney(value);
            }
            else if (field === "salario_liquido") {
              folhaData.salarioLiquido = normalizeMoney(value);
            }
            // FOLHA FIELDS (margens) - usam parseNum para permitir nulos
            else if (field.startsWith("margem_")) {
              const parts = field.split("_");
              let camelField = parts[0];
              for (let j = 1; j < parts.length; j++) {
                camelField += parts[j].charAt(0).toUpperCase() + parts[j].slice(1);
              }
              folhaData[camelField] = parseNum(value);
            }
            // TELEFONES
            else if (field.startsWith("telefone_")) {
              const tel = String(value || "").trim();
              if (tel) telefones.push(tel);
            }
            // CONTRATO FIELDS
            else if (field === "banco_emprestimo") {
              contratoData.banco = String(value || "").trim() || null;
            }
            else if (field === "valor_parcela") {
              contratoData.valorParcela = parseNum(value);
            }
            else if (field === "saldo_devedor") {
              contratoData.saldoDevedor = parseNum(value);
            }
            else if (field === "prazo_remanescente") {
              const prazo = parseInt(String(value || "0"), 10);
              contratoData.parcelasRestantes = isNaN(prazo) ? null : prazo;
            }
            else if (field === "numero_contrato") {
              contratoData.numeroContrato = String(value || "").trim() || null;
            }
            else if (field === "tipo_produto") {
              contratoData.tipoContrato = String(value || "").trim() || null;
            }
          }
          
          pessoaData.telefonesBase = telefones;
          
          // Upsert pessoa - busca por matrícula + convênio (chave composta)
          const pessoasEncontradas = await storage.getClientesByMatricula(matricula, convenio);
          let pessoa = pessoasEncontradas[0];
          
          if (pessoa) {
            pessoa = await storage.updateClientePessoa(pessoa.id, pessoaData as any);
          } else {
            pessoa = await storage.createClientePessoa(pessoaData as any);
          }
          
          if (pessoa) {
            // Create folha record
            await storage.createClienteFolhaMes({
              pessoaId: pessoa.id,
              competencia: competenciaDate,
              margemBruta70: folhaData.margem70Bruta,
              margemUtilizada70: folhaData.margem70Utilizada,
              margemSaldo70: folhaData.margem70Saldo,
              margemBruta35: folhaData.margem35Bruta,
              margemUtilizada35: folhaData.margem35Utilizada,
              margemSaldo35: folhaData.margem35Saldo,
              margemCartaoCreditoSaldo: folhaData.margemCartaoCreditoSaldo,
              margemCartaoBeneficioSaldo: folhaData.margemCartaoBeneficioSaldo,
              salarioBruto: folhaData.salarioBruto || null,
              descontosBrutos: folhaData.descontosBrutos || null,
              salarioLiquido: folhaData.salarioLiquido || null,
              sitFuncNoMes: pessoaData.sitFunc || null,
              baseTag,
            } as any);
            
            // UPSERT contrato: atualiza se existir (mesmo numero_contrato), senão cria novo
            if (contratoData.banco || contratoData.valorParcela || contratoData.numeroContrato) {
              const contratosExistentes = await storage.getContratosByPessoaId(pessoa.id);
              
              // Busca contrato existente pelo numero_contrato (chave única por pessoa)
              const contratoExistente = contratosExistentes.find(c => 
                c.numeroContrato === contratoData.numeroContrato && contratoData.numeroContrato
              );
              
              if (contratoExistente) {
                // ATUALIZAR contrato existente com novos dados (preserva pessoaId, atualiza só campos relevantes)
                const updateData: Record<string, any> = {
                  baseTag,
                  dadosBrutos: row,
                };
                // Só atualiza campos se tiverem valores na planilha
                if (contratoData.tipoContrato) updateData.tipoContrato = contratoData.tipoContrato;
                if (contratoData.banco) updateData.banco = contratoData.banco;
                if (contratoData.valorParcela !== null) updateData.valorParcela = contratoData.valorParcela;
                if (contratoData.saldoDevedor !== null) updateData.saldoDevedor = contratoData.saldoDevedor;
                if (contratoData.parcelasRestantes !== null) updateData.parcelasRestantes = contratoData.parcelasRestantes;
                // Atualiza competência só se for mais recente
                updateData.competencia = competenciaDate;
                
                await storage.updateClienteContrato(contratoExistente.id, updateData as any);
              } else {
                // CRIAR novo contrato
                await storage.createClienteContrato({
                  pessoaId: pessoa.id,
                  tipoContrato: contratoData.tipoContrato || "consignado",
                  banco: contratoData.banco,
                  valorParcela: contratoData.valorParcela,
                  saldoDevedor: contratoData.saldoDevedor,
                  parcelasRestantes: contratoData.parcelasRestantes,
                  numeroContrato: contratoData.numeroContrato,
                  competencia: competenciaDate,
                  baseTag,
                  dadosBrutos: row,
                } as any);
              }
            }
            
            totalLinhas++;
          }
          
          // Log progress every 500 rows
          if ((i + 1) % 500 === 0) {
            console.log(`[Import] Processed ${i + 1}/${data.length} rows, imported ${totalLinhas}`);
          }
        } catch (rowError) {
          console.error("[Import] Row error:", rowError);
        }
      }
      
      // Update base status to completed
      await storage.updateBaseImportada(base.id, {
        totalLinhas,
        status: "concluida",
      });
      
      console.log(`[Import] Base ${base.id} completed with ${totalLinhas} rows`);
      
      return res.json({
        message: "Importação concluída",
        baseId: base.id,
        baseTag,
        totalLinhas,
        fileName: file.originalname,
      });
    } catch (error) {
      console.error("Import error:", error);
      return res.status(500).json({ message: "Erro ao importar base" });
    }
  });


  // GET filtros disponíveis para clientes - MASTER ONLY
  app.get("/api/clientes/filtros", requireAuth, requireMaster, async (req, res) => {
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

  // GET convênios disponíveis para consulta de clientes - MASTER ONLY
  app.get("/api/clientes/filtros/convenios", requireAuth, requireMaster, async (req, res) => {
    try {
      const convenios = await storage.getDistinctConveniosClientes();
      return res.json(convenios);
    } catch (error) {
      console.error("Get convenios error:", error);
      return res.status(500).json({ message: "Erro ao buscar convênios" });
    }
  });

  // GET consulta de cliente por CPF ou matrícula - MASTER ONLY
  app.get("/api/clientes/consulta", requireAuth, requireMaster, async (req, res) => {
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

  // GET detalhes completos de um cliente - MASTER ONLY
  app.get("/api/clientes/:pessoaId", requireAuth, requireMaster, async (req, res) => {
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
          upag: pessoa.upag || null,
          natureza: pessoa.natureza,
          sit_func: pessoa.sitFunc,
          uf: pessoa.uf,
          municipio: pessoa.municipio,
          data_nascimento: pessoa.dataNascimento || null,
          telefones_base: pessoa.telefonesBase || [],
          // Dados bancários do cliente (onde recebe salário)
          banco_codigo: pessoa.bancoCodigo || null,
          agencia: pessoa.agencia || null,
          conta: pessoa.conta || null,
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
            margem_cartao_credito_saldo: folhaAtual.margemCartaoCreditoSaldo ? parseFloat(folhaAtual.margemCartaoCreditoSaldo) : null,
            margem_cartao_beneficio_saldo: folhaAtual.margemCartaoBeneficioSaldo ? parseFloat(folhaAtual.margemCartaoBeneficioSaldo) : null,
            salario_bruto: folhaAtual.salarioBruto ? parseFloat(folhaAtual.salarioBruto) : null,
            descontos_brutos: folhaAtual.descontosBrutos ? parseFloat(folhaAtual.descontosBrutos) : null,
            salario_liquido: folhaAtual.salarioLiquido ? parseFloat(folhaAtual.salarioLiquido) : null,
            creditos: folhaAtual.creditos ? parseFloat(folhaAtual.creditos) : null,
            debitos: folhaAtual.debitos ? parseFloat(folhaAtual.debitos) : null,
            liquido: folhaAtual.liquido ? parseFloat(folhaAtual.liquido) : null,
            base_tag: folhaAtual.baseTag,
            extras_folha: folhaAtual.extrasFolha,
          } : null,
          historico: folhaHistorico.map(f => ({
            competencia: f.competencia,
            margem_saldo_30: f.margemSaldo30 ? parseFloat(f.margemSaldo30) : null,
            margem_saldo_35: f.margemSaldo35 ? parseFloat(f.margemSaldo35) : null,
            margem_saldo_70: f.margemSaldo70 ? parseFloat(f.margemSaldo70) : null,
            liquido: f.liquido ? parseFloat(f.liquido) : null,
            base_tag: f.baseTag,
          })),
        },
        contratos: contratos.map(c => ({
          id: c.id,
          tipo_contrato: c.tipoContrato,
          banco: c.banco, // BANCO_DO_EMPRESTIMO
          valor_parcela: c.valorParcela ? parseFloat(c.valorParcela) : null,
          saldo_devedor: c.saldoDevedor ? parseFloat(c.saldoDevedor) : null,
          parcelas_restantes: c.parcelasRestantes || null, // prazo remanescente exato da planilha
          numero_contrato: c.numeroContrato || null,
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

  // ===== PRICING SETTINGS ENDPOINTS (MODELO DE PACOTES) =====

  // GET pricing settings - Master only - Retorna tabela de pacotes
  app.get("/api/pricing-settings", requireAuth, requireMaster, async (req, res) => {
    try {
      const pacotes = await getPacotesPreco();
      
      return res.json({
        pacotes,
        message: "Modelo de precificação por PACOTES. Os valores podem ser editados pelo administrador.",
      });
    } catch (error) {
      console.error("Get pricing settings error:", error);
      return res.status(500).json({ message: "Erro ao buscar configurações de preços" });
    }
  });

  // GET pacotes para exibição pública (usado na tela de compra)
  app.get("/api/pacotes-preco", requireAuth, async (req, res) => {
    try {
      return res.json(await getPacotesPreco());
    } catch (error) {
      console.error("Get pacotes error:", error);
      return res.status(500).json({ message: "Erro ao buscar pacotes" });
    }
  });

  // GET all pacotes from database (for admin editing)
  app.get("/api/pacotes-preco/all", requireAuth, requireMaster, async (req, res) => {
    try {
      const result = await db
        .select()
        .from(pacotesPreco)
        .orderBy(asc(pacotesPreco.ordem), asc(pacotesPreco.quantidadeMaxima));
      return res.json(result);
    } catch (error) {
      console.error("Get all pacotes error:", error);
      return res.status(500).json({ message: "Erro ao buscar pacotes" });
    }
  });

  // PUT update a pacote - Master only
  app.put("/api/pacotes-preco/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const result = updatePacotePrecoSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const updateData: Record<string, any> = { atualizadoEm: new Date() };
      if (result.data.quantidadeMaxima !== undefined) updateData.quantidadeMaxima = result.data.quantidadeMaxima;
      if (result.data.nomePacote !== undefined) updateData.nomePacote = result.data.nomePacote;
      if (result.data.preco !== undefined) updateData.preco = String(result.data.preco);
      if (result.data.ordem !== undefined) updateData.ordem = result.data.ordem;
      if (result.data.ativo !== undefined) updateData.ativo = result.data.ativo;

      const [updated] = await db
        .update(pacotesPreco)
        .set(updateData)
        .where(eq(pacotesPreco.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Pacote não encontrado" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Update pacote error:", error);
      return res.status(500).json({ message: "Erro ao atualizar pacote" });
    }
  });

  // ===== PEDIDOS LISTA ENDPOINTS =====

  // POST simular pedido de lista - MASTER ONLY
  app.post("/api/pedidos-lista/simular", requireAuth, requireMaster, async (req, res) => {
    try {

      const result = filtrosPedidoListaSchema.safeParse(req.body.filtros || req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Filtros inválidos",
          errors: result.error.errors,
        });
      }

      const filtros = result.data;
      const { clientes, total } = await storage.searchClientesPessoa(filtros);
      
      // Calcula preço usando modelo de pacotes
      const pricing = await calculatePackagePrice(total);
      
      // Return preview (first 10), total, and pricing
      return res.json({
        total,
        nomePacote: pricing.nomePacote,
        quantidadePacote: pricing.quantidadePacote,
        precoTotal: pricing.precoTotal,
        pacotes: await getPacotesPreco(), // Envia lista de pacotes para exibição
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

  // POST criar pedido de lista - MASTER ONLY
  app.post("/api/pedidos-lista", requireAuth, requireMaster, async (req, res) => {
    try {

      const result = filtrosPedidoListaSchema.safeParse(req.body.filtros || req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Filtros inválidos",
          errors: result.error.errors,
        });
      }

      const filtros = result.data;
      const { total } = await storage.searchClientesPessoa(filtros);
      
      // Calcula preço usando modelo de pacotes
      const pricing = await calculatePackagePrice(total);
      
      // Create pedido com informações do pacote
      const pedido = await storage.createPedidoLista({
        coordenadorId: req.user!.id,
        filtrosUsados: filtros,
        quantidadeRegistros: total,
        tipo: "exportacao_base",
        status: "pendente",
        nomePacote: pricing.nomePacote,
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

  // GET pedidos de lista - MASTER ONLY
  app.get("/api/pedidos-lista", requireAuth, requireMaster, async (req, res) => {
    try {
      // Master sees all
      const pedidos = await storage.getAllPedidosLista();
      
      return res.json(pedidos);
    } catch (error) {
      console.error("Get pedidos error:", error);
      return res.status(500).json({ message: "Erro ao buscar pedidos" });
    }
  });

  // ===== ADMIN PEDIDOS LISTA - MASTER ONLY =====
  
  // GET /api/pedidos-lista/admin - Lista todos os pedidos com info do coordenador - MASTER ONLY
  app.get("/api/pedidos-lista/admin", requireAuth, requireMaster, async (req, res) => {
    try {

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
        nome_pacote: p.nomePacote,
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

  // POST /api/pedidos-lista/:id/aprovar - Aprovar pedido - MASTER ONLY
  app.post("/api/pedidos-lista/:id/aprovar", requireAuth, requireMaster, async (req, res) => {
    try {

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

  // GET /api/pedidos-lista/:id/download - Download generated file - MASTER ONLY
  app.get("/api/pedidos-lista/:id/download", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const pedido = await storage.getPedidoLista(id);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido não encontrado" });
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

  // POST /api/pedidos-lista/:id/rejeitar - Rejeitar pedido - MASTER ONLY
  app.post("/api/pedidos-lista/:id/rejeitar", requireAuth, requireMaster, async (req, res) => {
    try {

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

  // ===== ACADEMIA CONSIGONE ENDPOINTS =====

  // Prompt mestre do treinador IA
  const TREINADOR_SYSTEM_PROMPT = `Você é o TREINADOR IA da Academia ConsigOne, especializado em venda de crédito consignado, cartão consignado/cartão benefício e COMPRA DE DÍVIDA (refin estratégico).

Seu objetivo é treinar corretores iniciantes de forma REALISTA e CONSULTIVA, simulando clientes e avaliando a qualidade do atendimento.

REGRAS GERAIS:
- Linguagem natural de cliente brasileiro, simples, direta e humana.
- Atendimento HUMANIZADO e CONSULTIVO: entender o cenário antes de empurrar produto.
- Foco em gerar VALOR REAL: organizar dívidas, melhorar fluxo de caixa, limpar nome, liberar fôlego.
- A operação é da ConsigOne / Gold, com diferenciais:
  - Análise profunda do cenário, comparação entre bancos e estratégias.
  - Relacionamento de longo prazo com o cliente.
  - Especialistas em operações fora do padrão (cartão, compra de dívida, clientes negativados).

PRODUTOS PRINCIPAIS:
1) Crédito consignado tradicional.
2) Cartão consignado / cartão benefício (parte limite, parte saque, desconto mínimo em folha).
3) Compra de dívida (refin estratégico):
   - Trocar dívidas caras por condição mais estruturada.
   - Muito usada para clientes negativados ou quando a portabilidade não resolve.
   - Objetivo principal: liberar mais valor de forma sustentável.
   - Redução de parcela só quando necessário para tirar o cliente do sufoco.

NÍVEIS DE TREINAMENTO (1 a 5):
1) Descoberta: acolhimento, perguntas iniciais, entender vínculo, margem, contratos e objetivo.
2) Explicação: explicar produtos com clareza, especialmente compra de dívida e cartão, sem jargão técnico.
3) Oferta: montar proposta com comparação "antes x depois", mostrando ganho real.
4) Objeções: lidar com medo, histórico ruim com financeiras, desconfiança, "vou pensar".
5) Fechamento: conduzir próximo passo com segurança, sem pressão burra.

MODOS DE OPERAÇÃO (campo "modo" na requisição):

1) modo = "roleplay_cliente"
   - Agir SOMENTE como cliente humano.
   - Recebe nível_atual, fala do corretor e, opcionalmente, um histórico resumido.
   - Responder com 1 a 3 frases, variando humor e perfil do cliente.
   - Não dar aula nem falar como consultor; é cliente conversando.

2) modo = "avaliacao_roleplay"
   - Recebe nível_atual, contexto e fala_corretor.
   - Avalia a fala do corretor em: Humanização, Consultoria, Clareza, Venda.
   - Para Nível 1, não exigir que o corretor pergunte tudo de uma vez. Ele pode perguntar por partes.
   - Responder EXCLUSIVAMENTE em JSON no formato: {"nota_global": 8.5, "nota_humanizacao": 9, "nota_consultivo": 8, "nota_clareza": 8, "nota_venda": 9, "comentario_geral": "...", "pontos_fortes": ["..."], "pontos_melhorar": ["..."], "nivel_atual": 1, "nivel_sugerido": 1, "aprovado_para_proximo_nivel": false}

3) modo = "abordagem_ia"
   - Recebe canal, tipo_cliente, produto_foco e contexto.
   - Gera abordagem inicial perfeita, natural e ética.
   - Responder EXCLUSIVAMENTE em JSON com: abertura_resumida, objetivo_abordagem, perguntas_consultivas (array), exploracao_dor, proposta_valor, gatilhos_usados (array), script_pronto_ligacao, script_pronto_whatsapp.`;

  // Helper function to get the effective roleplay prompt for a user
  async function getEffectiveRoleplayPrompt(userId: number): Promise<string> {
    try {
      // 1. Check if user belongs to a team
      const userMembership = await db.select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .limit(1);

      if (userMembership.length > 0) {
        const teamId = userMembership[0].teamId;
        
        // 2. Check for team-specific active prompt
        const teamPrompt = await db.select()
          .from(aiPrompts)
          .where(
            and(
              eq(aiPrompts.type, "roleplay"),
              eq(aiPrompts.scope, "team"),
              eq(aiPrompts.teamId, teamId),
              eq(aiPrompts.isActive, true)
            )
          )
          .limit(1);

        if (teamPrompt.length > 0) {
          console.log(`[Roleplay] Using team-specific prompt for user ${userId}, team ${teamId}`);
          return teamPrompt[0].promptText;
        }
      }

      // 3. Fallback to global prompt
      const globalPrompt = await db.select()
        .from(aiPrompts)
        .where(
          and(
            eq(aiPrompts.type, "roleplay"),
            eq(aiPrompts.scope, "global"),
            eq(aiPrompts.isActive, true)
          )
        )
        .limit(1);

      if (globalPrompt.length > 0) {
        console.log(`[Roleplay] Using global prompt for user ${userId}`);
        return globalPrompt[0].promptText;
      }

      // 4. Fallback to hardcoded default
      console.log(`[Roleplay] Using default hardcoded prompt for user ${userId}`);
      return TREINADOR_SYSTEM_PROMPT;
    } catch (error) {
      console.error("[Roleplay] Error fetching prompt, using default:", error);
      return TREINADOR_SYSTEM_PROMPT;
    }
  }

  // POST /api/treinador-consigone - Endpoint principal do treinador IA
  app.post("/api/treinador-consigone", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      const result = treinadorRequestSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      const { modo, nivelAtual, falaCorretor, canal, tipoCliente, produtoFoco, contexto, historicoResumido, sessaoId, avaliarResposta, tom, cenario } = result.data;
      const userId = req.user!.id;

      // Import OpenAI client
      const { openai } = await import("./openaiClient");

      let userMessage = "";
      let responseFormat: "text" | "json" = "text";

      // Build user message based on mode
      if (modo === "roleplay_cliente") {
        // Se há cenário mas não fala, inicia o roleplay com cenário
        if (!falaCorretor && !cenario) {
          return res.status(400).json({ message: "falaCorretor ou cenario é obrigatório para roleplay_cliente" });
        }
        
        if (cenario && !falaCorretor) {
          // Inicia roleplay direto no cenário
          userMessage = `modo: roleplay_cliente
nível_atual: ${nivelAtual}
cenario_inicial: "${cenario}"
${historicoResumido ? `historico_resumido: ${historicoResumido}` : ""}
${contexto ? `contexto: ${contexto}` : ""}

IMPORTANTE: O roleplay deve COMEÇAR já dentro desse cenário, sem saudações, sem apresentação. Responda exatamente como o cliente daquele cenário reagiria. Responda APENAS como cliente, com 1 a 3 frases naturais.`;
        } else {
          userMessage = `modo: roleplay_cliente
nível_atual: ${nivelAtual}
fala_corretor: "${falaCorretor}"
${cenario ? `cenario: "${cenario}"` : ""}
${historicoResumido ? `historico_resumido: ${historicoResumido}` : ""}
${contexto ? `contexto: ${contexto}` : ""}

Responda APENAS como cliente, com 1 a 3 frases naturais.`;
        }
        responseFormat = "text";

      } else if (modo === "avaliacao_roleplay") {
        if (!falaCorretor) {
          return res.status(400).json({ message: "falaCorretor é obrigatório para avaliacao_roleplay" });
        }
        userMessage = `modo: avaliacao_roleplay
nível_atual: ${nivelAtual}
fala_corretor: "${falaCorretor}"
${contexto ? `contexto: ${contexto}` : ""}

Avalie a performance completa do corretor na sessão de roleplay. Considere toda a conversa no contexto.
Responda EXCLUSIVAMENTE em JSON válido com EXATAMENTE esta estrutura:
{
  "nota_global": 7.5,
  "nota_humanizacao": 8,
  "nota_consultivo": 7,
  "nota_clareza": 8,
  "nota_venda": 6,
  "comentario_geral": "Seu comentário detalhado aqui",
  "pontos_fortes": ["Ponto forte 1", "Ponto forte 2"],
  "pontos_melhorar": ["Ponto a melhorar 1", "Ponto a melhorar 2"],
  "nivel_sugerido": ${nivelAtual},
  "aprovado_para_proximo_nivel": false
}
Notas devem ser de 0 a 10. Seja justo e construtivo.`;
        responseFormat = "json";

      } else if (modo === "abordagem_ia") {
        if (!canal || !tipoCliente || !produtoFoco) {
          return res.status(400).json({ message: "canal, tipoCliente e produtoFoco são obrigatórios para abordagem_ia" });
        }
        
        // Descrição detalhada do tom
        const tomDescricao = tom ? {
          consultiva_acolhedora: "Tom humano, empático, sem pressão. Perguntas abertas, validação de sentimentos. Para clientes sensíveis, negativados ou desconfiados.",
          direta_objetiva: "Linha reta, focada em benefício prático. Sem rodeios, objetivo claro. Para clientes ocupados ou servidores públicos pragmáticos.",
          persuasiva_profissional: "Usa prova social, ancoragem, autoridade. Tom de especialista que domina o assunto. Gatilhos: escassez moderada, reciprocidade.",
          alta_conversao: "Ataca dor real, cria urgência saudável. Gatilhos fortes: medo de perda, oportunidade única, tempo limitado. Para clientes indecisos que precisam de empurrão.",
          ultra_premium: "Tom consultor premium, estilo 'private banker'. Linguagem sofisticada, exclusividade. Para servidores antigos com salário alto.",
        }[tom] : null;
        
        userMessage = `modo: abordagem_ia
canal: ${canal}
tipo_cliente: ${tipoCliente}
produto_foco: ${produtoFoco}
${tom ? `tom_abordagem: ${tom}
estilo_tom: ${tomDescricao}` : ""}
${contexto ? `contexto: ${contexto}` : ""}

IMPORTANTE: Respeite o tom solicitado. O tom define estrutura, força persuasiva, velocidade da abordagem e gatilhos mentais apropriados.

Gere a abordagem e responda EXCLUSIVAMENTE em JSON válido com EXATAMENTE esta estrutura:
{
  "abertura_resumida": "Sua abertura aqui",
  "objetivo_abordagem": "Objetivo claro da abordagem",
  "perguntas_consultivas": ["Pergunta 1?", "Pergunta 2?", "Pergunta 3?"],
  "exploracao_dor": "Como explorar a dor do cliente",
  "proposta_valor": "Proposta de valor clara",
  "gatilhos_usados": ["Gatilho 1", "Gatilho 2"],
  "script_pronto_whatsapp": "Script completo para WhatsApp com emojis e formatação",
  "script_pronto_ligacao": "Script completo para ligação telefônica"
}`;
        responseFormat = "json";
      }

      console.log(`[Academia] Calling OpenAI for mode: ${modo}, user: ${userId}`);

      // Get the effective prompt for this user (team-specific or global)
      const effectivePrompt = await getEffectiveRoleplayPrompt(userId);

      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: effectivePrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const aiResponse = completion.choices[0]?.message?.content || "";
      console.log(`[Academia] OpenAI response received, length: ${aiResponse.length}`);

      // Process response based on mode
      const LIMITE_MENSAGENS_ROLEPLAY = 10; // Limite de mensagens do corretor por sessão
      
      if (modo === "roleplay_cliente") {
        // Get or create session
        let sessao;
        if (sessaoId) {
          sessao = await db.select().from(roleplaySessoes).where(eq(roleplaySessoes.id, sessaoId)).limit(1);
          if (sessao.length === 0) {
            return res.status(404).json({ message: "Sessão não encontrada" });
          }
          sessao = sessao[0];
          
          // Verificar se sessão já foi finalizada
          if (sessao.status === "finalizada") {
            return res.status(400).json({ 
              message: "Esta sessão já foi finalizada. Inicie uma nova sessão.",
              sessaoFinalizada: true 
            });
          }
          
          // Verificar se já atingiu o limite ANTES de processar
          if ((sessao.totalMensagens || 0) >= LIMITE_MENSAGENS_ROLEPLAY) {
            // Marcar como finalizada se ainda não estiver
            await db.update(roleplaySessoes)
              .set({ status: "finalizada", finalizadoEm: new Date() })
              .where(eq(roleplaySessoes.id, sessao.id));
            
            return res.status(400).json({ 
              message: "Limite de mensagens atingido. Inicie uma nova sessão.",
              sessaoFinalizada: true,
              mensagensEnviadas: sessao.totalMensagens || 0,
              limiteMensagens: LIMITE_MENSAGENS_ROLEPLAY
            });
          }
        } else {
          const [newSessao] = await db.insert(roleplaySessoes).values({
            userId,
            nivelTreinado: nivelAtual,
            status: "ativa",
            historicoConversa: [],
            cenario: cenario || null,
            totalMensagens: 0,
          }).returning();
          sessao = newSessao;
        }

        // Incrementar contador de mensagens do corretor
        const novoTotalMensagens = (sessao.totalMensagens || 0) + 1;
        const atingiuLimite = novoTotalMensagens >= LIMITE_MENSAGENS_ROLEPLAY;
        
        // Update conversation history
        const historico = (sessao.historicoConversa as any[]) || [];
        historico.push({ role: "corretor", content: falaCorretor, timestamp: new Date() });
        historico.push({ role: "cliente", content: aiResponse, timestamp: new Date() });

        await db.update(roleplaySessoes)
          .set({ 
            historicoConversa: historico,
            totalMensagens: novoTotalMensagens,
            status: atingiuLimite ? "finalizada" : "ativa",
            finalizadoEm: atingiuLimite ? new Date() : null,
          })
          .where(eq(roleplaySessoes.id, sessao.id));
        
        // Se atingiu o limite, incrementar totalSimulacoes do vendedor
        if (atingiuLimite) {
          // Atualizar contagem de simulações finalizadas
          const [sessoesFinalizadas] = await db.select({ count: sql`count(*)` })
            .from(roleplaySessoes)
            .where(and(
              eq(roleplaySessoes.userId, userId),
              eq(roleplaySessoes.status, "finalizada")
            ));
          
          await db.update(vendedoresAcademia)
            .set({ 
              totalSimulacoes: Number(sessoesFinalizadas?.count || 0),
              atualizadoEm: new Date(),
            })
            .where(eq(vendedoresAcademia.userId, userId));
        }

        // If inline evaluation is requested, make a second call
        let avaliacao = null;
        if (avaliarResposta && falaCorretor) {
          const avaliacaoPrompt = `Avalie esta fala do corretor de forma BREVE e DIRETA.
Nível: ${nivelAtual}
Contexto: ${contexto || "Início de conversa"}
Fala do corretor: "${falaCorretor}"

Responda EXCLUSIVAMENTE em JSON:
{"nota": 7.5, "feedback": "Breve feedback de 1 frase", "pontoPositivo": "1 ponto positivo curto", "pontoMelhorar": "1 sugestão curta"}`;

          try {
            const avaliacaoCompletion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: "Você é um avaliador de vendas consultivas. Seja conciso e direto. Sempre responda em JSON válido." },
                { role: "user", content: avaliacaoPrompt },
              ],
              temperature: 0.5,
              max_tokens: 300,
            });

            const avaliacaoRaw = avaliacaoCompletion.choices[0]?.message?.content || "";
            let cleanAval = avaliacaoRaw.trim();
            if (cleanAval.startsWith("```json")) {
              cleanAval = cleanAval.replace(/```json\n?/, "").replace(/```$/, "");
            } else if (cleanAval.startsWith("```")) {
              cleanAval = cleanAval.replace(/```\n?/, "").replace(/```$/, "");
            }
            avaliacao = JSON.parse(cleanAval);
          } catch (e) {
            console.error("[Academia] Failed to parse inline avaliacao:", e);
            // Continue without evaluation if it fails
          }
        }

        return res.json({
          falaCliente: aiResponse,
          sessaoId: sessao.id,
          avaliacao,
          mensagensEnviadas: novoTotalMensagens,
          limiteMensagens: LIMITE_MENSAGENS_ROLEPLAY,
          sessaoFinalizada: atingiuLimite,
        });

      } else if (modo === "avaliacao_roleplay") {
        // Parse JSON response
        let avaliacao;
        try {
          // Remove markdown code blocks if present
          let cleanResponse = aiResponse.trim();
          if (cleanResponse.startsWith("```json")) {
            cleanResponse = cleanResponse.replace(/```json\n?/, "").replace(/```$/, "");
          } else if (cleanResponse.startsWith("```")) {
            cleanResponse = cleanResponse.replace(/```\n?/, "").replace(/```$/, "");
          }
          avaliacao = JSON.parse(cleanResponse);
        } catch (e) {
          console.error("[Academia] Failed to parse avaliacao JSON:", e);
          return res.status(500).json({ message: "Erro ao processar avaliação da IA" });
        }

        // Save evaluation if we have a session
        if (sessaoId) {
          await db.insert(roleplayAvaliacoes).values({
            sessaoId,
            userId,
            falaCorretor: falaCorretor!,
            notaGlobal: String(avaliacao.nota_global || 0),
            notaHumanizacao: String(avaliacao.nota_humanizacao || 0),
            notaConsultivo: String(avaliacao.nota_consultivo || 0),
            notaClareza: String(avaliacao.nota_clareza || 0),
            notaVenda: String(avaliacao.nota_venda || 0),
            comentarioGeral: avaliacao.comentario_geral,
            pontosFortes: avaliacao.pontos_fortes || [],
            pontosMelhorar: avaliacao.pontos_melhorar || [],
            nivelSugerido: avaliacao.nivel_sugerido,
            aprovadoProximoNivel: avaliacao.aprovado_para_proximo_nivel || false,
          });

          // Marcar sessão como finalizada (se ainda não estiver)
          await db.update(roleplaySessoes)
            .set({ status: "finalizada", finalizadoEm: new Date() })
            .where(and(
              eq(roleplaySessoes.id, sessaoId),
              eq(roleplaySessoes.status, "ativa")
            ));

          // Update user's average score from all evaluations
          const avaliacoes = await db.select().from(roleplayAvaliacoes).where(eq(roleplayAvaliacoes.userId, userId));
          
          // Count finalized sessions for totalSimulacoes
          const [sessoesFinalizadas] = await db.select({ count: sql`count(*)` })
            .from(roleplaySessoes)
            .where(and(
              eq(roleplaySessoes.userId, userId),
              eq(roleplaySessoes.status, "finalizada")
            ));
          
          if (avaliacoes.length > 0) {
            const mediaGlobal = avaliacoes.reduce((acc, a) => acc + parseFloat(a.notaGlobal), 0) / avaliacoes.length;
            await db.update(vendedoresAcademia)
              .set({ 
                notaMediaGlobal: String(mediaGlobal.toFixed(2)),
                totalSimulacoes: Number(sessoesFinalizadas?.count || 0),
                atualizadoEm: new Date(),
              })
              .where(eq(vendedoresAcademia.userId, userId));
          }
        }

        return res.json(avaliacao);

      } else if (modo === "abordagem_ia") {
        // Parse JSON response
        let abordagem;
        try {
          let cleanResponse = aiResponse.trim();
          if (cleanResponse.startsWith("```json")) {
            cleanResponse = cleanResponse.replace(/```json\n?/, "").replace(/```$/, "");
          } else if (cleanResponse.startsWith("```")) {
            cleanResponse = cleanResponse.replace(/```\n?/, "").replace(/```$/, "");
          }
          abordagem = JSON.parse(cleanResponse);
        } catch (e) {
          console.error("[Academia] Failed to parse abordagem JSON:", e);
          return res.status(500).json({ message: "Erro ao processar abordagem da IA" });
        }

        // Save generated approach
        await db.insert(abordagensGeradas).values({
          userId,
          canal: canal!,
          tipoCliente: tipoCliente!,
          produtoFoco: produtoFoco!,
          contexto,
          aberturaResumida: abordagem.abertura_resumida,
          objetivoAbordagem: abordagem.objetivo_abordagem,
          perguntasConsultivas: abordagem.perguntas_consultivas || [],
          exploracaoDor: abordagem.exploracao_dor,
          propostaValor: abordagem.proposta_valor,
          gatilhosUsados: abordagem.gatilhos_usados || [],
          scriptLigacao: abordagem.script_pronto_ligacao,
          scriptWhatsapp: abordagem.script_pronto_whatsapp,
        });

        return res.json(abordagem);
      }

    } catch (error) {
      console.error("Treinador IA error:", error);
      return res.status(500).json({ message: "Erro ao processar treinamento" });
    }
  });

  // GET /api/academia/perfil - Perfil do vendedor na academia
  app.get("/api/academia/perfil", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get or create profile
      let [perfil] = await db.select().from(vendedoresAcademia).where(eq(vendedoresAcademia.userId, userId)).limit(1);
      
      if (!perfil) {
        [perfil] = await db.insert(vendedoresAcademia).values({
          userId,
          nivelAtual: 1,
          quizAprovado: false,
          totalSimulacoes: 0,
        }).returning();
      }

      // Get recent evaluations
      const avaliacoes = await db.select()
        .from(roleplayAvaliacoes)
        .where(eq(roleplayAvaliacoes.userId, userId))
        .orderBy(sql`${roleplayAvaliacoes.criadoEm} DESC`)
        .limit(10);

      return res.json({
        perfil,
        avaliacoesRecentes: avaliacoes,
      });
    } catch (error) {
      console.error("Get academia perfil error:", error);
      return res.status(500).json({ message: "Erro ao buscar perfil" });
    }
  });

  // Quiz perguntas (estáticas por enquanto)
  const QUIZ_PERGUNTAS = [
    {
      id: 1,
      pergunta: "Qual é o principal objetivo da COMPRA DE DÍVIDA (refin estratégico)?",
      opcoes: [
        "Apenas reduzir a parcela do cliente",
        "Trocar dívidas caras por condição mais estruturada, liberando valor",
        "Vender mais produtos ao cliente",
        "Negativar o cliente no SPC",
      ],
      correta: 1,
    },
    {
      id: 2,
      pergunta: "Qual é a característica do cartão consignado/benefício?",
      opcoes: [
        "Desconto total da fatura em folha",
        "Parte limite, parte saque, desconto mínimo em folha",
        "Não tem limite de crédito",
        "Só funciona para aposentados",
      ],
      correta: 1,
    },
    {
      id: 3,
      pergunta: "No atendimento consultivo, o que deve ser feito PRIMEIRO?",
      opcoes: [
        "Oferecer o produto com maior comissão",
        "Pedir todos os documentos do cliente",
        "Entender o cenário e objetivo do cliente",
        "Fechar a venda rapidamente",
      ],
      correta: 2,
    },
    {
      id: 4,
      pergunta: "Quando a COMPRA DE DÍVIDA é mais indicada?",
      opcoes: [
        "Quando o cliente quer aumentar suas dívidas",
        "Quando a portabilidade não resolve e/ou cliente está negativado",
        "Apenas para clientes com nome limpo",
        "Quando o cliente não tem margem",
      ],
      correta: 1,
    },
    {
      id: 5,
      pergunta: "Qual é o diferencial da ConsigOne/Gold no atendimento?",
      opcoes: [
        "Atendimento rápido sem perguntas",
        "Análise profunda do cenário, comparação entre bancos e relacionamento de longo prazo",
        "Menor taxa do mercado garantida",
        "Atendimento apenas por WhatsApp",
      ],
      correta: 1,
    },
  ];

  // GET /api/academia/niveis - Retorna estrutura de níveis e lições
  app.get("/api/academia/niveis", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      const { NIVEIS_ACADEMIA } = await import("@shared/academia-conteudo");
      return res.json({ niveis: NIVEIS_ACADEMIA });
    } catch (error) {
      console.error("Get niveis error:", error);
      return res.status(500).json({ message: "Erro ao buscar níveis" });
    }
  });

  // GET /api/academia/progresso - Retorna progresso do usuário nas lições
  app.get("/api/academia/progresso", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      const userId = req.user!.id;
      const progresso = await storage.getProgressoLicoesByUser(userId);
      const perfil = await storage.getVendedorAcademia(userId);
      
      return res.json({ 
        progresso,
        quizAprovado: perfil?.quizAprovado || false,
        nivelAtual: perfil?.nivelAtual || 1,
      });
    } catch (error) {
      console.error("Get progresso error:", error);
      return res.status(500).json({ message: "Erro ao buscar progresso" });
    }
  });

  // POST /api/academia/licoes/concluir - Marcar lição como concluída
  app.post("/api/academia/licoes/concluir", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { licaoId, nivelId, respostasAtividade } = req.body;

      if (!licaoId || !nivelId) {
        return res.status(400).json({ message: "licaoId e nivelId são obrigatórios" });
      }

      const progresso = await storage.upsertProgressoLicao({
        userId,
        licaoId,
        nivelId,
        concluida: true,
        respostasAtividade: respostasAtividade || null,
      });

      // Count completed lessons for this level
      const { NIVEIS_ACADEMIA } = await import("@shared/academia-conteudo");
      const nivel = NIVEIS_ACADEMIA.find(n => n.id === nivelId);
      const totalLicoes = nivel?.licoes.length || 0;
      const licoesConcluidas = await storage.countLicoesConcluidas(userId, nivelId);
      
      const nivelCompleto = licoesConcluidas >= totalLicoes;

      return res.json({ 
        progresso,
        licoesConcluidas,
        totalLicoes,
        nivelCompleto,
      });
    } catch (error) {
      console.error("Concluir licao error:", error);
      return res.status(500).json({ message: "Erro ao concluir lição" });
    }
  });

  // GET /api/academia/quiz - Retorna perguntas do quiz
  app.get("/api/academia/quiz", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      // Return questions without correct answers
      const perguntas = QUIZ_PERGUNTAS.map(p => ({
        id: p.id,
        pergunta: p.pergunta,
        opcoes: p.opcoes,
      }));
      
      return res.json({ perguntas });
    } catch (error) {
      console.error("Get quiz error:", error);
      return res.status(500).json({ message: "Erro ao buscar quiz" });
    }
  });

  // POST /api/academia/quiz - Submeter respostas do quiz
  app.post("/api/academia/quiz", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { respostas } = req.body; // { perguntaId: opcaoIndex }

      if (!respostas || typeof respostas !== "object") {
        return res.status(400).json({ message: "Respostas são obrigatórias" });
      }

      // Calculate score
      let acertos = 0;
      const total = QUIZ_PERGUNTAS.length;
      const resultados: { perguntaId: number; correto: boolean; respostaCorreta: number }[] = [];

      for (const pergunta of QUIZ_PERGUNTAS) {
        const respostaUsuario = respostas[pergunta.id];
        const correto = respostaUsuario === pergunta.correta;
        if (correto) acertos++;
        resultados.push({
          perguntaId: pergunta.id,
          correto,
          respostaCorreta: pergunta.correta,
        });
      }

      const aprovado = acertos >= Math.ceil(total * 0.7); // 70% para passar

      // Save attempt
      await db.insert(quizTentativas).values({
        userId,
        respostas,
        acertos,
        total,
        aprovado,
      });

      // Update profile if approved
      if (aprovado) {
        const [perfil] = await db.select().from(vendedoresAcademia).where(eq(vendedoresAcademia.userId, userId)).limit(1);
        
        if (perfil) {
          await db.update(vendedoresAcademia)
            .set({ 
              quizAprovado: true,
              quizAprovadoEm: new Date(),
              atualizadoEm: new Date(),
            })
            .where(eq(vendedoresAcademia.userId, userId));
        } else {
          await db.insert(vendedoresAcademia).values({
            userId,
            nivelAtual: 1,
            quizAprovado: true,
            quizAprovadoEm: new Date(),
            totalSimulacoes: 0,
          });
        }
      }

      return res.json({
        acertos,
        total,
        percentual: Math.round((acertos / total) * 100),
        aprovado,
        resultados,
        mensagem: aprovado 
          ? "Parabéns! Você foi aprovado e pode acessar os módulos de IA."
          : "Você não atingiu a pontuação mínima (70%). Revise o conteúdo e tente novamente.",
      });
    } catch (error) {
      console.error("Submit quiz error:", error);
      return res.status(500).json({ message: "Erro ao submeter quiz" });
    }
  });

  // GET /api/academia/sessoes - Listar sessões de roleplay do usuário
  app.get("/api/academia/sessoes", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      const sessoes = await db.select()
        .from(roleplaySessoes)
        .where(eq(roleplaySessoes.userId, userId))
        .orderBy(sql`${roleplaySessoes.criadoEm} DESC`)
        .limit(20);

      return res.json(sessoes);
    } catch (error) {
      console.error("Get sessoes error:", error);
      return res.status(500).json({ message: "Erro ao buscar sessões" });
    }
  });

  // POST /api/academia/sessoes/:id/finalizar - Finalizar sessão de roleplay
  app.post("/api/academia/sessoes/:id/finalizar", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      const userId = req.user!.id;
      const sessaoId = parseInt(req.params.id);

      if (isNaN(sessaoId)) {
        return res.status(400).json({ message: "ID de sessão inválido" });
      }

      const [sessao] = await db.select()
        .from(roleplaySessoes)
        .where(and(eq(roleplaySessoes.id, sessaoId), eq(roleplaySessoes.userId, userId)))
        .limit(1);

      if (!sessao) {
        return res.status(404).json({ message: "Sessão não encontrada" });
      }

      await db.update(roleplaySessoes)
        .set({ status: "finalizada", finalizadoEm: new Date() })
        .where(eq(roleplaySessoes.id, sessaoId));

      return res.json({ message: "Sessão finalizada com sucesso" });
    } catch (error) {
      console.error("Finalizar sessao error:", error);
      return res.status(500).json({ message: "Erro ao finalizar sessão" });
    }
  });

  // GET /api/academia/abordagens - Listar abordagens geradas pelo usuário
  app.get("/api/academia/abordagens", requireAuth, requireAcademiaAccess, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      const abordagens = await db.select()
        .from(abordagensGeradas)
        .where(eq(abordagensGeradas.userId, userId))
        .orderBy(sql`${abordagensGeradas.criadoEm} DESC`)
        .limit(20);

      return res.json(abordagens);
    } catch (error) {
      console.error("Get abordagens error:", error);
      return res.status(500).json({ message: "Erro ao buscar abordagens" });
    }
  });

  // ===== ADMIN ACADEMIA ENDPOINTS (MASTER AND COORDINATORS) =====
  
  // Helper to get team user IDs for coordinators
  async function getAcademiaTeamUserIds(user: User): Promise<number[] | null> {
    if (user.role === "master") {
      return null; // Master sees all
    }
    // Coordinator sees their team members (users with managerId = current user)
    const teamMembersData = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.managerId, user.id));
    return [user.id, ...teamMembersData.map(m => m.id)];
  }

  // GET /api/academia/admin/stats - Estatísticas gerais
  app.get("/api/academia/admin/stats", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const teamUserIds = await getAcademiaTeamUserIds(req.user!);
      
      // Total de vendedores na academia
      let vendedoresQuery = db.select({ count: sql`count(*)` }).from(vendedoresAcademia);
      if (teamUserIds) {
        vendedoresQuery = vendedoresQuery.where(inArray(vendedoresAcademia.userId, teamUserIds)) as any;
      }
      const [totalVendedores] = await vendedoresQuery;
      
      // Total aprovados no quiz
      let quizAprovadosQuery = db.select({ count: sql`count(*)` })
        .from(vendedoresAcademia)
        .where(eq(vendedoresAcademia.quizAprovado, true));
      if (teamUserIds) {
        quizAprovadosQuery = quizAprovadosQuery.where(inArray(vendedoresAcademia.userId, teamUserIds)) as any;
      }
      const [quizAprovados] = await quizAprovadosQuery;
      
      // Total de simulações
      let simulacoesQuery = db.select({ count: sql`count(*)` }).from(roleplaySessoes);
      if (teamUserIds) {
        simulacoesQuery = simulacoesQuery.where(inArray(roleplaySessoes.userId, teamUserIds)) as any;
      }
      const [totalSimulacoes] = await simulacoesQuery;
      
      // Total de abordagens geradas
      let abordagensQuery = db.select({ count: sql`count(*)` }).from(abordagensGeradas);
      if (teamUserIds) {
        abordagensQuery = abordagensQuery.where(inArray(abordagensGeradas.userId, teamUserIds)) as any;
      }
      const [totalAbordagens] = await abordagensQuery;
      
      // Média geral de notas
      let notasQuery = db.select({ 
        avg: sql`avg(cast(${roleplayAvaliacoes.notaGlobal} as decimal))` 
      }).from(roleplayAvaliacoes);
      if (teamUserIds) {
        notasQuery = notasQuery.where(inArray(roleplayAvaliacoes.userId, teamUserIds)) as any;
      }
      const [mediaNotas] = await notasQuery;

      return res.json({
        totalVendedores: Number(totalVendedores?.count || 0),
        quizAprovados: Number(quizAprovados?.count || 0),
        totalSimulacoes: Number(totalSimulacoes?.count || 0),
        totalAbordagens: Number(totalAbordagens?.count || 0),
        mediaNotas: mediaNotas?.avg ? parseFloat(String(mediaNotas.avg)).toFixed(2) : "0.00",
      });
    } catch (error) {
      console.error("Get academia stats error:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  // GET /api/academia/admin/vendedores - Listar todos os vendedores com progresso
  app.get("/api/academia/admin/vendedores", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const teamUserIds = await getAcademiaTeamUserIds(req.user!);
      
      let vendedoresQuery = db.select({
        id: vendedoresAcademia.id,
        userId: vendedoresAcademia.userId,
        userName: users.name,
        userEmail: users.email,
        nivelAtual: vendedoresAcademia.nivelAtual,
        quizAprovado: vendedoresAcademia.quizAprovado,
        quizAprovadoEm: vendedoresAcademia.quizAprovadoEm,
        totalSimulacoes: vendedoresAcademia.totalSimulacoes,
        notaMediaGlobal: vendedoresAcademia.notaMediaGlobal,
        criadoEm: vendedoresAcademia.criadoEm,
      })
        .from(vendedoresAcademia)
        .leftJoin(users, eq(vendedoresAcademia.userId, users.id));
      
      if (teamUserIds) {
        vendedoresQuery = vendedoresQuery.where(inArray(vendedoresAcademia.userId, teamUserIds)) as any;
      }
      
      const vendedores = await vendedoresQuery.orderBy(sql`${vendedoresAcademia.criadoEm} DESC`);

      return res.json(vendedores);
    } catch (error) {
      console.error("Get vendedores academia error:", error);
      return res.status(500).json({ message: "Erro ao buscar vendedores" });
    }
  });

  // GET /api/academia/admin/quiz-tentativas - Listar tentativas de quiz
  app.get("/api/academia/admin/quiz-tentativas", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const teamUserIds = await getAcademiaTeamUserIds(req.user!);
      
      let tentativasQuery = db.select({
        id: quizTentativas.id,
        userId: quizTentativas.userId,
        userName: users.name,
        userEmail: users.email,
        acertos: quizTentativas.acertos,
        total: quizTentativas.total,
        aprovado: quizTentativas.aprovado,
        criadoEm: quizTentativas.criadoEm,
      })
        .from(quizTentativas)
        .leftJoin(users, eq(quizTentativas.userId, users.id));
      
      if (teamUserIds) {
        tentativasQuery = tentativasQuery.where(inArray(quizTentativas.userId, teamUserIds)) as any;
      }
      
      const tentativas = await tentativasQuery
        .orderBy(sql`${quizTentativas.criadoEm} DESC`)
        .limit(100);

      return res.json(tentativas);
    } catch (error) {
      console.error("Get quiz tentativas error:", error);
      return res.status(500).json({ message: "Erro ao buscar tentativas" });
    }
  });

  // POST /api/academia/admin/feedback-ia/:userId - Gerar feedback IA para um vendedor
  app.post("/api/academia/admin/feedback-ia/:userId", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Verify coordinator can only access their team members
      const teamUserIds = await getAcademiaTeamUserIds(req.user!);
      if (teamUserIds && !teamUserIds.includes(userId)) {
        return res.status(403).json({ message: "Acesso negado - usuário não pertence à sua equipe" });
      }
      
      // Buscar dados do vendedor
      const [vendedor] = await db.select({
        id: vendedoresAcademia.id,
        userId: vendedoresAcademia.userId,
        userName: users.name,
        userEmail: users.email,
        nivelAtual: vendedoresAcademia.nivelAtual,
        quizAprovado: vendedoresAcademia.quizAprovado,
        quizAprovadoEm: vendedoresAcademia.quizAprovadoEm,
        totalSimulacoes: vendedoresAcademia.totalSimulacoes,
        notaMediaGlobal: vendedoresAcademia.notaMediaGlobal,
        criadoEm: vendedoresAcademia.criadoEm,
      })
        .from(vendedoresAcademia)
        .leftJoin(users, eq(vendedoresAcademia.userId, users.id))
        .where(eq(vendedoresAcademia.userId, userId))
        .limit(1);
      
      if (!vendedor) {
        return res.status(404).json({ message: "Vendedor não encontrado" });
      }

      // Buscar tentativas de quiz
      const tentativasQuiz = await db.select()
        .from(quizTentativas)
        .where(eq(quizTentativas.userId, userId))
        .orderBy(sql`${quizTentativas.criadoEm} DESC`);

      // Buscar sessões de roleplay e avaliações
      const sessoesRoleplay = await db.select()
        .from(roleplaySessoes)
        .where(eq(roleplaySessoes.userId, userId))
        .orderBy(sql`${roleplaySessoes.criadoEm} DESC`)
        .limit(20);

      // Buscar avaliações de roleplay
      const avaliacoesRoleplay = await db.select()
        .from(roleplayAvaliacoes)
        .where(eq(roleplayAvaliacoes.userId, userId))
        .orderBy(sql`${roleplayAvaliacoes.criadoEm} DESC`)
        .limit(50);

      // Buscar abordagens geradas
      const abordagens = await db.select()
        .from(abordagensGeradas)
        .where(eq(abordagensGeradas.userId, userId))
        .orderBy(sql`${abordagensGeradas.criadoEm} DESC`)
        .limit(20);

      // Buscar progresso das lições
      const progressoLicoesData = await db.select()
        .from(progressoLicoes)
        .where(eq(progressoLicoes.userId, userId));

      // Calcular métricas agregadas
      const totalTentativasQuiz = tentativasQuiz.length;
      const quizAprovacoes = tentativasQuiz.filter(t => t.aprovado).length;
      const taxaAprovacaoQuiz = totalTentativasQuiz > 0 ? (quizAprovacoes / totalTentativasQuiz) * 100 : 0;
      
      const notasRoleplay = avaliacoesRoleplay.map(a => parseFloat(a.notaGlobal as string)).filter(n => !isNaN(n));
      const mediaNotaRoleplay = notasRoleplay.length > 0 ? notasRoleplay.reduce((a, b) => a + b, 0) / notasRoleplay.length : 0;
      
      const notasHumanizacao = avaliacoesRoleplay.map(a => a.notaHumanizacao ? parseFloat(a.notaHumanizacao as string) : 0).filter(n => n > 0);
      const mediaHumanizacao = notasHumanizacao.length > 0 ? notasHumanizacao.reduce((a, b) => a + b, 0) / notasHumanizacao.length : 0;
      
      const notasConsultivo = avaliacoesRoleplay.map(a => a.notaConsultivo ? parseFloat(a.notaConsultivo as string) : 0).filter(n => n > 0);
      const mediaConsultivo = notasConsultivo.length > 0 ? notasConsultivo.reduce((a, b) => a + b, 0) / notasConsultivo.length : 0;
      
      const notasVenda = avaliacoesRoleplay.map(a => a.notaVenda ? parseFloat(a.notaVenda as string) : 0).filter(n => n > 0);
      const mediaVenda = notasVenda.length > 0 ? notasVenda.reduce((a, b) => a + b, 0) / notasVenda.length : 0;

      // Pontos fortes e melhorar agregados das avaliações
      const todosFortes: string[] = [];
      const todosMelhorar: string[] = [];
      avaliacoesRoleplay.forEach(a => {
        if (Array.isArray(a.pontosFortes)) todosFortes.push(...(a.pontosFortes as string[]));
        if (Array.isArray(a.pontosMelhorar)) todosMelhorar.push(...(a.pontosMelhorar as string[]));
      });

      // Frequência dos pontos fortes e melhorar
      const contarFrequencia = (arr: string[]) => {
        const freq: Record<string, number> = {};
        arr.forEach(item => {
          if (item) freq[item] = (freq[item] || 0) + 1;
        });
        return Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([ponto, count]) => ({ ponto, count }));
      };

      const pontosFortesMaisFrequentes = contarFrequencia(todosFortes);
      const pontosMelhorarMaisFrequentes = contarFrequencia(todosMelhorar);

      // Calcular recorrência de treino (últimos 30 dias)
      const hoje = new Date();
      const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const sessoesUltimos30Dias = sessoesRoleplay.filter(s => new Date(s.criadoEm) >= trintaDiasAtras).length;
      const abordagensUltimos30Dias = abordagens.filter(a => new Date(a.criadoEm) >= trintaDiasAtras).length;
      
      // Tipos de abordagem mais usados
      const canaisUsados = abordagens.reduce((acc, a) => {
        acc[a.canal] = (acc[a.canal] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const tiposClienteAbordados = abordagens.reduce((acc, a) => {
        acc[a.tipoCliente] = (acc[a.tipoCliente] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Lições concluídas
      const licoesConcluidas = progressoLicoesData.filter(p => p.concluida).length;
      const totalLicoes = 25; // 5 níveis × 5 lições

      // Preparar contexto para a IA
      const contextoDados = {
        vendedor: {
          nome: vendedor.userName,
          nivelAtual: vendedor.nivelAtual,
          quizAprovado: vendedor.quizAprovado,
          dataAprovacaoQuiz: vendedor.quizAprovadoEm,
          totalSimulacoes: vendedor.totalSimulacoes,
          notaMediaGlobal: vendedor.notaMediaGlobal,
          dataInicio: vendedor.criadoEm,
        },
        quiz: {
          totalTentativas: totalTentativasQuiz,
          aprovacoes: quizAprovacoes,
          taxaAprovacao: taxaAprovacaoQuiz.toFixed(1),
        },
        roleplay: {
          totalSessoes: sessoesRoleplay.length,
          sessoesUltimos30Dias,
          totalAvaliacoes: avaliacoesRoleplay.length,
          mediaNotaGlobal: mediaNotaRoleplay.toFixed(2),
          mediaHumanizacao: mediaHumanizacao.toFixed(2),
          mediaConsultivo: mediaConsultivo.toFixed(2),
          mediaVenda: mediaVenda.toFixed(2),
          pontosFortesMaisFrequentes,
          pontosMelhorarMaisFrequentes,
        },
        abordagens: {
          totalGeradas: abordagens.length,
          abordagensUltimos30Dias,
          canaisUsados,
          tiposClienteAbordados,
        },
        fundamentos: {
          licoesConcluidas,
          totalLicoes,
          percentualConclusao: ((licoesConcluidas / totalLicoes) * 100).toFixed(1),
        },
      };

      // Gerar feedback com IA
      const { openai } = await import("./openaiClient");

      const systemPrompt = `Você é um analista de desempenho de vendas especializado em crédito consignado brasileiro.
Sua função é analisar dados de treinamento de vendedores e fornecer feedback construtivo, personalizado e acionável.

FORMATO DE RESPOSTA (JSON):
{
  "resumoGeral": "Parágrafo resumindo o progresso geral do vendedor",
  "recorrenciaTreino": "Avaliação da frequência e consistência de treinos",
  "desempenhoQuiz": "Análise do desempenho nos quizzes de fundamentos",
  "evolucaoRoleplay": "Análise da evolução nas simulações de atendimento",
  "usoAbordagens": "Análise do uso do gerador de abordagens",
  "pontosFortes": ["Lista de 3-5 pontos fortes identificados"],
  "areasDesenvolvimento": ["Lista de 3-5 áreas para desenvolvimento"],
  "recomendacoes": ["Lista de 3-5 recomendações práticas e específicas"],
  "proximosPassos": "Sugestão de próximos passos prioritários",
  "notaGeral": 8.5
}

CRITÉRIOS DE AVALIAÇÃO:
- Recorrência: Ideal é treinar pelo menos 3x por semana
- Quiz: Taxa de aprovação acima de 70% é bom
- Roleplay: Notas acima de 7.0 indicam bom desempenho
- Abordagens: Usar regularmente indica preparação para atendimentos

Seja encorajador mas honesto. Forneça insights acionáveis.`;

      const userMessage = `Analise os dados de treinamento deste vendedor e gere um feedback completo:

${JSON.stringify(contextoDados, null, 2)}

Lembre-se: Este feedback será usado pelo gestor para acompanhar o desenvolvimento do vendedor. Seja específico e construtivo.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const feedbackText = completion.choices[0]?.message?.content || "{}";
      let feedback;
      try {
        feedback = JSON.parse(feedbackText);
      } catch {
        feedback = { resumoGeral: feedbackText, erro: "Formato inválido" };
      }

      // Salvar feedback no histórico
      const adminId = req.user!.id;
      await db.insert(feedbacksIAHistorico).values({
        userId,
        geradoPorId: adminId,
        notaGeral: String(feedback.notaGeral || 0),
        resumo: feedback.resumoGeral || "",
        pontosFortes: feedback.pontosFortes || [],
        areasDesenvolvimento: feedback.areasDesenvolvimento || [],
        recomendacoes: feedback.recomendacoes || [],
        proximosPassos: feedback.proximosPassos ? [feedback.proximosPassos] : [],
        metricas: contextoDados,
      });

      return res.json({
        vendedor: contextoDados.vendedor,
        metricas: {
          quiz: contextoDados.quiz,
          roleplay: contextoDados.roleplay,
          abordagens: contextoDados.abordagens,
          fundamentos: contextoDados.fundamentos,
        },
        feedback,
      });

    } catch (error) {
      console.error("Feedback IA error:", error);
      return res.status(500).json({ message: "Erro ao gerar feedback" });
    }
  });

  // ===== CRM DE VENDAS =====
  
  // Middleware para acesso ao CRM (master, atendimento)
  function requireCRMAdmin(req: Request, res: Response, next: NextFunction) {
    if (!hasRole(req.user, ["master", "atendimento"])) {
      return res.status(403).json({ message: "Acesso negado - apenas administradores do CRM" });
    }
    next();
  }
  
  // GET /api/vendas/campanhas - Listar campanhas
  app.get("/api/vendas/campanhas", requireAuth, async (req, res) => {
    try {
      const userRole = req.user!.role as UserRole;
      
      // Admin/Atendimento veem todas, vendedor não vê campanhas diretamente
      if (!hasRole(req.user, ["master", "atendimento", "coordenacao"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const campanhas = await storage.getAllSalesCampaigns();
      return res.json(campanhas);
    } catch (error) {
      console.error("Get campanhas error:", error);
      return res.status(500).json({ message: "Erro ao buscar campanhas" });
    }
  });
  
  // GET /api/vendas/campanhas/:id - Detalhes da campanha
  app.get("/api/vendas/campanhas/:id", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campanha = await storage.getSalesCampaign(id);
      if (!campanha) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      return res.json(campanha);
    } catch (error) {
      console.error("Get campanha error:", error);
      return res.status(500).json({ message: "Erro ao buscar campanha" });
    }
  });
  
  // POST /api/vendas/campanhas - Criar campanha
  app.post("/api/vendas/campanhas", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const parsed = insertSalesCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      }
      
      const campanha = await storage.createSalesCampaign({
        ...parsed.data,
        createdBy: req.user!.id,
      });
      return res.status(201).json(campanha);
    } catch (error) {
      console.error("Create campanha error:", error);
      return res.status(500).json({ message: "Erro ao criar campanha" });
    }
  });
  
  // PATCH /api/vendas/campanhas/:id - Atualizar campanha
  app.patch("/api/vendas/campanhas/:id", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campanha = await storage.updateSalesCampaign(id, req.body);
      if (!campanha) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      return res.json(campanha);
    } catch (error) {
      console.error("Update campanha error:", error);
      return res.status(500).json({ message: "Erro ao atualizar campanha" });
    }
  });
  
  // DELETE /api/vendas/campanhas/:id - Excluir campanha
  app.delete("/api/vendas/campanhas/:id", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSalesCampaign(id);
      return res.json({ message: "Campanha excluída com sucesso" });
    } catch (error) {
      console.error("Delete campanha error:", error);
      return res.status(500).json({ message: "Erro ao excluir campanha" });
    }
  });

  // POST /api/vendas/campanhas/criar-de-filtro - Criar campanha com leads a partir de filtros
  app.post("/api/vendas/campanhas/criar-de-filtro", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const { nome, descricao, filtros } = req.body;

      if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
        return res.status(400).json({ message: "Nome da campanha é obrigatório" });
      }

      const filtrosResult = filtrosPedidoListaSchema.safeParse(filtros || {});
      if (!filtrosResult.success) {
        return res.status(400).json({ message: "Filtros inválidos", errors: filtrosResult.error.errors });
      }

      const validFiltros = filtrosResult.data;
      const { clientes, total } = await storage.searchClientesPessoa(validFiltros);

      if (total === 0) {
        return res.status(400).json({ message: "Nenhum cliente encontrado com os filtros selecionados" });
      }

      const campanha = await storage.createSalesCampaign({
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        origem: "compra_lista",
        convenio: validFiltros.convenio || null,
        uf: validFiltros.uf || null,
        status: "ativa",
        totalLeads: total,
        leadsDisponiveis: total,
        leadsDistribuidos: 0,
        createdBy: req.user!.id,
      });

      const leads: InsertSalesLead[] = clientes.map((cliente) => ({
        campaignId: campanha.id,
        cpf: cliente.cpf || null,
        nome: cliente.nome,
        telefone1: cliente.telefonesBase?.[0] || null,
        telefone2: cliente.telefonesBase?.[1] || null,
        telefone3: cliente.telefonesBase?.[2] || null,
        email: cliente.emailBase || null,
        cidade: cliente.municipio || null,
        uf: cliente.uf || null,
        observacoes: `Convênio: ${cliente.convenio || "-"} | Órgão: ${cliente.orgaodesc || "-"} | Matrícula: ${cliente.matricula || "-"}`,
        baseClienteId: cliente.id,
      }));

      const insertedCount = await storage.createSalesLeadsBulk(leads);

      return res.status(201).json({
        campanha,
        leadsImportados: insertedCount,
        message: `Campanha criada com ${insertedCount} leads`,
      });
    } catch (error) {
      console.error("Create campanha from filter error:", error);
      return res.status(500).json({ message: "Erro ao criar campanha a partir dos filtros" });
    }
  });
  
  // POST /api/vendas/campanhas/:id/importar-leads - Importar leads para campanha
  app.post("/api/vendas/campanhas/:id/importar-leads", requireAuth, requireCRMAdmin, upload.single("file"), async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campanha = await storage.getSalesCampaign(campaignId);
      if (!campanha) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "Arquivo não enviado" });
      }
      
      const ext = path.extname(req.file.originalname).toLowerCase();
      let rows: any[] = [];
      
      // Parse file
      if (ext === ".csv") {
        const csvContent = req.file.buffer.toString("utf-8");
        const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
        rows = parsed.data;
      } else {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      }
      
      if (rows.length === 0) {
        return res.status(400).json({ message: "Arquivo vazio ou formato inválido" });
      }
      
      // Map columns (case-insensitive)
      const COLUMN_MAP: Record<string, string> = {
        "nome": "nome",
        "cpf": "cpf",
        "telefone_1": "telefone1", "telefone1": "telefone1", "telefone 1": "telefone1", "fone1": "telefone1",
        "telefone_2": "telefone2", "telefone2": "telefone2", "telefone 2": "telefone2", "fone2": "telefone2",
        "telefone_3": "telefone3", "telefone3": "telefone3", "telefone 3": "telefone3", "fone3": "telefone3",
        "email": "email", "e-mail": "email",
        "cidade": "cidade", "municipio": "cidade",
        "uf": "uf", "estado": "uf",
        "observacoes": "observacoes", "obs": "observacoes", "observacao": "observacoes",
      };
      
      // First pass: normalize all rows and collect CPFs
      const normalizedRows: { normalized: Record<string, any>; cpfLimpo: string | null }[] = [];
      let skipped = 0;
      
      for (const row of rows) {
        const normalized: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          const mappedKey = COLUMN_MAP[key.toLowerCase().trim()];
          if (mappedKey) {
            normalized[mappedKey] = String(value || "").trim();
          }
        }
        
        if (!normalized.nome) {
          skipped++;
          continue;
        }
        
        let cpfLimpo: string | null = null;
        if (normalized.cpf) {
          const cleaned = normalized.cpf.replace(/\D/g, "");
          if (cleaned.length === 11) {
            cpfLimpo = cleaned;
          }
        }
        
        normalizedRows.push({ normalized, cpfLimpo });
      }
      
      // Batch lookup: get all matching clients by CPF in one query
      const allCpfs = normalizedRows
        .map(r => r.cpfLimpo)
        .filter((cpf): cpf is string => cpf !== null);
      
      const cpfToClienteId = new Map<string, number>();
      if (allCpfs.length > 0) {
        // Query in chunks of 1000 to avoid query size limits
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < allCpfs.length; i += CHUNK_SIZE) {
          const chunk = allCpfs.slice(i, i + CHUNK_SIZE);
          const clientes = await db.select({ id: clientesPessoa.id, cpf: clientesPessoa.cpf })
            .from(clientesPessoa)
            .where(inArray(clientesPessoa.cpf, chunk));
          for (const c of clientes) {
            if (c.cpf) cpfToClienteId.set(c.cpf, c.id);
          }
        }
      }
      
      // Build leads array with cached client IDs
      const leads: InsertSalesLead[] = normalizedRows.map(({ normalized, cpfLimpo }) => ({
        campaignId,
        nome: normalized.nome,
        cpf: cpfLimpo,
        telefone1: normalized.telefone1 || null,
        telefone2: normalized.telefone2 || null,
        telefone3: normalized.telefone3 || null,
        email: normalized.email || null,
        cidade: normalized.cidade || null,
        uf: normalized.uf || null,
        observacoes: normalized.observacoes || null,
        baseClienteId: cpfLimpo ? cpfToClienteId.get(cpfLimpo) || null : null,
      }));
      
      // Insert leads in bulk
      const inserted = await storage.createSalesLeadsBulk(leads);
      
      // Update campaign counters
      await storage.updateSalesCampaign(campaignId, {
        totalLeads: (campanha.totalLeads || 0) + inserted,
        leadsDisponiveis: (campanha.leadsDisponiveis || 0) + inserted,
      });
      
      return res.json({
        message: "Leads importados com sucesso",
        total: rows.length,
        importados: inserted,
        ignorados: skipped,
      });
    } catch (error) {
      console.error("Import leads error:", error);
      return res.status(500).json({ message: "Erro ao importar leads" });
    }
  });
  
  // POST /api/vendas/campanhas/:id/distribuir-leads - Distribuir leads para vendedor
  app.post("/api/vendas/campanhas/:id/distribuir-leads", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { userId, quantidade } = req.body;
      
      if (!userId || !quantidade || quantidade < 1) {
        return res.status(400).json({ message: "Informe o vendedor e a quantidade de leads" });
      }
      
      const campanha = await storage.getSalesCampaign(campaignId);
      if (!campanha) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      
      // Get unassigned leads
      const leadsDisponiveis = await storage.getUnassignedLeads(campaignId, quantidade);
      
      if (leadsDisponiveis.length === 0) {
        return res.status(400).json({ message: "Não há leads disponíveis para distribuição" });
      }
      
      // Get current max ordem_fila for this user/campaign
      let ordemFila = await storage.getMaxOrdemFila(userId, campaignId);
      
      // Create assignments
      for (const lead of leadsDisponiveis) {
        ordemFila++;
        await storage.createSalesLeadAssignment({
          leadId: lead.id,
          userId,
          campaignId,
          status: "novo",
          ordemFila,
        });
      }
      
      // Update campaign counters
      await storage.updateSalesCampaign(campaignId, {
        leadsDisponiveis: Math.max(0, (campanha.leadsDisponiveis || 0) - leadsDisponiveis.length),
        leadsDistribuidos: (campanha.leadsDistribuidos || 0) + leadsDisponiveis.length,
      });
      
      return res.json({
        message: "Leads distribuídos com sucesso",
        quantidade: leadsDisponiveis.length,
      });
    } catch (error) {
      console.error("Distribute leads error:", error);
      return res.status(500).json({ message: "Erro ao distribuir leads" });
    }
  });
  
  // POST /api/vendas/campanhas/:id/distribuir-multi - Distribuir leads para múltiplos vendedores
  app.post("/api/vendas/campanhas/:id/distribuir-multi", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { distributions } = req.body;
      
      if (!distributions || !Array.isArray(distributions) || distributions.length === 0) {
        return res.status(400).json({ message: "Informe as distribuições de leads" });
      }
      
      // Validate distributions
      const totalRequested = distributions.reduce((acc: number, d: any) => acc + (d.quantidade || 0), 0);
      if (totalRequested < 1) {
        return res.status(400).json({ message: "A quantidade total deve ser maior que zero" });
      }
      
      const campanha = await storage.getSalesCampaign(campaignId);
      if (!campanha) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      
      if (totalRequested > (campanha.leadsDisponiveis || 0)) {
        return res.status(400).json({ 
          message: `Quantidade solicitada (${totalRequested}) excede leads disponíveis (${campanha.leadsDisponiveis})` 
        });
      }
      
      let totalDistributed = 0;
      const results: { userId: number; quantidade: number }[] = [];
      
      // Process each distribution
      for (const dist of distributions) {
        const { userId, quantidade } = dist;
        
        if (!userId || !quantidade || quantidade < 1) {
          continue;
        }
        
        // Get unassigned leads
        const leadsDisponiveis = await storage.getUnassignedLeads(campaignId, quantidade);
        
        if (leadsDisponiveis.length === 0) {
          break; // No more leads to distribute
        }
        
        // Get current max ordem_fila for this user/campaign
        let ordemFila = await storage.getMaxOrdemFila(userId, campaignId);
        
        // Create assignments
        for (const lead of leadsDisponiveis) {
          ordemFila++;
          await storage.createSalesLeadAssignment({
            leadId: lead.id,
            userId,
            campaignId,
            status: "novo",
            ordemFila,
          });
        }
        
        totalDistributed += leadsDisponiveis.length;
        results.push({ userId, quantidade: leadsDisponiveis.length });
      }
      
      // Update campaign counters
      if (totalDistributed > 0) {
        await storage.updateSalesCampaign(campaignId, {
          leadsDisponiveis: Math.max(0, (campanha.leadsDisponiveis || 0) - totalDistributed),
          leadsDistribuidos: (campanha.leadsDistribuidos || 0) + totalDistributed,
        });
      }
      
      return res.json({
        message: "Leads distribuídos com sucesso",
        totalDistribuido: totalDistributed,
        distribuicoes: results,
      });
    } catch (error) {
      console.error("Distribute multi leads error:", error);
      return res.status(500).json({ message: "Erro ao distribuir leads" });
    }
  });
  
  // GET /api/vendas/campanhas/:id/distribuicao - Estatísticas de distribuição
  app.get("/api/vendas/campanhas/:id/distribuicao", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const stats = await storage.getDistributionStats(campaignId);
      return res.json(stats);
    } catch (error) {
      console.error("Get distribution stats error:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas de distribuição" });
    }
  });
  
  // POST /api/vendas/campanhas/:id/devolver-pool - Devolver leads ao pool
  app.post("/api/vendas/campanhas/:id/devolver-pool", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { userId, quantidade } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "Informe o ID do usuário" });
      }
      
      const campanha = await storage.getSalesCampaign(campaignId);
      if (!campanha) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      
      // Get assignments with status 'novo' for this user and campaign
      const assignments = await db.select().from(salesLeadAssignments)
        .where(and(
          eq(salesLeadAssignments.userId, userId),
          eq(salesLeadAssignments.campaignId, campaignId),
          eq(salesLeadAssignments.status, "novo")
        ));
      
      if (assignments.length === 0) {
        return res.status(400).json({ message: "Nenhum lead com status 'novo' para devolver" });
      }
      
      // Limit to quantidade if provided
      const toReturn = quantidade ? assignments.slice(0, quantidade) : assignments;
      const assignmentIds = toReturn.map(a => a.id);
      
      // Delete the assignments (returns leads to pool)
      const returnedCount = await storage.returnLeadsToPool(assignmentIds);
      
      // Update campaign counters
      await storage.updateSalesCampaign(campaignId, {
        leadsDisponiveis: (campanha.leadsDisponiveis || 0) + returnedCount,
        leadsDistribuidos: Math.max(0, (campanha.leadsDistribuidos || 0) - returnedCount),
      });
      
      return res.json({
        message: "Leads devolvidos ao pool com sucesso",
        quantidade: returnedCount,
      });
    } catch (error) {
      console.error("Return leads to pool error:", error);
      return res.status(500).json({ message: "Erro ao devolver leads ao pool" });
    }
  });
  
  // POST /api/vendas/campanhas/:id/transferir - Transferir leads entre usuários
  app.post("/api/vendas/campanhas/:id/transferir", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { fromUserId, toUserId, quantidade } = req.body;
      
      if (!fromUserId || !toUserId || !quantidade) {
        return res.status(400).json({ message: "Informe origem, destino e quantidade" });
      }
      
      if (fromUserId === toUserId) {
        return res.status(400).json({ message: "Origem e destino não podem ser iguais" });
      }
      
      if (quantidade < 1) {
        return res.status(400).json({ message: "Quantidade deve ser maior que zero" });
      }
      
      const campanha = await storage.getSalesCampaign(campaignId);
      if (!campanha) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      
      const transferred = await storage.transferLeads(fromUserId, toUserId, campaignId, quantidade);
      
      if (transferred === 0) {
        return res.status(400).json({ message: "Nenhum lead disponível para transferir" });
      }
      
      return res.json({
        message: "Leads transferidos com sucesso",
        quantidade: transferred,
      });
    } catch (error) {
      console.error("Transfer leads error:", error);
      return res.status(500).json({ message: "Erro ao transferir leads" });
    }
  });
  
  // GET /api/vendas/vendedores - Lista vendedores para distribuição
  app.get("/api/vendas/vendedores", requireAuth, requireCRMAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Filter for vendedores or operacional
      const vendedores = allUsers.filter(u => 
        u.isActive && ["vendedor", "operacional"].includes(u.role)
      ).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));
      return res.json(vendedores);
    } catch (error) {
      console.error("Get vendedores error:", error);
      return res.status(500).json({ message: "Erro ao buscar vendedores" });
    }
  });
  
  // ===== ENDPOINTS DO VENDEDOR =====
  
  // GET /api/vendas/atendimento/resumo - Resumo do vendedor
  app.get("/api/vendas/atendimento/resumo", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const statusCounts = await storage.countAssignmentsByStatus(userId);
      
      const novos = statusCounts.find(s => s.status === "novo")?.count || 0;
      const emAtendimento = statusCounts.find(s => s.status === "em_atendimento")?.count || 0;
      const vendidos = statusCounts.find(s => s.status === "vendido")?.count || 0;
      const concluidos = statusCounts.filter(s => 
        ["vendido", "sem_interesse", "descartado", "concluido"].includes(s.status)
      ).reduce((acc, s) => acc + s.count, 0);
      
      return res.json({
        leadsPendentes: novos + emAtendimento,
        leadsNovos: novos,
        emAtendimento,
        vendidos,
        concluidos,
      });
    } catch (error) {
      console.error("Get resumo error:", error);
      return res.status(500).json({ message: "Erro ao buscar resumo" });
    }
  });
  
  // POST /api/vendas/atendimento/proximo - Pegar próximo lead
  app.post("/api/vendas/atendimento/proximo", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { campaignId } = req.body;
      
      // Get next assignment
      const assignment = await storage.getNextAssignment(userId, campaignId);
      
      if (!assignment) {
        return res.status(404).json({ message: "Não há mais leads na fila" });
      }
      
      // Update to em_atendimento
      const now = new Date();
      await storage.updateSalesLeadAssignment(assignment.id, {
        status: "em_atendimento",
        dataPrimeiroAtendimento: assignment.dataPrimeiroAtendimento || now,
        dataUltimoAtendimento: now,
      });
      
      // Get lead data
      const lead = await storage.getSalesLead(assignment.leadId);
      if (!lead) {
        return res.status(404).json({ message: "Lead não encontrado" });
      }
      
      // Get base cliente data if available
      let clienteBase = null;
      if (lead.baseClienteId) {
        const [pessoa] = await db.select().from(clientesPessoa)
          .where(eq(clientesPessoa.id, lead.baseClienteId));
        if (pessoa) {
          clienteBase = await storage.getClientePessoaById(pessoa.id);
        }
      }
      
      // Get events history
      const eventos = await storage.getEventsByAssignment(assignment.id);
      
      // Get campaign info
      const campanha = await storage.getSalesCampaign(assignment.campaignId);
      
      return res.json({
        assignment: { ...assignment, status: "em_atendimento" },
        lead,
        clienteBase,
        eventos,
        campanha: campanha ? { id: campanha.id, nome: campanha.nome } : null,
      });
    } catch (error) {
      console.error("Proximo lead error:", error);
      return res.status(500).json({ message: "Erro ao buscar próximo lead" });
    }
  });
  
  // POST /api/vendas/atendimento/carregar - Load specific assignment for atendimento
  app.post("/api/vendas/atendimento/carregar", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { assignmentId } = req.body;
      
      if (!assignmentId || isNaN(parseInt(assignmentId))) {
        return res.status(400).json({ message: "Assignment ID inválido" });
      }
      
      const result = await storage.getAssignmentWithLead(parseInt(assignmentId));
      if (!result) {
        return res.status(404).json({ message: "Atendimento não encontrado" });
      }
      
      // Verify ownership
      if (result.assignment.userId !== userId && !hasRole(req.user, ["master", "atendimento"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Update to em_atendimento if not already in a final status
      const finalStatuses = ["vendido", "sem_interesse", "descartado", "concluido"];
      if (!finalStatuses.includes(result.assignment.status)) {
        const now = new Date();
        await storage.updateSalesLeadAssignment(result.assignment.id, {
          status: "em_atendimento",
          dataPrimeiroAtendimento: result.assignment.dataPrimeiroAtendimento || now,
          dataUltimoAtendimento: now,
        });
      }
      
      // Get base cliente data if available
      let clienteBase = null;
      let folhaAtual = null;
      let contratos: any[] = [];
      
      if (result.lead.baseClienteId) {
        clienteBase = await storage.getClientePessoaById(result.lead.baseClienteId);
        if (clienteBase) {
          const folhaRegistros = await storage.getFolhaMesByPessoaId(result.lead.baseClienteId);
          folhaAtual = folhaRegistros.length > 0 ? folhaRegistros[0] : null;
          contratos = await storage.getContratosByPessoaId(result.lead.baseClienteId);
        }
      }
      
      // Get events history
      const eventos = await storage.getEventsByAssignment(result.assignment.id);
      
      // Get campaign info
      const campanha = await storage.getSalesCampaign(result.assignment.campaignId);
      
      return res.json({
        assignment: { ...result.assignment, status: finalStatuses.includes(result.assignment.status) ? result.assignment.status : "em_atendimento" },
        lead: result.lead,
        clienteBase,
        folhaAtual,
        contratos,
        eventos,
        campanha: campanha ? { id: campanha.id, nome: campanha.nome } : null,
      });
    } catch (error) {
      console.error("Carregar atendimento error:", error);
      return res.status(500).json({ message: "Erro ao carregar atendimento" });
    }
  });

  // GET /api/vendas/atendimento/campanhas-disponiveis - Campanhas com leads para o vendedor
  // IMPORTANT: This route MUST be before :assignmentId to avoid Express matching "campanhas-disponiveis" as an ID
  app.get("/api/vendas/atendimento/campanhas-disponiveis", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get campaigns where user has assignments
      const assignments = await storage.getAssignmentsByUser(userId);
      const campaignIds = [...new Set(assignments.map(a => a.campaignId))];
      
      const campanhas = [];
      for (const id of campaignIds) {
        const campanha = await storage.getSalesCampaign(id);
        if (campanha && campanha.status === "ativa") {
          const leadsPendentes = assignments.filter(a => 
            a.campaignId === id && ["novo", "em_atendimento"].includes(a.status)
          ).length;
          campanhas.push({
            id: campanha.id,
            nome: campanha.nome,
            leadsPendentes,
          });
        }
      }
      
      return res.json(campanhas);
    } catch (error) {
      console.error("Get campanhas disponiveis error:", error);
      return res.status(500).json({ message: "Erro ao buscar campanhas" });
    }
  });

  // GET /api/vendas/atendimento/:assignmentId - Detalhes do atendimento atual
  app.get("/api/vendas/atendimento/:assignmentId", requireAuth, async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const userId = req.user!.id;
      
      const result = await storage.getAssignmentWithLead(assignmentId);
      if (!result) {
        return res.status(404).json({ message: "Atendimento não encontrado" });
      }
      
      // Verify ownership
      if (result.assignment.userId !== userId && !hasRole(req.user, ["master", "atendimento"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Get base cliente data if available
      let clienteBase = null;
      let folhaAtual = null;
      let contratos: any[] = [];
      
      if (result.lead.baseClienteId) {
        clienteBase = await storage.getClientePessoaById(result.lead.baseClienteId);
        if (clienteBase) {
          const folhaRegistros = await storage.getFolhaMesByPessoaId(result.lead.baseClienteId);
          folhaAtual = folhaRegistros.length > 0 ? folhaRegistros[0] : null;
          contratos = await storage.getContratosByPessoaId(result.lead.baseClienteId);
        }
      }
      
      // Get events history
      const eventos = await storage.getEventsByAssignment(assignmentId);
      
      // Get campaign info
      const campanha = await storage.getSalesCampaign(result.assignment.campaignId);
      
      return res.json({
        assignment: result.assignment,
        lead: result.lead,
        clienteBase,
        folhaAtual,
        contratos,
        eventos,
        campanha: campanha ? { id: campanha.id, nome: campanha.nome } : null,
      });
    } catch (error) {
      console.error("Get atendimento error:", error);
      return res.status(500).json({ message: "Erro ao buscar atendimento" });
    }
  });
  
  // POST /api/vendas/atendimento/:assignmentId/registrar - Registrar atendimento
  app.post("/api/vendas/atendimento/:assignmentId/registrar", requireAuth, async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const userId = req.user!.id;
      const { tipo, resultado, observacao, status } = req.body;
      
      const result = await storage.getAssignmentWithLead(assignmentId);
      if (!result) {
        return res.status(404).json({ message: "Atendimento não encontrado" });
      }
      
      // Verify ownership
      if (result.assignment.userId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Create event
      await storage.createSalesLeadEvent({
        assignmentId,
        userId,
        tipo: tipo || "ligacao",
        resultado: resultado || null,
        observacao: observacao || null,
      });
      
      // Update assignment status
      const newStatus = status || "em_atendimento";
      await storage.updateSalesLeadAssignment(assignmentId, {
        status: newStatus,
        dataUltimoAtendimento: new Date(),
      });
      
      return res.json({
        message: "Atendimento registrado com sucesso",
        status: newStatus,
      });
    } catch (error) {
      console.error("Registrar atendimento error:", error);
      return res.status(500).json({ message: "Erro ao registrar atendimento" });
    }
  });
  
  // ===== NOVO SISTEMA DE MARCADORES =====
  
  // GET /api/crm/queue/next - Próximo lead da fila
  app.get("/api/crm/queue/next", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      
      const result = await storage.getNextLeadInQueue(userId, campaignId);
      
      if (!result) {
        return res.json({ lead: null, message: "Nenhum lead na fila" });
      }
      
      // Get interactions history
      const interactions = await storage.getInteractionsByLead(result.lead.id);
      
      // Get client base data if available
      let clienteBase = null;
      if (result.lead.baseClienteId) {
        clienteBase = await storage.getClientePessoaById(result.lead.baseClienteId);
      }
      
      return res.json({
        lead: result.lead,
        assignment: result.assignment,
        campaign: result.campaign,
        interactions,
        clienteBase,
      });
    } catch (error) {
      console.error("Get next lead error:", error);
      return res.status(500).json({ message: "Erro ao buscar próximo lead" });
    }
  });
  
  // POST /api/crm/leads/:id/interaction - Registrar interação com lead
  app.post("/api/crm/leads/:id/interaction", requireAuth, async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { tipoContato, leadMarker, motivo, observacao, retornoEm, margemValor, propostaValorEstimado } = req.body;
      
      if (!tipoContato || !leadMarker) {
        return res.status(400).json({ message: "Tipo de contato e marcador são obrigatórios" });
      }
      
      // Update lead marker and current margin/proposal values
      const retornoDate = retornoEm ? new Date(retornoEm) : undefined;
      await storage.updateLeadMarker(leadId, leadMarker, motivo, retornoDate, tipoContato);
      
      // Update lead's current margin and proposal if provided
      if (margemValor !== undefined || propostaValorEstimado !== undefined) {
        await db.update(salesLeads)
          .set({
            currentMargin: margemValor ? String(margemValor) : undefined,
            currentProposal: propostaValorEstimado ? String(propostaValorEstimado) : undefined,
            updatedAt: new Date(),
          })
          .where(eq(salesLeads.id, leadId));
      }
      
      // Create interaction record
      const interaction = await storage.createLeadInteraction({
        leadId,
        userId,
        tipoContato,
        leadMarker,
        motivo: motivo || null,
        observacao: observacao || null,
        retornoEm: retornoDate || null,
        margemValor: margemValor ? String(margemValor) : null,
        propostaValorEstimado: propostaValorEstimado ? String(propostaValorEstimado) : null,
      });
      
      // Update assignment status based on marker
      const assignments = await storage.getAssignmentsByUser(userId);
      const assignment = assignments.find(a => a.leadId === leadId);
      
      if (assignment) {
        let newStatus = "em_atendimento";
        if (["VENDIDO"].includes(leadMarker)) {
          newStatus = "vendido";
        } else if (["NAO_ATENDE", "TELEFONE_INVALIDO", "ENGANO", "SEM_INTERESSE"].includes(leadMarker)) {
          newStatus = "descartado";
        }
        
        await storage.updateSalesLeadAssignment(assignment.id, {
          status: newStatus,
          dataUltimoAtendimento: new Date(),
        });
      }
      
      return res.json({
        message: "Interação registrada com sucesso",
        interaction,
      });
    } catch (error) {
      console.error("Create interaction error:", error);
      return res.status(500).json({ message: "Erro ao registrar interação" });
    }
  });
  
  // GET /api/crm/leads/:id/interactions - Histórico de interações do lead
  app.get("/api/crm/leads/:id/interactions", requireAuth, async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const interactions = await storage.getInteractionsByLead(leadId);
      return res.json(interactions);
    } catch (error) {
      console.error("Get interactions error:", error);
      return res.status(500).json({ message: "Erro ao buscar histórico" });
    }
  });

  // POST /api/crm/consulta/registrar-atendimento - Registrar atendimento a partir de consulta de cliente
  app.post("/api/crm/consulta/registrar-atendimento", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { pessoaId, tipoContato, leadMarker, telefoneUsado, motivo, observacao, retornoEm, margemValor, propostaValorEstimado } = req.body;
      
      if (!pessoaId || !tipoContato || !leadMarker) {
        return res.status(400).json({ message: "Dados obrigatórios faltando" });
      }
      
      // Get pessoa data
      const pessoa = await storage.getClientePessoaById(pessoaId);
      if (!pessoa) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Find or create a "Consulta CRM" campaign for the user
      let campaign = await db
        .select()
        .from(salesCampaigns)
        .where(and(
          eq(salesCampaigns.nome, "Consulta CRM"),
          eq(salesCampaigns.ativo, true)
        ))
        .limit(1);
      
      let campaignId: number;
      if (campaign.length === 0) {
        // Create the campaign
        const [newCampaign] = await db.insert(salesCampaigns).values({
          nome: "Consulta CRM",
          descricao: "Leads gerados a partir de consultas diretas no CRM",
          ativo: true,
          criadoPor: userId,
        }).returning();
        campaignId = newCampaign.id;
      } else {
        campaignId = campaign[0].id;
      }
      
      // Check if a lead already exists for this pessoa in any campaign
      const existingLeads = await db
        .select()
        .from(salesLeads)
        .where(eq(salesLeads.baseClienteId, pessoaId))
        .limit(1);
      
      let leadId: number;
      if (existingLeads.length > 0) {
        leadId = existingLeads[0].id;
      } else {
        // Create new lead from pessoa
        const [newLead] = await db.insert(salesLeads).values({
          campaignId,
          cpf: pessoa.cpf || null,
          nome: pessoa.nome || "Nome não informado",
          telefone1: pessoa.telefones_base?.[0] || null,
          telefone2: pessoa.telefones_base?.[1] || null,
          telefone3: pessoa.telefones_base?.[2] || null,
          cidade: pessoa.municipio || null,
          uf: pessoa.uf || null,
          baseClienteId: pessoaId,
          leadMarker: "NOVO",
        }).returning();
        leadId = newLead.id;
      }
      
      // Update lead marker and values
      const retornoDate = retornoEm ? new Date(retornoEm) : undefined;
      await storage.updateLeadMarker(leadId, leadMarker, motivo, retornoDate, tipoContato);
      
      if (margemValor !== undefined || propostaValorEstimado !== undefined) {
        await db.update(salesLeads)
          .set({
            currentMargin: margemValor ? String(margemValor) : undefined,
            currentProposal: propostaValorEstimado ? String(propostaValorEstimado) : undefined,
            updatedAt: new Date(),
          })
          .where(eq(salesLeads.id, leadId));
      }
      
      // Create interaction record
      const interaction = await storage.createLeadInteraction({
        leadId,
        userId,
        tipoContato,
        leadMarker,
        motivo: motivo || null,
        observacao: observacao || null,
        retornoEm: retornoDate || null,
        margemValor: margemValor ? String(margemValor) : null,
        propostaValorEstimado: propostaValorEstimado ? String(propostaValorEstimado) : null,
      });
      
      // Create or update assignment for the user
      const existingAssignments = await db
        .select()
        .from(salesLeadAssignments)
        .where(and(
          eq(salesLeadAssignments.leadId, leadId),
          eq(salesLeadAssignments.userId, userId)
        ))
        .limit(1);
      
      if (existingAssignments.length === 0) {
        await db.insert(salesLeadAssignments).values({
          leadId,
          userId,
          status: "em_atendimento",
          dataUltimoAtendimento: new Date(),
        });
      } else {
        await db.update(salesLeadAssignments)
          .set({
            status: "em_atendimento",
            dataUltimoAtendimento: new Date(),
          })
          .where(eq(salesLeadAssignments.id, existingAssignments[0].id));
      }
      
      return res.json({
        message: "Atendimento registrado com sucesso",
        leadId,
        interaction,
      });
    } catch (error) {
      console.error("CRM consulta register error:", error);
      return res.status(500).json({ message: "Erro ao registrar atendimento" });
    }
  });

  // ===== CAMPAIGN MANAGEMENT ENDPOINTS =====

  // GET /api/crm/campaigns/:id/distribution - Get lead distribution by marker
  app.get("/api/crm/campaigns/:id/distribution", requireAuth, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      if (isNaN(campaignId)) {
        return res.status(400).json({ message: "ID de campanha inválido" });
      }

      // Query leads grouped by leadMarker
      const result = await db
        .select({
          leadMarker: salesLeads.leadMarker,
          count: sql<number>`count(*)::int`,
        })
        .from(salesLeads)
        .where(eq(salesLeads.campaignId, campaignId))
        .groupBy(salesLeads.leadMarker);

      // Convert to object with all markers (including zeros)
      const distribution: Record<string, number> = {};
      for (const marker of LEAD_MARKERS) {
        distribution[marker] = 0;
      }
      for (const row of result) {
        distribution[row.leadMarker] = row.count;
      }

      return res.json(distribution);
    } catch (error) {
      console.error("Get campaign distribution error:", error);
      return res.status(500).json({ message: "Erro ao buscar distribuição" });
    }
  });

  // POST /api/crm/campaigns/:id/reassign - Reassign leads from one user to another
  app.post("/api/crm/campaigns/:id/reassign", requireAuth, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      if (isNaN(campaignId)) {
        return res.status(400).json({ message: "ID de campanha inválido" });
      }

      const { fromUserId, toUserId, leadMarkers } = req.body;

      if (!fromUserId || !toUserId) {
        return res.status(400).json({ message: "IDs de usuário são obrigatórios" });
      }

      // Build conditions for the update
      const conditions = [
        eq(salesLeadAssignments.campaignId, campaignId),
        eq(salesLeadAssignments.userId, fromUserId),
      ];

      // If specific markers provided, filter by them
      let leadIdsToReassign: number[] = [];
      if (leadMarkers && Array.isArray(leadMarkers) && leadMarkers.length > 0) {
        // Get lead IDs with those markers
        const leadsWithMarkers = await db
          .select({ id: salesLeads.id })
          .from(salesLeads)
          .where(
            and(
              eq(salesLeads.campaignId, campaignId),
              inArray(salesLeads.leadMarker, leadMarkers)
            )
          );
        leadIdsToReassign = leadsWithMarkers.map(l => l.id);

        if (leadIdsToReassign.length === 0) {
          return res.json({ message: "Nenhum lead encontrado com os marcadores especificados", count: 0 });
        }
      }

      // Execute the reassignment
      let updateResult;
      if (leadIdsToReassign.length > 0) {
        updateResult = await db
          .update(salesLeadAssignments)
          .set({ userId: toUserId, updatedAt: new Date() })
          .where(
            and(
              eq(salesLeadAssignments.campaignId, campaignId),
              eq(salesLeadAssignments.userId, fromUserId),
              inArray(salesLeadAssignments.leadId, leadIdsToReassign)
            )
          )
          .returning({ id: salesLeadAssignments.id });
      } else {
        updateResult = await db
          .update(salesLeadAssignments)
          .set({ userId: toUserId, updatedAt: new Date() })
          .where(
            and(
              eq(salesLeadAssignments.campaignId, campaignId),
              eq(salesLeadAssignments.userId, fromUserId)
            )
          )
          .returning({ id: salesLeadAssignments.id });
      }

      return res.json({
        message: `${updateResult.length} leads transferidos com sucesso`,
        count: updateResult.length,
      });
    } catch (error) {
      console.error("Reassign leads error:", error);
      return res.status(500).json({ message: "Erro ao transferir leads" });
    }
  });

  // POST /api/crm/campaigns/:id/repescagem - Return leads to pool (remove assignments)
  app.post("/api/crm/campaigns/:id/repescagem", requireAuth, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      if (isNaN(campaignId)) {
        return res.status(400).json({ message: "ID de campanha inválido" });
      }

      const { leadMarkers } = req.body;

      if (!leadMarkers || !Array.isArray(leadMarkers) || leadMarkers.length === 0) {
        return res.status(400).json({ message: "Marcadores são obrigatórios" });
      }

      // Get leads with the specified markers in this campaign
      const leadsToReset = await db
        .select({ id: salesLeads.id })
        .from(salesLeads)
        .where(
          and(
            eq(salesLeads.campaignId, campaignId),
            inArray(salesLeads.leadMarker, leadMarkers)
          )
        );

      if (leadsToReset.length === 0) {
        return res.json({ message: "Nenhum lead encontrado com os marcadores especificados", count: 0 });
      }

      const leadIds = leadsToReset.map(l => l.id);

      // Remove assignments for these leads
      const deletedAssignments = await db
        .delete(salesLeadAssignments)
        .where(inArray(salesLeadAssignments.leadId, leadIds))
        .returning({ id: salesLeadAssignments.id });

      // Reset leads to NOVO marker
      await db
        .update(salesLeads)
        .set({
          leadMarker: "NOVO",
          motivo: null,
          retornoEm: null,
          ultimoContatoEm: null,
          ultimoTipoContato: null,
          updatedAt: new Date(),
        })
        .where(inArray(salesLeads.id, leadIds));

      // Update campaign counters
      const campaign = await db
        .select()
        .from(salesCampaigns)
        .where(eq(salesCampaigns.id, campaignId))
        .limit(1);

      if (campaign.length > 0) {
        const currentLeadsDisponiveis = campaign[0].leadsDisponiveis || 0;
        const currentLeadsDistribuidos = campaign[0].leadsDistribuidos || 0;
        
        await db
          .update(salesCampaigns)
          .set({
            leadsDisponiveis: currentLeadsDisponiveis + leadIds.length,
            leadsDistribuidos: Math.max(0, currentLeadsDistribuidos - deletedAssignments.length),
            updatedAt: new Date(),
          })
          .where(eq(salesCampaigns.id, campaignId));
      }

      return res.json({
        message: `${leadIds.length} leads retornados ao pool`,
        count: leadIds.length,
      });
    } catch (error) {
      console.error("Repescagem error:", error);
      return res.status(500).json({ message: "Erro ao devolver leads ao pool" });
    }
  });
  
  // ===== LEAD SCHEDULES (AGENDAMENTOS) =====

  // GET /api/vendas/agenda/detalhado - Get all schedules with lead/campaign info
  app.get("/api/vendas/agenda/detalhado", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const schedules = await storage.getSchedulesByUser(userId);
      
      const detailedSchedules = [];
      for (const schedule of schedules) {
        const data = await storage.getScheduleWithLead(schedule.id);
        if (data) {
          detailedSchedules.push(data);
        }
      }
      
      return res.json(detailedSchedules);
    } catch (error) {
      console.error("Get detailed schedules error:", error);
      return res.status(500).json({ message: "Erro ao buscar agendamentos detalhados" });
    }
  });

  // GET /api/vendas/agenda - Get all schedules for the current user
  app.get("/api/vendas/agenda", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const status = req.query.status as string | undefined;
      const schedules = await storage.getSchedulesByUser(userId, status);
      return res.json(schedules);
    } catch (error) {
      console.error("Get schedules error:", error);
      return res.status(500).json({ message: "Erro ao buscar agendamentos" });
    }
  });

  // POST /api/vendas/atendimento/:assignmentId/agendar - Create a schedule
  app.post("/api/vendas/atendimento/:assignmentId/agendar", requireAuth, async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const userId = req.user!.id;
      
      if (isNaN(assignmentId)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const { dataHora, observacao } = req.body;
      
      if (!dataHora) {
        return res.status(400).json({ message: "Data e hora são obrigatórias" });
      }
      
      const schedule = await storage.createSchedule({
        userId,
        assignmentId,
        dataHora: new Date(dataHora),
        observacao: observacao || null,
        status: "pendente",
      });
      
      return res.json(schedule);
    } catch (error) {
      console.error("Create schedule error:", error);
      return res.status(500).json({ message: "Erro ao criar agendamento" });
    }
  });

  // PATCH /api/vendas/agenda/:id - Update schedule status
  app.patch("/api/vendas/agenda/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const { status } = req.body;
      
      if (!status || !["pendente", "realizado", "cancelado"].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }
      
      const schedule = await storage.updateSchedule(id, { status });
      
      if (!schedule) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }
      
      return res.json(schedule);
    } catch (error) {
      console.error("Update schedule error:", error);
      return res.status(500).json({ message: "Erro ao atualizar agendamento" });
    }
  });

  // ===== LEAD CONTACTS ENDPOINTS =====
  
  // GET /api/crm/leads/:leadId/contacts - Get all contacts for a lead
  app.get("/api/crm/leads/:leadId/contacts", requireAuth, async (req, res) => {
    try {
      const leadId = parseInt(req.params.leadId);
      if (isNaN(leadId)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      const contacts = await storage.getContactsByLead(leadId);
      return res.json(contacts);
    } catch (error) {
      console.error("Get contacts error:", error);
      return res.status(500).json({ message: "Erro ao buscar contatos" });
    }
  });
  
  // POST /api/crm/leads/:leadId/contacts - Create a new contact
  app.post("/api/crm/leads/:leadId/contacts", requireAuth, async (req, res) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const userId = req.user!.id;
      if (isNaN(leadId)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const { type, label, value, isPrimary } = req.body;
      
      if (!value || typeof value !== "string" || value.trim().length === 0) {
        return res.status(400).json({ message: "Valor é obrigatório" });
      }
      
      const contact = await storage.createContact({
        leadId,
        type: type || "phone",
        label: label?.trim() || null,
        value: value.trim(),
        isPrimary: isPrimary || false,
        createdBy: userId,
      });
      
      return res.json(contact);
    } catch (error) {
      console.error("Create contact error:", error);
      return res.status(500).json({ message: "Erro ao criar contato" });
    }
  });
  
  // PUT /api/crm/contacts/:contactId - Update a contact
  app.put("/api/crm/contacts/:contactId", requireAuth, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const { label, value, isPrimary } = req.body;
      const updateData: { label?: string; value?: string; isPrimary?: boolean } = {};
      
      if (label !== undefined) updateData.label = label.trim();
      if (value !== undefined) updateData.value = value.trim();
      if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
      
      const contact = await storage.updateContact(contactId, updateData);
      
      if (!contact) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      
      return res.json(contact);
    } catch (error) {
      console.error("Update contact error:", error);
      return res.status(500).json({ message: "Erro ao atualizar contato" });
    }
  });
  
  // DELETE /api/crm/contacts/:contactId - Delete a contact
  app.delete("/api/crm/contacts/:contactId", requireAuth, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      await storage.deleteContact(contactId);
      return res.json({ message: "Contato excluído" });
    } catch (error) {
      console.error("Delete contact error:", error);
      return res.status(500).json({ message: "Erro ao excluir contato" });
    }
  });
  
  // POST /api/crm/contacts/:contactId/primary - Set contact as primary
  app.post("/api/crm/contacts/:contactId/primary", requireAuth, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const { leadId } = req.body;
      
      if (isNaN(contactId) || !leadId) {
        return res.status(400).json({ message: "Dados inválidos" });
      }
      
      await storage.setContactAsPrimary(contactId, leadId);
      return res.json({ message: "Contato definido como principal" });
    } catch (error) {
      console.error("Set primary contact error:", error);
      return res.status(500).json({ message: "Erro ao definir contato principal" });
    }
  });
  
  // GET /api/crm/contacts/labels - Get distinct contact labels
  app.get("/api/crm/contacts/labels", requireAuth, async (req, res) => {
    try {
      const labels = await storage.getDistinctContactLabels();
      return res.json(labels);
    } catch (error) {
      console.error("Get labels error:", error);
      return res.status(500).json({ message: "Erro ao buscar etiquetas" });
    }
  });
  
  // GET /api/crm/contacts/by-label - Get contacts by label
  app.get("/api/crm/contacts/by-label", requireAuth, async (req, res) => {
    try {
      const label = req.query.label as string;
      if (!label) {
        return res.status(400).json({ message: "Etiqueta é obrigatória" });
      }
      
      const contacts = await storage.getContactsByLabel(label);
      return res.json(contacts);
    } catch (error) {
      console.error("Get contacts by label error:", error);
      return res.status(500).json({ message: "Erro ao buscar contatos por etiqueta" });
    }
  });

  // ===== PIPELINE KANBAN ROUTES =====

  // GET /api/crm/pipeline - Leads do usuário logado (ou de outro usuário se master/gestor)
  app.get("/api/crm/pipeline", requireAuth, async (req, res) => {
    try {
      const currentUserId = req.user!.id;
      const userRole = req.user!.role;
      
      // Se foi passado userId via query param, verificar permissão
      let userId = currentUserId;
      if (req.query.userId) {
        const requestedUserId = parseInt(req.query.userId as string);
        if (!isNaN(requestedUserId) && requestedUserId !== currentUserId) {
          // Somente master, atendimento ou coordenacao podem ver pipeline de outros
          if (!["master", "atendimento", "coordenacao"].includes(userRole)) {
            return res.status(403).json({ message: "Acesso negado" });
          }
          // Coordenacao só pode ver membros da sua equipe
          if (userRole === "coordenacao") {
            const teamMembers = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.managerId, currentUserId));
            const teamIds = [currentUserId, ...teamMembers.map(m => m.id)];
            if (!teamIds.includes(requestedUserId)) {
              return res.status(403).json({ message: "Acesso negado - usuário não pertence à sua equipe" });
            }
          }
          userId = requestedUserId;
        }
      }
      
      const assignments = await db
        .select({
          id: salesLeads.id,
          nome: salesLeads.nome,
          cpf: salesLeads.cpf,
          telefone1: salesLeads.telefone1,
          telefone2: salesLeads.telefone2,
          telefone3: salesLeads.telefone3,
          email: salesLeads.email,
          cidade: salesLeads.cidade,
          uf: salesLeads.uf,
          observacoes: salesLeads.observacoes,
          leadMarker: salesLeads.leadMarker,
          retornoEm: salesLeads.retornoEm,
          motivo: salesLeads.motivo,
          ultimoContatoEm: salesLeads.ultimoContatoEm,
          ultimoTipoContato: salesLeads.ultimoTipoContato,
          currentMargin: salesLeads.currentMargin,
          currentProposal: salesLeads.currentProposal,
          campaignId: salesLeads.campaignId,
          campaignNome: salesCampaigns.nome,
          assignmentId: salesLeadAssignments.id,
        })
        .from(salesLeadAssignments)
        .innerJoin(salesLeads, eq(salesLeadAssignments.leadId, salesLeads.id))
        .innerJoin(salesCampaigns, eq(salesLeads.campaignId, salesCampaigns.id))
        .where(eq(salesLeadAssignments.userId, userId));

      // Calcular somas por marcador usando os campos currentMargin e currentProposal dos leads
      const summary: Record<string, { count: number; somaMargens: number; somaPropostas: number }> = {};
      for (const marker of LEAD_MARKERS) {
        const leadsInMarker = assignments.filter(a => a.leadMarker === marker);
        let somaMargens = 0;
        let somaPropostas = 0;
        for (const lead of leadsInMarker) {
          somaMargens += parseFloat(lead.currentMargin || "0");
          somaPropostas += parseFloat(lead.currentProposal || "0");
        }
        summary[marker] = {
          count: leadsInMarker.length,
          somaMargens,
          somaPropostas,
        };
      }

      return res.json({ leads: assignments, summary });
    } catch (error) {
      console.error("Get pipeline error:", error);
      return res.status(500).json({ message: "Erro ao buscar pipeline" });
    }
  });

  // PATCH /api/crm/leads/:id/stage - Mover lead de estágio
  app.patch("/api/crm/leads/:id/stage", requireAuth, async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const { marker, tipoContato, observacao, motivo, retornoEm, contactId, margemValor, propostaValorEstimado } = req.body;
      
      if (isNaN(leadId) || !marker || !LEAD_MARKERS.includes(marker)) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      // Marcador "NOVO" não é permitido no modal de atendimento
      if (marker === "NOVO") {
        return res.status(400).json({ message: "Marcador NOVO não é permitido" });
      }

      // Validar campos obrigatórios para qualquer atendimento
      // contactId é opcional (pode ser null se o lead não tem contatos cadastrados)
      if (margemValor === undefined || margemValor === null || margemValor === "") {
        return res.status(400).json({ message: "Margem é obrigatória" });
      }
      if (propostaValorEstimado === undefined || propostaValorEstimado === null || propostaValorEstimado === "") {
        return res.status(400).json({ message: "Valor estimado da proposta é obrigatório" });
      }

      const now = new Date();
      
      await db.update(salesLeads)
        .set({
          leadMarker: marker,
          motivo: motivo || null,
          retornoEm: retornoEm ? new Date(retornoEm) : null,
          ultimoContatoEm: now,
          ultimoTipoContato: tipoContato || "ligacao",
          currentMargin: margemValor ? String(margemValor) : undefined,
          currentProposal: propostaValorEstimado ? String(propostaValorEstimado) : undefined,
          updatedAt: now,
        })
        .where(eq(salesLeads.id, leadId));

      await db.insert(leadInteractions).values({
        leadId,
        userId: req.user!.id,
        tipoContato: tipoContato || "ligacao",
        leadMarker: marker,
        motivo: motivo || null,
        observacao: observacao || null,
        retornoEm: retornoEm ? new Date(retornoEm) : null,
        contactId: contactId ? parseInt(contactId) : null,
        margemValor: String(margemValor),
        propostaValorEstimado: String(propostaValorEstimado),
      });

      return res.json({ message: "Lead atualizado" });
    } catch (error) {
      console.error("Update stage error:", error);
      return res.status(500).json({ message: "Erro ao atualizar estágio" });
    }
  });

  // GET /api/crm/leads/:id/interactions - Histórico de interações do lead
  app.get("/api/crm/leads/:id/interactions", requireAuth, async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      if (isNaN(leadId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const interactions = await db
        .select({
          id: leadInteractions.id,
          tipoContato: leadInteractions.tipoContato,
          leadMarker: leadInteractions.leadMarker,
          motivo: leadInteractions.motivo,
          observacao: leadInteractions.observacao,
          retornoEm: leadInteractions.retornoEm,
          margemValor: leadInteractions.margemValor,
          propostaValorEstimado: leadInteractions.propostaValorEstimado,
          createdAt: leadInteractions.createdAt,
          userName: users.name,
        })
        .from(leadInteractions)
        .innerJoin(users, eq(leadInteractions.userId, users.id))
        .where(eq(leadInteractions.leadId, leadId))
        .orderBy(desc(leadInteractions.createdAt))
        .limit(10);

      return res.json(interactions);
    } catch (error) {
      console.error("Get interactions error:", error);
      return res.status(500).json({ message: "Erro ao buscar histórico" });
    }
  });

  // GET /api/crm/pipeline/overview - Visão macro para gestores
  app.get("/api/crm/pipeline/overview", requireAuth, async (req, res) => {
    try {
      const userRole = req.user!.role;
      const currentUserId = req.user!.id;
      if (!["master", "coordenacao", "atendimento"].includes(userRole)) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      let teamUserIds: number[] | null = null;
      if (userRole !== "master") {
        const teamMembers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.managerId, currentUserId));
        teamUserIds = [currentUserId, ...teamMembers.map(m => m.id)];
      }

      let assignmentsQuery = db
        .select({
          leadId: salesLeadAssignments.leadId,
          leadMarker: salesLeads.leadMarker,
          currentMargin: salesLeads.currentMargin,
          currentProposal: salesLeads.currentProposal,
          userId: salesLeadAssignments.userId,
          userName: users.name,
        })
        .from(salesLeadAssignments)
        .innerJoin(salesLeads, eq(salesLeadAssignments.leadId, salesLeads.id))
        .innerJoin(users, eq(salesLeadAssignments.userId, users.id));

      const allAssignments = teamUserIds 
        ? await assignmentsQuery.where(inArray(salesLeadAssignments.userId, teamUserIds))
        : await assignmentsQuery;

      const totals: Record<string, { count: number; somaMargens: number; somaPropostas: number }> = {};
      for (const marker of LEAD_MARKERS) {
        totals[marker] = { count: 0, somaMargens: 0, somaPropostas: 0 };
      }

      for (const a of allAssignments) {
        totals[a.leadMarker].count++;
        totals[a.leadMarker].somaMargens += parseFloat(a.currentMargin || "0");
        totals[a.leadMarker].somaPropostas += parseFloat(a.currentProposal || "0");
      }

      const byUserMap: Record<number, { userId: number; userName: string; totals: Record<string, number>; totalLeads: number; somaMargens: number; somaPropostas: number }> = {};
      
      for (const assignment of allAssignments) {
        if (!byUserMap[assignment.userId]) {
          byUserMap[assignment.userId] = {
            userId: assignment.userId,
            userName: assignment.userName,
            totals: {},
            totalLeads: 0,
            somaMargens: 0,
            somaPropostas: 0,
          };
          for (const marker of LEAD_MARKERS) {
            byUserMap[assignment.userId].totals[marker] = 0;
          }
        }
        byUserMap[assignment.userId].totals[assignment.leadMarker]++;
        byUserMap[assignment.userId].totalLeads++;
        byUserMap[assignment.userId].somaMargens += parseFloat(assignment.currentMargin || "0");
        byUserMap[assignment.userId].somaPropostas += parseFloat(assignment.currentProposal || "0");
      }

      return res.json({
        totals,
        byUser: Object.values(byUserMap),
        totalLeads: allAssignments.length,
      });
    } catch (error) {
      console.error("Get pipeline overview error:", error);
      return res.status(500).json({ message: "Erro ao buscar visão geral" });
    }
  });

  // GET /api/crm/pipeline/all-leads - Todos os leads para gestão
  app.get("/api/crm/pipeline/all-leads", requireAuth, async (req, res) => {
    try {
      const userRole = req.user!.role;
      const currentUserId = req.user!.id;
      if (!["master", "coordenacao", "atendimento"].includes(userRole)) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      let teamUserIds: number[] | null = null;
      if (userRole !== "master") {
        const teamMembers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.managerId, currentUserId));
        teamUserIds = [currentUserId, ...teamMembers.map(m => m.id)];
      }

      let leadsQuery = db
        .select({
          id: salesLeads.id,
          nome: salesLeads.nome,
          cpf: salesLeads.cpf,
          telefone1: salesLeads.telefone1,
          leadMarker: salesLeads.leadMarker,
          campaignNome: salesCampaigns.nome,
          assignedUserName: users.name,
          assignedUserId: salesLeadAssignments.userId,
          assignmentId: salesLeadAssignments.id,
        })
        .from(salesLeadAssignments)
        .innerJoin(salesLeads, eq(salesLeadAssignments.leadId, salesLeads.id))
        .innerJoin(salesCampaigns, eq(salesLeads.campaignId, salesCampaigns.id))
        .innerJoin(users, eq(salesLeadAssignments.userId, users.id));

      const leads = teamUserIds 
        ? await leadsQuery.where(inArray(salesLeadAssignments.userId, teamUserIds))
        : await leadsQuery;

      return res.json(leads);
    } catch (error) {
      console.error("Get all leads error:", error);
      return res.status(500).json({ message: "Erro ao buscar leads" });
    }
  });

  // GET /api/crm/team-members - Lista de membros da equipe para remanejamento
  app.get("/api/crm/team-members", requireAuth, async (req, res) => {
    try {
      const userRole = req.user!.role;
      const currentUserId = req.user!.id;

      let membersQuery;
      if (userRole === "master") {
        membersQuery = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.isActive, true));
      } else {
        membersQuery = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(and(eq(users.isActive, true), or(eq(users.id, currentUserId), eq(users.managerId, currentUserId))));
      }
      return res.json(membersQuery);
    } catch (error) {
      console.error("Get team members error:", error);
      return res.status(500).json({ message: "Erro ao buscar membros" });
    }
  });

  // POST /api/crm/pipeline/bulk-reassign - Remanejamento em lote
  app.post("/api/crm/pipeline/bulk-reassign", requireAuth, async (req, res) => {
    try {
      const userRole = req.user!.role;
      if (!["master", "coordenacao", "atendimento"].includes(userRole)) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { leadIds, targetUserId } = req.body;
      if (!Array.isArray(leadIds) || !targetUserId) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      await db.update(salesLeadAssignments)
        .set({ userId: targetUserId, updatedAt: new Date() })
        .where(inArray(salesLeadAssignments.leadId, leadIds));

      return res.json({ message: "Leads remanejados", count: leadIds.length });
    } catch (error) {
      console.error("Bulk reassign error:", error);
      return res.status(500).json({ message: "Erro ao remanejar leads" });
    }
  });

  // POST /api/crm/pipeline/repescagem - Devolver leads ao pool
  app.post("/api/crm/pipeline/repescagem", requireAuth, async (req, res) => {
    try {
      const userRole = req.user!.role;
      if (!["master", "coordenacao", "atendimento"].includes(userRole)) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { leadIds } = req.body;
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      await db.delete(salesLeadAssignments)
        .where(inArray(salesLeadAssignments.leadId, leadIds));

      await db.update(salesLeads)
        .set({ leadMarker: "NOVO", updatedAt: new Date() })
        .where(inArray(salesLeads.id, leadIds));

      return res.json({ message: "Leads devolvidos ao pool", count: leadIds.length });
    } catch (error) {
      console.error("Repescagem error:", error);
      return res.status(500).json({ message: "Erro na repescagem" });
    }
  });

  // ===== TEAMS & AI PROMPTS =====

  // GET /api/teams - Listar todas as equipes
  app.get("/api/teams", requireAuth, requireMaster, async (req, res) => {
    try {
      const teams = await storage.getAllTeams();
      const teamsWithMembers = await Promise.all(teams.map(async (team) => {
        const members = await storage.getTeamMembersByTeam(team.id);
        const manager = await storage.getUser(team.managerUserId);
        return {
          ...team,
          managerName: manager?.name || "N/A",
          memberCount: members.length,
        };
      }));
      return res.json(teamsWithMembers);
    } catch (error) {
      console.error("Get teams error:", error);
      return res.status(500).json({ message: "Erro ao buscar equipes" });
    }
  });

  // POST /api/teams - Criar equipe
  app.post("/api/teams", requireAuth, requireMaster, async (req, res) => {
    try {
      const { name, managerUserId } = req.body;
      if (!name || !managerUserId) {
        return res.status(400).json({ message: "Nome e coordenador são obrigatórios" });
      }
      const team = await storage.createTeam({ name, managerUserId });
      
      // Automatically add the coordinator as a team member
      await storage.deleteTeamMemberByUser(managerUserId);
      await storage.createTeamMember({
        teamId: team.id,
        userId: managerUserId,
        roleInTeam: "coordinator",
      });
      
      return res.status(201).json(team);
    } catch (error) {
      console.error("Create team error:", error);
      return res.status(500).json({ message: "Erro ao criar equipe" });
    }
  });

  // PATCH /api/teams/:id - Atualizar equipe
  app.patch("/api/teams/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const team = await storage.updateTeam(id, req.body);
      if (!team) {
        return res.status(404).json({ message: "Equipe não encontrada" });
      }
      return res.json(team);
    } catch (error) {
      console.error("Update team error:", error);
      return res.status(500).json({ message: "Erro ao atualizar equipe" });
    }
  });

  // DELETE /api/teams/:id - Excluir equipe
  app.delete("/api/teams/:id", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTeam(id);
      return res.json({ message: "Equipe excluída" });
    } catch (error) {
      console.error("Delete team error:", error);
      return res.status(500).json({ message: "Erro ao excluir equipe" });
    }
  });

  // GET /api/teams/:id/members - Membros de uma equipe
  app.get("/api/teams/:id/members", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const members = await storage.getTeamMembersByTeam(id);
      const membersWithUsers = await Promise.all(members.map(async (member) => {
        const user = await storage.getUser(member.userId);
        return {
          ...member,
          userName: user?.name || "N/A",
          userEmail: user?.email || "N/A",
          userRole: user?.role || "N/A",
        };
      }));
      return res.json(membersWithUsers);
    } catch (error) {
      console.error("Get team members error:", error);
      return res.status(500).json({ message: "Erro ao buscar membros" });
    }
  });

  // POST /api/teams/:id/members - Adicionar membro à equipe
  app.post("/api/teams/:id/members", requireAuth, requireMaster, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { userId, roleInTeam } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "userId é obrigatório" });
      }
      await storage.deleteTeamMemberByUser(userId);
      const member = await storage.createTeamMember({
        teamId,
        userId,
        roleInTeam: roleInTeam || "seller",
      });
      return res.status(201).json(member);
    } catch (error) {
      console.error("Add team member error:", error);
      return res.status(500).json({ message: "Erro ao adicionar membro" });
    }
  });

  // DELETE /api/teams/members/:userId - Remover membro da equipe
  app.delete("/api/teams/members/:userId", requireAuth, requireMaster, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      await storage.deleteTeamMemberByUser(userId);
      return res.json({ message: "Membro removido da equipe" });
    } catch (error) {
      console.error("Remove team member error:", error);
      return res.status(500).json({ message: "Erro ao remover membro" });
    }
  });

  // GET /api/ai-prompts/roleplay/active - Prompt ativo para o usuário atual
  app.get("/api/ai-prompts/roleplay/active", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { prompt, scope } = await storage.getActiveRoleplayPrompt(userId);
      return res.json({ prompt, scope });
    } catch (error) {
      console.error("Get active prompt error:", error);
      return res.status(500).json({ message: "Erro ao buscar prompt ativo" });
    }
  });

  // GET /api/ai-prompts/roleplay/global - Histórico de prompts globais (Master)
  app.get("/api/ai-prompts/roleplay/global", requireAuth, requireMaster, async (req, res) => {
    try {
      const prompts = await storage.getGlobalRoleplayPrompts();
      return res.json(prompts);
    } catch (error) {
      console.error("Get global prompts error:", error);
      return res.status(500).json({ message: "Erro ao buscar prompts globais" });
    }
  });

  // POST /api/ai-prompts/roleplay/global - Salvar novo prompt global (Master)
  app.post("/api/ai-prompts/roleplay/global", requireAuth, requireMaster, async (req, res) => {
    try {
      const { promptText } = req.body;
      if (!promptText || promptText.trim().length < 10) {
        return res.status(400).json({ message: "Prompt muito curto (mínimo 10 caracteres)" });
      }
      const prompt = await storage.saveRoleplayPrompt("roleplay", "global", null, promptText, req.user!.id);
      return res.status(201).json(prompt);
    } catch (error) {
      console.error("Save global prompt error:", error);
      return res.status(500).json({ message: "Erro ao salvar prompt" });
    }
  });

  // GET /api/ai-prompts/roleplay/team/:teamId - Histórico de prompts da equipe
  app.get("/api/ai-prompts/roleplay/team/:teamId", requireAuth, async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const userRole = req.user!.role as UserRole;
      if (!hasRole(req.user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      if (userRole === "coordenacao") {
        const team = await storage.getTeam(teamId);
        if (!team || team.managerUserId !== req.user!.id) {
          return res.status(403).json({ message: "Você não gerencia esta equipe" });
        }
      }
      const prompts = await storage.getTeamRoleplayPrompts(teamId);
      return res.json(prompts);
    } catch (error) {
      console.error("Get team prompts error:", error);
      return res.status(500).json({ message: "Erro ao buscar prompts da equipe" });
    }
  });

  // POST /api/ai-prompts/roleplay/team/:teamId - Salvar prompt de equipe (Coordenador ou Master)
  app.post("/api/ai-prompts/roleplay/team/:teamId", requireAuth, async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const userRole = req.user!.role as UserRole;
      if (!hasRole(req.user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      if (userRole === "coordenacao") {
        const team = await storage.getTeam(teamId);
        if (!team || team.managerUserId !== req.user!.id) {
          return res.status(403).json({ message: "Você não gerencia esta equipe" });
        }
      }
      const { promptText } = req.body;
      if (!promptText || promptText.trim().length < 10) {
        return res.status(400).json({ message: "Prompt muito curto (mínimo 10 caracteres)" });
      }
      const prompt = await storage.saveRoleplayPrompt("roleplay", "team", teamId, promptText, req.user!.id);
      return res.status(201).json(prompt);
    } catch (error) {
      console.error("Save team prompt error:", error);
      return res.status(500).json({ message: "Erro ao salvar prompt da equipe" });
    }
  });

  // DELETE /api/ai-prompts/roleplay/team/:teamId - Resetar prompt da equipe (volta para global)
  app.delete("/api/ai-prompts/roleplay/team/:teamId", requireAuth, async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const userRole = req.user!.role as UserRole;
      if (!hasRole(req.user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      if (userRole === "coordenacao") {
        const team = await storage.getTeam(teamId);
        if (!team || team.managerUserId !== req.user!.id) {
          return res.status(403).json({ message: "Você não gerencia esta equipe" });
        }
      }
      await storage.resetTeamRoleplayPrompt(teamId);
      return res.json({ message: "Prompt da equipe resetado. Agora usa o prompt global." });
    } catch (error) {
      console.error("Reset team prompt error:", error);
      return res.status(500).json({ message: "Erro ao resetar prompt" });
    }
  });

  // GET /api/user/team - Obter equipe do usuário atual
  app.get("/api/user/team", requireAuth, async (req, res) => {
    try {
      const membership = await storage.getTeamMemberByUser(req.user!.id);
      if (!membership) {
        return res.json({ team: null, membership: null });
      }
      const team = await storage.getTeam(membership.teamId);
      return res.json({ team, membership });
    } catch (error) {
      console.error("Get user team error:", error);
      return res.status(500).json({ message: "Erro ao buscar equipe" });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
