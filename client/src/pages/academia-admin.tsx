import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Users, ClipboardCheck, MessageSquare, Wand2, Award, TrendingUp, Brain, Loader2, Star, Target, Lightbulb, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminStats {
  totalVendedores: number;
  quizAprovados: number;
  totalSimulacoes: number;
  totalAbordagens: number;
  mediaNotas: string;
}

interface Vendedor {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  nivelAtual: number;
  quizAprovado: boolean;
  quizAprovadoEm: string | null;
  totalSimulacoes: number;
  notaMediaGlobal: string | null;
  criadoEm: string;
}

interface QuizTentativa {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  acertos: number;
  total: number;
  aprovado: boolean;
  criadoEm: string;
}

interface FeedbackIA {
  vendedor: {
    nome: string;
    nivelAtual: number;
    quizAprovado: boolean;
    dataAprovacaoQuiz: string | null;
    totalSimulacoes: number;
    notaMediaGlobal: string | null;
    dataInicio: string;
  };
  metricas: {
    quiz: {
      totalTentativas: number;
      aprovacoes: number;
      taxaAprovacao: string;
    };
    roleplay: {
      totalSessoes: number;
      sessoesUltimos30Dias: number;
      totalAvaliacoes: number;
      mediaNotaGlobal: string;
      mediaHumanizacao: string;
      mediaConsultivo: string;
      mediaVenda: string;
      pontosFortesMaisFrequentes: { ponto: string; count: number }[];
      pontosMelhorarMaisFrequentes: { ponto: string; count: number }[];
    };
    abordagens: {
      totalGeradas: number;
      abordagensUltimos30Dias: number;
      canaisUsados: Record<string, number>;
      tiposClienteAbordados: Record<string, number>;
    };
    fundamentos: {
      licoesConcluidas: number;
      totalLicoes: number;
      percentualConclusao: string;
    };
  };
  feedback: {
    resumoGeral: string;
    recorrenciaTreino: string;
    desempenhoQuiz: string;
    evolucaoRoleplay: string;
    usoAbordagens: string;
    pontosFortes: string[];
    areasDesenvolvimento: string[];
    recomendacoes: string[];
    proximosPassos: string;
    notaGeral: number;
  };
}

