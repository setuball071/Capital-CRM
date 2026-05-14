import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SimulacaoRapida } from "@/components/SimulacaoRapida";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Search, 
  User, 
  Phone, 
  MapPin, 
  Building2, 
  FileText, 
  CreditCard, 
  ChevronLeft, 
  AlertCircle,
  AlertTriangle,
  Wallet,
  Calendar,
  Lock,
  Landmark,
  Copy,
  Check,
  Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConsultaResultado {
  pessoa_id: number;
  cpf: string | null;
  matricula: string;
  nome: string | null;
  convenio: string | null;
  orgao: string | null;
  uf: string | null;
  municipio: string | null;
  sit_func: string | null;
}

interface ConsultaResponse {
  tipo_busca: "cpf" | "matricula" | "telefone";
  termo: string;
  convenio_filtro: string | null;
  resultados: ConsultaResultado[];
}

interface ClienteDetalhadoPessoa {
  id: number;
  cpf: string | null;
  matricula: string;
  nome: string | null;
  convenio: string | null;
  orgao: string | null;
  orgaocod: string | null;
  undpagadoradesc: string | null;
  undpagadoracod: string | null;
  upag: string | null;
  rjur: string | null;
  natureza: string | null;
  sit_func: string | null;
  uf: string | null;
  municipio: string | null;
  data_nascimento: string | null;
  telefones_base: string[] | null;
  // Dados bancários do cliente (onde recebe salário)
  banco_codigo: string | null;
  banco_nome: string | null;
  agencia: string | null;
  conta: string | null;
  base_tag_ultima: string | null;
  extras_pessoa: any;
}

interface SiapeDados {
  mes_pagamento: string;
  tipo_relacao: string;
  cargo: string | null;
  funcao: string | null;
  classe: string | null;
  nivel: string | null;
  nome_instituidor: string | null;
  data_termino: string | null;
  uf_siape: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  total_bruto: string | null;
  total_descontos: string | null;
  total_liquido: string | null;
  // Margens corretas do contracheque
  mg35_bruta: number | null;
  mg35_utilizado: number | null;
  mg35_disponivel: number | null;
  mg5cc_bruta: number | null;
  mg5cc_utilizado: number | null;
  mg5cc_disponivel: number | null;
  mg5cb_bruta: number | null;
  mg5cb_utilizado: number | null;
  mg5cb_disponivel: number | null;
  mg70_bruta: number | null;
  mg70_utilizado: number | null;
  mg70_disponivel: number | null;
}

interface HigienizacaoTelefone {
  telefone: string;
  tipo: string | null;
  principal: boolean | null;
}

interface Higienizacao {
  telefones: HigienizacaoTelefone[];
  emails: string[];
}

interface FolhaAtual {
  competencia: string;
  // Margem 5% (cartão crédito consignado)
  margem_bruta_5: number | null;
  margem_utilizada_5: number | null;
  margem_saldo_5: number | null;
  // Margem Benefício 5% (cartão benefício)
  margem_beneficio_bruta_5: number | null;
  margem_beneficio_utilizada_5: number | null;
  margem_beneficio_saldo_5: number | null;
  // Margem 35%
  margem_bruta_35: number | null;
  margem_utilizada_35: number | null;
  margem_saldo_35: number | null;
  // Margem 70%
  margem_bruta_70: number | null;
  margem_utilizada_70: number | null;
  margem_saldo_70: number | null;
  // Campos legados
  margem_cartao_credito_saldo: number | null;
  margem_cartao_beneficio_saldo: number | null;
  salario_bruto: number | null;
  descontos_brutos: number | null;
  salario_liquido: number | null;
  creditos: number | null;
  debitos: number | null;
  liquido: number | null;
  // Campos adicionais
  exc_qtd: number | null;
  exc_soma: number | null;
  margem: number | null;
  base_tag: string | null;
  extras_folha: any;
}

interface FolhaHistorico {
  competencia: string;
  margem_saldo_5: number | null;
  margem_beneficio_saldo_5: number | null;
  margem_saldo_35: number | null;
  margem_saldo_70: number | null;
  liquido: number | null;
  base_tag: string | null;
}

interface FolhaHistoricoCompleto {
  competencia: string;
  margem_bruta_5: number | null;
  margem_utilizada_5: number | null;
  margem_saldo_5: number | null;
  margem_beneficio_bruta_5: number | null;
  margem_beneficio_utilizada_5: number | null;
  margem_beneficio_saldo_5: number | null;
  margem_bruta_35: number | null;
  margem_utilizada_35: number | null;
  margem_saldo_35: number | null;
  margem_bruta_70: number | null;
  margem_utilizada_70: number | null;
  margem_saldo_70: number | null;
  salario_bruto: number | null;
  salario_liquido: number | null;
  creditos: number | null;
  debitos: number | null;
  liquido: number | null;
  base_tag: string | null;
}

interface HistoricoFolhaResponse {
  pessoa_id: number;
  vinculo_id: number | null;
  nome: string;
  cpf: string;
  total_competencias: number;
  historico: FolhaHistoricoCompleto[];
}

interface Contrato {
  id: number;
  tipo_contrato: string | null;
  banco: string | null; // BANCO_DO_EMPRESTIMO
  valor_parcela: number | null;
  saldo_devedor: number | null;
  parcelas_restantes: number | null; // prazo remanescente exato da planilha
  numero_contrato: string | null;
  competencia: string | null;
  base_tag: string | null;
  dados_brutos: any;
}

interface Vinculo {
  id: number;
  cpf: string;
  matricula: string;
  orgao: string;
  convenio: string | null;
  upag: string | null;
  rjur: string | null;
  sit_func: string | null;
  ativo: boolean;
  primeira_importacao: string;
  ultima_atualizacao: string;
  extras_vinculo: {
    instituidor?: string;
    [key: string]: unknown;
  } | null;
}

interface ClienteDetalhado {
  pessoa: ClienteDetalhadoPessoa;
  folha: {
    atual: FolhaAtual | null;
    historico: FolhaHistorico[];
  };
  contratos: Contrato[];
  vinculos: Vinculo[];
  vinculo_selecionado: number | null;
  tem_multiplos_vinculos: boolean;
  higienizacao: Higienizacao | null;
}

function formatCPF(cpf: string | null): string {
  if (!cpf) return "-";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

function formatCurrency(value: number | null | undefined): string {
  // null/undefined → "-", valor 0 → "R$ 0,00"
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const str = String(dateStr);
    const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      return `${months[month]}/${year}`;
    }
    const d = new Date(str);
    return `${months[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
  } catch {
    return "-";
  }
}

function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const str = String(dateStr);
    const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const d = new Date(str);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${d.getUTCFullYear()}`;
  } catch {
    return "-";
  }
}

function calcularIdade(dataNascimento: string | null): number | null {
  if (!dataNascimento) return null;
  try {
    const nascimento = new Date(dataNascimento);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mesAtual = hoje.getMonth();
    const mesNascimento = nascimento.getMonth();
    const diaAtual = hoje.getDate();
    const diaNascimento = nascimento.getDate();
    
    // Ajusta se ainda não fez aniversário este ano
    if (mesAtual < mesNascimento || (mesAtual === mesNascimento && diaAtual < diaNascimento)) {
      idade--;
    }
    return idade >= 0 ? idade : null;
  } catch {
    return null;
  }
}

