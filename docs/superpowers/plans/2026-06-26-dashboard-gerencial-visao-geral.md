# Dashboard Gerencial — Base + Aba 1 (Visão Geral) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a tela vazia "Dashboard da Empresa" (Gestão Comercial) num dashboard gerencial só-Master, com a Aba 1 (Visão Geral) completa e a base reutilizável (filtros globais + drill-down) que as próximas abas vão aproveitar.

**Architecture:** Backend Express com 2 endpoints agregadores sobre `proposals` (visão-geral + drill), protegidos por `requireMaster`, sempre filtrados por `tenantId`. Frontend React: a página vira um container de abas; a Aba 1 consome os endpoints via React Query e renderiza KPIs (Recharts) com drill-down. Abas 2–7 ficam como placeholders.

**Tech Stack:** React 18 + TypeScript + Vite + Wouter, Express + Drizzle ORM (Postgres/Supabase), React Query, shadcn/ui, Recharts.

## Global Constraints

- **Fonte de dados:** SEMPRE tabela `proposals` (NÃO `producoes_contratos`).
- **Produção paga:** `status = 'PAGO'`, contabilizada por `paidAt`. **Cadastro:** todas as propostas por `createdAt`. **Conversão %** = qtd pagas (por paidAt no período) ÷ qtd cadastradas (por createdAt no período).
- **Acesso:** só-Master. API protegida por `requireMaster` (`req.user.isMaster`). Rota do front restrita a `["master"]`.
- **Multi-tenant:** toda query filtra por `req.tenantId`.
- **Sem runner de teste no projeto** (não há vitest/jest configurado). Verificação de cada task = `npm run check` (tsc) + `npm run build` quando tocar no front + **conferência manual contra SQL** + smoke no navegador. NÃO adicionar runner de teste (fora de escopo).
- **NÃO fazer deploy/push enquanto a importação do Fábio estiver rodando.** Trabalhar na branch `feat/dashboard-gerencial`. Deploy = push pra `migracao-cloudfy` só com o Fábio ciente.
- **Enums:** status ∈ {CADASTRADA, EM_ANALISE, DIGITADA, EM_ANDAMENTO, PENDENTE_CORRETOR, PENDENTE_BANCO, PAGO, CANCELADA}; product ∈ {NOVO, PORTABILIDADE, REFINANCIAMENTO, CARTAO}.
- **Colunas `proposals`** (`shared/schema.ts` ~3459): `id, tenantId, clientName, clientCpf, clientConvenio, bank, product, contractValue (decimal), status, vendorId (FK users), parceiroId, createdAt, paidAt`.

---

## File Structure

**Backend (novo arquivo, pra não inchar `routes.ts` que já é gigante):**
- Create `server/dashboard-gerencial.ts` — funções de filtro + agregação + drill; `registerDashboardGerencialRoutes(app)`.
- Modify `server/routes.ts` — importar e chamar `registerDashboardGerencialRoutes(app)` (1 linha).

**Frontend:**
- Create `client/src/components/dashboard-gerencial/types.ts` — tipos de filtro e resposta (compartilhados front).
- Create `client/src/components/dashboard-gerencial/useDashboardFilters.ts` — estado dos filtros + sync com URL.
- Create `client/src/components/dashboard-gerencial/DashboardFilters.tsx` — barra de filtros.
- Create `client/src/components/dashboard-gerencial/KpiCard.tsx` — card de KPI com comparativo.
- Create `client/src/components/dashboard-gerencial/DrillChart.tsx` — wrapper Recharts clicável.
- Create `client/src/components/dashboard-gerencial/DrillDownPanel.tsx` — painel/modal de detalhe + export CSV.
- Create `client/src/components/dashboard-gerencial/tabs/VisaoGeralTab.tsx` — a Aba 1.
- Modify `client/src/pages/gestao-comercial-dashboard.tsx` — container de abas (Aba 1 + placeholders 2–7).
- Modify `client/src/App.tsx:560` — restringir `allowedRoles` a `["master"]`.

---

## Task 1: Backend — endpoint agregador `visao-geral`

**Files:**
- Create: `server/dashboard-gerencial.ts`
- Modify: `server/routes.ts` (registrar a rota)

