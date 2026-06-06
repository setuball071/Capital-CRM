import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Search, Filter, ChevronRight, Clock, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  CADASTRADA:        { label: "Cadastrada",    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  EM_ANALISE:        { label: "Em Análise",    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  DIGITADA:          { label: "Digitada",      className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  EM_ANDAMENTO:      { label: "Em Andamento",  className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  PENDENTE_CORRETOR: { label: "Pend. Corretor",className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  PENDENTE_BANCO:    { label: "Pend. Banco",   className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  PAGO:              { label: "Pago",          className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  CANCELADA:         { label: "Cancelada",     className: "bg-red-200 text-red-900 dark:bg-red-950/60 dark:text-red-400" },
};

const PRODUCTS = [
  { value: "NOVO", label: "Novo" },
  { value: "PORTABILIDADE", label: "Portabilidade" },
  { value: "REFINANCIAMENTO", label: "Refinanciamento" },
  { value: "CARTAO", label: "Cartão" },
];

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
  return d.length === 11
    ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
    : cpf;
}

function formatMoney(v: string | null | undefined) {
  if (!v) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContratosListaPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");

  // Busca TODAS as propostas (filtros são client-side para habilitar contagem)
  const { data: proposals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/contracts/proposals"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/proposals", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar propostas");
      return res.json();
    },
  });

  const isOperacional =
    user?.isMaster || ["coordenacao", "operacional"].includes(user?.role || "");

  const canCreate =
    user?.isMaster || ["coordenacao", "vendedor"].includes(user?.role || "");

  // Contagem por status para os pills
  const countByStatus: Record<string, number> = {};
  proposals.forEach((p) => {
    countByStatus[p.status] = (countByStatus[p.status] || 0) + 1;
  });

  // Filtro client-side
  const filtered = proposals.filter((p) => {
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

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            {isOperacional ? "Todas as propostas do tenant" : "Minhas propostas"}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setLocation("/contratos/nova")} data-testid="button-new-proposal">
            <Plus className="h-4 w-4 mr-2" />
            Nova Proposta
          </Button>
        )}
      </div>

      {/* Pills de status com contagem */}
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

      {/* Barra de busca + filtro de produto */}
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
            {PRODUCTS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-md bg-muted animate-pulse" />
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
        <div className="space-y-2">
          {filtered.map((proposal) => {
            const moneyStr = formatMoney(proposal.contractValue);
            const parcelaStr = formatMoney(proposal.installmentValue);

            return (
              <Card
                key={proposal.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setLocation(`/contratos/${proposal.id}`)}
                data-testid={`card-proposal-${proposal.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Linha 1: nome + status */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm truncate">{proposal.clientName}</span>
                        <StatusBadge status={proposal.status} />
                        {proposal.isPaused && (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            Pendente
                          </span>
                        )}
                      </div>

                      {/* Linha 2: CPF · banco · produto · ADE */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{formatCpfMask(proposal.clientCpf)}</span>
                        {proposal.bank && <span>· {proposal.bank}</span>}
                        {proposal.product && (
                          <span>· {PRODUCTS.find((p) => p.value === proposal.product)?.label || proposal.product}</span>
                        )}
                        {proposal.ade && <span>· ADE: {proposal.ade}</span>}
                        {proposal.clientConvenio && <span>· {proposal.clientConvenio}</span>}
                      </div>

                      {/* Linha 3 (operacional): corretor + parcela/prazo */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {isOperacional && proposal.vendorName && (
                          <span className="flex items-center gap-1">
                            <User2 className="h-3 w-3" />
                            {proposal.vendorName}
                          </span>
                        )}
                        {parcelaStr && proposal.term && (
                          <span>
                            {parcelaStr} × {proposal.term}x
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {moneyStr && (
                        <span className="text-sm font-semibold">{moneyStr}</span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {proposal.createdAt
                          ? format(new Date(proposal.createdAt), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground self-center shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rodapé: total filtrado */}
      {!isLoading && filtered.length > 0 && filtered.length < proposals.length && (
        <p className="text-center text-xs text-muted-foreground pb-2">
          Mostrando {filtered.length} de {proposals.length} propostas
        </p>
      )}
    </div>
  );
}
