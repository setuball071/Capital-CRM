// ═══════════════════════════════════════════════════════════════════════════
// ASSINATURA POR USUÁRIO
//
// Usuário → assinatura → plano → recursos. O ambiente é só informação
// relacionada: suspender uma pessoa não mexe nos colegas do mesmo ambiente.
//
// Três coisas separadas, de propósito:
//   • assinaturas          — plano, preço, vencimento, desconto, regras
//   • assinatura_cobrancas — cada mensalidade, com boleto e quitação próprios
//   • assinatura_eventos   — quem fez o quê, com valor anterior e novo
//
// Etapa 1: cadastro, cobranças manuais, boleto e quitação. NADA é bloqueado
// aqui — a rotina diária e o bloqueio no servidor entram nas etapas seguintes.
// ═══════════════════════════════════════════════════════════════════════════
import type { Express } from "express";
import multer from "multer";
import { sql } from "drizzle-orm";
import { db } from "./storage";
import { saveDocument, getDocument } from "./document-storage";

/** Cobrança nasce N dias antes do vencimento (decisão do Fábio, 07/10/2026). */
export const ANTECEDENCIA_COBRANCA_DIAS = 5;
/** Dias de atraso tolerados antes de suspender (padrão; ajustável por assinatura). */
export const TOLERANCIA_PADRAO_DIAS = 3;

export const STATUS_ASSINATURA = [
  "ativa",
  "aguardando_pagamento",
  "em_atraso",
  "suspensao_programada",
  "suspensa",
  "cancelada",
  "isenta",
] as const;

export const STATUS_COBRANCA = [
  "aberta",
  "paga",
  "vencida",
  "cancelada",
  "isenta",
  "estornada",
] as const;