**Interfaces:**
- Produces: `registerDashboardGerencialRoutes(app: Express): void`
- Produces (HTTP): `GET /api/gestao-comercial/dashboard/visao-geral` → JSON:
  ```ts
  {
    filtrosAplicados: {...},
    kpis: {
      pagoValor: number, pagoQtd: number, ticketMedio: number,
      cadastradoValor: number, cadastradoQtd: number, conversao: number, // 0..1
    },
    comparativo: { pagoValor:number, pagoQtd:number, ticketMedio:number, cadastradoValor:number, cadastradoQtd:number, conversao:number },
    serie: Array<{ periodo: string, pagoValor:number, pagoQtd:number, cadastradoValor:number, cadastradoQtd:number }>,
    quebras: {
      produto: Array<{ chave:string, valor:number, qtd:number }>,
      banco:   Array<{ chave:string, valor:number, qtd:number }>,
      convenio:Array<{ chave:string, valor:number, qtd:number }>,
    }
  }
  ```
- Query params: `inicio` (YYYY-MM-DD), `fim` (YYYY-MM-DD), `gran` (dia|semana|mes), `banco`, `produto`, `convenio`, `corretor` (vendorId), `parceiro` (parceiroId). Multi-valor via vírgula.

- [ ] **Step 1: Criar o arquivo com o helper de filtros e o registro da rota (esqueleto)**

Create `server/dashboard-gerencial.ts`:

```ts
import type { Express, Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "./storage";

// requireMaster vive em routes.ts; replicamos o check aqui pra não exportar/circular.
function requireMaster(req: any, res: Response, next: NextFunction) {
  if (!req.user?.isMaster) {
    return res.status(403).json({ message: "Acesso negado - apenas administradores master" });
  }
  next();
}
function requireAuthLocal(req: any, res: Response, next: NextFunction) {
  const userId = req.user?.id || req.session?.userId;
  const tenantId = req.tenantId || req.session?.tenantId;
  if (!userId || !tenantId) return res.status(401).json({ message: "Não autorizado" });
  next();
}

// Lê multi-valores "a,b,c" -> ["a","b","c"] (trim, sem vazios)
function parseList(v: any): string[] {
  if (!v) return [];
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}

// Monta os filtros comuns (banco/produto/convenio/corretor/parceiro) como SQL.
// Retorna um fragmento que começa com " AND ..." (ou vazio). tenantId é obrigatório e tratado fora.
function buildFiltrosSql(q: any) {
  const frags: any[] = [];
  const banco = parseList(q.banco);
  const produto = parseList(q.produto);
  const convenio = parseList(q.convenio);
  const corretor = parseList(q.corretor).map((n) => parseInt(n)).filter((n) => !isNaN(n));
  const parceiro = parseList(q.parceiro).map((n) => parseInt(n)).filter((n) => !isNaN(n));
  if (banco.length)    frags.push(sql`AND p.bank = ANY(${banco})`);
  if (produto.length)  frags.push(sql`AND p.product = ANY(${produto})`);
  if (convenio.length) frags.push(sql`AND p.client_convenio = ANY(${convenio})`);
  if (corretor.length) frags.push(sql`AND p.vendor_id = ANY(${corretor})`);
  if (parceiro.length) frags.push(sql`AND p.parceiro_id = ANY(${parceiro})`);
  return frags.length ? sql.join(frags, sql` `) : sql``;
}

export function registerDashboardGerencialRoutes(app: Express) {
  app.get(
    "/api/gestao-comercial/dashboard/visao-geral",
    requireAuthLocal,
    requireMaster,
    async (req: any, res: Response) => {
      // implementado no Step 3
      res.json({ ok: true });
    },
  );
}
```

- [ ] **Step 2: Registrar no routes.ts**

Modify `server/routes.ts` — perto do topo, junto aos outros imports de módulos de rotas, adicionar:
```ts
import { registerDashboardGerencialRoutes } from "./dashboard-gerencial";
```
E dentro da função que registra as rotas (onde os outros `app.get(...)` são definidos), adicionar uma linha:
```ts
registerDashboardGerencialRoutes(app);
```

