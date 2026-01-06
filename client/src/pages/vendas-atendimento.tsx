import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, Play, Phone, MessageSquare, Mail, User, Building, CreditCard, Save, SkipForward, 
  Landmark, Briefcase, Copy, Tag, Plus, X, Check, Calendar, ChevronUp, ChevronDown, MapPin,
  Users, Clock, CheckCircle, ShoppingCart, Trash2, Star, Pencil, Cake, Database, Calculator, Filter
} from "lucide-react";
import { 
  LEAD_STATUS, 
  TIPOS_CONTATO, 
  LEAD_MARKERS, 
  LEAD_MARKER_LABELS, 
  MARKERS_REQUIRING_MOTIVO, 
  TIPOS_CONTATO_LEAD,
  type SalesLeadAssignment, 
  type SalesLead, 
  type SalesLeadEvent, 
  type LeadSchedule, 
  type LeadContact,
  type LeadMarker,
  type LeadInteraction,
} from "@shared/schema";

const TIPOS_CLIENTE_ATENDIMENTO = ["todos", "servidor", "pensionista"] as const;
type TipoClienteAtendimento = typeof TIPOS_CLIENTE_ATENDIMENTO[number];

const TIPO_CLIENTE_LABELS_ATENDIMENTO: Record<TipoClienteAtendimento, string> = {
  todos: "Todos",
  servidor: "Servidor",
  pensionista: "Pensionista",
};

interface HigienizacaoTelefone {
  telefone: string;
  tipo: string;
  principal: boolean | null;
}

