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
import { registrarConsultaCliente } from "./consulta-cliente-log";
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
  /** Encaixa a comissão DO AMBIENTE nas regras do catálogo, e só ela. */
  function aplicarComissaoDoAmbiente(regras: RegrasBanco, cfg: any): RegrasBanco {
    const faixasCfg: any[] = Array.isArray(cfg?.comissao_faixas) ? cfg.comissao_faixas : [];
    const faixas = (regras as any).faixasRefin;
    return {
      ...regras,
      comissao: cfg?.comissao_ambiente ?? null,
      ...(Array.isArray(faixas) ? {
        faixasRefin: faixas.map((f: any) => {
          const achada = faixasCfg.find(x => Number(x?.minValor) === Number(f?.minValor));
          return { ...f, comissaoPercentual: achada ? (achada.percentual ?? null) : null };
        }),
      } : {}),
    } as RegrasBanco;
  }

  /** Onde este ambiente grava: NULL = catálogo global; número = só para ele. */
  async function destinoDaEscrita(tenantId: number) {
    return (await ehDonoDoCatalogo(tenantId)) ? null : tenantId;
  }

  /** Comissão nunca mora no catálogo: sai das regras e vai para a config do
   *  ambiente que gravou. Devolve as regras limpas. */
  async function guardarComissao(tenantId: number, bankId: number, convenio: string,
                                 regras: any, userId: number | null) {
    const comissao = regras?.comissao ?? null;
    const faixas = Array.isArray(regras?.faixasRefin)
      ? regras.faixasRefin
          .filter((f: any) => f?.comissaoPercentual != null)
          .map((f: any) => ({ minValor: f.minValor, percentual: f.comissaoPercentual }))
      : [];
    if (comissao != null || faixas.length) {
      await db.execute(sql`
        INSERT INTO port_bank_config (tenant_id, bank_id, convenio, comissao, comissao_faixas, atualizado_por, atualizado_em)
        VALUES (${tenantId}, ${bankId}, ${convenio}, ${comissao ? JSON.stringify(comissao) : null}::jsonb,
                ${faixas.length ? JSON.stringify(faixas) : null}::jsonb, ${userId}, NOW())
        ON CONFLICT (tenant_id, bank_id, convenio) DO UPDATE SET
          comissao = COALESCE(EXCLUDED.comissao, port_bank_config.comissao),
          comissao_faixas = COALESCE(EXCLUDED.comissao_faixas, port_bank_config.comissao_faixas),
          atualizado_por = EXCLUDED.atualizado_por, atualizado_em = NOW()
      `);
    }
    const limpas = { ...regras, comissao: null };
    if (Array.isArray(limpas.faixasRefin)) {
      limpas.faixasRefin = limpas.faixasRefin.map((f: any) => ({ ...f, comissaoPercentual: null }));
    }
    return limpas;
  }

  /** O ambiente que mantém o catálogo global (a Capital Go). Os demais leem. */
  async function ehDonoDoCatalogo(tenantId: number) {
    const r = await db.execute(sql`SELECT catalogo_portabilidade FROM tenants WHERE id = ${tenantId}`);
    return Boolean((r.rows[0] as any)?.catalogo_portabilidade);
  }

  /**
   * Banco, regra e exceção vêm do CATÁLOGO GLOBAL (tenant_id NULL) e valem para
   * todos os ambientes. De cada ambiente são:
   *   • a COMISSÃO — nunca herdada de ninguém; sem cadastro, fica em branco;
   *   • o liga/desliga;
   *   • uma regra PRÓPRIA, quando existir: ela vence a global (decisão do Fábio).
   */
  async function carregarParaAnalise(tenantId: number, convenio: string, soAtivos = true) {
    const todos = (await db.execute(sql`
      SELECT b.id, b.nome, b.codigo, b.ordem, (b.tenant_id IS NULL) AS global,
             COALESCE(c.ativo, b.ativo)                   AS ativo,
             COALESCE(c.inativo_motivo, b.inativo_motivo) AS inativo_motivo,
             COALESCE(c.inativo_em, b.inativo_em)         AS inativo_em,
             c.comissao                                   AS comissao_ambiente,
             c.comissao_faixas                            AS comissao_faixas
        FROM port_banks b
        LEFT JOIN port_bank_config c
          ON c.bank_id = b.id AND c.tenant_id = ${tenantId} AND c.convenio = ${convenio}
       WHERE b.tenant_id = ${tenantId} OR b.tenant_id IS NULL
       ORDER BY b.ordem, b.nome
    `)).rows as any[];

    // mesmo nome nos dois lugares: o do ambiente vence o global
    const porNome = new Map<string, any>();
    for (const b of todos) {
      const k = String(b.nome).trim().toLowerCase();
      const atual = porNome.get(k);
      if (!atual || (atual.global && !b.global)) porNome.set(k, b);
    }
    const bancos = Array.from(porNome.values()).filter(b => (soAtivos ? b.ativo : true));
    if (!bancos.length) return { bancos, paraMotor: [] as BancoParaAnalise[] };

    const ids = bancos.map(b => b.id);
    const dentro = sql.join(ids.map(i => sql`${i}`), sql`, `);
    const regras = (await db.execute(sql`
      SELECT id, bank_id, tenant_id, regras, hash, fonte_descricao, vigencia_inicio
      FROM port_rule_sets
      WHERE (tenant_id = ${tenantId} OR tenant_id IS NULL)
        AND convenio = ${convenio} AND vigencia_fim IS NULL AND bank_id IN (${dentro})
    `)).rows as any[];
    const excecoes = (await db.execute(sql`
      SELECT id, bank_id, tipo, parametros, motivo, criado_em
      FROM port_rule_exceptions
      WHERE (tenant_id = ${tenantId} OR tenant_id IS NULL)
        AND convenio = ${convenio} AND ativo = TRUE AND bank_id IN (${dentro})
      ORDER BY id
    `)).rows as any[];

    const paraMotor: BancoParaAnalise[] = bancos.map(b => {
      const rs = regras.find(r => r.bank_id === b.id);
      // A comissão vem SEMPRE da config do ambiente; a do catálogo nunca vaza.
      // Vale para o campo `comissao` E para o percentual de cada faixa (Safra).
      const comRegras = rs ? aplicarComissaoDoAmbiente(rs.regras as RegrasBanco, b) : null;
      return {
        bankId: b.id, nome: b.nome,
        ruleSet: rs ? { id: rs.id, hash: rs.hash, vigenciaInicio: new Date(rs.vigencia_inicio).toISOString(), regras: comRegras as RegrasBanco } : null,
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
      const dono = await ehDonoDoCatalogo(tenantId);
      res.json(bancos.map(b => {
        const rs = (regras as any[]).find(r => r.bank_id === b.id);
        return {
          ...b,
          donoDoCatalogo: dono,
          // a comissão NÃO sai da regra: é a do próprio ambiente
          comissao: b.comissao_ambiente ?? null,
          regraVigente: rs ? {
            id: rs.id, hash: rs.hash, fonteDescricao: rs.fonte_descricao, vigenciaInicio: rs.vigencia_inicio,
            global: rs.tenant_id == null,
            regras: { ...rs.regras, comissao: b.comissao_ambiente ?? null },
          } : null,
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
        WHERE (rs.tenant_id = ${tenantId} OR rs.tenant_id IS NULL) AND rs.bank_id = ${Number(req.params.id)}
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

      registrarConsultaCliente(req, {
        cpf, origem: "port-cliente", encontrado: !!(rows.length || nascimento),
      });
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
          SELECT p.upag AS upag_pessoa, p.upag_nome_pessoa, v.upag AS upag_vinculo,
                 v.sit_func, v.orgao
          FROM clientes_pessoa p
          LEFT JOIN clientes_vinculo v ON v.pessoa_id = p.id AND v.ativo = TRUE
          WHERE p.cpf = ${cpf}
          ORDER BY v.ultima_atualizacao DESC NULLS LAST
          LIMIT 10
        `);
        const rows = r.rows as any[];
        registrarConsultaCliente(req, {
          cpf, origem: "port-upag", encontrado: rows.length > 0,
        });
        const linha = rows.find(x => x.upag_vinculo || x.upag_pessoa);
        if (linha) {
          upag = String(linha.upag_vinculo || linha.upag_pessoa);
          origem = "cadastro do CRM";
        }
        if (rows.length) {
          // o cadastro da pessoa é o mais confiável; o órgão do vínculo serve de reserva
          upagNome = rows[0].upag_nome_pessoa || rows.find(x => x.orgao)?.orgao || null;
          situacao = rows.find(x => x.sit_func)?.sit_func || null;
        }
      }

      if (!upag) {
        return res.json({ upag: null, upagNome, situacao, origem, atendida: null,
          motivo: "UPAG não encontrada no CRM: informe a unidade pagadora." });
      }

      const achada = acharUpag(upags, upag);
      // a lista do banco tem o nome por extenso: serve quando o CRM não tem
      if (achada && !upagNome) upagNome = achada.descricao;
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
        VALUES (${await destinoDaEscrita(tenantId)}, ${nome}, ${req.body?.codigo || null}, TRUE, ${Number(req.body?.ordem) || 0})
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
      const bankId = Number(req.params.id);
      const alvo = (await db.execute(sql`
        SELECT id, tenant_id FROM port_banks
        WHERE id = ${bankId} AND (tenant_id = ${tenantId} OR tenant_id IS NULL)
      `)).rows[0] as any;
      if (!alvo) return res.status(404).json({ message: "Banco não encontrado" });

      // Banco do CATÁLOGO: ligar e desligar é de cada ambiente, não do catálogo.
      // Um assinante pode não trabalhar com um banco sem tirá-lo de todo mundo.
      if (alvo.tenant_id == null && mexeAtivo) {
        await db.execute(sql`
          INSERT INTO port_bank_config (tenant_id, bank_id, convenio, ativo, inativo_motivo, inativo_em, atualizado_por, atualizado_em)
          VALUES (${tenantId}, ${bankId}, ${String(req.body?.convenio || "SIAPE")}, ${!!b.ativo}, ${motivo},
                  ${b.ativo ? null : sql`NOW()`}, ${req.user?.id ?? null}, NOW())
          ON CONFLICT (tenant_id, bank_id, convenio) DO UPDATE SET
            ativo = EXCLUDED.ativo, inativo_motivo = EXCLUDED.inativo_motivo,
            inativo_em = EXCLUDED.inativo_em, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = NOW()
        `);
        return res.json({ id: bankId, ativo: !!b.ativo, global: true });
      }

      const r = await db.execute(sql`
        UPDATE port_banks SET
          inativo_motivo = CASE WHEN ${mexeAtivo} THEN ${motivo} ELSE inativo_motivo END,
          inativo_em = CASE WHEN ${mexeAtivo} THEN (CASE WHEN ${!!b.ativo} THEN NULL ELSE NOW() END) ELSE inativo_em END,
          ativo = COALESCE(${mexeAtivo ? b.ativo : null}, ativo),
          ordem = COALESCE(${Number.isFinite(b.ordem) ? b.ordem : null}, ordem),
          codigo = COALESCE(${b.codigo ?? null}, codigo)
        WHERE id = ${bankId} AND (tenant_id = ${tenantId} OR (tenant_id IS NULL AND ${await ehDonoDoCatalogo(tenantId)}))
        RETURNING *
      `);
      if (!r.rows.length) return res.status(404).json({ message: "Banco não encontrado" });
      res.json(r.rows[0]);
    } catch (err: any) {
      console.error("[PORT] PATCH banco:", err);
      res.status(500).json({ message: "Erro ao atualizar banco" });
    }
  });

  /** Comissão é SEMPRE do ambiente, nunca do catálogo. Sem cadastro, fica em
   *  branco — nenhum ambiente herda a comissão de outro. */
  app.put("/api/port/bancos/:id/comissao", requireAuth, async (req: any, res) => {
    try {
      const tenantId = tenantDe(req, res); if (!tenantId || !exigeMaster(req, res)) return;
      const bankId = Number(req.params.id);
      const convenio = String(req.body?.convenio || "SIAPE");
      const existe = (await db.execute(sql`
        SELECT 1 FROM port_banks WHERE id = ${bankId} AND (tenant_id = ${tenantId} OR tenant_id IS NULL)
      `)).rows.length;
      if (!existe) return res.status(404).json({ message: "Banco não encontrado" });

      const pct = req.body?.percentual;
      const comissao = pct == null || pct === "" ? null
        : { percentual: Number(String(pct).replace(",", ".")), base: "saldo" as const };
      if (comissao && (!Number.isFinite(comissao.percentual) || comissao.percentual < 0 || comissao.percentual > 100)) {
        return res.status(400).json({ message: "Percentual inválido (ex.: 0,75)" });
      }
      const faixas = Array.isArray(req.body?.faixas)
        ? req.body.faixas
            .map((f: any) => ({ minValor: Number(f?.minValor), percentual: f?.percentual == null || f?.percentual === "" ? null : Number(String(f.percentual).replace(",", ".")) }))
            .filter((f: any) => Number.isFinite(f.minValor))
        : null;

      await db.execute(sql`
        INSERT INTO port_bank_config (tenant_id, bank_id, convenio, comissao, comissao_faixas, atualizado_por, atualizado_em)
        VALUES (${tenantId}, ${bankId}, ${convenio}, ${comissao ? JSON.stringify(comissao) : null}::jsonb,
                ${faixas && faixas.length ? JSON.stringify(faixas) : null}::jsonb, ${req.user?.id ?? null}, NOW())
        ON CONFLICT (tenant_id, bank_id, convenio) DO UPDATE SET
          comissao = EXCLUDED.comissao, comissao_faixas = EXCLUDED.comissao_faixas,
          atualizado_por = EXCLUDED.atualizado_por, atualizado_em = NOW()
      `);
      res.json({ ok: true, comissao, faixas });
    } catch (err: any) {
      console.error("[PORT] PUT comissao:", err);
      res.status(500).json({ message: "Erro ao gravar a comissão" });
    }
  });

  /** Nova versão das regras do infográfico. Fecha a vigente; nunca edita. */
  async function gravarRegras(destino: number | null, bankId: number, convenio: string, regras: RegrasBanco,
                              fonteDescricao: string | null, modeloId: string | null, userId: number | null) {
    const hash = hashRegras(regras);
    const mesmoDono = destino == null ? sql`tenant_id IS NULL` : sql`tenant_id = ${destino}`;
    const atual = (await db.execute(sql`
      SELECT id, hash FROM port_rule_sets
      WHERE ${mesmoDono} AND bank_id = ${bankId} AND convenio = ${convenio} AND vigencia_fim IS NULL
    `)).rows as any[];
    if (atual.length === 1 && atual[0].hash === hash) return { id: atual[0].id, novo: false };

    await db.execute(sql`
      UPDATE port_rule_sets SET vigencia_fim = NOW()
      WHERE ${mesmoDono} AND bank_id = ${bankId} AND convenio = ${convenio} AND vigencia_fim IS NULL
    `);
    const r = await db.execute(sql`
      INSERT INTO port_rule_sets (tenant_id, bank_id, convenio, regras, hash, fonte_descricao, modelo_id, vigencia_inicio, criado_por)
      VALUES (${destino}, ${bankId}, ${convenio}, ${JSON.stringify(regras)}::jsonb, ${hash},
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
      const bankId = Number(req.params.id);
      const limpas = await guardarComissao(tenantId, bankId, String(convenio), regras, req.user?.id ?? null);
      const r = await gravarRegras(await destinoDaEscrita(tenantId), bankId, String(convenio), limpas,
                                   fonteDescricao || null, null, req.user?.id ?? null);
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
        VALUES (${await destinoDaEscrita(tenantId)}, ${Number(req.params.id)}, ${String(convenio)}, 'origem_pagas',
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
        WHERE id = ${Number(req.params.id)} AND ativo = TRUE
          AND (tenant_id = ${tenantId} OR (tenant_id IS NULL AND ${await ehDonoDoCatalogo(tenantId)}))
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

      const destino = await destinoDaEscrita(tenantId);
      // o banco pode já existir no catálogo global ou no próprio ambiente
      let banco = (await db.execute(sql`
        SELECT id FROM port_banks
        WHERE (tenant_id = ${tenantId} OR tenant_id IS NULL) AND lower(nome) = lower(${modelo.banco})
        ORDER BY tenant_id NULLS LAST LIMIT 1
      `)).rows[0] as any;
      if (!banco) {
        banco = (await db.execute(sql`
          INSERT INTO port_banks (tenant_id, nome, ativo, ordem) VALUES (${destino}, ${modelo.banco}, TRUE, 0) RETURNING id
        `)).rows[0];
      }
      // a comissão do modelo é DESTE ambiente; as regras vão limpas para o catálogo
      const limpas = await guardarComissao(tenantId, banco.id, modelo.convenio, modelo.regras, userId);
      const regra = await gravarRegras(destino, banco.id, modelo.convenio, limpas, modelo.fonteDescricao, modelo.id, userId);

      // exceções: só cria as que ainda não existem ativas para a mesma origem
      const ativas = (await db.execute(sql`
        SELECT parametros FROM port_rule_exceptions
        WHERE (tenant_id = ${tenantId} OR tenant_id IS NULL)
          AND bank_id = ${banco.id} AND convenio = ${modelo.convenio} AND ativo = TRUE
      `)).rows as any[];
      const jaTem = new Set(ativas.map(a => normalizarOrigem(a.parametros?.origem)));
      let criadas = 0;
      for (const e of modelo.excecoesSugeridas || []) {
        const chave = normalizarOrigem(e.parametros.origem);
        if (!chave || jaTem.has(chave)) continue;
        await db.execute(sql`
          INSERT INTO port_rule_exceptions (tenant_id, bank_id, convenio, tipo, parametros, motivo, ativo, criado_por)
          VALUES (${destino}, ${banco.id}, ${modelo.convenio}, 'origem_pagas',
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

      // carrega TODOS e separa aqui: assim o desligado respeita a config do ambiente
      const { bancos, paraMotor } = await carregarParaAnalise(tenantId, cliente.convenio, false);
      const ativos = paraMotor.filter((_, i) => bancos[i].ativo);
      const desligados = bancos.filter(b => !b.ativo);
      const resp = {
        ...respostaSimulacao(ativos, cliente, contratos, new Date(), normalizarOperacao(req.body?.operacao)),
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
