import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Shield, Medal, Star, Gem, Crown, Zap, Gauge, Scale, AlertCircle, CreditCard, Target, DollarSign, ChevronRight, FileText, Tag, Clock, Wheat, Trophy, Award, Flame, Rocket, TrendingUp, Dog, Swords, Coins, Wallet, PiggyBank, Landmark, Mountain, Crosshair, Magnet, HandCoins, PawPrint } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface NivelData {
  nome: string;
  ordem: number;
  cor: string;
  icone: string;
  premio: number;
  pontosMinimos: number;
  pontosMaximos: number | null;
}

interface CategoriaPerformance {
  produzido: number;
  pontos: number;
  meta: number;
  percentual: number;
  nivelAtual: NivelData | null;
  proximoNivel: NivelData | null;
  faltaParaProximo: number;
  progressoNivel: number;
  todosNiveis: NivelData[];
}

interface PerformanceData {
  geral: CategoriaPerformance;
  cartao: CategoriaPerformance;
}

interface DashboardData {
  vendedorNome: string;
  metaMensal: number;
  metaCartao: number;
  totalValor: number;
  totalCartao: number;
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
  mesAno: string;
}

const MESES: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
  "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
  "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
};

const TIER_ICONS: Record<string, typeof Shield> = {
  Shield, Medal, Star, Gem, Crown, Wheat, Trophy, Award, Flame, Rocket, Zap, TrendingUp, Target,
  Dog, CreditCard, Swords, Coins, Wallet, PiggyBank, Landmark, Mountain,
  Crosshair, Magnet, HandCoins, PawPrint,
};

function getTierIcon(iconName: string) {
  return TIER_ICONS[iconName] || Shield;
}

