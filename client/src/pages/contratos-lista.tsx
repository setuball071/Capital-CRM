import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Search, Filter, Briefcase, Eye,
  Settings, Trash2, Pencil, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// ─── Status config ────────────────────────────────────────────────────────────

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

// ─── Cores das fases ──────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, {
  box: string; activeBox: string; count: string; label: string; swatch: string;
}> = {
  zinc:   {
    box:       "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/60 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500",
    activeBox: "bg-zinc-100 border-zinc-500 dark:bg-zinc-800 dark:border-zinc-400 ring-2 ring-zinc-400/40",
    count:     "text-zinc-900 dark:text-zinc-50",
    label:     "text-zinc-600 dark:text-zinc-400",
    swatch:    "bg-zinc-400",
  },
  blue:   {
    box:       "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600",
    activeBox: "bg-blue-100 border-blue-500 dark:bg-blue-900/60 dark:border-blue-500 ring-2 ring-blue-400/40",
    count:     "text-blue-900 dark:text-blue-50",
    label:     "text-blue-600 dark:text-blue-400",
    swatch:    "bg-blue-500",
  },
  violet: {
    box:       "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600",
    activeBox: "bg-violet-100 border-violet-500 dark:bg-violet-900/60 dark:border-violet-500 ring-2 ring-violet-400/40",
    count:     "text-violet-900 dark:text-violet-50",
    label:     "text-violet-600 dark:text-violet-400",
    swatch:    "bg-violet-500",
  },
  orange: {
    box:       "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600",
    activeBox: "bg-orange-100 border-orange-500 dark:bg-orange-900/60 dark:border-orange-500 ring-2 ring-orange-400/40",
    count:     "text-orange-900 dark:text-orange-50",
    label:     "text-orange-600 dark:text-orange-400",
    swatch:    "bg-orange-500",
  },
  red:    {
    box:       "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600",
    activeBox: "bg-red-100 border-red-500 dark:bg-red-900/60 dark:border-red-500 ring-2 ring-red-400/40",
    count:     "text-red-900 dark:text-red-50",
    label:     "text-red-600 dark:text-red-400",
    swatch:    "bg-red-500",
  },
  yellow: {
    box:       "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800 hover:border-yellow-400 dark:hover:border-yellow-600",
    activeBox: "bg-yellow-100 border-yellow-500 dark:bg-yellow-900/60 dark:border-yellow-500 ring-2 ring-yellow-400/40",
    count:     "text-yellow-900 dark:text-yellow-50",
    label:     "text-yellow-700 dark:text-yellow-400",
    swatch:    "bg-yellow-400",
  },
  green:  {
    box:       "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600",
    activeBox: "bg-green-100 border-green-500 dark:bg-green-900/60 dark:border-green-500 ring-2 ring-green-400/40",
    count:     "text-green-900 dark:text-green-50",
    label:     "text-green-600 dark:text-green-400",
    swatch:    "bg-green-500",
  },
  rose:   {
    box:       "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600",
    activeBox: "bg-rose-100 border-rose-500 dark:bg-rose-900/60 dark:border-rose-500 ring-2 ring-rose-400/40",
    count:     "text-rose-900 dark:text-rose-50",
    label:     "text-rose-600 dark:text-rose-400",
    swatch:    "bg-rose-500",
  },
};

const COLOR_OPTIONS = Object.keys(PHASE_COLORS);

// ─── Subcomponents ────────────────────────────────────────────────────────────

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

// ─── Tipo de fase ─────────────────────────────────────────────────────────────

interface Phase {
  id: number;
  name: string;
  color: string;
  statuses: string[];
  ordem: number;
}

type FormState = { name: string; color: string; statuses: string[] };
const EMPTY_FORM: FormState = { name: "", color: "blue", statuses: [] };

// ─── Modal de gestão de fases ─────────────────────────────────────────────────

