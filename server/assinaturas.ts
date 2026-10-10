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
import { MODULOS_CATALOGO } from "@shared/modulos";
import { createNotification } from "./notification-service";

/** Cobrança nasce N dias antes do vencimento (decisão do Fábio, 07/10/2026). */
export const ANTECEDENCIA_COBRANCA_DIAS = 5;
/**
 * Chave geral da suspensão AUTOMÁTICA, ligada pelo master na central (tabela
 * assinatura_config). Desligada = simulação: a rotina só marca "suspensão
 * programada" e o aviso ao cliente NÃO fala em suspensão, porque prometer um
 * bloqueio que não acontece ensina o cliente a ignorar o aviso.
 * A suspensão MANUAL (master escolhe "Suspensa") bloqueia sempre.
 */
let suspensaoCache: { valor: boolean; ate: number } | null = null;
export async function suspensaoAtiva(): Promise<boolean> {
  if (suspensaoCache && suspensaoCache.ate > Date.now()) return suspensaoCache.valor;
  const [r] = (await db.execute(sql`
    SELECT valor FROM assinatura_config WHERE chave = 'suspensao_automatica_ativa'
  `)).rows as any[];
  const valor = r?.valor === true;
  suspensaoCache = { valor, ate: Date.now() + 60_000 };
  return valor;
}

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
  a.isenta_ate::text AS isenta_ate, a.observacoes, a.created_at, a.updated_at,
  a.pagador_nome, a.pagador_documento, a.pagador_email, a.pagador_telefone
`;
const COLS_COBRANCA = sql`
  c.id, c.assinatura_id, c.user_id, c.competencia, c.valor_original, c.desconto,
  c.acrescimo, c.valor_final, c.emitida_em, c.vencimento::text AS vencimento,
  c.status, c.pago_em::text AS pago_em, c.valor_pago, c.forma_pagamento,
  (c.boleto_arquivo IS NOT NULL) AS tem_boleto_arquivo, c.boleto_link,
  c.linha_digitavel, c.pix_copia_cola,
  (c.comprovante_arquivo IS NOT NULL) AS tem_comprovante, c.observacoes,
  c.pagamento_informado_em, c.created_at, c.updated_at
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

// ── O que o próprio assinante vê ────────────────────────────────────────────
export type AlertaAssinatura = {
  nivel: "info" | "aviso" | "urgente" | "suspenso";
  texto: string;
  diasVencimento: number | null;
  diasSuspensao: number | null;
};

/**
 * Aviso que aparece no topo de toda tela do assinante. Frases curtas e
 * objetivas, sem contagem negativa. Sem travessão: é texto de cliente.
 */
export function alertaAssinatura(
  a: any, cobranca: any | null, hoje = hojeISO(), suspensaoLigada = false,
): AlertaAssinatura | null {
  if (!a || a.status === "cancelada") return null;
  const temBoleto = !!(cobranca && (cobranca.tem_boleto_arquivo || cobranca.boleto_link
    || cobranca.linha_digitavel || cobranca.pix_copia_cola));
  const fraseBoleto = temBoleto
    ? " O boleto já está disponível em Minha assinatura."
    : " O boleto ainda não foi disponibilizado.";

  if (a.status === "isenta") {
    if (!a.isenta_ate) return null;
    const d = diasEntre(hoje, a.isenta_ate);
    if (d < 0 || d > ANTECEDENCIA_COBRANCA_DIAS) return null;
    return { nivel: "info", diasVencimento: d, diasSuspensao: null,
      texto: d === 0 ? "Sua cortesia termina hoje." : `Sua cortesia termina em ${d} ${d === 1 ? "dia" : "dias"}.` };
  }
  if (a.status === "suspensa") {
    return { nivel: "suspenso", diasVencimento: null, diasSuspensao: 0,
      texto: "Seu acesso foi temporariamente suspenso devido à mensalidade em aberto. Acesse Minha assinatura para consultar o boleto e regularizar." };
  }

  const venc = cobranca?.vencimento || a.proximo_vencimento;
  if (!venc) return null;
  const tol = Number(a.tolerancia_dias ?? TOLERANCIA_PADRAO_DIAS);
  const p = situacaoPrazo(venc, tol, hoje);
  const dv = p.diasVencimento as number;
  const ds = p.diasSuspensao as number;
  const base = { diasVencimento: dv, diasSuspensao: ds };

  if (dv > ANTECEDENCIA_COBRANCA_DIAS) return null;
  if (dv > 1) return { ...base, nivel: "info", texto: `Sua mensalidade vence em ${dv} dias.${fraseBoleto}` };
  if (dv === 1) return { ...base, nivel: "info", texto: `Sua mensalidade vence amanhã.${fraseBoleto}` };
  if (dv === 0) return { ...base, nivel: "aviso", texto: `Sua mensalidade vence hoje.${fraseBoleto}` };

  const atraso = -dv;
  const vencida = `Sua mensalidade está vencida há ${atraso} ${atraso === 1 ? "dia" : "dias"}.`;
  if (a.suspensao_automatica === false || !suspensaoLigada) {
    return { ...base, nivel: "urgente", texto: `${vencida}${fraseBoleto}` };
  }
  if (ds > 0) {
    return { ...base, nivel: "urgente",
      texto: `${vencida} ${ds === 1 ? "Falta 1 dia" : `Faltam ${ds} dias`} para a suspensão do acesso.${fraseBoleto}` };
  }
  return { ...base, nivel: "urgente",
    texto: `${vencida} O prazo de tolerância terminou e o acesso pode ser suspenso.${fraseBoleto}` };
}

