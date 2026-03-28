import { useState, useEffect } from "react";
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
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ShoppingCart, Users, Filter, Clock, CheckCircle, XCircle, AlertCircle, Download, Info, Megaphone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";

interface BaseRef {
  ref: string;
  label: string;
  folha: boolean;
  d8: boolean;
  contatos: boolean;
}

interface Filtros {
  base_tag?: string;
  base_ref?: string;
  convenio?: string;
  orgao?: string;
  uf?: string;
  idade_min?: number;
  idade_max?: number;
  sit_func?: string[];
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
  bancos?: string[];
  bancos_excluir?: string[];
  tipos_contrato?: string[];
  parcela_min?: number;
  parcela_max?: number;
  // Filtro de parcelas restantes
  parcelas_restantes_min?: number;
  parcelas_restantes_max?: number;
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
  const [tiposContratoFiltrados, setTiposContratoFiltrados] = useState<string[]>([]);
  const [isLoadingTipos, setIsLoadingTipos] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoLista | null>(null);

  const { data: filtrosDisponiveis } = useQuery<FiltrosDisponiveis>({
    queryKey: ["/api/clientes/filtros"],
  });

  const { data: basesDisponiveis } = useQuery<BaseRef[]>({
    queryKey: ["/api/clientes/filtros/bases"],
  });

  const { data: sitFuncOpcoes = [] } = useQuery<string[]>({
    queryKey: ["/api/clientes/filtros/sit-func"],
  });

