// Ponte entre o CRM e o Agente de Listas (o Jarvis que roda na máquina do
// Fábio, em cima do Bigdata). O CRM é só o cano: autentica, limita, registra e
// repassa a conversa ao vivo. Não interpreta nada.
//
// Rotas:
//   POST /api/agente-listas/registrar                 (o agente avisa onde está — token, sem usuário)
//   GET  /api/agente-listas/status                    (está no ar?)
//   POST /api/agente-listas/conversas                 -> { id }
//   POST /api/agente-listas/conversas/:id/mensagens   { texto } -> SSE repassado do agente
//   POST /api/agente-listas/conversas/:id/campanha    { nome?, excel? } -> cria campanha (+ pedido de exportação)

import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, storage } from "./storage";
import { clientesPessoa, users, type InsertSalesLead } from "@shared/schema";

const TOKEN = process.env.AGENTE_LISTAS_TOKEN || "";
const CONSIDERA_VIVO_MS = 10 * 60_000;

type Deps = {
  requireAuth: RequestHandler;
  requireModuleAccess: (module: string, accessType?: "view" | "edit") => RequestHandler;
  inserirAssignmentsBulk: (rows: any[]) => Promise<number>;
  recalcularContadoresCampanha: (campaignId: number) => Promise<void>;
  registrarConsumoLeads: (tenantId: number | null | undefined, qtd: number, userId?: number | null) => Promise<void>;
};

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ── Teto por usuário ─────────────────────────────────────────────────────────
// Cada usuário pode ter um limite mensal de leads gerados (users.limite_leads_mes).
// Sem limite cadastrado, não há teto. O consumo por usuário vive em
// consumo_leads_usuario; o consumo por ambiente continua em consumo_leads.
export async function tetoLeadsUsuario(userId: number, tenantId: number) {
  const [u] = await db.select({ limite: users.limiteLeadsMes }).from(users).where(eq(users.id, userId)).limit(1);
  const limite = u?.limite ?? null;
  const [c] = (await db.execute(sql`
    SELECT quantidade FROM consumo_leads_usuario
    WHERE tenant_id = ${tenantId} AND user_id = ${userId} AND mes_referencia = ${mesAtual()}
  `)).rows as any[];
  const usados = Number(c?.quantidade || 0);
  return { limite, usados, restantes: limite == null ? null : Math.max(limite - usados, 0) };
}

export async function registrarConsumoUsuario(tenantId: number | null | undefined, userId: number | null | undefined, qtd: number) {
  if (!tenantId || !userId || !qtd || qtd <= 0) return;
  try {
    await db.execute(sql`
      INSERT INTO consumo_leads_usuario (tenant_id, user_id, mes_referencia, quantidade)
      VALUES (${tenantId}, ${userId}, ${mesAtual()}, ${qtd})
      ON CONFLICT (tenant_id, user_id, mes_referencia)
      DO UPDATE SET quantidade = consumo_leads_usuario.quantidade + ${qtd}, atualizado_em = NOW()
    `);
  } catch (e) {
    console.error("[CONSUMO] falha ao registrar por usuário:", e);
  }
}

// ── Estado do agente (onde ele está e quando foi visto) ──────────────────────
async function lerEstado(): Promise<{ url: string; vistoEm: Date; versao: string | null; modelo: string | null } | null> {
  const [r] = (await db.execute(sql`SELECT url, visto_em, versao, modelo FROM agente_listas_estado WHERE id = 1`)).rows as any[];
  return r ? { url: r.url, vistoEm: new Date(r.visto_em), versao: r.versao, modelo: r.modelo } : null;
}

async function agenteVivo() {
  const estado = await lerEstado();
  if (!estado || Date.now() - estado.vistoEm.getTime() > CONSIDERA_VIVO_MS) return { ok: false as const, estado };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`${estado.url}/saude`, { headers: { "x-agente-token": TOKEN }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return { ok: false as const, estado };
    return { ok: true as const, estado, saude: await r.json() };
  } catch {
    return { ok: false as const, estado };
  }
}

