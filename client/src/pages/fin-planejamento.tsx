// Planejamento — % de reserva, tetos por categoria e projeção de caixa
// com alertas acionáveis. Fase 3 do Financeiro Empresarial (Master-only).
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Target, AlertTriangle, Info, ShieldAlert, PiggyBank, TrendingUp, TrendingDown, CalendarClock, Save } from "lucide-react";

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const mesAtual = () => new Date().toISOString().slice(0, 7);

interface Resumo {
  mes: string; saldoConsolidado: number; entradasMes: number; saidasMes: number;
  reservaDevida: number; pctReserva: number; comissoesAReceber: number;
  totalAbertas60d: number;
  estouros: { categoria: string; cor: string; teto: number; gasto: number; pct: number }[];
  projecao: { data: string; saldo: number; saidasDia: number }[];
  diaNegativo: string | null;
  alertas: { nivel: "info" | "warn" | "critico"; texto: string }[];
}

export default function FinPlanejamento() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [pctReserva, setPctReserva] = useState("");
  const [metaMargem, setMetaMargem] = useState("");
  const [tetos, setTetos] = useState<Record<string, string>>({});

  const { data: resumo, isLoading } = useQuery<Resumo>({
    queryKey: ["fin-resumo", mes],
    queryFn: async () => {
      const r = await fetch(`/api/fin/resumo?mes=${mes}`, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar resumo");
      return r.json();
    },
  });
  const { data: planData } = useQuery<{ planejamento: any }>({
    queryKey: ["fin-plan", mes],
    queryFn: async () => {
      const r = await fetch(`/api/fin/planejamento/${mes}`, { credentials: "include" });
      if (!r.ok) throw new Error("Erro");
      return r.json();
    },
  });
  const { data: catsData } = useQuery<{ categorias: any[] }>({ queryKey: ["/api/fin/categorias"] });
  const catsSaida = (catsData?.categorias ?? []).filter((c: any) => c.tipo === "saida");

  // Carrega valores do planejamento salvo no form
  useEffect(() => {
    const p = planData?.planejamento;
    setPctReserva(p?.pctReserva ? String(parseFloat(p.pctReserva)) : "");
    setMetaMargem(p?.metaMargem ? String(parseFloat(p.metaMargem)) : "");
    const t: Record<string, string> = {};
    if (p?.tetosJson) for (const [k, v] of Object.entries(p.tetosJson)) t[k] = String(v);
    setTetos(t);
  }, [planData]);

  const salvar = useMutation({
    mutationFn: async () => {
      const tetosNum: Record<string, number> = {};
      for (const [k, v] of Object.entries(tetos)) {
        const n = parseFloat(v);
        if (!isNaN(n) && n > 0) tetosNum[k] = n;
      }
      return apiRequest("PUT", `/api/fin/planejamento/${mes}`, {
        pctReserva: pctReserva || 0,
        metaMargem: metaMargem || null,
        tetosJson: tetosNum,
      });
    },
    onSuccess: () => {
      toast({ title: "Planejamento salvo", description: "As diretrizes já valem no fluxo de caixa." });
      qc.invalidateQueries({ queryKey: ["fin-resumo"] });
      qc.invalidateQueries({ queryKey: ["fin-plan"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Marcos da projeção: hoje, +7, +15, +30, +45, +60
  const marcos = resumo ? [0, 7, 15, 30, 45, 60]
    .map(i => resumo.projecao[i])
    .filter(Boolean) : [];

  const ICONE = { critico: ShieldAlert, warn: AlertTriangle, info: Info } as const;
  const COR = {
    critico: "border-red-500/40 bg-red-500/10 text-red-600",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-600",
    info: "border-primary/40 bg-primary/10 text-primary",
  } as const;

  return (
    <div className="p-6 space-y-5 max-w-[1300px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="h-6 w-6 text-primary" /> Planejamento</h1>
          <p className="text-sm text-muted-foreground">Diretrizes que operam sozinhas no seu fluxo de caixa</p>
        </div>
        <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-40" />
      </div>

      {/* Alertas acionáveis */}
      {(resumo?.alertas?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {resumo!.alertas.map((a, i) => {
            const Ic = ICONE[a.nivel];
            return (
              <div key={i} className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium ${COR[a.nivel]}`}>
                <Ic className="h-4 w-4 shrink-0" /> {a.texto}
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))" }}>
        <Card><CardContent className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Saldo consolidado</p>
          <p className={`text-xl font-bold ${(resumo?.saldoConsolidado ?? 0) < 0 ? "text-red-600" : "text-primary"}`}>{fmtBRL(resumo?.saldoConsolidado ?? 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-600" /> Entradas do mês</p>
          <p className="text-xl font-bold text-green-600">{fmtBRL(resumo?.entradasMes ?? 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-600" /> Saídas do mês</p>
          <p className="text-xl font-bold text-red-600">{fmtBRL(resumo?.saidasMes ?? 0)}</p>
        </CardContent></Card>
        <Card className="border-primary/40"><CardContent className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><PiggyBank className="h-3 w-3 text-primary" /> Reserva do mês ({resumo?.pctReserva ?? 0}%)</p>
          <p className="text-xl font-bold text-primary">{fmtBRL(resumo?.reservaDevida ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground">intocável na projeção</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Comissões a receber</p>
          <p className="text-xl font-bold text-green-600">{fmtBRL(resumo?.comissoesAReceber ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground">da Produção (sem data certa)</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" /> A pagar (60 dias)</p>
          <p className="text-xl font-bold">{fmtBRL(resumo?.totalAbertas60d ?? 0)}</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Projeção de caixa */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">📉 Projeção de caixa (só compromissos agendados)</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
              <div className="space-y-1.5">
                {marcos.map((m, i) => (
                  <div key={m.data} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5">
                    <span className="text-muted-foreground">{i === 0 ? "Hoje" : fmtData(m.data)}</span>
                    <span className={`font-bold font-mono ${m.saldo < 0 ? "text-red-600" : m.saldo < (resumo?.reservaDevida ?? 0) ? "text-amber-600" : "text-green-600"}`}>
                      {fmtBRL(m.saldo)}
                    </span>
                  </div>
                ))}
                {resumo?.diaNegativo ? (
                  <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-600">
                    ⚠️ Caixa fica negativo em {fmtData(resumo.diaNegativo)}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    Projeção desconta as contas a pagar em aberto dos próximos 60 dias. Comissões a receber ({fmtBRL(resumo?.comissoesAReceber ?? 0)}) entram como colchão extra quando confirmadas.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tetos por categoria — diretriz × realizado */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">📊 Tetos por categoria — diretriz × realizado</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {(resumo?.estouros?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Defina tetos abaixo para acompanhar aqui.</p>}
            {resumo?.estouros?.map((e: any) => (
              <div key={e.categoria}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{e.categoria}</span>
                  <span className={`font-mono font-semibold ${e.pct >= 100 ? "text-red-600" : e.pct >= 80 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {fmtBRL(e.gasto)} / {fmtBRL(e.teto)} · {e.pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, e.pct)}%`,
                    background: e.pct >= 100 ? "#dc2626" : e.pct >= 80 ? "#d97706" : (e.cor || "#7c3aed"),
                  }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Diretrizes (config) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">⚙️ Diretrizes de {mes.split("-").reverse().join("/")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
            <div>
              <Label>% de reserva sobre entradas</Label>
              <Input type="number" step="0.5" min="0" max="100" value={pctReserva} onChange={e => setPctReserva(e.target.value)} placeholder="ex: 10" />
            </div>
            <div>
              <Label>Meta de margem (%) — opcional</Label>
              <Input type="number" step="0.5" min="0" max="100" value={metaMargem} onChange={e => setMetaMargem(e.target.value)} placeholder="ex: 30" />
            </div>
          </div>
          {catsSaida.length > 0 && (
            <div>
              <Label className="mb-2 block">Tetos mensais por categoria (R$)</Label>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                {catsSaida.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.cor }} />
                    <span className="text-sm flex-1 truncate">{c.nome}</span>
                    <Input type="number" step="50" min="0" className="w-28 h-8 text-right"
                      value={tetos[String(c.id)] ?? ""}
                      onChange={e => setTetos({ ...tetos, [String(c.id)]: e.target.value })}
                      placeholder="sem teto" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            <Save className="h-4 w-4 mr-1" /> Salvar diretrizes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
