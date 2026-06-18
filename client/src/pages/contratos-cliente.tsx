import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Users, ListChecks, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const BADGE_COLORS: Record<string, string> = {
  zinc:   "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  red:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  green:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  rose:   "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

interface StatusDef { id: number; key: string; label: string; color: string; }

function formatMoney(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function cpfMask(cpf: string) {
  const d = (cpf || "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

export default function ContratosClientePage() {
  const params = useParams<{ cpf: string }>();
  const cpfParam = (params.cpf || "").replace(/\D/g, "");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canManage = !!(user?.isMaster || ["master", "operacional", "coordenacao"].includes(user?.role || ""));

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");

  const { data: allProposals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/contracts/proposals"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/proposals", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar propostas");
      return res.json();
    },
  });

  const { data: statusList = [] } = useQuery<StatusDef[]>({
    queryKey: ["/api/contracts/statuses"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/statuses", { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });

  const statusConfig = useMemo(() => {
    const m: Record<string, { label: string; className: string }> = {};
    statusList.forEach((s) => { m[s.key] = { label: s.label, className: BADGE_COLORS[s.color] ?? BADGE_COLORS.zinc }; });
    return m;
  }, [statusList]);

  const parcelas = useMemo(
    () => allProposals.filter((p) => (p.clientCpf || "").replace(/\D/g, "") === cpfParam),
    [allProposals, cpfParam],
  );

  const bulkMut = useMutation({
    mutationFn: async ({ ids, status, notes }: { ids: number[]; status: string; notes?: string }) => {
      const res = await fetch("/api/contracts/proposals/bulk-status", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ids, status, notes }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Erro");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals"] });
      setSelected(new Set()); setBulkStatus(""); setBulkNotes("");
      toast({ title: `${data?.updated ?? 0} proposta(s) atualizada(s)` });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-md bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (parcelas.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Users className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Nenhuma proposta encontrada para este cliente</p>
          <Button variant="outline" onClick={() => setLocation("/contratos")}>Voltar à lista</Button>
        </div>
      </div>
    );
  }

  const head = parcelas[0];
  const totalContrato = parcelas.reduce((s, p) => s + (parseFloat(p.contractValue) || 0), 0);
  const totalParcela = parcelas.reduce((s, p) => s + (parseFloat(p.installmentValue) || 0), 0);
  const bancosDestino = Array.from(new Set(parcelas.map((p) => p.bank).filter(Boolean)));
  const statusSet = Array.from(new Set(parcelas.map((p) => p.status)));
  const statusGeral = statusSet.length === 1
    ? (statusConfig[statusSet[0]]?.label ?? statusSet[0])
    : "Vários";

  const ids = parcelas.map((p) => p.id);
  const allSel = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSel = ids.some((id) => selected.has(id));
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allSel) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id));
    return next;
  });
  const toggleOne = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const HeaderItem = ({ label, value }: { label: string; value: any }) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm mt-0.5">{value || "—"}</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLocation("/contratos")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            {head.clientName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operação de portabilidade · {parcelas.length} contrato(s)
          </p>
        </div>
      </div>

      {/* Resumo da operação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumo da Operação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <HeaderItem label="CPF" value={cpfMask(head.clientCpf)} />
          <HeaderItem label="Órgão" value={head.clientConvenio} />
          <HeaderItem label="Corretor" value={head.vendorName} />
          <HeaderItem label="Contratos" value={parcelas.length} />
          <HeaderItem label="Valor total" value={formatMoney(totalContrato)} />
          <HeaderItem label="Soma das parcelas" value={formatMoney(totalParcela)} />
          <HeaderItem label="Banco(s) destino" value={bancosDestino.join(", ")} />
          <HeaderItem label="Status geral" value={statusGeral} />
        </CardContent>
      </Card>

      {/* Ações em lote */}
      {canManage && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
          <span className="flex items-center gap-1.5 text-sm font-medium px-1">
            <ListChecks className="h-4 w-4" />
            {selected.size} selecionada(s)
          </span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="Alterar status para..." /></SelectTrigger>
            <SelectContent>
              {statusList.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} placeholder="Observação (opcional)" className="h-8 text-xs w-56" />
          <Button size="sm" disabled={!bulkStatus || bulkMut.isPending}
            onClick={() => bulkMut.mutate({ ids: Array.from(selected), status: bulkStatus, notes: bulkNotes || undefined })}>
            {bulkMut.isPending ? "Aplicando..." : "Aplicar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
        </div>
      )}

      {/* Grade de parcelas */}
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {canManage && (
                <TableHead className="w-10">
                  <Checkbox checked={allSel ? true : someSel ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Selecionar todas" />
                </TableHead>
              )}
              <TableHead className="w-14">#</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Banco Origem</TableHead>
              <TableHead className="text-right">Parcela</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Prazo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcelas.map((p) => {
              const meta = p.clientMeta || {};
              const saldo = meta.saldoDevedor ?? p.contractValue;
              const cfg = statusConfig[p.status] ?? { label: p.status, className: BADGE_COLORS.zinc };
              return (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setLocation(`/contratos/${p.id}`)}>
                  {canManage && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} aria-label={`Selecionar ${p.id}`} />
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-muted-foreground font-mono">{p.id}</TableCell>
                  <TableCell className="text-sm font-medium">{p.bank || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{meta.bancoOrigem || "—"}</TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(p.installmentValue)}</TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(saldo)}</TableCell>
                  <TableCell className="text-right text-sm">{p.term ? `${p.term}x` : "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.className}`}>{cfg.label}</span>
                  </TableCell>
                  <TableCell><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {parcelas.length} contrato(s) · Parcelas {formatMoney(totalParcela)} · Total {formatMoney(totalContrato)}
      </p>
    </div>
  );
}
