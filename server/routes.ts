import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";

function safeCompetencia(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(val);
}
import { z } from "zod";
import { storage, db } from "./storage";
import {
  resolveTenant,
  requireTenant,
  validateTenantAccess,
  getTenantBranding,
  getUserTenants,
  checkUserTenantAccess,
} from "./tenant-middleware";
import { validateAccess } from "./middleware/validateAccess";
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
  tenants,
  tenantDomains,
  tenantAuditLog,
  userTenants,
  teams,
  teamMembers,
  aiPrompts,
  salesCampaigns,
  salesLeads,
  salesLeadAssignments,
  salesLeadEvents,
  leadInteractions,
  clientesPessoa,
  clientesVinculo,
  clientContacts,
  importRuns,
  insertSalesCampaignSchema,
  insertSalesLeadSchema,
  LEAD_STATUS,
  LEAD_MARKERS,
  TIPOS_CONTATO,
  MODULE_LIST,
  MODULE_SUB_ITEMS,
  MODULE_LABELS,
  parsePermissionKey,
  getSubItemPermissionKey,
  KANBAN_COLUMNS,
  insertPersonalTaskSchema,
  nomenclaturas,
  insertNomenclaturaSchema,
  NOMENCLATURA_CATEGORIA,
  feedbacks,
  insertFeedbackSchema,
  type User,
  type InsertCoefficientTable,
  type InsertSalesLead,
  USER_ROLES,
  type UserRole,
  type FiltrosPedidoLista,
  type PricingSettings,
  producoesContratos,
  producoesImportacoes,
  leadTags,
  leadTagAssignments,
  materials,
  insertMaterialSchema,
  commissionTables,
  insertCommissionTableSchema,
  creativePacks,
  insertCreativePackSchema,
  creatives,
  insertCreativeSchema,
  creativeGenerations,
  creativeGenerationQuota,
  creativeBrandConfig,
  companies,
  insertCompanySchema,
} from "@shared/schema";
import { eq, asc, desc, and, or, sql, inArray, not } from "drizzle-orm";
import * as XLSX from "xlsx";
import multer from "multer";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import Papa from "papaparse";
import { createNotification } from "./notification-service";
import { registerContractRoutes } from "./contracts";
import {
  addToPortfolio,
  checkPortfolioBlock,
  updateExpiredPortfolios,
  mapTipoContratoToProductType,
} from "./portfolio";

// Configure multer for file uploads using memory storage (for smaller files)
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

// Configure multer for massive streaming imports using disk storage
const uploadDisk = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = "/tmp/imports";
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "_" + file.originalname);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit for massive imports
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Formato de arquivo inválido para importação massiva. Use .csv",
        ),
      );
    }
  },
});

// Configure multer for CSV/XLSX split uploads using disk storage
const uploadCsvXlsx = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = "/tmp/csv_split_uploads";
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "_" + file.originalname);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".csv", ".xlsx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de arquivo inválido. Use .csv ou .xlsx"));
    }
  },
});

// Configure multer for TXT split uploads using disk storage
const uploadTxt = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = "/tmp/split_uploads";
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "_" + file.originalname);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit for TXT files
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de arquivo inválido. Use .txt"));
    }
  },
});

// Configure multer for PDF uploads (roteiros AI extraction)
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for PDFs
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Formato de arquivo inválido. Use arquivo PDF."));
    }
  },
});

// Configure multer for logo/image uploads (PNG, SVG, ICO - max 2MB)
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for logos
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/png",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];
    const allowedExtensions = [".png", ".svg", ".ico"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Formato de arquivo inválido. Use PNG, SVG ou ICO (máximo 2MB).",
        ),
      );
    }
  },
});

// Configure multer for avatar uploads (JPEG, PNG, WebP - max 2MB)
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Formato inválido. Use JPG, PNG ou WebP (máximo 2MB)."));
    }
  },
});

// Configure multer for creative image uploads (JPEG, PNG, WebP - max 5MB)
const uploadCreativeImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      allowedMimeTypes.includes(file.mimetype) &&
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Formato inválido. Use JPG, PNG ou WebP (máximo 5MB)."));
    }
  },
});

const mimeToExt: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

// ============ ASYNC RESET JOB SYSTEM ============
interface ResetJobStep {
  name: string;
  status: "pending" | "running" | "completed" | "error";
  countBefore?: number;
  deleted?: number;
  elapsedMs?: number;
  error?: string;
}

interface ResetJob {
  id: string;
  tenantId: number;
  userId: number;
  status: "pending" | "running" | "completed" | "error";
  currentStep: number;
  totalSteps: number;
  steps: ResetJobStep[];
  countsBefore: Record<string, number>;
  deleted: Record<string, number>;
  startedAt: Date;
  completedAt?: Date;
  elapsedMs?: number;
  error?: string;
}

const resetJobs = new Map<string, ResetJob>();

function generateJobId(): string {
  return `reset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Cleanup old jobs after 1 hour
setInterval(
  () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, job] of resetJobs.entries()) {
      if (job.startedAt.getTime() < oneHourAgo) {
        resetJobs.delete(id);
      }
    }
  },
  5 * 60 * 1000,
); // Check every 5 minutes

// Login validation: accepts 4-digit numeric code (new) OR email (legacy)
const loginValidatorServer = z.string().refine(
  (val) => {
    if (/^\d{4}$/.test(val)) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val);
  },
  { message: "Login deve ser um código de 4 dígitos ou email válido" },
);

// Schema for updating users
const updateUserSchema = z
  .object({
    name: z.string().min(3).optional(),
    email: loginValidatorServer.optional(),
    password: z.string().min(6).optional(),
    role: z.enum(USER_ROLES).optional(),
    managerId: z.number().int().nullable().optional(),
    isActive: z.boolean().optional(),
    isDemo: z.boolean().optional(),
  })
  .strict(); // Reject extra fields

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
// Deriva tenantId do usuário autenticado, não depende de header
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user || !user.isActive) {
    return res
      .status(401)
      .json({ message: "Usuário não encontrado ou inativo" });
  }

  req.user = user;

  // CRÍTICO: Derivar tenantId do usuário autenticado
  // Prioridade: session.tenantId (set at login) > domain-based (resolveTenant) > user_tenants lookup > dev fallback
  if (req.session.tenantId) {
    req.tenantId = req.session.tenantId;
  } else if (req.tenantId) {
    // Domain-based tenant already resolved by resolveTenant middleware
    req.session.tenantId = req.tenantId;
  } else if (user.isMaster) {
    // Master without session or domain tenant - dev fallback
    if (process.env.NODE_ENV === "development") {
      req.tenantId = 4;
    }
  } else {
    // Non-master user without session or domain tenant - look up from user_tenants
    const utResult = await db.execute(
      sql`SELECT tenant_id FROM user_tenants WHERE user_id = ${user.id} ORDER BY tenant_id ASC LIMIT 1`,
    );
    if (utResult.rows.length > 0) {
      req.tenantId = utResult.rows[0].tenant_id as number;
      req.session.tenantId = req.tenantId;
    }
  }

  // Aplicar validação de acesso (horário, dia, IP)
  validateAccess(req, res, next);
}

// Helper to check if user has one of the allowed roles
function hasRole(user: User | undefined, allowedRoles: UserRole[]): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role as UserRole);
}

// Master only middleware (full access - admin)
// Uses isMaster field for true master users who can access all tenants
function requireMaster(req: Request, res: Response, next: NextFunction) {
  // Check if user has isMaster flag set to true (real master user)
  if (!req.user?.isMaster) {
    return res
      .status(403)
      .json({ message: "Acesso negado - apenas administradores master" });
  }
  next();
}

// Role-based master check - REFACTORED to use isMaster flag instead of role
// This is for administrative functions that require true system admin access
function requireMasterRole(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isMaster) {
    logPermissionCheck(
      req.user?.id || 0,
      req.user?.name || "unknown",
      "admin",
      "master",
      false,
      "isMaster=false",
    );
    return res
      .status(403)
      .json({ message: "Acesso negado - apenas administradores" });
  }
  logPermissionCheck(
    req.user.id,
    req.user.name,
    "admin",
    "master",
    true,
    "isMaster=true",
  );
  next();
}

// Middleware para acesso à área Operacional (bancos, convênios, tabelas, roteiros)
// Permite: isMaster, role='operacional', ou permissão de edição em modulo_roteiros
async function requireOperacionalAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  // isMaster tem acesso total
  if (req.user.isMaster) {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_roteiros",
      "edit",
      true,
      "isMaster=true",
    );
    return next();
  }

  // Role 'operacional' tem acesso direto à área operacional
  if (req.user.role === "operacional") {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_roteiros",
      "edit",
      true,
      "role=operacional",
    );
    return next();
  }

  // Verificar permissão de edição no módulo de roteiros (área operacional)
  const hasEditAccess = await storage.hasSubItemAccess(
    req.user.id,
    "modulo_roteiros",
    "roteiros_bancarios",
    "canEdit",
  );
  if (hasEditAccess) {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_roteiros.roteiros_bancarios",
      "edit",
      true,
      "Profile permission granted",
    );
    return next();
  }

  // Também verificar permissões específicas para outros sub-itens operacionais
  const hasConveniosEdit = await storage.hasSubItemAccess(
    req.user.id,
    "modulo_roteiros",
    "convenios",
    "canEdit",
  );
  const hasBancosEdit = await storage.hasSubItemAccess(
    req.user.id,
    "modulo_roteiros",
    "bancos",
    "canEdit",
  );
  const hasTabelasEdit = await storage.hasSubItemAccess(
    req.user.id,
    "modulo_roteiros",
    "tabelas_coeficientes",
    "canEdit",
  );

  if (hasConveniosEdit || hasBancosEdit || hasTabelasEdit) {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_roteiros",
      "edit",
      true,
      "Sub-item edit permission",
    );
    return next();
  }

  logPermissionCheck(
    req.user.id,
    req.user.name,
    "modulo_roteiros",
    "edit",
    false,
    "No operacional access",
  );
  return res.status(403).json({
    message:
      "Acesso negado - você não tem permissão para editar a área operacional",
  });
}

// Table access middleware - REFACTORED to use profile-based permissions
// Now checks for modulo_tabelas_coeficientes permission instead of role
async function requireTableAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  // isMaster has full access
  if (req.user.isMaster) {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_tabelas_coeficientes",
      "view",
      true,
      "isMaster=true",
    );
    return next();
  }

  // Check profile-based permission for tables module
  const hasAccess = await storage.hasModuleAccess(
    req.user.id,
    "modulo_tabelas_coeficientes",
  );
  if (!hasAccess) {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_tabelas_coeficientes",
      "view",
      false,
      "No profile permission",
    );
    return res.status(403).json({
      message:
        "Acesso negado - você não tem permissão para acessar tabelas de coeficientes",
    });
  }

  logPermissionCheck(
    req.user.id,
    req.user.name,
    "modulo_tabelas_coeficientes",
    "view",
    true,
    "Profile permission granted",
  );
  next();
}

// Users management access middleware - REFACTORED to use profile-based permissions
// Now checks for modulo_config_usuarios permission instead of role
async function requireUserManagementAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  // isMaster has full access
  if (req.user.isMaster) {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_config_usuarios",
      "edit",
      true,
      "isMaster=true",
    );
    return next();
  }

  // Check if user has modulo_config_usuarios permission with canEdit
  const hasConfigEditAccess = await storage.hasModuleEditAccess(
    req.user.id,
    "modulo_config_usuarios",
  );
  if (hasConfigEditAccess) {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_config_usuarios",
      "edit",
      true,
      "Profile permission granted",
    );
    return next();
  }

  logPermissionCheck(
    req.user.id,
    req.user.name,
    "modulo_config_usuarios",
    "edit",
    false,
    "No edit permission",
  );
  return res.status(403).json({
    message: "Acesso negado - você não tem permissão para gerenciar usuários",
  });
}

// Legacy alias for backward compatibility
const requireManagerAccess = requireUserManagementAccess;

// Academia access middleware - REFACTORED to use profile-based permissions
// Now checks for modulo_academia permission instead of role
async function requireAcademiaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  // isMaster has full access
  if (req.user.isMaster) {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_academia",
      "view",
      true,
      "isMaster=true",
    );
    return next();
  }

  // Check profile-based permission for academia module
  const hasAccess = await storage.hasModuleAccess(
    req.user.id,
    "modulo_academia",
  );
  if (!hasAccess) {
    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_academia",
      "view",
      false,
      "No profile permission",
    );
    return res.status(403).json({
      message:
        "Acesso negado - você não tem permissão para acessar o Treinamento",
    });
  }

  logPermissionCheck(
    req.user.id,
    req.user.name,
    "modulo_academia",
    "view",
    true,
    "Profile permission granted",
  );
  next();
}

// ===== PERMISSION DIAGNOSTIC LOGGING =====
// Temporary diagnostic logging for permission failures (set to true to enable)
const PERMISSION_DEBUG = true;

function logPermissionCheck(
  userId: number,
  userName: string,
  module: string,
  accessType: string,
  granted: boolean,
  reason: string,
) {
  if (PERMISSION_DEBUG) {
    const status = granted ? "✓ GRANTED" : "✗ DENIED";
    console.log(
      `[PERMISSION] ${status} | User: ${userName} (ID:${userId}) | Module: ${module} | Access: ${accessType} | Reason: ${reason}`,
    );
  }
}

// Module access middleware - checks if user has permission to access a specific module
// REFACTORED: Permissions are now EXCLUSIVELY profile-based. Role does NOT grant automatic access.
// The only exception is users with isMaster=true flag, which have full system access.
function requireModuleAccess(
  module: string,
  accessType: "view" | "edit" = "view",
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const userId = req.user.id;
    const userName = req.user.name;

    // ONLY isMaster flag grants full bypass (true system administrators)
    if (req.user.isMaster) {
      logPermissionCheck(
        userId,
        userName,
        module,
        accessType,
        true,
        "isMaster=true (system admin)",
      );
      return next();
    }

    // Check profile-based permissions exclusively
    let hasAccess = false;
    if (accessType === "edit") {
      hasAccess = await storage.hasModuleEditAccess(userId, module);
    } else {
      hasAccess = await storage.hasModuleAccess(userId, module);
    }

    if (!hasAccess) {
      logPermissionCheck(
        userId,
        userName,
        module,
        accessType,
        false,
        "No profile permission found",
      );
      return res.status(403).json({
        message:
          "Acesso negado - você não tem permissão para acessar este módulo",
        module,
        accessType,
      });
    }

    logPermissionCheck(
      userId,
      userName,
      module,
      accessType,
      true,
      "Profile permission granted",
    );
    next();
  };
}

// Generic permission check middleware for specific actions
// Example: requirePermission("modulo_crm", "edit")
function requirePermission(
  module: string,
  accessType: "view" | "edit" | "delegate" = "view",
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const userId = req.user.id;
    const userName = req.user.name;

    // ONLY isMaster grants full bypass
    if (req.user.isMaster) {
      logPermissionCheck(
        userId,
        userName,
        module,
        accessType,
        true,
        "isMaster=true (system admin)",
      );
      return next();
    }

    // Check specific permission level
    const permissions = await storage.getUserPermissions(userId);
    const perm = permissions.find((p) => p.module === module);

    let hasAccess = false;
    if (perm) {
      switch (accessType) {
        case "view":
          hasAccess = perm.canView || perm.canEdit || perm.canDelegate;
          break;
        case "edit":
          hasAccess = perm.canEdit || perm.canDelegate;
          break;
        case "delegate":
          hasAccess = perm.canDelegate;
          break;
      }
    }

    if (!hasAccess) {
      logPermissionCheck(
        userId,
        userName,
        module,
        accessType,
        false,
        `Permission check failed (perm exists: ${!!perm})`,
      );
      return res.status(403).json({
        message: `Acesso negado - você não tem permissão de ${accessType} para este módulo`,
        module,
        accessType,
      });
    }

    logPermissionCheck(
      userId,
      userName,
      module,
      accessType,
      true,
      "Permission granted via profile",
    );
    next();
  };
}

// Helper to check permission in code (not middleware)
async function checkUserPermission(
  userId: number,
  isMaster: boolean,
  module: string,
  accessType: "view" | "edit" | "delegate" = "view",
): Promise<boolean> {
  // isMaster bypasses all checks
  if (isMaster) return true;

  const permissions = await storage.getUserPermissions(userId);
  const perm = permissions.find((p) => p.module === module);

  if (!perm) return false;

  switch (accessType) {
    case "view":
      return perm.canView || perm.canEdit || perm.canDelegate;
    case "edit":
      return perm.canEdit || perm.canDelegate;
    case "delegate":
      return perm.canDelegate;
    default:
      return false;
  }
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
  { quantidadeMaxima: 100, nomePacote: "Pacote 100", preco: 37.9 },
  { quantidadeMaxima: 300, nomePacote: "Pacote 300", preco: 67.9 },
  { quantidadeMaxima: 500, nomePacote: "Pacote 500", preco: 97.9 },
  { quantidadeMaxima: 1000, nomePacote: "Pacote 1000", preco: 187.9 },
  { quantidadeMaxima: 2000, nomePacote: "Pacote 2000", preco: 297.9 },
  { quantidadeMaxima: 3000, nomePacote: "Pacote 3000", preco: 397.9 },
  { quantidadeMaxima: 5000, nomePacote: "Pacote 5000", preco: 597.9 },
  { quantidadeMaxima: 10000, nomePacote: "Pacote 10000", preco: 997.9 },
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

    return result.map((p) => ({
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
async function calculatePackagePrice(
  qtdRegistros: number,
  pacotes?: PacotePrecoData[],
): Promise<PricingResult> {
  if (qtdRegistros <= 0) {
    return { precoTotal: 0, nomePacote: "", quantidadePacote: 0 };
  }

  const pacotesAtivos = pacotes || (await fetchPacotesFromDb());

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
  // ===== TENANT RESOLUTION MIDDLEWARE =====
  app.use(resolveTenant);

  // ===== DATABASE ERROR HANDLING MIDDLEWARE =====
  // Catches database connection errors and returns user-friendly messages
  const handleDatabaseError = (error: any, res: Response): boolean => {
    const errorMessage = error?.message || String(error);

    // Check for connection pool exhaustion
    if (errorMessage.includes("remaining connection slots")) {
      console.error("[DB] Connection pool exhausted:", errorMessage);
      res.status(503).json({
        message:
          "Sistema temporariamente sobrecarregado. Por favor, aguarde alguns segundos e tente novamente.",
      });
      return true;
    }

    // Check for connection timeout
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("ETIMEDOUT")
    ) {
      console.error("[DB] Connection timeout:", errorMessage);
      res.status(504).json({
        message:
          "A conexão com o banco de dados expirou. Por favor, tente novamente.",
      });
      return true;
    }

    // Check for connection refused
    if (
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("ECONNREFUSED")
    ) {
      console.error("[DB] Connection failed:", errorMessage);
      res.status(503).json({
        message:
          "Não foi possível conectar ao banco de dados. Por favor, tente novamente em alguns instantes.",
      });
      return true;
    }

    return false;
  };

  // Helper function to log tenant audit entries
  async function logTenantAudit(
    tenantId: number,
    userId: number | null,
    action: string,
    changedFields: Record<string, { before: any; after: any }>,
    ipAddress?: string,
  ) {
    try {
      await db.insert(tenantAuditLog).values({
        tenantId,
        userId,
        action,
        changedFields,
        ipAddress: ipAddress || null,
      });
      console.log(
        `[TENANT-AUDIT] Logged ${action} for tenant ${tenantId} by user ${userId}`,
      );
    } catch (error) {
      console.error(`[TENANT-AUDIT] Failed to log audit entry:`, error);
    }
  }

  // ===== TENANT ROUTES =====

  // Get current tenant branding/config (public - based on domain)
  app.get("/api/tenant", async (req: any, res) => {
    try {
      let tenant = req.tenant;

      // In development mode without a resolved tenant, try multiple fallbacks
      if (!tenant && process.env.NODE_ENV === "development") {
        // Priority 1: Session tenantId (authenticated users)
        const sessionTenantId = req.session?.tenantId;
        if (sessionTenantId) {
          const [sessionTenant] = await db
            .select()
            .from(tenants)
            .where(
              and(eq(tenants.id, sessionTenantId), eq(tenants.isActive, true)),
            )
            .limit(1);
          tenant = sessionTenant || null;
        }

        // Priority 2: Dev tenant cookie (persists across logout for testing)
        if (!tenant) {
          // Safe cookie parsing that handles cookies with '=' in values
          const cookieHeader = req.headers.cookie || "";
          let devTenantId: string | null = null;

          try {
            for (const cookie of cookieHeader.split(";")) {
              const trimmed = cookie.trim();
              const eqIndex = trimmed.indexOf("=");
              if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex);
                const value = trimmed.substring(eqIndex + 1);
                if (key === "devTenantId") {
                  devTenantId = decodeURIComponent(value);
                  break;
                }
              }
            }
          } catch (e) {
            // Ignore cookie parsing errors
          }

          if (devTenantId && !isNaN(parseInt(devTenantId))) {
            const [cookieTenant] = await db
              .select()
              .from(tenants)
              .where(
                and(
                  eq(tenants.id, parseInt(devTenantId)),
                  eq(tenants.isActive, true),
                ),
              )
              .limit(1);
            tenant = cookieTenant || null;
          }
        }

        // Priority 3: Fall back to Capital Go (primary dev tenant, id=4)
        if (!tenant) {
          const DEV_DEFAULT_TENANT_ID = 4;
          const [fallbackTenant] = await db
            .select()
            .from(tenants)
            .where(
              and(
                eq(tenants.id, DEV_DEFAULT_TENANT_ID),
                eq(tenants.isActive, true),
              ),
            )
            .limit(1);
          if (fallbackTenant) {
            tenant = fallbackTenant;
          } else {
            const [anyTenant] = await db
              .select()
              .from(tenants)
              .where(eq(tenants.isActive, true))
              .limit(1);
            tenant = anyTenant || null;
          }
        }
      }

      if (!tenant) {
        return res.status(404).json({ message: "Tenant não encontrado" });
      }

      if (process.env.NODE_ENV === "development" && tenant) {
        const cookieHeader = req.headers.cookie || "";
        const hasDevCookie = cookieHeader.includes("devTenantId=");
        if (!hasDevCookie) {
          res.cookie("devTenantId", tenant.id.toString(), {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: false,
            sameSite: "lax",
          });
        }
      }

      res.json({
        id: tenant.id,
        key: tenant.key,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        logoLoginUrl: (tenant as any).logoLoginUrl,
        faviconUrl: tenant.faviconUrl,
        logoHeight: (tenant as any).logoHeight || 64,
        slogan: (tenant as any).slogan,
        fontFamily: (tenant as any).fontFamily,
        theme: tenant.themeJson,
      });
    } catch (error) {
      console.error("Get tenant error:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar configuração do tenant" });
    }
  });

  // Get current tenant for branding page (requires auth)
  app.get("/api/tenant/current", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(404).json({ message: "Tenant não encontrado" });
      }

      const [tenantData] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenantData) {
        return res.status(404).json({ message: "Tenant não encontrado" });
      }

      res.json(tenantData);
    } catch (error) {
      console.error("Get current tenant error:", error);
      res.status(500).json({ message: "Erro ao buscar tenant" });
    }
  });

  // Update tenant branding (Master only)
  app.put(
    "/api/tenant/branding",
    requireAuth,
    requireMaster,
    async (req: any, res) => {
      try {
        const tenantId = req.tenantId;
        const userId = req.user?.id;
        const ipAddress = req.ip || req.connection?.remoteAddress;

        if (!tenantId) {
          return res.status(404).json({ message: "Tenant não encontrado" });
        }

        // Fetch current tenant state for audit
        const [currentTenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);
        if (!currentTenant) {
          return res.status(404).json({ message: "Tenant não encontrado" });
        }

        const { name, slogan, fontFamily, logoHeight, themeJson } = req.body;

        // Log detalhado para auditoria
        console.log(
          `[TENANT-BRANDING-UPDATE] userId=${userId} tenantId=${tenantId} timestamp=${new Date().toISOString()}`,
        );
        console.log(
          `[TENANT-BRANDING-UPDATE] Data: name="${name}" slogan="${slogan}" fontFamily="${fontFamily}" logoHeight=${logoHeight}`,
        );

        const existingTheme =
          (currentTenant.themeJson as Record<string, any>) || {};
        const incomingTheme = (themeJson as Record<string, any>) || {};
        const mergedThemeJson = { ...existingTheme, ...incomingTheme };

        console.log(
          `[TENANT-BRANDING-UPDATE] Theme merge: preserved keys from existing = [${Object.keys(
            existingTheme,
          )
            .filter((k) => !(k in incomingTheme))
            .join(", ")}]`,
        );

        const updateData: any = {
          name,
          slogan,
          fontFamily,
          themeJson: mergedThemeJson,
          updatedAt: new Date(),
        };

        // Only update logoHeight if provided and valid
        if (logoHeight !== undefined && logoHeight !== null) {
          updateData.logoHeight = Math.min(
            Math.max(parseInt(logoHeight) || 64, 32),
            120,
          );
        }

        const result = await db
          .update(tenants)
          .set(updateData)
          .where(eq(tenants.id, tenantId))
          .returning();

        if (result.length === 0) {
          console.log(
            `[TENANT-BRANDING-UPDATE] FAILED - Tenant ${tenantId} not found`,
          );
          return res.status(404).json({ message: "Tenant não encontrado" });
        }

        // Record audit with before/after values
        const changedFields: Record<string, { before: any; after: any }> = {};
        if (currentTenant.name !== name)
          changedFields.name = { before: currentTenant.name, after: name };
        if ((currentTenant as any).slogan !== slogan)
          changedFields.slogan = {
            before: (currentTenant as any).slogan,
            after: slogan,
          };
        if ((currentTenant as any).fontFamily !== fontFamily)
          changedFields.fontFamily = {
            before: (currentTenant as any).fontFamily,
            after: fontFamily,
          };
        if ((currentTenant as any).logoHeight !== updateData.logoHeight)
          changedFields.logoHeight = {
            before: (currentTenant as any).logoHeight,
            after: updateData.logoHeight,
          };
        if (
          JSON.stringify(currentTenant.themeJson) !==
          JSON.stringify(mergedThemeJson)
        )
          changedFields.themeJson = {
            before: currentTenant.themeJson,
            after: mergedThemeJson,
          };

        if (Object.keys(changedFields).length > 0) {
          await logTenantAudit(
            tenantId,
            userId,
            "BRANDING_UPDATE",
            changedFields,
            ipAddress,
          );
        }

        console.log(
          `[TENANT-BRANDING-UPDATE] SUCCESS - Tenant ${tenantId} updated. New updatedAt: ${result[0].updatedAt}`,
        );
        res.json(result[0]);
      } catch (error) {
        console.error("[TENANT-BRANDING-UPDATE] ERROR:", error);
        res
          .status(500)
          .json({ message: "Erro ao atualizar identidade visual" });
      }
    },
  );

  // Upload tenant logo (Master only)
  // Uses uploadLogo multer config that accepts PNG, SVG, ICO (max 2MB)
  app.post(
    "/api/tenant/logo",
    requireAuth,
    requireMaster,
    uploadLogo.single("file"),
    async (req: any, res) => {
      try {
        const tenantId = req.tenantId;
        const userId = req.user?.id;
        const ipAddress = req.ip || req.connection?.remoteAddress;
        const file = req.file;
        const type = req.body.type as "sidebar" | "login" | "favicon";

        console.log(
          `[TENANT-LOGO-UPLOAD] userId=${userId} tenantId=${tenantId} type=${type} timestamp=${new Date().toISOString()}`,
        );

        if (!tenantId) {
          return res.status(404).json({ message: "Tenant não encontrado" });
        }

        if (!file) {
          return res.status(400).json({
            message:
              "Arquivo não enviado. Formatos aceitos: PNG, SVG, ICO (máximo 2MB)",
          });
        }

        if (!["sidebar", "login", "favicon"].includes(type)) {
          return res
            .status(400)
            .json({ message: "Tipo inválido. Use: sidebar, login ou favicon" });
        }

        // Fetch current tenant for audit
        const [currentTenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        // Save file to uploads folder with tenant-specific naming
        const fsModule = await import("fs");
        const pathModule = await import("path");

        const uploadsDir = pathModule.join(process.cwd(), "uploads", "logos");
        if (!fsModule.existsSync(uploadsDir)) {
          fsModule.mkdirSync(uploadsDir, { recursive: true });
        }

        // Use semantic naming: logo-{type}-{tenantId}.{ext}
        const ext =
          pathModule.extname(file.originalname).toLowerCase() || ".png";
        const filename = `logo-${type}-${tenantId}${ext}`;
        const filepath = pathModule.join(uploadsDir, filename);

        console.log(`[TENANT-LOGO-UPLOAD] Saving file to: ${filepath}`);

        // Delete any existing file with different extension for this tenant/type
        const possibleExts = [".png", ".svg", ".ico"];
        for (const existingExt of possibleExts) {
          if (existingExt !== ext) {
            const oldFilePath = pathModule.join(
              uploadsDir,
              `logo-${type}-${tenantId}${existingExt}`,
            );
            if (fsModule.existsSync(oldFilePath)) {
              try {
                fsModule.unlinkSync(oldFilePath);
                console.log(
                  `[TENANT-LOGO-UPLOAD] Deleted old file: ${oldFilePath}`,
                );
              } catch (e) {
                console.warn(
                  `[TENANT-LOGO-UPLOAD] Could not delete old logo file: ${oldFilePath}`,
                );
              }
            }
          }
        }

        fsModule.writeFileSync(filepath, file.buffer);

        // Generate URL for the uploaded file with cache-busting timestamp
        const logoUrl = `/uploads/logos/${filename}?t=${Date.now()}`;

        // Update tenant with new logo URL based on type
        const updateData: any = {
          updatedAt: new Date(), // Sempre atualizar timestamp
        };
        let fieldName = "";
        let oldValue = "";
        if (type === "sidebar") {
          updateData.logoUrl = logoUrl;
          fieldName = "logoUrl";
          oldValue = currentTenant?.logoUrl || "";
        } else if (type === "login") {
          updateData.logoLoginUrl = logoUrl;
          fieldName = "logoLoginUrl";
          oldValue = (currentTenant as any)?.logoLoginUrl || "";
        } else if (type === "favicon") {
          updateData.faviconUrl = logoUrl;
          fieldName = "faviconUrl";
          oldValue = currentTenant?.faviconUrl || "";
        }

        console.log(
          `[TENANT-LOGO-UPLOAD] Updating tenant ${tenantId} with: ${JSON.stringify(updateData)}`,
        );

        const result = await db
          .update(tenants)
          .set(updateData)
          .where(eq(tenants.id, tenantId))
          .returning();

        // Record audit
        await logTenantAudit(
          tenantId,
          userId,
          "LOGO_UPLOAD",
          {
            [fieldName]: { before: oldValue, after: logoUrl },
            type: { before: null, after: type },
          },
          ipAddress,
        );

        console.log(
          `[TENANT-LOGO-UPLOAD] SUCCESS - Tenant ${tenantId} logo updated. New updatedAt: ${result[0]?.updatedAt}`,
        );

        res.json({
          message: "Logo atualizado com sucesso",
          url: logoUrl,
          tenant: result[0],
        });
      } catch (error: any) {
        console.error("[TENANT-LOGO-UPLOAD] ERROR:", error);
        if (
          error.message &&
          error.message.includes("Formato de arquivo inválido")
        ) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Erro ao fazer upload do logo" });
      }
    },
  );

  // Get user's accessible tenants (requires auth)
  app.get("/api/user/tenants", requireAuth, async (req, res) => {
    try {
      const userTenantsList = await getUserTenants(req.user!.id);
      res.json(
        userTenantsList.map((t) => ({
          id: t.id,
          key: t.key,
          name: t.name,
          logoUrl: t.logoUrl,
        })),
      );
    } catch (error) {
      console.error("Get user tenants error:", error);
      res.status(500).json({ message: "Erro ao buscar tenants do usuário" });
    }
  });

  // ===== AUTH ROUTES =====

  // Create user with role-based permissions:
  // - admin: can create any user
  // - atendimento: can create any user EXCEPT admin
  // - coordenador: can only create vendedor linked to themselves
  app.post(
    "/api/users",
    requireAuth,
    requireUserManagementAccess,
    async (req, res) => {
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
              message: "Coordenadores só podem criar vendedores",
            });
          }
          // Vendedor must be linked to this coordenador (or will be auto-linked)
          if (managerId && managerId !== req.user!.id) {
            return res.status(403).json({
              message: "Você só pode criar vendedores em sua equipe",
            });
          }
        } else if (currentUserRole === "atendimento") {
          // Atendimento cannot create master (admin)
          if (role === "master") {
            return res.status(403).json({
              message: "Você não tem permissão para criar administradores",
            });
          }
        }
        // master has no restrictions

        // Check if user already exists
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "Login já cadastrado" });
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
    },
  );

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

      // Validate tenant access (only if tenant is resolved from domain)
      if (req.tenantId) {
        const hasAccess = await checkUserTenantAccess(user.id, req.tenantId);
        if (!hasAccess) {
          return res.status(403).json({
            message:
              "Você não tem acesso a este ambiente. Por favor, acesse pelo domínio correto.",
          });
        }
      }

      // Determine tenant ID for session
      let sessionTenantId = req.tenantId;

      if (!sessionTenantId && process.env.NODE_ENV === "development") {
        const userTenantList = await getUserTenants(user.id);
        if (userTenantList.length > 0) {
          const cookieHeader = req.headers.cookie || "";
          let devTenantId: number | null = null;
          try {
            for (const cookie of cookieHeader.split(";")) {
              const trimmed = cookie.trim();
              const eqIndex = trimmed.indexOf("=");
              if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex);
                const value = trimmed.substring(eqIndex + 1);
                if (key === "devTenantId") {
                  devTenantId = parseInt(decodeURIComponent(value));
                  break;
                }
              }
            }
          } catch (e) {}

          if (devTenantId && userTenantList.some((t) => t.id === devTenantId)) {
            sessionTenantId = devTenantId;
          } else {
            sessionTenantId = userTenantList[0].id;
          }
        }
      }

      // Set session and save it
      req.session.userId = user.id;
      req.session.tenantId = sessionTenantId; // Store tenant in session

      // Set dev tenant cookie for persistence across logout (development only)
      if (process.env.NODE_ENV === "development" && sessionTenantId) {
        res.cookie("devTenantId", sessionTenantId.toString(), {
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          httpOnly: false,
          sameSite: "lax",
        });
      }

      // Save session before responding
      req.session.save(async (err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }

        // Don't send password hash to client
        const { passwordHash: _, ...userWithoutPassword } = user;

        const permissions = await storage.getUserPermissions(user.id);
        const permissionsMap: Record<string, { canView: boolean; canEdit: boolean; canDelegate: boolean }> = {};
        for (const perm of permissions) {
          permissionsMap[perm.module] = {
            canView: perm.canView,
            canEdit: perm.canEdit,
            canDelegate: perm.canDelegate,
          };
        }

        return res.json({
          message: "Login realizado com sucesso",
          user: userWithoutPassword,
          permissions: permissionsMap,
          tenant: req.tenant
            ? {
                id: req.tenant.id,
                key: req.tenant.key,
                name: req.tenant.name,
              }
            : null,
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
      res.clearCookie("devTenantId");
      return res.json({ message: "Logout realizado com sucesso" });
    });
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const { passwordHash: _, ...userWithoutPassword } = req.user!;

    // Buscar permissões do usuário
    const permissions = await storage.getUserPermissions(req.user!.id);

    // Converter para um mapa de módulo -> permissões
    const permissionsMap: Record<
      string,
      { canView: boolean; canEdit: boolean; canDelegate: boolean }
    > = {};
    for (const perm of permissions) {
      permissionsMap[perm.module] = {
        canView: perm.canView,
        canEdit: perm.canEdit,
        canDelegate: perm.canDelegate,
      };
    }

    return res.json({
      user: userWithoutPassword,
      permissions: permissionsMap,
    });
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
          isActive: true,
        });
      }
      return res.json(bank);
    } catch (error) {
      console.error("Get bank by name error:", error);
      return res.status(500).json({ message: "Erro ao buscar banco" });
    }
  });

  // Get all banks (master only)
  app.get(
    "/api/banks/all",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const bankList = await storage.getAllBanks();
        return res.json(bankList);
      } catch (error) {
        console.error("Get all banks error:", error);
        return res.status(500).json({ message: "Erro ao buscar bancos" });
      }
    },
  );

  // Create bank (master only)
  app.post(
    "/api/banks",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
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
          return res
            .status(400)
            .json({ message: "Já existe um banco com esse nome" });
        }

        const bank = await storage.createBank(result.data);
        return res.status(201).json(bank);
      } catch (error) {
        console.error("Create bank error:", error);
        return res.status(500).json({ message: "Erro ao criar banco" });
      }
    },
  );

  // Update bank (master only)
  app.put(
    "/api/banks/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
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
    },
  );

  // Delete bank (master only)
  app.delete(
    "/api/banks/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteBank(id);
        return res.json({ message: "Banco deletado com sucesso" });
      } catch (error) {
        console.error("Delete bank error:", error);
        return res.status(500).json({ message: "Erro ao deletar banco" });
      }
    },
  );

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
  app.get(
    "/api/agreements/all",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const agreements = await storage.getAllAgreements();
        return res.json(agreements);
      } catch (error) {
        console.error("Get all agreements error:", error);
        return res.status(500).json({ message: "Erro ao buscar convênios" });
      }
    },
  );

  // Create agreement (operacional access)
  app.post(
    "/api/agreements",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
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
    },
  );

  // Update agreement (operacional access)
  app.put(
    "/api/agreements/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
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
    },
  );

  // Delete agreement (operacional access)
  app.delete(
    "/api/agreements/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteAgreement(id);
        return res.json({ message: "Convênio deletado com sucesso" });
      } catch (error) {
        console.error("Delete agreement error:", error);
        return res.status(500).json({ message: "Erro ao deletar convênio" });
      }
    },
  );

  // ===== NOMENCLATURAS ROUTES =====

  // Cache em memória para nomenclaturas ativas (TTL 60s)
  interface NomenclaturaCacheEntry {
    data: any[];
    timestamp: number;
  }
  const nomenclaturasCache: Map<string, NomenclaturaCacheEntry> = new Map();
  const NOMENCLATURAS_CACHE_TTL = 60 * 1000; // 60 segundos

  function invalidateNomenclaturasCache() {
    nomenclaturasCache.clear();
  }

  async function getCachedNomenclaturas(categoria?: string): Promise<any[]> {
    const cacheKey = categoria || "__all__";
    const cached = nomenclaturasCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < NOMENCLATURAS_CACHE_TTL) {
      return cached.data;
    }

    // Buscar do banco apenas ativos
    let result;
    if (categoria && NOMENCLATURA_CATEGORIA.includes(categoria as any)) {
      result = await db
        .select()
        .from(nomenclaturas)
        .where(
          and(
            eq(nomenclaturas.ativo, true),
            eq(nomenclaturas.categoria, categoria),
          ),
        )
        .orderBy(asc(nomenclaturas.nome));
    } else {
      result = await db
        .select()
        .from(nomenclaturas)
        .where(eq(nomenclaturas.ativo, true))
        .orderBy(asc(nomenclaturas.categoria), asc(nomenclaturas.nome));
    }
    nomenclaturasCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  // Middleware para configurações do sistema - REFACTORED to use profile-based permissions
  // Now checks for modulo_config_sistema permission (nomenclaturas, etc.)
  // Also allows 'operacional' role users since nomenclaturas are part of operational config
  async function requireMasterOrAdmin(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    // isMaster has full access
    if (req.user.isMaster) {
      logPermissionCheck(
        req.user.id,
        req.user.name,
        "modulo_config_sistema",
        "edit",
        true,
        "isMaster=true",
      );
      return next();
    }

    // Role 'operacional' has access to nomenclaturas (operational config)
    if (req.user.role === "operacional") {
      logPermissionCheck(
        req.user.id,
        req.user.name,
        "modulo_config_sistema",
        "edit",
        true,
        "role=operacional",
      );
      return next();
    }

    // Check profile-based permission for system config
    const hasAccess = await storage.hasModuleEditAccess(
      req.user.id,
      "modulo_config_sistema",
    );
    if (hasAccess) {
      logPermissionCheck(
        req.user.id,
        req.user.name,
        "modulo_config_sistema",
        "edit",
        true,
        "Profile permission granted",
      );
      return next();
    }

    // Also allow users with modulo_roteiros edit permission
    const hasRoteirosEdit = await storage.hasModuleEditAccess(
      req.user.id,
      "modulo_roteiros",
    );
    if (hasRoteirosEdit) {
      logPermissionCheck(
        req.user.id,
        req.user.name,
        "modulo_roteiros",
        "edit",
        true,
        "modulo_roteiros edit granted",
      );
      return next();
    }

    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_config_sistema",
      "edit",
      false,
      "No profile permission",
    );
    return res.status(403).json({
      message:
        "Acesso negado - você não tem permissão para configurações do sistema",
    });
  }

  // GET list - com filtros por categoria e busca (admin - sem cache, mostra todos)
  app.get(
    "/api/nomenclaturas",
    requireAuth,
    requireMasterOrAdmin,
    async (req, res) => {
      try {
        const { categoria, busca, apenasAtivos } = req.query;

        let query = db.select().from(nomenclaturas);
        const conditions: any[] = [];

        // Filtro por categoria
        if (
          categoria &&
          typeof categoria === "string" &&
          NOMENCLATURA_CATEGORIA.includes(categoria as any)
        ) {
          conditions.push(eq(nomenclaturas.categoria, categoria));
        }

        // Filtro apenas ativos
        if (apenasAtivos === "true") {
          conditions.push(eq(nomenclaturas.ativo, true));
        }

        // Busca por código ou nome
        if (busca && typeof busca === "string" && busca.trim().length > 0) {
          const buscaLike = `%${busca.trim().toLowerCase()}%`;
          conditions.push(
            or(
              sql`LOWER(${nomenclaturas.codigo}) LIKE ${buscaLike}`,
              sql`LOWER(${nomenclaturas.nome}) LIKE ${buscaLike}`,
            ),
          );
        }

        const result =
          conditions.length > 0
            ? await db
                .select()
                .from(nomenclaturas)
                .where(and(...conditions))
                .orderBy(asc(nomenclaturas.categoria), asc(nomenclaturas.nome))
            : await db
                .select()
                .from(nomenclaturas)
                .orderBy(asc(nomenclaturas.categoria), asc(nomenclaturas.nome));

        return res.json(result);
      } catch (error) {
        console.error("Get nomenclaturas error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar nomenclaturas" });
      }
    },
  );

  // GET by ID
  app.get(
    "/api/nomenclaturas/:id",
    requireAuth,
    requireMasterOrAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const [result] = await db
          .select()
          .from(nomenclaturas)
          .where(eq(nomenclaturas.id, id))
          .limit(1);

        if (!result) {
          return res
            .status(404)
            .json({ message: "Nomenclatura não encontrada" });
        }

        return res.json(result);
      } catch (error) {
        console.error("Get nomenclatura error:", error);
        return res.status(500).json({ message: "Erro ao buscar nomenclatura" });
      }
    },
  );

  // POST create
  app.post(
    "/api/nomenclaturas",
    requireAuth,
    requireMasterOrAdmin,
    async (req, res) => {
      try {
        const result = insertNomenclaturaSchema.safeParse(req.body);

        if (!result.success) {
          return res.status(400).json({
            message: "Dados inválidos",
            errors: result.error.errors,
          });
        }

        // Check if codigo already exists for this categoria
        const [existing] = await db
          .select()
          .from(nomenclaturas)
          .where(
            and(
              eq(nomenclaturas.categoria, result.data.categoria),
              eq(nomenclaturas.codigo, result.data.codigo),
            ),
          )
          .limit(1);

        if (existing) {
          return res.status(400).json({
            message:
              "Já existe uma nomenclatura com esse código nesta categoria",
          });
        }

        const [created] = await db
          .insert(nomenclaturas)
          .values(result.data)
          .returning();
        invalidateNomenclaturasCache();
        return res.status(201).json(created);
      } catch (error) {
        console.error("Create nomenclatura error:", error);
        return res.status(500).json({ message: "Erro ao criar nomenclatura" });
      }
    },
  );

  // PUT update
  app.put(
    "/api/nomenclaturas/:id",
    requireAuth,
    requireMasterOrAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const result = insertNomenclaturaSchema.partial().safeParse(req.body);

        if (!result.success) {
          return res.status(400).json({
            message: "Dados inválidos",
            errors: result.error.errors,
          });
        }

        // Check if updating codigo would create duplicate
        if (result.data.codigo || result.data.categoria) {
          const [current] = await db
            .select()
            .from(nomenclaturas)
            .where(eq(nomenclaturas.id, id))
            .limit(1);
          if (!current) {
            return res
              .status(404)
              .json({ message: "Nomenclatura não encontrada" });
          }

          const newCategoria = result.data.categoria || current.categoria;
          const newCodigo = result.data.codigo || current.codigo;

          const [existing] = await db
            .select()
            .from(nomenclaturas)
            .where(
              and(
                eq(nomenclaturas.categoria, newCategoria),
                eq(nomenclaturas.codigo, newCodigo),
                sql`${nomenclaturas.id} != ${id}`,
              ),
            )
            .limit(1);

          if (existing) {
            return res.status(400).json({
              message:
                "Já existe uma nomenclatura com esse código nesta categoria",
            });
          }
        }

        const [updated] = await db
          .update(nomenclaturas)
          .set(result.data)
          .where(eq(nomenclaturas.id, id))
          .returning();

        if (!updated) {
          return res
            .status(404)
            .json({ message: "Nomenclatura não encontrada" });
        }

        invalidateNomenclaturasCache();
        return res.json(updated);
      } catch (error) {
        console.error("Update nomenclatura error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao atualizar nomenclatura" });
      }
    },
  );

  // DELETE (soft delete - set ativo=false)
  app.delete(
    "/api/nomenclaturas/:id",
    requireAuth,
    requireMasterOrAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        const [updated] = await db
          .update(nomenclaturas)
          .set({ ativo: false })
          .where(eq(nomenclaturas.id, id))
          .returning();

        if (!updated) {
          return res
            .status(404)
            .json({ message: "Nomenclatura não encontrada" });
        }

        invalidateNomenclaturasCache();
        return res.json({ message: "Nomenclatura desativada com sucesso" });
      } catch (error) {
        console.error("Delete nomenclatura error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao desativar nomenclatura" });
      }
    },
  );

  // DELETE em lote (soft delete - set ativo=false)
  app.post(
    "/api/nomenclaturas/delete-batch",
    requireAuth,
    requireMasterOrAdmin,
    async (req, res) => {
      try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res
            .status(400)
            .json({ message: "Lista de IDs é obrigatória" });
        }

        const numericIds = ids
          .map((id: any) => parseInt(id))
          .filter((id: number) => !isNaN(id));

        if (numericIds.length === 0) {
          return res
            .status(400)
            .json({ message: "Nenhum ID válido fornecido" });
        }

        const updated = await db
          .update(nomenclaturas)
          .set({ ativo: false })
          .where(inArray(nomenclaturas.id, numericIds))
          .returning();

        invalidateNomenclaturasCache();
        return res.json({
          message: `${updated.length} nomenclatura(s) desativada(s) com sucesso`,
          count: updated.length,
        });
      } catch (error) {
        console.error("Delete batch nomenclaturas error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao desativar nomenclaturas" });
      }
    },
  );

  // POST import from Excel
  app.post(
    "/api/nomenclaturas/import-excel",
    requireAuth,
    requireMasterOrAdmin,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "Nenhum arquivo enviado" });
        }

        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        if (rows.length === 0) {
          return res.status(400).json({ message: "Planilha vazia" });
        }

        const results = {
          total: rows.length,
          inserted: 0,
          updated: 0,
          errors: [] as { linha: number; erro: string }[],
        };

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const linha = i + 2; // Excel starts at 1, header is 1, first data is 2

          // Normalize column names (case-insensitive)
          const categoria = String(
            row.Categoria || row.categoria || row.CATEGORIA || "",
          )
            .trim()
            .toUpperCase();
          const codigo = String(
            row.Código || row.Codigo || row.codigo || row.CODIGO || "",
          ).trim();
          const nome = String(row.Nome || row.nome || row.NOME || "").trim();
          const ativoRaw = row.Ativo ?? row.ativo ?? row.ATIVO ?? "TRUE";
          const ativo =
            String(ativoRaw).toUpperCase() === "TRUE" ||
            String(ativoRaw) === "1" ||
            ativoRaw === true;

          // Validate required fields
          if (!categoria) {
            results.errors.push({ linha, erro: "Categoria é obrigatória" });
            continue;
          }
          if (!NOMENCLATURA_CATEGORIA.includes(categoria as any)) {
            results.errors.push({
              linha,
              erro: `Categoria inválida: ${categoria}. Use: ${NOMENCLATURA_CATEGORIA.join(", ")}`,
            });
            continue;
          }
          if (!codigo) {
            results.errors.push({ linha, erro: "Código é obrigatório" });
            continue;
          }
          if (!nome) {
            results.errors.push({ linha, erro: "Nome é obrigatório" });
            continue;
          }

          try {
            // Check if exists
            const [existing] = await db
              .select()
              .from(nomenclaturas)
              .where(
                and(
                  eq(nomenclaturas.categoria, categoria),
                  eq(nomenclaturas.codigo, codigo),
                ),
              )
              .limit(1);

            if (existing) {
              // Update
              await db
                .update(nomenclaturas)
                .set({ nome, ativo })
                .where(eq(nomenclaturas.id, existing.id));
              results.updated++;
            } else {
              // Insert
              await db.insert(nomenclaturas).values({
                categoria: categoria as any,
                codigo,
                nome,
                ativo,
              });
              results.inserted++;
            }
          } catch (dbError: any) {
            results.errors.push({
              linha,
              erro: dbError.message || "Erro no banco de dados",
            });
          }
        }

        invalidateNomenclaturasCache();

        return res.json({
          message: `Importação concluída: ${results.inserted} inseridos, ${results.updated} atualizados, ${results.errors.length} erros`,
          ...results,
        });
      } catch (error: any) {
        console.error("Import nomenclaturas error:", error);
        return res.status(500).json({
          message:
            "Erro ao processar arquivo: " +
            (error.message || "Erro desconhecido"),
        });
      }
    },
  );

  // GET categorias disponíveis
  app.get("/api/nomenclaturas-categorias", requireAuth, async (req, res) => {
    return res.json(NOMENCLATURA_CATEGORIA);
  });

  // GET nomenclaturas ativas COM CACHE (endpoint para frontend De-Para)
  app.get("/api/nomenclaturas-cached", requireAuth, async (req, res) => {
    try {
      const { categoria } = req.query;
      const result = await getCachedNomenclaturas(
        categoria as string | undefined,
      );
      return res.json(result);
    } catch (error) {
      console.error("Get cached nomenclaturas error:", error);
      return res.status(500).json({ message: "Erro ao buscar nomenclaturas" });
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
          parseInt(term as string),
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
  app.get(
    "/api/coefficient-tables/all",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const tables = await storage.getAllCoefficientTables();
        return res.json(tables);
      } catch (error) {
        console.error("Get all coefficient tables error:", error);
        return res.status(500).json({ message: "Erro ao buscar tabelas" });
      }
    },
  );

  // Create coefficient table (operacional access)
  app.post(
    "/api/coefficient-tables",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
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
    },
  );

  // Update coefficient table (operacional access)
  app.put(
    "/api/coefficient-tables/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const result = insertCoefficientTableSchema
          .partial()
          .safeParse(req.body);

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
    },
  );

  // Delete coefficient table (operacional access)
  app.delete(
    "/api/coefficient-tables/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteCoefficientTable(id);
        return res.json({ message: "Tabela deletada com sucesso" });
      } catch (error) {
        console.error("Delete coefficient table error:", error);
        return res.status(500).json({ message: "Erro ao deletar tabela" });
      }
    },
  );

  // Bulk delete coefficient tables (operacional access)
  app.post(
    "/api/coefficient-tables/bulk-delete",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ message: "IDs inválidos" });
        }

        const deletePromises = ids.map((id: number) =>
          storage.deleteCoefficientTable(id),
        );
        await Promise.all(deletePromises);

        return res.json({
          message: "Tabelas deletadas com sucesso",
          count: ids.length,
        });
      } catch (error) {
        console.error("Bulk delete coefficient tables error:", error);
        return res.status(500).json({ message: "Erro ao deletar tabelas" });
      }
    },
  );

  // Bulk deactivate coefficient tables (operacional access)
  app.post(
    "/api/coefficient-tables/bulk-deactivate",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ message: "IDs inválidos" });
        }

        const updatePromises = ids.map((id: number) =>
          storage.updateCoefficientTable(id, { isActive: false }),
        );
        await Promise.all(updatePromises);

        return res.json({
          message: "Tabelas desativadas com sucesso",
          count: ids.length,
        });
      } catch (error) {
        console.error("Bulk deactivate coefficient tables error:", error);
        return res.status(500).json({ message: "Erro ao desativar tabelas" });
      }
    },
  );

  // Bulk reactivate coefficient tables (operacional access)
  app.post(
    "/api/coefficient-tables/bulk-reactivate",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ message: "IDs inválidos" });
        }

        const updatePromises = ids.map((id: number) =>
          storage.updateCoefficientTable(id, { isActive: true }),
        );
        await Promise.all(updatePromises);

        return res.json({
          message: "Tabelas reativadas com sucesso",
          count: ids.length,
        });
      } catch (error) {
        console.error("Bulk reactivate coefficient tables error:", error);
        return res.status(500).json({ message: "Erro ao reativar tabelas" });
      }
    },
  );

  // ===== USERS ROUTES =====

  // Get users with role-based visibility:
  // - master: sees all users
  // - atendimento: sees all users
  // - coordenador: sees only themselves + vendedores whose managerId equals their id
  // - users with modulo_config_usuarios permission: sees all non-master users
  app.get(
    "/api/users",
    requireAuth,
    requireUserManagementAccess,
    async (req, res) => {
      try {
        let users: User[];
        const currentUserRole = req.user!.role as UserRole;
        const { sem_vinculo } = req.query;

        if (currentUserRole === "master" || currentUserRole === "atendimento") {
          // Master and atendimento see all users
          users = await storage.getAllUsers();
        } else if (currentUserRole === "coordenacao") {
          // Coordenacao sees only themselves + their vendedores
          const teamUsers = await storage.getUsersByManager(req.user!.id);
          users = [req.user!, ...teamUsers];
        } else {
          // Users with modulo_config_usuarios permission can see all non-master users
          const hasConfigEditAccess = await storage.hasModuleEditAccess(
            req.user!.id,
            "modulo_config_usuarios",
          );
          if (hasConfigEditAccess) {
            const allUsers = await storage.getAllUsers();
            // Filter out master users - non-master managers cannot see/manage masters
            users = allUsers.filter((u) => u.role !== "master");
          } else {
            return res.status(403).json({ message: "Acesso negado" });
          }
        }

        // Filter users without employee link if requested
        if (sem_vinculo === "true") {
          users = users.filter((u) => !u.employeeId || u.employeeId === 0);
        }

        // Remove password hashes
        const usersWithoutPasswords = users.map(
          ({ passwordHash: _, ...user }) => user,
        );
        return res.json(usersWithoutPasswords);
      } catch (error) {
        console.error("Get users error:", error);
        return res.status(500).json({ message: "Erro ao buscar usuários" });
      }
    },
  );

  // Get all coordenadores (for selecting manager when creating vendedor)
  // REFACTORED: Now uses profile-based permission modulo_config_usuarios
  app.get("/api/users/coordenadores", requireAuth, async (req, res) => {
    try {
      // Check permission: isMaster or modulo_config_usuarios access
      const hasAccess =
        req.user!.isMaster ||
        (await storage.hasModuleAccess(req.user!.id, "modulo_config_usuarios"));
      if (!hasAccess) {
        logPermissionCheck(
          req.user!.id,
          req.user!.name,
          "modulo_config_usuarios",
          "view",
          false,
          "No permission for coordenadores list",
        );
        return res.status(403).json({ message: "Acesso negado" });
      }

      const allUsers = await storage.getAllUsers();
      const coordenadores = allUsers.filter(
        (u) => u.role === "coordenacao" && u.isActive,
      );
      const withoutPasswords = coordenadores.map(
        ({ passwordHash: _, ...user }) => user,
      );
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
  app.put(
    "/api/users/:id",
    requireAuth,
    requireUserManagementAccess,
    async (req, res) => {
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
          const canEdit =
            targetUser.id === req.user!.id ||
            (targetUserRole === "vendedor" &&
              targetUser.managerId === req.user!.id);
          if (!canEdit) {
            return res.status(403).json({
              message:
                "Você só pode editar seu próprio perfil ou vendedores da sua equipe",
            });
          }

          // Coordenacao cannot change role or managerId
          if (
            validatedData.role !== undefined ||
            validatedData.managerId !== undefined
          ) {
            return res.status(403).json({
              message:
                "Você não pode alterar a função ou coordenador de usuários",
            });
          }
        } else if (currentUserRole === "atendimento") {
          // Atendimento cannot edit master (admins)
          if (targetUserRole === "master") {
            return res.status(403).json({
              message: "Você não tem permissão para editar administradores",
            });
          }
          // Atendimento cannot change role to master
          if (validatedData.role === "master") {
            return res.status(403).json({
              message: "Você não pode promover usuários a administrador",
            });
          }
        }
        // master has no restrictions

        // Build update object from validated data
        let dataToUpdate: any = {};
        if (validatedData.name !== undefined)
          dataToUpdate.name = validatedData.name;
        if (validatedData.email !== undefined)
          dataToUpdate.email = validatedData.email;
        if (validatedData.isActive !== undefined)
          dataToUpdate.isActive = validatedData.isActive;

        // Only master and atendimento can change role and managerId
        if (currentUserRole === "master" || currentUserRole === "atendimento") {
          if (validatedData.role !== undefined)
            dataToUpdate.role = validatedData.role;
          if (validatedData.managerId !== undefined)
            dataToUpdate.managerId = validatedData.managerId;
        }

        // Only master can toggle demo mode
        if (currentUserRole === "master" && validatedData.isDemo !== undefined) {
          dataToUpdate.isDemo = validatedData.isDemo;
        }

        // Hash password if provided
        if (validatedData.password) {
          const passwordHash = await bcrypt.hash(validatedData.password, 10);
          dataToUpdate.passwordHash = passwordHash;
        }

        // Reject empty updates
        if (Object.keys(dataToUpdate).length === 0) {
          return res
            .status(400)
            .json({ message: "Nenhuma alteração fornecida" });
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
    },
  );

  // Bulk delete users (must be before :id route)
  app.delete(
    "/api/users/bulk",
    requireAuth,
    requireUserManagementAccess,
    async (req, res) => {
      try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
          return res
            .status(400)
            .json({ message: "Lista de IDs é obrigatória" });
        }

        const currentUserId = req.user!.id;
        const currentUserRole = req.user!.role as UserRole;
        const validIds = ids.filter(
          (id: number) =>
            Number.isInteger(id) && id > 0 && id !== currentUserId,
        );

        if (validIds.length === 0) {
          return res
            .status(400)
            .json({ message: "Nenhum usuário válido para excluir" });
        }

        const errors: string[] = [];
        let deleted = 0;

        for (const id of validIds) {
          const targetUser = await storage.getUser(id);
          if (!targetUser) continue;

          const targetUserRole = targetUser.role as UserRole;

          if (currentUserRole === "coordenacao") {
            if (
              targetUserRole !== "vendedor" ||
              targetUser.managerId !== currentUserId
            ) {
              errors.push(`${targetUser.name}: sem permissão`);
              continue;
            }
          } else if (currentUserRole === "atendimento") {
            if (targetUserRole === "master") {
              errors.push(
                `${targetUser.name}: não pode excluir administradores`,
              );
              continue;
            }
          }

          try {
            await storage.deleteUser(id);
            deleted++;
          } catch (err: any) {
            console.error(
              `Error deleting user ${id} (${targetUser.name}):`,
              err?.message || err,
            );
            errors.push(
              `${targetUser.name}: erro ao excluir - ${err?.message || "erro desconhecido"}`,
            );
          }
        }

        return res.json({
          message: `${deleted} usuário(s) excluído(s) com sucesso`,
          deleted,
          errors,
        });
      } catch (error) {
        console.error("Bulk delete users error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao excluir usuários em lote" });
      }
    },
  );

  // Delete user with role-based permissions:
  // - admin: can delete any user (except themselves)
  // - atendimento: can delete any user EXCEPT admins
  // - coordenador: can only delete vendedores from their team
  app.delete(
    "/api/users/:id",
    requireAuth,
    requireUserManagementAccess,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const currentUserRole = req.user!.role as UserRole;

        // Validate ID is a valid number
        if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ message: "ID de usuário inválido" });
        }

        // Cannot delete yourself
        if (id === req.user!.id) {
          return res
            .status(403)
            .json({ message: "Você não pode excluir sua própria conta" });
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
          if (
            targetUserRole !== "vendedor" ||
            targetUser.managerId !== req.user!.id
          ) {
            return res.status(403).json({
              message: "Você só pode excluir vendedores da sua equipe",
            });
          }
        } else if (currentUserRole === "atendimento") {
          // Atendimento cannot delete master (admins)
          if (targetUserRole === "master") {
            return res.status(403).json({
              message: "Você não tem permissão para excluir administradores",
            });
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
    },
  );

  // ===== USER PERMISSIONS ROUTES =====

  // Helper to validate permission keys (accepts both module-level and sub-item keys)
  function isValidPermissionKey(key: string): boolean {
    const { module, subItem } = parsePermissionKey(key);

    // Check if module is valid
    if (!MODULE_LIST.includes(module as any)) {
      return false;
    }

    // If it's a sub-item key, validate the sub-item
    if (subItem) {
      const moduleSubItems =
        MODULE_SUB_ITEMS[module as keyof typeof MODULE_SUB_ITEMS];
      if (!moduleSubItems) return false;
      return moduleSubItems.some(
        (item: { key: string }) => item.key === subItem,
      );
    }

    return true;
  }

  // Get list of available modules (legacy - returns just module names)
  app.get("/api/permissions/modules", requireAuth, async (req, res) => {
    try {
      return res.json(MODULE_LIST);
    } catch (error) {
      console.error("Get modules error:", error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar lista de módulos" });
    }
  });

  // Get full permission structure with sub-items
  app.get("/api/permissions/structure", requireAuth, async (req, res) => {
    try {
      const structure = MODULE_LIST.map((module) => ({
        key: module,
        label: MODULE_LABELS[module],
        subItems: MODULE_SUB_ITEMS[module].map(
          (item: { key: string; label: string }) => ({
            key: getSubItemPermissionKey(module, item.key),
            label: item.label,
          }),
        ),
      }));
      return res.json(structure);
    } catch (error) {
      console.error("Get permission structure error:", error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar estrutura de permissões" });
    }
  });

  // Get current user's permissions (for delegation purposes)
  app.get("/api/permissions/my", requireAuth, async (req, res) => {
    try {
      const permissions = await storage.getUserPermissions(req.user!.id);
      return res.json(permissions);
    } catch (error) {
      console.error("Get my permissions error:", error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar suas permissões" });
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
      return res
        .status(500)
        .json({ message: "Erro ao buscar permissões do usuário" });
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

      // Validate request body - accepts both module-level and sub-item keys
      const permissionsSchema = z.array(
        z.object({
          module: z.string().refine((m) => isValidPermissionKey(m), {
            message: "Módulo ou sub-item inválido",
          }),
          canView: z.boolean(),
          canEdit: z.boolean(),
          canDelegate: z.boolean().optional().default(false),
        }),
      );

      const result = permissionsSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors,
        });
      }

      // For non-master users, check if they have Config. Usuários with canEdit
      if (!isMaster) {
        const currentUserPermissions = await storage.getUserPermissions(
          req.user!.id,
        );
        const configUsuariosPermission = currentUserPermissions.find(
          (p) => p.module === "modulo_config_usuarios",
        );

        if (!configUsuariosPermission?.canEdit) {
          return res.status(403).json({
            message:
              "Acesso negado - você não tem permissão para editar usuários",
          });
        }

        // Get modules that the current user can delegate
        const delegatableModules = currentUserPermissions
          .filter((p) => p.canDelegate)
          .map((p) => p.module);

        // Filter permissions to only include delegatable modules (non-master users can't set canDelegate)
        const filteredPermissions = result.data
          .filter((p) => delegatableModules.includes(p.module))
          .map((p) => ({ ...p, canDelegate: false })); // Non-master users can never grant canDelegate

        // Merge with existing permissions for non-delegatable modules
        const existingPermissions = await storage.getUserPermissions(id);
        const nonDelegatableExisting = existingPermissions.filter(
          (p) => !delegatableModules.includes(p.module),
        );

        const finalPermissions = [
          ...nonDelegatableExisting,
          ...filteredPermissions,
        ];
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
      return res
        .status(500)
        .json({ message: "Erro ao definir permissões do usuário" });
    }
  });

  // Update user access configuration (hours, days, IP)
  app.patch(
    "/api/users/:id/acesso",
    requireAuth,
    requireUserManagementAccess,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.tenantId;

        if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ message: "ID de usuário inválido" });
        }

        // Check if user exists
        const targetUser = await storage.getUser(id);
        if (!targetUser) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Tenant isolation: verify user belongs to current tenant
        const isMaster = req.user?.isMaster === true;
        if (!isMaster) {
          if (!tenantId) {
            return res
              .status(403)
              .json({ message: "Acesso negado - ambiente não identificado" });
          }
          const userTenantCheck = await db.execute(sql`
          SELECT 1 FROM user_tenants 
          WHERE user_id = ${id} AND tenant_id = ${tenantId}
        `);
          if (userTenantCheck.rows.length === 0) {
            return res
              .status(403)
              .json({ message: "Usuário não pertence ao ambiente atual" });
          }
        }

        // Validate request body
        const accessSchema = z.object({
          horario_acesso_inicio: z.string().nullable().optional(),
          horario_acesso_fim: z.string().nullable().optional(),
          dias_acesso_permitidos: z.string().nullable().optional(),
          restringir_por_ip: z.boolean().optional(),
          ips_permitidos: z.string().nullable().optional(),
        });

        const result = accessSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            message: "Dados inválidos",
            errors: result.error.errors,
          });
        }

        const {
          horario_acesso_inicio,
          horario_acesso_fim,
          dias_acesso_permitidos,
          restringir_por_ip,
          ips_permitidos,
        } = result.data;

        // Update user access fields
        await db.execute(sql`
        UPDATE users 
        SET 
          horario_acesso_inicio = ${horario_acesso_inicio || null},
          horario_acesso_fim = ${horario_acesso_fim || null},
          dias_acesso_permitidos = ${dias_acesso_permitidos || null},
          restringir_por_ip = ${restringir_por_ip === true},
          ips_permitidos = ${ips_permitidos || null}
        WHERE id = ${id}
      `);

        return res.json({
          success: true,
          message: "Configurações de acesso atualizadas",
        });
      } catch (error) {
        console.error("Update user access error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao atualizar configurações de acesso" });
      }
    },
  );

  // Link/unlink employee to user
  app.patch(
    "/api/users/:id/employee",
    requireAuth,
    requireUserManagementAccess,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const tenantId = req.tenantId;
        const { employee_id } = req.body;

        if (isNaN(userId) || userId <= 0) {
          return res.status(400).json({ message: "ID de usuário inválido" });
        }

        // Verify user exists
        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Tenant isolation for non-master users
        const isMaster = req.user?.isMaster === true;
        if (!isMaster) {
          if (!tenantId) {
            return res
              .status(403)
              .json({ message: "Acesso negado - ambiente não identificado" });
          }
          const userTenantCheck = await db.execute(sql`
          SELECT 1 FROM user_tenants 
          WHERE user_id = ${userId} AND tenant_id = ${tenantId}
        `);
          if (userTenantCheck.rows.length === 0) {
            return res
              .status(403)
              .json({ message: "Usuário não pertence ao ambiente atual" });
          }
        }

        // Validate employee_id if provided
        const employeeIdValue = employee_id ? parseInt(employee_id) : null;
        if (employee_id && (isNaN(employeeIdValue!) || employeeIdValue! <= 0)) {
          return res
            .status(400)
            .json({ message: "ID de funcionário inválido" });
        }

        // Require tenantId for this operation (even for masters)
        if (!tenantId) {
          return res.status(400).json({
            message: "Selecione um ambiente para realizar esta operação",
          });
        }

        // Verify employee belongs to same tenant
        if (employeeIdValue) {
          const employeeCheck = await db.execute(sql`
          SELECT id, user_id, tenant_id FROM employees WHERE id = ${employeeIdValue}
        `);
          if (employeeCheck.rows.length === 0) {
            return res
              .status(404)
              .json({ message: "Funcionário não encontrado" });
          }
          const employee = employeeCheck.rows[0] as any;
          if (employee.tenant_id !== tenantId) {
            return res
              .status(403)
              .json({ message: "Funcionário não pertence ao ambiente atual" });
          }
          // Check if employee is already linked to another user
          if (employee.user_id && employee.user_id !== userId) {
            return res.status(400).json({
              message: "Este funcionário já está vinculado a outro usuário",
            });
          }
        }

        // Check uniqueness: user can only be linked to one employee (via users.employee_id)
        if (employeeIdValue) {
          const existingLink = await db.execute(sql`
          SELECT id FROM users WHERE employee_id = ${employeeIdValue} AND id != ${userId}
        `);
          if (existingLink.rows.length > 0) {
            return res.status(400).json({
              message: "Este funcionário já está vinculado a outro usuário",
            });
          }
        }

        // Get current employee_id to update the old link
        const oldEmployeeId = (targetUser as any).employeeId;

        // Update user's employee link
        await db.execute(sql`
        UPDATE users 
        SET employee_id = ${employeeIdValue}
        WHERE id = ${userId}
      `);

        // Make linking bidirectional: update employees.user_id
        if (oldEmployeeId && oldEmployeeId !== employeeIdValue) {
          await db.execute(sql`
          UPDATE employees SET user_id = NULL WHERE id = ${oldEmployeeId}
        `);
        }
        if (employeeIdValue) {
          await db.execute(sql`
          UPDATE employees SET user_id = ${userId} WHERE id = ${employeeIdValue}
        `);
        }

        console.log(
          `✅ User ${userId} vinculado ao employee ${employeeIdValue}`,
        );

        return res.json({
          success: true,
          message: employeeIdValue
            ? "Vínculo criado com sucesso"
            : "Vínculo removido com sucesso",
        });
      } catch (error) {
        console.error("Link employee to user error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao vincular funcionário" });
      }
    },
  );

  // ===== AVATAR UPLOAD =====

  app.post(
    "/api/users/:id/avatar",
    requireAuth,
    requireUserManagementAccess,
    uploadAvatar.single("file"),
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId))
          return res.status(400).json({ message: "ID inválido" });

        const tenantId = req.tenantId;
        if (!tenantId)
          return res.status(400).json({ message: "Tenant não identificado" });

        const targetUser = await storage.getUser(userId);
        if (!targetUser)
          return res.status(404).json({ message: "Usuário não encontrado" });

        const isMaster = req.user?.isMaster === true;
        if (!isMaster) {
          const utCheck = await db.execute(
            sql`SELECT 1 FROM user_tenants WHERE user_id = ${userId} AND tenant_id = ${tenantId}`,
          );
          if (utCheck.rows.length === 0)
            return res
              .status(403)
              .json({ message: "Usuário não pertence ao ambiente atual" });
        }

        const file = req.file;
        if (!file)
          return res.status(400).json({
            message: "Arquivo não enviado. Use JPG, PNG ou WebP (máximo 2MB).",
          });

        const mimeType = file.mimetype || "image/png";
        const base64Data = file.buffer.toString("base64");
        const avatarUrl = `data:${mimeType};base64,${base64Data}`;

        await db.execute(
          sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${userId}`,
        );

        res.json({ avatarUrl });
      } catch (error: any) {
        console.error("[AVATAR] Upload error:", error);
        res.status(500).json({ message: "Erro ao enviar foto" });
      }
    },
  );

  app.delete(
    "/api/users/:id/avatar",
    requireAuth,
    requireUserManagementAccess,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId))
          return res.status(400).json({ message: "ID inválido" });

        const tenantId = req.tenantId;
        if (!tenantId)
          return res.status(400).json({ message: "Tenant não identificado" });

        await db.execute(
          sql`UPDATE users SET avatar_url = NULL WHERE id = ${userId}`,
        );
        res.json({ message: "Foto removida" });
      } catch (error: any) {
        console.error("[AVATAR] Delete error:", error);
        res.status(500).json({ message: "Erro ao remover foto" });
      }
    },
  );

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
  app.get(
    "/api/simulations/all",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const simulations = await storage.getAllSimulations();
        return res.json(simulations);
      } catch (error) {
        console.error("Get all simulations error:", error);
        return res.status(500).json({ message: "Erro ao buscar simulações" });
      }
    },
  );

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
      return res
        .status(500)
        .json({ message: "Erro ao buscar convênios ativos" });
    }
  });

  // Create agreement (operacional access)
  app.post(
    "/api/agreements",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
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
    },
  );

  // Update agreement (operacional access)
  app.patch(
    "/api/agreements/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
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
    },
  );

  // Delete agreement (operacional access)
  app.delete(
    "/api/agreements/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
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
    },
  );

  // ===== COEFFICIENT TABLES ROUTES =====

  // Get all coefficient tables
  app.get("/api/coefficient-tables", requireAuth, async (req, res) => {
    try {
      const tables = await storage.getAllCoefficientTables();
      return res.json(tables);
    } catch (error) {
      console.error("Get coefficient tables error:", error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar tabelas de coeficientes" });
    }
  });

  // Get coefficient tables by agreement
  app.get(
    "/api/coefficient-tables/by-agreement/:agreementId",
    requireAuth,
    async (req, res) => {
      try {
        const agreementId = parseInt(req.params.agreementId);
        if (isNaN(agreementId)) {
          return res.status(400).json({ message: "ID de convênio inválido" });
        }

        const tables =
          await storage.getCoefficientTablesByAgreement(agreementId);
        return res.json(tables);
      } catch (error) {
        console.error("Get coefficient tables by agreement error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar tabelas de coeficientes" });
      }
    },
  );

  // Create coefficient table (operacional access)
  app.post(
    "/api/coefficient-tables",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
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
        return res
          .status(500)
          .json({ message: "Erro ao criar tabela de coeficiente" });
      }
    },
  );

  // Bulk import coefficient tables (operacional access)
  app.post(
    "/api/coefficient-tables/bulk-import",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const { tables } = req.body;

        if (!Array.isArray(tables) || tables.length === 0) {
          return res
            .status(400)
            .json({ message: "Nenhuma tabela para importar" });
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

        const createdTables =
          await storage.createCoefficientTablesBulk(validatedTables);
        return res.status(201).json({
          message: `${createdTables.length} tabelas importadas com sucesso`,
          count: createdTables.length,
          tables: createdTables,
        });
      } catch (error) {
        console.error("Bulk import coefficient tables error:", error);
        return res.status(500).json({ message: "Erro ao importar tabelas" });
      }
    },
  );

  // Update coefficient table (operacional access)
  app.patch(
    "/api/coefficient-tables/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const result = insertCoefficientTableSchema
          .partial()
          .safeParse(req.body);

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
        return res
          .status(500)
          .json({ message: "Erro ao atualizar tabela de coeficiente" });
      }
    },
  );

  // Delete coefficient table (operacional access)
  app.delete(
    "/api/coefficient-tables/:id",
    requireAuth,
    requireOperacionalAccess,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        await storage.deleteCoefficientTable(id);
        return res.json({
          message: "Tabela de coeficiente excluída com sucesso",
        });
      } catch (error) {
        console.error("Delete coefficient table error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao excluir tabela de coeficiente" });
      }
    },
  );

  // ===== CALCULATOR HIERARCHY ROUTES =====

  // Get operation types by agreement
  app.get("/api/calculator/operation-types", requireAuth, async (req, res) => {
    try {
      const agreementId = parseInt(req.query.agreementId as string);
      if (isNaN(agreementId)) {
        return res.status(400).json({ message: "ID de convênio inválido" });
      }

      const operationTypes =
        await storage.getOperationTypesByAgreement(agreementId);
      return res.json(operationTypes);
    } catch (error) {
      console.error("Get operation types error:", error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar tipos de operação" });
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

      const banks = await storage.getBanksByAgreementAndOperationType(
        agreementId,
        operationType,
      );
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

      const terms = await storage.getTermsByAgreementOperationTypeAndBank(
        agreementId,
        operationType,
        bank,
      );
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

      const tables = await storage.getTablesByAgreementOperationTypeBankAndTerm(
        agreementId,
        operationType,
        bank,
        termMonths,
      );
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
      console.log(
        "[SIMULATION] Creating simulation for user:",
        req.user!.id,
        req.user!.email,
      );
      console.log(
        "[SIMULATION] Request body:",
        JSON.stringify(req.body, null, 2),
      );

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
      console.log(
        "[STATS] Request from user:",
        req.user!.id,
        req.user!.email,
        "role:",
        req.user!.role,
      );

      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;

      console.log(
        "[STATS] Filters - startDate:",
        startDate,
        "endDate:",
        endDate,
      );

      // Determine which userIds to include based on role
      let userIds: number[] | undefined;
      let relevantUsers: User[];

      if (req.user!.role === "master") {
        // Master sees all - no filter
        userIds = undefined;
        relevantUsers = await storage.getAllUsers();
        console.log(
          "[STATS] Master user - showing all users, total:",
          relevantUsers.length,
        );
      } else if (req.user!.role === "coordenacao") {
        // Coordenador sees their team (themselves + their vendedores)
        const teamUsers = await storage.getUsersByManager(req.user!.id);
        userIds = [req.user!.id, ...teamUsers.map((u) => u.id)];
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
        storage.getRecentSimulationsWithUser(
          undefined,
          startDate,
          endDate,
          userIds,
        ),
        storage.getRankingByBank(startDate, endDate, userIds),
        storage.getRankingByAgreement(startDate, endDate, userIds),
        storage.getRankingByTerm(startDate, endDate, userIds),
        storage.getRankingByOperationType(startDate, endDate, userIds),
      ]);

      // Safety checks for undefined/null values
      const safeSimulations = filteredSimulationsWithUser || [];

      console.log("[STATS] Found simulations:", safeSimulations.length);
      if (safeSimulations.length > 0) {
        console.log(
          "[STATS] First simulation:",
          JSON.stringify(safeSimulations[0], null, 2),
        );
      }

      // Calculate stats by user using filtered simulations
      const statsByUser = relevantUsers.map((user) => {
        const userSimulations = safeSimulations.filter(
          (s) => s.userId === user.id,
        );

        // Convert string values to numbers for proper aggregation
        const totalContractValue = userSimulations.reduce((sum, s) => {
          const value =
            typeof s.totalContractValue === "string"
              ? parseFloat(s.totalContractValue)
              : (s.totalContractValue as any);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);

        const totalClientRefund = userSimulations.reduce((sum, s) => {
          const value =
            typeof s.clientRefund === "string"
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
          lastSimulation:
            userSimulations.length > 0
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
        statsByUser: statsByUser.filter((s) => s.simulationCount > 0),
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

  // Middleware for roteiros access - REFACTORED to use profile-based permissions
  // Now checks for modulo_roteiros permission instead of role
  async function requireRoteirosAccess(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    // isMaster has full access
    if (req.user.isMaster) {
      logPermissionCheck(
        req.user.id,
        req.user.name,
        "modulo_roteiros",
        "view",
        true,
        "isMaster=true",
      );
      return next();
    }

    // Check profile-based permission for roteiros module
    const hasAccess = await storage.hasModuleAccess(
      req.user.id,
      "modulo_roteiros",
    );
    if (!hasAccess) {
      logPermissionCheck(
        req.user.id,
        req.user.name,
        "modulo_roteiros",
        "view",
        false,
        "No profile permission",
      );
      return res.status(403).json({
        message:
          "Acesso negado - você não tem permissão para acessar roteiros bancários",
      });
    }

    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_roteiros",
      "view",
      true,
      "Profile permission granted",
    );
    next();
  }

  // Get all active roteiros
  app.get(
    "/api/roteiros",
    requireAuth,
    requireRoteirosAccess,
    async (req, res) => {
      try {
        const roteiros = await storage.getActiveRoteiros();
        return res.json(roteiros);
      } catch (error) {
        console.error("Get roteiros error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar roteiros bancários" });
      }
    },
  );

  // Helper function to generate contextual suggestions for next queries
  const generateSuggestions = (
    topicos: string[],
    filters: {
      convenio: string | null;
      tipo_operacao: string | null;
      idade: number | null;
    },
    moduloId: string,
  ): string[] => {
    const sugestoes: string[] = [];

    // Base suggestions based on topics
    const suggestionMap: Record<string, string[]> = {
      idade: [
        filters.convenio
          ? `Qual o limite de parcela para ${filters.idade || "essa"} idade no ${filters.convenio}?`
          : "Qual o limite de parcela para essa idade?",
        "Quais bancos têm o maior prazo?",
      ],
      convenio: [
        `Quais operações são permitidas no ${filters.convenio || "convênio"}?`,
        `Algum banco tem regra especial para ${filters.convenio || "este convênio"}?`,
        "Há limite de idade?",
      ],
      operacao: [
        "Quanto libera em média?",
        "Pode fazer compra de dívida junto?",
        "Quais bancos aceitam essa operação?",
      ],
      portal: [
        "Como acessar o portal oficial?",
        "Onde consultar margem?",
        "Como gerar autorização?",
      ],
      documentacao: [
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
        if (!filters.convenio)
          sugestoes.push("Me diga o convênio: GOV SP, SIAPE, INSS...");
        if (!filters.tipo_operacao)
          sugestoes.push("Qual tipo de operação você precisa?");
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
  app.get(
    "/api/roteiros/ia-search",
    requireAuth,
    requireRoteirosAccess,
    async (req, res) => {
      try {
        const { q } = req.query;

        if (!q || typeof q !== "string" || q.trim() === "") {
          return res
            .status(400)
            .json({ message: "Consulta não pode estar vazia" });
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
            { role: "user", content: q.trim() },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 500,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          return res.status(502).json({
            message: "Erro ao interpretar consulta - resposta vazia da IA",
          });
        }

        // Schema for validating AI response with module detection
        const moduloSchema = z.object({
          id: z.string().default("modulo_1"),
          label: z.string().default("Comparação entre bancos"),
          confidence: z
            .union([
              z.number(),
              z.string().transform((v) => parseFloat(v) || 0.5),
            ])
            .default(0.5),
        });

        const defaultModulo = {
          id: "modulo_1",
          label: "Comparação entre bancos",
          confidence: 0.5,
        };

        const aiResponseSchema = z
          .object({
            convenio: z.string().nullable().optional().default(null),
            segmento: z.string().nullable().optional().default(null),
            tipo_operacao: z.string().nullable().optional().default(null),
            idade: z
              .union([
                z.number(),
                z.string().transform((v) => parseInt(v) || null),
              ])
              .nullable()
              .optional()
              .default(null),
            palavras_chave: z.array(z.string()).optional().default([]),
            modulo: moduloSchema.optional().default(defaultModulo),
            sugestoes_topicos: z.array(z.string()).optional().default([]),
          })
          .passthrough();

        let parsedContent: unknown;
        try {
          parsedContent = JSON.parse(content);
        } catch {
          console.error("AI response parse error:", content);
          return res.status(502).json({
            message: "Erro ao interpretar resposta da IA - JSON inválido",
          });
        }

        const validationResult = aiResponseSchema.safeParse(parsedContent);
        if (!validationResult.success) {
          console.error(
            "AI response validation error:",
            validationResult.error,
            "Content:",
            parsedContent,
          );
          return res.status(502).json({
            message: "Erro ao interpretar resposta da IA - formato inválido",
          });
        }

        const filters = {
          convenio: validationResult.data.convenio || null,
          segmento: validationResult.data.segmento || null,
          tipo_operacao: validationResult.data.tipo_operacao || null,
          idade: validationResult.data.idade ?? null,
          palavras_chave: validationResult.data.palavras_chave || [],
        };

        // Ensure robust module fallback
        const defaultModuloFallback = {
          id: "modulo_1",
          label: "Comparação entre bancos",
          confidence: 0.5,
        };
        const rawModulo = validationResult.data.modulo;
        const modulo =
          rawModulo && rawModulo.id ? rawModulo : defaultModuloFallback;

        // Normalize suggestion topics to lowercase
        const sugestoes_topicos = (
          validationResult.data.sugestoes_topicos || []
        )
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
        const results = roteiros.map((roteiro) => {
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
              portais: (dados.portais_acesso || [])
                .slice(0, 2)
                .map((p: any) => p.nome_portal || "Portal"),
            },
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
            modulo_1:
              basePrompt +
              `MÓDULO: COMPARAÇÃO ENTRE BANCOS

Sua missão: Comparar os bancos disponíveis para o perfil do cliente.

O que incluir na resposta:
- Liste os bancos que atendem o perfil (ex.: "Para esse perfil, os bancos NEO, BMG e PAN atendem.")
- Compare brevemente: qual libera maior parcela, qual tem menos documentação, qual tem prazo mais alto
- Se só tiver idade, peça o convênio para refinar a busca
- Destaque diferenças relevantes entre os bancos

Exemplo:
"Para 60 anos no SIAPE, encontrei 3 bancos disponíveis: NEO, BMG e PAN. O NEO libera maior parcela, o BMG exige menos documentos e o PAN oferece o maior prazo. Me conta mais sobre o valor que você precisa para eu indicar o melhor."`,

            modulo_2:
              basePrompt +
              `MÓDULO: EXPLICAÇÃO DE REGRAS ESPECÍFICAS

Sua missão: Explicar por que algo não atende ou quais são as regras específicas.

O que incluir na resposta:
- Explique a regra encontrada nos roteiros de forma clara
- Se houver limite de idade, explique exatamente qual é
- Se houver limite de parcela, mencione o valor
- Se houver restrição de público, liste quem não é atendido
- Se a informação não existir nos roteiros, diga claramente: "Não encontrei essa regra específica nos roteiros disponíveis."

Exemplo:
"No GOV SP, acima de 71 anos e 10 meses o limite de parcela cai para R$ 1.600,00 e muitos bancos não aceitam. Por isso esse perfil tem menos opções. Verifiquei aqui que apenas o banco X ainda atende, com algumas restrições."`,

            modulo_3:
              basePrompt +
              `MÓDULO: QUAL OPERAÇÃO É MELHOR (RECOMENDAÇÃO)

Sua missão: Recomendar qual tipo de operação é mais vantajoso para o perfil.

O que incluir na resposta:
- Compare as operações disponíveis (crédito novo, refin, cartão benefício, etc.)
- Considere: prazo, margem, idade, limites
- Recomende a operação mais vantajosa com justificativa
- Se faltar informação, peça mais detalhes sobre o objetivo do cliente

Exemplo:
"Para SIAPE com 60 anos, entre crédito novo e refin, o refin costuma liberar mais valor porque mantém o prazo original do contrato. Mas se você não tem contrato ativo, crédito novo é o caminho. Me conta: você já tem algum contrato de consignado?"`,

            modulo_4:
              basePrompt +
              `MÓDULO: CHECKLIST DE DOCUMENTAÇÃO

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

            modulo_5:
              basePrompt +
              `MÓDULO: PASSO A PASSO / FLUXO OPERACIONAL

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

            modulo_6:
              basePrompt +
              `MÓDULO: DETECÇÃO DE INCONSISTÊNCIAS

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

            modulo_7:
              basePrompt +
              `MÓDULO: RESUMO GERAL DO CONVÊNIO/BANCO

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
• Portal: SPPREV (spprev.sp.gov.br)"`,
          };

          return modulePrompts[moduloId] || modulePrompts["modulo_1"];
        };

        const respondentePrompt = getRespondentePrompt(modulo.id);

        let respostaHumana = "";
        try {
          // Prepare roteiros data for AI (simplified version with key info)
          const roteirosParaIA = roteiros.slice(0, 5).map((r) => {
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
${JSON.stringify(roteirosParaIA, null, 2)}`,
              },
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
        const sugestoes = generateSuggestions(
          sugestoes_topicos,
          filters,
          modulo.id,
        );

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
        if (
          error?.message?.includes("429") ||
          error?.message?.includes("rate limit")
        ) {
          return res.status(429).json({
            message:
              "Serviço de IA temporariamente indisponível. Tente novamente em alguns segundos.",
          });
        }
        if (error?.message?.includes("timeout")) {
          return res.status(504).json({
            message: "Tempo limite excedido ao consultar IA. Tente novamente.",
          });
        }

        return res
          .status(500)
          .json({ message: "Erro ao processar pesquisa inteligente" });
      }
    },
  );

  // Get single roteiro by ID
  app.get(
    "/api/roteiros/:id",
    requireAuth,
    requireRoteirosAccess,
    async (req, res) => {
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
    },
  );

  // Search roteiros with filters
  app.get(
    "/api/roteiros/search",
    requireAuth,
    requireRoteirosAccess,
    async (req, res) => {
      try {
        const { convenio, tipoOperacao, idade } = req.query;

        const idadeNum = idade ? parseInt(idade as string) : undefined;

        const roteiros = await storage.searchRoteiros(
          convenio as string | undefined,
          tipoOperacao as string | undefined,
          idadeNum,
        );

        return res.json(roteiros);
      } catch (error) {
        console.error("Search roteiros error:", error);
        return res.status(500).json({ message: "Erro ao pesquisar roteiros" });
      }
    },
  );

  // Get distinct convenios for filter
  app.get(
    "/api/roteiros/filters/convenios",
    requireAuth,
    requireRoteirosAccess,
    async (req, res) => {
      try {
        const convenios = await storage.getDistinctConvenios();
        return res.json(convenios);
      } catch (error) {
        console.error("Get convenios error:", error);
        return res.status(500).json({ message: "Erro ao buscar convênios" });
      }
    },
  );

  // Get distinct tipos de operacao for filter
  app.get(
    "/api/roteiros/filters/tipos-operacao",
    requireAuth,
    requireRoteirosAccess,
    async (req, res) => {
      try {
        const tipos = await storage.getDistinctTiposOperacao();
        return res.json(tipos);
      } catch (error) {
        console.error("Get tipos operacao error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar tipos de operação" });
      }
    },
  );

  // Import roteiros from JSON
  app.post(
    "/api/roteiros/importar-json",
    requireAuth,
    requireRoteirosAccess,
    async (req, res) => {
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
    },
  );

  // Import roteiros from PDF using AI extraction
  app.post(
    "/api/roteiros/importar-pdf",
    requireAuth,
    requireRoteirosAccess,
    uploadPdf.single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "Nenhum arquivo enviado" });
        }

        if (req.file.mimetype !== "application/pdf") {
          return res.status(400).json({ message: "O arquivo deve ser um PDF" });
        }

        if (req.file.size > 10 * 1024 * 1024) {
          return res
            .status(400)
            .json({ message: "O arquivo deve ter no máximo 10MB" });
        }

        const { processPdfBuffer } = await import("./roteiros-pdf-service");
        const result = await processPdfBuffer(req.file.buffer);

        if (!result.success) {
          return res.status(400).json({
            message: result.error || "Erro ao processar PDF",
            rawText: result.rawText,
            roteiros: result.roteiros,
            validationErrors: result.validationErrors,
          });
        }

        return res.json({
          success: true,
          message: `Extração concluída: ${result.roteiros?.roteiros.length || 0} roteiro(s) encontrado(s)`,
          roteiros: result.roteiros,
          rawText: result.rawText,
        });
      } catch (error: any) {
        console.error("Import PDF roteiros error:", error);
        return res.status(500).json({
          message: error.message || "Erro ao processar PDF",
          error: error.message,
        });
      }
    },
  );

  // Update roteiro metadata (banco, convenio, segmento, tipo_operacao)
  const updateRoteiroSchema = z
    .object({
      banco: z.string().min(1).optional(),
      convenio: z.string().min(1).optional(),
      segmento: z.union([z.string(), z.null()]).optional(),
      tipo_operacao: z
        .enum([
          "credito_novo",
          "refin",
          "compra_divida",
          "compra_cartao_beneficio",
          "cartao_beneficio",
          "cartao_consignado",
          "nao_especificado",
          "Não especificado",
        ])
        .optional(),
    })
    .refine(
      (data) =>
        data.banco ||
        data.convenio ||
        data.segmento !== undefined ||
        data.tipo_operacao,
      { message: "Pelo menos um campo deve ser fornecido para atualização" },
    );

  app.put(
    "/api/roteiros/:id",
    requireAuth,
    requireRoteirosAccess,
    async (req, res) => {
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

        const updateData: {
          banco?: string;
          convenio?: string;
          segmento?: string | null;
          tipoOperacao?: string;
        } = {};
        if (result.data.banco) updateData.banco = result.data.banco;
        if (result.data.convenio) updateData.convenio = result.data.convenio;
        if (result.data.segmento !== undefined)
          updateData.segmento = result.data.segmento;
        if (result.data.tipo_operacao)
          updateData.tipoOperacao = result.data.tipo_operacao;

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
    },
  );

  // Delete roteiro (only master, atendimento, operacional can delete)
  app.delete(
    "/api/roteiros/:id",
    requireAuth,
    requireRoteirosAccess,
    async (req, res) => {
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
    },
  );

  // ===== BASE DE CLIENTES ROUTES =====

  // Complete column mapping for import (includes official template + legacy aliases)
  // Formato Folha Servidor oficial (ordem exata com acentos e %):
  // Orgão, Matricula, Base Calc, Bruta 5%, Utilz 5%, Saldo 5%, Beneficio Bruta 5%, Beneficio Utilizado 5%, Beneficio Saldo 5%,
  // Bruta 35%, Utilz 35%, Saldo 35%, Bruta 70%, Utilz 70%, Saldo 70%, Créditos, Débitos, Líquido,
  // ARQ. UPAG, EXC QTD, EXC Soma, RJUR, Sit Func, CPF, Margem
  const COLUMN_MAP: Record<string, string> = {
    // === TEMPLATE FOLHA SERVIDOR OFICIAL (ordem exata) ===
    ORGÃO: "orgaodesc",
    MATRICULA: "matricula",
    "BASE CALC": "base_calc",
    "BRUTA 5%": "margem_5_bruta",
    "UTILZ 5%": "margem_5_utilizada",
    "SALDO 5%": "margem_5_saldo",
    "BENEFICIO BRUTA 5%": "margem_beneficio_5_bruta",
    "BENEFICIO UTILIZADO 5%": "margem_beneficio_5_utilizada",
    "BENEFICIO SALDO 5%": "margem_beneficio_5_saldo",
    "BRUTA 35%": "margem_35_bruta",
    "UTILZ 35%": "margem_35_utilizada",
    "SALDO 35%": "margem_35_saldo",
    "BRUTA 70%": "margem_70_bruta",
    "UTILZ 70%": "margem_70_utilizada",
    "SALDO 70%": "margem_70_saldo",
    CRÉDITOS: "creditos",
    DÉBITOS: "debitos",
    LÍQUIDO: "liquido",
    "ARQ. UPAG": "arq_upag",
    "EXC QTD": "exc_qtd",
    "EXC SOMA": "exc_soma",
    RJUR: "rjur",
    "SIT FUNC": "sit_func",
    CPF: "cpf",
    MARGEM: "margem",
    // === TEMPLATE FOLHA PENSIONISTA (campo adicional) ===
    INSTITUIDOR: "instituidor",
    // === IDENTIFICAÇÃO (legado) ===
    MATRÍCULA: "matricula",
    CONVENIO: "convenio",
    CONVÊNIO: "convenio",
    ORGAO: "orgaodesc",
    ORGAODESC: "orgaodesc",
    ORGAO_DESC: "orgaodesc",
    ORGÃO_DESC: "orgaodesc",
    UF: "uf",
    ESTADO: "uf",
    MUNICIPIO: "municipio",
    MUNICÍPIO: "municipio",
    SITUACAO_FUNCIONAL: "sit_func",
    SITUAÇÃO_FUNCIONAL: "sit_func",
    SIT_FUNC: "sit_func",
    "SITUACAO FUNCIONAL": "sit_func",
    "SITUAÇÃO FUNCIONAL": "sit_func",
    NOME: "nome",
    NOME_COMPLETO: "nome",
    "NOME COMPLETO": "nome",
    DATA_NASCIMENTO: "data_nascimento",
    "DATA NASCIMENTO": "data_nascimento",
    DT_NASCIMENTO: "data_nascimento",
    // === CONTATO ===
    TELEFONE_1: "telefone_1",
    "TELEFONE 1": "telefone_1",
    TELEFONE1: "telefone_1",
    TELEFONE_2: "telefone_2",
    "TELEFONE 2": "telefone_2",
    TELEFONE2: "telefone_2",
    TELEFONE_3: "telefone_3",
    "TELEFONE 3": "telefone_3",
    TELEFONE3: "telefone_3",
    TELEFONE_4: "telefone_4",
    "TELEFONE 4": "telefone_4",
    TELEFONE_5: "telefone_5",
    "TELEFONE 5": "telefone_5",
    EMAIL: "email",
    "E-MAIL": "email",
    // === DADOS BANCÁRIOS DO SALÁRIO ===
    BANCO_SALARIO: "banco_salario",
    "BANCO SALARIO": "banco_salario",
    BANCO: "banco_salario",
    AGENCIA_SALARIO: "agencia_salario",
    "AGENCIA SALARIO": "agencia_salario",
    AGENCIA: "agencia_salario",
    AGÊNCIA: "agencia_salario",
    CONTA_SALARIO: "conta_salario",
    "CONTA SALARIO": "conta_salario",
    CONTA: "conta_salario",
    UPAG: "upag",
    UNIDADE_PAGADORA: "upag",
    "UNIDADE PAGADORA": "upag",
    // === IDADE ===
    IDADE: "idade",
    // === RENDIMENTOS ===
    SALARIO_BRUTO: "salario_bruto",
    "SALARIO BRUTO": "salario_bruto",
    BRUTO: "salario_bruto",
    DESCONTOS_BRUTOS: "descontos_brutos",
    "DESCONTOS BRUTOS": "descontos_brutos",
    TOTAL_DESCONTOS: "descontos_brutos",
    "TOTAL DESCONTOS": "descontos_brutos",
    SALARIO_LIQUIDO: "salario_liquido",
    "SALARIO LIQUIDO": "salario_liquido",
    // === MARGENS 5% (template oficial) ===
    MARGEM_5_BRUTA: "margem_5_bruta",
    "MARGEM 5 BRUTA": "margem_5_bruta",
    MARGEM_5_UTILIZADA: "margem_5_utilizada",
    "MARGEM 5 UTILIZADA": "margem_5_utilizada",
    MARGEM_5_SALDO: "margem_5_saldo",
    "MARGEM 5 SALDO": "margem_5_saldo",
    // === MARGENS BENEFÍCIO 5% (template oficial) ===
    MARGEM_BENEFICIO_5_BRUTA: "margem_beneficio_5_bruta",
    "MARGEM BENEFICIO 5 BRUTA": "margem_beneficio_5_bruta",
    MARGEM_BENEFICIO_5_UTILIZADA: "margem_beneficio_5_utilizada",
    "MARGEM BENEFICIO 5 UTILIZADA": "margem_beneficio_5_utilizada",
    MARGEM_BENEFICIO_5_SALDO: "margem_beneficio_5_saldo",
    "MARGEM BENEFICIO 5 SALDO": "margem_beneficio_5_saldo",
    // === MARGENS 35% ===
    MARGEM_35_BRUTA: "margem_35_bruta",
    "MARGEM 35 BRUTA": "margem_35_bruta",
    "BRUTA 30%": "margem_35_bruta",
    MARGEM_35_UTILIZADA: "margem_35_utilizada",
    "MARGEM 35 UTILIZADA": "margem_35_utilizada",
    "UTILZ 30%": "margem_35_utilizada",
    MARGEM_35_SALDO: "margem_35_saldo",
    "MARGEM 35 SALDO": "margem_35_saldo",
    "SALDO 30%": "margem_35_saldo",
    // === MARGENS 70% ===
    MARGEM_70_BRUTA: "margem_70_bruta",
    "MARGEM 70 BRUTA": "margem_70_bruta",
    MARGEM_70_UTILIZADA: "margem_70_utilizada",
    "MARGEM 70 UTILIZADA": "margem_70_utilizada",
    MARGEM_70_SALDO: "margem_70_saldo",
    "MARGEM 70 SALDO": "margem_70_saldo",
    // === MARGEM CARTÃO CRÉDITO (legado) ===
    MARGEM_CARTAO_CREDITO_BRUTA: "margem_cartao_credito_bruta",
    "MARGEM CARTAO CREDITO BRUTA": "margem_cartao_credito_bruta",
    MARGEM_CARTAO_CREDITO_UTILIZADA: "margem_cartao_credito_utilizada",
    "MARGEM CARTAO CREDITO UTILIZADA": "margem_cartao_credito_utilizada",
    MARGEM_CARTAO_CREDITO_SALDO: "margem_cartao_credito_saldo",
    "MARGEM CARTAO CREDITO SALDO": "margem_cartao_credito_saldo",
    "MARGEM CARTAO CREDITO": "margem_cartao_credito_saldo",
    "SALDO CARTAO CREDITO": "margem_cartao_credito_saldo",
    "MARGEM 5% CREDITO": "margem_cartao_credito_saldo",
    // === MARGEM CARTÃO BENEFÍCIO (legado) ===
    MARGEM_CARTAO_BENEFICIO_BRUTA: "margem_cartao_beneficio_bruta",
    "MARGEM CARTAO BENEFICIO BRUTA": "margem_cartao_beneficio_bruta",
    MARGEM_CARTAO_BENEFICIO_UTILIZADA: "margem_cartao_beneficio_utilizada",
    "MARGEM CARTAO BENEFICIO UTILIZADA": "margem_cartao_beneficio_utilizada",
    MARGEM_CARTAO_BENEFICIO_SALDO: "margem_cartao_beneficio_saldo",
    "MARGEM CARTAO BENEFICIO SALDO": "margem_cartao_beneficio_saldo",
    "MARGEM CARTAO BENEFICIO": "margem_cartao_beneficio_saldo",
    "SALDO CARTAO BENEFICIO": "margem_cartao_beneficio_saldo",
    "MARGEM 5% BENEFICIO": "margem_cartao_beneficio_saldo",
    // === FOLHA AGREGADOS (legado) ===
    CREDITOS: "creditos",
    DEBITOS: "debitos",
    LIQUIDO: "liquido",
    // === CONTRATOS ===
    BANCO_EMPRESTIMO: "banco_emprestimo",
    "BANCO EMPRESTIMO": "banco_emprestimo",
    "BANCO DO EMPRESTIMO": "banco_emprestimo",
    BANCO_DO_EMPRESTIMO: "banco_emprestimo",
    VALOR_PARCELA: "valor_parcela",
    "VALOR PARCELA": "valor_parcela",
    SALDO_DEVEDOR: "saldo_devedor",
    "SALDO DEVEDOR": "saldo_devedor",
    PRAZO_REMANESCENTE: "prazo_remanescente",
    "PRAZO REMANESCENTE": "prazo_remanescente",
    PARCELAS_RESTANTES: "prazo_remanescente",
    "PARCELAS RESTANTES": "prazo_remanescente",
    NUMERO_CONTRATO: "numero_contrato",
    "NUMERO CONTRATO": "numero_contrato",
    NR_CONTRATO: "numero_contrato",
    TIPO_PRODUTO: "tipo_produto",
    "TIPO PRODUTO": "tipo_produto",
    TIPO_OPERACAO: "tipo_produto",
    "TIPO OPERACAO": "tipo_produto",
    TIPO_CONTRATO: "tipo_produto",
    SITUACAO_CONTRATO: "situacao_contrato",
    "SITUACAO CONTRATO": "situacao_contrato",
  };

  const ESTADUAL_COLUMN_MAP: Record<string, string> = {
    CPF: "cpf",
    "NOME DO SERVIDOR": "nome",
    ORGAO_SECRETARIA: "orgaodesc",
    "ORGAO_Secretaria": "orgaodesc",
    CARGO: "cargo",
    FUNCAO: "funcao",
    NATUREZA: "natureza",
    TOTAL_VANTAGENS: "salario_bruto",
    SITUACAOFUNCIONAL: "sit_func",
    SEXO: "sexo",
    DT_NASC: "data_nascimento",
    IDADE: "idade",
    ENDERECO: "endereco",
    NUMERO: "numero",
    BAIRRO: "bairro",
    CIDADE: "municipio",
    UF: "uf",
    CEP: "cep",
    NOME_MAE: "nome_mae",
    "DDICELULAR 1": "telefone_1",
    "CELULAR 1": "telefone_2",
    "CELULAR 2": "telefone_3",
    "CELULAR 3": "telefone_4",
  };

  // Headers esperados para template Folha Servidor (validação estrita)
  const FOLHA_SERVIDOR_EXPECTED_HEADERS = [
    "Orgão",
    "Matricula",
    "Base Calc",
    "Bruta 5%",
    "Utilz 5%",
    "Saldo 5%",
    "Beneficio Bruta 5%",
    "Beneficio Utilizado 5%",
    "Beneficio Saldo 5%",
    "Bruta 35%",
    "Utilz 35%",
    "Saldo 35%",
    "Bruta 70%",
    "Utilz 70%",
    "Saldo 70%",
    "Créditos",
    "Débitos",
    "Líquido",
    "ARQ. UPAG",
    "EXC QTD",
    "EXC Soma",
    "RJUR",
    "Sit Func",
    "CPF",
    "Margem",
  ];

  // Headers esperados para template Folha Pensionista (inclui Instituidor)
  const FOLHA_PENSIONISTA_EXPECTED_HEADERS = [
    "Orgão",
    "Instituidor",
    "Matricula",
    "Base Calc",
    "Bruta 5%",
    "Utilz 5%",
    "Saldo 5%",
    "Beneficio Bruta 5%",
    "Beneficio Utilizado 5%",
    "Beneficio Saldo 5%",
    "Bruta 35%",
    "Utilz 35%",
    "Saldo 35%",
    "Bruta 70%",
    "Utilz 70%",
    "Saldo 70%",
    "Créditos",
    "Débitos",
    "Líquido",
    "ARQ. UPAG",
    "EXC QTD",
    "EXC Soma",
    "RJUR",
    "Sit Func",
    "CPF",
    "Margem",
  ];

  // Detecta automaticamente se o arquivo é Servidor ou Pensionista
  // Regra: se existir a coluna "Instituidor" -> Pensionista, senão -> Servidor
  type FolhaLayoutType = "servidor" | "pensionista" | "unknown";

  function detectFolhaLayout(headers: string[]): FolhaLayoutType {
    const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

    // Se tiver coluna "Instituidor" -> Pensionista
    if (normalizedHeaders.some((h) => h === "instituidor")) {
      return "pensionista";
    }

    // Se tiver Matricula + CPF -> Servidor
    const hasMatricula = normalizedHeaders.some((h) => h === "matricula");
    const hasCpf = normalizedHeaders.some((h) => h === "cpf");

    if (hasMatricula && hasCpf) {
      return "servidor";
    }

    return "unknown";
  }

  // Valida header e retorna erro se não bater com nenhum layout
  function validateFolhaHeader(headers: string[]): {
    valid: boolean;
    layout: FolhaLayoutType;
    missing: string[];
  } {
    const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
    const layout = detectFolhaLayout(headers);
    const missing: string[] = [];

    // Colunas obrigatórias para ambos os layouts
    const required = ["matricula", "cpf"];
    for (const req of required) {
      if (!normalizedHeaders.includes(req)) {
        missing.push(req.toUpperCase());
      }
    }

    if (layout === "unknown") {
      return {
        valid: false,
        layout,
        missing: [
          "MATRICULA",
          "CPF",
          "Layout não reconhecido - use template Servidor ou Pensionista",
        ],
      };
    }

    return { valid: missing.length === 0, layout, missing };
  }

  function normalizeCol(col: string): string {
    // Normaliza para maiúsculas mas mantém espaços para permitir matching com aliases que usam espaço
    return col.toUpperCase().trim().replace(/\s+/g, " ");
  }

  function parseNum(value: any): string | null {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value)
      .replace(/[^\d,.-]/g, "")
      .replace(",", ".");
    const num = parseFloat(str);
    return isNaN(num) ? null : num.toFixed(2);
  }

  // Função para normalizar valores monetários - preserva vazios como null
  function normalizeMoney(value: any): string | null {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value)
      .trim()
      .replace(/[^\d,.-]/g, "")
      .replace(",", ".");
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
    competenciaDate: Date,
    tenantId?: number,
    importRunId?: number,
    templateType?: string,
  ) {
    const isEstadualBg = templateType === "estadual";
    console.log(
      `[Import-BG] Starting background processing for base ${baseId}, importRun ${importRunId || "N/A"}, ${data.length} rows, template: ${isEstadualBg ? 'estadual' : 'federal'}`,
    );

    const headers = data[0] ? Object.keys(data[0]) : [];
    const headerMap: Record<string, string> = {};
    const activeMap = isEstadualBg ? ESTADUAL_COLUMN_MAP : COLUMN_MAP;

    for (const header of headers) {
      const normalized = normalizeCol(header);
      if (activeMap[normalized]) {
        headerMap[header] = activeMap[normalized];
      }
      if (isEstadualBg) {
        const trimmed = header.trim();
        if (ESTADUAL_COLUMN_MAP[trimmed]) {
          headerMap[header] = ESTADUAL_COLUMN_MAP[trimmed];
        }
      }
    }

    // Detecta automaticamente o layout (Servidor ou Pensionista)
    const detectedLayout = isEstadualBg ? "servidor" as FolhaLayoutType : detectFolhaLayout(headers);
    console.log(
      `[Import-BG] Layout detectado: ${detectedLayout.toUpperCase()} (baseId: ${baseId})`,
    );
    console.log(`[Import-BG] Mapped columns:`, Object.keys(headerMap).length);

    let totalLinhas = 0;
    const BATCH_SIZE = 100;

    // Cache local de pessoas processadas para evitar duplicatas na mesma importação
    const processedPessoas = new Map<string, { id: number }>();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        let matricula: string | null = null;
        if (isEstadualBg) {
          let cpfRaw: string | null = null;
          for (const [col, field] of Object.entries(headerMap)) {
            if (field === "cpf") {
              cpfRaw = String(row[col] || "").replace(/\D/g, "").trim();
              break;
            }
          }
          if (!cpfRaw || cpfRaw.length < 5) continue;
          matricula = `EST_${cpfRaw.padStart(11, "0")}`;
        } else {
          for (const [col, field] of Object.entries(headerMap)) {
            if (field === "matricula") {
              matricula = String(row[col] || "").trim();
              break;
            }
          }
          if (!matricula) continue;
        }

        const pessoaData: Record<string, any> = {
          matricula,
          convenio,
          baseTagUltima: baseTag,
          importRunId: importRunId || null,
        };

        const folhaData: Record<string, any> = {
          competencia: competenciaDate,
          baseTag,
          importRunId: importRunId || null,
        };

        const telefones: string[] = [];

        const contratoData: Record<string, any> = {
          competencia: competenciaDate,
          baseTag,
          importRunId: importRunId || null,
        };

        for (const [col, value] of Object.entries(row)) {
          const field = headerMap[col];

          if (!field) continue;

          if (
            [
              "cpf",
              "nome",
              "orgaodesc",
              "sit_func",
              "uf",
              "municipio",
              "email",
            ].includes(field)
          ) {
            const key = field === "sit_func" ? "sitFunc" : field;
            pessoaData[key] = String(value || "").trim() || null;
          } else if (field === "banco_salario") {
            pessoaData.bancoCodigo = String(value || "").trim() || null;
          } else if (field === "agencia_salario") {
            pessoaData.agencia = String(value || "").trim() || null;
          } else if (field === "conta_salario") {
            pessoaData.conta = String(value || "").trim() || null;
          } else if (field === "upag") {
            pessoaData.upag = String(value || "").trim() || null;
          } else if (field === "data_nascimento") {
            pessoaData.dataNascimento = parseDate(value);
          } else if (field === "salario_bruto") {
            folhaData.salarioBruto = normalizeMoney(value);
          } else if (field === "descontos_brutos") {
            folhaData.descontosBrutos = normalizeMoney(value);
          } else if (field === "salario_liquido") {
            folhaData.salarioLiquido = normalizeMoney(value);
          }
          // Novos campos do template Folha Servidor oficial
          else if (field === "base_calc") {
            folhaData.baseCalc = normalizeMoney(value);
          } else if (field === "creditos") {
            folhaData.creditos = normalizeMoney(value);
          } else if (field === "debitos") {
            folhaData.debitos = normalizeMoney(value);
          } else if (field === "liquido") {
            folhaData.liquido = normalizeMoney(value);
          } else if (field === "arq_upag") {
            folhaData.arqUpag = String(value || "").trim() || null;
          } else if (field === "exc_qtd") {
            const qtd = parseInt(String(value || "0"), 10);
            folhaData.excQtd = isNaN(qtd) ? null : qtd;
          } else if (field === "exc_soma") {
            folhaData.excSoma = normalizeMoney(value);
          } else if (field === "rjur") {
            folhaData.rjur = String(value || "").trim() || null;
          } else if (field === "margem") {
            folhaData.margem = normalizeMoney(value);
          } else if (field.startsWith("margem_")) {
            const parts = field.split("_");
            let camelField = parts[0];
            for (let j = 1; j < parts.length; j++) {
              camelField +=
                parts[j].charAt(0).toUpperCase() + parts[j].slice(1);
            }
            folhaData[camelField] = parseNum(value);
          } else if (field.startsWith("telefone_")) {
            const tel = String(value || "").trim();
            if (tel && !tel.includes("E+")) telefones.push(tel);
          }
          // ESTADUAL-SPECIFIC FIELDS
          else if (field === "cargo" || field === "funcao") {
            if (!pessoaData.extrasVinculo) pessoaData.extrasVinculo = {};
            pessoaData.extrasVinculo[field] = String(value || "").trim() || null;
          } else if (field === "natureza") {
            pessoaData.natureza = String(value || "").trim() || null;
          } else if (field === "sexo" || field === "cep" || field === "nome_mae") {
            if (!pessoaData.extrasPessoa) pessoaData.extrasPessoa = {};
            pessoaData.extrasPessoa[field] = String(value || "").trim() || null;
          } else if (field === "endereco" || field === "numero" || field === "bairro") {
            if (!pessoaData.extrasPessoa) pessoaData.extrasPessoa = {};
            pessoaData.extrasPessoa[field] = String(value || "").trim() || null;
          }
          else if (field === "banco_emprestimo") {
            contratoData.banco = String(value || "").trim() || null;
          } else if (field === "valor_parcela") {
            contratoData.valorParcela = parseNum(value);
          } else if (field === "saldo_devedor") {
            contratoData.saldoDevedor = parseNum(value);
          } else if (field === "prazo_remanescente") {
            const prazo = parseInt(String(value || "0"), 10);
            contratoData.parcelasRestantes = isNaN(prazo) ? null : prazo;
          } else if (field === "numero_contrato") {
            contratoData.numeroContrato = String(value || "").trim() || null;
          } else if (field === "tipo_produto") {
            contratoData.tipoContrato = String(value || "").trim() || null;
          }
          // Campo específico de Pensionista - salvar separadamente para extrasVinculo
          else if (field === "instituidor") {
            const instituidorRaw = String(value || "").trim();
            folhaData.instituidor = instituidorRaw || null;
            if (instituidorRaw) {
              console.log(
                `[Import-BG] instituidorNormalizado=${instituidorRaw} (linha ${i + 1})`,
              );
            }
          }
        }

        pessoaData.telefonesBase = telefones;

        // Se for pensionista, salvar instituidor em extrasVinculo
        if (folhaData.instituidor && detectedLayout === "pensionista") {
          pessoaData.extrasVinculo = {
            ...(pessoaData.extrasVinculo || {}),
            instituidor: folhaData.instituidor,
            layoutDetectado: "pensionista",
          };
        }

        // CRÍTICO: Buscar pessoa por CPF (não matrícula) - CPF é único por pessoa
        // Vínculos são criados separadamente (tenant + cpf + matricula + orgao)
        const effectiveTenantIdBg = tenantId || 1;
        const cpf = pessoaData.cpf
          ? String(pessoaData.cpf).replace(/\D/g, "").padStart(11, "0")
          : null;

        let pessoa: any = null;
        if (cpf) {
          // Primeiro verificar o cache local (evita duplicatas na mesma importação)
          if (processedPessoas.has(cpf)) {
            pessoa = processedPessoas.get(cpf);
          } else {
            // Buscar no banco de dados (filtered by tenant)
            const pessoasEncontradas = await storage.getClientesByCpf(cpf);
            pessoa = pessoasEncontradas[0];
          }
        }

        if (pessoa) {
          // Merge extrasVinculo existente com o novo
          if (pessoaData.extrasVinculo && pessoa.extrasVinculo) {
            pessoaData.extrasVinculo = {
              ...(pessoa.extrasVinculo as object),
              ...pessoaData.extrasVinculo,
            };
          }
          pessoa = await storage.updateClientePessoa(
            pessoa.id,
            pessoaData as any,
          );
        } else {
          pessoa = await storage.createClientePessoa(pessoaData as any);
        }

        // Adicionar ao cache local
        if (cpf && pessoa) {
          processedPessoas.set(cpf, { id: pessoa.id });
        }

        if (pessoa) {
          // Criar/atualizar vínculo (tenant + cpf + matricula + orgao)
          const orgao = pessoaData.orgaodesc || "DESCONHECIDO";
          const effectiveTenantIdVinculo = tenantId || 1;

          // Upsert vínculo via SQL direto para garantir consistência
          const vinculoResult = await db.execute(sql`
            INSERT INTO clientes_vinculo (tenant_id, cpf, matricula, orgao, convenio, pessoa_id, upag, sit_func, import_run_id, base_tag)
            VALUES (
              ${effectiveTenantIdVinculo}::integer,
              ${pessoaData.cpf || null},
              ${matricula},
              ${orgao},
              ${convenio},
              ${pessoa.id},
              ${pessoaData.upag || null},
              ${pessoaData.sitFunc || null},
              ${importRunId || null},
              ${baseTag}
            )
            ON CONFLICT (cpf, matricula, orgao) DO UPDATE SET
              tenant_id = COALESCE(clientes_vinculo.tenant_id, EXCLUDED.tenant_id),
              pessoa_id = COALESCE(EXCLUDED.pessoa_id, clientes_vinculo.pessoa_id),
              upag = COALESCE(EXCLUDED.upag, clientes_vinculo.upag),
              sit_func = COALESCE(EXCLUDED.sit_func, clientes_vinculo.sit_func),
              import_run_id = ${importRunId || null},
              base_tag = ${baseTag},
              ultima_atualizacao = NOW()
            RETURNING id
          `);

          const vinculoId = (vinculoResult.rows as any[])?.[0]?.id || null;

          // Regra do teto de 70%: null = sem margem = zera as parciais; negativo = sem cap; >= 0 = aplica LEAST
          const _saldo70a = folhaData.margem70Saldo != null ? Number(folhaData.margem70Saldo) : null;
          const _cap70a = (v: number | string | null | undefined): number | null | undefined => {
            if (_saldo70a == null) return 0; // null → forçar zero explicitamente
            if (_saldo70a >= 0 && v != null) return Math.min(Number(v), _saldo70a);
            return v as number | null | undefined; // negativo → sem cap
          };
          // Upsert folha com merge de extrasFolha para preservar instituidor
          await storage.upsertClienteFolhaMes({
            pessoaId: pessoa.id,
            vinculoId: vinculoId,
            competencia: competenciaDate,
            // Margem 5%
            margemBruta5: folhaData.margem5Bruta,
            margemUtilizada5: folhaData.margem5Utilizada,
            margemSaldo5: _cap70a(folhaData.margem5Saldo),
            // Margem Benefício 5%
            margemBeneficioBruta5: folhaData.margemBeneficio5Bruta,
            margemBeneficioUtilizada5: folhaData.margemBeneficio5Utilizada,
            margemBeneficioSaldo5: _cap70a(folhaData.margemBeneficio5Saldo),
            // Margem 35%
            margemBruta35: folhaData.margem35Bruta,
            margemUtilizada35: folhaData.margem35Utilizada,
            margemSaldo35: _cap70a(folhaData.margem35Saldo),
            // Margem 70%
            margemBruta70: folhaData.margem70Bruta,
            margemUtilizada70: folhaData.margem70Utilizada,
            margemSaldo70: folhaData.margem70Saldo,
            // Cartões
            margemCartaoCreditoSaldo: folhaData.margemCartaoCreditoSaldo,
            margemCartaoBeneficioSaldo: folhaData.margemCartaoBeneficioSaldo,
            // Rendimentos
            salarioBruto: folhaData.salarioBruto || null,
            descontosBrutos: folhaData.descontosBrutos || null,
            salarioLiquido: folhaData.salarioLiquido || null,
            creditos: folhaData.creditos || null,
            debitos: folhaData.debitos || null,
            liquido: folhaData.liquido || null,
            sitFuncNoMes: pessoaData.sitFunc || null,
            baseTag,
            importRunId: importRunId || null, // Rastreabilidade obrigatória
            excQtd: folhaData.excQtd ?? null,
            excSoma: folhaData.excSoma ?? null,
            // Extras para pensionista (instituidor)
            extrasFolha: folhaData.instituidor
              ? {
                  instituidor: folhaData.instituidor,
                  layoutDetectado: detectedLayout,
                }
              : null,
          } as any);

          if (
            contratoData.banco ||
            contratoData.valorParcela ||
            contratoData.numeroContrato
          ) {
            const contratosExistentes = await storage.getContratosByPessoaId(
              pessoa.id,
            );

            const contratoExistente = contratosExistentes.find(
              (c) =>
                c.numeroContrato === contratoData.numeroContrato &&
                contratoData.numeroContrato,
            );

            if (contratoExistente) {
              const updateData: Record<string, any> = {
                baseTag,
                importRunId: importRunId || null,
                dadosBrutos: row,
              };
              if (contratoData.tipoContrato)
                updateData.tipoContrato = contratoData.tipoContrato;
              if (contratoData.banco) updateData.banco = contratoData.banco;
              if (contratoData.valorParcela !== null)
                updateData.valorParcela = contratoData.valorParcela;
              if (contratoData.saldoDevedor !== null)
                updateData.saldoDevedor = contratoData.saldoDevedor;
              if (contratoData.parcelasRestantes !== null)
                updateData.parcelasRestantes = contratoData.parcelasRestantes;
              updateData.competencia = competenciaDate;

              await storage.updateClienteContrato(
                contratoExistente.id,
                updateData as any,
              );
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
                importRunId: importRunId || null,
                dadosBrutos: row,
              } as any);
            }
          }

          totalLinhas++;
        }

        // Log progress every 1000 rows for large files
        if ((i + 1) % 1000 === 0) {
          console.log(
            `[Import-BG] Processed ${i + 1}/${data.length} rows, imported ${totalLinhas}`,
          );
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

    // Update import_run status to completed (if importRunId provided)
    if (importRunId) {
      await db
        .update(importRuns)
        .set({
          status: "concluido",
          completedAt: new Date(),
          processedRows: totalLinhas,
          successRows: totalLinhas,
        })
        .where(eq(importRuns.id, importRunId));
    }

    console.log(
      `[Import-BG] Base ${baseId} (importRun ${importRunId}) completed with ${totalLinhas} rows`,
    );
  }

  // GET bases importadas - Master only
  app.get(
    "/api/bases",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const bases = await storage.getAllBasesImportadas();
        return res.json(bases);
      } catch (error) {
        console.error("Get bases error:", error);
        return res.status(500).json({ message: "Erro ao buscar bases" });
      }
    },
  );

  // DELETE base importada - Master only
  app.delete(
    "/api/bases/:id",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req: any, res) => {
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

        // tenantId derivado do usuário autenticado via requireAuth
        const userTenantId = req.tenantId;

        console.log(
          `[Delete Base] User ${req.user?.id} (${req.user?.email}) deleting base ${id}: ${base.nome} (baseTenant: ${base.tenantId}, userTenant: ${userTenantId}, status: ${base.status}, importRunId: ${base.importRunId})`,
        );

        // Verificar se usuário tem acesso ao tenant da base
        if (base.tenantId && userTenantId && base.tenantId !== userTenantId) {
          return res
            .status(403)
            .json({ message: "Acesso negado - base pertence a outro tenant" });
        }

        // Delete base and all related data - transacional com isolamento por tenant
        // Storage deriva tenantId da base, não confiamos em parâmetro
        const result = await storage.deleteBaseImportada(
          id,
          base.baseTag,
          userTenantId,
          base.importRunId,
        );

        console.log(
          `[Delete Base] Completed: ${result.deletedFolhas} folhas, ${result.deletedContratos} contratos, ${result.deletedVinculos} vinculos, ${result.deletedContacts} contacts, ${result.deletedPessoas} pessoas removed`,
        );

        return res.json({
          message: "Base e dados associados excluídos com sucesso",
          deleted: {
            folhas: result.deletedFolhas,
            contratos: result.deletedContratos,
            vinculos: result.deletedVinculos,
            contacts: result.deletedContacts,
            pessoas: result.deletedPessoas,
          },
        });
      } catch (error) {
        console.error("Delete base error:", error);
        return res.status(500).json({ message: "Erro ao excluir base" });
      }
    },
  );

  // GET dashboard de métricas da base de clientes
  app.get(
    "/api/bases/dashboard",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req: any, res) => {
      try {
        const tenantId = req.tenantId;

        // OTIMIZADO: Query única para obter competências
        const competenciasResult = await db.execute(sql`
        SELECT DISTINCT f.competencia 
        FROM clientes_folha_mes f
        WHERE EXISTS (
          SELECT 1 FROM clientes_vinculo v 
          WHERE v.id = f.vinculo_id AND v.tenant_id = ${tenantId}
        )
        ORDER BY f.competencia DESC
        LIMIT 2
      `);

        const competencias = competenciasResult.rows.map(
          (r: any) => r.competencia,
        );

        if (competencias.length < 2) {
          return res.json({
            metricas: {
              totalClientes: 0,
              clientesNovos: 0,
              aumentoMargem: 0,
              diminuicaoMargem: 0,
              aumentoSalario: 0,
              clientesPorBanco: {},
              faixasMargem: {},
            },
            competenciaAtual: competencias[0] || null,
            competenciaAnterior: null,
            mensagem:
              "Necessário ter pelo menos 2 competências para comparação",
          });
        }

        const [compAtual, compAnterior] = competencias;

        // OTIMIZADO: Query única agregada para todas as métricas
        const metricasResult = await db.execute(sql`
        WITH folha_atual AS (
          SELECT f.pessoa_id, f.margem_saldo_70, f.salario_bruto
          FROM clientes_folha_mes f
          WHERE f.competencia = ${compAtual}
            AND EXISTS (SELECT 1 FROM clientes_vinculo v WHERE v.id = f.vinculo_id AND v.tenant_id = ${tenantId})
        ),
        folha_anterior AS (
          SELECT f.pessoa_id, f.margem_saldo_70, f.salario_bruto
          FROM clientes_folha_mes f
          WHERE f.competencia = ${compAnterior}
            AND EXISTS (SELECT 1 FROM clientes_vinculo v WHERE v.id = f.vinculo_id AND v.tenant_id = ${tenantId})
        ),
        comparacao AS (
          SELECT 
            a.pessoa_id,
            COALESCE(a.margem_saldo_70, 0) as margem_atual,
            COALESCE(b.margem_saldo_70, 0) as margem_anterior,
            COALESCE(a.salario_bruto, 0) as salario_atual,
            COALESCE(b.salario_bruto, 0) as salario_anterior,
            CASE WHEN b.pessoa_id IS NULL THEN 1 ELSE 0 END as is_novo
          FROM folha_atual a
          LEFT JOIN folha_anterior b ON a.pessoa_id = b.pessoa_id
        )
        SELECT 
          COUNT(*) as total_clientes,
          SUM(is_novo) as clientes_novos,
          SUM(CASE WHEN margem_anterior > 0 AND margem_atual > margem_anterior THEN 1 ELSE 0 END) as aumento_margem,
          SUM(CASE WHEN margem_anterior > 0 AND margem_atual < margem_anterior THEN 1 ELSE 0 END) as diminuicao_margem,
          SUM(CASE WHEN salario_anterior > 0 AND salario_atual > salario_anterior AND (salario_atual - salario_anterior) > 50 THEN 1 ELSE 0 END) as aumento_salario
        FROM comparacao
      `);

        const metricas = metricasResult.rows[0] || {};
        const totalClientes = parseInt(metricas.total_clientes || "0");
        const clientesNovos = parseInt(metricas.clientes_novos || "0");
        const aumentoMargem = parseInt(metricas.aumento_margem || "0");
        const diminuicaoMargem = parseInt(metricas.diminuicao_margem || "0");
        const aumentoSalario = parseInt(metricas.aumento_salario || "0");

        // OTIMIZADO: Faixas de margem com subquery simples
        const faixasMargemResult = await db.execute(sql`
        SELECT 
          CASE 
            WHEN COALESCE(f.margem_saldo_70, 0) = 0 THEN 'Sem margem'
            WHEN COALESCE(f.margem_saldo_70, 0) < 500 THEN 'Até R$ 500'
            WHEN COALESCE(f.margem_saldo_70, 0) < 1000 THEN 'R$ 500-1.000'
            WHEN COALESCE(f.margem_saldo_70, 0) < 2000 THEN 'R$ 1.000-2.000'
            ELSE 'Acima de R$ 2.000'
          END as faixa,
          COUNT(*) as total
        FROM clientes_folha_mes f
        WHERE f.competencia = ${compAtual}
          AND EXISTS (SELECT 1 FROM clientes_vinculo v WHERE v.id = f.vinculo_id AND v.tenant_id = ${tenantId})
        GROUP BY 1
        ORDER BY MIN(COALESCE(f.margem_saldo_70, 0))
      `);

        // OTIMIZADO: Top 10 bancos usando subquery
        const bancosResult = await db.execute(sql`
        SELECT 
          COALESCE(p.banco_nome, 'NÃO INFORMADO') as banco,
          COUNT(DISTINCT f.pessoa_id) as total
        FROM clientes_folha_mes f
        JOIN clientes_pessoa p ON p.id = f.pessoa_id
        WHERE f.competencia = ${compAtual}
          AND EXISTS (SELECT 1 FROM clientes_vinculo v WHERE v.id = f.vinculo_id AND v.tenant_id = ${tenantId})
        GROUP BY p.banco_nome
        ORDER BY total DESC
        LIMIT 10
      `);

        const clientesPorBanco: Record<string, number> = {};
        bancosResult.rows.forEach((r: any) => {
          clientesPorBanco[r.banco] = parseInt(r.total);
        });

        const faixasMargem: Record<string, number> = {};
        faixasMargemResult.rows.forEach((r: any) => {
          faixasMargem[r.faixa] = parseInt(r.total);
        });

        return res.json({
          metricas: {
            totalClientes,
            clientesNovos,
            aumentoMargem,
            diminuicaoMargem,
            aumentoSalario,
            clientesPorBanco,
            faixasMargem,
          },
          competenciaAtual: compAtual,
          competenciaAnterior: compAnterior,
        });
      } catch (error) {
        console.error("Dashboard error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao calcular métricas do dashboard" });
      }
    },
  );

  // POST importar base - Master only - Background processing for large files
  app.post(
    "/api/bases/import",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    upload.single("arquivo"),
    async (req, res) => {
      try {
        const file = req.file;
        const { convenio, competencia, nome_base, template } = req.body;
        const isEstadual = template === "estadual";

        if (!file || !convenio || !competencia) {
          return res.status(400).json({
            message: "Arquivo, convênio e competência são obrigatórios",
          });
        }

        const fileSizeMB = file.size / 1024 / 1024;
        console.log(
          `[Import] Received file: ${file.originalname}, size: ${fileSizeMB.toFixed(2)} MB`,
        );

        // Parse competencia to date (format: YYYY-MM)
        const [year, month] = competencia.split("-");
        const competenciaDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          1,
        );

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

        // Criar import_run para rastreabilidade obrigatória
        const [importRunRecord] = await db
          .insert(importRuns)
          .values({
            tenantId: null,
            tipoImport: "base_geral",
            competencia: competenciaDate,
            arquivoOrigem: file.originalname,
            status: "processando",
            baseTag,
            convenio,
          })
          .returning();

        // Vincular import_run à base
        await storage.updateBaseImportada(base.id, {
          importRunId: importRunRecord.id,
        });

        console.log(
          `[Import] Created base ${base.id} with importRun ${importRunRecord.id} and tag ${baseTag}`,
        );

        // Parse file - use PapaParse for CSV (much faster for large files)
        const ext = path.extname(file.originalname).toLowerCase();
        let data: any[] = [];

        if (ext === ".csv") {
          console.log(`[Import] Parsing CSV with PapaParse... (template: ${isEstadual ? 'estadual' : 'federal'})`);
          const csvString = file.buffer.toString("utf-8");
          const parsed = Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true,
            delimiter: isEstadual ? ";" : "", // estadual uses ;, federal auto-detect
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
          console.log(
            `[Import] Large file detected (${data.length} rows), processing in background...`,
          );

          // Return immediately for large files
          res.json({
            message: "Importação iniciada em segundo plano",
            baseId: base.id,
            importRunId: importRunRecord.id,
            baseTag,
            status: "processando",
            totalRows: data.length,
            fileName: file.originalname,
            isBackground: true,
          });

          // Process in background (don't await) - passa importRunId para rastreabilidade
          processImportInBackground(
            data,
            base.id,
            baseTag,
            convenio,
            competenciaDate,
            null,
            importRunRecord.id,
            template,
          ).catch((err) => {
            console.error(`[Import] Background processing error:`, err);
          });

          return;
        }

        // Build header mapping
        const headers = data[0] ? Object.keys(data[0]) : [];
        const headerMap: Record<string, string> = {};
        const activeColumnMap = isEstadual ? ESTADUAL_COLUMN_MAP : COLUMN_MAP;

        for (const header of headers) {
          const normalized = normalizeCol(header);
          if (activeColumnMap[normalized]) {
            headerMap[header] = activeColumnMap[normalized];
          }
          if (isEstadual) {
            const trimmed = header.trim();
            if (ESTADUAL_COLUMN_MAP[trimmed]) {
              headerMap[header] = ESTADUAL_COLUMN_MAP[trimmed];
            }
          }
        }

        if (isEstadual) {
          console.log(`[Import] Using ESTADUAL template, mapped columns: ${Object.keys(headerMap).length}`);
        }

        // Detecta automaticamente o layout (Servidor ou Pensionista)
        const detectedLayout = isEstadual ? "servidor" as FolhaLayoutType : detectFolhaLayout(headers);
        console.log(
          `[Import] Layout detectado: ${detectedLayout.toUpperCase()} (baseId: ${base.id})`,
        );
        console.log(`[Import] Mapped columns:`, Object.keys(headerMap).length);

        let totalLinhas = 0;

        // Cache local de pessoas processadas para evitar duplicatas na mesma importação
        const processedPessoas = new Map<string, { id: number }>();

        // Process each row
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            // Extract matricula (required for federal; synthetic for estadual)
            let matricula: string | null = null;
            if (isEstadual) {
              let cpfRaw: string | null = null;
              for (const [col, field] of Object.entries(headerMap)) {
                if (field === "cpf") {
                  cpfRaw = String(row[col] || "").replace(/\D/g, "").trim();
                  break;
                }
              }
              if (!cpfRaw || cpfRaw.length < 5) continue;
              matricula = `EST_${cpfRaw.padStart(11, "0")}`;
            } else {
              for (const [col, field] of Object.entries(headerMap)) {
                if (field === "matricula") {
                  matricula = String(row[col] || "").trim();
                  break;
                }
              }
              if (!matricula) continue;
            }

            // Build pessoa data
            const pessoaData: Record<string, any> = {
              matricula,
              convenio,
              baseTagUltima: baseTag,
              importRunId: importRunRecord.id, // Rastreabilidade obrigatória
            };

            // Build folha data
            const folhaData: Record<string, any> = {
              competencia: competenciaDate,
              baseTag,
              importRunId: importRunRecord.id, // Rastreabilidade obrigatória
            };

            // Build telefones array
            const telefones: string[] = [];

            // Build contrato data
            const contratoData: Record<string, any> = {
              competencia: competenciaDate,
              baseTag,
              importRunId: importRunRecord.id, // Rastreabilidade obrigatória
            };

            // Map row values
            for (const [col, value] of Object.entries(row)) {
              const field = headerMap[col];

              if (!field) continue;

              // PESSOA FIELDS
              if (
                [
                  "cpf",
                  "nome",
                  "orgaodesc",
                  "sit_func",
                  "uf",
                  "municipio",
                  "email",
                ].includes(field)
              ) {
                const key = field === "sit_func" ? "sitFunc" : field;
                pessoaData[key] = String(value || "").trim() || null;
              } else if (field === "banco_salario") {
                pessoaData.bancoCodigo = String(value || "").trim() || null;
              } else if (field === "agencia_salario") {
                pessoaData.agencia = String(value || "").trim() || null;
              } else if (field === "conta_salario") {
                pessoaData.conta = String(value || "").trim() || null;
              } else if (field === "upag") {
                pessoaData.upag = String(value || "").trim() || null;
              } else if (field === "data_nascimento") {
                pessoaData.dataNascimento = parseDate(value);
              } else if (field === "idade") {
                // Idade ignorada para persistência (calculamos a partir da data de nascimento)
                // Mas podemos salvar no extras_pessoa se quisermos
              }
              // RENDIMENTOS (campos monetários - usam normalizeMoney)
              else if (field === "salario_bruto") {
                folhaData.salarioBruto = normalizeMoney(value);
              } else if (field === "descontos_brutos") {
                folhaData.descontosBrutos = normalizeMoney(value);
              } else if (field === "salario_liquido") {
                folhaData.salarioLiquido = normalizeMoney(value);
              }
              // Novos campos do template Folha Servidor oficial
              else if (field === "base_calc") {
                folhaData.baseCalc = normalizeMoney(value);
              } else if (field === "creditos") {
                folhaData.creditos = normalizeMoney(value);
              } else if (field === "debitos") {
                folhaData.debitos = normalizeMoney(value);
              } else if (field === "liquido") {
                folhaData.liquido = normalizeMoney(value);
              } else if (field === "arq_upag") {
                folhaData.arqUpag = String(value || "").trim() || null;
              } else if (field === "exc_qtd") {
                const qtd = parseInt(String(value || "0"), 10);
                folhaData.excQtd = isNaN(qtd) ? null : qtd;
              } else if (field === "exc_soma") {
                folhaData.excSoma = normalizeMoney(value);
              } else if (field === "rjur") {
                folhaData.rjur = String(value || "").trim() || null;
              } else if (field === "margem") {
                folhaData.margem = normalizeMoney(value);
              }
              // FOLHA FIELDS (margens) - usam parseNum para permitir nulos
              else if (field.startsWith("margem_")) {
                const parts = field.split("_");
                let camelField = parts[0];
                for (let j = 1; j < parts.length; j++) {
                  camelField +=
                    parts[j].charAt(0).toUpperCase() + parts[j].slice(1);
                }
                folhaData[camelField] = parseNum(value);
              }
              // TELEFONES
              else if (field.startsWith("telefone_")) {
                const tel = String(value || "").trim();
                if (tel && !tel.includes("E+")) telefones.push(tel);
              }
              // ESTADUAL-SPECIFIC FIELDS
              else if (field === "cargo" || field === "funcao") {
                if (!pessoaData.extrasVinculo) pessoaData.extrasVinculo = {};
                pessoaData.extrasVinculo[field] = String(value || "").trim() || null;
              } else if (field === "natureza") {
                pessoaData.natureza = String(value || "").trim() || null;
              } else if (field === "sexo" || field === "cep" || field === "nome_mae") {
                if (!pessoaData.extrasPessoa) pessoaData.extrasPessoa = {};
                pessoaData.extrasPessoa[field] = String(value || "").trim() || null;
              } else if (field === "endereco" || field === "numero" || field === "bairro") {
                if (!pessoaData.extrasPessoa) pessoaData.extrasPessoa = {};
                pessoaData.extrasPessoa[field] = String(value || "").trim() || null;
              }
              // CONTRATO FIELDS
              else if (field === "banco_emprestimo") {
                contratoData.banco = String(value || "").trim() || null;
              } else if (field === "valor_parcela") {
                contratoData.valorParcela = parseNum(value);
              } else if (field === "saldo_devedor") {
                contratoData.saldoDevedor = parseNum(value);
              } else if (field === "prazo_remanescente") {
                const prazo = parseInt(String(value || "0"), 10);
                contratoData.parcelasRestantes = isNaN(prazo) ? null : prazo;
              } else if (field === "numero_contrato") {
                contratoData.numeroContrato =
                  String(value || "").trim() || null;
              } else if (field === "tipo_produto") {
                contratoData.tipoContrato = String(value || "").trim() || null;
              }
              // Campo específico de Pensionista - salvar separadamente para extrasFolha
              else if (field === "instituidor") {
                const instituidorRaw = String(value || "").trim();
                folhaData.instituidor = instituidorRaw || null;
                if (instituidorRaw) {
                  console.log(
                    `[Import] instituidorNormalizado=${instituidorRaw} (linha ${i + 1})`,
                  );
                }
              }
            }

            pessoaData.telefonesBase = telefones;

            // Se for pensionista, salvar instituidor em extrasVinculo
            if (folhaData.instituidor && detectedLayout === "pensionista") {
              pessoaData.extrasVinculo = {
                ...(pessoaData.extrasVinculo || {}),
                instituidor: folhaData.instituidor,
                layoutDetectado: "pensionista",
              };
            }

            // CRÍTICO: Buscar pessoa por CPF (não matrícula) - CPF é único por pessoa
            // Vínculos são criados separadamente (tenant + cpf + matricula + orgao)
            const effectiveTenantIdSync = base.tenantId || 1;
            const cpf = pessoaData.cpf
              ? String(pessoaData.cpf).replace(/\D/g, "").padStart(11, "0")
              : null;

            let pessoa: any = null;
            if (cpf) {
              // Primeiro verificar o cache local (evita duplicatas na mesma importação)
              if (processedPessoas.has(cpf)) {
                pessoa = processedPessoas.get(cpf);
              } else {
                // Buscar no banco de dados (filtered by tenant)
                const pessoasEncontradas = await storage.getClientesByCpf(cpf);
                pessoa = pessoasEncontradas[0];
              }
            }

            if (pessoa) {
              // Merge extrasVinculo existente com o novo
              if (pessoaData.extrasVinculo && pessoa.extrasVinculo) {
                pessoaData.extrasVinculo = {
                  ...(pessoa.extrasVinculo as object),
                  ...pessoaData.extrasVinculo,
                };
              }
              pessoa = await storage.updateClientePessoa(
                pessoa.id,
                pessoaData as any,
              );
            } else {
              pessoa = await storage.createClientePessoa(pessoaData as any);
            }

            // Adicionar ao cache local
            if (cpf && pessoa) {
              processedPessoas.set(cpf, { id: pessoa.id });
            }

            if (pessoa) {
              // Criar/atualizar vínculo (tenant + cpf + matricula + orgao)
              const orgao = pessoaData.orgaodesc || "DESCONHECIDO";
              const effectiveTenantId = base.tenantId || 1;

              // Upsert vínculo via SQL direto para garantir consistência
              const vinculoResult = await db.execute(sql`
              INSERT INTO clientes_vinculo (tenant_id, cpf, matricula, orgao, convenio, pessoa_id, upag, sit_func, import_run_id, base_tag)
              VALUES (
                ${effectiveTenantId}::integer,
                ${pessoaData.cpf || null},
                ${matricula},
                ${orgao},
                ${convenio},
                ${pessoa.id},
                ${pessoaData.upag || null},
                ${pessoaData.sitFunc || null},
                ${importRunRecord.id},
                ${baseTag}
              )
              ON CONFLICT (cpf, matricula, orgao) DO UPDATE SET
                tenant_id = COALESCE(clientes_vinculo.tenant_id, EXCLUDED.tenant_id),
                pessoa_id = COALESCE(EXCLUDED.pessoa_id, clientes_vinculo.pessoa_id),
                upag = COALESCE(EXCLUDED.upag, clientes_vinculo.upag),
                sit_func = COALESCE(EXCLUDED.sit_func, clientes_vinculo.sit_func),
                import_run_id = ${importRunRecord.id},
                base_tag = ${baseTag},
                ultima_atualizacao = NOW()
              RETURNING id
            `);

              const vinculoId = (vinculoResult.rows as any[])?.[0]?.id || null;

              // Regra do teto de 70%: null = sem margem = zera as parciais; negativo = sem cap; >= 0 = aplica LEAST
              const _saldo70b = folhaData.margem70Saldo != null ? Number(folhaData.margem70Saldo) : null;
              const _cap70b = (v: number | string | null | undefined): number | null | undefined => {
                if (_saldo70b == null) return 0; // null → forçar zero explicitamente
                if (_saldo70b >= 0 && v != null) return Math.min(Number(v), _saldo70b);
                return v as number | null | undefined; // negativo → sem cap
              };
              // Upsert folha com merge de extrasFolha para preservar instituidor
              await storage.upsertClienteFolhaMes({
                pessoaId: pessoa.id,
                vinculoId: vinculoId,
                competencia: competenciaDate,
                // Margem 5%
                margemBruta5: folhaData.margem5Bruta,
                margemUtilizada5: folhaData.margem5Utilizada,
                margemSaldo5: _cap70b(folhaData.margem5Saldo),
                // Margem Benefício 5%
                margemBeneficioBruta5: folhaData.margemBeneficio5Bruta,
                margemBeneficioUtilizada5: folhaData.margemBeneficio5Utilizada,
                margemBeneficioSaldo5: _cap70b(folhaData.margemBeneficio5Saldo),
                // Margem 35%
                margemBruta35: folhaData.margem35Bruta,
                margemUtilizada35: folhaData.margem35Utilizada,
                margemSaldo35: _cap70b(folhaData.margem35Saldo),
                // Margem 70%
                margemBruta70: folhaData.margem70Bruta,
                margemUtilizada70: folhaData.margem70Utilizada,
                margemSaldo70: folhaData.margem70Saldo,
                // Cartões
                margemCartaoCreditoSaldo: folhaData.margemCartaoCreditoSaldo,
                margemCartaoBeneficioSaldo:
                  folhaData.margemCartaoBeneficioSaldo,
                // Rendimentos
                salarioBruto: folhaData.salarioBruto || null,
                descontosBrutos: folhaData.descontosBrutos || null,
                salarioLiquido: folhaData.salarioLiquido || null,
                creditos: folhaData.creditos || null,
                debitos: folhaData.debitos || null,
                liquido: folhaData.liquido || null,
                sitFuncNoMes: pessoaData.sitFunc || null,
                baseTag,
                importRunId: importRunRecord.id, // Rastreabilidade obrigatória
                excQtd: folhaData.excQtd ?? null,
                excSoma: folhaData.excSoma ?? null,
                // Extras para pensionista (instituidor)
                extrasFolha: folhaData.instituidor
                  ? {
                      instituidor: folhaData.instituidor,
                      layoutDetectado: detectedLayout,
                    }
                  : null,
              } as any);

              // UPSERT contrato: atualiza se existir (mesmo numero_contrato), senão cria novo
              if (
                contratoData.banco ||
                contratoData.valorParcela ||
                contratoData.numeroContrato
              ) {
                const contratosExistentes =
                  await storage.getContratosByPessoaId(pessoa.id);

                // Busca contrato existente pelo numero_contrato (chave única por pessoa)
                const contratoExistente = contratosExistentes.find(
                  (c) =>
                    c.numeroContrato === contratoData.numeroContrato &&
                    contratoData.numeroContrato,
                );

                if (contratoExistente) {
                  // ATUALIZAR contrato existente com novos dados (preserva pessoaId, atualiza só campos relevantes)
                  const updateData: Record<string, any> = {
                    baseTag,
                    importRunId: importRunRecord.id,
                    dadosBrutos: row,
                  };
                  // Só atualiza campos se tiverem valores na planilha
                  if (contratoData.tipoContrato)
                    updateData.tipoContrato = contratoData.tipoContrato;
                  if (contratoData.banco) updateData.banco = contratoData.banco;
                  if (contratoData.valorParcela !== null)
                    updateData.valorParcela = contratoData.valorParcela;
                  if (contratoData.saldoDevedor !== null)
                    updateData.saldoDevedor = contratoData.saldoDevedor;
                  if (contratoData.parcelasRestantes !== null)
                    updateData.parcelasRestantes =
                      contratoData.parcelasRestantes;
                  // Atualiza competência só se for mais recente
                  updateData.competencia = competenciaDate;

                  await storage.updateClienteContrato(
                    contratoExistente.id,
                    updateData as any,
                  );
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
                    importRunId: importRunRecord.id,
                    dadosBrutos: row,
                  } as any);
                }
              }

              totalLinhas++;
            }

            // Log progress every 500 rows
            if ((i + 1) % 500 === 0) {
              console.log(
                `[Import] Processed ${i + 1}/${data.length} rows, imported ${totalLinhas}`,
              );
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

        // Update import_run status to completed
        await db
          .update(importRuns)
          .set({
            status: "concluido",
            completedAt: new Date(),
            processedRows: totalLinhas,
            successRows: totalLinhas,
          })
          .where(eq(importRuns.id, importRunRecord.id));

        console.log(
          `[Import] Base ${base.id} (importRun ${importRunRecord.id}) completed with ${totalLinhas} rows`,
        );

        return res.json({
          message: "Importação concluída",
          baseId: base.id,
          importRunId: importRunRecord.id,
          baseTag,
          totalLinhas,
          fileName: file.originalname,
        });
      } catch (error) {
        console.error("Import error:", error);
        return res.status(500).json({ message: "Erro ao importar base" });
      }
    },
  );

  // ===== CONVENIOS (LISTA PADRONIZADA POR TENANT) =====

  // GET lista de convênios do tenant
  app.get("/api/convenios", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId || 1;
      const conveniosList = await storage.getConvenios(tenantId);
      return res.json(conveniosList);
    } catch (error) {
      console.error("Get convenios error:", error);
      return res.status(500).json({ message: "Erro ao buscar convênios" });
    }
  });

  // POST criar/atualizar convênio - uses Zod schema for validation
  app.post("/api/convenios", requireAuth, async (req: any, res) => {
    try {
      const { normalizeConvenio } = await import("@shared/utils");
      const { insertConvenioSchema } = await import("@shared/schema");

      // Validate with Zod schema
      const parseResult = insertConvenioSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        return res.status(400).json({
          message: firstError?.message || "Dados inválidos",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const { label } = parseResult.data;
      const tenantId = req.tenantId || 1;
      const code = normalizeConvenio(label);

      // Store normalized code and user-friendly label
      const convenio = await storage.upsertConvenio(tenantId, code, label);
      return res.json(convenio);
    } catch (error) {
      console.error("Create convenio error:", error);
      return res.status(500).json({ message: "Erro ao criar convênio" });
    }
  });

  // GET status de um import run específico - MASTER ONLY
  app.get(
    "/api/import-runs/:id/status",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const { importService } = await import("./import-service");
        const runId = parseInt(req.params.id);
        const progress = await importService.getImportProgress(runId);

        if (!progress) {
          return res.status(404).json({ message: "Import run não encontrado" });
        }

        return res.json(progress);
      } catch (error) {
        console.error("Get import status error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar status do import" });
      }
    },
  );

  // GET erros de um import run - MASTER ONLY
  app.get(
    "/api/import-runs/:id/errors",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const { importService } = await import("./import-service");
        const runId = parseInt(req.params.id);
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;

        const errors = await importService.getImportErrors(
          runId,
          limit,
          offset,
        );

        return res.json({
          errors,
          count: errors.length,
          limit,
          offset,
        });
      } catch (error) {
        console.error("Get import errors error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar erros do import" });
      }
    },
  );

  // GET download de erros em CSV - MASTER ONLY
  app.get(
    "/api/import-runs/:id/errors/download",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const { importService } = await import("./import-service");
        const runId = parseInt(req.params.id);

        const errors = await importService.getImportErrors(runId, 100000, 0);

        if (errors.length === 0) {
          return res
            .status(404)
            .json({ message: "Nenhum erro encontrado para este import" });
        }

        const csvRows = [
          "linha,cpf,matricula,tipo_erro,mensagem",
          ...errors.map(
            (e: any) =>
              `${e.rowNumber},"${e.cpf || ""}","${e.matricula || ""}","${e.errorType}","${(e.errorMessage || "").replace(/"/g, '""')}"`,
          ),
        ];

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=erros_import_${runId}.csv`,
        );
        return res.send(csvRows.join("\n"));
      } catch (error) {
        console.error("Download import errors error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao baixar erros do import" });
      }
    },
  );

  // GET lista de import runs - MASTER ONLY
  // Increased limit from 50 to 1000 to show more import history
  app.get(
    "/api/import-runs",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const runs = await db
          .select()
          .from(importRuns)
          .orderBy(desc(importRuns.createdAt))
          .limit(1000);
        return res.json(runs);
      } catch (error) {
        console.error("Get import runs error:", error);
        return res.status(500).json({ message: "Erro ao buscar import runs" });
      }
    },
  );

  // GET detalhes de um import run específico
  app.get(
    "/api/import-runs/:id",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);
        const [run] = await db
          .select()
          .from(importRuns)
          .where(eq(importRuns.id, runId))
          .limit(1);

        if (!run) {
          return res.status(404).json({ message: "Import run não encontrado" });
        }

        // Buscar contadores reais de import_run_rows
        const countsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'ok') as ok_count,
          COUNT(*) FILTER (WHERE status = 'erro') as error_count
        FROM import_run_rows
        WHERE import_run_id = ${runId}
      `);

        const counts = countsResult.rows[0] as any;

        return res.json({
          ...run,
          realCounts: {
            totalRows: parseInt(counts?.total || "0"),
            successRows: parseInt(counts?.ok_count || "0"),
            errorRows: parseInt(counts?.error_count || "0"),
          },
        });
      } catch (error) {
        console.error("Get import run error:", error);
        return res.status(500).json({ message: "Erro ao buscar import run" });
      }
    },
  );

  // GET todas as linhas de um import run (com paginação)
  app.get(
    "/api/import-runs/:id/rows",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);
        const limit = Math.min(
          parseInt(req.query.limit as string) || 100,
          1000,
        );
        const offset = parseInt(req.query.offset as string) || 0;
        const statusFilter = req.query.status as string; // 'ok', 'erro', ou undefined para todos

        let query = sql`
        SELECT id, import_run_id, row_number, cpf, matricula, status, error_message, raw_data, created_at
        FROM import_run_rows
        WHERE import_run_id = ${runId}
      `;

        if (statusFilter === "ok" || statusFilter === "erro") {
          query = sql`${query} AND status = ${statusFilter}`;
        }

        query = sql`${query} ORDER BY row_number LIMIT ${limit} OFFSET ${offset}`;

        const result = await db.execute(query);

        // Contar total
        const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM import_run_rows WHERE import_run_id = ${runId}
        ${statusFilter ? sql`AND status = ${statusFilter}` : sql``}
      `);

        return res.json({
          rows: result.rows,
          total: parseInt((countResult.rows[0] as any)?.total || "0"),
          limit,
          offset,
        });
      } catch (error) {
        console.error("Get import run rows error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar linhas do import" });
      }
    },
  );

  // DELETE /api/import-runs/bulk-delete - Exclusão em massa de import runs
  // IMPORTANTE: Esta rota DEVE vir ANTES de /api/import-runs/:id para evitar conflito de roteamento
  // Processa em lotes de 10 com delay de 100ms entre lotes para não sobrecarregar o BD
  app.delete(
    "/api/import-runs/bulk-delete",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req: any, res) => {
      try {
        const { ids: rawIds } = req.body;
        const userTenantId = req.tenantId;
        const isMaster = req.user?.isMaster === true;

        console.log(
          `[BulkDelete] Received request with body:`,
          JSON.stringify(req.body),
        );

        if (!Array.isArray(rawIds) || rawIds.length === 0) {
          return res.status(400).json({ message: "IDs inválidos" });
        }

        // Converter e validar IDs para números inteiros
        const ids: number[] = [];
        for (const id of rawIds) {
          const numId = typeof id === "number" ? id : parseInt(String(id), 10);
          if (!isNaN(numId) && numId > 0) {
            ids.push(numId);
          }
        }

        if (ids.length === 0) {
          return res
            .status(400)
            .json({ message: "Nenhum ID válido fornecido" });
        }

        // Remover duplicatas
        const uniqueIds = [...new Set(ids)];

        console.log(
          `[BulkDelete] Starting bulk delete for ${uniqueIds.length} import runs: [${uniqueIds.join(", ")}] (userTenant: ${userTenantId}, isMaster: ${isMaster})...`,
        );

        const BATCH_SIZE = 10;
        const BATCH_DELAY_MS = 100;
        let deletedCount = 0;
        const errors: string[] = [];

        // Processar em lotes
        for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
          const batch = uniqueIds.slice(i, i + BATCH_SIZE);

          // Processar cada item do lote sequencialmente (para manter transação atômica por item)
          for (const runId of batch) {
            try {
              // Buscar o import_run para validação
              const [run] = await db
                .select()
                .from(importRuns)
                .where(eq(importRuns.id, runId))
                .limit(1);

              if (!run) {
                errors.push(`Import #${runId}: não encontrado`);
                continue;
              }

              // Validar tenant
              const runTenantId = run.tenantId;
              if (!isMaster && runTenantId && runTenantId !== userTenantId) {
                errors.push(
                  `Import #${runId}: sem permissão (tenant diferente)`,
                );
                continue;
              }

              const effectiveTenantId = runTenantId || userTenantId;
              const runBaseTag = run.baseTag || "";

              if (!effectiveTenantId) {
                errors.push(`Import #${runId}: tenant não identificado`);
                continue;
              }

              // Helper para executar query com retry em caso de falha de conexão
              const executeWithRetry = async (query: any, maxRetries = 3) => {
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                  try {
                    return await db.execute(query);
                  } catch (err: any) {
                    if (
                      attempt < maxRetries &&
                      err.message?.includes("fetch failed")
                    ) {
                      console.log(
                        `[BulkDelete] Retry ${attempt}/${maxRetries} for query...`,
                      );
                      await new Promise((r) => setTimeout(r, 500 * attempt)); // backoff
                      continue;
                    }
                    throw err;
                  }
                }
              };

              // Executar deletes em sequência com retry
              // 1. Deletar tabelas de staging e auxiliares (mais leves)
              await executeWithRetry(
                sql`DELETE FROM import_run_rows WHERE import_run_id = ${runId}`,
              );
              await executeWithRetry(
                sql`DELETE FROM import_errors WHERE import_run_id = ${runId}`,
              );
              await executeWithRetry(
                sql`DELETE FROM staging_folha WHERE import_run_id = ${runId}`,
              );
              await executeWithRetry(
                sql`DELETE FROM staging_d8 WHERE import_run_id = ${runId}`,
              );
              await executeWithRetry(
                sql`DELETE FROM staging_contatos WHERE import_run_id = ${runId}`,
              );

              // 2. Deletar dados de clientes vinculados ao import_run
              await executeWithRetry(sql`
              DELETE FROM clientes_folha_mes 
              WHERE import_run_id = ${runId}
                 OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            `);

              await executeWithRetry(sql`
              DELETE FROM clientes_contratos 
              WHERE import_run_id = ${runId}
                 OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            `);

              await executeWithRetry(sql`
              DELETE FROM client_contacts 
              WHERE (is_manual = false OR is_manual IS NULL)
                AND (
                  import_run_id = ${runId}
                  OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
                )
            `);

              await executeWithRetry(sql`
              DELETE FROM clientes_vinculo 
              WHERE import_run_id = ${runId}
                 OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            `);

              // 3. Deletar pessoas órfãs do tenant
              await executeWithRetry(sql`
              DELETE FROM clientes_pessoa 
              WHERE tenant_id = ${effectiveTenantId}
                AND NOT EXISTS (SELECT 1 FROM clientes_folha_mes f WHERE f.pessoa_id = clientes_pessoa.id)
                AND NOT EXISTS (SELECT 1 FROM clientes_contratos c WHERE c.pessoa_id = clientes_pessoa.id)
                AND NOT EXISTS (SELECT 1 FROM clientes_vinculo v WHERE v.pessoa_id = clientes_pessoa.id)
                AND NOT EXISTS (SELECT 1 FROM client_contacts cc WHERE cc.client_id = clientes_pessoa.id)
            `);

              // 4. Deletar o import_run
              await executeWithRetry(
                sql`DELETE FROM import_runs WHERE id = ${runId}`,
              );

              deletedCount++;
              console.log(
                `[BulkDelete] Deleted import #${runId} (${deletedCount}/${uniqueIds.length})`,
              );
            } catch (itemError: any) {
              console.error(
                `[BulkDelete] Error deleting import #${runId}:`,
                itemError.message,
              );
              errors.push(
                `Import #${runId}: ${itemError.message || "erro desconhecido"}`,
              );
            }
          }

          // Delay entre lotes (exceto o último)
          if (i + BATCH_SIZE < uniqueIds.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }

        console.log(
          `[BulkDelete] Completed: ${deletedCount} deleted, ${errors.length} errors`,
        );

        return res.json({
          success: true,
          deleted: deletedCount,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (error: any) {
        console.error("Bulk delete import runs error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao excluir importações" });
      }
    },
  );

  // DELETE excluir import run e TODOS os dados finais associados (cascata completa)
  // IMPORTANTE: Usa BOTH import_run_id E base_tag para capturar registros órfãos legados
  app.delete(
    "/api/import-runs/:id",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req: any, res) => {
      try {
        const runId = parseInt(req.params.id);
        const userTenantId = req.tenantId;
        const isMaster = req.user?.isMaster === true;

        console.log(
          `[ImportRun] Starting TRANSACTIONAL cascading delete for run ${runId} (userTenant: ${userTenantId}, isMaster: ${isMaster})...`,
        );

        // Buscar o import_run para obter tenantId e base_tag
        const [run] = await db
          .select()
          .from(importRuns)
          .where(eq(importRuns.id, runId))
          .limit(1);

        if (!run) {
          return res.status(404).json({ message: "Import run não encontrado" });
        }

        // Validar tenant: usuário master pode excluir de qualquer tenant, outros só do próprio
        const runTenantId = run.tenantId;
        if (!isMaster && runTenantId && runTenantId !== userTenantId) {
          console.error(
            `[ImportRun] ERROR: Tenant mismatch - user ${userTenantId} trying to delete run from tenant ${runTenantId}`,
          );
          return res.status(403).json({
            message: "Sem permissão para excluir importação de outro tenant",
          });
        }

        // Usar tenantId do run (sempre preferir o do run para garantir deleção correta)
        const effectiveTenantId = runTenantId || userTenantId;
        const runBaseTag = run.baseTag || "";

        if (!effectiveTenantId) {
          console.error(
            `[ImportRun] ERROR: Cannot delete run ${runId} - no tenantId found`,
          );
          return res
            .status(400)
            .json({ message: "Tenant ID obrigatório para exclusão" });
        }

        console.log(
          `[ImportRun] Effective tenant: ${effectiveTenantId}, base_tag: "${runBaseTag}"`,
        );

        // Usar uma única query SQL com CTEs para garantir atomicidade total
        // CRÍTICO: Filtra por import_run_id OU (import_run_id IS NULL AND base_tag match) para capturar órfãos
        // Isso garante que registros legados sem import_run_id também sejam deletados
        const result = await db.execute(sql`
        WITH 
        -- Identificar pessoas do tenant para isolamento
        tenant_pessoas AS (
          SELECT id FROM clientes_pessoa WHERE tenant_id = ${effectiveTenantId}
        ),
        -- 1. Deletar folhas: por import_run_id OU por base_tag (órfãos legados)
        deleted_folhas AS (
          DELETE FROM clientes_folha_mes 
          WHERE pessoa_id IN (SELECT id FROM tenant_pessoas)
            AND (
              import_run_id = ${runId}
              OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            )
          RETURNING id
        ),
        -- 2. Deletar contratos: por import_run_id OU por base_tag
        deleted_contratos AS (
          DELETE FROM clientes_contratos 
          WHERE pessoa_id IN (SELECT id FROM tenant_pessoas)
            AND (
              import_run_id = ${runId}
              OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            )
          RETURNING id
        ),
        -- 3. Deletar contacts: por import_run_id OU por base_tag
        -- IMPORTANTE: Não deletar contatos manuais (is_manual = true) - estes devem persistir
        deleted_contacts AS (
          DELETE FROM client_contacts 
          WHERE client_id IN (SELECT id FROM tenant_pessoas)
            AND (is_manual = false OR is_manual IS NULL)
            AND (
              import_run_id = ${runId}
              OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            )
          RETURNING id
        ),
        -- 4. Deletar vinculos: por import_run_id OU por base_tag (vínculos têm tenant_id direto)
        deleted_vinculos AS (
          DELETE FROM clientes_vinculo 
          WHERE tenant_id = ${effectiveTenantId}
            AND (
              import_run_id = ${runId}
              OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            )
          RETURNING id
        ),
        -- 5. Deletar pessoas órfãs criadas por este import (por run_id OU base_tag)
        deleted_pessoas AS (
          DELETE FROM clientes_pessoa 
          WHERE tenant_id = ${effectiveTenantId}
            AND (
              import_run_id = ${runId}
              OR (import_run_id IS NULL AND base_tag_ultima = ${runBaseTag} AND ${runBaseTag} != '')
            )
            AND NOT EXISTS (SELECT 1 FROM clientes_folha_mes WHERE pessoa_id = clientes_pessoa.id)
            AND NOT EXISTS (SELECT 1 FROM clientes_contratos WHERE pessoa_id = clientes_pessoa.id)
            AND NOT EXISTS (SELECT 1 FROM clientes_vinculo WHERE pessoa_id = clientes_pessoa.id)
            AND NOT EXISTS (SELECT 1 FROM client_contacts WHERE client_id = clientes_pessoa.id)
          RETURNING id
        ),
        -- 6. Deletar linhas de rastreabilidade
        deleted_rows AS (
          DELETE FROM import_run_rows WHERE import_run_id = ${runId}
          RETURNING id
        ),
        -- 7. Deletar erros do import
        deleted_errors AS (
          DELETE FROM import_errors WHERE import_run_id = ${runId}
          RETURNING id
        ),
        -- 8. Deletar staging (caso tenha restado)
        deleted_staging_folha AS (
          DELETE FROM staging_folha WHERE import_run_id = ${runId}
          RETURNING id
        ),
        deleted_staging_d8 AS (
          DELETE FROM staging_d8 WHERE import_run_id = ${runId}
          RETURNING id
        ),
        deleted_staging_contatos AS (
          DELETE FROM staging_contatos WHERE import_run_id = ${runId}
          RETURNING id
        ),
        -- 9. Deletar o registro principal do import_run
        deleted_run AS (
          DELETE FROM import_runs WHERE id = ${runId}
          RETURNING id
        )
        -- Retornar os counts de cada operação
        SELECT 
          (SELECT COUNT(*) FROM deleted_folhas) as folhas_count,
          (SELECT COUNT(*) FROM deleted_contratos) as contratos_count,
          (SELECT COUNT(*) FROM deleted_contacts) as contacts_count,
          (SELECT COUNT(*) FROM deleted_vinculos) as vinculos_count,
          (SELECT COUNT(*) FROM deleted_pessoas) as pessoas_count,
          (SELECT COUNT(*) FROM deleted_rows) as rows_count,
          (SELECT COUNT(*) FROM deleted_errors) as errors_count,
          (SELECT COUNT(*) FROM deleted_run) as run_deleted
      `);

        // Extrair counts do resultado
        const row = (result.rows?.[0] as any) || {};
        const deletedFolhas = Number(row.folhas_count) || 0;
        const deletedContratos = Number(row.contratos_count) || 0;
        const deletedContacts = Number(row.contacts_count) || 0;
        const deletedVinculos = Number(row.vinculos_count) || 0;
        const deletedPessoas = Number(row.pessoas_count) || 0;
        const deletedRows = Number(row.rows_count) || 0;
        const deletedErrors = Number(row.errors_count) || 0;
        const runDeleted = Number(row.run_deleted) || 0;

        if (runDeleted === 0) {
          return res
            .status(404)
            .json({ message: "Import run não encontrado ou já deletado" });
        }

        console.log(
          `[ImportRun] TRANSACTIONAL DELETE completed for run ${runId} (tenant ${effectiveTenantId}, tag "${runBaseTag}"):`,
        );
        console.log(`  - Folhas: ${deletedFolhas}`);
        console.log(`  - Contratos: ${deletedContratos}`);
        console.log(`  - Contacts: ${deletedContacts}`);
        console.log(`  - Vinculos: ${deletedVinculos}`);
        console.log(`  - Pessoas órfãs: ${deletedPessoas}`);
        console.log(`  - Rows/Errors: ${deletedRows}/${deletedErrors}`);

        return res.json({
          success: true,
          message: "Import e dados associados excluídos com sucesso",
          deleted: {
            folhas: deletedFolhas,
            contratos: deletedContratos,
            contacts: deletedContacts,
            vinculos: deletedVinculos,
            pessoasOrfas: deletedPessoas,
          },
        });
      } catch (error) {
        console.error("Delete import run error:", error);
        return res.status(500).json({ message: "Erro ao excluir import" });
      }
    },
  );

  // DELETE /api/d8/import-runs/bulk-delete - Exclusão em massa de contratos D8
  // IMPORTANTE: Esta rota DEVE vir ANTES de /api/d8/import-runs/:id para evitar conflito
  // Apaga SOMENTE contratos, preservando pessoas e vínculos que tenham outros dados
  app.delete(
    "/api/d8/import-runs/bulk-delete",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req: any, res) => {
      try {
        const { ids: rawIds } = req.body;
        const userTenantId = req.tenantId;
        const isMaster = req.user?.isMaster === true;

        console.log(
          `[D8-BulkDelete] Received request with body:`,
          JSON.stringify(req.body),
        );

        if (!Array.isArray(rawIds) || rawIds.length === 0) {
          return res.status(400).json({ message: "IDs inválidos" });
        }

        // Converter e validar IDs para números inteiros
        const ids: number[] = [];
        for (const id of rawIds) {
          const numId = typeof id === "number" ? id : parseInt(String(id), 10);
          if (!isNaN(numId) && numId > 0) {
            ids.push(numId);
          }
        }

        if (ids.length === 0) {
          return res
            .status(400)
            .json({ message: "Nenhum ID válido fornecido" });
        }

        const uniqueIds = [...new Set(ids)];
        console.log(
          `[D8-BulkDelete] Starting bulk delete D8 for ${uniqueIds.length} import runs: [${uniqueIds.join(", ")}]`,
        );

        // Helper para executar query com retry
        const executeWithRetry = async (query: any, maxRetries = 3) => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              return await db.execute(query);
            } catch (err: any) {
              if (
                attempt < maxRetries &&
                err.message?.includes("fetch failed")
              ) {
                console.log(
                  `[D8-BulkDelete] Retry ${attempt}/${maxRetries}...`,
                );
                await new Promise((r) => setTimeout(r, 500 * attempt));
                continue;
              }
              throw err;
            }
          }
        };

        let totalContratos = 0;
        let totalPessoasAfetadas = 0;
        let totalVinculosOrfaos = 0;
        let totalPessoasOrfas = 0;
        const errors: string[] = [];
        let processedCount = 0;

        for (const runId of uniqueIds) {
          try {
            // Buscar o import_run para validação
            const [run] = await db
              .select()
              .from(importRuns)
              .where(eq(importRuns.id, runId))
              .limit(1);

            if (!run) {
              errors.push(`Import #${runId}: não encontrado`);
              continue;
            }

            // Verificar se é D8
            if (run.tipoImport !== "d8") {
              errors.push(
                `Import #${runId}: não é D8 (tipo: ${run.tipoImport})`,
              );
              continue;
            }

            // Validar tenant
            const runTenantId = run.tenantId;
            if (!isMaster && runTenantId && runTenantId !== userTenantId) {
              errors.push(`Import #${runId}: sem permissão (tenant diferente)`);
              continue;
            }

            const effectiveTenantId = runTenantId || userTenantId;
            const runBaseTag = run.baseTag || "";

            if (!effectiveTenantId) {
              errors.push(`Import #${runId}: tenant não identificado`);
              continue;
            }

            // FASE 1: Deletar contratos
            const result = await executeWithRetry(sql`
            WITH 
            tenant_pessoas AS (
              SELECT id FROM clientes_pessoa WHERE tenant_id = ${effectiveTenantId}
            ),
            deleted_contratos AS (
              DELETE FROM clientes_contratos 
              WHERE pessoa_id IN (SELECT id FROM tenant_pessoas)
                AND (
                  import_run_id = ${runId}
                  OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
                )
              RETURNING id, pessoa_id
            )
            SELECT 
              (SELECT COUNT(*) FROM deleted_contratos) as contratos_count,
              (SELECT COUNT(DISTINCT pessoa_id) FROM deleted_contratos) as pessoas_afetadas
          `);

            const row = (result?.rows?.[0] as any) || {};
            const deletedContratos = Number(row.contratos_count) || 0;
            const pessoasAfetadas = Number(row.pessoas_afetadas) || 0;

            // FASE 2: Limpeza de órfãos
            const cleanupResult = await executeWithRetry(sql`
            WITH 
            deleted_vinculos AS (
              DELETE FROM clientes_vinculo v
              WHERE v.tenant_id = ${effectiveTenantId}
                AND (
                  v.import_run_id = ${runId}
                  OR (v.import_run_id IS NULL AND v.base_tag = ${runBaseTag} AND ${runBaseTag} != '')
                )
                AND NOT EXISTS (SELECT 1 FROM clientes_folha_mes f WHERE f.vinculo_id = v.id)
                AND NOT EXISTS (SELECT 1 FROM clientes_contratos c WHERE c.vinculo_id = v.id)
              RETURNING id, pessoa_id
            ),
            deleted_pessoas AS (
              DELETE FROM clientes_pessoa p
              WHERE p.tenant_id = ${effectiveTenantId}
                AND (
                  p.import_run_id = ${runId}
                  OR (p.import_run_id IS NULL AND p.base_tag_ultima = ${runBaseTag} AND ${runBaseTag} != '')
                )
                AND NOT EXISTS (SELECT 1 FROM clientes_vinculo v WHERE v.pessoa_id = p.id)
                AND NOT EXISTS (SELECT 1 FROM client_contacts c WHERE c.client_id = p.id)
                AND NOT EXISTS (SELECT 1 FROM clientes_telefones t WHERE t.pessoa_id = p.id)
                AND NOT EXISTS (SELECT 1 FROM clientes_folha_mes f WHERE f.pessoa_id = p.id)
                AND NOT EXISTS (SELECT 1 FROM clientes_contratos c WHERE c.pessoa_id = p.id)
              RETURNING id
            )
            SELECT 
              (SELECT COUNT(*) FROM deleted_vinculos) as vinculos_count,
              (SELECT COUNT(*) FROM deleted_pessoas) as pessoas_count
          `);

            const cleanupRow = (cleanupResult?.rows?.[0] as any) || {};
            const deletedVinculos = Number(cleanupRow.vinculos_count) || 0;
            const deletedPessoas = Number(cleanupRow.pessoas_count) || 0;

            // Atualizar status do import_run (com filtro de tenant para segurança)
            await executeWithRetry(sql`
            UPDATE import_runs 
            SET status = 'contratos_deletados', updated_at = NOW()
            WHERE id = ${runId} AND tenant_id = ${effectiveTenantId}
          `);

            totalContratos += deletedContratos;
            totalPessoasAfetadas += pessoasAfetadas;
            totalVinculosOrfaos += deletedVinculos;
            totalPessoasOrfas += deletedPessoas;
            processedCount++;

            console.log(
              `[D8-BulkDelete] Run #${runId}: ${deletedContratos} contratos, ${deletedVinculos} vínculos órfãos, ${deletedPessoas} pessoas órfãs`,
            );
          } catch (itemError: any) {
            console.error(
              `[D8-BulkDelete] Error on run #${runId}:`,
              itemError.message,
            );
            errors.push(
              `Import #${runId}: ${itemError.message || "erro desconhecido"}`,
            );
          }
        }

        console.log(
          `[D8-BulkDelete] Completed: ${processedCount}/${uniqueIds.length} processed, ${totalContratos} contratos total`,
        );

        return res.json({
          success: true,
          processed: processedCount,
          deleted: {
            contratos: totalContratos,
            pessoasAfetadas: totalPessoasAfetadas,
            vinculosOrfaos: totalVinculosOrfaos,
            pessoasOrfas: totalPessoasOrfas,
          },
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (error: any) {
        console.error("D8 Bulk delete error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao excluir contratos D8" });
      }
    },
  );

  // DELETE /api/d8/import-runs/:id - Apaga SOMENTE contratos gerados por esse import-run
  // Não apaga pessoas, vínculos, folha nem o import_run em si (mantém rastreabilidade)
  app.delete(
    "/api/d8/import-runs/:id",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req: any, res) => {
      try {
        const runId = parseInt(req.params.id);
        const userTenantId = req.tenantId;

        console.log(
          `[D8-Delete] Starting D8-only delete for run ${runId} (userTenant: ${userTenantId})...`,
        );

        // Buscar o import_run para validação
        const [run] = await db
          .select()
          .from(importRuns)
          .where(eq(importRuns.id, runId))
          .limit(1);

        if (!run) {
          return res.status(404).json({ message: "Import run não encontrado" });
        }

        // Verificar se é um import D8
        if (run.tipoImport !== "d8") {
          return res.status(400).json({
            message: `Este endpoint é exclusivo para imports D8. Tipo encontrado: ${run.tipoImport}`,
          });
        }

        const effectiveTenantId = run.tenantId || userTenantId;
        const runBaseTag = run.baseTag || "";

        if (!effectiveTenantId) {
          console.error(`[D8-Delete] ERROR: Cannot delete - no tenantId found`);
          return res.status(400).json({ message: "Tenant ID obrigatório" });
        }

        console.log(
          `[D8-Delete] Tenant: ${effectiveTenantId}, base_tag: "${runBaseTag}"`,
        );

        // FASE 1: Deletar SOMENTE contratos associados a este import_run
        // Usa import_run_id como fonte primária, e base_tag como fallback para órfãos
        const result = await db.execute(sql`
        WITH 
        -- Identificar pessoas do tenant para isolamento
        tenant_pessoas AS (
          SELECT id FROM clientes_pessoa WHERE tenant_id = ${effectiveTenantId}
        ),
        -- Deletar contratos: por import_run_id OU por base_tag (órfãos legados)
        deleted_contratos AS (
          DELETE FROM clientes_contratos 
          WHERE pessoa_id IN (SELECT id FROM tenant_pessoas)
            AND (
              import_run_id = ${runId}
              OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            )
          RETURNING id, pessoa_id, numero_contrato
        )
        -- Retornar count e alguns detalhes
        SELECT 
          (SELECT COUNT(*) FROM deleted_contratos) as contratos_count,
          (SELECT COUNT(DISTINCT pessoa_id) FROM deleted_contratos) as pessoas_afetadas
      `);

        const row = (result.rows?.[0] as any) || {};
        const deletedContratos = Number(row.contratos_count) || 0;
        const pessoasAfetadas = Number(row.pessoas_afetadas) || 0;

        console.log(
          `[D8-Delete] Phase 1 - Contratos deletados: ${deletedContratos}`,
        );

        // FASE 2: Limpeza segura de órfãos criados exclusivamente pelo D8
        // Regras:
        // - Apagar vínculo APENAS se não tiver folha E não tiver contratos
        // - Apagar pessoa APENAS se não tiver vínculos E não tiver contatos
        const cleanupResult = await db.execute(sql`
        WITH 
        -- Identificar vínculos órfãos criados por este import D8 que não têm folha nem contratos
        deleted_vinculos AS (
          DELETE FROM clientes_vinculo v
          WHERE v.tenant_id = ${effectiveTenantId}
            AND (
              v.import_run_id = ${runId}
              OR (v.import_run_id IS NULL AND v.base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            )
            -- Não tem folhas associadas
            AND NOT EXISTS (
              SELECT 1 FROM clientes_folha_mes f 
              WHERE f.vinculo_id = v.id
            )
            -- Não tem contratos associados
            AND NOT EXISTS (
              SELECT 1 FROM clientes_contratos c 
              WHERE c.vinculo_id = v.id
            )
          RETURNING id, pessoa_id
        ),
        -- Identificar pessoas órfãs criadas por este import D8 que não têm vínculos nem contatos
        deleted_pessoas AS (
          DELETE FROM clientes_pessoa p
          WHERE p.tenant_id = ${effectiveTenantId}
            AND (
              p.import_run_id = ${runId}
              OR (p.import_run_id IS NULL AND p.base_tag_ultima = ${runBaseTag} AND ${runBaseTag} != '')
            )
            -- Não tem vínculos restantes
            AND NOT EXISTS (
              SELECT 1 FROM clientes_vinculo v 
              WHERE v.pessoa_id = p.id
            )
            -- Não tem contatos restantes
            AND NOT EXISTS (
              SELECT 1 FROM client_contacts c 
              WHERE c.client_id = p.id
            )
            -- Não tem telefones restantes
            AND NOT EXISTS (
              SELECT 1 FROM clientes_telefones t 
              WHERE t.pessoa_id = p.id
            )
            -- Não tem folhas restantes (via pessoa_id direto)
            AND NOT EXISTS (
              SELECT 1 FROM clientes_folha_mes f 
              WHERE f.pessoa_id = p.id
            )
            -- Não tem contratos restantes (via pessoa_id direto)
            AND NOT EXISTS (
              SELECT 1 FROM clientes_contratos c 
              WHERE c.pessoa_id = p.id
            )
          RETURNING id
        )
        SELECT 
          (SELECT COUNT(*) FROM deleted_vinculos) as vinculos_count,
          (SELECT COUNT(*) FROM deleted_pessoas) as pessoas_count
      `);

        const cleanupRow = (cleanupResult.rows?.[0] as any) || {};
        const deletedVinculos = Number(cleanupRow.vinculos_count) || 0;
        const deletedPessoas = Number(cleanupRow.pessoas_count) || 0;

        console.log(`[D8-Delete] Phase 2 - Cleanup órfãos:`);
        console.log(`  - Vínculos órfãos: ${deletedVinculos}`);
        console.log(`  - Pessoas órfãs: ${deletedPessoas}`);

        // Atualizar o status do import_run para indicar que contratos foram deletados
        await db
          .update(importRuns)
          .set({
            status: "contratos_deletados",
            updatedAt: new Date(),
          })
          .where(eq(importRuns.id, runId));

        console.log(`[D8-Delete] Completed for run ${runId}`);

        return res.json({
          success: true,
          message: `${deletedContratos} contratos excluídos com sucesso`,
          deleted: {
            contratos: deletedContratos,
            pessoasAfetadas,
            vinculosOrfaos: deletedVinculos,
            pessoasOrfas: deletedPessoas,
          },
          importRun: {
            id: runId,
            baseTag: runBaseTag,
            status: "contratos_deletados",
          },
        });
      } catch (error) {
        console.error("D8 delete contracts error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao excluir contratos do D8" });
      }
    },
  );

  // GET /api/d8/import-runs/:id/preview-delete - Preview do que será apagado
  app.get(
    "/api/d8/import-runs/:id/preview-delete",
    requireAuth,
    requireMaster,
    async (req: any, res) => {
      try {
        const runId = parseInt(req.params.id);
        const userTenantId = req.tenantId;

        // Buscar o import_run para validação
        const [run] = await db
          .select()
          .from(importRuns)
          .where(eq(importRuns.id, runId))
          .limit(1);

        if (!run) {
          return res.status(404).json({ message: "Import run não encontrado" });
        }

        if (run.tipoImport !== "d8") {
          return res.status(400).json({
            message: `Este endpoint é exclusivo para imports D8. Tipo encontrado: ${run.tipoImport}`,
          });
        }

        const effectiveTenantId = run.tenantId || userTenantId;
        const runBaseTag = run.baseTag || "";

        if (!effectiveTenantId) {
          return res.status(400).json({ message: "Tenant ID obrigatório" });
        }

        // Contar o que será apagado (sem efetuar deleção)
        const previewResult = await db.execute(sql`
        WITH 
        tenant_pessoas AS (
          SELECT id FROM clientes_pessoa WHERE tenant_id = ${effectiveTenantId}
        ),
        -- Contratos que serão apagados
        contratos_para_apagar AS (
          SELECT id, pessoa_id, vinculo_id
          FROM clientes_contratos 
          WHERE pessoa_id IN (SELECT id FROM tenant_pessoas)
            AND (
              import_run_id = ${runId}
              OR (import_run_id IS NULL AND base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            )
        ),
        -- Vínculos candidatos a órfãos (criados por este D8)
        vinculos_candidatos AS (
          SELECT v.id, v.pessoa_id
          FROM clientes_vinculo v
          WHERE v.tenant_id = ${effectiveTenantId}
            AND (
              v.import_run_id = ${runId}
              OR (v.import_run_id IS NULL AND v.base_tag = ${runBaseTag} AND ${runBaseTag} != '')
            )
        ),
        -- Vínculos órfãos: sem folhas e sem contratos (após exclusão)
        vinculos_orfaos AS (
          SELECT vc.id
          FROM vinculos_candidatos vc
          WHERE NOT EXISTS (
            SELECT 1 FROM clientes_folha_mes f WHERE f.vinculo_id = vc.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM clientes_contratos c 
            WHERE c.vinculo_id = vc.id 
              AND c.id NOT IN (SELECT id FROM contratos_para_apagar)
          )
        ),
        -- Pessoas candidatas a órfãs (criadas por este D8)
        pessoas_candidatas AS (
          SELECT p.id
          FROM clientes_pessoa p
          WHERE p.tenant_id = ${effectiveTenantId}
            AND (
              p.import_run_id = ${runId}
              OR (p.import_run_id IS NULL AND p.base_tag_ultima = ${runBaseTag} AND ${runBaseTag} != '')
            )
        ),
        -- Pessoas órfãs: sem vínculos, sem contatos, sem telefones, sem folhas, sem contratos (após exclusão)
        pessoas_orfas AS (
          SELECT pc.id
          FROM pessoas_candidatas pc
          WHERE NOT EXISTS (
            SELECT 1 FROM clientes_vinculo v 
            WHERE v.pessoa_id = pc.id 
              AND v.id NOT IN (SELECT id FROM vinculos_orfaos)
          )
          AND NOT EXISTS (
            SELECT 1 FROM client_contacts c WHERE c.client_id = pc.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM clientes_telefones t WHERE t.pessoa_id = pc.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM clientes_folha_mes f WHERE f.pessoa_id = pc.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM clientes_contratos c 
            WHERE c.pessoa_id = pc.id 
              AND c.id NOT IN (SELECT id FROM contratos_para_apagar)
          )
        )
        SELECT 
          (SELECT COUNT(*) FROM contratos_para_apagar) as contratos_count,
          (SELECT COUNT(DISTINCT pessoa_id) FROM contratos_para_apagar) as pessoas_afetadas,
          (SELECT COUNT(*) FROM vinculos_orfaos) as vinculos_orfaos_count,
          (SELECT COUNT(*) FROM pessoas_orfas) as pessoas_orfas_count
      `);

        const row = (previewResult.rows?.[0] as any) || {};

        return res.json({
          importRun: {
            id: runId,
            tipoImport: run.tipoImport,
            baseTag: runBaseTag,
            convenio: run.convenio,
            status: run.status,
            arquivoOrigem: run.arquivoOrigem,
          },
          preview: {
            contratos: Number(row.contratos_count) || 0,
            pessoasAfetadas: Number(row.pessoas_afetadas) || 0,
            vinculosOrfaos: Number(row.vinculos_orfaos_count) || 0,
            pessoasOrfas: Number(row.pessoas_orfas_count) || 0,
          },
        });
      } catch (error) {
        console.error("D8 preview delete error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao gerar preview de exclusão" });
      }
    },
  );

  // GET download de TODAS as linhas com erro em CSV (usando import_run_rows)
  app.get(
    "/api/import-runs/:id/rows/errors/download",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);

        const result = await db.execute(sql`
        SELECT row_number, cpf, matricula, error_message, raw_data
        FROM import_run_rows
        WHERE import_run_id = ${runId} AND status = 'erro'
        ORDER BY row_number
        LIMIT 100000
      `);

        if (result.rows.length === 0) {
          return res
            .status(404)
            .json({ message: "Nenhum erro encontrado para este import" });
        }

        const csvRows = [
          "linha,cpf,matricula,mensagem_erro,dados_originais",
          ...(result.rows as any[]).map((row: any) => {
            const rawDataStr = row.raw_data
              ? JSON.stringify(row.raw_data).replace(/"/g, '""')
              : "";
            return `${row.row_number},"${row.cpf || ""}","${row.matricula || ""}","${(row.error_message || "").replace(/"/g, '""')}","${rawDataStr}"`;
          }),
        ];

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=erros_import_${runId}.csv`,
        );
        return res.send(csvRows.join("\n"));
      } catch (error) {
        console.error("Download import row errors error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao baixar erros do import" });
      }
    },
  );

  // ===== SISTEMA DE IMPORTAÇÃO MASSIVA (STREAMING) =====

  // Helper function para download de templates
  async function handleTemplateDownload(
    req: Request,
    res: Response,
    templateType:
      | "folha"
      | "folha_pensionista"
      | "d8_servidor"
      | "d8_pensionista"
      | "contatos",
  ) {
    try {
      const { generateExcelTemplate, getTemplateFileName } = await import(
        "./templates-service"
      );

      const buffer = await generateExcelTemplate(templateType);
      const fileName = getTemplateFileName(templateType);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.send(buffer);
    } catch (error: any) {
      console.error("Download template error:", error);
      return res
        .status(500)
        .json({ message: error.message || "Erro ao gerar template" });
    }
  }

  // GET /api/import/templates/folha - Download template Folha Servidor
  app.get("/api/import/templates/folha", requireAuth, async (req, res) => {
    return handleTemplateDownload(req, res, "folha");
  });

  // GET /api/import/templates/folha-pensionista - Download template Folha Pensionista
  app.get(
    "/api/import/templates/folha-pensionista",
    requireAuth,
    async (req, res) => {
      return handleTemplateDownload(req, res, "folha_pensionista");
    },
  );

  // GET /api/import/templates/d8-servidor - Download template D8 Servidor
  app.get(
    "/api/import/templates/d8-servidor",
    requireAuth,
    async (req, res) => {
      return handleTemplateDownload(req, res, "d8_servidor");
    },
  );

  // GET /api/import/templates/d8-pensionista - Download template D8 Pensionista
  app.get(
    "/api/import/templates/d8-pensionista",
    requireAuth,
    async (req, res) => {
      return handleTemplateDownload(req, res, "d8_pensionista");
    },
  );

  // GET /api/import/templates/contatos - Download template Contatos
  app.get("/api/import/templates/contatos", requireAuth, async (req, res) => {
    return handleTemplateDownload(req, res, "contatos");
  });

  // GET /api/templates/:type - Download template Excel para importação (legacy/generic)
  app.get("/api/templates/:type", requireAuth, async (req, res) => {
    type TemplateType =
      | "folha"
      | "folha_pensionista"
      | "d8_servidor"
      | "d8_pensionista"
      | "contatos";
    const templateType = req.params.type as TemplateType;

    const validTypes = [
      "folha",
      "folha_pensionista",
      "d8_servidor",
      "d8_pensionista",
      "contatos",
    ];
    if (!validTypes.includes(templateType)) {
      return res.status(400).json({
        message:
          "Tipo de template inválido. Use: folha, folha_pensionista, d8_servidor, d8_pensionista ou contatos",
      });
    }

    return handleTemplateDownload(req, res, templateType);
  });

  // POST /imports/start - Inicia um job de importação massiva (disk storage)
  app.post(
    "/api/imports/start",
    requireAuth,
    requireMaster,
    uploadDisk.single("arquivo"),
    async (req, res) => {
      try {
        const { streamingImportService, diagnosticarTabela } = await import(
          "./streaming-import-service"
        );

        // Diagnóstico de constraints/índices para debug
        console.log("[StreamImport] Iniciando diagnóstico de tabelas...");
        await diagnosticarTabela("clientes_vinculo");
        await diagnosticarTabela("clientes_folha_mes");

        const file = req.file;
        const { tipo_import, competencia, banco, layout_d8, convenio } =
          req.body;

        if (!file) {
          return res.status(400).json({ message: "Arquivo é obrigatório" });
        }

        if (
          !tipo_import ||
          !["folha", "d8", "contatos"].includes(tipo_import)
        ) {
          return res
            .status(400)
            .json({ message: "tipo_import deve ser folha, d8 ou contatos" });
        }

        if (tipo_import === "folha" && !competencia) {
          return res.status(400).json({
            message: "competencia é obrigatória para importação de folha",
          });
        }

        if (tipo_import === "d8" && !banco) {
          return res
            .status(400)
            .json({ message: "banco é obrigatório para importação de D8" });
        }

        const [year, month] = (competencia || "").split("-");
        const competenciaDate = competencia
          ? new Date(parseInt(year), parseInt(month) - 1, 1)
          : undefined;

        const result = await streamingImportService.startImportJob(file.path, {
          tipoImport: tipo_import,
          competencia: competenciaDate,
          banco: banco || undefined,
          layoutD8: layout_d8 || undefined,
          convenio: convenio || undefined,
          tenantId: req.tenantId || undefined,
          createdById: req.user?.id,
        });

        console.log(
          `[StreamImport] Job started: ${result.importRunId}, file at: ${file.path}`,
        );

        return res.json({
          success: true,
          importRunId: result.importRunId,
          message: result.message,
          nextStep: `POST /api/imports/process/${result.importRunId}`,
        });
      } catch (error: any) {
        console.error("Start import error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao iniciar importação" });
      }
    },
  );

  // POST /imports/process/:id - Processa um chunk do job de importação
  app.post(
    "/api/imports/process/:id",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const { streamingImportService } = await import(
          "./streaming-import-service"
        );
        const runId = parseInt(req.params.id);

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID de importação inválido" });
        }

        console.log(`[StreamImport] Processing chunk for run ${runId}`);

        const result = await streamingImportService.processImportChunk(runId);

        console.log(
          `[StreamImport] Chunk result: ${result.processedRows} rows, status: ${result.status}`,
        );

        return res.json({
          success: result.success,
          importRunId: result.importRunId,
          processedRows: result.processedRows,
          successRows: result.successRows,
          errorRows: result.errorRows,
          status: result.status,
          pausedForResume: result.pausedForResume,
          message: result.message,
          nextStep: result.pausedForResume
            ? `POST /api/imports/process/${runId}`
            : null,
        });
      } catch (error: any) {
        console.error("Process import error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao processar importação" });
      }
    },
  );

  // GET /imports/status/:id - Status de um job de importação
  app.get(
    "/api/imports/status/:id",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const { streamingImportService } = await import(
          "./streaming-import-service"
        );
        const runId = parseInt(req.params.id);

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID de importação inválido" });
        }

        const run = await streamingImportService.getImportStatus(runId);

        if (!run) {
          return res
            .status(404)
            .json({ message: "Job de importação não encontrado" });
        }

        const percentComplete =
          run.totalRows > 0
            ? Math.round((run.processedRows / run.totalRows) * 100)
            : 0;

        return res.json({
          id: run.id,
          tipoImport: run.tipoImport,
          status: run.status,
          arquivoOrigem: run.arquivoOrigem,
          totalRows: run.totalRows,
          processedRows: run.processedRows,
          successRows: run.successRows,
          errorRows: run.errorRows,
          percentComplete,
          competencia: safeCompetencia(run.competencia),
          banco: run.banco,
          layoutD8: run.layoutD8,
          convenio: run.convenio,
          baseTag: run.baseTag,
          errorMessage: run.errorMessage,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          pausedAt: run.pausedAt,
          canResume: run.status === "pausado",
          nextStep:
            run.status === "pausado"
              ? `POST /api/imports/process/${run.id}`
              : null,
        });
      } catch (error: any) {
        console.error("Get import status error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao buscar status" });
      }
    },
  );

  // GET /imports/:id/errors - Lista erros de um job de importação
  app.get(
    "/api/imports/:id/errors",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const { streamingImportService } = await import(
          "./streaming-import-service"
        );
        const runId = parseInt(req.params.id);
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID de importação inválido" });
        }

        const errors = await streamingImportService.getImportErrors(
          runId,
          limit,
          offset,
        );

        return res.json({
          errors,
          count: errors.length,
          limit,
          offset,
        });
      } catch (error: any) {
        console.error("Get import errors error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao buscar erros" });
      }
    },
  );

  // GET /api/imports/dados-complementares/template - Baixa planilha modelo para importação de dados complementares
  app.get(
    "/api/imports/dados-complementares/template",
    requireAuth,
    async (req, res) => {
      try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "ConsigOne";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet("Dados Complementares");

        // Headers
        const headers = [
          "CPF",
          "NOME",
          "DATA_NASCIMENTO",
          "BANCO_CODIGO",
          "AGENCIA",
          "CONTA",
          "TELEFONE_1",
          "TELEFONE_2",
          "TELEFONE_3",
        ];

        // Adicionar cabeçalhos
        sheet.addRow(headers);

        // Estilizar cabeçalhos
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        headerRow.alignment = { horizontal: "center" };

        // Exemplo de linha
        sheet.addRow([
          "12345678901",
          "MARIA DA SILVA",
          "15/03/1985",
          "001",
          "1234",
          "12345-6",
          "11999998888",
          "1133334444",
          "",
        ]);

        // Linha de instruções
        sheet.addRow([
          "Obrigatório",
          "Opcional",
          "DD/MM/AAAA",
          "Código banco",
          "Nº agência",
          "Nº conta",
          "Principal",
          "Opcional",
          "Opcional",
        ]);

        // Estilizar linha de instruções
        const instructionRow = sheet.getRow(3);
        instructionRow.font = { italic: true, color: { argb: "FF666666" } };

        // Ajustar largura das colunas
        sheet.columns = [
          { width: 15 }, // CPF
          { width: 30 }, // NOME
          { width: 15 }, // DATA_NASCIMENTO
          { width: 15 }, // BANCO_CODIGO
          { width: 12 }, // AGENCIA
          { width: 12 }, // CONTA
          { width: 14 }, // TELEFONE_1
          { width: 14 }, // TELEFONE_2
          { width: 14 }, // TELEFONE_3
        ];

        // Formatar colunas como texto para preservar zeros
        ["A", "D", "E", "F", "G", "H", "I"].forEach((col) => {
          sheet.getColumn(col).numFmt = "@";
        });

        // Gerar buffer
        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="modelo_dados_complementares.xlsx"',
        );
        res.send(buffer);
      } catch (error: any) {
        console.error("Erro ao gerar template dados complementares:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao gerar template" });
      }
    },
  );

  // POST /api/imports/dados-complementares - Importa dados complementares (telefones, banco, etc)
  // Headers aceitos: CPF, DATA_NASCIMENTO, BANCO_CODIGO, AGENCIA, CONTA, TELEFONE_1, TELEFONE_2, TELEFONE_3
  // Ordem das colunas não importa. Outras colunas são ignoradas.
  app.post(
    "/api/imports/dados-complementares",
    requireAuth,
    requireMaster,
    upload.single("arquivo"),
    async (req, res) => {
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ message: "Arquivo é obrigatório" });
        }

        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant não identificado" });
        }

        // Mapeamento de headers normalizados para campos do payload
        // Headers aceitos: CPF, NOME, DATA_NASCIMENTO, BANCO_CODIGO, AGENCIA, CONTA, TELEFONE_1, TELEFONE_2, TELEFONE_3
        const HEADER_MAP: Record<string, string> = {
          cpf: "cpf",
          nome: "nome",
          data_nascimento: "dataNascimento",
          datanascimento: "dataNascimento",
          banco_codigo: "bancoCodigo",
          bancocodigo: "bancoCodigo",
          agencia: "agencia",
          conta: "conta",
          telefone_1: "telefone1",
          telefone1: "telefone1",
          telefone_2: "telefone2",
          telefone2: "telefone2",
          telefone_3: "telefone3",
          telefone3: "telefone3",
        };

        function normalizeHeader(h: string): string {
          return h
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_|_$/g, "");
        }

        let rows: Record<string, any>[] = [];
        const fileName = file.originalname.toLowerCase();

        // Parse CSV ou XLSX
        if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
          const csvContent = file.buffer.toString("utf-8");
          const parsed = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            delimiter: csvContent.includes(";") ? ";" : ",",
          });
          rows = parsed.data as Record<string, any>[];
        } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(file.buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        } else {
          return res.status(400).json({
            message: "Formato de arquivo não suportado. Use CSV, TXT ou XLSX.",
          });
        }

        // Processar linha a linha
        const report = {
          linhas_lidas: rows.length,
          pessoas_atualizadas: 0,
          telefones_inseridos: 0,
          cpfs_nao_encontrados: 0,
          erros_por_linha: [] as {
            linha: number;
            cpf: string | null;
            mensagem: string;
          }[],
        };

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            // Mapear headers
            const payload: Record<string, any> = {};
            let cpf: string | null = null;

            for (const [originalHeader, value] of Object.entries(row)) {
              const normalized = normalizeHeader(originalHeader);
              const mappedField = HEADER_MAP[normalized];

              if (normalized === "cpf") {
                cpf = String(value || "")
                  .replace(/\D/g, "")
                  .padStart(11, "0");
              } else if (mappedField) {
                payload[mappedField] = value;
              }
            }

            if (!cpf || cpf.length !== 11 || cpf === "00000000000") {
              if (report.erros_por_linha.length < 200) {
                report.erros_por_linha.push({
                  linha: i + 2,
                  cpf,
                  mensagem: "CPF inválido ou ausente",
                });
              }
              continue;
            }

            // Chamar upsert
            const result = await storage.upsertDadosComplementaresPorCpf(
              cpf,
              tenantId,
              payload,
            );

            if (
              result.pessoasAtualizadas === 0 &&
              result.telefonesInseridos === 0
            ) {
              report.cpfs_nao_encontrados++;
              if (report.erros_por_linha.length < 200) {
                report.erros_por_linha.push({
                  linha: i + 2,
                  cpf,
                  mensagem: "CPF não encontrado na base",
                });
              }
            } else {
              report.pessoas_atualizadas += result.pessoasAtualizadas;
              report.telefones_inseridos += result.telefonesInseridos;
            }
          } catch (err: any) {
            if (report.erros_por_linha.length < 200) {
              report.erros_por_linha.push({
                linha: i + 2,
                cpf: null,
                mensagem: err.message || "Erro desconhecido",
              });
            }
          }
        }

        console.log(
          `[DadosComplementares] Processado: ${report.linhas_lidas} linhas, ${report.pessoas_atualizadas} atualizados, ${report.telefones_inseridos} telefones, ${report.cpfs_nao_encontrados} não encontrados`,
        );

        return res.json({
          success: true,
          ...report,
        });
      } catch (error: any) {
        console.error("Dados complementares import error:", error);
        return res.status(500).json({
          message:
            error.message ||
            "Erro ao processar importação de dados complementares",
        });
      }
    },
  );

  // ==================== FAST IMPORT ROUTES (SQL-based, 10-50x faster) ====================

  // POST /api/fast-imports/start - Inicia importação rápida com staging tables
  app.post(
    "/api/fast-imports/start",
    requireAuth,
    requireMaster,
    uploadDisk.single("arquivo"),
    async (req, res) => {
      try {
        const { fastImportService } = await import("./fast-import-service");
        const file = req.file;
        const { tipo_import, competencia, banco, layout_d8, convenio } =
          req.body;

        if (!file) {
          return res.status(400).json({ message: "Arquivo é obrigatório" });
        }

        if (
          !tipo_import ||
          !["folha", "d8", "contatos", "estadual"].includes(tipo_import)
        ) {
          return res
            .status(400)
            .json({ message: "tipo_import deve ser folha, d8, contatos ou estadual" });
        }

        if ((tipo_import === "folha" || tipo_import === "estadual") && !competencia) {
          return res.status(400).json({
            message: "competencia é obrigatória para importação de folha ou estadual",
          });
        }

        if (tipo_import === "d8" && !banco) {
          return res
            .status(400)
            .json({ message: "banco é obrigatório para importação de D8" });
        }

        if (tipo_import === "estadual" && !convenio) {
          return res.status(400).json({
            message: "convênio (UF) é obrigatório para importação estadual",
          });
        }

        const [year, month] = (competencia || "").split("-");
        const competenciaDate = competencia
          ? new Date(parseInt(year), parseInt(month) - 1, 1)
          : undefined;

        const result = await fastImportService.startFastImport(file.path, {
          tipoImport: tipo_import,
          competencia: competenciaDate,
          banco: banco || undefined,
          layoutD8: layout_d8 || undefined,
          convenio: convenio || undefined,
          tenantId: req.tenantId || undefined,
          createdById: req.user?.id,
        });

        console.log(
          `[FastImport] Job started: ${result.importRunId}, file at: ${file.path}`,
        );

        return res.json({
          success: true,
          importRunId: result.importRunId,
          message: result.message,
          nextStep: `POST /api/fast-imports/process/${result.importRunId}`,
        });
      } catch (error: any) {
        console.error("Fast import start error:", error);
        return res.status(500).json({
          message: error.message || "Erro ao iniciar importação rápida",
        });
      }
    },
  );

  // POST /api/fast-imports/reprocess/:id - Reset e reprocessa uma importação existente
  app.post(
    "/api/fast-imports/reprocess/:id",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const { fastImportService } = await import("./fast-import-service");
        const runId = parseInt(req.params.id);

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID de importação inválido" });
        }

        const [run] = await db
          .select()
          .from(importRuns)
          .where(eq(importRuns.id, runId))
          .limit(1);
        if (!run) {
          return res.status(404).json({ message: "Importação não encontrada" });
        }

        if (!["pending", "erro", "pausado"].includes(run.status)) {
          return res.status(400).json({
            message: `Importação com status '${run.status}' não pode ser reprocessada`,
          });
        }

        const stagingTableMap: Record<string, string> = {
          folha: "staging_folha",
          d8: "staging_d8",
          contatos: "staging_contatos",
        };
        const stagingTable = stagingTableMap[run.tipoImport];
        if (!stagingTable) {
          return res.status(400).json({
            message: `Tipo de importação '${run.tipoImport}' não suporta reprocessamento`,
          });
        }

        const filePath = run.arquivoPath;
        if (!filePath || !fs.existsSync(filePath)) {
          return res.status(400).json({
            message:
              "Arquivo original não encontrado no servidor. Faça o upload novamente.",
          });
        }

        await db.execute(
          sql`DELETE FROM import_run_rows WHERE import_run_id = ${runId}`,
        );
        await db.execute(
          sql`DELETE FROM ${sql.raw(stagingTable)} WHERE import_run_id = ${runId}`,
        );

        if (run.tipoImport === "contatos") {
          await db.execute(
            sql`DELETE FROM client_contacts WHERE import_run_id = ${runId}`,
          );
        }

        await db
          .update(importRuns)
          .set({
            status: "pending",
            processedRows: 0,
            successRows: 0,
            errorRows: 0,
            currentChunk: 0,
            offsetAtual: 0,
            completedAt: null,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(importRuns.id, runId));

        console.log(
          `[FastImport] Reprocessing run ${runId} (${run.tipoImport})...`,
        );

        res.json({
          success: true,
          importRunId: runId,
          phase: "staging",
          message: "Reprocessamento iniciado em background.",
          backgroundProcessing: true,
        });

        fastImportService
          .processChunk(runId)
          .then(async (result) => {
            console.log(
              `[FastImport] Reprocess result: phase=${result.phase}, staged=${result.stagedRows}, merged=${result.mergedRows}, elapsed=${result.elapsedMs}ms`,
            );
          })
          .catch(async (error: any) => {
            console.error("Fast import reprocess error:", error);
            try {
              await db
                .update(importRuns)
                .set({
                  status: "erro",
                  errorMessage: error.message || "Erro desconhecido",
                  updatedAt: new Date(),
                })
                .where(eq(importRuns.id, runId));
            } catch (e) {
              console.error("Failed to update import run status:", e);
            }
          });
      } catch (error: any) {
        console.error("Fast import reprocess error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao reprocessar importação" });
      }
    },
  );

  // POST /api/fast-imports/process/:id - Processa staging + merge (async background)
  app.post(
    "/api/fast-imports/process/:id",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const { fastImportService } = await import("./fast-import-service");
        const runId = parseInt(req.params.id);

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID de importação inválido" });
        }

        console.log(
          `[FastImport] Starting background processing for run ${runId}...`,
        );

        res.json({
          success: true,
          importRunId: runId,
          phase: "staging",
          message:
            "Processamento iniciado em background. Consulte o status via polling.",
          backgroundProcessing: true,
        });

        fastImportService
          .processChunk(runId)
          .then(async (result) => {
            console.log(
              `[FastImport] Background result: phase=${result.phase}, staged=${result.stagedRows}, merged=${result.mergedRows}, elapsed=${result.elapsedMs}ms`,
            );
          })
          .catch(async (error: any) => {
            console.error("Fast import background process error:", error);
            try {
              await db
                .update(importRuns)
                .set({
                  status: "erro",
                  errorMessage: error.message || "Erro desconhecido",
                  updatedAt: new Date(),
                })
                .where(eq(importRuns.id, runId));
            } catch (e) {
              console.error("Failed to update import run status:", e);
            }
          });
      } catch (error: any) {
        console.error("Fast import process error:", error);
        return res.status(500).json({
          error: "FAST_IMPORT_FAILED",
          message: error.message || "Erro ao processar importação",
          importRunId: parseInt(req.params.id),
        });
      }
    },
  );

  // GET /api/fast-imports/status/:id - Status de um job de importação rápida
  app.get(
    "/api/fast-imports/status/:id",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const { fastImportService } = await import("./fast-import-service");
        const runId = parseInt(req.params.id);

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID de importação inválido" });
        }

        const run = await fastImportService.getStatus(runId);

        if (!run) {
          return res
            .status(404)
            .json({ message: "Job de importação não encontrado" });
        }

        const percentComplete =
          run.totalRows > 0
            ? Math.round((run.processedRows / run.totalRows) * 100)
            : 0;

        return res.json({
          id: run.id,
          tipoImport: run.tipoImport,
          status: run.status,
          arquivoOrigem: run.arquivoOrigem,
          totalRows: run.totalRows,
          processedRows: run.processedRows,
          successRows: run.successRows,
          errorRows: run.errorRows,
          percentComplete,
          competencia: safeCompetencia(run.competencia),
          banco: run.banco,
          layoutD8: run.layoutD8,
          convenio: run.convenio,
          baseTag: run.baseTag,
          errorMessage: run.errorMessage,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          pausedAt: run.pausedAt,
          canResume: run.status === "pausado",
          nextStep:
            run.status === "pausado"
              ? `POST /api/fast-imports/process/${run.id}`
              : null,
        });
      } catch (error: any) {
        console.error("Get fast import status error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao buscar status" });
      }
    },
  );

  // GET /api/fast-imports/report/:id - Relatório detalhado de uma importação
  app.get(
    "/api/fast-imports/report/:id",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const { fastImportService } = await import("./fast-import-service");
        const runId = parseInt(req.params.id);

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID de importação inválido" });
        }

        const run = await fastImportService.getStatus(runId);

        if (!run) {
          return res
            .status(404)
            .json({ message: "Job de importação não encontrado" });
        }

        const report = await fastImportService.getImportReport(runId);

        return res.json({
          importRunId: runId,
          arquivoOrigem: run.arquivoOrigem,
          tipoImport: run.tipoImport,
          convenio: run.convenio,
          competencia: safeCompetencia(run.competencia),
          status: run.status,
          report,
        });
      } catch (error: any) {
        console.error("Get fast import report error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao buscar relatório" });
      }
    },
  );

  // ==================== SPLIT TXT→CSV ROUTES ====================

  // POST /api/split/start - Iniciar novo job de split TXT→CSV
  app.post(
    "/api/split/start",
    requireAuth,
    requireMaster,
    uploadTxt.single("arquivo"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const tenantId = (req as any).tenantId || user.tenantId || 1;
        const file = req.file;

        if (!file) {
          return res.status(400).json({ message: "Arquivo TXT é obrigatório" });
        }

        const linesPerPart = parseInt(req.body.linesPerPart) || 100000;

        const { splitService } = await import("./split-service");
        const run = await splitService.createRun(
          tenantId,
          file.path,
          file.originalname,
          user.id,
          linesPerPart,
        );

        return res.json({
          success: true,
          runId: run.id,
          status: "pendente",
          message:
            "Job de split criado. Chame POST /api/split/process/:id para iniciar.",
          nextStep: `/api/split/process/${run.id}`,
        });
      } catch (error: any) {
        console.error("Split start error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao criar job de split" });
      }
    },
  );

  // POST /api/split/process/:id - Processar próximo chunk do split
  app.post(
    "/api/split/process/:id",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);
        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { splitService } = await import("./split-service");
        const result = await splitService.processChunk(runId);

        return res.json({
          success: result.success,
          runId: result.runId,
          status: result.status,
          currentPart: result.currentPart,
          linesInCurrentPart: result.linesInCurrentPart,
          totalLinesProcessed: result.totalLinesProcessed,
          totalParts: result.totalParts,
          message: result.message,
          outputFiles: result.outputFiles,
          nextStep:
            result.status === "continue" ? `/api/split/process/${runId}` : null,
        });
      } catch (error: any) {
        console.error("Split process error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao processar split" });
      }
    },
  );

  // GET /api/split/status/:id - Consultar status do job de split
  app.get(
    "/api/split/status/:id",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);
        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { splitService } = await import("./split-service");
        const run = await splitService.getRun(runId);

        if (!run) {
          return res.status(404).json({ message: "Job não encontrado" });
        }

        const files = await splitService.listOutputFiles(runId);

        return res.json({
          id: run.id,
          status: run.status,
          originalFilename: run.originalFilename,
          currentPart: run.currentPart,
          linesInCurrentPart: run.linesInCurrentPart,
          totalLinesProcessed: run.totalLinesProcessed,
          totalParts: run.totalParts,
          linesPerPart: run.linesPerPart,
          byteOffset: run.byteOffset,
          errorMessage: run.errorMessage,
          outputFiles: files,
          canResume: run.status === "pausado",
          nextStep:
            run.status === "pausado" ? `/api/split/process/${run.id}` : null,
        });
      } catch (error: any) {
        console.error("Split status error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao buscar status" });
      }
    },
  );

  // GET /api/split/runs - Listar jobs de split do tenant
  app.get(
    "/api/split/runs",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const tenantId = (req as any).tenantId || user.tenantId || 1;

        const { splitService } = await import("./split-service");
        const runs = await splitService.getRunsByTenant(tenantId);

        return res.json(runs);
      } catch (error: any) {
        console.error("Split runs error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao listar jobs" });
      }
    },
  );

  // GET /api/split/download/:id/:filename - Download arquivo CSV gerado
  app.get(
    "/api/split/download/:id/:filename",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);
        const filename = req.params.filename;

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { splitService } = await import("./split-service");
        const run = await splitService.getRun(runId);

        if (!run || !run.outputFolder) {
          return res.status(404).json({ message: "Job não encontrado" });
        }

        const filePath = path.join(run.outputFolder, filename);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "Arquivo não encontrado" });
        }

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      } catch (error: any) {
        console.error("Split download error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao baixar arquivo" });
      }
    },
  );

  // ==================== END SPLIT ROUTES ====================

  // ==================== CSV SPLIT ROUTES (Dividir CSV em partes com header) ====================

  // POST /api/csv-split/start - Iniciar novo job de split CSV/XLSX (async - returns immediately)
  app.post(
    "/api/csv-split/start",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    uploadCsvXlsx.single("arquivo"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const tenantId = (req as any).tenantId || user.tenantId || 1;
        const file = req.file;

        if (!file) {
          return res
            .status(400)
            .json({ message: "Arquivo CSV ou XLSX é obrigatório" });
        }

        const baseName = req.body.baseName || undefined;
        const linesPerPart = parseInt(req.body.linesPerPart) || 100000;

        const { csvSplitService } = await import("./csv-split-service");
        const { csvSplitRunner } = await import("./csv-split-runner");

        let filePath = file.path;
        const ext = path.extname(file.originalname).toLowerCase();

        // If XLSX, start conversion in background after creating the run
        const needsConversion = ext === ".xlsx";

        const run = await csvSplitService.createRun(
          tenantId,
          filePath,
          file.originalname,
          user.id,
          baseName,
          linesPerPart,
          needsConversion,
        );

        // Enqueue for background processing (runner will handle XLSX conversion)
        csvSplitRunner.enqueue(run.id);

        return res.json({
          success: true,
          runId: run.id,
          status: "pendente",
          message: "Upload concluído. Processamento iniciado em background.",
        });
      } catch (error: any) {
        console.error("CSV Split start error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao criar job de split" });
      }
    },
  );

  // GET /api/csv-split/status/:id - Consultar status do job de split CSV
  app.get(
    "/api/csv-split/status/:id",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);
        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { csvSplitService } = await import("./csv-split-service");
        const run = await csvSplitService.getRun(runId);

        if (!run) {
          return res.status(404).json({ message: "Job não encontrado" });
        }

        const files = await csvSplitService.getOutputFiles(runId);
        const fileSize = await csvSplitService.getFileSize(runId);

        return res.json({
          id: run.id,
          status: run.status,
          originalFilename: run.originalFilename,
          baseName: run.baseName,
          currentPart: run.currentPart,
          lineOffset: run.lineOffset,
          headerLine: run.headerLine
            ? run.headerLine.substring(0, 200) + "..."
            : null,
          totalLinesProcessed: run.totalLinesProcessed,
          totalParts: run.totalParts,
          linesPerPart: run.linesPerPart,
          errorMessage: run.errorMessage,
          outputFiles: files,
          fileSize,
          bytesProcessed: run.lineOffset,
          canResume: run.status === "processando" || run.status === "pendente",
          nextStep:
            run.status === "processando" || run.status === "pendente"
              ? `/api/csv-split/process/${run.id}`
              : null,
        });
      } catch (error: any) {
        console.error("CSV Split status error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao buscar status" });
      }
    },
  );

  // GET /api/csv-split/runs - Listar jobs de split CSV do tenant
  app.get(
    "/api/csv-split/runs",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const tenantId = (req as any).tenantId || user.tenantId || 1;

        const { csvSplitService } = await import("./csv-split-service");
        const runs = await csvSplitService.getRunsByTenant(tenantId);

        return res.json(runs);
      } catch (error: any) {
        console.error("CSV Split runs error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao listar jobs" });
      }
    },
  );

  // POST /api/csv-split/reset/:id - Resetar job de split CSV para retomar
  app.post(
    "/api/csv-split/reset/:id",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);
        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { csvSplitService } = await import("./csv-split-service");
        await csvSplitService.resetRun(runId);

        return res.json({
          success: true,
          message: "Job resetado. Pode continuar o processamento.",
          nextStep: `/api/csv-split/process/${runId}`,
        });
      } catch (error: any) {
        console.error("CSV Split reset error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao resetar job" });
      }
    },
  );

  // GET /api/csv-split/download/:id/:filename - Download arquivo CSV gerado
  app.get(
    "/api/csv-split/download/:id/:filename",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);
        const filename = req.params.filename;

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { csvSplitService } = await import("./csv-split-service");
        const run = await csvSplitService.getRun(runId);

        if (!run || !run.outputFolder) {
          return res.status(404).json({ message: "Job não encontrado" });
        }

        const filePath = path.join(run.outputFolder, filename);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "Arquivo não encontrado" });
        }

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      } catch (error: any) {
        console.error("CSV Split download error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao baixar arquivo" });
      }
    },
  );

  // GET /api/csv-split/download-zip/:id - Download ZIP com todas as partes
  app.get(
    "/api/csv-split/download-zip/:id",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const runId = parseInt(req.params.id);

        if (isNaN(runId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { csvSplitService } = await import("./csv-split-service");
        const run = await csvSplitService.getRun(runId);

        if (!run || !run.outputFolder) {
          return res.status(404).json({ message: "Job não encontrado" });
        }

        if (run.status !== "concluido") {
          return res
            .status(400)
            .json({ message: "Processamento ainda não concluído" });
        }

        const zipPath = await csvSplitService.createZip(runId);

        if (!zipPath || !fs.existsSync(zipPath)) {
          return res
            .status(404)
            .json({ message: "Não foi possível gerar o ZIP" });
        }

        const zipFilename = `${run.baseName || "partes"}_completo.zip`;
        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${zipFilename}"`,
        );

        const stream = fs.createReadStream(zipPath);
        stream.pipe(res);
      } catch (error: any) {
        console.error("CSV Split ZIP download error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao gerar ZIP" });
      }
    },
  );

  // ==================== END CSV SPLIT ROUTES ====================

  // GET filtros disponíveis para clientes - MASTER ONLY
  app.get(
    "/api/clientes/filtros",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const convenios = await storage.getDistinctConveniosClientes();
        const orgaos = await storage.getDistinctOrgaosClientes();
        const orgaosComCodigo = await storage.getOrgaosWithCodigo();
        const ufs = await storage.getDistinctUfsClientes();
        const bancos = await storage.getDistinctBancosClientes();
        const tiposContrato = await storage.getDistinctTiposContratoClientes();

        return res.json({
          convenios,
          orgaos,
          orgaosComCodigo,
          ufs,
          bancos,
          tiposContrato,
        });
      } catch (error) {
        console.error("Get filtros error:", error);
        return res.status(500).json({ message: "Erro ao buscar filtros" });
      }
    },
  );

  // GET tipos de contrato filtrados por banco - MASTER ONLY
  app.get(
    "/api/clientes/filtros/tipos-contrato",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const banco = req.query.banco as string | undefined;

        let tiposContrato: string[];
        if (banco && banco.trim()) {
          tiposContrato = await storage.getDistinctTiposContratoByBanco(
            banco.trim(),
          );
        } else {
          tiposContrato = await storage.getDistinctTiposContratoClientes();
        }

        return res.json(tiposContrato);
      } catch (error) {
        console.error("Get tipos contrato error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar tipos de contrato" });
      }
    },
  );

  // GET convênios disponíveis para consulta de clientes - MASTER ONLY
  app.get(
    "/api/clientes/filtros/convenios",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const convenios = await storage.getDistinctConveniosClientes();
        return res.json(convenios);
      } catch (error) {
        console.error("Get convenios error:", error);
        return res.status(500).json({ message: "Erro ao buscar convênios" });
      }
    },
  );

  app.get(
    "/api/clientes/filtros/bases",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const result = await db.execute(sql`
        SELECT base_tag, tipo_import, MAX(created_at) as ultimo_import
        FROM import_runs
        WHERE status = 'concluido' AND base_tag IS NOT NULL
        GROUP BY base_tag, tipo_import
        ORDER BY base_tag DESC
      `);
        const meses: Record<string, string> = {
          "01": "Janeiro",
          "02": "Fevereiro",
          "03": "Março",
          "04": "Abril",
          "05": "Maio",
          "06": "Junho",
          "07": "Julho",
          "08": "Agosto",
          "09": "Setembro",
          "10": "Outubro",
          "11": "Novembro",
          "12": "Dezembro",
        };
        const basesMap = new Map<
          string,
          {
            ref: string;
            label: string;
            folha: boolean;
            d8: boolean;
            contatos: boolean;
          }
        >();
        for (const row of result.rows) {
          const tag = row.base_tag as string;
          const tipo = row.tipo_import as string;
          const ref = tag.substring(0, 6);
          const ano = ref.substring(0, 4);
          const mes = ref.substring(4, 6);
          if (!basesMap.has(ref)) {
            basesMap.set(ref, {
              ref,
              label: `${meses[mes] || mes}/${ano}`,
              folha: false,
              d8: false,
              contatos: false,
            });
          }
          const entry = basesMap.get(ref)!;
          if (tipo === "folha") entry.folha = true;
          if (tipo === "d8") entry.d8 = true;
          if (tipo === "contatos") entry.contatos = true;
        }
        const bases = Array.from(basesMap.values()).sort((a, b) =>
          b.ref.localeCompare(a.ref),
        );
        return res.json(bases);
      } catch (error) {
        console.error("Get bases error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar bases disponíveis" });
      }
    },
  );

  app.get(
    "/api/clientes/filtros/sit-func",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const tenantId = req.tenantId!;
        const result = await db.execute(sql`
          SELECT DISTINCT sit_func
          FROM clientes_vinculo
          WHERE tenant_id = ${tenantId}
            AND sit_func IS NOT NULL
            AND TRIM(sit_func) != ''
          ORDER BY sit_func
        `);
        const valores = result.rows.map((r: any) => r.sit_func as string);
        return res.json(valores);
      } catch (error) {
        console.error("Get sit-func filtros error:", error);
        return res.status(500).json({ message: "Erro ao buscar situações funcionais" });
      }
    },
  );

  // GET consulta de cliente por CPF ou matrícula
  // Base de clientes é compartilhada entre todos os ambientes
  app.get(
    "/api/clientes/consulta",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req: any, res) => {
      try {
        const { cpf, matricula, telefone, convenio, base } = req.query;

        if (!cpf && !matricula && !telefone) {
          return res.status(400).json({
            message: "Informe CPF, matrícula ou telefone para realizar a consulta",
          });
        }

        let tipoBusca: "cpf" | "matricula" | "telefone";
        let termo: string;
        let resultados: any[] = [];
        const convenioFiltro = convenio ? String(convenio).trim() : null;
        const baseFiltro = base ? String(base).trim() : null;
        console.log(
          `[Consulta Cliente] user=${req.user?.id}, tipoBusca=${telefone ? "telefone" : matricula ? "matricula" : "cpf"}, convenio=${convenioFiltro || "all"}, base=${baseFiltro || "all"}`,
        );

        if (telefone) {
          tipoBusca = "telefone";
          const cleanTel = String(telefone).replace(/\D/g, "");
          if (cleanTel.length < 8 || cleanTel.length > 11) {
            return res.status(400).json({
              message: "Telefone inválido. Informe entre 8 e 11 dígitos.",
            });
          }
          termo = cleanTel;
          const clientes = await storage.getPessoasByTelefone(
            cleanTel,
            convenioFiltro || undefined,
            baseFiltro || undefined,
          );
          resultados = clientes.map((cliente) => ({
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
        } else if (matricula) {
          tipoBusca = "matricula";
          termo = String(matricula).trim();

          const clientes = await storage.getClientesByMatricula(
            termo,
            convenioFiltro || undefined,
            baseFiltro || undefined,
          );
          resultados = clientes.map((cliente) => ({
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
          const cleanCpf = String(cpf).replace(/\D/g, "");
          termo = cleanCpf.padStart(11, "0");

          if (cleanCpf.length === 0 || cleanCpf.length > 11) {
            return res.status(400).json({
              message: "CPF inválido. Informe um CPF válido.",
            });
          }

          const clientes = await storage.getClientesByCpf(
            termo,
            convenioFiltro || undefined,
            baseFiltro || undefined,
          );
          resultados = clientes.map((cliente) => ({
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

        console.log(
          `[Consulta Cliente] user=${req.user?.id}, tipo=${tipoBusca}, termo="${termo}", resultados=${resultados.length}`,
        );

        return res.json({
          tipo_busca: tipoBusca,
          termo,
          convenio_filtro: convenioFiltro,
          base_filtro: baseFiltro,
          resultados,
        });
      } catch (error) {
        console.error("Consulta cliente error:", error);
        return res.status(500).json({ message: "Erro ao consultar cliente" });
      }
    },
  );

  // GET detalhes completos de um cliente - MASTER ONLY
  app.get(
    "/api/clientes/:pessoaId",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const pessoaId = parseInt(req.params.pessoaId);
        const vinculoIdParam = req.query.vinculoId
          ? parseInt(req.query.vinculoId as string)
          : null;

        if (isNaN(pessoaId)) {
          return res.status(400).json({ message: "ID de pessoa inválido" });
        }

        // Get pessoa
        const pessoa = await storage.getClientePessoaById(pessoaId);
        if (!pessoa) {
          return res.status(404).json({ message: "Cliente não encontrado" });
        }

        // Get all vínculos for this pessoa (shared across tenants)
        const vinculosTodos = await storage.getVinculosByPessoaId(pessoaId);

        // Determinar qual vínculo usar para buscar folha - PRIORIZAR folha mais recente (de TODOS os vínculos)
        let vinculoIdEfetivo: number | null = null;

        if (vinculoIdParam && !isNaN(vinculoIdParam)) {
          // Validar que o vinculoId pertence aos vínculos disponíveis
          const vinculoValido = vinculosTodos.find(
            (v) => v.id === vinculoIdParam,
          );
          if (vinculoValido) {
            vinculoIdEfetivo = vinculoIdParam;
          }
        }

        // Se não foi especificado, buscar o vínculo com folha mais recente (de TODOS, não apenas os filtrados)
        if (!vinculoIdEfetivo && vinculosTodos.length > 0) {
          const vinculoIds = vinculosTodos.map((v) => v.id);
          vinculoIdEfetivo =
            await storage.getVinculoIdWithLatestFolha(vinculoIds);
          // Fallback para primeiro vínculo se não encontrou folha
          if (!vinculoIdEfetivo) {
            vinculoIdEfetivo = vinculosTodos[0].id;
          }
        }

        const vinculos = vinculosTodos;

        // Get folha data - sempre buscar por vínculo quando disponível, senão por pessoa (fallback para dados legados)
        let folhaRegistros;
        if (vinculoIdEfetivo) {
          folhaRegistros =
            await storage.getFolhaMesByVinculoId(vinculoIdEfetivo);
          // Fallback: se não encontrou por vínculo, tentar por pessoa (dados antigos sem vinculo_id)
          if (folhaRegistros.length === 0) {
            folhaRegistros = await storage.getFolhaMesByPessoaId(pessoaId);
          }
        } else {
          folhaRegistros = await storage.getFolhaMesByPessoaId(pessoaId);
        }

        // Get contratos - filtrar por vínculo quando disponível
        let contratos;
        if (vinculoIdEfetivo) {
          // Primeiro tenta por vínculo específico
          contratos = await storage.getContratosByVinculoId(vinculoIdEfetivo);
          // Fallback: se não encontrou contratos por vínculo, buscar contratos sem vínculo associado (dados antigos)
          if (contratos.length === 0) {
            const todosPessoa = await storage.getContratosByPessoaId(pessoaId);
            // Incluir apenas contratos que não têm vínculo atribuído ou pertencem a este vínculo
            contratos = todosPessoa.filter(
              (c) => !c.vinculoId || c.vinculoId === vinculoIdEfetivo,
            );
          }
        } else {
          contratos = await storage.getContratosByPessoaId(pessoaId);
        }

        // Get telefones da tabela clientes_telefones
        const telefones = await storage.getTelefonesByPessoaId(pessoaId);

        // Get contatos (emails) da tabela client_contacts
        const contatos = await storage.getContactsByClientId(pessoaId);

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
            // REJUR: buscar do vínculo selecionado ou primeiro vínculo
            rjur:
              vinculos.length > 0
                ? vinculos.find((v) => v.id === vinculoIdEfetivo)?.rjur ||
                  vinculos[0]?.rjur ||
                  null
                : null,
            natureza: pessoa.natureza,
            sit_func: pessoa.sitFunc,
            uf: pessoa.uf,
            municipio: pessoa.municipio,
            data_nascimento: pessoa.dataNascimento || null,
            // Telefones: combina legado (pessoa.telefonesBase) com tabela clientes_telefones
            telefones_base:
              telefones.length > 0
                ? telefones.map((t) => t.telefone)
                : pessoa.telefonesBase || [],
            telefones_detalhados: telefones.map((t) => ({
              id: t.id,
              telefone: t.telefone,
              tipo: t.tipo,
              principal: t.principal,
            })),
            // Dados bancários do cliente (onde recebe salário)
            banco_codigo: pessoa.bancoCodigo || null,
            banco_nome: pessoa.bancoNome || null,
            agencia: pessoa.agencia || null,
            conta: pessoa.conta || null,
            base_tag_ultima: pessoa.baseTagUltima,
            extras_pessoa: pessoa.extrasPessoa,
          },
          folha: {
            atual: folhaAtual
              ? {
                  competencia: safeCompetencia(folhaAtual.competencia),
                  // Margem 5% (cartão crédito consignado) - usar != null para preservar valor 0
                  margem_bruta_5:
                    folhaAtual.margemBruta5 != null
                      ? parseFloat(folhaAtual.margemBruta5)
                      : null,
                  margem_utilizada_5:
                    folhaAtual.margemUtilizada5 != null
                      ? parseFloat(folhaAtual.margemUtilizada5)
                      : null,
                  margem_saldo_5:
                    folhaAtual.margemSaldo5 != null
                      ? parseFloat(folhaAtual.margemSaldo5)
                      : null,
                  // Margem Benefício 5% (cartão benefício)
                  margem_beneficio_bruta_5:
                    folhaAtual.margemBeneficioBruta5 != null
                      ? parseFloat(folhaAtual.margemBeneficioBruta5)
                      : null,
                  margem_beneficio_utilizada_5:
                    folhaAtual.margemBeneficioUtilizada5 != null
                      ? parseFloat(folhaAtual.margemBeneficioUtilizada5)
                      : null,
                  margem_beneficio_saldo_5:
                    folhaAtual.margemBeneficioSaldo5 != null
                      ? parseFloat(folhaAtual.margemBeneficioSaldo5)
                      : null,
                  // Margem 35%
                  margem_bruta_35:
                    folhaAtual.margemBruta35 != null
                      ? parseFloat(folhaAtual.margemBruta35)
                      : null,
                  margem_utilizada_35:
                    folhaAtual.margemUtilizada35 != null
                      ? parseFloat(folhaAtual.margemUtilizada35)
                      : null,
                  margem_saldo_35:
                    folhaAtual.margemSaldo35 != null
                      ? parseFloat(folhaAtual.margemSaldo35)
                      : null,
                  // Margem 70%
                  margem_bruta_70:
                    folhaAtual.margemBruta70 != null
                      ? parseFloat(folhaAtual.margemBruta70)
                      : null,
                  margem_utilizada_70:
                    folhaAtual.margemUtilizada70 != null
                      ? parseFloat(folhaAtual.margemUtilizada70)
                      : null,
                  margem_saldo_70:
                    folhaAtual.margemSaldo70 != null
                      ? parseFloat(folhaAtual.margemSaldo70)
                      : null,
                  // Campos legados (mantidos para compatibilidade)
                  margem_cartao_credito_saldo:
                    folhaAtual.margemCartaoCreditoSaldo != null
                      ? parseFloat(folhaAtual.margemCartaoCreditoSaldo)
                      : null,
                  margem_cartao_beneficio_saldo:
                    folhaAtual.margemCartaoBeneficioSaldo != null
                      ? parseFloat(folhaAtual.margemCartaoBeneficioSaldo)
                      : null,
                  salario_bruto:
                    folhaAtual.salarioBruto != null
                      ? parseFloat(folhaAtual.salarioBruto)
                      : null,
                  descontos_brutos:
                    folhaAtual.descontosBrutos != null
                      ? parseFloat(folhaAtual.descontosBrutos)
                      : null,
                  salario_liquido:
                    folhaAtual.salarioLiquido != null
                      ? parseFloat(folhaAtual.salarioLiquido)
                      : null,
                  creditos:
                    folhaAtual.creditos != null
                      ? parseFloat(folhaAtual.creditos)
                      : null,
                  debitos:
                    folhaAtual.debitos != null
                      ? parseFloat(folhaAtual.debitos)
                      : null,
                  liquido:
                    folhaAtual.liquido != null
                      ? parseFloat(folhaAtual.liquido)
                      : null,
                  // Campos adicionais: EXC QTD, EXC Soma, Margem (colunas do schema, podem não existir no banco ainda)
                  exc_qtd:
                    (folhaAtual as any).excQtd != null
                      ? (folhaAtual as any).excQtd
                      : null,
                  exc_soma:
                    (folhaAtual as any).excSoma != null
                      ? parseFloat((folhaAtual as any).excSoma)
                      : null,
                  margem:
                    (folhaAtual as any).margem != null
                      ? parseFloat((folhaAtual as any).margem)
                      : null,
                  base_tag: folhaAtual.baseTag,
                  extras_folha: folhaAtual.extrasFolha,
                }
              : null,
            historico: folhaHistorico.map((f) => ({
              competencia: safeCompetencia(f.competencia),
              margem_saldo_5:
                f.margemSaldo5 != null ? parseFloat(f.margemSaldo5) : null,
              margem_beneficio_saldo_5:
                f.margemBeneficioSaldo5 != null
                  ? parseFloat(f.margemBeneficioSaldo5)
                  : null,
              margem_saldo_35:
                f.margemSaldo35 != null ? parseFloat(f.margemSaldo35) : null,
              margem_saldo_70:
                f.margemSaldo70 != null ? parseFloat(f.margemSaldo70) : null,
              liquido: f.liquido != null ? parseFloat(f.liquido) : null,
              base_tag: f.baseTag,
            })),
          },
          contratos: contratos.map((c) => ({
            id: c.id,
            tipo_contrato: c.tipoContrato,
            banco: c.banco, // BANCO_DO_EMPRESTIMO
            valor_parcela: c.valorParcela ? parseFloat(c.valorParcela) : null,
            saldo_devedor: c.saldoDevedor ? parseFloat(c.saldoDevedor) : null,
            parcelas_restantes: c.parcelasRestantes || null, // prazo remanescente exato da planilha
            numero_contrato: c.numeroContrato || null,
            competencia: safeCompetencia(c.competencia),
            base_tag: c.baseTag,
            dados_brutos: c.dadosBrutos,
          })),
          vinculos: vinculos.map((v) => ({
            id: v.id,
            cpf: v.cpf,
            matricula: v.matricula,
            orgao: v.orgao,
            convenio: v.convenio,
            upag: v.upag,
            rjur: v.rjur,
            sit_func: v.sitFunc,
            ativo: v.ativo,
            primeira_importacao: v.primeiraImportacao,
            ultima_atualizacao: v.ultimaAtualizacao,
            extras_vinculo: v.extrasVinculo || null,
          })),
          vinculo_selecionado: vinculoIdEfetivo,
          tem_multiplos_vinculos: vinculos.length > 1,
          higienizacao: {
            // Combina telefones da tabela clientes_telefones com telefones de client_contacts (dados complementares)
            telefones: [
              ...telefones.map((t) => ({
                telefone: t.telefone,
                tipo: t.tipo || "telefone",
                principal: t.principal,
              })),
              ...contatos
                .filter((c) => c.tipo === "telefone")
                .map((c) => ({
                  telefone: c.valor,
                  tipo: "telefone",
                  principal: null,
                })),
            ],
            emails: contatos
              .filter((c) => c.tipo === "email")
              .map((c) => c.valor),
          },
        });
      } catch (error) {
        console.error("Get cliente details error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar detalhes do cliente" });
      }
    },
  );

  // GET histórico completo de folhas de um cliente
  app.get(
    "/api/clientes/:pessoaId/historico-folha",
    requireAuth,
    async (req, res) => {
      try {
        const pessoaId = parseInt(req.params.pessoaId);
        const vinculoIdParam = req.query.vinculoId
          ? parseInt(req.query.vinculoId as string)
          : null;

        if (isNaN(pessoaId)) {
          return res.status(400).json({ message: "ID de pessoa inválido" });
        }

        // Get pessoa
        const pessoa = await storage.getClientePessoaById(pessoaId);
        if (!pessoa) {
          return res.status(404).json({ message: "Cliente não encontrado" });
        }

        // Get all vínculos for this pessoa (shared across tenants)
        const vinculosTodos = await storage.getVinculosByPessoaId(pessoaId);

        // Determinar qual vínculo usar
        let vinculoIdEfetivo: number | null = null;

        if (vinculoIdParam && !isNaN(vinculoIdParam)) {
          const vinculoValido = vinculosTodos.find(
            (v) => v.id === vinculoIdParam,
          );
          if (vinculoValido) {
            vinculoIdEfetivo = vinculoIdParam;
          }
        }

        // Se não foi especificado, buscar o vínculo com folha mais recente
        if (!vinculoIdEfetivo && vinculosTodos.length > 0) {
          const vinculoIds = vinculosTodos.map((v) => v.id);
          vinculoIdEfetivo =
            await storage.getVinculoIdWithLatestFolha(vinculoIds);
          if (!vinculoIdEfetivo) {
            vinculoIdEfetivo = vinculosTodos[0].id;
          }
        }

        // Get all folhas for this vínculo (all competências)
        let folhaRegistros;
        if (vinculoIdEfetivo) {
          folhaRegistros =
            await storage.getFolhaMesByVinculoId(vinculoIdEfetivo);
          if (folhaRegistros.length === 0) {
            folhaRegistros = await storage.getFolhaMesByPessoaId(pessoaId);
          }
        } else {
          folhaRegistros = await storage.getFolhaMesByPessoaId(pessoaId);
        }

        // Map all folhas with complete data
        const historico = folhaRegistros.map((f) => ({
          competencia: safeCompetencia(f.competencia),
          // Margem 5% (cartão crédito consignado)
          margem_bruta_5:
            f.margemBruta5 != null ? parseFloat(f.margemBruta5) : null,
          margem_utilizada_5:
            f.margemUtilizada5 != null ? parseFloat(f.margemUtilizada5) : null,
          margem_saldo_5:
            f.margemSaldo5 != null ? parseFloat(f.margemSaldo5) : null,
          // Margem Benefício 5%
          margem_beneficio_bruta_5:
            f.margemBeneficioBruta5 != null
              ? parseFloat(f.margemBeneficioBruta5)
              : null,
          margem_beneficio_utilizada_5:
            f.margemBeneficioUtilizada5 != null
              ? parseFloat(f.margemBeneficioUtilizada5)
              : null,
          margem_beneficio_saldo_5:
            f.margemBeneficioSaldo5 != null
              ? parseFloat(f.margemBeneficioSaldo5)
              : null,
          // Margem 35%
          margem_bruta_35:
            f.margemBruta35 != null ? parseFloat(f.margemBruta35) : null,
          margem_utilizada_35:
            f.margemUtilizada35 != null
              ? parseFloat(f.margemUtilizada35)
              : null,
          margem_saldo_35:
            f.margemSaldo35 != null ? parseFloat(f.margemSaldo35) : null,
          // Margem 70%
          margem_bruta_70:
            f.margemBruta70 != null ? parseFloat(f.margemBruta70) : null,
          margem_utilizada_70:
            f.margemUtilizada70 != null
              ? parseFloat(f.margemUtilizada70)
              : null,
          margem_saldo_70:
            f.margemSaldo70 != null ? parseFloat(f.margemSaldo70) : null,
          // Valores monetários
          salario_bruto:
            f.salarioBruto != null ? parseFloat(f.salarioBruto) : null,
          salario_liquido:
            f.salarioLiquido != null ? parseFloat(f.salarioLiquido) : null,
          creditos: f.creditos != null ? parseFloat(f.creditos) : null,
          debitos: f.debitos != null ? parseFloat(f.debitos) : null,
          liquido: f.liquido != null ? parseFloat(f.liquido) : null,
          base_tag: f.baseTag,
        }));

        return res.json({
          pessoa_id: pessoaId,
          vinculo_id: vinculoIdEfetivo,
          nome: pessoa.nome,
          cpf: pessoa.cpf,
          total_competencias: historico.length,
          historico,
        });
      } catch (error) {
        console.error("Get histórico folha error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar histórico de folhas" });
      }
    },
  );

  // ===== PRICING SETTINGS ENDPOINTS (MODELO DE PACOTES) =====

  // GET pricing settings - Master only - Retorna tabela de pacotes
  app.get(
    "/api/pricing-settings",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios"),
    async (req, res) => {
      try {
        const pacotes = await getPacotesPreco();

        return res.json({
          pacotes,
          message:
            "Modelo de precificação por PACOTES. Os valores podem ser editados pelo administrador.",
        });
      } catch (error) {
        console.error("Get pricing settings error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar configurações de preços" });
      }
    },
  );

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
  app.get(
    "/api/pacotes-preco/all",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios"),
    async (req, res) => {
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
    },
  );

  // PUT update a pacote - Master only
  app.put(
    "/api/pacotes-preco/:id",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios"),
    async (req, res) => {
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
        if (result.data.quantidadeMaxima !== undefined)
          updateData.quantidadeMaxima = result.data.quantidadeMaxima;
        if (result.data.nomePacote !== undefined)
          updateData.nomePacote = result.data.nomePacote;
        if (result.data.preco !== undefined)
          updateData.preco = String(result.data.preco);
        if (result.data.ordem !== undefined)
          updateData.ordem = result.data.ordem;
        if (result.data.ativo !== undefined)
          updateData.ativo = result.data.ativo;

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
    },
  );

  // ===== PEDIDOS LISTA ENDPOINTS =====

  // POST simular pedido de lista - MASTER ONLY
  app.post(
    "/api/pedidos-lista/simular",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const result = filtrosPedidoListaSchema.safeParse(
          req.body.filtros || req.body,
        );

        if (!result.success) {
          return res.status(400).json({
            message: "Filtros inválidos",
            errors: result.error.errors,
          });
        }

        const filtros = result.data;
        const { clientes, total } = await storage.searchClientesPessoa(
          filtros,
          { limit: 10 },
        );

        // Calcula preço usando modelo de pacotes
        const pricing = await calculatePackagePrice(total);

        // Return preview (first 10), total, and pricing
        return res.json({
          total,
          nomePacote: pricing.nomePacote,
          quantidadePacote: pricing.quantidadePacote,
          precoTotal: pricing.precoTotal,
          pacotes: await getPacotesPreco(),
          preview: clientes.map((c: any) => ({
            matricula: c.matricula,
            nome: c.nome,
            cpf: c.cpf ? `***${c.cpf.slice(-4)}` : null, // Mask CPF
            convenio: c.convenio,
            orgao: c.orgaodesc,
            uf: c.uf,
            sit_func: c.sitFunc,
            // Campos de desconto fora de folha
            exc_qtd: c.exc_qtd ?? null,
            exc_soma: c.exc_soma ? parseFloat(c.exc_soma) : null,
            margem: c.margem ? parseFloat(c.margem) : null,
            has_desconto_fora_folha: c.has_desconto_fora_folha ?? false,
          })),
        });
      } catch (error) {
        console.error("Simulate pedido error:", error);
        return res.status(500).json({ message: "Erro ao simular pedido" });
      }
    },
  );

  // POST criar pedido de lista - MASTER ONLY
  app.post(
    "/api/pedidos-lista",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const result = filtrosPedidoListaSchema.safeParse(
          req.body.filtros || req.body,
        );

        if (!result.success) {
          return res.status(400).json({
            message: "Filtros inválidos",
            errors: result.error.errors,
          });
        }

        const filtros = result.data;
        const { total } = await storage.searchClientesPessoa(filtros);

        // Se o usuário selecionou um pacote manualmente, validamos contra a lista de pacotes do servidor
        // O cliente envia o nome do pacote, e buscamos o preço autoritativo no servidor
        const pacoteSelecionadoNome = req.body.pacoteSelecionado?.nomePacote;
        let nomePacote: string;
        let precoFinal: number;

        const pacotesServidor = await getPacotesPreco();

        // Quantidade efetiva que será exportada (pode ser limitada pelo pacote)
        let quantidadeEfetiva = total;

        if (pacoteSelecionadoNome) {
          // Buscar o pacote pelo nome na lista autoritativa do servidor
          const pacoteValido = pacotesServidor.find(
            (p) => p.nomePacote === pacoteSelecionadoNome,
          );

          if (!pacoteValido) {
            return res.status(400).json({
              message: `Pacote "${pacoteSelecionadoNome}" não encontrado na tabela de preços`,
            });
          }

          // Se o total excede o limite do pacote, aplicar corte automático
          // O pedido será gerado com a quantidade limitada ao tamanho do pacote
          if (total > pacoteValido.quantidadeMaxima) {
            quantidadeEfetiva = pacoteValido.quantidadeMaxima;
            console.log(
              `[Pedido] Corte automático aplicado: ${total.toLocaleString("pt-BR")} -> ${quantidadeEfetiva.toLocaleString("pt-BR")} registros (pacote ${pacoteValido.nomePacote})`,
            );
          }

          nomePacote = pacoteValido.nomePacote;
          precoFinal = pacoteValido.preco; // Preço autoritativo do servidor
        } else {
          const pricing = await calculatePackagePrice(total, pacotesServidor);
          nomePacote = pricing.nomePacote;
          precoFinal = pricing.precoTotal;
        }

        const isMaster = req.user!.role === "master";
        const statusInicial = isMaster ? "aprovado" : "pendente";

        const pedido = await storage.createPedidoLista({
          coordenadorId: req.user!.id,
          filtrosUsados: filtros,
          quantidadeRegistros: quantidadeEfetiva,
          tipo: "exportacao_base",
          status: statusInicial,
          nomePacote: nomePacote,
          custoEstimado: String(precoFinal),
          statusFinanceiro: "pendente",
        });

        if (isMaster) {
          generatePedidoListaFile(pedido.id, pedido).catch(async (err) => {
            console.error("[PedidoLista] Error generating file (auto-approved):", err);
            try {
              await storage.updatePedidoLista(pedido.id, { status: "erro" });
            } catch (e) {
              console.error("[PedidoLista] Failed to update status on error:", e);
            }
          });
        }

        const corteFoiAplicado = quantidadeEfetiva < total;
        const baseMsg = corteFoiAplicado
          ? `Pedido criado com sucesso. Foi aplicado corte automático: ${quantidadeEfetiva.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} registros serão exportados.`
          : "Pedido criado com sucesso";

        return res.json({
          message: isMaster ? `${baseMsg} O arquivo está sendo gerado.` : baseMsg,
          pedido: {
            id: pedido.id,
            quantidade: quantidadeEfetiva,
            quantidadeOriginal: corteFoiAplicado ? total : undefined,
            corteFoiAplicado,
            status: pedido.status,
            criadoEm: pedido.criadoEm,
          },
        });
      } catch (error) {
        console.error("Create pedido error:", error);
        return res.status(500).json({ message: "Erro ao criar pedido" });
      }
    },
  );

  // GET pedidos de lista - MASTER ONLY
  app.get(
    "/api/pedidos-lista",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        // Master sees all
        const pedidos = await storage.getAllPedidosLista();

        return res.json(pedidos);
      } catch (error) {
        console.error("Get pedidos error:", error);
        return res.status(500).json({ message: "Erro ao buscar pedidos" });
      }
    },
  );

  // ===== ADMIN PEDIDOS LISTA - MASTER ONLY =====

  // GET /api/pedidos-lista/admin - Lista todos os pedidos com info do coordenador - MASTER ONLY
  app.get(
    "/api/pedidos-lista/admin",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const pedidos = await storage.getAllPedidosListaWithUser();

        return res.json(
          pedidos.map((p) => ({
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
          })),
        );
      } catch (error) {
        console.error("Get pedidos admin error:", error);
        return res.status(500).json({ message: "Erro ao buscar pedidos" });
      }
    },
  );

  // POST /api/pedidos-lista/:id/aprovar - Aprovar pedido - MASTER ONLY
  app.post(
    "/api/pedidos-lista/:id/aprovar",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
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
          return res
            .status(400)
            .json({ message: `Pedido já está com status: ${pedido.status}` });
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
    },
  );

  // POST /api/pedidos-lista/:id/reprocessar - Reprocessar pedido com erro - MASTER ONLY
  app.post(
    "/api/pedidos-lista/:id/reprocessar",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const pedido = await storage.getPedidoLista(id);
        if (!pedido) {
          return res.status(404).json({ message: "Pedido não encontrado" });
        }

        if (pedido.status !== "erro") {
          return res.status(400).json({
            message: `Apenas pedidos com erro podem ser reprocessados. Status atual: ${pedido.status}`,
          });
        }

        // Reset status to aprovado and start processing again
        await storage.updatePedidoListaStatus(id, "aprovado");

        // Start async file generation (fire-and-forget)
        generatePedidoListaFile(id, pedido).catch(async (err) => {
          console.error("[PedidoLista] Error reprocessing file:", err);
          try {
            await storage.updatePedidoLista(id, { status: "erro" });
          } catch (e) {
            console.error("[PedidoLista] Failed to update status on error:", e);
          }
        });

        return res.json({
          message:
            "Pedido enviado para reprocessamento. O arquivo está sendo gerado.",
          pedido: { id, status: "aprovado" },
        });
      } catch (error) {
        console.error("Reprocess pedido error:", error);
        return res.status(500).json({ message: "Erro ao reprocessar pedido" });
      }
    },
  );

  // POST /api/pedidos-lista/:id/cancelar - Cancelar pedido travado - MASTER ONLY
  app.post(
    "/api/pedidos-lista/:id/cancelar",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const pedido = await storage.getPedidoLista(id);
        if (!pedido) {
          return res.status(404).json({ message: "Pedido não encontrado" });
        }

        // Only allow canceling pedidos in processing states
        const cancelableStatuses = ["aprovado", "processando"];
        if (!cancelableStatuses.includes(pedido.status)) {
          return res.status(400).json({
            message: `Apenas pedidos em processamento podem ser cancelados. Status atual: ${pedido.status}`,
          });
        }

        // Update status to cancelado
        await storage.updatePedidoListaStatus(id, "cancelado");
        console.log(`[PedidoLista] Pedido ${id} canceled by user`);

        return res.json({
          message: "Pedido cancelado com sucesso.",
          pedido: { id, status: "cancelado" },
        });
      } catch (error) {
        console.error("Cancel pedido error:", error);
        return res.status(500).json({ message: "Erro ao cancelar pedido" });
      }
    },
  );

  // Function to generate CSV file for approved pedido - STREAMING/CHUNKED VERSION
  async function generatePedidoListaFile(pedidoId: number, pedido: any) {
    const startTime = Date.now();
    console.log(`[PedidoLista] ========== STARTING FILE GENERATION ==========`);
    console.log(`[PedidoLista] Pedido ID: ${pedidoId}`);
    console.log(`[PedidoLista] Start time: ${new Date().toISOString()}`);
    console.log(
      `[PedidoLista] Filtros: ${JSON.stringify(pedido.filtrosUsados || {})}`,
    );

    const CHUNK_SIZE = 5000; // Process 5000 records at a time
    const MAX_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes max timeout

    let writeStream: fs.WriteStream | null = null;
    let filePath: string = "";
    let streamError: Error | null = null;

    try {
      // Update status to processing
      console.log(`[PedidoLista] Updating status to 'processando'...`);
      await storage.updatePedidoListaStatus(pedidoId, "processando");

      // Use persistent exports directory in project root (not /tmp which is volatile)
      const exportsDir = path.join(process.cwd(), "exports");
      console.log(`[PedidoLista] Exports directory: ${exportsDir}`);

      if (!fs.existsSync(exportsDir)) {
        console.log(`[PedidoLista] Creating exports directory...`);
        fs.mkdirSync(exportsDir, { recursive: true });
      }
      console.log(
        `[PedidoLista] Exports directory exists: ${fs.existsSync(exportsDir)}`,
      );

      // Get filtered clients - first just count to know the total
      const filtros = pedido.filtrosUsados || {};
      console.log(`[PedidoLista] Counting clients with filtros...`);
      const totalCount = await storage.countClientesPessoa(filtros);
      console.log(`[PedidoLista] Total count from DB: ${totalCount}`);

      // Apply package limit if specified
      const packageLimit = pedido.quantidadeRegistros || totalCount;
      const recordsToExport = Math.min(totalCount, packageLimit);

      console.log(
        `[PedidoLista] Package limit: ${packageLimit}, Records to export: ${recordsToExport}`,
      );

      if (recordsToExport === 0) {
        console.log(
          `[PedidoLista] WARNING: No records to export, marking as processado with empty file`,
        );
      }

      // Create write stream for incremental file writing
      const fileName = `lista-clientes-${pedidoId}-${Date.now()}.csv`;
      filePath = path.join(exportsDir, fileName);
      console.log(`[PedidoLista] Creating file: ${filePath}`);

      writeStream = fs.createWriteStream(filePath, { encoding: "utf-8" });

      // Set up stream error handler to capture errors during writes
      writeStream.on("error", (err) => {
        console.error(`[PedidoLista] STREAM ERROR: ${err.message}`);
        streamError = err;
      });

      // Write BOM for Excel compatibility
      console.log(`[PedidoLista] Writing BOM and headers...`);
      const bomWritten = writeStream.write("\ufeff");
      if (!bomWritten) {
        console.log(
          `[PedidoLista] Backpressure on BOM write, waiting for drain...`,
        );
        await new Promise((resolve) => writeStream!.once("drain", resolve));
      }

      // Write headers - adjusted per user request
      const headers = [
        "CPF",
        "Matricula",
        "Nome",
        "Convenio",
        "Orgao",
        "Situacao Funcional",
        "Margem Saldo 70%",
        "Margem Saldo 35%",
        "Margem Saldo CC 5%",
        "Margem Saldo CB 5%",
        "Margem Bruta 70%",
        "Margem Bruta 35%",
        "Margem Bruta CC 5%",
        "Margem Bruta CB 5%",
        "Data de Nascimento",
      ];
      const headerWritten = writeStream.write(headers.join(";") + "\n");
      if (!headerWritten) {
        console.log(
          `[PedidoLista] Backpressure on header write, waiting for drain...`,
        );
        await new Promise((resolve) => writeStream!.once("drain", resolve));
      }
      console.log(`[PedidoLista] Headers written successfully`);

      // Process in chunks
      let processedCount = 0;
      let offset = 0;
      let clientesWithoutFolha = 0;

      while (processedCount < recordsToExport) {
        // Check for stream errors
        if (streamError) {
          throw streamError;
        }

        // Check timeout
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_TIMEOUT_MS) {
          throw new Error(
            `Timeout: export exceeded ${MAX_TIMEOUT_MS / 1000 / 60} minutes (elapsed: ${Math.round(elapsed / 1000)}s)`,
          );
        }

        // Check if cancelled (re-fetch status from DB)
        const currentPedido = await storage.getPedidoLista(pedidoId);
        if (currentPedido?.status === "cancelado") {
          console.log(
            `[PedidoLista] Pedido ${pedidoId} was cancelled, aborting generation`,
          );
          // Close stream and clean up partial file
          writeStream.end();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[PedidoLista] Deleted partial file: ${filePath}`);
          }
          return; // Exit without updating status (keep it as cancelado)
        }

        const chunkLimit = Math.min(
          CHUNK_SIZE,
          recordsToExport - processedCount,
        );

        console.log(`[PedidoLista] ---- CHUNK START ----`);
        console.log(
          `[PedidoLista] Offset: ${offset}, Limit: ${chunkLimit}, Elapsed: ${Math.round(elapsed / 1000)}s`,
        );

        // Fetch chunk with pagination (skipCount=true for export chunks to avoid repeated COUNT queries)
        console.log(`[PedidoLista] Fetching clientes chunk...`);
        const { clientes } = await storage.searchClientesPessoa(filtros, {
          limit: chunkLimit,
          offset,
          skipCount: true,
        });

        console.log(`[PedidoLista] Fetched ${clientes.length} clientes`);

        if (clientes.length === 0) {
          console.log(
            `[PedidoLista] No more records at offset ${offset}, ending loop`,
          );
          break;
        }

        // Get folha data for this chunk in bulk (single query instead of N+1)
        const clienteIds = clientes.map((c) => c.id);
        console.log(
          `[PedidoLista] Fetching folha data for ${clienteIds.length} clientes...`,
        );
        const folhasByPessoaId =
          await storage.getLatestFolhaMesByPessoaIds(clienteIds);
        console.log(
          `[PedidoLista] Got ${folhasByPessoaId.size} folhas for ${clienteIds.length} clientes`,
        );

        // Write chunk to file
        let chunkRowsWritten = 0;
        for (const cliente of clientes) {
          try {
            const folhaAtual = folhasByPessoaId.get(cliente.id);

            if (!folhaAtual) {
              clientesWithoutFolha++;
            }

            const rawDateNasc = cliente.dataNascimento ??
              (cliente as typeof cliente & { data_nascimento?: string | Date | null }).data_nascimento;
            const dataNasc = rawDateNasc
              ? (() => {
                  const d = new Date(rawDateNasc as string | Date);
                  if (isNaN(d.getTime())) return "";
                  const dd = String(d.getUTCDate()).padStart(2, "0");
                  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
                  const yyyy = d.getUTCFullYear();
                  return `${dd}/${mm}/${yyyy}`;
                })()
              : "";
            const row = [
              cliente.cpf || "",
              cliente.matricula || "",
              cliente.nome || "",
              cliente.convenio || "",
              cliente.orgaodesc || "",
              folhaAtual?.sitFuncNoMes ?? cliente.sitFunc ?? "",
              folhaAtual?.margemSaldo70 ?? "",
              folhaAtual?.margemSaldo35 ?? "",
              folhaAtual?.margemSaldo5 ?? "",
              folhaAtual?.margemBeneficioSaldo5 ?? "",
              folhaAtual?.margemBruta70 ?? "",
              folhaAtual?.margemBruta35 ?? "",
              folhaAtual?.margemBruta5 ?? "",
              folhaAtual?.margemBeneficioBruta5 ?? "",
              dataNasc,
            ];

            const csvRow = row
              .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
              .join(";");
            const written = writeStream.write(csvRow + "\n");

            // Handle backpressure
            if (!written) {
              await new Promise((resolve) =>
                writeStream!.once("drain", resolve),
              );
            }

            chunkRowsWritten++;
          } catch (rowError: any) {
            console.error(
              `[PedidoLista] ERROR writing row for cliente ${cliente.id}:`,
              rowError?.message,
            );
            // Continue with next row instead of failing entire export
          }
        }

        console.log(
          `[PedidoLista] Wrote ${chunkRowsWritten} rows in this chunk`,
        );

        // Use actual rows consumed for accurate tracking
        const rowsConsumed = clientes.length;
        processedCount += rowsConsumed;
        offset += rowsConsumed;

        const progressPct = Math.round(
          (processedCount / recordsToExport) * 100,
        );
        console.log(
          `[PedidoLista] Progress: ${processedCount}/${recordsToExport} (${progressPct}%)`,
        );
        console.log(`[PedidoLista] ---- CHUNK END ----`);
      }

      console.log(
        `[PedidoLista] Loop completed. Total processed: ${processedCount}`,
      );
      console.log(
        `[PedidoLista] Clientes without folha data: ${clientesWithoutFolha}`,
      );

      // Close the stream
      console.log(`[PedidoLista] Closing write stream...`);
      await new Promise<void>((resolve, reject) => {
        writeStream!.on("finish", () => {
          console.log(`[PedidoLista] Write stream finished successfully`);
          resolve();
        });
        writeStream!.on("error", (err) => {
          console.error(`[PedidoLista] Write stream error on close:`, err);
          reject(err);
        });
        writeStream!.end();
      });

      // Verify file was created
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`[PedidoLista] File created: ${filePath}`);
        console.log(`[PedidoLista] File size: ${stats.size} bytes`);
      } else {
        throw new Error(`File was not created at ${filePath}`);
      }

      // Update pedido with file info
      console.log(`[PedidoLista] Updating pedido with file info...`);
      await storage.updatePedidoLista(pedidoId, {
        arquivoPath: filePath,
        arquivoGeradoEm: new Date(),
        status: "processado",
        custoFinal: pedido.custoEstimado, // Set custo_final = custo_estimado by default
      });

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`[PedidoLista] ========== COMPLETED SUCCESSFULLY ==========`);
      console.log(
        `[PedidoLista] Pedido ${pedidoId} completed in ${totalTime}s`,
      );
      console.log(
        `[PedidoLista] Total records: ${processedCount}, File: ${filePath}`,
      );
    } catch (error: any) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.error(
        `[PedidoLista] ERROR for pedido ${pedidoId} after ${elapsed}s:`,
        error?.message || error,
      );
      console.error(`[PedidoLista] Stack trace:`, error?.stack);

      try {
        await storage.updatePedidoLista(pedidoId, { status: "erro" });
        console.log(
          `[PedidoLista] Status updated to 'erro' for pedido ${pedidoId}`,
        );
      } catch (updateError) {
        console.error(
          `[PedidoLista] Failed to update status to 'erro':`,
          updateError,
        );
      }

      throw error;
    }
  }

  // Helper function to generate descriptive filename from filters
  // Format: Pedido_{ID}_{FilterSummary}.csv
  function gerarNomeArquivoLista(pedidoId: number, filtros: any): string {
    const parts: string[] = [`Pedido_${pedidoId}`];

    // Extract main filter values in priority order
    if (filtros?.orgao) parts.push(`Orgao_${filtros.orgao}`);
    if (filtros?.convenio) parts.push(`Convenio_${filtros.convenio}`);
    if (filtros?.uf) parts.push(`UF_${filtros.uf}`);
    if (filtros?.bancos && filtros.bancos.length > 0)
      parts.push(
        `Bancos_${filtros.bancos.map((b) => String(b).replace(/\s+/g, "_")).join("-")}`,
      );
    if (filtros?.situacaoFuncional)
      parts.push(`Situacao_${filtros.situacaoFuncional}`);

    // Age range (if both present)
    if (filtros?.idade_min && filtros?.idade_max) {
      parts.push(`Idade_${filtros.idade_min}-${filtros.idade_max}`);
    } else if (filtros?.idadeMin && filtros?.idadeMax) {
      parts.push(`Idade_${filtros.idadeMin}-${filtros.idadeMax}`);
    }

    // Margem 30% range
    if (filtros?.margem_30_min && filtros?.margem_30_max) {
      parts.push(`Margem30_${filtros.margem_30_min}-${filtros.margem_30_max}`);
    } else if (filtros?.margem30Min && filtros?.margem30Max) {
      parts.push(`Margem30_${filtros.margem30Min}-${filtros.margem30Max}`);
    }

    // Build filename
    let nome = parts.join("_") + ".csv";

    // Sanitize: remove invalid characters, replace spaces with underscores
    nome = nome
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_.-]/g, "_")
      .replace(/_+/g, "_");

    // Limit total length to 150 characters
    if (nome.length > 150) {
      nome = nome.substring(0, 146) + ".csv";
    }

    return nome;
  }

  // GET /api/pedidos-lista/:id/download - Download generated file - MASTER ONLY
  app.get(
    "/api/pedidos-lista/:id/download",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
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
        if (pedido.status !== "processado") {
          return res.status(400).json({
            message:
              pedido.status === "aprovado"
                ? "O arquivo ainda está sendo gerado. Aguarde alguns instantes."
                : "Arquivo não disponível para download",
          });
        }

        // Check if file exists - if not, regenerate it using chunked streaming
        let filePath = pedido.arquivoPath;
        if (!filePath || !fs.existsSync(filePath)) {
          console.log(
            `[PedidoLista] File not found, regenerating for pedido ${id}`,
          );

          // Regenerate using the same chunked approach as generatePedidoListaFile
          await generatePedidoListaFile(id, pedido);

          // Reload pedido to get the new file path
          const updatedPedido = await storage.getPedidoLista(id);
          filePath = updatedPedido?.arquivoPath || null;

          if (!filePath || !fs.existsSync(filePath)) {
            return res
              .status(500)
              .json({ message: "Erro ao regenerar arquivo" });
          }

          console.log(`[PedidoLista] File regenerated: ${filePath}`);
        }

        // Generate descriptive filename based on filters
        const fileName = gerarNomeArquivoLista(id, pedido.filtrosUsados);
        console.log(`[PedidoLista] Download file: ${fileName}`);
        res.download(filePath, fileName);
      } catch (error) {
        console.error("Download pedido error:", error);
        return res.status(500).json({ message: "Erro ao baixar arquivo" });
      }
    },
  );

  // POST /api/pedidos-lista/:id/rejeitar - Rejeitar pedido - MASTER ONLY
  app.post(
    "/api/pedidos-lista/:id/rejeitar",
    requireAuth,
    requireModuleAccess("modulo_base_clientes"),
    async (req, res) => {
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
          return res
            .status(400)
            .json({ message: `Pedido já está com status: ${pedido.status}` });
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
    },
  );

  // ===== ACADEMIA CONSIGONE ENDPOINTS =====

  // Prompt mestre do treinador IA
  const TREINADOR_SYSTEM_PROMPT = `Você é um cliente real, servidor público ou beneficiário, habituado a crédito consignado e cartão consignado.
Você entende o básico do produto (desconto em folha, margem, limite de 30%) e não age como leigo.

Seu papel é simular situações reais de venda, com comportamentos naturais, objetivos e coerentes com a realidade do mercado.

=== NECESSIDADES REAIS DO CLIENTE (OBRIGATÓRIO) ===

Em todo treinamento, você deve ter uma necessidade clara, escolhida de forma aleatória entre:
- Reforma ou melhoria da casa
- Compra de carro ou moto
- Entrada ou aquisição de imóvel
- Viagem planejada
- Estudos (do próprio cliente ou de filho)
- Abertura ou investimento em negócio
- Tratamento de saúde ou despesa médica
- Organização financeira / quitação de dívidas

⚠️ Nunca revele essa necessidade de imediato.
O corretor precisa descobrir fazendo as perguntas certas.

Se o corretor identificar corretamente:
- A necessidade
- A urgência
- A motivação emocional
👉 Ele deve ganhar pontuação extra na avaliação.

=== TEMPO PARA A SOLUÇÃO ===

Você sempre tem um prazo implícito, escolhido aleatoriamente:
- Precisa do dinheiro com urgência
- Precisa em poucos dias
- Pode aguardar, mas quer resolver logo
- Não tem pressa, mas quer organizar

Se o corretor identificar esse tempo corretamente e ajustar o discurso ao prazo, ele ganha pontuação extra.

=== COMPORTAMENTO SOBRE TAXA (REALISTA) ===

Você questiona taxa apenas uma vez, de forma direta:
"Qual é a taxa que vocês trabalham?"

Reação conforme a taxa informada:
- Até 1,55%: Baixa resistência, aceitação natural, avança para prazo e valor
- Acima de 1,55%: Questiona comparando com mercado, testa o corretor, abre espaço para argumentação

⚠️ Nunca repita a pergunta sobre taxa várias vezes.

=== SITUAÇÕES DE INDECISÃO (OBRIGATÓRIO) ===

Em alguns cenários, você deve demonstrar incompatibilidade entre desejo e capacidade:
- Gostou do valor liberado, mas a parcela ficou alta
- A parcela cabe, mas o valor liberado ficou baixo
- Quer fechar, mas precisa ajustar prazo ou valor
- Está no limite da margem

Se o corretor souber ajustar a proposta (prazo, valor, parcela), conduzir com lógica e clareza, e manter o fechamento possível, ele ganha pontuação extra.

Se o corretor não souber ajustar: você fica indeciso, pode desistir ou pedir tempo.

=== PAGAMENTO E DESCONTO EM FOLHA ===

- Você não entra em paranoia sobre não pagar
- Você sabe que o desconto é automático
- Pode perguntar uma vez sobre impacto no salário líquido
- Não insiste em medo de inadimplência ou perda de emprego

=== FECHAMENTO ===

Se o corretor:
- Descobrir a necessidade
- Entender o prazo
- Ajustar a proposta à realidade financeira
- Argumentar com segurança

👉 Aceite o fechamento naturalmente, como um cliente real:
"Pode seguir."
"Vamos fazer."
"Me manda que eu assino."

Se o corretor for confuso, ignorar sua realidade ou forçar algo incompatível, não feche.

=== TOM E ESTILO DA CONVERSA ===

- Linguagem simples
- Frases curtas
- Conversa natural de WhatsApp
- Sem repetição de objeções
- Sem discurso longo
- Sem comportamento teatral
- Você deve parecer uma pessoa real falando no dia a dia

=== REGRA FINAL ===

- Você não ensina o corretor
- Não dá dicas
- Não corrige
- Apenas reage como cliente real

=== MODOS DE OPERAÇÃO (campo "modo" na requisição) ===

1) modo = "roleplay_cliente"
   - Agir SOMENTE como cliente humano seguindo TODAS as regras acima.
   - Recebe nível_atual, fala do corretor e, opcionalmente, um histórico resumido.
   - Responder com 1 a 3 frases, variando humor e perfil do cliente.
   - Não dar aula nem falar como consultor; é cliente conversando.
   - MANTENHA COERÊNCIA com a necessidade, urgência e perfil escolhidos no início.

2) modo = "avaliacao_roleplay"
   - Recebe nível_atual, contexto e fala_corretor.
   - Avalia a fala do corretor em: Humanização, Consultoria, Clareza, Venda.
   - BÔNUS se o corretor descobriu: necessidade real, urgência, motivação emocional.
   - Para Nível 1, não exigir que o corretor pergunte tudo de uma vez. Ele pode perguntar por partes.
   - Responder EXCLUSIVAMENTE em JSON no formato: {"nota_global": 8.5, "nota_humanizacao": 9, "nota_consultivo": 8, "nota_clareza": 8, "nota_venda": 9, "comentario_geral": "...", "pontos_fortes": ["..."], "pontos_melhorar": ["..."], "nivel_atual": 1, "nivel_sugerido": 1, "aprovado_para_proximo_nivel": false}

3) modo = "abordagem_ia"
   - Recebe canal, tipo_cliente, produto_foco e contexto.
   - Gera abordagem inicial perfeita, natural e ética.
   - Responder EXCLUSIVAMENTE em JSON com: abertura_resumida, objetivo_abordagem, perguntas_consultivas (array), exploracao_dor, proposta_valor, gatilhos_usados (array), script_pronto_ligacao, script_pronto_whatsapp.`;

  // Helper function to get the effective roleplay prompt for a user
  // Returns { promptText, variante, descricaoVariante } for Modo Livre with persona variation
  async function getEffectiveRoleplayPrompt(userId: number): Promise<{
    promptText: string;
    variante?: string | null;
    descricaoVariante?: string | null;
  }> {
    try {
      // 1. Check if user belongs to a team
      const userMembership = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .limit(1);

      if (userMembership.length > 0) {
        const teamId = userMembership[0].teamId;

        // 2. Check for team-specific active prompt
        const teamPrompt = await db
          .select()
          .from(aiPrompts)
          .where(
            and(
              eq(aiPrompts.type, "roleplay"),
              eq(aiPrompts.scope, "team"),
              eq(aiPrompts.teamId, teamId),
              eq(aiPrompts.isActive, true),
            ),
          )
          .limit(1);

        if (teamPrompt.length > 0) {
          console.log(
            `[Roleplay] Using team-specific prompt for user ${userId}, team ${teamId}`,
          );
          return { promptText: teamPrompt[0].promptText };
        }
      }

      // 3. Fetch ALL active global prompts with variants
      const globalPrompts = await db
        .select()
        .from(aiPrompts)
        .where(
          and(
            eq(aiPrompts.type, "roleplay"),
            eq(aiPrompts.scope, "global"),
            eq(aiPrompts.isActive, true),
          ),
        );

      // Filter to only variants (those with variante field set)
      const variantes = globalPrompts.filter((p) => p.variante);

      if (variantes.length > 0) {
        // 4. RANDOM SELECTION - Choose one variant randomly
        const varianteSorteada =
          variantes[Math.floor(Math.random() * variantes.length)];
        console.log(
          `[Roleplay] Randomly selected persona "${varianteSorteada.variante}" for user ${userId}`,
        );
        return {
          promptText: varianteSorteada.promptText,
          variante: varianteSorteada.variante,
          descricaoVariante: varianteSorteada.descricaoVariante,
        };
      }

      // 5. Fallback to legacy global prompt (without variant)
      const legacyPrompt = globalPrompts.find((p) => !p.variante);
      if (legacyPrompt) {
        console.log(`[Roleplay] Using legacy global prompt for user ${userId}`);
        return { promptText: legacyPrompt.promptText };
      }

      // 6. Fallback to hardcoded default
      console.log(
        `[Roleplay] Using default hardcoded prompt for user ${userId}`,
      );
      return { promptText: TREINADOR_SYSTEM_PROMPT };
    } catch (error) {
      console.error("[Roleplay] Error fetching prompt, using default:", error);
      return { promptText: TREINADOR_SYSTEM_PROMPT };
    }
  }

  // POST /api/treinador-consigone - Endpoint principal do treinador IA
  app.post(
    "/api/treinador-consigone",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        const result = treinadorRequestSchema.safeParse(req.body);

        if (!result.success) {
          return res.status(400).json({
            message: "Dados inválidos",
            errors: result.error.errors,
          });
        }

        const {
          modo,
          nivelAtual,
          falaCorretor,
          canal,
          tipoCliente,
          produtoFoco,
          contexto,
          historicoResumido,
          sessaoId,
          avaliarResposta,
          tom,
          cenario,
          tipoModo,
          nivelPromptId,
        } = result.data;
        const userId = req.user!.id;
        const tenantId = req.user!.tenantId || 1;

        // Import OpenAI client
        const { openai } = await import("./openaiClient");

        let userMessage = "";
        let responseFormat: "text" | "json" = "text";

        // Build user message based on mode
        if (modo === "roleplay_cliente") {
          // Se há cenário mas não fala, inicia o roleplay com cenário
          if (!falaCorretor && !cenario) {
            return res.status(400).json({
              message:
                "falaCorretor ou cenario é obrigatório para roleplay_cliente",
            });
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
            return res.status(400).json({
              message: "falaCorretor é obrigatório para avaliacao_roleplay",
            });
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
            return res.status(400).json({
              message:
                "canal, tipoCliente e produtoFoco são obrigatórios para abordagem_ia",
            });
          }

          // Descrição detalhada do tom
          const tomDescricao = tom
            ? {
                consultiva_acolhedora:
                  "Tom humano, empático, sem pressão. Perguntas abertas, validação de sentimentos. Para clientes sensíveis, negativados ou desconfiados.",
                direta_objetiva:
                  "Linha reta, focada em benefício prático. Sem rodeios, objetivo claro. Para clientes ocupados ou servidores públicos pragmáticos.",
                persuasiva_profissional:
                  "Usa prova social, ancoragem, autoridade. Tom de especialista que domina o assunto. Gatilhos: escassez moderada, reciprocidade.",
                alta_conversao:
                  "Ataca dor real, cria urgência saudável. Gatilhos fortes: medo de perda, oportunidade única, tempo limitado. Para clientes indecisos que precisam de empurrão.",
                ultra_premium:
                  "Tom consultor premium, estilo 'private banker'. Linguagem sofisticada, exclusividade. Para servidores antigos com salário alto.",
              }[tom]
            : null;

          userMessage = `modo: abordagem_ia
canal: ${canal}
tipo_cliente: ${tipoCliente}
produto_foco: ${produtoFoco}
${
  tom
    ? `tom_abordagem: ${tom}
estilo_tom: ${tomDescricao}`
    : ""
}
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

        console.log(
          `[Academia] Calling OpenAI for mode: ${modo}, user: ${userId}, tipoModo: ${tipoModo || "livre"}`,
        );

        // Get the effective prompt for this user
        // For Modo Níveis, use the specific nivel prompt; otherwise use team/global prompt
        let effectivePrompt: string;
        let selectedNivelPrompt: any = null;
        let personaSorteada: {
          variante?: string | null;
          descricao?: string | null;
        } = {};

        if (tipoModo === "niveis") {
          // Modo Níveis: require nivel prompt
          if (!nivelPromptId && !nivelAtual) {
            return res.status(400).json({
              message:
                "Para Modo Níveis, é necessário especificar nivelPromptId ou nivelAtual",
            });
          }

          // Fetch the specific nivel prompt by nivelAtual (one prompt per level per tenant)
          const nivelPrompt = await storage.getRoleplayNivelPrompt(
            nivelAtual,
            tenantId,
          );

          if (
            nivelPrompt &&
            nivelPrompt.promptCompleto &&
            nivelPrompt.isActive
          ) {
            effectivePrompt = nivelPrompt.promptCompleto;
            selectedNivelPrompt = nivelPrompt;
            console.log(
              `[Academia] Using Modo Níveis prompt for level ${nivelAtual}: ${nivelPrompt.nome}`,
            );
          } else {
            return res.status(400).json({
              message: `Prompt do nível ${nivelAtual} não encontrado ou não está ativo`,
            });
          }
        } else {
          // Modo Livre: use team-specific or global prompt with random persona selection
          const promptResult = await getEffectiveRoleplayPrompt(userId);
          effectivePrompt = promptResult.promptText;
          personaSorteada = {
            variante: promptResult.variante,
            descricao: promptResult.descricaoVariante,
          };
        }

        // For roleplay_cliente, we need to include conversation history
        let messagesForOpenAI: {
          role: "system" | "user" | "assistant";
          content: string;
        }[] = [{ role: "system", content: effectivePrompt }];

        // If this is a roleplay session, include conversation history for context
        if (modo === "roleplay_cliente" && sessaoId) {
          // Fetch existing session history
          const existingSession = await db
            .select()
            .from(roleplaySessoes)
            .where(eq(roleplaySessoes.id, sessaoId))
            .limit(1);
          if (existingSession.length > 0) {
            const historico =
              (existingSession[0].historicoConversa as any[]) || [];

            // Convert session history to OpenAI format
            // Limit to last 20 exchanges (40 messages) to avoid token limits
            const recentHistory = historico.slice(-40);

            for (const msg of recentHistory) {
              if (msg.role === "corretor") {
                messagesForOpenAI.push({ role: "user", content: msg.content });
              } else if (msg.role === "cliente") {
                messagesForOpenAI.push({
                  role: "assistant",
                  content: msg.content,
                });
              }
            }

            console.log(
              `[Academia] Including ${recentHistory.length} messages from session history`,
            );
          }
        }

        // Add the current message
        messagesForOpenAI.push({ role: "user", content: userMessage });

        // Call OpenAI with full conversation history
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: messagesForOpenAI,
          temperature: 0.7,
          max_tokens: 1500,
        });

        const aiResponse = completion.choices[0]?.message?.content || "";
        console.log(
          `[Academia] OpenAI response received, length: ${aiResponse.length}, messages sent: ${messagesForOpenAI.length}`,
        );

        // Process response based on mode
        const LIMITE_MENSAGENS_ROLEPLAY = 10; // Limite de mensagens do corretor por sessão

        if (modo === "roleplay_cliente") {
          // Get or create session
          let sessao;
          if (sessaoId) {
            sessao = await db
              .select()
              .from(roleplaySessoes)
              .where(eq(roleplaySessoes.id, sessaoId))
              .limit(1);
            if (sessao.length === 0) {
              return res.status(404).json({ message: "Sessão não encontrada" });
            }
            sessao = sessao[0];

            // Verificar se sessão já foi finalizada
            if (sessao.status === "finalizada") {
              return res.status(400).json({
                message:
                  "Esta sessão já foi finalizada. Inicie uma nova sessão.",
                sessaoFinalizada: true,
              });
            }

            // Verificar se já atingiu o limite ANTES de processar
            if ((sessao.totalMensagens || 0) >= LIMITE_MENSAGENS_ROLEPLAY) {
              // Marcar como finalizada se ainda não estiver
              await db
                .update(roleplaySessoes)
                .set({ status: "finalizada", finalizadoEm: new Date() })
                .where(eq(roleplaySessoes.id, sessao.id));

              return res.status(400).json({
                message:
                  "Limite de mensagens atingido. Inicie uma nova sessão.",
                sessaoFinalizada: true,
                mensagensEnviadas: sessao.totalMensagens || 0,
                limiteMensagens: LIMITE_MENSAGENS_ROLEPLAY,
              });
            }
          } else {
            const [newSessao] = await db
              .insert(roleplaySessoes)
              .values({
                userId,
                nivelTreinado: nivelAtual,
                status: "ativa",
                historicoConversa: [],
                cenario: cenario || null,
                totalMensagens: 0,
                modo: tipoModo || "livre",
              })
              .returning();
            sessao = newSessao;
          }

          // Incrementar contador de mensagens do corretor
          const novoTotalMensagens = (sessao.totalMensagens || 0) + 1;
          const atingiuLimite = novoTotalMensagens >= LIMITE_MENSAGENS_ROLEPLAY;

          // Update conversation history
          const historico = (sessao.historicoConversa as any[]) || [];
          historico.push({
            role: "corretor",
            content: falaCorretor,
            timestamp: new Date(),
          });
          historico.push({
            role: "cliente",
            content: aiResponse,
            timestamp: new Date(),
          });

          await db
            .update(roleplaySessoes)
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
            const [sessoesFinalizadas] = await db
              .select({ count: sql`count(*)` })
              .from(roleplaySessoes)
              .where(
                and(
                  eq(roleplaySessoes.userId, userId),
                  eq(roleplaySessoes.status, "finalizada"),
                ),
              );

            await db
              .update(vendedoresAcademia)
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
                  {
                    role: "system",
                    content:
                      "Você é um avaliador de vendas consultivas. Seja conciso e direto. Sempre responda em JSON válido.",
                  },
                  { role: "user", content: avaliacaoPrompt },
                ],
                temperature: 0.5,
                max_tokens: 300,
              });

              const avaliacaoRaw =
                avaliacaoCompletion.choices[0]?.message?.content || "";
              let cleanAval = avaliacaoRaw.trim();
              if (cleanAval.startsWith("```json")) {
                cleanAval = cleanAval
                  .replace(/```json\n?/, "")
                  .replace(/```$/, "");
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
            personaSorteada: personaSorteada.variante
              ? {
                  variante: personaSorteada.variante,
                  descricao: personaSorteada.descricao,
                }
              : undefined,
          });
        } else if (modo === "avaliacao_roleplay") {
          // Parse JSON response
          let avaliacao;
          try {
            // Remove markdown code blocks if present
            let cleanResponse = aiResponse.trim();
            if (cleanResponse.startsWith("```json")) {
              cleanResponse = cleanResponse
                .replace(/```json\n?/, "")
                .replace(/```$/, "");
            } else if (cleanResponse.startsWith("```")) {
              cleanResponse = cleanResponse
                .replace(/```\n?/, "")
                .replace(/```$/, "");
            }
            avaliacao = JSON.parse(cleanResponse);
          } catch (e) {
            console.error("[Academia] Failed to parse avaliacao JSON:", e);
            return res
              .status(500)
              .json({ message: "Erro ao processar avaliação da IA" });
          }

          // Save evaluation if we have a session
          if (sessaoId) {
            // Get session details to check mode
            const [sessaoAtual] = await db
              .select()
              .from(roleplaySessoes)
              .where(eq(roleplaySessoes.id, sessaoId))
              .limit(1);
            const sessaoModo = sessaoAtual?.modo || "livre";
            const sessaoNivelTreinado =
              sessaoAtual?.nivelTreinado || nivelAtual;

            // For Modo Níveis, check if passed based on nivel-specific nota mínima
            let aprovadoProximoNivel =
              avaliacao.aprovado_para_proximo_nivel || false;
            let notaMinimaNivel = 7.0; // Default
            let nivelConfig: any = null;

            if (sessaoModo === "niveis") {
              // Get nivel configuration for nota mínima
              nivelConfig = await storage.getRoleplayNivelPrompt(
                sessaoNivelTreinado,
                tenantId,
              );
              if (nivelConfig) {
                notaMinimaNivel = nivelConfig.notaMinima || 7.0;
                // Check if passed based on nota mínima
                aprovadoProximoNivel =
                  (avaliacao.nota_global || 0) >= notaMinimaNivel;
                console.log(
                  `[Academia] Modo Níveis: nivel=${sessaoNivelTreinado}, nota=${avaliacao.nota_global}, minima=${notaMinimaNivel}, aprovado=${aprovadoProximoNivel}`,
                );
              }
            }

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
              nivelAvaliado:
                sessaoModo === "niveis" ? sessaoNivelTreinado : null,
              aprovadoProximoNivel: aprovadoProximoNivel,
              criteriosAtendidos: avaliacao.criterios_atendidos || {},
            });

            // Marcar sessão como finalizada com dados de aprovação
            await db
              .update(roleplaySessoes)
              .set({
                status: "finalizada",
                finalizadoEm: new Date(),
                aprovado: aprovadoProximoNivel,
                notaFinal: String(avaliacao.nota_global || 0),
              })
              .where(
                and(
                  eq(roleplaySessoes.id, sessaoId),
                  eq(roleplaySessoes.status, "ativa"),
                ),
              );

            // For Modo Níveis: Update vendedor's nivelAtual if passed
            if (sessaoModo === "niveis" && aprovadoProximoNivel) {
              const [vendedorAcademia] = await db
                .select()
                .from(vendedoresAcademia)
                .where(eq(vendedoresAcademia.userId, userId))
                .limit(1);

              if (vendedorAcademia) {
                // Only advance if user is still on this level (prevent skipping)
                if (
                  vendedorAcademia.nivelAtual === sessaoNivelTreinado &&
                  sessaoNivelTreinado < 5
                ) {
                  await db
                    .update(vendedoresAcademia)
                    .set({
                      nivelAtual: sessaoNivelTreinado + 1,
                      atualizadoEm: new Date(),
                    })
                    .where(eq(vendedoresAcademia.userId, userId));
                  console.log(
                    `[Academia] User ${userId} advanced to level ${sessaoNivelTreinado + 1}`,
                  );
                }
              } else {
                // Create vendedor profile with next level
                await db.insert(vendedoresAcademia).values({
                  userId,
                  nivelAtual: sessaoNivelTreinado + 1,
                  quizAprovado: false,
                  criadoEm: new Date(),
                  atualizadoEm: new Date(),
                });
                console.log(
                  `[Academia] Created profile for user ${userId} at level ${sessaoNivelTreinado + 1}`,
                );
              }
            }

            // Update user's average score from all evaluations
            const avaliacoes = await db
              .select()
              .from(roleplayAvaliacoes)
              .where(eq(roleplayAvaliacoes.userId, userId));

            // Count finalized sessions for totalSimulacoes
            const [sessoesFinalizadas] = await db
              .select({ count: sql`count(*)` })
              .from(roleplaySessoes)
              .where(
                and(
                  eq(roleplaySessoes.userId, userId),
                  eq(roleplaySessoes.status, "finalizada"),
                ),
              );

            if (avaliacoes.length > 0) {
              const mediaGlobal =
                avaliacoes.reduce(
                  (acc, a) => acc + parseFloat(a.notaGlobal),
                  0,
                ) / avaliacoes.length;
              await db
                .update(vendedoresAcademia)
                .set({
                  notaMediaGlobal: String(mediaGlobal.toFixed(2)),
                  totalSimulacoes: Number(sessoesFinalizadas?.count || 0),
                  atualizadoEm: new Date(),
                })
                .where(eq(vendedoresAcademia.userId, userId));
            }

            // Return enhanced response for Modo Níveis
            if (sessaoModo === "niveis") {
              return res.json({
                ...avaliacao,
                modo: sessaoModo,
                nivelAvaliado: sessaoNivelTreinado,
                notaMinima: notaMinimaNivel,
                aprovado: aprovadoProximoNivel,
                proximoNivel:
                  aprovadoProximoNivel && sessaoNivelTreinado < 5
                    ? sessaoNivelTreinado + 1
                    : sessaoNivelTreinado,
                nomePersona:
                  nivelConfig?.nome || `Nível ${sessaoNivelTreinado}`,
              });
            }
          }

          return res.json(avaliacao);
        } else if (modo === "abordagem_ia") {
          // Parse JSON response
          let abordagem;
          try {
            let cleanResponse = aiResponse.trim();
            if (cleanResponse.startsWith("```json")) {
              cleanResponse = cleanResponse
                .replace(/```json\n?/, "")
                .replace(/```$/, "");
            } else if (cleanResponse.startsWith("```")) {
              cleanResponse = cleanResponse
                .replace(/```\n?/, "")
                .replace(/```$/, "");
            }
            abordagem = JSON.parse(cleanResponse);
          } catch (e) {
            console.error("[Academia] Failed to parse abordagem JSON:", e);
            return res
              .status(500)
              .json({ message: "Erro ao processar abordagem da IA" });
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
        return res
          .status(500)
          .json({ message: "Erro ao processar treinamento" });
      }
    },
  );

  // GET /api/academia/perfil - Perfil do vendedor na academia
  app.get(
    "/api/academia/perfil",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Get or create profile
        let [perfil] = await db
          .select()
          .from(vendedoresAcademia)
          .where(eq(vendedoresAcademia.userId, userId))
          .limit(1);

        if (!perfil) {
          [perfil] = await db
            .insert(vendedoresAcademia)
            .values({
              userId,
              nivelAtual: 1,
              quizAprovado: false,
              totalSimulacoes: 0,
            })
            .returning();
        }

        // Get recent evaluations
        const avaliacoes = await db
          .select()
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
    },
  );

  // GET /api/academia/niveis/progresso - Progresso do vendedor nos níveis
  app.get(
    "/api/academia/niveis/progresso",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const tenantId = req.user!.tenantId || 1;

        // Get or create vendedor profile
        let [vendedor] = await db
          .select()
          .from(vendedoresAcademia)
          .where(eq(vendedoresAcademia.userId, userId))
          .limit(1);

        if (!vendedor) {
          [vendedor] = await db
            .insert(vendedoresAcademia)
            .values({
              userId,
              nivelAtual: 1,
              quizAprovado: false,
              totalSimulacoes: 0,
            })
            .returning();
        }

        const nivelAtual = vendedor.nivelAtual || 1;

        // Get all nivel prompts
        const nivelPrompts = await storage.getRoleplayNivelPrompts(tenantId);

        // Get all evaluations with nivelAvaliado for Modo Níveis
        const avaliacoes = await db
          .select()
          .from(roleplayAvaliacoes)
          .where(eq(roleplayAvaliacoes.userId, userId))
          .orderBy(sql`${roleplayAvaliacoes.criadoEm} DESC`);

        // Build progress for each level
        const niveis = [1, 2, 3, 4, 5].map((n) => {
          const nivelPrompt = nivelPrompts.find((p) => p.nivel === n);
          const avaliacoesDoNivel = avaliacoes.filter(
            (a) => a.nivelAvaliado === n,
          );
          const aprovado = avaliacoesDoNivel.some(
            (a) => a.aprovadoProximoNivel,
          );
          const melhorNota =
            avaliacoesDoNivel.length > 0
              ? Math.max(
                  ...avaliacoesDoNivel.map((a) => parseFloat(a.notaGlobal)),
                )
              : null;

          return {
            nivel: n,
            nome: nivelPrompt?.nome || `Nível ${n}`,
            descricao: nivelPrompt?.descricao || "",
            notaMinima: nivelPrompt?.notaMinima || 7.0,
            status:
              n < nivelAtual
                ? "concluido"
                : n === nivelAtual
                  ? "disponivel"
                  : "bloqueado",
            aprovado,
            melhorNota,
            tentativas: avaliacoesDoNivel.length,
          };
        });

        return res.json({
          nivelAtual,
          niveis,
        });
      } catch (error) {
        console.error("Get niveis progresso error:", error);
        return res.status(500).json({ message: "Erro ao buscar progresso" });
      }
    },
  );

  // Quiz perguntas (estáticas por enquanto)
  const QUIZ_PERGUNTAS = [
    {
      id: 1,
      pergunta:
        "Qual é o principal objetivo da COMPRA DE DÍVIDA (refin estratégico)?",
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
  app.get(
    "/api/academia/niveis",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        const { NIVEIS_ACADEMIA } = await import("@shared/academia-conteudo");
        return res.json({ niveis: NIVEIS_ACADEMIA });
      } catch (error) {
        console.error("Get niveis error:", error);
        return res.status(500).json({ message: "Erro ao buscar níveis" });
      }
    },
  );

  // GET /api/academia/progresso - Retorna progresso do usuário nas lições
  app.get(
    "/api/academia/progresso",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
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
    },
  );

  // POST /api/academia/licoes/concluir - Marcar lição como concluída
  app.post(
    "/api/academia/licoes/concluir",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const { licaoId, nivelId, respostasAtividade } = req.body;

        if (!licaoId || !nivelId) {
          return res
            .status(400)
            .json({ message: "licaoId e nivelId são obrigatórios" });
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
        const nivel = NIVEIS_ACADEMIA.find((n) => n.id === nivelId);
        const totalLicoes = nivel?.licoes.length || 0;
        const licoesConcluidas = await storage.countLicoesConcluidas(
          userId,
          nivelId,
        );

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
    },
  );

  // GET /api/academia/quiz - Retorna perguntas do quiz
  app.get(
    "/api/academia/quiz",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        // Return questions without correct answers
        const perguntas = QUIZ_PERGUNTAS.map((p) => ({
          id: p.id,
          pergunta: p.pergunta,
          opcoes: p.opcoes,
        }));

        return res.json({ perguntas });
      } catch (error) {
        console.error("Get quiz error:", error);
        return res.status(500).json({ message: "Erro ao buscar quiz" });
      }
    },
  );

  // POST /api/academia/quiz - Submeter respostas do quiz
  app.post(
    "/api/academia/quiz",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const { respostas } = req.body; // { perguntaId: opcaoIndex }

        if (!respostas || typeof respostas !== "object") {
          return res
            .status(400)
            .json({ message: "Respostas são obrigatórias" });
        }

        // Calculate score
        let acertos = 0;
        const total = QUIZ_PERGUNTAS.length;
        const resultados: {
          perguntaId: number;
          correto: boolean;
          respostaCorreta: number;
        }[] = [];

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
          const [perfil] = await db
            .select()
            .from(vendedoresAcademia)
            .where(eq(vendedoresAcademia.userId, userId))
            .limit(1);

          if (perfil) {
            await db
              .update(vendedoresAcademia)
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
    },
  );

  // GET /api/academia/sessoes - Listar sessões de roleplay do usuário
  app.get(
    "/api/academia/sessoes",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        const sessoes = await db
          .select()
          .from(roleplaySessoes)
          .where(eq(roleplaySessoes.userId, userId))
          .orderBy(sql`${roleplaySessoes.criadoEm} DESC`)
          .limit(20);

        return res.json(sessoes);
      } catch (error) {
        console.error("Get sessoes error:", error);
        return res.status(500).json({ message: "Erro ao buscar sessões" });
      }
    },
  );

  // POST /api/academia/sessoes/:id/finalizar - Finalizar sessão de roleplay
  app.post(
    "/api/academia/sessoes/:id/finalizar",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const sessaoId = parseInt(req.params.id);

        if (isNaN(sessaoId)) {
          return res.status(400).json({ message: "ID de sessão inválido" });
        }

        const [sessao] = await db
          .select()
          .from(roleplaySessoes)
          .where(
            and(
              eq(roleplaySessoes.id, sessaoId),
              eq(roleplaySessoes.userId, userId),
            ),
          )
          .limit(1);

        if (!sessao) {
          return res.status(404).json({ message: "Sessão não encontrada" });
        }

        await db
          .update(roleplaySessoes)
          .set({ status: "finalizada", finalizadoEm: new Date() })
          .where(eq(roleplaySessoes.id, sessaoId));

        return res.json({ message: "Sessão finalizada com sucesso" });
      } catch (error) {
        console.error("Finalizar sessao error:", error);
        return res.status(500).json({ message: "Erro ao finalizar sessão" });
      }
    },
  );

  // GET /api/academia/abordagens - Listar abordagens geradas pelo usuário
  app.get(
    "/api/academia/abordagens",
    requireAuth,
    requireAcademiaAccess,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        const abordagens = await db
          .select()
          .from(abordagensGeradas)
          .where(eq(abordagensGeradas.userId, userId))
          .orderBy(sql`${abordagensGeradas.criadoEm} DESC`)
          .limit(20);

        return res.json(abordagens);
      } catch (error) {
        console.error("Get abordagens error:", error);
        return res.status(500).json({ message: "Erro ao buscar abordagens" });
      }
    },
  );

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
    return [user.id, ...teamMembersData.map((m) => m.id)];
  }

  // GET /api/academia/admin/stats - Estatísticas gerais
  app.get(
    "/api/academia/admin/stats",
    requireAuth,
    requireManagerAccess,
    async (req, res) => {
      try {
        const teamUserIds = await getAcademiaTeamUserIds(req.user!);

        // Total de vendedores na academia
        let vendedoresQuery = db
          .select({ count: sql`count(*)` })
          .from(vendedoresAcademia);
        if (teamUserIds) {
          vendedoresQuery = vendedoresQuery.where(
            inArray(vendedoresAcademia.userId, teamUserIds),
          ) as any;
        }
        const [totalVendedores] = await vendedoresQuery;

        // Total aprovados no quiz
        let quizAprovadosQuery = db
          .select({ count: sql`count(*)` })
          .from(vendedoresAcademia)
          .where(eq(vendedoresAcademia.quizAprovado, true));
        if (teamUserIds) {
          quizAprovadosQuery = quizAprovadosQuery.where(
            inArray(vendedoresAcademia.userId, teamUserIds),
          ) as any;
        }
        const [quizAprovados] = await quizAprovadosQuery;

        // Total de simulações
        let simulacoesQuery = db
          .select({ count: sql`count(*)` })
          .from(roleplaySessoes);
        if (teamUserIds) {
          simulacoesQuery = simulacoesQuery.where(
            inArray(roleplaySessoes.userId, teamUserIds),
          ) as any;
        }
        const [totalSimulacoes] = await simulacoesQuery;

        // Total de abordagens geradas
        let abordagensQuery = db
          .select({ count: sql`count(*)` })
          .from(abordagensGeradas);
        if (teamUserIds) {
          abordagensQuery = abordagensQuery.where(
            inArray(abordagensGeradas.userId, teamUserIds),
          ) as any;
        }
        const [totalAbordagens] = await abordagensQuery;

        // Média geral de notas
        let notasQuery = db
          .select({
            avg: sql`avg(cast(${roleplayAvaliacoes.notaGlobal} as decimal))`,
          })
          .from(roleplayAvaliacoes);
        if (teamUserIds) {
          notasQuery = notasQuery.where(
            inArray(roleplayAvaliacoes.userId, teamUserIds),
          ) as any;
        }
        const [mediaNotas] = await notasQuery;

        return res.json({
          totalVendedores: Number(totalVendedores?.count || 0),
          quizAprovados: Number(quizAprovados?.count || 0),
          totalSimulacoes: Number(totalSimulacoes?.count || 0),
          totalAbordagens: Number(totalAbordagens?.count || 0),
          mediaNotas: mediaNotas?.avg
            ? parseFloat(String(mediaNotas.avg)).toFixed(2)
            : "0.00",
        });
      } catch (error) {
        console.error("Get academia stats error:", error);
        return res.status(500).json({ message: "Erro ao buscar estatísticas" });
      }
    },
  );

  // GET /api/academia/admin/vendedores - Listar todos os vendedores com progresso
  app.get(
    "/api/academia/admin/vendedores",
    requireAuth,
    requireManagerAccess,
    async (req, res) => {
      try {
        const teamUserIds = await getAcademiaTeamUserIds(req.user!);

        let vendedoresQuery = db
          .select({
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
          vendedoresQuery = vendedoresQuery.where(
            inArray(vendedoresAcademia.userId, teamUserIds),
          ) as any;
        }

        const vendedores = await vendedoresQuery.orderBy(
          sql`${vendedoresAcademia.criadoEm} DESC`,
        );

        return res.json(vendedores);
      } catch (error) {
        console.error("Get vendedores academia error:", error);
        return res.status(500).json({ message: "Erro ao buscar vendedores" });
      }
    },
  );

  // GET /api/academia/admin/quiz-tentativas - Listar tentativas de quiz
  app.get(
    "/api/academia/admin/quiz-tentativas",
    requireAuth,
    requireManagerAccess,
    async (req, res) => {
      try {
        const teamUserIds = await getAcademiaTeamUserIds(req.user!);

        let tentativasQuery = db
          .select({
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
          tentativasQuery = tentativasQuery.where(
            inArray(quizTentativas.userId, teamUserIds),
          ) as any;
        }

        const tentativas = await tentativasQuery
          .orderBy(sql`${quizTentativas.criadoEm} DESC`)
          .limit(100);

        return res.json(tentativas);
      } catch (error) {
        console.error("Get quiz tentativas error:", error);
        return res.status(500).json({ message: "Erro ao buscar tentativas" });
      }
    },
  );

  // POST /api/academia/admin/feedback-ia/:userId - Gerar feedback IA para um vendedor
  app.post(
    "/api/academia/admin/feedback-ia/:userId",
    requireAuth,
    requireManagerAccess,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.userId);

        // Verify coordinator can only access their team members
        const teamUserIds = await getAcademiaTeamUserIds(req.user!);
        if (teamUserIds && !teamUserIds.includes(userId)) {
          return res.status(403).json({
            message: "Acesso negado - usuário não pertence à sua equipe",
          });
        }

        // Buscar dados do vendedor
        const [vendedor] = await db
          .select({
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
        const tentativasQuiz = await db
          .select()
          .from(quizTentativas)
          .where(eq(quizTentativas.userId, userId))
          .orderBy(sql`${quizTentativas.criadoEm} DESC`);

        // Buscar sessões de roleplay e avaliações
        const sessoesRoleplay = await db
          .select()
          .from(roleplaySessoes)
          .where(eq(roleplaySessoes.userId, userId))
          .orderBy(sql`${roleplaySessoes.criadoEm} DESC`)
          .limit(20);

        // Buscar avaliações de roleplay
        const avaliacoesRoleplay = await db
          .select()
          .from(roleplayAvaliacoes)
          .where(eq(roleplayAvaliacoes.userId, userId))
          .orderBy(sql`${roleplayAvaliacoes.criadoEm} DESC`)
          .limit(50);

        // Buscar abordagens geradas
        const abordagens = await db
          .select()
          .from(abordagensGeradas)
          .where(eq(abordagensGeradas.userId, userId))
          .orderBy(sql`${abordagensGeradas.criadoEm} DESC`)
          .limit(20);

        // Buscar progresso das lições
        const progressoLicoesData = await db
          .select()
          .from(progressoLicoes)
          .where(eq(progressoLicoes.userId, userId));

        // Calcular métricas agregadas
        const totalTentativasQuiz = tentativasQuiz.length;
        const quizAprovacoes = tentativasQuiz.filter((t) => t.aprovado).length;
        const taxaAprovacaoQuiz =
          totalTentativasQuiz > 0
            ? (quizAprovacoes / totalTentativasQuiz) * 100
            : 0;

        const notasRoleplay = avaliacoesRoleplay
          .map((a) => parseFloat(a.notaGlobal as string))
          .filter((n) => !isNaN(n));
        const mediaNotaRoleplay =
          notasRoleplay.length > 0
            ? notasRoleplay.reduce((a, b) => a + b, 0) / notasRoleplay.length
            : 0;

        const notasHumanizacao = avaliacoesRoleplay
          .map((a) =>
            a.notaHumanizacao ? parseFloat(a.notaHumanizacao as string) : 0,
          )
          .filter((n) => n > 0);
        const mediaHumanizacao =
          notasHumanizacao.length > 0
            ? notasHumanizacao.reduce((a, b) => a + b, 0) /
              notasHumanizacao.length
            : 0;

        const notasConsultivo = avaliacoesRoleplay
          .map((a) =>
            a.notaConsultivo ? parseFloat(a.notaConsultivo as string) : 0,
          )
          .filter((n) => n > 0);
        const mediaConsultivo =
          notasConsultivo.length > 0
            ? notasConsultivo.reduce((a, b) => a + b, 0) /
              notasConsultivo.length
            : 0;

        const notasVenda = avaliacoesRoleplay
          .map((a) => (a.notaVenda ? parseFloat(a.notaVenda as string) : 0))
          .filter((n) => n > 0);
        const mediaVenda =
          notasVenda.length > 0
            ? notasVenda.reduce((a, b) => a + b, 0) / notasVenda.length
            : 0;

        // Pontos fortes e melhorar agregados das avaliações
        const todosFortes: string[] = [];
        const todosMelhorar: string[] = [];
        avaliacoesRoleplay.forEach((a) => {
          if (Array.isArray(a.pontosFortes))
            todosFortes.push(...(a.pontosFortes as string[]));
          if (Array.isArray(a.pontosMelhorar))
            todosMelhorar.push(...(a.pontosMelhorar as string[]));
        });

        // Frequência dos pontos fortes e melhorar
        const contarFrequencia = (arr: string[]) => {
          const freq: Record<string, number> = {};
          arr.forEach((item) => {
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
        const trintaDiasAtras = new Date(
          hoje.getTime() - 30 * 24 * 60 * 60 * 1000,
        );

        const sessoesUltimos30Dias = sessoesRoleplay.filter(
          (s) => new Date(s.criadoEm) >= trintaDiasAtras,
        ).length;
        const abordagensUltimos30Dias = abordagens.filter(
          (a) => new Date(a.criadoEm) >= trintaDiasAtras,
        ).length;

        // Tipos de abordagem mais usados
        const canaisUsados = abordagens.reduce(
          (acc, a) => {
            acc[a.canal] = (acc[a.canal] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        const tiposClienteAbordados = abordagens.reduce(
          (acc, a) => {
            acc[a.tipoCliente] = (acc[a.tipoCliente] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Lições concluídas
        const licoesConcluidas = progressoLicoesData.filter(
          (p) => p.concluida,
        ).length;
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
            percentualConclusao: (
              (licoesConcluidas / totalLicoes) *
              100
            ).toFixed(1),
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
          proximosPassos: feedback.proximosPassos
            ? [feedback.proximosPassos]
            : [],
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
    },
  );

  // ===== CRM DE VENDAS =====

  // Middleware para acesso administrativo ao ALPHA - REFACTORED to use profile-based permissions
  // Now checks for modulo_alpha permission with edit access
  async function requireCRMAdmin(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    // isMaster has full access
    if (req.user.isMaster) {
      logPermissionCheck(
        req.user.id,
        req.user.name,
        "modulo_alpha",
        "edit",
        true,
        "isMaster=true",
      );
      return next();
    }

    // Check profile-based permission for ALPHA admin (edit access)
    const hasAccess = await storage.hasModuleEditAccess(
      req.user.id,
      "modulo_alpha",
    );
    if (!hasAccess) {
      logPermissionCheck(
        req.user.id,
        req.user.name,
        "modulo_alpha",
        "edit",
        false,
        "No profile permission",
      );
      return res.status(403).json({
        message:
          "Acesso negado - você não tem permissão de administração do ALPHA",
      });
    }

    logPermissionCheck(
      req.user.id,
      req.user.name,
      "modulo_alpha",
      "edit",
      true,
      "Profile permission granted",
    );
    next();
  }

  // GET /api/vendas/campanhas - Listar campanhas
  // REFACTORED: Uses profile-based permission modulo_alpha
  app.get("/api/vendas/campanhas", requireAuth, async (req, res) => {
    try {
      // Check permission: isMaster or modulo_alpha access
      const hasAccess =
        req.user!.isMaster ||
        (await storage.hasModuleAccess(req.user!.id, "modulo_alpha"));
      if (!hasAccess) {
        logPermissionCheck(
          req.user!.id,
          req.user!.name,
          "modulo_alpha",
          "view",
          false,
          "No permission for campanhas",
        );
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Master users (isMaster) see all campaigns, others see only their tenant's
      const tenantId = req.user!.isMaster ? null : req.tenantId;
      const campanhas = await storage.getAllSalesCampaigns(tenantId);
      return res.json(campanhas);
    } catch (error) {
      console.error("Get campanhas error:", error);
      return res.status(500).json({ message: "Erro ao buscar campanhas" });
    }
  });

  // GET /api/vendas/campanhas/:id - Detalhes da campanha
  app.get(
    "/api/vendas/campanhas/:id",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.user!.isMaster ? null : req.tenantId;
        const campanha = await storage.getSalesCampaign(id, tenantId);
        if (!campanha) {
          return res.status(404).json({ message: "Campanha não encontrada" });
        }
        return res.json(campanha);
      } catch (error) {
        console.error("Get campanha error:", error);
        return res.status(500).json({ message: "Erro ao buscar campanha" });
      }
    },
  );

  // POST /api/vendas/campanhas - Criar campanha
  app.post(
    "/api/vendas/campanhas",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const parsed = insertSalesCampaignSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: "Dados inválidos", errors: parsed.error.errors });
        }

        // Set tenant_id from current tenant (or null for master creating without tenant context)
        const campanha = await storage.createSalesCampaign({
          ...parsed.data,
          createdBy: req.user!.id,
          tenantId: req.tenantId || null,
        });
        return res.status(201).json(campanha);
      } catch (error) {
        console.error("Create campanha error:", error);
        return res.status(500).json({ message: "Erro ao criar campanha" });
      }
    },
  );

  // PATCH /api/vendas/campanhas/:id - Atualizar campanha
  app.patch(
    "/api/vendas/campanhas/:id",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.user!.isMaster ? null : req.tenantId;
        const campanha = await storage.updateSalesCampaign(
          id,
          req.body,
          tenantId,
        );
        if (!campanha) {
          return res.status(404).json({ message: "Campanha não encontrada" });
        }
        return res.json(campanha);
      } catch (error) {
        console.error("Update campanha error:", error);
        return res.status(500).json({ message: "Erro ao atualizar campanha" });
      }
    },
  );

  // DELETE /api/vendas/campanhas/:id - Excluir campanha
  app.delete(
    "/api/vendas/campanhas/:id",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.user!.isMaster ? null : req.tenantId;
        await storage.deleteSalesCampaign(id, tenantId);
        return res.json({ message: "Campanha excluída com sucesso" });
      } catch (error) {
        console.error("Delete campanha error:", error);
        return res.status(500).json({ message: "Erro ao excluir campanha" });
      }
    },
  );

  // POST /api/vendas/campanhas/criar-de-filtro - Criar campanha com leads a partir de filtros
  app.post(
    "/api/vendas/campanhas/criar-de-filtro",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const { nome, descricao, filtros, limiteLeads } = req.body;

        if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
          return res
            .status(400)
            .json({ message: "Nome da campanha é obrigatório" });
        }

        const filtrosResult = filtrosPedidoListaSchema.safeParse(filtros || {});
        if (!filtrosResult.success) {
          return res.status(400).json({
            message: "Filtros inválidos",
            errors: filtrosResult.error.errors,
          });
        }

        const validFiltros = filtrosResult.data;
        const { clientes, total } =
          await storage.searchClientesPessoa(validFiltros);

        if (total === 0) {
          return res.status(400).json({
            message: "Nenhum cliente encontrado com os filtros selecionados",
          });
        }

        // Aplicar limite de leads se especificado
        const limite =
          limiteLeads && typeof limiteLeads === "number" && limiteLeads > 0
            ? Math.min(limiteLeads, clientes.length)
            : clientes.length;
        const clientesLimitados = clientes.slice(0, limite);
        const totalFinal = clientesLimitados.length;

        const campanha = await storage.createSalesCampaign({
          nome: nome.trim(),
          descricao: descricao?.trim() || null,
          origem: "compra_lista",
          convenio: validFiltros.convenio || null,
          uf: validFiltros.uf || null,
          status: "ativa",
          totalLeads: totalFinal,
          leadsDisponiveis: totalFinal,
          leadsDistribuidos: 0,
          createdBy: req.user!.id,
        });

        const leads: InsertSalesLead[] = clientesLimitados.map((cliente) => ({
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
        return res
          .status(500)
          .json({ message: "Erro ao criar campanha a partir dos filtros" });
      }
    },
  );

  // POST /api/vendas/campanhas/:id/importar-leads - Importar leads para campanha
  app.post(
    "/api/vendas/campanhas/:id/importar-leads",
    requireAuth,
    requireCRMAdmin,
    upload.single("file"),
    async (req, res) => {
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
          const parsed = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
          });
          rows = parsed.data;
        } else {
          const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }

        if (rows.length === 0) {
          return res
            .status(400)
            .json({ message: "Arquivo vazio ou formato inválido" });
        }

        // Map columns (case-insensitive)
        const COLUMN_MAP: Record<string, string> = {
          nome: "nome",
          cpf: "cpf",
          telefone_1: "telefone1",
          telefone1: "telefone1",
          "telefone 1": "telefone1",
          fone1: "telefone1",
          telefone_2: "telefone2",
          telefone2: "telefone2",
          "telefone 2": "telefone2",
          fone2: "telefone2",
          telefone_3: "telefone3",
          telefone3: "telefone3",
          "telefone 3": "telefone3",
          fone3: "telefone3",
          email: "email",
          "e-mail": "email",
          cidade: "cidade",
          municipio: "cidade",
          uf: "uf",
          estado: "uf",
          observacoes: "observacoes",
          obs: "observacoes",
          observacao: "observacoes",
        };

        // First pass: normalize all rows and collect CPFs
        const normalizedRows: {
          normalized: Record<string, any>;
          cpfLimpo: string | null;
        }[] = [];
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
          .map((r) => r.cpfLimpo)
          .filter((cpf): cpf is string => cpf !== null);

        const cpfToClienteId = new Map<string, number>();
        if (allCpfs.length > 0) {
          // Query in chunks of 1000 to avoid query size limits
          const CHUNK_SIZE = 1000;
          for (let i = 0; i < allCpfs.length; i += CHUNK_SIZE) {
            const chunk = allCpfs.slice(i, i + CHUNK_SIZE);
            const clientes = await db
              .select({ id: clientesPessoa.id, cpf: clientesPessoa.cpf })
              .from(clientesPessoa)
              .where(inArray(clientesPessoa.cpf, chunk));
            for (const c of clientes) {
              if (c.cpf) cpfToClienteId.set(c.cpf, c.id);
            }
          }
        }

        // Build leads array with cached client IDs
        const leads: InsertSalesLead[] = normalizedRows.map(
          ({ normalized, cpfLimpo }) => ({
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
            baseClienteId: cpfLimpo
              ? cpfToClienteId.get(cpfLimpo) || null
              : null,
          }),
        );

        // Insert leads in bulk
        const inserted = await storage.createSalesLeadsBulk(leads);

        // Backfill clientes_telefones for fast phone search
        try {
          const tenantIdForPhones = campanha.tenantId;
          if (tenantIdForPhones) {
            const phoneEntries = leads
              .filter((l) => l.cpf)
              .map((l) => ({
                tenantId: tenantIdForPhones,
                cpf: l.cpf as string,
                telefones: [l.telefone1, l.telefone2, l.telefone3],
              }));
            if (phoneEntries.length > 0) {
              await storage.addPessoaTelefonesByCpfBatch(phoneEntries);
            }
          }
        } catch (phoneErr) {
          console.error("[CAMPANHA-IMPORT] Falha ao popular clientes_telefones:", phoneErr);
        }

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
    },
  );

  // POST /api/vendas/campanhas/:id/distribuir-leads - Distribuir leads para vendedor
  app.post(
    "/api/vendas/campanhas/:id/distribuir-leads",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const campaignId = parseInt(req.params.id);
        const { userId, quantidade } = req.body;

        if (!userId || !quantidade || quantidade < 1) {
          return res
            .status(400)
            .json({ message: "Informe o vendedor e a quantidade de leads" });
        }

        const campanha = await storage.getSalesCampaign(campaignId);
        if (!campanha) {
          return res.status(404).json({ message: "Campanha não encontrada" });
        }

        // Get unassigned leads
        const leadsDisponiveis = await storage.getUnassignedLeads(
          campaignId,
          quantidade,
        );

        if (leadsDisponiveis.length === 0) {
          return res
            .status(400)
            .json({ message: "Não há leads disponíveis para distribuição" });
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
          leadsDisponiveis: Math.max(
            0,
            (campanha.leadsDisponiveis || 0) - leadsDisponiveis.length,
          ),
          leadsDistribuidos:
            (campanha.leadsDistribuidos || 0) + leadsDisponiveis.length,
        });

        try {
          await createNotification({
            userId,
            title: "Novos leads recebidos",
            message: `Você recebeu ${leadsDisponiveis.length} lead(s) da campanha "${campanha.nome}".`,
            type: "carteira",
            actionUrl: "/vendas/atendimento",
          });
        } catch (e) {
          console.error("[NOTIFY] Erro ao notificar distribuição:", e);
        }

        return res.json({
          message: "Leads distribuídos com sucesso",
          quantidade: leadsDisponiveis.length,
        });
      } catch (error) {
        console.error("Distribute leads error:", error);
        return res.status(500).json({ message: "Erro ao distribuir leads" });
      }
    },
  );

  // POST /api/vendas/campanhas/:id/distribuir-multi - Distribuir leads para múltiplos vendedores
  app.post(
    "/api/vendas/campanhas/:id/distribuir-multi",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const campaignId = parseInt(req.params.id);
        const { distributions } = req.body;

        if (
          !distributions ||
          !Array.isArray(distributions) ||
          distributions.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "Informe as distribuições de leads" });
        }

        // Validate distributions
        const totalRequested = distributions.reduce(
          (acc: number, d: any) => acc + (d.quantidade || 0),
          0,
        );
        if (totalRequested < 1) {
          return res
            .status(400)
            .json({ message: "A quantidade total deve ser maior que zero" });
        }

        const campanha = await storage.getSalesCampaign(campaignId);
        if (!campanha) {
          return res.status(404).json({ message: "Campanha não encontrada" });
        }

        if (totalRequested > (campanha.leadsDisponiveis || 0)) {
          return res.status(400).json({
            message: `Quantidade solicitada (${totalRequested}) excede leads disponíveis (${campanha.leadsDisponiveis})`,
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
          const leadsDisponiveis = await storage.getUnassignedLeads(
            campaignId,
            quantidade,
          );

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
            leadsDisponiveis: Math.max(
              0,
              (campanha.leadsDisponiveis || 0) - totalDistributed,
            ),
            leadsDistribuidos:
              (campanha.leadsDistribuidos || 0) + totalDistributed,
          });

          for (const r of results) {
            try {
              await createNotification({
                userId: r.userId,
                title: "Novos leads recebidos",
                message: `Você recebeu ${r.quantidade} lead(s) da campanha "${campanha.nome}".`,
                type: "carteira",
                actionUrl: "/vendas/atendimento",
              });
            } catch (e) {
              console.error(
                "[NOTIFY] Erro ao notificar distribuição multi:",
                e,
              );
            }
          }
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
    },
  );

  // GET /api/vendas/campanhas/:id/distribuicao - Estatísticas de distribuição
  app.get(
    "/api/vendas/campanhas/:id/distribuicao",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const campaignId = parseInt(req.params.id);
        const stats = await storage.getDistributionStats(campaignId);
        return res.json(stats);
      } catch (error) {
        console.error("Get distribution stats error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar estatísticas de distribuição" });
      }
    },
  );

  // POST /api/vendas/campanhas/:id/devolver-pool - Devolver leads ao pool
  app.post(
    "/api/vendas/campanhas/:id/devolver-pool",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
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
        const assignments = await db
          .select()
          .from(salesLeadAssignments)
          .where(
            and(
              eq(salesLeadAssignments.userId, userId),
              eq(salesLeadAssignments.campaignId, campaignId),
              eq(salesLeadAssignments.status, "novo"),
            ),
          );

        if (assignments.length === 0) {
          return res
            .status(400)
            .json({ message: "Nenhum lead com status 'novo' para devolver" });
        }

        // Limit to quantidade if provided
        const toReturn = quantidade
          ? assignments.slice(0, quantidade)
          : assignments;
        const assignmentIds = toReturn.map((a) => a.id);

        // Delete the assignments (returns leads to pool)
        const returnedCount = await storage.returnLeadsToPool(assignmentIds);

        // Update campaign counters
        await storage.updateSalesCampaign(campaignId, {
          leadsDisponiveis: (campanha.leadsDisponiveis || 0) + returnedCount,
          leadsDistribuidos: Math.max(
            0,
            (campanha.leadsDistribuidos || 0) - returnedCount,
          ),
        });

        return res.json({
          message: "Leads devolvidos ao pool com sucesso",
          quantidade: returnedCount,
        });
      } catch (error) {
        console.error("Return leads to pool error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao devolver leads ao pool" });
      }
    },
  );

  // POST /api/vendas/campanhas/:id/transferir - Transferir leads entre usuários
  app.post(
    "/api/vendas/campanhas/:id/transferir",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const campaignId = parseInt(req.params.id);
        const { fromUserId, toUserId, quantidade } = req.body;

        if (!fromUserId || !toUserId || !quantidade) {
          return res
            .status(400)
            .json({ message: "Informe origem, destino e quantidade" });
        }

        if (fromUserId === toUserId) {
          return res
            .status(400)
            .json({ message: "Origem e destino não podem ser iguais" });
        }

        if (quantidade < 1) {
          return res
            .status(400)
            .json({ message: "Quantidade deve ser maior que zero" });
        }

        const campanha = await storage.getSalesCampaign(campaignId);
        if (!campanha) {
          return res.status(404).json({ message: "Campanha não encontrada" });
        }

        const transferred = await storage.transferLeads(
          fromUserId,
          toUserId,
          campaignId,
          quantidade,
        );

        if (transferred === 0) {
          return res
            .status(400)
            .json({ message: "Nenhum lead disponível para transferir" });
        }

        try {
          await createNotification({
            userId: toUserId,
            title: "Leads transferidos para você",
            message: `Você recebeu ${transferred} lead(s) transferidos da campanha "${campanha.nome}".`,
            type: "carteira",
            actionUrl: "/vendas/atendimento",
          });
        } catch (e) {
          console.error("[NOTIFY] Erro ao notificar transferência:", e);
        }

        return res.json({
          message: "Leads transferidos com sucesso",
          quantidade: transferred,
        });
      } catch (error) {
        console.error("Transfer leads error:", error);
        return res.status(500).json({ message: "Erro ao transferir leads" });
      }
    },
  );

  // GET /api/vendas/campanhas/:id/exportar-leads - Exportar leads da campanha como CSV
  app.get(
    "/api/vendas/campanhas/:id/exportar-leads",
    requireAuth,
    requireCRMAdmin,
    async (req: any, res) => {
      try {
        const campaignId = parseInt(req.params.id);
        const tenantId = req.tenantId!;
        const campanha = await storage.getSalesCampaign(campaignId);
        if (!campanha || (campanha.tenantId !== null && campanha.tenantId !== tenantId)) {
          return res.status(404).json({ message: "Campanha não encontrada" });
        }

        const result = await db.execute(sql`
          SELECT 
            sl.cpf,
            sl.nome,
            sl.telefone_1,
            sl.telefone_2,
            sl.telefone_3,
            sl.observacoes,
            sl.lead_marker,
            vc.matricula,
            p.convenio,
            p.orgaodesc as orgao,
            p.sit_func,
            folha.margem_saldo_70,
            folha.margem_saldo_5,
            folha.salario_bruto
          FROM sales_leads sl
          LEFT JOIN clientes_pessoa p ON p.id = sl.base_cliente_id
          LEFT JOIN (
            SELECT DISTINCT ON (pessoa_id) pessoa_id, matricula
            FROM clientes_vinculo
            ORDER BY pessoa_id, id DESC
          ) vc ON vc.pessoa_id = p.id
          LEFT JOIN (
            SELECT DISTINCT ON (pessoa_id) pessoa_id, margem_saldo_70, margem_saldo_5, salario_bruto
            FROM clientes_folha_mes
            ORDER BY pessoa_id, competencia DESC
          ) folha ON folha.pessoa_id = p.id
          WHERE sl.campaign_id = ${campaignId}
          ORDER BY sl.nome
        `);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="campanha_${campaignId}_leads.csv"`);
        
        const csvEscape = (v: any) => {
          if (v == null) return '';
          const s = String(v);
          if (s.includes(';') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        };
        let csv = "CPF;Nome;Telefone1;Telefone2;Telefone3;Matricula;Convenio;Orgao;SitFunc;Margem70;MargemCartao;Parcela;Taxa;Banco;Observacoes\n";
        for (const row of result.rows) {
          csv += [
            csvEscape(row.cpf),
            csvEscape(row.nome),
            csvEscape(row.telefone_1),
            csvEscape(row.telefone_2),
            csvEscape(row.telefone_3),
            csvEscape(row.matricula),
            csvEscape(row.convenio),
            csvEscape(row.orgao),
            csvEscape(row.sit_func),
            csvEscape(row.margem_saldo_70),
            csvEscape(row.margem_saldo_5),
            '', // Parcela
            '', // Taxa
            '', // Banco
            csvEscape(row.observacoes),
          ].join(';') + '\n';
        }
        
        res.send(csv);
      } catch (error) {
        console.error("Exportar leads error:", error);
        return res.status(500).json({ message: "Erro ao exportar leads" });
      }
    }
  );

  // POST /api/vendas/importar-higienizados - Importar lista higienizada e criar campanha
  app.post(
    "/api/vendas/importar-higienizados",
    requireAuth,
    requireCRMAdmin,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const tenantId = req.tenantId!;
        const userId = req.user!.id;
        const { nomeCampanha, convenio, descricao } = req.body;

        if (!nomeCampanha || !req.file) {
          return res.status(400).json({ message: "Nome da campanha e arquivo CSV são obrigatórios" });
        }

        const fileContent = req.file.buffer.toString("utf-8");
        const parsed = Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true,
          delimiter: "",
          dynamicTyping: false,
        });

        if (!parsed.data || parsed.data.length === 0) {
          return res.status(400).json({ message: "Arquivo CSV vazio ou inválido" });
        }

        const COLUMN_MAP: Record<string, string> = {
          cpf: "cpf",
          nome: "nome",
          telefone1: "telefone1", telefone: "telefone1", celular: "telefone1", fone1: "telefone1", "telefone 1": "telefone1",
          telefone2: "telefone2", fone2: "telefone2", "telefone 2": "telefone2",
          telefone3: "telefone3", fone3: "telefone3", "telefone 3": "telefone3",
          matricula: "matricula",
          margem: "margem70", margem70: "margem70", "margem 70": "margem70", margem_70: "margem70",
          margemcartao: "margemCartao", "margem cartao": "margemCartao", margem_cartao: "margemCartao", "margem cartão": "margemCartao",
          parcela: "parcela", valor_parcela: "parcela",
          taxa: "taxa", taxa_real: "taxa",
          banco: "banco", banco_oferta: "banco",
          convenio: "convenioCol", convênio: "convenioCol",
          orgao: "orgao", "orgão": "orgao",
          sitfunc: "sitfunc", sit_func: "sitfunc", "situacao funcional": "sitfunc", "situação funcional": "sitfunc",
          observacoes: "observacoes", "observações": "observacoes", obs: "observacoes",
        };

        const rawHeaders = parsed.meta.fields || [];
        const headerMapping: Record<string, string> = {};
        for (const h of rawHeaders) {
          const normalized = h.toLowerCase().trim().replace(/[_\s]+/g, '').replace(/[áàã]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i').replace(/[óòõ]/g, 'o').replace(/[úù]/g, 'u').replace(/ç/g, 'c');
          for (const [key, mappedField] of Object.entries(COLUMN_MAP)) {
            const normalizedKey = key.replace(/[_\s]+/g, '');
            if (normalized === normalizedKey || normalized.includes(normalizedKey)) {
              headerMapping[h] = mappedField;
              break;
            }
          }
        }

        const newCampaign = await storage.createSalesCampaign({
          tenantId,
          nome: nomeCampanha,
          descricao: descricao || null,
          convenio: convenio || null,
          origem: "__higienizado__",
          status: "ativa",
          totalLeads: 0,
          leadsDisponiveis: 0,
          leadsDistribuidos: 0,
          createdBy: userId,
        });

        // Pre-scan all CPFs from CSV and check portfolio blocks
        const allCpfsRaw = (parsed.data as Record<string, string>[])
          .map((row) => {
            const cpfRaw = Object.entries(row).find(([h]) => {
              const norm = h.toLowerCase().trim().replace(/[_\s]+/g, "");
              return norm === "cpf";
            })?.[1];
            if (!cpfRaw) return null;
            return cpfRaw.trim().replace(/\D/g, "").padStart(11, "0");
          })
          .filter(Boolean) as string[];

        let blockedCpfs = new Set<string>();
        if (allCpfsRaw.length > 0) {
          try {
            const uniqueCpfs = [...new Set(allCpfsRaw)];
            const blockedResult = await db.execute(sql`
              SELECT DISTINCT cpf FROM client_portfolio
              WHERE tenant_id = ${tenantId}
                AND cpf = ANY(${uniqueCpfs}::text[])
                AND status = 'ATIVO'
                AND expires_at > NOW()
                AND vendor_id != ${userId}
            `);
            blockedCpfs = new Set(blockedResult.rows.map((r: any) => r.cpf));
          } catch (portfolioCheckErr) {
            console.error("[PORTFOLIO] bulk CPF check error (non-fatal):", portfolioCheckErr);
          }
        }

        let imported = 0;
        let updated = 0;
        let ignored = 0;
        let removedByPortfolio = 0;
        const removedCpfsList: string[] = [];

        for (const row of parsed.data as Record<string, string>[]) {
          const mapped: Record<string, string> = {};
          for (const [originalHeader, value] of Object.entries(row)) {
            const field = headerMapping[originalHeader];
            if (field && value && value.trim()) {
              mapped[field] = value.trim();
            }
          }

          if (!mapped.cpf && !mapped.nome) {
            ignored++;
            continue;
          }

          const cpfClean = mapped.cpf ? mapped.cpf.replace(/\D/g, '').padStart(11, '0') : null;

          // Skip CPFs already in active portfolios of another vendor
          if (cpfClean && blockedCpfs.has(cpfClean)) {
            removedByPortfolio++;
            if (!removedCpfsList.includes(cpfClean)) removedCpfsList.push(cpfClean);
            continue;
          }

          let baseClienteId: number | null = null;
          if (cpfClean) {
            const existingPessoa = await db.execute(
              sql`SELECT id FROM clientes_pessoa WHERE cpf = ${cpfClean} LIMIT 1`
            );
            if (existingPessoa.rows.length > 0) {
              baseClienteId = existingPessoa.rows[0].id as number;

              if (mapped.matricula) {
                await db.execute(sql`
                  UPDATE clientes_vinculo 
                  SET matricula = ${mapped.matricula}
                  WHERE pessoa_id = ${baseClienteId}
                  AND (matricula IS NULL OR matricula = '' OR matricula LIKE 'EST_%')
                `);
              }

              if (mapped.margem70 || mapped.margemCartao) {
                const updateParts: ReturnType<typeof sql>[] = [];
                if (mapped.margem70) updateParts.push(sql`margem_saldo_70 = ${parseFloat(mapped.margem70)}`);
                if (mapped.margemCartao) updateParts.push(sql`margem_saldo_5 = ${parseFloat(mapped.margemCartao)}`);
                if (updateParts.length > 0) {
                  const latestFolha = await db.execute(sql`
                    SELECT id FROM clientes_folha_mes 
                    WHERE pessoa_id = ${baseClienteId} 
                    ORDER BY competencia DESC LIMIT 1
                  `);
                  if (latestFolha.rows.length > 0) {
                    const folhaId = latestFolha.rows[0].id;
                    const setClauses = updateParts.reduce((a, b) => sql`${a}, ${b}`);
                    await db.execute(sql`UPDATE clientes_folha_mes SET ${setClauses} WHERE id = ${folhaId}`);
                  }
                }
              }
              updated++;
            }
          }

          const dadosHigienizados: Record<string, string> = {};
          if (mapped.orgao) dadosHigienizados.orgao = mapped.orgao;
          if (mapped.sitfunc) dadosHigienizados.sitfunc = mapped.sitfunc;
          if (mapped.convenioCol) dadosHigienizados.convenio = mapped.convenioCol;

          try {
            await db.execute(sql`
              INSERT INTO sales_leads (
                tenant_id, campaign_id, cpf, nome, 
                telefone_1, telefone_2, telefone_3,
                observacoes, base_cliente_id, lead_marker,
                matricula, taxa_real, valor_parcela, banco_oferta,
                dados_higienizados, higienizado_em,
                created_at, updated_at
              ) VALUES (
                ${tenantId}, ${newCampaign.id}, ${cpfClean}, ${mapped.nome || 'Sem nome'},
                ${mapped.telefone1 || null}, ${mapped.telefone2 || null}, ${mapped.telefone3 || null},
                ${mapped.observacoes || null}, ${baseClienteId}, 'NOVO',
                ${mapped.matricula || null}, 
                ${mapped.taxa ? parseFloat(mapped.taxa) : null},
                ${mapped.parcela ? parseFloat(mapped.parcela) : null},
                ${mapped.banco || null},
                ${Object.keys(dadosHigienizados).length > 0 ? JSON.stringify(dadosHigienizados) : null},
                NOW(),
                NOW(), NOW()
              )
            `);
            imported++;

            // Backfill clientes_telefones for fast phone search
            try {
              if (mapped.telefone1 || mapped.telefone2 || mapped.telefone3) {
                await storage.addPessoaTelefonesByCpfBatch([{
                  tenantId,
                  cpf: cpfClean,
                  telefones: [mapped.telefone1, mapped.telefone2, mapped.telefone3],
                }]);
              }
            } catch (phoneErr) {
              console.error(`[HIGIENIZADOS] Falha ao popular clientes_telefones (CPF ${cpfClean}):`, phoneErr);
            }
          } catch (insertError) {
            console.error(`Erro ao inserir lead CPF ${cpfClean}:`, insertError);
            ignored++;
          }
        }

        await db.execute(sql`
          UPDATE sales_campaigns 
          SET total_leads = ${imported}, leads_disponiveis = ${imported}
          WHERE id = ${newCampaign.id}
        `);

        return res.json({
          message: "Importação concluída",
          campanha: { id: newCampaign.id, nome: nomeCampanha },
          resumo: { imported, updated, ignored, total: parsed.data.length, removedByPortfolio, removedCpfs: removedCpfsList.slice(0, 50) },
          colunasDetectadas: Object.values(headerMapping),
        });
      } catch (error) {
        console.error("Importar higienizados error:", error);
        return res.status(500).json({ message: "Erro ao importar lista higienizada" });
      }
    }
  );

  // GET /api/vendas/vendedores - Lista vendedores para distribuição
  app.get(
    "/api/vendas/vendedores",
    requireAuth,
    requireCRMAdmin,
    async (req, res) => {
      try {
        const allUsers = await storage.getAllUsers();
        // Filter for vendedores or operacional
        const vendedores = allUsers
          .filter(
            (u) => u.isActive && ["vendedor", "operacional"].includes(u.role),
          )
          .map((u) => ({
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
    },
  );

  // ===== ENDPOINTS DO VENDEDOR =====

  // GET /api/vendas/atendimento/resumo - Resumo do vendedor
  app.get("/api/vendas/atendimento/resumo", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const statusCounts = await storage.countAssignmentsByStatus(userId);

      const novos = statusCounts.find((s) => s.status === "novo")?.count || 0;
      const emAtendimento =
        statusCounts.find((s) => s.status === "em_atendimento")?.count || 0;
      const vendidos =
        statusCounts.find((s) => s.status === "vendido")?.count || 0;
      const concluidos = statusCounts
        .filter((s) =>
          ["vendido", "sem_interesse", "descartado", "concluido"].includes(
            s.status,
          ),
        )
        .reduce((acc, s) => acc + s.count, 0);

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

  // POST /api/vendas/consulta/buscar - Buscar cliente por CPF ou Matrícula para consulta manual
  app.post("/api/vendas/consulta/buscar", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { termo } = req.body;

      if (!termo || typeof termo !== "string" || termo.trim().length < 3) {
        return res
          .status(400)
          .json({ message: "Informe CPF ou Matrícula (mínimo 3 caracteres)" });
      }

      const termoLimpo = termo.trim().replace(/\D/g, "");

      // First try to find by CPF
      let cliente = await storage.getClientePessoaByCpf(termoLimpo);

      // If not found by CPF, try to find by matrícula through vínculos
      if (!cliente) {
        const vinculos = await db
          .select()
          .from(clientesVinculo)
          .where(
            and(
              eq(clientesVinculo.tenantId, tenantId),
              eq(clientesVinculo.matricula, termoLimpo),
            ),
          )
          .limit(1);

        if (vinculos.length > 0) {
          cliente = await storage.getClientePessoaById(vinculos[0].pessoaId);
        }
      }

      if (!cliente) {
        return res.status(404).json({
          message:
            "Cliente não localizado. Verifique os dados informados ou atualize a Base de Clientes.",
        });
      }

      // Portfolio block check — applies to all search types (CPF and matrícula)
      const portfolioCheck = await checkPortfolioBlock(
        tenantId,
        cliente.cpf || "",
        req.user!.id,
        req.user!.role,
      );
      if (portfolioCheck.blocked) {
        return res.status(403).json({ message: portfolioCheck.message });
      }

      // Get vínculos (shared across tenants)
      const vinculos = await storage.getVinculosByPessoaId(cliente.id);

      // Selecionar vínculo com folha mais recente (de TODOS, não apenas os filtrados)
      let vinculoAtual: (typeof vinculos)[0] | null = null;
      if (vinculos.length > 0) {
        const vinculoIds = vinculos.map((v) => v.id);
        const vinculoIdMaisRecente =
          await storage.getVinculoIdWithLatestFolha(vinculoIds);
        vinculoAtual =
          vinculos.find((v) => v.id === vinculoIdMaisRecente) || vinculos[0];
      }

      // Vínculos filtrados apenas para exibição
      const vinculosValidos = vinculos.filter(
        (v) => v.orgao && v.orgao !== "DESCONHECIDO",
      );
      const vinculosFiltrados =
        vinculosValidos.length > 0 ? vinculosValidos : vinculos;

      // Get folha
      let folhaRegistros;
      if (vinculoAtual) {
        folhaRegistros = await storage.getFolhaMesByVinculoId(vinculoAtual.id);
        if (folhaRegistros.length === 0) {
          folhaRegistros = await storage.getFolhaMesByPessoaId(cliente.id);
        }
      } else {
        folhaRegistros = await storage.getFolhaMesByPessoaId(cliente.id);
      }
      const folhaAtual = folhaRegistros.length > 0 ? folhaRegistros[0] : null;

      // Transform folha to snake_case
      const folhaFormatada = folhaAtual
        ? {
            competencia: safeCompetencia(folhaAtual.competencia),
            margem_bruta_5:
              folhaAtual.margemBruta5 != null
                ? parseFloat(String(folhaAtual.margemBruta5))
                : null,
            margem_utilizada_5:
              folhaAtual.margemUtilizada5 != null
                ? parseFloat(String(folhaAtual.margemUtilizada5))
                : null,
            margem_saldo_5:
              folhaAtual.margemSaldo5 != null
                ? parseFloat(String(folhaAtual.margemSaldo5))
                : null,
            margem_beneficio_bruta_5:
              folhaAtual.margemBeneficioBruta5 != null
                ? parseFloat(String(folhaAtual.margemBeneficioBruta5))
                : null,
            margem_beneficio_utilizada_5:
              folhaAtual.margemBeneficioUtilizada5 != null
                ? parseFloat(String(folhaAtual.margemBeneficioUtilizada5))
                : null,
            margem_beneficio_saldo_5:
              folhaAtual.margemBeneficioSaldo5 != null
                ? parseFloat(String(folhaAtual.margemBeneficioSaldo5))
                : null,
            margem_bruta_35:
              folhaAtual.margemBruta35 != null
                ? parseFloat(String(folhaAtual.margemBruta35))
                : null,
            margem_utilizada_35:
              folhaAtual.margemUtilizada35 != null
                ? parseFloat(String(folhaAtual.margemUtilizada35))
                : null,
            margem_saldo_35:
              folhaAtual.margemSaldo35 != null
                ? parseFloat(String(folhaAtual.margemSaldo35))
                : null,
            margem_bruta_70:
              folhaAtual.margemBruta70 != null
                ? parseFloat(String(folhaAtual.margemBruta70))
                : null,
            margem_utilizada_70:
              folhaAtual.margemUtilizada70 != null
                ? parseFloat(String(folhaAtual.margemUtilizada70))
                : null,
            margem_saldo_70:
              folhaAtual.margemSaldo70 != null
                ? parseFloat(String(folhaAtual.margemSaldo70))
                : null,
            margem_cartao_credito_saldo:
              folhaAtual.margemCartaoCreditoSaldo != null
                ? parseFloat(String(folhaAtual.margemCartaoCreditoSaldo))
                : null,
            margem_cartao_beneficio_saldo:
              folhaAtual.margemCartaoBeneficioSaldo != null
                ? parseFloat(String(folhaAtual.margemCartaoBeneficioSaldo))
                : null,
            salario_bruto:
              folhaAtual.salarioBruto != null
                ? parseFloat(String(folhaAtual.salarioBruto))
                : null,
            descontos_brutos:
              folhaAtual.descontosBrutos != null
                ? parseFloat(String(folhaAtual.descontosBrutos))
                : null,
            salario_liquido:
              folhaAtual.salarioLiquido != null
                ? parseFloat(String(folhaAtual.salarioLiquido))
                : null,
            creditos:
              folhaAtual.creditos != null
                ? parseFloat(String(folhaAtual.creditos))
                : null,
            debitos:
              folhaAtual.debitos != null
                ? parseFloat(String(folhaAtual.debitos))
                : null,
            liquido:
              folhaAtual.liquido != null
                ? parseFloat(String(folhaAtual.liquido))
                : null,
            sit_func_no_mes: folhaAtual.sitFuncNoMes,
            base_tag: folhaAtual.baseTag,
            extras_folha: folhaAtual.extrasFolha,
            exc_qtd: folhaAtual.excQtd ?? null,
            exc_soma:
              folhaAtual.excSoma != null
                ? parseFloat(String(folhaAtual.excSoma))
                : null,
          }
        : null;

      // Get contratos
      let contratos;
      if (vinculoAtual) {
        contratos = await storage.getContratosByVinculoId(vinculoAtual.id);
        if (contratos.length === 0) {
          const todosPessoa = await storage.getContratosByPessoaId(cliente.id);
          contratos = todosPessoa.filter(
            (c) => !c.vinculoId || c.vinculoId === vinculoAtual.id,
          );
        }
      } else {
        contratos = await storage.getContratosByPessoaId(cliente.id);
      }

      // Get higienização data
      const telefones = await storage.getTelefonesByPessoaId(cliente.id);
      const contatos = await storage.getContactsByClientId(cliente.id);

      // Combine and deduplicate telefones
      const allTelefones = [
        ...telefones.map((t) => ({
          telefone: t.telefone || "",
          tipo: t.tipo || "telefone",
          principal: t.principal,
          _normalized: (t.telefone || "").replace(/\D/g, ""),
        })),
        ...contatos
          .filter((c) => c.tipo === "telefone")
          .map((c) => ({
            telefone: c.valor || "",
            tipo: "telefone",
            principal: null,
            _normalized: (c.valor || "").replace(/\D/g, ""),
          })),
      ];
      const seenTelefones = new Set<string>();
      const uniqueTelefones = allTelefones
        .filter((t) => {
          if (!t._normalized || seenTelefones.has(t._normalized)) return false;
          seenTelefones.add(t._normalized);
          return true;
        })
        .map((t) => ({
          telefone: t.telefone,
          tipo: t.tipo,
          principal: t.principal,
        }));

      // Deduplicate emails
      const allEmails = contatos
        .filter((c) => c.tipo === "email" && c.valor)
        .map((c) => c.valor!);
      const seenEmails = new Set<string>();
      const uniqueEmails = allEmails.filter((email) => {
        const normalized = email.toLowerCase().trim();
        if (seenEmails.has(normalized)) return false;
        seenEmails.add(normalized);
        return true;
      });

      let leadId: number | null = null;
      const clienteCpf = cliente.cpf?.replace(/\D/g, "");
      if (clienteCpf) {
        const existingLeads = await db
          .select({ id: salesLeads.id })
          .from(salesLeads)
          .where(
            and(
              eq(salesLeads.tenantId, tenantId),
              eq(salesLeads.cpf, clienteCpf),
            ),
          )
          .orderBy(desc(salesLeads.createdAt))
          .limit(1);

        if (existingLeads.length > 0) {
          leadId = existingLeads[0].id;
        } else {
          let campanha = await db
            .select()
            .from(salesCampaigns)
            .where(
              and(
                eq(salesCampaigns.tenantId, tenantId),
                eq(salesCampaigns.origem, "__consulta_avulsa__"),
              ),
            )
            .limit(1);

          let campanhaId: number;
          if (campanha.length > 0) {
            campanhaId = campanha[0].id;
          } else {
            const [novaCampanha] = await db
              .insert(salesCampaigns)
              .values({
                tenantId,
                nome: "Consulta Avulsa",
                descricao: "Campanha automática para leads criados via Consulta Individual",
                origem: "__consulta_avulsa__",
                status: "ativa",
                totalLeads: 0,
                leadsDisponiveis: 0,
                leadsDistribuidos: 0,
                createdBy: req.user!.id,
              })
              .returning();
            campanhaId = novaCampanha.id;
          }

          const [novoLead] = await db
            .insert(salesLeads)
            .values({
              tenantId,
              campaignId: campanhaId,
              cpf: clienteCpf,
              nome: cliente.nome || "Sem Nome",
              telefone1: cliente.telefone1 || null,
              telefone2: cliente.telefone2 || null,
              baseClienteId: cliente.id,
              leadMarker: "NOVO",
            })
            .returning();
          leadId = novoLead.id;

          await db
            .update(salesCampaigns)
            .set({ totalLeads: sql`total_leads + 1` })
            .where(eq(salesCampaigns.id, campanhaId));
        }
      }

      return res.json({
        clienteBase: cliente,
        folhaAtual: folhaFormatada,
        contratos,
        higienizacao: {
          telefones: uniqueTelefones,
          emails: uniqueEmails,
        },
        vinculo: vinculoAtual,
        vinculos: vinculosFiltrados,
        tem_multiplos_vinculos: vinculosFiltrados.length > 1,
        pessoaId: cliente.id,
        leadId,
        portfolioInfo: portfolioCheck.portfolioInfo ?? null,
      });
    } catch (error) {
      console.error("Buscar cliente consulta error:", error);
      return res.status(500).json({ message: "Erro ao buscar cliente" });
    }
  });

  // POST /api/vendas/consulta/buscar-telefone - Busca pessoas por telefone (multi-result)
  // Retorna lista de candidatos. Bloqueio de carteira é aplicado no buscar normal ao escolher CPF.
  app.post("/api/vendas/consulta/buscar-telefone", requireAuth, async (req, res) => {
    try {
      const { telefone } = req.body || {};
      if (!telefone || typeof telefone !== "string") {
        return res.status(400).json({ message: "Informe o telefone" });
      }
      const cleanTel = telefone.replace(/\D/g, "");
      if (cleanTel.length < 8 || cleanTel.length > 11) {
        return res.status(400).json({ message: "Telefone inválido. Informe entre 8 e 11 dígitos." });
      }
      const clientes = await storage.getPessoasByTelefone(cleanTel);
      const resultados = clientes.map((c) => ({
        pessoa_id: c.id,
        cpf: c.cpf,
        matricula: c.matricula,
        nome: c.nome,
        convenio: c.convenio,
        orgao: c.orgaodesc,
        uf: c.uf,
        municipio: c.municipio,
        sit_func: c.sitFunc,
      }));
      return res.json({ termo: cleanTel, resultados });
    } catch (error) {
      console.error("Buscar telefone error:", error);
      return res.status(500).json({ message: "Erro ao buscar por telefone" });
    }
  });

  // POST /api/vendas/consulta/trocar-vinculo - Troca o vínculo selecionado e retorna nova folha/contratos
  app.post("/api/vendas/consulta/trocar-vinculo", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { pessoaId, vinculoId } = req.body;

      if (!pessoaId || !vinculoId) {
        return res.status(400).json({ message: "pessoaId e vinculoId são obrigatórios" });
      }

      // Validate pessoa exists (security maintained by vínculo-belongs-to-pessoa check below)
      const cliente = await storage.getClientePessoaById(Number(pessoaId));
      if (!cliente) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      // Validate the vínculo exists and belongs to this pessoa (within tenant)
      const vinculos = await storage.getVinculosByPessoaId(cliente.id);
      const vinculoSelecionado = vinculos.find((v) => v.id === Number(vinculoId));
      if (!vinculoSelecionado) {
        return res.status(404).json({ message: "Vínculo não encontrado" });
      }

      // Get folha for the selected vínculo
      let folhaRegistros = await storage.getFolhaMesByVinculoId(vinculoSelecionado.id);
      if (folhaRegistros.length === 0) {
        folhaRegistros = await storage.getFolhaMesByPessoaId(cliente.id);
      }
      const folhaAtual = folhaRegistros.length > 0 ? folhaRegistros[0] : null;

      const folhaFormatada = folhaAtual
        ? {
            competencia: safeCompetencia(folhaAtual.competencia),
            margem_bruta_5: folhaAtual.margemBruta5 != null ? parseFloat(String(folhaAtual.margemBruta5)) : null,
            margem_utilizada_5: folhaAtual.margemUtilizada5 != null ? parseFloat(String(folhaAtual.margemUtilizada5)) : null,
            margem_saldo_5: folhaAtual.margemSaldo5 != null ? parseFloat(String(folhaAtual.margemSaldo5)) : null,
            margem_beneficio_bruta_5: folhaAtual.margemBeneficioBruta5 != null ? parseFloat(String(folhaAtual.margemBeneficioBruta5)) : null,
            margem_beneficio_utilizada_5: folhaAtual.margemBeneficioUtilizada5 != null ? parseFloat(String(folhaAtual.margemBeneficioUtilizada5)) : null,
            margem_beneficio_saldo_5: folhaAtual.margemBeneficioSaldo5 != null ? parseFloat(String(folhaAtual.margemBeneficioSaldo5)) : null,
            margem_bruta_35: folhaAtual.margemBruta35 != null ? parseFloat(String(folhaAtual.margemBruta35)) : null,
            margem_utilizada_35: folhaAtual.margemUtilizada35 != null ? parseFloat(String(folhaAtual.margemUtilizada35)) : null,
            margem_saldo_35: folhaAtual.margemSaldo35 != null ? parseFloat(String(folhaAtual.margemSaldo35)) : null,
            margem_bruta_70: folhaAtual.margemBruta70 != null ? parseFloat(String(folhaAtual.margemBruta70)) : null,
            margem_utilizada_70: folhaAtual.margemUtilizada70 != null ? parseFloat(String(folhaAtual.margemUtilizada70)) : null,
            margem_saldo_70: folhaAtual.margemSaldo70 != null ? parseFloat(String(folhaAtual.margemSaldo70)) : null,
            margem_cartao_credito_saldo: folhaAtual.margemCartaoCreditoSaldo != null ? parseFloat(String(folhaAtual.margemCartaoCreditoSaldo)) : null,
            margem_cartao_beneficio_saldo: folhaAtual.margemCartaoBeneficioSaldo != null ? parseFloat(String(folhaAtual.margemCartaoBeneficioSaldo)) : null,
            salario_bruto: folhaAtual.salarioBruto != null ? parseFloat(String(folhaAtual.salarioBruto)) : null,
            descontos_brutos: folhaAtual.descontosBrutos != null ? parseFloat(String(folhaAtual.descontosBrutos)) : null,
            salario_liquido: folhaAtual.salarioLiquido != null ? parseFloat(String(folhaAtual.salarioLiquido)) : null,
            creditos: folhaAtual.creditos != null ? parseFloat(String(folhaAtual.creditos)) : null,
            debitos: folhaAtual.debitos != null ? parseFloat(String(folhaAtual.debitos)) : null,
            liquido: folhaAtual.liquido != null ? parseFloat(String(folhaAtual.liquido)) : null,
            sit_func_no_mes: folhaAtual.sitFuncNoMes,
            base_tag: folhaAtual.baseTag,
            extras_folha: folhaAtual.extrasFolha,
          }
        : null;

      // Get contratos for the selected vínculo
      let contratos = await storage.getContratosByVinculoId(vinculoSelecionado.id);
      if (contratos.length === 0) {
        const todosPessoa = await storage.getContratosByPessoaId(cliente.id);
        contratos = todosPessoa.filter(
          (c) => !c.vinculoId || c.vinculoId === vinculoSelecionado.id,
        );
      }

      return res.json({
        folhaAtual: folhaFormatada,
        contratos,
        vinculo: vinculoSelecionado,
      });
    } catch (error) {
      console.error("Trocar vínculo consulta error:", error);
      return res.status(500).json({ message: "Erro ao trocar vínculo" });
    }
  });

  // GET /api/clientes/:clientId/contacts - Listar contatos do cliente
  app.get("/api/clientes/:clientId/contacts", requireAuth, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const contacts = await db
        .select()
        .from(clientContacts)
        .where(eq(clientContacts.clientId, clientId))
        .orderBy(desc(clientContacts.isPrimary), clientContacts.createdAt);

      return res.json(contacts);
    } catch (error) {
      console.error("Get client contacts error:", error);
      return res.status(500).json({ message: "Erro ao buscar contatos" });
    }
  });

  // POST /api/clientes/:clientId/contacts - Adicionar contato ao cliente
  app.post(
    "/api/clientes/:clientId/contacts",
    requireAuth,
    async (req, res) => {
      try {
        const clientId = parseInt(req.params.clientId);
        if (isNaN(clientId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { type, value, label } = req.body;
        if (!type || !value) {
          return res
            .status(400)
            .json({ message: "Tipo e valor são obrigatórios" });
        }

        const [contact] = await db
          .insert(clientContacts)
          .values({
            clientId,
            type,
            value,
            label: label || null,
            isPrimary: false,
            isManual: true,
            createdAt: new Date(),
          })
          .onConflictDoNothing()
          .returning();

        if (!contact) {
          return res
            .status(409)
            .json({ message: "Este contato já existe para este cliente" });
        }

        return res.json(contact);
      } catch (error) {
        console.error("Create client contact error:", error);
        return res.status(500).json({ message: "Erro ao criar contato" });
      }
    },
  );

  // PUT /api/clientes/contacts/:id - Atualizar contato
  app.put("/api/clientes/contacts/:id", requireAuth, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const { type, value, label } = req.body;
      const updateData: any = {};
      if (type !== undefined) updateData.type = type;
      if (value !== undefined) updateData.value = value;
      if (label !== undefined) updateData.label = label;

      const [updated] = await db
        .update(clientContacts)
        .set(updateData)
        .where(eq(clientContacts.id, contactId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Update client contact error:", error);
      return res.status(500).json({ message: "Erro ao atualizar contato" });
    }
  });

  // DELETE /api/clientes/contacts/:id - Deletar contato
  app.delete("/api/clientes/contacts/:id", requireAuth, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      await db.delete(clientContacts).where(eq(clientContacts.id, contactId));

      return res.json({ success: true });
    } catch (error) {
      console.error("Delete client contact error:", error);
      return res.status(500).json({ message: "Erro ao deletar contato" });
    }
  });

  // POST /api/clientes/contacts/:id/primary - Definir contato como principal
  app.post(
    "/api/clientes/contacts/:id/primary",
    requireAuth,
    async (req, res) => {
      try {
        const contactId = parseInt(req.params.id);
        if (isNaN(contactId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        // Get the contact to find the clientId
        const [contact] = await db
          .select()
          .from(clientContacts)
          .where(eq(clientContacts.id, contactId))
          .limit(1);

        if (!contact) {
          return res.status(404).json({ message: "Contato não encontrado" });
        }

        // Reset all contacts for this client to not primary
        await db
          .update(clientContacts)
          .set({ isPrimary: false })
          .where(eq(clientContacts.clientId, contact.clientId));

        // Set this contact as primary
        await db
          .update(clientContacts)
          .set({ isPrimary: true })
          .where(eq(clientContacts.id, contactId));

        return res.json({ success: true });
      } catch (error) {
        console.error("Set primary contact error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao definir contato principal" });
      }
    },
  );

  // POST /api/clientes/:clientId/observacao - Registrar observação do cliente
  app.post(
    "/api/clientes/:clientId/observacao",
    requireAuth,
    async (req, res) => {
      try {
        const clientId = parseInt(req.params.clientId);
        if (isNaN(clientId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { observacao } = req.body;
        if (
          !observacao ||
          typeof observacao !== "string" ||
          !observacao.trim()
        ) {
          return res.status(400).json({ message: "Observação é obrigatória" });
        }

        // Get existing notes
        const [cliente] = await db
          .select()
          .from(clientesPessoa)
          .where(eq(clientesPessoa.id, clientId))
          .limit(1);

        if (!cliente) {
          return res.status(404).json({ message: "Cliente não encontrado" });
        }

        const now = new Date().toISOString();
        const userName = req.user?.name || req.user?.username || "Sistema";
        const novaObs = `[${now}] ${userName}: ${observacao.trim()}`;

        const existingNotes = cliente.notes ? String(cliente.notes) : "";
        const updatedNotes = existingNotes
          ? `${novaObs}\n${existingNotes}`
          : novaObs;

        await db
          .update(clientesPessoa)
          .set({ notes: updatedNotes })
          .where(eq(clientesPessoa.id, clientId));

        return res.json({ success: true, notes: updatedNotes });
      } catch (error) {
        console.error("Register observacao error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao registrar observação" });
      }
    },
  );

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
      let folhaAtual = null;
      let contratos: any[] = [];
      let higienizacao: { telefones: any[]; emails: string[]; endereco?: any } =
        { telefones: [], emails: [] };
      let vinculoAtual: any = null;

      if (lead.baseClienteId) {
        clienteBase = await storage.getClientePessoaById(lead.baseClienteId);
        if (clienteBase) {
          // Get vínculos to find sit_func, rjur, orgao, upag (shared across tenants)
          const vinculos = await storage.getVinculosByPessoaId(
            lead.baseClienteId,
          );

          // Selecionar vínculo com folha mais recente (de TODOS, ou por matrícula se especificada)
          if (vinculos.length > 0) {
            if (lead.matricula) {
              vinculoAtual = vinculos.find(
                (v) => v.matricula === lead.matricula,
              );
            }
            if (!vinculoAtual) {
              const vinculoIds = vinculos.map((v) => v.id);
              const vinculoIdMaisRecente =
                await storage.getVinculoIdWithLatestFolha(vinculoIds);
              vinculoAtual =
                vinculos.find((v) => v.id === vinculoIdMaisRecente) ||
                vinculos[0];
            }
          }

          // Get folha by vínculo when available
          let folhaRegistros;
          if (vinculoAtual) {
            folhaRegistros = await storage.getFolhaMesByVinculoId(
              vinculoAtual.id,
            );
            if (folhaRegistros.length === 0) {
              folhaRegistros = await storage.getFolhaMesByPessoaId(
                lead.baseClienteId,
              );
            }
          } else {
            folhaRegistros = await storage.getFolhaMesByPessoaId(
              lead.baseClienteId,
            );
          }
          folhaAtual = folhaRegistros.length > 0 ? folhaRegistros[0] : null;

          // Get contratos by vínculo when available
          if (vinculoAtual) {
            contratos = await storage.getContratosByVinculoId(vinculoAtual.id);
            if (contratos.length === 0) {
              const todosPessoa = await storage.getContratosByPessoaId(
                lead.baseClienteId,
              );
              contratos = todosPessoa.filter(
                (c) => !c.vinculoId || c.vinculoId === vinculoAtual.id,
              );
            }
          } else {
            contratos = await storage.getContratosByPessoaId(
              lead.baseClienteId,
            );
          }

          const telefones = await storage.getTelefonesByPessoaId(
            lead.baseClienteId,
          );
          const contatos = await storage.getContactsByClientId(
            lead.baseClienteId,
          );

          // Combine and deduplicate telefones (preserve original formatting)
          const allTelefones = [
            ...telefones.map((t) => ({
              telefone: t.telefone || "",
              tipo: t.tipo || "telefone",
              principal: t.principal,
              _normalized: (t.telefone || "").replace(/\D/g, ""),
            })),
            ...contatos
              .filter((c) => c.tipo === "telefone")
              .map((c) => ({
                telefone: c.valor || "",
                tipo: "telefone",
                principal: null,
                _normalized: (c.valor || "").replace(/\D/g, ""),
              })),
          ];
          const seenTelefones = new Set<string>();
          const uniqueTelefones = allTelefones
            .filter((t) => {
              if (!t._normalized || seenTelefones.has(t._normalized))
                return false;
              seenTelefones.add(t._normalized);
              return true;
            })
            .map((t) => ({
              telefone: t.telefone,
              tipo: t.tipo,
              principal: t.principal,
            }));

          // Deduplicate emails (preserve original case)
          const allEmails = contatos
            .filter((c) => c.tipo === "email" && c.valor)
            .map((c) => c.valor!);
          const seenEmails = new Set<string>();
          const uniqueEmails = allEmails.filter((email) => {
            const normalized = email.toLowerCase().trim();
            if (seenEmails.has(normalized)) return false;
            seenEmails.add(normalized);
            return true;
          });

          higienizacao = {
            telefones: uniqueTelefones,
            emails: uniqueEmails,
          };
        }
      }

      // Get events history
      const eventos = await storage.getEventsByAssignment(assignment.id);

      // Get campaign info
      const campanha = await storage.getSalesCampaign(assignment.campaignId);

      // Transform folha data to snake_case format expected by frontend
      const folhaFormatada = folhaAtual
        ? {
            competencia: safeCompetencia(folhaAtual.competencia),
            margem_bruta_5:
              folhaAtual.margemBruta5 != null
                ? parseFloat(String(folhaAtual.margemBruta5))
                : null,
            margem_utilizada_5:
              folhaAtual.margemUtilizada5 != null
                ? parseFloat(String(folhaAtual.margemUtilizada5))
                : null,
            margem_saldo_5:
              folhaAtual.margemSaldo5 != null
                ? parseFloat(String(folhaAtual.margemSaldo5))
                : null,
            margem_beneficio_bruta_5:
              folhaAtual.margemBeneficioBruta5 != null
                ? parseFloat(String(folhaAtual.margemBeneficioBruta5))
                : null,
            margem_beneficio_utilizada_5:
              folhaAtual.margemBeneficioUtilizada5 != null
                ? parseFloat(String(folhaAtual.margemBeneficioUtilizada5))
                : null,
            margem_beneficio_saldo_5:
              folhaAtual.margemBeneficioSaldo5 != null
                ? parseFloat(String(folhaAtual.margemBeneficioSaldo5))
                : null,
            margem_bruta_35:
              folhaAtual.margemBruta35 != null
                ? parseFloat(String(folhaAtual.margemBruta35))
                : null,
            margem_utilizada_35:
              folhaAtual.margemUtilizada35 != null
                ? parseFloat(String(folhaAtual.margemUtilizada35))
                : null,
            margem_saldo_35:
              folhaAtual.margemSaldo35 != null
                ? parseFloat(String(folhaAtual.margemSaldo35))
                : null,
            margem_bruta_70:
              folhaAtual.margemBruta70 != null
                ? parseFloat(String(folhaAtual.margemBruta70))
                : null,
            margem_utilizada_70:
              folhaAtual.margemUtilizada70 != null
                ? parseFloat(String(folhaAtual.margemUtilizada70))
                : null,
            margem_saldo_70:
              folhaAtual.margemSaldo70 != null
                ? parseFloat(String(folhaAtual.margemSaldo70))
                : null,
            margem_cartao_credito_saldo:
              folhaAtual.margemCartaoCreditoSaldo != null
                ? parseFloat(String(folhaAtual.margemCartaoCreditoSaldo))
                : null,
            margem_cartao_beneficio_saldo:
              folhaAtual.margemCartaoBeneficioSaldo != null
                ? parseFloat(String(folhaAtual.margemCartaoBeneficioSaldo))
                : null,
            salario_bruto:
              folhaAtual.salarioBruto != null
                ? parseFloat(String(folhaAtual.salarioBruto))
                : null,
            descontos_brutos:
              folhaAtual.descontosBrutos != null
                ? parseFloat(String(folhaAtual.descontosBrutos))
                : null,
            salario_liquido:
              folhaAtual.salarioLiquido != null
                ? parseFloat(String(folhaAtual.salarioLiquido))
                : null,
            creditos:
              folhaAtual.creditos != null
                ? parseFloat(String(folhaAtual.creditos))
                : null,
            debitos:
              folhaAtual.debitos != null
                ? parseFloat(String(folhaAtual.debitos))
                : null,
            liquido:
              folhaAtual.liquido != null
                ? parseFloat(String(folhaAtual.liquido))
                : null,
            sit_func_no_mes: folhaAtual.sitFuncNoMes,
            base_tag: folhaAtual.baseTag,
            extras_folha: folhaAtual.extrasFolha,
          }
        : null;

      return res.json({
        assignment: { ...assignment, status: "em_atendimento" },
        lead,
        clienteBase,
        folhaAtual: folhaFormatada,
        contratos,
        eventos,
        campanha: campanha ? { id: campanha.id, nome: campanha.nome } : null,
        higienizacao,
        vinculo: vinculoAtual,
      });
    } catch (error) {
      console.error("Proximo lead error:", error);
      return res.status(500).json({ message: "Erro ao buscar próximo lead" });
    }
  });

  // POST /api/vendas/atendimento/carregar - Load specific assignment for atendimento
  app.post(
    "/api/vendas/atendimento/carregar",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const { assignmentId } = req.body;

        if (!assignmentId || isNaN(parseInt(assignmentId))) {
          return res.status(400).json({ message: "Assignment ID inválido" });
        }

        const result = await storage.getAssignmentWithLead(
          parseInt(assignmentId),
        );
        if (!result) {
          return res
            .status(404)
            .json({ message: "Atendimento não encontrado" });
        }

        // Verify ownership - REFACTORED: Use isMaster or modulo_alpha permission
        const canViewOthers =
          req.user!.isMaster ||
          (await storage.hasModuleEditAccess(userId, "modulo_alpha"));
        if (result.assignment.userId !== userId && !canViewOthers) {
          logPermissionCheck(
            userId,
            req.user!.name,
            "modulo_alpha",
            "edit",
            false,
            "Cannot view other user's assignment",
          );
          return res.status(403).json({ message: "Acesso negado" });
        }

        // Update to em_atendimento if not already in a final status
        const finalStatuses = [
          "vendido",
          "sem_interesse",
          "descartado",
          "concluido",
        ];
        if (!finalStatuses.includes(result.assignment.status)) {
          const now = new Date();
          await storage.updateSalesLeadAssignment(result.assignment.id, {
            status: "em_atendimento",
            dataPrimeiroAtendimento:
              result.assignment.dataPrimeiroAtendimento || now,
            dataUltimoAtendimento: now,
          });
        }

        // Get base cliente data if available
        let clienteBase = null;
        let folhaAtual = null;
        let contratos: any[] = [];
        let higienizacao: {
          telefones: any[];
          emails: string[];
          endereco?: any;
        } = { telefones: [], emails: [] };
        let vinculoAtual: any = null;

        if (result.lead.baseClienteId) {
          clienteBase = await storage.getClientePessoaById(
            result.lead.baseClienteId,
          );
          if (clienteBase) {
            // Get vínculos to find sit_func, rjur, orgao, upag (shared across tenants)
            const vinculos = await storage.getVinculosByPessoaId(
              result.lead.baseClienteId,
            );

            // Selecionar vínculo com folha mais recente (de TODOS, ou por matrícula se especificada)
            if (vinculos.length > 0) {
              if (result.lead.matricula) {
                vinculoAtual = vinculos.find(
                  (v) => v.matricula === result.lead.matricula,
                );
              }
              if (!vinculoAtual) {
                const vinculoIds = vinculos.map((v) => v.id);
                const vinculoIdMaisRecente =
                  await storage.getVinculoIdWithLatestFolha(vinculoIds);
                vinculoAtual =
                  vinculos.find((v) => v.id === vinculoIdMaisRecente) ||
                  vinculos[0];
              }
            }

            // Get folha by vínculo when available
            let folhaRegistros;
            if (vinculoAtual) {
              folhaRegistros = await storage.getFolhaMesByVinculoId(
                vinculoAtual.id,
              );
              if (folhaRegistros.length === 0) {
                folhaRegistros = await storage.getFolhaMesByPessoaId(
                  result.lead.baseClienteId,
                );
              }
            } else {
              folhaRegistros = await storage.getFolhaMesByPessoaId(
                result.lead.baseClienteId,
              );
            }
            folhaAtual = folhaRegistros.length > 0 ? folhaRegistros[0] : null;

            // Get contratos by vínculo when available
            if (vinculoAtual) {
              contratos = await storage.getContratosByVinculoId(
                vinculoAtual.id,
              );
              if (contratos.length === 0) {
                const todosPessoa = await storage.getContratosByPessoaId(
                  result.lead.baseClienteId,
                );
                contratos = todosPessoa.filter(
                  (c) => !c.vinculoId || c.vinculoId === vinculoAtual.id,
                );
              }
            } else {
              contratos = await storage.getContratosByPessoaId(
                result.lead.baseClienteId,
              );
            }

            // Get higienização data (telefones e emails)
            const telefones = await storage.getTelefonesByPessoaId(
              result.lead.baseClienteId,
            );
            const contatos = await storage.getContactsByClientId(
              result.lead.baseClienteId,
            );

            // Combine and deduplicate telefones (preserve original formatting)
            const allTelefones = [
              ...telefones.map((t) => ({
                telefone: t.telefone || "",
                tipo: t.tipo || "telefone",
                principal: t.principal,
                _normalized: (t.telefone || "").replace(/\D/g, ""),
              })),
              ...contatos
                .filter((c) => c.tipo === "telefone")
                .map((c) => ({
                  telefone: c.valor || "",
                  tipo: "telefone",
                  principal: null,
                  _normalized: (c.valor || "").replace(/\D/g, ""),
                })),
            ];
            const seenTelefones = new Set<string>();
            const uniqueTelefones = allTelefones
              .filter((t) => {
                if (!t._normalized || seenTelefones.has(t._normalized))
                  return false;
                seenTelefones.add(t._normalized);
                return true;
              })
              .map((t) => ({
                telefone: t.telefone,
                tipo: t.tipo,
                principal: t.principal,
              }));

            // Deduplicate emails (preserve original case)
            const allEmails = contatos
              .filter((c) => c.tipo === "email" && c.valor)
              .map((c) => c.valor!);
            const seenEmails = new Set<string>();
            const uniqueEmails = allEmails.filter((email) => {
              const normalized = email.toLowerCase().trim();
              if (seenEmails.has(normalized)) return false;
              seenEmails.add(normalized);
              return true;
            });

            higienizacao = {
              telefones: uniqueTelefones,
              emails: uniqueEmails,
            };
          }
        }

        // Get events history
        const eventos = await storage.getEventsByAssignment(
          result.assignment.id,
        );

        // Get campaign info
        const campanha = await storage.getSalesCampaign(
          result.assignment.campaignId,
        );

        // Transform folha data to snake_case format expected by frontend
        const folhaFormatada = folhaAtual
          ? {
              competencia: safeCompetencia(folhaAtual.competencia),
              margem_bruta_5:
                folhaAtual.margemBruta5 != null
                  ? parseFloat(String(folhaAtual.margemBruta5))
                  : null,
              margem_utilizada_5:
                folhaAtual.margemUtilizada5 != null
                  ? parseFloat(String(folhaAtual.margemUtilizada5))
                  : null,
              margem_saldo_5:
                folhaAtual.margemSaldo5 != null
                  ? parseFloat(String(folhaAtual.margemSaldo5))
                  : null,
              margem_beneficio_bruta_5:
                folhaAtual.margemBeneficioBruta5 != null
                  ? parseFloat(String(folhaAtual.margemBeneficioBruta5))
                  : null,
              margem_beneficio_utilizada_5:
                folhaAtual.margemBeneficioUtilizada5 != null
                  ? parseFloat(String(folhaAtual.margemBeneficioUtilizada5))
                  : null,
              margem_beneficio_saldo_5:
                folhaAtual.margemBeneficioSaldo5 != null
                  ? parseFloat(String(folhaAtual.margemBeneficioSaldo5))
                  : null,
              margem_bruta_35:
                folhaAtual.margemBruta35 != null
                  ? parseFloat(String(folhaAtual.margemBruta35))
                  : null,
              margem_utilizada_35:
                folhaAtual.margemUtilizada35 != null
                  ? parseFloat(String(folhaAtual.margemUtilizada35))
                  : null,
              margem_saldo_35:
                folhaAtual.margemSaldo35 != null
                  ? parseFloat(String(folhaAtual.margemSaldo35))
                  : null,
              margem_bruta_70:
                folhaAtual.margemBruta70 != null
                  ? parseFloat(String(folhaAtual.margemBruta70))
                  : null,
              margem_utilizada_70:
                folhaAtual.margemUtilizada70 != null
                  ? parseFloat(String(folhaAtual.margemUtilizada70))
                  : null,
              margem_saldo_70:
                folhaAtual.margemSaldo70 != null
                  ? parseFloat(String(folhaAtual.margemSaldo70))
                  : null,
              margem_cartao_credito_saldo:
                folhaAtual.margemCartaoCreditoSaldo != null
                  ? parseFloat(String(folhaAtual.margemCartaoCreditoSaldo))
                  : null,
              margem_cartao_beneficio_saldo:
                folhaAtual.margemCartaoBeneficioSaldo != null
                  ? parseFloat(String(folhaAtual.margemCartaoBeneficioSaldo))
                  : null,
              salario_bruto:
                folhaAtual.salarioBruto != null
                  ? parseFloat(String(folhaAtual.salarioBruto))
                  : null,
              descontos_brutos:
                folhaAtual.descontosBrutos != null
                  ? parseFloat(String(folhaAtual.descontosBrutos))
                  : null,
              salario_liquido:
                folhaAtual.salarioLiquido != null
                  ? parseFloat(String(folhaAtual.salarioLiquido))
                  : null,
              creditos:
                folhaAtual.creditos != null
                  ? parseFloat(String(folhaAtual.creditos))
                  : null,
              debitos:
                folhaAtual.debitos != null
                  ? parseFloat(String(folhaAtual.debitos))
                  : null,
              liquido:
                folhaAtual.liquido != null
                  ? parseFloat(String(folhaAtual.liquido))
                  : null,
              sit_func_no_mes: folhaAtual.sitFuncNoMes,
              base_tag: folhaAtual.baseTag,
              extras_folha: folhaAtual.extrasFolha,
            }
          : null;

        return res.json({
          assignment: {
            ...result.assignment,
            status: finalStatuses.includes(result.assignment.status)
              ? result.assignment.status
              : "em_atendimento",
          },
          lead: result.lead,
          clienteBase,
          folhaAtual: folhaFormatada,
          contratos,
          eventos,
          campanha: campanha ? { id: campanha.id, nome: campanha.nome } : null,
          higienizacao,
          vinculo: vinculoAtual,
        });
      } catch (error) {
        console.error("Carregar atendimento error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao carregar atendimento" });
      }
    },
  );

  // GET /api/vendas/atendimento/campanhas-disponiveis - Campanhas com leads para o vendedor
  // IMPORTANT: This route MUST be before :assignmentId to avoid Express matching "campanhas-disponiveis" as an ID
  app.get(
    "/api/vendas/atendimento/campanhas-disponiveis",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Get campaigns where user has assignments
        const assignments = await storage.getAssignmentsByUser(userId);
        const campaignIds = [...new Set(assignments.map((a) => a.campaignId))];

        const campanhas = [];
        for (const id of campaignIds) {
          const campanha = await storage.getSalesCampaign(id);
          if (campanha && campanha.status === "ativa") {
            const leadsPendentes = assignments.filter(
              (a) =>
                a.campaignId === id &&
                ["novo", "em_atendimento"].includes(a.status),
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
    },
  );

  // GET /api/vendas/atendimento/:assignmentId - Detalhes do atendimento atual
  app.get(
    "/api/vendas/atendimento/:assignmentId",
    requireAuth,
    async (req, res) => {
      try {
        const assignmentId = parseInt(req.params.assignmentId);
        const userId = req.user!.id;

        const result = await storage.getAssignmentWithLead(assignmentId);
        if (!result) {
          return res
            .status(404)
            .json({ message: "Atendimento não encontrado" });
        }

        // Verify ownership - REFACTORED: Use isMaster or modulo_alpha permission
        const canViewOthersAssignment =
          req.user!.isMaster ||
          (await storage.hasModuleEditAccess(userId, "modulo_alpha"));
        if (result.assignment.userId !== userId && !canViewOthersAssignment) {
          logPermissionCheck(
            userId,
            req.user!.name,
            "modulo_alpha",
            "edit",
            false,
            "Cannot view other user's assignment",
          );
          return res.status(403).json({ message: "Acesso negado" });
        }

        // Get base cliente data if available
        let clienteBase = null;
        let folhaAtual = null;
        let contratos: any[] = [];
        let higienizacao: {
          telefones: any[];
          emails: string[];
          endereco?: any;
        } = { telefones: [], emails: [] };
        let vinculoAtual: any = null;

        if (result.lead.baseClienteId) {
          clienteBase = await storage.getClientePessoaById(
            result.lead.baseClienteId,
          );
          if (clienteBase) {
            // Get vínculos to find sit_func, rjur, orgao, upag (shared across tenants)
            const vinculos = await storage.getVinculosByPessoaId(
              result.lead.baseClienteId,
            );

            // Selecionar vínculo com folha mais recente (de TODOS, ou por matrícula se especificada)
            if (vinculos.length > 0) {
              if (result.lead.matricula) {
                vinculoAtual = vinculos.find(
                  (v) => v.matricula === result.lead.matricula,
                );
              }
              if (!vinculoAtual) {
                const vinculoIds = vinculos.map((v) => v.id);
                const vinculoIdMaisRecente =
                  await storage.getVinculoIdWithLatestFolha(vinculoIds);
                vinculoAtual =
                  vinculos.find((v) => v.id === vinculoIdMaisRecente) ||
                  vinculos[0];
              }
            }

            // Get folha by vínculo when available
            let folhaRegistros;
            if (vinculoAtual) {
              folhaRegistros = await storage.getFolhaMesByVinculoId(
                vinculoAtual.id,
              );
              // Fallback: se não encontrou por vínculo, tentar por pessoa
              if (folhaRegistros.length === 0) {
                folhaRegistros = await storage.getFolhaMesByPessoaId(
                  result.lead.baseClienteId,
                );
              }
            } else {
              folhaRegistros = await storage.getFolhaMesByPessoaId(
                result.lead.baseClienteId,
              );
            }
            folhaAtual = folhaRegistros.length > 0 ? folhaRegistros[0] : null;

            // Get contratos by vínculo when available
            if (vinculoAtual) {
              contratos = await storage.getContratosByVinculoId(
                vinculoAtual.id,
              );
              if (contratos.length === 0) {
                const todosPessoa = await storage.getContratosByPessoaId(
                  result.lead.baseClienteId,
                );
                contratos = todosPessoa.filter(
                  (c) => !c.vinculoId || c.vinculoId === vinculoAtual.id,
                );
              }
            } else {
              contratos = await storage.getContratosByPessoaId(
                result.lead.baseClienteId,
              );
            }

            // Get higienização data
            const telefones = await storage.getTelefonesByPessoaId(
              result.lead.baseClienteId,
            );
            const contatos = await storage.getContactsByClientId(
              result.lead.baseClienteId,
            );

            // Combine and deduplicate telefones (preserve original formatting)
            const allTelefones = [
              ...telefones.map((t) => ({
                telefone: t.telefone || "",
                tipo: t.tipo || "telefone",
                principal: t.principal,
                _normalized: (t.telefone || "").replace(/\D/g, ""),
              })),
              ...contatos
                .filter((c) => c.tipo === "telefone")
                .map((c) => ({
                  telefone: c.valor || "",
                  tipo: "telefone",
                  principal: null,
                  _normalized: (c.valor || "").replace(/\D/g, ""),
                })),
            ];
            const seenTelefones = new Set<string>();
            const uniqueTelefones = allTelefones
              .filter((t) => {
                if (!t._normalized || seenTelefones.has(t._normalized))
                  return false;
                seenTelefones.add(t._normalized);
                return true;
              })
              .map((t) => ({
                telefone: t.telefone,
                tipo: t.tipo,
                principal: t.principal,
              }));

            // Deduplicate emails (preserve original case)
            const allEmails = contatos
              .filter((c) => c.tipo === "email" && c.valor)
              .map((c) => c.valor!);
            const seenEmails = new Set<string>();
            const uniqueEmails = allEmails.filter((email) => {
              const normalized = email.toLowerCase().trim();
              if (seenEmails.has(normalized)) return false;
              seenEmails.add(normalized);
              return true;
            });

            higienizacao = {
              telefones: uniqueTelefones,
              emails: uniqueEmails,
            };
          }
        }

        // Get events history
        const eventos = await storage.getEventsByAssignment(assignmentId);

        // Get campaign info
        const campanha = await storage.getSalesCampaign(
          result.assignment.campaignId,
        );

        // Transform folha data to snake_case format expected by frontend
        const folhaFormatada = folhaAtual
          ? {
              competencia: safeCompetencia(folhaAtual.competencia),
              margem_bruta_5:
                folhaAtual.margemBruta5 != null
                  ? parseFloat(String(folhaAtual.margemBruta5))
                  : null,
              margem_utilizada_5:
                folhaAtual.margemUtilizada5 != null
                  ? parseFloat(String(folhaAtual.margemUtilizada5))
                  : null,
              margem_saldo_5:
                folhaAtual.margemSaldo5 != null
                  ? parseFloat(String(folhaAtual.margemSaldo5))
                  : null,
              margem_beneficio_bruta_5:
                folhaAtual.margemBeneficioBruta5 != null
                  ? parseFloat(String(folhaAtual.margemBeneficioBruta5))
                  : null,
              margem_beneficio_utilizada_5:
                folhaAtual.margemBeneficioUtilizada5 != null
                  ? parseFloat(String(folhaAtual.margemBeneficioUtilizada5))
                  : null,
              margem_beneficio_saldo_5:
                folhaAtual.margemBeneficioSaldo5 != null
                  ? parseFloat(String(folhaAtual.margemBeneficioSaldo5))
                  : null,
              margem_bruta_35:
                folhaAtual.margemBruta35 != null
                  ? parseFloat(String(folhaAtual.margemBruta35))
                  : null,
              margem_utilizada_35:
                folhaAtual.margemUtilizada35 != null
                  ? parseFloat(String(folhaAtual.margemUtilizada35))
                  : null,
              margem_saldo_35:
                folhaAtual.margemSaldo35 != null
                  ? parseFloat(String(folhaAtual.margemSaldo35))
                  : null,
              margem_bruta_70:
                folhaAtual.margemBruta70 != null
                  ? parseFloat(String(folhaAtual.margemBruta70))
                  : null,
              margem_utilizada_70:
                folhaAtual.margemUtilizada70 != null
                  ? parseFloat(String(folhaAtual.margemUtilizada70))
                  : null,
              margem_saldo_70:
                folhaAtual.margemSaldo70 != null
                  ? parseFloat(String(folhaAtual.margemSaldo70))
                  : null,
              margem_cartao_credito_saldo:
                folhaAtual.margemCartaoCreditoSaldo != null
                  ? parseFloat(String(folhaAtual.margemCartaoCreditoSaldo))
                  : null,
              margem_cartao_beneficio_saldo:
                folhaAtual.margemCartaoBeneficioSaldo != null
                  ? parseFloat(String(folhaAtual.margemCartaoBeneficioSaldo))
                  : null,
              salario_bruto:
                folhaAtual.salarioBruto != null
                  ? parseFloat(String(folhaAtual.salarioBruto))
                  : null,
              descontos_brutos:
                folhaAtual.descontosBrutos != null
                  ? parseFloat(String(folhaAtual.descontosBrutos))
                  : null,
              salario_liquido:
                folhaAtual.salarioLiquido != null
                  ? parseFloat(String(folhaAtual.salarioLiquido))
                  : null,
              creditos:
                folhaAtual.creditos != null
                  ? parseFloat(String(folhaAtual.creditos))
                  : null,
              debitos:
                folhaAtual.debitos != null
                  ? parseFloat(String(folhaAtual.debitos))
                  : null,
              liquido:
                folhaAtual.liquido != null
                  ? parseFloat(String(folhaAtual.liquido))
                  : null,
              sit_func_no_mes: folhaAtual.sitFuncNoMes,
              base_tag: folhaAtual.baseTag,
              extras_folha: folhaAtual.extrasFolha,
            }
          : null;

        return res.json({
          assignment: result.assignment,
          lead: result.lead,
          clienteBase,
          folhaAtual: folhaFormatada,
          contratos,
          eventos,
          campanha: campanha ? { id: campanha.id, nome: campanha.nome } : null,
          higienizacao,
          vinculo: vinculoAtual,
        });
      } catch (error) {
        console.error("Get atendimento error:", error);
        return res.status(500).json({ message: "Erro ao buscar atendimento" });
      }
    },
  );

  // POST /api/vendas/atendimento/:assignmentId/registrar - Registrar atendimento
  app.post(
    "/api/vendas/atendimento/:assignmentId/registrar",
    requireAuth,
    async (req, res) => {
      try {
        const assignmentId = parseInt(req.params.assignmentId);
        const userId = req.user!.id;
        const { tipo, resultado, observacao, status } = req.body;

        const result = await storage.getAssignmentWithLead(assignmentId);
        if (!result) {
          return res
            .status(404)
            .json({ message: "Atendimento não encontrado" });
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
        return res
          .status(500)
          .json({ message: "Erro ao registrar atendimento" });
      }
    },
  );

  // ===== NOVO SISTEMA DE MARCADORES =====

  // GET /api/crm/queue/next - Próximo lead da fila
  app.get("/api/crm/queue/next", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const campaignId = req.query.campaignId
        ? parseInt(req.query.campaignId as string)
        : undefined;

      const result = await storage.getNextLeadInQueue(userId, campaignId);

      if (!result) {
        return res.json({ lead: null, message: "Nenhum lead na fila" });
      }

      // Get interactions history
      const interactions = await storage.getInteractionsByLead(result.lead.id);

      // Get client base data if available
      let clienteBase = null;
      if (result.lead.baseClienteId) {
        clienteBase = await storage.getClientePessoaById(
          result.lead.baseClienteId,
        );
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
      const {
        tipoContato,
        leadMarker,
        motivo,
        observacao,
        retornoEm,
        margemValor,
        propostaValorEstimado,
      } = req.body;

      if (!tipoContato || !leadMarker) {
        return res
          .status(400)
          .json({ message: "Tipo de contato e marcador são obrigatórios" });
      }

      // Update lead marker and current margin/proposal values
      const retornoDate = retornoEm ? new Date(retornoEm) : undefined;
      await storage.updateLeadMarker(
        leadId,
        leadMarker,
        motivo,
        retornoDate,
        tipoContato,
      );

      // Update lead's current margin and proposal if provided
      if (margemValor !== undefined || propostaValorEstimado !== undefined) {
        await db
          .update(salesLeads)
          .set({
            currentMargin: margemValor ? String(margemValor) : undefined,
            currentProposal: propostaValorEstimado
              ? String(propostaValorEstimado)
              : undefined,
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
        propostaValorEstimado: propostaValorEstimado
          ? String(propostaValorEstimado)
          : null,
      });

      // Update assignment status based on marker
      const assignments = await storage.getAssignmentsByUser(userId);
      const assignment = assignments.find((a) => a.leadId === leadId);

      if (assignment) {
        let newStatus = "em_atendimento";
        if (["VENDIDO"].includes(leadMarker)) {
          newStatus = "vendido";
        } else if (
          [
            "NAO_ATENDE",
            "TELEFONE_INVALIDO",
            "ENGANO",
            "SEM_INTERESSE",
          ].includes(leadMarker)
        ) {
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

  // POST /api/crm/leads/:id/move-quick - Movimentação rápida de lead sem observação obrigatória
  app.post("/api/crm/leads/:id/move-quick", requireAuth, async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { marker } = req.body;

      if (!marker) {
        return res.status(400).json({ message: "Marcador é obrigatório" });
      }

      // Validate marker is a valid LEAD_MARKER
      if (!LEAD_MARKERS.includes(marker)) {
        return res.status(400).json({ message: "Marcador inválido" });
      }

      // Cannot move to NOVO
      if (marker === "NOVO") {
        return res
          .status(400)
          .json({ message: "Não é possível mover para NOVO" });
      }

      // Update lead marker directly
      await db
        .update(salesLeads)
        .set({
          leadMarker: marker,
          ultimoContatoEm: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(salesLeads.id, leadId));

      // Update assignment status based on marker
      const assignments = await storage.getAssignmentsByUser(userId);
      const assignment = assignments.find((a) => a.leadId === leadId);

      if (assignment) {
        let newStatus = "em_atendimento";
        if (["VENDIDO"].includes(marker)) {
          newStatus = "vendido";
        } else if (
          [
            "NAO_ATENDE",
            "TELEFONE_INVALIDO",
            "ENGANO",
            "SEM_INTERESSE",
          ].includes(marker)
        ) {
          newStatus = "descartado";
        }

        await storage.updateSalesLeadAssignment(assignment.id, {
          status: newStatus,
          dataUltimoAtendimento: new Date(),
        });
      }

      return res.json({
        success: true,
        message: "Lead movido com sucesso",
      });
    } catch (error) {
      console.error("Quick move lead error:", error);
      return res.status(500).json({ message: "Erro ao mover lead" });
    }
  });

  // POST /api/crm/consulta/registrar-atendimento - Registrar atendimento a partir de consulta de cliente
  app.post(
    "/api/crm/consulta/registrar-atendimento",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const {
          pessoaId,
          tipoContato,
          leadMarker,
          telefoneUsado,
          motivo,
          observacao,
          retornoEm,
          margemValor,
          propostaValorEstimado,
        } = req.body;

        if (!pessoaId || !tipoContato || !leadMarker) {
          return res
            .status(400)
            .json({ message: "Dados obrigatórios faltando" });
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
          .where(
            and(
              eq(salesCampaigns.nome, "Consulta CRM"),
              eq(salesCampaigns.ativo, true),
            ),
          )
          .limit(1);

        let campaignId: number;
        if (campaign.length === 0) {
          // Create the campaign
          const [newCampaign] = await db
            .insert(salesCampaigns)
            .values({
              nome: "Consulta CRM",
              descricao: "Leads gerados a partir de consultas diretas no CRM",
              ativo: true,
              criadoPor: userId,
            })
            .returning();
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
        let leadCampaignId: number;
        if (existingLeads.length > 0) {
          leadId = existingLeads[0].id;
          leadCampaignId = existingLeads[0].campaignId;
        } else {
          // Create new lead from pessoa
          const [newLead] = await db
            .insert(salesLeads)
            .values({
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
            })
            .returning();
          leadId = newLead.id;
          leadCampaignId = campaignId;
        }

        // Update lead marker and values
        const retornoDate = retornoEm ? new Date(retornoEm) : undefined;
        await storage.updateLeadMarker(
          leadId,
          leadMarker,
          motivo,
          retornoDate,
          tipoContato,
        );

        if (margemValor !== undefined || propostaValorEstimado !== undefined) {
          await db
            .update(salesLeads)
            .set({
              currentMargin: margemValor ? String(margemValor) : undefined,
              currentProposal: propostaValorEstimado
                ? String(propostaValorEstimado)
                : undefined,
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
          propostaValorEstimado: propostaValorEstimado
            ? String(propostaValorEstimado)
            : null,
        });

        // Create or update assignment for the user
        const existingAssignments = await db
          .select()
          .from(salesLeadAssignments)
          .where(
            and(
              eq(salesLeadAssignments.leadId, leadId),
              eq(salesLeadAssignments.userId, userId),
            ),
          )
          .limit(1);

        if (existingAssignments.length === 0) {
          await db.insert(salesLeadAssignments).values({
            leadId,
            userId,
            campaignId: leadCampaignId,
            status: "em_atendimento",
            dataUltimoAtendimento: new Date(),
          });
        } else {
          await db
            .update(salesLeadAssignments)
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
        return res
          .status(500)
          .json({ message: "Erro ao registrar atendimento" });
      }
    },
  );

  // GET /api/crm/cliente/:pessoaId/interactions - Get all interactions for a client by pessoaId
  app.get(
    "/api/crm/cliente/:pessoaId/interactions",
    requireAuth,
    async (req, res) => {
      try {
        const pessoaId = parseInt(req.params.pessoaId);
        if (isNaN(pessoaId)) {
          return res.status(400).json({ message: "ID de pessoa inválido" });
        }

        const userTenantId = req.tenantId;
        const isMaster = req.user!.isMaster;

        // Find all leads for this pessoa, filtered by tenant
        const baseCondition = eq(salesLeads.baseClienteId, pessoaId);
        const whereCondition =
          userTenantId && !isMaster
            ? and(baseCondition, eq(salesLeads.tenantId, userTenantId))
            : baseCondition;

        const leads = await db
          .select({ id: salesLeads.id })
          .from(salesLeads)
          .where(whereCondition);

        if (leads.length === 0) {
          return res.json([]);
        }

        const leadIds = leads.map((l) => l.id);

        // Get all interactions for these leads
        const interactions = await db
          .select({
            id: leadInteractions.id,
            tipoContato: leadInteractions.tipoContato,
            leadMarker: leadInteractions.leadMarker,
            motivo: leadInteractions.motivo,
            observacao: leadInteractions.observacao,
            retornoEm: leadInteractions.retornoEm,
            createdAt: leadInteractions.createdAt,
            userName: users.nome,
            campaignName: salesCampaigns.nome,
          })
          .from(leadInteractions)
          .innerJoin(users, eq(leadInteractions.userId, users.id))
          .innerJoin(salesLeads, eq(leadInteractions.leadId, salesLeads.id))
          .innerJoin(
            salesCampaigns,
            eq(salesLeads.campaignId, salesCampaigns.id),
          )
          .where(inArray(leadInteractions.leadId, leadIds))
          .orderBy(desc(leadInteractions.createdAt))
          .limit(50);

        return res.json(interactions);
      } catch (error) {
        console.error("Get client interactions error:", error);
        return res.status(500).json({ message: "Erro ao buscar histórico" });
      }
    },
  );

  // GET /api/crm/cliente/:pessoaId/pipeline - Get all pipeline entries for a client
  app.get(
    "/api/crm/cliente/:pessoaId/pipeline",
    requireAuth,
    async (req, res) => {
      try {
        const pessoaId = parseInt(req.params.pessoaId);
        if (isNaN(pessoaId)) {
          return res.status(400).json({ message: "ID de pessoa inválido" });
        }

        const userTenantId = req.tenantId;
        const isMaster = req.user!.isMaster;

        // Build conditions with tenant filtering
        const baseCondition = eq(salesLeads.baseClienteId, pessoaId);
        const whereCondition =
          userTenantId && !isMaster
            ? and(baseCondition, eq(salesLeads.tenantId, userTenantId))
            : baseCondition;

        const pipeline = await db
          .select({
            leadId: salesLeads.id,
            campaignName: salesCampaigns.nome,
            leadMarker: salesLeads.leadMarker,
          })
          .from(salesLeads)
          .innerJoin(
            salesCampaigns,
            eq(salesLeads.campaignId, salesCampaigns.id),
          )
          .where(whereCondition);

        return res.json(pipeline);
      } catch (error) {
        console.error("Get client pipeline error:", error);
        return res.status(500).json({ message: "Erro ao buscar pipeline" });
      }
    },
  );

  // POST /api/crm/cliente/criar-lead - Create a lead from pessoaId to a specific campaign
  app.post("/api/crm/cliente/criar-lead", requireAuth, async (req, res) => {
    try {
      const { pessoaId, campaignId } = req.body;
      const userTenantId = req.tenantId;

      if (!pessoaId || !campaignId) {
        return res
          .status(400)
          .json({ message: "pessoaId e campaignId são obrigatórios" });
      }

      const pessoa = await storage.getClientePessoaById(pessoaId);
      if (!pessoa) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      // Verify the campaign belongs to user's tenant
      const campaign = await db
        .select()
        .from(salesCampaigns)
        .where(eq(salesCampaigns.id, campaignId))
        .limit(1);
      if (campaign.length === 0) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      if (
        userTenantId &&
        !req.user!.isMaster &&
        campaign[0].tenantId !== userTenantId
      ) {
        return res
          .status(403)
          .json({ message: "Sem permissão para esta campanha" });
      }

      // Check if lead already exists for this pessoa in this campaign
      const existingLead = await db
        .select()
        .from(salesLeads)
        .where(
          and(
            eq(salesLeads.baseClienteId, pessoaId),
            eq(salesLeads.campaignId, campaignId),
          ),
        )
        .limit(1);

      if (existingLead.length > 0) {
        return res
          .status(400)
          .json({ message: "Cliente já existe nesta campanha" });
      }

      const [newLead] = await db
        .insert(salesLeads)
        .values({
          tenantId: campaign[0].tenantId,
          campaignId,
          cpf: pessoa.cpf || null,
          nome: pessoa.nome || "Nome não informado",
          telefone1: pessoa.telefonesBase?.[0] || null,
          telefone2: pessoa.telefonesBase?.[1] || null,
          telefone3: pessoa.telefonesBase?.[2] || null,
          cidade: pessoa.municipio || null,
          uf: pessoa.uf || null,
          baseClienteId: pessoaId,
          leadMarker: "NOVO",
        })
        .returning();

      return res.json({
        message: "Lead criado com sucesso",
        leadId: newLead.id,
      });
    } catch (error) {
      console.error("Create lead from pessoa error:", error);
      return res.status(500).json({ message: "Erro ao criar lead" });
    }
  });

  // POST /api/crm/cliente/criar-lead-direto - Create a lead from consultation (auto campaign "Atendimento Direto")
  app.post(
    "/api/crm/cliente/criar-lead-direto",
    requireAuth,
    async (req, res) => {
      try {
        console.log(
          "[criar-lead-direto] Request body:",
          JSON.stringify(req.body),
        );
        const {
          pessoaId,
          marcador,
          margemValor,
          propostaValorEstimado,
          observacoes,
          tipoContato,
        } = req.body;
        const userId = req.user!.id;

        console.log(
          "[criar-lead-direto] userId:",
          userId,
          "pessoaId:",
          pessoaId,
          "marcador:",
          marcador,
        );

        if (!pessoaId) {
          console.log("[criar-lead-direto] Error: pessoaId is missing");
          return res.status(400).json({ message: "pessoaId é obrigatório" });
        }

        const pessoa = await storage.getClientePessoaById(pessoaId);
        if (!pessoa) {
          console.log(
            "[criar-lead-direto] Error: pessoa not found for id:",
            pessoaId,
          );
          return res.status(404).json({ message: "Cliente não encontrado" });
        }
        console.log(
          "[criar-lead-direto] Found pessoa id:",
          pessoa.id,
          "nome:",
          pessoa.nome || "(sem nome)",
          "cpf:",
          pessoa.cpf || "(sem cpf)",
        );

        // Use user's tenantId, or pessoa's tenantId, or user's own tenantId from profile
        let tenantId = req.tenantId || pessoa.tenantId || req.user!.tenantId;
        console.log(
          "[criar-lead-direto] Initial tenantId resolution:",
          tenantId,
          "(req:",
          req.tenantId,
          ", pessoa:",
          pessoa.tenantId,
          ", user:",
          req.user!.tenantId,
          ")",
        );

        // If still no tenant, try to get or create a default one
        if (!tenantId) {
          console.log("[criar-lead-direto] No tenant found, trying default...");
          const defaultTenant = await db.select().from(tenants).limit(1);
          if (defaultTenant.length > 0) {
            tenantId = defaultTenant[0].id;
            console.log("[criar-lead-direto] Using default tenant:", tenantId);
          } else {
            console.log("[criar-lead-direto] Error: No tenants in system");
            return res
              .status(400)
              .json({ message: "Nenhum tenant configurado no sistema" });
          }
        }

        // Find or create "Atendimento Direto" campaign for this tenant
        console.log(
          "[criar-lead-direto] Looking for campaign with tenantId:",
          tenantId,
        );

        let campaign = await db
          .select()
          .from(salesCampaigns)
          .where(
            and(
              eq(salesCampaigns.tenantId, tenantId),
              eq(salesCampaigns.nome, "Atendimento Direto"),
            ),
          )
          .limit(1);

        let campaignId: number;

        if (campaign.length === 0) {
          console.log(
            "[criar-lead-direto] Creating new campaign for tenant:",
            tenantId,
          );
          // Create the default campaign
          const [newCampaign] = await db
            .insert(salesCampaigns)
            .values({
              tenantId: tenantId,
              nome: "Atendimento Direto",
              descricao:
                "Leads originados de consultas diretas na tela de consulta",
              status: "ACTIVE",
              criadoPor: userId,
            })
            .returning();
          campaignId = newCampaign.id;
          console.log(
            "[criar-lead-direto] Created campaign with id:",
            campaignId,
          );
        } else {
          campaignId = campaign[0].id;
          console.log(
            "[criar-lead-direto] Found existing campaign with id:",
            campaignId,
          );
        }

        // Check if lead already exists for this pessoa in this campaign
        console.log(
          "[criar-lead-direto] Checking for existing lead with pessoaId:",
          pessoaId,
          "campaignId:",
          campaignId,
        );

        const existingLead = await db
          .select()
          .from(salesLeads)
          .where(
            and(
              eq(salesLeads.baseClienteId, pessoaId),
              eq(salesLeads.campaignId, campaignId),
            ),
          )
          .limit(1);

        console.log(
          "[criar-lead-direto] Existing lead check result:",
          existingLead.length > 0
            ? `Found lead id ${existingLead[0].id}`
            : "No existing lead",
        );

        if (existingLead.length > 0) {
          const leadId = existingLead[0].id;
          console.log(
            "[criar-lead-direto] Lead already exists with id:",
            leadId,
            "- updating...",
          );

          // Update existing lead with new data - map consultation markers to pipeline LEAD_MARKERS
          const marcadorMap: Record<string, string> = {
            em_atendimento: "EM_ATENDIMENTO",
            interesse: "INTERESSADO",
            agendar_retorno: "AGUARDANDO_RETORNO",
            sem_interesse: "SEM_INTERESSE",
            vendido: "VENDIDO",
            concluido: "VENDIDO",
          };
          const leadMarker =
            marcadorMap[marcador] || existingLead[0].leadMarker || "NOVO";
          console.log(
            "[criar-lead-direto] Mapped marcador:",
            marcador,
            "->",
            leadMarker,
          );

          // Update the lead with new interaction data
          await db
            .update(salesLeads)
            .set({
              leadMarker,
              currentMargin: margemValor
                ? String(margemValor)
                : existingLead[0].currentMargin,
              currentProposal: propostaValorEstimado
                ? String(propostaValorEstimado)
                : existingLead[0].currentProposal,
              observacoes: observacoes || existingLead[0].observacoes,
              ultimoContatoEm: new Date(),
              ultimoTipoContato:
                tipoContato || existingLead[0].ultimoTipoContato,
              assignedTo: existingLead[0].assignedTo || userId,
              updatedAt: new Date(),
            })
            .where(eq(salesLeads.id, leadId));

          console.log("[criar-lead-direto] Lead updated successfully");

          // Check for existing assignment
          const existingAssignment = await db
            .select()
            .from(salesLeadAssignments)
            .where(
              and(
                eq(salesLeadAssignments.leadId, leadId),
                eq(salesLeadAssignments.userId, userId),
              ),
            )
            .limit(1);

          if (existingAssignment.length === 0) {
            console.log(
              "[criar-lead-direto] Creating assignment for user:",
              userId,
            );
            await db.insert(salesLeadAssignments).values({
              leadId,
              userId,
              campaignId,
              status: "em_atendimento",
              dataUltimoAtendimento: new Date(),
            });
          } else {
            console.log(
              "[criar-lead-direto] Assignment already exists, updating...",
            );
            await db
              .update(salesLeadAssignments)
              .set({
                status: "em_atendimento",
                dataUltimoAtendimento: new Date(),
              })
              .where(eq(salesLeadAssignments.id, existingAssignment[0].id));
          }

          // Create interaction record for this update
          await db.insert(leadInteractions).values({
            leadId,
            userId,
            tipoContato: tipoContato || "outro",
            leadMarker,
            observacao: observacoes || null,
            margemValor: margemValor ? String(margemValor) : null,
            propostaValorEstimado: propostaValorEstimado
              ? String(propostaValorEstimado)
              : null,
          });

          console.log(
            "[criar-lead-direto] Interaction created for existing lead",
          );

          return res.json({
            success: true,
            message: "Lead atualizado com sucesso",
            leadId,
            updated: true,
          });
        }

        // Map marcador from consultation to lead marker (LEAD_MARKERS from schema)
        const marcadorMap: Record<string, string> = {
          em_atendimento: "EM_ATENDIMENTO",
          interesse: "INTERESSADO",
          agendar_retorno: "AGUARDANDO_RETORNO",
          sem_interesse: "SEM_INTERESSE",
          vendido: "VENDIDO",
          concluido: "VENDIDO",
        };
        const leadMarker = marcadorMap[marcador] || "NOVO";

        console.log(
          "[criar-lead-direto] Mapped marcador:",
          marcador,
          "-> leadMarker:",
          leadMarker,
        );

        const [newLead] = await db
          .insert(salesLeads)
          .values({
            tenantId: tenantId,
            campaignId,
            cpf: pessoa.cpf || null,
            nome: pessoa.nome || "Nome não informado",
            telefone1: (pessoa.telefonesBase as string[] | null)?.[0] || null,
            telefone2: (pessoa.telefonesBase as string[] | null)?.[1] || null,
            telefone3: (pessoa.telefonesBase as string[] | null)?.[2] || null,
            cidade: pessoa.municipio || null,
            uf: pessoa.uf || null,
            baseClienteId: pessoaId,
            leadMarker,
            assignedTo: userId,
            status: "ATRIBUIDO",
            currentMargin: margemValor ? String(margemValor) : null,
            currentProposal: propostaValorEstimado
              ? String(propostaValorEstimado)
              : null,
            observacoes: observacoes || null,
            ultimoContatoEm: new Date(),
            ultimoTipoContato: tipoContato || null,
          })
          .returning();

        console.log("[criar-lead-direto] Lead created with id:", newLead.id);

        // Create assignment for this user (REQUIRED for pipeline visibility)
        await db.insert(salesLeadAssignments).values({
          leadId: newLead.id,
          userId,
          campaignId,
          status: "em_atendimento",
          dataUltimoAtendimento: new Date(),
        });

        console.log("[criar-lead-direto] Assignment created for user:", userId);

        // Create interaction record
        await db.insert(leadInteractions).values({
          leadId: newLead.id,
          userId,
          tipoContato: tipoContato || "outro",
          leadMarker,
          observacao: observacoes || null,
          margemValor: margemValor ? String(margemValor) : null,
          propostaValorEstimado: propostaValorEstimado
            ? String(propostaValorEstimado)
            : null,
        });

        console.log("[criar-lead-direto] Interaction created successfully");

        return res.json({
          success: true,
          message: "Lead criado com sucesso",
          leadId: newLead.id,
          created: true,
        });
      } catch (error: unknown) {
        const err = error as Error & { code?: string; detail?: string };
        console.error(
          "[criar-lead-direto] Error:",
          err.message,
          err.code,
          err.detail,
        );
        console.error("[criar-lead-direto] Stack:", err.stack);
        return res.status(500).json({
          message: "Erro ao criar lead",
          error: err.message,
          code: err.code,
          detail: err.detail,
        });
      }
    },
  );

  // ===== CAMPAIGN MANAGEMENT ENDPOINTS =====

  // GET /api/crm/campaigns/:id/distribution - Get lead distribution by marker
  app.get(
    "/api/crm/campaigns/:id/distribution",
    requireAuth,
    async (req, res) => {
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
    },
  );

  // POST /api/crm/campaigns/:id/reassign - Reassign leads from one user to another
  app.post("/api/crm/campaigns/:id/reassign", requireAuth, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      if (isNaN(campaignId)) {
        return res.status(400).json({ message: "ID de campanha inválido" });
      }

      const { fromUserId, toUserId, leadMarkers } = req.body;

      if (!fromUserId || !toUserId) {
        return res
          .status(400)
          .json({ message: "IDs de usuário são obrigatórios" });
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
              inArray(salesLeads.leadMarker, leadMarkers),
            ),
          );
        leadIdsToReassign = leadsWithMarkers.map((l) => l.id);

        if (leadIdsToReassign.length === 0) {
          return res.json({
            message: "Nenhum lead encontrado com os marcadores especificados",
            count: 0,
          });
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
              inArray(salesLeadAssignments.leadId, leadIdsToReassign),
            ),
          )
          .returning({ id: salesLeadAssignments.id });
      } else {
        updateResult = await db
          .update(salesLeadAssignments)
          .set({ userId: toUserId, updatedAt: new Date() })
          .where(
            and(
              eq(salesLeadAssignments.campaignId, campaignId),
              eq(salesLeadAssignments.userId, fromUserId),
            ),
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
  app.post(
    "/api/crm/campaigns/:id/repescagem",
    requireAuth,
    async (req, res) => {
      try {
        const campaignId = parseInt(req.params.id);
        if (isNaN(campaignId)) {
          return res.status(400).json({ message: "ID de campanha inválido" });
        }

        const { leadMarkers } = req.body;

        if (
          !leadMarkers ||
          !Array.isArray(leadMarkers) ||
          leadMarkers.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "Marcadores são obrigatórios" });
        }

        // Get leads with the specified markers in this campaign
        const leadsToReset = await db
          .select({ id: salesLeads.id })
          .from(salesLeads)
          .where(
            and(
              eq(salesLeads.campaignId, campaignId),
              inArray(salesLeads.leadMarker, leadMarkers),
            ),
          );

        if (leadsToReset.length === 0) {
          return res.json({
            message: "Nenhum lead encontrado com os marcadores especificados",
            count: 0,
          });
        }

        const leadIds = leadsToReset.map((l) => l.id);

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
              leadsDistribuidos: Math.max(
                0,
                currentLeadsDistribuidos - deletedAssignments.length,
              ),
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
        return res
          .status(500)
          .json({ message: "Erro ao devolver leads ao pool" });
      }
    },
  );

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
      return res
        .status(500)
        .json({ message: "Erro ao buscar agendamentos detalhados" });
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
  app.post(
    "/api/vendas/atendimento/:assignmentId/agendar",
    requireAuth,
    async (req, res) => {
      try {
        const assignmentId = parseInt(req.params.assignmentId);
        const userId = req.user!.id;

        if (isNaN(assignmentId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const { dataHora, observacao } = req.body;

        if (!dataHora) {
          return res
            .status(400)
            .json({ message: "Data e hora são obrigatórias" });
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
    },
  );

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
        isManual: true,
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
      const updateData: {
        label?: string;
        value?: string;
        isPrimary?: boolean;
      } = {};

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
  app.post(
    "/api/crm/contacts/:contactId/primary",
    requireAuth,
    async (req, res) => {
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
        return res
          .status(500)
          .json({ message: "Erro ao definir contato principal" });
      }
    },
  );

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
      return res
        .status(500)
        .json({ message: "Erro ao buscar contatos por etiqueta" });
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
            const teamIds = [currentUserId, ...teamMembers.map((m) => m.id)];
            if (!teamIds.includes(requestedUserId)) {
              return res.status(403).json({
                message: "Acesso negado - usuário não pertence à sua equipe",
              });
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
      const summary: Record<
        string,
        { count: number; somaMargens: number; somaPropostas: number }
      > = {};
      for (const marker of LEAD_MARKERS) {
        const leadsInMarker = assignments.filter(
          (a) => a.leadMarker === marker,
        );
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
      const {
        marker,
        tipoContato,
        observacao,
        motivo,
        retornoEm,
        contactId,
        margemValor,
        propostaValorEstimado,
      } = req.body;

      if (isNaN(leadId) || !marker || !LEAD_MARKERS.includes(marker)) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      // Marcador "NOVO" não é permitido no modal de atendimento
      if (marker === "NOVO") {
        return res
          .status(400)
          .json({ message: "Marcador NOVO não é permitido" });
      }

      // Validar campos obrigatórios para qualquer atendimento
      // contactId é opcional (pode ser null se o lead não tem contatos cadastrados)
      if (
        margemValor === undefined ||
        margemValor === null ||
        margemValor === ""
      ) {
        return res.status(400).json({ message: "Margem é obrigatória" });
      }
      if (
        propostaValorEstimado === undefined ||
        propostaValorEstimado === null ||
        propostaValorEstimado === ""
      ) {
        return res
          .status(400)
          .json({ message: "Valor estimado da proposta é obrigatório" });
      }

      const now = new Date();

      await db
        .update(salesLeads)
        .set({
          leadMarker: marker,
          motivo: motivo || null,
          retornoEm: retornoEm ? new Date(retornoEm) : null,
          ultimoContatoEm: now,
          ultimoTipoContato: tipoContato || "ligacao",
          currentMargin: margemValor ? String(margemValor) : undefined,
          currentProposal: propostaValorEstimado
            ? String(propostaValorEstimado)
            : undefined,
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

  // POST /api/crm/leads/:id/observation - Adicionar observação/interação sem mover de estágio
  app.post("/api/crm/leads/:id/observation", requireAuth, async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const userId = req.user!.id;
      const tenantId = req.user!.tenantId;

      if (isNaN(leadId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Validação básica dos campos
      const tipoContato =
        typeof req.body.tipoContato === "string"
          ? req.body.tipoContato
          : "observacao";
      const observacao =
        typeof req.body.observacao === "string"
          ? req.body.observacao.trim()
          : "";
      const contactId =
        typeof req.body.contactId === "number" ? req.body.contactId : null;

      if (!observacao || observacao.length === 0) {
        return res.status(400).json({ message: "Observação é obrigatória" });
      }

      // Verificar se o lead existe e pertence ao tenant/usuário correto
      const [lead] = await db
        .select()
        .from(salesLeads)
        .where(eq(salesLeads.id, leadId))
        .limit(1);
      if (!lead) {
        return res.status(404).json({ message: "Lead não encontrado" });
      }

      // Verificar isolamento de tenant
      if (tenantId && lead.tenantId && lead.tenantId !== tenantId) {
        return res.status(403).json({ message: "Acesso negado a este lead" });
      }

      // Verificar se o usuário tem acesso ao lead (é o dono ou tem permissão especial)
      const isMaster = req.user!.isMaster;
      const isOwner = lead.assignedTo === userId;
      const hasSpecialAccess = ["atendimento", "coordenacao"].includes(
        req.user!.role,
      );

      if (!isMaster && !isOwner && !hasSpecialAccess) {
        return res.status(403).json({
          message:
            "Você não tem permissão para adicionar observações a este lead",
        });
      }

      const now = new Date();

      // Atualizar o lead com a data do último contato
      await db
        .update(salesLeads)
        .set({
          ultimoContatoEm: now,
          ultimoTipoContato: tipoContato,
          updatedAt: now,
        })
        .where(eq(salesLeads.id, leadId));

      // Inserir a interação mantendo o marcador atual
      await db.insert(leadInteractions).values({
        leadId,
        userId,
        tipoContato,
        leadMarker: lead.leadMarker,
        observacao,
        contactId,
        margemValor: lead.currentMargin || "0",
        propostaValorEstimado: lead.currentProposal || "0",
      });

      return res.json({ message: "Observação adicionada com sucesso" });
    } catch (error) {
      console.error("Add interaction error:", error);
      return res.status(500).json({ message: "Erro ao adicionar observação" });
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

  // DELETE /api/crm/leads/:id - Excluir lead do pipeline
  app.delete("/api/crm/leads/:id", requireAuth, async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      if (isNaN(leadId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const currentUserId = req.user!.id;
      const userRole = req.user!.role;

      // Verificar se o lead existe
      const [lead] = await db
        .select()
        .from(salesLeads)
        .where(eq(salesLeads.id, leadId));

      if (!lead) {
        return res.status(404).json({ message: "Lead não encontrado" });
      }

      // Verificar permissões: master pode excluir qualquer lead, outros apenas seus próprios
      if (userRole !== "master") {
        const [assignment] = await db
          .select()
          .from(salesLeadAssignments)
          .where(
            and(
              eq(salesLeadAssignments.leadId, leadId),
              eq(salesLeadAssignments.userId, currentUserId),
            ),
          );

        if (!assignment) {
          return res
            .status(403)
            .json({ message: "Você não tem permissão para excluir este lead" });
        }
      }

      // Excluir em ordem: interações -> atribuições -> lead
      await db
        .delete(leadInteractions)
        .where(eq(leadInteractions.leadId, leadId));
      await db
        .delete(salesLeadAssignments)
        .where(eq(salesLeadAssignments.leadId, leadId));
      await db.delete(salesLeads).where(eq(salesLeads.id, leadId));

      return res.json({ success: true, message: "Lead excluído com sucesso" });
    } catch (error) {
      console.error("Delete lead error:", error);
      return res.status(500).json({ message: "Erro ao excluir lead" });
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
        teamUserIds = [currentUserId, ...teamMembers.map((m) => m.id)];
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
        ? await assignmentsQuery.where(
            inArray(salesLeadAssignments.userId, teamUserIds),
          )
        : await assignmentsQuery;

      const totals: Record<
        string,
        { count: number; somaMargens: number; somaPropostas: number }
      > = {};
      for (const marker of LEAD_MARKERS) {
        totals[marker] = { count: 0, somaMargens: 0, somaPropostas: 0 };
      }

      for (const a of allAssignments) {
        totals[a.leadMarker].count++;
        totals[a.leadMarker].somaMargens += parseFloat(a.currentMargin || "0");
        totals[a.leadMarker].somaPropostas += parseFloat(
          a.currentProposal || "0",
        );
      }

      const byUserMap: Record<
        number,
        {
          userId: number;
          userName: string;
          totals: Record<string, number>;
          totalLeads: number;
          somaMargens: number;
          somaPropostas: number;
        }
      > = {};

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
        byUserMap[assignment.userId].somaMargens += parseFloat(
          assignment.currentMargin || "0",
        );
        byUserMap[assignment.userId].somaPropostas += parseFloat(
          assignment.currentProposal || "0",
        );
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
        teamUserIds = [currentUserId, ...teamMembers.map((m) => m.id)];
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
        ? await leadsQuery.where(
            inArray(salesLeadAssignments.userId, teamUserIds),
          )
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
        const tenantId = req.tenantId!;
        const masterResult = await db.execute(sql`
          SELECT u.id, u.name
          FROM users u
          JOIN user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = ${tenantId}
          WHERE u.is_active = true
          ORDER BY u.name
        `);
        return res.json(masterResult.rows);
      } else {
        membersQuery = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(
            and(
              eq(users.isActive, true),
              or(
                eq(users.id, currentUserId),
                eq(users.managerId, currentUserId),
              ),
            ),
          );
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

      await db
        .update(salesLeadAssignments)
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

      await db
        .delete(salesLeadAssignments)
        .where(inArray(salesLeadAssignments.leadId, leadIds));

      await db
        .update(salesLeads)
        .set({ leadMarker: "NOVO", updatedAt: new Date() })
        .where(inArray(salesLeads.id, leadIds));

      return res.json({
        message: "Leads devolvidos ao pool",
        count: leadIds.length,
      });
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
      const teamsWithMembers = await Promise.all(
        teams.map(async (team) => {
          const members = await storage.getTeamMembersByTeam(team.id);
          const manager = await storage.getUser(team.managerUserId);
          return {
            ...team,
            managerName: manager?.name || "N/A",
            memberCount: members.length,
          };
        }),
      );
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
        return res
          .status(400)
          .json({ message: "Nome e coordenador são obrigatórios" });
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
      const membersWithUsers = await Promise.all(
        members.map(async (member) => {
          const user = await storage.getUser(member.userId);
          return {
            ...member,
            userName: user?.name || "N/A",
            userEmail: user?.email || "N/A",
            userRole: user?.role || "N/A",
          };
        }),
      );
      return res.json(membersWithUsers);
    } catch (error) {
      console.error("Get team members error:", error);
      return res.status(500).json({ message: "Erro ao buscar membros" });
    }
  });

  // POST /api/teams/:id/members - Adicionar membro à equipe
  app.post(
    "/api/teams/:id/members",
    requireAuth,
    requireMaster,
    async (req, res) => {
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
    },
  );

  // DELETE /api/teams/members/:userId - Remover membro da equipe
  app.delete(
    "/api/teams/members/:userId",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.userId);
        await storage.deleteTeamMemberByUser(userId);
        return res.json({ message: "Membro removido da equipe" });
      } catch (error) {
        console.error("Remove team member error:", error);
        return res.status(500).json({ message: "Erro ao remover membro" });
      }
    },
  );

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
  app.get(
    "/api/ai-prompts/roleplay/global",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const prompts = await storage.getGlobalRoleplayPrompts();
        return res.json(prompts);
      } catch (error) {
        console.error("Get global prompts error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar prompts globais" });
      }
    },
  );

  // POST /api/ai-prompts/roleplay/global - Salvar novo prompt global (Master)
  app.post(
    "/api/ai-prompts/roleplay/global",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const { promptText } = req.body;
        if (!promptText || promptText.trim().length < 10) {
          return res
            .status(400)
            .json({ message: "Prompt muito curto (mínimo 10 caracteres)" });
        }
        const prompt = await storage.saveRoleplayPrompt(
          "roleplay",
          "global",
          null,
          promptText,
          req.user!.id,
        );
        return res.status(201).json(prompt);
      } catch (error) {
        console.error("Save global prompt error:", error);
        return res.status(500).json({ message: "Erro ao salvar prompt" });
      }
    },
  );

  // PUT /api/ai-prompts/:id - Atualizar prompt/variante específico (Master)
  app.put(
    "/api/ai-prompts/:id",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const promptId = parseInt(req.params.id);
        const { promptText, isActive } = req.body;

        // Buscar prompt existente
        const [existingPrompt] = await db
          .select()
          .from(aiPrompts)
          .where(eq(aiPrompts.id, promptId))
          .limit(1);
        if (!existingPrompt) {
          return res.status(404).json({ message: "Prompt não encontrado" });
        }

        // VALIDATION: If trying to deactivate a persona variant, ensure at least one will remain active
        if (
          isActive === false &&
          existingPrompt.variante &&
          existingPrompt.type === "roleplay" &&
          existingPrompt.scope === "global"
        ) {
          // Count how many active variants exist (excluding this one)
          const activeVariants = await db
            .select()
            .from(aiPrompts)
            .where(
              and(
                eq(aiPrompts.type, "roleplay"),
                eq(aiPrompts.scope, "global"),
                eq(aiPrompts.isActive, true),
                not(eq(aiPrompts.id, promptId)),
              ),
            );

          // Filter to only variants (those with variante field set)
          const otherActiveVariants = activeVariants.filter((p) => p.variante);

          if (otherActiveVariants.length === 0) {
            return res.status(400).json({
              message:
                "Não é possível desativar esta persona. Pelo menos uma persona deve permanecer ativa para o Modo Livre funcionar.",
            });
          }
        }

        // Construir objeto de atualização
        const updateData: Partial<{
          promptText: string;
          isActive: boolean;
          version: number;
          updatedAt: Date;
          updatedByUserId: number;
        }> = {
          updatedAt: new Date(),
          updatedByUserId: req.user!.id,
        };

        if (promptText !== undefined && promptText.trim().length >= 10) {
          updateData.promptText = promptText.trim();
          updateData.version = existingPrompt.version + 1;
        }

        if (isActive !== undefined) {
          updateData.isActive = isActive;
        }

        await db
          .update(aiPrompts)
          .set(updateData)
          .where(eq(aiPrompts.id, promptId));

        const [updatedPrompt] = await db
          .select()
          .from(aiPrompts)
          .where(eq(aiPrompts.id, promptId))
          .limit(1);
        return res.json(updatedPrompt);
      } catch (error) {
        console.error("Update prompt error:", error);
        return res.status(500).json({ message: "Erro ao atualizar prompt" });
      }
    },
  );

  // GET /api/ai-prompts/roleplay/team/:teamId - Histórico de prompts da equipe
  // REFACTORED: Uses isMaster flag + team manager check instead of role
  app.get(
    "/api/ai-prompts/roleplay/team/:teamId",
    requireAuth,
    async (req, res) => {
      try {
        const teamId = parseInt(req.params.teamId);
        const userId = req.user!.id;

        // isMaster has full access
        if (!req.user!.isMaster) {
          // Check if user manages this team
          const team = await storage.getTeam(teamId);
          if (!team || team.managerUserId !== userId) {
            logPermissionCheck(
              userId,
              req.user!.name,
              "modulo_prompts",
              "view",
              false,
              "Not team manager",
            );
            return res
              .status(403)
              .json({ message: "Você não gerencia esta equipe" });
          }
        }

        const prompts = await storage.getTeamRoleplayPrompts(teamId);
        return res.json(prompts);
      } catch (error) {
        console.error("Get team prompts error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar prompts da equipe" });
      }
    },
  );

  // POST /api/ai-prompts/roleplay/team/:teamId - Salvar prompt de equipe (Coordenador ou Master)
  // REFACTORED: Uses isMaster flag + team manager check instead of role
  app.post(
    "/api/ai-prompts/roleplay/team/:teamId",
    requireAuth,
    async (req, res) => {
      try {
        const teamId = parseInt(req.params.teamId);
        const userId = req.user!.id;

        // isMaster has full access
        if (!req.user!.isMaster) {
          // Check if user manages this team
          const team = await storage.getTeam(teamId);
          if (!team || team.managerUserId !== userId) {
            logPermissionCheck(
              userId,
              req.user!.name,
              "modulo_prompts",
              "edit",
              false,
              "Not team manager",
            );
            return res
              .status(403)
              .json({ message: "Você não gerencia esta equipe" });
          }
        }

        const { promptText } = req.body;
        if (!promptText || promptText.trim().length < 10) {
          return res
            .status(400)
            .json({ message: "Prompt muito curto (mínimo 10 caracteres)" });
        }
        const prompt = await storage.saveRoleplayPrompt(
          "roleplay",
          "team",
          teamId,
          promptText,
          req.user!.id,
        );
        return res.status(201).json(prompt);
      } catch (error) {
        console.error("Save team prompt error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao salvar prompt da equipe" });
      }
    },
  );

  // DELETE /api/ai-prompts/roleplay/team/:teamId - Resetar prompt da equipe (volta para global)
  // REFACTORED: Uses isMaster flag + team manager check instead of role
  app.delete(
    "/api/ai-prompts/roleplay/team/:teamId",
    requireAuth,
    async (req, res) => {
      try {
        const teamId = parseInt(req.params.teamId);
        const userId = req.user!.id;

        // isMaster has full access
        if (!req.user!.isMaster) {
          // Check if user manages this team
          const team = await storage.getTeam(teamId);
          if (!team || team.managerUserId !== userId) {
            logPermissionCheck(
              userId,
              req.user!.name,
              "modulo_prompts",
              "edit",
              false,
              "Not team manager",
            );
            return res
              .status(403)
              .json({ message: "Você não gerencia esta equipe" });
          }
        }

        await storage.resetTeamRoleplayPrompt(teamId);
        return res.json({
          message: "Prompt da equipe resetado. Agora usa o prompt global.",
        });
      } catch (error) {
        console.error("Reset team prompt error:", error);
        return res.status(500).json({ message: "Erro ao resetar prompt" });
      }
    },
  );

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

  // ===== ROLEPLAY NIVEL PROMPTS (Modo Níveis) =====

  // GET /api/roleplay-niveis/prompts - Listar prompts de todos os níveis
  app.get("/api/roleplay-niveis/prompts", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId || 1;

      // Seed prompts if not exists for this tenant
      await storage.seedRoleplayNivelPrompts(tenantId);

      const prompts = await storage.getRoleplayNivelPrompts(tenantId);
      return res.json(prompts);
    } catch (error) {
      console.error("Get nivel prompts error:", error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar prompts de níveis" });
    }
  });

  // GET /api/roleplay-niveis/prompts/:nivel - Obter prompt de um nível específico
  app.get(
    "/api/roleplay-niveis/prompts/:nivel",
    requireAuth,
    async (req, res) => {
      try {
        const nivel = parseInt(req.params.nivel);
        const tenantId = req.user!.tenantId || 1;

        if (nivel < 1 || nivel > 5) {
          return res
            .status(400)
            .json({ message: "Nível deve ser entre 1 e 5" });
        }

        const prompt = await storage.getRoleplayNivelPrompt(nivel, tenantId);
        if (!prompt) {
          return res
            .status(404)
            .json({ message: "Prompt não encontrado para este nível" });
        }

        return res.json(prompt);
      } catch (error) {
        console.error("Get nivel prompt error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar prompt do nível" });
      }
    },
  );

  // PUT /api/roleplay-niveis/prompts/:nivel - Atualizar prompt de um nível (Master only, se podeCustomizar=true)
  app.put(
    "/api/roleplay-niveis/prompts/:nivel",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const nivel = parseInt(req.params.nivel);
        const tenantId = req.user!.tenantId || 1;
        const {
          promptCompleto,
          criteriosAprovacao,
          notaMinima,
          tempoLimiteMinutos,
        } = req.body;

        if (nivel < 1 || nivel > 5) {
          return res
            .status(400)
            .json({ message: "Nível deve ser entre 1 e 5" });
        }

        const existing = await storage.getRoleplayNivelPrompt(nivel, tenantId);
        if (!existing) {
          return res
            .status(404)
            .json({ message: "Prompt não encontrado para este nível" });
        }

        if (!existing.podeCustomizar) {
          return res
            .status(403)
            .json({ message: "Este prompt não pode ser customizado ainda" });
        }

        const updated = await storage.upsertRoleplayNivelPrompt({
          ...existing,
          promptCompleto: promptCompleto || existing.promptCompleto,
          criteriosAprovacao: criteriosAprovacao || existing.criteriosAprovacao,
          notaMinima: notaMinima || existing.notaMinima,
          tempoLimiteMinutos:
            tempoLimiteMinutos !== undefined
              ? tempoLimiteMinutos
              : existing.tempoLimiteMinutos,
        });

        return res.json(updated);
      } catch (error) {
        console.error("Update nivel prompt error:", error);
        return res
          .status(500)
          .json({ message: "Erro ao atualizar prompt do nível" });
      }
    },
  );

  // ===== TENANT MANAGEMENT ROUTES (Master Only) =====

  // GET /api/admin/tenants - List all tenants
  app.get(
    "/api/admin/tenants",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const result = await db.select().from(tenants);
        res.json(result);
      } catch (error) {
        console.error("Get tenants error:", error);
        res.status(500).json({ message: "Erro ao buscar tenants" });
      }
    },
  );

  // POST /api/admin/tenants - Create tenant
  app.post(
    "/api/admin/tenants",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const { key, name, logoUrl, faviconUrl, themeJson } = req.body;

        if (!key || !name) {
          return res
            .status(400)
            .json({ message: "key e name são obrigatórios" });
        }

        const existing = await db
          .select()
          .from(tenants)
          .where(eq(tenants.key, key))
          .limit(1);
        if (existing.length > 0) {
          return res
            .status(400)
            .json({ message: "Tenant com esta key já existe" });
        }

        const result = await db
          .insert(tenants)
          .values({
            key,
            name,
            logoUrl,
            faviconUrl,
            themeJson,
            isActive: true,
          })
          .returning();

        res.status(201).json(result[0]);
      } catch (error) {
        console.error("Create tenant error:", error);
        res.status(500).json({ message: "Erro ao criar tenant" });
      }
    },
  );

  // PUT /api/admin/tenants/:id - Update tenant
  app.put(
    "/api/admin/tenants/:id",
    requireAuth,
    requireMaster,
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user?.id;
        const ipAddress = req.ip || req.connection?.remoteAddress;
        const { name, logoUrl, faviconUrl, themeJson, isActive } = req.body;

        // Fetch current tenant for audit
        const [currentTenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, id))
          .limit(1);
        if (!currentTenant) {
          return res.status(404).json({ message: "Tenant não encontrado" });
        }

        // Log detalhado para auditoria
        console.log(
          `[TENANT-ADMIN-UPDATE] userId=${userId} tenantId=${id} timestamp=${new Date().toISOString()}`,
        );
        console.log(
          `[TENANT-ADMIN-UPDATE] Data: name="${name}" logoUrl="${logoUrl}" faviconUrl="${faviconUrl}" isActive=${isActive}`,
        );

        const existingAdminTheme =
          (currentTenant.themeJson as Record<string, any>) || {};
        const incomingAdminTheme = (themeJson as Record<string, any>) || {};
        const mergedAdminThemeJson = {
          ...existingAdminTheme,
          ...incomingAdminTheme,
        };

        const result = await db
          .update(tenants)
          .set({
            name,
            logoUrl,
            faviconUrl,
            themeJson: mergedAdminThemeJson,
            isActive,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, id))
          .returning();

        if (result.length === 0) {
          console.log(`[TENANT-ADMIN-UPDATE] FAILED - Tenant ${id} not found`);
          return res.status(404).json({ message: "Tenant não encontrado" });
        }

        // Record audit with before/after values
        const changedFields: Record<string, { before: any; after: any }> = {};
        if (currentTenant.name !== name)
          changedFields.name = { before: currentTenant.name, after: name };
        if (currentTenant.logoUrl !== logoUrl)
          changedFields.logoUrl = {
            before: currentTenant.logoUrl,
            after: logoUrl,
          };
        if (currentTenant.faviconUrl !== faviconUrl)
          changedFields.faviconUrl = {
            before: currentTenant.faviconUrl,
            after: faviconUrl,
          };
        if (
          JSON.stringify(currentTenant.themeJson) !==
          JSON.stringify(mergedAdminThemeJson)
        )
          changedFields.themeJson = {
            before: currentTenant.themeJson,
            after: mergedAdminThemeJson,
          };
        if (currentTenant.isActive !== isActive)
          changedFields.isActive = {
            before: currentTenant.isActive,
            after: isActive,
          };

        if (Object.keys(changedFields).length > 0) {
          await logTenantAudit(
            id,
            userId,
            "ADMIN_UPDATE",
            changedFields,
            ipAddress,
          );
        }

        console.log(
          `[TENANT-ADMIN-UPDATE] SUCCESS - Tenant ${id} updated. New updatedAt: ${result[0].updatedAt}`,
        );
        res.json(result[0]);
      } catch (error) {
        console.error("[TENANT-ADMIN-UPDATE] ERROR:", error);
        res.status(500).json({ message: "Erro ao atualizar tenant" });
      }
    },
  );

  // GET /api/admin/tenants/:id/audit - Get tenant audit log
  app.get(
    "/api/admin/tenants/:id/audit",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

        const result = await db
          .select({
            id: tenantAuditLog.id,
            tenantId: tenantAuditLog.tenantId,
            userId: tenantAuditLog.userId,
            userName: users.name,
            userEmail: users.email,
            action: tenantAuditLog.action,
            changedFields: tenantAuditLog.changedFields,
            ipAddress: tenantAuditLog.ipAddress,
            createdAt: tenantAuditLog.createdAt,
          })
          .from(tenantAuditLog)
          .leftJoin(users, eq(tenantAuditLog.userId, users.id))
          .where(eq(tenantAuditLog.tenantId, id))
          .orderBy(desc(tenantAuditLog.createdAt))
          .limit(limit);

        res.json(result);
      } catch (error) {
        console.error("Get tenant audit log error:", error);
        res
          .status(500)
          .json({ message: "Erro ao buscar histórico de auditoria" });
      }
    },
  );

  // GET /api/admin/tenants/:id/domains - Get tenant domains
  app.get(
    "/api/admin/tenants/:id/domains",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const result = await db
          .select()
          .from(tenantDomains)
          .where(eq(tenantDomains.tenantId, id));
        res.json(result);
      } catch (error) {
        console.error("Get tenant domains error:", error);
        res.status(500).json({ message: "Erro ao buscar domínios" });
      }
    },
  );

  // POST /api/admin/tenants/:id/domains - Add domain to tenant
  app.post(
    "/api/admin/tenants/:id/domains",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const tenantId = parseInt(req.params.id);
        const { domain, isPrimary } = req.body;

        if (!domain) {
          return res.status(400).json({ message: "domain é obrigatório" });
        }

        // Normalize domain: remove protocol, www, port, path
        let cleanDomain = domain.trim().toLowerCase();
        cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
        cleanDomain = cleanDomain.replace(/^www\./, "");
        cleanDomain = cleanDomain.split(":")[0];
        cleanDomain = cleanDomain.split("/")[0];
        cleanDomain = cleanDomain.split("?")[0];

        if (!cleanDomain || cleanDomain.length < 3) {
          return res.status(400).json({ message: "Domínio inválido" });
        }

        const existing = await db
          .select()
          .from(tenantDomains)
          .where(eq(tenantDomains.domain, cleanDomain))
          .limit(1);
        if (existing.length > 0) {
          return res.status(400).json({ message: "Domínio já está em uso" });
        }

        const result = await db
          .insert(tenantDomains)
          .values({
            tenantId,
            domain: cleanDomain,
            isPrimary: isPrimary || false,
          })
          .returning();

        res.status(201).json(result[0]);
      } catch (error) {
        console.error("Add domain error:", error);
        res.status(500).json({ message: "Erro ao adicionar domínio" });
      }
    },
  );

  // DELETE /api/admin/tenants/domains/:domainId - Remove domain
  app.delete(
    "/api/admin/tenants/domains/:domainId",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const domainId = parseInt(req.params.domainId);
        await db.delete(tenantDomains).where(eq(tenantDomains.id, domainId));
        res.json({ message: "Domínio removido" });
      } catch (error) {
        console.error("Delete domain error:", error);
        res.status(500).json({ message: "Erro ao remover domínio" });
      }
    },
  );

  // GET /api/admin/tenants/:id/users - Get users with access to tenant
  app.get(
    "/api/admin/tenants/:id/users",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const tenantId = parseInt(req.params.id);
        const result = await db
          .select({
            id: userTenants.id,
            userId: userTenants.userId,
            roleInTenant: userTenants.roleInTenant,
            userName: users.name,
            userEmail: users.email,
            userRole: users.role,
          })
          .from(userTenants)
          .innerJoin(users, eq(userTenants.userId, users.id))
          .where(eq(userTenants.tenantId, tenantId));
        res.json(result);
      } catch (error) {
        console.error("Get tenant users error:", error);
        res.status(500).json({ message: "Erro ao buscar usuários do tenant" });
      }
    },
  );

  // POST /api/admin/tenants/:id/users - Add user access to tenant
  app.post(
    "/api/admin/tenants/:id/users",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const tenantId = parseInt(req.params.id);
        const { userId, roleInTenant } = req.body;

        if (!userId) {
          return res.status(400).json({ message: "userId é obrigatório" });
        }

        const existing = await db
          .select()
          .from(userTenants)
          .where(
            and(
              eq(userTenants.userId, userId),
              eq(userTenants.tenantId, tenantId),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          return res
            .status(400)
            .json({ message: "Usuário já tem acesso a este tenant" });
        }

        const result = await db
          .insert(userTenants)
          .values({
            userId,
            tenantId,
            roleInTenant: roleInTenant || "vendedor",
          })
          .returning();

        res.status(201).json(result[0]);
      } catch (error) {
        console.error("Add user to tenant error:", error);
        res
          .status(500)
          .json({ message: "Erro ao adicionar usuário ao tenant" });
      }
    },
  );

  // DELETE /api/admin/tenants/users/:userTenantId - Remove user access from tenant
  app.delete(
    "/api/admin/tenants/users/:userTenantId",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const userTenantId = parseInt(req.params.userTenantId);
        await db.delete(userTenants).where(eq(userTenants.id, userTenantId));
        res.json({ message: "Acesso removido" });
      } catch (error) {
        console.error("Remove user from tenant error:", error);
        res.status(500).json({ message: "Erro ao remover acesso" });
      }
    },
  );

  // PUT /api/admin/users/:id/master - Toggle master status
  app.put(
    "/api/admin/users/:id/master",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const { isMaster } = req.body;

        const result = await db
          .update(users)
          .set({ isMaster: isMaster || false })
          .where(eq(users.id, userId))
          .returning();

        if (result.length === 0) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }

        res.json(result[0]);
      } catch (error) {
        console.error("Toggle master error:", error);
        res.status(500).json({ message: "Erro ao atualizar usuário" });
      }
    },
  );

  // ===== KANBAN PESSOAL =====

  // GET /api/kanban/tasks - Get all tasks for current user
  app.get("/api/kanban/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getPersonalTasksByUser(req.user!.id);
      return res.json(tasks);
    } catch (error) {
      console.error("Get kanban tasks error:", error);
      return res.status(500).json({ message: "Erro ao buscar tarefas" });
    }
  });

  // POST /api/kanban/tasks - Create a new task
  app.post("/api/kanban/tasks", requireAuth, async (req, res) => {
    try {
      const parsed = insertPersonalTaskSchema.safeParse({
        ...req.body,
        userId: req.user!.id,
      });

      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Dados inválidos", errors: parsed.error.errors });
      }

      // Check if moving to em_execucao - limit of 3 tasks
      if (parsed.data.column === "em_execucao") {
        const count = await storage.countTasksInColumn(
          req.user!.id,
          "em_execucao",
        );
        if (count >= 3) {
          return res.status(400).json({
            message:
              "Limite de 3 tarefas em execução atingido. Mova uma tarefa para outra coluna primeiro.",
          });
        }
      }

      const task = await storage.createPersonalTask(parsed.data);
      return res.status(201).json(task);
    } catch (error) {
      console.error("Create kanban task error:", error);
      return res.status(500).json({ message: "Erro ao criar tarefa" });
    }
  });

  // PATCH /api/kanban/tasks/:id - Update a task
  app.patch("/api/kanban/tasks/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;

      // Check if moving to em_execucao - limit of 3 tasks
      if (updateData.column === "em_execucao") {
        const existingTask = await storage.getPersonalTask(id, req.user!.id);
        if (existingTask && existingTask.column !== "em_execucao") {
          const count = await storage.countTasksInColumn(
            req.user!.id,
            "em_execucao",
          );
          if (count >= 3) {
            return res.status(400).json({
              message:
                "Limite de 3 tarefas em execução atingido. Mova uma tarefa para outra coluna primeiro.",
            });
          }
        }
      }

      const task = await storage.updatePersonalTask(
        id,
        req.user!.id,
        updateData,
      );
      if (!task) {
        return res.status(404).json({ message: "Tarefa não encontrada" });
      }
      return res.json(task);
    } catch (error) {
      console.error("Update kanban task error:", error);
      return res.status(500).json({ message: "Erro ao atualizar tarefa" });
    }
  });

  // DELETE /api/kanban/tasks/:id - Delete a task
  app.delete("/api/kanban/tasks/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePersonalTask(id, req.user!.id);
      return res.json({ message: "Tarefa excluída" });
    } catch (error) {
      console.error("Delete kanban task error:", error);
      return res.status(500).json({ message: "Erro ao excluir tarefa" });
    }
  });

  // POST /api/kanban/reorder - Reorder tasks within a column
  app.post("/api/kanban/reorder", requireAuth, async (req, res) => {
    try {
      const { column, taskIds } = req.body;

      if (!column || !Array.isArray(taskIds)) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      // Check if moving to em_execucao exceeds limit
      if (column === "em_execucao" && taskIds.length > 3) {
        return res.status(400).json({
          message: "Limite de 3 tarefas em execução atingido.",
        });
      }

      await storage.reorderPersonalTasks(req.user!.id, column, taskIds);
      return res.json({ message: "Tarefas reordenadas" });
    } catch (error) {
      console.error("Reorder kanban tasks error:", error);
      return res.status(500).json({ message: "Erro ao reordenar tarefas" });
    }
  });

  // GET /api/kanban/stats - Get task statistics
  app.get("/api/kanban/stats", requireAuth, async (req, res) => {
    try {
      const stats: Record<string, number> = {};
      for (const col of KANBAN_COLUMNS) {
        stats[col] = await storage.countTasksInColumn(req.user!.id, col);
      }
      return res.json(stats);
    } catch (error) {
      console.error("Get kanban stats error:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  // GET /api/admin/db-snapshot - Database diagnostic snapshot (MASTER ONLY)
  app.get(
    "/api/admin/db-snapshot",
    requireAuth,
    requireMaster,
    async (req, res) => {
      try {
        const countsByTenant = await db.execute(sql`
        WITH pessoa_counts AS (
          SELECT COALESCE(tenant_id, 0) as tid, COUNT(*) as cnt FROM clientes_pessoa GROUP BY tenant_id
        ),
        vinculo_counts AS (
          SELECT COALESCE(tenant_id, 0) as tid, COUNT(*) as cnt FROM clientes_vinculo GROUP BY tenant_id
        ),
        folha_counts AS (
          SELECT COALESCE(p.tenant_id, 0) as tid, COUNT(*) as cnt 
          FROM clientes_folha_mes f
          LEFT JOIN clientes_pessoa p ON f.pessoa_id = p.id
          GROUP BY p.tenant_id
        ),
        contrato_counts AS (
          SELECT COALESCE(p.tenant_id, 0) as tid, COUNT(*) as cnt 
          FROM clientes_contratos c
          LEFT JOIN clientes_pessoa p ON c.pessoa_id = p.id
          GROUP BY p.tenant_id
        ),
        contact_counts AS (
          SELECT COALESCE(p.tenant_id, 0) as tid, COUNT(*) as cnt 
          FROM client_contacts cc
          LEFT JOIN clientes_pessoa p ON cc.client_id = p.id
          GROUP BY p.tenant_id
        ),
        base_counts AS (
          SELECT COALESCE(tenant_id, 0) as tid, COUNT(*) as cnt FROM bases_importadas GROUP BY tenant_id
        ),
        run_counts AS (
          SELECT COALESCE(tenant_id, 0) as tid, COUNT(*) as cnt FROM import_runs GROUP BY tenant_id
        ),
        run_row_counts AS (
          SELECT COALESCE(ir.tenant_id, 0) as tid, COUNT(*) as cnt 
          FROM import_run_rows rr
          LEFT JOIN import_runs ir ON rr.import_run_id = ir.id
          GROUP BY ir.tenant_id
        ),
        error_counts AS (
          SELECT COALESCE(ir.tenant_id, 0) as tid, COUNT(*) as cnt 
          FROM import_errors ie
          LEFT JOIN import_runs ir ON ie.import_run_id = ir.id
          GROUP BY ir.tenant_id
        )
        SELECT 
          COALESCE(t.id, 0) as tenant_id,
          COALESCE(t.name, 'Sem Tenant') as tenant_name,
          COALESCE(pc.cnt, 0) as clientes_pessoa,
          COALESCE(vc.cnt, 0) as clientes_vinculo,
          COALESCE(fc.cnt, 0) as clientes_folha_mes,
          COALESCE(cc.cnt, 0) as clientes_contratos,
          COALESCE(ctc.cnt, 0) as client_contacts,
          COALESCE(bc.cnt, 0) as bases_importadas,
          COALESCE(rc.cnt, 0) as import_runs,
          COALESCE(rrc.cnt, 0) as import_run_rows,
          COALESCE(ec.cnt, 0) as import_errors
        FROM (
          SELECT DISTINCT tid FROM (
            SELECT tid FROM pessoa_counts UNION ALL
            SELECT tid FROM vinculo_counts UNION ALL
            SELECT tid FROM base_counts UNION ALL
            SELECT tid FROM run_counts UNION ALL
            SELECT tid FROM run_row_counts UNION ALL
            SELECT tid FROM error_counts
          ) all_tids
        ) tids
        LEFT JOIN tenants t ON t.id = tids.tid
        LEFT JOIN pessoa_counts pc ON pc.tid = tids.tid
        LEFT JOIN vinculo_counts vc ON vc.tid = tids.tid
        LEFT JOIN folha_counts fc ON fc.tid = tids.tid
        LEFT JOIN contrato_counts cc ON cc.tid = tids.tid
        LEFT JOIN contact_counts ctc ON ctc.tid = tids.tid
        LEFT JOIN base_counts bc ON bc.tid = tids.tid
        LEFT JOIN run_counts rc ON rc.tid = tids.tid
        LEFT JOIN run_row_counts rrc ON rrc.tid = tids.tid
        LEFT JOIN error_counts ec ON ec.tid = tids.tid
        ORDER BY tenant_id
      `);

        const globalCounts = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM clientes_pessoa) as total_clientes_pessoa,
          (SELECT COUNT(*) FROM clientes_vinculo) as total_clientes_vinculo,
          (SELECT COUNT(*) FROM clientes_folha_mes) as total_clientes_folha_mes,
          (SELECT COUNT(*) FROM clientes_contratos) as total_clientes_contratos,
          (SELECT COUNT(*) FROM client_contacts) as total_client_contacts,
          (SELECT COUNT(*) FROM bases_importadas) as total_bases_importadas,
          (SELECT COUNT(*) FROM import_runs) as total_import_runs,
          (SELECT COUNT(*) FROM import_run_rows) as total_import_run_rows,
          (SELECT COUNT(*) FROM import_errors) as total_import_errors
      `);

        const dbUrl = process.env.DATABASE_URL || "";
        let dbInfo = { host: "***", dbname: "***" };
        try {
          const match = dbUrl.match(/@([^:\/]+)(?::\d+)?\/([^?]+)/);
          if (match) {
            const host = match[1];
            const dbname = match[2];
            dbInfo = {
              host:
                host.length > 8
                  ? host.slice(0, 4) + "****" + host.slice(-4)
                  : "****",
              dbname:
                dbname.length > 6
                  ? dbname.slice(0, 3) + "***" + dbname.slice(-3)
                  : "***",
            };
          }
        } catch {}

        return res.json({
          timestamp: new Date().toISOString(),
          database: dbInfo,
          countsByTenant: countsByTenant.rows,
          globalCounts: globalCounts.rows[0] || {
            import_run_rows: 0,
            import_errors: 0,
          },
        });
      } catch (error: any) {
        console.error("DB snapshot error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao gerar snapshot" });
      }
    },
  );

  // GET /api/admin/tenant-counts - Get current tenant table counts (for sanity test)
  app.get(
    "/api/admin/tenant-counts",
    requireAuth,
    requireMaster,
    async (req, res) => {
      const tenantId = req.tenantId || 1;

      try {
        const counts = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM clientes_pessoa WHERE tenant_id = ${tenantId}) as clientes_pessoa,
          (SELECT COUNT(*) FROM clientes_vinculo WHERE tenant_id = ${tenantId}) as clientes_vinculo,
          (SELECT COUNT(*) FROM clientes_folha_mes fm 
           JOIN clientes_vinculo v ON fm.vinculo_id = v.id 
           WHERE v.tenant_id = ${tenantId}) as clientes_folha_mes,
          (SELECT COUNT(*) FROM clientes_contratos ct 
           JOIN clientes_vinculo v ON ct.vinculo_id = v.id 
           WHERE v.tenant_id = ${tenantId}) as clientes_contratos,
          (SELECT COUNT(*) FROM client_contacts cc 
           JOIN clientes_pessoa p ON cc.client_id = p.id 
           WHERE p.tenant_id = ${tenantId}) as client_contacts,
          (SELECT COUNT(*) FROM bases_importadas WHERE tenant_id = ${tenantId}) as bases_importadas,
          (SELECT COUNT(*) FROM import_runs WHERE tenant_id = ${tenantId}) as import_runs
      `);

        return res.json(
          counts.rows[0] || {
            clientes_pessoa: "0",
            clientes_vinculo: "0",
            clientes_folha_mes: "0",
            clientes_contratos: "0",
            client_contacts: "0",
            bases_importadas: "0",
            import_runs: "0",
          },
        );
      } catch (error: any) {
        console.error("Tenant counts error:", error);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao contar registros" });
      }
    },
  );

  // ============ ASYNC RESET TENANT ENDPOINTS ============

  // POST /api/admin/reset-tenant - Start async reset job (MASTER ONLY)
  app.post(
    "/api/admin/reset-tenant",
    requireAuth,
    requireMaster,
    async (req, res) => {
      const tenantId = req.tenantId || 1;
      const userId = req.user!.id;

      // Check if there's already a running job for this tenant
      for (const job of resetJobs.values()) {
        if (
          job.tenantId === tenantId &&
          (job.status === "pending" || job.status === "running")
        ) {
          return res.status(409).json({
            message: "Já existe um job de reset em execução para este tenant",
            jobId: job.id,
          });
        }
      }

      const jobId = generateJobId();
      const stepNames = [
        "clientes_contratos",
        "clientes_folha_mes",
        "client_contacts",
        "clientes_vinculo",
        "clientes_pessoa",
        "import_run_rows",
        "import_errors",
        "import_runs",
        "bases_importadas",
      ];

      const job: ResetJob = {
        id: jobId,
        tenantId,
        userId,
        status: "pending",
        currentStep: 0,
        totalSteps: stepNames.length,
        steps: stepNames.map((name) => ({ name, status: "pending" })),
        countsBefore: {},
        deleted: {},
        startedAt: new Date(),
      };

      resetJobs.set(jobId, job);

      console.log(`[RESET-JOB] Job ${jobId} criado para tenant ${tenantId}`);

      // Start the job in background (don't await)
      runResetJob(jobId, tenantId).catch((err) => {
        console.error(`[RESET-JOB] Erro fatal no job ${jobId}:`, err);
        const j = resetJobs.get(jobId);
        if (j) {
          j.status = "error";
          j.error = err.message;
          j.completedAt = new Date();
          j.elapsedMs = Date.now() - j.startedAt.getTime();
        }
      });

      return res.json({
        success: true,
        jobId,
        message: "Job de reset iniciado em background",
      });
    },
  );

  // GET /api/admin/reset-tenant/status/:jobId - Get job status
  app.get(
    "/api/admin/reset-tenant/status/:jobId",
    requireAuth,
    requireMaster,
    async (req, res) => {
      const { jobId } = req.params;
      const job = resetJobs.get(jobId);

      if (!job) {
        return res.status(404).json({ message: "Job não encontrado" });
      }

      // Security: only allow access to jobs from same tenant
      const tenantId = req.tenantId || 1;
      if (job.tenantId !== tenantId) {
        return res.status(403).json({ message: "Acesso negado a este job" });
      }

      return res.json({
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        totalSteps: job.totalSteps,
        steps: job.steps,
        countsBefore: job.countsBefore,
        deleted: job.deleted,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        elapsedMs: job.elapsedMs || Date.now() - job.startedAt.getTime(),
        error: job.error,
      });
    },
  );

  // Background job runner function
  async function runResetJob(jobId: string, tenantId: number) {
    const job = resetJobs.get(jobId);
    if (!job) return;

    job.status = "running";
    const startTime = Date.now();

    console.log(
      `[RESET-JOB] ========== INICIANDO JOB ${jobId} TENANT ${tenantId} ==========`,
    );

    try {
      // 1. Capturar contagens ANTES
      console.log(`[RESET-JOB] Capturando contagens iniciais...`);
      const beforeSnapshot = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM clientes_contratos WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})) as contratos,
          (SELECT COUNT(*) FROM clientes_folha_mes WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})) as folhas,
          (SELECT COUNT(*) FROM client_contacts WHERE client_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})) as contatos,
          (SELECT COUNT(*) FROM clientes_vinculo WHERE tenant_id = ${tenantId}) as vinculos,
          (SELECT COUNT(*) FROM clientes_pessoa WHERE tenant_id = ${tenantId}) as pessoas,
          (SELECT COUNT(*) FROM import_run_rows WHERE import_run_id IN (SELECT id FROM import_runs WHERE tenant_id = ${tenantId})) as run_rows,
          (SELECT COUNT(*) FROM import_errors WHERE import_run_id IN (SELECT id FROM import_runs WHERE tenant_id = ${tenantId})) as errors,
          (SELECT COUNT(*) FROM import_runs WHERE tenant_id = ${tenantId}) as runs,
          (SELECT COUNT(*) FROM bases_importadas WHERE tenant_id = ${tenantId}) as bases
      `);
      const before = beforeSnapshot.rows[0] as any;
      job.countsBefore = {
        contratos: parseInt(before.contratos || "0"),
        folhas: parseInt(before.folhas || "0"),
        contatos: parseInt(before.contatos || "0"),
        vinculos: parseInt(before.vinculos || "0"),
        pessoas: parseInt(before.pessoas || "0"),
        run_rows: parseInt(before.run_rows || "0"),
        errors: parseInt(before.errors || "0"),
        runs: parseInt(before.runs || "0"),
        bases: parseInt(before.bases || "0"),
      };

      // Update step counts
      job.steps[0].countBefore = job.countsBefore.contratos;
      job.steps[1].countBefore = job.countsBefore.folhas;
      job.steps[2].countBefore = job.countsBefore.contatos;
      job.steps[3].countBefore = job.countsBefore.vinculos;
      job.steps[4].countBefore = job.countsBefore.pessoas;
      job.steps[5].countBefore = job.countsBefore.run_rows;
      job.steps[6].countBefore = job.countsBefore.errors;
      job.steps[7].countBefore = job.countsBefore.runs;
      job.steps[8].countBefore = job.countsBefore.bases;

      console.log(
        `[RESET-JOB] Contagens iniciais: pessoas=${job.countsBefore.pessoas}, vinculos=${job.countsBefore.vinculos}, folhas=${job.countsBefore.folhas}`,
      );

      // 2. Executar DELETEs em ordem correta (filhos antes de pais) dentro de transação
      // Ordem: contratos → folhas → contatos → vínculos → pessoas → run_rows → errors → runs → bases
      console.log(`[RESET-JOB] Iniciando transação de deleção...`);

      const deleteQueries = [
        sql`DELETE FROM clientes_contratos WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})`,
        sql`DELETE FROM clientes_folha_mes WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})`,
        sql`DELETE FROM client_contacts WHERE client_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})`,
        sql`DELETE FROM clientes_vinculo WHERE tenant_id = ${tenantId}`,
        sql`DELETE FROM clientes_pessoa WHERE tenant_id = ${tenantId}`,
        sql`DELETE FROM import_run_rows WHERE import_run_id IN (SELECT id FROM import_runs WHERE tenant_id = ${tenantId})`,
        sql`DELETE FROM import_errors WHERE import_run_id IN (SELECT id FROM import_runs WHERE tenant_id = ${tenantId})`,
        sql`DELETE FROM import_runs WHERE tenant_id = ${tenantId}`,
        sql`DELETE FROM bases_importadas WHERE tenant_id = ${tenantId}`,
      ];

      // BEGIN transaction
      await db.execute(sql`BEGIN`);

      try {
        for (let i = 0; i < deleteQueries.length; i++) {
          const step = job.steps[i];
          step.status = "running";
          job.currentStep = i + 1;

          const stepStart = Date.now();
          console.log(`[RESET-JOB] Step ${i + 1} START: ${step.name}`);

          const result = await db.execute(deleteQueries[i]);
          step.deleted = result.rowCount || 0;
          step.status = "completed";
          step.elapsedMs = Date.now() - stepStart;
          job.deleted[step.name] = step.deleted;

          console.log(
            `[RESET-JOB] Step ${i + 1} DONE: ${step.name} - deletados: ${step.deleted}, tempo: ${step.elapsedMs}ms`,
          );
        }

        // COMMIT transaction
        await db.execute(sql`COMMIT`);
        console.log(`[RESET-JOB] Transação commitada com sucesso`);
      } catch (txError: any) {
        // ROLLBACK on any error
        console.error(
          `[RESET-JOB] Erro durante deleção, fazendo ROLLBACK: ${txError.message}`,
        );
        await db.execute(sql`ROLLBACK`);

        // Mark failed step
        const currentStepIndex = job.currentStep - 1;
        if (job.steps[currentStepIndex]) {
          job.steps[currentStepIndex].status = "error";
          job.steps[currentStepIndex].error = txError.message;
        }

        throw txError;
      }

      job.status = "completed";
      job.completedAt = new Date();
      job.elapsedMs = Date.now() - startTime;

      console.log(
        `[RESET-JOB] ========== JOB ${jobId} CONCLUÍDO EM ${job.elapsedMs}ms ==========`,
      );
    } catch (error: any) {
      job.status = "error";
      job.error = error.message;
      job.completedAt = new Date();
      job.elapsedMs = Date.now() - startTime;

      console.error(`[RESET-JOB] ERRO no job ${jobId}: ${error.message}`);
    }
  }

  // DELETE /api/admin/reset-tenant-data - Hard delete all client data for current tenant (MASTER ONLY)
  // Executa DELETEs em ordem correta respeitando foreign keys
  // DEPRECATED: Use POST /api/admin/reset-tenant for async version
  app.delete(
    "/api/admin/reset-tenant-data",
    requireAuth,
    requireMaster,
    async (req, res) => {
      const tenantId = req.tenantId || 1;
      const startTime = Date.now();
      const stepTimes: Record<string, number> = {};
      const deleted: Record<string, number> = {};
      const countsBefore: Record<string, number> = {};

      console.log(
        `[RESET-TENANT] ========== INICIANDO LIMPEZA RÁPIDA TENANT ${tenantId} ==========`,
      );

      try {
        // 1. Capturar contagens ANTES (para relatório)
        console.log(`[RESET-TENANT] Capturando contagens iniciais...`);
        const beforeSnapshot = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM clientes_contratos WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})) as contratos,
          (SELECT COUNT(*) FROM clientes_folha_mes WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})) as folhas,
          (SELECT COUNT(*) FROM client_contacts WHERE client_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})) as contatos,
          (SELECT COUNT(*) FROM clientes_vinculo WHERE tenant_id = ${tenantId}) as vinculos,
          (SELECT COUNT(*) FROM clientes_pessoa WHERE tenant_id = ${tenantId}) as pessoas,
          (SELECT COUNT(*) FROM import_run_rows WHERE import_run_id IN (SELECT id FROM import_runs WHERE tenant_id = ${tenantId})) as run_rows,
          (SELECT COUNT(*) FROM import_errors WHERE import_run_id IN (SELECT id FROM import_runs WHERE tenant_id = ${tenantId})) as errors,
          (SELECT COUNT(*) FROM import_runs WHERE tenant_id = ${tenantId}) as runs,
          (SELECT COUNT(*) FROM bases_importadas WHERE tenant_id = ${tenantId}) as bases
      `);
        const before = beforeSnapshot.rows[0] as any;
        countsBefore["contratos"] = parseInt(before.contratos || "0");
        countsBefore["folhas"] = parseInt(before.folhas || "0");
        countsBefore["contatos"] = parseInt(before.contatos || "0");
        countsBefore["vinculos"] = parseInt(before.vinculos || "0");
        countsBefore["pessoas"] = parseInt(before.pessoas || "0");
        countsBefore["run_rows"] = parseInt(before.run_rows || "0");
        countsBefore["errors"] = parseInt(before.errors || "0");
        countsBefore["runs"] = parseInt(before.runs || "0");
        countsBefore["bases"] = parseInt(before.bases || "0");

        console.log(
          `[RESET-TENANT] Contagens iniciais: pessoas=${countsBefore.pessoas}, vinculos=${countsBefore.vinculos}, folhas=${countsBefore.folhas}`,
        );

        // 2. Executar DELETEs em ordem correta (filhos antes de pais) dentro de transação
        // Ordem: contratos → folhas → contatos → vínculos → pessoas → run_rows → errors → runs → bases
        console.log(`[RESET-TENANT] Iniciando transação de deleção...`);

        const fastDelete = async (
          stepNum: number,
          tableName: string,
          deleteQuery: any,
        ) => {
          const stepStart = Date.now();
          console.log(`[RESET-TENANT] Step ${stepNum} START: ${tableName}`);

          const result = await db.execute(deleteQuery);
          const count = result.rowCount || 0;

          const stepElapsed = Date.now() - stepStart;
          stepTimes[tableName] = stepElapsed;
          deleted[tableName] = count;

          console.log(
            `[RESET-TENANT] Step ${stepNum} DONE: ${tableName} - deletados: ${count}, tempo: ${stepElapsed}ms`,
          );
          return count;
        };

        // BEGIN transaction
        await db.execute(sql`BEGIN`);

        try {
          await fastDelete(
            1,
            "clientes_contratos",
            sql`DELETE FROM clientes_contratos WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})`,
          );

          await fastDelete(
            2,
            "clientes_folha_mes",
            sql`DELETE FROM clientes_folha_mes WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})`,
          );

          await fastDelete(
            3,
            "client_contacts",
            sql`DELETE FROM client_contacts WHERE client_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})`,
          );

          await fastDelete(
            4,
            "clientes_vinculo",
            sql`DELETE FROM clientes_vinculo WHERE tenant_id = ${tenantId}`,
          );

          await fastDelete(
            5,
            "clientes_pessoa",
            sql`DELETE FROM clientes_pessoa WHERE tenant_id = ${tenantId}`,
          );

          await fastDelete(
            6,
            "import_run_rows",
            sql`DELETE FROM import_run_rows WHERE import_run_id IN (SELECT id FROM import_runs WHERE tenant_id = ${tenantId})`,
          );

          await fastDelete(
            7,
            "import_errors",
            sql`DELETE FROM import_errors WHERE import_run_id IN (SELECT id FROM import_runs WHERE tenant_id = ${tenantId})`,
          );

          await fastDelete(
            8,
            "import_runs",
            sql`DELETE FROM import_runs WHERE tenant_id = ${tenantId}`,
          );

          await fastDelete(
            9,
            "bases_importadas",
            sql`DELETE FROM bases_importadas WHERE tenant_id = ${tenantId}`,
          );

          // COMMIT transaction
          await db.execute(sql`COMMIT`);
          console.log(`[RESET-TENANT] Transação commitada com sucesso`);
        } catch (txError: any) {
          // ROLLBACK on any error
          console.error(
            `[RESET-TENANT] Erro durante deleção, fazendo ROLLBACK: ${txError.message}`,
          );
          await db.execute(sql`ROLLBACK`);
          throw txError;
        }

        const elapsedMs = Date.now() - startTime;

        // 3. Capturar contagens DEPOIS
        const afterSnapshot = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM clientes_pessoa WHERE tenant_id = ${tenantId}) as clientes_pessoa,
          (SELECT COUNT(*) FROM clientes_vinculo WHERE tenant_id = ${tenantId}) as clientes_vinculo,
          (SELECT COUNT(*) FROM clientes_folha_mes WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})) as clientes_folha_mes,
          (SELECT COUNT(*) FROM clientes_contratos WHERE pessoa_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})) as clientes_contratos,
          (SELECT COUNT(*) FROM client_contacts WHERE client_id IN (SELECT id FROM clientes_pessoa WHERE tenant_id = ${tenantId})) as client_contacts,
          (SELECT COUNT(*) FROM bases_importadas WHERE tenant_id = ${tenantId}) as bases_importadas,
          (SELECT COUNT(*) FROM import_runs WHERE tenant_id = ${tenantId}) as import_runs
      `);

        console.log(`[RESET-TENANT] ========== RESUMO ==========`);
        console.log(
          `[RESET-TENANT] Contratos: ${countsBefore.contratos} → ${deleted["clientes_contratos"] || 0} deletados`,
        );
        console.log(
          `[RESET-TENANT] Folhas: ${countsBefore.folhas} → ${deleted["clientes_folha_mes"] || 0} deletados`,
        );
        console.log(
          `[RESET-TENANT] Contatos: ${countsBefore.contatos} → ${deleted["client_contacts"] || 0} deletados`,
        );
        console.log(
          `[RESET-TENANT] Vínculos: ${countsBefore.vinculos} → ${deleted["clientes_vinculo"] || 0} deletados`,
        );
        console.log(
          `[RESET-TENANT] Pessoas: ${countsBefore.pessoas} → ${deleted["clientes_pessoa"] || 0} deletados`,
        );
        console.log(
          `[RESET-TENANT] Run rows: ${countsBefore.run_rows} → ${deleted["import_run_rows"] || 0} deletados`,
        );
        console.log(
          `[RESET-TENANT] Errors: ${countsBefore.errors} → ${deleted["import_errors"] || 0} deletados`,
        );
        console.log(
          `[RESET-TENANT] Import runs: ${countsBefore.runs} → ${deleted["import_runs"] || 0} deletados`,
        );
        console.log(
          `[RESET-TENANT] Bases: ${countsBefore.bases} → ${deleted["bases_importadas"] || 0} deletados`,
        );
        console.log(
          `[RESET-TENANT] ========== LIMPEZA CONCLUÍDA EM ${elapsedMs}ms ==========`,
        );

        return res.json({
          success: true,
          tenantId,
          countsBefore,
          deleted: {
            contratos: deleted["clientes_contratos"] || 0,
            folhas: deleted["clientes_folha_mes"] || 0,
            contatos: deleted["client_contacts"] || 0,
            vinculos: deleted["clientes_vinculo"] || 0,
            pessoas: deleted["clientes_pessoa"] || 0,
            run_rows: deleted["import_run_rows"] || 0,
            errors: deleted["import_errors"] || 0,
            import_runs: deleted["import_runs"] || 0,
            bases_importadas: deleted["bases_importadas"] || 0,
          },
          stepTimes,
          remainingCounts: afterSnapshot.rows[0],
          elapsedMs,
        });
      } catch (error: any) {
        console.error(`[RESET-TENANT] ERRO: ${error.message}`);
        return res
          .status(500)
          .json({ message: error.message || "Erro ao limpar dados do tenant" });
      }
    },
  );

  // ===== EMPLOYEES (FUNCIONÁRIOS) API =====

  // GET /api/employees - List all employees for tenant
  app.get(
    "/api/employees",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios"),
    async (req, res) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }
        const {
          departamento,
          status,
          tipoContrato,
          search,
          page = "1",
          limit = "50",
        } = req.query;

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;
        const offset = (pageNum - 1) * limitNum;

        let conditions = [sql`tenant_id = ${tenantId}`];

        if (departamento && departamento !== "todos") {
          conditions.push(sql`departamento = ${departamento}`);
        }
        if (status && status !== "todos") {
          conditions.push(sql`status = ${status}`);
        }
        if (tipoContrato && tipoContrato !== "todos") {
          conditions.push(sql`tipo_contrato = ${tipoContrato}`);
        }
        if (search) {
          const searchTerm = `%${(search as string).toLowerCase()}%`;
          conditions.push(
            sql`(LOWER(nome_completo) LIKE ${searchTerm} OR cpf LIKE ${searchTerm})`,
          );
        }

        const whereClause = sql.join(conditions, sql` AND `);

        const [countResult, employeesResult] = await Promise.all([
          db.execute(
            sql`SELECT COUNT(*) as total FROM employees WHERE ${whereClause}`,
          ),
          db.execute(sql`
          SELECT * FROM employees 
          WHERE ${whereClause}
          ORDER BY nome_completo ASC
          LIMIT ${limitNum} OFFSET ${offset}
        `),
        ]);

        return res.json({
          employees: employeesResult.rows,
          total: parseInt(countResult.rows[0]?.total as string) || 0,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(
            (parseInt(countResult.rows[0]?.total as string) || 0) / limitNum,
          ),
        });
      } catch (error) {
        console.error("Error listing employees:", error);
        return res.status(500).json({ message: "Erro ao listar funcionários" });
      }
    },
  );

  // GET /api/employees/available-for-team - Must be before :id route
  app.get(
    "/api/employees/available-for-team",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios"),
    async (req, res) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }

        const result = await db.execute(sql`
        SELECT u.id, u.name, u.email, u.role
        FROM users u
        JOIN user_tenants ut ON u.id = ut.user_id
        WHERE ut.tenant_id = ${tenantId}
        AND u.is_active = true
        AND u.role IN ('vendedor', 'operacional', 'atendimento', 'coordenacao')
        AND NOT EXISTS (
          SELECT 1 FROM commercial_team_members ctm
          JOIN commercial_teams ct ON ctm.team_id = ct.id
          WHERE ctm.user_id = u.id 
          AND ctm.ativo = true 
          AND ct.ativa = true
          AND ctm.tenant_id = ${tenantId}
          AND ct.tenant_id = ${tenantId}
        )
        ORDER BY u.name ASC
      `);

        return res.json(result.rows);
      } catch (error) {
        console.error("Error listing available users for team:", error);
        return res
          .status(500)
          .json({ message: "Erro ao listar usuários disponíveis" });
      }
    },
  );

  // GET /api/employees/:id - Get single employee
  app.get(
    "/api/employees/:id",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }

        const result = await db.execute(sql`
        SELECT * FROM employees WHERE id = ${id} AND tenant_id = ${tenantId}
      `);

        if (result.rows.length === 0) {
          return res
            .status(404)
            .json({ message: "Funcionário não encontrado" });
        }

        return res.json(result.rows[0]);
      } catch (error) {
        console.error("Error getting employee:", error);
        return res.status(500).json({ message: "Erro ao buscar funcionário" });
      }
    },
  );

  // POST /api/employees - Create new employee
  app.post(
    "/api/employees",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }
        const userId = req.user!.id;
        const data = req.body;

        // Check CPF uniqueness
        const existingCpf = await db.execute(sql`
        SELECT id FROM employees WHERE cpf = ${data.cpf} AND tenant_id = ${tenantId}
      `);

        if (existingCpf.rows.length > 0) {
          return res
            .status(400)
            .json({ message: "Já existe um funcionário com este CPF" });
        }

        // Validate userId if provided - must belong to same tenant
        if (data.userId) {
          const userTenantCheck = await db.execute(sql`
          SELECT 1 FROM user_tenants WHERE user_id = ${data.userId} AND tenant_id = ${tenantId}
        `);
          if (userTenantCheck.rows.length === 0) {
            return res.status(400).json({
              message: "O usuário selecionado não pertence ao ambiente atual",
            });
          }
          // Check if user is already linked to another employee
          const existingEmployeeLink = await db.execute(sql`
          SELECT id FROM employees WHERE user_id = ${data.userId} AND tenant_id = ${tenantId}
        `);
          if (existingEmployeeLink.rows.length > 0) {
            return res.status(400).json({
              message: "Este usuário já está vinculado a outro funcionário",
            });
          }
        }

        // If criarAcesso is true, create a user for this employee
        let newUserId: number | null = null;
        if (data.criarAcesso) {
          // Validate required fields - login must be valid email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!data.login || !emailRegex.test(data.login)) {
            return res
              .status(400)
              .json({ message: "Informe um email válido para login" });
          }
          if (!data.senha || data.senha.length < 8) {
            return res
              .status(400)
              .json({ message: "Senha deve ter pelo menos 8 caracteres" });
          }
          if (data.senha !== data.confirmarSenha) {
            return res.status(400).json({ message: "As senhas não coincidem" });
          }

          // Validate visaoBanco
          const allowedVisaoBanco = ["TODOS", "SIAPE", "INSS"];
          if (
            !data.visaoBanco ||
            !allowedVisaoBanco.includes(data.visaoBanco)
          ) {
            return res
              .status(400)
              .json({ message: "Selecione uma visão de banco válida" });
          }

          // Validate role - aligned with USER_ROLES from shared schema
          const allowedRoles = [
            "vendedor",
            "coordenacao",
            "atendimento",
            "operacional",
            "master",
          ];
          if (!data.role || !allowedRoles.includes(data.role)) {
            return res
              .status(400)
              .json({ message: "Selecione um perfil de acesso válido" });
          }

          const finalRole = data.role;
          const isMasterFlag = data.role === "master";

          // Check if login (email) already exists
          const existingLogin = await db.execute(sql`
          SELECT id FROM users WHERE email = ${data.login}
        `);
          if (existingLogin.rows.length > 0) {
            return res
              .status(400)
              .json({ message: "Já existe um usuário com este login" });
          }

          // Hash password and create user
          const passwordHash = await bcrypt.hash(data.senha, 10);
          const newUserResult = await db.execute(sql`
          INSERT INTO users (name, email, password_hash, role, is_active, is_master)
          VALUES (${data.nomeCompleto}, ${data.login}, ${passwordHash}, ${finalRole}, true, ${isMasterFlag})
          RETURNING id
        `);
          newUserId = newUserResult.rows[0].id as number;

          // Link user to tenant
          await db.execute(sql`
          INSERT INTO user_tenants (user_id, tenant_id, is_primary)
          VALUES (${newUserId}, ${tenantId}, true)
        `);
        }

        const result = await db.execute(sql`
        INSERT INTO employees (
          tenant_id, user_id, nome_completo, cpf, rg, rg_estado, rg_emissao, data_nascimento,
          nacionalidade, naturalidade, naturalidade_estado, raca, grau_instrucao,
          email_corporativo, email_pessoal, telefone, celular,
          endereco_completo, bairro, cep, cidade, estado,
          nome_pai, nome_mae, nome_conjuge, estado_civil, quantidade_filhos,
          ctps_numero, ctps_serie, ctps_estado, titulo_eleitor, titulo_zona, titulo_secao, pis,
          clinica_exame, codigo_cnes, medico_exame, crm_medico, data_exame, data_vencimento_exame,
          cargo, departamento, tipo_contrato, data_admissao, data_demissao, status, salario_base, adicional_salarial,
          horario_entrada_1, horario_saida_1, horario_entrada_2, horario_saida_2, horario_sabado_entrada, horario_sabado_saida,
          vale_transporte, vale_refeicao, descanso_sabado, descanso_domingo,
          periodo_experiencia, renovacao_experiencia, cidade_assinatura, data_assinatura,
          banco, agencia, conta, tipo_conta, pix,
          documento_cpf, documento_rg, documento_ctps, documento_comprovante_residencia, documento_contrato, documento_outros,
          visao_banco, observacoes, criado_por
        ) VALUES (
          ${tenantId}, ${newUserId || data.userId || null}, ${data.nomeCompleto}, ${data.cpf}, ${data.rg || null}, ${data.rgEstado || null}, ${data.rgEmissao || null}, ${data.dataNascimento || null},
          ${data.nacionalidade || null}, ${data.naturalidade || null}, ${data.naturalidadeEstado || null}, ${data.raca || null}, ${data.grauInstrucao || null},
          ${data.emailCorporativo || null}, ${data.emailPessoal || null}, ${data.telefone || null}, ${data.celular || null},
          ${data.enderecoCompleto || null}, ${data.bairro || null}, ${data.cep || null}, ${data.cidade || null}, ${data.estado || null},
          ${data.nomePai || null}, ${data.nomeMae || null}, ${data.nomeConjuge || null}, ${data.estadoCivil || null}, ${data.quantidadeFilhos || 0},
          ${data.ctpsNumero || null}, ${data.ctpsSerie || null}, ${data.ctpsEstado || null}, ${data.tituloEleitor || null}, ${data.tituloZona || null}, ${data.tituloSecao || null}, ${data.pis || null},
          ${data.clinicaExame || null}, ${data.codigoCnes || null}, ${data.medicoExame || null}, ${data.crmMedico || null}, ${data.dataExame || null}, ${data.dataVencimentoExame || null},
          ${data.cargo || null}, ${data.departamento || null}, ${data.tipoContrato || null}, ${data.dataAdmissao || null}, ${data.dataDemissao || null}, ${data.status || "ativo"}, ${data.salarioBase || null}, ${data.adicionalSalarial || null},
          ${data.horarioEntrada1 || null}, ${data.horarioSaida1 || null}, ${data.horarioEntrada2 || null}, ${data.horarioSaida2 || null}, ${data.horarioSabadoEntrada || null}, ${data.horarioSabadoSaida || null},
          ${data.valeTransporte || false}, ${data.valeRefeicao || false}, ${data.descansoSabado || false}, ${data.descansoDomingo || false},
          ${data.periodoExperiencia || null}, ${data.renovacaoExperiencia || null}, ${data.cidadeAssinatura || null}, ${data.dataAssinatura || null},
          ${data.banco || null}, ${data.agencia || null}, ${data.conta || null}, ${data.tipoConta || null}, ${data.pix || null},
          ${data.documentoCpf || null}, ${data.documentoRg || null}, ${data.documentoCtps || null}, ${data.documentoComprovanteResidencia || null}, ${data.documentoContrato || null}, ${data.documentoOutros ? JSON.stringify(data.documentoOutros) : null},
          ${data.visaoBanco || null}, ${data.observacoes || null}, ${userId}
        )
        RETURNING *
      `);

        const createdEmployee = result.rows[0] as any;

        // If userId was provided (linking to existing user), update the user's employee_id
        const linkedUserId = newUserId || data.userId;
        if (linkedUserId && createdEmployee.id) {
          await db.execute(sql`
          UPDATE users SET employee_id = ${createdEmployee.id} WHERE id = ${linkedUserId}
        `);
          console.log(
            `✅ Employee ${createdEmployee.id} vinculado ao user ${linkedUserId}`,
          );
        }

        return res.status(201).json(createdEmployee);
      } catch (error) {
        console.error("Error creating employee:", error);
        return res.status(500).json({ message: "Erro ao criar funcionário" });
      }
    },
  );

  // POST /api/employees/import-json - Import employee from JSON
  app.post(
    "/api/employees/import-json",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }
        const userId = req.user!.id;
        const data = req.body;

        // Map JSON fields to employee fields (support multiple field naming conventions)
        const nomeCompleto =
          data.colaborador || data.nomeCompleto || data.nome_completo || "";
        const cpf = (data.cpf || "").replace(/\D/g, "");

        if (!nomeCompleto || !cpf) {
          return res.status(400).json({
            message: "Campos obrigatórios: colaborador/nomeCompleto e cpf",
          });
        }

        if (cpf.length !== 11) {
          return res.status(400).json({ message: "CPF deve ter 11 dígitos" });
        }

        // Check CPF uniqueness
        const existingCpf = await db.execute(sql`
        SELECT id FROM employees WHERE cpf = ${cpf} AND tenant_id = ${tenantId}
      `);

        if (existingCpf.rows.length > 0) {
          return res
            .status(400)
            .json({ message: "Já existe um funcionário com este CPF" });
        }

        // Build dataAssinatura from diaAssinatura, mesAssinatura, anoAssinatura if provided
        let dataAssinaturaCalculada: string | null = null;
        if (data.diaAssinatura && data.mesAssinatura && data.anoAssinatura) {
          const dia = String(data.diaAssinatura).padStart(2, "0");
          const mes = String(data.mesAssinatura).padStart(2, "0");
          const ano = data.anoAssinatura;
          dataAssinaturaCalculada = `${ano}-${mes}-${dia}`;
        }

        // Map fields exactly from user's JSON model (in order)
        const mappedData = {
          // empresa is informational, not stored
          nomeCompleto, // colaborador
          telefone: data.fone || null,
          enderecoCompleto: data.endereco || null,
          bairro: data.bairro || null,
          cidade: data.cidade || null,
          estado: data.estado || null,
          cep: (data.cep || "").replace(/\D/g, "") || null,
          estadoCivil: data.estadoCivil || null,
          nacionalidade: data.nacionalidade || null,
          grauInstrucao: data.grauInstrucao || null,
          naturalidade: data.naturalidade || null,
          naturalidadeEstado: data.naturalidadeEstado || null,
          ctpsNumero: data.ctpsNumero || null,
          ctpsSerie: data.ctpsSerie || null,
          ctpsEstado: data.ctpsEstado || null,
          rg: data.rgNumero || null,
          rgEstado: data.rgEstado || null,
          rgEmissao: data.rgEmissao || null,
          tituloEleitor: data.tituloEleitor || null,
          tituloZona: data.zona || null,
          tituloSecao: data.secao || null,
          cpf,
          pis: data.pis || null,
          dataNascimento: data.dataNascimento || null,
          raca: data.raca || null,
          nomeConjuge: data.nomeConjuge || null,
          nomePai: data.nomePai || null,
          nomeMae: data.nomeMae || null,
          clinicaExame: data.clinica || null,
          codigoCnes: data.codigoCnes || null,
          medicoExame: data.medico || null,
          crmMedico: data.crm || null,
          dataExame: data.dataExame || null,
          dataVencimentoExame: data.dataVencimentoExame || null,
          cargo: data.funcao || null,
          dataAdmissao: data.admissao || null,
          salarioBase: data.salario || null,
          adicionalSalarial: data.adicional || null,
          horarioEntrada1: data.horarioEntrada1 || null,
          horarioSaida1: data.horarioSaida1 || null,
          horarioEntrada2: data.horarioEntrada2 || null,
          horarioSaida2: data.horarioSaida2 || null,
          horarioSabadoEntrada: data.horarioSabadoEntrada || null,
          horarioSabadoSaida: data.horarioSabadoSaida || null,
          valeTransporte:
            data.valeTransporte === true || data.valeTransporte === "true",
          valeRefeicao:
            data.valeRefeicao === true || data.valeRefeicao === "true",
          descansoSabado:
            data.descansoSabado === true || data.descansoSabado === "true",
          descansoDomingo:
            data.descansoDomingo === true ||
            data.descansoDomingo === "true" ||
            data.descansoDomingo === null,
          periodoExperiencia: data.periodoExperiencia || null,
          renovacaoExperiencia: data.renovacao || null,
          cidadeAssinatura: data.cidadeAssinatura || null,
          dataAssinatura: dataAssinaturaCalculada,
          // Fields not in user's JSON but may be needed
          emailCorporativo: data.emailCorporativo || data.email || null,
          emailPessoal: data.emailPessoal || null,
          celular: data.celular || null,
          quantidadeFilhos: parseInt(data.quantidadeFilhos) || 0,
          departamento: data.departamento || null,
          tipoContrato: data.tipoContrato || null,
          banco: data.banco || null,
          agencia: data.agencia || null,
          conta: data.conta || null,
          tipoConta: data.tipoConta || null,
          pix: data.pix || null,
          observacoes: data.observacoes || null,
        };

        // Insert employee
        const result = await db.execute(sql`
        INSERT INTO employees (
          tenant_id, nome_completo, cpf, rg, rg_estado, rg_emissao, data_nascimento,
          nacionalidade, naturalidade, naturalidade_estado, raca, grau_instrucao,
          email_corporativo, email_pessoal, telefone, celular,
          endereco_completo, bairro, cep, cidade, estado,
          nome_pai, nome_mae, nome_conjuge, estado_civil, quantidade_filhos,
          ctps_numero, ctps_serie, ctps_estado, titulo_eleitor, titulo_zona, titulo_secao, pis,
          clinica_exame, codigo_cnes, medico_exame, crm_medico, data_exame, data_vencimento_exame,
          cargo, departamento, tipo_contrato, data_admissao, status, salario_base, adicional_salarial,
          horario_entrada_1, horario_saida_1, horario_entrada_2, horario_saida_2, horario_sabado_entrada, horario_sabado_saida,
          vale_transporte, vale_refeicao, descanso_sabado, descanso_domingo,
          periodo_experiencia, renovacao_experiencia, cidade_assinatura, data_assinatura,
          banco, agencia, conta, tipo_conta, pix,
          observacoes, criado_por
        ) VALUES (
          ${tenantId}, ${mappedData.nomeCompleto}, ${mappedData.cpf}, ${mappedData.rg}, ${mappedData.rgEstado}, ${mappedData.rgEmissao}, ${mappedData.dataNascimento},
          ${mappedData.nacionalidade}, ${mappedData.naturalidade}, ${mappedData.naturalidadeEstado}, ${mappedData.raca}, ${mappedData.grauInstrucao},
          ${mappedData.emailCorporativo}, ${mappedData.emailPessoal}, ${mappedData.telefone}, ${mappedData.celular},
          ${mappedData.enderecoCompleto}, ${mappedData.bairro}, ${mappedData.cep}, ${mappedData.cidade}, ${mappedData.estado},
          ${mappedData.nomePai}, ${mappedData.nomeMae}, ${mappedData.nomeConjuge}, ${mappedData.estadoCivil}, ${mappedData.quantidadeFilhos},
          ${mappedData.ctpsNumero}, ${mappedData.ctpsSerie}, ${mappedData.ctpsEstado}, ${mappedData.tituloEleitor}, ${mappedData.tituloZona}, ${mappedData.tituloSecao}, ${mappedData.pis},
          ${mappedData.clinicaExame}, ${mappedData.codigoCnes}, ${mappedData.medicoExame}, ${mappedData.crmMedico}, ${mappedData.dataExame}, ${mappedData.dataVencimentoExame},
          ${mappedData.cargo}, ${mappedData.departamento}, ${mappedData.tipoContrato}, ${mappedData.dataAdmissao}, 'ativo', ${mappedData.salarioBase}, ${mappedData.adicionalSalarial},
          ${mappedData.horarioEntrada1}, ${mappedData.horarioSaida1}, ${mappedData.horarioEntrada2}, ${mappedData.horarioSaida2}, ${mappedData.horarioSabadoEntrada}, ${mappedData.horarioSabadoSaida},
          ${mappedData.valeTransporte}, ${mappedData.valeRefeicao}, ${mappedData.descansoSabado}, ${mappedData.descansoDomingo},
          ${mappedData.periodoExperiencia}, ${mappedData.renovacaoExperiencia}, ${mappedData.cidadeAssinatura}, ${mappedData.dataAssinatura},
          ${mappedData.banco}, ${mappedData.agencia}, ${mappedData.conta}, ${mappedData.tipoConta}, ${mappedData.pix},
          ${mappedData.observacoes}, ${userId}
        )
        RETURNING *
      `);

        console.log(
          `[EMPLOYEE-IMPORT] Employee imported via JSON: ${mappedData.nomeCompleto} (CPF: ${mappedData.cpf})`,
        );

        return res.status(201).json({
          success: true,
          employee: result.rows[0],
          message: "Funcionário importado com sucesso",
        });
      } catch (error) {
        console.error("Error importing employee from JSON:", error);
        return res
          .status(500)
          .json({ message: "Erro ao importar funcionário" });
      }
    },
  );

  // PUT /api/employees/:id - Update employee
  app.put(
    "/api/employees/:id",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }
        const data = req.body;

        // Check if exists and get current user_id
        const existing = await db.execute(sql`
        SELECT id, user_id FROM employees WHERE id = ${id} AND tenant_id = ${tenantId}
      `);

        if (existing.rows.length === 0) {
          return res
            .status(404)
            .json({ message: "Funcionário não encontrado" });
        }

        const oldUserId = (existing.rows[0] as any).user_id;

        // Check CPF uniqueness (excluding current)
        if (data.cpf) {
          const existingCpf = await db.execute(sql`
          SELECT id FROM employees WHERE cpf = ${data.cpf} AND tenant_id = ${tenantId} AND id != ${id}
        `);

          if (existingCpf.rows.length > 0) {
            return res
              .status(400)
              .json({ message: "Já existe outro funcionário com este CPF" });
          }
        }

        // Validate userId if provided - must belong to same tenant
        const newUserId = data.userId || null;
        if (newUserId) {
          const userTenantCheck = await db.execute(sql`
          SELECT 1 FROM user_tenants WHERE user_id = ${newUserId} AND tenant_id = ${tenantId}
        `);
          if (userTenantCheck.rows.length === 0) {
            return res.status(400).json({
              message: "O usuário selecionado não pertence ao ambiente atual",
            });
          }
          // Check if user is already linked to another employee (excluding current)
          const existingEmployeeLink = await db.execute(sql`
          SELECT id FROM employees WHERE user_id = ${newUserId} AND tenant_id = ${tenantId} AND id != ${id}
        `);
          if (existingEmployeeLink.rows.length > 0) {
            return res.status(400).json({
              message: "Este usuário já está vinculado a outro funcionário",
            });
          }
        }

        const result = await db.execute(sql`
        UPDATE employees SET
          user_id = ${newUserId},
          nome_completo = ${data.nomeCompleto},
          cpf = ${data.cpf},
          rg = ${data.rg || null},
          rg_estado = ${data.rgEstado || null},
          rg_emissao = ${data.rgEmissao || null},
          data_nascimento = ${data.dataNascimento || null},
          nacionalidade = ${data.nacionalidade || null},
          naturalidade = ${data.naturalidade || null},
          naturalidade_estado = ${data.naturalidadeEstado || null},
          raca = ${data.raca || null},
          grau_instrucao = ${data.grauInstrucao || null},
          email_corporativo = ${data.emailCorporativo || null},
          email_pessoal = ${data.emailPessoal || null},
          telefone = ${data.telefone || null},
          celular = ${data.celular || null},
          endereco_completo = ${data.enderecoCompleto || null},
          bairro = ${data.bairro || null},
          cep = ${data.cep || null},
          cidade = ${data.cidade || null},
          estado = ${data.estado || null},
          nome_pai = ${data.nomePai || null},
          nome_mae = ${data.nomeMae || null},
          nome_conjuge = ${data.nomeConjuge || null},
          estado_civil = ${data.estadoCivil || null},
          quantidade_filhos = ${data.quantidadeFilhos || 0},
          ctps_numero = ${data.ctpsNumero || null},
          ctps_serie = ${data.ctpsSerie || null},
          ctps_estado = ${data.ctpsEstado || null},
          titulo_eleitor = ${data.tituloEleitor || null},
          titulo_zona = ${data.tituloZona || null},
          titulo_secao = ${data.tituloSecao || null},
          pis = ${data.pis || null},
          clinica_exame = ${data.clinicaExame || null},
          codigo_cnes = ${data.codigoCnes || null},
          medico_exame = ${data.medicoExame || null},
          crm_medico = ${data.crmMedico || null},
          data_exame = ${data.dataExame || null},
          data_vencimento_exame = ${data.dataVencimentoExame || null},
          cargo = ${data.cargo || null},
          departamento = ${data.departamento || null},
          tipo_contrato = ${data.tipoContrato || null},
          data_admissao = ${data.dataAdmissao || null},
          data_demissao = ${data.dataDemissao || null},
          status = ${data.status || "ativo"},
          salario_base = ${data.salarioBase || null},
          adicional_salarial = ${data.adicionalSalarial || null},
          horario_entrada_1 = ${data.horarioEntrada1 || null},
          horario_saida_1 = ${data.horarioSaida1 || null},
          horario_entrada_2 = ${data.horarioEntrada2 || null},
          horario_saida_2 = ${data.horarioSaida2 || null},
          horario_sabado_entrada = ${data.horarioSabadoEntrada || null},
          horario_sabado_saida = ${data.horarioSabadoSaida || null},
          vale_transporte = ${data.valeTransporte || false},
          vale_refeicao = ${data.valeRefeicao || false},
          descanso_sabado = ${data.descansoSabado || false},
          descanso_domingo = ${data.descansoDomingo || false},
          periodo_experiencia = ${data.periodoExperiencia || null},
          renovacao_experiencia = ${data.renovacaoExperiencia || null},
          cidade_assinatura = ${data.cidadeAssinatura || null},
          data_assinatura = ${data.dataAssinatura || null},
          banco = ${data.banco || null},
          agencia = ${data.agencia || null},
          conta = ${data.conta || null},
          tipo_conta = ${data.tipoConta || null},
          pix = ${data.pix || null},
          documento_cpf = ${data.documentoCpf || null},
          documento_rg = ${data.documentoRg || null},
          documento_ctps = ${data.documentoCtps || null},
          documento_comprovante_residencia = ${data.documentoComprovanteResidencia || null},
          documento_contrato = ${data.documentoContrato || null},
          documento_outros = ${data.documentoOutros ? JSON.stringify(data.documentoOutros) : null},
          observacoes = ${data.observacoes || null},
          updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `);

        const updatedEmployee = result.rows[0] as any;

        // Handle user link changes
        if (oldUserId !== newUserId) {
          // Unlink old user if exists
          if (oldUserId) {
            await db.execute(sql`
            UPDATE users SET employee_id = NULL WHERE id = ${oldUserId}
          `);
            console.log(`✅ User ${oldUserId} desvinculado do employee ${id}`);
          }
          // Link new user if exists
          if (newUserId) {
            await db.execute(sql`
            UPDATE users SET employee_id = ${id} WHERE id = ${newUserId}
          `);
            console.log(`✅ User ${newUserId} vinculado ao employee ${id}`);
          }
        }

        return res.json(updatedEmployee);
      } catch (error) {
        console.error("Error updating employee:", error);
        return res
          .status(500)
          .json({ message: "Erro ao atualizar funcionário" });
      }
    },
  );

  // DELETE /api/employees/:id - Delete employee
  app.delete(
    "/api/employees/:id",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }

        const result = await db.execute(sql`
        DELETE FROM employees WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING id
      `);

        if (result.rows.length === 0) {
          return res
            .status(404)
            .json({ message: "Funcionário não encontrado" });
        }

        return res.json({ message: "Funcionário removido com sucesso" });
      } catch (error) {
        console.error("Error deleting employee:", error);
        return res.status(500).json({ message: "Erro ao remover funcionário" });
      }
    },
  );

  // POST /api/employees/:id/documents - Upload document for employee
  app.post(
    "/api/employees/:id/documents",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    upload.single("file"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }
        const { documentType } = req.body;

        if (!req.file) {
          return res.status(400).json({ message: "Arquivo não enviado" });
        }

        // Check if employee exists
        const existing = await db.execute(sql`
        SELECT id FROM employees WHERE id = ${id} AND tenant_id = ${tenantId}
      `);

        if (existing.rows.length === 0) {
          return res
            .status(404)
            .json({ message: "Funcionário não encontrado" });
        }

        // Save file
        const uploadsDir = path.join(
          process.cwd(),
          "uploads",
          "employees",
          String(id),
        );
        fs.mkdirSync(uploadsDir, { recursive: true });

        const fileName = `${documentType}-${Date.now()}${path.extname(req.file.originalname)}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, req.file.buffer);

        const fileUrl = `/uploads/employees/${id}/${fileName}`;

        // Update employee with document path
        const columnMap: Record<string, string> = {
          cpf: "documento_cpf",
          rg: "documento_rg",
          ctps: "documento_ctps",
          comprovante_residencia: "documento_comprovante_residencia",
          contrato: "documento_contrato",
        };

        const column = columnMap[documentType];
        if (column) {
          await db.execute(sql`
          UPDATE employees SET ${sql.raw(column)} = ${fileUrl}, updated_at = NOW()
          WHERE id = ${id} AND tenant_id = ${tenantId}
        `);
        }

        return res.json({
          url: fileUrl,
          message: "Documento enviado com sucesso",
        });
      } catch (error) {
        console.error("Error uploading employee document:", error);
        return res.status(500).json({ message: "Erro ao enviar documento" });
      }
    },
  );

  // ===== COMMERCIAL TEAMS (EQUIPES COMERCIAIS) API =====

  // GET /api/commercial-teams - List all commercial teams for tenant
  app.get(
    "/api/commercial-teams",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios"),
    async (req, res) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }

        const result = await db.execute(sql`
        SELECT 
          ct.*,
          u.name as coordenador_nome,
          (SELECT COUNT(*) FROM commercial_team_members ctm WHERE ctm.team_id = ct.id AND ctm.ativo = true) as total_membros
        FROM commercial_teams ct
        LEFT JOIN users u ON ct.coordenador_id = u.id
        WHERE ct.tenant_id = ${tenantId}
        ORDER BY ct.nome_equipe ASC
      `);

        return res.json(result.rows);
      } catch (error) {
        console.error("Error listing commercial teams:", error);
        return res
          .status(500)
          .json({ message: "Erro ao listar equipes comerciais" });
      }
    },
  );

  // GET /api/commercial-teams/:id - Get single commercial team
  app.get(
    "/api/commercial-teams/:id",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }

        const result = await db.execute(sql`
        SELECT 
          ct.*,
          u.name as coordenador_nome
        FROM commercial_teams ct
        LEFT JOIN users u ON ct.coordenador_id = u.id
        WHERE ct.id = ${id} AND ct.tenant_id = ${tenantId}
      `);

        if (result.rows.length === 0) {
          return res.status(404).json({ message: "Equipe não encontrada" });
        }

        return res.json(result.rows[0]);
      } catch (error) {
        console.error("Error getting commercial team:", error);
        return res
          .status(500)
          .json({ message: "Erro ao buscar equipe comercial" });
      }
    },
  );

  // POST /api/commercial-teams - Create new commercial team
  app.post(
    "/api/commercial-teams",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }
        const data = req.body;

        // Validate required fields
        if (!data.nomeEquipe || !data.nomeEquipe.trim()) {
          return res
            .status(400)
            .json({ message: "Nome da equipe é obrigatório" });
        }
        if (!data.coordenadorId) {
          return res.status(400).json({ message: "Coordenador é obrigatório" });
        }

        const result = await db.execute(sql`
        INSERT INTO commercial_teams (
          tenant_id, nome_equipe, descricao, coordenador_id, ativa, meta_mensal
        ) VALUES (
          ${tenantId}, ${data.nomeEquipe}, ${data.descricao || null}, ${data.coordenadorId || null}, ${data.ativa !== false}, ${data.metaMensal || null}
        )
        RETURNING *
      `);

        return res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating commercial team:", error);
        return res
          .status(500)
          .json({ message: "Erro ao criar equipe comercial" });
      }
    },
  );

  // PUT /api/commercial-teams/:id - Update commercial team
  app.put(
    "/api/commercial-teams/:id",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }
        const data = req.body;

        // Validate required fields
        if (!data.nomeEquipe || !data.nomeEquipe.trim()) {
          return res
            .status(400)
            .json({ message: "Nome da equipe é obrigatório" });
        }
        if (!data.coordenadorId) {
          return res.status(400).json({ message: "Coordenador é obrigatório" });
        }

        const existing = await db.execute(sql`
        SELECT id, coordenador_id FROM commercial_teams WHERE id = ${id} AND tenant_id = ${tenantId}
      `);

        if (existing.rows.length === 0) {
          return res.status(404).json({ message: "Equipe não encontrada" });
        }

        const oldCoordinatorId = (existing.rows[0] as any).coordenador_id;
        const newCoordinatorId = data.coordenadorId
          ? parseInt(data.coordenadorId)
          : null;

        // Reconcile coordinator membership if coordinator changed
        if (oldCoordinatorId !== newCoordinatorId) {
          // Remove old coordinator's coordinator role
          if (oldCoordinatorId) {
            await db.execute(sql`
            DELETE FROM commercial_team_members 
            WHERE team_id = ${id} 
            AND user_id = ${oldCoordinatorId} 
            AND funcao_equipe = 'coordenador'
            AND tenant_id = ${tenantId}
          `);
          }

          // Add new coordinator as member if not already a member
          if (newCoordinatorId) {
            const existingMember = await db.execute(sql`
            SELECT id FROM commercial_team_members 
            WHERE team_id = ${id} AND user_id = ${newCoordinatorId} AND tenant_id = ${tenantId}
          `);

            if (existingMember.rows.length > 0) {
              await db.execute(sql`
              UPDATE commercial_team_members 
              SET funcao_equipe = 'coordenador', updated_at = NOW()
              WHERE team_id = ${id} AND user_id = ${newCoordinatorId} AND tenant_id = ${tenantId}
            `);
            } else {
              await db.execute(sql`
              INSERT INTO commercial_team_members (
                tenant_id, team_id, user_id, funcao_equipe, tipo_remuneracao, ativo, data_entrada
              ) VALUES (
                ${tenantId}, ${id}, ${newCoordinatorId}, 'coordenador', 'salario_fixo', true, ${new Date().toISOString().split("T")[0]}
              )
            `);
            }
          }
        }

        const result = await db.execute(sql`
        UPDATE commercial_teams SET
          nome_equipe = ${data.nomeEquipe},
          descricao = ${data.descricao || null},
          coordenador_id = ${newCoordinatorId},
          ativa = ${data.ativa !== false},
          meta_mensal = ${data.metaMensal || null},
          updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `);

        return res.json(result.rows[0]);
      } catch (error) {
        console.error("Error updating commercial team:", error);
        return res
          .status(500)
          .json({ message: "Erro ao atualizar equipe comercial" });
      }
    },
  );

  // DELETE /api/commercial-teams/:id - Delete commercial team
  app.delete(
    "/api/commercial-teams/:id",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }

        const result = await db.execute(sql`
        DELETE FROM commercial_teams WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING id
      `);

        if (result.rows.length === 0) {
          return res.status(404).json({ message: "Equipe não encontrada" });
        }

        return res.json({ message: "Equipe removida com sucesso" });
      } catch (error) {
        console.error("Error deleting commercial team:", error);
        return res
          .status(500)
          .json({ message: "Erro ao remover equipe comercial" });
      }
    },
  );

  // GET /api/commercial-teams/:id/members - List members of a commercial team
  app.get(
    "/api/commercial-teams/:id/members",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios"),
    async (req, res) => {
      try {
        const teamId = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }

        const result = await db.execute(sql`
        SELECT 
          ctm.*,
          u.name as funcionario_nome,
          u.email as funcionario_email,
          u.role as funcionario_role
        FROM commercial_team_members ctm
        LEFT JOIN users u ON ctm.user_id = u.id
        WHERE ctm.team_id = ${teamId} AND ctm.tenant_id = ${tenantId}
        ORDER BY 
          CASE ctm.funcao_equipe 
            WHEN 'coordenador' THEN 1
            WHEN 'subcoordenador' THEN 2
            WHEN 'assistente' THEN 3
            WHEN 'vendedor' THEN 4
            WHEN 'operacional' THEN 5
            ELSE 6
          END,
          u.name ASC
      `);

        return res.json(result.rows);
      } catch (error) {
        console.error("Error listing team members:", error);
        return res
          .status(500)
          .json({ message: "Erro ao listar membros da equipe" });
      }
    },
  );

  // POST /api/commercial-teams/:id/members - Add member to commercial team
  app.post(
    "/api/commercial-teams/:id/members",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const teamId = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }
        const data = req.body;

        // Validate required fields
        if (!data.userId) {
          return res.status(400).json({ message: "Usuário é obrigatório" });
        }
        if (!data.funcaoEquipe) {
          return res
            .status(400)
            .json({ message: "Função na equipe é obrigatória" });
        }
        // Check if team exists
        const team = await db.execute(sql`
        SELECT id FROM commercial_teams WHERE id = ${teamId} AND tenant_id = ${tenantId}
      `);
        if (team.rows.length === 0) {
          return res.status(404).json({ message: "Equipe não encontrada" });
        }

        // Check if user is already in an active team
        const existingMember = await db.execute(sql`
        SELECT ctm.id, ct.nome_equipe 
        FROM commercial_team_members ctm
        JOIN commercial_teams ct ON ctm.team_id = ct.id
        WHERE ctm.user_id = ${data.userId} 
        AND ctm.ativo = true 
        AND ct.ativa = true
        AND ctm.tenant_id = ${tenantId}
      `);
        if (existingMember.rows.length > 0) {
          const existingTeam = existingMember.rows[0] as any;
          return res.status(400).json({
            message: `Este usuário já é membro ativo da equipe "${existingTeam.nome_equipe}"`,
          });
        }

        // Check if trying to add coordinator when one already exists
        if (data.funcaoEquipe === "coordenador") {
          const existingCoord = await db.execute(sql`
          SELECT id FROM commercial_team_members 
          WHERE team_id = ${teamId} AND funcao_equipe = 'coordenador' AND ativo = true
        `);
          if (existingCoord.rows.length > 0) {
            return res
              .status(400)
              .json({ message: "Esta equipe já possui um coordenador" });
          }
        }

        const result = await db.execute(sql`
        INSERT INTO commercial_team_members (
          tenant_id, team_id, user_id, funcao_equipe, tipo_remuneracao,
          ativo, data_entrada
        ) VALUES (
          ${tenantId}, ${teamId}, ${data.userId}, ${data.funcaoEquipe}, ${"salario_fixo"},
          true, ${new Date().toISOString().split("T")[0]}
        )
        RETURNING *
      `);

        return res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error adding team member:", error);
        return res
          .status(500)
          .json({ message: "Erro ao adicionar membro à equipe" });
      }
    },
  );

  // PUT /api/team-members/:id - Update team member
  app.put(
    "/api/team-members/:id",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const memberId = parseInt(req.params.id);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }
        const data = req.body;

        // Validate required fields
        if (!data.funcaoEquipe) {
          return res
            .status(400)
            .json({ message: "Função na equipe é obrigatória" });
        }
        if (!data.tipoRemuneracao) {
          return res
            .status(400)
            .json({ message: "Tipo de remuneração é obrigatório" });
        }
        if (
          data.tipoRemuneracao === "salario_variavel" &&
          !data.percentualComissao
        ) {
          return res.status(400).json({
            message:
              "Percentual de comissão é obrigatório para remuneração variável",
          });
        }
        if (data.tipoRemuneracao === "premiacao_meta" && !data.percentualMeta) {
          return res.status(400).json({
            message:
              "Percentual de bônus é obrigatório para premiação por meta",
          });
        }

        // Get existing member
        const existing = await db.execute(sql`
        SELECT id, team_id, funcao_equipe FROM commercial_team_members 
        WHERE id = ${memberId} AND tenant_id = ${tenantId}
      `);
        if (existing.rows.length === 0) {
          return res.status(404).json({ message: "Membro não encontrado" });
        }
        const member = existing.rows[0] as any;

        // If changing to coordinator, check if team already has one
        if (
          data.funcaoEquipe === "coordenador" &&
          member.funcao_equipe !== "coordenador"
        ) {
          const existingCoord = await db.execute(sql`
          SELECT id FROM commercial_team_members 
          WHERE team_id = ${member.team_id} AND funcao_equipe = 'coordenador' AND ativo = true AND id != ${memberId}
          AND tenant_id = ${tenantId}
        `);
          if (existingCoord.rows.length > 0) {
            return res
              .status(400)
              .json({ message: "Esta equipe já possui um coordenador" });
          }
        }

        const result = await db.execute(sql`
        UPDATE commercial_team_members SET
          funcao_equipe = ${data.funcaoEquipe},
          tipo_remuneracao = ${data.tipoRemuneracao},
          percentual_comissao = ${data.percentualComissao || null},
          valor_fixo_adicional = ${data.valorFixoAdicional || null},
          percentual_meta = ${data.percentualMeta || null},
          observacoes = ${data.observacoes || null}
        WHERE id = ${memberId} AND tenant_id = ${tenantId}
        RETURNING *
      `);

        return res.json(result.rows[0]);
      } catch (error) {
        console.error("Error updating team member:", error);
        return res
          .status(500)
          .json({ message: "Erro ao atualizar membro da equipe" });
      }
    },
  );

  // DELETE /api/commercial-teams/:teamId/members/:memberId - Remove member from team
  app.delete(
    "/api/commercial-teams/:teamId/members/:memberId",
    requireAuth,
    requireModuleAccess("modulo_config_usuarios", "edit"),
    async (req, res) => {
      try {
        const teamId = parseInt(req.params.teamId);
        const memberId = parseInt(req.params.memberId);
        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(403).json({ message: "Tenant não configurado" });
        }

        const result = await db.execute(sql`
        DELETE FROM commercial_team_members 
        WHERE id = ${memberId} AND team_id = ${teamId} AND tenant_id = ${tenantId}
        RETURNING id
      `);

        if (result.rows.length === 0) {
          return res.status(404).json({ message: "Membro não encontrado" });
        }

        return res.json({ message: "Membro removido com sucesso" });
      } catch (error) {
        console.error("Error removing team member:", error);
        return res
          .status(500)
          .json({ message: "Erro ao remover membro da equipe" });
      }
    },
  );

  // ========================
  // Dashboard Vendedor API
  // ========================

  const PERFORMANCE_TIERS = [
    {
      level: 5,
      name: "BRONZE",
      color: "#cd7f32",
      icon: "Shield",
      target: 10000,
      rewardValue: 500,
    },
    {
      level: 4,
      name: "PRATA",
      color: "#94a3b8",
      icon: "Medal",
      target: 30000,
      rewardValue: 1200,
    },
    {
      level: 3,
      name: "OURO",
      color: "#fbbf24",
      icon: "Star",
      target: 50000,
      rewardValue: 3000,
    },
    {
      level: 2,
      name: "DIAMANTE",
      color: "#22d3ee",
      icon: "Gem",
      target: 80000,
      rewardValue: 6000,
    },
    {
      level: 1,
      name: "ELITE",
      color: "#a855f7",
      icon: "Crown",
      target: 150000,
      rewardValue: 15000,
    },
  ];

  function getTierForValue(value: number) {
    const sorted = [...PERFORMANCE_TIERS].sort((a, b) => b.target - a.target);
    for (const tier of sorted) {
      if (value >= tier.target) return tier;
    }
    return null;
  }

  function getNextTierForValue(value: number) {
    const sorted = [...PERFORMANCE_TIERS].sort((a, b) => a.target - b.target);
    for (const tier of sorted) {
      if (value < tier.target) return tier;
    }
    return null;
  }

  app.get("/api/dashboard-vendedor", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      const tenantId = req.tenantId || req.session?.tenantId;

      if (!userId || !tenantId) {
        return res.status(401).json({ message: "Não autorizado" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const mesRef = `${year}-${String(month + 1).padStart(2, "0")}`;
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);

      // Pull meta from metas_individuais (priority) or fallback to user.metaMensal
      let metaMensal = 0;
      let metaCartao = 0;
      const metaIndResult = await db.execute(sql`
        SELECT mi.meta_geral, mi.meta_cartao 
        FROM metas_individuais mi
        WHERE mi.usuario_id = ${userId} AND mi.tenant_id = ${tenantId} AND mi.mes_referencia = ${mesRef}
        LIMIT 1
      `);
      if (metaIndResult.rows.length > 0) {
        metaMensal =
          parseFloat(metaIndResult.rows[0].meta_geral as string) || 0;
        metaCartao =
          parseFloat(metaIndResult.rows[0].meta_cartao as string) || 0;
      } else {
        metaMensal = user.metaMensal
          ? parseFloat(user.metaMensal as string)
          : 0;
      }

      const calcDiasUteis = (start: Date, end: Date) => {
        let count = 0;
        const d = new Date(start);
        while (d <= end) {
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) count++;
          d.setDate(d.getDate() + 1);
        }
        return count;
      };

      const diasUteisNoMes = calcDiasUteis(firstDayOfMonth, lastDayOfMonth);
      const hoje = new Date(year, month, now.getDate());
      const diasUteisAteHoje = calcDiasUteis(firstDayOfMonth, hoje);
      const diasUteisRestantes = diasUteisNoMes - diasUteisAteHoje;

      // ── Demo user early-exit: skip all production queries, return synthetic data ──
      if (user.isDemo) {
        const demoDiariaOriginal = diasUteisNoMes > 0 ? metaMensal / diasUteisNoMes : 0;
        const totalValorDemo = metaMensal > 0 ? metaMensal * 0.70 : 0;
        const totalCartaoDemo = metaCartao > 0 ? metaCartao * 0.90 : 0;
        const demoPercentualMeta = metaMensal > 0 ? Math.round((totalValorDemo / metaMensal) * 10000) / 100 : 0;
        const demoSaldoDevedor = Math.max(0, metaMensal - totalValorDemo);
        const demoMetaDiariaAjustada = diasUteisRestantes > 0 ? demoSaldoDevedor / diasUteisRestantes : 0;
        const demoMediaAtual = diasUteisAteHoje > 0 ? totalValorDemo / diasUteisAteHoje : 0;
        const demoProjecao = demoMediaAtual * diasUteisNoMes;
        const demoValorPorDia = diasUteisAteHoje > 0 ? totalValorDemo / diasUteisAteHoje : 0;

        const demoContratosPorDia: Array<{
          dia: string; diaCompleto: string; quantidade: number; valor: number;
          metaDoDia: number; preenchimento: number; vazio: number; excedente: number;
        }> = [];
        const dd = new Date(firstDayOfMonth);
        while (dd <= hoje) {
          const dow = dd.getDay();
          if (dow !== 0 && dow !== 6) {
            const key = dd.toISOString().split("T")[0];
            demoContratosPorDia.push({
              dia: key.substring(8, 10),
              diaCompleto: key,
              quantidade: 2,
              valor: Math.round(demoValorPorDia * 100) / 100,
              metaDoDia: Math.round(demoDiariaOriginal * 100) / 100,
              preenchimento: Math.round(Math.min(demoValorPorDia, demoDiariaOriginal) * 100) / 100,
              vazio: Math.round(Math.max(0, demoDiariaOriginal - demoValorPorDia) * 100) / 100,
              excedente: Math.round(Math.max(0, demoValorPorDia - demoDiariaOriginal) * 100) / 100,
            });
          }
          dd.setDate(dd.getDate() + 1);
        }

        const demoFutureDays: typeof demoContratosPorDia = [];
        const futD = new Date(hoje);
        futD.setDate(futD.getDate() + 1);
        while (futD <= lastDayOfMonth) {
          const dow = futD.getDay();
          if (dow !== 0 && dow !== 6) {
            const key = futD.toISOString().split("T")[0];
            demoFutureDays.push({
              dia: key.substring(8, 10),
              diaCompleto: key,
              quantidade: 0,
              valor: 0,
              metaDoDia: Math.round(demoMetaDiariaAjustada * 100) / 100,
              preenchimento: 0,
              vazio: Math.round(demoMetaDiariaAjustada * 100) / 100,
              excedente: 0,
            });
          }
          futD.setDate(futD.getDate() + 1);
        }

        return res.json({
          vendedorNome: user.name,
          metaMensal,
          metaCartao,
          totalValor: Math.round(totalValorDemo * 100) / 100,
          totalCartao: Math.round(totalCartaoDemo * 100) / 100,
          totalContratos: diasUteisAteHoje * 2,
          percentualMeta: demoPercentualMeta,
          projecaoMensal: Math.round(demoProjecao * 100) / 100,
          metaDiariaOriginal: Math.round(demoDiariaOriginal * 100) / 100,
          metaDiariaAjustada: Math.round(demoMetaDiariaAjustada * 100) / 100,
          mediaAtual: Math.round(demoMediaAtual * 100) / 100,
          saldoDevedor: Math.round(demoSaldoDevedor * 100) / 100,
          diasUteisNoMes,
          diasUteisAteHoje,
          diasUteisRestantes,
          contratosPorDia: [...demoContratosPorDia, ...demoFutureDays],
          currentTier: getTierForValue(totalValorDemo),
          nextTier: getNextTierForValue(totalValorDemo),
          allTiers: PERFORMANCE_TIERS,
          mesAno: `${(month + 1).toString().padStart(2, "0")}/${year}`,
          posicaoRankingGeral: 1,
          posicaoRankingCartao: 1,
          totalVendedores: 1,
          isDemo: true,
        });
      }

      // Get production data from producoes_contratos (imported paid production) + vendedor_contratos
      const prodContratosResult = await db.execute(sql`
        SELECT 
          TO_DATE(data_pagamento, 'DD/MM/YYYY') as dia,
          COUNT(*)::int as quantidade,
          COALESCE(SUM(valor_base), 0)::numeric as valor_total,
          COALESCE(SUM(CASE WHEN is_cartao = true THEN valor_base ELSE 0 END), 0)::numeric as valor_cartao
        FROM producoes_contratos
        WHERE vendedor_id = ${userId}
          AND tenant_id = ${tenantId}
          AND mes_referencia = ${mesRef}
          AND confirmado = true
          AND pt_1000 > 0
        GROUP BY TO_DATE(data_pagamento, 'DD/MM/YYYY')
        ORDER BY dia ASC
      `);

      const vendContratosResult = await db.execute(sql`
        SELECT 
          DATE(data_contrato) as dia,
          COUNT(*)::int as quantidade,
          COALESCE(SUM(valor_contrato), 0)::numeric as valor_total
        FROM vendedor_contratos
        WHERE vendedor_id = ${userId}
          AND tenant_id = ${tenantId}
          AND data_contrato >= ${firstDayOfMonth.toISOString()}
          AND data_contrato <= ${lastDayOfMonth.toISOString()}
        GROUP BY DATE(data_contrato)
        ORDER BY dia ASC
      `);

      // Merge production totals from both sources
      const prodTotaisResult = await db.execute(sql`
        SELECT 
          COUNT(*)::int as total_contratos,
          COALESCE(SUM(valor_base), 0)::numeric as total_valor,
          COALESCE(SUM(CASE WHEN is_cartao = true THEN valor_base ELSE 0 END), 0)::numeric as total_cartao
        FROM producoes_contratos
        WHERE vendedor_id = ${userId}
          AND tenant_id = ${tenantId}
          AND mes_referencia = ${mesRef}
          AND confirmado = true
          AND pt_1000 > 0
      `);

      const vendTotaisResult = await db.execute(sql`
        SELECT 
          COUNT(*)::int as total_contratos,
          COALESCE(SUM(valor_contrato), 0)::numeric as total_valor,
          COALESCE(SUM(CASE WHEN LOWER(tipo_operacao) LIKE '%cartão%' OR LOWER(tipo_operacao) LIKE '%cartao%' THEN valor_contrato ELSE 0 END), 0)::numeric as total_cartao
        FROM vendedor_contratos
        WHERE vendedor_id = ${userId}
          AND tenant_id = ${tenantId}
          AND data_contrato >= ${firstDayOfMonth.toISOString()}
          AND data_contrato <= ${lastDayOfMonth.toISOString()}
      `);

      const totalContratos =
        (parseInt(prodTotaisResult.rows[0]?.total_contratos as string) || 0) +
        (parseInt(vendTotaisResult.rows[0]?.total_contratos as string) || 0);
      const totalValor =
        (parseFloat(prodTotaisResult.rows[0]?.total_valor as string) || 0) +
        (parseFloat(vendTotaisResult.rows[0]?.total_valor as string) || 0);
      const totalCartao =
        (parseFloat(prodTotaisResult.rows[0]?.total_cartao as string) || 0) +
        (parseFloat(vendTotaisResult.rows[0]?.total_cartao as string) || 0);

      const metaDiariaOriginal =
        diasUteisNoMes > 0 ? metaMensal / diasUteisNoMes : 0;
      const saldoDevedor = Math.max(0, metaMensal - totalValor);
      const metaDiariaAjustada =
        diasUteisRestantes > 0 ? saldoDevedor / diasUteisRestantes : 0;
      const mediaAtual =
        diasUteisAteHoje > 0 ? totalValor / diasUteisAteHoje : 0;
      const projecaoMensal = mediaAtual * diasUteisNoMes;
      const percentualMeta =
        metaMensal > 0 ? (totalValor / metaMensal) * 100 : 0;

      const currentTier = getTierForValue(totalValor);
      const nextTier = getNextTierForValue(totalValor);

      const allDaysMap: Record<string, { quantidade: number; valor: number }> =
        {};
      const d = new Date(firstDayOfMonth);
      while (d <= hoje) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) {
          const key = d.toISOString().split("T")[0];
          allDaysMap[key] = { quantidade: 0, valor: 0 };
        }
        d.setDate(d.getDate() + 1);
      }

      // Merge producoes_contratos data
      for (const row of prodContratosResult.rows) {
        const dia = (row.dia as string).split("T")[0];
        if (allDaysMap[dia] !== undefined) {
          allDaysMap[dia].quantidade += parseInt(row.quantidade as string) || 0;
          allDaysMap[dia].valor += parseFloat(row.valor_total as string) || 0;
        }
      }

      // Merge vendedor_contratos data
      for (const row of vendContratosResult.rows) {
        const dia = (row.dia as string).split("T")[0];
        if (allDaysMap[dia] !== undefined) {
          allDaysMap[dia].quantidade += parseInt(row.quantidade as string) || 0;
          allDaysMap[dia].valor += parseFloat(row.valor_total as string) || 0;
        }
      }

      let diaIndex = 0;
      const contratosPorDia = Object.entries(allDaysMap).map(
        ([dia, dayData]) => {
          diaIndex++;
          const isPassado = true;
          const metaDoDia = isPassado ? metaDiariaOriginal : metaDiariaAjustada;
          const produzido = dayData.valor;
          const preenchimento = Math.min(produzido, metaDoDia);
          const vazio = Math.max(0, metaDoDia - produzido);
          const excedente = Math.max(0, produzido - metaDoDia);

          return {
            dia: dia.substring(8, 10),
            diaCompleto: dia,
            quantidade: dayData.quantidade,
            valor: dayData.valor,
            metaDoDia: Math.round(metaDoDia * 100) / 100,
            preenchimento: Math.round(preenchimento * 100) / 100,
            vazio: Math.round(vazio * 100) / 100,
            excedente: Math.round(excedente * 100) / 100,
          };
        },
      );

      const futureDays: typeof contratosPorDia = [];
      const futureD = new Date(hoje);
      futureD.setDate(futureD.getDate() + 1);
      while (futureD <= lastDayOfMonth) {
        const dow = futureD.getDay();
        if (dow !== 0 && dow !== 6) {
          const key = futureD.toISOString().split("T")[0];
          futureDays.push({
            dia: key.substring(8, 10),
            diaCompleto: key,
            quantidade: 0,
            valor: 0,
            metaDoDia: Math.round(metaDiariaAjustada * 100) / 100,
            preenchimento: 0,
            vazio: Math.round(metaDiariaAjustada * 100) / 100,
            excedente: 0,
          });
        }
        futureD.setDate(futureD.getDate() + 1);
      }

      const allChartData = [...contratosPorDia, ...futureDays];

      const allVendedoresRanking = await db.execute(sql`
        SELECT u.id as user_id,
          COALESCE((SELECT SUM(pc.valor_base) FROM producoes_contratos pc WHERE pc.vendedor_id = u.id AND pc.tenant_id = ${tenantId} AND pc.mes_referencia = ${mesRef} AND pc.confirmado = true AND pc.pt_1000 > 0), 0)::numeric
          + COALESCE((SELECT SUM(vc.valor_contrato) FROM vendedor_contratos vc WHERE vc.vendedor_id = u.id AND vc.tenant_id = ${tenantId} AND vc.data_contrato >= ${firstDayOfMonth.toISOString()} AND vc.data_contrato <= ${lastDayOfMonth.toISOString()}), 0)::numeric as prod_geral,
          COALESCE((SELECT SUM(pc.valor_base) FROM producoes_contratos pc WHERE pc.vendedor_id = u.id AND pc.tenant_id = ${tenantId} AND pc.mes_referencia = ${mesRef} AND pc.confirmado = true AND pc.is_cartao = true AND pc.pt_1000 > 0), 0)::numeric
          + COALESCE((SELECT SUM(vc.valor_contrato) FROM vendedor_contratos vc WHERE vc.vendedor_id = u.id AND vc.tenant_id = ${tenantId} AND vc.data_contrato >= ${firstDayOfMonth.toISOString()} AND vc.data_contrato <= ${lastDayOfMonth.toISOString()} AND (LOWER(vc.tipo_operacao) LIKE '%cartão%' OR LOWER(vc.tipo_operacao) LIKE '%cartao%')), 0)::numeric as prod_cartao
        FROM users u
        INNER JOIN user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = ${tenantId}
        WHERE u.role = 'vendedor' AND u.is_active = true
        ORDER BY prod_geral DESC
      `);

      let posicaoRankingGeral = 0;
      let posicaoRankingCartao = 0;
      const totalVendedores = allVendedoresRanking.rows.length;

      const geralSorted = [...allVendedoresRanking.rows].sort((a, b) => parseFloat(b.prod_geral as string) - parseFloat(a.prod_geral as string));
      const cartaoSorted = [...allVendedoresRanking.rows].sort((a, b) => parseFloat(b.prod_cartao as string) - parseFloat(a.prod_cartao as string));

      for (let i = 0; i < geralSorted.length; i++) {
        if (parseInt(geralSorted[i].user_id as string) === userId) {
          posicaoRankingGeral = i + 1;
          break;
        }
      }
      for (let i = 0; i < cartaoSorted.length; i++) {
        if (parseInt(cartaoSorted[i].user_id as string) === userId) {
          posicaoRankingCartao = i + 1;
          break;
        }
      }


      return res.json({
        vendedorNome: user.name,
        metaMensal,
        metaCartao,
        totalValor: Math.round(totalValor * 100) / 100,
        totalCartao: Math.round(totalCartao * 100) / 100,
        totalContratos,
        percentualMeta: Math.round(percentualMeta * 100) / 100,
        projecaoMensal: Math.round(projecaoMensal * 100) / 100,
        metaDiariaOriginal: Math.round(metaDiariaOriginal * 100) / 100,
        metaDiariaAjustada: Math.round(metaDiariaAjustada * 100) / 100,
        mediaAtual: Math.round(mediaAtual * 100) / 100,
        saldoDevedor: Math.round(saldoDevedor * 100) / 100,
        diasUteisNoMes,
        diasUteisAteHoje,
        diasUteisRestantes,
        contratosPorDia: allChartData,
        currentTier,
        nextTier,
        allTiers: PERFORMANCE_TIERS,
        mesAno: `${(month + 1).toString().padStart(2, "0")}/${year}`,
        posicaoRankingGeral,
        posicaoRankingCartao,
        totalVendedores,
      });
    } catch (error) {
      console.error("Error in dashboard-vendedor API:", error);
      return res.status(500).json({ message: "Erro ao carregar dashboard" });
    }
  });

  // ========================
  // Dashboard Gestor API (master/coordenacao)
  // ========================
  app.get("/api/dashboard-gestor", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      const tenantId = req.tenantId!;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "master" && user.role !== "coordenacao")) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const mesRef = `${year}-${String(month + 1).padStart(2, "0")}`;
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);

      const teamsResult = await db.execute(sql`
        SELECT ct.id as team_id, ct.nome_equipe
        FROM commercial_teams ct
        WHERE ct.tenant_id = ${tenantId} AND ct.ativa = true
        ${user.role === "coordenacao" ? sql`AND ct.coordenador_id = ${userId}` : sql``}
      `);

      const teamIds = teamsResult.rows.map((t: any) => parseInt(t.team_id));

      let teamMemberIds: number[] = [];
      if (teamIds.length > 0) {
        const membersResult = await db.execute(sql`
          SELECT DISTINCT ctm.user_id
          FROM commercial_team_members ctm
          WHERE ctm.tenant_id = ${tenantId}
            AND ctm.team_id = ANY(ARRAY[${sql.raw(teamIds.join(','))}]::int[])
            AND ctm.ativo = true
            AND ctm.user_id IS NOT NULL
        `);
        teamMemberIds = membersResult.rows.map((r: any) => parseInt(r.user_id));
      }

      if (user.role === "master" && teamMemberIds.length === 0) {
        const allVendedores = await db.execute(sql`
          SELECT u.id FROM users u
          INNER JOIN user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = ${tenantId}
          WHERE u.role = 'vendedor' AND u.is_active = true
        `);
        teamMemberIds = allVendedores.rows.map((r: any) => parseInt(r.id));
      }

      let metaGeralEquipe = 0;
      let metaCartaoEquipe = 0;
      if (teamIds.length > 0) {
        const metaEquipeResult = await db.execute(sql`
          SELECT COALESCE(SUM(me.meta_geral), 0)::numeric as total_meta_geral,
                 COALESCE(SUM(me.meta_cartao), 0)::numeric as total_meta_cartao
          FROM metas_equipe me
          WHERE me.tenant_id = ${tenantId}
            AND me.equipe_id = ANY(ARRAY[${sql.raw(teamIds.join(','))}]::int[])
            AND me.mes_referencia = ${mesRef}
        `);
        metaGeralEquipe = parseFloat(metaEquipeResult.rows[0]?.total_meta_geral as string) || 0;
        metaCartaoEquipe = parseFloat(metaEquipeResult.rows[0]?.total_meta_cartao as string) || 0;
      }

      const vendedoresData: any[] = [];
      for (const vendedorId of teamMemberIds) {
        const vendedorUser = await storage.getUser(vendedorId);
        if (!vendedorUser) continue;

        const prodResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(valor_base), 0)::numeric as prod_geral,
            COALESCE(SUM(CASE WHEN is_cartao = true THEN valor_base ELSE 0 END), 0)::numeric as prod_cartao,
            COUNT(*)::int as contratos_total,
            COUNT(CASE WHEN is_cartao = true THEN 1 END)::int as contratos_cartao
          FROM producoes_contratos
          WHERE vendedor_id = ${vendedorId}
            AND tenant_id = ${tenantId}
            AND mes_referencia = ${mesRef}
            AND confirmado = true
            AND pt_1000 > 0
        `);

        const vendResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(valor_contrato), 0)::numeric as prod_geral,
            COALESCE(SUM(CASE WHEN LOWER(tipo_operacao) LIKE '%cartão%' OR LOWER(tipo_operacao) LIKE '%cartao%' THEN valor_contrato ELSE 0 END), 0)::numeric as prod_cartao,
            COUNT(*)::int as contratos_total,
            COUNT(CASE WHEN LOWER(tipo_operacao) LIKE '%cartão%' OR LOWER(tipo_operacao) LIKE '%cartao%' THEN 1 END)::int as contratos_cartao
          FROM vendedor_contratos
          WHERE vendedor_id = ${vendedorId}
            AND tenant_id = ${tenantId}
            AND data_contrato >= ${firstDayOfMonth.toISOString()}
            AND data_contrato <= ${lastDayOfMonth.toISOString()}
        `);

        const prodGeral = (parseFloat(prodResult.rows[0]?.prod_geral as string) || 0) + (parseFloat(vendResult.rows[0]?.prod_geral as string) || 0);
        const prodCartao = (parseFloat(prodResult.rows[0]?.prod_cartao as string) || 0) + (parseFloat(vendResult.rows[0]?.prod_cartao as string) || 0);
        const contratosTotal = (parseInt(prodResult.rows[0]?.contratos_total as string) || 0) + (parseInt(vendResult.rows[0]?.contratos_total as string) || 0);
        const contratosCartao = (parseInt(prodResult.rows[0]?.contratos_cartao as string) || 0) + (parseInt(vendResult.rows[0]?.contratos_cartao as string) || 0);

        const metaIndResult = await db.execute(sql`
          SELECT mi.meta_geral, mi.meta_cartao
          FROM metas_individuais mi
          WHERE mi.usuario_id = ${vendedorId} AND mi.tenant_id = ${tenantId} AND mi.mes_referencia = ${mesRef}
          LIMIT 1
        `);
        let metaIndGeral = 0;
        let metaIndCartao = 0;
        if (metaIndResult.rows.length > 0) {
          metaIndGeral = parseFloat(metaIndResult.rows[0].meta_geral as string) || 0;
          metaIndCartao = parseFloat(metaIndResult.rows[0].meta_cartao as string) || 0;
        } else {
          metaIndGeral = vendedorUser.metaMensal ? parseFloat(vendedorUser.metaMensal as string) : 0;
        }

        vendedoresData.push({
          userId: vendedorId,
          nome: vendedorUser.name,
          foto: vendedorUser.avatarUrl || null,
          producaoGeral: Math.round(prodGeral * 100) / 100,
          producaoCartao: Math.round(prodCartao * 100) / 100,
          contratos: contratosTotal,
          contratosCartao: contratosCartao,
          metaGeral: metaIndGeral,
          metaCartao: metaIndCartao,
          percentualMeta: metaIndGeral > 0 ? Math.round((prodGeral / metaIndGeral) * 100) : 0,
          percentualMetaCartao: metaIndCartao > 0 ? Math.round((prodCartao / metaIndCartao) * 100) : 0,
        });
      }

      const totalProduzidoGeral = vendedoresData.reduce((s, v) => s + v.producaoGeral, 0);
      const totalProduzidoCartao = vendedoresData.reduce((s, v) => s + v.producaoCartao, 0);

      const rankingGeral = [...vendedoresData].sort((a, b) => b.producaoGeral - a.producaoGeral).map((v, i) => ({ ...v, posicao: i + 1 }));
      const rankingCartao = [...vendedoresData].sort((a, b) => b.producaoCartao - a.producaoCartao).map((v, i) => ({ ...v, posicao: i + 1 }));

      return res.json({
        equipe: {
          metaGeral: metaGeralEquipe,
          metaCartao: metaCartaoEquipe,
          totalProduzidoGeral: Math.round(totalProduzidoGeral * 100) / 100,
          totalProduzidoCartao: Math.round(totalProduzidoCartao * 100) / 100,
          percentualGeral: metaGeralEquipe > 0 ? Math.round((totalProduzidoGeral / metaGeralEquipe) * 100) : 0,
          percentualCartao: metaCartaoEquipe > 0 ? Math.round((totalProduzidoCartao / metaCartaoEquipe) * 100) : 0,
        },
        rankingGeral,
        rankingCartao,
        mesAno: `${(month + 1).toString().padStart(2, "0")}/${year}`,
      });
    } catch (error) {
      console.error("Error in dashboard-gestor API:", error);
      return res.status(500).json({ message: "Erro ao carregar dashboard do gestor" });
    }
  });

  // ========================
  // Relatórios — Histórico de Produção
  // ========================
  app.get("/api/relatorios/historico-producao", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      const tenantId = req.tenantId!;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "master" && user.role !== "coordenacao")) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const mes = (req.query.mes as string) || (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      })();
      const visao = (req.query.visao as string) || "empresa";
      const equipeIdParam = req.query.equipeId ? parseInt(req.query.equipeId as string) : null;

      const [yearStr, monthStr] = mes.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr) - 1;
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const mesRef = mes;

      const teamsResult = await db.execute(sql`
        SELECT ct.id as team_id, ct.nome_equipe
        FROM commercial_teams ct
        WHERE ct.tenant_id = ${tenantId} AND ct.ativa = true
        ${user.role === "coordenacao" ? sql`AND ct.coordenador_id = ${userId}` : sql``}
      `);
      const allTeams = teamsResult.rows.map((t: any) => ({ id: parseInt(t.team_id), nome: t.nome_equipe }));

      let teamIds: number[] = [];
      if (visao === "equipe" && equipeIdParam) {
        const validTeam = allTeams.find(t => t.id === equipeIdParam);
        if (validTeam) teamIds = [equipeIdParam];
        else teamIds = allTeams.map(t => t.id);
      } else {
        teamIds = allTeams.map(t => t.id);
      }

      let teamMemberIds: number[] = [];
      if (teamIds.length > 0) {
        const membersResult = await db.execute(sql`
          SELECT DISTINCT ctm.user_id
          FROM commercial_team_members ctm
          WHERE ctm.tenant_id = ${tenantId}
            AND ctm.team_id = ANY(ARRAY[${sql.raw(teamIds.join(','))}]::int[])
            AND ctm.ativo = true
            AND ctm.user_id IS NOT NULL
        `);
        teamMemberIds = membersResult.rows.map((r: any) => parseInt(r.user_id));
      }

      if (user.role === "master" && teamMemberIds.length === 0) {
        const allVendedores = await db.execute(sql`
          SELECT u.id FROM users u
          INNER JOIN user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = ${tenantId}
          WHERE u.role = 'vendedor' AND u.is_active = true
        `);
        teamMemberIds = allVendedores.rows.map((r: any) => parseInt(r.id));
      }

      let metaGeralEquipe = 0;
      let metaCartaoEquipe = 0;
      if (teamIds.length > 0) {
        const metaEquipeResult = await db.execute(sql`
          SELECT COALESCE(SUM(me.meta_geral), 0)::numeric as total_meta_geral,
                 COALESCE(SUM(me.meta_cartao), 0)::numeric as total_meta_cartao
          FROM metas_equipe me
          WHERE me.tenant_id = ${tenantId}
            AND me.equipe_id = ANY(ARRAY[${sql.raw(teamIds.join(','))}]::int[])
            AND me.mes_referencia = ${mesRef}
        `);
        metaGeralEquipe = parseFloat(metaEquipeResult.rows[0]?.total_meta_geral as string) || 0;
        metaCartaoEquipe = parseFloat(metaEquipeResult.rows[0]?.total_meta_cartao as string) || 0;
      }

      const vendedoresData: any[] = [];
      for (const vendedorId of teamMemberIds) {
        const vendedorUser = await storage.getUser(vendedorId);
        if (!vendedorUser) continue;

        const prodResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(valor_base), 0)::numeric as prod_geral,
            COALESCE(SUM(CASE WHEN is_cartao = true THEN valor_base ELSE 0 END), 0)::numeric as prod_cartao,
            COUNT(*)::int as contratos_total,
            COUNT(CASE WHEN is_cartao = true THEN 1 END)::int as contratos_cartao
          FROM producoes_contratos
          WHERE vendedor_id = ${vendedorId}
            AND tenant_id = ${tenantId}
            AND mes_referencia = ${mesRef}
            AND confirmado = true
            AND pt_1000 > 0
        `);

        const vendResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(valor_contrato), 0)::numeric as prod_geral,
            COALESCE(SUM(CASE WHEN LOWER(tipo_operacao) LIKE '%cartão%' OR LOWER(tipo_operacao) LIKE '%cartao%' THEN valor_contrato ELSE 0 END), 0)::numeric as prod_cartao,
            COUNT(*)::int as contratos_total,
            COUNT(CASE WHEN LOWER(tipo_operacao) LIKE '%cartão%' OR LOWER(tipo_operacao) LIKE '%cartao%' THEN 1 END)::int as contratos_cartao
          FROM vendedor_contratos
          WHERE vendedor_id = ${vendedorId}
            AND tenant_id = ${tenantId}
            AND data_contrato >= ${firstDayOfMonth.toISOString()}
            AND data_contrato <= ${lastDayOfMonth.toISOString()}
        `);

        const prodGeral = (parseFloat(prodResult.rows[0]?.prod_geral as string) || 0) + (parseFloat(vendResult.rows[0]?.prod_geral as string) || 0);
        const prodCartao = (parseFloat(prodResult.rows[0]?.prod_cartao as string) || 0) + (parseFloat(vendResult.rows[0]?.prod_cartao as string) || 0);
        const contratosTotal = (parseInt(prodResult.rows[0]?.contratos_total as string) || 0) + (parseInt(vendResult.rows[0]?.contratos_total as string) || 0);
        const contratosCartao = (parseInt(prodResult.rows[0]?.contratos_cartao as string) || 0) + (parseInt(vendResult.rows[0]?.contratos_cartao as string) || 0);

        const metaIndResult = await db.execute(sql`
          SELECT mi.meta_geral, mi.meta_cartao
          FROM metas_individuais mi
          WHERE mi.usuario_id = ${vendedorId} AND mi.tenant_id = ${tenantId} AND mi.mes_referencia = ${mesRef}
          LIMIT 1
        `);
        let metaIndGeral = 0;
        let metaIndCartao = 0;
        if (metaIndResult.rows.length > 0) {
          metaIndGeral = parseFloat(metaIndResult.rows[0].meta_geral as string) || 0;
          metaIndCartao = parseFloat(metaIndResult.rows[0].meta_cartao as string) || 0;
        }

        vendedoresData.push({
          userId: vendedorId,
          nome: vendedorUser.name,
          foto: vendedorUser.avatarUrl || null,
          producaoGeral: Math.round(prodGeral * 100) / 100,
          producaoCartao: Math.round(prodCartao * 100) / 100,
          contratos: contratosTotal,
          contratosCartao: contratosCartao,
          metaGeral: metaIndGeral,
          metaCartao: metaIndCartao,
          percentualMeta: metaIndGeral > 0 ? Math.round((prodGeral / metaIndGeral) * 100) : 0,
          percentualMetaCartao: metaIndCartao > 0 ? Math.round((prodCartao / metaIndCartao) * 100) : 0,
        });
      }

      const totalProduzidoGeral = vendedoresData.reduce((s, v) => s + v.producaoGeral, 0);
      const totalProduzidoCartao = vendedoresData.reduce((s, v) => s + v.producaoCartao, 0);

      const rankingGeral = [...vendedoresData].sort((a, b) => b.producaoGeral - a.producaoGeral).map((v, i) => ({ ...v, posicao: i + 1 }));
      const rankingCartao = [...vendedoresData].sort((a, b) => b.producaoCartao - a.producaoCartao).map((v, i) => ({ ...v, posicao: i + 1 }));

      return res.json({
        equipe: {
          metaGeral: metaGeralEquipe,
          metaCartao: metaCartaoEquipe,
          totalProduzidoGeral: Math.round(totalProduzidoGeral * 100) / 100,
          totalProduzidoCartao: Math.round(totalProduzidoCartao * 100) / 100,
          percentualGeral: metaGeralEquipe > 0 ? Math.round((totalProduzidoGeral / metaGeralEquipe) * 100) : 0,
          percentualCartao: metaCartaoEquipe > 0 ? Math.round((totalProduzidoCartao / metaCartaoEquipe) * 100) : 0,
        },
        rankingGeral,
        rankingCartao,
        mesAno: `${(month + 1).toString().padStart(2, "0")}/${year}`,
        equipes: allTeams,
        visao,
      });
    } catch (error) {
      console.error("Error in historico-producao API:", error);
      return res.status(500).json({ message: "Erro ao carregar histórico de produção" });
    }
  });

  // ========================
  // Relatórios — Dia a Dia
  // ========================
  app.get("/api/relatorios/dia-a-dia", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      const tenantId = req.tenantId!;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "master" && user.role !== "coordenacao")) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const defaultDe = new Date(now);
      defaultDe.setDate(now.getDate() + mondayOffset);
      const defaultAte = new Date(defaultDe);
      defaultAte.setDate(defaultDe.getDate() + 4);

      const de = (req.query.de as string) || defaultDe.toISOString().split("T")[0];
      const ate = (req.query.ate as string) || defaultAte.toISOString().split("T")[0];
      const equipeIdParam = req.query.equipeId ? parseInt(req.query.equipeId as string) : null;

      const dateFrom = new Date(de + "T00:00:00.000Z");
      const dateTo = new Date(ate + "T23:59:59.999Z");
      const mesRef = `${dateFrom.getFullYear()}-${String(dateFrom.getMonth() + 1).padStart(2, "0")}`;

      const teamsResult = await db.execute(sql`
        SELECT ct.id as team_id, ct.nome_equipe
        FROM commercial_teams ct
        WHERE ct.tenant_id = ${tenantId} AND ct.ativa = true
        ${user.role === "coordenacao" ? sql`AND ct.coordenador_id = ${userId}` : sql``}
      `);
      const allTeams = teamsResult.rows.map((t: any) => ({ id: parseInt(t.team_id), nome: t.nome_equipe }));

      let teamIds: number[] = [];
      if (equipeIdParam) {
        const validTeam = allTeams.find(t => t.id === equipeIdParam);
        if (validTeam) teamIds = [equipeIdParam];
        else teamIds = allTeams.map(t => t.id);
      } else {
        teamIds = allTeams.map(t => t.id);
      }

      let teamMemberIds: number[] = [];
      if (teamIds.length > 0) {
        const membersResult = await db.execute(sql`
          SELECT DISTINCT ctm.user_id
          FROM commercial_team_members ctm
          WHERE ctm.tenant_id = ${tenantId}
            AND ctm.team_id = ANY(ARRAY[${sql.raw(teamIds.join(','))}]::int[])
            AND ctm.ativo = true
            AND ctm.user_id IS NOT NULL
        `);
        teamMemberIds = membersResult.rows.map((r: any) => parseInt(r.user_id));
      }

      if (user.role === "master" && teamMemberIds.length === 0) {
        const allVendedores = await db.execute(sql`
          SELECT u.id FROM users u
          INNER JOIN user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = ${tenantId}
          WHERE u.role = 'vendedor' AND u.is_active = true
        `);
        teamMemberIds = allVendedores.rows.map((r: any) => parseInt(r.id));
      }

      const calcDiasUteisRange = (start: Date, end: Date) => {
        let count = 0;
        const cur = new Date(start);
        while (cur <= end) {
          const d = cur.getDay();
          if (d !== 0 && d !== 6) count++;
          cur.setDate(cur.getDate() + 1);
        }
        return count;
      };
      const diasUteis = calcDiasUteisRange(dateFrom, dateTo);
      const horasTrabalhadas = diasUteis * 8;

      const corretoresData: any[] = [];
      for (const vendedorId of teamMemberIds) {
        const vendedorUser = await storage.getUser(vendedorId);
        if (!vendedorUser) continue;

        const atendidosResult = await db.execute(sql`
          SELECT COUNT(DISTINCT lead_id)::int as total
          FROM sales_lead_assignments
          WHERE user_id = ${vendedorId}
            AND status != 'pendente'
            AND (
              (data_primeiro_atendimento >= ${dateFrom.toISOString()} AND data_primeiro_atendimento <= ${dateTo.toISOString()})
              OR (data_ultimo_atendimento >= ${dateFrom.toISOString()} AND data_ultimo_atendimento <= ${dateTo.toISOString()})
            )
        `);
        const clientesAtendidos = parseInt(atendidosResult.rows[0]?.total as string) || 0;

        const interacoesResult = await db.execute(sql`
          SELECT COUNT(DISTINCT lead_id)::int as clientes_consultados
          FROM lead_interactions
          WHERE user_id = ${vendedorId}
            AND (tenant_id = ${tenantId} OR tenant_id IS NULL)
            AND created_at >= ${dateFrom.toISOString()}
            AND created_at <= ${dateTo.toISOString()}
        `);
        const clientesConsultados = parseInt(interacoesResult.rows[0]?.clientes_consultados as string) || 0;

        const etiquetasResult = await db.execute(sql`
          SELECT COUNT(*)::int as total
          FROM lead_tag_assignments lta
          INNER JOIN lead_tags lt ON lt.id = lta.tag_id AND (lt.tenant_id = ${tenantId} OR lt.tenant_id IS NULL)
          WHERE lta.assigned_by = ${vendedorId}
            AND lta.created_at >= ${dateFrom.toISOString()}
            AND lta.created_at <= ${dateTo.toISOString()}
        `);
        const clientesEtiquetados = parseInt(etiquetasResult.rows[0]?.total as string) || 0;

        const pipelineResult = await db.execute(sql`
          SELECT COUNT(DISTINCT lead_id)::int as total
          FROM lead_interactions
          WHERE user_id = ${vendedorId}
            AND (tenant_id = ${tenantId} OR tenant_id IS NULL)
            AND lead_marker IS NOT NULL
            AND lead_marker != ''
            AND lead_marker NOT IN ('NOVO', 'EM_ATENDIMENTO')
            AND created_at >= ${dateFrom.toISOString()}
            AND created_at <= ${dateTo.toISOString()}
        `);
        const clientesPipeline = parseInt(pipelineResult.rows[0]?.total as string) || 0;

        const markersResult = await db.execute(sql`
          SELECT lead_marker, COUNT(*)::int as total
          FROM lead_interactions
          WHERE user_id = ${vendedorId}
            AND (tenant_id = ${tenantId} OR tenant_id IS NULL)
            AND lead_marker IS NOT NULL
            AND lead_marker != ''
            AND created_at >= ${dateFrom.toISOString()}
            AND created_at <= ${dateTo.toISOString()}
          GROUP BY lead_marker
        `);
        const markers: Record<string, number> = {};
        for (const row of markersResult.rows as any[]) {
          markers[row.lead_marker] = parseInt(row.total) || 0;
        }

        const prodResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(valor_base), 0)::numeric as producao,
            COUNT(*)::int as contratos
          FROM producoes_contratos
          WHERE vendedor_id = ${vendedorId}
            AND tenant_id = ${tenantId}
            AND confirmado = true
            AND pt_1000 > 0
            AND created_at >= ${dateFrom.toISOString()}
            AND created_at <= ${dateTo.toISOString()}
        `);

        const vendResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(valor_contrato), 0)::numeric as producao,
            COUNT(*)::int as contratos
          FROM vendedor_contratos
          WHERE vendedor_id = ${vendedorId}
            AND tenant_id = ${tenantId}
            AND data_contrato >= ${dateFrom.toISOString()}
            AND data_contrato <= ${dateTo.toISOString()}
        `);

        const producao = (parseFloat(prodResult.rows[0]?.producao as string) || 0) + (parseFloat(vendResult.rows[0]?.producao as string) || 0);
        const contratos = (parseInt(prodResult.rows[0]?.contratos as string) || 0) + (parseInt(vendResult.rows[0]?.contratos as string) || 0);

        corretoresData.push({
          userId: vendedorId,
          nome: vendedorUser.name,
          clientesAtendidos,
          clientesConsultados,
          clientesEtiquetados,
          clientesPipeline,
          markers,
          producao: Math.round(producao * 100) / 100,
          contratos,
          diasUteis,
          horasTrabalhadas,
          clientesPorDia: diasUteis > 0 ? Math.round((clientesConsultados / diasUteis) * 10) / 10 : 0,
          clientesPorHora: horasTrabalhadas > 0 ? Math.round((clientesConsultados / horasTrabalhadas) * 10) / 10 : 0,
        });
      }

      corretoresData.sort((a, b) => b.clientesConsultados - a.clientesConsultados);

      return res.json({
        corretores: corretoresData,
        periodo: { de, ate },
        diasUteis,
        horasTrabalhadas,
        equipes: allTeams,
      });
    } catch (error) {
      console.error("Error in dia-a-dia API:", error);
      return res.status(500).json({ message: "Erro ao carregar relatório dia a dia" });
    }
  });

  // ========================
  // Performance API (Níveis Individuais)
  // ========================

  app.get(
    "/api/performance/:vendedorId",
    requireAuth,
    async (req: any, res) => {
      try {
        const vendedorId = parseInt(req.params.vendedorId);
        const tenantId = req.tenantId || req.session?.tenantId;

        if (!tenantId || isNaN(vendedorId)) {
          return res.status(400).json({ message: "Parâmetros inválidos" });
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const mesRef = `${year}-${String(month + 1).padStart(2, "0")}`;
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const niveisResult = await db.execute(sql`
        SELECT * FROM meta_niveis 
        WHERE tenant_id = ${tenantId}
        ORDER BY categoria, ordem ASC
      `);

        const niveisPorCategoria: Record<string, any[]> = {};
        for (const row of niveisResult.rows) {
          const cat = row.categoria as string;
          if (!niveisPorCategoria[cat]) niveisPorCategoria[cat] = [];
          niveisPorCategoria[cat].push(row);
        }

        // Sum production from vendedor_contratos
        const totalGeralVCResult = await db.execute(sql`
        SELECT COALESCE(SUM(valor_contrato), 0)::numeric as total
        FROM vendedor_contratos
        WHERE vendedor_id = ${vendedorId}
          AND tenant_id = ${tenantId}
          AND data_contrato >= ${firstDayOfMonth.toISOString()}
          AND data_contrato <= ${lastDayOfMonth.toISOString()}
      `);

        const totalCartaoVCResult = await db.execute(sql`
        SELECT COALESCE(SUM(valor_contrato), 0)::numeric as total
        FROM vendedor_contratos
        WHERE vendedor_id = ${vendedorId}
          AND tenant_id = ${tenantId}
          AND data_contrato >= ${firstDayOfMonth.toISOString()}
          AND data_contrato <= ${lastDayOfMonth.toISOString()}
          AND (LOWER(tipo_operacao) LIKE '%cartão%' OR LOWER(tipo_operacao) LIKE '%cartao%')
      `);

        // Sum production from producoes_contratos (imported paid production) - R$ values
        const totalGeralPCResult = await db.execute(sql`
        SELECT 
          COALESCE(SUM(valor_base), 0)::numeric as total,
          COALESCE(SUM(CASE WHEN is_cartao = true THEN valor_base ELSE 0 END), 0)::numeric as total_cartao
        FROM producoes_contratos
        WHERE vendedor_id = ${vendedorId}
          AND tenant_id = ${tenantId}
          AND mes_referencia = ${mesRef}
          AND confirmado = true
          AND pt_1000 > 0
      `);

        // Sum points from producoes_contratos for level calculation
        const totalPontosPCResult = await db.execute(sql`
        SELECT 
          COALESCE(SUM(pontos_geral), 0)::numeric as pontos_geral,
          COALESCE(SUM(pontos_cartao), 0)::numeric as pontos_cartao
        FROM producoes_contratos
        WHERE vendedor_id = ${vendedorId}
          AND tenant_id = ${tenantId}
          AND mes_referencia = ${mesRef}
          AND confirmado = true
      `);

        const produzidoGeral =
          (parseFloat(totalGeralVCResult.rows[0]?.total as string) || 0) +
          (parseFloat(totalGeralPCResult.rows[0]?.total as string) || 0);
        const produzidoCartao =
          (parseFloat(totalCartaoVCResult.rows[0]?.total as string) || 0) +
          (parseFloat(totalGeralPCResult.rows[0]?.total_cartao as string) || 0);

        // Points for level calculation
        const pontosGeral =
          parseFloat(totalPontosPCResult.rows[0]?.pontos_geral as string) || 0;
        const pontosCartao =
          parseFloat(totalPontosPCResult.rows[0]?.pontos_cartao as string) || 0;

        function calcularNivel(pontos: number, niveis: any[]) {
          let nivelAtual = null;
          let proximoNivel = null;

          const sorted = [...niveis].sort(
            (a, b) => parseInt(a.ordem) - parseInt(b.ordem),
          );

          for (let i = 0; i < sorted.length; i++) {
            const nivel = sorted[i];
            const min = parseFloat(nivel.pontos_minimos);
            const max = nivel.pontos_maximos
              ? parseFloat(nivel.pontos_maximos)
              : Infinity;

            if (pontos >= min && pontos <= max) {
              nivelAtual = nivel;
              proximoNivel = sorted[i + 1] || null;
              break;
            }
          }

          if (!nivelAtual && sorted.length > 0) {
            const lastNivel = sorted[sorted.length - 1];
            if (pontos >= parseFloat(lastNivel.pontos_minimos)) {
              nivelAtual = lastNivel;
              proximoNivel = null;
            } else {
              proximoNivel = sorted[0];
            }
          }

          let faltaParaProximo = 0;
          let progressoNivel = 0;

          if (nivelAtual && proximoNivel) {
            faltaParaProximo = Math.max(
              0,
              parseFloat(proximoNivel.pontos_minimos) - pontos,
            );
            const min = parseFloat(nivelAtual.pontos_minimos);
            const max = nivelAtual.pontos_maximos
              ? parseFloat(nivelAtual.pontos_maximos)
              : parseFloat(proximoNivel.pontos_minimos);
            const range = max - min;
            progressoNivel =
              range > 0 ? Math.min(100, ((pontos - min) / range) * 100) : 100;
          } else if (nivelAtual && !proximoNivel) {
            progressoNivel = 100;
          } else if (!nivelAtual && proximoNivel) {
            faltaParaProximo = Math.max(
              0,
              parseFloat(proximoNivel.pontos_minimos) - pontos,
            );
            const targetMin = parseFloat(proximoNivel.pontos_minimos);
            progressoNivel =
              targetMin > 0 ? Math.min(100, (pontos / targetMin) * 100) : 0;
          }

          const formatNivel = (n: any) => ({
            nome: n.nome_nivel,
            ordem: parseInt(n.ordem),
            cor: n.cor,
            icone: n.icone,
            premio: parseFloat(n.premio),
            pontosMinimos: parseFloat(n.pontos_minimos),
            pontosMaximos: n.pontos_maximos
              ? parseFloat(n.pontos_maximos)
              : null,
          });

          return {
            nivelAtual: nivelAtual ? formatNivel(nivelAtual) : null,
            proximoNivel: proximoNivel
              ? {
                  nome: proximoNivel.nome_nivel,
                  ordem: parseInt(proximoNivel.ordem),
                  cor: proximoNivel.cor,
                  icone: proximoNivel.icone,
                  premio: parseFloat(proximoNivel.premio),
                  pontosMinimos: parseFloat(proximoNivel.pontos_minimos),
                }
              : null,
            faltaParaProximo: Math.round(faltaParaProximo * 100) / 100,
            progressoNivel: Math.round(progressoNivel * 100) / 100,
            todosNiveis: sorted.map(formatNivel),
          };
        }

        // Pull meta from metas_individuais (priority) or fallback to user.metaMensal
        let metaMensal = 0;
        let metaCartaoInd = 0;
        const metaIndResult = await db.execute(sql`
        SELECT mi.meta_geral, mi.meta_cartao 
        FROM metas_individuais mi
        WHERE mi.usuario_id = ${vendedorId} AND mi.tenant_id = ${tenantId} AND mi.mes_referencia = ${mesRef}
        LIMIT 1
      `);
        if (metaIndResult.rows.length > 0) {
          metaMensal =
            parseFloat(metaIndResult.rows[0].meta_geral as string) || 0;
          metaCartaoInd =
            parseFloat(metaIndResult.rows[0].meta_cartao as string) || 0;
        } else {
          const user = await storage.getUser(vendedorId);
          metaMensal = user?.metaMensal
            ? parseFloat(user.metaMensal as string)
            : 0;
        }

        const geralNiveis = niveisPorCategoria["GERAL"] || [];
        const cartaoNiveis = niveisPorCategoria["CARTAO"] || [];

        const geralPerf = calcularNivel(pontosGeral, geralNiveis);
        const cartaoPerf = calcularNivel(pontosCartao, cartaoNiveis);

        return res.json({
          geral: {
            produzido: Math.round(produzidoGeral * 100) / 100,
            pontos: Math.round(pontosGeral * 100) / 100,
            meta: metaMensal,
            percentual:
              metaMensal > 0
                ? Math.round((produzidoGeral / metaMensal) * 10000) / 100
                : 0,
            ...geralPerf,
            todosNiveis: geralNiveis.map((n: any) => ({
              nome: n.nome_nivel,
              ordem: parseInt(n.ordem),
              cor: n.cor,
              icone: n.icone,
              premio: parseFloat(n.premio),
              pontosMinimos: parseFloat(n.pontos_minimos),
              pontosMaximos: n.pontos_maximos
                ? parseFloat(n.pontos_maximos)
                : null,
            })),
          },
          cartao: {
            produzido: Math.round(produzidoCartao * 100) / 100,
            pontos: Math.round(pontosCartao * 100) / 100,
            meta: metaCartaoInd,
            percentual:
              metaCartaoInd > 0
                ? Math.round((produzidoCartao / metaCartaoInd) * 10000) / 100
                : 0,
            ...cartaoPerf,
            todosNiveis: cartaoNiveis.map((n: any) => ({
              nome: n.nome_nivel,
              ordem: parseInt(n.ordem),
              cor: n.cor,
              icone: n.icone,
              premio: parseFloat(n.premio),
              pontosMinimos: parseFloat(n.pontos_minimos),
              pontosMaximos: n.pontos_maximos
                ? parseFloat(n.pontos_maximos)
                : null,
            })),
          },
        });
      } catch (error) {
        console.error("Error in performance API:", error);
        return res
          .status(500)
          .json({ message: "Erro ao carregar performance" });
      }
    },
  );

  // ==========================================
  // Gestão Comercial - Importar Produção
  // ==========================================

  app.post(
    "/api/gestao-comercial/importar/preview",
    requireAuth,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const userRole = req.user?.role;
        const isMaster = req.user?.isMaster;
        if (!isMaster && userRole !== "master" && userRole !== "coordenacao") {
          return res
            .status(403)
            .json({ message: "Sem permissão para importar produção" });
        }

        if (!req.file) {
          return res.status(400).json({ message: "Nenhum arquivo enviado" });
        }

        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows.length) {
          return res.status(400).json({ message: "Planilha vazia" });
        }

        const firstRow = rows[0];
        const hasContratoId = "ContratoId" in firstRow;
        if (!hasContratoId) {
          return res.status(400).json({
            message: "Coluna 'ContratoId' não encontrada na planilha",
          });
        }

        let totalImportado = 0;
        let totalPagoValido = 0;
        let totalValorGeral = 0;
        let totalValorCartao = 0;
        let totalIgnorados = 0;

        const contratos: any[] = [];
        const ignorados: any[] = [];

        for (const row of rows) {
          totalImportado++;

          const contratoId = String(row.ContratoId || "").trim();
          if (!contratoId) {
            totalIgnorados++;
            ignorados.push({
              linha: totalImportado + 1,
              contratoId: "(vazio)",
              nomeCliente: String(row.NomeCliente || "").trim(),
              motivo: "ContratoId vazio ou ausente",
            });
            continue;
          }

          const statusProposta = String(
            row.StatusBancoCliente || row.StatusProposta || "",
          )
            .trim()
            .toUpperCase();
          const tipoContrato = String(row.TipoContrato || "").trim();
          const tipoLower = tipoContrato.toLowerCase();
          const isCartao = tipoLower.includes("cart") || tipoLower.includes("saque complementar");
          const valorBase =
            parseFloat(String(row.ValorBase || "0").replace(",", ".")) || 0;

          const dataPagamentoRaw = String(
            row.DataStatusBancoCliente || row.DataPagamento || "",
          ).trim();

          let mesReferencia = "";
          let dataPagamento = dataPagamentoRaw;

          if (dataPagamentoRaw) {
            const parts = dataPagamentoRaw.split("/");
            if (parts.length === 3) {
              mesReferencia = `${parts[2]}-${parts[1].padStart(2, "0")}`;
            }
          }

          const isPago = statusProposta === "PAGO AO CLIENTE";

          const valorBruto =
            parseFloat(String(row.ValorBruto || "0").replace(",", ".")) || 0;
          const valorLiquido =
            parseFloat(String(row.ValorLiquido || "0").replace(",", ".")) || 0;
          const comissaoRepasseValor =
            parseFloat(
              String(row.ComissaoRepasseValor || "0").replace(",", "."),
            ) || 0;
          const comissaoRepassePerc =
            parseFloat(
              String(row.ComissaoRepassePercentual || "0").replace(",", "."),
            ) || 0;
          const pt1000Raw = String(
            row["pt.1000"] ||
              row["Pt.1000"] ||
              row["PT.1000"] ||
              row.Pt1000 ||
              row.pt1000 ||
              "0",
          );
          const pt1000 =
            parseFloat(pt1000Raw.replace(/[^\d.,]/g, "").replace(",", ".")) ||
            0;

          const phoneKey = Object.keys(row).find((k) =>
            /telefone|celular|fone|tel/i.test(k.trim()),
          );
          if (totalImportado === 1) {
            console.log("[IMPORT] Keys da primeira linha:", Object.keys(row));
            console.log("[IMPORT] Telefone key encontrado:", phoneKey ?? "(nenhum)");
          }
          const telefoneCliente = phoneKey
            ? String(row[phoneKey] || "").trim().slice(0, 30) || null
            : null;

          const contrato = {
            contratoId,
            nomeCliente: String(row.NomeCliente || "").trim(),
            cpfCliente: String(row.CpfCliente || "").trim(),
            banco: String(row.Banco || "").trim(),
            tipoContrato,
            convenio: String(row.Convenio || "").trim(),
            prazo: String(row.Prazo || "").trim(),
            nomeCorretor: String(row.NomeCorretor || "").trim(),
            codigoCorretor: String(row.CodigoCorretor || "").trim(),
            grupoVendedor: String(row.NomeGrupoVendedor || "").trim(),
            filial: String(row.Filial || "").trim(),
            status: statusProposta,
            dataPagamento,
            valorBase,
            valorBruto,
            valorLiquido,
            comissaoRepasseValor,
            comissaoRepassePerc,
            isCartao,
            mesReferencia,
            pt1000,
            telefoneCliente,
          };

          contratos.push(contrato);

          if (isPago && dataPagamentoRaw) {
            totalPagoValido++;
            if (pt1000 > 0) {
              totalValorGeral += valorBase;
              if (isCartao) {
                totalValorCartao += valorBase;
              }
            }
          } else {
            totalIgnorados++;
            const motivos: string[] = [];
            if (!isPago) {
              motivos.push(
                `Status "${statusProposta || "(vazio)"}" — somente "PAGO AO CLIENTE" é aceito`,
              );
            }
            if (!dataPagamentoRaw) {
              motivos.push("Data de pagamento ausente");
            }
            if (valorBase <= 0) {
              motivos.push("Valor base zerado ou inválido");
            }
            ignorados.push({
              linha: totalImportado + 1,
              contratoId,
              nomeCliente: contrato.nomeCliente,
              cpfCliente: contrato.cpfCliente,
              banco: contrato.banco,
              status: statusProposta,
              dataPagamento: dataPagamentoRaw || "(vazia)",
              valorBase,
              motivo: motivos.join("; "),
            });
          }
        }

        res.json({
          resumo: {
            totalImportado,
            totalPagoValido,
            totalValorGeral: Math.round(totalValorGeral * 100) / 100,
            totalValorCartao: Math.round(totalValorCartao * 100) / 100,
            totalIgnorados,
          },
          contratos,
          ignorados,
        });
      } catch (error: any) {
        console.error("[IMPORT-PRODUCAO] Preview error:", error);
        res.status(500).json({
          message:
            "Erro ao processar planilha: " +
            (error.message || "Erro desconhecido"),
        });
      }
    },
  );

  app.get(
    "/api/gestao-comercial/vendedores",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId)
          return res.status(400).json({ message: "Tenant não identificado" });

        const tenantUsers = await db
          .select({
            id: users.id,
            name: users.name,
            role: users.role,
            isActive: users.isActive,
          })
          .from(users)
          .innerJoin(userTenants, eq(users.id, userTenants.userId))
          .where(
            and(eq(userTenants.tenantId, tenantId), eq(users.isActive, true)),
          )
          .orderBy(asc(users.name));

        res.json(tenantUsers);
      } catch (error: any) {
        console.error("[VENDEDORES] Error:", error);
        res.status(500).json({ message: "Erro ao buscar vendedores" });
      }
    },
  );

  app.get(
    "/api/gestao-comercial/importacoes",
    requireAuth,
    async (req: any, res) => {
      try {
        const userRole = req.user?.role;
        const isMaster = req.user?.isMaster;
        if (!isMaster && userRole !== "master" && userRole !== "coordenacao") {
          return res.status(403).json({ message: "Sem permissão" });
        }

        const tenantId = req.tenantId;
        if (!tenantId)
          return res.status(400).json({ message: "Tenant não identificado" });

        const importacoes = await db
          .select()
          .from(producoesImportacoes)
          .where(eq(producoesImportacoes.tenantId, tenantId))
          .orderBy(desc(producoesImportacoes.createdAt));

        res.json(importacoes);
      } catch (error: any) {
        console.error("[IMPORTACOES] Error:", error);
        res
          .status(500)
          .json({ message: "Erro ao buscar histórico de importações" });
      }
    },
  );

  app.get(
    "/api/gestao-comercial/importacoes/:id",
    requireAuth,
    async (req: any, res) => {
      try {
        const userRole = req.user?.role;
        const isMaster = req.user?.isMaster;
        if (!isMaster && userRole !== "master" && userRole !== "coordenacao") {
          return res.status(403).json({ message: "Sem permissão" });
        }

        const tenantId = req.tenantId;
        if (!tenantId)
          return res.status(400).json({ message: "Tenant não identificado" });

        const importacaoId = parseInt(req.params.id);
        const [importacao] = await db
          .select()
          .from(producoesImportacoes)
          .where(
            and(
              eq(producoesImportacoes.id, importacaoId),
              eq(producoesImportacoes.tenantId, tenantId),
            ),
          )
          .limit(1);

        if (!importacao) {
          return res.status(404).json({ message: "Importação não encontrada" });
        }

        const contratosResult = await db
          .select()
          .from(producoesContratos)
          .where(
            and(
              eq(producoesContratos.importacaoId, importacaoId),
              eq(producoesContratos.tenantId, tenantId),
            ),
          )
          .orderBy(asc(producoesContratos.nomeCorretor));

        res.json({ importacao, contratos: contratosResult });
      } catch (error: any) {
        console.error("[IMPORTACAO-DETAIL] Error:", error);
        res
          .status(500)
          .json({ message: "Erro ao buscar detalhes da importação" });
      }
    },
  );

  app.post(
    "/api/gestao-comercial/importar/confirmar",
    requireAuth,
    async (req: any, res) => {
      try {
        const userRole = req.user?.role;
        const isMaster = req.user?.isMaster;
        if (!isMaster && userRole !== "master" && userRole !== "coordenacao") {
          return res
            .status(403)
            .json({ message: "Sem permissão para importar produção" });
        }

        const tenantId = req.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant não identificado" });
        }

        const { contratos, fileName } = req.body;
        if (!contratos || !Array.isArray(contratos) || contratos.length === 0) {
          return res
            .status(400)
            .json({ message: "Nenhum contrato para importar" });
        }

        let inseridos = 0;
        let atualizados = 0;
        let ignoradosCount = 0;
        let totalValorGeral = 0;
        let totalValorCartao = 0;
        let mesRef = "";
        const portfolioCountByVendor = new Map<number, number>();

        const [importacao] = await db
          .insert(producoesImportacoes)
          .values({
            tenantId,
            fileName: fileName || "planilha.xlsx",
            importadoPor: req.user?.id,
            importadoPorNome: req.user?.name || "",
            status: "processando",
          })
          .returning();

        for (const c of contratos) {
          const isPago =
            String(c.status || "").toUpperCase() === "PAGO AO CLIENTE";
          const hasDate = !!c.dataPagamento;
          if (!isPago || !hasDate) {
            ignoradosCount++;
            continue;
          }

          const valorBase = parseFloat(String(c.valorBase || 0)) || 0;
          totalValorGeral += valorBase;
          if (c.isCartao) totalValorCartao += valorBase;
          if (!mesRef && c.mesReferencia) mesRef = c.mesReferencia;

          const existing = await db
            .select()
            .from(producoesContratos)
            .where(
              and(
                eq(producoesContratos.contratoId, String(c.contratoId)),
                eq(producoesContratos.tenantId, tenantId),
              ),
            )
            .limit(1);

          const pt1000Val = parseFloat(String(c.pt1000 || 0)) || 0;
          const pontosGeral = pt1000Val * (valorBase / 1000);
          const pontosCartao = c.isCartao ? pontosGeral : 0;

          const telefoneRaw = c.telefoneCliente || c.telefone || c.celular || c.fone || c.tel || null;
          const contratoData = {
            nomeCliente: c.nomeCliente,
            cpfCliente: c.cpfCliente,
            banco: c.banco,
            tipoContrato: c.tipoContrato,
            convenio: c.convenio || "",
            prazo: c.prazo || "",
            nomeCorretor: c.nomeCorretor,
            codigoCorretor: c.codigoCorretor || "",
            grupoVendedor: c.grupoVendedor || "",
            filial: c.filial || "",
            vendedorId: c.vendedorId || null,
            vendedorNome: c.vendedorNome || "",
            status: c.status,
            dataPagamento: c.dataPagamento,
            valorBase: String(c.valorBase),
            valorBruto: String(c.valorBruto || 0),
            valorLiquido: String(c.valorLiquido || 0),
            comissaoRepasseValor: String(c.comissaoRepasseValor || 0),
            comissaoRepassePerc: String(c.comissaoRepassePerc || 0),
            isCartao: c.isCartao,
            mesReferencia: c.mesReferencia,
            importacaoId: importacao.id,
            confirmado: true,
            pt1000: String(pt1000Val),
            pontosGeral: String(Math.round(pontosGeral * 100) / 100),
            pontosCartao: String(Math.round(pontosCartao * 100) / 100),
            telefoneCliente: telefoneRaw ? String(telefoneRaw).trim().slice(0, 30) || null : null,
          };

          if (existing.length > 0) {
            await db
              .update(producoesContratos)
              .set(contratoData)
              .where(
                and(
                  eq(producoesContratos.contratoId, String(c.contratoId)),
                  eq(producoesContratos.tenantId, tenantId),
                ),
              );
            atualizados++;
          } else {
            await db.insert(producoesContratos).values({
              tenantId,
              contratoId: String(c.contratoId),
              ...contratoData,
              importadoPor: req.user?.id,
            });
            inseridos++;
          }

          // Backfill clientes_telefones for fast phone search
          if (c.cpfCliente && telefoneRaw) {
            try {
              await storage.addPessoaTelefonesByCpfBatch([{
                tenantId,
                cpf: String(c.cpfCliente),
                telefones: [String(telefoneRaw)],
              }]);
            } catch (phoneErr) {
              console.error(`[PRODUCAO-IMPORT] Falha ao popular clientes_telefones (CPF ${c.cpfCliente}):`, phoneErr);
            }
          }

          // Carteira de Clientes: add/renew portfolio entry for this vendor
          if (c.vendedorId && c.cpfCliente) {
            try {
              const productType = mapTipoContratoToProductType(c.tipoContrato, c.isCartao);
              await addToPortfolio(
                tenantId,
                c.cpfCliente,
                c.nomeCliente || null,
                Number(c.vendedorId),
                productType,
                "IMPORTACAO",
                importacao.id,
              );
              const prev = portfolioCountByVendor.get(Number(c.vendedorId)) || 0;
              portfolioCountByVendor.set(Number(c.vendedorId), prev + 1);
            } catch (portfolioErr) {
              console.error("[PORTFOLIO] addToPortfolio error (non-fatal):", portfolioErr);
            }
          }
        }

        // Send portfolio notifications per vendor
        for (const [vId, count] of portfolioCountByVendor.entries()) {
          try {
            const mesFormatado = mesRef
              ? (() => {
                  const d = new Date(mesRef);
                  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
                  const y = d.getUTCFullYear();
                  return `${m}/${y}`;
                })()
              : "importação recente";
            await createNotification({
              userId: vId,
              title: "Carteira atualizada",
              message: `Sua carteira foi atualizada com a competência ${mesFormatado}. ${count} cliente(s) adicionado(s) ou renovado(s).`,
              type: "portfolio",
              actionUrl: "/vendas/pipeline",
            });
          } catch (notifErr) {
            console.error("[PORTFOLIO] Notification error (non-fatal):", notifErr);
          }
        }

        await db
          .update(producoesImportacoes)
          .set({
            totalContratos: inseridos + atualizados,
            totalIgnorados: ignoradosCount,
            totalInseridos: inseridos,
            totalAtualizados: atualizados,
            totalValorGeral: String(Math.round(totalValorGeral * 100) / 100),
            totalValorCartao: String(Math.round(totalValorCartao * 100) / 100),
            mesReferencia: mesRef,
            status: "confirmado",
          })
          .where(eq(producoesImportacoes.id, importacao.id));

        res.json({
          message: "Importação confirmada com sucesso",
          resultado: { inseridos, atualizados, ignorados: ignoradosCount },
          importacaoId: importacao.id,
        });
      } catch (error: any) {
        console.error("[IMPORT-PRODUCAO] Confirm error:", error);
        res.status(500).json({
          message:
            "Erro ao confirmar importação: " +
            (error.message || "Erro desconhecido"),
        });
      }
    },
  );

  // ==========================================
  // METAS MENSAIS - Gestão Comercial
  // ==========================================

  // GET /api/metas/equipes - List teams for metas (with role-based filtering)
  app.get("/api/metas/equipes", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(401).json({ message: "Tenant não identificado" });

      const user = req.user!;
      const role = user.role;

      let result;
      if (role === "vendedor") {
        result = await db.execute(sql`
          SELECT ct.id, ct.nome_equipe, ct.coordenador_id, ct.ativa,
                 u.name as coordenador_nome
          FROM commercial_teams ct
          LEFT JOIN users u ON ct.coordenador_id = u.id
          WHERE ct.tenant_id = ${tenantId} AND ct.ativa = true
            AND ct.id IN (
              SELECT ctm.team_id FROM commercial_team_members ctm
              WHERE ctm.user_id = ${user.id} AND ctm.ativo = true
              AND ctm.tenant_id = ${tenantId}
            )
          ORDER BY ct.nome_equipe
        `);
      } else if (role === "coordenacao") {
        result = await db.execute(sql`
          SELECT ct.id, ct.nome_equipe, ct.coordenador_id, ct.ativa,
                 u.name as coordenador_nome
          FROM commercial_teams ct
          LEFT JOIN users u ON ct.coordenador_id = u.id
          WHERE ct.tenant_id = ${tenantId} AND ct.ativa = true
            AND (ct.coordenador_id = ${user.id} OR ct.id IN (
              SELECT ctm.team_id FROM commercial_team_members ctm
              WHERE ctm.user_id = ${user.id} AND ctm.tenant_id = ${tenantId} AND ctm.ativo = true
            ))
          ORDER BY ct.nome_equipe
        `);
      } else {
        result = await db.execute(sql`
          SELECT ct.id, ct.nome_equipe, ct.coordenador_id, ct.ativa,
                 u.name as coordenador_nome
          FROM commercial_teams ct
          LEFT JOIN users u ON ct.coordenador_id = u.id
          WHERE ct.tenant_id = ${tenantId} AND ct.ativa = true
          ORDER BY ct.nome_equipe
        `);
      }

      res.json(result.rows);
    } catch (error: any) {
      console.error("[METAS] Error listing teams:", error);
      res.status(500).json({ message: "Erro ao listar equipes" });
    }
  });

  // GET /api/metas/equipe/:equipeId/:mesReferencia - Get team meta
  app.get(
    "/api/metas/equipe/:equipeId/:mesReferencia",
    requireAuth,
    async (req, res) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId)
          return res.status(401).json({ message: "Tenant não identificado" });

        const equipeId = parseInt(req.params.equipeId);
        const mesReferencia = req.params.mesReferencia;

        const result = await db.execute(sql`
        SELECT * FROM metas_equipe WHERE equipe_id = ${equipeId} AND mes_referencia = ${mesReferencia} AND tenant_id = ${tenantId}
      `);

        res.json(result.rows[0] || null);
      } catch (error: any) {
        console.error("[METAS] Error getting team meta:", error);
        res.status(500).json({ message: "Erro ao buscar meta da equipe" });
      }
    },
  );

  // PUT /api/metas/equipe - Upsert team meta
  app.put("/api/metas/equipe", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(401).json({ message: "Tenant não identificado" });

      const user = req.user!;
      if (!user.isMaster && !["master", "coordenacao"].includes(user.role)) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { equipeId, mesReferencia, metaGeral, metaCartao } = req.body;

      if (!equipeId || !mesReferencia) {
        return res
          .status(400)
          .json({ message: "equipeId e mesReferencia são obrigatórios" });
      }

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (mesReferencia < currentMonth) {
        return res
          .status(403)
          .json({ message: "Não é possível editar metas de meses anteriores" });
      }

      const mg = parseFloat(metaGeral) || 0;
      const mc = parseFloat(metaCartao) || 0;

      const result = await db.execute(sql`
        INSERT INTO metas_equipe (tenant_id, equipe_id, mes_referencia, meta_geral, meta_cartao)
        VALUES (${tenantId}, ${equipeId}, ${mesReferencia}, ${mg}, ${mc})
        ON CONFLICT (tenant_id, equipe_id, mes_referencia) DO UPDATE SET
          meta_geral = EXCLUDED.meta_geral,
          meta_cartao = EXCLUDED.meta_cartao
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[METAS] Error upserting team meta:", error);
      res.status(500).json({ message: "Erro ao salvar meta da equipe" });
    }
  });

  // GET /api/metas/individuais/:equipeId/:mesReferencia - Get individual metas for a team/month
  app.get(
    "/api/metas/individuais/:equipeId/:mesReferencia",
    requireAuth,
    async (req, res) => {
      try {
        const tenantId = req.tenantId;
        if (!tenantId)
          return res.status(401).json({ message: "Tenant não identificado" });

        const user = req.user!;
        const equipeId = parseInt(req.params.equipeId);
        const mesReferencia = req.params.mesReferencia;

        let result;
        if (user.role === "vendedor") {
          result = await db.execute(sql`
          SELECT mi.*, u.name as usuario_nome, u.email as usuario_email
          FROM metas_individuais mi
          JOIN users u ON mi.usuario_id = u.id
          WHERE mi.equipe_id = ${equipeId} AND mi.mes_referencia = ${mesReferencia} AND mi.tenant_id = ${tenantId}
            AND mi.usuario_id = ${user.id}
          ORDER BY u.name
        `);
        } else {
          result = await db.execute(sql`
          SELECT mi.*, u.name as usuario_nome, u.email as usuario_email
          FROM metas_individuais mi
          JOIN users u ON mi.usuario_id = u.id
          WHERE mi.equipe_id = ${equipeId} AND mi.mes_referencia = ${mesReferencia} AND mi.tenant_id = ${tenantId}
          ORDER BY u.name
        `);
        }

        res.json(result.rows);
      } catch (error: any) {
        console.error("[METAS] Error getting individual metas:", error);
        res.status(500).json({ message: "Erro ao buscar metas individuais" });
      }
    },
  );

  // GET /api/metas/membros/:equipeId - Get team members (for individual meta assignment)
  app.get("/api/metas/membros/:equipeId", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(401).json({ message: "Tenant não identificado" });

      const equipeId = parseInt(req.params.equipeId);

      const result = await db.execute(sql`
        SELECT ctm.id as member_id, ctm.funcao_equipe, ctm.user_id,
               u.name as user_name, u.email
        FROM commercial_team_members ctm
        LEFT JOIN users u ON ctm.user_id = u.id
        WHERE ctm.team_id = ${equipeId} AND ctm.tenant_id = ${tenantId} AND ctm.ativo = true
        ORDER BY u.name
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error("[METAS] Error getting team members:", error);
      res.status(500).json({ message: "Erro ao listar membros da equipe" });
    }
  });

  // PUT /api/metas/individual - Upsert individual meta
  app.put("/api/metas/individual", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(401).json({ message: "Tenant não identificado" });

      const user = req.user!;
      if (!user.isMaster && !["master", "coordenacao"].includes(user.role)) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { usuarioId, equipeId, mesReferencia, metaGeral, metaCartao } =
        req.body;

      if (!usuarioId || !equipeId || !mesReferencia) {
        return res.status(400).json({
          message: "usuarioId, equipeId e mesReferencia são obrigatórios",
        });
      }

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (mesReferencia < currentMonth) {
        return res
          .status(403)
          .json({ message: "Não é possível editar metas de meses anteriores" });
      }

      const mg = parseFloat(metaGeral) || 0;
      const mc = parseFloat(metaCartao) || 0;

      const result = await db.execute(sql`
        INSERT INTO metas_individuais (tenant_id, usuario_id, equipe_id, mes_referencia, meta_geral, meta_cartao)
        VALUES (${tenantId}, ${usuarioId}, ${equipeId}, ${mesReferencia}, ${mg}, ${mc})
        ON CONFLICT (tenant_id, usuario_id, equipe_id, mes_referencia) DO UPDATE SET
          meta_geral = EXCLUDED.meta_geral,
          meta_cartao = EXCLUDED.meta_cartao
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[METAS] Error upserting individual meta:", error);
      res.status(500).json({ message: "Erro ao salvar meta individual" });
    }
  });

  // PUT /api/metas/individuais/batch - Batch upsert individual metas
  app.put("/api/metas/individuais/batch", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(401).json({ message: "Tenant não identificado" });

      const user = req.user!;
      if (!user.isMaster && !["master", "coordenacao"].includes(user.role)) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { metas, equipeId, mesReferencia } = req.body;

      if (!Array.isArray(metas) || !equipeId || !mesReferencia) {
        return res.status(400).json({
          message: "metas, equipeId e mesReferencia são obrigatórios",
        });
      }

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (mesReferencia < currentMonth) {
        return res
          .status(403)
          .json({ message: "Não é possível editar metas de meses anteriores" });
      }

      const results = [];
      for (const meta of metas) {
        const mg = parseFloat(meta.metaGeral) || 0;
        const mc = parseFloat(meta.metaCartao) || 0;
        const result = await db.execute(sql`
          INSERT INTO metas_individuais (tenant_id, usuario_id, equipe_id, mes_referencia, meta_geral, meta_cartao)
          VALUES (${tenantId}, ${meta.usuarioId}, ${equipeId}, ${mesReferencia}, ${mg}, ${mc})
          ON CONFLICT (tenant_id, usuario_id, equipe_id, mes_referencia) DO UPDATE SET
            meta_geral = EXCLUDED.meta_geral,
            meta_cartao = EXCLUDED.meta_cartao
          RETURNING *
        `);
        results.push(result.rows[0]);
      }

      res.json(results);
    } catch (error: any) {
      console.error("[METAS] Error batch upserting individual metas:", error);
      res.status(500).json({ message: "Erro ao salvar metas individuais" });
    }
  });

  // ===== META NÍVEIS CRUD =====

  function mapNivelRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      categoria: row.categoria,
      nomeNivel: row.nome_nivel,
      ordem: row.ordem,
      pontosMinimos: row.pontos_minimos,
      pontosMaximos: row.pontos_maximos,
      premio: row.premio,
      cor: row.cor,
      icone: row.icone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  app.get("/api/meta-niveis", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant não identificado" });

      const result = await db.execute(sql`
        SELECT * FROM meta_niveis
        WHERE tenant_id = ${tenantId}
        ORDER BY categoria, pontos_minimos ASC
      `);
      res.json(result.rows.map(mapNivelRow));
    } catch (error: any) {
      console.error("[META-NIVEIS] Error fetching:", error);
      res.status(500).json({ message: "Erro ao buscar níveis" });
    }
  });

  app.post("/api/meta-niveis", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant não identificado" });

      const user = req.user;
      if (!user || !hasRole(user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      const {
        categoria,
        nomeNivel,
        pontosMinimos,
        pontosMaximos,
        premio,
        ordem,
        cor,
        icone,
      } = req.body;

      if (!categoria || !["GERAL", "CARTAO"].includes(categoria)) {
        return res
          .status(400)
          .json({ message: "Categoria deve ser GERAL ou CARTAO" });
      }
      if (!nomeNivel || typeof nomeNivel !== "string" || !nomeNivel.trim()) {
        return res.status(400).json({ message: "Nome do nível é obrigatório" });
      }
      const minVal = Number(pontosMinimos);
      const premioVal = Number(premio);
      const ordemVal = Number(ordem);
      if (isNaN(minVal) || minVal < 0) {
        return res
          .status(400)
          .json({ message: "Pontos mínimos deve ser um número válido >= 0" });
      }
      if (isNaN(premioVal) || premioVal < 0) {
        return res
          .status(400)
          .json({ message: "Valor do prêmio deve ser um número válido >= 0" });
      }
      if (isNaN(ordemVal) || ordemVal < 1) {
        return res
          .status(400)
          .json({ message: "Ordem deve ser um número inteiro >= 1" });
      }
      const maxVal =
        pontosMaximos != null && pontosMaximos !== ""
          ? Number(pontosMaximos)
          : null;
      if (maxVal !== null && (isNaN(maxVal) || maxVal < 0)) {
        return res
          .status(400)
          .json({ message: "Pontos máximos deve ser um número válido >= 0" });
      }

      const dupCheck = await db.execute(sql`
        SELECT id FROM meta_niveis
        WHERE tenant_id = ${tenantId} AND categoria = ${categoria} AND pontos_minimos = ${minVal}
      `);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          message:
            "Já existe um nível com esses pontos mínimos nesta categoria",
        });
      }

      const result = await db.execute(sql`
        INSERT INTO meta_niveis (tenant_id, categoria, nome_nivel, pontos_minimos, pontos_maximos, premio, ordem, cor, icone, created_at, updated_at)
        VALUES (${tenantId}, ${categoria}, ${nomeNivel.trim()}, ${minVal}, ${maxVal}, ${premioVal}, ${Math.floor(ordemVal)}, ${cor || null}, ${icone || null}, NOW(), NOW())
        RETURNING *
      `);
      res.status(201).json(mapNivelRow(result.rows[0]));
    } catch (error: any) {
      console.error("[META-NIVEIS] Error creating:", error);
      res.status(500).json({ message: "Erro ao criar nível" });
    }
  });

  app.put("/api/meta-niveis/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant não identificado" });

      const user = req.user;
      if (!user || !hasRole(user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      const { id } = req.params;
      const nivelId = parseInt(id);
      if (isNaN(nivelId))
        return res.status(400).json({ message: "ID inválido" });

      const {
        categoria,
        nomeNivel,
        pontosMinimos,
        pontosMaximos,
        premio,
        ordem,
        cor,
        icone,
      } = req.body;

      if (!categoria || !["GERAL", "CARTAO"].includes(categoria)) {
        return res
          .status(400)
          .json({ message: "Categoria deve ser GERAL ou CARTAO" });
      }
      if (!nomeNivel || typeof nomeNivel !== "string" || !nomeNivel.trim()) {
        return res.status(400).json({ message: "Nome do nível é obrigatório" });
      }
      const minVal = Number(pontosMinimos);
      const premioVal = Number(premio);
      const ordemVal = Number(ordem);
      if (isNaN(minVal) || minVal < 0) {
        return res
          .status(400)
          .json({ message: "Pontos mínimos deve ser um número válido >= 0" });
      }
      if (isNaN(premioVal) || premioVal < 0) {
        return res
          .status(400)
          .json({ message: "Valor do prêmio deve ser um número válido >= 0" });
      }
      if (isNaN(ordemVal) || ordemVal < 1) {
        return res
          .status(400)
          .json({ message: "Ordem deve ser um número inteiro >= 1" });
      }
      const maxVal =
        pontosMaximos != null && pontosMaximos !== ""
          ? Number(pontosMaximos)
          : null;
      if (maxVal !== null && (isNaN(maxVal) || maxVal < 0)) {
        return res
          .status(400)
          .json({ message: "Pontos máximos deve ser um número válido >= 0" });
      }

      const dupCheck = await db.execute(sql`
        SELECT id FROM meta_niveis
        WHERE tenant_id = ${tenantId} AND categoria = ${categoria} AND pontos_minimos = ${minVal} AND id != ${nivelId}
      `);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          message:
            "Já existe um nível com esses pontos mínimos nesta categoria",
        });
      }

      const result = await db.execute(sql`
        UPDATE meta_niveis SET
          categoria = ${categoria},
          nome_nivel = ${nomeNivel.trim()},
          pontos_minimos = ${minVal},
          pontos_maximos = ${maxVal},
          premio = ${premioVal},
          ordem = ${Math.floor(ordemVal)},
          cor = ${cor || null},
          icone = ${icone || null},
          updated_at = NOW()
        WHERE id = ${nivelId} AND tenant_id = ${tenantId}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Nível não encontrado" });
      }
      res.json(mapNivelRow(result.rows[0]));
    } catch (error: any) {
      console.error("[META-NIVEIS] Error updating:", error);
      res.status(500).json({ message: "Erro ao atualizar nível" });
    }
  });

  app.delete("/api/meta-niveis/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant não identificado" });

      const user = req.user;
      if (!user || !hasRole(user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      const { id } = req.params;
      const result = await db.execute(sql`
        DELETE FROM meta_niveis WHERE id = ${parseInt(id)} AND tenant_id = ${tenantId} RETURNING id
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Nível não encontrado" });
      }
      res.json({ message: "Nível removido com sucesso" });
    } catch (error: any) {
      console.error("[META-NIVEIS] Error deleting:", error);
      res.status(500).json({ message: "Erro ao remover nível" });
    }
  });

  app.get("/api/regulamento", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant não identificado" });

      const result = await db.execute(sql`
        SELECT r.*, u.name as criado_por_nome
        FROM regulamentos r
        LEFT JOIN users u ON r.criado_por = u.id
        WHERE r.tenant_id = ${tenantId}
        ORDER BY r.created_at DESC
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        return res.json(null);
      }
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[REGULAMENTO] Error fetching:", error);
      res.status(500).json({ message: "Erro ao buscar regulamento" });
    }
  });

  app.post("/api/regulamento", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant não identificado" });

      const user = req.user;
      if (!user || !hasRole(user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      const { texto, versao } = req.body;
      if (!texto || !versao) {
        return res
          .status(400)
          .json({ message: "Texto e versão são obrigatórios" });
      }

      const result = await db.execute(sql`
        INSERT INTO regulamentos (tenant_id, texto, versao, data_atualizacao, criado_por, created_at)
        VALUES (${tenantId}, ${texto}, ${versao}, NOW(), ${user.id}, NOW())
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[REGULAMENTO] Error creating:", error);
      res.status(500).json({ message: "Erro ao criar regulamento" });
    }
  });

  app.put("/api/regulamento/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant não identificado" });

      const user = req.user;
      if (!user || !hasRole(user, ["master", "coordenacao"])) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      const { texto, versao } = req.body;
      if (!texto || !versao) {
        return res
          .status(400)
          .json({ message: "Texto e versão são obrigatórios" });
      }

      const { id } = req.params;
      const result = await db.execute(sql`
        UPDATE regulamentos
        SET texto = ${texto}, versao = ${versao}, data_atualizacao = NOW(), criado_por = ${user.id}
        WHERE id = ${parseInt(id)} AND tenant_id = ${tenantId}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Regulamento não encontrado" });
      }
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[REGULAMENTO] Error updating:", error);
      res.status(500).json({ message: "Erro ao atualizar regulamento" });
    }
  });
  // ══════════════════════════════════════════════════════════════
  // SOLICITAÇÕES DE BOLETO
  // ══════════════════════════════════════════════════════════════

  // GET /api/solicitacoes-boleto → lista (vendedor vê só as suas, operacional/admin vê todas)
  app.get("/api/solicitacoes-boleto", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const user = req.user;
      if (!tenantId || !user)
        return res.status(401).json({ message: "Não autenticado" });

      const isAdmin = hasRole(user, [
        "master",
        "coordenacao",
        "operacional",
        "atendimento",
      ]);

      let query = `
        SELECT 
          sb.*,
          u1.name as solicitado_por_nome,
          u2.name as atendido_por_nome
        FROM solicitacoes_boleto sb
        LEFT JOIN users u1 ON sb.solicitado_por_id = u1.id
        LEFT JOIN users u2 ON sb.atendido_por_id = u2.id
        WHERE sb.tenant_id = ${tenantId}
      `;

      if (!isAdmin) {
        query += ` AND sb.solicitado_por_id = ${user.id}`;
      }

      query += ` ORDER BY sb.created_at DESC`;

      const result = await db.execute(sql.raw(query));
      res.json(result.rows);
    } catch (error: any) {
      console.error("[BOLETO] Erro ao listar:", error);
      res.status(500).json({ message: "Erro ao buscar solicitações" });
    }
  });

  // GET /api/solicitacoes-boleto/stats → painel gestor
  app.get(
    "/api/solicitacoes-boleto/stats",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.tenantId;
        const user = req.user;
        if (!tenantId || !user)
          return res.status(401).json({ message: "Não autenticado" });
        const isAdminForStats = hasRole(user, [
          "master",
          "coordenacao",
          "operacional",
          "atendimento",
        ]);
        const isVendedorForStats = hasRole(user, ["vendedor"]);
        if (!isAdminForStats && !isVendedorForStats) {
          return res.status(403).json({ message: "Sem permissão" });
        }

        const valorExpr = sql`CAST(NULLIF(REPLACE(REPLACE(valor, '.', ''), ',', '.'), '') AS NUMERIC)`;
        const userFilter = isAdminForStats
          ? sql`WHERE tenant_id = ${tenantId}`
          : sql`WHERE tenant_id = ${tenantId} AND solicitado_por_id = ${user.id}`;
        const result = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pendente') as pendentes,
          COUNT(*) FILTER (WHERE status = 'em_andamento') as em_andamento,
          COUNT(*) FILTER (WHERE status = 'pendenciado') as pendenciados,
          COUNT(*) FILTER (WHERE status = 'concluido') as concluidos,
          COUNT(*) FILTER (WHERE status = 'cancelado') as cancelados,
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as hoje,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as semana,
          COALESCE(SUM(${valorExpr}), 0) as valor_total,
          COALESCE(SUM(${valorExpr}) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0) as valor_hoje,
          COALESCE(SUM(${valorExpr}) FILTER (WHERE status = 'pendente'), 0) as valor_pendentes,
          COALESCE(SUM(${valorExpr}) FILTER (WHERE status = 'cancelado'), 0) as valor_cancelados,
          COALESCE(SUM(${valorExpr}) FILTER (WHERE status = 'concluido'), 0) as valor_concluidos
        FROM solicitacoes_boleto
        ${userFilter}
      `);

        res.json(result.rows[0]);
      } catch (error: any) {
        console.error("[BOLETO] Erro stats:", error);
        res.status(500).json({ message: "Erro ao buscar estatísticas" });
      }
    },
  );

  // POST /api/solicitacoes-boleto → vendedor abre solicitação
  app.post("/api/solicitacoes-boleto", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const user = req.user;
      if (!tenantId || !user)
        return res.status(401).json({ message: "Não autenticado" });

      const {
        banco,
        tipoBoleto,
        nomeCliente,
        cpfCliente,
        dataNascimento,
        telefone,
        email,
        valor,
        observacaoVendedor,
        ultimosDigitosCartao,
      } = req.body;

      if (!banco || !tipoBoleto || !nomeCliente || !cpfCliente) {
        return res
          .status(400)
          .json({ message: "Banco, tipo, nome e CPF são obrigatórios" });
      }

      const bancosExigemDigitos = ["daycoval", "santander", "olé", "ole"];
      const tiposExigemDigitos = ["cartao_beneficio", "cartao_credito"];
      const exigeDigitos =
        bancosExigemDigitos.some((b) => banco.toLowerCase().includes(b)) &&
        tiposExigemDigitos.includes(tipoBoleto);
      if (
        exigeDigitos &&
        (!ultimosDigitosCartao ||
          String(ultimosDigitosCartao).replace(/\D/g, "").length !== 4)
      ) {
        return res.status(400).json({
          message:
            "Informe os 4 últimos dígitos do cartão para este banco e tipo de boleto",
        });
      }
      const digitosLimpos = ultimosDigitosCartao
        ? String(ultimosDigitosCartao).replace(/\D/g, "").substring(0, 4)
        : null;

      const result = await db.execute(sql`
        INSERT INTO solicitacoes_boleto 
          (tenant_id, banco, tipo_boleto, nome_cliente, cpf_cliente, data_nascimento, telefone, email, valor, observacao_vendedor, ultimos_digitos_cartao, status, solicitado_por_id, created_at, updated_at)
        VALUES 
          (${tenantId}, ${banco}, ${tipoBoleto}, ${nomeCliente}, ${cpfCliente}, ${dataNascimento || null}, ${telefone || null}, ${email || null}, ${valor || null}, ${observacaoVendedor || null}, ${digitosLimpos}, 'pendente', ${user.id}, NOW(), NOW())
        RETURNING *
      `);

      const novaSolicitacao = result.rows[0] as any;

      try {
        const operacionais = await db.execute(sql`
          SELECT id FROM users WHERE tenant_id = ${tenantId} AND role IN ('operacional', 'master') AND is_active = true
        `);
        for (const op of operacionais.rows as any[]) {
          await createNotification({
            userId: op.id,
            title: "Nova solicitação de boleto",
            message: `${user.name} solicitou boleto ${banco} para ${nomeCliente}.`,
            type: "demanda",
            actionUrl: "/operacional",
          });
        }
      } catch (e) {
        console.error("[NOTIFY] Erro ao notificar nova solicitação:", e);
      }

      res.status(201).json(novaSolicitacao);
    } catch (error: any) {
      console.error("[BOLETO] Erro ao criar:", error);
      res.status(500).json({ message: "Erro ao criar solicitação" });
    }
  });

  // PATCH /api/solicitacoes-boleto/:id/status → operacional atualiza status
  app.patch(
    "/api/solicitacoes-boleto/:id/status",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.tenantId;
        const user = req.user;
        if (!tenantId || !user)
          return res.status(401).json({ message: "Não autenticado" });

        const isAdmin = hasRole(user, [
          "master",
          "coordenacao",
          "operacional",
          "atendimento",
          "vendedor",
        ]);

        const { id } = req.params;

        // Busca o registro para verificar ownership
        const existingCheck = await db.execute(sql`
          SELECT solicitado_por_id, status FROM solicitacoes_boleto
          WHERE id = ${parseInt(id)} AND tenant_id = ${tenantId}
        `);
        if (existingCheck.rows.length === 0) {
          return res.status(404).json({ message: "Solicitação não encontrada" });
        }
        const solicitadoPorId = (existingCheck.rows[0] as any).solicitado_por_id;

        const isOwner = user.id === solicitadoPorId;

        if (!isAdmin && !isOwner) {
          return res
            .status(403)
            .json({ message: "Sem permissão para atualizar status" });
        }

        const { status, observacaoOperacional, boletoAnexo, boletoAnexoNome, boletoAnexos } =
          req.body;

        const statusValidos = [
          "pendente",
          "em_andamento",
          "solicitado_banco",
          "aguardando_retorno",
          "pendenciado",
          "concluido",
          "cancelado",
        ];
        if (!statusValidos.includes(status)) {
          return res.status(400).json({ message: "Status inválido" });
        }

        const allowedPrefixes = [
          "data:application/pdf;base64,",
          "data:image/jpeg;base64,",
          "data:image/jpg;base64,",
          "data:image/png;base64,",
        ];
        const maxSizeBytes = 5 * 1024 * 1024 * 1.37;

        let validatedAnexo: string | null = null;
        let validatedAnexoNome: string | null = null;
        if (boletoAnexo) {
          if (!allowedPrefixes.some((p) => boletoAnexo.startsWith(p))) {
            return res.status(400).json({
              message: "Formato de arquivo inválido. Apenas PDF, JPG e PNG são aceitos.",
            });
          }
          if (boletoAnexo.length > maxSizeBytes) {
            return res.status(400).json({ message: "Arquivo muito grande. O tamanho máximo é 5MB." });
          }
          validatedAnexo = boletoAnexo;
          validatedAnexoNome =
            typeof boletoAnexoNome === "string"
              ? boletoAnexoNome.substring(0, 255)
              : "boleto";
        }

        if (boletoAnexos !== undefined && boletoAnexos !== null && !Array.isArray(boletoAnexos)) {
          return res.status(400).json({ message: "Campo boletoAnexos deve ser um array." });
        }

        let validatedAnexosJson: string | null = null;
        if (Array.isArray(boletoAnexos) && boletoAnexos.length > 0) {
          for (const item of boletoAnexos) {
            if (!item.base64 || !allowedPrefixes.some((p: string) => item.base64.startsWith(p))) {
              return res.status(400).json({
                message: "Formato de arquivo inválido. Apenas PDF, JPG e PNG são aceitos.",
              });
            }
            if (item.base64.length > maxSizeBytes) {
              return res.status(400).json({
                message: `Arquivo "${item.nome || "anexo"}" muito grande. O tamanho máximo é 5MB.`,
              });
            }
          }
          validatedAnexosJson = JSON.stringify(
            boletoAnexos.map((item: any) => ({
              base64: item.base64,
              nome: typeof item.nome === "string" ? item.nome.substring(0, 255) : "anexo",
            }))
          );
        }

        const result = await db.execute(sql`
        UPDATE solicitacoes_boleto
        SET 
          status = ${status},
          observacao_operacional = ${observacaoOperacional || null},
          boleto_anexo = COALESCE(${validatedAnexo}, boleto_anexo),
          boleto_anexo_nome = COALESCE(${validatedAnexoNome}, boleto_anexo_nome),
          boleto_anexos = COALESCE(${validatedAnexosJson}, boleto_anexos),
          atendido_por_id = ${user.id},
          updated_at = NOW()
        WHERE id = ${parseInt(id)} AND tenant_id = ${tenantId}
        RETURNING *
      `);

        if (result.rows.length === 0) {
          return res
            .status(404)
            .json({ message: "Solicitação não encontrada" });
        }

        const solicitacao = result.rows[0] as any;
        const statusLabels: Record<string, string> = {
          pendente: "Pendente",
          em_andamento: "Em andamento",
          solicitado_banco: "Solicitado ao banco",
          aguardando_retorno: "Aguardando retorno",
          pendenciado: "Pendenciado",
          concluido: "Concluído",
          cancelado: "Cancelado",
        };

        if (
          solicitacao.solicitado_por_id &&
          solicitacao.solicitado_por_id !== user.id
        ) {
          try {
            await createNotification({
              userId: solicitacao.solicitado_por_id,
              title: "Atualização de boleto",
              message: `Seu boleto ${solicitacao.banco} (${solicitacao.nome_cliente}) foi atualizado para: ${statusLabels[status] || status}.`,
              type: "demanda",
              actionUrl: "/operacional",
            });
          } catch (e) {
            console.error("[NOTIFY] Erro ao notificar status boleto:", e);
          }
        }

        res.json(solicitacao);
      } catch (error: any) {
        console.error("[BOLETO] Erro ao atualizar status:", error);
        res.status(500).json({ message: "Erro ao atualizar status" });
      }
    },
  );

  // DELETE /api/solicitacoes-boleto/:id → só master/coordenacao
  app.delete(
    "/api/solicitacoes-boleto/:id",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.tenantId;
        const user = req.user;
        if (!tenantId || !user)
          return res.status(401).json({ message: "Não autenticado" });
        if (!hasRole(user, ["master", "coordenacao"])) {
          return res
            .status(403)
            .json({ message: "Sem permissão para excluir" });
        }

        const { id } = req.params;
        await db.execute(sql`
        DELETE FROM solicitacoes_boleto WHERE id = ${parseInt(id)} AND tenant_id = ${tenantId}
      `);

        res.json({ message: "Solicitação excluída" });
      } catch (error: any) {
        console.error("[BOLETO] Erro ao excluir:", error);
        res.status(500).json({ message: "Erro ao excluir" });
      }
    },
  );
  // ===== NOTIFICATIONS =====

  // GET /api/notifications → listar notificações do usuário autenticado
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const result = await db.execute(sql`
        SELECT * FROM notifications 
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error("[NOTIFICATIONS] Erro ao listar:", error);
      res.status(500).json({ message: "Erro ao listar notificações" });
    }
  });

  // GET /api/notifications/unread-count → contagem de não lidas
  app.get(
    "/api/notifications/unread-count",
    requireAuth,
    async (req: any, res) => {
      try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Não autenticado" });

        const result = await db.execute(sql`
        SELECT COUNT(*)::int as count FROM notifications 
        WHERE user_id = ${user.id} AND is_read = false
      `);

        res.json({ count: result.rows[0]?.count || 0 });
      } catch (error: any) {
        console.error("[NOTIFICATIONS] Erro ao contar:", error);
        res.status(500).json({ message: "Erro ao contar notificações" });
      }
    },
  );

  // PATCH /api/notifications/read-all → marcar todas como lidas (MUST be before :id route)
  app.patch(
    "/api/notifications/read-all",
    requireAuth,
    async (req: any, res) => {
      try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Não autenticado" });

        await db.execute(sql`
        UPDATE notifications SET is_read = true
        WHERE user_id = ${user.id} AND is_read = false
      `);

        res.json({ message: "Todas notificações marcadas como lidas" });
      } catch (error: any) {
        console.error("[NOTIFICATIONS] Erro ao marcar todas:", error);
        res.status(500).json({ message: "Erro ao atualizar notificações" });
      }
    },
  );

  // PATCH /api/notifications/:id/read → marcar como lida
  app.patch(
    "/api/notifications/:id/read",
    requireAuth,
    async (req: any, res) => {
      try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Não autenticado" });

        const { id } = req.params;
        const numId = parseInt(id);
        if (isNaN(numId))
          return res.status(400).json({ message: "ID inválido" });
        await db.execute(sql`
        UPDATE notifications SET is_read = true
        WHERE id = ${numId} AND user_id = ${user.id}
      `);

        res.json({ message: "Notificação marcada como lida" });
      } catch (error: any) {
        console.error("[NOTIFICATIONS] Erro ao marcar como lida:", error);
        res.status(500).json({ message: "Erro ao atualizar notificação" });
      }
    },
  );

  // DELETE /api/notifications/:id → excluir notificação
  app.delete("/api/notifications/:id", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const numId = parseInt(id);
      if (isNaN(numId)) return res.status(400).json({ message: "ID inválido" });
      await db.execute(sql`
        DELETE FROM notifications WHERE id = ${numId} AND user_id = ${user.id}
      `);

      res.json({ message: "Notificação excluída" });
    } catch (error: any) {
      console.error("[NOTIFICATIONS] Erro ao excluir:", error);
      res.status(500).json({ message: "Erro ao excluir notificação" });
    }
  });

  // =============================================
  // APPOINTMENTS (Agendamentos Universais)
  // =============================================

  function mapAppointmentRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      kind: row.kind,
      title: row.title,
      notes: row.notes,
      scheduledFor: row.scheduled_for,
      status: row.status,
      clientCpf: row.client_cpf,
      clientName: row.client_name,
      targetType: row.target_type,
      targetId: row.target_id,
      payload: row.payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // GET /api/appointments → listar agendamentos com filtros (kind, status, from, to)
  app.get("/api/appointments", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const tenantId = req.tenantId;
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const { status, kind, from, to } = req.query;

      let query = sql`
        SELECT * FROM appointments
        WHERE user_id = ${user.id} AND tenant_id = ${tenantId}
      `;

      if (kind && typeof kind === "string") {
        query = sql`${query} AND kind = ${kind}`;
      }
      if (status && typeof status === "string") {
        query = sql`${query} AND status = ${status}`;
      }
      if (from && typeof from === "string") {
        query = sql`${query} AND scheduled_for >= ${from}`;
      }
      if (to && typeof to === "string") {
        query = sql`${query} AND scheduled_for <= ${to}`;
      }

      query = sql`${query} ORDER BY scheduled_for ASC`;

      const result = await db.execute(query);
      res.json(result.rows.map(mapAppointmentRow));
    } catch (error: any) {
      console.error("[APPOINTMENTS] Erro ao listar:", error);
      res.status(500).json({ message: "Erro ao listar agendamentos" });
    }
  });

  // POST /api/appointments → criar agendamento universal
  app.post("/api/appointments", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const tenantId = req.tenantId;
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const {
        kind,
        title,
        notes,
        scheduledFor,
        clientCpf,
        clientName,
        targetType,
        targetId,
        payload,
      } = req.body;

      if (!title || !scheduledFor) {
        return res
          .status(400)
          .json({ message: "Título e data/hora são obrigatórios" });
      }

      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: "Data/hora inválida" });
      }

      const validKinds = [
        "client_followup",
        "task",
        "reminder",
        "pipeline_segment",
      ];
      const safeKind = validKinds.includes(kind) ? kind : "reminder";

      const result = await db.execute(sql`
        INSERT INTO appointments (tenant_id, user_id, kind, title, notes, scheduled_for, status, client_cpf, client_name, target_type, target_id, payload, created_at, updated_at)
        VALUES (${tenantId}, ${user.id}, ${safeKind}, ${title}, ${notes || null}, ${scheduledDate.toISOString()}, 'open', ${clientCpf || null}, ${clientName || null}, ${targetType || null}, ${targetId || null}, ${payload ? JSON.stringify(payload) : null}::jsonb, NOW(), NOW())
        RETURNING *
      `);

      res.status(201).json(mapAppointmentRow(result.rows[0]));
    } catch (error: any) {
      console.error("[APPOINTMENTS] Erro ao criar:", error);
      res.status(500).json({ message: "Erro ao criar agendamento" });
    }
  });

  // PATCH /api/appointments/:id → atualizar agendamento
  app.patch("/api/appointments/:id", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const tenantId = req.tenantId;
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const numId = parseInt(req.params.id);
      if (isNaN(numId)) return res.status(400).json({ message: "ID inválido" });

      const {
        title,
        notes,
        scheduledFor,
        clientCpf,
        clientName,
        status,
        kind,
        targetType,
        targetId,
        payload,
      } = req.body;

      const existing = await db.execute(sql`
        SELECT * FROM appointments WHERE id = ${numId} AND user_id = ${user.id} AND tenant_id = ${tenantId}
      `);

      if (existing.rows.length === 0) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      const current = existing.rows[0] as any;

      const newTitle = title ?? current.title;
      const newNotes = notes !== undefined ? notes : current.notes;
      let newScheduledFor = current.scheduled_for;
      if (scheduledFor) {
        const parsedDate = new Date(scheduledFor);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ message: "Data/hora inválida" });
        }
        newScheduledFor = parsedDate.toISOString();
      }
      const newClientCpf =
        clientCpf !== undefined ? clientCpf : current.client_cpf;
      const newClientName =
        clientName !== undefined ? clientName : current.client_name;
      const newStatus = status ?? current.status;
      const newKind = kind ?? current.kind;
      const newTargetType =
        targetType !== undefined ? targetType : current.target_type;
      const newTargetId = targetId !== undefined ? targetId : current.target_id;
      const newPayload =
        payload !== undefined
          ? payload
            ? JSON.stringify(payload)
            : null
          : current.payload
            ? JSON.stringify(current.payload)
            : null;

      const validStatuses = ["open", "done", "canceled"];
      if (!validStatuses.includes(newStatus)) {
        return res
          .status(400)
          .json({ message: "Status inválido. Use: open, done, canceled" });
      }

      const result = await db.execute(sql`
        UPDATE appointments
        SET title = ${newTitle}, notes = ${newNotes}, scheduled_for = ${newScheduledFor},
            client_cpf = ${newClientCpf}, client_name = ${newClientName}, status = ${newStatus},
            kind = ${newKind}, target_type = ${newTargetType}, target_id = ${newTargetId},
            payload = ${newPayload}::jsonb, updated_at = NOW()
        WHERE id = ${numId} AND user_id = ${user.id} AND tenant_id = ${tenantId}
        RETURNING *
      `);

      res.json(mapAppointmentRow(result.rows[0]));
    } catch (error: any) {
      console.error("[APPOINTMENTS] Erro ao atualizar:", error);
      res.status(500).json({ message: "Erro ao atualizar agendamento" });
    }
  });

  // DELETE /api/appointments/:id → excluir agendamento
  app.delete("/api/appointments/:id", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const tenantId = req.tenantId;
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const numId = parseInt(req.params.id);
      if (isNaN(numId)) return res.status(400).json({ message: "ID inválido" });

      const result = await db.execute(sql`
        DELETE FROM appointments WHERE id = ${numId} AND user_id = ${user.id} AND tenant_id = ${tenantId}
      `);

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      res.json({ message: "Agendamento excluído" });
    } catch (error: any) {
      console.error("[APPOINTMENTS] Erro ao excluir:", error);
      res.status(500).json({ message: "Erro ao excluir agendamento" });
    }
  });


    // ===== ROTAS DE ETIQUETAS =====

  // ─── GESTÃO DE ETIQUETAS ────────────────────────────────────────────────────

  // GET /api/lead-tags
  // Vendedor: vê só as suas. Gestor/master/coordenacao: vê todas do tenant com info do dono
  app.get("/api/lead-tags", requireAuth, async (req, res) => {
    try {
      const { id: userId, role } = req.user!;
      const tenantId = req.tenantId!;
      const isGestor = ["master", "coordenacao"].includes(role);

      if (isGestor) {
        // Gestor vê todas com nome do vendedor
        const tags = await db
          .select({
            id: leadTags.id,
            nome: leadTags.nome,
            cor: leadTags.cor,
            userId: leadTags.userId,
            createdAt: leadTags.createdAt,
            vendedorNome: users.name,
          })
          .from(leadTags)
          .leftJoin(users, eq(leadTags.userId, users.id))
          .where(eq(leadTags.tenantId, tenantId))
          .orderBy(users.name, leadTags.nome);
        return res.json(tags);
      }

      // Vendedor vê só as suas
      const tags = await db
        .select()
        .from(leadTags)
        .where(and(eq(leadTags.tenantId, tenantId), eq(leadTags.userId, userId)))
        .orderBy(leadTags.nome);
      res.json(tags);
    } catch {
      res.status(500).json({ error: "Erro ao buscar etiquetas" });
    }
  });

  // POST /api/lead-tags — criar etiqueta
  app.post("/api/lead-tags", requireAuth, async (req, res) => {
    try {
      const { id: userId } = req.user!;
      const tenantId = req.tenantId!;
      const { nome, cor } = req.body;

      if (!nome?.trim())
        return res.status(400).json({ error: "Nome obrigatório" });

      const existing = await db
        .select({ id: leadTags.id })
        .from(leadTags)
        .where(and(eq(leadTags.userId, userId), eq(leadTags.nome, nome.trim())))
        .limit(1);

      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: "Você já tem uma etiqueta com este nome" });
      }

      const [tag] = await db
        .insert(leadTags)
        .values({ tenantId, userId, nome: nome.trim(), cor: cor || "#6366f1" })
        .returning();

      res.status(201).json(tag);
    } catch (err) {
      console.error("Erro ao criar etiqueta:", err);
      res.status(500).json({ error: "Erro ao criar etiqueta" });
    }
  });

  // PATCH /api/lead-tags/:id — editar nome/cor (só dono ou gestor)
  app.patch("/api/lead-tags/:id", requireAuth, async (req, res) => {
    try {
      const { id: userId, role } = req.user!;
      const tagId = parseInt(req.params.id);
      const { nome, cor } = req.body;
      const isGestor = ["master", "coordenacao"].includes(role);

      const [tag] = await db
        .select()
        .from(leadTags)
        .where(eq(leadTags.id, tagId))
        .limit(1);

      if (!tag) return res.status(404).json({ error: "Etiqueta não encontrada" });
      if (!isGestor && tag.userId !== userId)
        return res.status(403).json({ error: "Sem permissão" });

      const [updated] = await db
        .update(leadTags)
        .set({ ...(nome ? { nome: nome.trim() } : {}), ...(cor ? { cor } : {}) })
        .where(eq(leadTags.id, tagId))
        .returning();

      res.json(updated);
    } catch {
      res.status(500).json({ error: "Erro ao atualizar etiqueta" });
    }
  });

  // DELETE /api/lead-tags/:id — excluir (só dono ou gestor)
  app.delete("/api/lead-tags/:id", requireAuth, async (req, res) => {
    try {
      const { id: userId, role } = req.user!;
      const tagId = parseInt(req.params.id);
      const isGestor = ["master", "coordenacao"].includes(role);

      const [tag] = await db
        .select()
        .from(leadTags)
        .where(eq(leadTags.id, tagId))
        .limit(1);

      if (!tag) return res.status(404).json({ error: "Etiqueta não encontrada" });
      if (!isGestor && tag.userId !== userId)
        return res.status(403).json({ error: "Sem permissão" });

      await db
        .delete(leadTagAssignments)
        .where(eq(leadTagAssignments.tagId, tagId));
      await db.delete(leadTags).where(eq(leadTags.id, tagId));
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Erro ao excluir etiqueta" });
    }
  });

  // ─── APLICAÇÃO EM LEADS ─────────────────────────────────────────────────────

  // GET /api/crm/leads/:leadId/tags — tags do lead visíveis ao usuário logado
  app.get("/api/crm/leads/:leadId/tags", requireAuth, async (req, res) => {
    try {
      const { id: userId, role } = req.user!;
      const leadId = parseInt(req.params.leadId);
      const isGestor = ["master", "coordenacao"].includes(role);

      const result = await db
        .select({
          id: leadTags.id,
          nome: leadTags.nome,
          cor: leadTags.cor,
          telefone: leadTagAssignments.telefone,
          assignmentId: leadTagAssignments.id,
        })
        .from(leadTagAssignments)
        .innerJoin(leadTags, eq(leadTagAssignments.tagId, leadTags.id))
        .where(
          and(
            eq(leadTagAssignments.leadId, leadId),
            isGestor ? undefined : eq(leadTags.userId, userId), // vendedor vê só as suas
          ),
        );

      res.json(result);
    } catch {
      res.status(500).json({ error: "Erro ao buscar etiquetas do lead" });
    }
  });

  // POST /api/crm/leads/:leadId/tags — aplicar etiqueta com telefone
  app.post("/api/crm/leads/:leadId/tags", requireAuth, async (req, res) => {
    try {
      const { id: userId } = req.user!;
      const leadId = parseInt(req.params.leadId);
      const { tagId, telefone } = req.body;

      if (!tagId) return res.status(400).json({ error: "tagId obrigatório" });
      if (!telefone?.trim())
        return res.status(400).json({ error: "Telefone obrigatório" });

      // Garante que a tag pertence ao usuário logado
      const [tag] = await db
        .select()
        .from(leadTags)
        .where(and(eq(leadTags.id, tagId), eq(leadTags.userId, userId)))
        .limit(1);

      if (!tag)
        return res
          .status(403)
          .json({ error: "Etiqueta não encontrada ou sem permissão" });

      // Verifica se já existe — se sim, atualiza o telefone
      const existing = await db
        .select()
        .from(leadTagAssignments)
        .where(
          and(
            eq(leadTagAssignments.tagId, tagId),
            eq(leadTagAssignments.leadId, leadId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await db
          .update(leadTagAssignments)
          .set({ telefone: telefone.trim() })
          .where(eq(leadTagAssignments.id, existing[0].id))
          .returning();
        return res.json(updated);
      }

      const [assignment] = await db
        .insert(leadTagAssignments)
        .values({ tagId, leadId, telefone: telefone.trim(), assignedBy: userId })
        .returning();

      res.status(201).json(assignment);
    } catch {
      res.status(500).json({ error: "Erro ao aplicar etiqueta" });
    }
  });

  // DELETE /api/crm/leads/:leadId/tags/:tagId — remover etiqueta de um lead
  app.delete(
    "/api/crm/leads/:leadId/tags/:tagId",
    requireAuth,
    async (req, res) => {
      try {
        const { id: userId, role } = req.user!;
        const leadId = parseInt(req.params.leadId);
        const tagId = parseInt(req.params.tagId);
        const isGestor = ["master", "coordenacao"].includes(role);

        // Vendedor só pode remover as suas
        if (!isGestor) {
          const [tag] = await db
            .select()
            .from(leadTags)
            .where(and(eq(leadTags.id, tagId), eq(leadTags.userId, userId)))
            .limit(1);
          if (!tag) return res.status(403).json({ error: "Sem permissão" });
        }

        await db
          .delete(leadTagAssignments)
          .where(
            and(
              eq(leadTagAssignments.tagId, tagId),
              eq(leadTagAssignments.leadId, leadId),
            ),
          );

        res.json({ ok: true });
      } catch {
        res.status(500).json({ error: "Erro ao remover etiqueta" });
      }
    },
  );

  // ─── ÁREA DE GESTÃO (clientes por etiqueta) ─────────────────────────────────

  // GET /api/lead-tags/:id/clientes — lista leads de uma etiqueta com nome + telefone
  app.get("/api/lead-tags/:id/clientes", requireAuth, async (req, res) => {
    try {
      const { id: userId, role } = req.user!;
      const tagId = parseInt(req.params.id);
      const isGestor = ["master", "coordenacao"].includes(role);

      // Garante acesso à tag
      const [tag] = await db
        .select()
        .from(leadTags)
        .where(
          and(
            eq(leadTags.id, tagId),
            isGestor ? undefined : eq(leadTags.userId, userId),
          ),
        )
        .limit(1);

      if (!tag)
        return res
          .status(403)
          .json({ error: "Sem permissão ou tag não encontrada" });

      const clientes = await db
        .select({
          assignmentId: leadTagAssignments.id,
          leadId: salesLeads.id,
          nome: salesLeads.nome,
          cpf: salesLeads.cpf,
          telefone: leadTagAssignments.telefone,
          createdAt: leadTagAssignments.createdAt,
        })
        .from(leadTagAssignments)
        .innerJoin(salesLeads, eq(leadTagAssignments.leadId, salesLeads.id))
        .where(eq(leadTagAssignments.tagId, tagId))
        .orderBy(salesLeads.nome);

      res.json(clientes);
    } catch {
      res.status(500).json({ error: "Erro ao buscar clientes da etiqueta" });
    }
  });


  // ========== FEEDBACKS ==========

  app.get("/api/feedbacks", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user!.id;
      const isGestor = ["master", "coordenacao"].includes(req.user!.role);

      let whereClause;
      if (isGestor) {
        whereClause = eq(feedbacks.tenantId, tenantId);
      } else {
        whereClause = and(
          eq(feedbacks.tenantId, tenantId),
          or(
            eq(feedbacks.destinatarioId, userId),
            sql`${feedbacks.destinatarioId} IS NULL`,
          ),
        );
      }

      const selectFields: Record<string, any> = {
        id: feedbacks.id,
        autorId: feedbacks.autorId,
        destinatarioId: feedbacks.destinatarioId,
        titulo: feedbacks.titulo,
        mensagem: feedbacks.mensagem,
        tipo: feedbacks.tipo,
        lidoPor: feedbacks.lidoPor,
        comentario: feedbacks.comentario,
        comentarioAt: feedbacks.comentarioAt,
        readAt: feedbacks.readAt,
        createdAt: feedbacks.createdAt,
      };
      if (isGestor) {
        selectFields.rascunho = feedbacks.rascunho;
      }

      const result = await db
        .select(selectFields)
        .from(feedbacks)
        .where(whereClause)
        .orderBy(desc(feedbacks.createdAt));

      const userIds = new Set<number>();
      for (const fb of result) {
        userIds.add(fb.autorId);
        if (fb.destinatarioId) userIds.add(fb.destinatarioId);
      }

      const userMap: Record<number, string> = {};
      for (const uid of userIds) {
        const u = await storage.getUser(uid);
        if (u) userMap[uid] = u.name;
      }

      const enriched = result.map((fb) => ({
        ...fb,
        autorNome: userMap[fb.autorId] || "Desconhecido",
        destinatarioNome: fb.destinatarioId ? (userMap[fb.destinatarioId] || "Desconhecido") : null,
        lidoPor: Array.isArray(fb.lidoPor) ? fb.lidoPor : [],
      }));

      res.json(enriched);
    } catch (error) {
      console.error("GET /api/feedbacks error:", error);
      res.status(500).json({ message: "Erro ao buscar feedbacks" });
    }
  });

  app.get("/api/feedbacks/team-users", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const result = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .innerJoin(userTenants, eq(users.id, userTenants.userId))
        .where(
          and(
            eq(userTenants.tenantId, tenantId),
            eq(users.isActive, true),
          ),
        )
        .orderBy(users.name);
      res.json(result);
    } catch (error) {
      console.error("GET /api/feedbacks/team-users error:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.get("/api/feedbacks/unread-count", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user!.id;

      const result = await db.execute(sql`
        SELECT COUNT(*)::int as total
        FROM feedbacks
        WHERE tenant_id = ${tenantId}
          AND (destinatario_id = ${userId} OR destinatario_id IS NULL)
          AND NOT (lido_por @> ${JSON.stringify([userId])}::jsonb)
      `);
      const count = parseInt(result.rows[0]?.total as string) || 0;
      res.json({ count });
    } catch (error) {
      console.error("GET /api/feedbacks/unread-count error:", error);
      res.json({ count: 0 });
    }
  });

  app.post("/api/feedbacks", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user!.id;
      const isGestor = ["master", "coordenacao"].includes(req.user!.role);
      if (!isGestor) {
        return res.status(403).json({ message: "Somente gestores podem criar feedbacks" });
      }

      const { titulo, mensagem, tipo, destinatarioId, rascunho } = req.body;
      if (!titulo || !mensagem) {
        return res.status(400).json({ message: "Título e mensagem são obrigatórios" });
      }

      if (destinatarioId) {
        const [recipientCheck] = await db
          .select({ id: userTenants.userId })
          .from(userTenants)
          .where(
            and(
              eq(userTenants.userId, destinatarioId),
              eq(userTenants.tenantId, tenantId),
            ),
          )
          .limit(1);
        if (!recipientCheck) {
          return res.status(400).json({ message: "Destinatário não pertence a esta empresa" });
        }
      }

      const [fb] = await db
        .insert(feedbacks)
        .values({
          tenantId,
          autorId: userId,
          destinatarioId: destinatarioId || null,
          titulo,
          mensagem,
          rascunho: rascunho || null,
          tipo: tipo || "combinado",
          lidoPor: [],
        })
        .returning();

      res.json(fb);
    } catch (error) {
      console.error("POST /api/feedbacks error:", error);
      res.status(500).json({ message: "Erro ao criar feedback" });
    }
  });

  app.patch("/api/feedbacks/:id/lido", requireAuth, async (req, res) => {
    try {
      const feedbackId = parseInt(req.params.id);
      const userId = req.user!.id;
      const tenantId = req.tenantId!;

      const isGestor = ["master", "coordenacao"].includes(req.user!.role);

      let whereCondition;
      if (isGestor) {
        whereCondition = and(
          eq(feedbacks.id, feedbackId),
          eq(feedbacks.tenantId, tenantId),
        );
      } else {
        whereCondition = and(
          eq(feedbacks.id, feedbackId),
          eq(feedbacks.tenantId, tenantId),
          or(
            eq(feedbacks.destinatarioId, userId),
            sql`${feedbacks.destinatarioId} IS NULL`,
          ),
        );
      }

      const [fb] = await db
        .select()
        .from(feedbacks)
        .where(whereCondition)
        .limit(1);

      if (!fb) return res.status(404).json({ message: "Feedback não encontrado" });

      const lidoPor = Array.isArray(fb.lidoPor) ? fb.lidoPor as number[] : [];
      if (!lidoPor.includes(userId)) {
        lidoPor.push(userId);
        const updateData: any = { lidoPor };
        if (!fb.readAt) {
          updateData.readAt = new Date();
        }
        await db
          .update(feedbacks)
          .set(updateData)
          .where(eq(feedbacks.id, feedbackId));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("PATCH /api/feedbacks/:id/lido error:", error);
      res.status(500).json({ message: "Erro ao marcar como lido" });
    }
  });

  app.delete("/api/feedbacks/:id", requireAuth, async (req, res) => {
    try {
      const feedbackId = parseInt(req.params.id);
      const tenantId = req.tenantId!;
      const isGestor = ["master", "coordenacao"].includes(req.user!.role);
      if (!isGestor) {
        return res.status(403).json({ message: "Apenas gestores podem excluir feedbacks" });
      }

      const [fb] = await db
        .select({ id: feedbacks.id })
        .from(feedbacks)
        .where(and(eq(feedbacks.id, feedbackId), eq(feedbacks.tenantId, tenantId)))
        .limit(1);

      if (!fb) return res.status(404).json({ message: "Feedback não encontrado" });

      await db.delete(feedbacks).where(eq(feedbacks.id, feedbackId));
      res.json({ success: true });
    } catch (error) {
      console.error("DELETE /api/feedbacks/:id error:", error);
      res.status(500).json({ message: "Erro ao excluir feedback" });
    }
  });

  // ========== AI FEEDBACK IMPROVEMENT ==========

  app.post("/api/ai/melhorar-feedback", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const isGestor = ["master", "coordenacao"].includes(req.user!.role);
      if (!isGestor) {
        return res.status(403).json({ message: "Acesso restrito" });
      }

      const { rascunho, destinatarioId, tipo } = req.body;
      if (!rascunho) {
        return res.status(400).json({ message: "Rascunho é obrigatório" });
      }

      let perfilInfo = "";
      let producaoInfo = "";

      if (destinatarioId) {
        const [tenantCheck] = await db
          .select({ userId: userTenants.userId })
          .from(userTenants)
          .where(and(eq(userTenants.userId, destinatarioId), eq(userTenants.tenantId, tenantId)))
          .limit(1);
        if (!tenantCheck) {
          return res.status(403).json({ message: "Destinatário não pertence ao seu tenant" });
        }

        const [destUser] = await db
          .select({
            name: users.name,
            perfilDisc: users.perfilDisc,
            perfilDiscData: users.perfilDiscData,
          })
          .from(users)
          .where(eq(users.id, destinatarioId))
          .limit(1);

        if (destUser?.perfilDisc) {
          const discData = destUser.perfilDiscData as any;
          const discMap: Record<string, string> = {
            EXECUTOR: "Executor (D) - Orientado a resultados, direto, decisivo",
            COMUNICADOR: "Comunicador (I) - Entusiasta, persuasivo, sociável",
            PLANEJADOR: "Planejador (S) - Estável, cooperativo, confiável",
            ANALISTA: "Analista (C) - Preciso, lógico, orientado a qualidade",
          };
          perfilInfo = `\nPerfil DISC do vendedor: ${discMap[destUser.perfilDisc] || destUser.perfilDisc}`;
          if (discData) {
            perfilInfo += ` (D: ${discData.d}%, I: ${discData.i}%, S: ${discData.s}%, C: ${discData.c}%)`;
          }
        }

        const now = new Date();
        const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const prodResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(valor_base), 0)::numeric as total_valor,
            COUNT(*)::int as total_contratos
          FROM producoes_contratos
          WHERE vendedor_id = ${destinatarioId}
            AND tenant_id = ${tenantId}
            AND mes_referencia = ${mesRef}
            AND confirmado = true
            AND pt_1000 > 0
        `);

        const vendResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(valor_contrato), 0)::numeric as total_valor,
            COUNT(*)::int as total_contratos
          FROM vendedor_contratos
          WHERE vendedor_id = ${destinatarioId}
            AND tenant_id = ${tenantId}
            AND data_contrato >= ${firstDay.toISOString()}
            AND data_contrato <= ${lastDay.toISOString()}
        `);

        const totalValor =
          (parseFloat(prodResult.rows[0]?.total_valor as string) || 0) +
          (parseFloat(vendResult.rows[0]?.total_valor as string) || 0);
        const totalContratos =
          (parseInt(prodResult.rows[0]?.total_contratos as string) || 0) +
          (parseInt(vendResult.rows[0]?.total_contratos as string) || 0);

        if (totalContratos > 0 || totalValor > 0) {
          producaoInfo = `\nProdução do mês atual: R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em ${totalContratos} contratos`;
        } else {
          producaoInfo = "\nProdução do mês atual: Sem produção registrada até o momento";
        }
      }

      const tipoLabel: Record<string, string> = {
        elogio: "Elogio (reconhecimento positivo)",
        melhoria: "Melhoria (ponto de desenvolvimento)",
        combinado: "Combinado (acordo entre gestor e vendedor)",
        aviso: "Aviso (alerta importante)",
      };

      const { openai } = await import("./openaiClient");

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Você é um assistente de RH especializado em feedback construtivo para equipes de vendas no mercado financeiro brasileiro (crédito consignado). Sua tarefa é melhorar o texto de feedback mantendo o tom e a intenção original do gestor, mas tornando-o mais claro, estruturado e construtivo. Considere o perfil comportamental DISC e dados de produção do vendedor (se disponíveis) para sugerir pontos relevantes de desenvolvimento. Retorne um JSON válido com: { "titulo": "título conciso e profissional para o feedback", "mensagem": "versão melhorada e estruturada do feedback, com parágrafos", "sugestoes": ["lista de sugestões adicionais de desenvolvimento baseadas no perfil e produção"] }`,
          },
          {
            role: "user",
            content: `Tipo de feedback: ${tipoLabel[tipo] || tipo}\n\nRascunho do gestor:\n${rascunho}${perfilInfo}${producaoInfo}`,
          },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ message: "Resposta vazia da IA" });
      }

      const parsed = JSON.parse(content);
      res.json({
        titulo: parsed.titulo || "",
        mensagem: parsed.mensagem || "",
        sugestoes: Array.isArray(parsed.sugestoes) ? parsed.sugestoes : [],
      });
    } catch (error) {
      console.error("POST /api/ai/melhorar-feedback error:", error);
      res.status(500).json({ message: "Erro ao melhorar feedback com IA" });
    }
  });

  // ========== FEEDBACK COMMENTS ==========

  app.post("/api/feedbacks/:id/comentario", requireAuth, async (req, res) => {
    try {
      const feedbackId = parseInt(req.params.id);
      const userId = req.user!.id;
      const tenantId = req.tenantId!;
      const { comentario } = req.body;

      if (!comentario || !comentario.trim()) {
        return res.status(400).json({ message: "Comentário é obrigatório" });
      }

      const [fb] = await db
        .select()
        .from(feedbacks)
        .where(
          and(
            eq(feedbacks.id, feedbackId),
            eq(feedbacks.tenantId, tenantId),
            eq(feedbacks.destinatarioId, userId),
          ),
        )
        .limit(1);

      if (!fb) return res.status(404).json({ message: "Feedback não encontrado ou sem permissão" });

      await db
        .update(feedbacks)
        .set({ comentario: comentario.trim(), comentarioAt: new Date() })
        .where(eq(feedbacks.id, feedbackId));

      res.json({ success: true });
    } catch (error) {
      console.error("POST /api/feedbacks/:id/comentario error:", error);
      res.status(500).json({ message: "Erro ao salvar comentário" });
    }
  });

  // ========== PROFILER / USER PROFILE ==========

  app.patch("/api/users/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { perfilDisc, perfilDiscData } = req.body;

      const updateData: any = {};
      if (perfilDisc) updateData.perfilDisc = perfilDisc;
      if (perfilDiscData) updateData.perfilDiscData = perfilDiscData;
      updateData.perfilDiscCompletedAt = new Date();

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("PATCH /api/users/profile error:", error);
      res.status(500).json({ message: "Erro ao salvar perfil" });
    }
  });

  app.get("/api/users/team-profiles", requireAuth, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const isGestor = ["master", "coordenacao"].includes(req.user!.role);
      if (!isGestor) {
        return res.status(403).json({ message: "Acesso restrito" });
      }

      const result = await db
        .select({
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
          perfilDisc: users.perfilDisc,
          perfilDiscData: users.perfilDiscData,
          perfilDiscCompletedAt: users.perfilDiscCompletedAt,
        })
        .from(users)
        .innerJoin(userTenants, eq(users.id, userTenants.userId))
        .where(
          and(
            eq(userTenants.tenantId, tenantId),
            eq(users.isActive, true),
          ),
        )
        .orderBy(users.name);

      res.json(result);
    } catch (error) {
      console.error("GET /api/users/team-profiles error:", error);
      res.status(500).json({ message: "Erro ao buscar perfis" });
    }
  });


  app.get(
    "/api/export/cpfs-sem-nascimento",
    requireAuth,
    async (req: any, res) => {
      try {
        const result = await db.execute(sql`
          SELECT cpf, nome FROM clientes_pessoa 
          WHERE data_nascimento IS NULL 
          ORDER BY nome
        `);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="cpfs_sem_nascimento.csv"');
        
        let csv = "CPF;NOME\n";
        for (const row of result.rows) {
          csv += `${row.cpf};${(row.nome || '').toString().replace(/;/g, ',')}\n`;
        }
        
        res.send(csv);
      } catch (error) {
        console.error("GET /api/export/cpfs-sem-nascimento error:", error);
        res.status(500).json({ message: "Erro ao exportar CPFs" });
      }
    }
  );

  app.get(
    "/api/materials",
    requireAuth,
    resolveTenant,
    requireTenant,
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.tenantId!;
        const category = req.query.category as string | undefined;
        let query;
        if (category) {
          query = await db.select().from(materials)
            .where(and(eq(materials.tenantId, tenantId), eq(materials.category, category)))
            .orderBy(desc(materials.createdAt));
        } else {
          query = await db.select().from(materials)
            .where(eq(materials.tenantId, tenantId))
            .orderBy(desc(materials.createdAt));
        }
        res.json(query);
      } catch (error) {
        console.error("GET /api/materials error:", error);
        res.status(500).json({ message: "Erro ao buscar materiais" });
      }
    }
  );

  app.post(
    "/api/materials",
    requireAuth,
    resolveTenant,
    requireTenant,
    async (req: Request, res: Response) => {
      try {
        const userRole = req.user!.role;
        if (userRole !== "master" && userRole !== "coordenacao") {
          return res.status(403).json({ message: "Sem permissão" });
        }
        const parsed = insertMaterialSchema.parse(req.body);
        const [created] = await db.insert(materials).values({
          ...parsed,
          tenantId: req.tenantId!,
          createdBy: req.user!.id,
        }).returning();
        res.status(201).json(created);
      } catch (error) {
        console.error("POST /api/materials error:", error);
        res.status(500).json({ message: "Erro ao criar material" });
      }
    }
  );

  app.delete(
    "/api/materials/:id",
    requireAuth,
    resolveTenant,
    requireTenant,
    async (req: Request, res: Response) => {
      try {
        const userRole = req.user!.role;
        if (userRole !== "master" && userRole !== "coordenacao") {
          return res.status(403).json({ message: "Sem permissão" });
        }
        const id = parseInt(req.params.id);
        const [item] = await db.select().from(materials)
          .where(and(eq(materials.id, id), eq(materials.tenantId, req.tenantId!)));
        if (!item) {
          return res.status(404).json({ message: "Material não encontrado" });
        }
        await db.delete(materials).where(eq(materials.id, id));
        res.json({ message: "Material removido" });
      } catch (error) {
        console.error("DELETE /api/materials/:id error:", error);
        res.status(500).json({ message: "Erro ao remover material" });
      }
    }
  );

  // ===== COMMISSION TABLES / TABELAS DE COMISSÃO =====

  app.get(
    "/api/commission-tables",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.tenantId!;
        const rows = await db
          .select()
          .from(commissionTables)
          .where(eq(commissionTables.tenantId, tenantId))
          .orderBy(desc(commissionTables.pontos));
        res.json(rows);
      } catch (error) {
        console.error("GET /api/commission-tables error:", error);
        res.status(500).json({ message: "Erro ao listar tabelas" });
      }
    }
  );

  app.get(
    "/api/commission-tables/simulate",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.tenantId!;
        const { convenio, tipoProduto, banco, prazo, parcela, valorContrato } = req.query as Record<string, string>;

        if (!convenio || !tipoProduto) {
          return res.status(400).json({ message: "convenio e tipoProduto são obrigatórios" });
        }
        if (!parcela && !valorContrato) {
          return res.status(400).json({ message: "Informe parcela ou valorContrato" });
        }

        const conditions = [
          eq(commissionTables.tenantId, tenantId),
          eq(commissionTables.convenio, convenio),
          eq(commissionTables.tipoProduto, tipoProduto),
          eq(commissionTables.ativo, true),
        ];

        if (banco) {
          conditions.push(eq(commissionTables.banco, banco));
        }
        if (prazo) {
          conditions.push(eq(commissionTables.prazo, parseInt(prazo)));
        }

        const rows = await db
          .select()
          .from(commissionTables)
          .where(and(...conditions))
          .orderBy(desc(commissionTables.pontos))
          .limit(10);

        const parcelaNum = parcela ? parseFloat(parcela) : 0;
        const contratoNum = valorContrato ? parseFloat(valorContrato) : 0;
        if ((parcela && (isNaN(parcelaNum) || parcelaNum <= 0)) || (valorContrato && (isNaN(contratoNum) || contratoNum <= 0))) {
          return res.status(400).json({ message: "Valor inválido" });
        }

        const results = rows.map((row) => {
          const coef = parseFloat(row.coeficiente);
          if (!coef || isNaN(coef) || coef <= 0) return null;
          let valorContratoLibera: number;
          let parcelaResultante: number;

          if (parcela) {
            parcelaResultante = parcelaNum;
            valorContratoLibera = parcelaResultante / coef;
          } else {
            valorContratoLibera = contratoNum;
            parcelaResultante = valorContratoLibera * coef;
          }

          return {
            id: row.id,
            banco: row.banco,
            convenio: row.convenio,
            tipoProduto: row.tipoProduto,
            prazo: row.prazo,
            coeficiente: row.coeficiente,
            pontos: row.pontos,
            valorContratoLibera: Math.round(valorContratoLibera * 100) / 100,
            parcelaResultante: Math.round(parcelaResultante * 100) / 100,
          };
        });

        res.json(results.filter(Boolean));
      } catch (error) {
        console.error("GET /api/commission-tables/simulate error:", error);
        res.status(500).json({ message: "Erro na simulação" });
      }
    }
  );

  app.post(
    "/api/commission-tables",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userRole = req.user!.role;
        if (userRole !== "master" && userRole !== "coordenacao") {
          return res.status(403).json({ message: "Sem permissão" });
        }
        const parsed = insertCommissionTableSchema.parse(req.body);
        const [created] = await db
          .insert(commissionTables)
          .values({
            ...parsed,
            tenantId: req.tenantId!,
            createdBy: req.user!.id,
          })
          .returning();
        res.status(201).json(created);
      } catch (error) {
        console.error("POST /api/commission-tables error:", error);
        res.status(500).json({ message: "Erro ao criar tabela" });
      }
    }
  );

  app.put(
    "/api/commission-tables/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userRole = req.user!.role;
        if (userRole !== "master" && userRole !== "coordenacao") {
          return res.status(403).json({ message: "Sem permissão" });
        }
        const id = parseInt(req.params.id);
        const [existing] = await db
          .select()
          .from(commissionTables)
          .where(and(eq(commissionTables.id, id), eq(commissionTables.tenantId, req.tenantId!)));
        if (!existing) {
          return res.status(404).json({ message: "Tabela não encontrada" });
        }
        const { nome, convenio, banco, tipoProduto, prazo, coeficiente, pontos, ativo } = req.body;
        const updateData: Record<string, any> = {};
        if (typeof nome === "string" && nome.trim()) updateData.nome = nome.trim();
        if (typeof convenio === "string" && convenio.trim()) updateData.convenio = convenio.trim();
        if (typeof banco === "string" && banco.trim()) updateData.banco = banco.trim();
        if (typeof tipoProduto === "string" && tipoProduto.trim()) updateData.tipoProduto = tipoProduto.trim();
        if (prazo !== undefined) updateData.prazo = parseInt(String(prazo));
        if (coeficiente !== undefined) updateData.coeficiente = String(coeficiente);
        if (pontos !== undefined) updateData.pontos = String(pontos);
        if (ativo !== undefined) updateData.ativo = Boolean(ativo);
        const [updated] = await db
          .update(commissionTables)
          .set(updateData)
          .where(and(eq(commissionTables.id, id), eq(commissionTables.tenantId, req.tenantId!)))
          .returning();
        res.json(updated);
      } catch (error) {
        console.error("PUT /api/commission-tables/:id error:", error);
        res.status(500).json({ message: "Erro ao atualizar tabela" });
      }
    }
  );

  app.delete(
    "/api/commission-tables/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userRole = req.user!.role;
        if (userRole !== "master" && userRole !== "coordenacao") {
          return res.status(403).json({ message: "Sem permissão" });
        }
        const id = parseInt(req.params.id);
        const [existing] = await db
          .select()
          .from(commissionTables)
          .where(and(eq(commissionTables.id, id), eq(commissionTables.tenantId, req.tenantId!)));
        if (!existing) {
          return res.status(404).json({ message: "Tabela não encontrada" });
        }
        await db.delete(commissionTables).where(and(eq(commissionTables.id, id), eq(commissionTables.tenantId, req.tenantId!)));
        res.json({ message: "Tabela removida" });
      } catch (error) {
        console.error("DELETE /api/commission-tables/:id error:", error);
        res.status(500).json({ message: "Erro ao remover tabela" });
      }
    }
  );

  // ===== COMMISSION TABLES IMPORT =====

  app.post(
    "/api/commission-tables/import",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userRole = req.user!.role;
        if (userRole !== "master" && userRole !== "coordenacao") {
          return res.status(403).json({ message: "Sem permissão" });
        }
        const { tabelas } = req.body;
        if (!Array.isArray(tabelas) || tabelas.length === 0) {
          return res.status(400).json({ message: "Nenhuma tabela para importar" });
        }
        let inseridas = 0;
        let ignoradas = 0;
        for (const row of tabelas) {
          try {
            const parsed = insertCommissionTableSchema.parse(row);
            await db.insert(commissionTables).values({
              ...parsed,
              tenantId: req.tenantId!,
              createdBy: req.user!.id,
            });
            inseridas++;
          } catch (e) {
            ignoradas++;
          }
        }
        res.json({ inseridas, ignoradas });
      } catch (error) {
        console.error("POST /api/commission-tables/import error:", error);
        res.status(500).json({ message: "Erro ao importar tabelas" });
      }
    }
  );

  // ===== CREATIVE PACKS =====

  app.get("/api/creative-packs", requireAuth, async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(creativePacks)
        .where(and(eq(creativePacks.tenantId, req.tenantId!), eq(creativePacks.ativo, true)))
        .orderBy(desc(creativePacks.createdAt));
      res.json(rows);
    } catch (error) {
      console.error("GET /api/creative-packs error:", error);
      res.status(500).json({ message: "Erro ao listar packs" });
    }
  });

  app.post("/api/creative-packs", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.user!.role;
      if (role !== "master" && role !== "coordenacao") return res.status(403).json({ message: "Sem permissão" });
      const parsed = insertCreativePackSchema.parse(req.body);
      const [created] = await db.insert(creativePacks).values({ ...parsed, tenantId: req.tenantId!, createdBy: req.user!.id }).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("POST /api/creative-packs error:", error);
      res.status(500).json({ message: "Erro ao criar pack" });
    }
  });

  app.put("/api/creative-packs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.user!.role;
      if (role !== "master" && role !== "coordenacao") return res.status(403).json({ message: "Sem permissão" });
      const id = parseInt(req.params.id);
      const { nome, descricao, ativo } = req.body;
      const updateData: Record<string, any> = {};
      if (typeof nome === "string" && nome.trim()) updateData.nome = nome.trim();
      if (descricao !== undefined) updateData.descricao = descricao;
      if (ativo !== undefined) updateData.ativo = Boolean(ativo);
      const [updated] = await db.update(creativePacks).set(updateData)
        .where(and(eq(creativePacks.id, id), eq(creativePacks.tenantId, req.tenantId!)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Pack não encontrado" });
      res.json(updated);
    } catch (error) {
      console.error("PUT /api/creative-packs/:id error:", error);
      res.status(500).json({ message: "Erro ao atualizar pack" });
    }
  });

  app.delete("/api/creative-packs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.user!.role;
      if (role !== "master" && role !== "coordenacao") return res.status(403).json({ message: "Sem permissão" });
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(creativePacks)
        .where(and(eq(creativePacks.id, id), eq(creativePacks.tenantId, req.tenantId!)));
      if (!existing) return res.status(404).json({ message: "Pack não encontrado" });
      await db.delete(creatives).where(and(eq(creatives.packId, id), eq(creatives.tenantId, req.tenantId!)));
      await db.delete(creativePacks).where(and(eq(creativePacks.id, id), eq(creativePacks.tenantId, req.tenantId!)));
      res.json({ message: "Pack removido" });
    } catch (error) {
      console.error("DELETE /api/creative-packs/:id error:", error);
      res.status(500).json({ message: "Erro ao remover pack" });
    }
  });

  // ===== CREATIVES =====

  app.get("/api/creatives", requireAuth, async (req: Request, res: Response) => {
    try {
      const conditions = [eq(creatives.tenantId, req.tenantId!), eq(creatives.ativo, true)];
      if (req.query.packId) conditions.push(eq(creatives.packId, parseInt(req.query.packId as string)));
      if (req.query.tipo) conditions.push(eq(creatives.tipo, req.query.tipo as string));
      const rows = await db.select().from(creatives).where(and(...conditions)).orderBy(desc(creatives.createdAt));
      res.json(rows);
    } catch (error) {
      console.error("GET /api/creatives error:", error);
      res.status(500).json({ message: "Erro ao listar criativos" });
    }
  });

  app.post("/api/creatives/upload-image", requireAuth, uploadCreativeImage.single("image"), async (req: Request, res: Response) => {
    try {
      const role = req.user!.role;
      if (role !== "master" && role !== "coordenacao") return res.status(403).json({ message: "Sem permissão" });
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Arquivo de imagem é obrigatório" });

      const mime = file.mimetype || "image/png";
      const imageUrl = `data:${mime};base64,${file.buffer.toString("base64")}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error("POST /api/creatives/upload-image error:", error);
      res.status(500).json({ message: "Erro ao fazer upload da imagem" });
    }
  });

  app.post("/api/creatives", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.user!.role;
      if (role !== "master" && role !== "coordenacao") return res.status(403).json({ message: "Sem permissão" });
      const parsed = insertCreativeSchema.parse(req.body);
      const [validPack] = await db.select().from(creativePacks)
        .where(and(eq(creativePacks.id, parsed.packId), eq(creativePacks.tenantId, req.tenantId!)));
      if (!validPack) return res.status(400).json({ message: "Pack inválido" });
      const [created] = await db.insert(creatives).values({ ...parsed, tenantId: req.tenantId!, createdBy: req.user!.id }).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("POST /api/creatives error:", error);
      res.status(500).json({ message: "Erro ao criar criativo" });
    }
  });

  app.put("/api/creatives/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.user!.role;
      if (role !== "master" && role !== "coordenacao") return res.status(403).json({ message: "Sem permissão" });
      const id = parseInt(req.params.id);
      const { title, packId, imageUrl, tipo, ativo } = req.body;
      const updateData: Record<string, any> = {};
      if (typeof title === "string" && title.trim()) updateData.title = title.trim();
      if (packId !== undefined) {
        const pid = parseInt(String(packId));
        const [validPack] = await db.select().from(creativePacks)
          .where(and(eq(creativePacks.id, pid), eq(creativePacks.tenantId, req.tenantId!)));
        if (!validPack) return res.status(400).json({ message: "Pack inválido" });
        updateData.packId = pid;
      }
      if (typeof imageUrl === "string" && imageUrl.trim()) updateData.imageUrl = imageUrl.trim();
      if (typeof tipo === "string") updateData.tipo = tipo;
      if (ativo !== undefined) updateData.ativo = Boolean(ativo);
      const [updated] = await db.update(creatives).set(updateData)
        .where(and(eq(creatives.id, id), eq(creatives.tenantId, req.tenantId!)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Criativo não encontrado" });
      res.json(updated);
    } catch (error) {
      console.error("PUT /api/creatives/:id error:", error);
      res.status(500).json({ message: "Erro ao atualizar criativo" });
    }
  });

  app.delete("/api/creatives/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.user!.role;
      if (role !== "master" && role !== "coordenacao") return res.status(403).json({ message: "Sem permissão" });
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(creatives)
        .where(and(eq(creatives.id, id), eq(creatives.tenantId, req.tenantId!)));
      if (!existing) return res.status(404).json({ message: "Criativo não encontrado" });
      await db.delete(creatives).where(and(eq(creatives.id, id), eq(creatives.tenantId, req.tenantId!)));
      res.json({ message: "Criativo removido" });
    } catch (error) {
      console.error("DELETE /api/creatives/:id error:", error);
      res.status(500).json({ message: "Erro ao remover criativo" });
    }
  });

  // ===== EMPRESAS (NOTA PROMISSÓRIA) =====

  app.get("/api/companies", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ message: "Tenant não identificado" });
      const isMasterUser = req.user?.isMaster;
      const allCompanies = isMasterUser
        ? await storage.getAllCompanies(tenantId)
        : await storage.getActiveCompanies(tenantId);
      res.json(allCompanies);
    } catch (error) {
      console.error("GET /api/companies error:", error);
      res.status(500).json({ message: "Erro ao listar empresas" });
    }
  });

  app.post("/api/companies", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user?.isMaster) {
        return res.status(403).json({ message: "Apenas administradores podem criar empresas" });
      }
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ message: "Tenant não identificado" });
      const parsed = insertCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      }
      const company = await storage.createCompany(tenantId, parsed.data);
      res.status(201).json(company);
    } catch (error) {
      console.error("POST /api/companies error:", error);
      res.status(500).json({ message: "Erro ao criar empresa" });
    }
  });

  app.put("/api/companies/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user?.isMaster) {
        return res.status(403).json({ message: "Apenas administradores podem editar empresas" });
      }
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ message: "Tenant não identificado" });
      const id = parseInt(req.params.id);
      const existing = await storage.getCompany(id, tenantId);
      if (!existing) return res.status(404).json({ message: "Empresa não encontrada" });
      const parsed = insertCompanySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      }
      const updated = await storage.updateCompany(id, tenantId, parsed.data);
      res.json(updated);
    } catch (error) {
      console.error("PUT /api/companies/:id error:", error);
      res.status(500).json({ message: "Erro ao atualizar empresa" });
    }
  });

  app.delete("/api/companies/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user?.isMaster) {
        return res.status(403).json({ message: "Apenas administradores podem desativar empresas" });
      }
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ message: "Tenant não identificado" });
      const id = parseInt(req.params.id);
      const existing = await storage.getCompany(id, tenantId);
      if (!existing) return res.status(404).json({ message: "Empresa não encontrada" });
      const updated = await storage.softDeleteCompany(id, tenantId);
      res.json(updated);
    } catch (error) {
      console.error("DELETE /api/companies/:id error:", error);
      res.status(500).json({ message: "Erro ao desativar empresa" });
    }
  });

  // ===== NOTAS PROMISSÓRIAS =====

  app.get("/api/promissory-notes", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ message: "Tenant não identificado" });
      const filters: { companyId?: number; startDate?: string; endDate?: string; page?: number; limit?: number } = {};
      if (req.query.companyId) filters.companyId = parseInt(req.query.companyId as string);
      if (req.query.startDate) filters.startDate = req.query.startDate as string;
      if (req.query.endDate) filters.endDate = req.query.endDate as string;
      if (req.query.page) filters.page = parseInt(req.query.page as string);
      if (req.query.limit) filters.limit = Math.min(parseInt(req.query.limit as string), 100);
      const result = await storage.getPromissoryNotes(tenantId, filters);
      res.json(result);
    } catch (error) {
      console.error("GET /api/promissory-notes error:", error);
      res.status(500).json({ message: "Erro ao listar notas promissórias" });
    }
  });

  app.get("/api/promissory-notes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ message: "Tenant não identificado" });
      const id = parseInt(req.params.id);
      const note = await storage.getPromissoryNote(id, tenantId);
      if (!note) return res.status(404).json({ message: "Nota promissória não encontrada" });
      res.json(note);
    } catch (error) {
      console.error("GET /api/promissory-notes/:id error:", error);
      res.status(500).json({ message: "Erro ao buscar nota promissória" });
    }
  });

  const createPromissoryNoteBodySchema = z.object({
    companyId: z.number({ coerce: true }).positive("Empresa é obrigatória"),
    devedorNome: z.string().min(1, "Nome do devedor é obrigatório"),
    devedorCpf: z.string().min(11, "CPF inválido"),
    devedorEndereco: z.string().min(1, "Endereço do devedor é obrigatório"),
    valor: z.string().refine((val) => parseFloat(val) > 0, { message: "Valor deve ser positivo" }),
    dataVencimento: z.string().min(1, "Data de vencimento é obrigatória"),
    localPagamento: z.string().nullable().optional(),
    multaPercentual: z.string().optional().default("2"),
    jurosPercentual: z.string().optional().default("1"),
    bancoOrigem: z.string().nullable().optional(),
    dataPagamento: z.string().nullable().optional(),
    descricao: z.string().nullable().optional(),
    prazoProtesto: z.number({ coerce: true }).optional().default(5),
  });

  app.post("/api/promissory-notes", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(400).json({ message: "Tenant não identificado" });

      const parsed = createPromissoryNoteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      }
      const data = parsed.data;

      const company = await storage.getCompany(data.companyId, tenantId);
      if (!company || !company.isActive) {
        return res.status(400).json({ message: "Empresa não encontrada ou inativa" });
      }

      const today = new Date();
      const dataEmissao = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const localEmissao = `${company.cidade}/${company.uf}`;

      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const npNumber = await storage.getNextNpNumber(tenantId);
          const note = await storage.createPromissoryNote(tenantId, {
            npNumber,
            companyId: company.id,
            companyRazaoSocial: company.razaoSocial,
            companyCnpj: company.cnpj,
            companyCidade: company.cidade,
            companyUf: company.uf,
            devedorNome: data.devedorNome,
            devedorCpf: data.devedorCpf,
            devedorEndereco: data.devedorEndereco,
            valor: data.valor,
            dataVencimento: data.dataVencimento,
            localPagamento: data.localPagamento || null,
            multaPercentual: data.multaPercentual || "2",
            jurosPercentual: data.jurosPercentual || "1",
            bancoOrigem: data.bancoOrigem || null,
            dataPagamento: data.dataPagamento || null,
            descricao: data.descricao || null,
            prazoProtesto: data.prazoProtesto || 5,
            localEmissao,
            dataEmissao,
            emitidoPorId: req.user!.id,
            emitidoPorNome: req.user!.name,
          });
          return res.status(201).json(note);
        } catch (insertError: any) {
          const isUniqueViolation = insertError?.code === "23505" ||
            insertError?.message?.includes("idx_np_number_tenant") ||
            insertError?.message?.includes("unique") ||
            insertError?.message?.includes("duplicate");
          if (isUniqueViolation && attempt < maxRetries - 1) {
            continue;
          }
          throw insertError;
        }
      }
      res.status(409).json({ message: "Conflito de numeração após múltiplas tentativas. Tente novamente." });
    } catch (error: any) {
      console.error("POST /api/promissory-notes error:", error);
      res.status(500).json({ message: "Erro ao criar nota promissória" });
    }
  });

  // ===== CRIADOR DE CRIATIVOS =====

  function todayBR(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async function getQuotaRecord(userId: number, date: string) {
    const [row] = await db
      .select()
      .from(creativeGenerationQuota)
      .where(and(eq(creativeGenerationQuota.userId, userId), eq(creativeGenerationQuota.date, date)));
    return row ?? null;
  }

  app.get("/api/creatives/quota", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.user!.isMaster) {
        return res.json({ used: 0, limit: null, resetsAt: null, unlimited: true });
      }
      const today = todayBR();
      const row = await getQuotaRecord(req.user!.id, today);
      const used = row?.count ?? 0;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const resetsAt = tomorrow.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " às 00:00";
      return res.json({ used, limit: 5, resetsAt });
    } catch (err) {
      console.error("GET /api/creatives/quota error:", err);
      return res.status(500).json({ message: "Erro ao consultar cota" });
    }
  });

  app.post("/api/creatives/generate", requireAuth, async (req: Request, res: Response) => {
    try {
      const today = todayBR();
      const userId = req.user!.id;

      // Check quota (master users have no limit)
      const isMaster = req.user!.isMaster;
      const quotaRow = isMaster ? null : await getQuotaRecord(userId, today);
      const used = quotaRow?.count ?? 0;
      if (!isMaster && used >= 5) {
        return res.status(429).json({ message: "Você atingiu o limite de 5 criações por dia. Tente novamente amanhã." });
      }

      const { prompt, formato, personalizable } = req.body;
      if (!prompt || !formato) {
        return res.status(400).json({ message: "Preencha todos os campos obrigatórios" });
      }

      // Create pending record
      const [gen] = await db.insert(creativeGenerations).values({
        tenantId: req.tenantId!,
        userId,
        promptUsed: "",
        formData: req.body,
        status: "pending",
      }).returning();

      // Generate images
      const { buildImagePrompt, sanitizePrompt } = await import("./services/creativePromptService");
      const { generateImages } = await import("./services/imagenService");
      const aspectRatio = formato; // formato value IS the aspectRatio (e.g. "1:1", "9:16")

      // Load brand config (global, single row)
      const brandRows = await db.select().from(creativeBrandConfig).limit(1);
      const brandCfg = brandRows[0]
        ? { systemPrompt: brandRows[0].systemPrompt || "", logoBase64: brandRows[0].logoBase64 || undefined }
        : { systemPrompt: "" };

      const cleanPrompt = await sanitizePrompt(prompt);
      const builtPrompt = buildImagePrompt(cleanPrompt, aspectRatio, !!personalizable, brandCfg);
      let imageUrls: string[];
      try {
        imageUrls = await generateImages(builtPrompt, aspectRatio);
      } catch (genErr: any) {
        await db.update(creativeGenerations).set({ status: "error" }).where(eq(creativeGenerations.id, gen.id));
        console.error("Image generation error:", genErr?.message);
        return res.status(502).json({ message: genErr?.message || "Erro ao gerar imagens. Tente novamente." });
      }

      // Update record
      await db.update(creativeGenerations).set({
        promptUsed: builtPrompt,
        imageUrls,
        status: "generated",
      }).where(eq(creativeGenerations.id, gen.id));

      // Increment quota ONLY after success, and only for non-master users
      if (!isMaster) {
        await db.execute(
          sql`INSERT INTO creative_generation_quota (user_id, date, count) VALUES (${userId}, ${today}, 1)
              ON CONFLICT (user_id, date) DO UPDATE SET count = creative_generation_quota.count + 1`
        );
      }

      return res.status(201).json({
        generationId: gen.id,
        images: imageUrls,
        quotaUsed: used + 1,
        quotaLimit: 5,
      });
    } catch (err: any) {
      console.error("POST /api/creatives/generate error:", err);
      return res.status(500).json({ message: "Erro interno ao gerar criativo" });
    }
  });

  // ─── Brand Config ─────────────────────────────────────────────────────────

  app.get("/api/creatives/brand-config", requireAuth, async (req: Request, res: Response) => {
    try {
      const [row] = await db.select().from(creativeBrandConfig).limit(1);
      if (!row) {
        return res.json({ systemPrompt: "", logoUrl: null, hasLogo: false });
      }
      return res.json({
        systemPrompt: row.systemPrompt || "",
        logoUrl: row.logoUrl || null,
        hasLogo: !!row.logoUrl,
      });
    } catch (err) {
      console.error("GET /api/creatives/brand-config error:", err);
      return res.status(500).json({ message: "Erro ao carregar configuração de marca" });
    }
  });

  app.post("/api/creatives/brand-config", requireAuth, upload.single("logo"), async (req: Request, res: Response) => {
    try {
      if (!req.user!.isMaster) {
        return res.status(403).json({ message: "Acesso negado: apenas administradores podem configurar a marca" });
      }

      const { systemPrompt = "" } = req.body;

      let logoUrl: string | null = null;
      let logoBase64: string | null = null;

      if (req.file) {
        const mime = req.file.mimetype || "image/png";
        const b64 = req.file.buffer.toString("base64");
        logoBase64 = b64;
        logoUrl = `data:${mime};base64,${b64}`;
      }

      // Check if a row exists
      const [existing] = await db.select({ id: creativeBrandConfig.id }).from(creativeBrandConfig).limit(1);

      if (existing) {
        const updateData: Record<string, any> = {
          systemPrompt,
          updatedAt: new Date(),
          updatedBy: req.user!.id,
        };
        if (logoUrl !== null) {
          updateData.logoUrl = logoUrl;
          updateData.logoBase64 = logoBase64;
        }
        await db.update(creativeBrandConfig).set(updateData).where(eq(creativeBrandConfig.id, existing.id));
      } else {
        await db.insert(creativeBrandConfig).values({
          systemPrompt,
          logoUrl,
          logoBase64,
          updatedBy: req.user!.id,
        });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("POST /api/creatives/brand-config error:", err);
      return res.status(500).json({ message: "Erro ao salvar configuração de marca" });
    }
  });

  app.delete("/api/creatives/brand-config/logo", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user!.isMaster) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const [existing] = await db.select({ id: creativeBrandConfig.id }).from(creativeBrandConfig).limit(1);
      if (existing) {
        await db.update(creativeBrandConfig).set({ logoUrl: null, logoBase64: null, updatedAt: new Date(), updatedBy: req.user!.id }).where(eq(creativeBrandConfig.id, existing.id));
      }
      return res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/creatives/brand-config/logo error:", err);
      return res.status(500).json({ message: "Erro ao remover logo" });
    }
  });

  // ─── Save Generation ───────────────────────────────────────────────────────

  app.post("/api/creatives/save-generation", requireAuth, async (req: Request, res: Response) => {
    try {
      const { generationId, selectedImageUrl, name, packId } = req.body;
      if (!generationId || !selectedImageUrl || !name || !packId) {
        return res.status(400).json({ message: "Dados incompletos para salvar" });
      }

      // Verify generation belongs to this tenant
      const [gen] = await db.select().from(creativeGenerations)
        .where(and(eq(creativeGenerations.id, Number(generationId)), eq(creativeGenerations.tenantId, req.tenantId!)));
      if (!gen) return res.status(404).json({ message: "Geração não encontrada" });

      // Save to main creatives gallery
      const [saved] = await db.insert(creatives).values({
        tenantId: req.tenantId!,
        packId: Number(packId),
        title: name,
        imageUrl: selectedImageUrl,
        tipo: "personalizado",
        ativo: true,
        createdBy: req.user!.id,
      }).returning();

      // Mark generation as saved
      await db.update(creativeGenerations).set({ selectedImageUrl, status: "saved" })
        .where(eq(creativeGenerations.id, Number(generationId)));

      return res.status(201).json(saved);
    } catch (err) {
      console.error("POST /api/creatives/save-generation error:", err);
      return res.status(500).json({ message: "Erro ao salvar criativo" });
    }
  });

  // ===== CENTRAL DE ATUALIZAÇÕES =====

  // POST /api/system-updates/generate — gera conteúdo com IA a partir de raw_input
  app.post("/api/system-updates/generate", requireAuth, requireMaster, async (req: any, res) => {
    try {
      const rawInput = req.body.rawInput ?? req.body.raw_input;
      if (!rawInput || typeof rawInput !== "string" || rawInput.trim().length < 10) {
        return res.status(400).json({ message: "raw_input é obrigatório e deve ter pelo menos 10 caracteres" });
      }

      const { openai } = await import("./openaiClient");
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `Você é um comunicador interno de uma empresa de crédito consignado chamada Capital Go.
Com base no texto técnico fornecido (output de um sistema de desenvolvimento),
reescreva em linguagem simples e direta para os colaboradores da empresa.
Retorne APENAS um JSON válido com exatamente estas 3 chaves:
{
  "content_what": "O que foi atualizado (2-3 frases simples)",
  "content_how": "Como funciona agora (passo a passo simples, máx 4 itens)",
  "content_impact": "Como isso impacta seu dia a dia (1-2 frases diretas)"
}`,
          },
          {
            role: "user",
            content: `Texto técnico:\n${rawInput.trim()}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      });

      const jsonText = completion.choices[0].message.content || "{}";
      const parsed = JSON.parse(jsonText);

      if (!parsed.content_what || !parsed.content_how || !parsed.content_impact) {
        return res.status(500).json({ message: "A IA não retornou os campos esperados" });
      }

      return res.json({
        contentWhat: parsed.content_what,
        contentHow: parsed.content_how,
        contentImpact: parsed.content_impact,
      });
    } catch (err: any) {
      console.error("[SystemUpdates] Erro ao gerar conteúdo:", err);
      return res.status(500).json({ message: "Erro ao gerar conteúdo com IA" });
    }
  });

  // GET /api/system-updates — lista todas (master only)
  app.get("/api/system-updates", requireAuth, requireMaster, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const result = await db.execute(sql`
        SELECT
          su.*,
          u.name AS created_by_name,
          (
            SELECT COUNT(*)::int FROM system_update_reads sur WHERE sur.update_id = su.id
          ) AS reads_count,
          (
            SELECT COUNT(*)::int FROM users us
            INNER JOIN user_tenants ut ON ut.user_id = us.id
            WHERE ut.tenant_id = ${tenantId}
              AND us.is_active = true
              AND (
                su.target_roles && ARRAY[us.role::text] OR 'todos' = ANY(su.target_roles)
              )
          ) AS target_count
        FROM system_updates su
        LEFT JOIN users u ON u.id = su.created_by
        WHERE su.tenant_id = ${tenantId}
        ORDER BY su.published_at DESC
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[SystemUpdates] Erro ao listar:", err);
      res.status(500).json({ message: "Erro ao listar atualizações" });
    }
  });

  // POST /api/system-updates — criar nova (master only)
  app.post("/api/system-updates", requireAuth, requireMaster, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { title, rawInput, contentWhat, contentHow, contentImpact, targetRoles, isActive, imageUrls } = req.body;

      if (!title || !rawInput || !contentWhat || !contentHow || !contentImpact || !Array.isArray(targetRoles) || targetRoles.length === 0) {
        return res.status(400).json({ message: "Campos obrigatórios: title, rawInput, contentWhat, contentHow, contentImpact, targetRoles" });
      }

      const rolesPgArray = '{' + (targetRoles as string[]).map(r => `"${r}"`).join(',') + '}';
      const imgArr: string[] = Array.isArray(imageUrls) ? imageUrls.slice(0, 5) : [];
      const imgPgArray = imgArr.length === 0 ? '{}' : '{' + imgArr.map((s: string) => `"${s}"`).join(',') + '}';

      const result = await db.execute(sql`
        INSERT INTO system_updates (tenant_id, title, raw_input, content_what, content_how, content_impact, target_roles, image_urls, is_active, created_by)
        VALUES (${tenantId}, ${title}, ${rawInput}, ${contentWhat}, ${contentHow}, ${contentImpact}, ${rolesPgArray}::text[], ${imgPgArray}::text[], ${isActive !== false}, ${req.user!.id})
        RETURNING *
      `);
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("[SystemUpdates] Erro ao criar:", err);
      res.status(500).json({ message: "Erro ao criar atualização" });
    }
  });

  // PUT /api/system-updates/:id — editar (master only)
  app.put("/api/system-updates/:id", requireAuth, requireMaster, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const { title, rawInput, contentWhat, contentHow, contentImpact, targetRoles, isActive, imageUrls } = req.body;

      if (!title || !rawInput || !contentWhat || !contentHow || !contentImpact || !Array.isArray(targetRoles)) {
        return res.status(400).json({ message: "Campos obrigatórios faltando" });
      }

      const rolesPgArray = '{' + (targetRoles as string[]).map(r => `"${r}"`).join(',') + '}';
      const imgArr: string[] = Array.isArray(imageUrls) ? imageUrls.slice(0, 5) : [];
      const imgPgArray = imgArr.length === 0 ? '{}' : '{' + imgArr.map((s: string) => `"${s}"`).join(',') + '}';

      const result = await db.execute(sql`
        UPDATE system_updates SET
          title = ${title},
          raw_input = ${rawInput},
          content_what = ${contentWhat},
          content_how = ${contentHow},
          content_impact = ${contentImpact},
          target_roles = ${rolesPgArray}::text[],
          image_urls = ${imgPgArray}::text[],
          is_active = ${isActive !== false}
        WHERE id = ${parseInt(id)} AND tenant_id = ${tenantId}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Atualização não encontrada" });
      }
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("[SystemUpdates] Erro ao editar:", err);
      res.status(500).json({ message: "Erro ao editar atualização" });
    }
  });

  // DELETE /api/system-updates/:id — remover (master only)
  app.delete("/api/system-updates/:id", requireAuth, requireMaster, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      await db.execute(sql`
        DELETE FROM system_updates WHERE id = ${parseInt(id)} AND tenant_id = ${tenantId}
      `);
      res.json({ message: "Atualização removida com sucesso" });
    } catch (err: any) {
      console.error("[SystemUpdates] Erro ao remover:", err);
      res.status(500).json({ message: "Erro ao remover atualização" });
    }
  });

  // GET /api/system-updates/pending — atualizações não lidas pelo usuário logado
  app.get("/api/system-updates/pending", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const result = await db.execute(sql`
        SELECT su.*
        FROM system_updates su
        WHERE su.tenant_id = ${tenantId}
          AND su.is_active = true
          AND (su.target_roles && ARRAY[${user.role}::text] OR 'todos' = ANY(su.target_roles))
          AND NOT EXISTS (
            SELECT 1 FROM system_update_reads sur
            WHERE sur.update_id = su.id AND sur.user_id = ${user.id}
          )
        ORDER BY su.published_at ASC
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[SystemUpdates] Erro ao buscar pendentes:", err);
      res.status(500).json({ message: "Erro ao buscar atualizações pendentes" });
    }
  });

  // POST /api/system-updates/:id/read — registra confirmação de leitura
  app.post("/api/system-updates/:id/read", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const updateId = parseInt(id);

      // Verify update exists, belongs to this tenant, is active, and targets this user
      const check = await db.execute(sql`
        SELECT id FROM system_updates
        WHERE id = ${updateId}
          AND tenant_id = ${tenantId}
          AND is_active = true
          AND (target_roles && ARRAY[${user.role}::text] OR 'todos' = ANY(target_roles))
      `);

      if (check.rows.length === 0) {
        return res.status(404).json({ message: "Atualização não encontrada ou não aplicável" });
      }

      await db.execute(sql`
        INSERT INTO system_update_reads (update_id, user_id)
        VALUES (${updateId}, ${user.id})
        ON CONFLICT (update_id, user_id) DO NOTHING
      `);
      res.json({ message: "Leitura registrada" });
    } catch (err: any) {
      console.error("[SystemUpdates] Erro ao registrar leitura:", err);
      res.status(500).json({ message: "Erro ao registrar leitura" });
    }
  });

  // GET /api/system-updates/:id/reads — quem leu (master only, tenant-scoped)
  app.get("/api/system-updates/:id/reads", requireAuth, requireMaster, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const updateId = parseInt(id);

      // Verify update belongs to this tenant before returning reader data
      const ownerCheck = await db.execute(sql`
        SELECT id FROM system_updates WHERE id = ${updateId} AND tenant_id = ${tenantId}
      `);
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ message: "Atualização não encontrada" });
      }

      const result = await db.execute(sql`
        SELECT sur.read_at, u.name AS user_name, u.role AS user_role
        FROM system_update_reads sur
        INNER JOIN users u ON u.id = sur.user_id
        WHERE sur.update_id = ${updateId}
        ORDER BY sur.read_at ASC
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[SystemUpdates] Erro ao buscar leituras:", err);
      res.status(500).json({ message: "Erro ao buscar leituras" });
    }
  });

  // ===== CARTEIRA DE CLIENTES =====

  // GET /api/portfolio/rules — listar regras de prazo
  app.get("/api/portfolio/rules", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const result = await db.execute(sql`
        SELECT id, product_type, duration_months, updated_at
        FROM portfolio_rules
        WHERE tenant_id = ${tenantId}
        ORDER BY product_type
      `);
      interface PortfolioRuleRow { id: number; product_type: string; duration_months: number; updated_at: string | null; }
      const ALL_PRODUCT_TYPES = ["CARTAO", "CONSIGNADO", "NOVO", "PORTABILIDADE", "REFINANCIAMENTO"];
      const defaultDuration: Record<string, number> = {
        CARTAO: 3, CONSIGNADO: 6, NOVO: 6, PORTABILIDADE: 6, REFINANCIAMENTO: 6,
      };
      const typedRows = result.rows as PortfolioRuleRow[];
      const merged = ALL_PRODUCT_TYPES.map(pt => {
        const found = typedRows.find(r => r.product_type === pt);
        return found ?? { product_type: pt, duration_months: defaultDuration[pt], id: null as number | null, updated_at: null as string | null };
      });
      res.json(merged);
    } catch (err: any) {
      res.status(500).json({ message: "Erro ao listar regras de carteira" });
    }
  });

  // PUT /api/portfolio/rules/simulation-coefs — salvar coeficientes padrão da simulação rápida (master only)
  app.put("/api/portfolio/rules/simulation-coefs", requireAuth, async (req: any, res) => {
    try {
      if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso restrito ao master" });
      const tenantId = req.tenantId!;
      const { consignado, cartao_credito, cartao_beneficio } = req.body;
      const toDecimal = (v: any) => (v != null && v !== "" ? parseFloat(v) : null);
      await db.execute(sql`
        UPDATE portfolio_rules
        SET
          default_coef_consignado = ${toDecimal(consignado)},
          default_coef_cartao_credito = ${toDecimal(cartao_credito)},
          default_coef_cartao_beneficio = ${toDecimal(cartao_beneficio)},
          updated_at = NOW()
        WHERE tenant_id = ${tenantId}
      `);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Erro ao salvar coeficientes" });
    }
  });

  // PUT /api/portfolio/rules/:productType — editar prazo por produto (master only)
  app.put("/api/portfolio/rules/:productType", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;
      if (!user.isMaster && user.role !== "master") {
        return res.status(403).json({ message: "Acesso restrito ao administrador master" });
      }
      const productType = req.params.productType.toUpperCase();
      const { durationMonths } = req.body;
      if (!durationMonths || isNaN(Number(durationMonths)) || Number(durationMonths) < 1) {
        return res.status(400).json({ message: "Prazo inválido" });
      }
      await db.execute(sql`
        INSERT INTO portfolio_rules (tenant_id, product_type, duration_months, updated_by, updated_at)
        VALUES (${tenantId}, ${productType}, ${Number(durationMonths)}, ${user.id}, NOW())
        ON CONFLICT (tenant_id, product_type)
        DO UPDATE SET duration_months = ${Number(durationMonths)}, updated_by = ${user.id}, updated_at = NOW()
      `);
      res.json({ message: "Regra atualizada com sucesso" });
    } catch (err: any) {
      res.status(500).json({ message: "Erro ao atualizar regra de carteira" });
    }
  });

  // GET /api/portfolio/check/:cpf — verifica bloqueio de CPF
  app.get("/api/portfolio/check/:cpf", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;
      const cpf = req.params.cpf;
      const result = await checkPortfolioBlock(tenantId, cpf, user.id, user.role);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Erro ao verificar carteira" });
    }
  });

  // GET /api/portfolio/stats — estatísticas da carteira (master/coordenacao only)
  app.get("/api/portfolio/stats", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;
      if (!user.isMaster && user.role !== "master" && user.role !== "coordenacao") {
        return res.status(403).json({ message: "Sem permissão" });
      }

      const totalR = await db.execute(sql`
        SELECT COUNT(*) AS total FROM client_portfolio
        WHERE tenant_id = ${tenantId} AND status = 'ATIVO'
      `);
      const produtoR = await db.execute(sql`
        SELECT product_type, COUNT(*) AS cnt
        FROM client_portfolio
        WHERE tenant_id = ${tenantId} AND status = 'ATIVO'
        GROUP BY product_type ORDER BY cnt DESC
      `);
      const convenioR = await db.execute(sql`
        SELECT pc.convenio, COUNT(DISTINCT cp.cpf) AS cnt
        FROM client_portfolio cp
        JOIN (
          SELECT DISTINCT ON (cpf_cliente) cpf_cliente, convenio
          FROM producoes_contratos
          WHERE tenant_id = ${tenantId} AND convenio IS NOT NULL AND convenio != ''
          ORDER BY cpf_cliente, id DESC
        ) pc ON pc.cpf_cliente = cp.cpf
        WHERE cp.tenant_id = ${tenantId} AND cp.status = 'ATIVO'
        GROUP BY pc.convenio ORDER BY cnt DESC LIMIT 5
      `);
      const bancoR = await db.execute(sql`
        SELECT pc.banco, COUNT(DISTINCT cp.cpf) AS cnt
        FROM client_portfolio cp
        JOIN (
          SELECT DISTINCT ON (cpf_cliente) cpf_cliente, banco
          FROM producoes_contratos
          WHERE tenant_id = ${tenantId} AND banco IS NOT NULL AND banco != ''
          ORDER BY cpf_cliente, id DESC
        ) pc ON pc.cpf_cliente = cp.cpf
        WHERE cp.tenant_id = ${tenantId} AND cp.status = 'ATIVO'
        GROUP BY pc.banco ORDER BY cnt DESC LIMIT 5
      `);
      const ufR = await db.execute(sql`
        SELECT cl.uf, COUNT(DISTINCT cp.cpf) AS cnt
        FROM client_portfolio cp
        JOIN clientes_pessoa cl ON cl.cpf = cp.cpf
          AND cl.uf IS NOT NULL AND cl.uf != ''
        WHERE cp.tenant_id = ${tenantId} AND cp.status = 'ATIVO'
        GROUP BY cl.uf ORDER BY cnt DESC LIMIT 5
      `);
      const orgaoR = await db.execute(sql`
        SELECT cl.orgaodesc, COUNT(DISTINCT cp.cpf) AS cnt
        FROM client_portfolio cp
        JOIN clientes_pessoa cl ON cl.cpf = cp.cpf
          AND cl.orgaodesc IS NOT NULL AND cl.orgaodesc != ''
        WHERE cp.tenant_id = ${tenantId} AND cp.status = 'ATIVO'
        GROUP BY cl.orgaodesc ORDER BY cnt DESC LIMIT 5
      `);

      const toMap = (rows: any[], keyField: string) =>
        Object.fromEntries(rows.map((r: any) => [r[keyField], Number(r.cnt)]));

      res.json({
        total: Number((totalR.rows[0] as any)?.total ?? 0),
        por_produto: toMap(produtoR.rows as any[], "product_type"),
        por_convenio: toMap(convenioR.rows as any[], "convenio"),
        por_banco: toMap(bancoR.rows as any[], "banco"),
        por_uf: toMap(ufR.rows as any[], "uf"),
        por_orgao: toMap(orgaoR.rows as any[], "orgaodesc"),
      });
    } catch (err: any) {
      console.error("[PORTFOLIO] stats error:", err);
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  // GET /api/portfolio — carteira do usuário logado (role-gated)
  // Returns one entry per CPF (the one with MAX(expires_at)), with enriched fields:
  //   convenio, telefone (null—not in producoes_contratos yet), last_deal_at,
  //   days_without_deal (vendedor view), days_remaining (master/coord view)
  app.get("/api/portfolio", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;
      const { vendorId, status: statusFilter, product } = req.query as Record<string, string>;

      if (user.role === "vendedor") {
        const result = await db.execute(sql`
          WITH latest_per_cpf AS (
            SELECT DISTINCT ON (cp.cpf)
              cp.id, cp.cpf, cp.client_name, cp.vendor_id, cp.product_type,
              cp.status, cp.expires_at, cp.started_at, cp.created_at,
              u.name AS vendor_name
            FROM client_portfolio cp
            JOIN users u ON u.id = cp.vendor_id
            WHERE cp.tenant_id = ${tenantId}
              AND cp.vendor_id = ${user.id}
            ORDER BY cp.cpf, cp.expires_at DESC
          ),
          last_deal AS (
            SELECT
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf,
              MAX(pc.created_at) AS last_deal_at
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId}
              AND pc.cpf_cliente IS NOT NULL AND pc.cpf_cliente != ''
            GROUP BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g')
          ),
          conv AS (
            SELECT DISTINCT ON (REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'))
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf_norm,
              pc.convenio
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId} AND pc.convenio IS NOT NULL AND pc.convenio != ''
            ORDER BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'), pc.id DESC
          ),
          banco_cte AS (
            SELECT DISTINCT ON (REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'))
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf_norm,
              pc.banco
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId} AND pc.banco IS NOT NULL AND pc.banco != ''
            ORDER BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'), pc.id DESC
          ),
          tel_cte AS (
            SELECT DISTINCT ON (REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'))
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf_norm,
              pc.telefone_cliente
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId}
              AND pc.telefone_cliente IS NOT NULL AND pc.telefone_cliente != ''
            ORDER BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'), pc.id DESC
          ),
          deals_count AS (
            SELECT
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf,
              COUNT(pc.id)::int AS total_deals
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId}
              AND pc.cpf_cliente IS NOT NULL AND pc.cpf_cliente != ''
            GROUP BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g')
          )
          SELECT
            lpc.*,
            conv.convenio,
            tel_cte.telefone_cliente AS telefone,
            banco_cte.banco,
            COALESCE(dc.total_deals, 0)::int AS total_deals,
            (COALESCE(dc.total_deals, 0) > 1) AS is_recorrente,
            ld.last_deal_at,
            EXTRACT(DAY FROM NOW() - ld.last_deal_at)::int AS days_without_deal,
            EXTRACT(DAY FROM lpc.expires_at - NOW())::int AS days_remaining
          FROM latest_per_cpf lpc
          LEFT JOIN last_deal ld ON ld.cpf = lpc.cpf
          LEFT JOIN conv ON conv.cpf_norm = lpc.cpf
          LEFT JOIN banco_cte ON banco_cte.cpf_norm = lpc.cpf
          LEFT JOIN tel_cte ON tel_cte.cpf_norm = lpc.cpf
          LEFT JOIN deals_count dc ON dc.cpf = lpc.cpf
          ORDER BY lpc.expires_at ASC
        `);
        return res.json(result.rows);
      } else if (user.role === "coordenacao") {
        const filterVendorId = vendorId ? Number(vendorId) : null;
        const result = await db.execute(sql`
          WITH latest_per_cpf AS (
            SELECT DISTINCT ON (cp.cpf)
              cp.id, cp.cpf, cp.client_name, cp.vendor_id, cp.product_type,
              cp.status, cp.expires_at, cp.started_at, cp.created_at,
              u.name AS vendor_name
            FROM client_portfolio cp
            JOIN users u ON u.id = cp.vendor_id
            WHERE cp.tenant_id = ${tenantId}
              AND cp.status = 'ATIVO'
              AND u.manager_id = ${user.id}
              ${filterVendorId ? sql`AND cp.vendor_id = ${filterVendorId}` : sql``}
            ORDER BY cp.cpf, cp.expires_at DESC
          ),
          last_deal AS (
            SELECT
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf,
              MAX(pc.created_at) AS last_deal_at
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId}
              AND pc.cpf_cliente IS NOT NULL AND pc.cpf_cliente != ''
            GROUP BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g')
          ),
          conv AS (
            SELECT DISTINCT ON (REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'))
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf_norm,
              pc.convenio
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId} AND pc.convenio IS NOT NULL AND pc.convenio != ''
            ORDER BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'), pc.id DESC
          ),
          banco_cte AS (
            SELECT DISTINCT ON (REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'))
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf_norm,
              pc.banco
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId} AND pc.banco IS NOT NULL AND pc.banco != ''
            ORDER BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'), pc.id DESC
          ),
          tel_cte AS (
            SELECT DISTINCT ON (REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'))
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf_norm,
              pc.telefone_cliente
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId}
              AND pc.telefone_cliente IS NOT NULL AND pc.telefone_cliente != ''
            ORDER BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'), pc.id DESC
          ),
          deals_count AS (
            SELECT
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf,
              COUNT(pc.id)::int AS total_deals
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId}
              AND pc.cpf_cliente IS NOT NULL AND pc.cpf_cliente != ''
            GROUP BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g')
          )
          SELECT
            lpc.*,
            conv.convenio,
            tel_cte.telefone_cliente AS telefone,
            banco_cte.banco,
            COALESCE(dc.total_deals, 0)::int AS total_deals,
            (COALESCE(dc.total_deals, 0) > 1) AS is_recorrente,
            ld.last_deal_at,
            EXTRACT(DAY FROM NOW() - ld.last_deal_at)::int AS days_without_deal,
            EXTRACT(DAY FROM lpc.expires_at - NOW())::int AS days_remaining
          FROM latest_per_cpf lpc
          LEFT JOIN last_deal ld ON ld.cpf = lpc.cpf
          LEFT JOIN conv ON conv.cpf_norm = lpc.cpf
          LEFT JOIN banco_cte ON banco_cte.cpf_norm = lpc.cpf
          LEFT JOIN tel_cte ON tel_cte.cpf_norm = lpc.cpf
          LEFT JOIN deals_count dc ON dc.cpf = lpc.cpf
          ORDER BY lpc.expires_at ASC
        `);
        return res.json(result.rows);
      } else {
        // master — all with optional filters, grouped by CPF
        const result = await db.execute(sql`
          WITH latest_per_cpf AS (
            SELECT DISTINCT ON (cp.cpf)
              cp.id, cp.cpf, cp.client_name, cp.vendor_id, cp.product_type,
              cp.status, cp.expires_at, cp.started_at, cp.created_at,
              u.name AS vendor_name
            FROM client_portfolio cp
            JOIN users u ON u.id = cp.vendor_id
            WHERE cp.tenant_id = ${tenantId}
              ${statusFilter ? sql`AND cp.status = ${statusFilter.toUpperCase()}` : sql`AND cp.status = 'ATIVO'`}
              ${vendorId ? sql`AND cp.vendor_id = ${Number(vendorId)}` : sql``}
              ${product ? sql`AND cp.product_type = ${product.toUpperCase()}` : sql``}
            ORDER BY cp.cpf, cp.expires_at DESC
          ),
          last_deal AS (
            SELECT
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf,
              MAX(pc.created_at) AS last_deal_at
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId}
              AND pc.cpf_cliente IS NOT NULL AND pc.cpf_cliente != ''
            GROUP BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g')
          ),
          conv AS (
            SELECT DISTINCT ON (REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'))
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf_norm,
              pc.convenio
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId} AND pc.convenio IS NOT NULL AND pc.convenio != ''
            ORDER BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'), pc.id DESC
          ),
          banco_cte AS (
            SELECT DISTINCT ON (REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'))
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf_norm,
              pc.banco
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId} AND pc.banco IS NOT NULL AND pc.banco != ''
            ORDER BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'), pc.id DESC
          ),
          tel_cte AS (
            SELECT DISTINCT ON (REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'))
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf_norm,
              pc.telefone_cliente
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId}
              AND pc.telefone_cliente IS NOT NULL AND pc.telefone_cliente != ''
            ORDER BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g'), pc.id DESC
          ),
          deals_count AS (
            SELECT
              REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g') AS cpf,
              COUNT(pc.id)::int AS total_deals
            FROM producoes_contratos pc
            WHERE pc.tenant_id = ${tenantId}
              AND pc.cpf_cliente IS NOT NULL AND pc.cpf_cliente != ''
            GROUP BY REGEXP_REPLACE(pc.cpf_cliente, '[^0-9]', '', 'g')
          )
          SELECT
            lpc.*,
            conv.convenio,
            tel_cte.telefone_cliente AS telefone,
            banco_cte.banco,
            COALESCE(dc.total_deals, 0)::int AS total_deals,
            (COALESCE(dc.total_deals, 0) > 1) AS is_recorrente,
            ld.last_deal_at,
            EXTRACT(DAY FROM NOW() - ld.last_deal_at)::int AS days_without_deal,
            EXTRACT(DAY FROM lpc.expires_at - NOW())::int AS days_remaining
          FROM latest_per_cpf lpc
          LEFT JOIN last_deal ld ON ld.cpf = lpc.cpf
          LEFT JOIN conv ON conv.cpf_norm = lpc.cpf
          LEFT JOIN banco_cte ON banco_cte.cpf_norm = lpc.cpf
          LEFT JOIN tel_cte ON tel_cte.cpf_norm = lpc.cpf
          LEFT JOIN deals_count dc ON dc.cpf = lpc.cpf
          ORDER BY lpc.expires_at ASC
        `);
        return res.json(result.rows);
      }
    } catch (err: any) {
      console.error("[PORTFOLIO] GET /api/portfolio error:", err);
      res.status(500).json({ message: "Erro ao listar carteira" });
    }
  });

  // POST /api/portfolio/transfer — transferir cliente (master only)
  app.post("/api/portfolio/transfer", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;
      if (!user.isMaster && user.role !== "master") {
        return res.status(403).json({ message: "Acesso restrito ao administrador master" });
      }
      const { portfolioId, toVendorId, reason } = req.body;
      if (!portfolioId || !toVendorId) {
        return res.status(400).json({ message: "portfolioId e toVendorId são obrigatórios" });
      }
      const toVendorIdNum = Number(toVendorId);
      if (!Number.isInteger(toVendorIdNum) || toVendorIdNum <= 0) {
        return res.status(400).json({ message: "toVendorId inválido" });
      }

      // Verify portfolio entry exists and belongs to tenant
      const portfolioRows = await db.execute(sql`
        SELECT * FROM client_portfolio WHERE id = ${portfolioId} AND tenant_id = ${tenantId} LIMIT 1
      `);
      if (portfolioRows.rows.length === 0) {
        return res.status(404).json({ message: "Entrada de carteira não encontrada" });
      }
      const portfolio = portfolioRows.rows[0] as any;

      // Prevent self-transfer
      if (portfolio.vendor_id === toVendorIdNum) {
        return res.status(400).json({ message: "Vendedor de destino é o mesmo que o atual" });
      }

      // Verify target vendor exists and belongs to same tenant (users table has no tenant_id — use user_tenants)
      const targetVendorRows = await db.execute(sql`
        SELECT u.id FROM users u
        JOIN user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = ${tenantId}
        WHERE u.id = ${toVendorIdNum} AND u.is_active = true
        LIMIT 1
      `);
      if (targetVendorRows.rows.length === 0) {
        return res.status(400).json({ message: "Vendedor de destino não encontrado neste ambiente" });
      }

      await db.execute(sql`
        INSERT INTO portfolio_transfers
          (tenant_id, portfolio_id, from_vendor_id, to_vendor_id, transferred_by, reason, transferred_at)
        VALUES
          (${tenantId}, ${portfolioId}, ${portfolio.vendor_id}, ${toVendorIdNum}, ${user.id}, ${reason || null}, NOW())
      `);

      await db.execute(sql`
        UPDATE client_portfolio SET vendor_id = ${toVendorIdNum} WHERE id = ${portfolioId}
      `);

      res.json({ message: "Cliente transferido com sucesso" });
    } catch (err: any) {
      console.error("[PORTFOLIO] transfer error:", err);
      res.status(500).json({ message: "Erro ao transferir cliente" });
    }
  });

  // GET /api/portfolio/transfers/:portfolioId — histórico de transferências
  app.get("/api/portfolio/transfers/:portfolioId", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;
      if (!["master", "coordenacao"].includes(user.role) && !user.isMaster) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      const portfolioId = Number(req.params.portfolioId);
      const result = await db.execute(sql`
        SELECT pt.*,
          uf.name as from_vendor_name,
          ut.name as to_vendor_name,
          ub.name as transferred_by_name
        FROM portfolio_transfers pt
        JOIN users uf ON uf.id = pt.from_vendor_id
        JOIN users ut ON ut.id = pt.to_vendor_id
        JOIN users ub ON ub.id = pt.transferred_by
        WHERE pt.portfolio_id = ${portfolioId} AND pt.tenant_id = ${tenantId}
        ORDER BY pt.transferred_at DESC
      `);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: "Erro ao listar transferências" });
    }
  });

  // ===== OBSERVAÇÕES COMPLEMENTARES POR CPF =====

  app.get("/api/client-observations/:cpf", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const cpf = req.params.cpf.replace(/[^0-9]/g, "");
      if (!cpf) return res.status(400).json({ message: "CPF inválido" });
      const result = await db.execute(sql`
        SELECT id, cpf, observation, imported_at
        FROM client_observations
        WHERE tenant_id = ${tenantId}
          AND REGEXP_REPLACE(cpf, '[^0-9]', '', 'g') = ${cpf}
        ORDER BY imported_at DESC
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Sem observação" });
      }
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: "Erro ao buscar observação" });
    }
  });

  app.post("/api/client-observations/import", requireAuth, upload.single("file"), async (req: any, res) => {
    try {
      const role = req.user?.role as string;
      const allowed = req.user?.isMaster || ["master", "coordenacao", "financeiro"].includes(role);
      if (!allowed) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "Arquivo CSV não enviado" });
      }

      const tenantId = req.tenantId!;
      const userId = req.user!.id;

      // Try UTF-8 first, fall back to Latin-1 (Windows-1252) common in Brazilian Excel exports
      let content: string;
      try {
        content = req.file.buffer.toString("utf-8");
        // Heuristic: if replacement char appears, likely wrong encoding
        if (content.includes("\uFFFD")) throw new Error("bad utf8");
      } catch {
        content = req.file.buffer.toString("latin1");
      }
      // Strip UTF-8 BOM if present
      content = content.replace(/^\uFEFF/, "");

      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      if (lines.length === 0) {
        return res.status(400).json({ message: "Arquivo vazio" });
      }

      // Auto-detect delimiter: semicolon (Brazilian Excel) or comma
      const firstLine = lines[0];
      const delimiter = (firstLine.split(";").length >= firstLine.split(",").length) ? ";" : ",";

      // Detect header row
      const header = firstLine.toLowerCase().split(delimiter).map(h => h.trim().replace(/"/g, "").replace(/\uFEFF/g, ""));
      const cpfIdx = header.findIndex(h => h === "cpf");
      const obsIdx = header.findIndex(h => h === "observacao" || h === "observação");

      if (cpfIdx === -1 || obsIdx === -1) {
        return res.status(400).json({ message: "CSV deve ter colunas 'cpf' e 'observacao'" });
      }

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Simple CSV split respecting quoted fields (uses auto-detected delimiter)
        const cols: string[] = [];
        let inQuote = false;
        let cur = "";
        for (const ch of line) {
          if (ch === '"') { inQuote = !inQuote; }
          else if (ch === delimiter && !inQuote) { cols.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        cols.push(cur.trim());

        const rawCpf = (cols[cpfIdx] || "").replace(/"/g, "").trim();
        const obs = (cols[obsIdx] || "").replace(/"/g, "").trim();
        if (!rawCpf || !obs) { errors++; continue; }

        const cpf = rawCpf.replace(/[^0-9]/g, "");
        if (cpf.length < 11) { errors++; continue; }

        try {
          const insertResult = await db.execute(sql`
            INSERT INTO client_observations (tenant_id, cpf, observation, imported_by, imported_at)
            VALUES (${tenantId}, ${cpf}, ${obs}, ${userId}, NOW())
            ON CONFLICT (tenant_id, cpf, observation) DO NOTHING
            RETURNING id
          `);
          if (insertResult.rows.length > 0) {
            imported++;
          } else {
            skipped++;
          }
        } catch {
          errors++;
        }
      }

      res.json({ imported, skipped, errors });
    } catch (err: any) {
      res.status(500).json({ message: "Erro ao importar observações" });
    }
  });

  // ===== SIMULAÇÃO RÁPIDA DE MARGEM =====
  app.get("/api/simulation/best-coefficients", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const result = await db.execute(sql`
        SELECT default_coef_consignado, default_coef_cartao_credito, default_coef_cartao_beneficio
        FROM portfolio_rules
        WHERE tenant_id = ${tenantId}
        LIMIT 1
      `);
      const row = result.rows[0] as {
        default_coef_consignado: string | null;
        default_coef_cartao_credito: string | null;
        default_coef_cartao_beneficio: string | null;
      } | undefined;
      const toNum = (v: string | null | undefined) => (v != null ? parseFloat(v) : null);
      res.json({
        consignado: toNum(row?.default_coef_consignado),
        cartao_credito: toNum(row?.default_coef_cartao_credito),
        cartao_beneficio: toNum(row?.default_coef_cartao_beneficio),
      });
    } catch (err: any) {
      res.status(500).json({ message: "Erro ao buscar coeficientes" });
    }
  });

  // ===== MÓDULO DE CONTRATOS =====
  registerContractRoutes(app, requireAuth);

  const httpServer = createServer(app);
  return httpServer;
}