- [ ] **Step 3: Implementar o handler agregador**

Substituir o corpo do handler do Step 1 por:

```ts
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

async function kpis(ini: string, f: string) {
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
    pagoValor, pagoQtd,
    ticketMedio: pagoQtd ? pagoValor / pagoQtd : 0,
    cadastradoValor: cadValor, cadastradoQtd: cadQtd,
    conversao: cadQtd ? pagoQtd / cadQtd : 0,
  };
}

const [atual, anterior] = await Promise.all([
  kpis(inicioStr, fimStr),
  kpis(prevInicioStr, prevFimStr),
]);

// série temporal (paga por paid_at e cadastro por created_at, unidos por período)
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

// quebras de produção PAGA (top 8 + restante agrupado feito no front)
async function quebra(col: any) {
  const r = await db.execute(sql`
    SELECT COALESCE(NULLIF(${col}, ''), 'Não informado') AS chave,
           SUM(p.contract_value) AS valor, COUNT(*) AS qtd
    FROM proposals p
    WHERE p.tenant_id = ${tenantId} AND p.status = 'PAGO'
      AND p.paid_at::date BETWEEN ${inicioStr} AND ${fimStr} ${filtros}
    GROUP BY 1 ORDER BY valor DESC LIMIT 12
  `);
  return r.rows.map((x: any) => ({ chave: x.chave, valor: Number(x.valor) || 0, qtd: Number(x.qtd) || 0 }));
}
const [produto, banco, convenio] = await Promise.all([
  quebra(sql`p.product`), quebra(sql`p.bank`), quebra(sql`p.client_convenio`),
]);

return res.json({
  filtrosAplicados: { inicio: inicioStr, fim: fimStr, gran },
  kpis: atual, comparativo: anterior, serie,
  quebras: { produto, banco, convenio },
});
```

Envolver tudo em `try/catch` retornando `500 { message: "Erro ao carregar dashboard" }` e `console.error`.

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: sem novos erros em `server/dashboard-gerencial.ts` (o projeto tem ~baseline de erros pré-existentes; conferir que nenhum novo veio do arquivo criado).

- [ ] **Step 5: Conferência manual contra SQL (sem subir o app)**

No SQL Editor do Supabase (projeto capital-crm), rodar pra um período conhecido e comparar com o que o endpoint retornaria:
```sql
SELECT
  COALESCE(SUM(CASE WHEN status='PAGO' AND paid_at::date BETWEEN '2026-06-01' AND '2026-06-30' THEN contract_value END),0) pago,
  COUNT(*) FILTER (WHERE status='PAGO' AND paid_at::date BETWEEN '2026-06-01' AND '2026-06-30') pago_qtd,
  COUNT(*) FILTER (WHERE created_at::date BETWEEN '2026-06-01' AND '2026-06-30') cad_qtd
FROM proposals WHERE tenant_id = 4;
```
Expected: os números batem com os KPIs do endpoint (testável via `curl` autenticado quando o app estiver rodando localmente, ou na conferência pós-deploy).

- [ ] **Step 6: Commit**

```bash
git add server/dashboard-gerencial.ts server/routes.ts
git commit -m "feat(dashboard-gerencial): endpoint agregador visao-geral (so-Master)"
```

---

## Task 2: Backend — endpoint `drill` (lista detalhada)

**Files:**
- Modify: `server/dashboard-gerencial.ts`

**Interfaces:**
- Produces (HTTP): `GET /api/gestao-comercial/dashboard/visao-geral/drill` → `{ itens: Array<{ id:number, cliente:string, cpf:string, corretor:string|null, banco:string|null, produto:string|null, convenio:string|null, valor:number, status:string, criadoEm:string, pagoEm:string|null }> }`
- Query params: os mesmos filtros + `metrica` (pago|cadastro) + `dim` (produto|banco|convenio) opcional + `valor` (valor da dimensão clicada) opcional.

- [ ] **Step 1: Adicionar a rota drill no registerDashboardGerencialRoutes**

