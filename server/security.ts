/**
 * security.ts — Camadas de proteção do Capital Go CRM
 *
 * Inclui:
 * - Rate limiters por rota e por usuário
 * - Bloqueio de conta após tentativas erradas
 * - Limite de sessões simultâneas por usuário
 * - Detecção de bots / automação
 * - Detecção de comportamento suspeito (scraping em massa)
 * - Log de auditoria
 * - Proteção de acesso ao /uploads
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { db } from "./storage";
import { users, auditLog } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import {
  sendAccountLockedAlert,
  sendSuspiciousLoginAlert,
  sendScrapingDetectedAlert,
} from "./email-service";

// ─────────────────────────────────────────────────────────────────────────────
// 1. RATE LIMITERS
// ─────────────────────────────────────────────────────────────────────────────

// Em desenvolvimento, todos os rate limiters são desativados automaticamente.
// Você trabalha sem restrições. Em produção, tudo ativo.
const isDev = process.env.NODE_ENV !== "production";
const skipInDev = () => isDev;

/**
 * Login: máximo 5 tentativas por IP a cada 15 minutos.
 * Não conta tentativas bem-sucedidas.
 * DESATIVADO em desenvolvimento.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  skip: skipInDev,
  skipSuccessfulRequests: true, // só conta falhas
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente.",
  },
  keyGenerator: (req: Request) => {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      ipKeyGenerator(req)
    );
  },
});

/**
 * API global: máximo 300 requisições por IP por minuto.
 * DESATIVADO em desenvolvimento.
 */
export const globalApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  skip: skipInDev,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas requisições. Aguarde um momento." },
  keyGenerator: (req: Request) => {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      ipKeyGenerator(req)
    );
  },
});

/**
 * Rotas sensíveis (SIAPE, consulta de cliente):
 * máximo 30 req por usuário por minuto.
 * DESATIVADO em desenvolvimento.
 */
export const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: skipInDev,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Velocidade de consulta muito alta. Aguarde um momento antes de continuar.",
  },
  keyGenerator: (req: Request) => {
    const userId = (req as any).session?.userId;
    if (userId) return `user:${userId}`;
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      ipKeyGenerator(req)
    );
  },
});

/**
 * Upload de arquivos: máximo 10 por usuário por minuto.
 * DESATIVADO em desenvolvimento.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: skipInDev,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitos uploads em pouco tempo. Aguarde." },
  keyGenerator: (req: Request) => {
    const userId = (req as any).session?.userId;
    if (userId) return `user:${userId}`;
    return ipKeyGenerator(req);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DETECÇÃO DE BOTS E AUTOMAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * User-Agents conhecidos de scripts, bibliotecas de automação e scraping.
 * Bloqueados apenas em produção para não atrapalhar desenvolvimento.
 */
const BLOCKED_USER_AGENTS = [
  "python-requests",
  "python-urllib",
  "python-httpx",
  "aiohttp",
  "curl/",
  "wget/",
  "go-http-client",
  "java/",
  "okhttp",
  "scrapy",
  "mechanize",
  "httpie",
  "axios/0", // axios direto sem header de browser (Node.js)
  "node-fetch",
  "node-axios",
  "undici",
];

export function botDetection(req: Request, res: Response, next: NextFunction) {
  // Só bloqueia em produção
  if (process.env.NODE_ENV !== "production") return next();

  const ua = (req.headers["user-agent"] || "").toLowerCase();

  // Bloqueia ausência de User-Agent (bots primitivos)
  if (!ua || ua.trim() === "") {
    return res.status(403).json({ message: "Acesso não autorizado." });
  }

  // Bloqueia User-Agents conhecidos de automação
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (ua.includes(blocked)) {
      return res.status(403).json({ message: "Acesso não autorizado." });
    }
  }

  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DETECÇÃO DE COMPORTAMENTO SUSPEITO (SCRAPING EM MASSA)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rastreia volume de consultas por usuário em janela deslizante.
 * Se um usuário fizer mais de 60 consultas em 1 minuto, bloqueia
 * temporariamente. Isso é além do rate limiter padrão — detecta
 * padrões de scraping sequencial de CPFs.
 */
const userQueryWindows = new Map<
  string,
  { count: number; windowStart: number; blocked: boolean; blockedUntil: number }
>();

