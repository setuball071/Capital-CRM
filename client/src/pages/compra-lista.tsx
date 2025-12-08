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
import { Loader2, Search, ShoppingCart, Users, Filter, Clock, CheckCircle, XCircle, AlertCircle, Download, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Filtros {
  convenio?: string;
  orgao?: string;
  uf?: string;
  idade_min?: number;
  idade_max?: number;
  sit_func?: string;
  // Filtros de margem
  margem_30_min?: number;
  margem_30_max?: number;
  margem_35_min?: number;
  margem_35_max?: number;
  margem_70_min?: number;
  margem_70_max?: number;
  margem_cartao_credito_min?: number;
  margem_cartao_credito_max?: number;
  margem_cartao_beneficio_min?: number;
  margem_cartao_beneficio_max?: number;
  // Filtros de contrato
  banco?: string;
  parcela_min?: number;
  parcela_max?: number;
}

interface FiltrosDisponiveis {
  convenios: string[];
  orgaos: string[];
  ufs: string[];
}

interface PacotePreco {
  quantidadeMaxima: number;
  nomePacote: string;
  preco: number;
}

interface SimulacaoResult {
  total: number;
  nomePacote: string;
  quantidadePacote: number;
  precoTotal: number;
  pacotes: PacotePreco[];
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
  nomePacote: string | null;
  custoEstimado: string | null;
  custoFinal: string | null;
  statusFinanceiro: string | null;
  arquivoPath: string | null;
  arquivoGeradoEm: string | null;
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
    if (f.margem_70_min !== undefined || f.margem_70_max !== undefined) {
      parts.push(`Margem 70%: ${f.margem_70_min || 0} - ${f.margem_70_max || "∞"}`);
    }
    if (f.margem_35_min !== undefined || f.margem_35_max !== undefined) {
      parts.push(`Margem 35%: ${f.margem_35_min || 0} - ${f.margem_35_max || "∞"}`);
    }
    if (f.margem_cartao_credito_min !== undefined || f.margem_cartao_credito_max !== undefined) {
      parts.push(`Margem Cart.Créd: ${f.margem_cartao_credito_min || 0} - ${f.margem_cartao_credito_max || "∞"}`);
    }
    if (f.margem_cartao_beneficio_min !== undefined || f.margem_cartao_beneficio_max !== undefined) {
      parts.push(`Margem Cart.Benef: ${f.margem_cartao_beneficio_min || 0} - ${f.margem_cartao_beneficio_max || "∞"}`);
    }
    if (f.banco) parts.push(`Banco: ${f.banco}`);
    if (f.parcela_min !== undefined || f.parcela_max !== undefined) {
      parts.push(`Parcela: ${f.parcela_min || 0} - ${f.parcela_max || "∞"}`);
    }
    return parts.length > 0 ? parts.join(" | ") : "Sem filtros";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
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

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-4 text-sm text-muted-foreground">Filtros de Contrato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="banco">Banco</Label>
                    <Input
                      id="banco"
                      placeholder="Ex: BRADESCO, ITAU"
                      value={filtros.banco || ""}
                      onChange={(e) => setFiltros({ ...filtros, banco: e.target.value || undefined })}
                      data-testid="input-banco"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parcela_min">Parcela Mínima (R$)</Label>
                    <Input
                      id="parcela_min"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Ex: 100.00"
                      value={filtros.parcela_min || ""}
                      onChange={(e) => setFiltros({ ...filtros, parcela_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                      data-testid="input-parcela-min"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parcela_max">Parcela Máxima (R$)</Label>
                    <Input
                      id="parcela_max"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Ex: 500.00"
                      value={filtros.parcela_max || ""}
                      onChange={(e) => setFiltros({ ...filtros, parcela_max: e.target.value ? parseFloat(e.target.value) : undefined })}
                      data-testid="input-parcela-max"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-4 text-sm text-muted-foreground">Filtros de Margem (Saldos)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Margem 70%</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Mín"
                        value={filtros.margem_70_min || ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_70_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-70-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Máx"
                        value={filtros.margem_70_max || ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_70_max: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-70-max"
                        className="w-1/2"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Margem 35%</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Mín"
                        value={filtros.margem_35_min || ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_35_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-35-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Máx"
                        value={filtros.margem_35_max || ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_35_max: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-35-max"
                        className="w-1/2"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Cartão Crédito 5%</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Mín"
                        value={filtros.margem_cartao_credito_min || ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_cartao_credito_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-cartao-credito-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Máx"
                        value={filtros.margem_cartao_credito_max || ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_cartao_credito_max: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-cartao-credito-max"
                        className="w-1/2"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Cartão Benefício 5%</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Mín"
                        value={filtros.margem_cartao_beneficio_min || ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_cartao_beneficio_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-cartao-beneficio-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Máx"
                        value={filtros.margem_cartao_beneficio_max || ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_cartao_beneficio_max: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-cartao-beneficio-max"
                        className="w-1/2"
                      />
                    </div>
                  </div>
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
                    {/* Pacote selecionado */}
                    <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                      <ShoppingCart className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-green-900 dark:text-green-100 text-lg">
                              {simulacao.nomePacote}
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Atende até {simulacao.quantidadePacote.toLocaleString("pt-BR")} registros
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                              {formatCurrency(simulacao.precoTotal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tabela de pacotes disponíveis */}
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-3">Tabela de pacotes:</p>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        {simulacao.pacotes.map((p) => (
                          <div 
                            key={p.nomePacote} 
                            className={`p-2 rounded text-center ${
                              p.nomePacote === simulacao.nomePacote 
                                ? "bg-green-100 dark:bg-green-900/50 border border-green-400" 
                                : "bg-background border"
                            }`}
                          >
                            <p className="font-medium">{p.nomePacote}</p>
                            <p className="text-muted-foreground">{formatCurrency(p.preco)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

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
                        size="lg"
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
                            Gerar Pedido ({simulacao.total.toLocaleString("pt-BR")} registros – {simulacao.nomePacote} – {formatCurrency(simulacao.precoTotal)})
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
                      <TableHead>Valor Estimado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
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
                        <TableCell>
                          {pedido.custoEstimado 
                            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(pedido.custoEstimado))
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                        <TableCell>
                          {format(new Date(pedido.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {pedido.status === "concluido" && pedido.arquivoGeradoEm ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`/api/pedidos-lista/${pedido.id}/download`, "_blank")}
                              data-testid={`button-download-${pedido.id}`}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Baixar
                            </Button>
                          ) : pedido.status === "processando" ? (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Gerando...
                            </span>
                          ) : pedido.status === "aprovado" ? (
                            <span className="text-sm text-muted-foreground">Aguardando...</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
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
