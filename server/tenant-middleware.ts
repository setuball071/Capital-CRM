import type { Request, Response, NextFunction } from "express";
import { db } from "./storage";
import { tenants, tenantDomains, userTenants, users, type Tenant, type User } from "@shared/schema";
import { eq, and } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantId?: number;
    }
  }
}

export async function resolveTenantByDomain(domain: string): Promise<Tenant | null> {
  const cleanDomain = domain.replace(/^www\./, "").split(":")[0].toLowerCase();
  
  const result = await db
    .select({ tenant: tenants })
    .from(tenantDomains)
    .innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
    .where(eq(tenantDomains.domain, cleanDomain))
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
        res.status(404).json({ message: "Domínio não configurado" });
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
