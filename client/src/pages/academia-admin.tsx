import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, ClipboardCheck, MessageSquare, Wand2, Award, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function AcademiaAdmin() {
  const { data: stats, isLoading: loadingStats } = useQuery<AdminStats>({
    queryKey: ["/api/academia/admin/stats"],
  });

  const { data: vendedores, isLoading: loadingVendedores } = useQuery<Vendedor[]>({
    queryKey: ["/api/academia/admin/vendedores"],
  });

  const { data: tentativas, isLoading: loadingTentativas } = useQuery<QuizTentativa[]>({
    queryKey: ["/api/academia/admin/quiz-tentativas"],
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
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
    </div>
  );
}