// ── datas: sempre "YYYY-MM-DD", sem fuso no meio ────────────────────────────
function hojeISO(): string {
  // Data de Brasília: o vencimento é do calendário do cliente, não do servidor.
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

export function addMeses(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const alvoMes = m - 1 + n;
  const ano = a + Math.floor(alvoMes / 12);
  const mes = ((alvoMes % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia); // 31/01 + 1 mês = 28 ou 29/02, não 03/03
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function addDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diasEntre(deISO: string, ateISO: string): number {
  const a = Date.parse(`${deISO}T12:00:00Z`);
  const b = Date.parse(`${ateISO}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Próxima data com o dia de vencimento, a partir de (inclusive) uma data. */
export function proximaComDia(dia: number, aPartirDe: string): string {
  const [a, m] = aPartirDe.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const nesteMes = `${a}-${mm}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
  if (nesteMes >= aPartirDe) return nesteMes;
  return addMeses(`${a}-${mm}-${String(dia).padStart(2, "0")}`, 1);
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const dataOuNull = (v: unknown): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

// ── desconto ────────────────────────────────────────────────────────────────
/**
 * Quanto de desconto vale para uma mensalidade com este vencimento.
 * Fica de fora quando: sem tipo, fora do período, ou parcelas esgotadas.
 */
export function descontoVigente(a: any, vencimento: string): number {
  if (!a?.desconto_tipo || !a?.desconto_valor) return 0;
  if (a.desconto_inicio && vencimento < a.desconto_inicio) return 0;
  if (a.desconto_fim && vencimento > a.desconto_fim) return 0;
  if (a.desconto_parcelas_restantes !== null && a.desconto_parcelas_restantes !== undefined
    && Number(a.desconto_parcelas_restantes) <= 0) return 0;
  const base = num(a.valor_mensal);
  const valor = num(a.desconto_valor);
  const desc = a.desconto_tipo === "percentual" ? (base * valor) / 100 : valor;
  return Math.round(Math.min(Math.max(desc, 0), base) * 100) / 100;
}

// ── histórico ───────────────────────────────────────────────────────────────
async function registrarEvento(p: {
  assinaturaId: number | null;
  cobrancaId?: number | null;
  titularId: number | null;
  acao: string;
  antes?: unknown;
  depois?: unknown;
  porUserId: number | null;
}) {
  await db.execute(sql`
    INSERT INTO assinatura_eventos (assinatura_id, cobranca_id, titular_id, acao, antes, depois, por_user_id)
    VALUES (
      ${p.assinaturaId}, ${p.cobrancaId ?? null}, ${p.titularId}, ${p.acao},
      ${p.antes === undefined ? null : JSON.stringify(p.antes)}::jsonb,
      ${p.depois === undefined ? null : JSON.stringify(p.depois)}::jsonb,
      ${p.porUserId}
    )
  `);
}

/** Só as chaves que mudaram, para o histórico não virar uma parede de JSON. */
function diferenca(antes: Record<string, any>, depois: Record<string, any>) {
  const a: Record<string, any> = {};
  const d: Record<string, any> = {};
  for (const k of Object.keys(depois)) {
    if (String(antes?.[k] ?? "") !== String(depois[k] ?? "")) {
      a[k] = antes?.[k] ?? null;
      d[k] = depois[k] ?? null;
    }
  }
  return { a, d, mudou: Object.keys(d).length > 0 };
}

// Colunas de data sempre como texto: o driver do Postgres converte DATE para
// Date local e o fuso desloca o dia.
const COLS_ASSINATURA = sql`
  a.id, a.user_id, a.plano_id, a.status, a.valor_mensal, a.dia_vencimento,
  a.data_inicio::text AS data_inicio, a.proximo_vencimento::text AS proximo_vencimento,
  a.desconto_tipo, a.desconto_valor, a.desconto_inicio::text AS desconto_inicio,
  a.desconto_fim::text AS desconto_fim, a.desconto_parcelas_restantes, a.desconto_motivo,
  a.tolerancia_dias, a.suspensao_automatica, a.forma_pagamento,
  a.isenta_ate::text AS isenta_ate, a.observacoes, a.created_at, a.updated_at
`;
const COLS_COBRANCA = sql`
  c.id, c.assinatura_id, c.user_id, c.competencia, c.valor_original, c.desconto,
  c.acrescimo, c.valor_final, c.emitida_em, c.vencimento::text AS vencimento,
  c.status, c.pago_em::text AS pago_em, c.valor_pago, c.forma_pagamento,
  (c.boleto_arquivo IS NOT NULL) AS tem_boleto_arquivo, c.boleto_link,
  c.linha_digitavel, c.pix_copia_cola,
  (c.comprovante_arquivo IS NOT NULL) AS tem_comprovante, c.observacoes,
  c.created_at, c.updated_at
`;

/** Contagem regressiva sem número negativo nem frase ambígua. */
export function situacaoPrazo(vencimento: string | null, tolerancia: number, hoje = hojeISO()) {
  if (!vencimento) return { diasVencimento: null, diasSuspensao: null, texto: null as string | null };
  const dv = diasEntre(hoje, vencimento);
  const suspensaoEm = addDias(vencimento, tolerancia + 1);
  const ds = diasEntre(hoje, suspensaoEm);
  let texto: string;
  if (dv > 1) texto = `Vence em ${dv} dias`;
  else if (dv === 1) texto = "Vence amanhã";
  else if (dv === 0) texto = "Vence hoje";
  else if (ds > 0) texto = `Vencida há ${-dv} ${-dv === 1 ? "dia" : "dias"} · suspensão em ${ds} ${ds === 1 ? "dia" : "dias"}`;
  else texto = "Prazo de tolerância encerrado";
  return { diasVencimento: dv, diasSuspensao: ds, suspensaoEm, texto };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Envie PDF ou imagem (PNG, JPG, WebP)"));
  },
});

export function registerAssinaturasRoutes(app: Express, requireAuth: any) {
  const soMaster = (req: any, res: any): boolean => {
    if (req.user?.isMaster) return true;
    res.status(403).json({ message: "Acesso restrito ao master" });
    return false;
  };

  // ── Central: todas as assinaturas, com a situação calculada ───────────────
  app.get("/api/admin/assinaturas", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      const r = await db.execute(sql`
        SELECT ${COLS_ASSINATURA},
          u.name AS usuario_nome, u.email AS usuario_email, u.is_active AS usuario_ativo,
          pl.nome AS plano_nome,
          (SELECT string_agg(t.name, ', ' ORDER BY t.name)
             FROM user_tenants ut JOIN tenants t ON t.id = ut.tenant_id
            WHERE ut.user_id = a.user_id) AS ambientes,
          cur.id AS cob_id, cur.status AS cob_status, cur.vencimento::text AS cob_vencimento,
          cur.valor_final AS cob_valor,
          (cur.boleto_arquivo IS NOT NULL OR cur.boleto_link IS NOT NULL
            OR cur.linha_digitavel IS NOT NULL OR cur.pix_copia_cola IS NOT NULL) AS cob_tem_boleto,
          up.pago_em::text AS ultimo_pagamento, up.valor_pago AS ultimo_valor
        FROM assinaturas a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN planos pl ON pl.id = a.plano_id
        LEFT JOIN LATERAL (
          SELECT * FROM assinatura_cobrancas c
           WHERE c.assinatura_id = a.id AND c.status IN ('aberta','vencida')
           ORDER BY c.vencimento ASC LIMIT 1
        ) cur ON true
        LEFT JOIN LATERAL (
          SELECT pago_em, valor_pago FROM assinatura_cobrancas c
           WHERE c.assinatura_id = a.id AND c.status = 'paga'
           ORDER BY c.pago_em DESC NULLS LAST LIMIT 1
        ) up ON true
        ORDER BY (a.status = 'cancelada'), u.name
      `);
      const hoje = hojeISO();
      res.json(
        (r.rows as any[]).map((a) => {
          const venc = a.cob_vencimento || a.proximo_vencimento;
          const desconto = descontoVigente(a, venc || hoje);
          return {
            ...a,
            valor_mensal: num(a.valor_mensal),
            desconto_aplicado: desconto,
            valor_final: Math.round((num(a.valor_mensal) - desconto) * 100) / 100,
            prazo: situacaoPrazo(venc, Number(a.tolerancia_dias ?? TOLERANCIA_PADRAO_DIAS), hoje),
          };
        }),
      );
    } catch (e: any) {
      console.error("[ASSINATURAS] listar:", e?.message);
      res.status(500).json({ message: "Erro ao listar assinaturas" });
    }
  });

  // ── Assinatura de um usuário (seção "Assinatura e acesso") ────────────────
  app.get("/api/admin/assinaturas/usuario/:userId", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      const userId = parseInt(req.params.userId);
      const [a] = (await db.execute(sql`
        SELECT ${COLS_ASSINATURA} FROM assinaturas a WHERE a.user_id = ${userId}
      `)).rows as any[];
      if (!a) return res.json({ assinatura: null, cobrancas: [], eventos: [] });
      const cob = await db.execute(sql`
        SELECT ${COLS_COBRANCA} FROM assinatura_cobrancas c
         WHERE c.assinatura_id = ${a.id} ORDER BY c.vencimento DESC
      `);
      const ev = await db.execute(sql`
        SELECT e.id, e.acao, e.antes, e.depois, e.criado_em, e.cobranca_id, u.name AS por_nome
          FROM assinatura_eventos e LEFT JOIN users u ON u.id = e.por_user_id
         WHERE e.assinatura_id = ${a.id} ORDER BY e.criado_em DESC LIMIT 100
      `);
      res.json({ assinatura: a, cobrancas: cob.rows, eventos: ev.rows });
    } catch (e: any) {
      console.error("[ASSINATURAS] usuario:", e?.message);
      res.status(500).json({ message: "Erro ao buscar a assinatura" });
    }
  });

  app.put("/api/admin/assinaturas/usuario/:userId", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      const userId = parseInt(req.params.userId);
      const [usuario] = (await db.execute(sql`SELECT id FROM users WHERE id = ${userId}`)).rows as any[];
      if (!usuario) return res.status(404).json({ message: "Usuário não encontrado" });

      const b = req.body || {};
      const status = STATUS_ASSINATURA.includes(b.status) ? b.status : "ativa";
      const planoId = b.plano_id ? parseInt(b.plano_id) : null;

      let valorMensal = b.valor_mensal === "" || b.valor_mensal === null || b.valor_mensal === undefined
        ? null : num(b.valor_mensal);
      if (valorMensal === null && planoId) {
        const [pl] = (await db.execute(sql`SELECT valor, preco_mensal FROM planos WHERE id = ${planoId}`)).rows as any[];
        valorMensal = num(pl?.valor ?? pl?.preco_mensal);
      }

      const dia = Math.min(28, Math.max(1, parseInt(b.dia_vencimento) || 10));
      const inicio = dataOuNull(b.data_inicio) || hojeISO();
      const descTipo = b.desconto_tipo === "percentual" || b.desconto_tipo === "valor" ? b.desconto_tipo : null;

      const novo = {
        plano_id: planoId,
        status,
        valor_mensal: valorMensal ?? 0,
        dia_vencimento: dia,
        data_inicio: inicio,
        proximo_vencimento: dataOuNull(b.proximo_vencimento) || proximaComDia(dia, inicio),
        desconto_tipo: descTipo,
        desconto_valor: descTipo ? num(b.desconto_valor) : null,
        desconto_inicio: descTipo ? dataOuNull(b.desconto_inicio) : null,
        desconto_fim: descTipo ? dataOuNull(b.desconto_fim) : null,
        desconto_parcelas_restantes:
          descTipo && b.desconto_parcelas !== "" && b.desconto_parcelas !== null && b.desconto_parcelas !== undefined
            ? Math.max(0, parseInt(b.desconto_parcelas) || 0) : null,
        desconto_motivo: descTipo ? (b.desconto_motivo || null) : null,
        tolerancia_dias: Math.min(60, Math.max(0, parseInt(b.tolerancia_dias ?? TOLERANCIA_PADRAO_DIAS))),
        suspensao_automatica: b.suspensao_automatica !== false,
        forma_pagamento: b.forma_pagamento || null,
        isenta_ate: status === "isenta" ? dataOuNull(b.isenta_ate) : null,
        observacoes: b.observacoes || null,
      };

      const [atual] = (await db.execute(sql`
        SELECT ${COLS_ASSINATURA} FROM assinaturas a WHERE a.user_id = ${userId}
      `)).rows as any[];

      const [salva] = (await db.execute(sql`
        INSERT INTO assinaturas (
          user_id, plano_id, status, valor_mensal, dia_vencimento, data_inicio, proximo_vencimento,
          desconto_tipo, desconto_valor, desconto_inicio, desconto_fim, desconto_parcelas_restantes,
          desconto_motivo, tolerancia_dias, suspensao_automatica, forma_pagamento, isenta_ate,
          observacoes, criado_por
        ) VALUES (
          ${userId}, ${novo.plano_id}, ${novo.status}, ${novo.valor_mensal}, ${novo.dia_vencimento},
          ${novo.data_inicio}, ${novo.proximo_vencimento}, ${novo.desconto_tipo}, ${novo.desconto_valor},
          ${novo.desconto_inicio}, ${novo.desconto_fim}, ${novo.desconto_parcelas_restantes},
          ${novo.desconto_motivo}, ${novo.tolerancia_dias}, ${novo.suspensao_automatica},
          ${novo.forma_pagamento}, ${novo.isenta_ate}, ${novo.observacoes}, ${req.user.id}
        )
        ON CONFLICT (user_id) DO UPDATE SET
          plano_id = EXCLUDED.plano_id, status = EXCLUDED.status, valor_mensal = EXCLUDED.valor_mensal,
          dia_vencimento = EXCLUDED.dia_vencimento, data_inicio = EXCLUDED.data_inicio,
          proximo_vencimento = EXCLUDED.proximo_vencimento, desconto_tipo = EXCLUDED.desconto_tipo,
          desconto_valor = EXCLUDED.desconto_valor, desconto_inicio = EXCLUDED.desconto_inicio,
          desconto_fim = EXCLUDED.desconto_fim,
          desconto_parcelas_restantes = EXCLUDED.desconto_parcelas_restantes,
          desconto_motivo = EXCLUDED.desconto_motivo, tolerancia_dias = EXCLUDED.tolerancia_dias,
          suspensao_automatica = EXCLUDED.suspensao_automatica,
          forma_pagamento = EXCLUDED.forma_pagamento, isenta_ate = EXCLUDED.isenta_ate,
          observacoes = EXCLUDED.observacoes, updated_at = NOW()
        RETURNING id
      `)).rows as any[];

      // Histórico: cada assunto vira um evento próprio, para responder
      // "quem concedeu o desconto" sem garimpar uma alteração genérica.
      const grupos: Record<string, string[]> = {
        plano_alterado: ["plano_id", "valor_mensal"],
        desconto_alterado: ["desconto_tipo", "desconto_valor", "desconto_inicio", "desconto_fim",
          "desconto_parcelas_restantes", "desconto_motivo"],
        situacao_alterada: ["status", "isenta_ate"],
        vencimento_alterado: ["dia_vencimento", "proximo_vencimento", "data_inicio", "tolerancia_dias",
          "suspensao_automatica"],
        dados_alterados: ["forma_pagamento", "observacoes"],
      };
      if (!atual) {
        await registrarEvento({ assinaturaId: salva.id, titularId: userId, acao: "criada",
          depois: novo, porUserId: req.user.id });
      } else {
        for (const [acao, chaves] of Object.entries(grupos)) {
          const sub = (o: any) => Object.fromEntries(chaves.map((k) => [k, o?.[k] ?? null]));
          const { a, d, mudou } = diferenca(sub(atual), sub(novo));
          if (mudou) {
            await registrarEvento({ assinaturaId: salva.id, titularId: userId, acao, antes: a, depois: d,
              porUserId: req.user.id });
          }
        }
      }
      res.json({ id: salva.id });
    } catch (e: any) {
      console.error("[ASSINATURAS] salvar:", e?.message);
      res.status(500).json({ message: "Erro ao salvar a assinatura" });
    }
  });

  // ── Gera a mensalidade (manual nesta etapa) ───────────────────────────────
  app.post("/api/admin/assinaturas/:id/cobrancas", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      const id = parseInt(req.params.id);
      const [a] = (await db.execute(sql`SELECT ${COLS_ASSINATURA} FROM assinaturas a WHERE a.id = ${id}`)).rows as any[];
      if (!a) return res.status(404).json({ message: "Assinatura não encontrada" });
      if (a.status === "cancelada") return res.status(400).json({ message: "Assinatura cancelada" });

      const vencimento = dataOuNull(req.body?.vencimento) || a.proximo_vencimento;
      if (!vencimento) return res.status(400).json({ message: "Defina o próximo vencimento da assinatura" });
      const competencia = vencimento.slice(0, 7);
      const original = num(a.valor_mensal);
      const desconto = a.status === "isenta" ? original : descontoVigente(a, vencimento);
      const acrescimo = Math.max(0, num(req.body?.acrescimo));
      const final = Math.round((original - desconto + acrescimo) * 100) / 100;

      // UNIQUE (assinatura_id, competencia): clicar duas vezes não gera duas mensalidades.
      const [cob] = (await db.execute(sql`
        INSERT INTO assinatura_cobrancas (assinatura_id, user_id, competencia, valor_original, desconto,
          acrescimo, valor_final, vencimento, status, observacoes)
        VALUES (${a.id}, ${a.user_id}, ${competencia}, ${original}, ${desconto}, ${acrescimo}, ${final},
          ${vencimento}, ${a.status === "isenta" ? "isenta" : "aberta"}, ${req.body?.observacoes || null})
        ON CONFLICT (assinatura_id, competencia) DO NOTHING
        RETURNING id
      `)).rows as any[];
      if (!cob) return res.status(409).json({ message: `Já existe mensalidade da competência ${competencia}` });

      // Desconto por quantidade de mensalidades: esta consumiu uma.
      if (desconto > 0 && a.status !== "isenta" && a.desconto_parcelas_restantes !== null) {
        await db.execute(sql`
          UPDATE assinaturas SET desconto_parcelas_restantes = GREATEST(desconto_parcelas_restantes - 1, 0)
           WHERE id = ${a.id}
        `);
      }
      await registrarEvento({ assinaturaId: a.id, cobrancaId: cob.id, titularId: a.user_id,
        acao: "cobranca_gerada",
        depois: { competencia, vencimento, valor_original: original, desconto, acrescimo, valor_final: final },
        porUserId: req.user.id });
      res.json({ id: cob.id });
    } catch (e: any) {
      console.error("[ASSINATURAS] gerar cobranca:", e?.message);
      res.status(500).json({ message: "Erro ao gerar a mensalidade" });
    }
  });

  // ── Edita dados de pagamento da cobrança (boleto por link, linha, Pix) ────
  app.patch("/api/admin/cobrancas/:id", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      const id = parseInt(req.params.id);
      const [c] = (await db.execute(sql`SELECT ${COLS_COBRANCA} FROM assinatura_cobrancas c WHERE c.id = ${id}`)).rows as any[];
      if (!c) return res.status(404).json({ message: "Cobrança não encontrada" });
      const b = req.body || {};
      const novo = {
        boleto_link: b.boleto_link ?? c.boleto_link,
        linha_digitavel: b.linha_digitavel ?? c.linha_digitavel,
        pix_copia_cola: b.pix_copia_cola ?? c.pix_copia_cola,
        observacoes: b.observacoes ?? c.observacoes,
      };
      // Só estes status saem por aqui; "paga" tem rota própria, com quitação.
      let status = c.status;
      if (["cancelada", "isenta", "estornada"].includes(b.status)) {
        if (c.status === "paga" && b.status !== "estornada") {
          return res.status(400).json({ message: "Cobrança paga só pode ser estornada" });
        }
        status = b.status;
      }
      await db.execute(sql`
        UPDATE assinatura_cobrancas SET boleto_link = ${novo.boleto_link || null},
          linha_digitavel = ${novo.linha_digitavel || null}, pix_copia_cola = ${novo.pix_copia_cola || null},
          observacoes = ${novo.observacoes || null}, status = ${status}, updated_at = NOW()
         WHERE id = ${id}
      `);
      // Mensalidade cancelada devolve a parcela de desconto que tinha consumido.
      if (status === "cancelada" && c.status !== "cancelada" && num(c.desconto) > 0) {
        await db.execute(sql`
          UPDATE assinaturas SET desconto_parcelas_restantes = desconto_parcelas_restantes + 1
           WHERE id = ${c.assinatura_id} AND desconto_parcelas_restantes IS NOT NULL
        `);
      }
      const { a, d, mudou } = diferenca(
        { ...c, status: c.status },
        { ...novo, status },
      );
      if (mudou) {
        await registrarEvento({ assinaturaId: c.assinatura_id, cobrancaId: id, titularId: c.user_id,
          acao: status !== c.status ? `cobranca_${status}` : "cobranca_alterada", antes: a, depois: d,
          porUserId: req.user.id });
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[ASSINATURAS] editar cobranca:", e?.message);
      res.status(500).json({ message: "Erro ao salvar a cobrança" });
    }
  });

  // ── Anexa boleto ou comprovante (arquivo) ─────────────────────────────────
  app.post("/api/admin/cobrancas/:id/arquivo", requireAuth, (req: any, res, next) => {
    if (!soMaster(req, res)) return;
    upload.single("file")(req, res, (err: any) => {
      if (err) return res.status(400).json({ message: err.message || "Arquivo inválido" });
      next();
    });
  }, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const tipo = req.query.tipo === "comprovante" ? "comprovante" : "boleto";
      if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
      const [c] = (await db.execute(sql`SELECT id, assinatura_id, user_id FROM assinatura_cobrancas WHERE id = ${id}`)).rows as any[];
      if (!c) return res.status(404).json({ message: "Cobrança não encontrada" });

      const ext = req.file.mimetype === "application/pdf" ? "pdf"
        : req.file.mimetype === "image/png" ? "png"
        : req.file.mimetype === "image/webp" ? "webp" : "jpg";
      // Caminho só com ids: o nome original do arquivo nunca entra na chave.
      const caminho = `assinaturas/${c.user_id}/cobranca-${id}-${tipo}-${Date.now()}.${ext}`;
      await saveDocument(caminho, req.file.buffer, req.file.mimetype);

      if (tipo === "boleto") {
        await db.execute(sql`UPDATE assinatura_cobrancas SET boleto_arquivo = ${caminho}, updated_at = NOW() WHERE id = ${id}`);
      } else {
        await db.execute(sql`UPDATE assinatura_cobrancas SET comprovante_arquivo = ${caminho}, updated_at = NOW() WHERE id = ${id}`);
      }
      // Anexar NÃO muda situação de nada: boleto anexado não é boleto pago.
      await registrarEvento({ assinaturaId: c.assinatura_id, cobrancaId: id, titularId: c.user_id,
        acao: tipo === "boleto" ? "boleto_anexado" : "comprovante_anexado",
        depois: { arquivo: caminho, tamanho: req.file.size }, porUserId: req.user.id });
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[ASSINATURAS] anexar:", e?.message);
      res.status(500).json({ message: "Erro ao anexar o arquivo" });
    }
  });

  // ── Quitação manual (o webhook do gateway, no futuro, chama a mesma função) ─
  app.post("/api/admin/cobrancas/:id/pagar", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      const r = await confirmarPagamento({
        cobrancaId: parseInt(req.params.id),
        pagoEm: dataOuNull(req.body?.pago_em) || hojeISO(),
        valorPago: req.body?.valor_pago !== undefined && req.body?.valor_pago !== "" ? num(req.body.valor_pago) : null,
        forma: req.body?.forma_pagamento || null,
        observacoes: req.body?.observacoes || null,
        porUserId: req.user.id,
      });
      if (!r.ok) return res.status(r.status).json({ message: r.message });
      res.json(r);
    } catch (e: any) {
      console.error("[ASSINATURAS] pagar:", e?.message);
      res.status(500).json({ message: "Erro ao confirmar o pagamento" });
    }
  });

  // ── Download protegido: o dono ou o master. Ninguém mais. ─────────────────
  app.get("/api/cobrancas/:id/arquivo/:tipo", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const tipo = req.params.tipo === "comprovante" ? "comprovante" : "boleto";
      const [c] = (await db.execute(sql`
        SELECT user_id, boleto_arquivo, comprovante_arquivo FROM assinatura_cobrancas WHERE id = ${id}
      `)).rows as any[];
      // 404 em vez de 403: trocar o número na URL não confirma que a cobrança existe.
      if (!c || (!req.user?.isMaster && c.user_id !== req.user?.id)) {
        return res.status(404).json({ message: "Arquivo não encontrado" });
      }
      const caminho = tipo === "boleto" ? c.boleto_arquivo : c.comprovante_arquivo;
      if (!caminho) return res.status(404).json({ message: "Arquivo não encontrado" });
      const { buffer, contentType } = await getDocument(caminho);
      const ext = caminho.slice(caminho.lastIndexOf(".") + 1);
      const tipos: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
      res.setHeader("Content-Type", contentType || tipos[ext] || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${tipo}-${id}.${ext}"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(buffer);
    } catch (e: any) {
      console.error("[ASSINATURAS] baixar:", e?.message);
      res.status(404).json({ message: "Arquivo não encontrado" });
    }
  });
}

