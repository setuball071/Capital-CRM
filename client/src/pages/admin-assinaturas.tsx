import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Plus,
  CheckCircle,
  XCircle,
  PauseCircle,
  RefreshCw,
  Building2,
  Calendar,
  History,
} from "lucide-react";

function cicloSufixo(ciclo: string | null | undefined) {
  return ciclo === "anual" ? "/ano" : "/mês";
}

function formatPlanoValor(valor: number | null | undefined, ciclo?: string | null) {
  if (valor == null) return "—";
  if (Number(valor) === 0) return "Grátis";
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + cicloSufixo(ciclo);
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  trial: { label: "Trial", variant: "secondary", icon: RefreshCw },
  active: { label: "Ativa", variant: "default", icon: CheckCircle },
  suspended: { label: "Suspensa", variant: "destructive", icon: PauseCircle },
  cancelled: { label: "Cancelada", variant: "outline", icon: XCircle },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateDiff(d: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `Venceu há ${Math.abs(diff)} dias`;
  if (diff === 0) return "Vence hoje";
  return `${diff} dias restantes`;
}

export default function AdminAssinaturasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [historySub, setHistorySub] = useState<any | null>(null);
  const [changeHistorySub, setChangeHistorySub] = useState<any | null>(null);
  const [editingTenantId, setEditingTenantId] = useState<number | null>(null);
  const [form, setForm] = useState({
    tenantId: "",
    planoId: "",
    status: "trial",
    trialDays: "7",
    notes: "",
  });

  const { data: subscriptions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/subscriptions"],
  });

  const { data: tenantsWithout = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/tenants-without-subscription"],
    enabled: modalOpen && !editingTenantId,
  });

  const { data: planos = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/planos"],
    enabled: modalOpen,
  });
  const planosAtivos = planos.filter((p: any) => p.ativo);

  const { data: changeHistory = [], isLoading: isLoadingChangeHistory } = useQuery<any[]>({
    queryKey: ["/api/admin/subscriptions", changeHistorySub?.tenant_id, "historico"],
    enabled: !!changeHistorySub,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingTenantId) {
        return apiRequest("PATCH", `/api/admin/subscriptions/${editingTenantId}`, data);
      }
      return apiRequest("POST", "/api/admin/subscriptions", data);
    },
    onSuccess: async (res: Response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants-without-subscription"] });
      toast({ title: "Assinatura salva com sucesso" });
      const data = await res.json().catch(() => ({}));
      if (data?.asaasWarning) {
        toast({ title: "Atenção (Asaas)", description: data.asaasWarning, variant: "destructive" });
      }
      setModalOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "Erro ao salvar assinatura", variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ tenantId, action, plan }: { tenantId: number; action: string; plan?: string }) =>
      apiRequest("POST", `/api/admin/subscriptions/${tenantId}/${action}`, plan ? { plan } : {}),
    onSuccess: async (res: Response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({ title: "Operação realizada com sucesso" });
      const data = await res.json().catch(() => ({}));
      if (data?.asaasWarning) {
        toast({ title: "Atenção (Asaas)", description: data.asaasWarning, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Erro na operação", variant: "destructive" }),
  });

  function resetForm() {
    setForm({ tenantId: "", planoId: "", status: "trial", trialDays: "7", notes: "" });
    setEditingTenantId(null);
  }

  function openNew() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(sub: any) {
    setEditingTenantId(sub.tenant_id);
    setForm({
      tenantId: String(sub.tenant_id),
      planoId: sub.plano_id != null ? String(sub.plano_id) : "",
      status: sub.status,
      trialDays: "7",
      notes: sub.notes || "",
    });
    setModalOpen(true);
  }

  function handleSave() {
    saveMutation.mutate({
      tenantId: editingTenantId || parseInt(form.tenantId),
      planoId: form.planoId ? parseInt(form.planoId) : undefined,
      status: form.status,
      trialDays: parseInt(form.trialDays),
      notes: form.notes,
    });
  }

  const counts = {
    total: subscriptions.length,
    active: subscriptions.filter((s: any) => s.status === "active").length,
    trial: subscriptions.filter((s: any) => s.status === "trial").length,
    suspended: subscriptions.filter((s: any) => s.status === "suspended").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            Assinaturas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os planos e cobranças de cada tenant
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Assinatura
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: counts.total, color: "text-foreground" },
          { label: "Ativas", value: counts.active, color: "text-green-600" },
          { label: "Trial", value: counts.trial, color: "text-yellow-600" },
          { label: "Suspensas", value: counts.suspended, color: "text-red-600" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos os Tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : subscriptions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma assinatura cadastrada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Adicionais</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Trial até</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub: any) => {
                  const statusCfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.trial;
                  const Icon = statusCfg.icon;
                  const diffMsg = sub.status === "trial"
                    ? formatDateDiff(sub.trial_ends_at)
                    : formatDateDiff(sub.current_period_end);

                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="font-medium">{sub.tenant_name}</div>
                        <div className="text-xs text-muted-foreground">{sub.tenant_key}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{sub.plano_nome || sub.plan}</div>
                        <div className="text-xs text-muted-foreground">{formatPlanoValor(sub.plano_valor, sub.plano_ciclo)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant={statusCfg.variant} className="gap-1">
                            <Icon className="h-3 w-3" />
                            {statusCfg.label}
                          </Badge>
                          {sub.gateway_subscription_id ? (
                            <Badge variant="outline" className="text-xs" data-testid={`badge-asaas-${sub.tenant_id}`}>
                              Asaas
                            </Badge>
                          ) : sub.status === "active" ? (
                            <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-manual-${sub.tenant_id}`}>
                              manual
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.adicionais?.length > 0 ? (
                          <div className="flex flex-wrap gap-1" data-testid={`adicionais-${sub.tenant_id}`}>
                            {sub.adicionais.map((a: any) => (
                              <Badge key={a.id} variant="secondary" className="text-xs">
                                {a.produto ?? "Serviço"}
                              </Badge>
                            ))}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(sub.current_period_end)}</div>
                        {diffMsg && sub.status === "active" && (
                          <div className={`text-xs ${diffMsg.includes("Venceu") ? "text-red-500" : "text-muted-foreground"}`}>
                            {diffMsg}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {sub.status === "trial" ? (
                          <>
                            <div className="text-sm">{formatDate(sub.trial_ends_at)}</div>
                            {diffMsg && (
                              <div className={`text-xs ${diffMsg.includes("Venceu") ? "text-red-500" : "text-yellow-600"}`}>
                                {diffMsg}
                              </div>
                            )}
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <span className="text-xs text-muted-foreground line-clamp-2">{sub.notes || "—"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {sub.payment_history?.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setHistorySub(sub)}
                              data-testid={`button-historico-${sub.tenant_id}`}
                            >
                              Pagamentos
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setChangeHistorySub(sub)}
                            data-testid={`button-historico-alteracoes-${sub.tenant_id}`}
                          >
                            <History className="h-3.5 w-3.5" />
                            Alterações
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(sub)}
                          >
                            Editar
                          </Button>
                          {sub.status !== "active" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => actionMutation.mutate({ tenantId: sub.tenant_id, action: "activate", plan: sub.plan })}
                            >
                              Ativar
                            </Button>
                          )}
                          {sub.status === "active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => actionMutation.mutate({ tenantId: sub.tenant_id, action: "suspend" })}
                            >
                              Suspender
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de criar/editar */}
      <Dialog open={modalOpen} onOpenChange={(v) => { setModalOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTenantId ? "Editar Assinatura" : "Nova Assinatura"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editingTenantId && (
              <div>
                <Label>Tenant</Label>
                <Select value={form.tenantId} onValueChange={(v) => setForm({ ...form, tenantId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantsWithout.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} ({t.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Plano</Label>
              <Select value={form.planoId} onValueChange={(v) => setForm({ ...form, planoId: v })}>
                <SelectTrigger data-testid="select-plano">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {planosAtivos.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nome} — {formatPlanoValor(p.valor, p.ciclo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="suspended">Suspensa</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.status === "trial" && (
              <div>
                <Label>Dias de trial</Label>
                <Input
                  type="number"
                  value={form.trialDays}
                  onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                  min="1"
                  max="90"
                />
              </div>
            )}

            <div>
              <Label>Notas internas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Ex: Pago via PIX em 15/05, aguardando confirmação..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de histórico de pagamentos */}
      <Dialog open={!!historySub} onOpenChange={(v) => { if (!v) setHistorySub(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-payment-history">
          <DialogHeader>
            <DialogTitle>Histórico de pagamentos — {historySub?.tenant_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(historySub?.payment_history || []).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0" data-testid={`payment-row-${i}`}>
                <span>{formatDate(p.date)}</span>
                <span className="font-medium">
                  {typeof p.amount === "number"
                    ? p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </span>
                <span className="text-xs text-muted-foreground">{p.status || ""}</span>
                {p.invoiceUrl ? (
                  <a
                    href={p.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs hover:underline"
                  >
                    fatura
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de histórico de alterações */}
      <Dialog open={!!changeHistorySub} onOpenChange={(v) => { if (!v) setChangeHistorySub(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-change-history">
          <DialogHeader>
            <DialogTitle>Histórico de alterações — {changeHistorySub?.tenant_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {isLoadingChangeHistory ? (
              <div className="py-6 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : changeHistory.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">Nenhuma alteração registrada.</div>
            ) : (
              changeHistory.map((h: any) => (
                <div key={h.id} className="border-b pb-2 last:border-b-0 space-y-1" data-testid={`change-row-${h.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-xs">{h.tipo}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(h.criado_em)}</span>
                  </div>
                  <div className="text-sm">{h.descricao}</div>
                  {h.por_nome && (
                    <div className="text-xs text-muted-foreground">por {h.por_nome}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
