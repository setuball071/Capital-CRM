import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Pencil, Trash2, Power, PowerOff, GitBranch, GripVertical,
  ChevronRight, AlertCircle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ─── Schemas ────────────────────────────────────────────────────────────────

const flowSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  bank: z.string().min(1, "Banco obrigatório"),
  convenio: z.string().min(1, "Convênio obrigatório"),
  product: z.string().min(1, "Produto obrigatório"),
  isActive: z.boolean().default(true),
});
type FlowForm = z.infer<typeof flowSchema>;

const stepSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  requiredRole: z.string().optional(),
  requiresDocuments: z.boolean().default(false),
});
type StepForm = z.infer<typeof stepSchema>;

const PRODUCTS = [
  { value: "NOVO", label: "Novo" },
  { value: "PORTABILIDADE", label: "Portabilidade" },
  { value: "REFINANCIAMENTO", label: "Refinanciamento" },
  { value: "CARTAO", label: "Cartão" },
];

const ROLES = [
  { value: "operacional", label: "Operacional" },
  { value: "vendedor", label: "Vendedor" },
  { value: "coordenacao", label: "Coordenação" },
  { value: "financeiro", label: "Financeiro" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function FlowModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: any | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FlowForm>({
    resolver: zodResolver(flowSchema),
    defaultValues: {
      name: editing?.name ?? "",
      bank: editing?.bank ?? "",
      convenio: editing?.convenio ?? "",
      product: editing?.product ?? "",
      isActive: editing?.isActive ?? true,
    },
    values: editing
      ? { name: editing.name, bank: editing.bank, convenio: editing.convenio, product: editing.product, isActive: editing.isActive }
      : { name: "", bank: "", convenio: "", product: "", isActive: true },
  });

  const saveMutation = useMutation({
    mutationFn: (data: FlowForm) =>
      editing
        ? apiRequest("PUT", `/api/contracts/flows/${editing.id}`, data)
        : apiRequest("POST", "/api/contracts/flows", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/flows"] });
      toast({ title: editing ? "Fluxo atualizado" : "Fluxo criado" });
      onClose();
    },
    onError: () => toast({ title: "Erro ao salvar fluxo", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Fluxo" : "Novo Fluxo"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: Fluxo INSS Novo" data-testid="input-flow-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="bank" render={({ field }) => (
                <FormItem>
                  <FormLabel>Banco *</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: Banco do Brasil" data-testid="input-flow-bank" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="convenio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Convênio *</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: INSS" data-testid="input-flow-convenio" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="product" render={({ field }) => (
              <FormItem>
                <FormLabel>Produto *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-flow-product">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PRODUCTS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-md border p-3">
                <FormLabel className="cursor-pointer">Fluxo ativo</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-flow-active" />
                </FormControl>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-flow">
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function StepModal({
  open,
  flowId,
  editing,
  nextOrder,
  onClose,
}: {
  open: boolean;
  flowId: number;
  editing: any | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<StepForm>({
    resolver: zodResolver(stepSchema),
    values: editing
      ? { name: editing.name, description: editing.description ?? "", requiredRole: editing.requiredRole ?? "none", requiresDocuments: editing.requiresDocuments ?? false }
      : { name: "", description: "", requiredRole: "none", requiresDocuments: false },
  });

  const saveMutation = useMutation({
    mutationFn: (data: StepForm) => {
      const payload = {
        ...data,
        requiredRole: (data.requiredRole && data.requiredRole !== "none") ? data.requiredRole : null,
        stepOrder: editing?.stepOrder ?? nextOrder,
      };
      return editing
        ? apiRequest("PUT", `/api/contracts/flows/steps/${editing.id}`, payload)
        : apiRequest("POST", `/api/contracts/flows/${flowId}/steps`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/flows", flowId, "steps"] });
      toast({ title: editing ? "Etapa atualizada" : "Etapa adicionada" });
      onClose();
    },
    onError: () => toast({ title: "Erro ao salvar etapa", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Etapa" : "Adicionar Etapa"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da etapa *</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: Conferência de Documentos" data-testid="input-step-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Descreva o que deve ser feito..." className="resize-none" rows={3} data-testid="textarea-step-description" />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="requiredRole" render={({ field }) => (
              <FormItem>
                <FormLabel>Role responsável</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-step-role">
                      <SelectValue placeholder="Qualquer role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Qualquer role</SelectItem>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="requiresDocuments" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-md border p-3">
                <FormLabel className="cursor-pointer">Exige documentos?</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-step-docs" />
                </FormControl>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-step">
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ContratosFluxosPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedFlow, setSelectedFlow] = useState<any | null>(null);
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<any | null>(null);
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<any | null>(null);

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // ─── Flows ───────────────────────────────────────────────────────────────

  const { data: flows = [], isLoading: flowsLoading } = useQuery<any[]>({
    queryKey: ["/api/contracts/flows"],
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (flow: any) =>
      apiRequest("PUT", `/api/contracts/flows/${flow.id}`, { isActive: !flow.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/contracts/flows"] }),
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const deleteFlowMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contracts/flows/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/flows"] });
      if (selectedFlow?.id === id) setSelectedFlow(null);
      toast({ title: "Fluxo removido" });
    },
    onError: () => toast({ title: "Erro ao remover fluxo", variant: "destructive" }),
  });

  // ─── Steps ───────────────────────────────────────────────────────────────

  const { data: steps = [], isLoading: stepsLoading } = useQuery<any[]>({
    queryKey: ["/api/contracts/flows", selectedFlow?.id, "steps"],
    queryFn: async () => {
      if (!selectedFlow?.id) return [];
      const res = await fetch(`/api/contracts/flows/${selectedFlow.id}/steps`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedFlow?.id,
  });

  const deleteStepMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contracts/flows/steps/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/flows", selectedFlow?.id, "steps"] });
      toast({ title: "Etapa removida" });
    },
    onError: () => toast({ title: "Erro ao remover etapa", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; stepOrder: number }[]) =>
      apiRequest("PUT", `/api/contracts/flows/${selectedFlow?.id}/steps/reorder`, items),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/flows", selectedFlow?.id, "steps"] }),
    onError: () => toast({ title: "Erro ao reordenar", variant: "destructive" }),
  });

  // ─── Drag handlers ───────────────────────────────────────────────────────

  function handleDragStart(idx: number) {
    dragItem.current = idx;
  }

  function handleDragEnter(idx: number) {
    dragOverItem.current = idx;
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const reordered = [...steps];
    const dragged = reordered.splice(dragItem.current, 1)[0];
    reordered.splice(dragOverItem.current, 0, dragged);

    dragItem.current = null;
    dragOverItem.current = null;

    const payload = reordered.map((s, i) => ({ id: s.id, stepOrder: i + 1 }));
    reorderMutation.mutate(payload);
  }

  // ─── Access control ──────────────────────────────────────────────────────
  if (user && !user.isMaster) {
    setLocation("/contratos");
    return null;
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold">Gestão de Fluxos</h1>
        <p className="text-sm text-muted-foreground">Configure os fluxos operacionais para cada produto bancário</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* ── Coluna esquerda: lista de fluxos ── */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3 flex-row flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Fluxos Operacionais
            </CardTitle>
            <Button
              size="sm"
              onClick={() => { setEditingFlow(null); setFlowModalOpen(true); }}
              data-testid="button-new-flow"
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo Fluxo
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {flowsLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)}
              </div>
            ) : flows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4 gap-2">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum fluxo cadastrado</p>
              </div>
            ) : (
              <div className="divide-y">
                {flows.map((flow) => {
                  const isSelected = selectedFlow?.id === flow.id;
                  return (
                    <div
                      key={flow.id}
                      className={`p-3 cursor-pointer transition-colors hover-elevate ${isSelected ? "bg-primary/8" : ""}`}
                      onClick={() => setSelectedFlow(flow)}
                      data-testid={`flow-item-${flow.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate">{flow.name}</span>
                            {isSelected && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">{flow.bank}</span>
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">{flow.convenio}</span>
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">
                              {PRODUCTS.find((p) => p.value === flow.product)?.label || flow.product}
                            </span>
                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${flow.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                              {flow.isActive ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setEditingFlow(flow); setFlowModalOpen(true); }}
                            data-testid={`button-edit-flow-${flow.id}`}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); toggleActiveMutation.mutate(flow); }}
                            data-testid={`button-toggle-flow-${flow.id}`}
                            title={flow.isActive ? "Desativar" : "Ativar"}
                          >
                            {flow.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); deleteFlowMutation.mutate(flow.id); }}
                            data-testid={`button-delete-flow-${flow.id}`}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Coluna direita: etapas ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex-row flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {selectedFlow ? (
                <span>Etapas — <span className="text-primary">{selectedFlow.name}</span></span>
              ) : (
                "Etapas do Fluxo"
              )}
            </CardTitle>
            {selectedFlow && (
              <Button
                size="sm"
                onClick={() => { setEditingStep(null); setStepModalOpen(true); }}
                data-testid="button-add-step"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Etapa
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedFlow ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <GitBranch className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Selecione um fluxo na lista ao lado para ver e editar suas etapas.
                </p>
              </div>
            ) : stepsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />)}
              </div>
            ) : steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada. Clique em "Adicionar Etapa" para começar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="flex items-center gap-3 p-3 rounded-md border bg-card cursor-grab active:cursor-grabbing select-none"
                    data-testid={`step-item-${step.id}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {step.stepOrder}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{step.name}</p>
                      {step.description && (
                        <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {step.requiredRole && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {ROLES.find((r) => r.value === step.requiredRole)?.label || step.requiredRole}
                        </span>
                      )}
                      {step.requiresDocuments && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Docs
                        </span>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditingStep(step); setStepModalOpen(true); }}
                        data-testid={`button-edit-step-${step.id}`}
                        title="Editar etapa"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteStepMutation.mutate(step.id)}
                        data-testid={`button-delete-step-${step.id}`}
                        title="Excluir etapa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <FlowModal
        open={flowModalOpen}
        editing={editingFlow}
        onClose={() => { setFlowModalOpen(false); setEditingFlow(null); }}
      />
      {selectedFlow && (
        <StepModal
          open={stepModalOpen}
          flowId={selectedFlow.id}
          editing={editingStep}
          nextOrder={steps.length + 1}
          onClose={() => { setStepModalOpen(false); setEditingStep(null); }}
        />
      )}
    </div>
  );
}
