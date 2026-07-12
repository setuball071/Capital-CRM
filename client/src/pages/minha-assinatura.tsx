import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_LABELS } from "@shared/schema";
import {
  CreditCard,
  CheckCircle,
  XCircle,
  PauseCircle,
  RefreshCw,
  Calendar,
  Mail,
  Package,
  Receipt,
} from "lucide-react";

function cicloSufixo(ciclo: string | null | undefined) {
  return ciclo === "anual" ? "/ano" : "/mês";
}

function formatPlanoValor(valor: number | null | undefined, ciclo?: string | null) {
  if (valor == null) return "—";
  if (Number(valor) === 0) return "Grátis";
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + cicloSufixo(ciclo);
}

const PLAN_FEATURES: Record<string, string[]> = {
  trial: ["Acesso completo por 7 dias", "Sem necessidade de cartão"],
  basico: ["Consulta individual avulsa", "Lista: até 500 nomes/mês", "Dados: margem, banco, matrícula", "Simulação de crédito", "1 usuário"],
  profissional: ["Tudo do Básico", "Lista: até 1.000 nomes/mês", "Contracheque SIAPE completo", "Telefones atualizados", "Pipeline CRM", "Agenda e Follow-up", "1 usuário"],
  expert: ["Tudo do Profissional", "Lista: até 5.000 nomes/mês", "Campanhas automáticas", "Relatórios de produção", "Roteiros de abordagem (IA)", "Suporte prioritário", "1 usuário"],
  enterprise: ["Múltiplos usuários", "Volume customizado", "SLA garantido", "Treinamento da equipe", "Gerente de conta dedicado"],
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any; color: string }> = {
  trial: { label: "Trial ativo", variant: "secondary", icon: RefreshCw, color: "text-yellow-600" },
  active: { label: "Ativa", variant: "default", icon: CheckCircle, color: "text-green-600" },
  suspended: { label: "Suspensa", variant: "destructive", icon: PauseCircle, color: "text-red-600" },
  cancelled: { label: "Cancelada", variant: "outline", icon: XCircle, color: "text-muted-foreground" },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function daysLeft(d: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function MinhaAssinaturaPage() {
  const { data: sub, isLoading } = useQuery<any>({
    queryKey: ["/api/subscription"],
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold">Sem assinatura ativa</h2>
            <p className="text-muted-foreground text-sm">
              Entre em contato com o suporte para contratar um plano.
            </p>
            <a
              href="mailto:contato@sistemacapital.com.br"
              className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:underline"
            >
              <Mail className="h-4 w-4" />
              contato@sistemacapital.com.br
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.trial;
  const Icon = statusCfg.icon;
  const trialLeft = sub.status === "trial" ? daysLeft(sub.trial_ends_at) : null;
  const periodLeft = sub.status === "active" ? daysLeft(sub.current_period_end) : null;
  const features = PLAN_FEATURES[sub.plan] || [];
  const lastPayment = sub.payment_history?.length > 0
    ? sub.payment_history[sub.payment_history.length - 1]
    : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Minha Assinatura
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Detalhes do seu plano atual
        </p>
      </div>

      {/* Status principal */}
      <Card className={sub.status === "suspended" ? "border-red-300" : sub.status === "active" ? "border-green-300" : ""}>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold" data-testid="text-plano-nome">{sub.plano_nome || (PLAN_LABELS as Record<string, string>)[sub.plan] || sub.plan}</span>
                <Badge variant={statusCfg.variant} className="gap-1 text-sm">
                  <Icon className="h-3.5 w-3.5" />
                  {statusCfg.label}
                </Badge>
              </div>
              <div className="text-muted-foreground text-sm" data-testid="text-plano-valor">{formatPlanoValor(sub.plano_valor, sub.plano_ciclo)}</div>
            </div>

            <div className="space-y-1 text-right">
              {sub.status === "trial" && trialLeft !== null && (
                <div className={`text-sm font-semibold ${trialLeft <= 2 ? "text-red-600" : "text-yellow-600"}`}>
                  {trialLeft <= 0 ? "Trial expirado" : `${trialLeft} dias de trial restantes`}
                </div>
              )}
              {sub.status === "active" && periodLeft !== null && (
                <div className={`text-sm ${periodLeft <= 5 ? "text-orange-500" : "text-muted-foreground"}`}>
                  Renova em {formatDate(sub.current_period_end)}
                </div>
              )}
              {sub.status === "suspended" && (
                <div className="text-sm text-red-600 font-medium">
                  Acesso suspenso — entre em contato
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Período atual
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Início</span>
              <span className="font-medium">{formatDate(sub.current_period_start)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fim</span>
              <span className="font-medium">{formatDate(sub.current_period_end)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
              Trial
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expira em</span>
              <span className="font-medium">{formatDate(sub.trial_ends_at)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funcionalidades do plano */}
      {features.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">O que está incluído no seu plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Serviços inclusos no plano */}
      {sub.servicos_inclusos?.length > 0 && (
        <Card data-testid="card-servicos-inclusos">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Serviços inclusos no seu plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {sub.servicos_inclusos.map((s: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm" data-testid={`servico-incluso-${i}`}>
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>{s.produto}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Adicionais contratados */}
      {sub.adicionais?.length > 0 && (
        <Card data-testid="card-adicionais">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Adicionais contratados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {sub.adicionais.map((a: any) => (
                <li key={a.id} className="flex items-center justify-between text-sm" data-testid={`adicional-${a.id}`}>
                  <span className="font-medium">{a.produto ?? "Serviço"}</span>
                  <span className="text-muted-foreground text-xs">Contratado em {formatDate(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Última fatura */}
      {lastPayment && (
        <Card data-testid="card-ultima-fatura">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Última fatura
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{formatDate(lastPayment.date)}</span>
              <span className="font-medium">
                {typeof lastPayment.amount === "number"
                  ? lastPayment.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "—"}
              </span>
              {lastPayment.invoiceUrl && (
                <a
                  href={lastPayment.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:underline"
                  data-testid="link-ver-fatura"
                >
                  Ver fatura
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contato */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-muted-foreground">
            Deseja fazer upgrade, cancelar ou tem dúvidas sobre sua assinatura?
          </p>
          <a
            href="mailto:contato@sistemacapital.com.br"
            className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:underline mt-1"
          >
            <Mail className="h-4 w-4" />
            contato@sistemacapital.com.br
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
