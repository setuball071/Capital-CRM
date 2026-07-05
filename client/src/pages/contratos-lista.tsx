import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Search, Filter, Briefcase, Eye,
  Settings, Trash2, Pencil, Check, X, Lock, MoreHorizontal,
  ListChecks, Hash, MessageSquare, RefreshCw, Copy,
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
import { cipInfo, parseCipDate, type CipState } from "@/lib/cip";

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

// ─── Acompanhamento operacional: tempo desde a última consulta ────────────────
// Sem consulta registrada ainda, conta a partir da última atualização da proposta.
function consultaElapsed(p: any): { label: string; hours: number } | null {
  const ref = p.ultimaConsulta || p.updatedAt || p.createdAt;
  if (!ref) return null;
  const ms = Date.now() - new Date(ref).getTime();
  if (isNaN(ms) || ms < 0) return null;
  const hours = ms / 36e5;
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  const label = d > 0 ? `${d}d ${h}h` : hours >= 1 ? `${h}h` : `${Math.max(1, Math.floor(ms / 6e4))}min`;
  return { label, hours };
}
function consultaBadgeCls(hours: number): string {
  if (hours < 24) return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  if (hours < 48) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
}

// ─── Paleta compartilhada entre badges e caixas de fase ──────────────────────

// Tons EXATOS do design (Contratos.dc.html → toneColors): success/warning/info/danger
const BADGE_COLORS: Record<string, string> = {
  zinc:   "bg-[#F9FAFB] text-[#6B7280] dark:bg-white/5 dark:text-[#9C97AE]",
  blue:   "bg-[#E8F1FD] text-[#1E5FB5] dark:bg-[rgba(30,136,229,0.16)] dark:text-[#60A5FA]",
  violet: "bg-[#F2EBFC] text-[#6C2BD9] dark:bg-[rgba(108,43,217,0.28)] dark:text-[#C79CF7]",
  orange: "bg-[#FEF6E0] text-[#9a6a00] dark:bg-[rgba(249,168,37,0.14)] dark:text-[#FBBF24]",
  red:    "bg-[#FDECEC] text-[#C62828] dark:bg-[rgba(229,57,53,0.16)] dark:text-[#F87171]",
  yellow: "bg-[#FEF6E0] text-[#9a6a00] dark:bg-[rgba(249,168,37,0.14)] dark:text-[#FBBF24]",
  green:  "bg-[#E7F9EE] text-[#0F8A46] dark:bg-[rgba(0,200,83,0.14)] dark:text-[#4ADE80]",
  rose:   "bg-[#FDECEC] text-[#C62828] dark:bg-[rgba(229,57,53,0.16)] dark:text-[#F87171]",
};

