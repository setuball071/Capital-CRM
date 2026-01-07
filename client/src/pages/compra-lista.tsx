import { useState, useMemo } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ShoppingCart, Users, Filter, Clock, CheckCircle, XCircle, AlertCircle, Download, Info, Megaphone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";

const TIPOS_CLIENTE = ["todos", "servidor", "pensionista"] as const;
type TipoCliente = typeof TIPOS_CLIENTE[number];

const TIPO_CLIENTE_LABELS: Record<TipoCliente, string> = {
  todos: "Todos",
  servidor: "Servidor",
  pensionista: "Pensionista",
};

interface Filtros {
  convenio?: string;
  orgao?: string;
  uf?: string;
  idade_min?: number;
  idade_max?: number;
  sit_func?: string;
  tipo_cliente?: TipoCliente;
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
  tipo_contrato?: string;
  parcela_min?: number;
  parcela_max?: number;
  // Filtro de quantidade de contratos
  qtd_contratos_min?: number;
  qtd_contratos_max?: number;
}

interface OrgaoComCodigo {
  codigo: string;
  nome: string;
}

interface FiltrosDisponiveis {
  convenios: string[];
  orgaos: string[];
  orgaosComCodigo: OrgaoComCodigo[];
  ufs: string[];
  bancos: string[];
  tiposContrato: string[];
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
    exc_qtd: number | null;
    exc_soma: number | null;
    margem: number | null;
    has_desconto_fora_folha: boolean;
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

interface OrgaoComboboxProps {
  orgaosComCodigo: OrgaoComCodigo[];
  orgaosFallback?: string[];
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  "data-testid"?: string;
}

function OrgaoCombobox({
  orgaosComCodigo,
  orgaosFallback = [],
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum item encontrado.",
  "data-testid": testId,
}: OrgaoComboboxProps) {
  const useCodigo = orgaosComCodigo && orgaosComCodigo.length > 0;

  if (!useCodigo) {
    return (
      <Combobox
        options={orgaosFallback}
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
        data-testid={testId}
      />
    );
  }

  const nomeParaCodigo = orgaosComCodigo.reduce((acc, org) => {
    acc[org.nome] = org.codigo;
    return acc;
  }, {} as Record<string, string>);

  const codigoParaNome = orgaosComCodigo.reduce((acc, org) => {
    acc[org.codigo] = org.nome;
    return acc;
  }, {} as Record<string, string>);

  const nomes = orgaosComCodigo.map(o => o.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const nomeExibicao = value ? (codigoParaNome[value] || value) : undefined;

  return (
    <Combobox
      options={nomes}
      value={nomeExibicao}
      onValueChange={(nome) => {
        if (nome) {
          const codigo = nomeParaCodigo[nome] || nome;
          onValueChange(codigo);
        } else {
          onValueChange(undefined);
        }
      }}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      data-testid={testId}
    />
  );
}

export default function CompraLista() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [filtros, setFiltros] = useState<Filtros>({});
  const [simulacao, setSimulacao] = useState<SimulacaoResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showCampanhaDialog, setShowCampanhaDialog] = useState(false);
  const [campanhaName, setCampanhaName] = useState("");
  const [campanhaDescricao, setCampanhaDescricao] = useState("");
  const [campanhaLimiteLeads, setCampanhaLimiteLeads] = useState<number | undefined>(undefined);
  const [selectedPacote, setSelectedPacote] = useState<PacotePreco | null>(null);

  const { data: filtrosDisponiveis } = useQuery<FiltrosDisponiveis>({
    queryKey: ["/api/clientes/filtros"],
  });

  // Nomenclaturas para filtros dinâmicos
  const { data: nomenclaturas } = useQuery<{ id: number; categoria: string; codigo: string; nome: string; ativo: boolean }[]>({
    queryKey: ["/api/nomenclaturas-cached"],
    staleTime: 1000 * 60 * 5,
  });

  const situacoesFuncionais = useMemo(() => {
    if (!nomenclaturas) return [];
    return nomenclaturas
      .filter(n => n.categoria === "SIT_FUNC" && n.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [nomenclaturas]);

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
      setSelectedPacote(null);
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
    mutationFn: async (data: { filtros: Filtros; pacoteSelecionado?: PacotePreco | null }) => {
      return await apiRequest("POST", "/api/pedidos-lista", { 
        filtros: data.filtros,
        pacoteSelecionado: data.pacoteSelecionado || undefined
      });
    },
    onSuccess: () => {
      toast({
        title: "Pedido criado",
        description: "Seu pedido de lista foi criado com sucesso.",
      });
      setSimulacao(null);
      setFiltros({});
      setSelectedPacote(null);
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

  const criarCampanhaMutation = useMutation({
    mutationFn: async (data: { nome: string; descricao?: string; filtros: Filtros; limiteLeads?: number }) => {
      const response = await apiRequest("POST", "/api/vendas/campanhas/criar-de-filtro", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Campanha criada",
        description: `Campanha "${data.campanha.nome}" criada com ${data.leadsImportados} leads.`,
      });
      setShowCampanhaDialog(false);
      setCampanhaName("");
      setCampanhaDescricao("");
      setCampanhaLimiteLeads(undefined);
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/campanhas"] });
      navigate(`/vendas/campanhas`);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar campanha",
        description: error.message || "Ocorreu um erro ao criar a campanha.",
        variant: "destructive",
      });
    },
  });

