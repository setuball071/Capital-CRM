// ═══════════════════════════════════════════════════════════════════════════
// REGISTRO DE CONSULTA À BASE DE CLIENTES
//
// A base é compartilhada entre os tenants de propósito: é ela que dá valor à
// assinatura. O que NÃO é compartilhado (negociação, documento, simulação,
// digitação) já fica isolado pelo tenant_id de cada tabela.
//
// Falta saber QUEM consultou O QUÊ. Serve para duas coisas:
//   • medir  — quantas consultas cada assinante fez, para limitar ou cobrar;
//   • provar — se perguntarem o que uma empresa fez com dado de servidor
//     público, a resposta existe, com data, usuário e IP.
//
// Não cria tabela nova: usa o audit_log que já existe e que já previa a ação
// "consulta_cliente" (shared/schema.ts:4023) — só ninguém a gravava ainda.
// ═══════════════════════════════════════════════════════════════════════════
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "./storage";
import { logAudit, getClientIp } from "./security";

/** Ações que contam como consulta à base, para os relatórios abaixo. */
export const ACOES_CONSULTA = ["consulta_cliente", "consulta_siape"];

/**
 * Anota a consulta. Não devolve promessa de propósito: ninguém espera por ela e
 * uma falha aqui não pode virar erro na tela do corretor.
 *
 * @param origem de onde veio, em uma palavra: "vendas-busca", "port-cliente"…
 */
export function registrarConsultaCliente(
  req: any,
  dados: { cpf: unknown; origem: string; encontrado: boolean; integracao?: string },
): void {
  const cpf = String(dados.cpf ?? "").replace(/\D/g, "").slice(0, 11);
  if (!cpf) return;
  logAudit({
    tenantId: req?.tenantId ?? undefined,
    userId: req?.user?.id ?? req?.session?.userId ?? undefined,
    action: "consulta_cliente",
    entityType: "cpf",
    entityId: cpf,
    details: {
      origem: dados.origem,
      encontrado: dados.encontrado,
      ...(dados.integracao ? { integracao: dados.integracao } : {}),
    },
    ipAddress: getClientIp(req),
    userAgent: String(req?.headers?.["user-agent"] || ""),
  }).catch(() => {});
}

/** Relatório do registro — só master, e só do próprio tenant. */
export function registerConsultaClienteRoutes(app: Express, requireAuth: any) {
  app.get("/api/base/consultas", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      if (!(user.isMaster || user.role === "master")) {
        return res.status(403).json({ message: "Acesso restrito ao administrador master" });
      }
      const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias || "30"), 10) || 30));
      const tenantId = req.tenantId!;
      const desde = sql`NOW() - (${String(dias)} || ' days')::interval`;
      const acoes = sql`('consulta_cliente','consulta_siape')`;

      const porDia = await db.execute(sql`
        SELECT created_at::date AS dia, COUNT(*)::int AS total,
               COUNT(DISTINCT entity_id)::int AS cpfs
        FROM audit_log
        WHERE tenant_id = ${tenantId} AND action IN ${acoes} AND created_at >= ${desde}
        GROUP BY 1 ORDER BY 1 DESC
      `);

      // Sem usuário pode ser DUAS coisas bem diferentes: uma integração por chave
      // de API (nunca teve usuário) ou um usuário que foi apagado depois. O nome
      // da chave, quando existe, resolve — os dois não podem virar a mesma linha.
      const porUsuario = await db.execute(sql`
        SELECT
          COALESCE(
            u.name,
            a.details->>'integracao',
            CASE WHEN a.details->>'origem' = 'api-externa'
                 THEN 'Integração externa (chave sem nome)' END,
            '— usuário removido —'
          ) AS usuario,
          (a.details->>'origem' = 'api-externa') AS integracao,
          COUNT(*)::int AS total,
          COUNT(DISTINCT a.entity_id)::int AS cpfs
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.tenant_id = ${tenantId} AND a.action IN ${acoes} AND a.created_at >= ${desde}
        GROUP BY 1, 2 ORDER BY total DESC LIMIT 50
      `);

      const porOrigem = await db.execute(sql`
        SELECT COALESCE(details->>'origem', action) AS origem, COUNT(*)::int AS total
        FROM audit_log
        WHERE tenant_id = ${tenantId} AND action IN ${acoes} AND created_at >= ${desde}
        GROUP BY 1 ORDER BY total DESC
      `);

      res.json({
        dias,
        total: (porDia.rows as any[]).reduce((a, x) => a + Number(x.total || 0), 0),
        porDia: porDia.rows,
        porUsuario: porUsuario.rows,
        porOrigem: porOrigem.rows,
      });
    } catch (err: any) {
      console.error("[CONSULTA_CLIENTE] relatório:", err);
      res.status(500).json({ message: "Erro ao ler o registro de consultas" });
    }
  });
}
