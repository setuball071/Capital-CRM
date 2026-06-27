import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
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

const fmtDias = (v: number | null) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;

type Formato = "moeda" | "num" | "pct";
function fmtVal(v: number, f: Formato) {
  if (f === "moeda") return fmtMoeda(v);
  if (f === "pct") return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return (Number(v) || 0).toLocaleString("pt-BR");
}

function MiniBar({ titulo, dados, formato, vazio }: { titulo: string; dados: { nome: string; valor: number }[]; formato: Formato; vazio?: string }) {
  return (
    <Card data-testid={`port-${titulo}`}>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{titulo}</CardTitle></CardHeader>
      <CardContent>
        {dados.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">{vazio || "Sem dados no período"}</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, dados.length * 38)}>
            <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide tickFormatter={(v) => fmtVal(v, formato)} />
              <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => fmtVal(Number(v), formato)} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, formatter: (v: any) => fmtVal(Number(v), formato) }}>
                {dados.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Bar>
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
  const origemReal = (data?.bancoOrigem || []).filter((b) => b.chave !== "Não informado");

  return (
    <div className="space-y-4" data-testid="tab-portabilidades">
      <DashboardFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">Sem dados.</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            Base: propostas de <strong>Portabilidade</strong> criadas no período. "Saldo quitado" conta como concluído/pago.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Portabilidades" valor={k!.valor} formato="moeda" sub={`${k!.total} no total`} />
            <KpiCard titulo="Concluídas" valor={k!.pagas} formato="numero" sub={fmtMoeda(k!.valorPagas)} />
            <KpiCard titulo="Efetividade" valor={k!.efetividade} formato="percent" />
            <KpiCard titulo="Em andamento" valor={k!.emAndamento} formato="numero" sub={`${k!.canceladas} canceladas/perdidas`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Saldo informado" valor={k!.saldoInformado} formato="moeda" />
            <KpiCard titulo="Saldo pago (quitado)" valor={k!.saldoPago} formato="moeda" />
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tempo até conclusão</div><div className="text-2xl font-semibold mt-1">{fmtDias(k!.diasAtePago)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tempo CIP → saldo</div><div className="text-2xl font-semibold mt-1">{fmtDias(k!.diasCipSaldo)}</div></CardContent></Card>
          </div>

          <MiniBar titulo="Funil por status (qtd)" formato="num" dados={data.funil.map((f) => ({ nome: f.label, valor: f.qtd }))} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MiniBar titulo="Por banco destino (R$)" formato="moeda" dados={data.bancoDestino.map((b) => ({ nome: b.chave, valor: b.valor }))} />
            <MiniBar titulo="Efetividade por banco destino" formato="pct" dados={data.bancoDestino.map((b) => ({ nome: b.chave, valor: b.efetividade || 0 }))} />
          </div>

          <MiniBar
            titulo="Por banco de origem (R$)"
            formato="moeda"
            dados={origemReal.map((b) => ({ nome: b.chave, valor: b.valor }))}
            vazio="Sem banco de origem preenchido ainda — popula conforme o operacional informar na ficha."
          />
        </>
      )}
    </div>
  );
}
