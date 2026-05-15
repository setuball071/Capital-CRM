import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TagManager } from "@/components/tag-manager";
import { SimulacaoRapida } from "@/components/SimulacaoRapida";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, Phone, MessageSquare, Mail, User, Building, Building2, CreditCard, Search,
  Landmark, Briefcase, Copy, Calendar, MapPin, Database, Calculator, Star,
  Plus, Pencil, Trash2, Save, SkipForward, Target, History, AlertCircle, AlertTriangle, Info
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhoneClientSearch } from "@/components/PhoneClientSearch";

const TIPOS_CONTATO_CONSULTA = ["ligacao", "whatsapp", "outro"] as const;
type TipoContatoConsulta = typeof TIPOS_CONTATO_CONSULTA[number];

const MARCADORES_CONSULTA = [
  "em_atendimento",
  "interesse",
  "agendar_retorno", 
  "sem_interesse",
  "vendido",
  "concluido"
] as const;
type MarcadorConsulta = typeof MARCADORES_CONSULTA[number];

const MARCADOR_LABELS: Record<MarcadorConsulta, string> = {
  em_atendimento: "Em Atendimento",
  interesse: "Interesse",
  agendar_retorno: "Agendar Retorno",
  sem_interesse: "Sem Interesse",
  vendido: "Vendido",
  concluido: "Concluído",
};

interface HigienizacaoTelefone {
  telefone: string;
  tipo: string;
  principal: boolean | null;
}

interface ClientContact {
  id: number;
  clientId: number;
  type: string;
  value: string;
  label: string | null;
  isPrimary: boolean;
  isManual: boolean;
}

interface VinculoItem {
  id: number;
  cpf: string;
  matricula: string;
  orgao: string | null;
  convenio: string | null;
  upag: string | null;
  rjur: string | null;
  sit_func: string | null;
  ativo: boolean;
}

interface ConsultaData {
  clienteBase: any | null;
  folhaAtual: any | null;
  contratos: any[];
  higienizacao?: {
    telefones: HigienizacaoTelefone[];
    emails: string[];
    endereco?: {
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
      cep?: string;
    };
  };
  vinculo?: {
    id: number;
    pessoaId: number;
    cpf: string;
    matricula: string;
    orgao: string | null;
    upag: string | null;
    sitFunc: string | null;
    rjur: string | null;
    natureza: string | null;
  } | null;
  vinculos?: VinculoItem[];
  tem_multiplos_vinculos?: boolean;
  pessoaId?: number;
  leadId?: number;
}

interface HistoricoFolhaItem {
  competencia: string;
  margem_bruta_70: number | null;
  margem_utilizada_70: number | null;
  margem_saldo_70: number | null;
  margem_bruta_35: number | null;
  margem_utilizada_35: number | null;
  margem_saldo_35: number | null;
  margem_bruta_5: number | null;
  margem_utilizada_5: number | null;
  margem_saldo_5: number | null;
  margem_beneficio_bruta_5: number | null;
  margem_beneficio_utilizada_5: number | null;
  margem_beneficio_saldo_5: number | null;
  salario_bruto: number | null;
  salario_liquido: number | null;
  creditos: number | null;
  debitos: number | null;
  liquido: number | null;
}

interface HistoricoFolhaData {
  pessoa_id: number;
  vinculo_id: number | null;
  nome: string;
  cpf: string;
  total_competencias: number;
  historico: HistoricoFolhaItem[];
}