export function scrapingDetection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Sem restrição em desenvolvimento
  if (isDev) return next();

  const userId = (req as any).session?.userId;
  if (!userId) return next();

  const key = String(userId);
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const maxQueriesPerWindow = 60;
  const blockDurationMs = 5 * 60 * 1000; // bloqueia por 5 minutos se detectado

  const entry = userQueryWindows.get(key);

  // Se usuário está bloqueado por comportamento suspeito
  if (entry?.blocked && now < entry.blockedUntil) {
    return res.status(429).json({
      message:
        "Comportamento suspeito detectado. Acesso temporariamente suspenso.",
    });
  }

  // Nova janela ou janela expirada
  if (!entry || now - entry.windowStart > windowMs) {
    userQueryWindows.set(key, {
      count: 1,
      windowStart: now,
      blocked: false,
      blockedUntil: 0,
    });
    return next();
  }

  // Incrementa contador
  entry.count++;

  if (entry.count > maxQueriesPerWindow) {
    // Marca como bloqueado
    entry.blocked = true;
    entry.blockedUntil = now + blockDurationMs;
    userQueryWindows.set(key, entry);

    console.warn(
      `[SECURITY] Possível scraping detectado — userId: ${userId}, ` +
        `${entry.count} consultas em 1 minuto. Bloqueado por 5 min.`
    );

    return res.status(429).json({
      message:
        "Velocidade de consulta anormal detectada. Acesso suspenso por 5 minutos.",
    });
  }

  next();
}

// Limpa o mapa de janelas a cada 10 minutos para não vazar memória
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of Array.from(userQueryWindows.entries())) {
      if (now - entry.windowStart > 10 * 60 * 1000 && !entry.blocked) {
        userQueryWindows.delete(key);
      }
    }
  },
  10 * 60 * 1000
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. BLOQUEIO DE CONTA APÓS SENHAS ERRADAS
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutos
const WARN_AT_ATTEMPT = 3; // Envia alerta de email a partir da 3ª tentativa

/**
 * Verifica se o usuário está bloqueado.
 * Retorna { blocked: true, minutesLeft } ou { blocked: false }.
 */
export async function checkAccountLock(
  userId: number
): Promise<{ blocked: boolean; minutesLeft?: number }> {
  const result = await db
    .select({ lockedUntil: users.lockedUntil, loginAttempts: users.loginAttempts })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!result.length) return { blocked: false };

  const { lockedUntil } = result[0];
  if (!lockedUntil) return { blocked: false };

  const now = new Date();
  if (lockedUntil > now) {
    const minutesLeft = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
    return { blocked: true, minutesLeft };
  }

  // Bloqueio expirou — zera os campos
  await db
    .update(users)
    .set({ loginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, userId));

  return { blocked: false };
}

/**
 * Registra uma tentativa de login falha.
 * Bloqueia a conta após MAX_LOGIN_ATTEMPTS e envia alertas por email.
 */
export async function recordFailedLogin(
  userId: number,
  email: string,
  ip: string,
  userAgent: string
): Promise<void> {
  const result = await db
    .update(users)
    .set({ loginAttempts: sql`login_attempts + 1` })
    .where(eq(users.id, userId))
    .returning({ loginAttempts: users.loginAttempts });

  const attempts = result[0]?.loginAttempts ?? 0;

  // Alerta na 3ª tentativa (sem bloquear ainda)
  if (attempts === WARN_AT_ATTEMPT) {
    sendSuspiciousLoginAlert(email, ip, userAgent).catch(() => {});
    console.warn(
      `[SECURITY] ${WARN_AT_ATTEMPT} tentativas falhas para ${email} (IP: ${ip})`
    );
  }

  // Bloqueia na 5ª tentativa
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    await db
      .update(users)
      .set({ lockedUntil })
      .where(eq(users.id, userId));

    sendAccountLockedAlert(email, ip, attempts).catch(() => {});
    console.warn(
      `[SECURITY] Conta bloqueada: ${email} (${attempts} tentativas, IP: ${ip})`
    );
  }
}

/**
 * Zera o contador de tentativas após login bem-sucedido.
 */
export async function resetLoginAttempts(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ loginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, userId));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CONTROLE DE SESSÃO EXCLUSIVA POR NAVEGADOR
// ─────────────────────────────────────────────────────────────────────────────
//
// REGRA:
//   - Múltiplas abas no mesmo navegador → compartilham o mesmo cookie de sessão
//     (mesmo sessionId) → todas funcionam normalmente ✅
//   - Novo navegador (Chrome, Firefox, celular, etc.) → gera novo sessionId
//     → derruba a sessão anterior automaticamente ✅
//
// Como funciona: guardamos somente o sessionId ativo de cada usuário.
// Se uma requisição chegar com sessionId diferente do registrado, o antigo
// é invalidado e o novo assume.

