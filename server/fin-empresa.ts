// ═══════════════════════════════════════════════════════════════════
// FINANCEIRO EMPRESARIAL — caixa consolidado, contas a pagar,
// planejamento. Master-only. (Fases 1–3 do blueprint aprovado)
// ═══════════════════════════════════════════════════════════════════
import type { Express } from "express";
import { db } from "./storage";
import {
  finContasBancarias,
  finCategorias,
  finRegrasCategorizacao,
  finLancamentos,
  finContasPagar,
  finPlanejamento,
  producoesContratos,
} from "../shared/schema";
import { eq, and, desc, asc, sql, inArray, gte, lte } from "drizzle-orm";
import multer from "multer";

const uploadOfx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Helpers ─────────────────────────────────────────────────────────

function isMasterReq(req: any): boolean {
  // Coordenação tem os mesmos acessos do master no financeiro empresarial
  // (pedido do Fábio: Manu com acesso igual ao dele)
  return !!(req.user?.isMaster || req.user?.role === "master" || req.user?.role === "coordenacao");
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parser OFX próprio (SGML 1.x e XML 2.x). Extrai blocos STMTTRN. */
export function parseOfx(text: string): { fitid: string | null; data: string; valor: number; descricao: string }[] {
  const txs: { fitid: string | null; data: string; valor: number; descricao: string }[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const b of blocks) {
    const corpo = b.split(/<\/STMTTRN>/i)[0];
    const get = (tag: string) => {
      const m = corpo.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
      return m ? m[1].trim() : "";
    };
    const dt = get("DTPOSTED");
    const dm = dt.match(/^(\d{4})(\d{2})(\d{2})/);
    const data = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : "";
    const valor = parseFloat(get("TRNAMT").replace(",", "."));
    const fitid = get("FITID") || null;
    const descricao = (get("MEMO") || get("NAME") || get("TRNTYPE")).slice(0, 500);
    if (data && !isNaN(valor)) txs.push({ fitid, data, valor, descricao });
  }
  return txs;
}

/** Decodifica linha digitável de boleto (47 díg. bancário / 48 díg. concessionária).
 *  Retorna valor, vencimento e código do banco. Trata o rollover FEBRABAN do
 *  fator de vencimento (9999 = 21/02/2025; reinicia em 1000 = 22/02/2025) por
 *  proximidade de hoje. */
export function decodificarBoleto(linha: string): { valor: number | null; vencimento: string | null; banco: string | null; tipo: string } | null {
  const d = String(linha || "").replace(/\D/g, "");
  if (d.length === 47) {
    const banco = d.slice(0, 3);
    const fator = parseInt(d.slice(33, 37));
    const valor = parseInt(d.slice(37, 47)) / 100 || null;
    let vencimento: string | null = null;
    if (fator > 0) {
      const base1 = new Date(Date.UTC(1997, 9, 7));
      const d1 = new Date(base1.getTime() + fator * 86400000);
      const base2 = new Date(Date.UTC(2025, 1, 22)); // fator 1000
      const d2 = new Date(base2.getTime() + (fator - 1000) * 86400000);
      const agora = Date.now();
      const escolhida = Math.abs(d1.getTime() - agora) <= Math.abs(d2.getTime() - agora) ? d1 : d2;
      vencimento = escolhida.toISOString().slice(0, 10);
    }
    return { valor, vencimento, banco, tipo: "bancario" };
  }
  if (d.length === 48 && d[0] === "8") {
    // Concessionária/convênio: valor nas posições 4-14 do código de barras
    // (linha digitável = 4 blocos de 11+1 DV → remove os DVs nas posições 11,23,35,47)
    const barra = d.slice(0, 11) + d.slice(12, 23) + d.slice(24, 35) + d.slice(36, 47);
    const valor = parseInt(barra.slice(4, 15)) / 100 || null;
    return { valor, vencimento: null, banco: null, tipo: "concessionaria" };
  }
  return null;
}

/** Status derivado de uma conta a pagar aberta. */
function statusDerivado(cp: any, diasVencendo = 7): "paga" | "cancelada" | "atrasada" | "vencendo" | "em_dia" {
  if (cp.status === "paga") return "paga";
  if (cp.status === "cancelada") return "cancelada";
  const hoje = hojeISO();
  if (cp.vencimento < hoje) return "atrasada";
  const limite = new Date(Date.now() + diasVencendo * 86400000).toISOString().slice(0, 10);
  if (cp.vencimento <= limite) return "vencendo";
  return "em_dia";
}

// ── Rotas ───────────────────────────────────────────────────────────

export function registerFinEmpresaRoutes(app: Express, requireAuth: any) {
  /** Guard comum: tenant + master */
  const guard = (req: any, res: any): number | null => {
    const tenantId = req.tenantId;
    if (!tenantId) { res.status(400).json({ message: "Tenant não identificado" }); return null; }
    if (!isMasterReq(req)) { res.status(403).json({ message: "Acesso restrito ao master" }); return null; }
    return tenantId;
  };

  // ══ CONTAS BANCÁRIAS ══════════════════════════════════════════════
  app.get("/api/fin/contas", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const contas = await db.select().from(finContasBancarias)
        .where(eq(finContasBancarias.tenantId, tenantId))
        .orderBy(asc(finContasBancarias.id));
      // Saldo atual = saldo_inicial + soma dos lançamentos
      const somas = await db
        .select({ contaId: finLancamentos.contaId, total: sql<string>`COALESCE(SUM(${finLancamentos.valor}), 0)` })
        .from(finLancamentos)
        .where(eq(finLancamentos.tenantId, tenantId))
        .groupBy(finLancamentos.contaId);
      const somaPorConta = new Map(somas.map(s => [s.contaId, parseFloat(s.total || "0")]));
      return res.json({
        contas: contas.map(c => ({
          ...c,
          saldoAtual: Math.round((parseFloat(c.saldoInicial || "0") + (somaPorConta.get(c.id) || 0)) * 100) / 100,
        })),
      });
    } catch (e: any) {
      console.error("[FIN-CONTAS]", e);
      return res.status(500).json({ message: "Erro ao buscar contas" });
    }
  });

  app.post("/api/fin/contas", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const { nome, banco, cor, saldoInicial, dataSaldoInicial } = req.body || {};
      if (!nome) return res.status(400).json({ message: "Informe o nome da conta" });
      const [conta] = await db.insert(finContasBancarias).values({
        tenantId,
        nome: String(nome),
        banco: banco || null,
        cor: cor || "#7c3aed",
        saldoInicial: saldoInicial != null ? String(parseFloat(saldoInicial) || 0) : "0",
        dataSaldoInicial: dataSaldoInicial || hojeISO(),
      }).returning();
      return res.json({ ok: true, conta });
    } catch (e: any) {
      console.error("[FIN-CONTAS-POST]", e);
      return res.status(500).json({ message: "Erro ao criar conta" });
    }
  });

  app.patch("/api/fin/contas/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const id = Number(req.params.id);
      const { nome, banco, cor, saldoInicial, dataSaldoInicial, ativa } = req.body || {};
      const set: any = {};
      if (nome !== undefined) set.nome = String(nome);
      if (banco !== undefined) set.banco = banco || null;
      if (cor !== undefined) set.cor = cor || "#7c3aed";
      if (saldoInicial !== undefined) set.saldoInicial = String(parseFloat(saldoInicial) || 0);
      if (dataSaldoInicial !== undefined) set.dataSaldoInicial = dataSaldoInicial || null;
      if (ativa !== undefined) set.ativa = !!ativa;
      if (!Object.keys(set).length) return res.status(400).json({ message: "Nada para atualizar" });
      await db.update(finContasBancarias).set(set)
        .where(and(eq(finContasBancarias.id, id), eq(finContasBancarias.tenantId, tenantId)));
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[FIN-CONTAS-PATCH]", e);
      return res.status(500).json({ message: "Erro ao atualizar conta" });
    }
  });

  app.delete("/api/fin/contas/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const id = Number(req.params.id);
      const [temLanc] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(finLancamentos)
        .where(and(eq(finLancamentos.tenantId, tenantId), eq(finLancamentos.contaId, id)));
      if ((temLanc?.n || 0) > 0) {
        return res.status(400).json({ message: "Conta tem lançamentos — desative-a em vez de excluir" });
      }
      await db.delete(finContasBancarias)
        .where(and(eq(finContasBancarias.id, id), eq(finContasBancarias.tenantId, tenantId)));
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[FIN-CONTAS-DELETE]", e);
      return res.status(500).json({ message: "Erro ao excluir conta" });
    }
  });

  // ══ CATEGORIAS + REGRAS ═══════════════════════════════════════════
  app.get("/api/fin/categorias", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const categorias = await db.select().from(finCategorias)
        .where(eq(finCategorias.tenantId, tenantId)).orderBy(asc(finCategorias.nome));
      const regras = await db.select().from(finRegrasCategorizacao)
        .where(eq(finRegrasCategorizacao.tenantId, tenantId)).orderBy(desc(finRegrasCategorizacao.id));
      return res.json({ categorias, regras });
    } catch (e: any) {
      console.error("[FIN-CATEGORIAS]", e);
      return res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  app.post("/api/fin/categorias", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const { nome, tipo, cor, tetoMensal } = req.body || {};
      if (!nome || !["entrada", "saida"].includes(tipo)) {
        return res.status(400).json({ message: "Informe nome e tipo (entrada/saida)" });
      }
      const [cat] = await db.insert(finCategorias).values({
        tenantId, nome: String(nome), tipo,
        cor: cor || "#6b7280",
        tetoMensal: tetoMensal != null && tetoMensal !== "" ? String(parseFloat(tetoMensal) || 0) : null,
      }).returning();
      return res.json({ ok: true, categoria: cat });
    } catch (e: any) {
      console.error("[FIN-CATEGORIAS-POST]", e);
      return res.status(500).json({ message: "Erro ao criar categoria" });
    }
  });

  app.patch("/api/fin/categorias/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const id = Number(req.params.id);
      const { nome, tipo, cor, tetoMensal } = req.body || {};
      const set: any = {};
      if (nome !== undefined) set.nome = String(nome);
      if (tipo !== undefined && ["entrada", "saida"].includes(tipo)) set.tipo = tipo;
      if (cor !== undefined) set.cor = cor || "#6b7280";
      if (tetoMensal !== undefined) set.tetoMensal = tetoMensal !== "" && tetoMensal != null ? String(parseFloat(tetoMensal) || 0) : null;
      if (!Object.keys(set).length) return res.status(400).json({ message: "Nada para atualizar" });
      await db.update(finCategorias).set(set)
        .where(and(eq(finCategorias.id, id), eq(finCategorias.tenantId, tenantId)));
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[FIN-CATEGORIAS-PATCH]", e);
      return res.status(500).json({ message: "Erro ao atualizar categoria" });
    }
  });

  app.delete("/api/fin/categorias/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const id = Number(req.params.id);
      await db.delete(finCategorias)
        .where(and(eq(finCategorias.id, id), eq(finCategorias.tenantId, tenantId)));
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[FIN-CATEGORIAS-DELETE]", e);
      return res.status(500).json({ message: "Erro ao excluir categoria" });
    }
  });

  app.post("/api/fin/regras", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const { padraoTexto, categoriaId } = req.body || {};
      if (!padraoTexto || !categoriaId) return res.status(400).json({ message: "Informe padrão e categoria" });
      const [regra] = await db.insert(finRegrasCategorizacao).values({
        tenantId, padraoTexto: String(padraoTexto), categoriaId: Number(categoriaId),
      }).returning();
      return res.json({ ok: true, regra });
    } catch (e: any) {
      console.error("[FIN-REGRAS-POST]", e);
      return res.status(500).json({ message: "Erro ao criar regra" });
    }
  });

  app.delete("/api/fin/regras/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      await db.delete(finRegrasCategorizacao)
        .where(and(eq(finRegrasCategorizacao.id, Number(req.params.id)), eq(finRegrasCategorizacao.tenantId, tenantId)));
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[FIN-REGRAS-DELETE]", e);
      return res.status(500).json({ message: "Erro ao excluir regra" });
    }
  });

  // ══ LANÇAMENTOS (extrato consolidado) ═════════════════════════════
  app.get("/api/fin/lancamentos", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const { de, ate } = req.query;
      const conds: any[] = [eq(finLancamentos.tenantId, tenantId)];
      if (de) conds.push(gte(finLancamentos.data, String(de)));
      if (ate) conds.push(lte(finLancamentos.data, String(ate)));
      const lancamentos = await db.select().from(finLancamentos)
        .where(and(...conds))
        .orderBy(desc(finLancamentos.data), desc(finLancamentos.id))
        .limit(3000);
      return res.json({ lancamentos });
    } catch (e: any) {
      console.error("[FIN-LANCAMENTOS]", e);
      return res.status(500).json({ message: "Erro ao buscar lançamentos" });
    }
  });

  app.post("/api/fin/lancamentos", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const { contaId, data, valor, descricao, categoriaId } = req.body || {};
      const v = parseFloat(String(valor));
      if (!contaId || !data || isNaN(v) || v === 0) {
        return res.status(400).json({ message: "Informe conta, data e valor (≠ 0)" });
      }
      const [lanc] = await db.insert(finLancamentos).values({
        tenantId, contaId: Number(contaId), data: String(data),
        valor: String(Math.round(v * 100) / 100),
        descricao: descricao || null,
        categoriaId: categoriaId ? Number(categoriaId) : null,
        origem: "manual",
      }).returning();
      return res.json({ ok: true, lancamento: lanc });
    } catch (e: any) {
      console.error("[FIN-LANCAMENTOS-POST]", e);
      return res.status(500).json({ message: "Erro ao criar lançamento" });
    }
  });

  app.patch("/api/fin/lancamentos/categorizar", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const { ids, categoriaId, criarRegra, padraoTexto } = req.body || {};
      if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: "Informe os lançamentos" });
      await db.update(finLancamentos)
        .set({ categoriaId: categoriaId ? Number(categoriaId) : null })
        .where(and(eq(finLancamentos.tenantId, tenantId), inArray(finLancamentos.id, ids.map(Number))));
      // Opcional: cria regra para futuras importações
      if (criarRegra && padraoTexto && categoriaId) {
        await db.insert(finRegrasCategorizacao).values({
          tenantId, padraoTexto: String(padraoTexto), categoriaId: Number(categoriaId),
        });
      }
      return res.json({ ok: true, atualizados: ids.length });
    } catch (e: any) {
      console.error("[FIN-CATEGORIZAR]", e);
      return res.status(500).json({ message: "Erro ao categorizar" });
    }
  });

  app.delete("/api/fin/lancamentos/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      await db.delete(finLancamentos)
        .where(and(eq(finLancamentos.id, Number(req.params.id)), eq(finLancamentos.tenantId, tenantId)));
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[FIN-LANCAMENTOS-DELETE]", e);
      return res.status(500).json({ message: "Erro ao excluir lançamento" });
    }
  });

  // Importação de extrato OFX — dedupe por FITID; auto-categorização; conciliação
  app.post("/api/fin/importar-ofx", requireAuth, uploadOfx.single("arquivo"), async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const contaId = Number(req.body?.contaId);
      if (!contaId) return res.status(400).json({ message: "Informe a conta bancária" });
      if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

      // Encoding: OFX brasileiro frequentemente vem em Latin-1
      let text = req.file.buffer.toString("utf-8");
      if (text.includes("�")) text = req.file.buffer.toString("latin1");

      const txs = parseOfx(text);
      if (!txs.length) return res.status(400).json({ message: "Nenhuma transação encontrada no arquivo (é um OFX válido?)" });

      // Blindagem: transação sem FITID ganha chave sintética determinística
      // (data+valor+descrição+nº da ocorrência no arquivo) — assim o dedupe
      // funciona mesmo com OFX mal-comportado, sem colapsar transações
      // idênticas legítimas do mesmo dia.
      const ocorrencias = new Map<string, number>();
      for (const t of txs) {
        if (!t.fitid) {
          const chave = `${t.data}|${t.valor.toFixed(2)}|${(t.descricao || "").slice(0, 60)}`;
          const n = (ocorrencias.get(chave) || 0) + 1;
          ocorrencias.set(chave, n);
          t.fitid = `syn-${Buffer.from(chave).toString("base64").slice(0, 40)}-${n}`;
        }
      }

      // Regras de auto-categorização
      const regras = await db.select().from(finRegrasCategorizacao)
        .where(eq(finRegrasCategorizacao.tenantId, tenantId));
      const categorizar = (descricao: string): number | null => {
        const d = (descricao || "").toUpperCase();
        for (const r of regras) {
          if (d.includes(r.padraoTexto.toUpperCase())) return r.categoriaId;
        }
        return null;
      };

      // Insert em lotes com ON CONFLICT (conta_id, fitid) DO NOTHING → dedupe
      let inseridos = 0;
      const semFitid = txs.filter(t => !t.fitid).length;
      for (let i = 0; i < txs.length; i += 300) {
        const chunk = txs.slice(i, i + 300).map(t => ({
          tenantId, contaId,
          data: t.data,
          valor: String(Math.round(t.valor * 100) / 100),
          descricao: t.descricao || null,
          fitid: t.fitid,
          categoriaId: categorizar(t.descricao),
          origem: "ofx" as const,
        }));
        const r = await db.insert(finLancamentos).values(chunk)
          .onConflictDoNothing()
          .returning({ id: finLancamentos.id });
        inseridos += r.length;
      }

      // Conciliação automática: contas a pagar abertas × débitos novos (valor exato, data ±3 dias)
      let conciliadas = 0;
      try {
        const abertas = await db.select().from(finContasPagar)
          .where(and(eq(finContasPagar.tenantId, tenantId), eq(finContasPagar.status, "aberta")));
        if (abertas.length) {
          const novosDebitos = await db.select().from(finLancamentos)
            .where(and(
              eq(finLancamentos.tenantId, tenantId),
              eq(finLancamentos.contaId, contaId),
              sql`${finLancamentos.valor}::numeric < 0`,
              sql`${finLancamentos.contaPagarId} IS NULL`,
            ))
            .orderBy(desc(finLancamentos.id)).limit(500);
          for (const cp of abertas) {
            const alvo = Math.round(parseFloat(cp.valor) * 100);
            const venc = new Date(cp.vencimento + "T12:00:00").getTime();
            const match = novosDebitos.find(l => {
              if (l.contaPagarId) return false;
              const lv = Math.round(Math.abs(parseFloat(l.valor)) * 100);
              if (lv !== alvo) return false;
              const ld = new Date(l.data + "T12:00:00").getTime();
              return Math.abs(ld - venc) <= 3 * 86400000;
            });
            if (match) {
              match.contaPagarId = cp.id; // impede reuso no loop
              await db.update(finLancamentos).set({ contaPagarId: cp.id })
                .where(eq(finLancamentos.id, match.id));
              await db.update(finContasPagar)
                .set({ status: "paga", dataPagamento: match.data, lancamentoId: match.id })
                .where(eq(finContasPagar.id, cp.id));
              conciliadas++;
              // Recorrente paga → gera a do mês seguinte
              if (cp.recorrente) await gerarProximaRecorrencia(tenantId, cp);
            }
          }
        }
      } catch (concErr) {
        console.error("[FIN-OFX] conciliação (non-fatal):", concErr);
      }

      return res.json({
        ok: true,
        totalNoArquivo: txs.length,
        inseridos,
        duplicados: txs.length - inseridos - semFitid > 0 ? txs.length - inseridos : 0,
        semFitid,
        conciliadas,
      });
    } catch (e: any) {
      console.error("[FIN-IMPORTAR-OFX]", e);
      return res.status(500).json({ message: "Erro ao importar OFX: " + (e.message || "") });
    }
  });

  // ══ CONTAS A PAGAR ════════════════════════════════════════════════

  async function gerarProximaRecorrencia(tenantId: number, cp: any) {
    const [y, m, d] = cp.vencimento.split("-").map(Number);
    const prox = new Date(Date.UTC(y, m - 1 + 1, Math.min(d, 28)));
    const proxVenc = prox.toISOString().slice(0, 10);
    // Evita duplicar se a próxima já existe
    const [jaExiste] = await db.select({ id: finContasPagar.id }).from(finContasPagar)
      .where(and(
        eq(finContasPagar.tenantId, tenantId),
        eq(finContasPagar.descricao, cp.descricao),
        eq(finContasPagar.vencimento, proxVenc),
        eq(finContasPagar.recorrente, true),
      )).limit(1);
    if (jaExiste) return;
    await db.insert(finContasPagar).values({
      tenantId,
      descricao: cp.descricao,
      fornecedor: cp.fornecedor,
      categoriaId: cp.categoriaId,
      contaId: cp.contaId,
      valor: cp.valor,
      vencimento: proxVenc,
      tipo: "recorrente",
      recorrente: true,
      status: "aberta",
      criadoPor: cp.criadoPor,
    });
  }

  app.get("/api/fin/contas-pagar", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const { mes } = req.query; // YYYY-MM (opcional)
      const conds: any[] = [eq(finContasPagar.tenantId, tenantId)];
      if (mes) {
        conds.push(gte(finContasPagar.vencimento, `${mes}-01`));
        conds.push(lte(finContasPagar.vencimento, `${mes}-31`));
      }
      const contas = await db.select().from(finContasPagar)
        .where(and(...conds))
        .orderBy(asc(finContasPagar.vencimento));
      return res.json({
        contas: contas.map(c => ({ ...c, statusDerivado: statusDerivado(c) })),
      });
    } catch (e: any) {
      console.error("[FIN-CP]", e);
      return res.status(500).json({ message: "Erro ao buscar contas a pagar" });
    }
  });

  app.post("/api/fin/contas-pagar", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const { descricao, fornecedor, categoriaId, contaId, valor, vencimento, tipo, parcelas, recorrente, boletoCodigo, observacao } = req.body || {};
      const v = parseFloat(String(valor));
      if (!descricao || isNaN(v) || v <= 0 || !vencimento) {
        return res.status(400).json({ message: "Informe descrição, valor (> 0) e vencimento" });
      }
      const base = {
        tenantId,
        descricao: String(descricao),
        fornecedor: fornecedor || null,
        categoriaId: categoriaId ? Number(categoriaId) : null,
        contaId: contaId ? Number(contaId) : null,
        boletoCodigo: boletoCodigo || null,
        observacao: observacao || null,
        criadoPor: req.user?.id || null,
      };
      const nParc = Number(parcelas) || 1;
      if (tipo === "parcelada" && nParc > 1) {
        // Gera as N parcelas de uma vez (valor total dividido; última absorve arredondamento)
        const grupo = `parc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const vParcela = Math.floor((v / nParc) * 100) / 100;
        const vUltima = Math.round((v - vParcela * (nParc - 1)) * 100) / 100;
        const [y, m, d] = String(vencimento).split("-").map(Number);
        const rows = Array.from({ length: nParc }, (_, i) => {
          const dt = new Date(Date.UTC(y, m - 1 + i, Math.min(d, 28)));
          return {
            ...base,
            valor: String(i === nParc - 1 ? vUltima : vParcela),
            vencimento: dt.toISOString().slice(0, 10),
            tipo: "parcelada",
            parcelaNum: i + 1,
            parcelaTotal: nParc,
            grupoParcelamento: grupo,
          };
        });
        await db.insert(finContasPagar).values(rows);
        return res.json({ ok: true, parcelasGeradas: nParc });
      }
      const [cp] = await db.insert(finContasPagar).values({
        ...base,
        valor: String(Math.round(v * 100) / 100),
        vencimento: String(vencimento),
        tipo: recorrente ? "recorrente" : (tipo === "prazo" ? "prazo" : "avista"),
        recorrente: !!recorrente,
      }).returning();
      return res.json({ ok: true, conta: cp });
    } catch (e: any) {
      console.error("[FIN-CP-POST]", e);
      return res.status(500).json({ message: "Erro ao criar conta a pagar" });
    }
  });

  app.patch("/api/fin/contas-pagar/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const id = Number(req.params.id);
      const [atual] = await db.select().from(finContasPagar)
        .where(and(eq(finContasPagar.id, id), eq(finContasPagar.tenantId, tenantId))).limit(1);
      if (!atual) return res.status(404).json({ message: "Conta não encontrada" });

      const { descricao, fornecedor, categoriaId, contaId, valor, vencimento, observacao, acao, dataPagamento } = req.body || {};
      const set: any = {};
      if (descricao !== undefined) set.descricao = String(descricao);
      if (fornecedor !== undefined) set.fornecedor = fornecedor || null;
      if (categoriaId !== undefined) set.categoriaId = categoriaId ? Number(categoriaId) : null;
      if (contaId !== undefined) set.contaId = contaId ? Number(contaId) : null;
      if (valor !== undefined) {
        const v = parseFloat(String(valor));
        if (isNaN(v) || v <= 0) return res.status(400).json({ message: "Valor inválido" });
        set.valor = String(Math.round(v * 100) / 100);
      }
      if (vencimento !== undefined) set.vencimento = String(vencimento);
      if (observacao !== undefined) set.observacao = observacao || null;

      // Ações de ciclo de vida
      if (acao === "pagar") {
        set.status = "paga";
        set.dataPagamento = dataPagamento || hojeISO();
      } else if (acao === "reabrir") {
        set.status = "aberta";
        set.dataPagamento = null;
        set.lancamentoId = null;
      } else if (acao === "cancelar") {
        set.status = "cancelada";
      }

      await db.update(finContasPagar).set(set)
        .where(and(eq(finContasPagar.id, id), eq(finContasPagar.tenantId, tenantId)));

      // Baixa manual de recorrente → gera a próxima
      if (acao === "pagar" && atual.recorrente) {
        try { await gerarProximaRecorrencia(tenantId, atual); } catch (e) { console.error("[FIN-CP] recorrência:", e); }
      }
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[FIN-CP-PATCH]", e);
      return res.status(500).json({ message: "Erro ao atualizar conta" });
    }
  });

  app.delete("/api/fin/contas-pagar/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const id = Number(req.params.id);
      const grupoTodo = req.query.grupo === "1";
      const [atual] = await db.select().from(finContasPagar)
        .where(and(eq(finContasPagar.id, id), eq(finContasPagar.tenantId, tenantId))).limit(1);
      if (!atual) return res.status(404).json({ message: "Conta não encontrada" });
      if (grupoTodo && atual.grupoParcelamento) {
        // Exclui as parcelas ABERTAS do grupo (pagas ficam para histórico)
        await db.delete(finContasPagar).where(and(
          eq(finContasPagar.tenantId, tenantId),
          eq(finContasPagar.grupoParcelamento, atual.grupoParcelamento),
          eq(finContasPagar.status, "aberta"),
        ));
      } else {
        await db.delete(finContasPagar)
          .where(and(eq(finContasPagar.id, id), eq(finContasPagar.tenantId, tenantId)));
      }
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[FIN-CP-DELETE]", e);
      return res.status(500).json({ message: "Erro ao excluir conta" });
    }
  });

  // Decodificar linha digitável de boleto → valor, vencimento, banco
  app.post("/api/fin/decodificar-boleto", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const resultado = decodificarBoleto(req.body?.linha || "");
      if (!resultado) return res.status(400).json({ message: "Linha digitável inválida (esperado 47 ou 48 dígitos)" });
      return res.json({ ok: true, ...resultado });
    } catch (e: any) {
      return res.status(500).json({ message: "Erro ao decodificar boleto" });
    }
  });

  // ══ PLANEJAMENTO + RESUMO/PROJEÇÃO ════════════════════════════════
  app.get("/api/fin/planejamento/:mes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const mes = String(req.params.mes);
      const [plan] = await db.select().from(finPlanejamento)
        .where(and(eq(finPlanejamento.tenantId, tenantId), eq(finPlanejamento.mesReferencia, mes))).limit(1);
      return res.json({ planejamento: plan || null });
    } catch (e: any) {
      console.error("[FIN-PLAN]", e);
      return res.status(500).json({ message: "Erro ao buscar planejamento" });
    }
  });

  app.put("/api/fin/planejamento/:mes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const mes = String(req.params.mes);
      const { pctReserva, tetosJson, metaMargem, observacao } = req.body || {};
      const valores = {
        pctReserva: String(parseFloat(pctReserva) || 0),
        tetosJson: tetosJson || null,
        metaMargem: metaMargem != null && metaMargem !== "" ? String(parseFloat(metaMargem) || 0) : null,
        observacao: observacao || null,
      };
      const [existente] = await db.select({ id: finPlanejamento.id }).from(finPlanejamento)
        .where(and(eq(finPlanejamento.tenantId, tenantId), eq(finPlanejamento.mesReferencia, mes))).limit(1);
      if (existente) {
        await db.update(finPlanejamento).set(valores).where(eq(finPlanejamento.id, existente.id));
      } else {
        await db.insert(finPlanejamento).values({ tenantId, mesReferencia: mes, ...valores });
      }
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[FIN-PLAN-PUT]", e);
      return res.status(500).json({ message: "Erro ao salvar planejamento" });
    }
  });

  // Resumo do mês + projeção de caixa 60 dias + alertas
  app.get("/api/fin/resumo", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const hoje = hojeISO();
      const mes = String(req.query.mes || hoje.slice(0, 7));

      // Saldo consolidado
      const contas = await db.select().from(finContasBancarias)
        .where(and(eq(finContasBancarias.tenantId, tenantId), eq(finContasBancarias.ativa, true)));
      const somas = await db
        .select({ contaId: finLancamentos.contaId, total: sql<string>`COALESCE(SUM(${finLancamentos.valor}), 0)` })
        .from(finLancamentos)
        .where(eq(finLancamentos.tenantId, tenantId))
        .groupBy(finLancamentos.contaId);
      const somaPorConta = new Map(somas.map(s => [s.contaId, parseFloat(s.total || "0")]));
      const saldoConsolidado = contas.reduce((s, c) =>
        s + parseFloat(c.saldoInicial || "0") + (somaPorConta.get(c.id) || 0), 0);

      // Entradas/saídas do mês por categoria
      const doMes = await db.select({
        valor: finLancamentos.valor,
        categoriaId: finLancamentos.categoriaId,
      }).from(finLancamentos)
        .where(and(
          eq(finLancamentos.tenantId, tenantId),
          gte(finLancamentos.data, `${mes}-01`),
          lte(finLancamentos.data, `${mes}-31`),
        ));
      let entradasMes = 0, saidasMes = 0;
      const porCategoria = new Map<number | null, number>();
      for (const l of doMes) {
        const v = parseFloat(l.valor || "0");
        if (v >= 0) entradasMes += v; else saidasMes += Math.abs(v);
        if (v < 0) porCategoria.set(l.categoriaId, (porCategoria.get(l.categoriaId) || 0) + Math.abs(v));
      }

      // Planejamento do mês (reserva + tetos)
      const [plan] = await db.select().from(finPlanejamento)
        .where(and(eq(finPlanejamento.tenantId, tenantId), eq(finPlanejamento.mesReferencia, mes))).limit(1);
      const pctReserva = plan ? parseFloat(plan.pctReserva || "0") : 0;
      const reservaDevida = Math.round(entradasMes * pctReserva / 100 * 100) / 100;

      // Categorias (para tetos e nomes)
      const categorias = await db.select().from(finCategorias)
        .where(eq(finCategorias.tenantId, tenantId));
      const tetos: Record<string, number> = (plan?.tetosJson as any) || {};
      const estouros = categorias
        .filter(c => c.tipo === "saida")
        .map(c => {
          const teto = tetos[String(c.id)] ?? (c.tetoMensal ? parseFloat(c.tetoMensal) : null);
          const gasto = porCategoria.get(c.id) || 0;
          return teto && teto > 0 ? { categoria: c.nome, cor: c.cor, teto, gasto, pct: Math.round(gasto / teto * 100) } : null;
        })
        .filter(Boolean);

      // Compromissos futuros: contas a pagar abertas (próximos 60 dias)
      const limite60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const abertas = await db.select().from(finContasPagar)
        .where(and(
          eq(finContasPagar.tenantId, tenantId),
          eq(finContasPagar.status, "aberta"),
          lte(finContasPagar.vencimento, limite60),
        )).orderBy(asc(finContasPagar.vencimento));

      // Entradas previstas: comissões A Receber da Produção (empresa ainda não recebeu)
      const [aReceberRow] = await db.select({
        total: sql<string>`COALESCE(SUM(COALESCE(NULLIF(${producoesContratos.comissaoEmpresaValor}, '0'), ${producoesContratos.comissaoRepasseValor})::numeric), 0)`,
      }).from(producoesContratos)
        .where(and(
          eq(producoesContratos.tenantId, tenantId),
          sql`${producoesContratos.dataRecebimento} IS NULL`,
          sql`${producoesContratos.comissaoRepasseValor}::numeric > 0`,
        ));
      const comissoesAReceber = parseFloat(aReceberRow?.total || "0");

      // Projeção diária 60 dias: saldo hoje − contas a pagar por vencimento
      // (comissões a receber entram como linha informativa, não têm data certa)
      const projecao: { data: string; saldo: number; saidasDia: number }[] = [];
      let saldoProj = saldoConsolidado;
      const saidasPorDia = new Map<string, number>();
      for (const cp of abertas) {
        const d = cp.vencimento < hoje ? hoje : cp.vencimento; // atrasada pesa hoje
        saidasPorDia.set(d, (saidasPorDia.get(d) || 0) + parseFloat(cp.valor));
      }
      for (let i = 0; i <= 60; i++) {
        const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
        const saidasDia = saidasPorDia.get(d) || 0;
        saldoProj = Math.round((saldoProj - saidasDia) * 100) / 100;
        projecao.push({ data: d, saldo: saldoProj, saidasDia });
      }
      const diaNegativo = projecao.find(p => p.saldo < 0)?.data || null;
      const diaAbaixoReserva = reservaDevida > 0 ? (projecao.find(p => p.saldo < reservaDevida)?.data || null) : null;

      // Alertas acionáveis
      const alertas: { nivel: "info" | "warn" | "critico"; texto: string }[] = [];
      const atrasadas = abertas.filter(c => c.vencimento < hoje);
      if (atrasadas.length) {
        const tot = atrasadas.reduce((s, c) => s + parseFloat(c.valor), 0);
        alertas.push({ nivel: "critico", texto: `${atrasadas.length} conta(s) em atraso somando R$ ${tot.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
      }
      if (diaNegativo) alertas.push({ nivel: "critico", texto: `Com os compromissos atuais, o caixa fica NEGATIVO em ${diaNegativo.split("-").reverse().join("/")}` });
      else if (diaAbaixoReserva) alertas.push({ nivel: "warn", texto: `O caixa fura a reserva planejada em ${diaAbaixoReserva.split("-").reverse().join("/")}` });
      if (reservaDevida > 0) alertas.push({ nivel: "info", texto: `Reserva de ${mes.split("-").reverse().join("/")}: separar R$ ${reservaDevida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${pctReserva}% das entradas)` });
      for (const e of estouros as any[]) {
        if (e.pct >= 100) alertas.push({ nivel: "critico", texto: `Categoria "${e.categoria}" estourou o teto: ${e.pct}% usado` });
        else if (e.pct >= 80) alertas.push({ nivel: "warn", texto: `Categoria "${e.categoria}" em ${e.pct}% do teto` });
      }

      return res.json({
        mes,
        saldoConsolidado: Math.round(saldoConsolidado * 100) / 100,
        entradasMes: Math.round(entradasMes * 100) / 100,
        saidasMes: Math.round(saidasMes * 100) / 100,
        reservaDevida,
        pctReserva,
        comissoesAReceber: Math.round(comissoesAReceber * 100) / 100,
        totalAbertas60d: Math.round(abertas.reduce((s, c) => s + parseFloat(c.valor), 0) * 100) / 100,
        estouros,
        projecao,
        diaNegativo,
        alertas,
      });
    } catch (e: any) {
      console.error("[FIN-RESUMO]", e);
      return res.status(500).json({ message: "Erro ao gerar resumo" });
    }
  });

  // ══ REVISÃO DE CUSTOS (Fase 4) ════════════════════════════════════

  // Lê fatura/boleto (imagem ou PDF) com IA e devolve os campos extraídos;
  // com criar=1 já cadastra a conta a pagar.
  app.post("/api/fin/analisar-fatura", requireAuth, uploadOfx.single("arquivo"), async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

      const { ocrClient, ocrModel } = await import("./openaiClient");
      const mime = req.file.mimetype || "image/jpeg";
      const b64 = req.file.buffer.toString("base64");

      const completion = await ocrClient.chat.completions.create({
        model: ocrModel,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Você é um extrator de dados de faturas e boletos brasileiros. Analise o documento e retorne SOMENTE um JSON válido (sem markdown) com:
{
  "descricao": "o que está sendo cobrado (curto)",
  "fornecedor": "quem emitiu",
  "valor": 123.45,
  "vencimento": "YYYY-MM-DD ou null",
  "linhaDigitavel": "se houver código de barras/linha digitável, os dígitos, senão null",
  "categoriasugerida": "uma palavra: aluguel|energia|internet|telefonia|software|marketing|impostos|folha|outros",
  "observacoes": "detalhes relevantes: período de referência, multa, itens principais"
}
Se não conseguir ler algum campo com segurança, use null — NÃO invente.`,
            },
            { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        }],
        max_tokens: 800,
      });

      const raw = completion.choices?.[0]?.message?.content || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(422).json({ message: "A IA não conseguiu ler o documento", bruto: raw.slice(0, 300) });
      let dados: any;
      try { dados = JSON.parse(jsonMatch[0]); } catch {
        return res.status(422).json({ message: "Resposta da IA fora do formato", bruto: raw.slice(0, 300) });
      }

      // Se veio linha digitável, refina valor/vencimento com o decodificador determinístico
      if (dados.linhaDigitavel) {
        const dec = decodificarBoleto(String(dados.linhaDigitavel));
        if (dec?.valor && !dados.valor) dados.valor = dec.valor;
        if (dec?.vencimento && !dados.vencimento) dados.vencimento = dec.vencimento;
      }

      let contaCriada = null;
      if (String(req.body?.criar) === "1" && dados.valor && dados.descricao) {
        const [cp] = await db.insert(finContasPagar).values({
          tenantId,
          descricao: String(dados.descricao).slice(0, 255),
          fornecedor: dados.fornecedor ? String(dados.fornecedor).slice(0, 255) : null,
          valor: String(Math.round(parseFloat(dados.valor) * 100) / 100),
          vencimento: dados.vencimento || hojeISO(),
          tipo: "avista",
          boletoCodigo: dados.linhaDigitavel ? String(dados.linhaDigitavel).replace(/\D/g, "").slice(0, 60) : null,
          observacao: dados.observacoes || "Cadastrada pela Revisão de Custos (IA)",
          criadoPor: req.user?.id || null,
        }).returning();
        contaCriada = cp;
      }

      return res.json({ ok: true, dados, contaCriada });
    } catch (e: any) {
      console.error("[FIN-ANALISAR-FATURA]", e);
      return res.status(500).json({ message: "Erro ao analisar: " + (e.message || "") });
    }
  });

  // Cruzamentos de custos: duplicidades, recorrências e tendências de aumento
  app.get("/api/fin/revisao-analise", requireAuth, async (req: any, res) => {
    try {
      const tenantId = guard(req, res); if (!tenantId) return;
      const seisMesesAtras = new Date(Date.now() - 185 * 86400000).toISOString().slice(0, 10);

      // Débitos dos últimos ~6 meses
      const debitos = await db.select({
        data: finLancamentos.data,
        valor: finLancamentos.valor,
        descricao: finLancamentos.descricao,
      }).from(finLancamentos)
        .where(and(
          eq(finLancamentos.tenantId, tenantId),
          gte(finLancamentos.data, seisMesesAtras),
          sql`${finLancamentos.valor}::numeric < 0`,
        ));

      // Normaliza descrição (remove números/datas para agrupar a mesma cobrança)
      const norm = (s: string) => (s || "")
        .toUpperCase()
        .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, "")
        .replace(/\d{4,}/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);

      type Serie = { total: number; porMes: Map<string, number>; ocorrencias: number; exemplo: string };
      const grupos = new Map<string, Serie>();
      for (const d of debitos) {
        const k = norm(d.descricao || "");
        if (!k || k.length < 4) continue;
        const mes = d.data.slice(0, 7);
        const v = Math.abs(parseFloat(d.valor));
        if (!grupos.has(k)) grupos.set(k, { total: 0, porMes: new Map(), ocorrencias: 0, exemplo: d.descricao || "" });
        const g = grupos.get(k)!;
        g.total += v; g.ocorrencias++;
        g.porMes.set(mes, (g.porMes.get(mes) || 0) + v);
      }

      const oportunidades: any[] = [];

      // 1) Recorrências (≥3 meses distintos) — assinaturas/contratos com custo anualizado
      for (const [k, g] of grupos) {
        const meses = [...g.porMes.keys()].sort();
        if (meses.length >= 3) {
          const valores = meses.map(m => g.porMes.get(m)!);
          const media = valores.reduce((s, v) => s + v, 0) / valores.length;
          const custoAnual = Math.round(media * 12 * 100) / 100;
          // Tendência: média dos 2 últimos vs 2 primeiros
          let tendencia = 0;
          if (valores.length >= 4) {
            const ini = (valores[0] + valores[1]) / 2;
            const fim = (valores[valores.length - 1] + valores[valores.length - 2]) / 2;
            if (ini > 0) tendencia = Math.round(((fim - ini) / ini) * 100);
          }
          if (tendencia >= 15) {
            oportunidades.push({
              tipo: "aumento", titulo: g.exemplo.slice(0, 80),
              detalhe: `Cobrança recorrente subiu ~${tendencia}% no período (média R$ ${media.toFixed(2)}/mês)`,
              custoAnual, prioridade: 1,
            });
          } else {
            oportunidades.push({
              tipo: "recorrencia", titulo: g.exemplo.slice(0, 80),
              detalhe: `${meses.length} meses seguidos · média R$ ${media.toFixed(2)}/mês — vale conferir se ainda é necessária`,
              custoAnual, prioridade: 3,
            });
          }
        }
      }

      // 2) Possíveis duplicidades no mesmo mês (mesma descrição normalizada + mesmo valor 2x)
      const vistos = new Map<string, number>();
      for (const d of debitos) {
        const k = `${d.data.slice(0, 7)}|${norm(d.descricao || "")}|${Math.abs(parseFloat(d.valor)).toFixed(2)}`;
        vistos.set(k, (vistos.get(k) || 0) + 1);
      }
      for (const [k, n] of vistos) {
        if (n >= 2) {
          const [mes, desc, val] = k.split("|");
          if (!desc || desc.length < 4) continue;
          oportunidades.push({
            tipo: "duplicidade", titulo: desc.slice(0, 80),
            detalhe: `${n}× o mesmo débito de R$ ${val} em ${mes.split("-").reverse().join("/")} — cobrança duplicada?`,
            custoAnual: parseFloat(val) * (n - 1), prioridade: 0,
          });
        }
      }

      oportunidades.sort((a, b) => a.prioridade - b.prioridade || b.custoAnual - a.custoAnual);
      const economiaPotencial = oportunidades
        .filter(o => o.tipo !== "recorrencia")
        .reduce((s, o) => s + (o.custoAnual || 0), 0);

      return res.json({
        oportunidades: oportunidades.slice(0, 60),
        economiaPotencial: Math.round(economiaPotencial * 100) / 100,
        baseAnalisada: debitos.length,
      });
    } catch (e: any) {
      console.error("[FIN-REVISAO]", e);
      return res.status(500).json({ message: "Erro na análise de custos" });
    }
  });
}