function formatCPF(cpf: string | null): string {
  if (!cpf) return "-";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatCompetencia(competencia: string | null | undefined): string {
  if (!competencia) return "-";
  try {
    const date = new Date(competencia);
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    return `${month}/${year}`;
  } catch {
    return competencia;
  }
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
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
  testId, 
  className = "",
  toast,
  formatOnCopy
}: { 
  value: string | null | undefined; 
  displayValue: string; 
  testId: string;
  className?: string;
  toast: ReturnType<typeof useToast>["toast"];
  formatOnCopy?: (value: string) => string;
}) {
  const handleCopy = async () => {
    if (!value || value === "-") return;
    try {
      const textToCopy = formatOnCopy ? formatOnCopy(value) : value;
      await navigator.clipboard.writeText(textToCopy);
      toast({ title: "Copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const canCopy = value && value !== "-" && displayValue !== "-";

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span>{displayValue}</span>
      {canCopy && (
        <button
          onClick={handleCopy}
          className="p-0.5 rounded hover:bg-muted transition-colors"
          data-testid={testId}
          type="button"
        >
          <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </span>
  );
}

export default function VendasConsulta() {
  const { toast } = useToast();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const cpfFromUrl = urlParams.get("cpf");
  const hasAutoSearched = useRef(false);
  
  const [termoBusca, setTermoBusca] = useState("");
  const [searchMode, setSearchMode] = useState<"padrao" | "telefone">("padrao");
  const [consultaData, setConsultaData] = useState<ConsultaData | null>(null);
  const [portfolioInfo, setPortfolioInfo] = useState<{ vendorName: string; expiresAt: string } | null>(null);
  const [selectedVinculoId, setSelectedVinculoId] = useState<number | null>(null);
  const [contratosSelecionados, setContratosSelecionados] = useState<Set<number>>(new Set());
  const [taxasContratos, setTaxasContratos] = useState<Record<number, string>>({});
  const [taxasSiape, setTaxasSiape] = useState<Record<string, string>>({});
  const [siapeSelecionados, setSiapeSelecionados] = useState<Set<number>>(new Set());
  
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [newContact, setNewContact] = useState({ tipo: "phone", valor: "", label: "" });
  
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoData, setHistoricoData] = useState<HistoricoFolhaData | null>(null);
  const [selectedHistoricoItem, setSelectedHistoricoItem] = useState<HistoricoFolhaItem | null>(null);
  
  const [contatosModalOpen, setContatosModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addToPipeline, setAddToPipeline] = useState(true);
  const [interactionFormData, setInteractionFormData] = useState({
    tipoContato: "ligacao" as TipoContatoConsulta,
    marcador: "em_atendimento" as MarcadorConsulta,
    margemValor: "",
    propostaValorEstimado: "",
    observacao: "",
  });
  const [agendamentoData, setAgendamentoData] = useState("");
  const [agendamentoNota, setAgendamentoNota] = useState("");
  const [showObsDialog, setShowObsDialog] = useState(false);

  // ─── Dados Bancários manual (Maranhão) ───────────────────────────────────
  const [editandoBancario, setEditandoBancario] = useState(false);
  const [bancarioForm, setBancarioForm] = useState({ banco: "", agencia: "", conta: "" });

  // ─── Contrato manual (Maranhão) ──────────────────────────────────────────
  const [adicionandoContrato, setAdicionandoContrato] = useState(false);
  const [contratoForm, setContratoForm] = useState({
    banco: "", tipo: "consignado", valorParcela: "",
    parcelasRestantes: "", prazoTotal: "", numeroContrato: "",
  });

  const clienteCpf = consultaData?.clienteBase?.cpf?.replace(/[^0-9]/g, "") || "";

  // Dados enriquecidos do SIAPE (cargo, função, UF, banco, financeiro, margens corretas)
  const { data: siapeEnrichData } = useQuery<{
    dados: {
      mes_pagamento: string | null;
      tipo_relacao: string | null;
      cargo: string | null;
      funcao: string | null;
      nome_instituidor: string | null;
      data_termino: string | null;
      uf_siape: string | null;
      banco: string | null;
      agencia: string | null;
      conta: string | null;
      total_bruto: string | null;
      total_descontos: string | null;
      total_liquido: string | null;
      // Margens SIAPE (calculadas pelo processar_pdf_siape.py)
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
    } | null
  }>({
    queryKey: ["/api/siape/dados", clienteCpf],
    enabled: !!clienteCpf,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!clienteCpf) return { dados: null };
      const res = await fetch(`/api/siape/dados/${clienteCpf}`, { credentials: "include" });
      if (!res.ok) return { dados: null };
      return res.json();
    },
  });
  const siapeDados = siapeEnrichData?.dados ?? null;

  const { data: siapeParcelasData } = useQuery<{ parcelas: Array<{
    descricao: string; banco: string; tipo: string; prazo_restante: number; valor: number;
  }> | null }>({
    queryKey: ["/api/siape/parcelas", clienteCpf],
    enabled: !!clienteCpf,
    retry: false,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!clienteCpf) return { parcelas: null };
      const res = await fetch(`/api/siape/parcelas/${clienteCpf}`, { credentials: "include" });
      if (!res.ok) return { parcelas: null };
      return res.json();
    },
  });
  const siapeParcelas = siapeParcelasData?.parcelas ?? null;

  const { data: clienteObsData } = useQuery<{ id: number; observation: string; imported_at: string }[] | null>({
    queryKey: ["/api/client-observations", clienteCpf],
    enabled: !!clienteCpf,
    retry: false,
    queryFn: async () => {
      if (!clienteCpf) return null;
      const res = await fetch(`/api/client-observations/${clienteCpf}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
  });

  const parseCurrency = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;
    
    const str = String(value).trim();
    
    if (/^-?\d+\.?\d*$/.test(str)) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
    
    const cleaned = str
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calcularSaldoDevedorPrice = (valorParcela: number | null, taxaPercent: number, parcelasRestantes: number | null): number | null => {
    if (!valorParcela || !parcelasRestantes || taxaPercent <= 0) return null;
    const i = taxaPercent / 100;
    const n = parcelasRestantes;
    const pmt = valorParcela;
    const pv = pmt * (1 - Math.pow(1 + i, -n)) / i;
    return pv;
  };

  const { data: nomenclaturas } = useQuery<{ id: number; categoria: string; codigo: string; nome: string; ativo: boolean }[]>({
    queryKey: ["/api/nomenclaturas-cached"],
    staleTime: 1000 * 60 * 5,
  });

  const mapNomenclatura = (categoria: "ORGAO" | "TIPO_CONTRATO" | "UPAG" | "UF" | "SIT_FUNC" | "RJUR", codigo: string | null | undefined): string => {
    if (!codigo) return "-";
    if (!nomenclaturas) return codigo;
    const found = nomenclaturas.find(n => n.categoria === categoria && n.codigo === codigo && n.ativo);
    return found ? found.nome : codigo;
  };

  const clientId = consultaData?.pessoaId || consultaData?.vinculo?.pessoaId;

  const { data: clientContacts = [], isLoading: loadingContacts, refetch: refetchContacts } = useQuery<ClientContact[]>({
    queryKey: ["/api/clientes", clientId, "contacts"],
    enabled: !!clientId,
  });

  useEffect(() => {
    setContratosSelecionados(new Set());
    setTaxasContratos({});
  }, [consultaData?.clienteBase?.cpf]);

  const buscarMutation = useMutation({
    mutationFn: async (termo: string) => {
      const termoNormalizado = termo.replace(/\D/g, "");
      if (!termoNormalizado) {
        throw new Error("CPF ou Matrícula inválido");
      }
      // If the term is 11 digits (CPF), check portfolio block before proceeding
      let capturedPortfolioInfo: { vendorName: string; expiresAt: string } | null = null;
      if (termoNormalizado.length === 11) {
        try {
          const checkRes = await apiRequest("GET", `/api/portfolio/check/${termoNormalizado}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.blocked) {
              throw new Error(checkData.message || "Este cliente está vinculado a outro vendedor.");
            }
            if (checkData.portfolioInfo) {
              capturedPortfolioInfo = checkData.portfolioInfo;
            }
          }
        } catch (portfolioErr: any) {
          if (portfolioErr.message && (portfolioErr.message.includes("vinculado") || portfolioErr.message.includes("carteira"))) {
            throw portfolioErr;
          }
          // Non-blocking: ignore network errors in portfolio check
        }
      }
      const res = await apiRequest("POST", "/api/vendas/consulta/buscar", { termo: termoNormalizado });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Cliente não encontrado");
      }
      const data = await res.json();

      // Use portfolioInfo from backend response (covers matrícula searches where pre-check is skipped)
      if (!capturedPortfolioInfo && data.portfolioInfo) {
        capturedPortfolioInfo = data.portfolioInfo;
      }
      
      const transformFolha = (folha: any) => {
        if (!folha) return null;
        return {
          ...folha,
          margem_bruta_5: folha.margemBruta5 ?? folha.margem_bruta_5,
          margem_saldo_5: folha.margemSaldo5 ?? folha.margem_saldo_5,
          margem_utilizada_5: folha.margemUtilizada5 ?? folha.margem_utilizada_5,
          margem_bruta_35: folha.margemBruta35 ?? folha.margem_bruta_35,
          margem_saldo_35: folha.margemSaldo35 ?? folha.margem_saldo_35,
          margem_utilizada_35: folha.margemUtilizada35 ?? folha.margem_utilizada_35,
          margem_bruta_70: folha.margemBruta70 ?? folha.margem_bruta_70,
          margem_saldo_70: folha.margemSaldo70 ?? folha.margem_saldo_70,
          margem_utilizada_70: folha.margemUtilizada70 ?? folha.margem_utilizada_70,
          margem_beneficio_bruta_5: folha.margemBeneficioBruta5 ?? folha.margem_beneficio_bruta_5,
          margem_beneficio_saldo_5: folha.margemBeneficioSaldo5 ?? folha.margem_beneficio_saldo_5,
          margem_beneficio_utilizada_5: folha.margemBeneficioUtilizada5 ?? folha.margem_beneficio_utilizada_5,
          margem_cartao_credito_saldo: folha.margemCartaoCreditoSaldo ?? folha.margem_cartao_credito_saldo,
          margem_cartao_beneficio_saldo: folha.margemCartaoBeneficioSaldo ?? folha.margem_cartao_beneficio_saldo,
        };
      };
      
      const transformContrato = (contrato: any) => {
        if (!contrato) return null;
        return {
          ...contrato,
          valor_parcela: contrato.valorParcela ?? contrato.valor_parcela,
          parcelas_restantes: contrato.parcelasRestantes ?? contrato.parcelas_restantes,
          saldo_devedor: contrato.saldoDevedor ?? contrato.saldo_devedor,
          tipo_contrato: contrato.tipoContrato ?? contrato.tipo_contrato,
          numero_contrato: contrato.numeroContrato ?? contrato.numero_contrato ?? contrato.contrato,
        };
      };
      
      return {
        ...data,
        folhaAtual: transformFolha(data.folhaAtual),
        contratos: (data.contratos || []).map(transformContrato),
        _portfolioInfo: capturedPortfolioInfo,
      };
    },
    onSuccess: (data) => {
      setConsultaData(data);
      setPortfolioInfo(data._portfolioInfo ?? null);
      setSelectedVinculoId(null);
      setContratosSelecionados(new Set());
      setTaxasContratos({});
      toast({ title: "Cliente encontrado", description: data.clienteBase?.nome || "Dados carregados" });
    },
    onError: (error: any) => {
      setConsultaData(null);
      setPortfolioInfo(null);
      setSelectedVinculoId(null);
      toast({ 
        title: "Cliente não localizado", 
        description: error.message || "Verifique os dados informados ou atualize a Base de Clientes.",
        variant: "destructive" 
      });
    },
  });

  // Auto-search when cpf is passed via URL parameter
  useEffect(() => {
    if (cpfFromUrl && !hasAutoSearched.current) {
      hasAutoSearched.current = true;
      setTermoBusca(cpfFromUrl);
      buscarMutation.mutate(cpfFromUrl);
    }
  }, [cpfFromUrl]);

  const trocarVinculoMutation = useMutation({
    mutationFn: async ({ pessoaId, vinculoId }: { pessoaId: number; vinculoId: number }) => {
      const res = await apiRequest("POST", "/api/vendas/consulta/trocar-vinculo", { pessoaId, vinculoId });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao trocar vínculo");
      }
      const data = await res.json();
      const transformFolha = (folha: any) => {
        if (!folha) return null;
        return {
          ...folha,
          margem_bruta_5: folha.margemBruta5 ?? folha.margem_bruta_5,
          margem_saldo_5: folha.margemSaldo5 ?? folha.margem_saldo_5,
          margem_utilizada_5: folha.margemUtilizada5 ?? folha.margem_utilizada_5,
          margem_bruta_35: folha.margemBruta35 ?? folha.margem_bruta_35,
          margem_saldo_35: folha.margemSaldo35 ?? folha.margem_saldo_35,
          margem_utilizada_35: folha.margemUtilizada35 ?? folha.margem_utilizada_35,
          margem_bruta_70: folha.margemBruta70 ?? folha.margem_bruta_70,
          margem_saldo_70: folha.margemSaldo70 ?? folha.margem_saldo_70,
          margem_utilizada_70: folha.margemUtilizada70 ?? folha.margem_utilizada_70,
          margem_beneficio_bruta_5: folha.margemBeneficioBruta5 ?? folha.margem_beneficio_bruta_5,
          margem_beneficio_saldo_5: folha.margemBeneficioSaldo5 ?? folha.margem_beneficio_saldo_5,
          margem_beneficio_utilizada_5: folha.margemBeneficioUtilizada5 ?? folha.margem_beneficio_utilizada_5,
          margem_cartao_credito_saldo: folha.margemCartaoCreditoSaldo ?? folha.margem_cartao_credito_saldo,
          margem_cartao_beneficio_saldo: folha.margemCartaoBeneficioSaldo ?? folha.margem_cartao_beneficio_saldo,
        };
      };
      const transformContrato = (contrato: any) => {
        if (!contrato) return null;
        return {
          ...contrato,
          valor_parcela: contrato.valorParcela ?? contrato.valor_parcela,
          parcelas_restantes: contrato.parcelasRestantes ?? contrato.parcelas_restantes,
          saldo_devedor: contrato.saldoDevedor ?? contrato.saldo_devedor,
          tipo_contrato: contrato.tipoContrato ?? contrato.tipo_contrato,
          numero_contrato: contrato.numeroContrato ?? contrato.numero_contrato ?? contrato.contrato,
        };
      };
      return {
        folhaAtual: transformFolha(data.folhaAtual),
        contratos: (data.contratos || []).map(transformContrato),
        vinculo: data.vinculo,
      };
    },
    onSuccess: (data) => {
      setConsultaData((prev) => prev ? { ...prev, ...data } : prev);
      setContratosSelecionados(new Set());
      setTaxasContratos({});
    },
    onError: () => {
      toast({ title: "Erro ao trocar vínculo", variant: "destructive" });
    },
  });

  // When selectedVinculoId changes, fetch data for that vínculo
  useEffect(() => {
    if (selectedVinculoId && consultaData?.pessoaId) {
      trocarVinculoMutation.mutate({ pessoaId: consultaData.pessoaId, vinculoId: selectedVinculoId });
    }
  }, [selectedVinculoId]);

  const createContactMutation = useMutation({
    mutationFn: async (data: { type: string; value: string; label?: string }) => {
      if (!clientId) throw new Error("Cliente não identificado");
      return apiRequest("POST", `/api/clientes/${clientId}/contacts`, data);
    },
    onSuccess: () => {
      refetchContacts();
      toast({ title: "Contato salvo!" });
      setAddContactOpen(false);
      setNewContact({ tipo: "phone", valor: "", label: "" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar contato", variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; type?: string; label?: string; value?: string }) => {
      return apiRequest("PUT", `/api/clientes/contacts/${id}`, data);
    },
    onSuccess: () => {
      refetchContacts();
      toast({ title: "Contato atualizado!" });
      setEditingContact(null);
      setAddContactOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar contato", variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/clientes/contacts/${id}`);
    },
    onSuccess: () => {
      refetchContacts();
      toast({ title: "Contato removido!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover contato", variant: "destructive" });
    },
  });

  const setPrimaryContactMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/clientes/contacts/${id}/primary`);
    },
    onSuccess: () => {
      refetchContacts();
      toast({ title: "Contato definido como principal!" });
    },
    onError: () => {
      toast({ title: "Erro ao definir como principal", variant: "destructive" });
    },
  });

  // ─── Mutation: salvar dados bancários manualmente ────────────────────────
  const salvarBancarioMutation = useMutation({
    mutationFn: async ({ pessoaId, ...data }: { pessoaId: number; banco: string; agencia: string; conta: string }) => {
      const res = await apiRequest("PATCH", `/api/clientes/pessoa/${pessoaId}/banco`, data);
      if (!res.ok) throw new Error("Erro ao salvar");
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: "Dados bancários salvos!" });
      setEditandoBancario(false);
      // Update local state so fields reflect new values immediately
      setConsultaData((prev) => {
        if (!prev || !prev.clienteBase) return prev;
        return {
          ...prev,
          clienteBase: {
            ...prev.clienteBase,
            banco_nome: vars.banco || prev.clienteBase.banco_nome,
            agencia: vars.agencia || prev.clienteBase.agencia,
            conta: vars.conta || prev.clienteBase.conta,
          },
        };
      });
    },
    onError: () => toast({ title: "Erro ao salvar dados bancários", variant: "destructive" }),
  });

  // ─── Mutation: adicionar contrato manual ──────────────────────────────────
  const adicionarContratoMutation = useMutation({
    mutationFn: async ({ pessoaId, ...data }: {
      pessoaId: number; banco: string; tipo: string; valorParcela: string;
      parcelasRestantes: string; prazoTotal: string; numeroContrato: string;
    }) => {
      const res = await apiRequest("POST", `/api/clientes/pessoa/${pessoaId}/contratos`, data);
      if (!res.ok) throw new Error("Erro ao adicionar");
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "Contrato adicionado!" });
      setAdicionandoContrato(false);
      setContratoForm({ banco: "", tipo: "consignado", valorParcela: "", parcelasRestantes: "", prazoTotal: "", numeroContrato: "" });
      // Append to local contratos list
      if (result?.contrato) {
        const c = result.contrato;
        setConsultaData((prev) => {
          if (!prev) return prev;
          const novoContrato = {
            banco: c.banco,
            tipo_contrato: c.tipo_contrato,
            valor_parcela: c.valor_parcela,
            parcelas_restantes: c.parcelas_restantes,
            prazo_total: c.prazo_total,
            numero_contrato: c.numero_contrato,
            saldo_devedor: null,
          };
          return { ...prev, contratos: [...(prev.contratos || []), novoContrato] };
        });
      }
    },
    onError: () => toast({ title: "Erro ao adicionar contrato", variant: "destructive" }),
  });

  const registrarInteracaoMutation = useMutation({
    mutationFn: async (data: {
      tipoContato: string;
      marcador: string;
      margemValor: string;
      propostaValorEstimado: string;
      observacao: string;
      addToPipeline: boolean;
      agendamentoData?: string;
      agendamentoNota?: string;
    }) => {
      if (!clientId) throw new Error("Cliente não identificado");
      
      const tipoLabel = data.tipoContato === "ligacao" ? "Ligação" : 
                        data.tipoContato === "whatsapp" ? "WhatsApp" : "Outro";
      const marcadorLabel = MARCADOR_LABELS[data.marcador as MarcadorConsulta] || data.marcador;
      const margem = data.margemValor ? `R$ ${parseFloat(data.margemValor).toFixed(2)}` : "-";
      const proposta = data.propostaValorEstimado ? `R$ ${parseFloat(data.propostaValorEstimado).toFixed(2)}` : "-";
      
      const obsFormatada = `[ATENDIMENTO] Tipo: ${tipoLabel} | Marcador: ${marcadorLabel} | Margem: ${margem} | Proposta: ${proposta}${data.observacao ? ` | Obs: ${data.observacao}` : ""}`;
      
      // Save notes
      await apiRequest("POST", `/api/clientes/${clientId}/observacao`, { observacao: obsFormatada });
      
      // Also create lead in pipeline if requested (uses auto "Atendimento Direto" campaign)
      if (data.addToPipeline) {
        try {
          // Use fetch directly to handle errors manually
          const leadRes = await fetch("/api/crm/cliente/criar-lead-direto", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pessoaId: clientId,
              marcador: data.marcador,
              margemValor: data.margemValor,
              propostaValorEstimado: data.propostaValorEstimado,
              observacoes: data.observacao,
              tipoContato: data.tipoContato,
            }),
            credentials: "include",
          });
          
          const leadData = await leadRes.json().catch(() => ({}));
          
          if (!leadRes.ok) {
            // If lead already exists, that's okay - we continue
            if (leadData.message?.includes("já existe")) {
              console.log("Lead já existe no pipeline, continuando...");
            } else {
              console.error("Erro ao criar lead:", leadData);
              throw new Error(leadData.message || "Erro ao criar lead no pipeline");
            }
          } else {
            console.log("Lead criado/atualizado com sucesso:", leadData);
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error("Erro ao adicionar ao pipeline:", error);
          // Don't throw - just show a warning, the interaction was still saved
          throw new Error(error.message || "Erro ao adicionar ao pipeline de vendas");
        }
      }
      
      if (data.marcador === "agendar_retorno" && data.agendamentoData) {
        const nomeCliente = consultaData?.clienteBase?.nome || "";
        const cpfCliente = consultaData?.clienteBase?.cpf || "";
        const tituloAgendamento = `Retorno: ${nomeCliente || cpfCliente || "Cliente"}`;
        await apiRequest("POST", "/api/appointments", {
          kind: "client_followup",
          title: tituloAgendamento,
          scheduledFor: new Date(data.agendamentoData).toISOString(),
          notes: data.agendamentoNota || data.observacao || "",
          clientName: nomeCliente,
          clientCpf: cpfCliente,
          targetType: "pessoa",
          targetId: clientId ? String(clientId) : undefined,
        });
      }

      return { success: true };
    },
    onSuccess: () => {
      const wasAgendamento = interactionFormData.marcador === "agendar_retorno" && agendamentoData;
      toast({ title: wasAgendamento ? "Atendimento registrado e retorno agendado!" : "Atendimento registrado!" });
      setDrawerOpen(false);
      setInteractionFormData({
        tipoContato: "ligacao",
        marcador: "em_atendimento",
        margemValor: "",
        propostaValorEstimado: "",
        observacao: "",
      });
      setAgendamentoData("");
      setAgendamentoNota("");
      setAddToPipeline(true);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Erro ao registrar atendimento", variant: "destructive" });
    },
  });

  const handleBuscar = () => {
    if (!termoBusca.trim()) {
      toast({
        title: "Atenção",
        description: "Digite CPF ou Matrícula",
        variant: "destructive",
      });
      return;
    }
    buscarMutation.mutate(termoBusca.trim());
  };

  const handleSelectPhoneResult = (cpf: string | null, matricula: string | null) => {
    const termo = cpf || matricula;
    if (!termo) {
      toast({ title: "Cliente sem CPF", description: "Não foi possível abrir este cliente.", variant: "destructive" });
      return;
    }
    buscarMutation.mutate(termo);
  };

  const historicoMutation = useMutation({
    mutationFn: async ({ pessoaId, vinculoId }: { pessoaId: number; vinculoId?: number }): Promise<HistoricoFolhaData> => {
      const url = vinculoId 
        ? `/api/clientes/${pessoaId}/historico-folha?vinculoId=${vinculoId}`
        : `/api/clientes/${pessoaId}/historico-folha`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
    onSuccess: (data) => {
      setHistoricoData(data);
    },
    onError: () => {
      toast({ title: "Erro ao carregar histórico", variant: "destructive" });
    },
  });

  const handleOpenHistorico = () => {
    if (!consultaData?.pessoaId) return;
    setSelectedHistoricoItem(null);
    setHistoricoData(null);
    setHistoricoModalOpen(true);
    historicoMutation.mutate({
      pessoaId: consultaData.pessoaId,
      vinculoId: selectedVinculoId ?? consultaData.vinculo?.id,
    });
  };

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast({ title: "Copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleAddContact = () => {
    if (!newContact.valor.trim()) {
      toast({ title: "Informe o valor do contato", variant: "destructive" });
      return;
    }
    if (editingContact) {
      updateContactMutation.mutate({
        id: editingContact.id,
        type: newContact.tipo,
        value: newContact.valor,
        label: newContact.label || undefined,
      });
    } else {
      createContactMutation.mutate({
        type: newContact.tipo,
        value: newContact.valor,
        label: newContact.label || undefined,
      });
    }
  };

  const handleDeleteContact = (contact: ClientContact) => {
    if (window.confirm(`Tem certeza que deseja excluir este contato?\n${contact.value}`)) {
      deleteContactMutation.mutate(contact.id);
    }
  };

  const openEditContact = (contact: ClientContact) => {
    setEditingContact(contact);
    setNewContact({ tipo: contact.type, valor: contact.value, label: contact.label || "" });
    setAddContactOpen(true);
  };

  const openNewContact = (tipo: string = "phone") => {
    setEditingContact(null);
    setNewContact({ tipo, valor: "", label: "" });
    setAddContactOpen(true);
  };

  const handleRegistrarInteracao = () => {
    if (interactionFormData.marcador === "agendar_retorno" && !agendamentoData) {
      toast({ title: "Informe a data/hora do retorno", variant: "destructive" });
      return;
    }
    registrarInteracaoMutation.mutate({
      ...interactionFormData,
      addToPipeline,
      agendamentoData: agendamentoData || undefined,
      agendamentoNota: agendamentoNota || undefined,
    });
  };

  if (!consultaData) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Consulta de Cliente</h1>
          <p className="text-muted-foreground">Busque dados completos de clientes por CPF ou Matrícula</p>
        </div>

        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Buscar Cliente</h2>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Busque por CPF, Matrícula ou Telefone para consultar dados completos, contratos e margens disponíveis.
            </p>
            <div className="w-full max-w-md space-y-4">
              <Tabs value={searchMode} onValueChange={(v) => { setSearchMode(v as "padrao" | "telefone"); setTermoBusca(""); }} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="padrao" data-testid="tab-cpf-matricula">CPF / Matrícula</TabsTrigger>
                  <TabsTrigger value="telefone" data-testid="tab-busca-telefone">Telefone</TabsTrigger>
                </TabsList>
              </Tabs>
              {searchMode === "padrao" ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite CPF ou Matrícula..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                    data-testid="input-termo-busca"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleBuscar}
                    disabled={buscarMutation.isPending}
                    data-testid="button-buscar"
                  >
                    {buscarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Consultar
                  </Button>
                </div>
              ) : (
                <PhoneClientSearch
                  onSelect={(r) => handleSelectPhoneResult(r.cpf, r.matricula)}
                  buttonLabel="Consultar"
                  inputTestId="input-termo-busca"
                  buttonTestId="button-buscar"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const phoneContacts = clientContacts.filter(c => c.type === "phone");
  const emailContacts = clientContacts.filter(c => c.type === "email");

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex-shrink-0 border-b bg-card p-4">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold inline-flex items-center gap-2" data-testid="text-cliente-nome">
                  {consultaData.clienteBase?.nome || "-"}
                  <CopyableField
                    value={consultaData.clienteBase?.nome}
                    displayValue=""
                    testId="button-copy-nome-header"
                    toast={toast}
                    formatOnCopy={formatProperName}
                  />
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
                </h1>
                <Badge variant="secondary" data-testid="badge-modo">Consulta</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">CPF:</span>
                <CopyableField
                  value={consultaData.clienteBase?.cpf}
                  displayValue={formatCPF(consultaData.clienteBase?.cpf)}
                  testId="button-copy-cpf-header"
                  className="font-mono"
                  toast={toast}
                />
                <span className="text-muted-foreground">Matrícula:</span>
                <CopyableField
                  value={consultaData.vinculo?.matricula || consultaData.clienteBase?.matricula}
                  displayValue={consultaData.vinculo?.matricula || consultaData.clienteBase?.matricula || "-"}
                  testId="button-copy-matricula-header"
                  className="font-mono"
                  toast={toast}
                />
              </div>
            </div>
            {consultaData.leadId && (
              <div className="flex items-center mt-1">
                <TagManager
                  leadId={consultaData.leadId}
                  telefones={[
                    consultaData.clienteBase?.telefone1,
                    consultaData.clienteBase?.telefone2,
                    ...(consultaData.higienizacao?.telefones?.map((t: any) => t.telefone) || []),
                  ].filter((t): t is string => !!t)}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setContatosModalOpen(true)}
                data-testid="button-painel-contato"
              >
                <Phone className="h-4 w-4 mr-2" />
                Contatos
                <Badge variant="outline" className="ml-2" data-testid="text-contatos-count">
                  {(() => {
                    const telCount = (consultaData?.higienizacao?.telefones?.length || 0) + phoneContacts.length;
                    const emailCount = (consultaData?.higienizacao?.emails?.length || 0) + emailContacts.length;
                    return `${telCount + emailCount}`;
                  })()}
                </Badge>
              </Button>
              <Button
                onClick={() => setDrawerOpen(true)}
                data-testid="button-registrar-atendimento"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Registrar Atendimento
              </Button>
              <Button 
                variant="outline" 
                onClick={() => { setConsultaData(null); setPortfolioInfo(null); setSelectedVinculoId(null); }}
                data-testid="button-nova-busca"
              >
                <Search className="h-4 w-4 mr-2" />
                Nova Busca
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-4">
        <div className="container mx-auto p-4">
          <div className="space-y-4">

            {/* Portfolio lock info banner - shown to master/coordenação when client is in another vendor's portfolio */}
            {portfolioInfo && (
              <Alert className="border-amber-500/50 bg-amber-50/10" data-testid="alert-portfolio-info">
                <AlertTitle className="text-amber-700 dark:text-amber-400 font-semibold">
                  Na carteira de {portfolioInfo.vendorName} — expira em {new Date(portfolioInfo.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </AlertTitle>
              </Alert>
            )}

            {/* Vínculo selector card - shown only when there are multiple vínculos */}
            {consultaData.tem_multiplos_vinculos && consultaData.vinculos && consultaData.vinculos.length > 1 && (
              <Card className="border-amber-500/50 bg-amber-50/10">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="w-5 h-5 text-amber-500" />
                    Este CPF possui {consultaData.vinculos.length} vínculos/órgãos
                    {trocarVinculoMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    Selecione o vínculo para ver os dados de margem correspondentes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {consultaData.vinculos.map((v) => {
                      const activeId = selectedVinculoId ?? consultaData.vinculo?.id ?? consultaData.vinculos![0].id;
                      const isActive = activeId === v.id;
                      return (
                        <Button
                          key={v.id}
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          disabled={trocarVinculoMutation.isPending}
                          onClick={() => { if (!isActive) setSelectedVinculoId(v.id); }}
                          className="flex flex-col items-start h-auto py-2 px-3 text-left"
                          data-testid={`button-vinculo-${v.id}`}
                        >
                          <span className="font-medium">{mapNomenclatura("ORGAO", v.orgao)}</span>
                          <span className="text-xs opacity-80">
                            Mat: {v.matricula} | {v.sit_func || "SEM INFO"}
                          </span>
                        </Button>
                      );
                    })}
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
                    <ScrollArea className="max-h-96">
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
                    </ScrollArea>
                    <div className="flex justify-end mt-2">
                      <Button variant="outline" onClick={() => setShowObsDialog(false)}>
                        Fechar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const convenioRaw = (consultaData.vinculos?.[0]?.convenio || consultaData.clienteBase?.convenio || "").toUpperCase();
                    const isMaranhao = convenioRaw === "ESTADUAL - MA";
                    // Drizzle retorna camelCase; suportar ambas as formas para segurança
                    const extrasPessoa = (
                      (consultaData.clienteBase?.extras_pessoa as Record<string, string> | null) ||
                      (consultaData.clienteBase?.extrasPessoa as Record<string, string> | null) ||
                      {}
                    );

                    // Nascimento — funciona para timestamp ISO e string DD/MM/YYYY
                    const renderNascimento = () => {
                      const raw = consultaData.clienteBase?.data_nascimento || consultaData.clienteBase?.dataNascimento;
                      if (!raw) return <span>-</span>;
                      // Se vier como string DD/MM/YYYY (estadual via extras ou campo texto)
                      let dataFormatada: string;
                      let idade: number;
                      const matchBR = String(raw).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                      if (matchBR) {
                        const [, d, m, y] = matchBR;
                        dataFormatada = `${d}/${m}/${y}`;
                        const hoje = new Date();
                        idade = hoje.getFullYear() - Number(y);
                        if (hoje.getMonth() + 1 < Number(m) || (hoje.getMonth() + 1 === Number(m) && hoje.getDate() < Number(d))) idade--;
                      } else {
                        const dt = new Date(raw);
                        dataFormatada = dt.toLocaleDateString("pt-BR");
                        const hoje = new Date();
                        idade = hoje.getFullYear() - dt.getFullYear();
                        if (hoje.getMonth() < dt.getMonth() || (hoje.getMonth() === dt.getMonth() && hoje.getDate() < dt.getDate())) idade--;
                      }
                      return <><span>{dataFormatada}</span><Badge variant="secondary">{idade} anos</Badge></>;
                    };

                    if (isMaranhao) {
                      // ─── Layout Maranhão ────────────────────────────────────
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                          {/* Nascimento */}
                          <div className="space-y-1">
                            <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-4 h-4" />Nascimento / Idade</p>
                            <div className="flex items-center gap-2 flex-wrap" data-testid="text-data-nascimento">
                              {renderNascimento()}
                            </div>
                          </div>
                          {/* Situação */}
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Situação Funcional</p>
                            {(() => {
                              // Drizzle retorna camelCase (sitFunc), mas suportamos snake_case também
                              const sf = (
                                consultaData.vinculos?.[0]?.sit_func ||
                                (consultaData.vinculos?.[0] as any)?.sitFunc ||
                                consultaData.clienteBase?.sit_func ||
                                (consultaData.clienteBase as any)?.situacaoFuncionalAtual ||
                                ""
                              ).toUpperCase();
                              const sfAtivo = !sf || sf === "ATIVO" || sf === "ATIVA";
                              return sfAtivo ? (
                                <Badge variant="secondary" className="text-green-700 bg-green-50 border border-green-200" data-testid="text-sit-func">
                                  ✓ {sf || "ATIVO"}
                                </Badge>
                              ) : (
                                <Badge variant="destructive" data-testid="text-sit-func">
                                  ✕ {sf}
                                </Badge>
                              );
                            })()}
                          </div>
                          {/* UF — sempre MA para Maranhão */}
                          <div className="space-y-1">
                            <p className="text-muted-foreground">UF</p>
                            <p data-testid="text-uf" className="font-medium">{consultaData.clienteBase?.uf || "MA"}</p>
                          </div>
                          {/* Tipo de Cargo — vem do extras_pessoa.cargo (importação estadual) */}
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Tipo de Cargo</p>
                            <p data-testid="text-cargo">{extrasPessoa?.cargo || "-"}</p>
                          </div>
                          {/* Órgão */}
                          <div className="space-y-1 md:col-span-2">
                            <p className="text-muted-foreground flex items-center gap-1"><Building className="w-4 h-4" />Órgão</p>
                            <p data-testid="text-orgao">{consultaData.clienteBase?.orgaodesc || consultaData.vinculos?.[0]?.orgao || "-"}</p>
                          </div>
                          {/* Última Base */}
                          <div className="space-y-1">
                            <p className="text-muted-foreground flex items-center gap-1"><Database className="w-4 h-4" />Última Base</p>
                            <Badge variant="secondary" data-testid="text-ultima-base">
                              {consultaData.clienteBase?.base_tag || consultaData.folhaAtual?.competencia || "-"}
                            </Badge>
                          </div>
                        </div>
                      );
                    }

                    // ─── Layout SIAPE / padrão ───────────────────────────────
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-4 h-4" />Nascimento / Idade</p>
                          <div className="flex items-center gap-2 flex-wrap" data-testid="text-data-nascimento">
                            {renderNascimento()}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Situação Funcional</p>
                          <Badge variant="secondary" data-testid="text-sit-func">
                            {mapNomenclatura("SIT_FUNC", consultaData.vinculo?.sitFunc || consultaData.clienteBase?.sit_func || consultaData.clienteBase?.sitFunc)}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Regime Jurídico (REJUR)</p>
                          <p data-testid="text-rjur">
                            {mapNomenclatura("RJUR", consultaData.vinculo?.rjur || consultaData.clienteBase?.rjur || consultaData.clienteBase?.regime_juridico)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">UF</p>
                          <p data-testid="text-uf">
                            {siapeDados?.uf_siape || consultaData.vinculo?.natureza || consultaData.clienteBase?.natureza || "-"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Cargo</p>
                          <p data-testid="text-cargo">{siapeDados?.cargo || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Função</p>
                          <p data-testid="text-funcao">{siapeDados?.funcao || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">UPAG</p>
                          <p data-testid="text-upag">
                            {mapNomenclatura("UPAG", consultaData.vinculo?.upag || consultaData.clienteBase?.upag || consultaData.clienteBase?.undpagadoracod)}
                          </p>
                          {(consultaData.vinculo?.upag || consultaData.clienteBase?.upag || consultaData.clienteBase?.undpagadoracod) && (
                            <p className="text-xs text-muted-foreground">Código: {consultaData.vinculo?.upag || consultaData.clienteBase?.upag || consultaData.clienteBase?.undpagadoracod}</p>
                          )}
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <p className="text-muted-foreground flex items-center gap-1"><Building className="w-4 h-4" />Órgão</p>
                          <p data-testid="text-orgao">
                            {mapNomenclatura("ORGAO", consultaData.vinculo?.orgao || consultaData.clienteBase?.orgao || consultaData.clienteBase?.orgaocod)}
                          </p>
                          {(consultaData.vinculo?.orgao || consultaData.clienteBase?.orgao || consultaData.clienteBase?.orgaocod) && (
                            <p className="text-xs text-muted-foreground">Código: {consultaData.vinculo?.orgao || consultaData.clienteBase?.orgao || consultaData.clienteBase?.orgaocod}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground flex items-center gap-1"><Database className="w-4 h-4" />Última Base</p>
                          <Badge variant="secondary" data-testid="text-ultima-base">
                            {consultaData.clienteBase?.base_tag || consultaData.folhaAtual?.competencia || "-"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* ── Banner: Parcelas Fora de Folha ── */}
              {(() => {
                return null;
              })()}

              {(() => {
                const convenioRawBanco = (consultaData.vinculos?.[0]?.convenio || consultaData.clienteBase?.convenio || "").toUpperCase();
                const isMaranhaoBanco = convenioRawBanco === "ESTADUAL - MA";
                const pessoaIdBanco = consultaData.pessoaId;
                return (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Landmark className="h-4 w-4" />
                      Dados Bancários
                      {isMaranhaoBanco && pessoaIdBanco && !editandoBancario && (
                        <Button
                          variant="ghost" size="sm"
                          className="ml-auto h-7 px-2 text-xs gap-1"
                          onClick={() => {
                            setBancarioForm({
                              banco: consultaData.clienteBase?.banco_nome || consultaData.clienteBase?.bancoNome || "",
                              agencia: consultaData.clienteBase?.agencia || "",
                              conta: consultaData.clienteBase?.conta || "",
                            });
                            setEditandoBancario(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isMaranhaoBanco && editandoBancario ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Banco</Label>
                            <Input
                              placeholder="Ex: Caixa Econômica Federal"
                              value={bancarioForm.banco}
                              onChange={(e) => setBancarioForm(f => ({ ...f, banco: e.target.value }))}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Agência</Label>
                              <Input
                                placeholder="Ex: 0001"
                                value={bancarioForm.agencia}
                                onChange={(e) => setBancarioForm(f => ({ ...f, agencia: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Conta</Label>
                              <Input
                                placeholder="Ex: 12345-6"
                                value={bancarioForm.conta}
                                onChange={(e) => setBancarioForm(f => ({ ...f, conta: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            disabled={salvarBancarioMutation.isPending}
                            onClick={() => {
                              if (!pessoaIdBanco) return;
                              salvarBancarioMutation.mutate({ pessoaId: pessoaIdBanco, ...bancarioForm });
                            }}
                          >
                            {salvarBancarioMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                            Salvar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditandoBancario(false)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Banco</p>
                          <p data-testid="text-banco">
                            <CopyableField
                              value={siapeDados?.banco || consultaData.clienteBase?.banco_codigo || consultaData.clienteBase?.bancoCodigo}
                              displayValue={siapeDados?.banco || consultaData.clienteBase?.banco_nome || consultaData.clienteBase?.bancoNome || consultaData.clienteBase?.banco_codigo || "-"}
                              testId="button-copy-banco"
                              toast={toast}
                            />
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Agência</p>
                          <p data-testid="text-agencia">
                            <CopyableField
                              value={siapeDados?.agencia || consultaData.clienteBase?.agencia}
                              displayValue={siapeDados?.agencia || consultaData.clienteBase?.agencia || "-"}
                              testId="button-copy-agencia"
                              toast={toast}
                            />
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Conta</p>
                          <p data-testid="text-conta">
                            <CopyableField
                              value={siapeDados?.conta || consultaData.clienteBase?.conta}
                              displayValue={siapeDados?.conta || consultaData.clienteBase?.conta || "-"}
                              testId="button-copy-conta"
                              toast={toast}
                            />
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                );
              })()}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Situação de Folha
                  </CardTitle>
                  <CardDescription className="flex items-center gap-3 flex-wrap">
                    <span>
                      {consultaData.folhaAtual?.competencia
                        ? `Competência: ${formatCompetencia(consultaData.folhaAtual.competencia)}`
                        : "Dados de folha não disponíveis"}
                    </span>
                    {consultaData.folhaAtual && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenHistorico}
                        disabled={historicoMutation.isPending}
                        data-testid="button-historico-folha"
                        title="Visualizar todas as competências importadas"
                      >
                        {historicoMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <History className="w-4 h-4 mr-2" />
                        )}
                        Ver Histórico
                      </Button>
                    )}
                    {siapeDados && (
                      <Button
                        variant="default"
                        size="sm"
                        className="font-semibold shadow-sm px-4 gap-1.5"
                        onClick={async () => {
                          if (!clienteCpf) return;
                          try {
                            const r = await fetch(`/api/siape/contracheque/${clienteCpf}`, { credentials: "include" });
                            const json = await r.json();
                            const meses = json.meses || [];
                            if (meses.length === 0) {
                              toast({ title: "Contracheque não encontrado", description: "Nenhum dado SIAPE importado para este CPF.", variant: "destructive" });
                              return;
                            }
                            const url = `/api/siape/contracheque/${clienteCpf}/html?mes=${meses[0].mes_pagamento}`;
                            window.open(url, "_blank");
                          } catch {
                            toast({ title: "Erro", description: "Não foi possível carregar o contracheque.", variant: "destructive" });
                          }
                        }}
                      >
                        📄 Ver Contracheque
                      </Button>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {consultaData.folhaAtual ? (
                    <>
                    {(() => {
                      const convenioRaw = (consultaData.vinculos?.[0]?.convenio || consultaData.clienteBase?.convenio || "").toUpperCase();
                      // Cada governo estadual tem suas próprias regras — detectar por UF
                      const isMaranhao = convenioRaw === "ESTADUAL - MA";
                      // Futuros estados: isGoias = convenioRaw === "ESTADUAL - GO", etc.

                      if (isMaranhao) {
                        // ─── GOVERNO DO MARANHÃO ────────────────────────────────────────
                        const extrasPessoa = consultaData.clienteBase?.extras_pessoa as Record<string, string> | null ?? {};
                        const sitFunc = (consultaData.vinculos?.[0]?.sit_func || consultaData.clienteBase?.sit_func || "").toUpperCase();
                        const isAtivo = !sitFunc || sitFunc === "ATIVO" || sitFunc === "ATIVA";
                        const orgao = consultaData.clienteBase?.orgaodesc;
                        const cargo = extrasPessoa?.cargo;
                        const dataAdmissao = extrasPessoa?.data_admissao;

                        return (
                          <>
                          {/* Bloco de dados funcionais — Maranhão */}
                          <div className="mb-4 p-3 rounded-md border bg-muted/30 space-y-2">
                            {/* Situação — destaque vermelho se INATIVO */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-28 shrink-0">Situação:</span>
                              {isAtivo ? (
                                <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                                  ✓ {sitFunc || "ATIVO"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-sm font-bold text-white bg-red-600 rounded px-2 py-0.5 animate-pulse">
                                  ✕ {sitFunc || "INATIVO"}
                                </span>
                              )}
                            </div>
                            {orgao && (
                              <div className="flex items-start gap-2">
                                <span className="text-sm text-muted-foreground w-28 shrink-0">Órgão:</span>
                                <span className="text-sm font-medium">{orgao}</span>
                              </div>
                            )}
                            {cargo && (
                              <div className="flex items-start gap-2">
                                <span className="text-sm text-muted-foreground w-28 shrink-0">Tipo de Cargo:</span>
                                <span className="text-sm font-medium">{cargo}</span>
                              </div>
                            )}
                            {dataAdmissao && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground w-28 shrink-0">Admissão:</span>
                                <span className="text-sm font-medium">{dataAdmissao}</span>
                              </div>
                            )}
                          </div>

                          {/* Cards de margem — Maranhão */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-muted/50" data-testid="card-margem-35">
                              <CardContent className="p-4">
                                <p className="text-sm font-medium mb-2">35% Crédito Consignado</p>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Bruta:</span>
                                    <span>{formatCurrency(consultaData.folhaAtual.margem_bruta_35)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Utilizada:</span>
                                    <span>{formatCurrency(consultaData.folhaAtual.margem_utilizada_35)}</span>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span>Saldo:</span>
                                    <span className={(Number(consultaData.folhaAtual.margem_saldo_35 ?? 0)) >= 0 ? "text-green-600" : "text-red-600"}>
                                      {formatCurrency(consultaData.folhaAtual.margem_saldo_35)}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="bg-muted/50" data-testid="card-margem-5">
                              <CardContent className="p-4">
                                <p className="text-sm font-medium mb-2">10% Cartão Consignado</p>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Bruta:</span>
                                    <span>{formatCurrency(consultaData.folhaAtual.margem_bruta_5)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Utilizada:</span>
                                    <span>{formatCurrency(consultaData.folhaAtual.margem_utilizada_5)}</span>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span>Saldo:</span>
                                    <span className={(Number(consultaData.folhaAtual.margem_saldo_5 ?? 0)) >= 0 ? "text-green-600" : "text-red-600"}>
                                      {formatCurrency(consultaData.folhaAtual.margem_saldo_5)}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="bg-muted/50" data-testid="card-margem-beneficio-5">
                              <CardContent className="p-4">
                                <p className="text-sm font-medium mb-2">15% Bens e Serviços</p>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Bruta:</span>
                                    <span>{formatCurrency(consultaData.folhaAtual.margem_beneficio_bruta_5)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Utilizada:</span>
                                    <span>{formatCurrency(consultaData.folhaAtual.margem_beneficio_utilizada_5)}</span>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span>Saldo:</span>
                                    <span className={(Number(consultaData.folhaAtual.margem_beneficio_saldo_5 ?? 0)) >= 0 ? "text-green-600" : "text-red-600"}>
                                      {formatCurrency(consultaData.folhaAtual.margem_beneficio_saldo_5)}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="mt-3 pt-3 border-t">
                            <div className="text-center">
                              <p className="text-muted-foreground text-sm">Remuneração Base</p>
                              <p className="font-medium text-green-600">{formatCurrency(consultaData.folhaAtual.salario_bruto)}</p>
                            </div>
                          </div>
                          </>
                        );
                      }

                      // Layout SIAPE padrão: 4 cards (70% / 35% / 5% Cartão / 5% Benefício)
                      return (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card className="bg-muted/50" data-testid="card-margem-70">
                            <CardContent className="p-4">
                              <p className="text-sm font-medium mb-2">Margem 70%</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Bruta:</span>
                                  {/* Margens: fonte única = D8 (extrato de consignação SIAPE) */}
                                  <span>{formatCurrency(consultaData.folhaAtual.margem_bruta_70)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Utilizada:</span>
                                  <span>{formatCurrency(consultaData.folhaAtual.margem_utilizada_70)}</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span>Saldo:</span>
                                  <span className={(Number(consultaData.folhaAtual.margem_saldo_70 ?? 0)) >= 0 ? "text-green-600" : "text-red-600"}>
                                    {formatCurrency(consultaData.folhaAtual.margem_saldo_70)}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-muted/50" data-testid="card-margem-35">
                            <CardContent className="p-4">
                              <p className="text-sm font-medium mb-2">Margem 35%</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Bruta:</span>
                                  <span>{formatCurrency(consultaData.folhaAtual.margem_bruta_35)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Utilizada:</span>
                                  <span>{formatCurrency(consultaData.folhaAtual.margem_utilizada_35)}</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span>Saldo:</span>
                                  <span className={(Number(consultaData.folhaAtual.margem_saldo_35 ?? 0)) >= 0 ? "text-green-600" : "text-red-600"}>
                                    {formatCurrency(consultaData.folhaAtual.margem_saldo_35)}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-muted/50" data-testid="card-margem-5">
                            <CardContent className="p-4">
                              <p className="text-sm font-medium mb-2">Margem 5%</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Bruta:</span>
                                  <span>{formatCurrency(consultaData.folhaAtual.margem_bruta_5)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Utilizada:</span>
                                  <span>{formatCurrency(consultaData.folhaAtual.margem_utilizada_5)}</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span>Saldo:</span>
                                  <span className={(Number(consultaData.folhaAtual.margem_saldo_5 ?? 0)) >= 0 ? "text-green-600" : "text-red-600"}>
                                    {formatCurrency(consultaData.folhaAtual.margem_saldo_5)}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-muted/50" data-testid="card-margem-beneficio-5">
                            <CardContent className="p-4">
                              <p className="text-sm font-medium mb-2">Benefício 5%</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Bruta:</span>
                                  <span>{formatCurrency(consultaData.folhaAtual.margem_beneficio_bruta_5)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Utilizada:</span>
                                  <span>{formatCurrency(consultaData.folhaAtual.margem_beneficio_utilizada_5)}</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span>Saldo:</span>
                                  <span className={(Number(consultaData.folhaAtual.margem_beneficio_saldo_5 ?? 0)) >= 0 ? "text-green-600" : "text-red-600"}>
                                    {formatCurrency(consultaData.folhaAtual.margem_beneficio_saldo_5)}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="mt-4 pt-4 border-t">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <p className="text-muted-foreground">Total Créditos</p>
                              <p className="font-medium text-green-600">{formatCurrency(consultaData.folhaAtual.creditos ?? consultaData.folhaAtual.salario_bruto)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-muted-foreground">Total Débitos</p>
                              <p className="font-medium text-red-600">{formatCurrency(consultaData.folhaAtual.debitos ?? consultaData.folhaAtual.descontos_brutos)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-muted-foreground">Valor Líquido</p>
                              <p className="font-medium">{formatCurrency(consultaData.folhaAtual.liquido ?? consultaData.folhaAtual.salario_liquido)}</p>
                            </div>
                          </div>
                        </div>
                        </>
                      );
                    })()}

                    </>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Nenhum dado de folha disponível para este cliente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {consultaData.folhaAtual && (
                <SimulacaoRapida
                  convenio={consultaData.vinculos?.[0]?.convenio || consultaData.clienteBase?.convenio}
                  saldo35={consultaData.folhaAtual.margem_saldo_35}
                  saldo5beneficio={consultaData.folhaAtual.margem_beneficio_saldo_5}
                  saldo5cartao={consultaData.folhaAtual.margem_saldo_5}
                />
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Contratos
                    {siapeParcelas && siapeParcelas.length > 0 && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">SIAPE</Badge>
                    )}
                    {(() => {
                      const convenioRawC = (consultaData.vinculos?.[0]?.convenio || consultaData.clienteBase?.convenio || "").toUpperCase();
                      const isMaranhaoC = convenioRawC === "ESTADUAL - MA";
                      const pessoaIdC = consultaData.pessoaId;
                      if (!isMaranhaoC || !pessoaIdC) return null;
                      return (
                        <Button
                          variant="outline" size="sm"
                          className="ml-auto h-7 px-2 text-xs gap-1"
                          onClick={() => setAdicionandoContrato(true)}
                        >
                          <Plus className="h-3 w-3" /> Adicionar
                        </Button>
                      );
                    })()}
                  </CardTitle>
                  <CardDescription>
                    {siapeParcelas && siapeParcelas.length > 0
                      ? `${siapeParcelas.length} desconto(s) do contracheque SIAPE`
                      : consultaData.contratos && consultaData.contratos.length > 0
                        ? `${consultaData.contratos.length} contrato(s) encontrado(s)`
                        : "Nenhum contrato registrado"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* ── Tabela SIAPE ─────────────────────────────────────── */}
                  {siapeParcelas && siapeParcelas.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={siapeSelecionados.size === siapeParcelas.length}
                                  onCheckedChange={(checked) => {
                                    setSiapeSelecionados(checked ? new Set(siapeParcelas.map((_, i) => i)) : new Set());
                                  }}
                                />
                              </TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Banco</TableHead>
                              <TableHead className="text-right">Valor Parcela</TableHead>
                              <TableHead className="text-right">Parc. Rest.</TableHead>
                              <TableHead className="text-center w-20">Taxa (%)</TableHead>
                              <TableHead className="text-right">Saldo Devedor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {siapeParcelas.map((p, idx) => {
                              const taxaStr = taxasSiape[String(idx)];
                              const taxa = taxaStr ? parseFloat(taxaStr) : 0;
                              const saldo = taxa > 0 ? calcularSaldoDevedorPrice(p.valor, taxa, p.prazo_restante) : null;
                              return (
                                <TableRow key={idx} className={siapeSelecionados.has(idx) ? "bg-muted/50" : ""}>
                                  <TableCell>
                                    <Checkbox
                                      checked={siapeSelecionados.has(idx)}
                                      onCheckedChange={(checked) => {
                                        const s = new Set(siapeSelecionados);
                                        checked ? s.add(idx) : s.delete(idx);
                                        setSiapeSelecionados(s);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs whitespace-nowrap">{p.tipo || "-"}</Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <CopyableField value={p.banco} displayValue={p.banco || "-"} testId={`copy-banco-siape-${idx}`} toast={toast} />
                                  </TableCell>
                                  <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                                  <TableCell className="text-right">{p.prazo_restante ?? "-"}</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number" step="0.01" min="0" placeholder="0.00"
                                      className="w-16 h-8 text-sm text-center"
                                      value={taxaStr || ""}
                                      onChange={(e) => setTaxasSiape(prev => ({ ...prev, [String(idx)]: e.target.value }))}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {saldo != null ? formatCurrency(saldo) : "-"}
                                      {saldo != null && <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">calc</Badge>}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {siapeSelecionados.size > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 mb-3">
                            <Calculator className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Resumo dos {siapeSelecionados.size} item(s) selecionado(s)</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            {(() => {
                              let somaParcelas = 0, somaSaldo = 0, totalPrazo = 0, comPrazo = 0;
                              siapeSelecionados.forEach((idx) => {
                                const p = siapeParcelas[idx];
                                if (!p) return;
                                const taxa = parseFloat(taxasSiape[String(idx)] || "0") || 0;
                                const saldo = taxa > 0 ? calcularSaldoDevedorPrice(p.valor, taxa, p.prazo_restante) ?? 0 : 0;
                                somaParcelas += p.valor || 0;
                                somaSaldo += saldo;
                                if (p.prazo_restante > 0) { totalPrazo += p.prazo_restante; comPrazo++; }
                              });
                              return (
                                <>
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-muted-foreground text-xs">Soma Parcelas</p>
                                    <p className="font-bold text-lg">{formatCurrency(somaParcelas)}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-muted-foreground text-xs">Soma Saldo Devedor</p>
                                    <p className="font-bold text-lg">{formatCurrency(somaSaldo)}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-muted-foreground text-xs">Prazo Médio</p>
                                    <p className="font-bold text-lg">{comPrazo > 0 ? Math.round(totalPrazo / comPrazo) : 0} meses</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </>

                  /* ── Fallback tabela antiga ──────────────────────────── */
                  ) : consultaData.contratos && consultaData.contratos.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={contratosSelecionados.size === consultaData.contratos.length && consultaData.contratos.length > 0}
                                  onCheckedChange={(checked) => {
                                    setContratosSelecionados(checked ? new Set(consultaData.contratos.map((_, idx) => idx)) : new Set());
                                  }}
                                  data-testid="checkbox-select-all"
                                />
                              </TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Banco</TableHead>
                              <TableHead>Nº Contrato</TableHead>
                              <TableHead className="text-right">Valor Parcela</TableHead>
                              <TableHead className="text-right">Parc. Rest.</TableHead>
                              <TableHead className="text-center w-20">Taxa (%)</TableHead>
                              <TableHead className="text-right">Saldo Devedor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {consultaData.contratos.map((contrato, idx) => {
                              const taxaStr = taxasContratos[idx];
                              const taxa = taxaStr ? parseFloat(taxaStr) : 0;
                              const valorParcela = contrato.valor_parcela || contrato.valorParcela;
                              const parcelasRestantes = contrato.parcelas_restantes || contrato.parcelasRestantes;
                              const saldoCalculado = taxa > 0 ? calcularSaldoDevedorPrice(valorParcela, taxa, parcelasRestantes) : null;
                              const saldoExibir = saldoCalculado !== null ? saldoCalculado : (contrato.saldo_devedor || contrato.saldoDevedor);
                              return (
                                <TableRow key={idx} data-testid={`row-contrato-${idx}`} className={contratosSelecionados.has(idx) ? "bg-muted/50" : ""}>
                                  <TableCell>
                                    <Checkbox
                                      checked={contratosSelecionados.has(idx)}
                                      onCheckedChange={(checked) => {
                                        const s = new Set(contratosSelecionados);
                                        checked ? s.add(idx) : s.delete(idx);
                                        setContratosSelecionados(s);
                                      }}
                                      data-testid={`checkbox-contrato-${idx}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="capitalize text-xs">
                                      {mapNomenclatura("TIPO_CONTRATO", contrato.tipo_contrato || contrato.tipoContrato)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <CopyableField value={contrato.banco || contrato.BANCO_DO_EMPRESTIMO} displayValue={contrato.banco || contrato.BANCO_DO_EMPRESTIMO || "-"} testId={`button-copy-banco-contrato-${idx}`} toast={toast} />
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    <CopyableField value={contrato.numero_contrato || contrato.numeroContrato} displayValue={contrato.numero_contrato || contrato.numeroContrato || "-"} testId={`button-copy-contrato-${idx}`} toast={toast} />
                                  </TableCell>
                                  <TableCell className="text-right">{formatCurrency(valorParcela)}</TableCell>
                                  <TableCell className="text-right">{parcelasRestantes || "-"}</TableCell>
                                  <TableCell>
                                    <Input type="number" step="0.01" min="0" placeholder="0.00" className="w-16 h-8 text-sm text-center"
                                      value={taxasContratos[idx] || ""}
                                      onChange={(e) => setTaxasContratos(prev => ({ ...prev, [idx]: e.target.value }))}
                                      data-testid={`input-taxa-${idx}`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {formatCurrency(saldoExibir)}
                                      {saldoCalculado !== null && <Badge variant="outline" className="text-xs ml-1 text-blue-600 border-blue-300">calc</Badge>}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {contratosSelecionados.size > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 mb-3">
                            <Calculator className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Resumo dos {contratosSelecionados.size} contrato(s) selecionado(s)</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            {(() => {
                              let somaParcelas = 0, somaSaldo = 0, totalParcelasRestantes = 0, contratosComParcelas = 0;
                              contratosSelecionados.forEach((idx) => {
                                const contrato = consultaData.contratos[idx];
                                if (!contrato) return;
                                const valorParcela = parseCurrency(contrato.valor_parcela || contrato.valorParcela);
                                const parcelasRestantes = parseInt(String(contrato.parcelas_restantes || contrato.parcelasRestantes || 0)) || 0;
                                const taxa = parseFloat(taxasContratos[idx] || "0") || 0;
                                const saldoCalculado = taxa > 0 ? calcularSaldoDevedorPrice(valorParcela, taxa, parcelasRestantes) : null;
                                somaParcelas += valorParcela;
                                somaSaldo += saldoCalculado !== null ? saldoCalculado : parseCurrency(contrato.saldo_devedor || contrato.saldoDevedor);
                                if (parcelasRestantes > 0) { totalParcelasRestantes += parcelasRestantes; contratosComParcelas++; }
                              });
                              return (
                                <>
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-muted-foreground text-xs">Soma Parcelas</p>
                                    <p className="font-bold text-lg">{formatCurrency(somaParcelas)}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-muted-foreground text-xs">Soma Saldo Devedor</p>
                                    <p className="font-bold text-lg">{formatCurrency(somaSaldo)}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-muted-foreground text-xs">Prazo Médio</p>
                                    <p className="font-bold text-lg">{contratosComParcelas > 0 ? Math.round(totalParcelasRestantes / contratosComParcelas) : 0} meses</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Nenhum contrato registrado para este cliente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
          </div>
        </div>
      </div>

      {/* ── Dialog: Adicionar Contrato Manual (Maranhão) ─────────────────── */}
      <Dialog open={adicionandoContrato} onOpenChange={(open) => {
        if (!open) { setAdicionandoContrato(false); setContratoForm({ banco: "", tipo: "consignado", valorParcela: "", parcelasRestantes: "", prazoTotal: "", numeroContrato: "" }); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Adicionar Contrato
            </DialogTitle>
            <DialogDescription>
              Informe os dados do contrato manualmente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Banco</Label>
              <Input
                placeholder="Ex: Caixa Econômica Federal"
                value={contratoForm.banco}
                onChange={(e) => setContratoForm(f => ({ ...f, banco: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo de Contrato</Label>
              <Select
                value={contratoForm.tipo}
                onValueChange={(v) => setContratoForm(f => ({ ...f, tipo: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consignado">Consignado 35%</SelectItem>
                  <SelectItem value="cartao">Cartão 10%</SelectItem>
                  <SelectItem value="beneficio">Bens e Serviços 15%</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor Parcela</Label>
                <Input
                  placeholder="Ex: 250,00"
                  value={contratoForm.valorParcela}
                  onChange={(e) => setContratoForm(f => ({ ...f, valorParcela: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Parc. Restantes</Label>
                <Input
                  type="number" min="0"
                  placeholder="Ex: 60"
                  value={contratoForm.parcelasRestantes}
                  onChange={(e) => setContratoForm(f => ({ ...f, parcelasRestantes: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prazo Total</Label>
                <Input
                  type="number" min="0"
                  placeholder="Ex: 84"
                  value={contratoForm.prazoTotal}
                  onChange={(e) => setContratoForm(f => ({ ...f, prazoTotal: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Nº Contrato</Label>
                <Input
                  placeholder="Ex: 00123456 (opcional)"
                  value={contratoForm.numeroContrato}
                  onChange={(e) => setContratoForm(f => ({ ...f, numeroContrato: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAdicionandoContrato(false)}>Cancelar</Button>
            <Button
              disabled={adicionarContratoMutation.isPending}
              onClick={() => {
                const pessoaId = consultaData?.pessoaId;
                if (!pessoaId) return;
                adicionarContratoMutation.mutate({ pessoaId, ...contratoForm });
              }}
            >
              {adicionarContratoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Salvar Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Painel de Contato */}
      <Dialog open={contatosModalOpen} onOpenChange={setContatosModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Painel de Contato
            </DialogTitle>
            <DialogDescription>
              Gerencie telefones, emails e endereço do cliente
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="telefones" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="telefones" className="flex-1" data-testid="tab-telefones">
                <Phone className="h-3 w-3 mr-1" />
                Telefones
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex-1" data-testid="tab-emails">
                <Mail className="h-3 w-3 mr-1" />
                Emails
              </TabsTrigger>
              <TabsTrigger value="endereco" className="flex-1" data-testid="tab-endereco">
                <MapPin className="h-3 w-3 mr-1" />
                Endereço
              </TabsTrigger>
            </TabsList>
            <TabsContent value="telefones" className="p-4 space-y-2">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {consultaData.higienizacao?.telefones && consultaData.higienizacao.telefones.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground font-medium">Base Importada</p>
                      {consultaData.higienizacao.telefones.map((tel, idx) => (
                        <div 
                          key={`hig-tel-${idx}`} 
                          className="flex items-center gap-2 p-2 border rounded text-sm bg-green-50 dark:bg-green-950/30"
                          data-testid={`higienizacao-tel-${idx}`}
                        >
                          {tel.principal && <Star className="h-3 w-3 text-yellow-500 fill-current shrink-0" />}
                          <span className="font-medium flex-1 truncate">{formatPhone(tel.telefone)}</span>
                          <Badge variant="outline" className="text-xs shrink-0">{tel.tipo}</Badge>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleCopyPhone(tel.telefone)}
                            data-testid={`button-copy-hig-tel-${idx}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Separator className="my-2" />
                    </>
                  )}
                  
                  {phoneContacts.length > 0 && (
                    <p className="text-xs text-muted-foreground font-medium">Adicionados</p>
                  )}
                  {phoneContacts.map((contact) => (
                    <div 
                      key={contact.id} 
                      className={`flex items-center gap-2 p-2 border rounded text-sm hover-elevate ${contact.isManual ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30" : ""}`}
                      data-testid={`contact-item-${contact.id}`}
                    >
                      {contact.isManual && (
                        <Badge variant="secondary" className="bg-orange-500 text-white text-[10px] px-1.5 py-0 shrink-0">
                          Hot
                        </Badge>
                      )}
                      <span className="font-medium flex-1 truncate">{formatPhone(contact.value)}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleCopyPhone(contact.value)}
                          data-testid={`button-copy-contact-${contact.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {contact.isManual && (
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEditContact(contact)}
                          data-testid={`button-edit-contact-${contact.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className={`h-7 w-7 ${contact.isPrimary ? "text-yellow-500" : ""}`}
                          onClick={() => setPrimaryContactMutation.mutate(contact.id)}
                          data-testid={`button-primary-contact-${contact.id}`}
                        >
                          <Star className={`h-3 w-3 ${contact.isPrimary ? "fill-current" : ""}`} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {phoneContacts.length === 0 && (!consultaData.higienizacao?.telefones || consultaData.higienizacao.telefones.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Sem telefones cadastrados
                    </div>
                  )}
                </>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => openNewContact("phone")}
                data-testid="button-novo-telefone"
              >
                <Plus className="h-3 w-3 mr-1" />
                Novo Telefone
              </Button>
            </TabsContent>
            <TabsContent value="emails" className="p-4 space-y-2">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {consultaData.higienizacao?.emails && consultaData.higienizacao.emails.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground font-medium">Base Importada</p>
                      {consultaData.higienizacao.emails.map((email, idx) => (
                        <div 
                          key={`email-${idx}`} 
                          className="flex items-center gap-2 p-2 border rounded text-sm bg-blue-50 dark:bg-blue-950/30"
                          data-testid={`email-item-${idx}`}
                        >
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium flex-1 truncate">{email}</span>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleCopyPhone(email)}
                            data-testid={`button-copy-email-${idx}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Separator className="my-2" />
                    </>
                  )}
                  
                  {emailContacts.length > 0 && (
                    <p className="text-xs text-muted-foreground font-medium">Adicionados</p>
                  )}
                  {emailContacts.map((contact) => (
                    <div 
                      key={contact.id} 
                      className="flex items-center gap-2 p-2 border rounded text-sm hover-elevate"
                      data-testid={`email-contact-item-${contact.id}`}
                    >
                      <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium flex-1 truncate">{contact.value}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleCopyPhone(contact.value)}
                          data-testid={`button-copy-email-contact-${contact.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEditContact(contact)}
                          data-testid={`button-edit-email-${contact.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {emailContacts.length === 0 && (!consultaData.higienizacao?.emails || consultaData.higienizacao.emails.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Sem emails cadastrados
                    </div>
                  )}
                </>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => openNewContact("email")}
                data-testid="button-novo-email"
              >
                <Plus className="h-3 w-3 mr-1" />
                Novo Email
              </Button>
            </TabsContent>
            <TabsContent value="endereco" className="p-4 space-y-2">
              {consultaData.higienizacao?.endereco ? (
                <div className="space-y-3 text-sm p-3 border rounded bg-green-50 dark:bg-green-950/30">
                  <p className="text-xs text-muted-foreground font-medium">Base Importada</p>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Logradouro</p>
                    <p>{consultaData.higienizacao.endereco.logradouro || "-"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Número</p>
                      <p>{consultaData.higienizacao.endereco.numero || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Complemento</p>
                      <p>{consultaData.higienizacao.endereco.complemento || "-"}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Bairro</p>
                    <p>{consultaData.higienizacao.endereco.bairro || "-"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Cidade</p>
                      <p>{consultaData.higienizacao.endereco.cidade || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">UF</p>
                      <p>{consultaData.higienizacao.endereco.uf || "-"}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">CEP</p>
                    <p>{consultaData.higienizacao.endereco.cep || "-"}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Sem endereço cadastrado
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>


      {/* Dialog Registrar Interação */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Registrar Interação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm">Tipo de Contato *</Label>
                <Select
                  value={interactionFormData.tipoContato}
                  onValueChange={(v) => setInteractionFormData({ ...interactionFormData, tipoContato: v as TipoContatoConsulta })}
                >
                  <SelectTrigger data-testid="select-tipo-contato-interacao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Marcador do Lead *</Label>
                <Select
                  value={interactionFormData.marcador}
                  onValueChange={(v) => setInteractionFormData({ ...interactionFormData, marcador: v as MarcadorConsulta })}
                >
                  <SelectTrigger data-testid="select-marcador">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARCADORES_CONSULTA.map((marker) => (
                      <SelectItem key={marker} value={marker}>{MARCADOR_LABELS[marker]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {interactionFormData.marcador === "agendar_retorno" && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4 pb-3 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-medium text-primary">Agendar Retorno</Label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-sm">Data e Hora do Retorno *</Label>
                      <Input
                        type="datetime-local"
                        value={agendamentoData}
                        onChange={(e) => setAgendamentoData(e.target.value)}
                        data-testid="input-agendamento-data"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Nota do Agendamento</Label>
                      <Input
                        value={agendamentoNota}
                        onChange={(e) => setAgendamentoNota(e.target.value)}
                        placeholder="Ex: Ligar para confirmar proposta"
                        data-testid="input-agendamento-nota"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm">Valor da Margem (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={interactionFormData.margemValor}
                  onChange={(e) => setInteractionFormData({ ...interactionFormData, margemValor: e.target.value })}
                  placeholder="0,00"
                  data-testid="input-margem-valor"
                />
              </div>
              <div>
                <Label className="text-sm">Proposta Estimada (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={interactionFormData.propostaValorEstimado}
                  onChange={(e) => setInteractionFormData({ ...interactionFormData, propostaValorEstimado: e.target.value })}
                  placeholder="0,00"
                  data-testid="input-proposta-estimada"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Observações</Label>
              <Textarea
                value={interactionFormData.observacao}
                onChange={(e) => setInteractionFormData({ ...interactionFormData, observacao: e.target.value })}
                placeholder="Detalhes do atendimento..."
                rows={3}
                data-testid="textarea-observacao-interacao"
              />
            </div>

            <Separator />

            {/* Add to Pipeline Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Adicionar ao Pipeline de Vendas</Label>
              </div>
              <Switch
                checked={addToPipeline}
                onCheckedChange={setAddToPipeline}
                data-testid="switch-add-pipeline"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDrawerOpen(false)}
              data-testid="button-cancelar-interacao"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrarInteracao}
              disabled={registrarInteracaoMutation.isPending}
              data-testid="button-salvar-interacao"
            >
              {registrarInteracaoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newContact.tipo} onValueChange={(v) => setNewContact(prev => ({ ...prev, tipo: v }))}>
                <SelectTrigger data-testid="select-tipo-contato">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{newContact.tipo === "email" ? "Email" : "Número"}</Label>
              <Input
                placeholder={newContact.tipo === "email" ? "email@exemplo.com" : "(00) 00000-0000"}
                value={newContact.valor}
                onChange={(e) => setNewContact(prev => ({ ...prev, valor: e.target.value }))}
                data-testid="input-valor-contato"
              />
            </div>
            <div className="space-y-2">
              <Label>Rótulo (opcional)</Label>
              <Input
                placeholder="Ex: Pessoal, Trabalho, Recado..."
                value={newContact.label}
                onChange={(e) => setNewContact(prev => ({ ...prev, label: e.target.value }))}
                data-testid="input-label-contato"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddContactOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddContact}
              disabled={createContactMutation.isPending || updateContactMutation.isPending}
              data-testid="button-confirmar-contato"
            >
              {(createContactMutation.isPending || updateContactMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingContact ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historicoModalOpen} onOpenChange={setHistoricoModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Folhas
            </DialogTitle>
            <DialogDescription>
              Visualize todas as competências importadas para este cliente
            </DialogDescription>
          </DialogHeader>
          
          {historicoData ? (
            <div className="space-y-4" data-testid="historico-content">
              <div className="text-sm text-muted-foreground" data-testid="historico-header-info">
                <span className="font-medium" data-testid="text-historico-nome">{historicoData.nome}</span> - CPF: <span data-testid="text-historico-cpf">{formatCPF(historicoData.cpf)}</span>
                <span className="ml-4" data-testid="text-historico-total">({historicoData.total_competencias} competência{historicoData.total_competencias !== 1 ? "s" : ""})</span>
              </div>
              
              {historicoData.historico.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Selecione uma competência:</p>
                    <ScrollArea className="h-[300px] border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Competência</TableHead>
                            <TableHead className="text-right">Saldo 70%</TableHead>
                            <TableHead className="text-right">Saldo 35%</TableHead>
                            <TableHead className="text-right">Saldo 5%</TableHead>
                            <TableHead className="text-right">Benefício 5%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historicoData.historico.map((item) => (
                            <TableRow 
                              key={item.competencia}
                              className={`cursor-pointer ${selectedHistoricoItem?.competencia === item.competencia ? "bg-accent" : ""}`}
                              onClick={() => setSelectedHistoricoItem(item)}
                              data-testid={`row-historico-${item.competencia}`}
                            >
                              <TableCell className="font-medium" data-testid={`text-competencia-${item.competencia}`}>{formatCompetencia(item.competencia)}</TableCell>
                              <TableCell className="text-right">
                                <span className={(item.margem_saldo_70 ?? 0) >= 0 ? "text-green-600" : "text-red-600"} data-testid={`text-saldo70-${item.competencia}`}>
                                  {formatCurrency(item.margem_saldo_70)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={(item.margem_saldo_35 ?? 0) >= 0 ? "text-green-600" : "text-red-600"} data-testid={`text-saldo35-${item.competencia}`}>
                                  {formatCurrency(item.margem_saldo_35)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={(item.margem_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"} data-testid={`text-saldo5-${item.competencia}`}>
                                  {formatCurrency(item.margem_saldo_5)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={(item.margem_beneficio_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"} data-testid={`text-beneficio5-${item.competencia}`}>
                                  {formatCurrency(item.margem_beneficio_saldo_5)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                  
                  <div>
                    {selectedHistoricoItem ? (
                      <Card data-testid="card-historico-detalhes">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base" data-testid="text-competencia-selecionada">
                            Detalhes: {formatCompetencia(selectedHistoricoItem.competencia)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm" data-testid="historico-margens">
                            <div className="space-y-2" data-testid="historico-margem-70">
                              <p className="font-medium">Margem 70%</p>
                              <div className="pl-2 space-y-1 text-muted-foreground">
                                <p data-testid="text-margem70-bruta">Bruta: {formatCurrency(selectedHistoricoItem.margem_bruta_70)}</p>
                                <p data-testid="text-margem70-utilizada">Utilizada: {formatCurrency(selectedHistoricoItem.margem_utilizada_70)}</p>
                                <p className={`font-medium ${(selectedHistoricoItem.margem_saldo_70 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-margem70-saldo">
                                  Saldo: {formatCurrency(selectedHistoricoItem.margem_saldo_70)}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2" data-testid="historico-margem-35">
                              <p className="font-medium">Margem 35%</p>
                              <div className="pl-2 space-y-1 text-muted-foreground">
                                <p data-testid="text-margem35-bruta">Bruta: {formatCurrency(selectedHistoricoItem.margem_bruta_35)}</p>
                                <p data-testid="text-margem35-utilizada">Utilizada: {formatCurrency(selectedHistoricoItem.margem_utilizada_35)}</p>
                                <p className={`font-medium ${(selectedHistoricoItem.margem_saldo_35 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-margem35-saldo">
                                  Saldo: {formatCurrency(selectedHistoricoItem.margem_saldo_35)}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2" data-testid="historico-margem-5">
                              <p className="font-medium">Margem 5%</p>
                              <div className="pl-2 space-y-1 text-muted-foreground">
                                <p data-testid="text-margem5-bruta">Bruta: {formatCurrency(selectedHistoricoItem.margem_bruta_5)}</p>
                                <p data-testid="text-margem5-utilizada">Utilizada: {formatCurrency(selectedHistoricoItem.margem_utilizada_5)}</p>
                                <p className={`font-medium ${(selectedHistoricoItem.margem_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-margem5-saldo">
                                  Saldo: {formatCurrency(selectedHistoricoItem.margem_saldo_5)}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2" data-testid="historico-beneficio-5">
                              <p className="font-medium">Benefício 5%</p>
                              <div className="pl-2 space-y-1 text-muted-foreground">
                                <p data-testid="text-beneficio5-bruta">Bruta: {formatCurrency(selectedHistoricoItem.margem_beneficio_bruta_5)}</p>
                                <p data-testid="text-beneficio5-utilizada">Utilizada: {formatCurrency(selectedHistoricoItem.margem_beneficio_utilizada_5)}</p>
                                <p className={`font-medium ${(selectedHistoricoItem.margem_beneficio_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-beneficio5-saldo">
                                  Saldo: {formatCurrency(selectedHistoricoItem.margem_beneficio_saldo_5)}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div className="grid grid-cols-3 gap-4 text-sm text-center" data-testid="historico-valores">
                            <div>
                              <p className="text-muted-foreground">Créditos</p>
                              <p className="font-medium text-green-600" data-testid="text-historico-creditos">{formatCurrency(selectedHistoricoItem.creditos)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Débitos</p>
                              <p className="font-medium text-red-600" data-testid="text-historico-debitos">{formatCurrency(selectedHistoricoItem.debitos)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Líquido</p>
                              <p className="font-medium" data-testid="text-historico-liquido">{formatCurrency(selectedHistoricoItem.liquido)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground" data-testid="historico-select-prompt">
                        <p data-testid="text-select-competencia">Clique em uma competência para ver detalhes</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="historico-empty">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p data-testid="text-historico-empty">Nenhum histórico de folha encontrado.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8" data-testid="historico-loading">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoricoModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