```ts
app.get(
  "/api/gestao-comercial/dashboard/visao-geral/drill",
  requireAuthLocal, requireMaster,
  async (req: any, res: Response) => {
    try {
      const tenantId = req.tenantId || req.session?.tenantId;
      const hoje = new Date();
      const fimStr = (req.query.fim as string) || hoje.toISOString().slice(0,10);
      const inicioStr = (req.query.inicio as string) || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
      const filtros = buildFiltrosSql(req.query);
      const metrica = req.query.metrica === "cadastro" ? "cadastro" : "pago";
      const dim = ["produto","banco","convenio"].includes(req.query.dim) ? req.query.dim : null;
      const valor = req.query.valor != null ? String(req.query.valor) : null;

      const dataCond = metrica === "pago"
        ? sql`p.status = 'PAGO' AND p.paid_at::date BETWEEN ${inicioStr} AND ${fimStr}`
        : sql`p.created_at::date BETWEEN ${inicioStr} AND ${fimStr}`;

      let dimCond = sql``;
      if (dim && valor != null) {
        const col = dim === "produto" ? sql`p.product` : dim === "banco" ? sql`p.bank` : sql`p.client_convenio`;
        dimCond = valor === "Não informado"
          ? sql`AND (${col} IS NULL OR ${col} = '')`
          : sql`AND ${col} = ${valor}`;
      }

      const r = await db.execute(sql`
        SELECT p.id, p.client_name, p.client_cpf, u.name AS corretor,
               p.bank, p.product, p.client_convenio, p.contract_value, p.status,
               to_char(p.created_at, 'YYYY-MM-DD') AS criado_em,
               to_char(p.paid_at, 'YYYY-MM-DD') AS pago_em
        FROM proposals p
        LEFT JOIN users u ON u.id = p.vendor_id
        WHERE p.tenant_id = ${tenantId} AND ${dataCond} ${filtros} ${dimCond}
        ORDER BY ${metrica === "pago" ? sql`p.paid_at` : sql`p.created_at`} DESC
        LIMIT 1000
      `);
      const itens = r.rows.map((x: any) => ({
        id: x.id, cliente: x.client_name, cpf: x.client_cpf, corretor: x.corretor,
        banco: x.bank, produto: x.product, convenio: x.client_convenio,
        valor: Number(x.contract_value) || 0, status: x.status,
        criadoEm: x.criado_em, pagoEm: x.pago_em,
      }));
      return res.json({ itens });
    } catch (e: any) {
      console.error("drill visao-geral error:", e);
      return res.status(500).json({ message: "Erro ao carregar detalhe" });
    }
  },
);
```

- [ ] **Step 2: Typecheck**

Run: `npm run check` — sem novos erros no arquivo.

- [ ] **Step 3: Commit**

```bash
git add server/dashboard-gerencial.ts
git commit -m "feat(dashboard-gerencial): endpoint drill da visao-geral"
```

---

## Task 3: Frontend — tipos, hook de filtros e barra de filtros

**Files:**
- Create: `client/src/components/dashboard-gerencial/types.ts`
- Create: `client/src/components/dashboard-gerencial/useDashboardFilters.ts`
- Create: `client/src/components/dashboard-gerencial/DashboardFilters.tsx`

**Interfaces:**
- Produces: `type DashFiltros = { inicio: string; fim: string; gran: "dia"|"semana"|"mes"; banco: string[]; produto: string[]; convenio: string[]; corretor: number[]; parceiro: number[] }`
- Produces: `useDashboardFilters(): { filtros: DashFiltros; setFiltros: (f: Partial<DashFiltros>) => void; queryString: string }`
- Produces: `<DashboardFilters filtros opcoes onChange />` onde `opcoes = { bancos:string[]; produtos:string[]; convenios:string[]; corretores:{id:number;nome:string}[]; parceiros:{id:number;nome:string}[] }`

- [ ] **Step 1: Criar `types.ts`**

