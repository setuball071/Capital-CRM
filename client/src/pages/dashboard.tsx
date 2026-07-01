import { useQuery } from "@tanstack/react-query";
import { Target, Trophy, Loader2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

interface VendedorRanking {
  userId: number;
  nome: string;
  foto: string | null;
  efetivado: number;            // produção efetivada (financeiro), inclui cartão
  emAndamento: number;          // pipeline (proposals) nos status Em andamento / Aguardando CIP
  emAndamentoContratos: number;
  novo: number;                 // breakdown do efetivado
  portabilidade: number;
  cartao: number;
  contratos: number;
  meta: number;
  percentual: number;
  posicao: number;
}

interface GestorDashboardData {
  equipe: {
    meta: number;
    efetivado: number;
    emAndamento: number;
    novo: number;
    portabilidade: number;
    cartao: number;
    percentual: number;
  };
  ranking: VendedorRanking[];
  statusEmAndamento: string[];
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

function EquipeCard({ efetivado, emAndamento, meta, percentual, novo, portabilidade, cartao }: {
  efetivado: number;
  emAndamento: number;
  meta: number;
  percentual: number;
  novo: number;
  portabilidade: number;
  cartao: number;
}) {
  return (
    <Card className="border-primary/20" data-testid="card-equipe-meta">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target size={16} className="text-primary" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-primary">Meta da Equipe</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Efetivado</div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-equipe-efetivado">
              {formatBRL(efetivado)}
            </div>
            <div className="text-sm text-muted-foreground">Meta: {formatBRL(meta)}</div>
          </div>
          <div className="border-l pl-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Clock size={11} /> Em andamento
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400" data-testid="text-equipe-andamento">
              {formatBRL(emAndamento)}
            </div>
            <div className="text-sm text-muted-foreground">pipeline em aberto</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-primary to-chart-2"
              style={{ width: `${Math.min(percentual, 100)}%` }}
            />
          </div>
          <div className="shrink-0 px-3 py-1 rounded-md border bg-primary/10 border-primary/20">
            <span className="text-lg font-bold text-primary" data-testid="text-equipe-percent">{percentual}%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Contrato Novo</p>
            <p className="text-sm font-bold" data-testid="text-equipe-novo">{formatBRL(novo)}</p>
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Portabilidade</p>
            <p className="text-sm font-bold" data-testid="text-equipe-portabilidade">{formatBRL(portabilidade)}</p>
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cartão</p>
            <p className="text-sm font-bold" data-testid="text-equipe-cartao">{formatBRL(cartao)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankingAvatar({ nome, posicao }: { nome: string; posicao: number }) {
  const initials = getInitials(nome);
  const bgClass =
    posicao === 1 ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 ring-yellow-500/30" :
    posicao === 2 ? "bg-gray-300/20 text-gray-600 dark:text-gray-300 ring-gray-400/30" :
    posicao === 3 ? "bg-orange-500/20 text-orange-700 dark:text-orange-400 ring-orange-500/30" :
    "bg-muted text-muted-foreground ring-border";

  return (
    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ring-1 shrink-0 ${bgClass}`} data-testid={`avatar-ranking-${posicao}`}>
      {initials}
    </div>
  );
}

function RankingTable({ data, statusEmAndamento }: {
  data: VendedorRanking[];
  statusEmAndamento: string[];
}) {
  return (
    <Card data-testid="card-ranking" className="flex flex-col">
      <CardContent className="p-0 flex flex-col flex-1">
        <div className="flex items-center gap-2 p-4 pb-3 border-b shrink-0">
          <Trophy size={18} className="text-primary" />
          <h3 className="font-bold text-base">Ranking dos Corretores</h3>
          <Badge variant="outline" className="ml-auto">{data.length} corretores</Badge>
        </div>

        {statusEmAndamento.length > 0 && (
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-b bg-muted/30">
            <Clock size={11} className="inline mr-1" />
            Em andamento conta os status: <strong>{statusEmAndamento.join(", ")}</strong>
          </div>
        )}

        {data.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Nenhum corretor encontrado
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead className="text-right">Efetivado</TableHead>
                  <TableHead className="text-right">Em andamento</TableHead>
                  <TableHead className="text-right">% Meta</TableHead>
                  <TableHead className="text-right w-16">Ctts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((v) => (
                  <TableRow key={v.userId} data-testid={`row-ranking-${v.userId}`}>
                    <TableCell className="text-center align-top pt-3">
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
                        <RankingAvatar nome={v.nome} posicao={v.posicao} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate" data-testid={`text-ranking-nome-${v.userId}`}>{v.nome}</div>
                          <div className="text-[10px] text-muted-foreground flex gap-2 mt-0.5">
                            <span>Novo: {formatBRL(v.novo || 0)}</span>
                            <span>·</span>
                            <span>Port: {formatBRL(v.portabilidade || 0)}</span>
                            <span>·</span>
                            <span>Cartão: {formatBRL(v.cartao || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm align-top pt-3" data-testid={`text-ranking-efetivado-${v.userId}`}>
                      {formatBRL(v.efetivado)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm align-top pt-3 text-amber-600 dark:text-amber-400" data-testid={`text-ranking-andamento-${v.userId}`}>
                      {formatBRL(v.emAndamento)}
                      {v.emAndamentoContratos > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-1">({v.emAndamentoContratos})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top pt-3">
                      <Badge
                        variant={v.percentual >= 100 ? "default" : "outline"}
                        className={v.percentual >= 100 ? "bg-green-600 text-white no-default-hover-elevate" : ""}
                        data-testid={`text-ranking-pct-${v.userId}`}
                      >
                        {v.percentual}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground align-top pt-3" data-testid={`text-ranking-contratos-${v.userId}`}>
                      {v.contratos}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
          <EquipeCard
            efetivado={data.equipe.efetivado}
            emAndamento={data.equipe.emAndamento}
            meta={data.equipe.meta}
            percentual={data.equipe.percentual}
            novo={data.equipe.novo}
            portabilidade={data.equipe.portabilidade}
            cartao={data.equipe.cartao}
          />

          <RankingTable data={data.ranking} statusEmAndamento={data.statusEmAndamento || []} />
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