function MetaGeralCard({ performance, mesNome, metaMensal }: {
  performance: CategoriaPerformance | undefined;
  mesNome: string;
  metaMensal: number;
}) {
  if (!performance) return null;
  const nivel = performance.nivelAtual;
  const percentual = metaMensal > 0 ? Math.round((performance.produzido / metaMensal) * 100) : 0;

  return (
    <Card className="rounded-2xl border-primary/20 shadow-lg flex-1 min-w-0" data-testid="card-meta-geral">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-primary" />
          <h3 className="font-black italic text-xs sm:text-sm uppercase tracking-[0.15em] text-primary" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Meta Geral – {mesNome}
          </h3>
        </div>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-primary tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }} data-testid="text-meta-geral-produzido">
                R$ {performance.produzido.toLocaleString("pt-BR")}
              </span>
              <span className="text-base sm:text-lg lg:text-xl font-bold text-muted-foreground/50">
                / {metaMensal.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
          <div className="shrink-0 bg-primary/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-primary/20">
            <span className="text-lg sm:text-xl lg:text-2xl font-black text-primary" data-testid="text-meta-geral-percent">
              {percentual}%
            </span>
          </div>
        </div>

        <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2" data-testid="text-nivel-geral">
          Nível Atual: <span style={{ color: nivel?.cor || "hsl(var(--muted-foreground))" }}>{nivel?.nome || "Sem Nível"}</span>
        </p>

        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-primary to-chart-2"
            style={{ width: `${Math.min(percentual, 100)}%` }}
          />
        </div>

        <div className="flex justify-between items-center gap-2 text-[9px] sm:text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
          <span>Início: 01 {mesNome?.substring(0, 3).toUpperCase()}</span>
          <span>Meta consolidada de todos os contratos</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaCartaoCard({ performance, mesNome, metaCartao: metaCartaoProp }: {
  performance: CategoriaPerformance | undefined;
  mesNome: string;
  metaCartao: number;
}) {
  if (!performance) return null;
  const nivel = performance.nivelAtual;
  const metaCartao = metaCartaoProp > 0 ? metaCartaoProp : (performance.meta || 0);
  const percentCartao = metaCartao > 0 ? Math.round((performance.produzido / metaCartao) * 100) : 0;

  return (
    <div className="rounded-2xl bg-[#1a1a2e] dark:bg-[#111122] p-4 sm:p-5 flex flex-col justify-between min-w-0 flex-1 w-full" data-testid="card-meta-cartao">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={14} className="text-purple-400" />
          <h3 className="font-black italic text-xs sm:text-sm uppercase tracking-[0.15em] text-purple-300" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Meta Cartão – {mesNome}
          </h3>
        </div>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl lg:text-3xl font-black text-purple-400 tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }} data-testid="text-meta-cartao-produzido">
                R$ {performance.produzido.toLocaleString("pt-BR")}
              </span>
              <span className="text-sm sm:text-base font-bold text-gray-500">
                / {metaCartao.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
          <div className="shrink-0 bg-purple-500/20 px-3 py-1.5 rounded-xl border border-purple-500/30">
            <span className="text-base sm:text-lg font-black text-purple-400" data-testid="text-meta-cartao-percent">
              {percentCartao}%
            </span>
          </div>
        </div>

        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-purple-600 to-purple-400"
            style={{ width: `${Math.min(percentCartao, 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-center">
            <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Nível Cartão</p>
            <p className="text-xs sm:text-sm font-black text-white uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif" }} data-testid="text-nivel-cartao">
              {nivel?.nome || "Sem Nível"}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-center">
            <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Prêmio Atual</p>
            <p className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wide" data-testid="text-premio-cartao">
              R$ {(nivel?.premio || 0).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NivelSection({ performance, label, icon: IconComponent }: {
  performance: CategoriaPerformance | undefined;
  label: string;
  icon: typeof Shield;
}) {
  if (!performance) return null;
  const nivel = performance.nivelAtual;
  const proximo = performance.proximoNivel;
  const NivelIcon = nivel ? getTierIcon(nivel.icone) : Shield;

  return (
    <div data-testid={`section-nivel-${label.toLowerCase().includes("cartão") ? "cartao" : "geral"}`}>
      <div className="flex items-center gap-2 mb-3">
        <IconComponent size={14} className="text-primary" />
        <h3 className="text-primary font-black italic text-[11px] sm:text-xs uppercase tracking-[0.15em]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          {label}
        </h3>
      </div>

      <div className="flex flex-col items-center text-center mb-3 relative z-10">
        <div className="inline-flex p-3 sm:p-4 rounded-full bg-muted border border-border mb-2">
          <NivelIcon size={24} style={{ color: nivel?.cor || "hsl(var(--muted-foreground))" }} />
        </div>
        <p className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase tracking-[0.3em] mb-0.5">
          Sua Classificação
        </p>
        <p
          className="text-xl sm:text-2xl font-black italic tracking-tight uppercase leading-none mb-2"
          style={{ color: nivel?.cor || "hsl(var(--muted-foreground))", fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {nivel?.nome || "SEM NÍVEL"}
        </p>
        {nivel && (
          <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <DollarSign size={10} />
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
              Prêmio: R$ {nivel.premio.toLocaleString("pt-BR")}
            </span>
          </div>
        )}
      </div>

      {proximo && (
        <div className="bg-muted/50 p-3 rounded-xl border border-border relative z-10">
          <div className="flex justify-between items-center gap-1 mb-1.5">
            <p className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <ChevronRight size={9} className="text-primary" /> Rumo ao {proximo.nome}
            </p>
            <span className="text-[10px] sm:text-xs font-black" style={{ color: proximo.cor }}>
              R$ {proximo.premio.toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="flex justify-between items-center gap-1 mb-1.5">
            <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground">
              {performance.faltaParaProximo.toLocaleString("pt-BR")} pts faltantes
            </span>
            <span className="text-[9px] sm:text-[10px] font-black text-primary">
              {performance.progressoNivel.toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden border border-border">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(performance.progressoNivel, 100)}%`,
                backgroundColor: proximo.cor,
              }}
            />
          </div>
        </div>
      )}

      {!proximo && nivel && (
        <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 text-center relative z-10">
          <p className="text-[9px] sm:text-[10px] font-black text-primary uppercase tracking-wider flex items-center justify-center gap-1">
            <Crown size={10} /> Nível Máximo Atingido
          </p>
        </div>
      )}

      {!proximo && !nivel && (
        <div className="bg-muted/50 p-3 rounded-xl border border-border text-center relative z-10">
          <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Níveis não configurados
          </p>
        </div>
      )}
    </div>
  );
}