/** WhatsApp de suporte que aparece em Minha assinatura (só dígitos, com DDI). */
async function whatsappSuporte(): Promise<string | null> {
  const [r] = (await db.execute(sql`
    SELECT valor FROM assinatura_config WHERE chave = 'whatsapp_suporte'
  `)).rows as any[];
  const n = typeof r?.valor === "string" ? r.valor.replace(/\D/g, "") : "";
  return n.length >= 10 ? n : null;
}

/** Tudo que a tela Minha assinatura precisa, só do próprio usuário. */
export async function minhaAssinatura(userId: number) {
  const [a] = (await db.execute(sql`
    SELECT ${COLS_ASSINATURA}, pl.nome AS plano_nome
      FROM assinaturas a LEFT JOIN planos pl ON pl.id = a.plano_id
     WHERE a.user_id = ${userId}
  `)).rows as any[];
  if (!a) return null;

  const cobrancas = (await db.execute(sql`
    SELECT ${COLS_COBRANCA} FROM assinatura_cobrancas c
     WHERE c.assinatura_id = ${a.id} ORDER BY c.vencimento DESC
  `)).rows as any[];
  // Cobrança atual = a mais antiga ainda em aberto; é a que precisa ser paga primeiro.
  const emAberto = cobrancas.filter((c) => c.status === "aberta" || c.status === "vencida");
  const atual = emAberto.length ? emAberto[emAberto.length - 1] : null;

  const modulos = a.plano_id
    ? ((await db.execute(sql`SELECT modulo_key FROM plano_modulos WHERE plano_id = ${a.plano_id}`)).rows as any[])
        .map((m) => MODULOS_CATALOGO.find((x) => x.key === m.modulo_key)?.nome || m.modulo_key)
    : [];

  const hoje = hojeISO();
  const venc = atual?.vencimento || a.proximo_vencimento;
  const desconto = descontoVigente(a, venc || hoje);
  return {
    assinatura: {
      plano: a.plano_nome,
      status: a.status,
      valor_mensal: num(a.valor_mensal),
      desconto,
      valor_final: Math.round((num(a.valor_mensal) - desconto) * 100) / 100,
      desconto_motivo: desconto > 0 ? a.desconto_motivo : null,
      proximo_vencimento: a.proximo_vencimento,
      forma_pagamento: a.forma_pagamento,
      tolerancia_dias: a.tolerancia_dias,
      isenta_ate: a.isenta_ate,
      recursos: modulos,
    },
    cobrancaAtual: atual,
    historico: cobrancas.filter((c) => c.id !== atual?.id),
    prazo: situacaoPrazo(venc, Number(a.tolerancia_dias ?? TOLERANCIA_PADRAO_DIAS), hoje),
    alerta: alertaAssinatura(a, atual, hoje, await suspensaoAtiva()),
    whatsappSuporte: await whatsappSuporte(),
  };
}

/**
 * Cria a mensalidade de um vencimento. Usada pelo botão do master e pela
 * rotina diária. Devolve null se a competência já existe (UNIQUE): clicar
 * duas vezes, ou a rotina rodar duas vezes, não gera duas mensalidades.
 */