// Caixas de KPI com os tons exatos do design: fundo + borda tingidos, número e
// label na cor do tom, "Contratos"/valor em neutro (Contratos.dc.html → statusCards)
const PHASE_COLORS: Record<string, {
  box: string; activeBox: string; count: string; label: string; swatch: string;
}> = {
  zinc:   {
    box:       "bg-[#F9FAFB] border-[#E5E7EB] dark:bg-white/5 dark:border-white/10",
    activeBox: "bg-[#F9FAFB] border-[#E5E7EB] dark:bg-white/5 dark:border-white/10 ring-2 ring-current",
    count: "text-[#6B7280] dark:text-[#9C97AE]", label: "text-[#6B7280] dark:text-[#9C97AE]", swatch: "bg-zinc-400",
  },
  blue:   {
    box:       "bg-[#E8F1FD] border-[#BFDAF9] dark:bg-[rgba(30,136,229,0.16)] dark:border-[rgba(30,136,229,0.32)]",
    activeBox: "bg-[#E8F1FD] border-[#BFDAF9] dark:bg-[rgba(30,136,229,0.16)] dark:border-[rgba(30,136,229,0.32)] ring-2 ring-current",
    count: "text-[#1E5FB5] dark:text-[#60A5FA]", label: "text-[#1E5FB5] dark:text-[#60A5FA]", swatch: "bg-blue-500",
  },
  violet: {
    box:       "bg-[#F2EBFC] border-[#E3D2FA] dark:bg-[rgba(108,43,217,0.28)] dark:border-[rgba(108,43,217,0.45)]",
    activeBox: "bg-[#F2EBFC] border-[#E3D2FA] dark:bg-[rgba(108,43,217,0.28)] dark:border-[rgba(108,43,217,0.45)] ring-2 ring-current",
    count: "text-[#6C2BD9] dark:text-[#C79CF7]", label: "text-[#6C2BD9] dark:text-[#C79CF7]", swatch: "bg-violet-500",
  },
  orange: {
    box:       "bg-[#FEF6E0] border-[#F5E1A4] dark:bg-[rgba(249,168,37,0.14)] dark:border-[rgba(249,168,37,0.30)]",
    activeBox: "bg-[#FEF6E0] border-[#F5E1A4] dark:bg-[rgba(249,168,37,0.14)] dark:border-[rgba(249,168,37,0.30)] ring-2 ring-current",
    count: "text-[#9a6a00] dark:text-[#FBBF24]", label: "text-[#9a6a00] dark:text-[#FBBF24]", swatch: "bg-orange-500",
  },
  red:    {
    box:       "bg-[#FDECEC] border-[#F6C6C6] dark:bg-[rgba(229,57,53,0.16)] dark:border-[rgba(229,57,53,0.32)]",
    activeBox: "bg-[#FDECEC] border-[#F6C6C6] dark:bg-[rgba(229,57,53,0.16)] dark:border-[rgba(229,57,53,0.32)] ring-2 ring-current",
    count: "text-[#C62828] dark:text-[#F87171]", label: "text-[#C62828] dark:text-[#F87171]", swatch: "bg-red-500",
  },
  yellow: {
    box:       "bg-[#FEF6E0] border-[#F5E1A4] dark:bg-[rgba(249,168,37,0.14)] dark:border-[rgba(249,168,37,0.30)]",
    activeBox: "bg-[#FEF6E0] border-[#F5E1A4] dark:bg-[rgba(249,168,37,0.14)] dark:border-[rgba(249,168,37,0.30)] ring-2 ring-current",
    count: "text-[#9a6a00] dark:text-[#FBBF24]", label: "text-[#9a6a00] dark:text-[#FBBF24]", swatch: "bg-yellow-400",
  },
  green:  {
    box:       "bg-[#E7F9EE] border-[#BFEAD1] dark:bg-[rgba(0,200,83,0.14)] dark:border-[rgba(0,200,83,0.30)]",
    activeBox: "bg-[#E7F9EE] border-[#BFEAD1] dark:bg-[rgba(0,200,83,0.14)] dark:border-[rgba(0,200,83,0.30)] ring-2 ring-current",
    count: "text-[#0F8A46] dark:text-[#4ADE80]", label: "text-[#0F8A46] dark:text-[#4ADE80]", swatch: "bg-green-500",
  },
  rose:   {
    box:       "bg-[#FDECEC] border-[#F6C6C6] dark:bg-[rgba(229,57,53,0.16)] dark:border-[rgba(229,57,53,0.32)]",
    activeBox: "bg-[#FDECEC] border-[#F6C6C6] dark:bg-[rgba(229,57,53,0.16)] dark:border-[rgba(229,57,53,0.32)] ring-2 ring-current",
    count: "text-[#C62828] dark:text-[#F87171]", label: "text-[#C62828] dark:text-[#F87171]", swatch: "bg-rose-500",
  },
};

const COLOR_OPTIONS = Object.keys(PHASE_COLORS);

