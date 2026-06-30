import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
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
import { DrillChart } from "../DrillChart";
import { DrillDownPanel } from "../DrillDownPanel";
import { fmtMoeda } from "../fmt";
import type { VisaoGeralResp, DashOpcoes, DrillDim, DrillMetrica } from "../types";

export default function VisaoGeralTab() {
  const { filtros, setFiltros, queryString } = useDashboardFilters();
  const [drill, setDrill] = useState<{ aberto: boolean; titulo: string; dim?: DrillDim; valor?: string; metrica: DrillMetrica }>({
    aberto: false, titulo: "", metrica: "pago",
  });

  const { data: opcoes } = useQuery<DashOpcoes>({
    queryKey: ["/api/gestao-comercial/dashboard/opcoes"],
    queryFn: async () => {
      const r = await fetch("/api/gestao-comercial/dashboard/opcoes", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar opções");
      return r.json();
    },
  });

  const url = `/api/gestao-comercial/dashboard/visao-geral?${queryString}`;
  const { data, isLoading } = useQuery<VisaoGeralResp>({
    queryKey: [url],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar dashboard");
      return r.json();
    },
  });

  const k = data?.kpis;
  const c = data?.comparativo;
  const abrirDrill = (dim: DrillDim, valor: string) =>
    setDrill({ aberto: true, titulo: `Produção paga — ${valor}`, dim, valor, metrica: "pago" });

  return (
    <div className="space-y-4" data-testid="tab-visao-geral">
      <DashboardFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando indicadores…</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">Sem dados.</div>
      ) : (
        <>
          {/* Produção Oficial (módulo Produção/financeiro) — mesma base da Meta/Ranking */}
          <div>
            <div className="text-sm font-semibold mb-2">
              Produção Oficial <span className="text-muted-foreground font-normal">· financeiro (igual à Meta/Ranking)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard titulo="Produção (geral)" valor={data.oficial.geral} formato="moeda" sub={`${data.oficial.qtd} contratos · sem cartão`} />
              <KpiCard titulo="Novo" valor={data.oficial.novo} formato="moeda" />
              <KpiCard titulo="Portabilidade" valor={data.oficial.portabilidade} formato="moeda" />
              <KpiCard titulo="Cartão" valor={data.oficial.cartao} formato="moeda" />
              <KpiCard titulo="Produção total" valor={data.oficial.total} formato="moeda" />
            </div>
          </div>

          {/* Pipeline (operacional) — base proposals */}
          <div>
            <div className="text-sm font-semibold mb-2">
              Pipeline <span className="text-muted-foreground font-normal">· operacional (propostas do CRM)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard titulo="Produção paga" valor={k!.pagoValor} formato="moeda" anterior={c?.pagoValor} sub={`${k!.pagoQtd} contratos`} />
              <KpiCard titulo="Ticket médio" valor={k!.ticketMedio} formato="moeda" anterior={c?.ticketMedio} />
              <KpiCard titulo="Cadastrado" valor={k!.cadastradoValor} formato="moeda" anterior={c?.cadastradoValor} sub={`${k!.cadastradoQtd} propostas`} />
              <KpiCard titulo="Conversão" valor={k!.conversao} formato="percent" anterior={c?.conversao} />
              <KpiCard titulo="Qtd paga" valor={k!.pagoQtd} formato="numero" anterior={c?.pagoQtd} />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Evolução — produção paga × cadastrado</CardTitle>
            </CardHeader>
            <CardContent>
              {data.serie.length === 0 ? (
                <div className="text-sm text-muted-foreground py-10 text-center">Sem produção no período</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.serie} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtMoeda(v)} width={90} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => fmtMoeda(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="pagoValor" name="Pago" stroke="#059669" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cadastradoValor" name="Cadastrado" stroke="#7C3AED" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DrillChart titulo="Produção por Produto" tipo="pizza" dados={data.quebras.produto} onSlice={(v) => abrirDrill("produto", v)} />
            <DrillChart titulo="Produção por Banco" tipo="barra" dados={data.quebras.banco} onSlice={(v) => abrirDrill("banco", v)} />
            <DrillChart titulo="Produção por Convênio" tipo="barra" dados={data.quebras.convenio} onSlice={(v) => abrirDrill("convenio", v)} />
          </div>
        </>
      )}

      <DrillDownPanel
        aberto={drill.aberto}
        onClose={() => setDrill((d) => ({ ...d, aberto: false }))}
        titulo={drill.titulo}
        queryString={queryString}
        metrica={drill.metrica}
        dim={drill.dim}
        valor={drill.valor}
      />
    </div>
  );
}