/**
 * Confirma o pagamento de uma mensalidade. Única porta de quitação: a tela
 * do master usa agora, o webhook do gateway vai usar depois.
 *
 * Contra duplicidade:
 *  • a cobrança só passa de aberta/vencida para paga UMA vez (UPDATE condicional);
 *  • o próximo vencimento sai da competência paga, não da data de hoje, e só
 *    anda para frente — pagar uma mensalidade antiga não puxa a data para trás.
 */
export async function confirmarPagamento(p: {
  cobrancaId: number;
  pagoEm: string;
  valorPago: number | null;
  forma: string | null;
  observacoes: string | null;
  porUserId: number | null;
}): Promise<{ ok: true; proximoVencimento: string } | { ok: false; status: number; message: string }> {
  const [c] = (await db.execute(sql`
    UPDATE assinatura_cobrancas
       SET status = 'paga', pago_em = ${p.pagoEm}, valor_pago = COALESCE(${p.valorPago}, valor_final),
           forma_pagamento = COALESCE(${p.forma}, forma_pagamento),
           observacoes = COALESCE(${p.observacoes}, observacoes), updated_at = NOW()
     WHERE id = ${p.cobrancaId} AND status IN ('aberta', 'vencida')
    RETURNING id, assinatura_id, user_id, vencimento::text AS vencimento, valor_final, valor_pago
  `)).rows as any[];

  if (!c) {
    const [existe] = (await db.execute(sql`SELECT status FROM assinatura_cobrancas WHERE id = ${p.cobrancaId}`)).rows as any[];
    if (!existe) return { ok: false, status: 404, message: "Cobrança não encontrada" };
    return { ok: false, status: 409, message: `Esta cobrança já está como "${existe.status}" — nada foi alterado` };
  }

  const proximo = addMeses(c.vencimento, 1);
  await db.execute(sql`
    UPDATE assinaturas
       SET proximo_vencimento = GREATEST(COALESCE(proximo_vencimento, ${proximo}::date), ${proximo}::date),
           status = CASE WHEN status IN ('cancelada', 'isenta') THEN status ELSE 'ativa' END,
           updated_at = NOW()
     WHERE id = ${c.assinatura_id}
  `);
  const [a] = (await db.execute(sql`SELECT proximo_vencimento::text AS pv FROM assinaturas WHERE id = ${c.assinatura_id}`)).rows as any[];

  await registrarEvento({
    assinaturaId: c.assinatura_id, cobrancaId: c.id, titularId: c.user_id, acao: "pagamento_confirmado",
    depois: { pago_em: p.pagoEm, valor_pago: num(c.valor_pago), forma: p.forma, proximo_vencimento: a?.pv },
    porUserId: p.porUserId,
  });
  return { ok: true, proximoVencimento: a?.pv || proximo };
}
