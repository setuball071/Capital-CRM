import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ClipboardCheck, CheckCircle2, XCircle, ArrowRight, RotateCcw, Trophy, AlertCircle, Lock, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Licao {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  atividadePratica: string;
}

interface Nivel {
  id: number;
  nome: string;
  descricao: string;
  icone: string;
  licoes: Licao[];
}

interface ProgressoLicao {
  licaoId: string;
  concluida: boolean;
}

interface Pergunta {
  id: number;
  pergunta: string;
  opcoes: string[];
}

interface ResultadoQuiz {
  acertos: number;
  total: number;
  percentual: number;
  aprovado: boolean;
  resultados: { perguntaId: number; correto: boolean; respostaCorreta: number }[];
  mensagem: string;
}

interface Perfil {
  perfil: {
    quizAprovado: boolean;
    nivelAtual: number;
  };
}

export default function AcademiaQuiz() {
  const { toast } = useToast();
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [resultado, setResultado] = useState<ResultadoQuiz | null>(null);

  // Get user profile to check if quiz is already approved
  const { data: perfilData } = useQuery<Perfil>({
    queryKey: ["/api/academia/perfil"],
  });

  // Get lesson progress to check if user can take quiz
  const { data: progressoData } = useQuery<{ 
    progresso: ProgressoLicao[]; 
    quizAprovado: boolean;
    nivelAtual: number;
  }>({
    queryKey: ["/api/academia/progresso"],
  });

  const { data: niveisData } = useQuery<{ niveis: Nivel[] }>({
    queryKey: ["/api/academia/niveis"],
  });

  const { data: quizData, isLoading } = useQuery<{ perguntas: Pergunta[] }>({
    queryKey: ["/api/academia/quiz"],
  });
  
  // Calculate total lessons and completed lessons
  const niveis = niveisData?.niveis || [];
  const progresso = progressoData?.progresso || [];
  
  // For now, require at least 1 level (5 lessons) to be completed
  const totalLicoesNivel1 = niveis[0]?.licoes.length || 5;
  const licoesConcluidas = progresso.filter(p => p.concluida && p.licaoId.startsWith("1.")).length;
  const podeRealizarQuiz = licoesConcluidas >= totalLicoesNivel1;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/academia/quiz", { respostas });
      return response.json();
    },
    onSuccess: (data: ResultadoQuiz) => {
      setResultado(data);
      queryClient.invalidateQueries({ queryKey: ["/api/academia/perfil"] });
      if (data.aprovado) {
        toast({
          title: "Parabéns!",
          description: "Você foi aprovado no quiz!",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível submeter o quiz",
        variant: "destructive",
      });
    },
  });

  const handleSelectOption = (perguntaId: number, opcaoIndex: number) => {
    setRespostas((prev) => ({ ...prev, [perguntaId]: opcaoIndex }));
  };

  const handleSubmit = () => {
    if (!quizData?.perguntas) return;
    
    // Check if all questions are answered
    const todasRespondidas = quizData.perguntas.every((p) => respostas[p.id] !== undefined);
    if (!todasRespondidas) {
      toast({
        title: "Atenção",
        description: "Responda todas as perguntas antes de enviar",
        variant: "destructive",
      });
      return;
    }
    
    submitMutation.mutate();
  };

  const handleRetry = () => {
    setResultado(null);
    setRespostas({});
  };

  const perguntas = quizData?.perguntas || [];
  const respondidas = Object.keys(respostas).length;
  const progressoQuiz = perguntas.length > 0 ? (respondidas / perguntas.length) * 100 : 0;
  const quizAprovado = perfilData?.perfil?.quizAprovado;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-8" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show locked message if lessons not completed
  if (!podeRealizarQuiz && !quizAprovado && !resultado) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl" data-testid="page-academia-quiz">
        <Card className="text-center">
          <CardContent className="pt-8 pb-8">
            <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2" data-testid="text-quiz-bloqueado">Quiz Bloqueado</h2>
            <p className="text-muted-foreground mb-4">
              Complete todas as lições do Nível 1 (Descoberta) para liberar o quiz.
            </p>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Progresso do Nível 1</span>
                <Badge variant="outline">{licoesConcluidas}/{totalLicoesNivel1}</Badge>
              </div>
              <Progress value={(licoesConcluidas / totalLicoesNivel1) * 100} className="h-2" />
            </div>
            <Link href="/academia/fundamentos">
              <Button data-testid="button-ir-fundamentos">
                <BookOpen className="h-4 w-4 mr-2" />
                Ir para Fundamentos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show approved message if already passed
  if (quizAprovado && !resultado) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl" data-testid="page-academia-quiz">
        <Card className="text-center">
          <CardContent className="pt-8 pb-8">
            <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2" data-testid="text-quiz-aprovado">Quiz Aprovado!</h2>
            <p className="text-muted-foreground mb-6">
              Você já completou o quiz e tem acesso aos módulos de IA.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/academia/roleplay">
                <Button data-testid="button-ir-roleplay">
                  Ir para Roleplay
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/academia/abordagem">
                <Button variant="outline" data-testid="button-ir-abordagem">
                  Gerador de Abordagem
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show result if submitted
  if (resultado) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl" data-testid="page-academia-quiz">
        <Card>
          <CardHeader className="text-center">
            {resultado.aprovado ? (
              <>
                <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-2" />
                <CardTitle className="text-green-600" data-testid="text-resultado-aprovado">Aprovado!</CardTitle>
              </>
            ) : (
              <>
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-2" />
                <CardTitle className="text-red-600" data-testid="text-resultado-reprovado">Não Aprovado</CardTitle>
              </>
            )}
            <CardDescription className="text-lg">
              {resultado.acertos} de {resultado.total} corretas ({resultado.percentual}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center mb-6">{resultado.mensagem}</p>
            
            <div className="space-y-4">
              {perguntas.map((pergunta, index) => {
                const res = resultado.resultados.find((r) => r.perguntaId === pergunta.id);
                return (
                  <div key={pergunta.id} className={`p-4 rounded-lg border ${res?.correto ? "bg-green-50 border-green-200 dark:bg-green-900/20" : "bg-red-50 border-red-200 dark:bg-red-900/20"}`}>
                    <div className="flex items-start gap-2">
                      {res?.correto ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{index + 1}. {pergunta.pergunta}</p>
                        {!res?.correto && res?.respostaCorreta !== undefined && (
                          <p className="text-sm mt-1 text-green-700 dark:text-green-400">
                            Resposta correta: {pergunta.opcoes[res.respostaCorreta]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
            {resultado.aprovado ? (
              <>
                <Link href="/academia/roleplay">
                  <Button data-testid="button-ir-roleplay">
                    Ir para Roleplay
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/academia/abordagem">
                  <Button variant="outline" data-testid="button-ir-abordagem">
                    Gerador de Abordagem
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/academia/fundamentos">
                  <Button variant="outline" data-testid="button-revisar-conteudo">
                    Revisar Conteúdo
                  </Button>
                </Link>
                <Button onClick={handleRetry} data-testid="button-tentar-novamente">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl" data-testid="page-academia-quiz">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-title">Quiz de Fundamentos</h1>
        </div>
        <p className="text-muted-foreground">
          Acerte 70% ou mais para liberar os módulos de IA
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {respondidas} de {perguntas.length} respondidas
            </span>
            <Badge variant="outline">{Math.round(progressoQuiz)}%</Badge>
          </div>
          <Progress value={progressoQuiz} className="h-2" />
        </CardContent>
      </Card>

      <div className="space-y-6">
        {perguntas.map((pergunta, index) => (
          <Card key={pergunta.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {index + 1}. {pergunta.pergunta}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={respostas[pergunta.id]?.toString()}
                onValueChange={(value) => handleSelectOption(pergunta.id, parseInt(value))}
              >
                {pergunta.opcoes.map((opcao, opcaoIndex) => (
                  <div key={opcaoIndex} className="flex items-center space-x-2 p-3 rounded-lg hover-elevate cursor-pointer">
                    <RadioGroupItem
                      value={opcaoIndex.toString()}
                      id={`q${pergunta.id}-o${opcaoIndex}`}
                      data-testid={`radio-q${pergunta.id}-o${opcaoIndex}`}
                    />
                    <Label
                      htmlFor={`q${pergunta.id}-o${opcaoIndex}`}
                      className="flex-1 cursor-pointer"
                    >
                      {opcao}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitMutation.isPending || respondidas < perguntas.length}
          data-testid="button-enviar-quiz"
        >
          {submitMutation.isPending ? "Enviando..." : "Enviar Respostas"}
        </Button>
      </div>
    </div>
  );
}
