// ═══════════════════════════════════════════════════════════════════════════
// PORTABILIDADE MULTIBANCO — cadastro de bancos, regras versionadas, exceções
// e análises auditáveis. Módulo NOVO e separado: não lê nem escreve nas tabelas
// do simulador antigo (portability_bank_rules). Substitui o antigo só depois de
// testado, por decisão do Fábio.
//
// Garantias de histórico:
//   • port_rule_sets é só-inserção: regra nova fecha a vigência da anterior,
//     nunca a edita.
//   • port_rule_exceptions nunca é editada: desativar grava quem e quando.
//   • port_analyses guarda o CONTEÚDO das regras e exceções usadas, não só o id —
//     a análise se sustenta mesmo que o cadastro mude depois.
// ═══════════════════════════════════════════════════════════════════════════
import type { Express } from "express";
import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./storage";
import {
  analisar, respostaSimulacao, semComissao, normalizarOrigem, nomeOrigem, acharUpag,
  type BancoParaAnalise, type ClienteEntrada, type ContratoEntrada, type Excecao, type RegrasBanco,
} from "../shared/portability/engine";
import { MODELOS } from "../shared/portability/modelos";
import { normalizarOperacao } from "../shared/portability/refin";

/** JSON com chaves ordenadas: o mesmo conteúdo sempre dá o mesmo hash. */
function jsonEstavel(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(jsonEstavel).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v as object).sort()
      .map(k => JSON.stringify(k) + ":" + jsonEstavel((v as any)[k])).join(",") + "}";
  }
  return JSON.stringify(v ?? null);
}
const hashRegras = (r: unknown) => createHash("sha256").update(jsonEstavel(r)).digest("hex");

