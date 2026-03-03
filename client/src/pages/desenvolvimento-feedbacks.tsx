import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, Plus, CheckCircle, Eye, EyeOff, Loader2, Send, ThumbsUp, AlertTriangle, Handshake, Bell,
} from "lucide-react";

interface FeedbackItem {
  id: number;
  autorId: number;
  autorNome: string;
  destinatarioId: number | null;
  destinatarioNome: string | null;
  titulo: string;
  mensagem: string;
  tipo: string;
  lidoPor: number[];
  createdAt: string;
}

interface TeamUser {
  id: number;
  name: string;
}

const TIPO_CONFIG: Record<string, { label: string; icon: typeof ThumbsUp; badgeCor: string }> = {
  elogio: { label: "Elogio", icon: ThumbsUp, badgeCor: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" },
  melhoria: { label: "Melhoria", icon: AlertTriangle, badgeCor: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" },
  combinado: { label: "Combinado", icon: Handshake, badgeCor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  aviso: { label: "Aviso", icon: Bell, badgeCor: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
};

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DesenvolvimentoFeedbacksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isGestor = user?.role === "master" || user?.role === "coordenacao";
  const [criarOpen, setCriarOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [tipo, setTipo] = useState("combinado");
  const [destinatarioId, setDestinatarioId] = useState<string>("todos");

  const { data: feedbacksList = [], isLoading } = useQuery<FeedbackItem[]>({
    queryKey: ["/api/feedbacks"],
  });

  const { data: teamUsers = [] } = useQuery<TeamUser[]>({
    queryKey: ["/api/feedbacks/team-users"],
    enabled: isGestor,
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/feedbacks", {
        titulo,
        mensagem,
        tipo,
        destinatarioId: destinatarioId === "todos" ? null : parseInt(destinatarioId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedbacks"] });
      toast({ title: "Feedback enviado!" });
      setCriarOpen(false);
      setTitulo("");
      setMensagem("");
      setTipo("combinado");
      setDestinatarioId("todos");
    },
    onError: () => {
      toast({ title: "Erro ao enviar feedback", variant: "destructive" });
    },
  });

  const marcarLidoMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/feedbacks/${id}/lido`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedbacks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedbacks/unread-count"] });
    },
  });

  const unreadCount = feedbacksList.filter((f) => !f.lidoPor?.includes(user?.id || 0)).length;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-feedbacks-title">
            <MessageSquare className="h-5 w-5" /> Feedbacks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isGestor ? "Gerencie feedbacks para sua equipe" : `Você tem ${unreadCount} feedback${unreadCount !== 1 ? "s" : ""} não lido${unreadCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        {isGestor && (
          <Button onClick={() => setCriarOpen(true)} data-testid="button-criar-feedback">
            <Plus className="h-4 w-4 mr-2" /> Novo Feedback
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : feedbacksList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum feedback encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedbacksList.map((fb) => {
            const tipoConf = TIPO_CONFIG[fb.tipo] || TIPO_CONFIG.combinado;
            const TipoIcon = tipoConf.icon;
            const isLido = fb.lidoPor?.includes(user?.id || 0);
            return (
              <Card key={fb.id} className={!isLido ? "border-primary/30" : ""} data-testid={`card-feedback-${fb.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs">{getInitials(fb.autorNome)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm">{fb.autorNome}</span>
                        <Badge className={`text-xs border ${tipoConf.badgeCor}`}>
                          <TipoIcon className="h-3 w-3 mr-1" /> {tipoConf.label}
                        </Badge>
                        {fb.destinatarioNome ? (
                          <span className="text-xs text-muted-foreground">para {fb.destinatarioNome}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">para toda equipe</span>
                        )}
                        {!isLido && <Badge variant="outline" className="text-xs">Novo</Badge>}
                      </div>
                      <h3 className="font-semibold text-sm mb-1">{fb.titulo}</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{fb.mensagem}</p>
                      <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{formatDate(fb.createdAt)}</span>
                        <div className="flex items-center gap-2">
                          {isGestor && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {fb.lidoPor?.length > 0 ? (
                                <><Eye className="h-3 w-3" /> {fb.lidoPor.length} leu</>
                              ) : (
                                <><EyeOff className="h-3 w-3" /> Ninguém leu</>
                              )}
                            </span>
                          )}
                          {!isLido && !isGestor && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => marcarLidoMutation.mutate(fb.id)}
                              disabled={marcarLidoMutation.isPending}
                              data-testid={`button-marcar-lido-${fb.id}`}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Marcar como lido
                            </Button>
                          )}
                          {isLido && (
                            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Lido
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={criarOpen} onOpenChange={setCriarOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Novo Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destinatário</Label>
              <Select value={destinatarioId} onValueChange={setDestinatarioId}>
                <SelectTrigger data-testid="select-destinatario">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Toda a Equipe</SelectItem>
                  {teamUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger data-testid="select-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="elogio">Elogio</SelectItem>
                  <SelectItem value="melhoria">Melhoria</SelectItem>
                  <SelectItem value="combinado">Combinado</SelectItem>
                  <SelectItem value="aviso">Aviso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do feedback" data-testid="input-feedback-titulo" />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Escreva sua mensagem..." rows={5} data-testid="input-feedback-mensagem" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCriarOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => criarMutation.mutate()}
              disabled={!titulo.trim() || !mensagem.trim() || criarMutation.isPending}
              data-testid="button-enviar-feedback"
            >
              <Send className="h-4 w-4 mr-2" /> {criarMutation.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
