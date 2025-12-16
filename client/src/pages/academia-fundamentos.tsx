import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, CheckCircle2, ArrowRight, Target, Users, Heart, Brain, Lock, Search, Gift, Shield, Loader2 } from "lucide-react";

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

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Search: Search,
  BookOpen: BookOpen,
  Gift: Gift,
  Shield: Shield,
  CheckCircle: CheckCircle2,
};

const COR_MAP: Record<number, string> = {
  1: "bg-blue-500",
  2: "bg-green-500",
  3: "bg-yellow-500",
  4: "bg-orange-500",
  5: "bg-purple-500",
};

export default function AcademiaFundamentos() {
  const { toast } = useToast();
  const [selectedLicao, setSelectedLicao] = useState<{ nivel: Nivel; licao: Licao } | null>(null);
  const [resposta, setResposta] = useState("");

  const { data: niveisData, isLoading: loadingNiveis } = useQuery<{ niveis: Nivel[] }>({
    queryKey: ["/api/academia/niveis"],
  });

  const { data: progressoData } = useQuery<{ 
    progresso: ProgressoLicao[]; 
    quizAprovado: boolean;
    nivelAtual: number;
  }>({
    queryKey: ["/api/academia/progresso"],
  });

  const concluirMutation = useMutation({
    mutationFn: async (data: { licaoId: string; nivelId: number; respostasAtividade: string }) => {
      const res = await apiRequest("POST", "/api/academia/licoes/concluir", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/academia/progresso"] });
      toast({
        title: "Lição concluída!",
        description: data.nivelCompleto 
          ? `Parabéns! Você completou todas as lições do nível ${data.licoesConcluidas}/${data.totalLicoes}`
          : `Progresso: ${data.licoesConcluidas}/${data.totalLicoes} lições`,
      });
      setSelectedLicao(null);
      setResposta("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o progresso",
        variant: "destructive",
      });
    },
  });

  const isLicaoConcluida = (licaoId: string) => {
    return progressoData?.progresso?.some(p => p.licaoId === licaoId && p.concluida) || false;
  };

  const countLicoesConcluidas = (nivelId: number) => {
    const nivel = niveisData?.niveis?.find(n => n.id === nivelId);
    if (!nivel) return 0;
    return nivel.licoes.filter(l => isLicaoConcluida(l.id)).length;
  };

  const handleConcluirLicao = () => {
    if (!selectedLicao) return;
    concluirMutation.mutate({
      licaoId: selectedLicao.licao.id,
      nivelId: selectedLicao.nivel.id,
      respostasAtividade: resposta,
    });
  };

  if (loadingNiveis) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const niveis = niveisData?.niveis || [];
  const quizAprovado = progressoData?.quizAprovado || false;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl" data-testid="page-academia-fundamentos">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-title">Treinamento</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Fundamentos do atendimento consultivo em crédito consignado
        </p>
      </div>

      {/* Princípios */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Princípios do Atendimento Consultivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <Target className="h-6 w-6 mb-2 text-blue-500" />
              <h3 className="font-semibold mb-1">Consultivo</h3>
              <p className="text-sm text-muted-foreground">
                Entender o cenário antes de empurrar produto. O foco é resolver o problema do cliente.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <Users className="h-6 w-6 mb-2 text-green-500" />
              <h3 className="font-semibold mb-1">Humanizado</h3>
              <p className="text-sm text-muted-foreground">
                Tratamento respeitoso, linguagem simples, sem pressão. Construir relacionamento de longo prazo.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <Brain className="h-6 w-6 mb-2 text-purple-500" />
              <h3 className="font-semibold mb-1">Estratégico</h3>
              <p className="text-sm text-muted-foreground">
                Analisar cenário completo, comparar bancos, encontrar a melhor solução estruturada.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jornada de Treinamento */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Jornada de Treinamento</CardTitle>
          <CardDescription>
            Complete as lições de cada nível para liberar o Quiz
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {niveis.map((nivel) => {
              const licoesConcluidas = countLicoesConcluidas(nivel.id);
              const totalLicoes = nivel.licoes.length;
              const progressoPercent = totalLicoes > 0 ? (licoesConcluidas / totalLicoes) * 100 : 0;
              const IconComponent = ICON_MAP[nivel.icone] || BookOpen;
              const corNivel = COR_MAP[nivel.id] || "bg-gray-500";

              return (
                <Accordion key={nivel.id} type="single" collapsible>
                  <AccordionItem value={`nivel-${nivel.id}`} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline" data-testid={`accordion-nivel-${nivel.id}`}>
                      <div className="flex items-center gap-4 flex-1">
                        <Badge className={`${corNivel} text-white`}>
                          Nível {nivel.id}
                        </Badge>
                        <div className="text-left flex-1">
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            <p className="font-semibold">{nivel.nome}</p>
                          </div>
                          <p className="text-sm text-muted-foreground font-normal">
                            {nivel.descricao}
                          </p>
                        </div>
                        <div className="hidden md:flex items-center gap-2 mr-4">
                          <Progress value={progressoPercent} className="w-24 h-2" />
                          <span className="text-sm text-muted-foreground">
                            {licoesConcluidas}/{totalLicoes}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {nivel.licoes.map((licao) => {
                          const concluida = isLicaoConcluida(licao.id);
                          return (
                            <div
                              key={licao.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                concluida 
                                  ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" 
                                  : "hover:bg-muted"
                              }`}
                              onClick={() => setSelectedLicao({ nivel, licao })}
                              data-testid={`licao-${licao.id}`}
                            >
                              {concluida ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                              )}
                              <div className="flex-1">
                                <p className={`font-medium ${concluida ? "text-green-700 dark:text-green-400" : ""}`}>
                                  {licao.id}. {licao.titulo}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {licao.resumo}
                                </p>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className={`border-primary/20 ${quizAprovado ? "bg-green-50 dark:bg-green-950/20" : "bg-primary/5"}`}>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              {quizAprovado ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <h3 className="font-semibold text-lg text-green-700 dark:text-green-400">Quiz Aprovado!</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Acesse os módulos de IA para praticar
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-lg">Pronto para o Quiz?</h3>
                  <p className="text-muted-foreground">
                    Complete o quiz para liberar os módulos de IA (Roleplay e Abordagem)
                  </p>
                </>
              )}
            </div>
            {quizAprovado ? (
              <div className="flex gap-2">
                <Link href="/academia/roleplay">
                  <Button variant="outline" data-testid="button-ir-roleplay">
                    Roleplay IA
                  </Button>
                </Link>
                <Link href="/academia/abordagem">
                  <Button data-testid="button-ir-abordagem">
                    Abordagem IA
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            ) : (
              <Link href="/academia/quiz">
                <Button data-testid="button-ir-quiz">
                  Fazer Quiz
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal da Lição */}
      <Dialog open={!!selectedLicao} onOpenChange={() => { setSelectedLicao(null); setResposta(""); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedLicao && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge className={COR_MAP[selectedLicao.nivel.id]}>
                    Nível {selectedLicao.nivel.id}
                  </Badge>
                  <Badge variant="outline">{selectedLicao.nivel.nome}</Badge>
                </div>
                <DialogTitle className="text-xl mt-2">
                  {selectedLicao.licao.id}. {selectedLicao.licao.titulo}
                </DialogTitle>
                <DialogDescription>
                  {selectedLicao.licao.resumo}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Conteúdo da lição em markdown */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {selectedLicao.licao.conteudo.split("\n").map((line, i) => {
                    if (line.startsWith("## ")) {
                      return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace("## ", "")}</h2>;
                    }
                    if (line.startsWith("### ")) {
                      return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.replace("### ", "")}</h3>;
                    }
                    if (line.startsWith("- ")) {
                      return <li key={i} className="ml-4">{line.replace("- ", "")}</li>;
                    }
                    if (line.startsWith("> ")) {
                      return <blockquote key={i} className="border-l-4 border-primary pl-4 italic my-2 text-muted-foreground">{line.replace("> ", "")}</blockquote>;
                    }
                    if (line.trim() === "") {
                      return <br key={i} />;
                    }
                    return <p key={i} className="my-1">{line}</p>;
                  })}
                </div>

                {/* Atividade prática */}
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Atividade Prática
                  </h4>
                  <p className="text-sm mb-3">{selectedLicao.licao.atividadePratica}</p>
                  <Textarea
                    placeholder="Escreva sua resposta aqui..."
                    value={resposta}
                    onChange={(e) => setResposta(e.target.value)}
                    rows={4}
                    data-testid="textarea-resposta"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setSelectedLicao(null); setResposta(""); }}>
                    Fechar
                  </Button>
                  <Button 
                    onClick={handleConcluirLicao}
                    disabled={concluirMutation.isPending}
                    data-testid="button-concluir-licao"
                  >
                    {concluirMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isLicaoConcluida(selectedLicao.licao.id) ? "Atualizar Resposta" : "Marcar como Concluída"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
