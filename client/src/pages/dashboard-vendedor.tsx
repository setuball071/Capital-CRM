import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Shield, Medal, Star, Gem, Crown, Zap, Gauge, Scale, AlertCircle, DollarSign } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface TierData {
  level: number;
  name: string;
  color: string;
  icon: string;
  target: number;
  rewardValue: number;
}

interface DashboardData {
  vendedorNome: string;
  metaMensal: number;
  totalValor: number;
  totalContratos: number;
  percentualMeta: number;
  projecaoMensal: number;
  metaDiariaOriginal: number;
  metaDiariaAjustada: number;
  mediaAtual: number;
  saldoDevedor: number;
  diasUteisNoMes: number;
  diasUteisAteHoje: number;
  diasUteisRestantes: number;
  contratosPorDia: Array<{
    dia: string;
    diaCompleto: string;
    quantidade: number;
    valor: number;
    metaDoDia: number;
    preenchimento: number;
    vazio: number;
    excedente: number;
  }>;
  rankingPosition: number;
  currentTier: TierData | null;
  nextTier: TierData | null;
  allTiers: TierData[];
  mesAno: string;
}

const MESES: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
  "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
  "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
};

const TIER_ICONS: Record<string, typeof Shield> = {
  Shield, Medal, Star, Gem, Crown,
};

function getTierIcon(iconName: string) {
  return TIER_ICONS[iconName] || Shield;
}

