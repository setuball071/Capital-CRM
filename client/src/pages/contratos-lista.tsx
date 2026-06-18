import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Search, Filter, Briefcase, Eye,
  Settings, Trash2, Pencil, Check, X, Lock, MoreHorizontal,
  ListChecks, Hash, MessageSquare, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cipInfo, type CipState } from "@/lib/cip";

// Tag e cor de linha do contador CIP (portabilidade)
const CIP_BADGE: Record<CipState, string> = {
  ok:   "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  near: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  due:  "bg-amber-300 text-amber-950 dark:bg-amber-600/60 dark:text-amber-50 font-semibold",
};
const CIP_ROW: Record<CipState, string> = {
  ok:   "",
  near: "bg-amber-50 dark:bg-amber-950/20",
  due:  "bg-amber-100 dark:bg-amber-900/30",
};

// ─── Paleta compartilhada entre badges e caixas de fase ──────────────────────

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

const PHASE_COLORS: Record<string, {
  box: string; activeBox: string; count: string; label: string; swatch: string;
}> = {
  zinc:   {
    box:       "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/60 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500",
    activeBox: "bg-zinc-100 border-zinc-500 dark:bg-zinc-800 dark:border-zinc-400 ring-2 ring-zinc-400/40",
    count: "text-zinc-900 dark:text-zinc-50", label: "text-zinc-600 dark:text-zinc-400", swatch: "bg-zinc-400",
  },
  blue:   {
    box:       "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600",
    activeBox: "bg-blue-100 border-blue-500 dark:bg-blue-900/60 dark:border-blue-500 ring-2 ring-blue-400/40",
    count: "text-blue-900 dark:text-blue-50", label: "text-blue-600 dark:text-blue-400", swatch: "bg-blue-500",
  },
  violet: {
    box:       "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600",
    activeBox: "bg-violet-100 border-violet-500 dark:bg-violet-900/60 dark:border-violet-500 ring-2 ring-violet-400/40",
    count: "text-violet-900 dark:text-violet-50", label: "text-violet-600 dark:text-violet-400", swatch: "bg-violet-500",
  },
  orange: {
    box:       "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600",
    activeBox: "bg-orange-100 border-orange-500 dark:bg-orange-900/60 dark:border-orange-500 ring-2 ring-orange-400/40",
    count: "text-orange-900 dark:text-orange-50", label: "text-orange-600 dark:text-orange-400", swatch: "bg-orange-500",
  },
  red:    {
    box:       "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600",
    activeBox: "bg-red-100 border-red-500 dark:bg-red-900/60 dark:border-red-500 ring-2 ring-red-400/40",
    count: "text-red-900 dark:text-red-50", label: "text-red-600 dark:text-red-400", swatch: "bg-red-500",
  },
  yellow: {
    box:       "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800 hover:border-yellow-400 dark:hover:border-yellow-600",
    activeBox: "bg-yellow-100 border-yellow-500 dark:bg-yellow-900/60 dark:border-yellow-500 ring-2 ring-yellow-400/40",
    count: "text-yellow-900 dark:text-yellow-50", label: "text-yellow-700 dark:text-yellow-400", swatch: "bg-yellow-400",
  },
  green:  {
    box:       "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600",
    activeBox: "bg-green-100 border-green-500 dark:bg-green-900/60 dark:border-green-500 ring-2 ring-green-400/40",
    count: "text-green-900 dark:text-green-50", label: "text-green-600 dark:text-green-400", swatch: "bg-green-500",
  },
  rose:   {
    box:       "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600",
    activeBox: "bg-rose-100 border-rose-500 dark:bg-rose-900/60 dark:border-rose-500 ring-2 ring-rose-400/40",
    count: "text-rose-900 dark:text-rose-50", label: "text-rose-600 dark:text-rose-400", swatch: "bg-rose-500",
  },
};

const COLOR_OPTIONS = Object.keys(PHASE_COLORS);

