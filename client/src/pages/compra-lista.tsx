import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ShoppingCart, Users, Filter, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Filtros {
  convenio?: string;
  orgao?: string;
  uf?: string;
  idade_min?: number;
  idade_max?: number;
  sit_func?: string;
}

interface FiltrosDisponiveis {
  convenios: string[];
  orgaos: string[];
  ufs: string[];
}

interface SimulacaoResult {
  total: number;
  preview: Array<{
    matricula: string;
    nome: string;
    cpf: string | null;
    convenio: string;
    orgao: string;
    uf: string;
    sit_func: string;
  }>;
}

interface PedidoLista {
  id: number;
  coordenadorId: number;
  filtrosUsados: Filtros;
  quantidadeRegistros: number;
  tipo: string;
  status: string;
  custoEstimado: string | null;
  custoFinal: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

const UF_LIST = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

export default function CompraLista() {
  const { toast } = useToast();
  const [filtros, setFiltros] = useState<Filtros>({});
  const [simulacao, setSimulacao] = useState<SimulacaoResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const { data: filtrosDisponiveis } = useQuery<FiltrosDisponiveis>({
    queryKey: ["/api/clientes/filtros"],
  });

  const { data: pedidos = [], isLoading: isLoadingPedidos } = useQuery<PedidoLista[]>({
    queryKey: ["/api/pedidos-lista"],
  });

  const simularMutation = useMutation({
    mutationFn: async (f: Filtros) => {
      const response = await apiRequest("POST", "/api/pedidos-lista/simular", { filtros: f });
      return response.json() as Promise<SimulacaoResult>;
    },
    onSuccess: (data) => {
      setSimulacao(data);
      setIsSimulating(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro na simulação",
        description: error.message || "Ocorreu um erro ao simular o pedido.",
        variant: "destructive",
      });
      setIsSimulating(false);
    },
  });