  const handleCriarCampanha = () => {
    if (!campanhaName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome da campanha.",
        variant: "destructive",
      });
      return;
    }
    criarCampanhaMutation.mutate({
      nome: campanhaName,
      descricao: campanhaDescricao || undefined,
      filtros,
      limiteLeads: campanhaLimiteLeads,
    });
  };

  const handleSimular = () => {
    setIsSimulating(true);
    simularMutation.mutate(filtros);
  };

  const handleCriarPedido = () => {
    criarPedidoMutation.mutate({ filtros, pacoteSelecionado: selectedPacote });
  };
  
  const getPacoteAtivo = () => {
    if (!simulacao) return null;
    return selectedPacote || {
      nomePacote: simulacao.nomePacote,
      quantidadeMaxima: simulacao.quantidadePacote,
      preco: simulacao.precoTotal
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
      case "processado":
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
      case "processando":
        return (
          <Badge variant="default" className="bg-blue-600">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Gerando...
          </Badge>
        );
      case "cancelado":
      case "erro":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            {status === "erro" ? "Erro" : "Cancelado"}
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
    if (f.tipo_cliente && f.tipo_cliente !== "todos") parts.push(`Tipo: ${TIPO_CLIENTE_LABELS[f.tipo_cliente]}`);
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
    if (f.qtd_contratos_min !== undefined || f.qtd_contratos_max !== undefined) {
      parts.push(`Contratos: ${f.qtd_contratos_min ?? 0} - ${f.qtd_contratos_max ?? "∞"}`);
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
                  <OrgaoCombobox
                    orgaosComCodigo={filtrosDisponiveis?.orgaosComCodigo || []}
                    orgaosFallback={filtrosDisponiveis?.orgaos || []}
                    value={filtros.orgao}
                    onValueChange={(v) => setFiltros({ ...filtros, orgao: v })}
                    placeholder="Todos os órgãos"
                    searchPlaceholder="Buscar órgão..."
                    emptyText="Nenhum órgão encontrado."
                    data-testid="combobox-orgao"
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
                  <Select
                    value={filtros.sit_func || "all"}
                    onValueChange={(v) => setFiltros({ ...filtros, sit_func: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-situacao-funcional">
                      <SelectValue placeholder="Todas as situações" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Situações</SelectItem>
                      {situacoesFuncionais.map((sit) => (
                        <SelectItem key={sit.codigo} value={sit.codigo}>
                          {sit.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo_cliente">Tipo de Cliente</Label>
                  <Select
                    value={filtros.tipo_cliente || "todos"}
                    onValueChange={(v) => setFiltros({ ...filtros, tipo_cliente: v as TipoCliente })}
                  >
                    <SelectTrigger data-testid="select-tipo-cliente">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CLIENTE.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {TIPO_CLIENTE_LABELS[tipo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-4 text-sm text-muted-foreground">Filtros de Contrato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="banco">Banco</Label>
                    <Combobox
                      options={filtrosDisponiveis?.bancos || []}
                      value={filtros.banco}
                      onValueChange={(v) => setFiltros({ ...filtros, banco: v })}
                      placeholder="Todos os bancos"
                      searchPlaceholder="Buscar banco..."
                      emptyText="Nenhum banco encontrado."
                      creatable={true}
                      createOptionLabel={(v) => `Usar "${v}"`}
                      data-testid="combobox-banco"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                    <Select
                      value={filtros.tipo_contrato || "all"}
                      onValueChange={(v) => setFiltros({ ...filtros, tipo_contrato: v === "all" ? undefined : v })}
                    >
                      <SelectTrigger data-testid="select-tipo-contrato">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {filtrosDisponiveis?.tiposContrato?.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Qtd. Contratos</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Mín"
                        value={filtros.qtd_contratos_min ?? ""}
                        onChange={(e) => setFiltros({ ...filtros, qtd_contratos_min: e.target.value ? parseInt(e.target.value) : undefined })}
                        data-testid="input-qtd-contratos-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Máx"
                        value={filtros.qtd_contratos_max ?? ""}
                        onChange={(e) => setFiltros({ ...filtros, qtd_contratos_max: e.target.value ? parseInt(e.target.value) : undefined })}
                        data-testid="input-qtd-contratos-max"
                        className="w-1/2"
                      />
                    </div>
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
                    {/* Pacote selecionado (manual ou automático) */}
                    {(() => {
                      const pacoteAtivo = selectedPacote || {
                        nomePacote: simulacao.nomePacote,
                        quantidadeMaxima: simulacao.quantidadePacote,
                        preco: simulacao.precoTotal
                      };
                      return (
                        <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                          <ShoppingCart className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-green-900 dark:text-green-100 text-lg">
                                  {pacoteAtivo.nomePacote}
                                  {selectedPacote && (
                                    <Badge variant="secondary" className="ml-2 text-xs">Seleção manual</Badge>
                                  )}
                                </p>
                                <p className="text-sm text-green-700 dark:text-green-300">
                                  Atende até {pacoteAtivo.quantidadeMaxima.toLocaleString("pt-BR")} registros
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                  {formatCurrency(pacoteAtivo.preco)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Tabela de pacotes - clicáveis para seleção */}
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-3">Escolha um pacote (clique para selecionar):</p>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        {simulacao.pacotes.map((p) => {
                          const isSelected = selectedPacote?.nomePacote === p.nomePacote;
                          const isAutomatic = !selectedPacote && p.nomePacote === simulacao.nomePacote;
                          const isActive = isSelected || isAutomatic;
                          
                          return (
                            <button
                              type="button"
                              key={p.nomePacote} 
                              onClick={() => {
                                if (p.nomePacote === simulacao.nomePacote) {
                                  setSelectedPacote(null);
                                } else {
                                  setSelectedPacote(p);
                                }
                              }}
                              className={`p-2 rounded text-center cursor-pointer transition-colors hover-elevate ${
                                isActive
                                  ? "bg-green-100 dark:bg-green-900/50 border-2 border-green-500" 
                                  : "bg-background border hover:border-green-300"
                              }`}
                              data-testid={`button-pacote-${p.nomePacote.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <p className="font-medium">{p.nomePacote}</p>
                              <p className="text-muted-foreground">{formatCurrency(p.preco)}</p>
                              {isAutomatic && !isSelected && (
                                <Badge variant="outline" className="mt-1 text-[10px]">Sugerido</Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedPacote && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => setSelectedPacote(null)}
                        >
                          Usar pacote sugerido
                        </Button>
                      )}
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
                          <TableHead>Obs.</TableHead>
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
                            <TableCell>
                              {cliente.has_desconto_fora_folha && (
                                <Badge variant="destructive" className="text-xs" data-testid={`badge-exc-${idx}`}>
                                  Desc. fora folha
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="flex justify-end gap-3 pt-4 border-t flex-wrap">
                      <Button
                        variant="outline"
                        onClick={() => setShowCampanhaDialog(true)}
                        disabled={criarCampanhaMutation.isPending}
                        size="lg"
                        data-testid="button-criar-campanha"
                      >
                        <Megaphone className="w-4 h-4 mr-2" />
                        Criar Campanha CRM
                      </Button>
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
                            Gerar Pedido ({simulacao.total.toLocaleString("pt-BR")} registros – {getPacoteAtivo()?.nomePacote} – {formatCurrency(getPacoteAtivo()?.preco || 0)})
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
                          {(pedido.status === "processado" || pedido.status === "concluido") && pedido.arquivoGeradoEm ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`/api/pedidos-lista/${pedido.id}/download`, "_blank")}
                              data-testid={`button-download-${pedido.id}`}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Baixar
                            </Button>
                          ) : pedido.status === "processando" || pedido.status === "aprovado" ? (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Gerando...
                            </span>
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

      <Dialog open={showCampanhaDialog} onOpenChange={setShowCampanhaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Campanha CRM</DialogTitle>
            <DialogDescription>
              Crie uma nova campanha de vendas com {simulacao?.total.toLocaleString("pt-BR") || 0} leads baseados nos filtros atuais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campanha-nome">Nome da Campanha *</Label>
              <Input
                id="campanha-nome"
                placeholder="Ex: Campanha SIAPE Janeiro 2025"
                value={campanhaName}
                onChange={(e) => setCampanhaName(e.target.value)}
                data-testid="input-campanha-nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campanha-descricao">Descrição (opcional)</Label>
              <Textarea
                id="campanha-descricao"
                placeholder="Descreva o objetivo da campanha..."
                value={campanhaDescricao}
                onChange={(e) => setCampanhaDescricao(e.target.value)}
                data-testid="input-campanha-descricao"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campanha-limite">Limite de Leads (opcional)</Label>
              <Input
                id="campanha-limite"
                type="number"
                min={1}
                max={simulacao?.total || 100000}
                placeholder={`Máximo: ${simulacao?.total?.toLocaleString("pt-BR") || "todos"}`}
                value={campanhaLimiteLeads || ""}
                onChange={(e) => setCampanhaLimiteLeads(e.target.value ? parseInt(e.target.value) : undefined)}
                data-testid="input-campanha-limite"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para importar todos os {simulacao?.total?.toLocaleString("pt-BR") || 0} leads.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCampanhaDialog(false)}
              data-testid="button-cancelar-campanha"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriarCampanha}
              disabled={criarCampanhaMutation.isPending || !campanhaName.trim()}
              data-testid="button-confirmar-campanha"
            >
              {criarCampanhaMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Megaphone className="w-4 h-4 mr-2" />
                  Criar Campanha
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
