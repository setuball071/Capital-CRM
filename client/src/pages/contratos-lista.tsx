import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Search, Filter, Briefcase, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  CADASTRADA:        { label: "Cadastrada",      className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  EM_ANALISE:        { label: "Em Análise",      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  DIGITADA:          { label: "Digitada",        className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  EM_ANDAMENTO:      { label: "Em Andamento",    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  PENDENTE_CORRETOR: { label: "Pend. Corretor",  className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  PENDENTE_BANCO:    { label: "Pend. Banco",     className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  PAGO:              { label: "Pago",            className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  CANCELADA:         { label: "Cancelada",       className: "bg-red-200 text-red-900 dark:bg-red-950/60 dark:text-red-400" },
  PERDIDA:           { label: "Perdida",         className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};

const PRODUCT_LABEL: Record<string, string> = {
  NOVO: "Novo",
  PORTABILIDADE: "Portabilidade",
  REFINANCIAMENTO: "Refinanciamento",
  CARTAO: "Cartão",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function formatCpfMask(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

function formatMoney(v: string | null | undefined) {
  if (!v) return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type ViewMode = "operacional" | "corretor";

export default function ContratosListaPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");

  const isMaster = !!(user?.isMaster || user?.role === "master");
  const isVendedor = user?.role === "vendedor";

  const [viewMode, setViewMode] = useState<ViewMode>(isVendedor ? "corretor" : "operacional");

  const canCreate = !!(user?.isMaster || ["coordenacao", "vendedor"].includes(user?.role || ""));

  const { data: proposals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/contracts/proposals"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/proposals", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar propostas");
      return res.json();
    },
  });

  // Contagem por status (sobre todas as propostas, antes do filtro de modo)
  const countByStatus: Record<string, number> = {};
  proposals.forEach((p) => {
    countByStatus[p.status] = (countByStatus[p.status] || 0) + 1;
  });

  const filtered = proposals.filter((p) => {
    if (viewMode === "corretor" && p.vendorId !== user?.id) return false;

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.clientName?.toLowerCase().includes(q) ||
      p.clientCpf?.includes(q) ||
      p.bank?.toLowerCase().includes(q) ||
      p.ade?.toLowerCase().includes(q) ||
      p.vendorName?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchProduct = filterProduct === "all" || p.product === filterProduct;
    return matchSearch && matchStatus && matchProduct;
  });

  const showCorretorCol = viewMode === "operacional";

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === "operacional" ? "Todas as propostas" : "Minhas propostas"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMaster && (
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setViewMode("operacional")}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  viewMode === "operacional"
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                Operacional
              </button>
              <button
                onClick={() => setViewMode("corretor")}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  viewMode === "corretor"
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Corretor
              </button>
            </div>
          )}
          {canCreate && (
            <Button onClick={() => setLocation("/contratos/nova")} data-testid="button-new-proposal">
              <Plus className="h-4 w-4 mr-2" />
              Nova Proposta
            </Button>
          )}
        </div>
      </div>

      {/* Pills de status */}
      {!isLoading && proposals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todos ({proposals.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = countByStatus[key] || 0;
            if (count === 0) return null;
            const isActive = filterStatus === key;
            return (
              <button
                key={key}
                onClick={() => setFilterStatus(isActive ? "all" : key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${cfg.className} ${
                  isActive ? "ring-2 ring-current ring-offset-1" : "opacity-80 hover:opacity-100"
                }`}
              >
                {cfg.label} {count}
              </button>
            );
          })}
        </div>
      )}

      {/* Busca + filtro de produto */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, banco, ADE, corretor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-44" data-testid="select-filter-product">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {Object.entries(PRODUCT_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grade / tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Filter className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhuma proposta encontrada</p>
            <p className="text-sm text-muted-foreground">
              {canCreate ? "Clique em Nova Proposta para começar." : "Aguarde novas propostas."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-14">#</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Nome do Cliente</TableHead>
                {showCorretorCol && <TableHead>Corretor</TableHead>}
                <TableHead>Tipo</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead className="text-right">Parcela</TableHead>
                <TableHead className="text-right">Contrato</TableHead>
                <TableHead>ADE</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setLocation(`/contratos/${p.id}`)}
                  data-testid={`row-proposal-${p.id}`}
                >
                  <TableCell className="text-xs text-muted-foreground font-mono">{p.id}</TableCell>
                  <TableCell className="text-sm">{p.clientConvenio || "—"}</TableCell>
                  <TableCell className="text-sm font-mono text-xs">{formatCpfMask(p.clientCpf || "")}</TableCell>
                  <TableCell className="text-sm font-medium">{p.clientName}</TableCell>
                  {showCorretorCol && (
                    <TableCell className="text-sm text-muted-foreground">{p.vendorName || "—"}</TableCell>
                  )}
                  <TableCell className="text-sm">{PRODUCT_LABEL[p.product] || p.product || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.bank || "—"}</TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(p.installmentValue)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatMoney(p.contractValue)}</TableCell>
                  <TableCell className="text-sm font-mono text-xs">{p.ade || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={p.status} />
                      {p.isPaused && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          Pend.
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && filtered.length > 0 && filtered.length < proposals.length && (
        <p className="text-center text-xs text-muted-foreground pb-2">
          Mostrando {filtered.length} de {proposals.length} propostas
        </p>
      )}
    </div>
  );
}