```ts
export type Gran = "dia" | "semana" | "mes";
export interface DashFiltros {
  inicio: string; fim: string; gran: Gran;
  banco: string[]; produto: string[]; convenio: string[];
  corretor: number[]; parceiro: number[];
}
export interface KpiBloco {
  pagoValor: number; pagoQtd: number; ticketMedio: number;
  cadastradoValor: number; cadastradoQtd: number; conversao: number;
}
export interface SeriePonto { periodo: string; pagoValor: number; pagoQtd: number; cadastradoValor: number; cadastradoQtd: number; }
export interface QuebraItem { chave: string; valor: number; qtd: number; }
export interface VisaoGeralResp {
  filtrosAplicados: { inicio: string; fim: string; gran: Gran };
  kpis: KpiBloco; comparativo: KpiBloco; serie: SeriePonto[];
  quebras: { produto: QuebraItem[]; banco: QuebraItem[]; convenio: QuebraItem[] };
}
export interface DrillItem {
  id: number; cliente: string; cpf: string; corretor: string | null;
  banco: string | null; produto: string | null; convenio: string | null;
  valor: number; status: string; criadoEm: string; pagoEm: string | null;
}
```

- [ ] **Step 2: Criar `useDashboardFilters.ts` (estado + URL)**

```ts
import { useCallback, useMemo, useState } from "react";
import type { DashFiltros, Gran } from "./types";

function defaultFiltros(): DashFiltros {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { inicio: fmt(inicio), fim: fmt(hoje), gran: "dia",
    banco: [], produto: [], convenio: [], corretor: [], parceiro: [] };
}

export function useDashboardFilters() {
  const [filtros, setState] = useState<DashFiltros>(() => {
    const p = new URLSearchParams(window.location.search);
    const base = defaultFiltros();
    return {
      inicio: p.get("inicio") || base.inicio,
      fim: p.get("fim") || base.fim,
      gran: (p.get("gran") as Gran) || base.gran,
      banco: p.get("banco")?.split(",").filter(Boolean) || [],
      produto: p.get("produto")?.split(",").filter(Boolean) || [],
      convenio: p.get("convenio")?.split(",").filter(Boolean) || [],
      corretor: (p.get("corretor")?.split(",").filter(Boolean) || []).map(Number),
      parceiro: (p.get("parceiro")?.split(",").filter(Boolean) || []).map(Number),
    };
  });

  const setFiltros = useCallback((patch: Partial<DashFiltros>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      const p = new URLSearchParams();
      p.set("inicio", next.inicio); p.set("fim", next.fim); p.set("gran", next.gran);
      if (next.banco.length) p.set("banco", next.banco.join(","));
      if (next.produto.length) p.set("produto", next.produto.join(","));
      if (next.convenio.length) p.set("convenio", next.convenio.join(","));
      if (next.corretor.length) p.set("corretor", next.corretor.join(","));
      if (next.parceiro.length) p.set("parceiro", next.parceiro.join(","));
      window.history.replaceState(null, "", `?${p.toString()}`);
      return next;
    });
  }, []);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("inicio", filtros.inicio); p.set("fim", filtros.fim); p.set("gran", filtros.gran);
    if (filtros.banco.length) p.set("banco", filtros.banco.join(","));
    if (filtros.produto.length) p.set("produto", filtros.produto.join(","));
    if (filtros.convenio.length) p.set("convenio", filtros.convenio.join(","));
    if (filtros.corretor.length) p.set("corretor", filtros.corretor.join(","));
    if (filtros.parceiro.length) p.set("parceiro", filtros.parceiro.join(","));
    return p.toString();
  }, [filtros]);

  return { filtros, setFiltros, queryString };
}
```

- [ ] **Step 3: Criar `DashboardFilters.tsx`**

Barra com: inputs de data (`inicio`, `fim`), presets (mês atual / mês anterior / últimos 30d / últimos 90d), toggle de granularidade (dia/semana/mês), e multi-selects para banco/produto/convênio/corretor/parceiro usando os componentes shadcn já existentes (`@/components/ui/select` ou um popover de checkboxes). Cada mudança chama `onChange(patch)`. Usar `data-testid` em cada controle. (Implementar com os componentes de UI já presentes no projeto; produto vem do enum fixo {NOVO, PORTABILIDADE, REFINANCIAMENTO, CARTAO}; banco/convênio/corretor/parceiro vêm de `opcoes`.)

- [ ] **Step 4: Typecheck + build**

