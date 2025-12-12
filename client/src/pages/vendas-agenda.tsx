import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Calendar, Phone, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import type { LeadSchedule, SalesLead, SalesLeadAssignment, SalesCampaign } from "@shared/schema";

interface ScheduleDetalhado {
  schedule: LeadSchedule;
  assignment: SalesLeadAssignment;
  lead: SalesLead;
  campaign: SalesCampaign;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "default",
  realizado: "secondary",
  cancelado: "destructive",
};

export default function VendasAgendaPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("todos");
  const [confirmDialog, setConfirmDialog] = useState<{ type: "realizado" | "cancelado"; scheduleId: number } | null>(null);

  const { data: schedules = [], isLoading } = useQuery<ScheduleDetalhado[]>({
    queryKey: ["/api/vendas/agenda/detalhado"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/vendas/agenda/${id}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/agenda/detalhado"] });
      setConfirmDialog(null);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const atenderMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await apiRequest("POST", "/api/vendas/atendimento/carregar", { assignmentId });
      return res.json();
    },
    onSuccess: (data) => {
      sessionStorage.setItem("atendimentoCarregado", JSON.stringify(data));
      setLocation("/vendas/atendimento");
    },
    onError: () => {
      toast({ title: "Erro ao carregar atendimento", variant: "destructive" });
    },
  });

  const handleAtender = (assignmentId: number) => {
    atenderMutation.mutate(assignmentId);
  };

  const handleMarkStatus = (scheduleId: number, status: "realizado" | "cancelado") => {
    setConfirmDialog({ type: status, scheduleId });
  };

  const confirmStatusChange = () => {
    if (confirmDialog) {
      updateStatusMutation.mutate({ id: confirmDialog.scheduleId, status: confirmDialog.type });
    }
  };

  const formatDateTime = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOverdue = (schedule: LeadSchedule) => {
    if (schedule.status !== "pendente") return false;
    const now = new Date();
    const scheduleDate = new Date(schedule.dataHora);
    return scheduleDate < now;
  };

  const filteredSchedules = schedules.filter((item) => {
    if (activeTab === "todos") return true;
    if (activeTab === "pendentes") return item.schedule.status === "pendente";
    if (activeTab === "realizados") return item.schedule.status === "realizado";
    if (activeTab === "cancelados") return item.schedule.status === "cancelado";
    return true;
  });

  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    return new Date(a.schedule.dataHora).getTime() - new Date(b.schedule.dataHora).getTime();
  });

  const pendingCount = schedules.filter((s) => s.schedule.status === "pendente").length;
  const overdueCount = schedules.filter((s) => isOverdue(s.schedule)).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-vendas-agenda">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Agenda do Vendedor</h1>
          <p className="text-muted-foreground">Gerencie seus retornos agendados</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Pendentes:</span>
            <Badge variant="default" data-testid="badge-pending-count">{pendingCount}</Badge>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="text-sm text-destructive">Atrasados:</span>
              <Badge variant="destructive" data-testid="badge-overdue-count">{overdueCount}</Badge>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="todos" data-testid="tab-todos">
                Todos ({schedules.length})
              </TabsTrigger>
              <TabsTrigger value="pendentes" data-testid="tab-pendentes">
                Pendentes ({schedules.filter((s) => s.schedule.status === "pendente").length})
              </TabsTrigger>
              <TabsTrigger value="realizados" data-testid="tab-realizados">
                Realizados ({schedules.filter((s) => s.schedule.status === "realizado").length})
              </TabsTrigger>
              <TabsTrigger value="cancelados" data-testid="tab-cancelados">
                Cancelados ({schedules.filter((s) => s.schedule.status === "cancelado").length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {sortedSchedules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum agendamento encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSchedules.map((item) => {
                        const overdue = isOverdue(item.schedule);
                        return (
                          <TableRow
                            key={item.schedule.id}
                            className={overdue ? "bg-destructive/10" : ""}
                            data-testid={`row-schedule-${item.schedule.id}`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {overdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                <span className={overdue ? "text-destructive font-medium" : ""}>
                                  {formatDateTime(item.schedule.dataHora)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium" data-testid={`text-client-${item.schedule.id}`}>
                                {item.lead.nome || "Sem nome"}
                              </div>
                              {item.lead.telefone1 && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {item.lead.telefone1}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" data-testid={`badge-campaign-${item.schedule.id}`}>
                                {item.campaign.nome}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground max-w-xs truncate block">
                                {item.schedule.observacao || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={STATUS_VARIANTS[item.schedule.status]}
                                data-testid={`badge-status-${item.schedule.id}`}
                              >
                                {STATUS_LABELS[item.schedule.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {item.schedule.status === "pendente" && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => handleAtender(item.assignment.id)}
                                      disabled={atenderMutation.isPending}
                                      data-testid={`button-atender-${item.schedule.id}`}
                                    >
                                      {atenderMutation.isPending && (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      )}
                                      <Phone className="h-3 w-3 mr-1" />
                                      Atender
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleMarkStatus(item.schedule.id, "realizado")}
                                      data-testid={`button-realizado-${item.schedule.id}`}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Realizado
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleMarkStatus(item.schedule.id, "cancelado")}
                                      data-testid={`button-cancelar-${item.schedule.id}`}
                                    >
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Cancelar
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === "realizado" ? "Marcar como Realizado" : "Cancelar Agendamento"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === "realizado"
                ? "Confirma que este retorno foi realizado?"
                : "Tem certeza que deseja cancelar este agendamento?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Não
            </Button>
            <Button
              variant={confirmDialog?.type === "cancelado" ? "destructive" : "default"}
              onClick={confirmStatusChange}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sim, confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