  // Buscar tipos de contrato dinamicamente quando os bancos mudarem
  useEffect(() => {
    const fetchTiposContrato = async () => {
      setIsLoadingTipos(true);
      try {
        // Se apenas um banco selecionado, filtrar por ele; senão, buscar todos
        const url = filtros.bancos && filtros.bancos.length === 1
          ? `/api/clientes/filtros/tipos-contrato?banco=${encodeURIComponent(filtros.bancos[0])}`
          : `/api/clientes/filtros/tipos-contrato`;
        const response = await fetch(url, { credentials: "include" });
        if (response.ok) {
          const tipos = await response.json();
          setTiposContratoFiltrados(tipos);
        }
      } catch (error) {
        console.error("Erro ao buscar tipos de contrato:", error);
      } finally {
        setIsLoadingTipos(false);
      }
    };
    fetchTiposContrato();
  }, [filtros.bancos]);

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
      const response = await apiRequest("POST", "/api/pedidos-lista", { 
        filtros: data.filtros,
        pacoteSelecionado: data.pacoteSelecionado || undefined
      });
      return response.json();
    },
    onSuccess: (data: { message: string; pedido: { quantidade: number; quantidadeOriginal?: number; corteFoiAplicado?: boolean } }) => {
      // Se houve corte automático, mostrar mensagem informativa
      if (data.pedido?.corteFoiAplicado && data.pedido?.quantidadeOriginal) {
        toast({
          title: "Pedido criado com corte automático",
          description: `Serão exportados ${data.pedido.quantidade.toLocaleString('pt-BR')} de ${data.pedido.quantidadeOriginal.toLocaleString('pt-BR')} registros disponíveis.`,
        });
      } else {
        toast({
          title: "Pedido criado",
          description: data.message || "Seu pedido de lista foi criado com sucesso.",
        });
      }
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

  const cancelarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      const response = await apiRequest("POST", `/api/pedidos-lista/${pedidoId}/cancelar`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pedido cancelado",
        description: data.message || "O pedido foi cancelado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos-lista"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Ocorreu um erro ao cancelar o pedido.",
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
    if (f.sit_func && f.sit_func.length > 0) {
      const arr = Array.isArray(f.sit_func) ? f.sit_func : [f.sit_func];
      const labels = arr.map((v: string) => v === "__VAZIO__" ? "Sem situação" : v);
      parts.push(`Situação: ${labels.join(", ")}`);
    }
    if (f.margem_70_min !== undefined || f.margem_70_max !== undefined) {
      parts.push(`Margem 70%: ${f.margem_70_min ?? 0} - ${f.margem_70_max ?? "∞"}`);
    }
    if (f.margem_35_min !== undefined || f.margem_35_max !== undefined) {
      parts.push(`Margem 35%: ${f.margem_35_min ?? 0} - ${f.margem_35_max ?? "∞"}`);
    }
    if (f.margem_cartao_credito_min !== undefined || f.margem_cartao_credito_max !== undefined) {
      parts.push(`Margem Cart.Créd: ${f.margem_cartao_credito_min ?? 0} - ${f.margem_cartao_credito_max ?? "∞"}`);
    }
    if (f.margem_cartao_beneficio_min !== undefined || f.margem_cartao_beneficio_max !== undefined) {
      parts.push(`Margem Cart.Benef: ${f.margem_cartao_beneficio_min ?? 0} - ${f.margem_cartao_beneficio_max ?? "∞"}`);
    }
    if (f.bancos && f.bancos.length > 0) parts.push(`Bancos: ${f.bancos.join(", ")}`);
    if (f.bancos_excluir && f.bancos_excluir.length > 0) parts.push(`Bancos excluídos: ${f.bancos_excluir.join(", ")}`);
    if (f.parcela_min !== undefined || f.parcela_max !== undefined) {
      parts.push(`Parcela: ${f.parcela_min ?? 0} - ${f.parcela_max ?? "∞"}`);
    }
    if (f.qtd_contratos_min !== undefined || f.qtd_contratos_max !== undefined) {
      if (f.qtd_contratos_min === 0 && f.qtd_contratos_max === 0) {
        parts.push("SEM CONTRATOS (0)");
      } else {
        parts.push(`Contratos: ${f.qtd_contratos_min ?? 0} - ${f.qtd_contratos_max ?? "∞"}`);
      }
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
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Filtros de Base</h1>
        <p className="text-muted-foreground">
          Filtre a base de clientes e gere exportações de dados
        </p>
      </div>

      <Tabs defaultValue="nova" className="space-y-6">
        <TabsList>
          <TabsTrigger value="nova" data-testid="tab-nova">
            <Filter className="w-4 h-4 mr-2" />
            Novo Filtro
          </TabsTrigger>
          <TabsTrigger value="pedidos" data-testid="tab-pedidos">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Meus Filtros
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
              <div className="mb-4 p-3 rounded-md bg-muted/50 border">
                <div className="space-y-2">
                  <Label htmlFor="base_ref" className="font-semibold">Base de Referência</Label>
                  <Select
                    value={filtros.base_ref || "latest"}
                    onValueChange={(v) => setFiltros({ ...filtros, base_ref: v === "latest" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-base-ref">
                      <SelectValue placeholder="Mais Recente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Mais Recente</SelectItem>
                      {basesDisponiveis?.map((b) => (
                        <SelectItem key={b.ref} value={b.ref}>
                          {b.label}
                          {b.folha && b.d8 ? " (Folha + D8)" : b.folha ? " (Folha)" : b.d8 ? " (D8)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define qual competência será usada para filtrar folha e contratos
                  </p>
                </div>
              </div>
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
                    value={filtros.idade_min ?? ""}
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
                    value={filtros.idade_max ?? ""}
                    onChange={(e) => setFiltros({ ...filtros, idade_max: e.target.value ? parseInt(e.target.value) : undefined })}
                    data-testid="input-idade-max"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sit_func">Situação Funcional</Label>
                  <MultiSelectCombobox
                    options={["Sem situação funcional", ...sitFuncOpcoes]}
                    value={(Array.isArray(filtros.sit_func) ? filtros.sit_func : filtros.sit_func ? [filtros.sit_func] : []).map(v => v === "__VAZIO__" ? "Sem situação funcional" : v)}
                    onValueChange={(v) => {
                      const mapped = v.map(val => val === "Sem situação funcional" ? "__VAZIO__" : val);
                      setFiltros({ ...filtros, sit_func: mapped.length > 0 ? mapped : undefined });
                    }}
                    placeholder="Todas as situações"
                    searchPlaceholder="Buscar situação..."
                    emptyText="Nenhuma situação encontrada."
                    data-testid="multiselect-sit-func"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-4 text-sm text-muted-foreground">Filtros de Contrato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="bancos">Bancos</Label>
                      <Button
                        type="button"
                        variant={filtros.bancos_excluir !== undefined ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => {
                          const currentValues = filtros.bancos || filtros.bancos_excluir || [];
                          const isExcluding = filtros.bancos_excluir !== undefined;
                          if (isExcluding) {
                            setFiltros({ ...filtros, bancos: currentValues.length > 0 ? currentValues : undefined, bancos_excluir: undefined });
                          } else {
                            setFiltros({ ...filtros, bancos: undefined, bancos_excluir: currentValues.length > 0 ? currentValues : [] });
                          }
                        }}
                        data-testid="toggle-bancos-excluir"
                      >
                        {filtros.bancos_excluir !== undefined ? "Sem estes bancos" : "Com estes bancos"}
                      </Button>
                    </div>
                    <MultiSelectCombobox
                      options={filtrosDisponiveis?.bancos || []}
                      value={(filtros.bancos_excluir !== undefined ? filtros.bancos_excluir : filtros.bancos) || []}
                      onValueChange={(v) => {
                        if (filtros.bancos_excluir !== undefined) {
                          setFiltros({ ...filtros, bancos_excluir: v.length > 0 ? v : [], bancos: undefined, tipos_contrato: [] });
                        } else {
                          setFiltros({ ...filtros, bancos: v.length > 0 ? v : undefined, bancos_excluir: undefined, tipos_contrato: [] });
                        }
                      }}
                      placeholder={filtros.bancos_excluir !== undefined ? "Selecione bancos a excluir..." : "Todos os bancos"}
                      searchPlaceholder="Buscar banco..."
                      emptyText="Nenhum banco encontrado."
                      data-testid="multiselect-bancos"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                    <MultiSelectCombobox
                      options={tiposContratoFiltrados}
                      value={filtros.tipos_contrato || []}
                      onValueChange={(v) => setFiltros({ ...filtros, tipos_contrato: v.length > 0 ? v : undefined })}
                      placeholder={isLoadingTipos ? "Carregando..." : "Todos"}
                      searchPlaceholder="Buscar tipo..."
                      emptyText="Nenhum tipo encontrado."
                      disabled={isLoadingTipos}
                      data-testid="multiselect-tipo-contrato"
                    />
                    {filtros.bancos && filtros.bancos.length === 1 && tiposContratoFiltrados.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {tiposContratoFiltrados.length} tipo(s) disponível(is) para {filtros.bancos[0]}
                        {filtros.tipos_contrato && filtros.tipos_contrato.length > 0 && (
                          <> • {filtros.tipos_contrato.length} selecionado(s)</>
                        )}
                      </p>
                    )}
                    {filtros.bancos && filtros.bancos.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {filtros.bancos.length} banco(s) selecionado(s)
                        {filtros.tipos_contrato && filtros.tipos_contrato.length > 0 && (
                          <> • {filtros.tipos_contrato.length} tipo(s) selecionado(s)</>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Qtd. Contratos</Label>
                      <Button
                        type="button"
                        variant={filtros.qtd_contratos_min === 0 && filtros.qtd_contratos_max === 0 ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          if (filtros.qtd_contratos_min === 0 && filtros.qtd_contratos_max === 0) {
                            setFiltros({ ...filtros, qtd_contratos_min: undefined, qtd_contratos_max: undefined });
                          } else {
                            setFiltros({ ...filtros, qtd_contratos_min: 0, qtd_contratos_max: 0 });
                          }
                        }}
                        data-testid="button-zero-contratos"
                      >
                        {filtros.qtd_contratos_min === 0 && filtros.qtd_contratos_max === 0 ? "0 Contratos" : "Sem Contratos"}
                      </Button>
                    </div>
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
                    {filtros.qtd_contratos_min === 0 && filtros.qtd_contratos_max === 0 && (
                      <Badge variant="secondary" className="mt-1" data-testid="badge-zero-contratos">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Filtrando apenas clientes SEM contratos registrados
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parcela_min">Parcela Mínima (R$)</Label>
                    <Input
                      id="parcela_min"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Ex: 100.00"
                      value={filtros.parcela_min ?? ""}
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
                      value={filtros.parcela_max ?? ""}
                      onChange={(e) => setFiltros({ ...filtros, parcela_max: e.target.value ? parseFloat(e.target.value) : undefined })}
                      data-testid="input-parcela-max"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Parcelas Restantes</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Mín"
                        value={filtros.parcelas_restantes_min ?? ""}
                        onChange={(e) => setFiltros({ ...filtros, parcelas_restantes_min: e.target.value ? parseInt(e.target.value) : undefined })}
                        data-testid="input-parcelas-restantes-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Máx"
                        value={filtros.parcelas_restantes_max ?? ""}
                        onChange={(e) => setFiltros({ ...filtros, parcelas_restantes_max: e.target.value ? parseInt(e.target.value) : undefined })}
                        data-testid="input-parcelas-restantes-max"
                        className="w-1/2"
                      />
                    </div>
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
                        value={filtros.margem_70_min ?? ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_70_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-70-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Máx"
                        value={filtros.margem_70_max ?? ""}
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
                        value={filtros.margem_35_min ?? ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_35_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-35-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Máx"
                        value={filtros.margem_35_max ?? ""}
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
                        value={filtros.margem_cartao_credito_min ?? ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_cartao_credito_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-cartao-credito-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Máx"
                        value={filtros.margem_cartao_credito_max ?? ""}
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
                        value={filtros.margem_cartao_beneficio_min ?? ""}
                        onChange={(e) => setFiltros({ ...filtros, margem_cartao_beneficio_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                        data-testid="input-margem-cartao-beneficio-min"
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Máx"
                        value={filtros.margem_cartao_beneficio_max ?? ""}
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
                Meus Filtros
              </CardTitle>
              <CardDescription>
                Histórico de filtros aplicados e exportações geradas
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
                  <p>Nenhum filtro realizado ainda.</p>
                  <p className="text-sm">Use os filtros na aba "Novo Filtro" para criar seu primeiro filtro.</p>
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
                      <TableRow
                        key={pedido.id}
                        data-testid={`row-pedido-${pedido.id}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedPedido(pedido)}
                      >
                        <TableCell className="font-mono">#{pedido.id}</TableCell>
                        <TableCell className="max-w-[300px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{formatFiltros(pedido.filtrosUsados)}</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[400px] whitespace-normal break-words">
                              {formatFiltros(pedido.filtrosUsados)}
                            </TooltipContent>
                          </Tooltip>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
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
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Gerando...
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => cancelarPedidoMutation.mutate(pedido.id)}
                                disabled={cancelarPedidoMutation.isPending}
                                data-testid={`button-cancel-${pedido.id}`}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
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

      {/* Details modal */}
      <Dialog open={!!selectedPedido} onOpenChange={(open) => { if (!open) setSelectedPedido(null); }}>
        {selectedPedido && (
          <DialogContent className="max-w-lg" data-testid="dialog-filtro-detalhes">
            <DialogHeader>
              <DialogTitle>Detalhes do Filtro #{selectedPedido.id}</DialogTitle>
              <DialogDescription>
                Criado em {format(new Date(selectedPedido.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros Aplicados</p>
                <p className="text-sm leading-relaxed break-words" data-testid="text-filtros-completos">
                  {formatFiltros(selectedPedido.filtrosUsados)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Registros</p>
                  <p className="text-sm font-medium">
                    {selectedPedido.quantidadeRegistros?.toLocaleString("pt-BR") || 0}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Estimado</p>
                  <p className="text-sm font-medium">
                    {selectedPedido.custoEstimado
                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(selectedPedido.custoEstimado))
                      : "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
                  <div>{getStatusBadge(selectedPedido.status)}</div>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-wrap gap-2">
              {(selectedPedido.status === "processado" || selectedPedido.status === "concluido") && selectedPedido.arquivoGeradoEm && (
                <Button
                  variant="outline"
                  onClick={() => window.open(`/api/pedidos-lista/${selectedPedido.id}/download`, "_blank")}
                  data-testid={`button-modal-download-${selectedPedido.id}`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar
                </Button>
              )}
              <Button variant="secondary" onClick={() => setSelectedPedido(null)} data-testid="button-modal-fechar">
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