interface AtendimentoData {
  assignment: SalesLeadAssignment;
  lead: SalesLead;
  clienteBase: any | null;
  folhaAtual: any | null;
  contratos: any[];
  eventos: SalesLeadEvent[];
  campanha: { id: number; nome: string } | null;
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

function CopyableField({ 
  value, 
  displayValue, 
  testId, 
  className = "",
  toast 
}: { 
  value: string | null | undefined; 
  displayValue: string; 
  testId: string;
  className?: string;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const handleCopy = async () => {
    if (!value || value === "-") return;
    try {
      await navigator.clipboard.writeText(value);
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

function SummaryCards({ resumo, loadingResumo }: { resumo: any; loadingResumo: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-sm font-medium">Leads Pendentes</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-leads-pendentes">
            {loadingResumo ? <Loader2 className="h-5 w-5 animate-spin" /> : resumo?.leadsPendentes ?? 0}
          </div>
          <p className="text-xs text-muted-foreground">Aguardando atendimento</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-sm font-medium">Novos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600" data-testid="text-leads-novos">
            {loadingResumo ? <Loader2 className="h-5 w-5 animate-spin" /> : resumo?.leadsNovos ?? 0}
          </div>
          <p className="text-xs text-muted-foreground">Nunca contatados</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
          <Phone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600" data-testid="text-em-atendimento">
            {loadingResumo ? <Loader2 className="h-5 w-5 animate-spin" /> : resumo?.emAtendimento ?? 0}
          </div>
          <p className="text-xs text-muted-foreground">Em andamento</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-sm font-medium">Vendidos</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600" data-testid="text-vendidos">
            {loadingResumo ? <Loader2 className="h-5 w-5 animate-spin" /> : resumo?.vendidos ?? 0}
          </div>
          <p className="text-xs text-muted-foreground">Fechados com sucesso</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VendasAtendimento() {
  const { toast } = useToast();
  const [atendimentoAtual, setAtendimentoAtual] = useState<AtendimentoData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<LeadContact | null>(null);
  const [newContact, setNewContact] = useState({ tipo: "phone", valor: "" });
  const [contratosSelecionados, setContratosSelecionados] = useState<Set<number>>(new Set());
  const [taxasContratos, setTaxasContratos] = useState<Record<number, string>>({});
  
  const [filtroSituacaoFuncional, setFiltroSituacaoFuncional] = useState<string>("todos");
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<TipoClienteAtendimento>("todos");
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(false);

  // Parse Brazilian currency: handles number, "301.86", "R$ 301,86", "1.530.480,77"
  const parseCurrency = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;
    
    const str = String(value).trim();
    
    // If it's a simple numeric string (e.g., "301.86" from API with dot as decimal)
    if (/^-?\d+\.?\d*$/.test(str)) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
    
    // Handle Brazilian format: "R$ 1.234,56" -> remove R$, remove thousands dots, replace comma with dot
    const cleaned = str
      .replace(/[^\d,.-]/g, '')  // Keep only digits, comma, dot, minus
      .replace(/\./g, '')         // Remove thousand separators (dots)
      .replace(',', '.');         // Replace decimal comma with dot
    
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
  const [interactionFormData, setInteractionFormData] = useState({
    tipoContato: "ligacao" as typeof TIPOS_CONTATO_LEAD[number],
    leadMarker: "EM_ATENDIMENTO" as LeadMarker,
    motivo: "",
    observacao: "",
    retornoEm: "",
    margemValor: "",
    propostaValorEstimado: "",
  });

  useEffect(() => {
    const storedData = sessionStorage.getItem("atendimentoCarregado");
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setAtendimentoAtual(data);
        sessionStorage.removeItem("atendimentoCarregado");
      } catch {
        sessionStorage.removeItem("atendimentoCarregado");
      }
    }
  }, []);

  useEffect(() => {
    setContratosSelecionados(new Set());
    setTaxasContratos({});
  }, [atendimentoAtual?.lead?.id]);

  const { data: resumo, isLoading: loadingResumo } = useQuery<{
    leadsPendentes: number;
    leadsNovos: number;
    emAtendimento: number;
    vendidos: number;
    concluidos: number;
  }>({
    queryKey: ["/api/vendas/atendimento/resumo"],
  });

  const { data: campanhasDisponiveis } = useQuery<{ id: number; nome: string; leadsPendentes: number }[]>({
    queryKey: ["/api/vendas/atendimento/campanhas-disponiveis"],
  });

  // Nomenclaturas para De-Para de códigos - usa endpoint com cache no backend
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

  const mapNomenclatura = (categoria: "ORGAO" | "TIPO_CONTRATO" | "UPAG" | "UF" | "SIT_FUNC" | "RJUR", codigo: string | null | undefined): string => {
    if (!codigo) return "-";
    if (!nomenclaturas) return codigo;
    const found = nomenclaturas.find(n => n.categoria === categoria && n.codigo === codigo && n.ativo);
    return found ? found.nome : codigo;
  };


  const { data: leadContacts = [], isLoading: loadingContacts } = useQuery<LeadContact[]>({
    queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "contacts"],
    enabled: !!atendimentoAtual?.lead?.id,
  });

  // Fetch lead interactions history
  const { data: leadInteractions = [] } = useQuery<LeadInteraction[]>({
    queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "interactions"],
    enabled: !!atendimentoAtual?.lead?.id,
  });

  // Check if the selected marker requires a motivo
  const markerRequiresMotivo = MARKERS_REQUIRING_MOTIVO.includes(interactionFormData.leadMarker);
  
  // Check if marker requires scheduling
  const markerRequiresRetorno = ["AGUARDANDO_RETORNO", "RETORNAR_DEPOIS"].includes(interactionFormData.leadMarker);

  const createContactMutation = useMutation({
    mutationFn: async (data: { type: string; value: string }) => {
      if (!atendimentoAtual?.lead?.id) throw new Error("Nenhum lead ativo");
      return apiRequest("POST", `/api/crm/leads/${atendimentoAtual.lead.id}/contacts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "contacts"] });
      toast({ title: "Contato salvo!" });
      setAddContactOpen(false);
      setNewContact({ tipo: "phone", valor: "" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar contato", variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; type?: string; label?: string; value?: string }) => {
      return apiRequest("PUT", `/api/crm/contacts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "contacts"] });
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
      return apiRequest("DELETE", `/api/crm/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "contacts"] });
      toast({ title: "Contato removido!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover contato", variant: "destructive" });
    },
  });

  const setPrimaryContactMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/crm/contacts/${id}/primary`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "contacts"] });
      toast({ title: "Contato definido como principal!" });
    },
    onError: () => {
      toast({ title: "Erro ao definir como principal", variant: "destructive" });
    },
  });

  // Interaction mutation - register interaction with lead marker
  const registerInteractionMutation = useMutation({
    mutationFn: async (data: typeof interactionFormData) => {
      if (!atendimentoAtual?.lead?.id) throw new Error("Nenhum lead ativo");
      return apiRequest("POST", `/api/crm/leads/${atendimentoAtual.lead.id}/interaction`, {
        tipoContato: data.tipoContato,
        leadMarker: data.leadMarker,
        motivo: data.motivo || null,
        observacao: data.observacao || null,
        retornoEm: data.retornoEm || null,
        margemValor: data.margemValor ? parseFloat(data.margemValor) : null,
        propostaValorEstimado: data.propostaValorEstimado ? parseFloat(data.propostaValorEstimado) : null,
      });
    },
    onSuccess: () => {
      toast({ title: "Interação registrada!" });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "interactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/atendimento/resumo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/queue/next"] });
    },
    onError: () => {
      toast({ title: "Erro ao registrar interação", variant: "destructive" });
    },
  });

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast({ title: "Telefone copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleDeleteContact = (contact: LeadContact) => {
    if (window.confirm(`Tem certeza que deseja excluir este contato?\n${contact.value}`)) {
      deleteContactMutation.mutate(contact.id);
    }
  };

  
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    dataHora: "",
    observacao: "",
  });

  const { data: pendingSchedules = [] } = useQuery<LeadSchedule[]>({
    queryKey: ["/api/vendas/agenda", { status: "pendente" }],
    enabled: !!atendimentoAtual?.assignment?.id,
  });

  const currentLeadSchedule = pendingSchedules.find(
    (s) => s.assignmentId === atendimentoAtual?.assignment?.id
  );

  const agendarMutation = useMutation({
    mutationFn: async (data: { dataHora: string; observacao: string }) => {
      if (!atendimentoAtual) throw new Error("Nenhum atendimento ativo");
      return apiRequest("POST", `/api/vendas/atendimento/${atendimentoAtual.assignment.id}/agendar`, data);
    },
    onSuccess: () => {
      toast({ title: "Retorno agendado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/agenda"] });
      setScheduleDialogOpen(false);
      setScheduleData({ dataHora: "", observacao: "" });
    },
    onError: () => {
      toast({ title: "Erro ao agendar retorno", variant: "destructive" });
    },
  });

  const handleAgendar = () => {
    if (!scheduleData.dataHora) {
      toast({ title: "Selecione a data e hora", variant: "destructive" });
      return;
    }
    agendarMutation.mutate(scheduleData);
  };

  const proximoMutation = useMutation({
    mutationFn: async (params: { campaignId?: number; situacaoFuncional?: string; tipoCliente?: string } = {}) => {
      const body: any = {};
      if (params.campaignId !== undefined) body.campaignId = params.campaignId;
      if (params.situacaoFuncional && params.situacaoFuncional !== "todos") {
        body.situacaoFuncional = params.situacaoFuncional;
      }
      if (params.tipoCliente && params.tipoCliente !== "todos") {
        body.tipoCliente = params.tipoCliente;
      }
      const res = await apiRequest("POST", "/api/vendas/atendimento/proximo", body);
      return res.json() as Promise<AtendimentoData>;
    },
    onSuccess: (data) => {
      setAtendimentoAtual(data);
      setInteractionFormData({ tipoContato: "ligacao", leadMarker: "EM_ATENDIMENTO", motivo: "", observacao: "", retornoEm: "", margemValor: "", propostaValorEstimado: "" });
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/atendimento/resumo"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: any) => {
      if (error?.message?.includes("404") || error?.cause?.status === 404) {
        toast({ title: "Não há mais leads na fila", description: "Todos os leads foram atendidos!" });
      } else {
        toast({ title: "Erro ao buscar próximo lead", variant: "destructive" });
      }
    },
  });

  const handleRegistrarInteracao = () => {
    if (markerRequiresMotivo && !interactionFormData.motivo.trim()) {
      toast({ title: "Informe o motivo", description: "Este marcador exige uma justificativa", variant: "destructive" });
      return;
    }
    if (markerRequiresRetorno && !interactionFormData.retornoEm) {
      toast({ title: "Agende o retorno", description: "Este marcador exige uma data de retorno", variant: "destructive" });
      return;
    }
    if (!interactionFormData.margemValor || parseFloat(interactionFormData.margemValor) <= 0) {
      toast({ title: "Informe a margem", description: "O valor da margem é obrigatório", variant: "destructive" });
      return;
    }
    if (!interactionFormData.propostaValorEstimado || parseFloat(interactionFormData.propostaValorEstimado) <= 0) {
      toast({ title: "Informe a proposta", description: "O valor da proposta estimada é obrigatório", variant: "destructive" });
      return;
    }
    registerInteractionMutation.mutate(interactionFormData);
  };

  const handleRegistrarEProximo = async () => {
    if (markerRequiresMotivo && !interactionFormData.motivo.trim()) {
      toast({ title: "Informe o motivo", description: "Este marcador exige uma justificativa", variant: "destructive" });
      return;
    }
    if (markerRequiresRetorno && !interactionFormData.retornoEm) {
      toast({ title: "Agende o retorno", description: "Este marcador exige uma data de retorno", variant: "destructive" });
      return;
    }
    if (!interactionFormData.margemValor || parseFloat(interactionFormData.margemValor) <= 0) {
      toast({ title: "Informe a margem", description: "O valor da margem é obrigatório", variant: "destructive" });
      return;
    }
    if (!interactionFormData.propostaValorEstimado || parseFloat(interactionFormData.propostaValorEstimado) <= 0) {
      toast({ title: "Informe a proposta", description: "O valor da proposta estimada é obrigatório", variant: "destructive" });
      return;
    }
    try {
      await registerInteractionMutation.mutateAsync(interactionFormData);
      setDrawerOpen(false);
      proximoMutation.mutate({ situacaoFuncional: filtroSituacaoFuncional, tipoCliente: filtroTipoCliente });
    } catch {
      // Error already handled by mutation
    }
  };

  const handleAddContact = () => {
    if (!newContact.valor.trim()) {
      toast({ title: "Informe o telefone", variant: "destructive" });
      return;
    }
    if (editingContact) {
      updateContactMutation.mutate({
        id: editingContact.id,
        type: newContact.tipo,
        value: newContact.valor,
      });
    } else {
      createContactMutation.mutate({
        type: newContact.tipo,
        value: newContact.valor,
      });
    }
  };

  const openEditContact = (contact: LeadContact) => {
    setEditingContact(contact);
    setNewContact({ tipo: contact.type, valor: contact.value });
    setAddContactOpen(true);
  };

  const openNewContact = () => {
    setEditingContact(null);
    setNewContact({ tipo: "phone", valor: "" });
    setAddContactOpen(true);
  };

  // Tela sem lead carregado
  if (!atendimentoAtual) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Atendimento</h1>
          <p className="text-muted-foreground">Atenda leads e registre seus contatos</p>
        </div>

        <SummaryCards resumo={resumo} loadingResumo={loadingResumo} />

        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Play className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Pronto para atender?</h2>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Clique no botão abaixo para carregar o próximo lead da fila e iniciar o atendimento.
            </p>

            <div className="w-full max-w-lg mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMostrarFiltrosAvancados(!mostrarFiltrosAvancados)}
                className="w-full justify-center text-muted-foreground mb-2"
                data-testid="button-toggle-filtros-atendimento"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros Avançados
                {mostrarFiltrosAvancados ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
              
              {mostrarFiltrosAvancados && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Situação Funcional</Label>
                    <Select
                      value={filtroSituacaoFuncional}
                      onValueChange={setFiltroSituacaoFuncional}
                    >
                      <SelectTrigger data-testid="select-situacao-funcional-atendimento">
                        <SelectValue placeholder="Todas as situações" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas as Situações</SelectItem>
                        {situacoesFuncionais.map((sit) => (
                          <SelectItem key={sit.codigo} value={sit.codigo}>
                            {sit.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo de Cliente</Label>
                    <Select
                      value={filtroTipoCliente}
                      onValueChange={(v) => setFiltroTipoCliente(v as TipoClienteAtendimento)}
                    >
                      <SelectTrigger data-testid="select-tipo-cliente-atendimento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_CLIENTE_ATENDIMENTO.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>
                            {TIPO_CLIENTE_LABELS_ATENDIMENTO[tipo]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {campanhasDisponiveis && campanhasDisponiveis.length > 0 ? (
              <div className="space-y-4 w-full max-w-md">
                <div className="grid gap-2">
                  {campanhasDisponiveis.map((camp) => (
                    <Button
                      key={camp.id}
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => proximoMutation.mutate({ campaignId: camp.id, situacaoFuncional: filtroSituacaoFuncional, tipoCliente: filtroTipoCliente })}
                      disabled={proximoMutation.isPending || camp.leadsPendentes === 0}
                      data-testid={`button-campanha-${camp.id}`}
                    >
                      <span>{camp.nome}</span>
                      <Badge variant="secondary">{camp.leadsPendentes} pendentes</Badge>
                    </Button>
                  ))}
                </div>
                <Separator />
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => proximoMutation.mutate({ situacaoFuncional: filtroSituacaoFuncional, tipoCliente: filtroTipoCliente })}
                  disabled={proximoMutation.isPending}
                  data-testid="button-proximo-qualquer"
                >
                  {proximoMutation.isPending && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                  <Play className="h-5 w-5 mr-2" />
                  Iniciar / Próximo Cliente
                </Button>
              </div>
            ) : (
              <Button
                size="lg"
                onClick={() => proximoMutation.mutate({ situacaoFuncional: filtroSituacaoFuncional, tipoCliente: filtroTipoCliente })}
                disabled={proximoMutation.isPending}
                data-testid="button-iniciar"
              >
                {proximoMutation.isPending && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                <Play className="h-5 w-5 mr-2" />
                Iniciar / Próximo Cliente
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela com lead carregado - Layout em 3 faixas
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* CABEÇALHO DO CLIENTE */}
      <div className="flex-shrink-0 border-b bg-card p-4">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold" data-testid="text-cliente-nome">
                  {atendimentoAtual.clienteBase?.nome || atendimentoAtual.lead.nome}
                </h1>
                <Badge variant="default" data-testid="badge-status">Em Atendimento</Badge>
                {atendimentoAtual.campanha && (
                  <Badge variant="outline" data-testid="badge-campanha">
                    {atendimentoAtual.campanha.nome}
                  </Badge>
                )}
                {/* Lead marker badge */}
                {atendimentoAtual.lead.leadMarker && atendimentoAtual.lead.leadMarker !== "NOVO" && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-lead-marker">
                    {LEAD_MARKER_LABELS[atendimentoAtual.lead.leadMarker as LeadMarker] || atendimentoAtual.lead.leadMarker}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">CPF:</span>
                <CopyableField
                  value={atendimentoAtual.clienteBase?.cpf || atendimentoAtual.lead.cpf}
                  displayValue={formatCPF(atendimentoAtual.clienteBase?.cpf || atendimentoAtual.lead.cpf)}
                  testId="button-copy-cpf-header"
                  className="font-mono"
                  toast={toast}
                />
                <span className="text-muted-foreground">Matrícula:</span>
                <CopyableField
                  value={atendimentoAtual.clienteBase?.matricula}
                  displayValue={atendimentoAtual.clienteBase?.matricula || "-"}
                  testId="button-copy-matricula-header"
                  className="font-mono"
                  toast={toast}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CORPO - 2 COLUNAS */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="container mx-auto p-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* COLUNA ESQUERDA - Dados do Cliente */}
            <div className="lg:col-span-2 space-y-4">
              {/* Dados do Cliente - Exatamente como Consulta Cliente */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">CPF</p>
                      <p className="font-mono" data-testid="text-cpf">
                        <CopyableField
                          value={atendimentoAtual.clienteBase?.cpf || atendimentoAtual.lead.cpf}
                          displayValue={formatCPF(atendimentoAtual.clienteBase?.cpf || atendimentoAtual.lead.cpf)}
                          testId="button-copy-cpf"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Matrícula</p>
                      <p className="font-mono" data-testid="text-matricula">
                        <CopyableField
                          value={atendimentoAtual.clienteBase?.matricula}
                          displayValue={atendimentoAtual.clienteBase?.matricula || "-"}
                          testId="button-copy-matricula"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Nome</p>
                      <p className="font-medium" data-testid="text-nome">
                        {atendimentoAtual.clienteBase?.nome || atendimentoAtual.lead.nome}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Nascimento / Idade
                      </p>
                      <div className="flex items-center gap-2 flex-wrap" data-testid="text-data-nascimento">
                        {(() => {
                          const dataNasc = atendimentoAtual.clienteBase?.data_nascimento || atendimentoAtual.clienteBase?.dataNascimento;
                          if (!dataNasc) return <span>-</span>;
                          const dataFormatada = new Date(dataNasc).toLocaleDateString("pt-BR");
                          const hoje = new Date();
                          const nascimento = new Date(dataNasc);
                          let idade = hoje.getFullYear() - nascimento.getFullYear();
                          const mesAtual = hoje.getMonth();
                          const mesNasc = nascimento.getMonth();
                          if (mesAtual < mesNasc || (mesAtual === mesNasc && hoje.getDate() < nascimento.getDate())) {
                            idade--;
                          }
                          const isAniversarianteDoMes = mesAtual === mesNasc;
                          return (
                            <>
                              <span>{dataFormatada}</span>
                              <Badge variant="secondary">{idade} anos</Badge>
                              {isAniversarianteDoMes && (
                                <Badge className="bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" data-testid="badge-aniversariante">
                                  <Cake className="w-3 h-3 mr-1" />
                                  Aniversariante
                                </Badge>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Situação Funcional</p>
                      <Badge variant="secondary" data-testid="text-sit-func">
                        {mapNomenclatura("SIT_FUNC", atendimentoAtual.vinculo?.sitFunc || atendimentoAtual.clienteBase?.sit_func || atendimentoAtual.clienteBase?.sitFunc)}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Regime Jurídico (REJUR)</p>
                      <p data-testid="text-rjur">
                        {mapNomenclatura("RJUR", atendimentoAtual.vinculo?.rjur || atendimentoAtual.clienteBase?.rjur || atendimentoAtual.clienteBase?.regime_juridico)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Natureza</p>
                      <p data-testid="text-natureza">
                        {atendimentoAtual.vinculo?.natureza || atendimentoAtual.clienteBase?.natureza || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">UPAG</p>
                      <p data-testid="text-upag">
                        {mapNomenclatura("UPAG", atendimentoAtual.vinculo?.upag || atendimentoAtual.clienteBase?.upag || atendimentoAtual.clienteBase?.undpagadoracod)}
                      </p>
                      {(atendimentoAtual.vinculo?.upag || atendimentoAtual.clienteBase?.upag || atendimentoAtual.clienteBase?.undpagadoracod) && (
                        <p className="text-xs text-muted-foreground">Código: {atendimentoAtual.vinculo?.upag || atendimentoAtual.clienteBase?.upag || atendimentoAtual.clienteBase?.undpagadoracod}</p>
                      )}
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Building className="w-4 h-4" />
                        Órgão
                      </p>
                      <p data-testid="text-orgao">
                        {mapNomenclatura("ORGAO", atendimentoAtual.vinculo?.orgao || atendimentoAtual.clienteBase?.orgao || atendimentoAtual.clienteBase?.orgaocod)}
                      </p>
                      {(atendimentoAtual.vinculo?.orgao || atendimentoAtual.clienteBase?.orgao || atendimentoAtual.clienteBase?.orgaocod) && (
                        <p className="text-xs text-muted-foreground">Código: {atendimentoAtual.vinculo?.orgao || atendimentoAtual.clienteBase?.orgao || atendimentoAtual.clienteBase?.orgaocod}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Convênio</p>
                      <Badge variant="outline" data-testid="text-convenio">
                        {atendimentoAtual.clienteBase?.convenio || "-"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Database className="w-4 h-4" />
                        Última Base
                      </p>
                      <Badge variant="secondary" data-testid="text-ultima-base">
                        {atendimentoAtual.clienteBase?.base_tag || atendimentoAtual.folhaAtual?.competencia || "-"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Dados Bancários */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Landmark className="h-4 w-4" />
                    Dados Bancários
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Banco</p>
                      <p data-testid="text-banco">
                        <CopyableField
                          value={atendimentoAtual.clienteBase?.banco_codigo || atendimentoAtual.clienteBase?.bancoCodigo}
                          displayValue={atendimentoAtual.clienteBase?.banco_nome || atendimentoAtual.clienteBase?.bancoNome || atendimentoAtual.clienteBase?.banco_codigo || atendimentoAtual.clienteBase?.bancoCodigo || "-"}
                          testId="button-copy-banco"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Agência</p>
                      <p data-testid="text-agencia">
                        <CopyableField
                          value={atendimentoAtual.clienteBase?.agencia}
                          displayValue={atendimentoAtual.clienteBase?.agencia || "-"}
                          testId="button-copy-agencia"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Conta</p>
                      <p data-testid="text-conta">
                        <CopyableField
                          value={atendimentoAtual.clienteBase?.conta}
                          displayValue={atendimentoAtual.clienteBase?.conta || "-"}
                          testId="button-copy-conta"
                          toast={toast}
                        />
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Situação de Folha - 4 Cards com Bruta/Utilizada/Saldo */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Situação de Folha
                  </CardTitle>
                  <CardDescription>
                    {atendimentoAtual.folhaAtual?.competencia
                      ? `Competência: ${atendimentoAtual.folhaAtual.competencia}`
                      : "Dados de folha não disponíveis"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {atendimentoAtual.folhaAtual ? (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Margem 70% */}
                      <Card className="bg-muted/50" data-testid="card-margem-70">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium mb-2">Margem 70%</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bruta:</span>
                              <span>{formatCurrency(atendimentoAtual.folhaAtual.margem_bruta_70 ?? atendimentoAtual.folhaAtual.margemBruta70)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Utilizada:</span>
                              <span>{formatCurrency(atendimentoAtual.folhaAtual.margem_utilizada_70 ?? atendimentoAtual.folhaAtual.margemUtilizada70)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Saldo:</span>
                              <span className={(atendimentoAtual.folhaAtual.margem_saldo_70 ?? atendimentoAtual.folhaAtual.margemSaldo70 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                {formatCurrency(atendimentoAtual.folhaAtual.margem_saldo_70 ?? atendimentoAtual.folhaAtual.margemSaldo70)}
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
                              <span>{formatCurrency(atendimentoAtual.folhaAtual.margem_bruta_35 ?? atendimentoAtual.folhaAtual.margemBruta35)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Utilizada:</span>
                              <span>{formatCurrency(atendimentoAtual.folhaAtual.margem_utilizada_35 ?? atendimentoAtual.folhaAtual.margemUtilizada35)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Saldo:</span>
                              <span className={(atendimentoAtual.folhaAtual.margem_saldo_35 ?? atendimentoAtual.folhaAtual.margemSaldo35 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                {formatCurrency(atendimentoAtual.folhaAtual.margem_saldo_35 ?? atendimentoAtual.folhaAtual.margemSaldo35)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Margem 5% - Cartão Crédito */}
                      <Card className="bg-muted/50" data-testid="card-margem-5">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium mb-2">Margem 5%</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bruta:</span>
                              <span>{formatCurrency(atendimentoAtual.folhaAtual.margem_bruta_5)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Utilizada:</span>
                              <span>{formatCurrency(atendimentoAtual.folhaAtual.margem_utilizada_5)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Saldo:</span>
                              <span className={(atendimentoAtual.folhaAtual.margem_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                {formatCurrency(atendimentoAtual.folhaAtual.margem_saldo_5)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Margem Benefício 5% */}
                      <Card className="bg-muted/50" data-testid="card-margem-beneficio-5">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium mb-2">Benefício 5%</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bruta:</span>
                              <span>{formatCurrency(atendimentoAtual.folhaAtual.margem_beneficio_bruta_5)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Utilizada:</span>
                              <span>{formatCurrency(atendimentoAtual.folhaAtual.margem_beneficio_utilizada_5)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Saldo:</span>
                              <span className={(atendimentoAtual.folhaAtual.margem_beneficio_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                {formatCurrency(atendimentoAtual.folhaAtual.margem_beneficio_saldo_5)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Totais: Créditos, Débitos, Líquido */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-muted-foreground">Total Créditos</p>
                          <p className="font-medium text-green-600">{formatCurrency(atendimentoAtual.folhaAtual.creditos ?? atendimentoAtual.folhaAtual.salario_bruto)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Total Débitos</p>
                          <p className="font-medium text-red-600">{formatCurrency(atendimentoAtual.folhaAtual.debitos ?? atendimentoAtual.folhaAtual.descontos_brutos)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Valor Líquido</p>
                          <p className="font-medium">{formatCurrency(atendimentoAtual.folhaAtual.liquido ?? atendimentoAtual.folhaAtual.salario_liquido)}</p>
                        </div>
                      </div>
                    </div>
                    </>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Nenhum dado de folha disponível para este cliente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contratos - Tabela Completa sem resumo */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Contratos
                  </CardTitle>
                  <CardDescription>
                    {atendimentoAtual.contratos && atendimentoAtual.contratos.length > 0
                      ? `${atendimentoAtual.contratos.length} contrato(s) encontrado(s)`
                      : "Nenhum contrato registrado"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {atendimentoAtual.contratos && atendimentoAtual.contratos.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={contratosSelecionados.size === atendimentoAtual.contratos.length && atendimentoAtual.contratos.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setContratosSelecionados(new Set(atendimentoAtual.contratos.map((_, idx) => idx)));
                                  } else {
                                    setContratosSelecionados(new Set());
                                  }
                                }}
                                data-testid="checkbox-select-all"
                              />
                            </TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Origem do Desconto</TableHead>
                            <TableHead>Nº Contrato</TableHead>
                            <TableHead className="text-right">Valor Parcela</TableHead>
                            <TableHead className="text-center w-20">Taxa (%)</TableHead>
                            <TableHead className="text-right">Saldo Devedor</TableHead>
                            <TableHead className="text-right">Parc. Rest.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {atendimentoAtual.contratos.map((contrato, idx) => {
                            const taxaStr = taxasContratos[idx];
                            const taxa = taxaStr ? parseFloat(taxaStr) : 0;
                            const valorParcela = contrato.valor_parcela || contrato.valorParcela;
                            const parcelasRestantes = contrato.parcelas_restantes || contrato.parcelasRestantes;
                            const saldoCalculado = taxa > 0 
                              ? calcularSaldoDevedorPrice(valorParcela, taxa, parcelasRestantes)
                              : null;
                            const saldoExibir = saldoCalculado !== null ? saldoCalculado : (contrato.saldo_devedor || contrato.saldoDevedor);
                            const isCalculado = saldoCalculado !== null;
                            return (
                              <TableRow key={idx} data-testid={`row-contrato-${idx}`} className={contratosSelecionados.has(idx) ? "bg-muted/50" : ""}>
                                <TableCell>
                                  <Checkbox
                                    checked={contratosSelecionados.has(idx)}
                                    onCheckedChange={(checked) => {
                                      const newSet = new Set(contratosSelecionados);
                                      if (checked) {
                                        newSet.add(idx);
                                      } else {
                                        newSet.delete(idx);
                                      }
                                      setContratosSelecionados(newSet);
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
                                  <CopyableField
                                    value={contrato.banco || contrato.BANCO_DO_EMPRESTIMO}
                                    displayValue={contrato.banco || contrato.BANCO_DO_EMPRESTIMO || "-"}
                                    testId={`button-copy-banco-contrato-${idx}`}
                                    toast={toast}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  <CopyableField
                                    value={contrato.numero_contrato || contrato.numeroContrato}
                                    displayValue={contrato.numero_contrato || contrato.numeroContrato || "-"}
                                    testId={`button-copy-contrato-${idx}`}
                                    toast={toast}
                                  />
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(valorParcela)}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="w-16 h-8 text-sm text-center"
                                    value={taxasContratos[idx] || ""}
                                    onChange={(e) => setTaxasContratos(prev => ({
                                      ...prev,
                                      [idx]: e.target.value
                                    }))}
                                    data-testid={`input-taxa-${idx}`}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {formatCurrency(saldoExibir)}
                                    {isCalculado && (
                                      <Badge variant="outline" className="text-xs ml-1 text-blue-600 border-blue-300">
                                        calc
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{parcelasRestantes || "-"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>

                      {/* Resumo dos contratos selecionados */}
                      {contratosSelecionados.size > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 mb-3">
                            <Calculator className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Resumo dos {contratosSelecionados.size} contrato(s) selecionado(s)</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            {(() => {
                              let somaParcelas = 0;
                              let somaSaldo = 0;
                              let totalParcelasRestantes = 0;
                              let contratosComParcelas = 0;
                              contratosSelecionados.forEach((idx) => {
                                const contrato = atendimentoAtual.contratos[idx];
                                if (!contrato) return;
                                const valorParcela = parseCurrency(contrato.valor_parcela || contrato.valorParcela);
                                const parcelasRestantes = parseInt(String(contrato.parcelas_restantes || contrato.parcelasRestantes || 0)) || 0;
                                const taxaStr = taxasContratos[idx];
                                const taxa = taxaStr ? parseFloat(taxaStr) : 0;
                                const saldoCalculado = taxa > 0 
                                  ? calcularSaldoDevedorPrice(valorParcela, taxa, parcelasRestantes)
                                  : null;
                                const saldoContrato = saldoCalculado !== null ? saldoCalculado : parseCurrency(contrato.saldo_devedor || contrato.saldoDevedor);
                                somaParcelas += valorParcela;
                                somaSaldo += saldoContrato;
                                if (parcelasRestantes > 0) {
                                  totalParcelasRestantes += parcelasRestantes;
                                  contratosComParcelas++;
                                }
                              });
                              const prazoMedio = contratosComParcelas > 0 ? Math.round(totalParcelasRestantes / contratosComParcelas) : 0;
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
                                    <p className="font-bold text-lg">{prazoMedio} meses</p>
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

              {/* Histórico de Contatos */}
              {atendimentoAtual.eventos && atendimentoAtual.eventos.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Histórico de Contatos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {atendimentoAtual.eventos.slice(0, 5).map((evento, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2 border rounded-lg text-sm">
                          <div className="p-1.5 bg-muted rounded">
                            {evento.tipo === "ligacao" && <Phone className="h-3 w-3" />}
                            {evento.tipo === "whatsapp" && <MessageSquare className="h-3 w-3" />}
                            {evento.tipo === "email" && <Mail className="h-3 w-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{TIPOS_CONTATO[evento.tipo as keyof typeof TIPOS_CONTATO] || evento.tipo}</span>
                              {evento.resultado && <Badge variant="outline" className="text-xs">{evento.resultado}</Badge>}
                            </div>
                            {evento.observacao && <p className="text-muted-foreground truncate">{evento.observacao}</p>}
                            <p className="text-xs text-muted-foreground">
                              {new Date(evento.createdAt).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* COLUNA DIREITA - Painel de Contato */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Painel de Contato</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Tabs defaultValue="telefones" className="w-full">
                    <TabsList className="w-full rounded-none border-b">
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
                          {/* Telefones da higienização (dados importados) */}
                          {atendimentoAtual.higienizacao?.telefones && atendimentoAtual.higienizacao.telefones.length > 0 && (
                            <>
                              <p className="text-xs text-muted-foreground font-medium">Base Importada</p>
                              {atendimentoAtual.higienizacao.telefones.map((tel, idx) => (
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
                          
                          {/* Contatos adicionados pelo corretor */}
                          {leadContacts.length > 0 && (
                            <p className="text-xs text-muted-foreground font-medium">Adicionados</p>
                          )}
                          {leadContacts.map((contact) => (
                              <div 
                                key={contact.id} 
                                className="flex items-center gap-2 p-2 border rounded text-sm hover-elevate"
                                data-testid={`contact-item-${contact.id}`}
                              >
                                <span className="font-medium flex-1 truncate">
                                  {contact.type === "phone" ? formatPhone(contact.value) : contact.value}
                                </span>
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
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => openEditContact(contact)}
                                    data-testid={`button-edit-contact-${contact.id}`}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    className={`h-7 w-7 ${contact.isPrimary ? "text-yellow-500" : ""}`}
                                    onClick={() => setPrimaryContactMutation.mutate(contact.id)}
                                    data-testid={`button-primary-contact-${contact.id}`}
                                  >
                                    <Star className={`h-3 w-3 ${contact.isPrimary ? "fill-current" : ""}`} />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => handleDeleteContact(contact)}
                                    data-testid={`button-delete-contact-${contact.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          
                          {/* Telefone original do lead (fallback) */}
                          {atendimentoAtual.lead.telefone1 && leadContacts.length === 0 && (!atendimentoAtual.higienizacao?.telefones || atendimentoAtual.higienizacao.telefones.length === 0) && (
                            <div className="flex items-center gap-2 p-2 border rounded text-sm bg-muted/30">
                              <Badge variant="outline" className="text-xs shrink-0">Original</Badge>
                              <span className="font-medium flex-1">{formatPhone(atendimentoAtual.lead.telefone1)}</span>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleCopyPhone(atendimentoAtual.lead.telefone1 || "")}
                                data-testid="button-copy-tel1-original"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          
                          {/* Mensagem quando não há contatos */}
                          {leadContacts.length === 0 && (!atendimentoAtual.higienizacao?.telefones || atendimentoAtual.higienizacao.telefones.length === 0) && !atendimentoAtual.lead.telefone1 && (
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
                        onClick={openNewContact}
                        data-testid="button-novo-contato-panel"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Novo Contato
                      </Button>
                    </TabsContent>
                    <TabsContent value="emails" className="p-4 space-y-2">
                      {loadingContacts ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          {/* Emails da higienização (dados importados) */}
                          {atendimentoAtual.higienizacao?.emails && atendimentoAtual.higienizacao.emails.length > 0 && (
                            <>
                              <p className="text-xs text-muted-foreground font-medium">Base Importada</p>
                              {atendimentoAtual.higienizacao.emails.map((email, idx) => (
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
                          
                          {/* Emails adicionados pelo corretor */}
                          {leadContacts.filter(c => c.type === "email").length > 0 && (
                            <p className="text-xs text-muted-foreground font-medium">Adicionados</p>
                          )}
                          {leadContacts.filter(c => c.type === "email").map((contact) => (
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
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeleteContact(contact)}
                                  data-testid={`button-delete-email-${contact.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {/* Email original do lead (fallback) */}
                          {atendimentoAtual.lead.email && leadContacts.filter(c => c.type === "email").length === 0 && (!atendimentoAtual.higienizacao?.emails || atendimentoAtual.higienizacao.emails.length === 0) && (
                            <div className="flex items-center gap-2 p-2 border rounded text-sm bg-muted/30">
                              <Badge variant="outline" className="text-xs shrink-0">Original</Badge>
                              <span className="font-medium flex-1">{atendimentoAtual.lead.email}</span>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleCopyPhone(atendimentoAtual.lead.email || "")}
                                data-testid="button-copy-email-original"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          
                          {/* Mensagem quando não há emails */}
                          {leadContacts.filter(c => c.type === "email").length === 0 && (!atendimentoAtual.higienizacao?.emails || atendimentoAtual.higienizacao.emails.length === 0) && !atendimentoAtual.lead.email && (
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
                        onClick={() => {
                          setNewContact({ tipo: "email", valor: "" });
                          setAddContactOpen(true);
                        }}
                        data-testid="button-novo-email-panel"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Novo Email
                      </Button>
                    </TabsContent>
                    <TabsContent value="endereco" className="p-4 space-y-2">
                      {/* Endereço da higienização */}
                      {atendimentoAtual.higienizacao?.endereco ? (
                        <div className="space-y-3 text-sm p-3 border rounded bg-green-50 dark:bg-green-950/30">
                          <p className="text-xs text-muted-foreground font-medium">Base Importada</p>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Logradouro</p>
                            <p>{atendimentoAtual.higienizacao.endereco.logradouro || "-"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Número</p>
                              <p>{atendimentoAtual.higienizacao.endereco.numero || "-"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Complemento</p>
                              <p>{atendimentoAtual.higienizacao.endereco.complemento || "-"}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Bairro</p>
                            <p>{atendimentoAtual.higienizacao.endereco.bairro || "-"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Cidade</p>
                              <p>{atendimentoAtual.higienizacao.endereco.cidade || atendimentoAtual.clienteBase?.municipio || "-"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">UF</p>
                              <p>{atendimentoAtual.higienizacao.endereco.uf || atendimentoAtual.clienteBase?.uf || "-"}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">CEP</p>
                            <p>{atendimentoAtual.higienizacao.endereco.cep || "-"}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 text-sm">
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Logradouro</p>
                            <p>-</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Número</p>
                              <p>-</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Complemento</p>
                              <p>-</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Bairro</p>
                            <p>-</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Cidade</p>
                              <p>{atendimentoAtual.clienteBase?.municipio || atendimentoAtual.lead.cidade || "-"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">UF</p>
                              <p>{atendimentoAtual.clienteBase?.uf || atendimentoAtual.lead.uf || "-"}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">CEP</p>
                            <p>-</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Endereços adicionados pelo corretor */}
                      {leadContacts.filter(c => c.type === "address").length > 0 && (
                        <>
                          <Separator className="my-2" />
                          <p className="text-xs text-muted-foreground font-medium">Adicionados</p>
                          {leadContacts.filter(c => c.type === "address").map((contact) => (
                            <div 
                              key={contact.id} 
                              className="flex items-center gap-2 p-2 border rounded text-sm hover-elevate"
                              data-testid={`address-contact-item-${contact.id}`}
                            >
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-medium flex-1 truncate">{contact.value}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => openEditContact(contact)}
                                  data-testid={`button-edit-address-${contact.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeleteContact(contact)}
                                  data-testid={`button-delete-address-${contact.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          setNewContact({ tipo: "address", valor: "" });
                          setAddContactOpen(true);
                        }}
                        data-testid="button-novo-endereco-panel"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Novo Endereço
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>

      {/* BOTÃO FIXO - Registrar Atendimento */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          className="px-6 py-6 text-base font-bold shadow-lg"
          onClick={() => setDrawerOpen(true)}
          data-testid="button-registrar-atendimento"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          Registrar Atendimento
        </Button>
      </div>

      {/* Dialog Registrar Atendimento */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Registrar Interação
              {atendimentoAtual?.lead?.leadMarker && (
                <Badge variant="secondary" className="text-xs ml-2">
                  {LEAD_MARKER_LABELS[atendimentoAtual.lead.leadMarker as LeadMarker] || atendimentoAtual.lead.leadMarker}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm">Tipo de Contato *</Label>
                <Select
                  value={interactionFormData.tipoContato}
                  onValueChange={(v) => setInteractionFormData({ ...interactionFormData, tipoContato: v as typeof TIPOS_CONTATO_LEAD[number] })}
                >
                  <SelectTrigger data-testid="select-tipo-contato">
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
                  value={interactionFormData.leadMarker}
                  onValueChange={(v) => setInteractionFormData({ ...interactionFormData, leadMarker: v as LeadMarker })}
                >
                  <SelectTrigger data-testid="select-marcador">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_MARKERS.map((marker) => (
                      <SelectItem key={marker} value={marker}>{LEAD_MARKER_LABELS[marker]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {markerRequiresMotivo && (
              <div>
                <Label className="text-sm">Motivo *</Label>
                <Input
                  value={interactionFormData.motivo}
                  onChange={(e) => setInteractionFormData({ ...interactionFormData, motivo: e.target.value })}
                  placeholder="Justifique o marcador selecionado..."
                  data-testid="input-motivo"
                />
              </div>
            )}

            {markerRequiresRetorno && (
              <div>
                <Label className="text-sm">Agendar Retorno *</Label>
                <Input
                  type="datetime-local"
                  value={interactionFormData.retornoEm}
                  onChange={(e) => setInteractionFormData({ ...interactionFormData, retornoEm: e.target.value })}
                  data-testid="input-retorno"
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm">Valor da Margem (R$) *</Label>
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
                <Label className="text-sm">Proposta Estimada (R$) *</Label>
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
                data-testid="textarea-observacao"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleRegistrarInteracao}
              disabled={registerInteractionMutation.isPending}
              data-testid="button-salvar"
            >
              {registerInteractionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
            <div className="flex-1" />
            <Button
              onClick={handleRegistrarEProximo}
              disabled={registerInteractionMutation.isPending || proximoMutation.isPending}
              data-testid="button-salvar-proximo"
            >
              {(registerInteractionMutation.isPending || proximoMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <SkipForward className="h-4 w-4 mr-2" />
              Registrar e Próximo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Agendar Retorno */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Retorno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {currentLeadSchedule && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Este lead já possui um agendamento pendente:</p>
                <p className="font-medium">
                  {new Date(currentLeadSchedule.dataHora).toLocaleString("pt-BR")}
                </p>
                {currentLeadSchedule.observacao && (
                  <p className="text-sm text-muted-foreground mt-1">{currentLeadSchedule.observacao}</p>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="schedule-datetime">Data e Hora</Label>
              <Input
                id="schedule-datetime"
                type="datetime-local"
                value={scheduleData.dataHora}
                onChange={(e) => setScheduleData({ ...scheduleData, dataHora: e.target.value })}
                data-testid="input-schedule-datetime"
              />
            </div>
            <div>
              <Label htmlFor="schedule-observacao">Observação (opcional)</Label>
              <Textarea
                id="schedule-observacao"
                value={scheduleData.observacao}
                onChange={(e) => setScheduleData({ ...scheduleData, observacao: e.target.value })}
                placeholder="Ex: Retornar ligação após horário comercial"
                rows={3}
                data-testid="textarea-schedule-observacao"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setScheduleDialogOpen(false)}
              data-testid="button-cancel-schedule"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAgendar}
              disabled={agendarMutation.isPending}
              data-testid="button-confirm-schedule"
            >
              {agendarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Adicionar/Editar Contato */}
      <Dialog open={addContactOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingContact(null);
          setNewContact({ tipo: "phone", valor: "" });
        }
        setAddContactOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact 
                ? "Editar Contato" 
                : newContact.tipo === "email" 
                  ? "Novo Email" 
                  : newContact.tipo === "address" 
                    ? "Novo Endereço" 
                    : "Novo Telefone"
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>
                {newContact.tipo === "email" 
                  ? "Email *" 
                  : newContact.tipo === "address" 
                    ? "Endereço *" 
                    : "Telefone *"}
              </Label>
              <Input
                value={newContact.valor}
                onChange={(e) => setNewContact({ ...newContact, valor: e.target.value })}
                placeholder={
                  newContact.tipo === "email" 
                    ? "exemplo@email.com" 
                    : newContact.tipo === "address" 
                      ? "Rua, número, bairro, cidade - UF" 
                      : "(00) 00000-0000"
                }
                data-testid="input-contact-value"
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
              data-testid="button-save-contact"
            >
              {(createContactMutation.isPending || updateContactMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingContact ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