function PhaseManagerDialog({
  open,
  onClose,
  phases,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  phases: Phase[];
  onCreated: (p: FormState) => void;
  onUpdated: (id: number, p: FormState) => void;
  onDeleted: (id: number) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  function startEdit(phase: Phase) {
    setEditingId(phase.id);
    setForm({ name: phase.name, color: phase.color, statuses: phase.statuses });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!form.name.trim()) return;
    if (editingId !== null) {
      onUpdated(editingId, form);
      cancelEdit();
    } else {
      onCreated(form);
      setForm(EMPTY_FORM);
    }
  }

  function toggleStatus(s: string) {
    setForm((f) => ({
      ...f,
      statuses: f.statuses.includes(s) ? f.statuses.filter((x) => x !== s) : [...f.statuses, s],
    }));
  }

  const isEditing = editingId !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Fases</DialogTitle>
        </DialogHeader>

        {/* Lista de fases existentes */}
        <div className="space-y-2">
          {phases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fase cadastrada.</p>
          )}
          {phases.map((phase) => {
            const clr = PHASE_COLORS[phase.color] ?? PHASE_COLORS.blue;
            const isEditThis = editingId === phase.id;
            return (
              <div
                key={phase.id}
                className={`rounded-lg border p-3 transition-colors ${isEditThis ? clr.activeBox : "border-border bg-card"}`}
              >
                {isEditThis ? (
                  <PhaseForm
                    form={form}
                    setForm={setForm}
                    onToggleStatus={toggleStatus}
                    onSubmit={handleSubmit}
                    onCancel={cancelEdit}
                    submitLabel="Salvar"
                  />
                ) : (
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-3 w-3 rounded-full shrink-0 ${clr.swatch}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{phase.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {phase.statuses.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Nenhum status vinculado</span>
                        ) : phase.statuses.map((s) => (
                          <StatusBadge key={s} status={s} />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        onClick={() => startEdit(phase)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirm === phase.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            onClick={() => { onDeleted(phase.id); setDeleteConfirm(null); }}
                            title="Confirmar exclusão"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
                            onClick={() => setDeleteConfirm(null)}
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          onClick={() => setDeleteConfirm(phase.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Formulário de nova fase (escondido quando editando uma existente) */}
        {!isEditing && (
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Nova Fase</p>
            <PhaseForm
              form={form}
              setForm={setForm}
              onToggleStatus={toggleStatus}
              onSubmit={handleSubmit}
              onCancel={() => setForm(EMPTY_FORM)}
              submitLabel="Criar Fase"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PhaseForm({
  form,
  setForm,
  onToggleStatus,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onToggleStatus: (s: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-3">
      <Input
        placeholder="Nome da fase"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="h-8 text-sm"
      />

      {/* Seletor de cor */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Cor</p>
        <div className="flex gap-2 flex-wrap">
          {COLOR_OPTIONS.map((c) => {
            const clr = PHASE_COLORS[c];
            return (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`h-6 w-6 rounded-full transition-all border-2 ${clr.swatch} ${
                  form.color === c
                    ? "border-foreground scale-110 shadow"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Status vinculados */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Status vinculados</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const active = form.statuses.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleStatus(key)}
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border transition-all ${cfg.className} ${
                  active
                    ? "border-current opacity-100"
                    : "border-transparent opacity-40 hover:opacity-70"
                }`}
              >
                {active && <Check className="h-3 w-3 mr-1" />}
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="button" disabled={!form.name.trim()} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type ViewMode = "operacional" | "corretor";

export default function ContratosListaPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [activePhase, setActivePhase] = useState<number | null>(null);
  const [showPhaseManager, setShowPhaseManager] = useState(false);

  const isMaster = !!(user?.isMaster || user?.role === "master");
  const isVendedor = user?.role === "vendedor";
  const [viewMode, setViewMode] = useState<ViewMode>(isVendedor ? "corretor" : "operacional");
  const canCreate = !!(user?.isMaster || ["coordenacao", "vendedor"].includes(user?.role || ""));

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: proposals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/contracts/proposals"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/proposals", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar propostas");
      return res.json();
    },
  });

  const { data: phases = [] } = useQuery<Phase[]>({
    queryKey: ["/api/contracts/phases"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/phases", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar fases");
      return res.json();
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createPhase = useMutation({
    mutationFn: async (data: FormState) => {
      const res = await fetch("/api/contracts/phases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, ordem: phases.length }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/phases"] });
      toast({ title: "Fase criada com sucesso" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const updatePhase = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormState }) => {
      const res = await fetch(`/api/contracts/phases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/phases"] });
      toast({ title: "Fase atualizada" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deletePhase = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/contracts/phases/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error("Erro ao excluir fase");
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/phases"] });
      if (activePhase === id) setActivePhase(null);
      toast({ title: "Fase excluída" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // ── Contagens ──────────────────────────────────────────────────────────────

  const countByStatus: Record<string, number> = {};
  proposals.forEach((p) => {
    countByStatus[p.status] = (countByStatus[p.status] || 0) + 1;
  });

  function countForPhase(phase: Phase) {
    return phase.statuses.reduce((acc, s) => acc + (countByStatus[s] || 0), 0);
  }

  // ── Filtro ────────────────────────────────────────────────────────────────

  const activePhaseDef = phases.find((p) => p.id === activePhase);

  const filtered = proposals.filter((p) => {
    if (viewMode === "corretor" && p.vendorId !== user?.id) return false;

    if (activePhaseDef) {
      if (!activePhaseDef.statuses.includes(p.status)) return false;
    } else if (filterStatus !== "all") {
      if (p.status !== filterStatus) return false;
    }

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.clientName?.toLowerCase().includes(q) ||
      p.clientCpf?.includes(q) ||
      p.bank?.toLowerCase().includes(q) ||
      p.ade?.toLowerCase().includes(q) ||
      p.vendorName?.toLowerCase().includes(q);
    const matchProduct = filterProduct === "all" || p.product === filterProduct;
    return matchSearch && matchProduct;
  });

  const showCorretorCol = viewMode === "operacional";

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
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
          {isMaster && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPhaseManager(true)}
              className="gap-1.5"
            >
              <Settings className="h-4 w-4" />
              Fases
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setLocation("/contratos/nova")} data-testid="button-new-proposal">
              <Plus className="h-4 w-4 mr-2" />
              Nova Proposta
            </Button>
          )}
        </div>
      </div>

      {/* ── Caixas de fases ───────────────────────────────────────────────── */}
      {phases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {phases.map((phase) => {
            const clr = PHASE_COLORS[phase.color] ?? PHASE_COLORS.blue;
            const isActive = activePhase === phase.id;
            const count = countForPhase(phase);
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => setActivePhase(isActive ? null : phase.id)}
                className={`rounded-lg border-2 p-3 text-left transition-all ${
                  isActive ? clr.activeBox : clr.box
                }`}
              >
                <span className={`block text-2xl font-bold leading-none ${clr.count}`}>
                  {count}
                </span>
                <span className={`block text-xs font-medium mt-1.5 leading-tight ${clr.label}`}>
                  {phase.name}
                </span>
                <span className={`block text-[10px] mt-0.5 opacity-60 ${clr.label}`}>
                  Contrato{count !== 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Pills de status (quando nenhuma fase ativa) ───────────────────── */}
      {!activePhaseDef && !isLoading && proposals.length > 0 && (
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

      {/* indicador de fase ativa */}
      {activePhaseDef && (
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${PHASE_COLORS[activePhaseDef.color]?.swatch ?? "bg-blue-500"}`} />
          <span className="text-sm font-medium">{activePhaseDef.name}</span>
          <button
            onClick={() => setActivePhase(null)}
            className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Busca + filtro de produto ──────────────────────────────────────── */}
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

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
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

      {/* ── Modal gestão de fases ─────────────────────────────────────────── */}
      <PhaseManagerDialog
        open={showPhaseManager}
        onClose={() => setShowPhaseManager(false)}
        phases={phases}
        onCreated={(data) => createPhase.mutate(data)}
        onUpdated={(id, data) => updatePhase.mutate({ id, data })}
        onDeleted={(id) => deletePhase.mutate(id)}
      />
    </div>
  );
}
