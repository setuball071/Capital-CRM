import { db } from "./storage";
import { sql } from "drizzle-orm";

export type PortfolioProductType =
  | "CARTAO"
  | "CONSIGNADO"
  | "NOVO"
  | "PORTABILIDADE"
  | "REFINANCIAMENTO";

export function mapTipoContratoToProductType(tipoContrato: string | null | undefined, isCartao?: boolean): PortfolioProductType {
  if (isCartao) return "CARTAO";
  if (!tipoContrato) return "CONSIGNADO";
  const t = tipoContrato.toUpperCase();
  if (t.includes("CART") || t.includes("CARD")) return "CARTAO";
  if (t.includes("PORTAB")) return "PORTABILIDADE";
  if (t.includes("REFIN")) return "REFINANCIAMENTO";
  if (t.includes("NOVO") || t.includes("NEW") || t.includes("EMPREST")) return "NOVO";
  return "CONSIGNADO";
}

async function getPortfolioDuration(tenantId: number, productType: PortfolioProductType): Promise<number> {
  const result = await db.execute(sql`
    SELECT duration_months FROM portfolio_rules
    WHERE tenant_id = ${tenantId} AND product_type = ${productType}
    LIMIT 1
  `);
  if (result.rows.length > 0) {
    return Number(result.rows[0].duration_months) || 6;
  }
  const defaults: Record<PortfolioProductType, number> = {
    CARTAO: 3,
    CONSIGNADO: 6,
    NOVO: 6,
    PORTABILIDADE: 6,
    REFINANCIAMENTO: 6,
  };
  return defaults[productType];
}

export async function addToPortfolio(
  tenantId: number,
  cpf: string,
  clientName: string | null,
  vendorId: number,
  productType: PortfolioProductType,
  origin: "IMPORTACAO" | "CONTRATO",
  originId: number | null,
): Promise<{ added: boolean; renewed: boolean }> {
  const cpfClean = cpf.replace(/\D/g, "").padStart(11, "0");
  const durationMonths = await getPortfolioDuration(tenantId, productType);

  const existing = await db.execute(sql`
    SELECT id, expires_at, status FROM client_portfolio
    WHERE tenant_id = ${tenantId}
      AND cpf = ${cpfClean}
      AND vendor_id = ${vendorId}
      AND product_type = ${productType}
    LIMIT 1
  `);

  if (existing.rows.length > 0) {
    const row = existing.rows[0] as { id: number; expires_at: string; status: string };
    const currentExpiry = new Date(row.expires_at);
    const newExpiry = new Date();
    newExpiry.setMonth(newExpiry.getMonth() + durationMonths);

    const keepExpiry = currentExpiry > newExpiry ? currentExpiry : newExpiry;

    await db.execute(sql`
      UPDATE client_portfolio
      SET expires_at = ${keepExpiry.toISOString()},
          status = 'ATIVO',
          client_name = COALESCE(${clientName}, client_name),
          origin = ${origin},
          origin_id = COALESCE(${originId}, origin_id)
      WHERE id = ${row.id}
    `);
    return { added: false, renewed: true };
  }

  // First-vendor-wins: if another vendor already has an active lock for this CPF+product, skip
  const otherActive = await db.execute(sql`
    SELECT id FROM client_portfolio
    WHERE tenant_id = ${tenantId}
      AND cpf = ${cpfClean}
      AND product_type = ${productType}
      AND vendor_id != ${vendorId}
      AND status = 'ATIVO'
      AND expires_at > NOW()
    LIMIT 1
  `);
  if (otherActive.rows.length > 0) {
    return { added: false, renewed: false };
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  await db.execute(sql`
    INSERT INTO client_portfolio
      (tenant_id, cpf, client_name, vendor_id, product_type, origin, origin_id, started_at, expires_at, status, created_at)
    VALUES
      (${tenantId}, ${cpfClean}, ${clientName}, ${vendorId}, ${productType}, ${origin}, ${originId}, NOW(), ${expiresAt.toISOString()}, 'ATIVO', NOW())
  `);
  return { added: true, renewed: false };
}

export async function checkPortfolioBlock(
  tenantId: number,
  cpf: string,
  currentVendorId: number,
  userRole?: string,
): Promise<{ blocked: boolean; message?: string }> {
  if (userRole === "coordenacao" || userRole === "master") {
    return { blocked: false };
  }

  const cpfClean = cpf.replace(/\D/g, "").padStart(11, "0");

  const result = await db.execute(sql`
    SELECT cp.id, u.name as vendor_name
    FROM client_portfolio cp
    JOIN users u ON u.id = cp.vendor_id
    WHERE cp.tenant_id = ${tenantId}
      AND cp.cpf = ${cpfClean}
      AND cp.status = 'ATIVO'
      AND cp.expires_at > NOW()
      AND cp.vendor_id != ${currentVendorId}
    LIMIT 1
  `);

  if (result.rows.length > 0) {
    return {
      blocked: true,
      message: "Esse cliente já possui vínculo ativo com outro vendedor. Favor alinhar com o supervisor.",
    };
  }

  return { blocked: false };
}

export async function updateExpiredPortfolios(tenantId?: number): Promise<number> {
  let result;
  if (tenantId) {
    result = await db.execute(sql`
      UPDATE client_portfolio
      SET status = 'EXPIRADO'
      WHERE expires_at < NOW()
        AND status = 'ATIVO'
        AND tenant_id = ${tenantId}
    `);
  } else {
    result = await db.execute(sql`
      UPDATE client_portfolio
      SET status = 'EXPIRADO'
      WHERE expires_at < NOW()
        AND status = 'ATIVO'
    `);
  }
  return (result as any).rowCount || 0;
}