const PRODUCT_LABEL: Record<string, string> = {
  NOVO: "Novo",
  PORTABILIDADE: "Portabilidade",
  REFINANCIAMENTO: "Refinanciamento",
  CARTAO: "Cartão",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface StatusDef {
  id: number;
  key: string;
  label: string;
  color: string;
  ordem: number;
  isDefault: boolean;
  allowsVendorEdit: boolean;
  isFinal: boolean;
  returnStatusKey: string | null;
}

interface Phase {
  id: number;
  name: string;
  color: string;
  statuses: string[];
  ordem: number;
}

type PhaseFormT = { name: string; color: string; statuses: string[] };
type StatusFormT = { label: string; color: string; allowsVendorEdit: boolean; isFinal: boolean; returnStatusKey: string };
const EMPTY_PHASE: PhaseFormT = { name: "", color: "blue", statuses: [] };
const EMPTY_STATUS: StatusFormT = { label: "", color: "zinc", allowsVendorEdit: false, isFinal: false, returnStatusKey: "" };

// Status que encerram a operação (fallback p/ padrões, além da flag isFinal)
const FINAL_FALLBACK = ["PAGO", "CANCELADA", "PERDIDA"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateKey(label: string): string {
  return label
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
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

// ─── ColorPicker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full transition-all border-2 ${PHASE_COLORS[c].swatch} ${
            value === c ? "border-foreground scale-110 shadow" : "border-transparent opacity-60 hover:opacity-100"
          }`}
        />
      ))}
    </div>
  );
}

// ─── StatusBadge (mapa dinâmico) ─────────────────────────────────────────────

function StatusBadge({
  status,
  configMap,
}: {
  status: string;
  configMap: Record<string, { label: string; className: string }>;
}) {
  const cfg = configMap[status] ?? { label: status, className: BADGE_COLORS.zinc };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Dialog de gestão (Fases + Status) ───────────────────────────────────────

function PhaseManagerDialog({
  open, onClose, phases, statusList, statusConfigMap,
  onCreatedPhase, onUpdatedPhase, onDeletedPhase,
  onCreatedStatus, onUpdatedStatus, onDeletedStatus,
}: {
  open: boolean;
  onClose: () => void;
  phases: Phase[];
  statusList: StatusDef[];
  statusConfigMap: Record<string, { label: string; className: string }>;
  onCreatedPhase: (f: PhaseFormT) => void;
  onUpdatedPhase: (id: number, f: PhaseFormT) => void;
  onDeletedPhase: (id: number) => void;
  onCreatedStatus: (f: StatusFormT & { key: string }) => void;
  onUpdatedStatus: (id: number, f: StatusFormT) => void;
  onDeletedStatus: (id: number) => void;
}) {
  const [tab, setTab] = useState<"phases" | "statuses">("phases");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Contratos</DialogTitle>
        </DialogHeader>

        <div className="flex border-b mb-4">
          {(["phases", "statuses"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "phases" ? "Fases" : "Status"}
            </button>
          ))}
        </div>

        {tab === "phases" && (
          <PhasesTab
            phases={phases}
            statusList={statusList}
            statusConfigMap={statusConfigMap}
            onCreated={onCreatedPhase}
            onUpdated={onUpdatedPhase}
            onDeleted={onDeletedPhase}
          />
        )}

        {tab === "statuses" && (
          <StatusesTab
            statusList={statusList}
            onCreated={onCreatedStatus}
            onUpdated={onUpdatedStatus}
            onDeleted={onDeletedStatus}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Aba Fases ────────────────────────────────────────────────────────────────

function PhasesTab({
  phases, statusList, statusConfigMap, onCreated, onUpdated, onDeleted,
}: {
  phases: Phase[];
  statusList: StatusDef[];
  statusConfigMap: Record<string, { label: string; className: string }>;
  onCreated: (f: PhaseFormT) => void;
  onUpdated: (id: number, f: PhaseFormT) => void;
  onDeleted: (id: number) => void;
}) {
  const [form, setForm] = useState<PhaseFormT>(EMPTY_PHASE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  function startEdit(p: Phase) {
    setEditingId(p.id);
    setForm({ name: p.name, color: p.color, statuses: p.statuses });
  }
  function cancelEdit() { setEditingId(null); setForm(EMPTY_PHASE); }

  function handleSubmit() {
    if (!form.name.trim()) return;
    if (editingId !== null) { onUpdated(editingId, form); cancelEdit(); }
    else { onCreated(form); setForm(EMPTY_PHASE); }
  }

  function toggleStatus(key: string) {
    setForm((f) => ({
      ...f,
      statuses: f.statuses.includes(key) ? f.statuses.filter((s) => s !== key) : [...f.statuses, key],
    }));
  }

  return (
    <div className="space-y-2">
      {phases.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fase cadastrada.</p>
      )}
      {phases.map((phase) => {
        const clr = PHASE_COLORS[phase.color] ?? PHASE_COLORS.blue;
        const isEditThis = editingId === phase.id;
        return (
          <div key={phase.id} className={`rounded-lg border p-3 transition-colors ${isEditThis ? clr.activeBox : "border-border bg-card"}`}>
            {isEditThis ? (
              <PhaseFormFields
                form={form} setForm={setForm} statusList={statusList}
                onToggleStatus={toggleStatus} onSubmit={handleSubmit} onCancel={cancelEdit} submitLabel="Salvar"
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
                      <StatusBadge key={s} status={s} configMap={statusConfigMap} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => startEdit(phase)} title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {deleteConfirm === phase.id ? (
                    <div className="flex items-center gap-1">
                      <button className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" onClick={() => { onDeleted(phase.id); setDeleteConfirm(null); }}>
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors" onClick={() => setDeleteConfirm(null)}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button className="rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" onClick={() => setDeleteConfirm(phase.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {editingId === null && (
        <div className="border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Nova Fase</p>
          <PhaseFormFields
            form={form} setForm={setForm} statusList={statusList}
            onToggleStatus={toggleStatus} onSubmit={handleSubmit} onCancel={() => setForm(EMPTY_PHASE)} submitLabel="Criar Fase"
          />
        </div>
      )}
    </div>
  );
}

function PhaseFormFields({
  form, setForm, statusList, onToggleStatus, onSubmit, onCancel, submitLabel,
}: {
  form: PhaseFormT;
  setForm: React.Dispatch<React.SetStateAction<PhaseFormT>>;
  statusList: StatusDef[];
  onToggleStatus: (key: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-3">
      <Input placeholder="Nome da fase" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Cor</p>
        <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Status vinculados</p>
        <div className="flex flex-wrap gap-1.5">
          {statusList.map((s) => {
            const active = form.statuses.includes(s.key);
            const badgeCls = BADGE_COLORS[s.color] ?? BADGE_COLORS.zinc;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onToggleStatus(s.key)}
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border transition-all ${badgeCls} ${
                  active ? "border-current opacity-100" : "border-transparent opacity-40 hover:opacity-70"
                }`}
              >
                {active && <Check className="h-3 w-3 mr-1" />}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="button" disabled={!form.name.trim()} onClick={onSubmit}>{submitLabel}</Button>
      </div>
    </div>
  );
}