export default function DashboardVendedorPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"dashboard" | "rules">("dashboard");

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard-vendedor"],
    refetchInterval: 60000,
  });

  if (!user) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const mesNome = data?.mesAno ? MESES[data.mesAno.split("/")[0]] || "" : "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-2">Erro ao carregar o painel</p>
            <p className="text-xs text-muted-foreground">Tente recarregar a página</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentTierData = data?.currentTier;
  const nextTierData = data?.nextTier;
  const CurrentTierIcon = currentTierData ? getTierIcon(currentTierData.icon) : Shield;
  const sortedTiers = data?.allTiers ? [...data.allTiers].sort((a, b) => b.target - a.target) : [];

  const RegulationPanel = () => (
    <div className="max-w-5xl mx-auto">
      <Card className="rounded-2xl">
        <CardContent className="p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Scale className="text-primary" size={24} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-foreground uppercase tracking-tight">Regulamento de Desempenho</h2>
                <p className="text-muted-foreground text-xs sm:text-sm">Classificações e Premiações</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400">
              <AlertCircle size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Prêmios não cumulativos</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left min-w-[480px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nível</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Faturamento Mínimo</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Prêmio (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm font-semibold">
                {sortedTiers.map((tier) => {
                  const TIcon = getTierIcon(tier.icon);
                  return (
                    <tr key={tier.level}>
                      <td className="px-4 sm:px-6 py-3 sm:py-5 flex items-center gap-3">
                        <TIcon size={18} style={{ color: tier.color }} />
                        <span className="text-foreground uppercase text-xs sm:text-sm font-bold tracking-wider">{tier.name}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-5 text-muted-foreground text-xs sm:text-sm">R$ {tier.target.toLocaleString("pt-BR")}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-5 text-base sm:text-xl text-emerald-600 dark:text-emerald-400 font-black">R$ {tier.rewardValue.toLocaleString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const DashboardPanel = () => (
    <div className="space-y-5 sm:space-y-6" data-testid="dashboard-vendedor">
      <Card className="rounded-2xl border-primary/20 shadow-lg">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-1.5">Meta Mensal - {mesNome}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground" data-testid="text-total-fechado">
                  R$ {(data?.totalValor || 0).toLocaleString("pt-BR")}
                </span>
                <span className="text-base sm:text-lg lg:text-xl font-bold text-muted-foreground/50" data-testid="text-meta-mensal">
                  / {(data?.metaMensal || 0).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <div className="bg-primary/10 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-primary/20 mb-1">
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-primary" data-testid="text-percentual">
                  {(data?.percentualMeta || 0).toFixed(0)}%
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Atingimento Total</p>
            </div>
          </div>
          <div className="w-full h-2.5 sm:h-3 bg-muted rounded-full mb-3 sm:mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-1000 rounded-full"
              style={{ width: `${Math.min(data?.percentualMeta || 0, 100)}%` }}
              data-testid="progress-meta"
            />
          </div>
          <div className="flex justify-between gap-2 text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider opacity-70">
            <span>Início do Mês</span>
            <span>Meta: R$ {(data?.metaMensal || 0).toLocaleString("pt-BR")}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <div className="lg:col-span-8">
          <Card className="rounded-2xl">
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-border">
                <div>
                  <h3 className="text-foreground font-black italic text-xl sm:text-2xl lg:text-3xl tracking-tight flex items-center gap-2 uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    <Gauge size={20} className="text-primary" /> Ritmo de Desempenho
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Status de preenchimento da meta diária recalculada
                  </p>
                </div>
                <div className="flex gap-3 sm:gap-4 bg-muted/50 p-2 rounded-lg border border-border flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(var(--primary))" }} />
                    <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Produzido</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-primary/15 border border-primary/30" />
                    <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Meta do Dia</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#D81B60" }} />
                    <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Excedente</span>
                  </div>
                </div>
              </div>

              <div className="h-[240px] sm:h-[300px] lg:h-[360px] w-full" data-testid="card-grafico-ritmo">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.contratosPorDia || []} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                    <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "hsl(var(--card-foreground))",
                        padding: "10px 14px",
                      }}
                      labelStyle={{ color: "hsl(var(--muted-foreground))", fontWeight: 700, marginBottom: "4px" }}
                      formatter={(value: number, name: string) => {
                        const label = name === "preenchimento" ? "Produzido" :
                                      name === "vazio" ? "A realizar" :
                                      name === "excedente" ? "Excedente" : name;
                        const color = name === "preenchimento" ? "hsl(var(--primary))" :
                                      name === "excedente" ? "#D81B60" :
                                      "hsl(var(--muted-foreground))";
                        return [<span style={{ color, fontWeight: 600 }}>{`R$ ${value.toLocaleString("pt-BR")}`}</span>, label];
                      }}
                    />
                    <Bar dataKey="preenchimento" stackId="a" fill="hsl(var(--primary))" barSize={24} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="vazio" stackId="a" fill="hsl(var(--primary) / 0.15)" barSize={24} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="excedente" stackId="a" fill="#D81B60" barSize={24} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6">
                <div className="bg-muted/50 p-3 sm:p-5 rounded-xl border border-border text-center">
                  <p className="text-muted-foreground text-[9px] sm:text-[10px] font-bold uppercase mb-1 tracking-wider">Quanto falta pra Meta</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-black text-foreground tracking-tight" data-testid="text-saldo-devedor">
                    R$ {(data?.saldoDevedor || 0).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="bg-primary/5 p-3 sm:p-5 rounded-xl border border-primary/20 text-center">
                  <p className="text-primary text-[9px] sm:text-[10px] font-bold uppercase mb-1 tracking-wider flex items-center justify-center gap-1">
                    <Zap size={10} fill="currentColor" /> Meta de Hoje
                  </p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-black text-foreground tracking-tight" data-testid="text-meta-hoje">
                    R$ {Math.round(data?.metaDiariaAjustada || 0).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="rounded-2xl border-primary/10 relative overflow-visible group h-full">
            <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
              <div className="absolute top-0 right-0 p-6 sm:p-8 opacity-[0.04] pointer-events-none">
                <CurrentTierIcon size={120} />
              </div>

              <h3 className="text-primary font-black italic text-sm sm:text-base lg:text-lg flex items-center gap-2 mb-5 sm:mb-8 uppercase tracking-[0.15em] sm:tracking-[0.2em]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                <Shield size={14} fill="currentColor" className="opacity-80" /> Nível Extraordinário
              </h3>

              <div className="text-center mb-5 sm:mb-8 relative z-10 flex-1 flex flex-col items-center justify-center">
                <div className="inline-flex p-5 sm:p-6 rounded-full bg-muted border border-border mb-3 sm:mb-5">
                  <CurrentTierIcon size={40} style={{ color: currentTierData?.color || "hsl(var(--muted-foreground))" }} />
                </div>
                <h2 className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-[0.3em] sm:tracking-[0.5em] mb-1.5 text-center">
                  Sua Classificação
                </h2>
                <p
                  className="text-3xl sm:text-4xl lg:text-5xl font-black italic tracking-tight text-center uppercase leading-none mb-3 sm:mb-5"
                  style={{ color: currentTierData?.color || "hsl(var(--muted-foreground))", fontFamily: "'Barlow Condensed', sans-serif" }}
                  data-testid="text-tier-name"
                >
                  {currentTierData?.name || "SEM TIER"}
                </p>
                {currentTierData && (
                  <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 sm:px-4 py-1.5 rounded-full border border-emerald-500/20">
                    <DollarSign size={13} />
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">
                      Prêmio: R$ {currentTierData.rewardValue.toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}
              </div>

              {nextTierData && (
                <div className="space-y-3 sm:space-y-4 bg-primary/5 p-4 sm:p-6 rounded-xl border border-primary/10 relative z-10">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Rumo ao {nextTierData.name}
                    </p>
                    <div className="text-foreground font-black text-xs sm:text-sm">
                      R$ {nextTierData.rewardValue.toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 text-[10px] sm:text-xs font-bold text-muted-foreground">
                      <span>R$ {Math.max(0, nextTierData.target - (data?.totalValor || 0)).toLocaleString("pt-BR")} faltantes</span>
                      <span className="text-primary">
                        {Math.min(100, ((data?.totalValor || 0) / nextTierData.target * 100)).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-chart-4 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(((data?.totalValor || 0) / nextTierData.target * 100), 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-3 sm:p-5 lg:p-8 overflow-auto">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 sm:mb-8 gap-3 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="relative shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-primary p-0.5">
              <Avatar className="w-full h-full">
                <AvatarFallback className="text-xs sm:text-sm font-bold">
                  {user.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            {currentTierData && (
              <div
                className="absolute -bottom-1 -right-1 p-1 sm:p-1.5 rounded-full border-2 border-background"
                style={{ backgroundColor: currentTierData.color }}
              >
                <CurrentTierIcon size={8} className="text-background" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="font-black italic text-2xl sm:text-4xl lg:text-5xl text-foreground tracking-tight uppercase leading-none truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }} data-testid="text-dashboard-title">
                {data?.vendedorNome || user.name}
              </h1>
              {data?.rankingPosition && (
                <span className="text-xl sm:text-2xl lg:text-3xl tracking-tight whitespace-nowrap font-black italic text-primary/70" style={{ fontFamily: "'Barlow Condensed', sans-serif" }} data-testid="text-ranking">
                  Top {data.rankingPosition}#
                </span>
              )}
            </div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground font-bold tracking-wider uppercase mt-0.5 sm:mt-1">
              {mesNome} {data?.mesAno?.split("/")[1]} {currentTierData ? `\u2022 ${currentTierData.name}` : ""}
            </p>
          </div>
        </div>

        <div className="flex bg-muted p-1 rounded-lg border border-border shrink-0" data-testid="nav-toggle">
          <button
            onClick={() => setView("dashboard")}
            className={`px-4 sm:px-6 py-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase transition-all tracking-wider ${
              view === "dashboard"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-view-dashboard"
          >
            Dashboard
          </button>
          <button
            onClick={() => setView("rules")}
            className={`px-4 sm:px-6 py-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase transition-all tracking-wider ${
              view === "rules"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-view-rules"
          >
            Regulamento
          </button>
        </div>
      </header>
      {view === "dashboard" ? <DashboardPanel /> : <RegulationPanel />}
      <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 text-[9px] sm:text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Shield size={10} className="text-primary/30" />
          <span>Classificação Extraordinária Protegida</span>
        </div>
        <span>ConsigOne CRM</span>
      </footer>
    </div>
  );
}