  const criarPedidoMutation = useMutation({
    mutationFn: async (f: Filtros) => {
      return await apiRequest("POST", "/api/pedidos-lista", { filtros: f });
    },
    onSuccess: () => {
      toast({
        title: "Pedido criado",
        description: "Seu pedido de lista foi criado com sucesso.",
      });
      setSimulacao(null);
      setFiltros({});
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos-lista"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar pedido",
        description: error.message || "Ocorreu um erro ao criar o pedido.",
        variant: "destructive",
      });
    },
  });

  const handleSimular = () => {
    setIsSimulating(true);
    simularMutation.mutate(filtros);
  };

  const handleCriarPedido = () => {
    criarPedidoMutation.mutate(filtros);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Concluído
          </Badge>
        );
      case "pendente":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case "aprovado":
        return (
          <Badge variant="default" className="bg-blue-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprovado
          </Badge>
        );
      case "processando":
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case "cancelado":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatFiltros = (f: Filtros) => {
    const parts: string[] = [];
    if (f.convenio) parts.push(`Convênio: ${f.convenio}`);
    if (f.orgao) parts.push(`Órgão: ${f.orgao}`);
    if (f.uf) parts.push(`UF: ${f.uf}`);
    if (f.idade_min || f.idade_max) {
      parts.push(`Idade: ${f.idade_min || 0} - ${f.idade_max || 99}`);
    }
    if (f.sit_func) parts.push(`Situação: ${f.sit_func}`);
    return parts.length > 0 ? parts.join(" | ") : "Sem filtros";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Compra de Lista</h1>
        <p className="text-muted-foreground">
          Filtre clientes e gere pedidos de exportação de listas
        </p>
      </div>

      <Tabs defaultValue="nova" className="space-y-6">
        <TabsList>
          <TabsTrigger value="nova" data-testid="tab-nova">
            <Filter className="w-4 h-4 mr-2" />
            Nova Lista
          </TabsTrigger>
          <TabsTrigger value="pedidos" data-testid="tab-pedidos">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Meus Pedidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nova" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
              <CardDescription>
                Selecione os filtros para encontrar os clientes desejados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="convenio">Convênio</Label>
                  <Select
                    value={filtros.convenio || "all"}
                    onValueChange={(v) => setFiltros({ ...filtros, convenio: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-convenio">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filtrosDisponiveis?.convenios?.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgao">Órgão</Label>
                  <Input
                    id="orgao"
                    placeholder="Digite para filtrar..."
                    value={filtros.orgao || ""}
                    onChange={(e) => setFiltros({ ...filtros, orgao: e.target.value || undefined })}
                    data-testid="input-orgao"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uf">UF</Label>
                  <Select
                    value={filtros.uf || "all"}
                    onValueChange={(v) => setFiltros({ ...filtros, uf: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-uf">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {UF_LIST.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idade_min">Idade Mínima</Label>
                  <Input
                    id="idade_min"
                    type="number"
                    min={0}
                    max={120}
                    placeholder="Ex: 30"
                    value={filtros.idade_min || ""}
                    onChange={(e) => setFiltros({ ...filtros, idade_min: e.target.value ? parseInt(e.target.value) : undefined })}
                    data-testid="input-idade-min"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idade_max">Idade Máxima</Label>
                  <Input
                    id="idade_max"
                    type="number"
                    min={0}
                    max={120}
                    placeholder="Ex: 75"
                    value={filtros.idade_max || ""}
                    onChange={(e) => setFiltros({ ...filtros, idade_max: e.target.value ? parseInt(e.target.value) : undefined })}
                    data-testid="input-idade-max"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sit_func">Situação Funcional</Label>
                  <Input
                    id="sit_func"
                    placeholder="Ex: ATIVO, APOSENTADO"
                    value={filtros.sit_func || ""}
                    onChange={(e) => setFiltros({ ...filtros, sit_func: e.target.value || undefined })}
                    data-testid="input-sit-func"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <Button
                  onClick={handleSimular}
                  disabled={isSimulating}
                  data-testid="button-simular"
                >
                  {isSimulating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Simulando...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Simular
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFiltros({});
                    setSimulacao(null);
                  }}
                  data-testid="button-limpar"
                >
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {simulacao && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Resultado da Simulação
                </CardTitle>
                <CardDescription>
                  Encontrados <strong>{simulacao.total.toLocaleString("pt-BR")}</strong> registros com os filtros selecionados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {simulacao.total === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum cliente encontrado com os filtros selecionados.</p>
                    <p className="text-sm">Tente ajustar os filtros.</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground mb-4">
                      Mostrando prévia dos primeiros {Math.min(10, simulacao.preview.length)} registros:
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Convênio</TableHead>
                          <TableHead>Órgão</TableHead>
                          <TableHead>UF</TableHead>
                          <TableHead>Situação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {simulacao.preview.map((cliente, idx) => (
                          <TableRow key={idx} data-testid={`row-preview-${idx}`}>
                            <TableCell className="font-mono">{cliente.matricula}</TableCell>
                            <TableCell>{cliente.nome}</TableCell>
                            <TableCell className="font-mono">{cliente.cpf || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{cliente.convenio}</Badge>
                            </TableCell>
                            <TableCell className="truncate max-w-[200px]">{cliente.orgao}</TableCell>
                            <TableCell>{cliente.uf}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{cliente.sit_func}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="flex justify-end pt-4 border-t">
                      <Button
                        onClick={handleCriarPedido}
                        disabled={criarPedidoMutation.isPending}
                        data-testid="button-criar-pedido"
                      >
                        {criarPedidoMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Gerar Pedido de Lista ({simulacao.total.toLocaleString("pt-BR")} registros)
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pedidos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Meus Pedidos
              </CardTitle>
              <CardDescription>
                Histórico de pedidos de exportação de listas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPedidos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : pedidos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum pedido realizado ainda.</p>
                  <p className="text-sm">Use os filtros na aba "Nova Lista" para criar seu primeiro pedido.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Filtros</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidos.map((pedido) => (
                      <TableRow key={pedido.id} data-testid={`row-pedido-${pedido.id}`}>
                        <TableCell className="font-mono">#{pedido.id}</TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {formatFiltros(pedido.filtrosUsados)}
                        </TableCell>
                        <TableCell>{pedido.quantidadeRegistros?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                        <TableCell>
                          {format(new Date(pedido.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