// ─── Aba Status ───────────────────────────────────────────────────────────────

function StatusesTab({
  statusList, onCreated, onUpdated, onDeleted,
}: {
  statusList: StatusDef[];
  onCreated: (f: StatusFormT & { key: string }) => void;
  onUpdated: (id: number, f: StatusFormT) => void;
  onDeleted: (id: number) => void;
}) {
  const [form, setForm] = useState<StatusFormT>(EMPTY_STATUS);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const derivedKey = generateKey(form.label);

  function startEdit(s: StatusDef) {
    setEditingId(s.id);
    setForm({ label: s.label, color: s.color, allowsVendorEdit: s.allowsVendorEdit, isFinal: s.isFinal, returnStatusKey: s.returnStatusKey || "" });
  }
  function cancelEdit() { setEditingId(null); setForm(EMPTY_STATUS); }

  function handleSubmit() {
    if (!form.label.trim()) return;
    if (editingId !== null) { onUpdated(editingId, form); cancelEdit(); }
    else { onCreated({ ...form, key: derivedKey }); setForm(EMPTY_STATUS); }
  }

  const VendorEditToggle = (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">Permite edição do corretor</p>
        <p className="text-xs text-muted-foreground">Neste status o corretor volta a poder editar a proposta.</p>
      </div>
      <Switch checked={form.allowsVendorEdit} onCheckedChange={(v) => setForm((f) => ({ ...f, allowsVendorEdit: v }))} />
    </div>
  );

  const FinalToggle = (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">Finaliza a operação</p>
        <p className="text-xs text-muted-foreground">Encerra o acompanhamento (ex.: contador CIP para de alertar).</p>
      </div>
      <Switch checked={form.isFinal} onCheckedChange={(v) => setForm((f) => ({ ...f, isFinal: v }))} />
    </div>
  );

  const ReturnSelect = (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-sm font-medium">Pendência do corretor — ao regularizar, mover para</p>
      <p className="text-xs text-muted-foreground mb-2">
        Defina para tornar este status uma pendência: o corretor verá o botão "Pendência regularizada" e, ao clicar, a proposta vai para o status escolhido.
      </p>
      <select
        className="w-full border rounded px-2 py-1 text-sm bg-background"
        value={form.returnStatusKey}
        onChange={(e) => setForm((f) => ({ ...f, returnStatusKey: e.target.value }))}
      >
        <option value="">— não é pendência do corretor —</option>
        {statusList.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-2">
      {statusList.map((s) => {
        const badgeCls = BADGE_COLORS[s.color] ?? BADGE_COLORS.zinc;
        const isEditThis = editingId === s.id;
        return (
          <div key={s.id} className={`rounded-lg border p-3 transition-colors ${isEditThis ? "border-border bg-muted/30" : "border-border bg-card"}`}>
            {isEditThis ? (
              <div className="space-y-3">
                <Input placeholder="Nome do status" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="h-8 text-sm" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Cor</p>
                  <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
                </div>
                {VendorEditToggle}
                {FinalToggle}
                {ReturnSelect}
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" type="button" onClick={cancelEdit}>Cancelar</Button>
                  <Button size="sm" type="button" disabled={!form.label.trim()} onClick={handleSubmit}>Salvar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badgeCls}`}>{s.label}</span>
                <span className="text-xs text-muted-foreground font-mono">{s.key}</span>
                {s.allowsVendorEdit && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400" title="Corretor pode editar neste status">
                    <Pencil className="h-3 w-3" /> corretor
                  </span>
                )}
                {(s.isFinal || FINAL_FALLBACK.includes(s.key)) && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400" title="Finaliza a operação — para o acompanhamento">
                    <Check className="h-3 w-3" /> final
                  </span>
                )}
                {s.isDefault && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> padrão</span>
                )}
                {!s.isDefault ? (
                  <div className="ml-auto flex gap-1">
                    <button className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => startEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {deleteConfirm === s.id ? (
                      <div className="flex items-center gap-1">
                        <button className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" onClick={() => { onDeleted(s.id); setDeleteConfirm(null); }}>
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors" onClick={() => setDeleteConfirm(null)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button className="rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" onClick={() => setDeleteConfirm(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => startEdit(s)} title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {editingId === null && (
        <div className="border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Novo Status</p>
          <div className="space-y-3">
            <Input placeholder="Nome do status (ex: Em Produção)" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="h-8 text-sm" />
            {form.label && (
              <p className="text-xs text-muted-foreground">Código: <span className="font-mono">{derivedKey || "—"}</span></p>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Cor</p>
              <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
            </div>
            {VendorEditToggle}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" type="button" onClick={() => setForm(EMPTY_STATUS)}>Limpar</Button>
              <Button size="sm" type="button" disabled={!form.label.trim() || !derivedKey} onClick={handleSubmit}>Criar Status</Button>
            </div>
          </div>
        </div>
      )}
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
  const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem("contratos_filterStatus") || "all");
  const [filterProduct, setFilterProduct] = useState("all");
  // Fase ativa persiste na sessão: ao abrir um contrato e voltar, mantém o filtro
  const [activePhase, setActivePhase] = useState<number | null>(() => {
    const s = sessionStorage.getItem("contratos_activePhase");
    return s ? Number(s) : null;
  });
  const [showPhaseManager, setShowPhaseManager] = useState(false);

  useEffect(() => {
    if (activePhase == null) sessionStorage.removeItem("contratos_activePhase");
    else sessionStorage.setItem("contratos_activePhase", String(activePhase));
  }, [activePhase]);

  useEffect(() => {
    if (filterStatus === "all") sessionStorage.removeItem("contratos_filterStatus");
    else sessionStorage.setItem("contratos_filterStatus", filterStatus);
  }, [filterStatus]);

  // Seleção em lote + diálogo de ação rápida
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [quick, setQuick] = useState<{ id: number; mode: "ade" | "obs" | "status"; status?: string } | null>(null);
  const [quickValue, setQuickValue] = useState("");

  const isMaster = !!(user?.isMaster || user?.role === "master");
  // Operacional e Administrador (role master) têm a MESMA visão/gestão do master em contratos
  const canManageContracts = !!(user?.isMaster || ["master", "operacional"].includes(user?.role || ""));
  const isVendedor = user?.role === "vendedor";
  const isOperacional = !!(user?.isMaster || ["coordenacao", "operacional", "master"].includes(user?.role || ""));
  const [viewMode, setViewMode] = useState<ViewMode>(isVendedor ? "corretor" : "operacional");
  const canCreate = !!(user?.isMaster || ["master", "coordenacao", "operacional", "vendedor"].includes(user?.role || ""));

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: proposals = [], isLoading } = useQuery<any[]>({
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
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: phases = [] } = useQuery<Phase[]>({
    queryKey: ["/api/contracts/phases"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/phases", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const statusConfigMap = useMemo(() => {
    const map: Record<string, { label: string; className: string }> = {};
    statusList.forEach((s) => {
      map[s.key] = { label: s.label, className: BADGE_COLORS[s.color] ?? BADGE_COLORS.zinc };
    });
    return map;
  }, [statusList]);

  const invalidateProposals = () => queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals"] });

  // ── Mutations fases ────────────────────────────────────────────────────────

  const createPhase = useMutation({
    mutationFn: async (data: PhaseFormT) => {
      const res = await fetch("/api/contracts/phases", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...data, ordem: phases.length }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/contracts/phases"] }); toast({ title: "Fase criada" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const updatePhase = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PhaseFormT }) => {
      const res = await fetch(`/api/contracts/phases/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/contracts/phases"] }); toast({ title: "Fase atualizada" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deletePhase = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/contracts/phases/${id}`, { method: "DELETE", credentials: "include" }); },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/phases"] });
      if (activePhase === id) setActivePhase(null);
      toast({ title: "Fase excluída" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // ── Mutations status ───────────────────────────────────────────────────────

  const createStatus = useMutation({
    mutationFn: async (data: StatusFormT & { key: string }) => {
      const res = await fetch("/api/contracts/statuses", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/contracts/statuses"] }); toast({ title: "Status criado" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: StatusFormT }) => {
      const res = await fetch(`/api/contracts/statuses/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/contracts/statuses"] }); toast({ title: "Status atualizado" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/contracts/statuses/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 204) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/contracts/statuses"] }); toast({ title: "Status excluído" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // ── Mutations de movimentação (rápida + lote) ──────────────────────────────

  const quickStatusMut = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const action = ["CANCELADA", "PERDIDA"].includes(status) ? "CANCELAMENTO" : status === "PAGO" ? "PAGAMENTO" : "AVANCO";
      const res = await fetch(`/api/contracts/proposals/${id}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ status, action, notes: notes || "Alterado via ação rápida" }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erro");
    },
    onSuccess: () => { invalidateProposals(); setQuick(null); setQuickValue(""); toast({ title: "Status atualizado" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const quickPatchMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const res = await fetch(`/api/contracts/proposals/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erro");
    },
    onSuccess: () => { invalidateProposals(); setQuick(null); setQuickValue(""); toast({ title: "Proposta atualizada" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const bulkStatusMut = useMutation({
    mutationFn: async ({ ids, status, notes }: { ids: number[]; status: string; notes?: string }) => {
      const res = await fetch("/api/contracts/proposals/bulk-status", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ids, status, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erro");
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateProposals();
      setSelected(new Set());
      setBulkStatus("");
      setBulkNotes("");
      toast({ title: `${data?.updated ?? 0} proposta(s) atualizada(s)` });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // ── Contagens ──────────────────────────────────────────────────────────────

  const countByStatus: Record<string, number> = {};
  proposals.forEach((p) => { countByStatus[p.status] = (countByStatus[p.status] || 0) + 1; });
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
  const showSelectCol = isOperacional;

  // ── Agrupamento: portabilidade com +1 parcela (mesmo CPF) vira um grupo ──────
  type DisplayItem = { type: "single"; p: any } | { type: "group"; cpf: string; list: any[] };
  const displayItems: DisplayItem[] = useMemo(() => {
    const portByCpf = new Map<string, any[]>();
    const rest: any[] = [];
    for (const p of filtered) {
      const cpf = (p.clientCpf || "").replace(/\D/g, "");
      if (p.product === "PORTABILIDADE" && cpf) {
        const arr = portByCpf.get(cpf) || [];
        arr.push(p);
        portByCpf.set(cpf, arr);
      } else {
        rest.push(p);
      }
    }
    const items: DisplayItem[] = [];
    for (const [cpf, list] of portByCpf) {
      if (list.length >= 2) items.push({ type: "group", cpf, list });
      else items.push({ type: "single", p: list[0] });
    }
    for (const p of rest) items.push({ type: "single", p });
    // ordena pelo id mais recente de cada item (desc)
    const itemMaxId = (it: DisplayItem) => it.type === "single" ? it.p.id : Math.max(...it.list.map((x) => x.id));
    return items.sort((a, b) => itemMaxId(b) - itemMaxId(a));
  }, [filtered]);

  // ── Seleção ─────────────────────────────────────────────────────────────────

  const filteredIds = filtered.map((p) => p.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            title="Atualizar lista"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals"] });
              queryClient.invalidateQueries({ queryKey: ["/api/contracts/statuses"] });
              queryClient.invalidateQueries({ queryKey: ["/api/contracts/phases"] });
            }}
          >
            <RefreshCw className="h-4 w-4" />Atualizar
          </Button>
          {canManageContracts && (
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setViewMode("operacional")}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  viewMode === "operacional" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />Operacional
              </button>
              <button
                onClick={() => setViewMode("corretor")}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  viewMode === "corretor" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />Corretor
              </button>
            </div>
          )}
          {canManageContracts && (
            <Button variant="outline" size="sm" onClick={() => setShowPhaseManager(true)} className="gap-1.5">
              <Settings className="h-4 w-4" />Fases
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setLocation("/contratos/nova")} data-testid="button-new-proposal">
              <Plus className="h-4 w-4 mr-2" />Nova Proposta
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
                className={`rounded-lg border-2 p-3 text-left transition-all ${isActive ? clr.activeBox : clr.box}`}
              >
                <span className={`block text-2xl font-bold leading-none ${clr.count}`}>{count}</span>
                <span className={`block text-xs font-medium mt-1.5 leading-tight ${clr.label}`}>{phase.name}</span>
                <span className={`block text-[10px] mt-0.5 opacity-60 ${clr.label}`}>Contrato{count !== 1 ? "s" : ""}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Pills de status ───────────────────────────────────────────────── */}
      {!activePhaseDef && !isLoading && proposals.length > 0 && statusList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todos ({proposals.length})
          </button>
          {statusList.map((s) => {
            const count = countByStatus[s.key] || 0;
            if (count === 0) return null;
            const isActive = filterStatus === s.key;
            const badgeCls = BADGE_COLORS[s.color] ?? BADGE_COLORS.zinc;
            return (
              <button
                key={s.key}
                onClick={() => setFilterStatus(isActive ? "all" : s.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${badgeCls} ${
                  isActive ? "ring-2 ring-current ring-offset-1" : "opacity-80 hover:opacity-100"
                }`}
              >
                {s.label} {count}
              </button>
            );
          })}
        </div>
      )}

      {activePhaseDef && (
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${PHASE_COLORS[activePhaseDef.color]?.swatch ?? "bg-blue-500"}`} />
          <span className="text-sm font-medium">{activePhaseDef.name}</span>
          <button onClick={() => setActivePhase(null)} className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
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

      {/* ── Barra de ações em lote ─────────────────────────────────────────── */}
      {showSelectCol && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
          <span className="flex items-center gap-1.5 text-sm font-medium px-1">
            <ListChecks className="h-4 w-4" />
            {selected.size} selecionada(s)
          </span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Alterar status para..." />
            </SelectTrigger>
            <SelectContent>
              {statusList.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={bulkNotes}
            onChange={(e) => setBulkNotes(e.target.value)}
            placeholder="Observação (opcional)"
            className="h-8 text-xs w-56"
          />
          <Button
            size="sm"
            disabled={!bulkStatus || bulkStatusMut.isPending}
            onClick={() => bulkStatusMut.mutate({ ids: Array.from(selected), status: bulkStatus, notes: bulkNotes || undefined })}
          >
            {bulkStatusMut.isPending ? "Aplicando..." : "Aplicar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
        </div>
      )}

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />)}
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
                {showSelectCol && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar todas"
                    />
                  </TableHead>
                )}
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
                {showSelectCol && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((item) => {
                // ── Linha de GRUPO (portabilidade multi-parcela do mesmo cliente) ──
                if (item.type === "group") {
                  const g = item.list;
                  const first = g[0];
                  const totalContrato = g.reduce((s, x) => s + (parseFloat(x.contractValue) || 0), 0);
                  const totalParcela = g.reduce((s, x) => s + (parseFloat(x.installmentValue) || 0), 0);
                  const bancos = Array.from(new Set(g.map((x) => x.bank).filter(Boolean)));
                  const statusSet = Array.from(new Set(g.map((x) => x.status)));
                  return (
                    <TableRow
                      key={`grp-${item.cpf}`}
                      className="cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors font-medium"
                      onClick={() => setLocation(`/contratos/cliente/${item.cpf}`)}
                      data-testid={`row-group-${item.cpf}`}
                    >
                      {showSelectCol && <TableCell />}
                      <TableCell><span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold h-6 min-w-6 px-1.5">{g.length}</span></TableCell>
                      <TableCell className="text-sm">{first.clientConvenio || "—"}</TableCell>
                      <TableCell className="text-sm font-mono text-xs">{formatCpfMask(first.clientCpf || "")}</TableCell>
                      <TableCell className="text-sm">
                        <span className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">▶</span>
                          <span className="font-medium">{first.clientName}</span>
                          <span className="text-xs text-muted-foreground font-normal">· {g.length} parcelas</span>
                        </span>
                      </TableCell>
                      {showCorretorCol && <TableCell className="text-sm text-muted-foreground font-normal">{first.vendorName || "—"}</TableCell>}
                      <TableCell className="text-sm font-normal">Portabilidade</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-normal">{bancos.length === 1 ? bancos[0] : `${bancos.length} bancos`}</TableCell>
                      <TableCell className="text-right text-sm font-normal">{formatMoney(totalParcela)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{formatMoney(totalContrato)}</TableCell>
                      <TableCell className="text-sm">—</TableCell>
                      <TableCell>
                        {statusSet.length === 1
                          ? <StatusBadge status={statusSet[0]} configMap={statusConfigMap} />
                          : <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Vários</span>}
                      </TableCell>
                      {showSelectCol && <TableCell />}
                    </TableRow>
                  );
                }

                // ── Linha individual (comportamento de sempre) ──
                const p = item.p;
                const pStatusDef = statusList.find((s) => s.key === p.status);
                const pIsFinal = pStatusDef?.isFinal || FINAL_FALLBACK.includes(p.status);
                const cip = (p.product === "PORTABILIDADE" && !pIsFinal) ? cipInfo(p.clientMeta?.dataCip) : null;
                const cipActive = cip && cip.state !== "ok";
                return (
                <TableRow
                  key={p.id}
                  className={`cursor-pointer transition-colors ${cipActive ? CIP_ROW[cip!.state] : "hover:bg-muted/40"}`}
                  onClick={() => setLocation(`/contratos/${p.id}`)}
                  data-testid={`row-proposal-${p.id}`}
                >
                  {showSelectCol && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggleOne(p.id)}
                        aria-label={`Selecionar proposta ${p.id}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-muted-foreground font-mono">{p.id}</TableCell>
                  <TableCell className="text-sm">{p.clientConvenio || "—"}</TableCell>
                  <TableCell className="text-sm font-mono text-xs">{formatCpfMask(p.clientCpf || "")}</TableCell>
                  <TableCell className="text-sm font-medium">{p.clientName}</TableCell>
                  {showCorretorCol && <TableCell className="text-sm text-muted-foreground">{p.vendorName || "—"}</TableCell>}
                  <TableCell className="text-sm">{PRODUCT_LABEL[p.product] || p.product || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.bank || "—"}</TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(p.installmentValue)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatMoney(p.contractValue)}</TableCell>
                  <TableCell className="text-sm font-mono text-xs">{p.ade || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={p.status} configMap={statusConfigMap} />
                      {p.isPaused && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Pend.</span>
                      )}
                      {cip && (
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${CIP_BADGE[cip.state]}`}>{cip.label}</span>
                      )}
                    </div>
                  </TableCell>
                  {showSelectCol && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Alterar status</DropdownMenuLabel>
                          {statusList.filter((s) => s.key !== p.status).map((s) => (
                            <DropdownMenuItem
                              key={s.key}
                              onClick={() => { setQuick({ id: p.id, mode: "status", status: s.key }); setQuickValue(""); }}
                            >
                              <span className={`mr-2 h-2 w-2 rounded-full ${PHASE_COLORS[s.color]?.swatch ?? "bg-zinc-400"}`} />
                              {s.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setQuick({ id: p.id, mode: "ade" }); setQuickValue(p.ade || ""); }}>
                            <Hash className="h-3.5 w-3.5 mr-2" /> Registrar ADE…
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setQuick({ id: p.id, mode: "obs" }); setQuickValue(""); }}>
                            <MessageSquare className="h-3.5 w-3.5 mr-2" /> Adicionar observação…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && filtered.length > 0 && filtered.length < proposals.length && (
        <p className="text-center text-xs text-muted-foreground pb-2">
          Mostrando {filtered.length} de {proposals.length} propostas
        </p>
      )}

      {/* ── Diálogo de ação rápida (status+observação / ADE / observação) ──── */}
      <Dialog open={!!quick} onOpenChange={(v) => { if (!v) { setQuick(null); setQuickValue(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {quick?.mode === "status" ? "Alterar status" : quick?.mode === "ade" ? "Registrar ADE" : "Adicionar observação"}
            </DialogTitle>
          </DialogHeader>

          {quick?.mode === "status" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Status</p>
                <Select value={quick.status} onValueChange={(v) => setQuick((q) => q ? { ...q, status: v } : q)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o status..." /></SelectTrigger>
                  <SelectContent>
                    {statusList.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Observação (opcional)</p>
                <Textarea value={quickValue} onChange={(e) => setQuickValue(e.target.value)} placeholder="Observação sobre a movimentação..." rows={3} />
              </div>
            </div>
          )}

          {quick?.mode === "ade" && (
            <Input value={quickValue} onChange={(e) => setQuickValue(e.target.value)} placeholder="Número do ADE" autoFocus />
          )}

          {quick?.mode === "obs" && (
            <Textarea value={quickValue} onChange={(e) => setQuickValue(e.target.value)} placeholder="Observação..." rows={3} autoFocus />
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setQuick(null); setQuickValue(""); }}>Cancelar</Button>
            <Button
              disabled={
                (quick?.mode === "status" ? (!quick?.status || quickStatusMut.isPending) : (!quickValue.trim() || quickPatchMut.isPending))
              }
              onClick={() => {
                if (!quick) return;
                if (quick.mode === "status") {
                  if (!quick.status) return;
                  quickStatusMut.mutate({ id: quick.id, status: quick.status, notes: quickValue.trim() || undefined });
                } else {
                  const body = quick.mode === "ade" ? { ade: quickValue.trim() } : { notes: quickValue.trim() };
                  quickPatchMut.mutate({ id: quick.id, body });
                }
              }}
            >
              {(quick?.mode === "status" ? quickStatusMut.isPending : quickPatchMut.isPending) ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de gestão ──────────────────────────────────────────────── */}
      <PhaseManagerDialog
        open={showPhaseManager}
        onClose={() => setShowPhaseManager(false)}
        phases={phases}
        statusList={statusList}
        statusConfigMap={statusConfigMap}
        onCreatedPhase={(data) => createPhase.mutate(data)}
        onUpdatedPhase={(id, data) => updatePhase.mutate({ id, data })}
        onDeletedPhase={(id) => deletePhase.mutate(id)}
        onCreatedStatus={(data) => createStatus.mutate(data)}
        onUpdatedStatus={(id, data) => updateStatus.mutate({ id, data })}
        onDeletedStatus={(id) => deleteStatus.mutate(id)}
      />
    </div>
  );
}