Run: `npm run check` e `npm run build`
Expected: build conclui; sem novos erros de tipo nos arquivos criados.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/dashboard-gerencial/types.ts client/src/components/dashboard-gerencial/useDashboardFilters.ts client/src/components/dashboard-gerencial/DashboardFilters.tsx
git commit -m "feat(dashboard-gerencial): tipos, hook de filtros e barra de filtros"
```

---

## Task 4: Frontend — KpiCard, DrillChart e DrillDownPanel

**Files:**
- Create: `client/src/components/dashboard-gerencial/KpiCard.tsx`
- Create: `client/src/components/dashboard-gerencial/DrillChart.tsx`
- Create: `client/src/components/dashboard-gerencial/DrillDownPanel.tsx`

**Interfaces:**
- Produces: `<KpiCard titulo valor formato="moeda"|"numero"|"percent" anterior? onClick? />`
- Produces: `<DrillChart tipo="barra"|"pizza" dados={QuebraItem[]} onSlice={(chave:string)=>void} />`
- Produces: `<DrillDownPanel aberto titulo queryString dim? valor? metrica onClose />` (busca `/drill` e lista + export CSV)

- [ ] **Step 1: `KpiCard.tsx`** — card com título, valor formatado (helper de moeda BR `R$`, número, e percent), e seta ▲▼ com a variação vs `anterior` (verde/vermelho). Apresentacional. `data-testid={`kpi-${titulo}`}`.

- [ ] **Step 2: `DrillChart.tsx`** — wrapper Recharts (`ResponsiveContainer` + `BarChart`/`PieChart`), recebe `dados` (QuebraItem[]) e dispara `onSlice(chave)` no clique de barra/fatia. Imports: `import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";`

- [ ] **Step 3: `DrillDownPanel.tsx`** — `Dialog` (shadcn) que, quando `aberto`, faz `useQuery` em `/api/gestao-comercial/dashboard/visao-geral/drill?${queryString}&metrica=${metrica}${dim?`&dim=${dim}&valor=${encodeURIComponent(valor)}`:""}` e mostra tabela com colunas (cliente, corretor, banco, produto, convênio, valor, status, datas). Botão **Exportar CSV** (formato BR `;` + BOM, mesmo padrão do simulador). `data-testid="drilldown-panel"`.

- [ ] **Step 4: Typecheck + build**

Run: `npm run check` e `npm run build` — sem novos erros.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/dashboard-gerencial/KpiCard.tsx client/src/components/dashboard-gerencial/DrillChart.tsx client/src/components/dashboard-gerencial/DrillDownPanel.tsx
git commit -m "feat(dashboard-gerencial): KpiCard, DrillChart e DrillDownPanel"
```

---

## Task 5: Frontend — Aba 1 (VisaoGeralTab) ligando tudo

**Files:**
- Create: `client/src/components/dashboard-gerencial/tabs/VisaoGeralTab.tsx`

**Interfaces:**
- Consumes: `useDashboardFilters`, `DashboardFilters`, `KpiCard`, `DrillChart`, `DrillDownPanel`, tipos de `types.ts`.
- Produces: `export default function VisaoGeralTab()`

- [ ] **Step 1: Implementar a aba**

Estrutura:
```tsx
// 1. const { filtros, setFiltros, queryString } = useDashboardFilters();
// 2. useQuery<VisaoGeralResp>(["/api/gestao-comercial/dashboard/visao-geral", queryString], fetch da URL com credentials)
// 3. Carregar opções de filtro (bancos/convenios/corretores/parceiros) — endpoint simples ou derivar do retorno; v1: derivar bancos/convenios das quebras + buscar corretores/parceiros de /api/users e /api/partners se já existirem.
// 4. Render:
//    <DashboardFilters .../>
//    Linha de <KpiCard> (pagoValor moeda + comparativo, ticketMedio, cadastrado, conversao percent)
//    <DrillChart tipo="barra" dados={serie convertida}/> para evolução (eixo X = periodo)
//    3x <DrillChart tipo="pizza"/barra> para quebras produto/banco/convenio, cada onSlice abre <DrillDownPanel dim=... valor=...>
//    Estado para o DrillDownPanel (aberto, dim, valor, metrica)
// 5. Estados de loading e vazio ("Sem produção no período").
```
Incluir `data-testid="tab-visao-geral"`.

- [ ] **Step 2: Typecheck + build**

Run: `npm run check` e `npm run build` — sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/dashboard-gerencial/tabs/VisaoGeralTab.tsx
git commit -m "feat(dashboard-gerencial): Aba 1 Visao Geral (KPIs, evolucao, quebras, drill)"
```

