import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { MessageSquare, Send, Star, RefreshCw, Lock, ArrowRight, User, Bot, Award, ThumbsUp, ThumbsDown, Lightbulb, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Perfil {
  perfil: {
    quizAprovado: boolean;
    nivelAtual: number;
    totalSimulacoes: number;
    notaMediaGlobal: string | null;
  };
}

interface AvaliacaoResposta {
  nota: number;
  feedback: string;
  pontoPositivo?: string;
  pontoMelhorar?: string;
}

interface Mensagem {
  role: "corretor" | "cliente";
  content: string;
  timestamp?: Date;
  avaliacao?: AvaliacaoResposta;
}

interface AvaliacaoFinal {
  nota_global: number;
  nota_humanizacao: number;
  nota_consultivo: number;
  nota_clareza: number;
  nota_venda: number;
  comentario_geral: string;
  pontos_fortes: string[];
  pontos_melhorar: string[];
  nivel_sugerido: number;
  aprovado_para_proximo_nivel: boolean;
}

export default function AcademiaRoleplay() {
  const { toast } = useToast();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [inputMensagem, setInputMensagem] = useState("");
  const [sessaoId, setSessaoId] = useState<number | null>(null);
  const [nivelSelecionado, setNivelSelecionado] = useState("1");
  const [avaliacaoFinal, setAvaliacaoFinal] = useState<AvaliacaoFinal | null>(null);
  const [modoAvaliacao, setModoAvaliacao] = useState(false);
  const [avaliacoesExpandidas, setAvaliacoesExpandidas] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: perfilData, isLoading: loadingPerfil } = useQuery<Perfil>({
    queryKey: ["/api/academia/perfil"],
  });

  const quizAprovado = perfilData?.perfil?.quizAprovado;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const roleplayMutation = useMutation({
    mutationFn: async (falaCorretor: string) => {
      const response = await apiRequest("POST", "/api/treinador-consigone", {
        modo: "roleplay_cliente",
        falaCorretor,
        nivelAtual: parseInt(nivelSelecionado),
        sessaoId,
        avaliarResposta: true,
        contexto: mensagens.map((m) => `${m.role}: ${m.content}`).join("\n"),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.sessaoId) {
        setSessaoId(data.sessaoId);
      }
      
      setMensagens((prev) => {
        const updated = [...prev];
        const lastCorretorIndex = updated.findLastIndex((m) => m.role === "corretor");
        if (lastCorretorIndex !== -1 && data.avaliacao) {
          updated[lastCorretorIndex] = {
            ...updated[lastCorretorIndex],
            avaliacao: data.avaliacao,
          };
        }
        return [
          ...updated,
          { role: "cliente", content: data.falaCliente, timestamp: new Date() },
        ];
      });
      
      if (data.avaliacao?.nota) {
        const nota = data.avaliacao.nota;
        const lastIndex = mensagens.length;
        if (nota >= 8) {
          setAvaliacoesExpandidas((prev) => new Set(prev).add(lastIndex));
        }
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível obter resposta do cliente",
        variant: "destructive",
      });
    },
  });

  const avaliacaoFinalMutation = useMutation({
    mutationFn: async () => {
      const ultimaFalaCorretor = [...mensagens].reverse().find((m) => m.role === "corretor");
      if (!ultimaFalaCorretor) {
        throw new Error("Nenhuma fala para avaliar");
      }
      
      const response = await apiRequest("POST", "/api/treinador-consigone", {
        modo: "avaliacao_roleplay",
        falaCorretor: ultimaFalaCorretor.content,
        nivelAtual: parseInt(nivelSelecionado),
        sessaoId,
        contexto: mensagens.map((m) => `${m.role}: ${m.content}`).join("\n"),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAvaliacaoFinal(data);
      queryClient.invalidateQueries({ queryKey: ["/api/academia/perfil"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível obter avaliação final",
        variant: "destructive",
      });
    },
  });

  const handleEnviarMensagem = () => {
    if (!inputMensagem.trim()) return;
    
    const novaMensagem: Mensagem = {
      role: "corretor",
      content: inputMensagem.trim(),
      timestamp: new Date(),
    };
    
    setMensagens((prev) => [...prev, novaMensagem]);
    setInputMensagem("");
    roleplayMutation.mutate(inputMensagem.trim());
  };

  const handleNovaSimulacao = () => {
    setMensagens([]);
    setSessaoId(null);
    setAvaliacaoFinal(null);
    setModoAvaliacao(false);
    setAvaliacoesExpandidas(new Set());
  };

  const handleFinalizarSimulacao = () => {
    if (mensagens.length === 0) {
      toast({
        title: "Atenção",
        description: "Inicie uma conversa antes de finalizar",
        variant: "destructive",
      });
      return;
    }
    setModoAvaliacao(true);
    avaliacaoFinalMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviarMensagem();
    }
  };

  const toggleAvaliacao = (index: number) => {
    setAvaliacoesExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const calcularMediaNotas = () => {
    const avaliacoes = mensagens.filter((m) => m.avaliacao?.nota).map((m) => m.avaliacao!.nota);
    if (avaliacoes.length === 0) return null;
    return (avaliacoes.reduce((a, b) => a + b, 0) / avaliacoes.length).toFixed(1);
  };

  if (loadingPerfil) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!quizAprovado) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl" data-testid="page-academia-roleplay">
        <Card className="text-center">
          <CardContent className="pt-8 pb-8">
            <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2" data-testid="text-bloqueado">Módulo Bloqueado</h2>
            <p className="text-muted-foreground mb-6">
              Complete o quiz de fundamentos para liberar o Roleplay com IA.
            </p>
            <Link href="/academia/quiz">
              <Button data-testid="button-ir-quiz">
                Fazer Quiz
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mediaNotas = calcularMediaNotas();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" data-testid="page-academia-roleplay">
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-title">Roleplay com IA</h1>
              <p className="text-muted-foreground text-sm">
                Avaliação em tempo real a cada resposta
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={nivelSelecionado} onValueChange={setNivelSelecionado} disabled={mensagens.length > 0}>
              <SelectTrigger className="w-40" data-testid="select-nivel">
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Nível 1 - Descoberta</SelectItem>
                <SelectItem value="2">Nível 2 - Explicação</SelectItem>
                <SelectItem value="3">Nível 3 - Oferta</SelectItem>
                <SelectItem value="4">Nível 4 - Objeções</SelectItem>
                <SelectItem value="5">Nível 5 - Fechamento</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleNovaSimulacao} data-testid="button-nova-simulacao">
              <RefreshCw className="h-4 w-4 mr-2" />
              Nova
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Simulação de Atendimento
            </CardTitle>
            <CardDescription>
              Cada resposta recebe feedback instantâneo da IA
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <ScrollArea className="h-96 pr-4" ref={scrollRef}>
              {mensagens.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Inicie a conversa com o cliente...</p>
                    <p className="text-sm mt-1">Cada resposta será avaliada pela IA</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {mensagens.map((msg, index) => (
                    <div key={index}>
                      <div className={`flex gap-3 ${msg.role === "corretor" ? "justify-end" : "justify-start"}`}>
                        {msg.role === "cliente" && (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === "corretor"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                          data-testid={`mensagem-${msg.role}-${index}`}
                        >
                          <p className="text-sm">{msg.content}</p>
                        </div>
                        {msg.role === "corretor" && (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {msg.role === "corretor" && msg.avaliacao && (
                        <Collapsible 
                          open={avaliacoesExpandidas.has(index)} 
                          onOpenChange={() => toggleAvaliacao(index)}
                          className="ml-11 mr-11 mt-2"
                        >
                          <CollapsibleTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full justify-between h-8 text-xs"
                              data-testid={`toggle-avaliacao-${index}`}
                            >
                              <span className="flex items-center gap-2">
                                <Star className="h-3 w-3 text-yellow-500" />
                                Nota: {msg.avaliacao.nota}/10
                              </span>
                              <span className="text-muted-foreground">
                                {avaliacoesExpandidas.has(index) ? "Ocultar" : "Ver feedback"}
                              </span>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                              <p className="text-muted-foreground">{msg.avaliacao.feedback}</p>
                              {msg.avaliacao.pontoPositivo && (
                                <div className="flex items-start gap-2 text-green-600 dark:text-green-400">
                                  <ThumbsUp className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                  <span>{msg.avaliacao.pontoPositivo}</span>
                                </div>
                              )}
                              {msg.avaliacao.pontoMelhorar && (
                                <div className="flex items-start gap-2 text-orange-600 dark:text-orange-400">
                                  <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                  <span>{msg.avaliacao.pontoMelhorar}</span>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  ))}
                  {roleplayMutation.isPending && (
                    <div className="space-y-2">
                      <div className="flex gap-3 justify-end">
                        <div className="bg-primary/20 rounded-lg px-4 py-2 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Avaliando...</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <p className="text-sm text-muted-foreground">Cliente digitando...</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <div className="flex w-full gap-2">
              <Textarea
                placeholder="Digite sua fala como corretor..."
                value={inputMensagem}
                onChange={(e) => setInputMensagem(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-h-[60px] resize-none"
                disabled={roleplayMutation.isPending || modoAvaliacao}
                data-testid="textarea-mensagem"
              />
              <Button
                onClick={handleEnviarMensagem}
                disabled={!inputMensagem.trim() || roleplayMutation.isPending || modoAvaliacao}
                data-testid="button-enviar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {mensagens.length >= 4 && !modoAvaliacao && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleFinalizarSimulacao}
                disabled={avaliacaoFinalMutation.isPending}
                data-testid="button-finalizar-simulacao"
              >
                <Star className="h-4 w-4 mr-2" />
                {avaliacaoFinalMutation.isPending ? "Gerando avaliação final..." : "Finalizar e Ver Avaliação Completa"}
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" />
                Sessão Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Mensagens</span>
                <Badge variant="outline" data-testid="text-total-mensagens">
                  {mensagens.filter((m) => m.role === "corretor").length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Média da Sessão</span>
                <Badge 
                  variant="outline" 
                  className={mediaNotas ? (parseFloat(mediaNotas) >= 7 ? "text-green-600" : "text-orange-600") : ""}
                  data-testid="text-media-sessao"
                >
                  {mediaNotas || "N/A"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Nível</span>
                <Badge data-testid="text-nivel-atual">
                  Nível {nivelSelecionado}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5" />
                Seu Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Simulações</span>
                <Badge variant="outline" data-testid="text-total-simulacoes">
                  {perfilData?.perfil?.totalSimulacoes || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Nota Média Global</span>
                <Badge variant="outline" data-testid="text-nota-media">
                  {perfilData?.perfil?.notaMediaGlobal || "N/A"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {avaliacaoFinal && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Avaliação Final
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary" data-testid="text-nota-global">
                    {avaliacaoFinal.nota_global.toFixed(1)}
                  </div>
                  <p className="text-sm text-muted-foreground">Nota Global</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Humanização</p>
                    <p className="font-semibold">{avaliacaoFinal.nota_humanizacao}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Consultivo</p>
                    <p className="font-semibold">{avaliacaoFinal.nota_consultivo}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Clareza</p>
                    <p className="font-semibold">{avaliacaoFinal.nota_clareza}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Venda</p>
                    <p className="font-semibold">{avaliacaoFinal.nota_venda}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-1">Comentário:</p>
                  <p className="text-sm text-muted-foreground">{avaliacaoFinal.comentario_geral}</p>
                </div>

                {avaliacaoFinal.pontos_fortes?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-green-600 mb-1">Pontos Fortes:</p>
                    <ul className="text-sm space-y-1">
                      {avaliacaoFinal.pontos_fortes.map((p, i) => (
                        <li key={i} className="text-muted-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {avaliacaoFinal.pontos_melhorar?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-orange-600 mb-1">A Melhorar:</p>
                    <ul className="text-sm space-y-1">
                      {avaliacaoFinal.pontos_melhorar.map((p, i) => (
                        <li key={i} className="text-muted-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {avaliacaoFinal.aprovado_para_proximo_nivel && (
                  <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20">
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      Parabéns! Você está pronto para o próximo nível!
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
