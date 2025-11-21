import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, FileText, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/lib/auth";

interface UserStats {
  userId: number;
  userName: string;
  userRole: string;
  simulationCount: number;
  totalContractValue: number;
  totalClientRefund: number;
  lastSimulation: string | null;
}

interface Simulation {
  id: number;
  clientName: string;
  agreementName: string;
  operationType: string;
  bank: string;
  termMonths: number;
  totalContractValue: string;
  clientRefund: string;
  createdAt: string;
}

interface StatsResponse {
  totalSimulations: number;
  statsByUser: UserStats[];
  recentSimulations: Simulation[];
}

const OPERATION_TYPES: Record<string, string> = {
  credit_card: "Cartão de Crédito",
  benefit_card: "Cartão Benefício",
  consignado: "Consignado",
};

const ROLE_LABELS: Record<string, string> = {
  master: "Administrador",
  coordenacao: "Coordenador",
  vendedor: "Vendedor",
};

// Admin view component that contains the stats query - only rendered for master users
function DashboardAdminView() {
  const { data: stats, isLoading, error } = useQuery<StatsResponse>({
    queryKey: ["/api/simulations/stats"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Carregando estatísticas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-destructive">Erro ao carregar estatísticas.</div>
      </div>
    );
  }

  const statsByUser = stats?.statsByUser || [];
  const topUsers = [...statsByUser].sort((a, b) => b.simulationCount - a.simulationCount).slice(0, 5);

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Administrativo</h1>
            <p className="text-sm text-muted-foreground">Controle de uso e relatórios</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="card-total-simulations">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Simulações</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-simulations">
                  {stats?.totalSimulations || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Todas as simulações realizadas
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-active-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-users">
                  {statsByUser.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Usuários com simulações
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-contract">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total Contratado</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-contract">
                  {formatCurrency(
                    statsByUser.reduce((sum, user) => sum + user.totalContractValue, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Soma de todas as simulações
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-refund">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Troco</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-refund">
                  {formatCurrency(
                    statsByUser.reduce((sum, user) => sum + user.totalClientRefund, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total devolvido aos clientes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Users Table */}
          <Card data-testid="card-top-users">
            <CardHeader>
              <CardTitle>Top 5 Usuários</CardTitle>
              <p className="text-sm text-muted-foreground">Usuários com mais simulações realizadas</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right">Simulações</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Última Simulação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhuma simulação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    topUsers.map((user) => (
                      <TableRow key={user.userId} data-testid={`row-user-${user.userId}`}>
                        <TableCell className="font-medium">{user.userName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ROLE_LABELS[user.userRole] || user.userRole}</Badge>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-simulations-${user.userId}`}>
                          {user.simulationCount}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(user.totalContractValue)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {user.lastSimulation
                            ? format(new Date(user.lastSimulation), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Simulations Table */}
          <Card data-testid="card-recent-simulations">
            <CardHeader>
              <CardTitle>Simulações Recentes</CardTitle>
              <p className="text-sm text-muted-foreground">Últimas 10 simulações realizadas</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Convênio</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead className="text-right">Prazo</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Troco</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!stats?.recentSimulations || stats.recentSimulations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Nenhuma simulação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.recentSimulations.map((simulation) => (
                      <TableRow key={simulation.id} data-testid={`row-simulation-${simulation.id}`}>
                        <TableCell className="font-medium">{simulation.clientName}</TableCell>
                        <TableCell>{simulation.agreementName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {OPERATION_TYPES[simulation.operationType] || simulation.operationType}
                          </Badge>
                        </TableCell>
                        <TableCell>{simulation.bank}</TableCell>
                        <TableCell className="text-right">{simulation.termMonths} meses</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(parseFloat(simulation.totalContractValue))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(parseFloat(simulation.clientRefund))}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {format(new Date(simulation.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

// Dashboard page shell - only renders admin view for master users
export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Wait for auth to resolve
  if (isAuthLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Only render admin view for masters
  if (user.role !== "master") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-destructive">Você precisa ser administrador para acessar esta página.</div>
      </div>
    );
  }

  // Render the admin view - this component contains the stats query
  return <DashboardAdminView />;
}
