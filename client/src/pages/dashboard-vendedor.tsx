import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy,
  Medal,
  Calendar,
  CheckCircle,
  TrendingUp,
  Target,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Cell,
} from "recharts";

const INITIAL_CAMPAIGNS = [
  {
    id: "monthly-feb",
    type: "monthly",
    title: "Meta Mensal - Fevereiro",
    active: true,
    steps: [
      { target: 10000, reward: "Bônus R$ 500" },
      { target: 30000, reward: "Bônus R$ 1.500" },
      { target: 50000, reward: "Bônus R$ 3.000" },
    ],
  },
  {
    id: "special-q1",
    type: "special",
    title: "Campanha Master (Trimestral)",
    active: true,
    steps: [{ target: 150000, reward: "Viagem Internacional" }],
  },
];

const DAILY_PRODUCTION = [
  { day: "01", valor: 2500, acumulado: 2500 },
  { day: "02", valor: 0, acumulado: 2500 },
  { day: "03", valor: 4200, acumulado: 6700 },
  { day: "04", valor: 1500, acumulado: 8200 },
  { day: "05", valor: 8500, acumulado: 16700 },
  { day: "06", valor: 1200, acumulado: 17900 },
  { day: "07", valor: 0, acumulado: 17900 },
  { day: "08", valor: 3100, acumulado: 21000 },
  { day: "09", valor: 5000, acumulado: 26000 },
  { day: "10", valor: 6500, acumulado: 32500 },
];

const RANKING_DATA = [
  { position: 1, name: "Ana Costa", value: 52300 },
  { position: 2, name: "Carlos Mendes", value: 45100 },
  { position: 3, name: "Marcos Silva", value: 38200 },
  { position: 5, name: "Julia Santos", value: 28400 },
];

