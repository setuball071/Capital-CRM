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
import { MessageSquare, Send, Star, RefreshCw, Lock, ArrowRight, User, Bot, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Perfil {
  perfil: {
    quizAprovado: boolean;
    nivelAtual: number;
    totalSimulacoes: number;
    notaMediaGlobal: string | null;
  };
}

interface Mensagem {
  role: "corretor" | "cliente";
  content: string;
  timestamp?: Date;
}

interface Avaliacao {
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
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [modoAvaliacao, setModoAvaliacao] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: perfilData, isLoading: loadingPerfil } = useQuery<Perfil>({
    queryKey: ["/api/academia/perfil"],
  });

  const quizAprovado = perfilData?.perfil?.quizAprovado;

  // Scroll to bottom when messages change
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
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.sessaoId) {
        setSessaoId(data.sessaoId);
      }
      setMensagens((prev) => [
        ...prev,
        { role: "cliente", content: data.falaCliente, timestamp: new Date() },
      ]);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível obter resposta do cliente",
        variant: "destructive",
      });
    },
  });

  const avaliacaoMutation = useMutation({
    mutationFn: async () => {
      // Get the last corretor message for evaluation
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
      setAvaliacao(data);
      queryClient.invalidateQueries({ queryKey: ["/api/academia/perfil"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível obter avaliação",
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
    setAvaliacao(null);
    setModoAvaliacao(false);
  };

  const handleSolicitarAvaliacao = () => {
    if (mensagens.length === 0) {
      toast({
        title: "Atenção",
        description: "Inicie uma conversa antes de solicitar avaliação",
        variant: "destructive",
      });
      return;
    }
    setModoAvaliacao(true);
    avaliacaoMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviarMensagem();
    }
  };

  if (loadingPerfil) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Check quiz approval
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" data-testid="page-academia-roleplay">
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-title">Roleplay com IA</h1>
              <p className="text-muted-foreground text-sm">
                Pratique atendimento com clientes simulados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={nivelSelecionado} onValueChange={setNivelSelecionado}>
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
        {/* Chat Area */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Simulação de Atendimento
            </CardTitle>
            <CardDescription>
              Você é o corretor. O cliente é simulado pela IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <ScrollArea className="h-80 pr-4" ref={scrollRef}>
              {mensagens.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Inicie a conversa com o cliente...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mensagens.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${msg.role === "corretor" ? "justify-end" : "justify-start"}`}
                    >
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
                  ))}
                  {roleplayMutation.isPending && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <p className="text-sm text-muted-foreground">Digitando...</p>
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
            {mensagens.length > 0 && !modoAvaliacao && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSolicitarAvaliacao}
                disabled={avaliacaoMutation.isPending}
                data-testid="button-solicitar-avaliacao"
              >
                <Star className="h-4 w-4 mr-2" />
                {avaliacaoMutation.isPending ? "Avaliando..." : "Solicitar Avaliação da IA"}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Stats and Evaluation */}
        <div className="space-y-6">
          {/* Profile Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" />
                Seu Progresso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Simulações</span>
                <Badge variant="outline" data-testid="text-total-simulacoes">
                  {perfilData?.perfil?.totalSimulacoes || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Nota Média</span>
                <Badge variant="outline" data-testid="text-nota-media">
                  {perfilData?.perfil?.notaMediaGlobal || "N/A"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Nível Atual</span>
                <Badge data-testid="text-nivel-atual">
                  Nível {perfilData?.perfil?.nivelAtual || 1}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Evaluation Result */}
          {avaliacao && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Avaliação da IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary" data-testid="text-nota-global">
                    {avaliacao.nota_global.toFixed(1)}
                  </div>
                  <p className="text-sm text-muted-foreground">Nota Global</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Humanização</p>
                    <p className="font-semibold">{avaliacao.nota_humanizacao}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Consultivo</p>
                    <p className="font-semibold">{avaliacao.nota_consultivo}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Clareza</p>
                    <p className="font-semibold">{avaliacao.nota_clareza}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Venda</p>
                    <p className="font-semibold">{avaliacao.nota_venda}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-1">Comentário:</p>
                  <p className="text-sm text-muted-foreground">{avaliacao.comentario_geral}</p>
                </div>

                {avaliacao.pontos_fortes?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-green-600 mb-1">Pontos Fortes:</p>
                    <ul className="text-sm space-y-1">
                      {avaliacao.pontos_fortes.map((p, i) => (
                        <li key={i} className="text-muted-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {avaliacao.pontos_melhorar?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-orange-600 mb-1">A Melhorar:</p>
                    <ul className="text-sm space-y-1">
                      {avaliacao.pontos_melhorar.map((p, i) => (
                        <li key={i} className="text-muted-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {avaliacao.aprovado_para_proximo_nivel && (
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
