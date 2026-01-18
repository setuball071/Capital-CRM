import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { MessageSquare, Send, Star, RefreshCw, Lock, ArrowRight, User, Bot, Award, ThumbsUp, ThumbsDown, Lightbulb, Loader2, Sparkles, GraduationCap, Target, Clock, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";

interface Perfil {
  perfil: {
    quizAprovado: boolean;
    nivelAtual: number;
    totalSimulacoes: number;
    notaMediaGlobal: string | null;
  };
}

interface RoleplayNivelPrompt {
  id: number;
  nivel: number;
  nome: string;
  descricao: string | null;
  promptCompleto: string;
  criteriosAprovacao: string[];
  notaMinima: string;
  tempoLimiteMinutos: number | null;
  isActive: boolean;
  podeCustomizar: boolean;
}

type ModoRoleplay = "selecao" | "livre" | "niveis";

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
  // Modo Níveis specific fields
  modo?: string;
  nivelAvaliado?: number;
  notaMinima?: number;
  aprovado?: boolean;
  proximoNivel?: number;
  nomePersona?: string;
}

interface NivelProgresso {
  nivel: number;
  nome: string;
  descricao: string;
  notaMinima: number;
  status: "concluido" | "disponivel" | "bloqueado";
  aprovado: boolean;
  melhorNota: number | null;
  tentativas: number;
}

interface ProgressoNiveis {
  nivelAtual: number;
  niveis: NivelProgresso[];
}

