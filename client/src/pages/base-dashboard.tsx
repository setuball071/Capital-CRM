import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DashboardData {
  metricas: {
    totalClientes: number;
    clientesNovos: number;
    aumentoMargem: number;
    diminuicaoMargem: number;
    aumentoSalario: number;
    clientesPorBanco: Record<string, number>;
    faixasMargem: Record<string, number>;
  };
  competenciaAtual: string | null;
  competenciaAnterior: string | null;
  mensagem?: string;
}

function formatCompetencia(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month}/${year}`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("pt-BR").format(num);
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  variant = "default",
  testId
}: { 
  title: string; 
  value: number | string; 
  icon: React.ElementType;
  description?: string;
  variant?: "default" | "success" | "danger";
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium" data-testid={`${testId}-title`}>{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" data-testid={`${testId}-icon`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`${testId}-value`}>
          {typeof value === "number" ? formatNumber(value) : value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1" data-testid={`${testId}-description`}>{description}</p>
        )}
        {variant === "success" && (
          <Badge variant="secondary" className="mt-2" data-testid={`${testId}-badge`}>
            <TrendingUp className="h-3 w-3 mr-1" />
            Positivo
          </Badge>
        )}
        {variant === "danger" && (
          <Badge variant="destructive" className="mt-2" data-testid={`${testId}-badge`}>
            <TrendingDown className="h-3 w-3 mr-1" />
            Atenção
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function BarChart({ 
  data, 
  title,
  maxItems = 10,
  testId
}: { 
  data: Record<string, number>; 
  title: string;
  maxItems?: number;
  testId: string;
}) {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems);
  
  const maxValue = Math.max(...entries.map(([, v]) => v), 1);
  
  if (entries.length === 0) {
    return (
      <Card data-testid={testId}>
        <CardHeader>
          <CardTitle className="text-base" data-testid={`${testId}-title`}>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid={`${testId}-empty`}>Sem dados disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="text-base" data-testid={`${testId}-title`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([label, value], index) => (
          <div key={label} className="space-y-1" data-testid={`${testId}-row-${index}`}>
            <div className="flex justify-between text-sm">
              <span className="truncate max-w-[200px]" title={label} data-testid={`${testId}-label-${index}`}>{label}</span>
              <span className="font-medium" data-testid={`${testId}-value-${index}`}>{formatNumber(value)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(value / maxValue) * 100}%` }}
                data-testid={`${testId}-bar-${index}`}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function BaseDashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/bases/dashboard"],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Dashboard - Base de Clientes</h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle-loading">Análise comparativa entre competências</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} data-testid={`skeleton-card-${i}`}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Dashboard - Base de Clientes</h1>
        </div>
        <Alert variant="destructive" data-testid="alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription data-testid="alert-error-message">
            Erro ao carregar dados do dashboard. Tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const metricas = data?.metricas || {
    totalClientes: 0,
    clientesNovos: 0,
    aumentoMargem: 0,
    diminuicaoMargem: 0,
    aumentoSalario: 0,
    clientesPorBanco: {},
    faixasMargem: {},
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Dashboard - Base de Clientes</h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">Análise comparativa entre competências</p>
        </div>
        <div className="flex items-center gap-2" data-testid="competencia-info">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Comparando:{" "}
            <Badge variant="secondary" data-testid="badge-competencia-atual">
              {formatCompetencia(data?.competenciaAtual || null)}
            </Badge>
            {" vs "}
            <Badge variant="outline" data-testid="badge-competencia-anterior">
              {formatCompetencia(data?.competenciaAnterior || null)}
            </Badge>
          </span>
        </div>
      </div>

      {data?.mensagem && (
        <Alert data-testid="alert-mensagem">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription data-testid="alert-mensagem-text">{data.mensagem}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total de Clientes"
          value={metricas.totalClientes}
          icon={Users}
          description="Na competência atual"
          testId="card-total-clientes"
        />
        <MetricCard
          title="Clientes Novos"
          value={metricas.clientesNovos}
          icon={UserPlus}
          description="Novos na base"
          variant="success"
          testId="card-clientes-novos"
        />
        <MetricCard
          title="Aumento Margem"
          value={metricas.aumentoMargem}
          icon={TrendingUp}
          description="Margem 70% subiu"
          variant="success"
          testId="card-aumento-margem"
        />
        <MetricCard
          title="Redução Margem"
          value={metricas.diminuicaoMargem}
          icon={TrendingDown}
          description="Margem 70% caiu"
          variant="danger"
          testId="card-reducao-margem"
        />
        <MetricCard
          title="Aumento Salário"
          value={metricas.aumentoSalario}
          icon={DollarSign}
          description="Salário bruto subiu +R$50"
          variant="success"
          testId="card-aumento-salario"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          data={metricas.clientesPorBanco}
          title="Clientes por Banco"
          testId="chart-clientes-banco"
        />
        <BarChart
          data={metricas.faixasMargem}
          title="Distribuição de Margem 70%"
          testId="chart-faixas-margem"
        />
      </div>
    </div>
  );
}
