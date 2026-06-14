import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { db } from "./storage";
import { apiKeys } from "@shared/schema";
import { eq, and } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      apiTenantId?: number;
      apiKeyId?: number;
    }
  }
}

const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(hash: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(hash);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(hash, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const raw =
    (req.headers["x-api-key"] as string | undefined) ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!raw) {
    return res.status(401).json({ error: "API key ausente. Envie no header X-API-Key." });
  }

  const hash = hashApiKey(raw);

  if (!checkRateLimit(hash)) {
    return res.status(429).json({ error: "Rate limit excedido. Máximo 120 requisições/minuto." });
  }

  try {
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.chaveHash, hash), eq(apiKeys.ativo, true)))
      .limit(1);

    if (!key) {
      return res.status(401).json({ error: "API key inválida ou desativada." });
    }

    // Fire-and-forget — não bloqueia a resposta
    db.update(apiKeys)
      .set({ ultimoUso: new Date(), totalRequisicoes: key.totalRequisicoes + 1 })
      .where(eq(apiKeys.id, key.id))
      .catch(() => {});

    req.apiTenantId = key.tenantId;
    req.apiKeyId = key.id;
    next();
  } catch (err) {
    console.error("[requireApiKey] erro:", err);
    return res.status(500).json({ error: "Erro interno ao validar API key." });
  }
}