async function gerarCobranca(
  a: any,
  vencimento: string,
  o: { acrescimo?: number; observacoes?: string | null; porUserId: number | null },
): Promise<{ id: number; competencia: string } | null> {
  const competencia = vencimento.slice(0, 7);
  const original = num(a.valor_mensal);
  const desconto = a.status === "isenta" ? original : descontoVigente(a, vencimento);
  const acrescimo = o.acrescimo || 0;
  const final = Math.round((original - desconto + acrescimo) * 100) / 100;

  const [cob] = (await db.execute(sql`
    INSERT INTO assinatura_cobrancas (assinatura_id, user_id, competencia, valor_original, desconto,
      acrescimo, valor_final, vencimento, status, observacoes)
    VALUES (${a.id}, ${a.user_id}, ${competencia}, ${original}, ${desconto}, ${acrescimo}, ${final},
      ${vencimento}, ${a.status === "isenta" ? "isenta" : "aberta"}, ${o.observacoes || null})
    ON CONFLICT (assinatura_id, competencia) DO NOTHING
    RETURNING id
  `)).rows as any[];
  if (!cob) return null;

  // Desconto por quantidade de mensalidades: esta consumiu uma.
  if (desconto > 0 && a.status !== "isenta" && a.desconto_parcelas_restantes !== null) {
    await db.execute(sql`
      UPDATE assinaturas SET desconto_parcelas_restantes = GREATEST(desconto_parcelas_restantes - 1, 0)
       WHERE id = ${a.id}
    `);
  }
  await registrarEvento({ assinaturaId: a.id, cobrancaId: cob.id, titularId: a.user_id,
    acao: "cobranca_gerada",
    depois: { competencia, vencimento, valor_original: original, desconto, acrescimo, valor_final: final,
      ...(o.porUserId ? {} : { origem: "rotina diária" }) },
    porUserId: o.porUserId });
  return { id: cob.id, competencia };
}

