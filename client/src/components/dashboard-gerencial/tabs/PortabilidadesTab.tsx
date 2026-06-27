import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardFilters } from "../useDashboardFilters";
import { DashboardFilters } from "../DashboardFilters";
import { KpiCard } from "../KpiCard";
import { fmtMoeda } from "../fmt";
import type { PortabilidadesResp, DashOpcoes } from "../types";

const CORES = ["#7C3AED", "#EC4899", "#2563EB", "#059669", "#D97706", "#DC2626", "#0891B2", "#9333EA", "#65A30D", "#E11D48", "#0D9488", "#7E22CE"];

// cores dos status (contract_statuses.color = nome do tailwind) -> hex
const COR_STATUS: Record<string, string> = {
  zinc: "#71717a", slate: "#64748b", gray: "#6b7280", neutral: "#737373", stone: "#78716c",
  red: "#dc2626", rose: "#e11d48", orange: "#ea580c", amber: "#d97706", yellow: "#ca8a04",
  lime: "#65a30d", green: "#16a34a", emerald: "#059669", teal: "#0d9488", cyan: "#0891b2",
  sky: "#0284c7", blue: "#2563eb", indigo: "#4f46e5", violet: "#7c3aed", purple: "#9333ea",
  fuchsia: "#c026d3", pink: "#db2777",
};

const fmtDias = (v: number | null) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;

type Formato = "moeda" | "num" | "pct";
function fmtVal(v: number, f: Formato) {
  if (f === "moeda") return fmtMoeda(v);
  if (f === "pct") return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return (Number(v) || 0).toLocaleString("pt-BR");
}

interface ChartItem { nome: string; valor: number; cor?: string }