export default function DashboardVendedorPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"dashboard" | "premiacao" | "regulamento">("dashboard");

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard-vendedor"],
    refetchInterval: 60000,
  });

  const { data: perfData } = useQuery<PerformanceData>({
    queryKey: ["/api/performance", user?.id],
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const { data: regulamentoData } = useQuery<{
    id: number;
    texto: string;
    versao: string;
    data_atualizacao: string;
    criado_por_nome: string | null;
  } | null>({
    queryKey: ["/api/regulamento"],
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

  const nivelGeral = perfData?.geral?.nivelAtual;
  const NivelGeralIcon = nivelGeral ? getTierIcon(nivelGeral.icone) : Shield;

  const RegulationPanel = () => {
    const allCategorias = [
      { key: "geral", label: "Meta Geral", niveis: perfData?.geral?.todosNiveis || [] },
      { key: "cartao", label: "Meta Cartão", niveis: perfData?.cartao?.todosNiveis || [] },
    ];

    const pontosGeral = perfData?.geral?.pontos || 0;
    const pontosCartao = perfData?.cartao?.pontos || 0;
    const nivelAtualGeral = perfData?.geral?.nivelAtual;
    const nivelAtualCartao = perfData?.cartao?.nivelAtual;
    const GeralIcon = nivelAtualGeral ? getTierIcon(nivelAtualGeral.icone) : Scale;
    const CartaoIcon = nivelAtualCartao ? getTierIcon(nivelAtualCartao.icone) : CreditCard;

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-2xl" data-testid="card-pontos-geral">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl" style={{ backgroundColor: nivelAtualGeral ? `${nivelAtualGeral.cor}20` : undefined }}>
                <GeralIcon size={28} style={{ color: nivelAtualGeral?.cor || "hsl(var(--primary))" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pontos Geral</p>
                <p className="text-2xl font-black text-foreground" data-testid="text-pontos-geral">{pontosGeral.toLocaleString("pt-BR")} <span className="text-sm font-medium text-muted-foreground">pts</span></p>
                {nivelAtualGeral && (
                  <p className="text-xs font-bold uppercase tracking-wide" data-testid="text-nivel-geral" style={{ color: nivelAtualGeral.cor }}>{nivelAtualGeral.nome}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl" data-testid="card-pontos-cartao">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl" style={{ backgroundColor: nivelAtualCartao ? `${nivelAtualCartao.cor}20` : undefined }}>
                <CartaoIcon size={28} style={{ color: nivelAtualCartao?.cor || "hsl(var(--primary))" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pontos Cartão</p>
                <p className="text-2xl font-black text-foreground" data-testid="text-pontos-cartao">{pontosCartao.toLocaleString("pt-BR")} <span className="text-sm font-medium text-muted-foreground">pts</span></p>
                {nivelAtualCartao && (
                  <p className="text-xs font-bold uppercase tracking-wide" data-testid="text-nivel-cartao" style={{ color: nivelAtualCartao.cor }}>{nivelAtualCartao.nome}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        {allCategorias.map((cat) => (
          <Card className="rounded-2xl" key={cat.key}>
            <CardContent className="p-5 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    {cat.key === "geral" ? <Scale className="text-primary" size={24} /> : <CreditCard className="text-primary" size={24} />}
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-foreground uppercase tracking-tight">{cat.label}</h2>
                    <p className="text-muted-foreground text-xs sm:text-sm">Níveis e Premiações</p>
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
                      <th className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pontos Mínimos</th>
                      <th className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Prêmio (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm font-semibold">
                    {[...cat.niveis].sort((a, b) => b.ordem - a.ordem).map((nivel) => {
                      const TIcon = getTierIcon(nivel.icone);
                      return (
                        <tr key={nivel.nome}>
                          <td className="px-4 sm:px-6 py-3 sm:py-5 flex items-center gap-3">
                            <TIcon size={18} style={{ color: nivel.cor }} />
                            <span className="text-foreground uppercase text-xs sm:text-sm font-bold tracking-wider">{nivel.nome}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-3 sm:py-5 text-muted-foreground text-xs sm:text-sm">{nivel.pontosMinimos.toLocaleString("pt-BR")} pts</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-5 text-base sm:text-xl text-emerald-600 dark:text-emerald-400 font-black">R$ {nivel.premio.toLocaleString("pt-BR")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const DashboardPanel = () => (
    <div className="space-y-5 sm:space-y-6 relative" style={{ zIndex: 5 }} data-testid="dashboard-vendedor">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 items-stretch">
        <div className="lg:col-span-3 flex">
          <MetaGeralCard performance={perfData?.geral} mesNome={mesNome} metaMensal={data?.metaMensal || 0} />
        </div>
        <div className="lg:col-span-2 flex">
          <MetaCartaoCard performance={perfData?.cartao} mesNome={mesNome} metaCartao={data?.metaCartao || 0} />
        </div>
      </div>

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
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#A855F7" }} />
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
                                      name === "excedente" ? "#A855F7" :
                                      "hsl(var(--muted-foreground))";
                        return [<span style={{ color, fontWeight: 600 }}>{`R$ ${value.toLocaleString("pt-BR")}`}</span>, label];
                      }}
                    />
                    <Bar dataKey="preenchimento" stackId="a" fill="hsl(var(--primary))" barSize={24} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="vazio" stackId="a" fill="hsl(var(--primary) / 0.15)" barSize={24} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="excedente" stackId="a" fill="#A855F7" barSize={24} radius={[4, 4, 0, 0]} />
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
          <Card className="rounded-2xl border-primary/10 h-full" data-testid="card-niveis">
            <CardContent className="p-4 sm:p-5 h-full flex flex-col">
              <NivelSection
                performance={perfData?.geral}
                label="Nível Geral"
                icon={Target}
              />
              <div className="border-t border-border my-4" />
              <NivelSection
                performance={perfData?.cartao}
                label="Nível Cartão"
                icon={CreditCard}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const RegulamentoTextPanel = () => {
    const formatDate = (dateStr: string) => {
      try {
        return new Date(dateStr).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return dateStr;
      }
    };

    if (!regulamentoData) {
      return (
        <div className="max-w-5xl mx-auto">
          <Card className="rounded-2xl">
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg font-medium">Regulamento ainda não disponível</p>
              <p className="text-muted-foreground text-sm mt-2">O regulamento comercial será publicado em breve.</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto">
        <Card className="rounded-2xl">
          <CardContent className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <FileText className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-foreground uppercase tracking-tight">Regulamento Comercial</h2>
                  <p className="text-muted-foreground text-xs sm:text-sm">Regras e condições do programa</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-primary">
                <Tag size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Versão {regulamentoData.versao}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-6 pb-4 border-b border-border text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock size={14} />
                <span>Atualizado em {formatDate(regulamentoData.data_atualizacao)}</span>
              </div>
            </div>

            <div className="space-y-2" data-testid="text-regulamento-vendedor">
              {regulamentoData.texto.split("\n").map((line, i) => (
                <p key={i} className={`text-sm leading-relaxed ${line.trim() === "" ? "h-3" : "text-foreground"}`}>
                  {line || "\u00A0"}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-3 sm:p-5 lg:p-8 overflow-auto">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-0 gap-3 sm:gap-6 relative overflow-visible" style={{ minHeight: user.avatarUrl ? "100px" : "auto", zIndex: 1 }}>
        <div className="flex items-end -space-x-4 sm:-space-x-6 min-w-0">
          <div className="relative shrink-0" style={{ zIndex: 1 }}>
            {user.avatarUrl ? (
              <div className="relative w-[180px] sm:w-[240px] lg:w-[280px]" style={{ marginBottom: "-80px" }}>
                <img 
                  src={user.avatarUrl} 
                  alt={user.name} 
                  className="w-full h-auto mt-[-113px] mb-[-113px] pt-[20px] pb-[20px] pl-[25px] pr-[25px]" 
                  style={{ 
                    filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.15))"
                  }}
                  data-testid="img-vendedor-avatar" 
                />
                {nivelGeral && (
                  <div
                    className="absolute bottom-0 right-2 p-1.5 sm:p-2 rounded-full border-2 border-background"
                    style={{ backgroundColor: nivelGeral.cor, zIndex: 2 }}
                  >
                    <NivelGeralIcon size={12} className="text-background" />
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-primary p-0.5">
                  <Avatar className="w-full h-full">
                    <AvatarFallback className="text-xs sm:text-sm font-bold">
                      {user.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {nivelGeral && (
                  <div
                    className="absolute -bottom-1 -right-1 p-1 sm:p-1.5 rounded-full border-2 border-background"
                    style={{ backgroundColor: nivelGeral.cor }}
                  >
                    <NivelGeralIcon size={8} className="text-background" />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="font-black italic text-2xl sm:text-4xl lg:text-5xl text-foreground tracking-tight uppercase leading-none truncate ml-[-13px] mr-[-13px]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }} data-testid="text-dashboard-title">
                {data?.vendedorNome || user.name}
              </h1>
            </div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground font-bold tracking-wider uppercase mt-0.5 sm:mt-1 ml-[10px] mr-[10px]">
              {mesNome} {data?.mesAno?.split("/")[1]} {nivelGeral ? `\u2022 ${nivelGeral.nome}` : ""}
            </p>
          </div>
        </div>

        <div className="flex bg-muted p-1 rounded-lg border border-border shrink-0" data-testid="nav-toggle">
          <button
            onClick={() => setView("dashboard")}
            className={`px-3 sm:px-5 py-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase transition-all tracking-wider ${
              view === "dashboard"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-view-dashboard"
          >
            Dashboard
          </button>
          <button
            onClick={() => setView("premiacao")}
            className={`px-3 sm:px-5 py-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase transition-all tracking-wider ${
              view === "premiacao"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-view-premiacao"
          >
            Premiação
          </button>
          <button
            onClick={() => setView("regulamento")}
            className={`px-3 sm:px-5 py-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase transition-all tracking-wider ${
              view === "regulamento"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-view-regulamento"
          >
            Regulamento
          </button>
        </div>
      </header>
      {view === "dashboard" && <DashboardPanel />}
      {view === "premiacao" && <RegulationPanel />}
      {view === "regulamento" && <RegulamentoTextPanel />}
      <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 text-[9px] sm:text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Target size={10} className="text-primary/30" />
          <span>Desempenho Individual</span>
        </div>
        <span>Capital GO</span>
      </footer>
    </div>
  );
}
