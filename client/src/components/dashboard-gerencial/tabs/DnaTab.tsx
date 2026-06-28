import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardFilters } from "../useDashboardFilters";
import { DashboardFilters } from "../DashboardFilters";
import { fmtMoeda, fmtPercent } from "../fmt";
import type { DnaResp, DashOpcoes, DnaChaveValor, DnaComponentes } from "../types";

const CORES = ["#7C3AED", "#EC4899", "#2563EB", "#059669", "#D97706", "#DC2626", "#0891B2", "#9333EA"];

const COMP_LABEL: { key: keyof DnaComponentes; label: string; peso: string }[] = [
  { key: "volume", label: "Volume", peso: "30%" },
  { key: "consistencia", label: "Consistência", peso: "20%" },
  { key: "crescimento", label: "Crescimento", peso: "20%" },
  { key: "diversificacao", label: "Diversificação", peso: "15%" },
  { key: "abrangencia", label: "Abrangência (público)", peso: "15%" },
];

function corScore(s: number) {
  if (s >= 70) return "#16a34a";
  if (s >= 40) return "#d97706";
  return "#dc2626";
}

function ListaBarras({ titulo, itens, sufixo }: { titulo: string; itens: DnaChaveValor[]; sufixo?: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-sm">{titulo}{sufixo}</CardTitle></CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Sem dados</div>
        ) : (
          <div className="space-y-1.5">
            {itens.map((it, i) => (
              <div key={it.chave}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="truncate pr-2" title={it.chave}>{it.chave}</span>
                  <span className="text-muted-foreground shrink-0">{fmtMoeda(it.valor)}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(it.valor / max) * 100}%`, background: CORES[i % CORES.length] }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DnaTab() {
  const { filtros, setFiltros, queryString } = useDashboardFilters();
  const [corretorSel, setCorretorSel] = useState<string>("");

  const { data: opcoes } = useQuery<DashOpcoes>({
    queryKey: ["/api/gestao-comercial/dashboard/opcoes"],
    queryFn: async () => {
      const r = await fetch("/api/gestao-comercial/dashboard/opcoes", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar opções");
      return r.json();
    },
  });

  const url = `/api/gestao-comercial/dashboard/dna?${queryString}${corretorSel ? `&corretor=${encodeURIComponent(corretorSel)}` : ""}`;
  const { data, isLoading } = useQuery<DnaResp>({
    queryKey: [url],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar DNA do corretor");
      return r.json();
    },
  });

  const sel = data?.selecionado;
  const mixData = (sel?.mix || []).map((m) => ({ nome: m.chave, valor: m.valor }));

  return (
    <div className="space-y-4" data-testid="tab-dna">
      <DashboardFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : !data || !data.ranking.length ? (
        <div className="py-16 text-center text-muted-foreground">Sem produção de corretores no período.</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            Score 0-100 <strong>relativo à equipe</strong> (100 = melhor do time), sobre a produção realizada (financeiro — inclui importados).
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Ranking (clicável) */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-1"><CardTitle className="text-sm">Ranking por score</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-[520px] overflow-auto">
                  {data.ranking.map((r) => {
                    const ativo = sel?.corretor === r.corretor;
                    return (
                      <button
                        key={r.corretor}
                        onClick={() => setCorretorSel(r.corretor)}
                        className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 hover:bg-muted transition ${ativo ? "bg-muted ring-1 ring-primary" : ""}`}
                        data-testid={`dna-rank-${r.pos}`}
                      >
                        <span className="text-xs text-muted-foreground w-5 shrink-0">{r.pos}º</span>
                        <span
                          className="text-xs font-bold text-white rounded px-1.5 py-0.5 shrink-0"
                          style={{ background: corScore(r.score) }}
                        >{r.score}</span>
                        <span className="text-sm truncate flex-1">{r.corretor}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{fmtMoeda(r.volume)}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Perfil do corretor selecionado */}
            <div className="lg:col-span-2 space-y-4">
              {sel && (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div
                          className="h-20 w-20 rounded-full flex flex-col items-center justify-center text-white shrink-0"
                          style={{ background: corScore(sel.score) }}
                        >
                          <span className="text-2xl font-bold leading-none">{sel.score}</span>
                          <span className="text-[10px] opacity-90">score</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-lg font-semibold truncate">{sel.corretor}</div>
                          <div className="text-xs text-muted-foreground">
                            {sel.rankingPos}º de {sel.totalCorretores} corretores
                          </div>
                          <div className="text-sm mt-1">
                            {fmtMoeda(sel.volume)} · {sel.qtd} contratos · ticket {fmtMoeda(sel.ticket)}
                          </div>
                        </div>
                      </div>

                      {/* componentes do score */}
                      <div className="mt-4 space-y-2">
                        {COMP_LABEL.map(({ key, label, peso }) => {
                          const v = Math.round(sel.componentes[key]);
                          return (
                            <div key={key}>
                              <div className="flex justify-between text-xs mb-0.5">
                                <span>{label} <span className="text-muted-foreground">({peso})</span></span>
                                <span className="font-medium">{v}/100</span>
                              </div>
                              <div className="h-2 rounded bg-muted overflow-hidden">
                                <div className="h-full rounded" style={{ width: `${v}%`, background: corScore(v) }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* fortes / fracos */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {sel.fortes.map((f) => (
                          <span key={f} className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">★ {f}</span>
                        ))}
                        {sel.fracos.map((f) => (
                          <span key={f} className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">▼ {f}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* rentabilidade do corretor (repasse pago a ele) */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Repasse no período</div><div className="text-xl font-semibold text-emerald-600">{fmtMoeda(sel.repasse)}</div><div className="text-[11px] text-muted-foreground mt-0.5">comissão paga a ele (produção financeira)</div></CardContent></Card>
                    <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Média de ganho / contrato</div><div className="text-xl font-semibold text-emerald-600">{fmtMoeda(sel.mediaGanho)}</div><div className="text-[11px] text-muted-foreground mt-0.5">repasse ÷ contratos remunerados</div></CardContent></Card>
                  </div>

                  {/* contexto numérico do DNA */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Meses ativos</div><div className="text-lg font-semibold">{sel.raw.mesesAtivos}/{sel.raw.totalMeses}</div></CardContent></Card>
                    <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Crescimento</div><div className={`text-lg font-semibold ${sel.raw.crescimentoPct >= 0 ? "text-green-600" : "text-red-600"}`}>{sel.raw.crescimentoPct >= 0 ? "+" : ""}{fmtPercent(sel.raw.crescimentoPct)}</div></CardContent></Card>
                    <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Órgãos atendidos</div><div className="text-lg font-semibold">{sel.raw.nOrgao}</div></CardContent></Card>
                    <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Estados</div><div className="text-lg font-semibold">{sel.raw.nUf}</div></CardContent></Card>
                  </div>

                  {/* mix de produtos */}
                  <Card>
                    <CardHeader className="pb-1"><CardTitle className="text-sm">Mix de produtos (R$)</CardTitle></CardHeader>
                    <CardContent>
                      {mixData.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-4 text-center">Sem dados</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Tooltip formatter={(v: any) => fmtMoeda(Number(v))} />
                            <Pie data={mixData} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.nome}>
                              {mixData.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>

          {sel && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <ListaBarras titulo="Bancos" itens={sel.bancos} />
              <ListaBarras titulo="Convênios" itens={sel.convenios} />
              <ListaBarras titulo="Órgãos (público)" itens={sel.orgaos} />
              <ListaBarras titulo="Estados" itens={sel.estados} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