function verificarAniversarioNoMes(dataNascimento: string | null): boolean {
  if (!dataNascimento) return false;
  try {
    const nascimento = new Date(dataNascimento);
    const hoje = new Date();
    return nascimento.getMonth() === hoje.getMonth();
  } catch {
    return false;
  }
}

function formatProperName(name: string | null | undefined): string {
  if (!name) return "";
  const prepositions = ["de", "da", "do", "das", "dos", "e"];
  return name
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index > 0 && prepositions.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function CopyableField({ 
  value, 
  displayValue, 
  label,
  onCopy,
  formatOnCopy
}: { 
  value: string | null | undefined; 
  displayValue?: string;
  label?: string;
  onCopy?: (text: string, label?: string) => void;
  formatOnCopy?: (value: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    if (!value) return;
    try {
      const textToCopy = formatOnCopy ? formatOnCopy(value) : value;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      if (onCopy) onCopy(textToCopy, label);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  
  if (!value) return <span className="text-muted-foreground">-</span>;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span 
          className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors inline-flex items-center gap-1"
          onClick={handleCopy}
          data-testid={`copyable-${label?.toLowerCase().replace(/\s/g, "-") || "field"}`}
        >
          {displayValue || value}
          {copied ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{copied ? "Copiado!" : "Clique para copiar"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface Nomenclatura {
  id: number;
  categoria: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export default function ConsultaCliente() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMaster = !!user?.isMaster;

  // Fonte de referência para margens: configuração global + override local do master
  const { data: configDados } = useQuery<{ fonte_margem: "D8" | "CONTRACHEQUE" }>({
    queryKey: ["/api/admin/configuracoes-dados"],
    queryFn: async () => {
      const res = await fetch("/api/admin/configuracoes-dados", { credentials: "include" });
      if (!res.ok) return { fonte_margem: "D8" };
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
  const [fonteOverride, setFonteOverride] = useState<"D8" | "CONTRACHEQUE" | null>(null);
  const fonteAtiva: "D8" | "CONTRACHEQUE" = fonteOverride ?? configDados?.fonte_margem ?? "D8";

  const [searchType, setSearchType] = useState<"cpf" | "matricula" | "telefone">("cpf");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConvenio, setSelectedConvenio] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ConsultaResultado[] | null>(null);
  const [selectedPessoaId, setSelectedPessoaId] = useState<number | null>(null);
  const [selectedVinculoId, setSelectedVinculoId] = useState<number | null>(null);
  const [showExcModal, setShowExcModal] = useState(false);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [showContrachequeModal, setShowContrachequeModal] = useState(false);
  const [contrachequeUrl, setContrachequeUrl] = useState<string | null>(null);
  const [contrachequesMeses, setContrachequesMeses] = useState<any[]>([]);
  const [historicoData, setHistoricoData] = useState<HistoricoFolhaResponse | null>(null);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);
  const [selectedHistoricoCompetencia, setSelectedHistoricoCompetencia] = useState<FolhaHistoricoCompleto | null>(null);
  const [taxasContratos, setTaxasContratos] = useState<Record<number, string>>({});
  const [taxasSiape, setTaxasSiape] = useState<Record<string, string>>({});
  const [showObsDialog, setShowObsDialog] = useState(false);
  
  // Função para calcular Saldo Devedor usando Tabela Price
  const calcularSaldoDevedorPrice = (valorParcela: number | null, taxaPercent: number, parcelasRestantes: number | null): number | null => {
    if (!valorParcela || !parcelasRestantes || taxaPercent <= 0) return null;
    const i = taxaPercent / 100; // Converter percentual para decimal
    const n = parcelasRestantes;
    const pmt = valorParcela;
    // PV = PMT × (1 - (1 + i)^-n) / i
    const pv = pmt * (1 - Math.pow(1 + i, -n)) / i;
    return pv;
  };

  // Busca nomenclaturas para De-Para (ORGAO e TIPO_CONTRATO) - usa endpoint com cache no backend
  const { data: nomenclaturas } = useQuery<Nomenclatura[]>({
    queryKey: ["/api/nomenclaturas-cached"],
    staleTime: 1000 * 60 * 5, // 5 minutos de cache no frontend também
  });

  // Função De-Para: retorna nome se existir, senão código original
  // Suporta alias de categorias (ex: ARQ. UPAG → UPAG)
  // Remove zeros à esquerda para comparação (ex: "000000947" → "947")
  const mapNomenclatura = (categoria: "ORGAO" | "TIPO_CONTRATO" | "UPAG" | "UF" | "ARQ. UPAG", codigo: string | null): string => {
    if (!codigo) return "-";
    if (!nomenclaturas) return codigo;
    // Normaliza categoria para busca (ARQ. UPAG → UPAG)
    const normalizedCategoria = categoria === "ARQ. UPAG" ? "UPAG" : categoria;
    // Remove zeros à esquerda para comparação numérica
    const normalizedCodigo = codigo.replace(/^0+/, "") || "0";
    const found = nomenclaturas.find(n => {
      const nCategoria = n.categoria === "ARQ. UPAG" ? "UPAG" : n.categoria;
      const nCodigo = n.codigo.replace(/^0+/, "") || "0";
      return nCategoria === normalizedCategoria && nCodigo === normalizedCodigo && n.ativo;
    });
    return found ? found.nome : codigo;
  };

  // Listener para resetar estados locais quando dados de clientes são deletados em outra tela
  // Nota: invalidação de queries já é feita na origem (bases-clientes), aqui só resetamos estados locais
  useEffect(() => {
    const handleClientDataDeleted = () => {
      // Não resetar se uma busca está em andamento
      if (isSearching) {
        console.log("[ConsultaCliente] clientDataDeleted event ignored - search in progress");
        return;
      }
      console.log("[ConsultaCliente] clientDataDeleted event received - resetting local states");
      setSearchResults(null);
      setSelectedPessoaId(null);
      setSelectedVinculoId(null);
      setSelectedConvenio("");
      setSearchTerm("");
    };

    window.addEventListener("clientDataDeleted", handleClientDataDeleted);
    return () => window.removeEventListener("clientDataDeleted", handleClientDataDeleted);
  }, [isSearching]);

  // Handler para notificar quando algo é copiado
  const handleCopy = (text: string, label?: string) => {
    toast({
      title: "Copiado!",
      description: label ? `${label} copiado para a área de transferência.` : "Copiado para a área de transferência.",
    });
  };

  // Handler para abrir modal de histórico de folha
  const handleOpenHistorico = async () => {
    if (!selectedPessoaId) return;
    
    setIsLoadingHistorico(true);
    setShowHistoricoModal(true);
    setSelectedHistoricoCompetencia(null);
    
    try {
      const url = selectedVinculoId 
        ? `/api/clientes/${selectedPessoaId}/historico-folha?vinculoId=${selectedVinculoId}`
        : `/api/clientes/${selectedPessoaId}/historico-folha`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Erro ao carregar histórico");
      }
      const data: HistoricoFolhaResponse = await res.json();
      setHistoricoData(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico de folhas.",
        variant: "destructive",
      });
      setShowHistoricoModal(false);
    } finally {
      setIsLoadingHistorico(false);
    }
  };

  const { data: conveniosDisponiveis } = useQuery<string[]>({
    queryKey: ["/api/clientes/filtros/convenios"],
  });

  const { data: clienteDetalhado, isLoading: isLoadingDetails, error: detailsError } = useQuery<ClienteDetalhado>({
    queryKey: ["/api/clientes", selectedPessoaId, selectedVinculoId],
    queryFn: async () => {
      const url = selectedVinculoId 
        ? `/api/clientes/${selectedPessoaId}?vinculoId=${selectedVinculoId}`
        : `/api/clientes/${selectedPessoaId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error("Cliente não encontrado na base de dados.");
        }
        throw new Error(errorData.message || "Erro ao carregar detalhes do cliente.");
      }
      return res.json();
    },
    enabled: !!selectedPessoaId,
    retry: false,
  });
  
  const clienteObsCpf = clienteDetalhado?.pessoa?.cpf?.replace(/[^0-9]/g, "") || "";

  // Dados enriquecidos do SIAPE (cargo, funcao, banco, financeiro)
  const { data: siapeEnrichData } = useQuery<{ dados: SiapeDados | null }>({
    queryKey: ["/api/siape/dados", clienteObsCpf],
    enabled: !!clienteObsCpf,
    retry: false,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!clienteObsCpf) return { dados: null };
      const res = await fetch(`/api/siape/dados/${clienteObsCpf}`, { credentials: "include" });
      if (!res.ok) return { dados: null };
      return res.json();
    },
  });
  const siapeDados = siapeEnrichData?.dados ?? null;

  // Parcelas SIAPE (contratos do contracheque: tipo, banco, valor, prazo)
  const { data: siapeParcelasData } = useQuery<{ parcelas: Array<{
    descricao: string; banco: string; tipo: string; prazo_restante: number; valor: number;
  }> | null }>({
    queryKey: ["/api/siape/parcelas", clienteObsCpf],
    enabled: !!clienteObsCpf,
    retry: false,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!clienteObsCpf) return { parcelas: null };
      const res = await fetch(`/api/siape/parcelas/${clienteObsCpf}`, { credentials: "include" });
      if (!res.ok) return { parcelas: null };
      return res.json();
    },
  });
  const siapeParcelas = siapeParcelasData?.parcelas ?? null;

  const { data: clienteObsData } = useQuery<{ id: number; observation: string; imported_at: string }[] | null>({
    queryKey: ["/api/client-observations", clienteObsCpf],
    enabled: !!clienteObsCpf,
    retry: false,
    queryFn: async () => {
      if (!clienteObsCpf) return null;
      const res = await fetch(`/api/client-observations/${clienteObsCpf}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Auto-sincronizar o vínculo selecionado com o retornado pelo backend
  useEffect(() => {
    if (clienteDetalhado?.vinculo_selecionado && !selectedVinculoId) {
      // Se o backend retornou um vínculo selecionado e não temos um local, usar o do backend
      setSelectedVinculoId(clienteDetalhado.vinculo_selecionado);
    }
  }, [clienteDetalhado?.vinculo_selecionado, selectedVinculoId]);

  const handleSearch = async () => {
    const term = searchTerm.trim();
    const labelCampo = searchType === "cpf" ? "o CPF" : searchType === "matricula" ? "a matrícula" : "o telefone";
    if (!term) {
      toast({
        title: "Campo obrigatório",
        description: `Informe ${labelCampo} para consultar.`,
        variant: "destructive",
      });
      return;
    }

    if (searchType === "telefone") {
      const cleanTel = term.replace(/\D/g, "");
      if (cleanTel.length < 8 || cleanTel.length > 11) {
        toast({
          title: "Telefone inválido",
          description: "Informe entre 8 e 11 dígitos (DDD + número).",
          variant: "destructive",
        });
        return;
      }
    }

    // For matricula search, convenio is required (and must not be "__all__")
    const convenioValue = selectedConvenio && selectedConvenio !== "__all__" ? selectedConvenio : "";
    if (searchType === "matricula" && !convenioValue) {
      toast({
        title: "Convênio obrigatório",
        description: "Para buscar por matrícula, selecione o convênio.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setSearchResults(null);
    setSelectedPessoaId(null);
    setSelectedVinculoId(null);

    try {
      const queryParams = new URLSearchParams();
      if (searchType === "cpf") {
        queryParams.set("cpf", term);
      } else if (searchType === "matricula") {
        queryParams.set("matricula", term);
      } else {
        queryParams.set("telefone", term.replace(/\D/g, ""));
      }
      if (convenioValue) {
        queryParams.set("convenio", convenioValue);
      }

      const response = await fetch(`/api/clientes/consulta?${queryParams.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao consultar");
      }

      const data: ConsultaResponse = await response.json();
      setSearchResults(data.resultados);

      if (data.resultados.length === 1) {
        setSelectedPessoaId(data.resultados[0].pessoa_id);
      } else if (data.resultados.length === 0) {
        const convenioMsg = data.convenio_filtro ? ` no convênio ${data.convenio_filtro}` : "";
        toast({
          title: "Nenhum cliente encontrado",
          description: `Não encontramos clientes com ${searchType === "cpf" ? "o CPF" : searchType === "matricula" ? "a matrícula" : "o telefone"} informado${convenioMsg}.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na consulta",
        description: error.message || "Ocorreu um erro ao consultar o cliente.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPessoa = (pessoaId: number) => {
    setSelectedPessoaId(pessoaId);
    setSelectedVinculoId(null); // Reset vínculo quando muda de pessoa
  };

  const handleBackToResults = () => {
    setSelectedPessoaId(null);
    setSelectedVinculoId(null);
  };

  const handleNewSearch = () => {
    setSearchResults(null);
    setSelectedPessoaId(null);
    setSelectedVinculoId(null);
    setSearchTerm("");
    setSelectedConvenio("");
  };

  // Obter o vínculo atualmente selecionado para exibir dados corretos
  const vinculoAtual = clienteDetalhado?.vinculos?.find(v => v.id === selectedVinculoId) 
    || clienteDetalhado?.vinculos?.find(v => v.id === clienteDetalhado.vinculo_selecionado)
    || clienteDetalhado?.vinculos?.[0];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Consulta de Cliente</h1>
        <p className="text-muted-foreground">
          Busque clientes por CPF ou matrícula para ver dados da base
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Buscar Cliente
          </CardTitle>
          <CardDescription>
            Digite o CPF ou matrícula para consultar os dados do cliente na base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="search-type">Tipo de Busca</Label>
                <Tabs value={searchType} onValueChange={(v) => { setSearchType(v as "cpf" | "matricula" | "telefone"); setSearchTerm(""); }} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="cpf" data-testid="tab-cpf">
                      CPF
                    </TabsTrigger>
                    <TabsTrigger value="matricula" data-testid="tab-matricula">
                      Matrícula
                    </TabsTrigger>
                    <TabsTrigger value="telefone" data-testid="tab-telefone">
                      Telefone
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="convenio">
                  Convênio {searchType === "matricula" ? "(obrigatório)" : "(opcional)"}
                </Label>
                <Select value={selectedConvenio} onValueChange={setSelectedConvenio}>
                  <SelectTrigger data-testid="select-convenio">
                    <SelectValue placeholder="Selecione o convênio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os convênios</SelectItem>
                    {conveniosDisponiveis?.map((conv) => (
                      <SelectItem key={conv} value={conv}>{conv}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="search-term">
                  {searchType === "cpf" ? "CPF" : searchType === "matricula" ? "Matrícula" : "Telefone"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="search-term"
                    placeholder={searchType === "cpf" ? "000.000.000-00" : searchType === "matricula" ? "Digite a matrícula" : "(11) 99999-9999"}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-search-term"
                  />
                  <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search">
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Buscando cliente na base...</span>
        </div>
      )}

      {searchResults && searchResults.length > 1 && !selectedPessoaId && (
        <Card>
          <CardHeader>
            <CardTitle>Múltiplos Resultados Encontrados</CardTitle>
            <CardDescription>
              {searchType === "telefone"
                ? `Encontramos ${searchResults.length} clientes com este telefone. Selecione qual deseja visualizar.`
                : searchType === "matricula"
                ? `Encontramos ${searchResults.length} clientes com esta matrícula. Selecione qual deseja visualizar.`
                : `Encontramos ${searchResults.length} matrículas para este CPF. Selecione qual deseja visualizar.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {searchResults.map((resultado) => (
                <Card key={resultado.pessoa_id} className="hover-elevate cursor-pointer" data-testid={`card-resultado-${resultado.pessoa_id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-lg">{resultado.nome || "Nome não informado"}</p>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>CPF: {formatCPF(resultado.cpf)}</span>
                          <span>Matrícula: {resultado.matricula}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {resultado.convenio && (
                            <Badge variant="outline">{resultado.convenio}</Badge>
                          )}
                          {resultado.sit_func && (
                            <Badge variant="secondary">{resultado.sit_func}</Badge>
                          )}
                          {resultado.uf && (
                            <Badge variant="outline">{resultado.uf}</Badge>
                          )}
                        </div>
                        {resultado.orgao && (
                          <p className="text-sm text-muted-foreground truncate max-w-md">{mapNomenclatura("ORGAO", resultado.orgao)}</p>
                        )}
                      </div>
                      <Button onClick={() => handleSelectPessoa(resultado.pessoa_id)} data-testid={`button-ver-${resultado.pessoa_id}`}>
                        Ver Detalhes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedPessoaId && (
        <>
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando detalhes do cliente...</span>
            </div>
          ) : clienteDetalhado ? (() => {
            // ═══════════════════════════════════════════════════════════════════════════
            // VARIÁVEIS CENTRALIZADAS - usar em TUDO (cards, EXC, debug)
            // ═══════════════════════════════════════════════════════════════════════════
            const folhaAtual = clienteDetalhado?.folha?.atual ?? null;
            // Conversão numérica forçada para EXC
            const excQtd = Number(folhaAtual?.exc_qtd ?? 0);
            const excSoma = Number(folhaAtual?.exc_soma ?? 0);
            const margemReal = Number(folhaAtual?.margem ?? 0);
            const showExcAlert = excQtd > 0;
            
            return (
            <div className="space-y-6">
              <div className="flex items-center gap-4 flex-wrap">
                {searchResults && searchResults.length > 1 && (
                  <Button variant="outline" size="sm" onClick={handleBackToResults} data-testid="button-voltar">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Voltar aos resultados
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleNewSearch} data-testid="button-nova-consulta">
                  Nova Consulta
                </Button>
              </div>

              {clienteDetalhado.tem_multiplos_vinculos && clienteDetalhado.vinculos.length > 1 && (
                <Card className="border-amber-500/50 bg-amber-50/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="w-5 h-5 text-amber-500" />
                      Este CPF possui {clienteDetalhado.vinculos.length} vínculos/órgãos
                    </CardTitle>
                    <CardDescription>
                      Selecione o vínculo para ver os dados de margem correspondentes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {clienteDetalhado.vinculos.map((vinculo) => (
                        <Button
                          key={vinculo.id}
                          variant={selectedVinculoId === vinculo.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedVinculoId(vinculo.id)}
                          className="flex flex-col items-start h-auto py-2 px-3 text-left"
                          data-testid={`button-vinculo-${vinculo.id}`}
                        >
                          <span className="font-medium">{mapNomenclatura("ORGAO", vinculo.orgao)}</span>
                          <span className="text-xs opacity-80">
                            Mat: {vinculo.matricula} | {vinculo.sit_func || "SEM INFO"}
                          </span>
                        </Button>
                      ))}
                    </div>
                    {!selectedVinculoId && (
                      <p className="text-sm text-amber-600 mt-3 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Os dados de margem mostrados são do vínculo mais recente. Selecione um vínculo específico para detalhes.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {clienteObsData && clienteObsData.length > 0 && (
                <Dialog open={showObsDialog} onOpenChange={setShowObsDialog}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Info className="h-4 w-4" style={{ color: "#6C2BD9" }} />
                        Informações Complementares
                      </DialogTitle>
                    </DialogHeader>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="space-y-3 pr-2">
                        {clienteObsData.map((obs) => (
                          <div key={obs.id} className="rounded-md border p-3 space-y-1">
                            <p className="text-sm whitespace-pre-wrap">{obs.observation}</p>
                            <p className="text-xs text-muted-foreground">
                              Importado em: {new Date(obs.imported_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button variant="outline" onClick={() => setShowObsDialog(false)}>
                        Fechar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Dados do Cliente
                    {clienteObsData && clienteObsData.length > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowObsDialog(true)}
                        data-testid="button-obs-info"
                        title="Ver informações complementares"
                      >
                        <Info className="h-5 w-5" style={{ color: "#6C2BD9" }} />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Grade principal */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Convênio */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Convênio</p>
                      <Badge variant="outline">{clienteDetalhado.pessoa.convenio || "-"}</Badge>
                    </div>

                    {/* Situação Funcional */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Situação Funcional</p>
                      <Badge variant="secondary">{vinculoAtual?.sit_func || clienteDetalhado.pessoa.sit_func || "-"}</Badge>
                    </div>

                    {/* UF (substituiu Natureza) */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">UF</p>
                      <p>{siapeDados?.uf_siape || clienteDetalhado.pessoa.uf || "-"}</p>
                    </div>

                    {/* Nascimento / Idade */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Nascimento / Idade
                      </p>
                      <div className="flex items-center gap-2" data-testid="text-nascimento-idade">
                        <span>{formatDateFull(clienteDetalhado.pessoa.data_nascimento)}</span>
                        {calcularIdade(clienteDetalhado.pessoa.data_nascimento) !== null && (
                          <Badge variant="secondary" data-testid="badge-idade">
                            {calcularIdade(clienteDetalhado.pessoa.data_nascimento)} anos
                          </Badge>
                        )}
                        {verificarAniversarioNoMes(clienteDetalhado.pessoa.data_nascimento) && (
                          <Badge variant="default" className="bg-yellow-500 text-black" data-testid="badge-aniversario">
                            Aniversariante do Mês
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Cargo */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Cargo</p>
                      <p>{siapeDados?.cargo || "-"}</p>
                    </div>

                    {/* Função */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Função</p>
                      <p>{siapeDados?.funcao || "-"}</p>
                    </div>

                    {/* UPAG */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">UPAG</p>
                      <p>{mapNomenclatura("UPAG", vinculoAtual?.upag || clienteDetalhado.pessoa.upag)}</p>
                      {(vinculoAtual?.upag || clienteDetalhado.pessoa.upag) && (
                        <p className="text-xs text-muted-foreground">Código: {vinculoAtual?.upag || clienteDetalhado.pessoa.upag}</p>
                      )}
                    </div>

                    {/* Órgão */}
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        Órgão
                      </p>
                      <p>{mapNomenclatura("ORGAO", vinculoAtual?.orgao || clienteDetalhado.pessoa.orgao)}</p>
                      {(vinculoAtual?.orgao || clienteDetalhado.pessoa.orgaocod) && (
                        <p className="text-xs text-muted-foreground">Código: {vinculoAtual?.orgao || clienteDetalhado.pessoa.orgaocod}</p>
                      )}
                    </div>

                    {/* Regime Jurídico */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Regime Jurídico (REJUR)</p>
                      <p>{vinculoAtual?.rjur || clienteDetalhado.pessoa.rjur || "-"}</p>
                    </div>

                    {/* Última Base */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Última Base</p>
                      <Badge>{clienteDetalhado.pessoa.base_tag_ultima || "-"}</Badge>
                    </div>

                    {/* Pensão / Aposentado — Nome Instituidor + Data Término */}
                    {siapeDados && (siapeDados.tipo_relacao === "PENSAO" || siapeDados.tipo_relacao === "APOSENTADO") && (
                      <>
                        {siapeDados.nome_instituidor && (
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Nome Instituidor</p>
                            <p className="font-medium">{siapeDados.nome_instituidor}</p>
                          </div>
                        )}
                        {siapeDados.data_termino && siapeDados.data_termino !== "***********" && (
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Data Término Pensão</p>
                            <p>{siapeDados.data_termino}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Dados Bancários */}
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium flex items-center gap-2 mb-3">
                      <Landmark className="w-4 h-4" />
                      Dados Bancários
                    </p>
                    {(() => {
                      const banco = siapeDados?.banco || clienteDetalhado.pessoa.banco_nome || clienteDetalhado.pessoa.banco_codigo;
                      const agencia = siapeDados?.agencia || clienteDetalhado.pessoa.agencia;
                      const conta = siapeDados?.conta || clienteDetalhado.pessoa.conta;
                      if (!banco && !agencia && !conta) {
                        return <p className="text-muted-foreground text-sm">Dados bancários não informados</p>;
                      }
                      return (
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Banco</p>
                            <CopyableField value={banco} label="Banco" onCopy={handleCopy} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Agência</p>
                            <CopyableField value={agencia} label="Agência" onCopy={handleCopy} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Conta</p>
                            <CopyableField value={conta} label="Conta" onCopy={handleCopy} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Financeiro — resumo da folha */}
                  {(folhaAtual || siapeDados) && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-3">Financeiro</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Total Bruto</p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(folhaAtual?.creditos ?? (siapeDados?.total_bruto ? parseFloat(siapeDados.total_bruto) : null))}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Total Descontos</p>
                          <p className="font-semibold text-red-600">
                            {formatCurrency(folhaAtual?.debitos ?? (siapeDados?.total_descontos ? parseFloat(siapeDados.total_descontos) : null))}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Valor Líquido</p>
                          <p className="font-semibold">
                            {formatCurrency(folhaAtual?.liquido ?? (siapeDados?.total_liquido ? parseFloat(siapeDados.total_liquido) : null))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>


              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="w-5 h-5" />
                        Situação de Folha
                        <span style={{fontSize:10,background:"#7c3aed",color:"#fff",padding:"1px 6px",borderRadius:4,cursor:"pointer"}} onClick={() => setFonteOverride(fonteAtiva === "D8" ? (siapeDados ? "CONTRACHEQUE" : null) : "D8")}>
                          {fonteAtiva === "D8" ? "D8 ▾" : "Contracheque ▾"}
                        </span>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {folhaAtual
                          ? `Competência mais recente: ${formatDate(folhaAtual.competencia)}`
                          : "Nenhum dado de folha disponível"
                        }
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                    {/* Botão contracheque — aparece sempre que há dados SIAPE */}
                    {siapeDados && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const cpfLimpo = (clienteDetalhado?.pessoa?.cpf || "").replace(/\D/g, "");
                          if (!cpfLimpo) return;
                          try {
                            const r = await fetch(`/api/siape/contracheque/${cpfLimpo}`);
                            const json = await r.json();
                            const meses = json.meses || [];
                            if (meses.length === 0) {
                              toast({ title: "Contracheque não encontrado", description: "Nenhum dado SIAPE importado para este CPF.", variant: "destructive" });
                              return;
                            }
                            setContrachequesMeses(meses);
                            setContrachequeUrl(`/api/siape/contracheque/${cpfLimpo}/html?mes=${meses[0].mes_pagamento}`);
                            setShowContrachequeModal(true);
                          } catch {
                            toast({ title: "Erro", description: "Não foi possível carregar o contracheque.", variant: "destructive" });
                          }
                        }}
                      >
                        📄 Ver Contracheque SIAPE
                      </Button>
                    )}
                    </div>
                  </div>
                </CardHeader>
                {/* ── Seletor de fonte de margens ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 24px 12px" }}>
                  <span style={{ fontSize: 11, color: "#888" }}>Fonte das margens:</span>
                  {(["D8", "CONTRACHEQUE"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFonteOverride(fonteAtiva === f && fonteOverride ? null : f)}
                      disabled={f === "CONTRACHEQUE" && !siapeDados}
                      style={{
                        fontSize: 11,
                        padding: "2px 10px",
                        borderRadius: 4,
                        border: "1px solid",
                        cursor: f === "CONTRACHEQUE" && !siapeDados ? "not-allowed" : "pointer",
                        opacity: f === "CONTRACHEQUE" && !siapeDados ? 0.4 : 1,
                        background: fonteAtiva === f ? "#7c3aed" : "transparent",
                        color: fonteAtiva === f ? "#fff" : "inherit",
                        fontWeight: fonteAtiva === f ? 600 : 400,
                      }}
                    >
                      {f === "D8" ? "D8" : "Contracheque"}
                    </button>
                  ))}
                  {fonteOverride && (
                    <button onClick={() => setFonteOverride(null)} style={{ fontSize: 11, cursor: "pointer", color: "#888" }}>
                      ✕ padrão
                    </button>
                  )}
                </div>
                <CardContent>
                  {folhaAtual ? (
                    <div className="space-y-6">
                      {/* Modal de detalhes EXC */}
                      <Dialog open={showExcModal} onOpenChange={setShowExcModal}>
                        <DialogContent className="sm:max-w-md" data-testid="modal-exc-detalhes">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600">
                              <AlertTriangle className="h-5 w-5" />
                              Desconto Fora de Folha
                            </DialogTitle>
                            <DialogDescription>
                              Há descontos fora do consignado. Use a Margem real para conferência no extrato.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-muted p-4 rounded-lg">
                                <p className="text-sm text-muted-foreground">EXC QTD</p>
                                <p className="text-2xl font-bold">{excQtd}</p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <p className="text-sm text-muted-foreground">EXC Soma</p>
                                <p className="text-2xl font-bold">{formatCurrency(excSoma)}</p>
                              </div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                              <p className="text-sm text-muted-foreground">Margem real (após desconto fora de folha)</p>
                              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                                {formatCurrency(margemReal)}
                              </p>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {/* Indicador de fonte das margens */}
                      {siapeDados?.mg35_bruta != null && (
                        fonteAtiva === "CONTRACHEQUE" ? (
                          <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 rounded-md w-fit">
                            <span className="font-semibold">✓ Margens via Contracheque SIAPE</span>
                            <span className="text-blue-400">({siapeDados.mes_pagamento})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md w-fit">
                            <span className="font-semibold">✓ Margens via D8</span>
                            <span className="opacity-60">(contracheque disponível)</span>
                          </div>
                        )
                      )}

                      {/* Helper: seleciona valor conforme fonte ativa */}
                      {(() => {
                        const usaContrachq = fonteAtiva === "CONTRACHEQUE" && !!siapeDados;
                        const mg70_bruta    = usaContrachq ? siapeDados!.mg70_bruta    : folhaAtual.margem_bruta_70;
                        const mg70_util     = usaContrachq ? siapeDados!.mg70_utilizado : folhaAtual.margem_utilizada_70;
                        const mg70_saldo    = usaContrachq ? siapeDados!.mg70_disponivel : folhaAtual.margem_saldo_70;
                        const mg35_bruta    = usaContrachq ? siapeDados!.mg35_bruta    : folhaAtual.margem_bruta_35;
                        const mg35_util     = usaContrachq ? siapeDados!.mg35_utilizado : folhaAtual.margem_utilizada_35;
                        const mg35_saldo    = usaContrachq ? siapeDados!.mg35_disponivel : folhaAtual.margem_saldo_35;
                        const mg5cc_bruta   = usaContrachq ? siapeDados!.mg5cc_bruta   : folhaAtual.margem_bruta_5;
                        const mg5cc_util    = usaContrachq ? siapeDados!.mg5cc_utilizado : folhaAtual.margem_utilizada_5;
                        const mg5cc_saldo   = usaContrachq ? siapeDados!.mg5cc_disponivel : folhaAtual.margem_saldo_5;
                        const mg5cb_bruta   = usaContrachq ? siapeDados!.mg5cb_bruta   : folhaAtual.margem_beneficio_bruta_5;
                        const mg5cb_util    = usaContrachq ? siapeDados!.mg5cb_utilizado : folhaAtual.margem_beneficio_utilizada_5;
                        const mg5cb_saldo   = usaContrachq ? siapeDados!.mg5cb_disponivel : folhaAtual.margem_beneficio_saldo_5;
                        return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Margem 70% */}
                        <Card className="bg-muted/50" data-testid="card-margem-70">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Margem 70%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(mg70_bruta)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(mg70_util)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className={(mg70_saldo ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                  {formatCurrency(mg70_saldo)}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Margem 35% */}
                        <Card className="bg-muted/50" data-testid="card-margem-35">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Margem 35%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(mg35_bruta)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(mg35_util)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className={(mg35_saldo ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                  {formatCurrency(mg35_saldo)}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Margem 5% — Cartão Crédito */}
                        <Card className="bg-muted/50" data-testid="card-margem-5">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Margem 5%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(mg5cc_bruta)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(mg5cc_util)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className={(mg5cc_saldo ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                  {formatCurrency(mg5cc_saldo)}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Margem 5% — Cartão Benefício */}
                        <Card className="bg-muted/50" data-testid="card-margem-beneficio-5">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Benefício 5%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(mg5cb_bruta)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(mg5cb_util)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className={(mg5cb_saldo ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                  {formatCurrency(mg5cb_saldo)}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                        ); })()}


                      <Separator />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Créditos</p>
                          <p className="text-lg font-semibold text-green-600">{formatCurrency(folhaAtual.creditos)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Débitos</p>
                          <p className="text-lg font-semibold text-red-600">{formatCurrency(folhaAtual.debitos)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Líquido</p>
                          <p className="text-lg font-semibold">{formatCurrency(folhaAtual.liquido)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-center items-center gap-2 pt-2">
                        {/* Toggle fonte de margens — sempre visível */}
                        <div className="flex items-center rounded-md border border-border overflow-hidden text-xs">
                          <button
                            onClick={() => setFonteOverride("D8")}
                            className={`px-3 py-1.5 transition-colors ${fonteAtiva === "D8" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground"}`}
                          >
                            D8
                          </button>
                          <button
                            onClick={() => setFonteOverride(siapeDados ? "CONTRACHEQUE" : null)}
                            disabled={!siapeDados}
                            title={siapeDados ? "Usar margens do contracheque" : "Contracheque não disponível para este cliente"}
                            className={`px-3 py-1.5 transition-colors ${fonteAtiva === "CONTRACHEQUE" ? "bg-primary text-primary-foreground font-medium" : !siapeDados ? "opacity-40 cursor-not-allowed text-muted-foreground" : "hover:bg-muted text-muted-foreground"}`}
                          >
                            Contracheque
                          </button>
                          {fonteOverride && (
                            <button
                              onClick={() => setFonteOverride(null)}
                              className="px-1.5 py-1.5 hover:bg-muted text-muted-foreground border-l border-border"
                              title="Voltar ao padrão"
                            >✕</button>
                          )}
                        </div>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleOpenHistorico}
                              disabled={isLoadingHistorico}
                              data-testid="button-historico-folha"
                            >
                              {isLoadingHistorico ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Calendar className="w-4 h-4 mr-2" />
                              )}
                              Ver Histórico
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Visualizar todas as competências importadas</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Botão Contracheque SIAPE */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const cpfLimpo = (clienteDetalhado?.pessoa?.cpf || "").replace(/\D/g, "");
                                if (!cpfLimpo) return;
                                try {
                                  const r = await fetch(`/api/siape/contracheque/${cpfLimpo}`);
                                  const json = await r.json();
                                  const meses = json.meses || [];
                                  if (meses.length === 0) {
                                    toast({ title: "Contracheque não encontrado", description: "Nenhum dado SIAPE importado para este CPF.", variant: "destructive" });
                                    return;
                                  }
                                  setContrachequesMeses(meses);
                                  setContrachequeUrl(`/api/siape/contracheque/${cpfLimpo}/html?mes=${meses[0].mes_pagamento}`);
                                  setShowContrachequeModal(true);
                                } catch {
                                  toast({ title: "Erro", description: "Não foi possível carregar o contracheque.", variant: "destructive" });
                                }
                              }}
                            >
                              📄 Contracheque
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ver contracheque SIAPE do servidor</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum dado de folha disponível para este cliente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {folhaAtual && (
                <SimulacaoRapida
                  convenio={vinculoAtual?.convenio || clienteDetalhado.pessoa.convenio}
                  saldo35={folhaAtual.margem_saldo_35}
                  saldo5beneficio={folhaAtual.margem_beneficio_saldo_5}
                  saldo5cartao={folhaAtual.margem_saldo_5}
                />
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Contratos
                    {siapeParcelas && siapeParcelas.length > 0 && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 ml-1">SIAPE</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {siapeParcelas && siapeParcelas.length > 0
                      ? `${siapeParcelas.length} desconto(s) do contracheque SIAPE`
                      : clienteDetalhado.contratos.length > 0
                        ? `${clienteDetalhado.contratos.length} contrato(s) encontrado(s)`
                        : "Nenhum contrato registrado"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Alerta: desconto na margem sem contrato identificado */}
                  {(() => {
                    // Usa siapeDados se disponível (mesma lógica da exibição de margens)
                    const utilizada35Raw = siapeDados?.mg35_utilizado
                      ? parseFloat(siapeDados.mg35_utilizado)
                      : (folhaAtual?.margem_utilizada_35 ?? 0);
                    const utilizada35 = Number(utilizada35Raw) || 0;
                    if (utilizada35 <= 10) return null;
                    // Soma dos contratos conhecidos: siapeParcelas (contracheque) ou D8
                    const somaConhecida = siapeParcelas && siapeParcelas.length > 0
                      ? siapeParcelas.reduce((acc: number, p: any) => acc + (Number(p.valor) || 0), 0)
                      : clienteDetalhado.contratos.reduce((acc: number, c: any) => acc + (Number(c.valor_parcela) || 0), 0);
                    const discrepancia = utilizada35 - somaConhecida;
                    if (discrepancia <= 10) return null;
                    return (
                      <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        <span className="mt-0.5 text-base">⚠️</span>
                        <div>
                          <span className="font-semibold">Desconto não identificado na margem 35%</span>
                          <span className="ml-1">
                            — A folha aponta <strong>R$ {utilizada35.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> utilizada,
                            mas só encontramos <strong>R$ {somaConhecida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> em contratos.
                            Diferença de <strong>R$ {discrepancia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                            Verifique o contracheque.
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Tabela SIAPE — prioridade quando existir */}
                  {siapeParcelas && siapeParcelas.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Banco</TableHead>
                          <TableHead>Valor Parcela</TableHead>
                          <TableHead>Parc. Rest.</TableHead>
                          <TableHead className="w-24">Taxa (%)</TableHead>
                          <TableHead>Saldo Devedor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {siapeParcelas.map((p, idx) => {
                          const key = `${idx}`;
                          const taxaStr = taxasSiape[key];
                          const taxa = taxaStr ? parseFloat(taxaStr) : 0;
                          const saldo = taxa > 0
                            ? calcularSaldoDevedorPrice(p.valor, taxa, p.prazo_restante)
                            : null;
                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                <input type="checkbox" className="rounded" />
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize whitespace-nowrap">
                                  {p.tipo || "-"}
                                </Badge>
                              </TableCell>
                              <TableCell className="group">
                                <CopyableField value={p.banco} label="Banco" onCopy={handleCopy} />
                              </TableCell>
                              <TableCell className="group">
                                <CopyableField
                                  value={p.valor?.toString()}
                                  displayValue={formatCurrency(p.valor)}
                                  label="Valor da Parcela"
                                  onCopy={handleCopy}
                                />
                              </TableCell>
                              <TableCell className="text-center">{p.prazo_restante ?? "-"}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="w-20 h-8 text-sm text-center"
                                  value={taxaStr || ""}
                                  onChange={(e) => setTaxasSiape(prev => ({ ...prev, [key]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell className="group">
                                <div className="flex items-center gap-1">
                                  <CopyableField
                                    value={saldo?.toFixed(2)}
                                    displayValue={saldo != null ? formatCurrency(saldo) : "-"}
                                    label="Saldo Devedor"
                                    onCopy={handleCopy}
                                  />
                                  {saldo != null && (
                                    <Badge variant="outline" className="text-xs ml-1 text-blue-600 border-blue-300">calc</Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : clienteDetalhado.contratos.length > 0 ? (
                    /* Fallback — tabela antiga quando não há dados SIAPE */
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Origem do Desconto</TableHead>
                          <TableHead>Nº Contrato</TableHead>
                          <TableHead>Valor Parcela</TableHead>
                          <TableHead className="w-24">Taxa (%)</TableHead>
                          <TableHead>Saldo Devedor</TableHead>
                          <TableHead>Parcelas Restantes</TableHead>
                          <TableHead>Competência</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clienteDetalhado.contratos.map((contrato) => (
                          <TableRow key={contrato.id} data-testid={`row-contrato-${contrato.id}`}>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {mapNomenclatura("TIPO_CONTRATO", contrato.tipo_contrato)}
                              </Badge>
                            </TableCell>
                            <TableCell className="group">
                              <CopyableField value={contrato.banco} label="Origem do Desconto" onCopy={handleCopy} />
                            </TableCell>
                            <TableCell className="group font-mono text-sm">
                              <CopyableField value={contrato.numero_contrato} label="Número do Contrato" onCopy={handleCopy} />
                            </TableCell>
                            <TableCell className="group">
                              <CopyableField
                                value={contrato.valor_parcela?.toString()}
                                displayValue={formatCurrency(contrato.valor_parcela)}
                                label="Valor da Parcela"
                                onCopy={handleCopy}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="w-20 h-8 text-sm text-center"
                                value={taxasContratos[contrato.id] || ""}
                                onChange={(e) => setTaxasContratos(prev => ({ ...prev, [contrato.id]: e.target.value }))}
                                data-testid={`input-taxa-${contrato.id}`}
                              />
                            </TableCell>
                            <TableCell className="group">
                              {(() => {
                                const taxaStr = taxasContratos[contrato.id];
                                const taxa = taxaStr ? parseFloat(taxaStr) : 0;
                                const saldoCalculado = taxa > 0
                                  ? calcularSaldoDevedorPrice(contrato.valor_parcela, taxa, contrato.parcelas_restantes)
                                  : null;
                                const saldoExibir = saldoCalculado !== null ? saldoCalculado : contrato.saldo_devedor;
                                return (
                                  <div className="flex items-center gap-1">
                                    <CopyableField
                                      value={saldoExibir?.toFixed(2)}
                                      displayValue={formatCurrency(saldoExibir)}
                                      label="Saldo Devedor"
                                      onCopy={handleCopy}
                                    />
                                    {saldoCalculado !== null && (
                                      <Badge variant="outline" className="text-xs ml-1 text-blue-600 border-blue-300">calc</Badge>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="group text-center">
                              <CopyableField
                                value={contrato.parcelas_restantes?.toString()}
                                label="Parcelas Restantes"
                                onCopy={handleCopy}
                              />
                            </TableCell>
                            <TableCell>{formatDate(contrato.competencia)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum contrato registrado para este cliente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Seção Dados de Contato / Higienização - movida para o final */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    Dados de Contato / Higienização
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Telefones */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Telefones</p>
                      {clienteDetalhado.higienizacao?.telefones && clienteDetalhado.higienizacao.telefones.length > 0 ? (
                        <div className="space-y-2">
                          {clienteDetalhado.higienizacao.telefones.map((tel, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-center justify-between p-2 bg-muted rounded-md group"
                              data-testid={`telefone-item-${idx}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{tel.telefone}</span>
                                {tel.principal && (
                                  <Badge variant="outline" className="text-xs">Principal</Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  navigator.clipboard.writeText(tel.telefone);
                                  handleCopy(tel.telefone, `Telefone ${idx + 1}`);
                                }}
                                data-testid={`button-copiar-telefone-${idx}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : clienteDetalhado.pessoa.telefones_base && clienteDetalhado.pessoa.telefones_base.length > 0 ? (
                        <div className="space-y-2">
                          {clienteDetalhado.pessoa.telefones_base.map((tel, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-center justify-between p-2 bg-muted rounded-md group"
                              data-testid={`telefone-legado-item-${idx}`}
                            >
                              <span className="font-mono text-sm">{tel}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  navigator.clipboard.writeText(tel);
                                  handleCopy(tel, `Telefone ${idx + 1}`);
                                }}
                                data-testid={`button-copiar-telefone-legado-${idx}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Nenhum telefone cadastrado</p>
                      )}
                    </div>
                    
                    {/* E-mails */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">E-mails</p>
                      {clienteDetalhado.higienizacao?.emails && clienteDetalhado.higienizacao.emails.length > 0 ? (
                        <div className="space-y-2">
                          {clienteDetalhado.higienizacao.emails.map((email, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-center justify-between p-2 bg-muted rounded-md group"
                              data-testid={`email-item-${idx}`}
                            >
                              <span className="text-sm">{email}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  navigator.clipboard.writeText(email);
                                  handleCopy(email, `E-mail ${idx + 1}`);
                                }}
                                data-testid={`button-copiar-email-${idx}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Nenhum e-mail cadastrado</p>
                      )}
                    </div>
                    
                    {/* Endereço Completo */}
                    <div className="space-y-3 md:col-span-2">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Endereço
                      </p>
                      {clienteDetalhado.pessoa.municipio || clienteDetalhado.pessoa.uf ? (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="text-sm">
                            {[clienteDetalhado.pessoa.municipio, clienteDetalhado.pessoa.uf].filter(Boolean).join(" - ")}
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Endereço não informado</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            )
          })() : (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{detailsError instanceof Error ? detailsError.message : "Não foi possível carregar os detalhes do cliente."}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={handleBackToResults} data-testid="button-tentar-novamente">
                  Voltar aos resultados
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {searchResults && searchResults.length === 0 && !isSearching && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum cliente encontrado para {searchType === "cpf" ? "o CPF" : searchType === "matricula" ? "a matrícula" : "o telefone"} informado.</p>
            <p className="text-sm mt-2">Verifique os dados e tente novamente.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showHistoricoModal} onOpenChange={setShowHistoricoModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Histórico de Folhas
            </DialogTitle>
            <DialogDescription>
              {historicoData && (
                <span>
                  {historicoData.nome} - CPF: {formatCPF(historicoData.cpf)} 
                  {historicoData.total_competencias > 0 && ` - ${historicoData.total_competencias} competência(s)`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingHistorico ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : historicoData && historicoData.historico.length > 0 ? (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              <div className="overflow-auto max-h-[300px] border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-right">Margem 70%</TableHead>
                      <TableHead className="text-right">Margem 35%</TableHead>
                      <TableHead className="text-right">Margem 5%</TableHead>
                      <TableHead className="text-right">Benef. 5%</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoData.historico.map((f, idx) => (
                      <TableRow 
                        key={idx} 
                        className={selectedHistoricoCompetencia?.competencia === f.competencia ? "bg-muted" : "cursor-pointer hover:bg-muted/50"}
                        onClick={() => setSelectedHistoricoCompetencia(f)}
                        data-testid={`row-historico-${idx}`}
                      >
                        <TableCell className="font-medium">{formatDate(f.competencia)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(f.margem_saldo_70)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(f.margem_saldo_35)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(f.margem_saldo_5)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(f.margem_beneficio_saldo_5)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(f.liquido)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{f.base_tag}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); setSelectedHistoricoCompetencia(f); }}
                            data-testid={`button-ver-detalhes-${idx}`}
                          >
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {selectedHistoricoCompetencia && (
                <Card className="flex-shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      Detalhes - {formatDate(selectedHistoricoCompetencia.competencia)}
                      <Badge variant="outline">{selectedHistoricoCompetencia.base_tag}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Margem 70%</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bruta:</span>
                            <span>{formatCurrency(selectedHistoricoCompetencia.margem_bruta_70)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Utilizada:</span>
                            <span>{formatCurrency(selectedHistoricoCompetencia.margem_utilizada_70)}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Saldo:</span>
                            <span className={(selectedHistoricoCompetencia.margem_saldo_70 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                              {formatCurrency(selectedHistoricoCompetencia.margem_saldo_70)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Margem 35%</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bruta:</span>
                            <span>{formatCurrency(selectedHistoricoCompetencia.margem_bruta_35)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Utilizada:</span>
                            <span>{formatCurrency(selectedHistoricoCompetencia.margem_utilizada_35)}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Saldo:</span>
                            <span className={(selectedHistoricoCompetencia.margem_saldo_35 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                              {formatCurrency(selectedHistoricoCompetencia.margem_saldo_35)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Margem 5%</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bruta:</span>
                            <span>{formatCurrency(selectedHistoricoCompetencia.margem_bruta_5)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Utilizada:</span>
                            <span>{formatCurrency(selectedHistoricoCompetencia.margem_utilizada_5)}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Saldo:</span>
                            <span className={(selectedHistoricoCompetencia.margem_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                              {formatCurrency(selectedHistoricoCompetencia.margem_saldo_5)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Benefício 5%</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bruta:</span>
                            <span>{formatCurrency(selectedHistoricoCompetencia.margem_beneficio_bruta_5)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Utilizada:</span>
                            <span>{formatCurrency(selectedHistoricoCompetencia.margem_beneficio_utilizada_5)}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Saldo:</span>
                            <span className={(selectedHistoricoCompetencia.margem_beneficio_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                              {formatCurrency(selectedHistoricoCompetencia.margem_beneficio_saldo_5)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Salário Bruto</p>
                        <p className="font-medium">{formatCurrency(selectedHistoricoCompetencia.salario_bruto)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Salário Líquido</p>
                        <p className="font-medium">{formatCurrency(selectedHistoricoCompetencia.salario_liquido)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Créditos</p>
                        <p className="font-medium text-green-600">{formatCurrency(selectedHistoricoCompetencia.creditos)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Débitos</p>
                        <p className="font-medium text-red-600">{formatCurrency(selectedHistoricoCompetencia.debitos)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Líquido</p>
                        <p className="font-medium">{formatCurrency(selectedHistoricoCompetencia.liquido)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum histórico de folha disponível.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal Contracheque SIAPE ── */}
      <Dialog open={showContrachequeModal} onOpenChange={setShowContrachequeModal}>
        <DialogContent className="max-w-[880px] w-full h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>📄 Contracheque SIAPE</span>
              {contrachequeUrl && (
                <button
                  onClick={() => {
                    const win = window.open(contrachequeUrl, '_blank');
                    if (win) win.onload = () => { win.focus(); win.print(); };
                  }}
                  className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  🖨️ Imprimir / Salvar PDF
                </button>
              )}
            </DialogTitle>
            {contrachequesMeses.length > 1 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {contrachequesMeses.map((m: any) => {
                  const mes = m.mes_pagamento;
                  const label = mes.replace(/^([A-Z]+)(\d{4})$/, '$1/$2');
                  const cpfLimpo = (clienteDetalhado?.pessoa?.cpf || "").replace(/\D/g, "");
                  const url = `/api/siape/contracheque/${cpfLimpo}/html?mes=${mes}`;
                  return (
                    <button
                      key={mes}
                      onClick={() => setContrachequeUrl(url)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        contrachequeUrl === url
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {contrachequeUrl && (
              <iframe
                key={contrachequeUrl}
                src={contrachequeUrl}
                className="w-full h-full border-0"
                title="Contracheque SIAPE"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