const isMaster = (req: any) => Boolean(req.user?.isMaster || req.user?.role === "master");
const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export function registerPortMultibancoRoutes(app: Express, requireAuth: any) {
  const tenantDe = (req: any, res: any): number | null => {
    const t = req.tenantId;
    if (!t) { res.status(400).json({ message: "Tenant não identificado" }); return null; }
    return t;
  };
  const exigeMaster = (req: any, res: any) => {
    if (isMaster(req)) return true;
    res.status(403).json({ message: "Só o master acessa o cadastro de bancos e regras" });
    return false;
  };

  /** Bancos ativos + regra vigente do convênio + exceções ativas: o que o motor consome. */
  async function carregarParaAnalise(tenantId: number, convenio: string, soAtivos = true) {
    const bancos = (await db.execute(sql`
      SELECT id, nome, codigo, ativo, ordem, inativo_motivo, inativo_em FROM port_banks
      WHERE tenant_id = ${tenantId} ${soAtivos ? sql`AND ativo = TRUE` : sql``}
      ORDER BY ordem, nome
    `)).rows as any[];
    if (!bancos.length) return { bancos, paraMotor: [] as BancoParaAnalise[] };

    const ids = bancos.map(b => b.id);
    const regras = (await db.execute(sql`
      SELECT id, bank_id, regras, hash, fonte_descricao, vigencia_inicio
      FROM port_rule_sets
      WHERE tenant_id = ${tenantId} AND convenio = ${convenio} AND vigencia_fim IS NULL
        AND bank_id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})
    `)).rows as any[];
    const excecoes = (await db.execute(sql`
      SELECT id, bank_id, tipo, parametros, motivo, criado_em
      FROM port_rule_exceptions
      WHERE tenant_id = ${tenantId} AND convenio = ${convenio} AND ativo = TRUE
        AND bank_id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})
      ORDER BY id
    `)).rows as any[];

    const paraMotor: BancoParaAnalise[] = bancos.map(b => {
      const rs = regras.find(r => r.bank_id === b.id);
      return {
        bankId: b.id, nome: b.nome,
        ruleSet: rs ? { id: rs.id, hash: rs.hash, vigenciaInicio: new Date(rs.vigencia_inicio).toISOString(), regras: rs.regras as RegrasBanco } : null,
        excecoes: excecoes.filter(e => e.bank_id === b.id)
          .map(e => ({ id: e.id, tipo: e.tipo, parametros: e.parametros, motivo: e.motivo }) as Excecao),
      };
    });
    return { bancos, regras, excecoes, paraMotor };
  }

  // ── Leitura do cadastro (só master: as regras trazem a comissão da empresa) ──

  app.get("/api/port/bancos", requireAuth, async (req: any, res) => {
    try {
      if (!exigeMaster(req, res)) return;
      const tenantId = tenantDe(req, res); if (!tenantId) return;
      const convenio = String(req.query.convenio || "SIAPE");
      const { bancos, regras = [], excecoes = [] } = await carregarParaAnalise(tenantId, convenio, false);
      res.json(bancos.map(b => {
        const rs = (regras as any[]).find(r => r.bank_id === b.id);
        return {
          ...b,
          regraVigente: rs ? { id: rs.id, hash: rs.hash, fonteDescricao: rs.fonte_descricao, vigenciaInicio: rs.vigencia_inicio, regras: rs.regras } : null,
          excecoes: (excecoes as any[]).filter(e => e.bank_id === b.id),
        };
      }));
    } catch (err: any) {
      console.error("[PORT] GET bancos:", err);
      res.status(500).json({ message: "Erro ao carregar bancos" });
    }
  });

  app.get("/api/port/modelos", requireAuth, (_req, res) => {
    res.json(MODELOS.map(m => ({ id: m.id, banco: m.banco, convenio: m.convenio, fonteDescricao: m.fonteDescricao,
      excecoesSugeridas: m.excecoesSugeridas?.length || 0 })));
  });

  app.get("/api/port/bancos/:id/regras", requireAuth, async (req: any, res) => {
    try {
      if (!exigeMaster(req, res)) return;
      const tenantId = tenantDe(req, res); if (!tenantId) return;
      const r = await db.execute(sql`
        SELECT rs.id, rs.convenio, rs.hash, rs.fonte_descricao, rs.vigencia_inicio, rs.vigencia_fim,
               rs.criado_em, rs.regras, u.name AS criado_por_nome
        FROM port_rule_sets rs LEFT JOIN users u ON u.id = rs.criado_por
        WHERE rs.tenant_id = ${tenantId} AND rs.bank_id = ${Number(req.params.id)}
        ORDER BY rs.vigencia_inicio DESC, rs.id DESC
      `);
      res.json(r.rows);
    } catch (err: any) {
      console.error("[PORT] GET historico:", err);
      res.status(500).json({ message: "Erro ao carregar histórico" });
    }
  });

  /** Situação funcional, nascimento e nome pelo CPF. A base de clientes é global por desenho. */
  /** "1980-03-05", "05/03/1980" ou timestamp → yyyy-mm-dd; nada disso → null. */
  function dataISO(v: unknown): string | null {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
    const t = String(v).trim();
    const br = t.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  app.get("/api/port/cliente/:cpf", requireAuth, async (req: any, res) => {
    try {
      const cpf = soDigitos(req.params.cpf).padStart(11, "0");
      if (cpf.length !== 11) return res.status(400).json({ message: "CPF inválido" });
      const r = await db.execute(sql`
        SELECT p.nome, p.data_nascimento, p.upag AS upag_pessoa, p.upag_nome_pessoa,
               v.sit_func, v.convenio, v.orgao, v.upag AS upag_vinculo
        FROM clientes_pessoa p
        LEFT JOIN clientes_vinculo v ON v.pessoa_id = p.id AND v.ativo = TRUE
        WHERE p.cpf = ${cpf}
        ORDER BY v.ultima_atualizacao DESC NULLS LAST
        LIMIT 10
      `);
      const rows = r.rows as any[];
      let nascimento = rows.length ? dataISO(rows[0].data_nascimento) : null;
      let origemNascimento: string | null = nascimento ? "cadastro do CRM" : null;

      // o cadastro nem sempre tem a data: procura em quem mais guarda isso
      if (!nascimento) {
        const outras = await db.execute(sql`
          SELECT data_nascimento, 'importação de contatos' AS origem, 2 AS ordem
            FROM staging_contatos WHERE regexp_replace(coalesce(cpf,''), '\\D', '', 'g') = ${cpf}
              AND data_nascimento IS NOT NULL AND data_nascimento <> ''
          UNION ALL
          SELECT data_nascimento, 'solicitação de boleto' AS origem, 3 AS ordem
            FROM solicitacoes_boleto
            WHERE tenant_id = ${req.tenantId ?? null} AND regexp_replace(cpf_cliente, '\\D', '', 'g') = ${cpf}
              AND data_nascimento IS NOT NULL AND data_nascimento <> ''
          ORDER BY ordem
          LIMIT 5
        `);
        for (const o of outras.rows as any[]) {
          const d = dataISO(o.data_nascimento);
          if (d) { nascimento = d; origemNascimento = String(o.origem); break; }
        }
      }

      if (!rows.length && !nascimento) return res.json(null);
      // UPAG: o vínculo é mais específico que o cadastro da pessoa
      const linhaUpag = rows.find(x => x.upag_vinculo || x.upag_pessoa);
      const upag = linhaUpag ? (linhaUpag.upag_vinculo || linhaUpag.upag_pessoa) : null;
      res.json({
        nome: rows.length ? rows[0].nome : null,
        dataNascimento: nascimento,
        origemNascimento,
        upag: upag ? String(upag) : null,
        upagNome: rows.length ? rows[0].upag_nome_pessoa || null : null,
        vinculos: rows.filter(x => x.sit_func || x.orgao).map(x => ({ sitFunc: x.sit_func, convenio: x.convenio, orgao: x.orgao })),
      });
    } catch (err: any) {
      console.error("[PORT] GET cliente:", err);
      res.status(500).json({ message: "Erro ao buscar o cliente" });
    }
  });

  // A Viabilidade Inter é uma página à parte e não roda o motor: sem isto ela
  // fechava operação que o portal do próprio Inter recusa por UPAG.
  app.get("/api/port/upag-inter", requireAuth, async (req: any, res) => {
    try {
      const modelo = MODELOS.find(m => m.id === "inter-siape-2026-09");
      const upags = modelo?.regras.upagsNaoAtendidas || [];
      const ativos = modelo?.regras.codigosAtivos || [];

      let upag = String(req.query.upag || "").trim();
      let upagNome: string | null = null;
      let situacao: string | null = null;
      let origem: string | null = upag ? "informada na tela" : null;

      const cpf = soDigitos(String(req.query.cpf || ""));
      if (!upag && cpf.length === 11) {
        const r = await db.execute(sql`
          SELECT p.upag AS upag_pessoa, p.upag_nome_pessoa, v.upag AS upag_vinculo, v.sit_func
          FROM clientes_pessoa p
          LEFT JOIN clientes_vinculo v ON v.pessoa_id = p.id AND v.ativo = TRUE
          WHERE p.cpf = ${cpf}
          ORDER BY v.ultima_atualizacao DESC NULLS LAST
          LIMIT 10
        `);
        const rows = r.rows as any[];
        const linha = rows.find(x => x.upag_vinculo || x.upag_pessoa);
        if (linha) {
          upag = String(linha.upag_vinculo || linha.upag_pessoa);
          origem = "cadastro do CRM";
        }
        if (rows.length) {
          upagNome = rows[0].upag_nome_pessoa || null;
          situacao = rows.find(x => x.sit_func)?.sit_func || null;
        }
      }

      if (!upag) {
        return res.json({ upag: null, upagNome, situacao, origem, atendida: null,
          motivo: "UPAG não encontrada no CRM: informe a unidade pagadora." });
      }

      const achada = acharUpag(upags, upag);
      if (!achada) {
        return res.json({ upag, upagNome, situacao, origem, atendida: true,
          motivo: "UPAG atendida pelo Inter." });
      }
      // DNOCS: só é barrada para servidor ativo
      if (achada.apenasAtivos) {
        const codigo = String(situacao || "").trim();
        if (!codigo) {
          return res.json({ upag, upagNome, situacao, origem, atendida: null,
            motivo: `${achada.descricao} só não é atendida para servidor ativo: confirme a situação funcional.` });
        }
        const ehAtivo = ativos.some(c => c.trim() === codigo);
        return res.json({ upag, upagNome, situacao, origem, atendida: !ehAtivo,
          motivo: ehAtivo
            ? `${achada.descricao}: o Inter não atende servidor ativo desta UPAG.`
            : `${achada.descricao} só é barrada para servidor ativo; este cliente não é.` });
      }
      res.json({ upag, upagNome, situacao, origem, atendida: false,
        motivo: `UPAG ${upag} não é atendida pelo Inter para portabilidade${achada.descricao ? " — " + achada.descricao : ""}.` });
    } catch (err: any) {
      console.error("[PORT] GET upag-inter:", err);
      res.status(500).json({ message: "Erro ao conferir a UPAG" });
    }
  });

  // ── Cadastro (master) ─────────────────────────────────────────────────────

  app.post("/api/port/bancos", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const nome = String(req.body?.nome || "").trim();
      if (!nome) return res.status(400).json({ message: "Informe o nome do banco" });
      const r = await db.execute(sql`
        INSERT INTO port_banks (tenant_id, nome, codigo, ativo, ordem)
        VALUES (${tenantId}, ${nome}, ${req.body?.codigo || null}, TRUE, ${Number(req.body?.ordem) || 0})
        RETURNING *
      `);
      res.json(r.rows[0]);
    } catch (err: any) {
      if (String(err?.message).includes("port_banks_tenant_nome")) return res.status(409).json({ message: "Banco já cadastrado" });
      console.error("[PORT] POST banco:", err);
      res.status(500).json({ message: "Erro ao criar banco" });
    }
  });

  app.patch("/api/port/bancos/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const b = req.body || {};
      // desligar guarda o porquê e a data; religar limpa os dois
      const mexeAtivo = typeof b.ativo === "boolean";
      const motivo = mexeAtivo && !b.ativo ? (String(b.motivo || "").trim() || null) : null;
      const r = await db.execute(sql`
        UPDATE port_banks SET
          inativo_motivo = CASE WHEN ${mexeAtivo} THEN ${motivo} ELSE inativo_motivo END,
          inativo_em = CASE WHEN ${mexeAtivo} THEN (CASE WHEN ${!!b.ativo} THEN NULL ELSE NOW() END) ELSE inativo_em END,
          ativo = COALESCE(${mexeAtivo ? b.ativo : null}, ativo),
          ordem = COALESCE(${Number.isFinite(b.ordem) ? b.ordem : null}, ordem),
          codigo = COALESCE(${b.codigo ?? null}, codigo)
        WHERE id = ${Number(req.params.id)} AND tenant_id = ${tenantId}
        RETURNING *
      `);
      if (!r.rows.length) return res.status(404).json({ message: "Banco não encontrado" });
      res.json(r.rows[0]);
    } catch (err: any) {
      console.error("[PORT] PATCH banco:", err);
      res.status(500).json({ message: "Erro ao atualizar banco" });
    }
  });

  /** Nova versão das regras do infográfico. Fecha a vigente; nunca edita. */
  async function gravarRegras(tenantId: number, bankId: number, convenio: string, regras: RegrasBanco,
                              fonteDescricao: string | null, modeloId: string | null, userId: number | null) {
    const hash = hashRegras(regras);
    const atual = (await db.execute(sql`
      SELECT id, hash FROM port_rule_sets
      WHERE tenant_id = ${tenantId} AND bank_id = ${bankId} AND convenio = ${convenio} AND vigencia_fim IS NULL
    `)).rows as any[];
    if (atual.length === 1 && atual[0].hash === hash) return { id: atual[0].id, novo: false };

    await db.execute(sql`
      UPDATE port_rule_sets SET vigencia_fim = NOW()
      WHERE tenant_id = ${tenantId} AND bank_id = ${bankId} AND convenio = ${convenio} AND vigencia_fim IS NULL
    `);
    const r = await db.execute(sql`
      INSERT INTO port_rule_sets (tenant_id, bank_id, convenio, regras, hash, fonte_descricao, modelo_id, vigencia_inicio, criado_por)
      VALUES (${tenantId}, ${bankId}, ${convenio}, ${JSON.stringify(regras)}::jsonb, ${hash},
              ${fonteDescricao}, ${modeloId}, NOW(), ${userId})
      RETURNING id
    `);
    return { id: (r.rows[0] as any).id, novo: true };
  }

  app.post("/api/port/bancos/:id/regras", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const { convenio, regras, fonteDescricao } = req.body || {};
      if (!convenio || !regras || typeof regras !== "object") return res.status(400).json({ message: "Informe convênio e regras" });
      const soltos = (regras.origens?.lista || []).map((o: any) => o.origem).filter((n: string) => !normalizarOrigem(n));
      if (soltos.length) return res.status(400).json({ message: `Banco de origem não reconhecido: ${soltos.join(", ")}` });
      const r = await gravarRegras(tenantId, Number(req.params.id), String(convenio), regras, fonteDescricao || null, null, req.user?.id ?? null);
      res.json(r);
    } catch (err: any) {
      console.error("[PORT] POST regras:", err);
      res.status(500).json({ message: "Erro ao gravar regras" });
    }
  });

  app.post("/api/port/bancos/:id/excecoes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const { convenio, parametros, motivo } = req.body || {};
      if (!convenio || !parametros?.origem) return res.status(400).json({ message: "Informe convênio e banco de origem" });
      // o nome tem que resolver para um banco conhecido — foi assim que a "BRB Financeira"
      // quase virou exceção do BRB Banco nos testes
      const chave = normalizarOrigem(parametros.origem);
      if (!chave) return res.status(400).json({ message: `Banco de origem não reconhecido: ${parametros.origem}` });
      if (!motivo || String(motivo).trim().length < 5) return res.status(400).json({ message: "Explique o motivo da exceção" });
      const p = { origem: nomeOrigem(chave), porta: Boolean(parametros.porta), pagasMin: parametros.porta ? (Number(parametros.pagasMin) || 0) : null };
      const r = await db.execute(sql`
        INSERT INTO port_rule_exceptions (tenant_id, bank_id, convenio, tipo, parametros, motivo, ativo, criado_por)
        VALUES (${tenantId}, ${Number(req.params.id)}, ${String(convenio)}, 'origem_pagas',
                ${JSON.stringify(p)}::jsonb, ${String(motivo).trim()}, TRUE, ${req.user?.id ?? null})
        RETURNING *
      `);
      res.json(r.rows[0]);
    } catch (err: any) {
      console.error("[PORT] POST excecao:", err);
      res.status(500).json({ message: "Erro ao criar exceção" });
    }
  });

  app.delete("/api/port/excecoes/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const r = await db.execute(sql`
        UPDATE port_rule_exceptions SET ativo = FALSE, desativado_em = NOW(), desativado_por = ${req.user?.id ?? null}
        WHERE id = ${Number(req.params.id)} AND tenant_id = ${tenantId} AND ativo = TRUE
        RETURNING id
      `);
      if (!r.rows.length) return res.status(404).json({ message: "Exceção não encontrada ou já desativada" });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[PORT] DELETE excecao:", err);
      res.status(500).json({ message: "Erro ao desativar exceção" });
    }
  });

  /** Um clique: cria o banco se faltar, grava a regra do modelo e as exceções sugeridas. */
  app.post("/api/port/importar-modelo", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const modelo = MODELOS.find(m => m.id === req.body?.modeloId);
      if (!modelo) return res.status(404).json({ message: "Modelo não encontrado" });
      const userId = req.user?.id ?? null;

      let banco = (await db.execute(sql`
        SELECT id FROM port_banks WHERE tenant_id = ${tenantId} AND lower(nome) = lower(${modelo.banco})
      `)).rows[0] as any;
      if (!banco) {
        banco = (await db.execute(sql`
          INSERT INTO port_banks (tenant_id, nome, ativo, ordem) VALUES (${tenantId}, ${modelo.banco}, TRUE, 0) RETURNING id
        `)).rows[0];
      }
      const regra = await gravarRegras(tenantId, banco.id, modelo.convenio, modelo.regras, modelo.fonteDescricao, modelo.id, userId);

      // exceções: só cria as que ainda não existem ativas para a mesma origem
      const ativas = (await db.execute(sql`
        SELECT parametros FROM port_rule_exceptions
        WHERE tenant_id = ${tenantId} AND bank_id = ${banco.id} AND convenio = ${modelo.convenio} AND ativo = TRUE
      `)).rows as any[];
      const jaTem = new Set(ativas.map(a => normalizarOrigem(a.parametros?.origem)));
      let criadas = 0;
      for (const e of modelo.excecoesSugeridas || []) {
        const chave = normalizarOrigem(e.parametros.origem);
        if (!chave || jaTem.has(chave)) continue;
        await db.execute(sql`
          INSERT INTO port_rule_exceptions (tenant_id, bank_id, convenio, tipo, parametros, motivo, ativo, criado_por)
          VALUES (${tenantId}, ${banco.id}, ${modelo.convenio}, 'origem_pagas',
                  ${JSON.stringify({ ...e.parametros, origem: nomeOrigem(chave) })}::jsonb, ${e.motivo}, TRUE, ${userId})
        `);
        criadas++;
      }
      res.json({ bankId: banco.id, ruleSetId: regra.id, regraNova: regra.novo, excecoesCriadas: criadas });
    } catch (err: any) {
      console.error("[PORT] importar-modelo:", err);
      res.status(500).json({ message: "Erro ao importar o modelo" });
    }
  });

  // ── Análise (qualquer usuário) ────────────────────────────────────────────

  /** Análise ao vivo do simulador: roda o motor e NÃO grava nada. A cotação não
   *  precisa estar salva. Chamada a cada mudança do snapshot (com debounce). */
  app.post("/api/port/simular", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId) return;
      const cliente = req.body?.cliente as ClienteEntrada;
      const contratos = (req.body?.contratos || []) as ContratoEntrada[];
      if (!cliente?.convenio) return res.status(400).json({ message: "Informe o convênio do cliente" });

      const { paraMotor } = await carregarParaAnalise(tenantId, cliente.convenio);
      const desligados = (await db.execute(sql`
        SELECT nome, inativo_motivo, inativo_em FROM port_banks
        WHERE tenant_id = ${tenantId} AND ativo = FALSE ORDER BY nome
      `)).rows as any[];
      const resp = {
        ...respostaSimulacao(paraMotor, cliente, contratos, new Date(), normalizarOperacao(req.body?.operacao)),
        bancosDesligados: desligados.map(d => ({ banco: d.nome, motivo: d.inativo_motivo, desde: d.inativo_em })),
      };
      // corretor NUNCA vê a comissão da empresa: sai daqui, não só da tela
      res.json(isMaster(req) ? { ...resp, comissaoVisivel: true }
        : { ...resp, resultado: semComissao(resp.resultado), comissaoVisivel: false });
    } catch (err: any) {
      console.error("[PORT] POST simular:", err);
      res.status(500).json({ message: "Erro ao analisar" });
    }
  });

  /** Roda o motor com as regras vigentes AGORA e registra tudo que foi usado. */
  app.post("/api/port/analises", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId) return;
      const cliente = req.body?.cliente as ClienteEntrada;
      const contratos = (req.body?.contratos || []) as ContratoEntrada[];
      if (!cliente?.convenio) return res.status(400).json({ message: "Informe o convênio do cliente" });

      const { paraMotor } = await carregarParaAnalise(tenantId, cliente.convenio);
      const resultado = analisar(paraMotor, cliente, contratos, new Date(), normalizarOperacao(req.body?.operacao));
      const regrasUsadas = paraMotor.map(b => ({
        bankId: b.bankId, banco: b.nome,
        ruleSetId: b.ruleSet?.id ?? null, hash: b.ruleSet?.hash ?? null, regras: b.ruleSet?.regras ?? null,
        excecoes: b.excecoes,
      }));

      const cpf = soDigitos(req.body?.cpf) || null;
      const r = await db.execute(sql`
        INSERT INTO port_analyses (tenant_id, cpf, cotacao_id, engine_version, entrada, regras_usadas, resultado, criado_por)
        VALUES (${tenantId}, ${cpf}, ${Number(req.body?.cotacaoId) || null}, ${resultado.engineVersion},
                ${JSON.stringify({ cliente, contratos })}::jsonb, ${JSON.stringify(regrasUsadas)}::jsonb,
                ${JSON.stringify(resultado)}::jsonb, ${req.user?.id ?? null})
        RETURNING id, criado_em
      `);
      res.json({ id: (r.rows[0] as any).id, criadoEm: (r.rows[0] as any).criado_em,
        resultado: isMaster(req) ? resultado : semComissao(resultado) });
    } catch (err: any) {
      console.error("[PORT] POST analise:", err);
      res.status(500).json({ message: "Erro ao registrar a análise" });
    }
  });

  app.get("/api/port/analises", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId) return;
      const cpf = soDigitos(req.query.cpf);
      if (!cpf) return res.json([]);
      const r = await db.execute(sql`
        SELECT a.id, a.criado_em, a.engine_version, u.name AS criado_por_nome,
               (SELECT json_agg(json_build_object('banco', b->>'banco', 'status', b->>'status', 'resumo', b->>'resumo'))
                  FROM jsonb_array_elements(a.resultado->'bancos') b) AS bancos
        FROM port_analyses a LEFT JOIN users u ON u.id = a.criado_por
        WHERE a.tenant_id = ${tenantId} AND a.cpf = ${cpf}
        ORDER BY a.criado_em DESC LIMIT 30
      `);
      res.json(r.rows);
    } catch (err: any) {
      console.error("[PORT] GET analises:", err);
      res.status(500).json({ message: "Erro ao listar análises" });
    }
  });

  app.get("/api/port/analises/:id", requireAuth, async (req: any, res) => {
    try {
      if (!exigeMaster(req, res)) return;   // o registro guarda regras e comissão
      const tenantId = tenantDe(req, res); if (!tenantId) return;
      const r = await db.execute(sql`
        SELECT * FROM port_analyses WHERE id = ${Number(req.params.id)} AND tenant_id = ${tenantId}
      `);
      if (!r.rows.length) return res.status(404).json({ message: "Análise não encontrada" });
      res.json(r.rows[0]);
    } catch (err: any) {
      console.error("[PORT] GET analise:", err);
      res.status(500).json({ message: "Erro ao carregar a análise" });
    }
  });
}
