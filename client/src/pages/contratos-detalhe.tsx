import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Send, AlertTriangle, CheckCircle2, Clock, ChevronRight,
  SkipForward, Pause, Play, XCircle, FileText, AlertCircle, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  CADASTRADA:        { label: "Cadastrada",       className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  EM_ANALISE:        { label: "Em Análise",        className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  DIGITADA:          { label: "Digitada",          className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  EM_ANDAMENTO:      { label: "Em Andamento",      className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  PENDENTE_CORRETOR: { label: "Pend. Corretor",    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  PENDENTE_BANCO:    { label: "Pend. Banco",       className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  PAGO:              { label: "Pago",              className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  CANCELADA:         { label: "Cancelada",         className: "bg-red-200 text-red-900 dark:bg-red-950/60 dark:text-red-400" },
};

const ACTION_ICONS: Record<string, any> = {
  AVANCO: CheckCircle2,
  PENDENCIA: AlertTriangle,
  RESOLUCAO: Play,
  CANCELAMENTO: XCircle,
  PAGAMENTO: CheckCircle2,
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, className: "bg-zinc-100 text-zinc-700" };
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function formatMoney(v: string | null | undefined) {
  if (!v) return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  try { return format(new Date(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return v; }
}

export default function ContratosDetalhePage() {
  const params = useParams<{ id: string }>();
  const proposalId = params.id;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");
  const [adeValue, setAdeValue] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [pauseType, setPauseType] = useState<"CORRETOR" | "BANCO">("CORRETOR");
  const [nextStatus, setNextStatus] = useState("");

  const isOperacional =
    user?.isMaster || ["coordenacao", "operacional"].includes(user?.role || "");
  const isMasterOrCoord =
    user?.isMaster || user?.role === "coordenacao";

  const { data: proposal, isLoading } = useQuery<any>({
    queryKey: ["/api/contracts/proposals", proposalId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Proposta não encontrada");
      return res.json();
    },
  });

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["/api/contracts/proposals", proposalId, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}/history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: chat } = useQuery<any>({
    queryKey: ["/api/contracts/proposals", proposalId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}/messages`, { credentials: "include" });
      if (!res.ok) return { messages: [], documents: [] };
      return res.json();
    },
    refetchInterval: 10000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals", proposalId] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals", proposalId, "history"] });
  };

  const sendMessageMutation = useMutation({
    mutationFn: (msg: string) =>
      apiRequest("POST", `/api/contracts/proposals/${proposalId}/messages`, { message: msg }),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals", proposalId, "messages"] });
    },
    onError: () => toast({ title: "Erro ao enviar mensagem", variant: "destructive" }),
  });

  const advanceStatusMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest("PUT", `/api/contracts/proposals/${proposalId}/status`, body),
    onSuccess: () => { toast({ title: "Status atualizado" }); invalidate(); setActionNotes(""); setAdeValue(""); },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const pauseMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest("POST", `/api/contracts/proposals/${proposalId}/pause`, body),
    onSuccess: () => { toast({ title: "Proposta pendenciada" }); invalidate(); setActionNotes(""); },
    onError: () => toast({ title: "Erro ao pendenciar", variant: "destructive" }),
  });

  const resumeMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest("POST", `/api/contracts/proposals/${proposalId}/resume`, body),
    onSuccess: () => { toast({ title: "Proposta retomada" }); invalidate(); setActionNotes(""); },
    onError: () => toast({ title: "Erro ao retomar", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Proposta não encontrada</p>
          <Button variant="outline" onClick={() => setLocation("/contratos")}>
            Voltar à lista
          </Button>
        </div>
      </div>
    );
  }

  const STATUSES_OPERACIONAL = [
    "CADASTRADA", "EM_ANALISE", "DIGITADA", "EM_ANDAMENTO", "PAGO", "CANCELADA"
  ];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLocation("/contratos")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold truncate">{proposal.clientName}</h1>
            <StatusBadge status={proposal.status} />
            {proposal.isPaused && (
              <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <AlertTriangle className="h-3 w-3" />
                Pendente
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Proposta #{proposal.id}</p>
        </div>
      </div>

      {/* Pending Banner */}
      {proposal.isPaused && (
        <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">
              {proposal.status === "PENDENTE_CORRETOR" ? "Aguardando ação do corretor" : "Aguardando resposta do banco"}
            </p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              Esta proposta está pausada e precisa de atenção para continuar.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Details + Actions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Proposal Data */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados da Proposta</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {[
                { label: "CPF", value: proposal.clientCpf },
                { label: "Matrícula", value: proposal.clientMatricula },
                { label: "Convênio", value: proposal.clientConvenio },
                { label: "Banco", value: proposal.bank },
                { label: "Produto", value: proposal.product },
                { label: "Valor Contrato", value: formatMoney(proposal.contractValue) },
                { label: "Parcela", value: formatMoney(proposal.installmentValue) },
                { label: "Prazo", value: proposal.term ? `${proposal.term}x` : "—" },
                { label: "ADE", value: proposal.ade || "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium mt-0.5">{value || "—"}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Flow Steps */}
          {proposal.steps && proposal.steps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Etapas do Fluxo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {proposal.steps.map((step: any, idx: number) => {
                    const isCurrent = step.id === proposal.currentStepId;
                    const isCompleted =
                      proposal.steps.findIndex((s: any) => s.id === proposal.currentStepId) > idx;
                    return (
                      <div
                        key={step.id}
                        className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                          isCurrent
                            ? "bg-primary/10 border border-primary/30"
                            : isCompleted
                            ? "bg-green-50 dark:bg-green-950/20"
                            : "bg-muted/40"
                        }`}
                        data-testid={`step-${step.id}`}
                      >
                        <div
                          className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCurrent
                              ? "bg-primary text-primary-foreground"
                              : isCompleted
                              ? "bg-green-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.stepOrder}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isCurrent ? "text-primary" : ""}`}>{step.name}</p>
                          {step.description && (
                            <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                          )}
                        </div>
                        {isCurrent && (
                          <span className="text-xs font-medium text-primary shrink-0">Atual</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Operacional Actions */}
          {isOperacional && !["PAGO", "CANCELADA"].includes(proposal.status) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ações Operacionais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Avançar para status</p>
                    <Select value={nextStatus} onValueChange={setNextStatus}>
                      <SelectTrigger data-testid="select-next-status">
                        <SelectValue placeholder="Selecione o status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES_OPERACIONAL.filter((s) => s !== proposal.status).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_CONFIG[s]?.label || s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Registrar ADE</p>
                    <Input
                      value={adeValue}
                      onChange={(e) => setAdeValue(e.target.value)}
                      placeholder="Número ADE"
                      data-testid="input-ade"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Observação</p>
                  <Textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Observação sobre a movimentação..."
                    className="resize-none"
                    rows={2}
                    data-testid="textarea-action-notes"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={(!nextStatus && !adeValue) || advanceStatusMutation.isPending}
                    onClick={() =>
                      advanceStatusMutation.mutate({
                        status: nextStatus || undefined,
                        ade: adeValue || undefined,
                        notes: actionNotes,
                        action: nextStatus === "PAGO" ? "PAGAMENTO" : nextStatus === "CANCELADA" ? "CANCELAMENTO" : "AVANCO",
                      })
                    }
                    data-testid="button-advance-status"
                  >
                    <SkipForward className="h-4 w-4 mr-2" />
                    {advanceStatusMutation.isPending ? "Salvando..." : "Confirmar"}
                  </Button>

                  {!proposal.isPaused && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() =>
                          pauseMutation.mutate({ type: "CORRETOR", notes: actionNotes || "Aguardando ação do corretor" })
                        }
                        disabled={pauseMutation.isPending}
                        data-testid="button-pause-corretor"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pend. Corretor
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          pauseMutation.mutate({ type: "BANCO", notes: actionNotes || "Aguardando resposta do banco" })
                        }
                        disabled={pauseMutation.isPending}
                        data-testid="button-pause-banco"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pend. Banco
                      </Button>
                    </>
                  )}

                  {proposal.isPaused && (
                    <Button
                      variant="outline"
                      onClick={() => resumeMutation.mutate({ notes: actionNotes || "Pendência resolvida" })}
                      disabled={resumeMutation.isPending}
                      data-testid="button-resume"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {resumeMutation.isPending ? "Retomando..." : "Retomar"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vendor Action — only when paused for corretor */}
          {user?.role === "vendedor" && proposal.isPaused && proposal.status === "PENDENTE_CORRETOR" && (
            <Card className="border-red-200 dark:border-red-900/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Ação Necessária
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Esta proposta está aguardando sua ação. Envie uma mensagem com a documentação ou informação solicitada.
                </p>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Descreva a resolução da pendência..."
                  className="resize-none"
                  rows={3}
                  data-testid="textarea-vendor-response"
                />
                <Button
                  onClick={() => resumeMutation.mutate({ notes: actionNotes })}
                  disabled={resumeMutation.isPending || !actionNotes.trim()}
                  data-testid="button-vendor-respond"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Responder Pendência
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Timeline + Chat */}
        <div className="space-y-4">
          {/* History Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem movimentações</p>
              ) : (
                <div className="space-y-4">
                  {history.map((h: any, idx: number) => {
                    const Icon = ACTION_ICONS[h.action] || Clock;
                    const isLast = idx === history.length - 1;
                    return (
                      <div key={h.id} className="flex gap-3" data-testid={`history-${h.id}`}>
                        <div className="flex flex-col items-center">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                            h.action === "AVANCO" ? "bg-green-100 text-green-600 dark:bg-green-900/40" :
                            h.action === "PENDENCIA" ? "bg-red-100 text-red-600 dark:bg-red-900/40" :
                            h.action === "RESOLUCAO" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40" :
                            h.action === "PAGAMENTO" ? "bg-green-100 text-green-600 dark:bg-green-900/40" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-4">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-medium">
                              {h.toStatus ? (STATUS_CONFIG[h.toStatus]?.label || h.toStatus) : h.action}
                            </p>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(h.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {h.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{h.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Messages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" />
                Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                {(!chat?.messages || chat.messages.length === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem mensagens</p>
                ) : (
                  chat.messages.map((msg: any) => {
                    const isMe = msg.senderId === user?.id;
                    const doc = chat.documents?.find((d: any) => d.messageId === msg.id);
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`} data-testid={`message-${msg.id}`}>
                        <div className={`max-w-[80%] rounded-md p-3 text-sm ${
                          isMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}>
                          <p>{msg.message}</p>
                          {doc && (
                            <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${isMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              <FileText className="h-3 w-3 shrink-0" />
                              <span className="truncate">{doc.fileName}</span>
                            </div>
                          )}
                          <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {format(new Date(msg.createdAt), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                  className="resize-none"
                  rows={2}
                  data-testid="textarea-message"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (message.trim()) sendMessageMutation.mutate(message.trim());
                    }
                  }}
                />
                <Button
                  size="icon"
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  onClick={() => sendMessageMutation.mutate(message.trim())}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
