import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardFilters } from "../useDashboardFilters";
import { DashboardFilters } from "../DashboardFilters";
import { KpiCard } from "../KpiCard";
import { fmtMoeda } from "../fmt";
import type { PerfilResp, DashOpcoes, PerfilDimItem } from "../types";

const CORES = ["#7C3AED", "#EC4899", "#2563EB", "#059669", "#D97706", "#DC2626", "#0891B2", "#9333EA", "#65A30D", "#E11D48", "#0D9488", "#7E22CE"];
const ORDEM_FAIXA = ["Até 29", "30-39", "40-49", "50-59", "60-69", "70+", "Sem data"];

function Grafico({ titulo, dados, tipo = "bar" }: { titulo: string; dados: PerfilDimItem[]; tipo?: "bar" | "pie" }) {
  return (
    <Card data-testid={`perfil-${titulo}`}>
      <CardHeader className="pb-1"><CardTitle className="text-sm">{titulo}</CardTitle></CardHeader>
      <CardContent>
        {dados.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Sem dados no período</div>
        ) : tipo === "pie" ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip formatter={(v: any) => fmtMoeda(Number(v))} />
              <Legend />
              <Pie data={dados} dataKey="valor" nameKey="chave" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.chave}>
                {dados.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 34)}>
            <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 56 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="chave" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [fmtMoeda(Number(v)), "Produção"]} />
              <Bar dataKey="valor" name="Produção" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, formatter: (v: any) => fmtMoeda(Number(v)) }}>
                {dados.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function PerfilTab() {
  const { filtros, setFiltros, queryString } = useDashboardFilters();

  const { data: opcoes } = useQuery<DashOpcoes>({
    queryKey: ["/api/gestao-comercial/dashboard/opcoes"],
    queryFn: async () => {
      const r = await fetch("/api/gestao-comercial/dashboard/opcoes", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar opções");
      return r.json();
    },
  });

  const url = `/api/gestao-comercial/dashboard/perfil?${queryString}`;
  const { data, isLoading } = useQuery<PerfilResp>({
    queryKey: [url],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar perfil");
      return r.json();
    },
  });

  const faixaOrdenada = (data?.faixaEtaria || [])
    .slice()
    .sort((a, b) => ORDEM_FAIXA.indexOf(a.chave) - ORDEM_FAIXA.indexOf(b.chave));

  return (
    <div className="space-y-4" data-testid="tab-perfil">
      <DashboardFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">Sem dados.</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            Perfil de quem <strong>produziu</strong> no período (financeiro — inclui importados), cruzado com o cadastro do cliente. Valores = produção (R$). (Sexo e regime jurídico ficam pra uma próxima etapa.)
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Produção" valor={data.total.valor} formato="moeda" />
            <KpiCard titulo="Clientes que produziram" valor={data.total.clientes} formato="numero" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Grafico titulo="Faixa etária (R$)" dados={faixaOrdenada} />
            <Grafico titulo="Estados (R$)" dados={data.uf} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Grafico titulo="Convênios (R$)" dados={data.convenio} tipo="pie" />
            <Grafico titulo="Órgãos mais atendidos (R$)" dados={data.orgao} />
          </div>
          <Grafico titulo="Banco de recebimento (R$)" dados={data.bancoRecebimento} />
        </>
      )}
    </div>
  );
}
