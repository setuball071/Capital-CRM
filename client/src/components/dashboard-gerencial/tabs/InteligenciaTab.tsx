import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Sparkles, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardFilters } from "../useDashboardFilters";
import { DashboardFilters } from "../DashboardFilters";
import { KpiCard } from "../KpiCard";
import { fmtMoeda, fmtPercent } from "../fmt";
import type { InteligenciaResp, DashOpcoes, CrescItem, ConcItem } from "../types";

type Dim = "corretor" | "banco" | "produto";
const DIM_LABEL: Record<Dim, string> = { corretor: "Corretor", banco: "Banco", produto: "Produto" };

function ListaCrescimento({ itens }: { itens: CrescItem[] }) {
  const sobe = itens.filter((x) => x.delta > 0).slice(0, 6);
  const cai = [...itens].filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 6);
  const Linha = ({ x }: { x: CrescItem }) => {
    const up = x.delta >= 0;
    return (
      <div className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
        <div className="min-w-0">
          <div className="text-sm truncate">{x.chave}</div>
          <div className="text-xs text-muted-foreground">{fmtMoeda(x.atual)} <span className="opacity-60">· antes {fmtMoeda(x.anterior)}</span></div>
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium shrink-0 ${up ? "text-green-600" : "text-red-600"}`}>
          {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          {fmtMoeda(Math.abs(x.delta))}
          {x.anterior > 0 && <span className="text-xs opacity-70">({fmtPercent(Math.abs(x.deltaPct))})</span>}
        </div>
      </div>
    );
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1"><ArrowUp className="h-3.5 w-3.5" /> Maiores altas</div>
        {sobe.length ? sobe.map((x) => <Linha key={x.chave} x={x} />) : <div className="text-xs text-muted-foreground py-3">Sem altas no período.</div>}
      </div>
      <div>
        <div className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1"><ArrowDown className="h-3.5 w-3.5" /> Maiores quedas</div>
        {cai.length ? cai.map((x) => <Linha key={x.chave} x={x} />) : <div className="text-xs text-muted-foreground py-3">Sem quedas no período.</div>}
      </div>
    </div>
  );
}

function CardConcentracao({ titulo, c }: { titulo: string; c: ConcItem }) {
  const alerta = c.pct >= 0.4;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{titulo}</div>
        <div className="text-2xl font-semibold mt-1">{fmtPercent(c.pct)}</div>
        <div className="text-xs mt-1 truncate" title={c.topNome}>
          em <strong>{c.topNome}</strong>
        </div>
        <div className="text-xs text-muted-foreground mt-1">Top 5 = {fmtPercent(c.top5pct)} · {c.n} no total</div>
        {alerta && (
          <div className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Alta dependência
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InteligenciaTab() {
  const { filtros, setFiltros, queryString } = useDashboardFilters();
  const [dim, setDim] = useState<Dim>("corretor");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaTexto, setIaTexto] = useState<string | null>(null);
  const [iaErro, setIaErro] = useState<string | null>(null);

  const { data: opcoes } = useQuery<DashOpcoes>({
    queryKey: ["/api/gestao-comercial/dashboard/opcoes"],
    queryFn: async () => {
      const r = await fetch("/api/gestao-comercial/dashboard/opcoes", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar opções");
      return r.json();
    },
  });

  const url = `/api/gestao-comercial/dashboard/inteligencia?${queryString}`;
  const { data, isLoading } = useQuery<InteligenciaResp>({
    queryKey: [url],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar inteligência comercial");
      return r.json();
    },
  });

  const gerarIA = async () => {
    if (!data) return;
    setIaLoading(true);
    setIaErro(null);
    setIaTexto(null);
    try {
      const r = await fetch("/api/gestao-comercial/dashboard/inteligencia/ia", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: data }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Falha na IA");
      setIaTexto(j.analise);
    } catch (e: any) {
      setIaErro(e?.message || "Falha ao gerar análise.");
    } finally {
      setIaLoading(false);
    }
  };

  const crescAtual = data ? data.crescimento[dim] : [];

  return (
    <div className="space-y-4" data-testid="tab-inteligencia">
      <DashboardFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">Sem dados.</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            Leituras automáticas sobre a <strong>produção realizada</strong> (financeiro — inclui importados; bate com o ranking).
          </div>

          {/* Insights automáticos */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" /> Insights automáticos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {data.insights.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2"><span className="text-muted-foreground">•</span><span>{s}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Análise por IA (sob demanda) */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-500" /> Análise por IA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={gerarIA} disabled={iaLoading} data-testid="btn-gerar-ia">
                  <Sparkles className="h-4 w-4 mr-1" />
                  {iaLoading ? "Gerando…" : iaTexto ? "Gerar de novo" : "Gerar análise"}
                </Button>
                <span className="text-xs text-muted-foreground">A IA lê os números do período e escreve destaques, riscos e recomendações.</span>
              </div>
              {iaErro && <div className="text-sm text-red-600 mt-3">{iaErro}</div>}
              {iaTexto && (
                <div className="mt-3 text-sm whitespace-pre-wrap leading-relaxed bg-muted/40 rounded-md p-3">{iaTexto}</div>
              )}
            </CardContent>
          </Card>

          {/* Projeção do mês */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" /> Projeção do mês ({data.projecao.mes})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard titulo="Realizado até hoje" valor={data.projecao.realizado} formato="moeda" />
                <KpiCard titulo="Projeção de fechamento" valor={data.projecao.projetado} formato="moeda" anterior={data.projecao.mesAnterior} />
                <KpiCard titulo="Mês anterior" valor={data.projecao.mesAnterior} formato="moeda" />
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">Ritmo (dias úteis)</div>
                    <div className="text-2xl font-semibold mt-1">{data.projecao.diasUteisDecorridos}/{data.projecao.diasUteisMes}</div>
                    <div className="text-xs text-muted-foreground mt-1">decorridos / no mês</div>
                  </CardContent>
                </Card>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Projeção = realizado ÷ dias úteis decorridos × dias úteis do mês. Respeita os filtros, mas é sempre do mês corrente.
              </div>
            </CardContent>
          </Card>

          {/* Crescimento vs período anterior */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm">Crescimento vs período anterior</CardTitle>
                <div className="flex gap-1">
                  {(Object.keys(DIM_LABEL) as Dim[]).map((d) => (
                    <Button key={d} size="sm" variant={dim === d ? "default" : "outline"} onClick={() => setDim(d)} className="h-7 px-2 text-xs">
                      {DIM_LABEL[d]}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ListaCrescimento itens={crescAtual} />
            </CardContent>
          </Card>

          {/* Concentração / risco */}
          <div>
            <div className="text-sm font-semibold mb-2">Concentração / risco de dependência</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CardConcentracao titulo="Top corretor" c={data.concentracao.corretor} />
              <CardConcentracao titulo="Top banco" c={data.concentracao.banco} />
              <CardConcentracao titulo="Top convênio" c={data.concentracao.convenio} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
