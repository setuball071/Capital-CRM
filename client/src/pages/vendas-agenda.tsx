import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Loader2, Calendar, ChevronLeft, ChevronRight, Plus, Phone, CheckCircle, XCircle,
  Clock, AlertTriangle, User, Trash2, ListTodo, Bell, GitBranch, Pencil,
} from "lucide-react";
import type { Appointment } from "@shared/schema";
import { APPOINTMENT_KINDS, APPOINTMENT_KIND_LABELS } from "@shared/schema";

const WEEKDAYS = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];

const KIND_ICONS: Record<string, typeof Phone> = {
  client_followup: Phone,
  task: ListTodo,
  reminder: Bell,
  pipeline_segment: GitBranch,
};

const KIND_COLORS: Record<string, string> = {
  client_followup: "text-blue-500 dark:text-blue-400",
  task: "text-green-500 dark:text-green-400",
  reminder: "text-amber-500 dark:text-amber-400",
  pipeline_segment: "text-purple-500 dark:text-purple-400",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  done: "Concluído",
  canceled: "Cancelado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  done: "secondary",
  canceled: "destructive",
};

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  for (let d = 1; d <= totalDays; d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
  }

  return days;
}

function formatTime(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isToday(date: Date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export default function VendasAgendaPage() {
  const { toast } = useToast();
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [deleteApptId, setDeleteApptId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [formKind, setFormKind] = useState<string>("reminder");
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formClientCpf, setFormClientCpf] = useState("");
  const [formPipelineColumn, setFormPipelineColumn] = useState("");
  const [formPipelineAction, setFormPipelineAction] = useState("");

  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
  const fromISO = monthStart.toISOString();
  const toISO = monthEnd.toISOString();

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", currentYear, currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/appointments?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar agendamentos");
      return res.json();
    },
  });

  const calendarDays = useMemo(() => getCalendarDays(currentYear, currentMonth), [currentYear, currentMonth]);

  const appointmentsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const appt of appointments) {
      const key = dateKey(new Date(appt.scheduledFor));
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    }
    for (const key in map) {
      map[key].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
    }
    return map;
  }, [appointments]);

  const selectedDayAppts = selectedDay ? (appointmentsByDay[selectedDay] || []) : [];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(currentYear - 1); setCurrentMonth(11); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(currentYear + 1); setCurrentMonth(0); }
    else setCurrentMonth(currentMonth + 1);
  };
  const goToday = () => { setCurrentYear(now.getFullYear()); setCurrentMonth(now.getMonth()); };

  const monthName = new Date(currentYear, currentMonth).toLocaleString("pt-BR", { month: "long", year: "numeric" });

  const resetForm = () => {
    setFormKind("reminder");
    setFormTitle("");
    setFormNotes("");
    setFormDate("");
    setFormClientName("");
    setFormClientCpf("");
    setFormPipelineColumn("");
    setFormPipelineAction("");
    setEditingAppt(null);
  };

  const openCreate = (prefillDate?: string) => {
    resetForm();
    if (prefillDate) {
      const d = new Date(prefillDate + "T09:00");
      setFormDate(prefillDate + "T09:00");
    }
    setCreateDialogOpen(true);
  };

  const openEdit = (appt: Appointment) => {
    setEditingAppt(appt);
    setFormKind(appt.kind || "reminder");
    setFormTitle(appt.title);
    setFormNotes(appt.notes || "");
    const d = new Date(appt.scheduledFor);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setFormDate(local);
    setFormClientName(appt.clientName || "");
    setFormClientCpf(appt.clientCpf || "");
    const payload = appt.payload as any;
    setFormPipelineColumn(payload?.pipelineColumn || "");
    setFormPipelineAction(payload?.action || "");
    setCreateDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/appointments", data);
    },
    onSuccess: () => {
      toast({ title: "Agendamento criado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao criar agendamento", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/appointments/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Agendamento atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar agendamento", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Agendamento excluído!" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setDeleteApptId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/appointments/${id}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formTitle.trim()) {
      toast({ title: "Informe o título", variant: "destructive" });
      return;
    }
    if (!formDate) {
      toast({ title: "Informe a data e hora", variant: "destructive" });
      return;
    }

    const body: any = {
      kind: formKind,
      title: formTitle.trim(),
      notes: formNotes.trim() || null,
      scheduledFor: formDate,
    };

    if (formKind === "client_followup" || formKind === "task") {
      body.clientName = formClientName.trim() || null;
      body.clientCpf = formClientCpf.trim() || null;
    }

    if (formKind === "pipeline_segment") {
      body.payload = {
        pipelineColumn: formPipelineColumn,
        action: formPipelineAction,
      };
    }

    if (editingAppt) {
      updateMutation.mutate({ id: editingAppt.id, data: body });
    } else {
      createMutation.mutate(body);
    }
  };

  const openCount = appointments.filter((a) => a.status === "open").length;
  const overdueCount = appointments.filter((a) => a.status === "open" && new Date(a.scheduledFor) < now).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="page-vendas-agenda">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-muted-foreground">Seus compromissos e agendamentos</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Abertos:</span>
            <Badge variant="default" data-testid="badge-open-count">{openCount}</Badge>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">Atrasados:</span>
              <Badge variant="destructive" data-testid="badge-overdue-count">{overdueCount}</Badge>
            </div>
          )}
          <Button onClick={() => openCreate()} data-testid="button-new-appointment">
            <Plus className="h-4 w-4 mr-1" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={prevMonth} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold capitalize min-w-[180px] text-center" data-testid="text-current-month">
                {monthName}
              </h2>
              <Button size="icon" variant="ghost" onClick={nextMonth} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToday} data-testid="button-today">
              Hoje
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-4">
          <div className="grid grid-cols-7 border-b">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2 border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((dayInfo, idx) => {
              const key = dateKey(dayInfo.date);
              const dayAppts = appointmentsByDay[key] || [];
              const isTodayDate = isToday(dayInfo.date);
              const isSelected = selectedDay === key;
              return (
                <div
                  key={idx}
                  className={`
                    min-h-[90px] md:min-h-[110px] border-r border-b last:border-r-0 p-1 cursor-pointer transition-colors
                    ${!dayInfo.isCurrentMonth ? "bg-muted/30" : ""}
                    ${isSelected ? "bg-accent/30" : ""}
                    ${isTodayDate ? "ring-1 ring-inset ring-primary/40" : ""}
                  `}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  data-testid={`cell-day-${key}`}
                >
                  <div className={`text-right text-sm mb-1 ${!dayInfo.isCurrentMonth ? "text-muted-foreground/50" : ""} ${isTodayDate ? "font-bold text-primary" : ""}`}>
                    {dayInfo.date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayAppts.slice(0, 3).map((appt) => {
                      const KindIcon = KIND_ICONS[appt.kind] || Bell;
                      const kindColor = KIND_COLORS[appt.kind] || "text-muted-foreground";
                      return (
                        <div
                          key={appt.id}
                          className={`text-[10px] md:text-xs truncate flex items-center gap-1 ${appt.status === "done" ? "line-through text-muted-foreground" : appt.status === "canceled" ? "line-through text-muted-foreground/50" : ""}`}
                          title={`${formatTime(appt.scheduledFor)} ${appt.title}`}
                          data-testid={`appt-mini-${appt.id}`}
                        >
                          <KindIcon className={`h-2.5 w-2.5 shrink-0 ${kindColor}`} />
                          <span className="text-muted-foreground">{formatTime(appt.scheduledFor)}</span>
                          <span className="truncate">{appt.title}</span>
                        </div>
                      );
                    })}
                    {dayAppts.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">+{dayAppts.length - 3} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(selectedDay + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </CardTitle>
              <Button size="sm" onClick={() => openCreate(selectedDay)} data-testid="button-add-to-day">
                <Plus className="h-3 w-3 mr-1" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedDayAppts.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">Nenhum compromisso neste dia</p>
            ) : (
              <div className="space-y-2">
                {selectedDayAppts.map((appt) => {
                  const KindIcon = KIND_ICONS[appt.kind] || Bell;
                  const kindColor = KIND_COLORS[appt.kind] || "text-muted-foreground";
                  const isOverdue = appt.status === "open" && new Date(appt.scheduledFor) < now;
                  return (
                    <div
                      key={appt.id}
                      className={`flex items-start gap-3 p-3 rounded-md border ${isOverdue ? "border-destructive/40 bg-destructive/5" : ""}`}
                      data-testid={`appt-detail-${appt.id}`}
                    >
                      <div className={`mt-0.5 ${kindColor}`}>
                        <KindIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${appt.status === "done" ? "line-through text-muted-foreground" : appt.status === "canceled" ? "line-through text-muted-foreground/50" : ""}`} data-testid={`text-appt-title-${appt.id}`}>
                            {appt.title}
                          </span>
                          <Badge variant={STATUS_VARIANTS[appt.status] || "outline"} className="text-[10px]" data-testid={`badge-appt-status-${appt.id}`}>
                            {STATUS_LABELS[appt.status] || appt.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {APPOINTMENT_KIND_LABELS[appt.kind] || appt.kind}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(appt.scheduledFor)}
                          {isOverdue && <span className="text-destructive text-xs font-medium">Atrasado</span>}
                        </div>
                        {appt.clientName && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            {appt.clientName}
                            {appt.clientCpf && <span className="text-xs">({appt.clientCpf})</span>}
                          </div>
                        )}
                        {appt.notes && <p className="text-sm text-muted-foreground mt-1">{appt.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {appt.status === "open" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => statusMutation.mutate({ id: appt.id, status: "done" })}
                            title="Marcar concluído"
                            data-testid={`button-appt-done-${appt.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(appt)}
                          title="Editar"
                          data-testid={`button-appt-edit-${appt.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteApptId(appt.id)}
                          title="Excluir"
                          data-testid={`button-appt-delete-${appt.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) { setCreateDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAppt ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
            <DialogDescription>Preencha os dados do compromisso</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={formKind} onValueChange={setFormKind}>
                <SelectTrigger data-testid="select-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{APPOINTMENT_KIND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Título *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={
                  formKind === "client_followup" ? "Ex: Retorno para João" :
                  formKind === "task" ? "Ex: Preparar documentação" :
                  formKind === "pipeline_segment" ? "Ex: Ligar para leads em Atendimento" :
                  "Ex: Buscar contrato no banco"
                }
                data-testid="input-title"
              />
            </div>

            <div>
              <Label>Data e Hora *</Label>
              <Input
                type="datetime-local"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                data-testid="input-datetime"
              />
            </div>

            {(formKind === "client_followup" || formKind === "task") && (
              <div className="space-y-3">
                <div>
                  <Label>Nome do Cliente</Label>
                  <Input
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value)}
                    placeholder="Nome do cliente"
                    data-testid="input-client-name"
                  />
                </div>
                <div>
                  <Label>CPF do Cliente</Label>
                  <Input
                    value={formClientCpf}
                    onChange={(e) => setFormClientCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    data-testid="input-client-cpf"
                  />
                </div>
              </div>
            )}

            {formKind === "pipeline_segment" && (
              <div className="space-y-3">
                <div>
                  <Label>Coluna do Pipeline</Label>
                  <Select value={formPipelineColumn} onValueChange={setFormPipelineColumn}>
                    <SelectTrigger data-testid="select-pipeline-column">
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="atendimento">Atendimento</SelectItem>
                      <SelectItem value="interesse">Interesse</SelectItem>
                      <SelectItem value="negociacao">Negociação</SelectItem>
                      <SelectItem value="fechamento">Fechamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ação</Label>
                  <Input
                    value={formPipelineAction}
                    onChange={(e) => setFormPipelineAction(e.target.value)}
                    placeholder="Ex: Entrar em contato, Revisar propostas"
                    data-testid="input-pipeline-action"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Notas adicionais..."
                rows={3}
                data-testid="textarea-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }} data-testid="button-cancel-form">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-appointment"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAppt ? "Salvar" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteApptId !== null} onOpenChange={() => setDeleteApptId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Agendamento</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteApptId(null)} data-testid="button-cancel-delete">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteApptId !== null && deleteMutation.mutate(deleteApptId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
