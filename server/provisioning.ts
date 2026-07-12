// Provisionamento de ambiente cliente (Fase 5 — wizard "Novo Ambiente").
// Cria o tenant + seed de statuses/fases (copiados do ambiente interno, que é o
// template vivo) + usuário admin do cliente (role master, isMaster=false, senha
// temporária) + módulos do plano + assinatura (com recorrência Asaas se ativa)
// + domínio (subdomínio do curinga ou próprio via Railway API) + e-mail de
// credenciais (best-effort — a senha SEMPRE volta na resposta pro dono repassar).

import crypto from "crypto";
import bcrypt from "bcrypt";
import { db } from "./storage";
import { sql } from "drizzle-orm";

export interface ProvisionInput {
  nome: string;
  key: string;
  adminNome: string;
  adminEmail: string;
  plano?: string; // trial | basico | profissional | expert | enterprise
  statusAssinatura?: "trial" | "active" | "nenhuma";
  trialDays?: number;
  dominioTipo?: "subdominio" | "proprio" | "nenhum";
  dominioProprio?: string; // ex.: crm.empresa.com.br (quando dominioTipo=proprio)
}

export interface ProvisionResult {
  tenantId: number;
  adminUserId: number;
  senhaTemporaria: string;
  dominio: string | null;
  cnameAlvo: string | null;
  emailEnviado: boolean;
  warnings: string[];
}

function gerarSenhaTemporaria(): string {
  // 12 chars legíveis (sem ambíguos tipo 0/O, 1/l)
  const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(12))
    .map((b) => alfabeto[b % alfabeto.length])
    .join("");
}