function Grafico({
  titulo, subtitulo, dados, formato, tipo = "bar", nomeSerie = "Valor",
}: {
  titulo: string; subtitulo?: string; dados: ChartItem[]; formato: Formato;
  tipo?: "bar" | "pie"; nomeSerie?: string;
}) {
  const corDe = (d: ChartItem, i: number) => d.cor || CORES[i % CORES.length];
  return (
    <Card data-testid={`port-${titulo}`}>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">{titulo}</CardTitle>
        {subtitulo && <div className="text-xs text-muted-foreground">{subtitulo}</div>}
      </CardHeader>
      <CardContent>
        {dados.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Sem dados no período</div>
        ) : tipo === "pie" ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip formatter={(v: any) => fmtVal(Number(v), formato)} />
              <Legend />
              <Pie data={dados} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={95} label={(e: any) => fmtVal(Number(e.valor), formato)}>
                {dados.map((d, i) => <Cell key={i} fill={corDe(d, i)} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 34)}>
            <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 56 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [fmtVal(Number(v), formato), nomeSerie]} />
              <Bar dataKey="valor" name={nomeSerie} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, formatter: (v: any) => fmtVal(Number(v), formato) }}>
                {dados.map((d, i) => <Cell key={i} fill={corDe(d, i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function fmtCompact(v: number) {
  const n = Number(v) || 0;
  if (n >= 1e6) return `R$ ${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return fmtMoeda(n);
}
const pctTip = (v: any) => `${(Number(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function StackedOrigem({ dados }: { dados: { chave: string; valor: number; valorPago: number; valorCancelado: number; valorAndamento: number }[] }) {
  const data = dados.map((b) => ({
    nome: b.chave,
    pago: b.valorPago, cancelado: b.valorCancelado, andamento: b.valorAndamento,
  }));
  return (
    <Card data-testid="port-origem-dificuldade">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">Dificuldade por banco de origem (R$)</CardTitle>
        <div className="text-xs text-muted-foreground">
          Tamanho da barra = cadastrado. Verde = pago · vermelho = cancelado · cinza = em andamento. Mais vermelho/longo = mais difícil.
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            Sem banco de origem preenchido — popula conforme o operacional informar na ficha.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => fmtCompact(Number(v))} />
              <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any, n: any) => [fmtMoeda(Number(v)), n]} />
              <Legend />
              <Bar dataKey="pago" name="Pago" stackId="a" fill="#16a34a" />
              <Bar dataKey="cancelado" name="Cancelado" stackId="a" fill="#dc2626" />
              <Bar dataKey="andamento" name="Em andamento" stackId="a" fill="#d1d5db" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function PortabilidadesTab() {
  const { filtros, setFiltros, queryString } = useDashboardFilters();

  const { data: opcoes } = useQuery<DashOpcoes>({
    queryKey: ["/api/gestao-comercial/dashboard/opcoes"],
    queryFn: async () => {
      const r = await fetch("/api/gestao-comercial/dashboard/opcoes", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar opções");
      return r.json();
    },
  });

  const url = `/api/gestao-comercial/dashboard/portabilidades?${queryString}`;
  const { data, isLoading } = useQuery<PortabilidadesResp>({
    queryKey: [url],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar portabilidades");
      return r.json();
    },
  });

  const k = data?.kpis;
  const origemReal = (data?.bancoOrigem || []).filter((b) => b.chave !== "NÃO INFORMADO" && b.chave !== "Não informado");
  // efetividade por banco destino, ordenada desc
  const efet = (data?.bancoDestino || []).slice().sort((a, b) => (b.efetividade || 0) - (a.efetividade || 0));

  return (
    <div className="space-y-4" data-testid="tab-portabilidades">
      <DashboardFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">Sem dados.</div>
      ) : (
        <>
          {/* Produção oficial (financeiro — inclui importados) */}
          <div className="text-sm font-semibold">
            Produção de Portabilidade <span className="text-muted-foreground font-normal">· financeiro (inclui importados — bate com o ranking)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Cadastrado" valor={k!.valor} formato="moeda" sub={`${k!.total} propostas`} />
            <KpiCard titulo="Produção paga" valor={data.producao.valor} formato="moeda" sub={`${data.producao.qtd} contratos`} />
            <KpiCard titulo="Efetividade (cad.→produção)" valor={k!.valor ? data.producao.valor / k!.valor : 0} formato="percent" />
            <KpiCard titulo="Em andamento" valor={k!.emAndamento} formato="numero" sub={`${k!.canceladas} canceladas/perdidas`} />
          </div>
          <Grafico
            titulo="Bancos com mais produção paga (efetividade)"
            subtitulo="quem efetivamente pagou/quitou — financeiro, inclui importados (R$)"
            tipo="pie"
            formato="moeda"
            dados={data.bancoProducao.map((b) => ({ nome: b.chave, valor: b.valor }))}
          />

          {/* Funil / processo do CRM */}
          <div className="text-sm font-semibold pt-2">
            Funil do CRM (processo) <span className="text-muted-foreground font-normal">· propostas — etapas CIP/saldo, banco de origem; "Saldo quitado" = concluído</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Saldo informado" valor={k!.saldoInformado} formato="moeda" />
            <KpiCard titulo="Saldo pago (quitado)" valor={k!.saldoPago} formato="moeda" />
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tempo até conclusão</div><div className="text-2xl font-semibold mt-1">{fmtDias(k!.diasAtePago)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tempo CIP → saldo</div><div className="text-2xl font-semibold mt-1">{fmtDias(k!.diasCipSaldo)}</div></CardContent></Card>
          </div>

          <Grafico
            titulo="Funil por status (R$)"
            formato="moeda"
            nomeSerie="Valor"
            dados={data.funil.map((f) => ({ nome: f.label, valor: f.valor, cor: COR_STATUS[f.color] || "#71717a" }))}
          />

          <Grafico titulo="Efetividade por banco destino (CRM)" formato="pct" nomeSerie="Efetividade" dados={efet.map((b) => ({ nome: b.chave, valor: b.efetividade || 0 }))} />

          <StackedOrigem dados={origemReal} />
        </>
      )}
    </div>
  );
}
