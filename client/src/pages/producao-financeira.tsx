import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  TrendingUp, Clock, CheckCircle2, DollarSign, ChevronRight,
  User, AlertTriangle, Filter, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  try { return format(new Date(v), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return v; }
}

function fmtCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11
    ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
    : cpf;
}

const PRODUCT_LABELS: Record<string, string> = {
  NOVO: "Novo",
  PORTABILIDADE: "Portabilidade",
  REFINANCIAMENTO: "Refinanciamento",
  CARTAO: "Cartão",
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-full p-2 ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Linha de proposta ───────────────────────────────────────────────────────

function ProposalRow({
  p,
  isMaster,
  onClick,
}: {
  p: any;
  isMaster: boolean;
  onClick: () => void;
}) {
  const commVal = isMaster
    ? p.companyCommissionValue
    : p.corretorCommissionValue;

  const commLabel = isMaster ? "Comissão Empresa" : "Meu Repasse";

  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded-md border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium truncate">{p.clientName}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{fmtCpf(p.clientCpf)}</span>
          {p.bank && <span>· {p.bank}</span>}
          {p.product && <span>· {PRODUCT_LABELS[p.product] || p.product}</span>}
          {p.ade && <span>· ADE: {p.ade}</span>}
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <p className="text-xs text-muted-foreground">{commLabel}</p>
        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
          {fmt(commVal)}
        </p>
        <p className="text-xs text-muted-foreground">{fmtDate(p.createdAt)}</p>
      </div>

      {isMaster && p.corretorCommissionValue && (
        <div className="flex flex-col items-end gap-0.5">
          <p className="text-xs text-muted-foreground">Repasse Corretor</p>
          <p className="text-sm font-semibold">{fmt(p.corretorCommissionValue)}</p>
        </div>
      )}

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function ProducaoFinanceiraPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isMaster = user?.isMaster || user?.role === "coordenacao";
  const [filterVendor, setFilterVendor] = useState("all");

  // Busca todos os usuários (para filtro master)
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: isMaster,
    select: (u) => u.filter((x: any) => x.isActive && x.role === "vendedor"),
  });

  // Busca todas as propostas
  const { data: all = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/contracts/proposals"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/proposals", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar propostas");
      return res.json();
    },
  });

  // Aplica filtro de vendedor (master)
  const proposals = isMaster && filterVendor !== "all"
    ? all.filter((p) => String(p.vendorId) === filterVendor)
    : all;

  // Segmentações
  const emAndamento = proposals.filter(
    (p) => !["PAGO", "CANCELADA"].includes(p.status)
  );
  const confirmadas = proposals.filter((p) => p.status === "PAGO");
  const aReceber    = confirmadas.filter((p) => p.commissionStatus === "PENDENTE" || !p.commissionStatus);
  const recebido    = confirmadas.filter((p) => p.commissionStatus === "RECEBIDA");

  // Totais monetários
  function sumField(arr: any[], field: string): number {
    return arr.reduce((acc, p) => acc + (parseFloat(p[field]) || 0), 0);
  }

  const valorEmAndamento  = sumField(emAndamento, isMaster ? "contractValue" : "contractValue");
  const valorConfirmado   = sumField(confirmadas, "contractValue");
  const valorAReceber     = sumField(aReceber, isMaster ? "companyCommissionValue" : "corretorCommissionValue");
  const valorRecebido     = sumField(recebido, isMaster ? "companyCommissionValue" : "corretorCommissionValue");

  const goToProposal = (id: number) => setLocation(`/contratos/${id}`);

  // Componente de lista vazia
  function EmptyState({ label }: { label: string }) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
        <Filter className="h-9 w-9 text-muted-foreground" />
        <p className="font-medium">Nenhuma proposta {label}</p>
        <p className="text-sm text-muted-foreground">As propostas aparecerão aqui conforme avançam no fluxo operacional.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {isMaster ? "Produção & Financeiro" : "Minha Produção"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMaster
              ? "Visão consolidada de toda a equipe"
              : "Suas propostas em andamento e comissões"}
          </p>
        </div>

        {isMaster && (
          <Select value={filterVendor} onValueChange={setFilterVendor}>
            <SelectTrigger className="w-52" data-testid="select-filter-vendor">
              <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Todos os corretores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os corretores</SelectItem>
              {allUsers.map((u: any) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Em Andamento"
          value={String(emAndamento.length)}
          sub={`${fmt(valorEmAndamento)} em contratos`}
          icon={Clock}
          color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        />
        <KpiCard
          title="Produção Confirmada"
          value={String(confirmadas.length)}
          sub={`${fmt(valorConfirmado)} em contratos`}
          icon={CheckCircle2}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <KpiCard
          title="A Receber"
          value={fmt(valorAReceber)}
          sub={`${aReceber.length} contrato${aReceber.length !== 1 ? "s" : ""}`}
          icon={AlertTriangle}
          color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
        />
        <KpiCard
          title="Recebido"
          value={fmt(valorRecebido)}
          sub={`${recebido.length} contrato${recebido.length !== 1 ? "s" : ""}`}
          icon={DollarSign}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="a-receber" className="space-y-4">
        <TabsList>
          <TabsTrigger value="a-receber" data-testid="tab-a-receber">
            A Receber
            {aReceber.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {aReceber.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recebido" data-testid="tab-recebido">
            Recebido
            {recebido.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {recebido.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="em-andamento" data-testid="tab-em-andamento">
            Em Andamento
            {emAndamento.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {emAndamento.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* A Receber */}
        <TabsContent value="a-receber" className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)
          ) : aReceber.length === 0 ? (
            <EmptyState label="aguardando recebimento de comissão" />
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground pb-1">
                <span>{aReceber.length} proposta{aReceber.length !== 1 ? "s" : ""}</span>
                <span className="font-medium text-foreground">Total: {fmt(valorAReceber)}</span>
              </div>
              {aReceber.map((p) => (
                <ProposalRow
                  key={p.id}
                  p={p}
                  isMaster={isMaster}
                  onClick={() => goToProposal(p.id)}
                />
              ))}
            </>
          )}
        </TabsContent>

        {/* Recebido */}
        <TabsContent value="recebido" className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)
          ) : recebido.length === 0 ? (
            <EmptyState label="com comissão confirmada" />
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground pb-1">
                <span>{recebido.length} proposta{recebido.length !== 1 ? "s" : ""}</span>
                <span className="font-medium text-foreground">Total recebido: {fmt(valorRecebido)}</span>
              </div>
              {recebido.map((p) => (
                <ProposalRow
                  key={p.id}
                  p={p}
                  isMaster={isMaster}
                  onClick={() => goToProposal(p.id)}
                />
              ))}
            </>
          )}
        </TabsContent>

        {/* Em Andamento */}
        <TabsContent value="em-andamento" className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)
          ) : emAndamento.length === 0 ? (
            <EmptyState label="em andamento" />
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground pb-1">
                <span>{emAndamento.length} proposta{emAndamento.length !== 1 ? "s" : ""}</span>
                <span className="font-medium text-foreground">{fmt(valorEmAndamento)} em contratos</span>
              </div>
              {emAndamento.map((p) => {
                const STATUS_LABELS: Record<string, string> = {
                  CADASTRADA: "Cadastrada",
                  EM_ANALISE: "Em Análise",
                  DIGITADA: "Digitada",
                  EM_ANDAMENTO: "Em Andamento",
                  PENDENTE_CORRETOR: "Pend. Corretor",
                  PENDENTE_BANCO: "Pend. Banco",
                };
                const STATUS_COLORS: Record<string, string> = {
                  CADASTRADA: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                  EM_ANALISE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                  DIGITADA: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
                  EM_ANDAMENTO: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
                  PENDENTE_CORRETOR: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                  PENDENTE_BANCO: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
                };
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 p-3 rounded-md border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => goToProposal(p.id)}
                  >
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{p.clientName}</p>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || "bg-zinc-100 text-zinc-700"}`}>
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                        {p.isPaused && (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            Pendente
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{fmtCpf(p.clientCpf)}</span>
                        {p.bank && <span>· {p.bank}</span>}
                        {p.product && <span>· {PRODUCT_LABELS[p.product] || p.product}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <p className="text-sm font-semibold">{fmt(p.contractValue)}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(p.createdAt)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