export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  const warnings: string[] = [];
  const key = input.key.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!key || !input.nome || !input.adminNome || !input.adminEmail) {
    throw new Error("nome, key, adminNome e adminEmail são obrigatórios");
  }

  // Key e e-mail únicos
  const existingTenant = await db.execute(sql`SELECT id FROM tenants WHERE key = ${key}`);
  if (existingTenant.rows.length > 0) throw new Error(`Já existe um ambiente com a key "${key}"`);
  const existingUser = await db.execute(sql`SELECT id FROM users WHERE email = ${input.adminEmail}`);
  if (existingUser.rows.length > 0) throw new Error(`Já existe um usuário com o e-mail ${input.adminEmail}`);

  // 1) Tenant (cliente: interno=false, status ativo)
  const [tenant] = (await db.execute(sql`
    INSERT INTO tenants (key, name, is_active, interno, status)
    VALUES (${key}, ${input.nome}, true, false, 'ativo')
    RETURNING id
  `)).rows as any[];
  const tenantId = Number(tenant.id);

  // 2) Seed de statuses/fases de contrato copiados do ambiente interno (template vivo)
  const [template] = (await db.execute(
    sql`SELECT id FROM tenants WHERE interno = true ORDER BY id LIMIT 1`,
  )).rows as any[];
  if (template) {
    await db.execute(sql`
      INSERT INTO contract_statuses (tenant_id, key, label, color, ordem, allows_vendor_edit, is_final, return_status_key)
      SELECT ${tenantId}, key, label, color, ordem, allows_vendor_edit, is_final, return_status_key
      FROM contract_statuses WHERE tenant_id = ${template.id}
    `);
    await db.execute(sql`
      INSERT INTO contract_phases (tenant_id, name, color, statuses, ordem)
      SELECT ${tenantId}, name, color, statuses, ordem
      FROM contract_phases WHERE tenant_id = ${template.id}
    `);
  } else {
    warnings.push("Nenhum ambiente interno encontrado como template — statuses/fases não semeados.");
  }

  // 3) Usuário admin do cliente (role master, isMaster=false)
  const senhaTemporaria = gerarSenhaTemporaria();
  const passwordHash = await bcrypt.hash(senhaTemporaria, 10);
  const [admin] = (await db.execute(sql`
    INSERT INTO users (name, email, password_hash, role, is_active, is_master)
    VALUES (${input.adminNome}, ${input.adminEmail}, ${passwordHash}, 'master', true, false)
    RETURNING id
  `)).rows as any[];
  const adminUserId = Number(admin.id);
  await db.execute(sql`
    INSERT INTO user_tenants (user_id, tenant_id, role_in_tenant)
    VALUES (${adminUserId}, ${tenantId}, 'master')
  `);

  // 4) Módulos do plano (catálogo módulos×plano): procura um plano cadastrado com o
  // mesmo nome; sem match, deixa tenant_modulos vazio = todos os módulos ativos.
  if (input.plano) {
    const [planoRow] = (await db.execute(
      sql`SELECT id FROM planos WHERE LOWER(nome) = LOWER(${input.plano}) AND ativo = true LIMIT 1`,
    )).rows as any[];
    if (planoRow) {
      await db.execute(sql`
        INSERT INTO tenant_modulos (tenant_id, modulo_key, ativo)
        SELECT ${tenantId}, modulo_key, true FROM plano_modulos WHERE plano_id = ${planoRow.id}
        ON CONFLICT DO NOTHING
      `);
    } else {
      warnings.push(`Catálogo módulos×plano sem entrada para "${input.plano}" — todos os módulos ficaram liberados.`);
    }
  }

  // 5) Assinatura
  const statusAssinatura = input.statusAssinatura || "trial";
  if (statusAssinatura !== "nenhuma" && input.plano) {
    const now = new Date();
    const trialEndsAt =
      statusAssinatura === "trial"
        ? new Date(Date.now() + (input.trialDays || 7) * 86400000)
        : null;
    const periodEnd =
      statusAssinatura === "active"
        ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
        : null;
    await db.execute(sql`
      INSERT INTO subscriptions (tenant_id, plan, status, trial_ends_at, current_period_start, current_period_end, updated_at)
      VALUES (${tenantId}, ${input.plano}, ${statusAssinatura}, ${trialEndsAt},
        ${statusAssinatura === "active" ? now : null}, ${periodEnd}, NOW())
      ON CONFLICT (tenant_id) DO NOTHING
    `);

    // Recorrência no Asaas quando já nasce ativa e o plano tem preço fixo
    if (statusAssinatura === "active") {
      try {
        const { asaasConfigured, createCustomer, createSubscription } = await import("./asaas");
        const { PLAN_PRICES, PLAN_LABELS } = await import("@shared/schema");
        const precoCentavos = (PLAN_PRICES as Record<string, number | null>)[input.plano];
        if (!asaasConfigured()) {
          warnings.push("Asaas não configurado — assinatura criada sem recorrência no gateway.");
        } else if (!precoCentavos) {
          warnings.push(`Plano ${input.plano} sem preço fixo — recorrência não criada no Asaas.`);
        } else {
          const customer = await createCustomer({
            name: input.nome,
            email: input.adminEmail,
            externalReference: String(tenantId),
          });
          await db.execute(sql`UPDATE tenants SET asaas_customer_id = ${customer.id} WHERE id = ${tenantId}`);
          const subAsaas = await createSubscription({
            customer: customer.id,
            value: precoCentavos / 100,
            nextDueDate: periodEnd!.toISOString().slice(0, 10),
            description: `Assinatura ${(PLAN_LABELS as Record<string, string>)[input.plano] || input.plano} — Capital CRM`,
            externalReference: `subscription:tenant:${tenantId}`,
          });
          await db.execute(sql`
            UPDATE subscriptions SET gateway_customer_id = ${customer.id}, gateway_subscription_id = ${subAsaas.id}, updated_at = NOW()
            WHERE tenant_id = ${tenantId}
          `);
        }
      } catch (e: any) {
        warnings.push(`Asaas: ${e?.message || "falha ao criar recorrência"} (assinatura segue manual).`);
      }
    }
  }

  // 6) Domínio
  let dominio: string | null = null;
  let cnameAlvo: string | null = null;
  const dominioTipo = input.dominioTipo || "nenhum";
  if (dominioTipo === "subdominio") {
    const base = process.env.WILDCARD_BASE_DOMAIN;
    if (!base) {
      warnings.push("WILDCARD_BASE_DOMAIN não configurado — subdomínio não criado.");
    } else {
      dominio = `${key}.${base}`;
      await db.execute(sql`
        INSERT INTO tenant_domains (tenant_id, domain, is_primary) VALUES (${tenantId}, ${dominio}, true)
      `);
      // Coberto pelo wildcard no Railway — resolve na hora, sem chamada de API
    }
  } else if (dominioTipo === "proprio" && input.dominioProprio) {
    dominio = input.dominioProprio.toLowerCase().trim();
    await db.execute(sql`
      INSERT INTO tenant_domains (tenant_id, domain, is_primary) VALUES (${tenantId}, ${dominio}, true)
    `);
    try {
      const { railwayConfigured, addCustomDomain } = await import("./railway");
      if (railwayConfigured()) {
        const created = await addCustomDomain(dominio);
        cnameAlvo = created.cnameAlvo;
      } else {
        warnings.push("Railway API não configurada — registre o domínio próprio manualmente no painel do Railway.");
      }
    } catch (e: any) {
      warnings.push(`Railway: ${e?.message || "falha ao registrar domínio"} — registre manualmente no painel.`);
    }
  }

  // 7) E-mail de credenciais (best-effort; a senha sempre volta na resposta)
  let emailEnviado = false;
  try {
    const { sendMailTo } = await import("./email-service");
    const loginUrl = dominio ? `https://${dominio}` : "https://www.sistemacapital.com.br";
    emailEnviado = await sendMailTo(
      input.adminEmail,
      `Bem-vindo ao ${input.nome} — seus dados de acesso`,
      `<p>Olá, ${input.adminNome}!</p>
       <p>Seu ambiente <b>${input.nome}</b> está pronto.</p>
       <p><b>Acesso:</b> <a href="${loginUrl}">${loginUrl}</a><br/>
       <b>Login:</b> ${input.adminEmail}<br/>
       <b>Senha temporária:</b> ${senhaTemporaria}</p>
       <p>Troque a senha no primeiro acesso, em Perfil.</p>`,
      input.nome,
    );
  } catch (e) {
    console.error("[PROVISIONING] envio de credenciais falhou:", e);
  }

  return { tenantId, adminUserId, senhaTemporaria, dominio, cnameAlvo, emailEnviado, warnings };
}