const PRODUCT_LABEL: Record<string, string> = {
  NOVO: "Novo",
  PORTABILIDADE: "Portabilidade",
  REFIN_PORTABILIDADE: "Refin de Port.",
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
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
  // Ordenação por coluna (clicar no cabeçalho) — persiste na sessão
  const [sortBy, setSortBy] = useState<string | null>(() => sessionStorage.getItem("contratos_sortBy") || null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => (sessionStorage.getItem("contratos_sortDir") as "asc" | "desc") || "desc");
  useEffect(() => {
    if (sortBy) {
      sessionStorage.setItem("contratos_sortBy", sortBy);
      sessionStorage.setItem("contratos_sortDir", sortDir);
    } else {
      sessionStorage.removeItem("contratos_sortBy");
      sessionStorage.removeItem("contratos_sortDir");
    }
  }, [sortBy, sortDir]);

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
  const [bulkVendor, setBulkVendor] = useState("");
  const [quick, setQuick] = useState<{ id: number; mode: "ade" | "obs" | "status" | "consulta"; status?: string } | null>(null);
  const [quickValue, setQuickValue] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  function copyText(key: string, text: string) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
  }

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

  // Tabelas de comissão (Financeiro → Tabelas) — usadas para excluir da produção
  // contratos digitados com tabela de % Empresa zerado (sem repasse nenhum).
  const { data: financeiroConfig } = useQuery<{ dados: any } | null>({
    queryKey: ["/api/financeiro/config"],
    queryFn: async () => {
      const res = await fetch("/api/financeiro/config", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });
  const tabelasRepasseZerado = new Set(
    ((financeiroConfig?.dados?.tabelas as any[]) ?? [])
      .filter((t) => Number(t.pctEmpresa) === 0)
      .map((t) => String(t.id))
  );

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

  // Registrar consulta no banco (acompanhamento) — atualiza só a linha no cache,
  // sem refetch da lista inteira.
  const consultaMut = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const res = await fetch(`/api/contracts/proposals/${id}/consulta`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erro");
      return res.json();
    },
    onSuccess: (data: any, vars) => {
      queryClient.setQueryData(["/api/contracts/proposals"], (old: any) =>
        Array.isArray(old)
          ? old.map((p: any) => p.id === vars.id
              ? { ...p, ultimaConsulta: data.ultimaConsulta, ultimaConsultaPor: user?.name || user?.email || "" }
              : p)
          : old
      );
      setQuick(null); setQuickValue("");
      toast({ title: "Consulta registrada" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // Usuários para transferência em lote (só operacional/master enxergam)
  const { data: assignableUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/contracts/assignable-users"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/assignable-users", { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: viewMode === "operacional",
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

  const bulkTransferMut = useMutation({
    mutationFn: async ({ ids, vendorId, notes }: { ids: number[]; vendorId: string; notes?: string }) => {
      const res = await fetch("/api/contracts/proposals/bulk-transfer", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ids, vendorId, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erro");
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateProposals();
      setSelected(new Set());
      setBulkVendor("");
      setBulkNotes("");
      toast({ title: `${data?.updated ?? 0} proposta(s) transferida(s)` });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // ── Contagens ──────────────────────────────────────────────────────────────

  const countByStatus: Record<string, number> = {};
  proposals.forEach((p) => { countByStatus[p.status] = (countByStatus[p.status] || 0) + 1; });
  function countForPhase(phase: Phase) {
    return phase.statuses.reduce((acc, s) => acc + (countByStatus[s] || 0), 0);
  }

  // ── Somatória da produção por caixa ──────────────────────────────────────────
  // Regra: cancelados não somam; PAGO conta só se pago no mês corrente (paidAt);
  // demais status somam o valor do contrato integralmente.
  const CANCEL_STATUSES = ["CANCELADA", "PERDIDA"];
  const _now = new Date();
  const isCurrentMonth = (raw: any) => {
    if (!raw) return false;
    const d = new Date(raw);
    return !isNaN(d.getTime()) && d.getFullYear() === _now.getFullYear() && d.getMonth() === _now.getMonth();
  };
  function prodValueOf(p: any) {
    if (p.unificadaEmId) return 0; // parcela absorvida numa unificação não soma produção
    if (CANCEL_STATUSES.includes(p.status)) return 0;
    const tabelaId = p.clientMeta?.tabelaFinanceiroId;
    if (tabelaId && tabelasRepasseZerado.has(String(tabelaId))) return 0; // tabela sem repasse (% Empresa = 0)
    const val = parseFloat(p.contractValue || "0") || 0;
    if (p.status === "PAGO") {
      return isCurrentMonth(p.paidAt || p.updatedAt) ? val : 0;
    }
    return val;
  }
  function prodForPhase(phase: Phase) {
    return proposals.reduce(
      (acc, p) => acc + (phase.statuses.includes(p.status) ? prodValueOf(p) : 0),
      0
    );
  }
  // Não exibir soma em caixas puramente de cancelamento
  function phaseShowsSum(phase: Phase) {
    return phase.statuses.length > 0 && !phase.statuses.every((s) => CANCEL_STATUSES.includes(s));
  }
  const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ── Filtro ────────────────────────────────────────────────────────────────

  const activePhaseDef = phases.find((p) => p.id === activePhase);

  const filtered = proposals.filter((p) => {
    if (viewMode === "corretor" && p.vendorId !== user?.id) return false;
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    // Ao pesquisar, a busca varre TUDO (ignora a caixa de fase/status selecionada).
    // O filtro de caixa só se aplica quando não há texto de busca.
    if (!q) {
      if (activePhaseDef) {
        if (!activePhaseDef.statuses.includes(p.status)) return false;
      } else if (filterStatus !== "all") {
        if (p.status !== filterStatus) return false;
      }
    }
    const matchSearch =
      !q ||
      p.clientName?.toLowerCase().includes(q) ||
      (!!qDigits && (p.clientCpf || "").replace(/\D/g, "").includes(qDigits)) ||
      p.bank?.toLowerCase().includes(q) ||
      (p.ade || "").toLowerCase().includes(q) ||
      p.vendorName?.toLowerCase().includes(q) ||
      (!!qDigits && String(p.id) === qDigits);
    const matchProduct = filterProduct === "all" || p.product === filterProduct;
    return matchSearch && matchProduct;
  });

  // Na caixa "Aguardando retorno CIP": ordena pela data da CIP — a mais antiga
  // (mais perto de vencer o prazo) no topo; sem data CIP vai pro fim.
  const activeStatusLabel =
    filterStatus !== "all" ? (statusList.find((s) => s.key === filterStatus)?.label || "") : "";
  const isCipBox =
    (!!activePhaseDef && /cip/i.test(activePhaseDef.name)) || /cip/i.test(activeStatusLabel);
  const displayed = isCipBox
    ? [...filtered].sort((a, b) => {
        const da = parseCipDate(a.clientMeta?.dataCip);
        const db = parseCipDate(b.clientMeta?.dataCip);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.getTime() - db.getTime(); // mais antiga primeiro (topo)
      })
    : filtered;

  // Ordenação por coluna (cabeçalho clicável). Sobrepõe a ordem padrão quando ativa.
  const SORT_GET: Record<string, (p: any) => any> = {
    id: (p) => p.id,
    convenio: (p) => (p.clientConvenio || "").toLowerCase(),
    cpf: (p) => (p.clientCpf || "").replace(/\D/g, ""),
    nome: (p) => (p.clientName || "").toLowerCase(),
    corretor: (p) => (p.vendorName || "").toLowerCase(),
    tipo: (p) => (p.product || "").toLowerCase(),
    banco: (p) => (p.bank || "").toLowerCase(),
    parcela: (p) => parseFloat(p.installmentValue || "0") || 0,
    contrato: (p) => parseFloat(p.contractValue || "0") || 0,
    ade: (p) => (p.ade || "").toLowerCase(),
    parceiro: (p) => (p.parceiroNome || "").toLowerCase(),
    status: (p) => new Date(p.updatedAt || p.createdAt || 0).getTime(), // atualização mais recente
    consulta: (p) => new Date(p.ultimaConsulta || p.updatedAt || p.createdAt || 0).getTime(), // consulta mais antiga/recente
  };
  // A caixa CIP mantém SEMPRE a ordem por data/urgência (ordenação por coluna não se
  // aplica nela), para não embaralhar os dias de CIP com um sort herdado de outra caixa.
  const sorted = (sortBy && SORT_GET[sortBy] && !isCipBox)
    ? [...displayed].sort((a, b) => {
        const va = SORT_GET[sortBy](a), vb = SORT_GET[sortBy](b);
        let cmp = 0;
        if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
        else cmp = String(va).localeCompare(String(vb), "pt-BR");
        return sortDir === "desc" ? -cmp : cmp;
      })
    : displayed;
  function toggleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  }
  const sortHead = (key: string, label: string, cls = "") => (
    // Na caixa CIP a ordenação é fixa (por urgência) → cabeçalho não clicável
    <TableHead
      className={`select-none text-[11px] font-bold tracking-[0.04em] uppercase ${isCipBox ? "" : "cursor-pointer hover:text-foreground"} ${cls}`}
      onClick={isCipBox ? undefined : () => toggleSort(key)}
    >
      <span className={`inline-flex items-center gap-0.5 ${cls.includes("text-right") ? "justify-end w-full" : ""}`}>
        {label}{!isCipBox && sortBy === key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
      </span>
    </TableHead>
  );

  const showCorretorCol = viewMode === "operacional";
  const showParceiroCol = canManageContracts;
  const showSelectCol = isOperacional;
  // Acompanhamento (última consulta no banco) — ferramenta de gestão: só no modo Operacional
  const showConsultaCol = viewMode === "operacional";

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
          <h1 className="text-2xl font-bold tracking-[-0.01em]">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {phases.map((phase) => {
            const clr = PHASE_COLORS[phase.color] ?? PHASE_COLORS.blue;
            const isActive = activePhase === phase.id;
            const count = countForPhase(phase);
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => setActivePhase(isActive ? null : phase.id)}
                className={`rounded-[10px] border px-3.5 py-2.5 text-left transition-all ${isActive ? clr.activeBox : clr.box}`}
              >
                <span className={`block text-xl font-bold leading-none ${clr.count}`}>{count}</span>
                <span className={`block text-[12.5px] font-semibold mt-1 leading-tight ${clr.label}`}>{phase.name}</span>
                <span className="block text-[11px] mt-1 text-muted-foreground">Contrato{count !== 1 ? "s" : ""}</span>
                {phaseShowsSum(phase) && (
                  <span className="block text-[12.5px] font-bold mt-0.5 text-foreground">
                    {fmtBRL(prodForPhase(phase))}
                    {phase.statuses.includes("PAGO") && <span className="text-[10px] font-normal ml-1 text-muted-foreground">no mês</span>}
                  </span>
                )}
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
            className={`rounded-[9px] px-4 py-2 text-[13px] font-semibold whitespace-nowrap border transition-colors ${
              filterStatus === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-muted/50 text-foreground/80 border-border hover:bg-muted"
            }`}
          >
            Todos ({proposals.length})
          </button>
          {statusList.map((s) => {
            const count = countByStatus[s.key] || 0;
            if (count === 0) return null;
            const isActive = filterStatus === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setFilterStatus(isActive ? "all" : s.key)}
                className={`rounded-[9px] px-4 py-2 text-[13px] font-semibold whitespace-nowrap border transition-colors ${
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-muted/50 text-foreground/80 border-border hover:bg-muted"
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

      {/* ── Card da tabela: busca + filtro de produto + tabela (design) ────── */}
      <section className="rounded-2xl border border-border bg-card px-6 pt-5 pb-3 space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, banco, ADE, corretor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-[38px] rounded-[9px] bg-muted/50 text-[13.5px]"
            data-testid="input-search"
          />
        </div>
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-[180px] h-[38px] rounded-[9px] text-[13.5px]" data-testid="select-filter-product">
            <SelectValue placeholder="Todos os produtos" />
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
              {statusList
                .slice()
                .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
                .map((s) => (
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

          <span className="mx-1 h-6 w-px bg-border" />

          <Select value={bulkVendor} onValueChange={setBulkVendor}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Transferir para..." />
            </SelectTrigger>
            <SelectContent>
              {assignableUsers.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!bulkVendor || bulkTransferMut.isPending}
            onClick={() => bulkTransferMut.mutate({ ids: Array.from(selected), vendorId: bulkVendor, notes: bulkNotes || undefined })}
          >
            {bulkTransferMut.isPending ? "Transferindo..." : "Transferir"}
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
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Filter className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Nenhuma proposta encontrada</p>
          <p className="text-sm text-muted-foreground">
            {canCreate ? "Clique em Nova Proposta para começar." : "Aguarde novas propostas."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {showSelectCol && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar todas"
                    />
                  </TableHead>
                )}
                {sortHead("id", "#", "w-14")}
                {sortHead("convenio", "Órgão")}
                {sortHead("cpf", "CPF")}
                {sortHead("nome", "Nome do Cliente")}
                {showCorretorCol && sortHead("corretor", "Corretor")}
                {sortHead("tipo", "Tipo")}
                {sortHead("banco", "Banco")}
                {sortHead("parcela", "Parcela", "text-right")}
                {sortHead("contrato", "Contrato", "text-right")}
                {sortHead("ade", "ADE")}
                {sortHead("status", "Status")}
                {showParceiroCol && sortHead("parceiro", "Parceiro")}
                {showConsultaCol && sortHead("consulta", "Consulta")}
                {showSelectCol && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => {
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
                  <TableCell className="text-sm font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                    <span className="group inline-flex items-center gap-1">
                      {formatCpfMask(p.clientCpf || "")}
                      {p.clientCpf && (
                        <button title="Copiar CPF" onClick={() => copyText(`cpf-${p.id}`, (p.clientCpf || "").replace(/\D/g, ""))} className="text-muted-foreground hover:text-primary">
                          {copiedKey === `cpf-${p.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                    <span className="group inline-flex items-center gap-1">
                      {p.clientName}
                      {p.clientName && (
                        <button title="Copiar nome" onClick={() => copyText(`nome-${p.id}`, p.clientName)} className="text-muted-foreground hover:text-primary">
                          {copiedKey === `nome-${p.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>
                      )}
                    </span>
                  </TableCell>
                  {showCorretorCol && <TableCell className="text-sm text-muted-foreground">{p.vendorName || "—"}</TableCell>}
                  <TableCell className="text-sm">{PRODUCT_LABEL[p.product] || p.product || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.bank || "—"}</TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(p.installmentValue)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatMoney(p.contractValue)}</TableCell>
                  <TableCell className="text-sm font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-0.5">
                      <span className="group inline-flex items-center gap-1">
                        {p.ade || "—"}
                        {p.ade && (
                          <button title="Copiar ADE" onClick={() => copyText(`ade-${p.id}`, p.ade)} className="text-muted-foreground hover:text-primary">
                            {copiedKey === `ade-${p.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </button>
                        )}
                      </span>
                      {p.product === "PORTABILIDADE" && p.adeRefin && (
                        <span className="group inline-flex items-center gap-1 text-muted-foreground">
                          <span className="text-[10px] uppercase tracking-wide">refin</span>
                          {p.adeRefin}
                          <button title="Copiar ADE de refin" onClick={() => copyText(`aderefin-${p.id}`, p.adeRefin)} className="hover:text-primary">
                            {copiedKey === `aderefin-${p.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </button>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={p.status} configMap={statusConfigMap} />
                      {p.unificadaEmId && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" title={`Unificada na proposta #${p.unificadaEmId}`}>Unificada</span>
                      )}
                      {p.clientMeta?.cancelamentoSolicitado && (
                        <span
                          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          title={`Cancelamento solicitado por ${p.clientMeta.cancelamentoSolicitado.por}: ${p.clientMeta.cancelamentoSolicitado.motivo || ""}`}
                        >
                          Cancel. solicitado
                        </span>
                      )}
                      {p.isPaused && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Pend.</span>
                      )}
                      {cip && (
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${CIP_BADGE[cip.state]}`}>{cip.label}</span>
                      )}
                    </div>
                  </TableCell>
                  {showParceiroCol && <TableCell className="text-sm text-muted-foreground">{p.parceiroNome || "—"}</TableCell>}
                  {showConsultaCol && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const el = consultaElapsed(p);
                        return (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            {el && (
                              <span
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${consultaBadgeCls(el.hours)}`}
                                title={p.ultimaConsulta
                                  ? `Consultado por ${p.ultimaConsultaPor || "—"} em ${new Date(p.ultimaConsulta).toLocaleString("pt-BR")}`
                                  : "Sem consulta registrada — contando da última atualização da proposta"}
                              >
                                {el.label}
                              </span>
                            )}
                            <button
                              title="Registrar consulta no banco"
                              className="text-muted-foreground hover:text-primary"
                              onClick={() => { setQuick({ id: p.id, mode: "consulta" }); setQuickValue(""); }}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })()}
                    </TableCell>
                  )}
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
                          {statusList
                            .filter((s) => s.key !== p.status)
                            .slice()
                            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
                            .map((s) => (
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
      </section>

      {/* ── Diálogo de ação rápida (status+observação / ADE / observação) ──── */}
      <Dialog open={!!quick} onOpenChange={(v) => { if (!v) { setQuick(null); setQuickValue(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {quick?.mode === "status" ? "Alterar status" : quick?.mode === "ade" ? "Registrar ADE" : quick?.mode === "consulta" ? "Registrar consulta no banco" : "Adicionar observação"}
            </DialogTitle>
          </DialogHeader>

          {quick?.mode === "status" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Status</p>
                <Select value={quick.status} onValueChange={(v) => setQuick((q) => q ? { ...q, status: v } : q)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o status..." /></SelectTrigger>
                  <SelectContent>
                    {statusList
                      .slice()
                      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
                      .map((s) => (
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

          {quick?.mode === "consulta" && (
            <div className="space-y-1.5">
              <Textarea
                value={quickValue}
                onChange={(e) => setQuickValue(e.target.value)}
                placeholder="Como está o contrato no banco? (ex: em análise na esteira, aguardando averbação, sem retorno ainda...)"
                rows={3}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Registra a consulta no histórico e zera o contador de acompanhamento. Não altera o status.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setQuick(null); setQuickValue(""); }}>Cancelar</Button>
            <Button
              disabled={
                quick?.mode === "status" ? (!quick?.status || quickStatusMut.isPending)
                : quick?.mode === "consulta" ? (!quickValue.trim() || consultaMut.isPending)
                : (!quickValue.trim() || quickPatchMut.isPending)
              }
              onClick={() => {
                if (!quick) return;
                if (quick.mode === "status") {
                  if (!quick.status) return;
                  quickStatusMut.mutate({ id: quick.id, status: quick.status, notes: quickValue.trim() || undefined });
                } else if (quick.mode === "consulta") {
                  consultaMut.mutate({ id: quick.id, notes: quickValue.trim() });
                } else {
                  const body = quick.mode === "ade" ? { ade: quickValue.trim() } : { notes: quickValue.trim() };
                  quickPatchMut.mutate({ id: quick.id, body });
                }
              }}
            >
              {(quick?.mode === "status" ? quickStatusMut.isPending : quick?.mode === "consulta" ? consultaMut.isPending : quickPatchMut.isPending) ? "Salvando..." : "Salvar"}
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
