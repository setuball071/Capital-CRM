/**
 * security.ts — Camadas de proteção do Capital Go CRM
 *
 * Inclui:
 * - Rate limiters por rota e por usuário
 * - Detecção de bots / automação
 * - Detecção de comportamento suspeito (scraping em massa)
 * - Proteção de acesso ao /uploads
 */

import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

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
      req.ip ||
      "unknown"
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
      req.ip ||
      "unknown"
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
      req.ip ||
      "unknown"
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
    return req.ip || "unknown";
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
// 4. PROTEÇÃO DO DIRETÓRIO /uploads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica se a requisição tem sessão válida antes de servir arquivos do /uploads.
 * Impede acesso a arquivos privados sem autenticação.
 */
export function requireSessionForUploads(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = (req as any).session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Autenticação necessária." });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. HEADERS DE SEGURANÇA ADICIONAIS (complementa o helmet)
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

  // Impede carregamento em iframe (clickjacking)
  res.setHeader("X-Frame-Options", "DENY");

  // Força HTTPS por 1 ano em produção
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
}