export default function DashboardVendedorPage() {
  const { user } = useAuth();
  const [campaigns] = useState(INITIAL_CAMPAIGNS);
  const production = 32500;
  const userRank = 4;
  const diasRestantes = 8;

  if (!user) return null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString("pt-BR")}`;

  const monthlyCampaign = campaigns.find(
    (c) => c.active && c.type === "monthly"
  );
  const mainTarget = monthlyCampaign
    ? monthlyCampaign.steps[monthlyCampaign.steps.length - 1].target
    : 50000;
  const percent = (production / mainTarget) * 100;

  const nextRankValue = RANKING_DATA.find(
    (r) => r.position === userRank - 1
  )?.value;
  const gapToNextRank = nextRankValue ? nextRankValue - production : 0;

  return (
    <div className="flex flex-col h-screen" data-testid="dashboard-vendedor">
      <header className="border-b bg-background p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary">
              <AvatarFallback className="text-sm font-bold">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-dashboard-title">
                {getGreeting()}, {user.name.split(" ")[0]}
              </h1>
              <p className="text-xs text-muted-foreground">
                Painel do Vendedor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1" data-testid="badge-rank">
              <Medal className="h-3 w-3" />
              TOP {userRank}
            </Badge>
            <Badge variant="secondary" className="gap-1" data-testid="badge-dias-restantes">
              <Calendar className="h-3 w-3" />
              {diasRestantes} dias úteis restantes
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 max-w-[1400px] mx-auto">
          <div className="lg:col-span-8 space-y-4 md:space-y-6">
            {monthlyCampaign && (
              <Card data-testid="card-meta-principal">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                        {monthlyCampaign.title}
                      </p>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-4xl md:text-5xl font-black" data-testid="text-producao-valor">
                          {formatCurrency(production)}
                        </span>
                        <span className="text-lg text-muted-foreground font-bold">
                          / {mainTarget.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl text-center mb-1">
                        <p className="text-2xl font-black text-primary" data-testid="text-percent">
                          {percent.toFixed(0)}%
                        </p>
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Atingimento Total
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full mb-3">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-chart-2 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(percent, 100)}%` }}
                      data-testid="progress-meta"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                    <span>Início do Mês</span>
                    <span>
                      Meta batida em {formatCurrency(mainTarget)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card data-testid="card-grafico-ritmo">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      RITMO DE PRODUÇÃO
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Volume de contratos por dia digitado
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={DAILY_PRODUCTION}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--card-foreground))",
                        }}
                        formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === "valor" ? "Produção" : "Acumulado",
                        ]}
                      />
                      <Bar
                        dataKey="valor"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        barSize={40}
                      >
                        {DAILY_PRODUCTION.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.valor > 5000
                                ? "hsl(var(--chart-1))"
                                : "hsl(var(--primary))"
                            }
                          />
                        ))}
                      </Bar>
                      <Line
                        type="monotone"
                        dataKey="acumulado"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={2}
                        dot={false}
                        opacity={0.3}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-4 md:space-y-6">
            <Card data-testid="card-ranking">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Medal className="h-4 w-4 text-yellow-500" />
                    POSIÇÃO NO RANKING
                  </span>
                  <span className="text-2xl font-black">#{userRank}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {RANKING_DATA.filter((r) => r.position === userRank - 1).map(
                    (r) => (
                      <div
                        key={r.position}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">
                              {r.position}º
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground">
                            {r.name}
                          </span>
                        </div>
                        <span className="font-bold text-muted-foreground">
                          {formatCurrency(r.value)}
                        </span>
                      </div>
                    )
                  )}

                  <div className="flex items-center justify-between text-xs p-2 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-7 w-7 border border-primary">
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-bold">
                          {userRank}º
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-bold">Você</span>
                    </div>
                    <span className="font-bold text-primary">
                      {formatCurrency(production)}
                    </span>
                  </div>

                  {RANKING_DATA.filter((r) => r.position === userRank + 1).map(
                    (r) => (
                      <div
                        key={r.position}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">
                              {r.position}º
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground">
                            {r.name}
                          </span>
                        </div>
                        <span className="font-bold text-muted-foreground">
                          {formatCurrency(r.value)}
                        </span>
                      </div>
                    )
                  )}

                  {gapToNextRank > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-[10px] text-center text-muted-foreground font-bold uppercase">
                        Faltam {formatCurrency(gapToNextRank)} para subir de
                        posição
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-campanhas">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  CAMPANHAS ATIVAS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {campaigns
                    .filter((c) => c.active)
                    .map((camp) => (
                      <div
                        key={camp.id}
                        className="border-t pt-4 first:border-0 first:pt-0"
                        data-testid={`campaign-${camp.id}`}
                      >
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3 tracking-widest">
                          {camp.title}
                        </p>
                        <div className="space-y-2">
                          {camp.steps.map((step, idx) => {
                            const isAchieved = production >= step.target;
                            const prevTarget =
                              idx > 0 ? camp.steps[idx - 1].target : 0;
                            const isNext =
                              !isAchieved && production >= prevTarget;
                            return (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border transition-all ${
                                  isAchieved
                                    ? "bg-chart-2/10 border-chart-2/30"
                                    : isNext
                                    ? "bg-primary/10 border-primary/30"
                                    : "bg-muted/50 border-border"
                                }`}
                                data-testid={`campaign-step-${camp.id}-${idx}`}
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p
                                      className={`font-bold text-sm ${
                                        isAchieved
                                          ? "text-chart-2"
                                          : ""
                                      }`}
                                    >
                                      {step.reward}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Meta: {formatCurrency(step.target)}
                                    </p>
                                  </div>
                                  {isAchieved && (
                                    <CheckCircle className="h-4 w-4 text-chart-2" />
                                  )}
                                  {isNext && (
                                    <Target className="h-4 w-4 text-primary animate-pulse" />
                                  )}
                                </div>
                                {isNext && (
                                  <p className="mt-1 text-[10px] text-primary font-bold uppercase">
                                    Faltam{" "}
                                    {formatCurrency(step.target - production)}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
