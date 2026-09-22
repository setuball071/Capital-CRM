// ═══════════════════════════════════════════════════════════════════════════
// SIMULADOR DE COMPRA — tabelas próprias (separadas do módulo Financeiro).
//
// Qualquer usuário lê as tabelas ativas para simular. O PERCENTUAL é a
// comissão da empresa: só o master recebe (corretor NUNCA vê % empresa).
// Cadastrar, editar e desativar: só master. Nada é apagado — desativar tira
// a tabela do simulador e ela continua no histórico.
// ═══════════════════════════════════════════════════════════════════════════
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "./storage";
import { TABELAS_PLANILHA } from "../shared/compra/calculo";

const isMaster = (req: any) => Boolean(req.user?.isMaster || req.user?.role === "master");

/** número vindo da tela: aceita 0,0428 / 0.0428; vazio = null */
function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function validar(b: any): { ok: true; t: any } | { ok: false; msg: string } {
  const banco = String(b?.banco ?? "").trim();
  const coeficiente = numero(b?.coeficiente);
  const percentual = numero(b?.percentual);
  const prazo = numero(b?.prazo);
  if (!banco) return { ok: false, msg: "Informe o banco" };
  if (coeficiente === null || coeficiente <= 0 || coeficiente >= 1) return { ok: false, msg: "Coeficiente inválido (ex.: 0,042824888)" };
  if (percentual !== null && (percentual < 0 || percentual > 100)) return { ok: false, msg: "Percentual entre 0 e 100" };
  if (prazo !== null && (prazo <= 0 || prazo > 240 || !Number.isInteger(prazo))) return { ok: false, msg: "Prazo inválido" };
  return { ok: true, t: { banco, nome: String(b?.nome ?? "").trim() || null, coeficiente, percentual, prazo } };
}

const paraTela = (r: any, master: boolean) => ({
  id: r.id, banco: r.banco, nome: r.nome, coeficiente: Number(r.coeficiente),
  prazo: r.prazo, ativo: r.ativo,
  ...(master ? { percentual: r.percentual === null ? null : Number(r.percentual) } : {}),
});

export function registerSimuladorCompraRoutes(app: Express, requireAuth: any) {
  const tenantDe = (req: any, res: any): number | null => {
    const t = req.tenantId;
    if (!t) { res.status(400).json({ message: "Tenant não identificado" }); return null; }
    return t;
  };
  const exigeMaster = (req: any, res: any) => {
    if (isMaster(req)) return true;
    res.status(403).json({ message: "Só o master cadastra tabelas" });
    return false;
  };

  /** Tabelas para simular. Master pede ?todas=1 para ver também as desativadas. */
  app.get("/api/compra/tabelas", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId) return;
      const master = isMaster(req);
      const todas = master && req.query.todas === "1";
      const r = await db.execute(sql`
        SELECT * FROM compra_tabelas
        WHERE tenant_id = ${tenantId} ${todas ? sql`` : sql`AND ativo = TRUE`}
        ORDER BY lower(banco), id
      `);
      res.json({ tabelas: (r.rows as any[]).map(x => paraTela(x, master)), comissaoVisivel: master });
    } catch (err: any) {
      console.error("[COMPRA] GET tabelas:", err);
      res.status(500).json({ message: "Erro ao carregar tabelas" });
    }
  });

  app.post("/api/compra/tabelas", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const v = validar(req.body); if (!v.ok) return res.status(400).json({ message: v.msg });
      const { banco, nome, coeficiente, percentual, prazo } = v.t;
      const r = await db.execute(sql`
        INSERT INTO compra_tabelas (tenant_id, banco, nome, coeficiente, percentual, prazo, criado_por)
        VALUES (${tenantId}, ${banco}, ${nome}, ${coeficiente}, ${percentual}, ${prazo}, ${req.user?.id ?? null})
        RETURNING *
      `);
      res.json(paraTela(r.rows[0], true));
    } catch (err: any) {
      console.error("[COMPRA] POST tabela:", err);
      res.status(500).json({ message: "Erro ao salvar a tabela" });
    }
  });

  app.patch("/api/compra/tabelas/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const id = Number(req.params.id);
      // só troca ativo/inativo
      if (Object.keys(req.body || {}).length === 1 && typeof req.body.ativo === "boolean") {
        const r = await db.execute(sql`
          UPDATE compra_tabelas SET ativo = ${req.body.ativo}, atualizado_em = NOW()
          WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *
        `);
        if (!r.rows.length) return res.status(404).json({ message: "Tabela não encontrada" });
        return res.json(paraTela(r.rows[0], true));
      }
      const v = validar(req.body); if (!v.ok) return res.status(400).json({ message: v.msg });
      const { banco, nome, coeficiente, percentual, prazo } = v.t;
      const r = await db.execute(sql`
        UPDATE compra_tabelas SET banco = ${banco}, nome = ${nome}, coeficiente = ${coeficiente},
          percentual = ${percentual}, prazo = ${prazo}, atualizado_em = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *
      `);
      if (!r.rows.length) return res.status(404).json({ message: "Tabela não encontrada" });
      res.json(paraTela(r.rows[0], true));
    } catch (err: any) {
      console.error("[COMPRA] PATCH tabela:", err);
      res.status(500).json({ message: "Erro ao salvar a tabela" });
    }
  });

  /** Cadastra as 15 tabelas da planilha; pula as que já existem (mesmo banco e coeficiente). */
  app.post("/api/compra/tabelas/importar-planilha", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const existentes = (await db.execute(sql`
        SELECT lower(banco) AS banco, coeficiente FROM compra_tabelas WHERE tenant_id = ${tenantId}
      `)).rows as any[];
      const tem = new Set(existentes.map(e => e.banco + "|" + Number(e.coeficiente).toFixed(10)));
      let criadas = 0;
      for (const t of TABELAS_PLANILHA) {
        if (tem.has(t.banco.toLowerCase() + "|" + t.coeficiente.toFixed(10))) continue;
        await db.execute(sql`
          INSERT INTO compra_tabelas (tenant_id, banco, nome, coeficiente, percentual, prazo, criado_por)
          VALUES (${tenantId}, ${t.banco}, ${t.nome ?? null}, ${t.coeficiente}, ${t.percentual ?? null}, ${t.prazo ?? null}, ${req.user?.id ?? null})
        `);
        criadas++;
      }
      res.json({ criadas, jaExistiam: TABELAS_PLANILHA.length - criadas });
    } catch (err: any) {
      console.error("[COMPRA] importar planilha:", err);
      res.status(500).json({ message: "Erro ao cadastrar as tabelas" });
    }
  });
}
