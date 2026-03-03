import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardCheck, Plus, CheckCircle, Eye, EyeOff, Loader2, Send, ThumbsUp,
  AlertTriangle, Handshake, Bell, Sparkles, ArrowRight, MessageCircle, Pencil,
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
  comentario: string | null;
  comentarioAt: string | null;
  createdAt: string;
}

interface TeamUser {
  id: number;
  name: string;
}

interface AIResult {
  titulo: string;
  mensagem: string;
  sugestoes: string[];
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
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function GestorView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [tipo, setTipo] = useState("combinado");
  const [destinatarioId, setDestinatarioId] = useState<string>("todos");
  const [titulo, setTitulo] = useState("");
  const [mensagemFinal, setMensagemFinal] = useState("");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiMode, setAiMode] = useState<"none" | "loading" | "ready">("none");
  const [usandoIA, setUsandoIA] = useState(false);

  const { data: feedbacksList = [], isLoading } = useQuery<FeedbackItem[]>({
    queryKey: ["/api/feedbacks"],
  });

  const { data: teamUsers = [] } = useQuery<TeamUser[]>({
    queryKey: ["/api/feedbacks/team-users"],
  });

  const melhorarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/melhorar-feedback", {
        rascunho,
        destinatarioId: destinatarioId === "todos" ? null : parseInt(destinatarioId),
        tipo,
      });
      return res.json() as Promise<AIResult>;
    },
    onSuccess: (data) => {
      setAiResult(data);
      setAiMode("ready");
    },
    onError: () => {
      toast({ title: "Erro ao melhorar com IA", variant: "destructive" });
      setAiMode("none");
    },
  });

  const criarMutation = useMutation({
    mutationFn: async (payload: { titulo: string; mensagem: string; tipo: string; destinatarioId: number | null }) => {
      await apiRequest("POST", "/api/feedbacks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedbacks"] });
      toast({ title: "Feedback enviado com sucesso!" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao enviar feedback", variant: "destructive" });
    },
  });

  function resetForm() {
    setShowForm(false);
    setRascunho("");
    setTipo("combinado");
    setDestinatarioId("todos");
    setTitulo("");
    setMensagemFinal("");
    setAiResult(null);
    setAiMode("none");
    setUsandoIA(false);
  }

  function handleMelhorarIA() {
    if (!rascunho.trim()) {
      toast({ title: "Escreva um rascunho antes de melhorar com IA", variant: "destructive" });
      return;
    }
    setAiMode("loading");
    melhorarMutation.mutate();
  }

  function usarVersaoIA() {
    if (!aiResult) return;
    setTitulo(aiResult.titulo);
    setMensagemFinal(aiResult.mensagem);
    setUsandoIA(true);
  }

  function usarRascunhoOriginal() {
    setMensagemFinal(rascunho);
    setTitulo("");
    setUsandoIA(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-feedbacks-title">
            <ClipboardCheck className="h-5 w-5" /> Feedbacks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie feedbacks para sua equipe</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} data-testid="button-criar-feedback">
            <Plus className="h-4 w-4 mr-2" /> Novo Feedback
          </Button>
        )}
      </div>

      {showForm && (
        <Card data-testid="card-form-feedback">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Novo Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label>Rascunho</Label>
              <Textarea
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                placeholder="Escreva livremente o que você conversou pessoalmente com o vendedor..."
                rows={5}
                data-testid="input-feedback-rascunho"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleMelhorarIA}
              disabled={aiMode === "loading" || !rascunho.trim()}
              data-testid="button-melhorar-ia"
            >
              {aiMode === "loading" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando com IA...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Melhorar com IA</>
              )}
            </Button>

            {aiMode === "ready" && aiResult && (
              <div className="space-y-4">
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-muted">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Rascunho Original</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{rascunho}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-primary/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" /> Versão Melhorada pela IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm font-semibold mb-2">{aiResult.titulo}</p>
                      <p className="text-sm whitespace-pre-wrap">{aiResult.mensagem}</p>
                    </CardContent>
                  </Card>
                </div>

                {aiResult.sugestoes.length > 0 && (
                  <Card className="border-muted">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Sugestões de Desenvolvimento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {aiResult.sugestoes.map((s, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <ArrowRight className="h-3 w-3 mt-1 shrink-0 text-primary" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-3 flex-wrap">
                  <Button variant={usandoIA ? "default" : "outline"} onClick={usarVersaoIA} data-testid="button-usar-ia">
                    <Sparkles className="h-4 w-4 mr-2" /> Usar Versão IA
                  </Button>
                  <Button variant={!usandoIA && mensagemFinal ? "default" : "outline"} onClick={usarRascunhoOriginal} data-testid="button-usar-rascunho">
                    Usar Rascunho Original
                  </Button>
                </div>
              </div>
            )}

            {(aiMode === "ready" || aiMode === "none") && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Título do feedback"
                    data-testid="input-feedback-titulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem Final</Label>
                  <Textarea
                    value={mensagemFinal || rascunho}
                    onChange={(e) => setMensagemFinal(e.target.value)}
                    placeholder="Mensagem que será enviada ao vendedor..."
                    rows={5}
                    data-testid="input-feedback-mensagem"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={resetForm} data-testid="button-cancelar-feedback">
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const msg = mensagemFinal || rascunho;
                  if (!msg.trim()) {
                    toast({ title: "Escreva uma mensagem", variant: "destructive" });
                    return;
                  }
                  if (!titulo.trim()) {
                    toast({ title: "Adicione um título", variant: "destructive" });
                    return;
                  }
                  criarMutation.mutate({
                    titulo,
                    mensagem: msg,
                    tipo,
                    destinatarioId: destinatarioId === "todos" ? null : parseInt(destinatarioId),
                  });
                }}
                disabled={criarMutation.isPending}
                data-testid="button-enviar-feedback"
              >
                <Send className="h-4 w-4 mr-2" /> {criarMutation.isPending ? "Enviando..." : "Enviar Feedback"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Feedbacks Enviados</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : feedbacksList.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum feedback enviado ainda</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {feedbacksList.map((fb) => {
              const tipoConf = TIPO_CONFIG[fb.tipo] || TIPO_CONFIG.combinado;
              const TipoIcon = tipoConf.icon;
              const lidoIds = Array.isArray(fb.lidoPor) ? fb.lidoPor : [];
              return (
                <Card key={fb.id} data-testid={`card-feedback-${fb.id}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={`text-xs border ${tipoConf.badgeCor}`}>
                            <TipoIcon className="h-3 w-3 mr-1" /> {tipoConf.label}
                          </Badge>
                          {fb.destinatarioNome ? (
                            <span className="text-xs text-muted-foreground">para <span className="font-medium">{fb.destinatarioNome}</span></span>
                          ) : (
                            <span className="text-xs text-muted-foreground">para <span className="font-medium">toda equipe</span></span>
                          )}
                          <span className="text-xs text-muted-foreground">{formatDate(fb.createdAt)}</span>
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{fb.titulo}</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{fb.mensagem}</p>

                        <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            {lidoIds.length > 0 ? (
                              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Eye className="h-3 w-3" /> {lidoIds.length} {lidoIds.length === 1 ? "leu" : "leram"}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <EyeOff className="h-3 w-3" /> Ninguém leu
                              </span>
                            )}
                          </div>
                          {fb.comentario && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" /> Respondido
                            </span>
                          )}
                        </div>

                        {fb.comentario && (
                          <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border">
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[8px]">{getInitials(fb.destinatarioNome || "")}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium">{fb.destinatarioNome}</span>
                              {fb.comentarioAt && <span className="text-xs text-muted-foreground">{formatDate(fb.comentarioAt)}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{fb.comentario}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VendedorView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedFb, setSelectedFb] = useState<FeedbackItem | null>(null);
  const [comentarioText, setComentarioText] = useState("");

  const { data: feedbacksList = [], isLoading } = useQuery<FeedbackItem[]>({
    queryKey: ["/api/feedbacks"],
  });

  const marcarLidoMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/feedbacks/${id}/lido`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedbacks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedbacks/unread-count"] });
      if (selectedFb) {
        setSelectedFb((prev) => prev ? { ...prev, lidoPor: [...(prev.lidoPor || []), user?.id || 0] } : null);
      }
    },
  });

  const comentarioMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/feedbacks/${id}/comentario`, { comentario: comentarioText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedbacks"] });
      toast({ title: "Comentário enviado!" });
      if (selectedFb) {
        setSelectedFb((prev) => prev ? { ...prev, comentario: comentarioText, comentarioAt: new Date().toISOString() } : null);
      }
      setComentarioText("");
    },
    onError: () => {
      toast({ title: "Erro ao enviar comentário", variant: "destructive" });
    },
  });

  const unreadCount = feedbacksList.filter((f) => !f.lidoPor?.includes(user?.id || 0)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-feedbacks-title">
          <ClipboardCheck className="h-5 w-5" /> Feedbacks
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {unreadCount > 0
            ? `Você tem ${unreadCount} feedback${unreadCount !== 1 ? "s" : ""} não lido${unreadCount !== 1 ? "s" : ""}`
            : "Todos os feedbacks foram lidos"}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : feedbacksList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum feedback recebido ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedbacksList.map((fb) => {
            const tipoConf = TIPO_CONFIG[fb.tipo] || TIPO_CONFIG.combinado;
            const TipoIcon = tipoConf.icon;
            const isLido = fb.lidoPor?.includes(user?.id || 0);
            return (
              <Card
                key={fb.id}
                className={`cursor-pointer hover-elevate ${!isLido ? "border-primary/30" : ""}`}
                onClick={() => {
                  setSelectedFb(fb);
                  setComentarioText("");
                }}
                data-testid={`card-feedback-${fb.id}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs">{getInitials(fb.autorNome)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <Badge className={`text-xs border ${tipoConf.badgeCor}`}>
                          <TipoIcon className="h-3 w-3 mr-1" /> {tipoConf.label}
                        </Badge>
                        {!isLido && <Badge variant="outline" className="text-xs">Novo</Badge>}
                        {fb.comentario && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm truncate">{fb.titulo}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{fb.autorNome}</span>
                        <span>{formatDate(fb.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedFb} onOpenChange={(open) => { if (!open) setSelectedFb(null); }}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          {selectedFb && (() => {
            const tipoConf = TIPO_CONFIG[selectedFb.tipo] || TIPO_CONFIG.combinado;
            const TipoIcon = tipoConf.icon;
            const isLido = selectedFb.lidoPor?.includes(user?.id || 0);
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs border ${tipoConf.badgeCor}`}>
                      <TipoIcon className="h-3 w-3 mr-1" /> {tipoConf.label}
                    </Badge>
                    {!isLido && <Badge variant="outline" className="text-xs">Novo</Badge>}
                  </div>
                  <DialogTitle className="text-lg mt-2" data-testid="text-feedback-modal-titulo">{selectedFb.titulo}</DialogTitle>
                  <DialogDescription className="flex items-center gap-2 text-xs">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px]">{getInitials(selectedFb.autorNome)}</AvatarFallback>
                    </Avatar>
                    {selectedFb.autorNome} — {formatDate(selectedFb.createdAt)}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-feedback-modal-mensagem">{selectedFb.mensagem}</p>

                  {!isLido && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => marcarLidoMutation.mutate(selectedFb.id)}
                      disabled={marcarLidoMutation.isPending}
                      data-testid="button-marcar-lido"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> {marcarLidoMutation.isPending ? "Marcando..." : "Marcar como Lido"}
                    </Button>
                  )}
                  {isLido && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" /> Lido
                    </div>
                  )}

                  {selectedFb.destinatarioId && (
                    <>
                    <Separator />

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <MessageCircle className="h-4 w-4" /> Resposta / Reconhecimento
                      </Label>
                      {selectedFb.comentario ? (
                        <div className="p-3 rounded-md bg-muted/50 border border-border">
                          <p className="text-sm whitespace-pre-wrap">{selectedFb.comentario}</p>
                          {selectedFb.comentarioAt && (
                            <p className="text-xs text-muted-foreground mt-2">Enviado em {formatDate(selectedFb.comentarioAt)}</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Textarea
                            value={comentarioText}
                            onChange={(e) => setComentarioText(e.target.value)}
                            placeholder="Escreva sua resposta ou reconhecimento..."
                            rows={3}
                            data-testid="input-comentario"
                          />
                          <Button
                            size="sm"
                            onClick={() => comentarioMutation.mutate(selectedFb.id)}
                            disabled={!comentarioText.trim() || comentarioMutation.isPending}
                            data-testid="button-enviar-comentario"
                          >
                            <Send className="h-3 w-3 mr-1.5" /> {comentarioMutation.isPending ? "Enviando..." : "Enviar Comentário"}
                          </Button>
                        </div>
                      )}
                    </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DesenvolvimentoFeedbacksPage() {
  const { user } = useAuth();
  const isGestor = user?.role === "master" || user?.role === "coordenacao";

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {isGestor ? <GestorView /> : <VendedorView />}
    </div>
  );
}
