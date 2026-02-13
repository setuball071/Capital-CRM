import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, TrendingUp, Target, Calendar, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  ReferenceLine,
  Cell,
} from "recharts";

interface DashboardData {
  vendedorNome: string;
  metaMensal: number;
  totalValor: number;
  totalContratos: number;
  percentualMeta: number;
  projecaoMensal: number;
  indicadorCor: "verde" | "amarelo" | "vermelho";
  metaDiaria: number;
  mediaAtual: number;
  diasUteisNoMes: number;
  diasUteisAteHoje: number;
  diasUteisRestantes: number;
  contratosPorDia: Array<{
    dia: string;
    diaCompleto: string;
    quantidade: number;
    valor: number;
    metaDiaria: number;
  }>;
  mesAno: string;
}

const MESES: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
  "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
  "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
};

export default function DashboardVendedorPage() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard-vendedor"],
    refetchInterval: 60000,
  });

  if (!user) return null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
    return formatCurrency(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-2">Erro ao carregar o painel</p>
            <p className="text-xs text-muted-foreground">Tente recarregar a página</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const indicadorBg = data?.indicadorCor === "verde"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
    : data?.indicadorCor === "amarelo"
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
    : "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";

  const indicadorIcon = data?.indicadorCor === "verde"
    ? <ArrowUpRight className="h-4 w-4" />
    : data?.indicadorCor === "amarelo"
    ? <ArrowUpRight className="h-4 w-4" />
    : <ArrowDownRight className="h-4 w-4" />;

  const mesNome = data?.mesAno ? MESES[data.mesAno.split("/")[0]] || "" : "";
  const ano = data?.mesAno ? data.mesAno.split("/")[1] : "";

  const chartData = data?.contratosPorDia || [];

  const projecaoLinhaData = chartData.map((item, idx) => {
    if (data && data.diasUteisAteHoje > 0) {
      const projecaoPorDia = data.projecaoMensal / data.diasUteisNoMes;
      return { ...item, projecaoDiaria: Math.round(projecaoPorDia * 100) / 100 };
    }
    return { ...item, projecaoDiaria: 0 };
  });

  return (
    <div className="flex flex-col h-screen" data-testid="dashboard-vendedor">
      <header className="border-b bg-background p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary">
              <AvatarFallback className="text-sm font-bold">
                {user.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-dashboard-title">
                {getGreeting()}, {user.name.split(" ")[0]}
              </h1>
              <p className="text-xs text-muted-foreground">
                Painel de Performance &middot; {mesNome} {ano}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1" data-testid="badge-dias-restantes">
              <Calendar className="h-3 w-3" />
              {data?.diasUteisRestantes || 0} dias úteis restantes
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto space-y-4 md:space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Card data-testid="card-meta-mensal">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Meta Mensal</p>
                </div>
                <p className="text-xl md:text-2xl font-black" data-testid="text-meta-mensal">
                  {data?.metaMensal ? formatCurrency(data.metaMensal) : "Não definida"}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-fechado">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Total Fechado</p>
                </div>
                <p className="text-xl md:text-2xl font-black" data-testid="text-total-fechado">
                  {formatCurrency(data?.totalValor || 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {data?.totalContratos || 0} contratos
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-percentual">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">% da Meta</p>
                </div>
                <p className="text-xl md:text-2xl font-black" data-testid="text-percentual">
                  {(data?.percentualMeta || 0).toFixed(1)}%
                </p>
                <div className="w-full h-2 bg-muted rounded-full mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-chart-2 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(data?.percentualMeta || 0, 100)}%` }}
                    data-testid="progress-meta"
                  />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-projecao">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Projeção Final</p>
                </div>
                <p className="text-xl md:text-2xl font-black" data-testid="text-projecao">
                  {formatCurrency(data?.projecaoMensal || 0)}
                </p>
                <div className="mt-2">
                  <Badge variant="outline" className={`text-[10px] gap-1 ${indicadorBg}`} data-testid="badge-indicador">
                    {indicadorIcon}
                    {data?.indicadorCor === "verde" ? "Acima da meta" :
                     data?.indicadorCor === "amarelo" ? "Próximo da meta" : "Abaixo da meta"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-grafico-ritmo">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    RITMO DE PRODUÇÃO
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Valor de contratos fechados por dia útil
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-primary" />
                    <span className="text-muted-foreground">Produção/dia</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-0.5 bg-emerald-500" />
                    <span className="text-muted-foreground">Meta diária</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-0.5 border-t-2 border-dashed border-amber-500" />
                    <span className="text-muted-foreground">Projeção</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projecaoLinhaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="dia"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatCurrencyShort(v)}
                      width={60}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => {
                        const label = name === "valor" ? "Produção" :
                                      name === "metaDiaria" ? "Meta diária" :
                                      name === "projecaoDiaria" ? "Projeção diária" : name;
                        return [formatCurrency(value), label];
                      }}
                    />
                    {data?.metaDiaria && data.metaDiaria > 0 && (
                      <ReferenceLine
                        y={data.metaDiaria}
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        strokeDasharray=""
                        label={{
                          value: `Meta: ${formatCurrencyShort(data.metaDiaria)}`,
                          position: "right",
                          fill: "hsl(var(--chart-2))",
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Bar
                      dataKey="valor"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    >
                      {projecaoLinhaData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.valor >= (data?.metaDiaria || 0) && entry.valor > 0
                              ? "hsl(var(--chart-2))"
                              : "hsl(var(--primary))"
                          }
                        />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="projecaoDiaria"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <Card data-testid="card-media-diaria">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide mb-1">Média Diária Atual</p>
                <p className="text-lg font-black" data-testid="text-media-diaria">
                  {formatCurrency(data?.mediaAtual || 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Baseado em {data?.diasUteisAteHoje || 0} dias úteis trabalhados
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-meta-diaria">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide mb-1">Meta Diária Necessária</p>
                <p className="text-lg font-black" data-testid="text-meta-diaria">
                  {formatCurrency(data?.metaDiaria || 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {data?.diasUteisNoMes || 0} dias úteis no mês
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-falta-meta">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide mb-1">Falta para Meta</p>
                <p className="text-lg font-black" data-testid="text-falta-meta">
                  {formatCurrency(Math.max((data?.metaMensal || 0) - (data?.totalValor || 0), 0))}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Em {data?.diasUteisRestantes || 0} dias úteis restantes
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
