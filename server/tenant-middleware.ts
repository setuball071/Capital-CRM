import type { Request, Response, NextFunction } from "express";
import { db } from "./storage";
import { tenants, tenantDomains, userTenants, users, type Tenant, type User } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantId?: number;
    }
  }
}

export function normalizeDomain(domain: string): string {
  let clean = domain.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/^www\./, "");
  clean = clean.split(":")[0];
  clean = clean.split("/")[0];
  clean = clean.split("?")[0];
  return clean;
}

export async function resolveTenantByDomain(domain: string): Promise<Tenant | null> {
  const cleanDomain = normalizeDomain(domain);
  const withWww = `www.${cleanDomain}`;
  
  const result = await db
    .select({ tenant: tenants })
    .from(tenantDomains)
    .innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
    .where(or(
      eq(tenantDomains.domain, cleanDomain),
      eq(tenantDomains.domain, withWww)
    ))
    .limit(1);
  
  if (result.length === 0 || !result[0].tenant.isActive) {
    return null;
  }
  
  return result[0].tenant;
}

export async function checkUserTenantAccess(userId: number, tenantId: number): Promise<boolean> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (user.length === 0) {
    return false;
  }
  
  if (user[0].isMaster) {
    return true;
  }
  
  const access = await db
    .select()
    .from(userTenants)
    .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
    .limit(1);
  
  return access.length > 0;
}

export function resolveTenant(req: Request, res: Response, next: NextFunction) {
  const host = req.headers.host || "localhost";
  
  resolveTenantByDomain(host)
    .then((tenant) => {
      if (!tenant) {
        if (process.env.NODE_ENV === "development" && (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("replit"))) {
          next();
          return;
        }
        const normalizedHost = normalizeDomain(host);
        res.status(404).send(`
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Domínio não configurado</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
              .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; }
              h1 { color: #dc2626; margin-bottom: 1rem; }
              p { color: #666; margin-bottom: 0.5rem; }
              .domain { font-family: monospace; background: #f0f0f0; padding: 0.25rem 0.5rem; border-radius: 4px; }
              .instructions { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.9rem; color: #888; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Domínio não configurado</h1>
              <p>O domínio <span class="domain">${normalizedHost}</span> não está vinculado a nenhum ambiente.</p>
              <div class="instructions">
                <p>Para configurar este domínio:</p>
                <p>Acesse <strong>Administração → Ambientes</strong> e adicione o domínio ao ambiente desejado.</p>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      }
      
      req.tenant = tenant;
      req.tenantId = tenant.id;
      next();
    })
    .catch((error) => {
      console.error("Error resolving tenant:", error);
      res.status(500).json({ message: "Erro ao resolver tenant" });
    });
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantId && req.tenant) {
    req.tenantId = req.tenant.id;
  }
  
  if (!req.tenantId) {
    if (process.env.NODE_ENV === "development") {
      next();
      return;
    }
    return res.status(400).json({ message: "Tenant não identificado" });
  }
  
  next();
}

export async function validateTenantAccess(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  const tenantId = req.tenantId;
  
  if (!userId) {
    return next();
  }
  
  if (!tenantId) {
    if (process.env.NODE_ENV === "development") {
      return next();
    }
    return res.status(400).json({ message: "Tenant não identificado" });
  }
  
  try {
    const hasAccess = await checkUserTenantAccess(userId, tenantId);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: "Você não tem acesso a este ambiente. Por favor, verifique o domínio correto." 
      });
    }
    
    next();
  } catch (error) {
    console.error("Error validating tenant access:", error);
    res.status(500).json({ message: "Erro ao validar acesso" });
  }
}

export async function getTenantBranding(tenantId: number): Promise<Tenant | null> {
  const result = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.isActive, true)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function getUserTenants(userId: number): Promise<Tenant[]> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (user.length === 0) {
    return [];
  }
  
  if (user[0].isMaster) {
    return db.select().from(tenants).where(eq(tenants.isActive, true));
  }
  
  const result = await db
    .select({ tenant: tenants })
    .from(userTenants)
    .innerJoin(tenants, eq(userTenants.tenantId, tenants.id))
    .where(and(eq(userTenants.userId, userId), eq(tenants.isActive, true)));
  
  return result.map((r) => r.tenant);
}