export default function AcademiaRoleplay() {
  const { toast } = useToast();
  const { user, hasModuleAccess } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [inputMensagem, setInputMensagem] = useState("");
  const [sessaoId, setSessaoId] = useState<number | null>(null);
  const [nivelSelecionado, setNivelSelecionado] = useState("1");
  const [avaliacaoFinal, setAvaliacaoFinal] = useState<AvaliacaoFinal | null>(null);
  const [modoAvaliacao, setModoAvaliacao] = useState(false);
  const [avaliacoesExpandidas, setAvaliacoesExpandidas] = useState<Set<number>>(new Set());
  const [cenario, setCenario] = useState("");
  const [cenarioIniciado, setCenarioIniciado] = useState(false);
  const [mensagensEnviadas, setMensagensEnviadas] = useState(0);
  const [limiteMensagens, setLimiteMensagens] = useState(10);
  const [sessaoFinalizada, setSessaoFinalizada] = useState(false);
  const [modoRoleplay, setModoRoleplay] = useState<ModoRoleplay>("selecao");
  const [nivelModoNiveis, setNivelModoNiveis] = useState<number>(1);
  const [personaAtual, setPersonaAtual] = useState<RoleplayNivelPrompt | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Fetch nivel prompts for Modo Níveis
  const { data: nivelPrompts, isLoading: loadingNivelPrompts } = useQuery<RoleplayNivelPrompt[]>({
    queryKey: ["/api/roleplay-niveis/prompts"],
    enabled: modoRoleplay === "selecao" || modoRoleplay === "niveis",
  });

  // Fetch progression progress for Modo Níveis
  const { data: progressoNiveis, refetch: refetchProgresso } = useQuery<ProgressoNiveis>({
    queryKey: ["/api/academia/niveis/progresso"],
    enabled: modoRoleplay === "selecao" || modoRoleplay === "niveis",
  });

  // REFACTORED: Use profile-based permissions for quiz bypass
  // isMaster or users with edit access to modulo_academia can bypass quiz
  const canBypassQuiz = user?.isMaster === true || hasModuleAccess("modulo_academia", "edit");

  const { data: perfilData, isLoading: loadingPerfil } = useQuery<Perfil>({
    queryKey: ["/api/academia/perfil"],
  });

  const quizAprovado = perfilData?.perfil?.quizAprovado || canBypassQuiz;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const roleplayMutation = useMutation({
    mutationFn: async (falaCorretor: string) => {
      // Include cenario context if this roleplay started with a scenario
      const contextoBase = mensagens.map((m) => `${m.role}: ${m.content}`).join("\n");
      const contextoCompleto = cenario 
        ? `CENÁRIO INICIAL: ${cenario}\n\n${contextoBase}`
        : contextoBase;
      
      const response = await apiRequest("POST", "/api/treinador-consigone", {
        modo: "roleplay_cliente",
        falaCorretor,
        nivelAtual: parseInt(nivelSelecionado),
        sessaoId: sessaoId || undefined,
        avaliarResposta: true,
        contexto: contextoCompleto,
        cenario: cenario || undefined,
        tipoModo: modoRoleplay === "niveis" ? "niveis" : "livre",
        nivelPromptId: personaAtual?.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.sessaoId) {
        setSessaoId(data.sessaoId);
      }
      
      // Atualizar contadores de mensagens
      if (data.mensagensEnviadas !== undefined) {
        setMensagensEnviadas(data.mensagensEnviadas);
      }
      if (data.limiteMensagens !== undefined) {
        setLimiteMensagens(data.limiteMensagens);
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
      
      // Verificar se sessão foi finalizada pelo limite
      if (data.sessaoFinalizada) {
        setSessaoFinalizada(true);
        toast({
          title: "Sessão Finalizada",
          description: `Você atingiu o limite de ${data.limiteMensagens} mensagens. Solicite a avaliação final.`,
        });
        // Automaticamente solicitar avaliação final
        setTimeout(() => {
          avaliacaoFinalMutation.mutate();
        }, 500);
      }
    },
    onError: (error: any) => {
      console.error("[Roleplay] Error getting client response:", error);
      // Verificar se a sessão foi finalizada
      if (error?.message?.includes("finalizada")) {
        setSessaoFinalizada(true);
        toast({
          title: "Sessão Finalizada",
          description: "Esta sessão já foi encerrada. Inicie uma nova simulação.",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível obter resposta do cliente",
          variant: "destructive",
        });
      }
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
        sessaoId: sessaoId || undefined, // Don't send null, send undefined
        contexto: mensagens.map((m) => `${m.role}: ${m.content}`).join("\n"),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAvaliacaoFinal(data);
      queryClient.invalidateQueries({ queryKey: ["/api/academia/perfil"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academia/niveis/progresso"] });
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
    setCenario("");
    setCenarioIniciado(false);
    setMensagensEnviadas(0);
    setSessaoFinalizada(false);
    setModoRoleplay("selecao");
    setPersonaAtual(null);
    queryClient.invalidateQueries({ queryKey: ["/api/academia/perfil"] });
    queryClient.invalidateQueries({ queryKey: ["/api/academia/niveis/progresso"] });
  };
  
  const handleSelecionarModoLivre = () => {
    setModoRoleplay("livre");
  };
  
  const handleSelecionarModoNiveis = (nivel: number) => {
    const prompt = nivelPrompts?.find(p => p.nivel === nivel);
    if (prompt) {
      setNivelModoNiveis(nivel);
      setNivelSelecionado(nivel.toString());
      setPersonaAtual(prompt);
      setModoRoleplay("niveis");
    }
  };

  const cenarioMutation = useMutation({
    mutationFn: async (cenarioTexto: string) => {
      const response = await apiRequest("POST", "/api/treinador-consigone", {
        modo: "roleplay_cliente",
        cenario: cenarioTexto,
        nivelAtual: parseInt(nivelSelecionado),
        tipoModo: modoRoleplay === "niveis" ? "niveis" : "livre",
        nivelPromptId: personaAtual?.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.sessaoId) {
        setSessaoId(data.sessaoId);
      }
      setCenarioIniciado(true);
      setMensagens([{ role: "cliente", content: data.falaCliente, timestamp: new Date() }]);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o cenário",
        variant: "destructive",
      });
    },
  });

  const handleIniciarCenario = () => {
    if (!cenario.trim()) {
      toast({
        title: "Atenção",
        description: "Descreva o cenário que deseja treinar",
        variant: "destructive",
      });
      return;
    }
    cenarioMutation.mutate(cenario.trim());
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
  
  // Tela de seleção de modo
  if (modoRoleplay === "selecao") {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl" data-testid="page-academia-roleplay">
        <div className="mb-8 text-center">
          <MessageSquare className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Roleplay com IA</h1>
          <p className="text-muted-foreground">
            Escolha o modo de treinamento para praticar suas habilidades de vendas
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Modo Livre */}
          <Card className="hover-elevate cursor-pointer" onClick={handleSelecionarModoLivre} data-testid="card-modo-livre">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Modo Livre</CardTitle>
                  <CardDescription>Treino customizável</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Crie cenários personalizados e treine situações específicas do seu dia a dia.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Cenários personalizados</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Sem limite de tempo</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Feedback em tempo real</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" data-testid="button-iniciar-modo-livre">
                <Sparkles className="h-4 w-4 mr-2" />
                Iniciar Modo Livre
              </Button>
            </CardFooter>
          </Card>
          
          {/* Modo Níveis */}
          <Card className="hover-elevate cursor-pointer" data-testid="card-modo-niveis">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <GraduationCap className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">Modo Níveis</CardTitle>
                  <CardDescription>Progressão estruturada</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enfrente 5 personas com dificuldade crescente e obtenha aprovação formal.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-amber-500" />
                  <span>5 níveis de dificuldade</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-amber-500" />
                  <span>Personas realistas</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-amber-500" />
                  <span>Nota mínima para aprovar</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <p className="text-xs text-muted-foreground w-full">Selecione o nível:</p>
              <div className="grid grid-cols-5 gap-1 w-full">
                {loadingNivelPrompts ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))
                ) : (
                  nivelPrompts?.map((prompt) => {
                    const progresso = progressoNiveis?.niveis?.find(n => n.nivel === prompt.nivel);
                    const status = progresso?.status || (prompt.nivel === 1 ? "disponivel" : "bloqueado");
                    const isBloqueado = status === "bloqueado";
                    const isConcluido = status === "concluido";
                    
                    return (
                      <Button
                        key={prompt.nivel}
                        variant={isConcluido ? "default" : "outline"}
                        size="sm"
                        className={`flex-col h-auto py-2 relative ${isConcluido ? "bg-green-600 hover:bg-green-700" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isBloqueado) {
                            handleSelecionarModoNiveis(prompt.nivel);
                          }
                        }}
                        disabled={!prompt.isActive || isBloqueado}
                        data-testid={`button-nivel-${prompt.nivel}`}
                      >
                        {isConcluido && (
                          <CheckCircle className="h-3 w-3 absolute top-1 right-1" />
                        )}
                        {isBloqueado && (
                          <Lock className="h-3 w-3 absolute top-1 right-1" />
                        )}
                        <span className="font-bold">{prompt.nivel}</span>
                        {progresso?.melhorNota !== null && progresso?.melhorNota !== undefined && (
                          <span className="text-[10px] opacity-70">{progresso.melhorNota.toFixed(1)}</span>
                        )}
                      </Button>
                    );
                  })
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
        
        {/* Descrição dos níveis */}
        {nivelPrompts && nivelPrompts.length > 0 && (
          <Card className="mt-6 max-w-3xl mx-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Personas do Modo Níveis</CardTitle>
              <CardDescription>Conheça os clientes que você vai enfrentar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {nivelPrompts.map((prompt) => {
                  const progresso = progressoNiveis?.niveis?.find(n => n.nivel === prompt.nivel);
                  const status = progresso?.status || (prompt.nivel === 1 ? "disponivel" : "bloqueado");
                  
                  return (
                    <div 
                      key={prompt.nivel} 
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        status === "concluido" ? "bg-green-500/10 border border-green-500/30" : 
                        status === "bloqueado" ? "bg-muted/30 opacity-60" : 
                        "bg-muted/50"
                      }`}
                    >
                      <Badge 
                        variant={status === "concluido" ? "default" : "outline"} 
                        className={`shrink-0 ${status === "concluido" ? "bg-green-600" : ""}`}
                      >
                        {status === "concluido" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {status === "bloqueado" && <Lock className="h-3 w-3 mr-1" />}
                        Nível {prompt.nivel}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{prompt.nome}</p>
                        <p className="text-sm text-muted-foreground">{prompt.descricao}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Nota mínima: {prompt.notaMinima}
                          </span>
                          {prompt.tempoLimiteMinutos && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {prompt.tempoLimiteMinutos} min
                            </span>
                          )}
                          {progresso?.melhorNota !== null && progresso?.melhorNota !== undefined && (
                            <span className="flex items-center gap-1">
                              <Award className="h-3 w-3" />
                              Melhor nota: {progresso.melhorNota.toFixed(1)}
                            </span>
                          )}
                          {progresso?.tentativas ? (
                            <span className="flex items-center gap-1">
                              {progresso.tentativas} tentativa{progresso.tentativas !== 1 ? 's' : ''}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
  
  // Header para modos ativos
  const renderHeader = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {modoRoleplay === "livre" ? (
            <Sparkles className="h-8 w-8 text-primary" />
          ) : (
            <GraduationCap className="h-8 w-8 text-amber-500" />
          )}
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-title">
              {modoRoleplay === "livre" ? "Modo Livre" : `Nível ${nivelModoNiveis}: ${personaAtual?.nome || ""}`}
            </h1>
            <p className="text-muted-foreground text-sm">
              {modoRoleplay === "livre" 
                ? "Treinamento com cenários personalizados"
                : personaAtual?.descricao || "Avaliação estruturada"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {modoRoleplay === "livre" && (
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
          )}
          {modoRoleplay === "niveis" && personaAtual && (
            <Badge variant="outline" className="px-3 py-1">
              <Target className="h-3 w-3 mr-1" />
              Meta: {personaAtual.notaMinima}
            </Badge>
          )}
          <Button variant="outline" onClick={handleNovaSimulacao} data-testid="button-nova-simulacao">
            <RefreshCw className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" data-testid="page-academia-roleplay">
      {renderHeader()}

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
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  {!cenarioIniciado ? (
                    <div className="w-full max-w-md space-y-4">
                      <div className="text-center mb-4">
                        <Lightbulb className="h-10 w-10 mx-auto mb-2 text-yellow-500" />
                        <p className="font-medium text-foreground">Treinar cenário específico?</p>
                        <p className="text-sm">Descreva uma situação e a IA iniciará nesse contexto</p>
                      </div>
                      <Textarea
                        placeholder='Ex: "cliente disse que vai pensar", "cliente reclama da taxa", "cliente quer saber a diferença do cartão"...'
                        value={cenario}
                        onChange={(e) => setCenario(e.target.value)}
                        className="min-h-[80px] text-foreground"
                        data-testid="textarea-cenario"
                      />
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleIniciarCenario} 
                          disabled={cenarioMutation.isPending || !cenario.trim()}
                          className="flex-1"
                          data-testid="button-iniciar-cenario"
                        >
                          {cenarioMutation.isPending ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Iniciando...</>
                          ) : (
                            <>Iniciar no Cenário</>
                          )}
                        </Button>
                      </div>
                      <div className="text-center text-sm text-muted-foreground">
                        <p>ou</p>
                        <p className="mt-1">Inicie a conversa normalmente digitando abaixo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Inicie a conversa com o cliente...</p>
                      <p className="text-sm mt-1">Cada resposta será avaliada pela IA</p>
                    </div>
                  )}
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
                disabled={roleplayMutation.isPending || modoAvaliacao || sessaoFinalizada}
                data-testid="textarea-mensagem"
              />
              <Button
                onClick={handleEnviarMensagem}
                disabled={!inputMensagem.trim() || roleplayMutation.isPending || modoAvaliacao || sessaoFinalizada}
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
                <Badge 
                  variant="outline" 
                  className={mensagensEnviadas >= limiteMensagens - 2 ? "text-orange-600" : ""}
                  data-testid="text-total-mensagens"
                >
                  {mensagensEnviadas}/{limiteMensagens}
                </Badge>
              </div>
              {sessaoFinalizada && (
                <div className="text-center py-2">
                  <Badge variant="secondary" className="text-orange-600">
                    Limite atingido
                  </Badge>
                </div>
              )}
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
                    {avaliacaoFinal.nota_global?.toFixed(1) ?? "N/A"}
                  </div>
                  <p className="text-sm text-muted-foreground">Nota Global</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Humanização</p>
                    <p className="font-semibold">{avaliacaoFinal.nota_humanizacao ?? "N/A"}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Consultivo</p>
                    <p className="font-semibold">{avaliacaoFinal.nota_consultivo ?? "N/A"}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Clareza</p>
                    <p className="font-semibold">{avaliacaoFinal.nota_clareza ?? "N/A"}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Venda</p>
                    <p className="font-semibold">{avaliacaoFinal.nota_venda ?? "N/A"}</p>
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

                {/* Modo Níveis: Progressão */}
                {avaliacaoFinal.modo === "niveis" && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">
                        Avaliação do Nível {avaliacaoFinal.nivelAvaliado}: {avaliacaoFinal.nomePersona}
                      </span>
                      <Badge variant="outline">
                        Nota mínima: {avaliacaoFinal.notaMinima}
                      </Badge>
                    </div>
                    
                    {avaliacaoFinal.aprovado ? (
                      <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700 dark:text-green-400">
                          <span className="font-semibold">APROVADO!</span> Parabéns! 
                          {avaliacaoFinal.proximoNivel && avaliacaoFinal.proximoNivel !== avaliacaoFinal.nivelAvaliado && (
                            <span> O Nível {avaliacaoFinal.proximoNivel} foi desbloqueado.</span>
                          )}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-900/20">
                        <Target className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-700 dark:text-orange-400">
                          <span className="font-semibold">Não aprovado.</span> Sua nota foi {avaliacaoFinal.nota_global?.toFixed(1)}, 
                          mas a nota mínima é {avaliacaoFinal.notaMinima}. Tente novamente!
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Modo Livre: Aprovação genérica */}
                {avaliacaoFinal.modo !== "niveis" && avaliacaoFinal.aprovado_para_proximo_nivel && (
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
