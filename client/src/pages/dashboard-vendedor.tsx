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
      <div className="flex items-center justify-center h-full bg-[#090b0e]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full bg-[#090b0e]">
        <Card className="max-w-md bg-[#111318] border-white/5">
          <CardContent className="p-6 text-center">
            <p className="text-slate-400 mb-2">Erro ao carregar o painel</p>
            <p className="text-xs text-slate-500">Tente recarregar a página</p>
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
      <div className="bg-[#111318] border border-white/5 rounded-2xl md:rounded-[3rem] p-6 md:p-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 md:mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 md:p-4 bg-purple-600/20 rounded-xl md:rounded-2xl">
              <Scale className="text-purple-500" size={28} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Regulamento de Desempenho</h2>
              <p className="text-slate-500 text-sm font-medium">Classificações e Premiações</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
            <AlertCircle size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Prêmios não cumulativos</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl md:rounded-2xl border border-white/5 bg-black/20">
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nível</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Faturamento Mínimo</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Prêmio (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm font-bold">
              {sortedTiers.map((tier) => {
                const TIcon = getTierIcon(tier.icon);
                return (
                  <tr key={tier.level} className="group">
                    <td className="px-4 md:px-8 py-4 md:py-6 flex items-center gap-3 md:gap-4">
                      <TIcon size={18} style={{ color: tier.color }} />
                      <span className="text-white italic tracking-widest uppercase text-xs md:text-sm">{tier.name}</span>
                    </td>
                    <td className="px-4 md:px-8 py-4 md:py-6 text-slate-300 text-xs md:text-sm">R$ {tier.target.toLocaleString("pt-BR")}</td>
                    <td className="px-4 md:px-8 py-4 md:py-6 text-lg md:text-2xl text-emerald-400 italic font-black">R$ {tier.rewardValue.toLocaleString("pt-BR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const DashboardPanel = () => (
    <div className="space-y-6 md:space-y-8" data-testid="dashboard-vendedor">
      <div className="bg-white dark:bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 shadow-2xl overflow-hidden relative border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start mb-5 md:mb-6 gap-4">
          <div>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-2">Meta Mensal - {mesNome}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl md:text-5xl font-black text-[#1e1b4b]" data-testid="text-total-fechado">
                R$ {(data?.totalValor || 0).toLocaleString("pt-BR")}
              </span>
              <span className="text-lg md:text-2xl font-bold text-slate-300" data-testid="text-meta-mensal">
                / {(data?.metaMensal || 0).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="bg-[#e0e7ff] px-5 md:px-8 py-3 md:py-4 rounded-2xl md:rounded-3xl border border-blue-100 shadow-sm mb-1">
              <span className="text-2xl md:text-4xl font-black text-blue-600" data-testid="text-percentual">
                {(data?.percentualMeta || 0).toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] md:text-[11px] text-slate-400 font-black uppercase tracking-tighter italic">Atingimento Total</p>
          </div>
        </div>
        <div className="w-full h-3 md:h-4 bg-slate-100 rounded-full mb-4 md:mb-5 overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-1000 rounded-full"
            style={{ width: `${Math.min(data?.percentualMeta || 0, 100)}%` }}
            data-testid="progress-meta"
          />
        </div>
        <div className="flex justify-between text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest italic opacity-80">
          <span>Início do Mês</span>
          <span>Meta Alvo de R$ {(data?.metaMensal || 0).toLocaleString("pt-BR")}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-8">
          <div className="bg-[#111318] border border-white/5 rounded-2xl md:rounded-[3rem] p-5 md:p-10">
            <div className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-10 pb-4 md:pb-6 border-b border-white/5 gap-4">
              <div>
                <h3 className="text-white font-black text-lg md:text-2xl tracking-tighter flex items-center gap-3 italic uppercase">
                  <Gauge size={24} className="text-purple-500" /> Ritmo de Desempenho
                </h3>
                <p className="text-xs text-slate-500 mt-2 font-medium italic font-mono tracking-tighter">
                  Status de preenchimento da meta diária recalculada.
                </p>
              </div>
              <div className="flex gap-4 md:gap-6 bg-black/20 p-2 md:p-3 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#9333ea] shadow-[0_0_8px_rgba(147,51,234,0.4)]" />
                  <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">PRODUZIDO</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#1e1b4b]" />
                  <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">A REALIZAR</span>
                </div>
              </div>
            </div>

            <div className="h-[280px] md:h-[400px] w-full mt-4" data-testid="card-grafico-ritmo">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.contratosPorDia || []} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.2} />
                  <XAxis dataKey="dia" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "#ffffff", opacity: 0.03 }}
                    contentStyle={{ backgroundColor: "#0f1115", border: "1px solid #334155", borderRadius: "16px", fontSize: "12px" }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(value: number, name: string) => {
                      const label = name === "preenchimento" ? "Produzido" :
                                    name === "vazio" ? "A realizar" :
                                    name === "excedente" ? "Excedente" : name;
                      return [`R$ ${value.toLocaleString("pt-BR")}`, label];
                    }}
                  />
                  <Bar dataKey="preenchimento" stackId="a" fill="#9333ea" barSize={28} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="vazio" stackId="a" fill="#1e1b4b" barSize={28} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="excedente" stackId="a" fill="#e9d5ff" barSize={28} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4 md:gap-6 mt-6 md:mt-10">
              <div className="bg-black/20 p-4 md:p-6 rounded-xl md:rounded-[2rem] border border-white/5 text-center">
                <p className="text-slate-500 text-[10px] font-black uppercase mb-1 tracking-widest">Saldo p/ Meta 100%</p>
                <p className="text-xl md:text-3xl font-black text-white italic tracking-tighter" data-testid="text-saldo-devedor">
                  R$ {(data?.saldoDevedor || 0).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="bg-purple-600/10 p-4 md:p-6 rounded-xl md:rounded-[2rem] border border-purple-500/20 text-center ring-1 ring-purple-500/10">
                <p className="text-purple-400 text-[10px] font-black uppercase mb-1 tracking-widest italic flex items-center justify-center gap-1">
                  <Zap size={10} fill="currentColor" /> Meta de Hoje
                </p>
                <p className="text-xl md:text-3xl font-black text-white italic tracking-tighter" data-testid="text-meta-hoje">
                  R$ {Math.round(data?.metaDiariaAjustada || 0).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-[#111318] border border-white/5 rounded-2xl md:rounded-[3rem] p-6 md:p-10 relative overflow-hidden group border-purple-500/10">
            <div className="absolute top-0 right-0 p-8 md:p-10 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-1000">
              <CurrentTierIcon size={140} />
            </div>

            <h3 className="text-purple-500 font-black text-[12px] md:text-[14px] flex items-center gap-2 mb-8 md:mb-10 uppercase tracking-[0.3em] md:tracking-[0.4em] italic">
              <Shield size={16} fill="currentColor" className="opacity-80" /> Nível Extraordinário
            </h3>

            <div className="text-center mb-8 md:mb-10 relative z-10">
              <div className="inline-flex p-6 md:p-8 rounded-full bg-slate-900 border border-white/5 shadow-inner mb-4 md:mb-6 ring-4 ring-purple-500/5">
                <CurrentTierIcon size={48} style={{ color: currentTierData?.color || "#94a3b8" }} />
              </div>
              <h2 className="text-[11px] md:text-[12px] font-bold text-slate-500 uppercase tracking-[0.5em] md:tracking-[0.6em] mb-2 text-center italic">
                Sua Classificação
              </h2>
              <p
                className="text-3xl md:text-5xl font-black italic tracking-tighter text-center uppercase leading-none mb-4 md:mb-6"
                style={{ color: currentTierData?.color || "#94a3b8" }}
                data-testid="text-tier-name"
              >
                {currentTierData?.name || "SEM TIER"}
              </p>
              {currentTierData && (
                <div className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-4 md:px-5 py-2 rounded-full border border-emerald-500/20 shadow-lg">
                  <DollarSign size={14} />
                  <span className="text-xs md:text-sm font-black italic tracking-widest uppercase">
                    Prêmio: R$ {currentTierData.rewardValue.toLocaleString("pt-BR")}
                  </span>
                </div>
              )}
            </div>

            {nextTierData && (
              <div className="space-y-4 md:space-y-6 bg-purple-500/5 p-5 md:p-8 rounded-xl md:rounded-[2.5rem] border border-purple-500/10 shadow-inner relative z-10">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic underline decoration-purple-500 underline-offset-8">
                    Rumo ao {nextTierData.name}
                  </p>
                  <div className="text-white font-black italic text-sm">
                    R$ {nextTierData.rewardValue.toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-black italic text-white opacity-70">
                    <span>R$ {Math.max(0, nextTierData.target - (data?.totalValor || 0)).toLocaleString("pt-BR")} faltantes</span>
                    <span className="text-purple-400">
                      {Math.min(100, ((data?.totalValor || 0) / nextTierData.target * 100)).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                      style={{ width: `${Math.min(((data?.totalValor || 0) / nextTierData.target * 100), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#090b0e] text-slate-200 p-3 md:p-6 lg:p-8 font-sans selection:bg-purple-500 selection:text-white overflow-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-4 md:gap-8">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="relative">
            <div className="w-14 h-14 md:w-20 md:h-20 rounded-full border-2 border-purple-600 p-1 shadow-2xl">
              <Avatar className="w-full h-full">
                <AvatarFallback className="text-sm md:text-base font-bold bg-slate-800 text-white border border-white/5">
                  {user.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            {currentTierData && (
              <div
                className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 p-1.5 md:p-2 rounded-full border-2 border-[#090b0e] shadow-xl ring-2 ring-purple-500/20"
                style={{ backgroundColor: currentTierData.color }}
              >
                <CurrentTierIcon size={10} className="text-[#090b0e]" />
              </div>
            )}
          </div>
          <div>
            <h1 className="font-black text-2xl md:text-4xl text-white tracking-tighter uppercase leading-none italic" data-testid="text-dashboard-title">
              {data?.vendedorNome || user.name}
            </h1>
            <p className="text-[9px] md:text-[10px] text-slate-500 font-black tracking-[0.3em] md:tracking-[0.6em] uppercase mt-1 md:mt-2 italic">
              {mesNome} {data?.mesAno?.split("/")[1]} {currentTierData ? `\u2022 STATUS ${currentTierData.name}` : ""}
            </p>
          </div>
        </div>

        <div className="flex bg-[#111318] p-1.5 md:p-2 rounded-xl md:rounded-[1.5rem] border border-white/5 shadow-xl" data-testid="nav-toggle">
          <button
            onClick={() => setView("dashboard")}
            className={`px-5 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest flex items-center gap-2 ${
              view === "dashboard"
                ? "bg-purple-600 text-white shadow-xl shadow-purple-900/40"
                : "text-slate-500 hover:text-white"
            }`}
            data-testid="button-view-dashboard"
          >
            Dashboard
          </button>
          <button
            onClick={() => setView("rules")}
            className={`px-5 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest flex items-center gap-2 ${
              view === "rules"
                ? "bg-purple-600 text-white shadow-xl shadow-purple-900/40"
                : "text-slate-500 hover:text-white"
            }`}
            data-testid="button-view-rules"
          >
            Regulamento
          </button>
        </div>
      </header>

      {view === "dashboard" ? <DashboardPanel /> : <RegulationPanel />}

      <footer className="mt-12 md:mt-20 pt-6 md:pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6 text-[9px] md:text-[10px] text-slate-800 font-black uppercase tracking-[0.3em] md:tracking-[0.5em]">
        <div className="flex items-center gap-3">
          <Shield size={12} className="text-purple-900" />
          <span>Classificação Extraordinária Protegida</span>
        </div>
        <span>ConsigOne CRM Infrastructure</span>
      </footer>
    </div>
  );
}