async function chamarAgente(caminho: string, init: RequestInit = {}) {
  const estado = await lerEstado();
  if (!estado) throw new Error("O montador de listas não está registrado.");
  return fetch(`${estado.url}${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-agente-token": TOKEN, ...(init.headers || {}) },
  });
}

export function registerAgenteListasRoutes(app: Express, deps: Deps) {
  const { requireAuth, requireModuleAccess, inserirAssignmentsBulk, recalcularContadoresCampanha, registrarConsumoLeads } = deps;
  const podeUsar = [requireAuth, requireModuleAccess("modulo_base_clientes")];

  // O agente se apresenta (e repete a cada 5 min). Só token; não há usuário.
  app.post("/api/agente-listas/registrar", async (req: Request, res: Response) => {
    try {
      if (!TOKEN || req.headers["x-agente-token"] !== TOKEN) return res.status(401).json({ message: "token inválido" });
      const { url, versao, modelo } = req.body || {};
      if (!url || !/^https?:\/\//.test(String(url))) return res.status(400).json({ message: "url inválida" });
      await db.execute(sql`
        INSERT INTO agente_listas_estado (id, url, versao, modelo, visto_em)
        VALUES (1, ${String(url).replace(/\/+$/, "")}, ${versao || null}, ${modelo || null}, NOW())
        ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, versao = EXCLUDED.versao, modelo = EXCLUDED.modelo, visto_em = NOW()
      `);
      return res.json({ ok: true });
    } catch (e) {
      console.error("[agente-listas] registrar:", e);
      return res.status(500).json({ message: "erro ao registrar agente" });
    }
  });

  app.get("/api/agente-listas/status", ...podeUsar, async (req: any, res: Response) => {
    try {
      if (!TOKEN) return res.json({ disponivel: false, motivo: "AGENTE_LISTAS_TOKEN não configurado no servidor" });
      const vivo = await agenteVivo();
      const teto = await tetoLeadsUsuario(req.user!.id, req.tenantId!);
      return res.json({
        disponivel: vivo.ok,
        vistoEm: vivo.estado?.vistoEm ?? null,
        modelo: vivo.ok ? vivo.saude?.modelo : null,
        teto,
      });
    } catch (e) {
      console.error("[agente-listas] status:", e);
      return res.status(500).json({ message: "erro ao consultar o agente" });
    }
  });

  app.post("/api/agente-listas/conversas", ...podeUsar, async (req: any, res: Response) => {
    try {
      const vivo = await agenteVivo();
      if (!vivo.ok) return res.status(503).json({ message: "O montador de listas está fora do ar agora. Use o filtro ao lado ou tente mais tarde." });
      const [tenant] = (await db.execute(sql`SELECT name FROM tenants WHERE id = ${req.tenantId}`)).rows as any[];
      const r = await chamarAgente("/conversas", {
        method: "POST",
        body: JSON.stringify({ usuario: req.user!.name || req.user!.email, ambiente: tenant?.name || String(req.tenantId) }),
      });
      if (!r.ok) throw new Error(`agente respondeu ${r.status}`);
      const { id } = await r.json();
      const [linha] = (await db.execute(sql`
        INSERT INTO agente_listas_conversas (tenant_id, user_id, agente_conversa_id)
        VALUES (${req.tenantId}, ${req.user!.id}, ${id}) RETURNING id
      `)).rows as any[];
      return res.status(201).json({ id: linha.id });
    } catch (e) {
      console.error("[agente-listas] conversas:", e);
      return res.status(502).json({ message: "Não consegui abrir a conversa com o agente." });
    }
  });

  // Dono da conversa (ou master do ambiente)
  async function conversaDoUsuario(req: any, id: number) {
    const [c] = (await db.execute(sql`
      SELECT * FROM agente_listas_conversas WHERE id = ${id} AND tenant_id = ${req.tenantId}
    `)).rows as any[];
    if (!c) return null;
    if (c.user_id !== req.user!.id && !req.user!.isMaster && req.user!.role !== "master") return null;
    return c;
  }

  // Repassa a conversa ao vivo: o que o agente escreve, o navegador vê na hora.
  app.post("/api/agente-listas/conversas/:id/mensagens", ...podeUsar, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    const conversa = await conversaDoUsuario(req, id);
    if (!conversa) return res.status(404).json({ message: "conversa não encontrada" });
    const texto = String(req.body?.texto || "").trim();
    if (!texto) return res.status(400).json({ message: "mensagem vazia" });

    const ctrl = new AbortController();
    req.on("close", () => ctrl.abort());
    let upstream: Awaited<ReturnType<typeof fetch>>;
    try {
      upstream = await chamarAgente(`/conversas/${conversa.agente_conversa_id}/mensagens`, {
        method: "POST",
        body: JSON.stringify({ texto }),
        signal: ctrl.signal,
      });
    } catch (e) {
      return res.status(502).json({ message: "O agente não respondeu. Pode estar fora do ar." });
    }
    if (!upstream.ok || !upstream.body) {
      const corpo = await upstream.text().catch(() => "");
      return res.status(502).json({ message: `Agente respondeu ${upstream.status}: ${corpo.slice(0, 200)}` });
    }

    await db.execute(sql`UPDATE agente_listas_conversas SET mensagens = mensagens + 1, atualizado_em = NOW() WHERE id = ${id}`);
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
    try {
      for await (const chunk of upstream.body as any) {
        res.write(chunk);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) res.write(`data: ${JSON.stringify({ tipo: "erro", mensagem: "conexão com o agente caiu" })}\n\n`);
    } finally {
      res.end();
    }
  });

  // A lista vira campanha (e, se pedido, pedido de exportação pendente).
  app.post("/api/agente-listas/conversas/:id/campanha", ...podeUsar, async (req: any, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversa = await conversaDoUsuario(req, id);
      if (!conversa) return res.status(404).json({ message: "conversa não encontrada" });
      if (conversa.campanha_id) return res.status(409).json({ message: "Esta lista já virou campanha." });

      const r = await chamarAgente(`/conversas/${conversa.agente_conversa_id}/lista`);
      if (r.status === 404) return res.status(400).json({ message: "O agente ainda não fechou a lista. Peça para ele fechar primeiro." });
      if (!r.ok) throw new Error(`agente respondeu ${r.status}`);
      const lista = await r.json() as {
        id: number; nome: string; criterios: string; resumo: any;
        linhas: Array<{ cpf: string; nome: string; telefone: string | null; orgao?: string | null; matricula?: string | null; convenio?: string | null; margem?: number | null }>;
        sem_telefone: Array<{ cpf: string; nome: string }>;
      };
      const nome = String(req.body?.nome || lista.nome || "Lista do Jarvis").trim().slice(0, 150);
      const querExcel = Boolean(req.body?.excel);
      const linhas = lista.linhas || [];
      if (!linhas.length) return res.status(400).json({ message: "A lista veio vazia (ninguém com telefone)." });

      // Teto do usuário
      const teto = await tetoLeadsUsuario(req.user!.id, req.tenantId!);
      if (teto.limite != null && linhas.length > teto.restantes!) {
        return res.status(403).json({
          message: `Esta lista tem ${linhas.length.toLocaleString("pt-BR")} leads e você ainda pode gerar ${teto.restantes!.toLocaleString("pt-BR")} neste mês (limite ${teto.limite.toLocaleString("pt-BR")}). Peça ao agente para reduzir.`,
          teto,
        });
      }

      // Liga ao cadastro quando o CPF existe na base do CRM
      const cpfs = linhas.map((l) => l.cpf);
      const idPorCpf = new Map<string, number>();
      for (let i = 0; i < cpfs.length; i += 2000) {
        const lote = cpfs.slice(i, i + 2000);
        const achados = await db.select({ id: clientesPessoa.id, cpf: clientesPessoa.cpf }).from(clientesPessoa).where(inArray(clientesPessoa.cpf, lote));
        for (const a of achados) if (a.cpf) idPorCpf.set(a.cpf, a.id);
      }

      const campanha = await storage.createSalesCampaign({
        nome,
        descricao: `Montada com o Jarvis. Critérios: ${lista.criterios || "-"}`.slice(0, 1000),
        origem: "agente_listas",
        convenio: linhas[0]?.convenio || "SIAPE",
        uf: null,
        status: "ativa",
        totalLeads: linhas.length,
        leadsDisponiveis: linhas.length,
        leadsDistribuidos: 0,
        createdBy: req.user!.id,
      } as any);

      const leads: InsertSalesLead[] = linhas.map((l) => ({
        campaignId: campanha.id,
        cpf: l.cpf,
        nome: l.nome,
        telefone1: l.telefone,
        observacoes: `Convênio: ${l.convenio || "SIAPE"} | Órgão: ${l.orgao || "-"} | Matrícula: ${l.matricula || "-"}${l.margem != null ? ` | Margem: ${l.margem}` : ""}`,
        baseClienteId: idPorCpf.get(l.cpf) ?? null,
      } as any));
      const inseridos = await storage.createSalesLeadsBulk(leads);
      await registrarConsumoLeads(req.tenantId, inseridos, req.user!.id);
      await registrarConsumoUsuario(req.tenantId, req.user!.id, inseridos);

      // Quem não distribui equipe recebe os leads na hora (mesma regra do filtro)
      const distribuidor = req.user!.isMaster || ["master", "coordenacao"].includes(req.user!.role || "");
      let atribuidos = 0;
      if (!distribuidor && inseridos > 0) {
        const meus = await storage.getUnassignedLeads(campanha.id, inseridos);
        const ordemBase = await storage.getMaxOrdemFila(req.user!.id, campanha.id);
        atribuidos = await inserirAssignmentsBulk(meus.map((lead, i) => ({
          leadId: lead.id, userId: req.user!.id, campaignId: campanha.id, status: "novo", ordemFila: ordemBase + i + 1,
        })));
        await recalcularContadoresCampanha(campanha.id);
      }

      // Excel: vira pedido pendente, com o arquivo já pronto; o master aprova
      let pedidoId: number | null = null;
      if (querExcel) {
        const exportsDir = path.join(process.cwd(), "exports");
        if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
        const wb = new ExcelJS.Workbook();
        wb.creator = "Capital CRM — Jarvis";
        const aba = wb.addWorksheet("DISPARO");
        aba.addRow(["NOME", "CPF", "TELEFONE"]);
        for (const l of linhas) aba.addRow([l.nome, l.cpf, l.telefone]);
        const semTel = wb.addWorksheet("Sem telefone");
        semTel.addRow(["NOME", "CPF"]);
        for (const l of lista.sem_telefone || []) semTel.addRow([l.nome, l.cpf]);
        const pedido = await storage.createPedidoLista({
          tenantId: req.tenantId,
          coordenadorId: req.user!.id,
          filtrosUsados: { origem: "agente_listas", criterios: lista.criterios, conversaId: id, campanhaId: campanha.id } as any,
          quantidadeRegistros: linhas.length,
          tipo: "exportacao_agente",
          status: "pendente",
          nomePacote: "Jarvis",
        } as any);
        pedidoId = pedido.id;
        const filePath = path.join(exportsDir, `agente_${pedido.id}.xlsx`);
        await wb.xlsx.writeFile(filePath);
        await storage.updatePedidoLista(pedido.id, { arquivoPath: filePath, arquivoGeradoEm: new Date() } as any);
      }

      await db.execute(sql`
        UPDATE agente_listas_conversas
        SET campanha_id = ${campanha.id}, pedido_id = ${pedidoId}, criterios = ${lista.criterios || null},
            total_leads = ${inseridos}, atualizado_em = NOW()
        WHERE id = ${id}
      `);
      chamarAgente(`/conversas/${conversa.agente_conversa_id}/lista/consumida`, {
        method: "POST", body: JSON.stringify({ campanhaId: campanha.id, pedidoId }),
      }).catch(() => {});

      return res.status(201).json({
        campanhaId: campanha.id,
        leads: inseridos,
        atribuidosAoCriador: atribuidos,
        pedidoId,
        message: pedidoId
          ? `Campanha criada com ${inseridos} leads. O Excel ficou pendente de aprovação do master.`
          : `Campanha criada com ${inseridos} leads${atribuidos ? ", já na sua lista de atendimento" : ""}.`,
      });
    } catch (e) {
      console.error("[agente-listas] campanha:", e);
      return res.status(500).json({ message: "Erro ao transformar a lista em campanha." });
    }
  });
}
