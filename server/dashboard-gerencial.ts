import type { Express, RequestHandler, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./storage";

// "a,b,c" -> ["a","b","c"] (trim, sem vazios)
function parseList(v: any): string[] {
  if (!v) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Lista pra IN (...) — evita o "malformed array literal" do ANY(${jsArray}).
function inVals(values: (string | number)[]) {
  return sql.join(values.map((v) => sql`${v}`), sql`, `);
}

// Filtros do PIPELINE (tabela proposals, alias p). Cada fragmento começa com "AND".
function buildFiltrosSql(q: any) {
  const frags: any[] = [];
  const banco = parseList(q.banco);
  const produto = parseList(q.produto);
  const convenio = parseList(q.convenio);
  const corretor = parseList(q.corretor).map((n) => parseInt(n)).filter((n) => !isNaN(n));
  const parceiro = parseList(q.parceiro).map((n) => parseInt(n)).filter((n) => !isNaN(n));
  if (banco.length) frags.push(sql`AND p.bank IN (${inVals(banco)})`);
  if (produto.length) frags.push(sql`AND p.product IN (${inVals(produto)})`);
  if (convenio.length) frags.push(sql`AND p.client_convenio IN (${inVals(convenio)})`);
  if (corretor.length) frags.push(sql`AND p.vendor_id IN (${inVals(corretor)})`);
  if (parceiro.length) frags.push(sql`AND p.parceiro_id IN (${inVals(parceiro)})`);
  return frags.length ? sql.join(frags, sql` `) : sql``;
}

// Filtros da PRODUÇÃO OFICIAL (producoes_contratos / vendedor_contratos — mesmas
// colunas banco/convenio/vendedor_id, sem alias). Produto/parceiro não se aplicam.
function buildFiltrosOficialSql(q: any, prefix = "") {
  const px = prefix ? sql.raw(prefix) : sql``;
  const frags: any[] = [];
  const banco = parseList(q.banco);
  const convenio = parseList(q.convenio);
  const corretor = parseList(q.corretor).map((n) => parseInt(n)).filter((n) => !isNaN(n));
  if (banco.length) frags.push(sql`AND ${px}banco IN (${inVals(banco)})`);
  if (convenio.length) frags.push(sql`AND ${px}convenio IN (${inVals(convenio)})`);
  if (corretor.length) frags.push(sql`AND ${px}vendedor_id IN (${inVals(corretor)})`);
  return frags.length ? sql.join(frags, sql` `) : sql``;
}

// Lista de "YYYY-MM" entre as datas (inclusive) — pra filtrar mes_referencia.
function mesesNoPeriodo(inicioStr: string, fimStr: string): string[] {
  const [iy, im] = inicioStr.split("-").map(Number);
  const [fy, fm] = fimStr.split("-").map(Number);
  const out: string[] = [];
  let y = iy, m = im;
  let guard = 0;
  while ((y < fy || (y === fy && m <= fm)) && guard < 240) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
    guard++;
  }
  return out;
}

export function registerDashboardGerencialRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireMaster: RequestHandler,
) {
  // ── Aba 1 (Visão Geral): Pipeline (proposals) + Produção Oficial (financeiro) ─
  app.get(
    "/api/gestao-comercial/dashboard/visao-geral",
    requireAuth,
    requireMaster,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.tenantId || req.session?.tenantId;
        const hoje = new Date();
        const fimStr = (req.query.fim as string) || hoje.toISOString().slice(0, 10);
        const inicioStr =
          (req.query.inicio as string) ||
          new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
        const gran = ["dia", "semana", "mes"].includes(req.query.gran) ? req.query.gran : "dia";
        const truncUnit = gran === "mes" ? "month" : gran === "semana" ? "week" : "day";
        const filtros = buildFiltrosSql(req.query);

        // período anterior equivalente (mesmo tamanho imediatamente antes)
        const inicio = new Date(inicioStr + "T00:00:00");
        const fim = new Date(fimStr + "T23:59:59");
        const durMs = fim.getTime() - inicio.getTime();
        const prevFim = new Date(inicio.getTime() - 1000);
        const prevInicio = new Date(prevFim.getTime() - durMs);
        const prevInicioStr = prevInicio.toISOString().slice(0, 10);
        const prevFimStr = prevFim.toISOString().slice(0, 10);

        // PAGO = status PAGO, contabilizado por paid_at OU updated_at (igual ao
        // card "Pagos" do operacional — muitas propostas PAGO não têm paid_at).
        const kpis = async (ini: string, f: string) => {
          const r = await db.execute(sql`
            SELECT
              COALESCE(SUM(CASE WHEN p.status = 'PAGO' AND COALESCE(p.paid_at, p.updated_at)::date BETWEEN ${ini} AND ${f}
                                THEN p.contract_value ELSE 0 END), 0) AS pago_valor,
              COUNT(*) FILTER (WHERE p.status = 'PAGO' AND COALESCE(p.paid_at, p.updated_at)::date BETWEEN ${ini} AND ${f}) AS pago_qtd,
              COALESCE(SUM(CASE WHEN p.created_at::date BETWEEN ${ini} AND ${f}
                                THEN p.contract_value ELSE 0 END), 0) AS cad_valor,
              COUNT(*) FILTER (WHERE p.created_at::date BETWEEN ${ini} AND ${f}) AS cad_qtd
            FROM proposals p
            WHERE p.tenant_id = ${tenantId} ${filtros}
          `);
          const row: any = r.rows[0] || {};
          const pagoValor = Number(row.pago_valor) || 0;
          const pagoQtd = Number(row.pago_qtd) || 0;
          const cadValor = Number(row.cad_valor) || 0;
          const cadQtd = Number(row.cad_qtd) || 0;
          return {
            pagoValor,
            pagoQtd,
            ticketMedio: pagoQtd ? pagoValor / pagoQtd : 0,
            cadastradoValor: cadValor,
            cadastradoQtd: cadQtd,
            conversao: cadQtd ? pagoQtd / cadQtd : 0,
          };
        };

        const [atual, anterior] = await Promise.all([
          kpis(inicioStr, fimStr),
          kpis(prevInicioStr, prevFimStr),
        ]);

        // série temporal (paga por paid_at/updated_at, cadastro por created_at)
        const serieRes = await db.execute(sql`
          WITH base AS (
            SELECT date_trunc(${truncUnit}, COALESCE(p.paid_at, p.updated_at))::date AS periodo,
                   SUM(p.contract_value) AS pago_valor, COUNT(*) AS pago_qtd,
                   0::numeric AS cad_valor, 0 AS cad_qtd
            FROM proposals p
            WHERE p.tenant_id = ${tenantId} AND p.status = 'PAGO'
              AND COALESCE(p.paid_at, p.updated_at)::date BETWEEN ${inicioStr} AND ${fimStr} ${filtros}
            GROUP BY 1
            UNION ALL
            SELECT date_trunc(${truncUnit}, p.created_at)::date AS periodo,
                   0::numeric, 0, SUM(p.contract_value), COUNT(*)
            FROM proposals p
            WHERE p.tenant_id = ${tenantId}
              AND p.created_at::date BETWEEN ${inicioStr} AND ${fimStr} ${filtros}
            GROUP BY 1
          )
          SELECT to_char(periodo, 'YYYY-MM-DD') AS periodo,
                 SUM(pago_valor) AS pago_valor, SUM(pago_qtd) AS pago_qtd,
                 SUM(cad_valor) AS cad_valor, SUM(cad_qtd) AS cad_qtd
          FROM base GROUP BY periodo ORDER BY periodo
        `);
        const serie = serieRes.rows.map((r: any) => ({
          periodo: r.periodo,
          pagoValor: Number(r.pago_valor) || 0,
          pagoQtd: Number(r.pago_qtd) || 0,
          cadastradoValor: Number(r.cad_valor) || 0,
          cadastradoQtd: Number(r.cad_qtd) || 0,
        }));

        // quebras de produção PAGA (top 12; o front agrupa "outros")
        const quebra = async (col: any) => {
          const r = await db.execute(sql`
            SELECT COALESCE(NULLIF(${col}, ''), 'Não informado') AS chave,
                   SUM(p.contract_value) AS valor, COUNT(*) AS qtd
            FROM proposals p
            WHERE p.tenant_id = ${tenantId} AND p.status = 'PAGO'
              AND COALESCE(p.paid_at, p.updated_at)::date BETWEEN ${inicioStr} AND ${fimStr} ${filtros}
            GROUP BY 1 ORDER BY valor DESC LIMIT 12
          `);
          return r.rows.map((x: any) => ({
            chave: x.chave,
            valor: Number(x.valor) || 0,
            qtd: Number(x.qtd) || 0,
          }));
        };
        const [produto, banco, convenio] = await Promise.all([
          quebra(sql`p.product`),
          quebra(sql`p.bank`),
          quebra(sql`p.client_convenio`),
        ]);

        // ── PRODUÇÃO OFICIAL (mesma definição da Meta/Ranking) ──────────────
        // producoes_contratos (confirmado, valor_base, por mes_referencia) +
        // vendedor_contratos (valor_contrato, por data_contrato). Novo/Port/Cartão
        // por tipo. "geral" = total - cartão (como a Meta Geral da equipe).
        const meses = mesesNoPeriodo(inicioStr, fimStr);
        if (!meses.length) meses.push("0000-00"); // guarda: nunca IN () vazio
        const filtrosOf = buildFiltrosOficialSql(req.query);
        const [prodR, vendR] = await Promise.all([
          db.execute(sql`
            SELECT
              COALESCE(SUM(valor_base),0) AS total,
              COALESCE(SUM(CASE WHEN is_cartao = true THEN valor_base ELSE 0 END),0) AS cartao,
              COALESCE(SUM(CASE WHEN is_cartao = false AND LOWER(COALESCE(tipo_contrato,'')) LIKE '%port%' THEN valor_base ELSE 0 END),0) AS portabilidade,
              COALESCE(SUM(CASE WHEN is_cartao = false AND (LOWER(COALESCE(tipo_contrato,'')) LIKE '%novo%' OR LOWER(COALESCE(tipo_contrato,'')) LIKE '%consig%') THEN valor_base ELSE 0 END),0) AS novo,
              COUNT(*) AS qtd
            FROM producoes_contratos
            WHERE tenant_id = ${tenantId} AND confirmado = true AND comissao_repasse_valor > 0
              AND mes_referencia IN (${inVals(meses)}) ${filtrosOf}
          `),
          db.execute(sql`
            SELECT
              COALESCE(SUM(valor_contrato),0) AS total,
              COALESCE(SUM(CASE WHEN LOWER(COALESCE(tipo_operacao,'')) LIKE '%cart%' THEN valor_contrato ELSE 0 END),0) AS cartao,
              COALESCE(SUM(CASE WHEN LOWER(COALESCE(tipo_operacao,'')) NOT LIKE '%cart%' AND LOWER(COALESCE(tipo_operacao,'')) LIKE '%port%' THEN valor_contrato ELSE 0 END),0) AS portabilidade,
              COALESCE(SUM(CASE WHEN LOWER(COALESCE(tipo_operacao,'')) NOT LIKE '%cart%' AND (LOWER(COALESCE(tipo_operacao,'')) LIKE '%novo%' OR LOWER(COALESCE(tipo_operacao,'')) LIKE '%consig%') THEN valor_contrato ELSE 0 END),0) AS novo,
              COUNT(*) AS qtd
            FROM vendedor_contratos
            WHERE tenant_id = ${tenantId}
              AND data_contrato::date BETWEEN ${inicioStr} AND ${fimStr} ${filtrosOf}
          `),
        ]);
        const pr: any = prodR.rows[0] || {};
        const vr: any = vendR.rows[0] || {};
        const num = (a: any, b: any) => (Number(a) || 0) + (Number(b) || 0);
        const ofCartao = num(pr.cartao, vr.cartao);
        const ofTotal = num(pr.total, vr.total);
        const oficial = {
          geral: ofTotal - ofCartao, // produção sem cartão (= Meta Geral)
          novo: num(pr.novo, vr.novo),
          portabilidade: num(pr.portabilidade, vr.portabilidade),
          cartao: ofCartao,
          total: ofTotal,
          qtd: num(pr.qtd, vr.qtd),
        };

        return res.json({
          filtrosAplicados: { inicio: inicioStr, fim: fimStr, gran },
          kpis: atual,
          comparativo: anterior,
          serie,
          quebras: { produto, banco, convenio },
          oficial,
        });
      } catch (e: any) {
        console.error("dashboard visao-geral error:", e);
        return res.status(500).json({ message: "Erro ao carregar dashboard" });
      }
    },
  );

  // ── Drill-down: lista detalhada das propostas (pipeline) ───────────────────
  app.get(
    "/api/gestao-comercial/dashboard/visao-geral/drill",
    requireAuth,
    requireMaster,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.tenantId || req.session?.tenantId;
        const hoje = new Date();
        const fimStr = (req.query.fim as string) || hoje.toISOString().slice(0, 10);
        const inicioStr =
          (req.query.inicio as string) ||
          new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
        const filtros = buildFiltrosSql(req.query);
        const metrica = req.query.metrica === "cadastro" ? "cadastro" : "pago";
        const dim = ["produto", "banco", "convenio"].includes(req.query.dim) ? req.query.dim : null;
        const valor = req.query.valor != null ? String(req.query.valor) : null;

        const dataCond =
          metrica === "pago"
            ? sql`p.status = 'PAGO' AND COALESCE(p.paid_at, p.updated_at)::date BETWEEN ${inicioStr} AND ${fimStr}`
            : sql`p.created_at::date BETWEEN ${inicioStr} AND ${fimStr}`;

        let dimCond = sql``;
        if (dim && valor != null) {
          const col =
            dim === "produto" ? sql`p.product` : dim === "banco" ? sql`p.bank` : sql`p.client_convenio`;
          dimCond =
            valor === "Não informado"
              ? sql`AND (${col} IS NULL OR ${col} = '')`
              : sql`AND ${col} = ${valor}`;
        }

        const orderCol = metrica === "pago" ? sql`COALESCE(p.paid_at, p.updated_at)` : sql`p.created_at`;
        const r = await db.execute(sql`
          SELECT p.id, p.client_name, p.client_cpf, u.name AS corretor,
                 p.bank, p.product, p.client_convenio, p.contract_value, p.status,
                 to_char(p.created_at, 'YYYY-MM-DD') AS criado_em,
                 to_char(COALESCE(p.paid_at, p.updated_at), 'YYYY-MM-DD') AS pago_em
          FROM proposals p
          LEFT JOIN users u ON u.id = p.vendor_id
          WHERE p.tenant_id = ${tenantId} AND ${dataCond} ${filtros} ${dimCond}
          ORDER BY ${orderCol} DESC NULLS LAST
          LIMIT 1000
        `);
        const itens = r.rows.map((x: any) => ({
          id: x.id,
          cliente: x.client_name,
          cpf: x.client_cpf,
          corretor: x.corretor,
          banco: x.bank,
          produto: x.product,
          convenio: x.client_convenio,
          valor: Number(x.contract_value) || 0,
          status: x.status,
          criadoEm: x.criado_em,
          pagoEm: x.pago_em,
        }));
        return res.json({ itens });
      } catch (e: any) {
        console.error("dashboard drill error:", e);
        return res.status(500).json({ message: "Erro ao carregar detalhe" });
      }
    },
  );

  // ── Aba 2 (Performance Comercial): top dimensões c/ ticket + perfil por cliente ─
  app.get(
    "/api/gestao-comercial/dashboard/performance",
    requireAuth,
    requireMaster,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.tenantId || req.session?.tenantId;
        const hoje = new Date();
        const fimStr = (req.query.fim as string) || hoje.toISOString().slice(0, 10);
        const inicioStr =
          (req.query.inicio as string) ||
          new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
        const filtros = buildFiltrosSql(req.query); // proposals (cadastrado)
        const filtrosOf = buildFiltrosOficialSql(req.query); // producoes/vendedor (produção)
        const meses = mesesNoPeriodo(inicioStr, fimStr);
        if (!meses.length) meses.push("0000-00");

        const mapRow = (x: any) => {
          const cadQtd = Number(x.cad_qtd) || 0;
          const cadValor = Number(x.cad_valor) || 0;
          const prodQtd = Number(x.prod_qtd) || 0;
          const prodValor = Number(x.prod_valor) || 0;
          return {
            chave: x.chave,
            cadQtd,
            cadValor,
            prodQtd,
            prodValor,
            // Conversão por VALOR (consistente com o total): Produção R$ ÷ Cadastrado R$
            conversao: cadValor ? prodValor / cadValor : 0,
            ticket: prodQtd ? prodValor / prodQtd : 0,
          };
        };

        // Cadastrado = proposals; Produção (pago) = producoes_contratos +
        // vendedor_contratos (fonte ÚNICA do pago — os pagos do CRM já entram aqui,
        // mais os importados). Unificado por chave normalizada (UPPER/TRIM).
        const dimUnificado = async (pCol: any, prodCol: any, vendCol: any) => {
          const r = await db.execute(sql`
            WITH cad AS (
              SELECT UPPER(TRIM(COALESCE(NULLIF(${pCol}, ''), 'Não informado'))) AS k,
                     COUNT(*) AS qtd, COALESCE(SUM(p.contract_value), 0) AS valor
              FROM proposals p
              WHERE p.tenant_id = ${tenantId}
                AND p.created_at::date BETWEEN ${inicioStr} AND ${fimStr} ${filtros}
              GROUP BY 1
            ),
            prod AS (
              SELECT k, SUM(qtd) AS qtd, SUM(valor) AS valor FROM (
                SELECT UPPER(TRIM(COALESCE(NULLIF(${prodCol}, ''), 'Não informado'))) AS k,
                       COUNT(*) AS qtd, COALESCE(SUM(valor_base), 0) AS valor
                FROM producoes_contratos
                WHERE tenant_id = ${tenantId} AND confirmado = true AND comissao_repasse_valor > 0
                  AND mes_referencia IN (${inVals(meses)}) ${filtrosOf}
                GROUP BY 1
                UNION ALL
                SELECT UPPER(TRIM(COALESCE(NULLIF(${vendCol}, ''), 'Não informado'))),
                       COUNT(*), COALESCE(SUM(valor_contrato), 0)
                FROM vendedor_contratos
                WHERE tenant_id = ${tenantId}
                  AND data_contrato::date BETWEEN ${inicioStr} AND ${fimStr} ${filtrosOf}
                GROUP BY 1
              ) u GROUP BY k
            )
            SELECT COALESCE(cad.k, prod.k) AS chave,
                   COALESCE(cad.qtd, 0) AS cad_qtd, COALESCE(cad.valor, 0) AS cad_valor,
                   COALESCE(prod.qtd, 0) AS prod_qtd, COALESCE(prod.valor, 0) AS prod_valor
            FROM cad FULL OUTER JOIN prod ON cad.k = prod.k
            ORDER BY COALESCE(prod.valor, 0) DESC, COALESCE(cad.valor, 0) DESC
            LIMIT 20
          `);
          return r.rows.map(mapRow);
        };

        // produto: proposals.product é enum; producoes/vendedor via tipo -> bucket
        const bucketProd = sql`CASE WHEN is_cartao = true THEN 'CARTAO'
          WHEN LOWER(COALESCE(tipo_contrato,'')) LIKE '%port%' THEN 'PORTABILIDADE'
          WHEN LOWER(COALESCE(tipo_contrato,'')) LIKE '%novo%' OR LOWER(COALESCE(tipo_contrato,'')) LIKE '%consig%' THEN 'NOVO'
          ELSE 'OUTRO' END`;
        const bucketVend = sql`CASE WHEN LOWER(COALESCE(tipo_operacao,'')) LIKE '%cart%' THEN 'CARTAO'
          WHEN LOWER(COALESCE(tipo_operacao,'')) LIKE '%port%' THEN 'PORTABILIDADE'
          WHEN LOWER(COALESCE(tipo_operacao,'')) LIKE '%novo%' OR LOWER(COALESCE(tipo_operacao,'')) LIKE '%consig%' THEN 'NOVO'
          ELSE 'OUTRO' END`;

        const [produto, banco, convenio] = await Promise.all([
          dimUnificado(sql`p.product`, bucketProd, bucketVend),
          dimUnificado(sql`p.bank`, sql`banco`, sql`banco`),
          dimUnificado(sql`p.client_convenio`, sql`convenio`, sql`convenio`),
        ]);

        // totais
        const cadTotR = await db.execute(sql`
          SELECT COUNT(*) AS qtd, COALESCE(SUM(p.contract_value), 0) AS valor
          FROM proposals p
          WHERE p.tenant_id = ${tenantId}
            AND p.created_at::date BETWEEN ${inicioStr} AND ${fimStr} ${filtros}
        `);
        const prodTotR = await db.execute(sql`
          SELECT SUM(qtd) AS qtd, SUM(valor) AS valor FROM (
            SELECT COUNT(*) AS qtd, COALESCE(SUM(valor_base), 0) AS valor FROM producoes_contratos
            WHERE tenant_id = ${tenantId} AND confirmado = true AND comissao_repasse_valor > 0
              AND mes_referencia IN (${inVals(meses)}) ${filtrosOf}
            UNION ALL
            SELECT COUNT(*), COALESCE(SUM(valor_contrato), 0) FROM vendedor_contratos
            WHERE tenant_id = ${tenantId} AND data_contrato::date BETWEEN ${inicioStr} AND ${fimStr} ${filtrosOf}
          ) u
        `);
        const ct: any = cadTotR.rows[0] || {};
        const pt: any = prodTotR.rows[0] || {};
        const cadValorT = Number(ct.valor) || 0;
        const prodQtdT = Number(pt.qtd) || 0;
        const prodValorT = Number(pt.valor) || 0;
        const totais = {
          cadQtd: Number(ct.qtd) || 0,
          cadValor: cadValorT,
          prodQtd: prodQtdT,
          prodValor: prodValorT,
          conversao: cadValorT ? prodValorT / cadValorT : 0,
          ticket: prodQtdT ? prodValorT / prodQtdT : 0,
        };

        // perfil por cliente (entre quem PRODUZIU — producoes_contratos)
        const cliR = await db.execute(sql`
          WITH c AS (
            SELECT cpf_cliente,
                   COUNT(*) AS contratos,
                   COUNT(DISTINCT (${bucketProd})) AS produtos
            FROM producoes_contratos
            WHERE tenant_id = ${tenantId} AND confirmado = true AND comissao_repasse_valor > 0
              AND mes_referencia IN (${inVals(meses)}) ${filtrosOf}
              AND cpf_cliente IS NOT NULL AND cpf_cliente <> ''
            GROUP BY cpf_cliente
          )
          SELECT COUNT(*) AS clientes, COALESCE(AVG(contratos), 0) AS media_contratos,
                 COUNT(*) FILTER (WHERE produtos = 1) AS um_produto,
                 COUNT(*) FILTER (WHERE produtos >= 2) AS multi_produto
          FROM c
        `);
        const cr: any = cliR.rows[0] || {};
        const clientes = Number(cr.clientes) || 0;
        const porCliente = {
          clientes,
          mediaContratos: Number(cr.media_contratos) || 0,
          pctUmProduto: clientes ? (Number(cr.um_produto) || 0) / clientes : 0,
          pctMultiProduto: clientes ? (Number(cr.multi_produto) || 0) / clientes : 0,
        };

        return res.json({ totais, produto, banco, convenio, porCliente });
      } catch (e: any) {
        console.error("dashboard performance error:", e);
        return res.status(500).json({ message: "Erro ao carregar performance" });
      }
    },
  );

  // ── Aba 3 (Portabilidades): funil por status + bancos + efetividade + tempos ─
  app.get(
    "/api/gestao-comercial/dashboard/portabilidades",
    requireAuth,
    requireMaster,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.tenantId || req.session?.tenantId;
        const hoje = new Date();
        const fimStr = (req.query.fim as string) || hoje.toISOString().slice(0, 10);
        const inicioStr =
          (req.query.inicio as string) ||
          new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
        // produto é sempre PORTABILIDADE aqui — ignora o filtro de produto da barra
        const filtros = buildFiltrosSql({ ...req.query, produto: undefined });
        const base = sql`p.tenant_id = ${tenantId} AND p.product = 'PORTABILIDADE'
          AND p.created_at::date BETWEEN ${inicioStr} AND ${fimStr} ${filtros}`;

        // Dados da operação ficam em clientMeta (JSON): bancoOrigem, saldoDevedor, dataCip.
        const saldoExpr = sql`CASE WHEN p.client_meta->>'saldoDevedor' ~ '^-?[0-9]+([.][0-9]+)?$' THEN (p.client_meta->>'saldoDevedor')::numeric ELSE 0 END`;
        const dataCipExpr = sql`CASE WHEN p.client_meta->>'dataCip' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (substring(p.client_meta->>'dataCip' from 1 for 10))::date ELSE NULL END`;
        // Concluído/pago = status PAGO OU um status "quitado" (saldo quitado conta como pago)
        const concluido = sql`(p.status = 'PAGO' OR EXISTS (
          SELECT 1 FROM contract_statuses cs
          WHERE cs.tenant_id = p.tenant_id AND cs.key = p.status AND cs.label ILIKE '%quitad%'
        ))`;

        const kpiR = await db.execute(sql`
          SELECT
            COUNT(*) AS total,
            COALESCE(SUM(p.contract_value),0) AS valor,
            COUNT(*) FILTER (WHERE ${concluido}) AS pagas,
            COALESCE(SUM(p.contract_value) FILTER (WHERE ${concluido}),0) AS valor_pagas,
            COUNT(*) FILTER (WHERE p.status IN ('CANCELADA','PERDIDA')) AS canceladas,
            COALESCE(SUM(${saldoExpr}),0) AS saldo_informado,
            COALESCE(SUM(${saldoExpr}) FILTER (WHERE ${concluido}),0) AS saldo_pago,
            AVG(EXTRACT(EPOCH FROM (COALESCE(p.paid_at, p.updated_at) - p.created_at))/86400)
              FILTER (WHERE ${concluido}) AS dias_ate_pago,
            AVG((COALESCE(p.paid_at, p.updated_at)::date - ${dataCipExpr}))
              FILTER (WHERE ${concluido} AND ${dataCipExpr} IS NOT NULL) AS dias_cip_saldo
          FROM proposals p WHERE ${base}
        `);
        const k: any = kpiR.rows[0] || {};
        const total = Number(k.total) || 0;
        const pagas = Number(k.pagas) || 0;
        const canceladas = Number(k.canceladas) || 0;
        const kpis = {
          total,
          valor: Number(k.valor) || 0,
          pagas,
          valorPagas: Number(k.valor_pagas) || 0,
          canceladas,
          emAndamento: total - pagas - canceladas,
          efetividade: total ? pagas / total : 0,
          saldoInformado: Number(k.saldo_informado) || 0,
          saldoPago: Number(k.saldo_pago) || 0,
          diasAtePago: k.dias_ate_pago != null ? Number(k.dias_ate_pago) : null,
          diasCipSaldo: k.dias_cip_saldo != null ? Number(k.dias_cip_saldo) : null,
        };

        // funil por status (dinâmico, ordenado pela config de contract_statuses)
        const funilR = await db.execute(sql`
          SELECT p.status AS key,
                 COALESCE(cs.label, p.status) AS label,
                 COALESCE(cs.color, 'zinc') AS color,
                 COALESCE(cs.ordem, 999) AS ordem,
                 COUNT(*) AS qtd,
                 COALESCE(SUM(p.contract_value),0) AS valor
          FROM proposals p
          LEFT JOIN contract_statuses cs ON cs.tenant_id = p.tenant_id AND cs.key = p.status
          WHERE ${base}
          GROUP BY p.status, cs.label, cs.color, cs.ordem
          ORDER BY ordem ASC, qtd DESC
        `);
        const funil = funilR.rows.map((x: any) => ({
          key: x.key,
          label: x.label,
          color: x.color,
          qtd: Number(x.qtd) || 0,
          valor: Number(x.valor) || 0,
        }));

        // por banco destino (com efetividade) e por banco origem
        const bancoDestR = await db.execute(sql`
          SELECT COALESCE(NULLIF(p.bank,''),'Não informado') AS chave,
                 COUNT(*) AS qtd, COALESCE(SUM(p.contract_value),0) AS valor,
                 COUNT(*) FILTER (WHERE ${concluido}) AS pagas
          FROM proposals p WHERE ${base} GROUP BY 1 ORDER BY qtd DESC LIMIT 15
        `);
        const bancoDestino = bancoDestR.rows.map((x: any) => {
          const qtd = Number(x.qtd) || 0;
          const pg = Number(x.pagas) || 0;
          return { chave: x.chave, qtd, valor: Number(x.valor) || 0, efetividade: qtd ? pg / qtd : 0 };
        });
        const bancoOrigR = await db.execute(sql`
          SELECT UPPER(TRIM(COALESCE(NULLIF(p.client_meta->>'bancoOrigem',''),'Não informado'))) AS chave,
                 COUNT(*) AS qtd, COALESCE(SUM(p.contract_value),0) AS valor,
                 COALESCE(SUM(p.contract_value) FILTER (WHERE ${concluido}),0) AS valor_pago,
                 COALESCE(SUM(p.contract_value) FILTER (WHERE p.status IN ('CANCELADA','PERDIDA')),0) AS valor_cancelado
          FROM proposals p WHERE ${base} GROUP BY 1 ORDER BY valor DESC LIMIT 15
        `);
        const bancoOrigem = bancoOrigR.rows.map((x: any) => {
          const valor = Number(x.valor) || 0;
          const valorPago = Number(x.valor_pago) || 0;
          const valorCancelado = Number(x.valor_cancelado) || 0;
          return {
            chave: x.chave,
            qtd: Number(x.qtd) || 0,
            valor,
            valorPago,
            valorCancelado,
            valorAndamento: Math.max(0, valor - valorPago - valorCancelado),
          };
        });

        // PRODUÇÃO OFICIAL de portabilidade (financeiro — inclui importados; é o
        // que conta no ranking). producoes_contratos + vendedor_contratos, tipo port.
        const meses = mesesNoPeriodo(inicioStr, fimStr);
        if (!meses.length) meses.push("0000-00");
        const filtrosOf = buildFiltrosOficialSql(req.query);
        const [ppR, pvR] = await Promise.all([
          db.execute(sql`
            SELECT COALESCE(NULLIF(banco,''),'Não informado') AS chave,
                   COALESCE(SUM(valor_base),0) AS valor, COUNT(*) AS qtd
            FROM producoes_contratos
            WHERE tenant_id = ${tenantId} AND confirmado = true AND comissao_repasse_valor > 0
              AND mes_referencia IN (${inVals(meses)}) ${filtrosOf}
              AND is_cartao = false AND LOWER(COALESCE(tipo_contrato,'')) LIKE '%port%'
            GROUP BY 1
          `),
          db.execute(sql`
            SELECT COALESCE(NULLIF(banco,''),'Não informado') AS chave,
                   COALESCE(SUM(valor_contrato),0) AS valor, COUNT(*) AS qtd
            FROM vendedor_contratos
            WHERE tenant_id = ${tenantId}
              AND data_contrato::date BETWEEN ${inicioStr} AND ${fimStr} ${filtrosOf}
              AND LOWER(COALESCE(tipo_operacao,'')) LIKE '%port%'
            GROUP BY 1
          `),
        ]);
        const mapBanco = new Map<string, { valor: number; qtd: number }>();
        let prodValor = 0;
        let prodQtd = 0;
        for (const r of [...ppR.rows, ...pvR.rows] as any[]) {
          const kk = String(r.chave || "Não informado").trim().toUpperCase();
          const v = Number(r.valor) || 0;
          const q = Number(r.qtd) || 0;
          prodValor += v;
          prodQtd += q;
          const cur = mapBanco.get(kk) || { valor: 0, qtd: 0 };
          cur.valor += v;
          cur.qtd += q;
          mapBanco.set(kk, cur);
        }
        const bancoProducao = [...mapBanco.entries()]
          .map(([chave, x]) => ({ chave, valor: x.valor, qtd: x.qtd }))
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 15);
        const producao = { valor: prodValor, qtd: prodQtd };

        return res.json({ producao, bancoProducao, kpis, funil, bancoDestino, bancoOrigem });
      } catch (e: any) {
        console.error("dashboard portabilidades error:", e);
        return res.status(500).json({ message: "Erro ao carregar portabilidades" });
      }
    },
  );

  // ── Aba 4 (Perfil dos Clientes): produção (financeiro, inclui importados) por
  //    demografia do cliente (clientes_pessoa por CPF). ─────────────────────────
  app.get(
    "/api/gestao-comercial/dashboard/perfil",
    requireAuth,
    requireMaster,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.tenantId || req.session?.tenantId;
        const hoje = new Date();
        const fimStr = (req.query.fim as string) || hoje.toISOString().slice(0, 10);
        const inicioStr =
          (req.query.inicio as string) ||
          new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
        const meses = mesesNoPeriodo(inicioStr, fimStr);
        if (!meses.length) meses.push("0000-00");
        const filtrosOf = buildFiltrosOficialSql(req.query, "pc.");

        // base: produção confirmada (financeiro, inclui importados) JOIN cadastro
        // + nomenclaturas (categoria ORGAO) pra traduzir o código do órgão em nome.
        const baseProd = sql`
          FROM producoes_contratos pc
          LEFT JOIN clientes_pessoa cp
            ON cp.cpf = lpad(regexp_replace(COALESCE(pc.cpf_cliente,''), '[^0-9]', '', 'g'), 11, '0')
          LEFT JOIN LATERAL (
            SELECT COALESCE(NULLIF(btrim(cp.orgaocod),''), NULLIF(btrim(cp.orgaodesc),'')) AS codigo
          ) src ON true
          LEFT JOIN LATERAL (
            SELECT n.nome,
              CASE
                WHEN regexp_replace(COALESCE(n.codigo,''), '^0+', '') = regexp_replace(COALESCE(src.codigo,''), '^0+', '')
                     OR upper(btrim(COALESCE(n.codigo,''))) = upper(COALESCE(src.codigo,''))
                  THEN (CASE WHEN n.categoria='ORGAO' THEN 1 ELSE 2 END)
                WHEN regexp_replace(COALESCE(src.codigo,''), '[^0-9]', '', 'g') ~ '^[0-9]{6,}$'
                     AND regexp_replace(COALESCE(n.codigo,''), '^0+', '')
                         = regexp_replace(substring(regexp_replace(COALESCE(src.codigo,''), '[^0-9]', '', 'g') FROM 1 FOR 5), '^0+', '')
                  THEN (CASE WHEN n.categoria='ORGAO' THEN 3 ELSE 4 END)
                WHEN upper(btrim(COALESCE(n.nome,''))) = upper(COALESCE(src.codigo,''))
                  THEN (CASE WHEN n.categoria='ORGAO' THEN 5 ELSE 6 END)
                ELSE 99
              END AS pri
            FROM nomenclaturas n
            WHERE n.ativo = true AND n.categoria IN ('ORGAO','RUBRICA')
              AND (
                regexp_replace(COALESCE(n.codigo,''), '^0+', '') = regexp_replace(COALESCE(src.codigo,''), '^0+', '')
                OR upper(btrim(COALESCE(n.codigo,''))) = upper(COALESCE(src.codigo,''))
                OR (
                  regexp_replace(COALESCE(src.codigo,''), '[^0-9]', '', 'g') ~ '^[0-9]{6,}$'
                  AND regexp_replace(COALESCE(n.codigo,''), '^0+', '')
                      = regexp_replace(substring(regexp_replace(COALESCE(src.codigo,''), '[^0-9]', '', 'g') FROM 1 FOR 5), '^0+', '')
                )
                OR upper(btrim(COALESCE(n.nome,''))) = upper(COALESCE(src.codigo,''))
              )
            ORDER BY pri, n.id
            LIMIT 1
          ) no ON true
          WHERE pc.tenant_id = ${tenantId} AND pc.confirmado = true AND pc.comissao_repasse_valor > 0
            AND pc.mes_referencia IN (${inVals(meses)}) ${filtrosOf}
        `;

        const porDim = async (colExpr: any) => {
          const r = await db.execute(sql`
            SELECT COALESCE(NULLIF(${colExpr}::text, ''), 'Não informado') AS chave,
                   COALESCE(SUM(pc.valor_base), 0) AS valor,
                   COUNT(DISTINCT pc.cpf_cliente) AS clientes
            ${baseProd}
            GROUP BY 1 ORDER BY valor DESC LIMIT 15
          `);
          return r.rows.map((x: any) => ({
            chave: x.chave, valor: Number(x.valor) || 0, clientes: Number(x.clientes) || 0,
          }));
        };

        const faixaExpr = sql`CASE
          WHEN cp.data_nascimento IS NULL THEN 'Sem data'
          WHEN EXTRACT(YEAR FROM age(cp.data_nascimento)) < 30 THEN 'Até 29'
          WHEN EXTRACT(YEAR FROM age(cp.data_nascimento)) < 40 THEN '30-39'
          WHEN EXTRACT(YEAR FROM age(cp.data_nascimento)) < 50 THEN '40-49'
          WHEN EXTRACT(YEAR FROM age(cp.data_nascimento)) < 60 THEN '50-59'
          WHEN EXTRACT(YEAR FROM age(cp.data_nascimento)) < 70 THEN '60-69'
          ELSE '70+' END`;

        const [convenio, uf, faixaEtaria, orgao, bancoRecebimento, totalR] =
          await Promise.all([
            porDim(sql`pc.convenio`),
            porDim(sql`cp.uf`),
            porDim(faixaExpr),
            porDim(sql`COALESCE(no.nome, NULLIF(cp.orgaodesc,''), cp.orgaocod)`),
            porDim(sql`cp.banco_nome`),
            db.execute(sql`SELECT COALESCE(SUM(pc.valor_base),0) AS valor, COUNT(DISTINCT pc.cpf_cliente) AS clientes ${baseProd}`),
          ]);
        const tt: any = totalR.rows[0] || {};

        return res.json({
          total: { valor: Number(tt.valor) || 0, clientes: Number(tt.clientes) || 0 },
          convenio, uf, faixaEtaria, orgao, bancoRecebimento,
        });
      } catch (e: any) {
        console.error("dashboard perfil error:", e);
        return res.status(500).json({ message: "Erro ao carregar perfil" });
      }
    },
  );

  // ── Opções pros filtros (bancos/convênios/corretores/parceiros do tenant) ──
  app.get(
    "/api/gestao-comercial/dashboard/opcoes",
    requireAuth,
    requireMaster,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.tenantId || req.session?.tenantId;
        const [bancosR, conveniosR, corretoresR, parceirosR] = await Promise.all([
          db.execute(sql`SELECT DISTINCT bank AS v FROM proposals WHERE tenant_id = ${tenantId} AND bank IS NOT NULL AND bank <> '' ORDER BY bank`),
          db.execute(sql`SELECT DISTINCT client_convenio AS v FROM proposals WHERE tenant_id = ${tenantId} AND client_convenio IS NOT NULL AND client_convenio <> '' ORDER BY client_convenio`),
          db.execute(sql`SELECT DISTINCT u.id, u.name FROM proposals p JOIN users u ON u.id = p.vendor_id WHERE p.tenant_id = ${tenantId} ORDER BY u.name`),
          db.execute(sql`SELECT DISTINCT pr.id, pr.name FROM proposals p JOIN partners pr ON pr.id = p.parceiro_id WHERE p.tenant_id = ${tenantId} ORDER BY pr.name`),
        ]);
        return res.json({
          bancos: bancosR.rows.map((x: any) => x.v),
          convenios: conveniosR.rows.map((x: any) => x.v),
          produtos: ["NOVO", "PORTABILIDADE", "REFINANCIAMENTO", "CARTAO"],
          corretores: corretoresR.rows.map((x: any) => ({ id: x.id, nome: x.name })),
          parceiros: parceirosR.rows.map((x: any) => ({ id: x.id, nome: x.name })),
        });
      } catch (e: any) {
        console.error("dashboard opcoes error:", e);
        return res.status(500).json({ message: "Erro ao carregar opções" });
      }
    },
  );
}
