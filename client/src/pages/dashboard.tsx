import { useQuery } from "@tanstack/react-query";
import { Target, CreditCard, Trophy, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";

interface VendedorRanking {
  userId: number;
  nome: string;
  foto: string | null;
  producaoGeral: number;
  producaoCartao: number;
  contratos: number;
  contratosCartao: number;
  metaGeral: number;
  metaCartao: number;
  percentualMeta: number;
  percentualMetaCartao: number;
  posicao: number;
}

interface GestorDashboardData {
  equipe: {
    metaGeral: number;
    metaCartao: number;
    totalProduzidoGeral: number;
    totalProduzidoCartao: number;
    percentualGeral: number;
    percentualCartao: number;
  };
  rankingGeral: VendedorRanking[];
  rankingCartao: VendedorRanking[];
  mesAno: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function EquipeMetaCard({ label, icon: Icon, produzido, meta, percentual, variant }: {
  label: string;
  icon: typeof Target;
  produzido: number;
  meta: number;
  percentual: number;
  variant: "geral" | "cartao";
}) {
  const isCartao = variant === "cartao";

  return (
    <Card className={`flex-1 min-w-0 ${isCartao ? "bg-[#1a1a2e] dark:bg-[#111122] border-purple-500/20" : "border-primary/20"}`} data-testid={`card-equipe-meta-${variant}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon size={16} className={isCartao ? "text-purple-400" : "text-primary"} />
          <h3 className={`font-bold text-sm uppercase tracking-wider ${isCartao ? "text-purple-300" : "text-primary"}`}>
            {label}
          </h3>
        </div>

        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${isCartao ? "text-purple-400" : ""}`} data-testid={`text-equipe-produzido-${variant}`}>
              {formatBRL(produzido)}
            </div>
            <div className={`text-sm ${isCartao ? "text-gray-500" : "text-muted-foreground"}`}>
              Meta: {formatBRL(meta)}
            </div>
          </div>
          <div className={`shrink-0 px-3 py-1.5 rounded-md border ${isCartao ? "bg-purple-500/20 border-purple-500/30" : "bg-primary/10 border-primary/20"}`}>
            <span className={`text-xl font-bold ${isCartao ? "text-purple-400" : "text-primary"}`} data-testid={`text-equipe-percent-${variant}`}>
              {percentual}%
            </span>
          </div>
        </div>

        <div className={`w-full h-2.5 rounded-full overflow-hidden ${isCartao ? "bg-gray-700" : "bg-muted"}`}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isCartao ? "bg-gradient-to-r from-purple-600 to-purple-400" : "bg-gradient-to-r from-primary to-chart-2"}`}
            style={{ width: `${Math.min(percentual, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RankingTable({ title, icon: Icon, data, type }: {
  title: string;
  icon: typeof Trophy;
  data: VendedorRanking[];
  type: "geral" | "cartao";
}) {
  const isCartao = type === "cartao";

  return (
    <Card data-testid={`card-ranking-${type}`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 p-4 pb-3 border-b">
          <Icon size={18} className={isCartao ? "text-purple-400" : "text-primary"} />
          <h3 className="font-bold text-base">{title}</h3>
          <Badge variant="outline" className="ml-auto">{data.length} corretores</Badge>
        </div>

        {data.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Nenhum corretor encontrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Corretor</TableHead>
                <TableHead className="text-right">{isCartao ? "Prod. Cartao" : "Produção"}</TableHead>
                <TableHead className="text-right">% Meta</TableHead>
                <TableHead className="text-right">Contratos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((v) => {
                const prod = isCartao ? v.producaoCartao : v.producaoGeral;
                const pct = isCartao ? v.percentualMetaCartao : v.percentualMeta;
                const contratos = isCartao ? v.contratosCartao : v.contratos;

                return (
                  <TableRow key={v.userId} data-testid={`row-ranking-${type}-${v.userId}`}>
                    <TableCell className="text-center">
                      {v.posicao <= 3 ? (
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                          v.posicao === 1 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                          v.posicao === 2 ? "bg-gray-300/30 text-gray-600 dark:text-gray-300" :
                          "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                        }`}>
                          {v.posicao}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{v.posicao}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {v.foto && <AvatarImage src={v.foto} alt={v.nome} />}
                          <AvatarFallback className="text-xs">{getInitials(v.nome)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm" data-testid={`text-ranking-nome-${type}-${v.userId}`}>{v.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm" data-testid={`text-ranking-prod-${type}-${v.userId}`}>
                      {formatBRL(prod)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={pct >= 100 ? "default" : "outline"}
                        className={pct >= 100 ? "bg-green-600 text-white no-default-hover-elevate" : ""}
                        data-testid={`text-ranking-pct-${type}-${v.userId}`}
                      >
                        {pct}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground" data-testid={`text-ranking-contratos-${type}-${v.userId}`}>
                      {contratos}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function GestorDashboard() {
  const { data, isLoading, error } = useQuery<GestorDashboardData>({
    queryKey: ["/api/dashboard-gestor"],
    retry: 3,
    retryDelay: 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <div className="text-destructive font-medium">Erro ao carregar dashboard</div>
        <div className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Erro desconhecido"}</div>
      </div>
    );
  }

  if (!data) return null;

  const mesLabel = data.mesAno || "";

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-background p-4 shrink-0">
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard da Equipe</h1>
        <p className="text-sm text-muted-foreground">Produção e rankings do mês {mesLabel}</p>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <EquipeMetaCard
              label="Meta Geral da Equipe"
              icon={Target}
              produzido={data.equipe.totalProduzidoGeral}
              meta={data.equipe.metaGeral}
              percentual={data.equipe.percentualGeral}
              variant="geral"
            />
            <EquipeMetaCard
              label="Meta Cartão da Equipe"
              icon={CreditCard}
              produzido={data.equipe.totalProduzidoCartao}
              meta={data.equipe.metaCartao}
              percentual={data.equipe.percentualCartao}
              variant="cartao"
            />
          </div>

          <RankingTable
            title="Ranking Geral dos Corretores"
            icon={Trophy}
            data={data.rankingGeral}
            type="geral"
          />

          <RankingTable
            title="Ranking Cartão dos Corretores"
            icon={CreditCard}
            data={data.rankingCartao}
            type="cartao"
          />
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <GestorDashboard />;
}