// userId -> sessionId ativo
const activeSessionByUser = new Map<number, string>();

/**
 * Registra o sessionId ativo do usuário (chamado no login).
 * Se já havia outro sessionId, ele é derrubado — o novo assume.
 */
export function registerSession(userId: number, sessionId: string): void {
  const previous = activeSessionByUser.get(userId);
  if (previous && previous !== sessionId) {
    console.warn(
      `[SECURITY] userId ${userId} logou em novo navegador — sessão anterior derrubada.`
    );
  }
  activeSessionByUser.set(userId, sessionId);
}

/**
 * Remove o registro de sessão ao fazer logout.
 */
export function unregisterSession(userId: number, sessionId: string): void {
  if (activeSessionByUser.get(userId) === sessionId) {
    activeSessionByUser.delete(userId);
  }
}

/**
 * Verifica se a sessão atual foi deslocada por outro navegador.
 *
 * Retorna TRUE se a sessão deve ser bloqueada (outro navegador assumiu).
 * Retorna FALSE se a sessão é válida (mesmas abas ou primeiro acesso).
 *
 * Lógica:
 * - Tabs do mesmo navegador compartilham o mesmo cookie → mesmo sessionId → FALSE ✅
 * - Outro navegador (ou celular) gera sessionId diferente → TRUE, derruba ✅
 * - Restart do servidor limpa o mapa → primeira requisição registra e retorna FALSE ✅
 */
export function isSessionDisplaced(userId: number, sessionId: string): boolean {
  const activeId = activeSessionByUser.get(userId);

  // Sem registro ainda (restart do servidor) → registra e deixa passar
  if (!activeId) {
    activeSessionByUser.set(userId, sessionId);
    return false;
  }

  // Mesma sessão (mesmas abas) → OK
  if (activeId === sessionId) return false;

  // Sessão diferente → foi deslocada por outro navegador
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. LOG DE AUDITORIA
// ─────────────────────────────────────────────────────────────────────────────

interface AuditEntry {
  tenantId?: number;
  userId?: number;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Registra uma ação no log de auditoria.
 * Falha silenciosamente para não impactar o fluxo principal.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  // Em desenvolvimento, só loga no console para não poluir o banco
  if (isDev) {
    console.log(`[AUDIT] ${entry.action}`, {
      userId: entry.userId,
      entityId: entry.entityId,
    });
    return;
  }

  try {
    await db.insert(auditLog).values({
      tenantId: entry.tenantId ?? null,
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (err) {
    // Nunca deixa falha de auditoria derrubar a requisição
    console.error("[AUDIT] Erro ao salvar log:", err);
  }
}

/**
 * Helper: extrai IP real da requisição.
 */
export function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PROTEÇÃO DO DIRETÓRIO /uploads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica se a requisição tem sessão válida antes de servir arquivos do /uploads.
 * Impede acesso a arquivos privados sem autenticação.
 */
/**
 * Logos, favicons e arquivos de branding são públicos por natureza —
 * aparecem na tela de login antes de qualquer autenticação.
 * Apenas outros uploads (documentos, CSVs, etc.) exigem sessão.
 */
const PUBLIC_UPLOAD_PATTERNS = [
  /\/(logo|favicon|brand|logo_login|logo_menu)/i,
  /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,
];

export function requireSessionForUploads(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Imagens e logos são públicos (necessário para tela de login)
  const isPublicAsset = PUBLIC_UPLOAD_PATTERNS.some((p) => p.test(req.path));
  if (isPublicAsset) return next();

  // Demais arquivos exigem autenticação
  const userId = (req as any).session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Autenticação necessária." });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. HEADERS DE SEGURANÇA ADICIONAIS (complementa o helmet)
// ─────────────────────────────────────────────────────────────────────────────

export function additionalSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Remove header que revela tecnologia do servidor
  res.removeHeader("X-Powered-By");

  // Impede que o navegador adivinhe o tipo de conteúdo
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Permite iframe apenas do mesmo domínio (SAMEORIGIN protege de clickjacking externo
  // e ainda permite iframes internos como o Simulador de Contracheque)
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Força HTTPS por 1 ano em produção
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
}