export default function AcademiaAdmin() {
  const { toast } = useToast();
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackIA | null>(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  const { data: stats, isLoading: loadingStats } = useQuery<AdminStats>({
    queryKey: ["/api/academia/admin/stats"],
  });

  const { data: vendedores, isLoading: loadingVendedores } = useQuery<Vendedor[]>({
    queryKey: ["/api/academia/admin/vendedores"],
  });

  const { data: tentativas, isLoading: loadingTentativas } = useQuery<QuizTentativa[]>({
    queryKey: ["/api/academia/admin/quiz-tentativas"],
  });

  const feedbackMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("POST", `/api/academia/admin/feedback-ia/${userId}`);
      const data = await response.json();
      return data as FeedbackIA;
    },
    onSuccess: (data) => {
      setFeedbackData(data);
      setShowFeedbackDialog(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar feedback",
        description: error.message || "Não foi possível gerar o feedback",
        variant: "destructive",
      });
    },
  });

  const handleFeedbackClick = (vendedor: Vendedor) => {
    setSelectedVendedor(vendedor);
    feedbackMutation.mutate(vendedor.userId);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const getNotaColor = (nota: number) => {
    if (nota >= 8) return "text-green-600";
    if (nota >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  if (loadingStats) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl" data-testid="page-academia-admin">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-title">Admin Academia</h1>
            <p className="text-muted-foreground text-sm">
              Acompanhe o progresso dos vendedores
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendedores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-vendedores">
              {stats?.totalVendedores || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quiz Aprovados</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-quiz-aprovados">
              {stats?.quizAprovados || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalVendedores ? `${Math.round((stats.quizAprovados / stats.totalVendedores) * 100)}%` : "0%"} do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Simulações</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-simulacoes">
              {stats?.totalSimulacoes || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abordagens</CardTitle>
            <Wand2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-abordagens">
              {stats?.totalAbordagens || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Notas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-media-notas">
              {stats?.mediaNotas || "0.00"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <Tabs defaultValue="vendedores" className="w-full">
        <TabsList>
          <TabsTrigger value="vendedores">
            <Users className="h-4 w-4 mr-2" />
            Vendedores
          </TabsTrigger>
          <TabsTrigger value="tentativas">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Tentativas Quiz
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores">
          <Card>
            <CardHeader>
              <CardTitle>Vendedores na Academia</CardTitle>
              <CardDescription>
                Progresso de todos os vendedores cadastrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingVendedores ? (
                <Skeleton className="h-64 w-full" />
              ) : vendedores && vendedores.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead>Quiz</TableHead>
                        <TableHead>Simulações</TableHead>
                        <TableHead>Nota Média</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendedores.map((v) => (
                        <TableRow key={v.id} data-testid={`row-vendedor-${v.id}`}>
                          <TableCell className="font-medium">{v.userName || "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{v.userEmail || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">Nível {v.nivelAtual}</Badge>
                          </TableCell>
                          <TableCell>
                            {v.quizAprovado ? (
                              <Badge className="bg-green-500">Aprovado</Badge>
                            ) : (
                              <Badge variant="secondary">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell>{v.totalSimulacoes}</TableCell>
                          <TableCell>
                            {v.notaMediaGlobal ? (
                              <span className="font-semibold">{parseFloat(v.notaMediaGlobal).toFixed(1)}</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(v.criadoEm)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFeedbackClick(v)}
                              disabled={feedbackMutation.isPending && selectedVendedor?.id === v.id}
                              data-testid={`button-feedback-${v.id}`}
                            >
                              {feedbackMutation.isPending && selectedVendedor?.id === v.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Brain className="h-4 w-4 mr-1" />
                                  Feedback IA
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum vendedor cadastrado na academia
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tentativas">
          <Card>
            <CardHeader>
              <CardTitle>Tentativas de Quiz</CardTitle>
              <CardDescription>
                Histórico de todas as tentativas de quiz
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTentativas ? (
                <Skeleton className="h-64 w-full" />
              ) : tentativas && tentativas.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Acertos</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tentativas.map((t) => (
                        <TableRow key={t.id} data-testid={`row-tentativa-${t.id}`}>
                          <TableCell className="font-medium">{t.userName || "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{t.userEmail || "-"}</TableCell>
                          <TableCell>
                            {t.acertos}/{t.total} ({Math.round((t.acertos / t.total) * 100)}%)
                          </TableCell>
                          <TableCell>
                            {t.aprovado ? (
                              <Badge className="bg-green-500">Aprovado</Badge>
                            ) : (
                              <Badge variant="destructive">Reprovado</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(t.criadoEm)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma tentativa de quiz registrada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feedback IA Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Feedback IA - {feedbackData?.vendedor?.nome || selectedVendedor?.userName}
            </DialogTitle>
            <DialogDescription>
              Análise completa do desempenho no treinamento
            </DialogDescription>
          </DialogHeader>

          {feedbackData && (
            <div className="space-y-6 py-4">
              {/* Nota Geral */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Nota Geral</p>
                  <p className={`text-4xl font-bold ${getNotaColor(feedbackData.feedback.notaGeral)}`}>
                    {feedbackData.feedback.notaGeral?.toFixed(1) || "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Nível Atual</p>
                  <Badge className="text-lg px-3 py-1">Nível {feedbackData.vendedor.nivelAtual}</Badge>
                </div>
              </div>

              {/* Resumo Geral */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Resumo Geral
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feedbackData.feedback.resumoGeral}</p>
                </CardContent>
              </Card>

              {/* Métricas Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Quiz */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Quiz de Fundamentos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tentativas:</span>
                      <span className="font-medium">{feedbackData.metricas.quiz.totalTentativas}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Taxa de Aprovação:</span>
                      <span className="font-medium">{feedbackData.metricas.quiz.taxaAprovacao}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{feedbackData.feedback.desempenhoQuiz}</p>
                  </CardContent>
                </Card>

                {/* Roleplay */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Roleplay</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Sessões (30 dias):</span>
                      <span className="font-medium">{feedbackData.metricas.roleplay.sessoesUltimos30Dias}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Nota Média:</span>
                      <span className="font-medium">{feedbackData.metricas.roleplay.mediaNotaGlobal}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{feedbackData.feedback.evolucaoRoleplay}</p>
                  </CardContent>
                </Card>

                {/* Abordagens */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Abordagens</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Geradas (30 dias):</span>
                      <span className="font-medium">{feedbackData.metricas.abordagens.abordagensUltimos30Dias}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total:</span>
                      <span className="font-medium">{feedbackData.metricas.abordagens.totalGeradas}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{feedbackData.feedback.usoAbordagens}</p>
                  </CardContent>
                </Card>

                {/* Fundamentos */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fundamentos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Lições:</span>
                      <span className="font-medium">
                        {feedbackData.metricas.fundamentos.licoesConcluidas}/{feedbackData.metricas.fundamentos.totalLicoes}
                      </span>
                    </div>
                    <Progress 
                      value={parseFloat(feedbackData.metricas.fundamentos.percentualConclusao)} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {feedbackData.metricas.fundamentos.percentualConclusao}% concluído
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recorrência */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Recorrência de Treino
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feedbackData.feedback.recorrenciaTreino}</p>
                </CardContent>
              </Card>

              {/* Pontos Fortes e Áreas de Desenvolvimento */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Pontos Fortes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {feedbackData.feedback.pontosFortes?.map((ponto, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Star className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{ponto}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-yellow-600">
                      <AlertTriangle className="h-4 w-4" />
                      Áreas de Desenvolvimento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {feedbackData.feedback.areasDesenvolvimento?.map((area, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Target className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Recomendações */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Recomendações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feedbackData.feedback.recomendacoes?.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                          {i + 1}
                        </span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Próximos Passos */}
              <Card className="border-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Próximos Passos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feedbackData.feedback.proximosPassos}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