async function avisarDonos(title: string, message: string, actionUrl = "/admin/assinaturas") {
  const donos = (await db.execute(sql`SELECT id FROM users WHERE is_master = true AND is_active = true`)).rows as any[];
  for (const d of donos) {
    await createNotification({ userId: Number(d.id), title, message, type: "assinatura", actionUrl });
  }
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
          cur.valor_final AS cob_valor, cur.pagamento_informado_em AS cob_pagamento_informado_em,
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
      limparCacheBloqueio(userId);
      res.json({ id: salva.id });
    } catch (e: any) {
      console.error("[ASSINATURAS] salvar:", e?.message);
      res.status(500).json({ message: "Erro ao salvar a assinatura" });
    }
  });

  // ── Dados do pagador (para emitir o boleto no site do banco) ──────────────
  app.put("/api/admin/assinaturas/:id/pagador", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      const id = parseInt(req.params.id);
      const [a] = (await db.execute(sql`SELECT ${COLS_ASSINATURA} FROM assinaturas a WHERE a.id = ${id}`)).rows as any[];
      if (!a) return res.status(404).json({ message: "Assinatura não encontrada" });
      const limpa = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
      const novo = {
        pagador_nome: limpa(req.body?.pagador_nome, 200),
        pagador_documento: limpa(req.body?.pagador_documento, 30),
        pagador_email: limpa(req.body?.pagador_email, 200),
        pagador_telefone: limpa(req.body?.pagador_telefone, 30),
      };
      await db.execute(sql`
        UPDATE assinaturas SET pagador_nome = ${novo.pagador_nome}, pagador_documento = ${novo.pagador_documento},
               pagador_email = ${novo.pagador_email}, pagador_telefone = ${novo.pagador_telefone}, updated_at = NOW()
         WHERE id = ${id}
      `);
      const { a: antes, d: depois, mudou } = diferenca(a, novo);
      if (mudou) {
        await registrarEvento({ assinaturaId: id, titularId: a.user_id, acao: "pagador_alterado",
          antes, depois, porUserId: req.user.id });
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[ASSINATURAS] pagador:", e?.message);
      res.status(500).json({ message: "Erro ao salvar os dados do pagador" });
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
      const r = await gerarCobranca(a, vencimento, {
        acrescimo: Math.max(0, num(req.body?.acrescimo)),
        observacoes: req.body?.observacoes || null,
        porUserId: req.user.id,
      });
      if (!r) return res.status(409).json({ message: `Já existe mensalidade da competência ${vencimento.slice(0, 7)}` });
      res.json({ id: r.id });
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
      // Mensalidade isentada conta como resolvida: o vencimento anda, como no
      // pagamento. Sem isso a rotina diária ficaria presa nesta competência.
      if (status === "isenta" && c.status !== "isenta") {
        const proximo = addMeses(c.vencimento, 1);
        await db.execute(sql`
          UPDATE assinaturas
             SET proximo_vencimento = GREATEST(COALESCE(proximo_vencimento, ${proximo}::date), ${proximo}::date),
                 updated_at = NOW()
           WHERE id = ${c.assinatura_id}
        `);
      }
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

  // ── Chave geral da suspensão automática ───────────────────────────────────
  app.get("/api/admin/assinaturas/config", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      const [r] = (await db.execute(sql`
        SELECT c.valor, c.updated_at, u.name AS por_nome
          FROM assinatura_config c LEFT JOIN users u ON u.id = c.updated_by
         WHERE c.chave = 'suspensao_automatica_ativa'
      `)).rows as any[];
      res.json({
        suspensaoAtiva: r?.valor === true, alteradoEm: r?.updated_at || null, alteradoPor: r?.por_nome || null,
        whatsappSuporte: await whatsappSuporte(),
      });
    } catch (e: any) {
      console.error("[ASSINATURAS] config:", e?.message);
      res.status(500).json({ message: "Erro ao ler a configuração" });
    }
  });

  app.put("/api/admin/assinaturas/config", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      if (typeof req.body?.whatsappSuporte === "string") {
        const n = req.body.whatsappSuporte.replace(/\D/g, "");
        if (n && n.length < 10) return res.status(400).json({ message: "WhatsApp inválido: use DDI + DDD + número" });
        await db.execute(sql`
          INSERT INTO assinatura_config (chave, valor, updated_at, updated_by)
          VALUES ('whatsapp_suporte', ${JSON.stringify(n || null)}::jsonb, NOW(), ${req.user.id})
          ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW(), updated_by = EXCLUDED.updated_by
        `);
      }
      if (typeof req.body?.suspensaoAtiva === "boolean") {
        const ligar = req.body.suspensaoAtiva;
        await db.execute(sql`
          INSERT INTO assinatura_config (chave, valor, updated_at, updated_by)
          VALUES ('suspensao_automatica_ativa', ${JSON.stringify(ligar)}::jsonb, NOW(), ${req.user.id})
          ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW(), updated_by = EXCLUDED.updated_by
        `);
        suspensaoCache = null;
        console.log(`[ASSINATURAS] suspensão automática ${ligar ? "LIGADA" : "desligada"} por ${req.user.id}`);
      }
      res.json({ suspensaoAtiva: await suspensaoAtiva(), whatsappSuporte: await whatsappSuporte() });
    } catch (e: any) {
      console.error("[ASSINATURAS] config salvar:", e?.message);
      res.status(500).json({ message: "Erro ao salvar a configuração" });
    }
  });

  // ── Rotina diária: executar agora e ver as últimas execuções ──────────────
  app.post("/api/admin/assinaturas/rotina/executar", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      res.json(await executarRotina("manual"));
    } catch (e: any) {
      console.error("[ASSINATURAS] rotina manual:", e?.message);
      res.status(500).json({ message: "Erro ao executar a rotina" });
    }
  });

  app.get("/api/admin/assinaturas/rotina/execucoes", requireAuth, async (req: any, res) => {
    if (!soMaster(req, res)) return;
    try {
      const r = await db.execute(sql`
        SELECT id, data::text AS data, origem, iniciada_em, terminada_em, resultado, erro
          FROM rotina_execucoes WHERE rotina = ${ROTINA} ORDER BY iniciada_em DESC LIMIT 10
      `);
      res.json(r.rows);
    } catch (e: any) {
      console.error("[ASSINATURAS] execucoes:", e?.message);
      res.status(500).json({ message: "Erro ao listar execuções" });
    }
  });

  // ── Minha assinatura: só a do próprio usuário, nunca por id na URL ────────
  app.get("/api/minha-assinatura", requireAuth, async (req: any, res) => {
    try {
      res.json(await minhaAssinatura(req.user.id));
    } catch (e: any) {
      console.error("[ASSINATURAS] minha:", e?.message);
      res.status(500).json({ message: "Erro ao buscar sua assinatura" });
    }
  });

  // ── "Já paguei": avisa o master. NÃO muda situação nenhuma: quem libera é
  // a confirmação do pagamento (master agora, webhook depois).
  app.post("/api/minha-assinatura/informar-pagamento", requireAuth, async (req: any, res) => {
    try {
      const [a] = (await db.execute(sql`SELECT id FROM assinaturas WHERE user_id = ${req.user.id}`)).rows as any[];
      if (!a) return res.status(404).json({ message: "Você não possui assinatura" });
      const [c] = (await db.execute(sql`
        SELECT id, competencia, valor_final, pagamento_informado_em FROM assinatura_cobrancas
         WHERE assinatura_id = ${a.id} AND status IN ('aberta', 'vencida') ORDER BY vencimento ASC LIMIT 1
      `)).rows as any[];
      if (!c) return res.status(404).json({ message: "Nenhuma mensalidade em aberto" });
      // Clicar de novo não gera outro aviso: o primeiro já está na central.
      if (c.pagamento_informado_em) return res.json({ ok: true });
      await db.execute(sql`UPDATE assinatura_cobrancas SET pagamento_informado_em = NOW() WHERE id = ${c.id}`);
      await registrarEvento({ assinaturaId: a.id, cobrancaId: c.id, titularId: req.user.id,
        acao: "pagamento_informado_pelo_titular", porUserId: req.user.id });
      const [amb] = req.tenantId
        ? (await db.execute(sql`SELECT name FROM tenants WHERE id = ${req.tenantId}`)).rows as any[]
        : [];
      const comp = `${c.competencia.slice(5, 7)}/${c.competencia.slice(0, 4)}`;
      const valor = Number(c.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      await avisarDonos(`Pagamento informado: ${req.user.name}`,
        `${req.user.name} (${req.user.email}${amb?.name ? `, ambiente ${amb.name}` : ""}) informou que pagou a mensalidade ${comp} de ${valor}. Confira o recebimento e confirme o pagamento para liberar o acesso.`,
        `/admin/assinaturas?usuario=${req.user.id}`);
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[ASSINATURAS] informar pagamento:", e?.message);
      res.status(500).json({ message: "Erro ao registrar o aviso" });
    }
  });

  // ── Cancelamento pelo próprio assinante: nada é apagado. A assinatura fica
  // "cancelada", o usuário fica inativo e a sessão termina.
  app.post("/api/minha-assinatura/cancelar", requireAuth, async (req: any, res) => {
    try {
      if (req.user.isMaster) return res.status(400).json({ message: "Conta master não pode ser cancelada por aqui" });
      if (req.body?.confirmar !== true) return res.status(400).json({ message: "Confirmação obrigatória" });
      const [a] = (await db.execute(sql`
        SELECT id, status FROM assinaturas WHERE user_id = ${req.user.id} AND status <> 'cancelada'
      `)).rows as any[];
      if (!a) return res.status(404).json({ message: "Nenhuma assinatura ativa para cancelar" });
      await db.execute(sql`UPDATE assinaturas SET status = 'cancelada', updated_at = NOW() WHERE id = ${a.id}`);
      await db.execute(sql`UPDATE users SET is_active = false WHERE id = ${req.user.id}`);
      limparCacheBloqueio(req.user.id);
      await registrarEvento({ assinaturaId: a.id, titularId: req.user.id, acao: "cancelada_pelo_titular",
        antes: { status: a.status }, depois: { status: "cancelada", usuario: "inativado" }, porUserId: req.user.id });
      await avisarDonos(`Assinatura cancelada: ${req.user.name}`,
        `${req.user.name} (${req.user.email}) cancelou a própria assinatura. O usuário foi inativado; nada foi apagado.`,
        `/admin/assinaturas?usuario=${req.user.id}`);
      req.session.destroy(() => res.json({ ok: true }));
    } catch (e: any) {
      console.error("[ASSINATURAS] cancelar:", e?.message);
      res.status(500).json({ message: "Erro ao cancelar a assinatura" });
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
  limparCacheBloqueio(c.user_id);

  await registrarEvento({
    assinaturaId: c.assinatura_id, cobrancaId: c.id, titularId: c.user_id, acao: "pagamento_confirmado",
    depois: { pago_em: p.pagoEm, valor_pago: num(c.valor_pago), forma: p.forma, proximo_vencimento: a?.pv },
    porUserId: p.porUserId,
  });
  const [cc] = (await db.execute(sql`SELECT competencia FROM assinatura_cobrancas WHERE id = ${c.id}`)).rows as any[];
  const comp = cc?.competencia ? `${cc.competencia.slice(5, 7)}/${cc.competencia.slice(0, 4)}` : "";
  await createNotification({
    userId: c.user_id,
    title: "Pagamento confirmado",
    message: `Recebemos o pagamento da sua mensalidade ${comp}. Obrigado!`,
    type: "assinatura",
    actionUrl: "/assinatura",
  }).catch((e) => console.error("[ASSINATURAS] aviso de pagamento:", e?.message));
  return { ok: true, proximoVencimento: a?.pv || proximo };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROTINA DIÁRIA (etapa 3)
//
// Roda uma vez por dia, depois das 06:00 de Brasília. O relógio é um tick de
// hora em hora; quem garante "uma vez por dia" é o banco (rotina_execucoes,
// índice único por rotina+data), porque cada deploy zera o setInterval e duas
// instâncias rodariam em dobro.
//
// Enquanto a chave geral estiver desligada é SIMULAÇÃO: quem passou da tolerância
// vai para "suspensao_programada" e aparece no resumo do master, mas nada é
// bloqueado e o cliente não ouve falar em suspensão.
// ═══════════════════════════════════════════════════════════════════════════
const ROTINA = "assinaturas";
const HORA_MINIMA_BRT = 6;

/**
 * Situação que a assinatura deveria ter hoje, olhando a mensalidade em aberto
 * mais antiga. Cancelada, suspensa (decisão manual até a etapa 4) e isenta
 * dentro do prazo não são tocadas pela rotina.
 */
export function situacaoAutomatica(
  a: { status: string; isenta_ate?: string | null; tolerancia_dias?: number | null; suspensao_automatica?: boolean | null },
  vencimentoAberto: string | null,
  hoje = hojeISO(),
  ligada = false,
): string {
  if (a.status === "cancelada" || a.status === "suspensa") return a.status;
  if (a.status === "isenta" && (!a.isenta_ate || a.isenta_ate >= hoje)) return "isenta";
  if (!vencimentoAberto) return "ativa";
  const dv = diasEntre(hoje, vencimentoAberto);
  if (dv >= 0) return "aguardando_pagamento";
  const tol = Number(a.tolerancia_dias ?? TOLERANCIA_PADRAO_DIAS);
  if (-dv <= tol || a.suspensao_automatica === false) return "em_atraso";
  return ligada ? "suspensa" : "suspensao_programada";
}

/** Etapa do aviso ao cliente para esta mensalidade hoje (no máximo um de cada). */
export function etapaAviso(vencimento: string, hoje = hojeISO()): "antes" | "hoje" | "atraso" | null {
  const dv = diasEntre(hoje, vencimento);
  if (dv > ANTECEDENCIA_COBRANCA_DIAS) return null;
  if (dv > 0) return "antes";
  if (dv === 0) return "hoje";
  return "atraso";
}

const TITULO_AVISO = {
  antes: "Mensalidade disponível",
  hoje: "Mensalidade vence hoje",
  atraso: "Mensalidade em atraso",
} as const;

export async function rotinaDiariaAssinaturas(hoje = hojeISO()) {
  suspensaoCache = null;
  const ligada = await suspensaoAtiva();
  const res = {
    simulacao: !ligada,
    geradas: [] as string[],
    vencidas: 0,
    mudancas: [] as string[],
    avisos: 0,
    semBoleto: [] as string[],
    seriamSuspensos: [] as string[],
  };
  const limite = addDias(hoje, ANTECEDENCIA_COBRANCA_DIAS);

  // 1) Cortesia vencida volta a ser cobrada, a partir do primeiro vencimento depois dela.
  const isentas = (await db.execute(sql`
    SELECT ${COLS_ASSINATURA}, u.name AS nome FROM assinaturas a JOIN users u ON u.id = a.user_id
     WHERE a.status = 'isenta' AND a.isenta_ate IS NOT NULL AND a.isenta_ate < ${hoje}::date
  `)).rows as any[];
  for (const a of isentas) {
    const pv = proximaComDia(Number(a.dia_vencimento), addDias(a.isenta_ate, 1));
    const r = await db.execute(sql`
      UPDATE assinaturas SET status = 'ativa',
             proximo_vencimento = GREATEST(COALESCE(proximo_vencimento, ${pv}::date), ${pv}::date),
             updated_at = NOW()
       WHERE id = ${a.id} AND status = 'isenta'
    `);
    if (!(r as any).rowCount) continue;
    await registrarEvento({ assinaturaId: a.id, titularId: a.user_id, acao: "situacao_automatica",
      antes: { status: "isenta", isenta_ate: a.isenta_ate }, depois: { status: "ativa", motivo: "fim da cortesia" },
      porUserId: null });
    res.mudancas.push(`${a.nome}: cortesia terminou`);
  }

  // 2) Gera a mensalidade de quem vence nos próximos N dias (ou já venceu sem mensalidade).
  const aGerar = (await db.execute(sql`
    SELECT ${COLS_ASSINATURA}, u.name AS nome FROM assinaturas a JOIN users u ON u.id = a.user_id
     WHERE a.status NOT IN ('cancelada', 'isenta') AND a.proximo_vencimento IS NOT NULL
       AND a.proximo_vencimento <= ${limite}::date AND u.is_active = true
  `)).rows as any[];
  for (const a of aGerar) {
    const r = await gerarCobranca(a, a.proximo_vencimento, { porUserId: null });
    if (r) res.geradas.push(`${a.nome} (${r.competencia.slice(5, 7)}/${r.competencia.slice(0, 4)})`);
  }

  // 3) Mensalidade aberta que passou do vencimento vira vencida.
  const venc = await db.execute(sql`
    UPDATE assinatura_cobrancas SET status = 'vencida', updated_at = NOW()
     WHERE status = 'aberta' AND vencimento < ${hoje}::date RETURNING id
  `);
  res.vencidas = venc.rows.length;

  // 4) Situação de cada assinatura + avisos ao cliente.
  const todas = (await db.execute(sql`
    SELECT ${COLS_ASSINATURA}, u.name AS nome,
           cur.id AS cob_id, cur.vencimento::text AS cob_vencimento,
           (cur.boleto_arquivo IS NOT NULL OR cur.boleto_link IS NOT NULL
             OR cur.linha_digitavel IS NOT NULL OR cur.pix_copia_cola IS NOT NULL) AS cob_tem_boleto
      FROM assinaturas a JOIN users u ON u.id = a.user_id
      LEFT JOIN LATERAL (
        SELECT * FROM assinatura_cobrancas c
         WHERE c.assinatura_id = a.id AND c.status IN ('aberta', 'vencida')
         ORDER BY c.vencimento ASC LIMIT 1
      ) cur ON true
     WHERE a.status <> 'cancelada'
  `)).rows as any[];

  for (const a of todas) {
    const novo = situacaoAutomatica(a, a.cob_vencimento, hoje, ligada);
    if (novo !== a.status) {
      const r = await db.execute(sql`
        UPDATE assinaturas SET status = ${novo}, updated_at = NOW() WHERE id = ${a.id} AND status = ${a.status}
      `);
      if ((r as any).rowCount) {
        await registrarEvento({ assinaturaId: a.id, titularId: a.user_id, acao: "situacao_automatica",
          antes: { status: a.status }, depois: { status: novo, vencimento: a.cob_vencimento }, porUserId: null });
        res.mudancas.push(`${a.nome}: ${a.status} → ${novo}`);
      }
    }
    if (novo === "suspensao_programada" || novo === "suspensa") res.seriamSuspensos.push(a.nome);
    if (!a.cob_id) continue;

    // Sem boleto, o aviso espera: cobrar quem não tem como pagar só ensina a
    // ignorar o aviso. O master vê a lista no resumo.
    if (!a.cob_tem_boleto) {
      res.semBoleto.push(a.nome);
      continue;
    }
    const etapa = etapaAviso(a.cob_vencimento, hoje);
    if (!etapa) continue;
    // Marca antes de enviar: se duas execuções correrem juntas, só uma ganha.
    const marcado = await db.execute(sql`
      INSERT INTO assinatura_avisos_enviados (assinatura_id, cobranca_id, tipo)
      VALUES (${a.id}, ${a.cob_id}, ${etapa}) ON CONFLICT (cobranca_id, tipo) DO NOTHING RETURNING id
    `);
    if (!marcado.rows.length) continue;
    const alerta = alertaAssinatura({ ...a, status: novo },
      { vencimento: a.cob_vencimento, tem_boleto_arquivo: true }, hoje, ligada);
    if (!alerta) continue;
    await createNotification({ userId: a.user_id, title: TITULO_AVISO[etapa], message: alerta.texto,
      type: "assinatura", actionUrl: "/assinatura" });
    res.avisos++;
  }

  limparCacheBloqueio();

  // 5) Resumo para o dono do SaaS, só quando há algo a fazer ou saber.
  const linhas: string[] = [];
  if (res.geradas.length) linhas.push(`Mensalidades geradas: ${res.geradas.join(", ")}.`);
  if (res.semBoleto.length) linhas.push(`Sem boleto ou link (o cliente não foi avisado): ${res.semBoleto.join(", ")}.`);
  if (res.seriamSuspensos.length) {
    linhas.push(`${res.simulacao ? "Seriam suspensos (simulação, nada foi bloqueado)" : "Suspensos"}: ${res.seriamSuspensos.join(", ")}.`);
  }
  if (linhas.length) {
    const donos = (await db.execute(sql`SELECT id FROM users WHERE is_master = true AND is_active = true`)).rows as any[];
    for (const d of donos) {
      await createNotification({ userId: Number(d.id), title: "Assinaturas: resumo do dia",
        message: linhas.join(" "), type: "assinatura", actionUrl: "/admin/assinaturas" });
    }
  }
  return res;
}

/**
 * Executa e registra. "agendada" só passa uma vez por dia (índice único);
 * "manual" sempre roda. Se a agendada falhar, a reserva do dia é apagada para
 * a próxima hora tentar de novo (os avisos já enviados não se repetem).
 */
async function executarRotina(origem: "agendada" | "manual") {
  const hoje = hojeISO();
  const [reserva] = (await db.execute(
    origem === "agendada"
      ? sql`INSERT INTO rotina_execucoes (rotina, data, origem) VALUES (${ROTINA}, ${hoje}, 'agendada')
            ON CONFLICT (rotina, data) WHERE origem = 'agendada' DO NOTHING RETURNING id`
      : sql`INSERT INTO rotina_execucoes (rotina, data, origem) VALUES (${ROTINA}, ${hoje}, 'manual') RETURNING id`,
  )).rows as any[];
  if (!reserva) return null; // já rodou hoje
  try {
    const resultado = await rotinaDiariaAssinaturas(hoje);
    await db.execute(sql`
      UPDATE rotina_execucoes SET terminada_em = NOW(), resultado = ${JSON.stringify(resultado)}::jsonb
       WHERE id = ${reserva.id}
    `);
    console.log(`[ASSINATURAS] rotina ${origem}: ${resultado.geradas.length} geradas, ${resultado.mudancas.length} mudanças, ${resultado.avisos} avisos`);
    return resultado;
  } catch (e: any) {
    if (origem === "agendada") {
      await db.execute(sql`DELETE FROM rotina_execucoes WHERE id = ${reserva.id}`);
    } else {
      await db.execute(sql`
        UPDATE rotina_execucoes SET terminada_em = NOW(), erro = ${String(e?.message || e)} WHERE id = ${reserva.id}
      `);
    }
    throw e;
  }
}

export function startRotinaAssinaturas() {
  const tick = async () => {
    const horaBRT = new Date(Date.now() - 3 * 3600_000).getUTCHours();
    if (horaBRT < HORA_MINIMA_BRT) return;
    try {
      await executarRotina("agendada");
    } catch (e: any) {
      console.error("[ASSINATURAS] rotina agendada falhou (tenta de novo na próxima hora):", e?.message);
    }
  };
  setTimeout(tick, 2 * 60_000); // dá tempo das migrações do boot
  setInterval(tick, 60 * 60_000);
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUEIO NO SERVIDOR (etapa 4)
//
// Chamado pelo requireAuth em toda rota autenticada. Quem está com a
// assinatura "suspensa" só alcança o necessário para regularizar: entrar e
// sair, Minha assinatura, os próprios boletos, notificações e a aparência do
// ambiente. Master nunca é bloqueado; quem não tem assinatura também não.
// ═══════════════════════════════════════════════════════════════════════════
const cacheBloqueio = new Map<number, { suspenso: boolean; ate: number }>();

export function limparCacheBloqueio(userId?: number) {
  if (userId === undefined) cacheBloqueio.clear();
  else cacheBloqueio.delete(userId);
}

export async function usuarioSuspenso(userId: number): Promise<boolean> {
  const c = cacheBloqueio.get(userId);
  if (c && c.ate > Date.now()) return c.suspenso;
  const [r] = (await db.execute(sql`SELECT status FROM assinaturas WHERE user_id = ${userId}`)).rows as any[];
  const suspenso = r?.status === "suspensa";
  cacheBloqueio.set(userId, { suspenso, ate: Date.now() + 60_000 });
  return suspenso;
}

const LIVRE_SEMPRE = ["/api/auth/", "/api/minha-assinatura", "/api/cobrancas/", "/api/notifications"];
const LIVRE_SO_LEITURA = ["/api/tenant", "/api/branding", "/api/preferencias"];

export function rotaLiberadaParaSuspenso(metodo: string, url: string): boolean {
  const caminho = url.split("?")[0];
  if (LIVRE_SEMPRE.some((p) => caminho.startsWith(p))) return true;
  return metodo === "GET" && LIVRE_SO_LEITURA.some((p) => caminho.startsWith(p));
}

export const MENSAGEM_SUSPENSO =
  "Seu acesso está suspenso por mensalidade em aberto. Acesse Minha assinatura para consultar o boleto e regularizar.";
