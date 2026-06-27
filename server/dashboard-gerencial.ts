import type { Express, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "./storage";

// requireMaster: dashboard gerencial é exclusivo para usuário Master.
function requireMaster(req: any, res: Response, next: NextFunction) {
  if (!req.user?.isMaster) {
    return res
      .status(403)
      .json({ message: "Acesso negado - apenas administradores master" });
  }
  next();
}

function requireAuthLocal(req: any, res: Response, next: NextFunction) {
  const userId = req.user?.id || req.session?.userId;
  const tenantId = req.tenantId || req.session?.tenantId;
  if (!userId || !tenantId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  next();
}

// "a,b,c" -> ["a","b","c"] (trim, sem vazios)
function parseList(v: any): string[] {
  if (!v) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Filtros comuns (banco/produto/convenio/corretor/parceiro) como fragmento SQL.
// tenantId é tratado fora. Cada fragmento começa com "AND ...".
function buildFiltrosSql(q: any) {
  const frags: any[] = [];
  const banco = parseList(q.banco);
  const produto = parseList(q.produto);
  const convenio = parseList(q.convenio);
  const corretor = parseList(q.corretor)
    .map((n) => parseInt(n))
    .filter((n) => !isNaN(n));
  const parceiro = parseList(q.parceiro)
    .map((n) => parseInt(n))
    .filter((n) => !isNaN(n));
  if (banco.length) frags.push(sql`AND p.bank = ANY(${banco})`);
  if (produto.length) frags.push(sql`AND p.product = ANY(${produto})`);
  if (convenio.length) frags.push(sql`AND p.client_convenio = ANY(${convenio})`);
  if (corretor.length) frags.push(sql`AND p.vendor_id = ANY(${corretor})`);
  if (parceiro.length) frags.push(sql`AND p.parceiro_id = ANY(${parceiro})`);
  return frags.length ? sql.join(frags, sql` `) : sql``;
}

export function registerDashboardGerencialRoutes(app: Express) {
  // ── Agregador da Aba 1 (Visão Geral) ──────────────────────────────────────
  app.get(
    "/api/gestao-comercial/dashboard/visao-geral",
    requireAuthLocal,
    requireMaster,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.tenantId || req.session?.tenantId;
        const hoje = new Date();
        const fimStr =
          (req.query.fim as string) || hoje.toISOString().slice(0, 10);
        const inicioStr =
          (req.query.inicio as string) ||
          new Date(hoje.getFullYear(), hoje.getMonth(), 1)
            .toISOString()
            .slice(0, 10);
        const gran = ["dia", "semana", "mes"].includes(req.query.gran)
          ? req.query.gran
          : "dia";
        const truncUnit =
          gran === "mes" ? "month" : gran === "semana" ? "week" : "day";
        const filtros = buildFiltrosSql(req.query);

        // período anterior equivalente (mesmo tamanho imediatamente antes)
        const inicio = new Date(inicioStr + "T00:00:00");
        const fim = new Date(fimStr + "T23:59:59");
        const durMs = fim.getTime() - inicio.getTime();
        const prevFim = new Date(inicio.getTime() - 1000);
        const prevInicio = new Date(prevFim.getTime() - durMs);
        const prevInicioStr = prevInicio.toISOString().slice(0, 10);
        const prevFimStr = prevFim.toISOString().slice(0, 10);

        const kpis = async (ini: string, f: string) => {
          const r = await db.execute(sql`
            SELECT
              COALESCE(SUM(CASE WHEN p.status = 'PAGO' AND p.paid_at::date BETWEEN ${ini} AND ${f}
                                THEN p.contract_value ELSE 0 END), 0) AS pago_valor,
              COUNT(*) FILTER (WHERE p.status = 'PAGO' AND p.paid_at::date BETWEEN ${ini} AND ${f}) AS pago_qtd,
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

        // série temporal (paga por paid_at, cadastro por created_at)
        const serieRes = await db.execute(sql`
          WITH base AS (
            SELECT date_trunc(${truncUnit}, p.paid_at)::date AS periodo,
                   SUM(p.contract_value) AS pago_valor, COUNT(*) AS pago_qtd,
                   0::numeric AS cad_valor, 0 AS cad_qtd
            FROM proposals p
            WHERE p.tenant_id = ${tenantId} AND p.status = 'PAGO'
              AND p.paid_at::date BETWEEN ${inicioStr} AND ${fimStr} ${filtros}
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
              AND p.paid_at::date BETWEEN ${inicioStr} AND ${fimStr} ${filtros}
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

        return res.json({
          filtrosAplicados: { inicio: inicioStr, fim: fimStr, gran },
          kpis: atual,
          comparativo: anterior,
          serie,
          quebras: { produto, banco, convenio },
        });
      } catch (e: any) {
        console.error("dashboard visao-geral error:", e);
        return res.status(500).json({ message: "Erro ao carregar dashboard" });
      }
    },
  );

  // ── Drill-down: lista detalhada das propostas que formam um indicador ──────
  app.get(
    "/api/gestao-comercial/dashboard/visao-geral/drill",
    requireAuthLocal,
    requireMaster,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.tenantId || req.session?.tenantId;
        const hoje = new Date();
        const fimStr =
          (req.query.fim as string) || hoje.toISOString().slice(0, 10);
        const inicioStr =
          (req.query.inicio as string) ||
          new Date(hoje.getFullYear(), hoje.getMonth(), 1)
            .toISOString()
            .slice(0, 10);
        const filtros = buildFiltrosSql(req.query);
        const metrica = req.query.metrica === "cadastro" ? "cadastro" : "pago";
        const dim = ["produto", "banco", "convenio"].includes(req.query.dim)
          ? req.query.dim
          : null;
        const valor = req.query.valor != null ? String(req.query.valor) : null;

        const dataCond =
          metrica === "pago"
            ? sql`p.status = 'PAGO' AND p.paid_at::date BETWEEN ${inicioStr} AND ${fimStr}`
            : sql`p.created_at::date BETWEEN ${inicioStr} AND ${fimStr}`;

        let dimCond = sql``;
        if (dim && valor != null) {
          const col =
            dim === "produto"
              ? sql`p.product`
              : dim === "banco"
                ? sql`p.bank`
                : sql`p.client_convenio`;
          dimCond =
            valor === "Não informado"
              ? sql`AND (${col} IS NULL OR ${col} = '')`
              : sql`AND ${col} = ${valor}`;
        }

        const orderCol = metrica === "pago" ? sql`p.paid_at` : sql`p.created_at`;
        const r = await db.execute(sql`
          SELECT p.id, p.client_name, p.client_cpf, u.name AS corretor,
                 p.bank, p.product, p.client_convenio, p.contract_value, p.status,
                 to_char(p.created_at, 'YYYY-MM-DD') AS criado_em,
                 to_char(p.paid_at, 'YYYY-MM-DD') AS pago_em
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

  // ── Opções pros filtros (bancos/convênios/corretores/parceiros do tenant) ──
  app.get(
    "/api/gestao-comercial/dashboard/opcoes",
    requireAuthLocal,
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