---

## Task 6: Frontend — container de abas + restrição de rota

**Files:**
- Modify: `client/src/pages/gestao-comercial-dashboard.tsx`
- Modify: `client/src/App.tsx:560`

- [ ] **Step 1: Transformar a página em container de abas**

Substituir o conteúdo de `gestao-comercial-dashboard.tsx` por um `Tabs` (shadcn `@/components/ui/tabs`) com 7 abas:
```tsx
// Aba "Visão Geral" -> <VisaoGeralTab/>
// Abas "Performance Comercial", "Portabilidades", "Perfil dos Clientes",
//   "Gestão Operacional", "Inteligência Comercial", "DNA do Corretor"
//   -> placeholder <div>Em desenvolvimento</div> (data-testid por aba)
```
Manter o cabeçalho "Dashboard da Empresa".

- [ ] **Step 2: Restringir rota a Master**

Modify `client/src/App.tsx:560` — trocar `allowedRoles={["master", "coordenacao"]}` por `allowedRoles={["master"]}` (exclusivo Master, conforme o pedido). Comentar que coordenação pode ser reativada depois.

- [ ] **Step 3: Typecheck + build**

Run: `npm run check` e `npm run build` — build conclui sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/gestao-comercial-dashboard.tsx client/src/App.tsx
git commit -m "feat(dashboard-gerencial): container de abas + rota so-Master"
```

---

## Task 7: Verificação ponta-a-ponta (sem deploy)

**Files:** nenhum (verificação).

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build do client e bundle do server concluem sem erro (warning pré-existente de `storageKey` duplicado é aceitável).

- [ ] **Step 2: Smoke local (se possível rodar local) OU checklist pós-deploy**

Com o app rodando (local com `npm run dev`, ou após o deploy quando autorizado):
- Logar como Master → abrir `/vendas/gestao-comercial/dashboard` → ver as 7 abas, Aba 1 com dados.
- Conferir KPIs contra a query SQL do Task 1 Step 5 (mesmo período).
- Clicar numa fatia de "Produção por Banco" → DrillDownPanel abre com as propostas daquele banco; somatório das linhas = valor da fatia.
- Logar como não-Master → a aba/rota não aparece (ou 403 no endpoint).

- [ ] **Step 3: NÃO fazer push enquanto a importação do Fábio estiver rodando.** Quando autorizado:

```bash
git checkout migracao-cloudfy
git merge --no-ff feat/dashboard-gerencial -m "feat: dashboard gerencial base + Aba 1 Visao Geral"
git push origin migracao-cloudfy   # Railway publica (reinicia o app — confirmar com Fábio antes)
```

---

## Self-Review (cobertura do spec)

- Acesso só-Master → Task 1/2 (requireMaster) + Task 6 (rota). ✓
- Filtros globais (período/banco/produto/convênio/corretor/parceiro) → Task 1 (buildFiltrosSql) + Task 3 (UI). Operador/subconvênio/estado deferidos (consta no spec §9). ✓
- Drill-down → Task 2 (endpoint) + Task 4 (DrillDownPanel) + Task 5 (ligação). ✓
- KPIs pago/cadastrado/ticket/conversão + comparativo → Task 1 (kpis()) + Task 5 (cards). ✓
- Evolução temporal (dia/semana/mês) → Task 1 (série) + Task 5 (gráfico + toggle no Task 3). ✓
- Quebras produto/banco/convênio → Task 1 (quebra()) + Task 5. ✓
- Abas 2–7 placeholders → Task 6. ✓
- Multi-tenant → todas as queries com `tenant_id`. ✓
- Verificação (sem runner) → typecheck + build + SQL cross-check + smoke (Task 7). ✓

Sem placeholders de implementação (código real nas tasks de backend; componentes de front descritos com interface + estrutura concreta — implementador segue os padrões citados do projeto).
