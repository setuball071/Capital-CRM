import { useState, useEffect } from "react";
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
import { 
  Loader2, Play, Phone, MessageSquare, Mail, User, Building, CreditCard, Save, SkipForward, 
  Landmark, Briefcase, Copy, Tag, Plus, X, Check, Calendar, ChevronUp, ChevronDown, MapPin,
  Users, Clock, CheckCircle, ShoppingCart
} from "lucide-react";
import { LEAD_STATUS, TIPOS_CONTATO, type SalesLeadAssignment, type SalesLead, type SalesLeadEvent, type LeadTag, type LeadSchedule } from "@shared/schema";

const TAG_COLORS = [
  { value: "#22c55e", name: "Verde" },
  { value: "#3b82f6", name: "Azul" },
  { value: "#ef4444", name: "Vermelho" },
  { value: "#eab308", name: "Amarelo" },
  { value: "#a855f7", name: "Roxo" },
  { value: "#f97316", name: "Laranja" },
  { value: "#ec4899", name: "Rosa" },
];

interface AtendimentoData {
  assignment: SalesLeadAssignment;
  lead: SalesLead;
  clienteBase: any | null;
  folhaAtual: any | null;
  contratos: any[];
  eventos: SalesLeadEvent[];
  campanha: { id: number; nome: string } | null;
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
  const [newContact, setNewContact] = useState({ tipo: "telefone", valor: "", observacao: "" });
  const [formData, setFormData] = useState({
    tipo: "ligacao",
    resultado: "",
    observacao: "",
    status: "em_atendimento",
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

  const { data: userTags = [] } = useQuery<LeadTag[]>({
    queryKey: ["/api/vendas/tags"],
  });

  const { data: assignmentTags = [] } = useQuery<LeadTag[]>({
    queryKey: ["/api/vendas/atendimento", atendimentoAtual?.assignment?.id, "tags"],
    enabled: !!atendimentoAtual?.assignment?.id,
  });

  const [newTagNome, setNewTagNome] = useState("");
  const [newTagCor, setNewTagCor] = useState("#3b82f6");
  
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    dataHora: "",
    observacao: "",
  });

  const createTagMutation = useMutation({
    mutationFn: async (data: { nome: string; cor: string }) => {
      return apiRequest("POST", "/api/vendas/tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/tags"] });
      setNewTagNome("");
      toast({ title: "Tag criada!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar tag", variant: "destructive" });
    },
  });

  const toggleTagMutation = useMutation({
    mutationFn: async ({ tagId, isAssigned }: { tagId: number; isAssigned: boolean }) => {
      if (!atendimentoAtual) throw new Error("Nenhum atendimento ativo");
      const assignmentId = atendimentoAtual.assignment.id;
      if (isAssigned) {
        return apiRequest("DELETE", `/api/vendas/atendimento/${assignmentId}/tags/${tagId}`);
      } else {
        return apiRequest("POST", `/api/vendas/atendimento/${assignmentId}/tags/${tagId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/atendimento", atendimentoAtual?.assignment?.id, "tags"] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar tag", variant: "destructive" });
    },
  });

  const isTagAssigned = (tagId: number) => assignmentTags.some(t => t.id === tagId);

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
    mutationFn: async (campaignId?: number) => {
      const res = await apiRequest("POST", "/api/vendas/atendimento/proximo", { campaignId });
      return res.json() as Promise<AtendimentoData>;
    },
    onSuccess: (data) => {
      setAtendimentoAtual(data);
      setFormData({ tipo: "ligacao", resultado: "", observacao: "", status: "em_atendimento" });
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

  const registrarMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!atendimentoAtual) throw new Error("Nenhum atendimento ativo");
      return apiRequest("POST", `/api/vendas/atendimento/${atendimentoAtual.assignment.id}/registrar`, data);
    },
    onSuccess: () => {
      toast({ title: "Atendimento registrado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/atendimento/resumo"] });
    },
    onError: () => {
      toast({ title: "Erro ao registrar atendimento", variant: "destructive" });
    },
  });

  const handleSalvar = () => {
    registrarMutation.mutate(formData);
  };

  const handleSalvarEProximo = async () => {
    try {
      await registrarMutation.mutateAsync(formData);
      proximoMutation.mutate(undefined);
    } catch {
      // Error already handled by mutation
    }
  };

  const handleAddContact = () => {
    if (!newContact.valor.trim()) {
      toast({ title: "Informe o valor do contato", variant: "destructive" });
      return;
    }
    toast({ title: "Contato adicionado!", description: "Funcionalidade será persistida em breve." });
    setAddContactOpen(false);
    setNewContact({ tipo: "telefone", valor: "", observacao: "" });
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

            {campanhasDisponiveis && campanhasDisponiveis.length > 0 ? (
              <div className="space-y-4 w-full max-w-md">
                <div className="grid gap-2">
                  {campanhasDisponiveis.map((camp) => (
                    <Button
                      key={camp.id}
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => proximoMutation.mutate(camp.id)}
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
                  onClick={() => proximoMutation.mutate(undefined)}
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
                onClick={() => proximoMutation.mutate(undefined)}
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
              {assignmentTags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {assignmentTags.map((tag) => (
                    <Badge 
                      key={tag.id} 
                      className="text-white text-xs" 
                      style={{ backgroundColor: tag.cor }}
                      data-testid={`badge-tag-${tag.id}`}
                    >
                      {tag.nome}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => proximoMutation.mutate(undefined)}
              disabled={proximoMutation.isPending}
              data-testid="button-proximo-header"
            >
              {proximoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Próximo Cliente
            </Button>
          </div>
        </div>
      </div>

      {/* CORPO - 2 COLUNAS */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="container mx-auto p-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* COLUNA ESQUERDA - Dados do Cliente */}
            <div className="lg:col-span-2 space-y-4">
              {/* Dados Pessoais */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
                      <p className="text-muted-foreground">Data de Nascimento</p>
                      <p data-testid="text-data-nascimento">
                        {atendimentoAtual.clienteBase?.data_nascimento 
                          ? new Date(atendimentoAtual.clienteBase.data_nascimento).toLocaleDateString("pt-BR")
                          : "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Situação Funcional</p>
                      <p data-testid="text-sit-func">
                        {atendimentoAtual.clienteBase?.sit_func || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Convênio</p>
                      <Badge variant="outline" data-testid="text-convenio">
                        {atendimentoAtual.clienteBase?.convenio || "-"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contato */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contato
                    </CardTitle>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setAddContactOpen(true)}
                      data-testid="button-add-contact"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Telefone 1</p>
                      <p className="font-medium" data-testid="text-telefone-1">
                        <CopyableField
                          value={atendimentoAtual.lead.telefone1}
                          displayValue={formatPhone(atendimentoAtual.lead.telefone1)}
                          testId="button-copy-telefone1"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Telefone 2</p>
                      <p className="font-medium" data-testid="text-telefone-2">
                        <CopyableField
                          value={atendimentoAtual.lead.telefone2}
                          displayValue={formatPhone(atendimentoAtual.lead.telefone2)}
                          testId="button-copy-telefone2"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Telefone 3</p>
                      <p className="font-medium" data-testid="text-telefone-3">
                        <CopyableField
                          value={atendimentoAtual.lead.telefone3}
                          displayValue={formatPhone(atendimentoAtual.lead.telefone3)}
                          testId="button-copy-telefone3"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">E-mail</p>
                      <p className="font-medium" data-testid="text-email">
                        <CopyableField
                          value={atendimentoAtual.lead.email}
                          displayValue={atendimentoAtual.lead.email || "-"}
                          testId="button-copy-email"
                          toast={toast}
                        />
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lotação */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Lotação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Convênio</p>
                      <p data-testid="text-convenio-lotacao">{atendimentoAtual.clienteBase?.convenio || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Órgão</p>
                      <p data-testid="text-orgao">{atendimentoAtual.clienteBase?.orgao || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">UF</p>
                      <p data-testid="text-uf">{atendimentoAtual.clienteBase?.uf || atendimentoAtual.lead.uf || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Município</p>
                      <p data-testid="text-municipio">{atendimentoAtual.clienteBase?.municipio || atendimentoAtual.lead.cidade || "-"}</p>
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
                      <p className="text-muted-foreground">Banco Salário</p>
                      <p data-testid="text-banco">{atendimentoAtual.clienteBase?.banco_codigo || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Agência</p>
                      <p data-testid="text-agencia">{atendimentoAtual.clienteBase?.agencia || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Conta</p>
                      <p data-testid="text-conta">{atendimentoAtual.clienteBase?.conta || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Margens */}
              {atendimentoAtual.folhaAtual && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Folha / Margens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                      {(atendimentoAtual.folhaAtual.margem_saldo_70 !== null || atendimentoAtual.folhaAtual.margemSaldo70 !== null) && (
                        <div className="p-3 border rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-1">Margem 70%</p>
                          <p className="text-lg font-bold text-green-600">
                            {formatCurrency(atendimentoAtual.folhaAtual.margem_saldo_70 ?? atendimentoAtual.folhaAtual.margemSaldo70)}
                          </p>
                        </div>
                      )}
                      {(atendimentoAtual.folhaAtual.margem_saldo_35 !== null || atendimentoAtual.folhaAtual.margemSaldo35 !== null) && (
                        <div className="p-3 border rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-1">Margem 35%</p>
                          <p className="text-lg font-bold text-blue-600">
                            {formatCurrency(atendimentoAtual.folhaAtual.margem_saldo_35 ?? atendimentoAtual.folhaAtual.margemSaldo35)}
                          </p>
                        </div>
                      )}
                      {(atendimentoAtual.folhaAtual.margem_cartao_credito_saldo !== null || atendimentoAtual.folhaAtual.margemCartaoCreditoSaldo !== null) && (
                        <div className="p-3 border rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-1">Cartão Crédito 5%</p>
                          <p className="text-lg font-bold text-purple-600">
                            {formatCurrency(atendimentoAtual.folhaAtual.margem_cartao_credito_saldo ?? atendimentoAtual.folhaAtual.margemCartaoCreditoSaldo)}
                          </p>
                        </div>
                      )}
                      {(atendimentoAtual.folhaAtual.margem_cartao_beneficio_saldo !== null || atendimentoAtual.folhaAtual.margemCartaoBeneficioSaldo !== null) && (
                        <div className="p-3 border rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-1">Cartão Benefício 5%</p>
                          <p className="text-lg font-bold text-orange-600">
                            {formatCurrency(atendimentoAtual.folhaAtual.margem_cartao_beneficio_saldo ?? atendimentoAtual.folhaAtual.margemCartaoBeneficioSaldo)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contratos */}
              {atendimentoAtual.contratos && atendimentoAtual.contratos.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Contratos / Descontos em Folha
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo de Produto</TableHead>
                          <TableHead>Banco do Empréstimo</TableHead>
                          <TableHead className="text-right">Valor Parcela</TableHead>
                          <TableHead className="text-right">Parcelas Rest.</TableHead>
                          <TableHead>Competência</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {atendimentoAtual.contratos.map((contrato, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{contrato.tipo_contrato || contrato.tipoContrato || "-"}</TableCell>
                            <TableCell className="font-medium">{contrato.banco || "-"}</TableCell>
                            <TableCell className="text-right">{formatCurrency(contrato.valor_parcela || contrato.valorParcela)}</TableCell>
                            <TableCell className="text-right">{contrato.parcelas_restantes || contrato.parcelasRestantes || "-"}</TableCell>
                            <TableCell>{contrato.competencia || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

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
                      <TabsTrigger value="endereco" className="flex-1" data-testid="tab-endereco">
                        <MapPin className="h-3 w-3 mr-1" />
                        Endereço
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="telefones" className="p-4 space-y-3">
                      {atendimentoAtual.lead.telefone1 && (
                        <div className="flex items-center justify-between p-2 border rounded hover-elevate">
                          <div>
                            <p className="text-xs text-muted-foreground">Telefone 1</p>
                            <p className="font-medium">{formatPhone(atendimentoAtual.lead.telefone1)}</p>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(atendimentoAtual.lead.telefone1 || "");
                              toast({ title: "Copiado!" });
                            }}
                            data-testid="button-copy-tel1-panel"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {atendimentoAtual.lead.telefone2 && (
                        <div className="flex items-center justify-between p-2 border rounded hover-elevate">
                          <div>
                            <p className="text-xs text-muted-foreground">Telefone 2</p>
                            <p className="font-medium">{formatPhone(atendimentoAtual.lead.telefone2)}</p>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(atendimentoAtual.lead.telefone2 || "");
                              toast({ title: "Copiado!" });
                            }}
                            data-testid="button-copy-tel2-panel"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {atendimentoAtual.lead.telefone3 && (
                        <div className="flex items-center justify-between p-2 border rounded hover-elevate">
                          <div>
                            <p className="text-xs text-muted-foreground">Telefone 3</p>
                            <p className="font-medium">{formatPhone(atendimentoAtual.lead.telefone3)}</p>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(atendimentoAtual.lead.telefone3 || "");
                              toast({ title: "Copiado!" });
                            }}
                            data-testid="button-copy-tel3-panel"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {atendimentoAtual.lead.email && (
                        <div className="flex items-center justify-between p-2 border rounded hover-elevate">
                          <div>
                            <p className="text-xs text-muted-foreground">E-mail</p>
                            <p className="font-medium text-sm truncate max-w-[180px]">{atendimentoAtual.lead.email}</p>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(atendimentoAtual.lead.email || "");
                              toast({ title: "Copiado!" });
                            }}
                            data-testid="button-copy-email-panel"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setAddContactOpen(true)}
                        data-testid="button-novo-contato-panel"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Novo Contato
                      </Button>
                    </TabsContent>
                    <TabsContent value="endereco" className="p-4">
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
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Tags */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {assignmentTags.map((tag) => (
                      <Badge 
                        key={tag.id} 
                        className="text-white text-xs cursor-pointer" 
                        style={{ backgroundColor: tag.cor }}
                        onClick={() => toggleTagMutation.mutate({ tagId: tag.id, isAssigned: true })}
                        data-testid={`badge-tag-remove-${tag.id}`}
                      >
                        {tag.nome}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="w-full" data-testid="button-manage-tags">
                        <Plus className="h-3 w-3 mr-1" />
                        Gerenciar Tags
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="start">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Gerenciar Tags</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {userTags.map((tag) => (
                            <div 
                              key={tag.id} 
                              className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                              onClick={() => toggleTagMutation.mutate({ tagId: tag.id, isAssigned: isTagAssigned(tag.id) })}
                              data-testid={`tag-option-${tag.id}`}
                            >
                              <div 
                                className="w-4 h-4 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: tag.cor }} 
                              />
                              <span className="flex-1 text-sm">{tag.nome}</span>
                              {isTagAssigned(tag.id) && <Check className="h-4 w-4 text-green-600" />}
                            </div>
                          ))}
                          {userTags.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma tag criada</p>
                          )}
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Criar nova tag:</p>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="Nome" 
                              value={newTagNome}
                              onChange={(e) => setNewTagNome(e.target.value)}
                              className="h-8 text-sm"
                              data-testid="input-new-tag-nome"
                            />
                            <Select value={newTagCor} onValueChange={setNewTagCor}>
                              <SelectTrigger className="w-20 h-8" data-testid="select-new-tag-cor">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: newTagCor }} />
                              </SelectTrigger>
                              <SelectContent>
                                {TAG_COLORS.map((color) => (
                                  <SelectItem key={color.value} value={color.value}>
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color.value }} />
                                      <span>{color.name}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button 
                            size="sm" 
                            className="w-full h-8"
                            disabled={!newTagNome.trim() || createTagMutation.isPending}
                            onClick={() => createTagMutation.mutate({ nome: newTagNome, cor: newTagCor })}
                            data-testid="button-create-tag"
                          >
                            {createTagMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            Criar Tag
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* RODAPÉ FIXO - Drawer de Registrar Atendimento */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-primary shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div 
          className="flex items-center justify-between px-6 py-4 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => setDrawerOpen(!drawerOpen)}
          data-testid="drawer-toggle"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-primary-foreground/20 rounded-md">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="font-bold text-base tracking-wide">Registrar Atendimento</span>
            {currentLeadSchedule && (
              <Badge variant="secondary" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Retorno agendado
              </Badge>
            )}
          </div>
          {drawerOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </div>

        {drawerOpen && (
          <div className="px-6 pb-6 pt-2 border-t bg-card">
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label className="text-sm">Tipo de Contato</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                  >
                    <SelectTrigger data-testid="select-tipo-contato">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPOS_CONTATO).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm">Status do Lead</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEAD_STATUS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-sm">Tags</Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md min-h-[40px] flex-wrap">
                    {assignmentTags.map((tag) => (
                      <Badge 
                        key={tag.id} 
                        className="text-white text-xs" 
                        style={{ backgroundColor: tag.cor }}
                      >
                        {tag.nome}
                      </Badge>
                    ))}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-6 px-2">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64" align="start">
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {userTags.filter(t => !isTagAssigned(t.id)).map((tag) => (
                            <div 
                              key={tag.id} 
                              className="flex items-center gap-2 p-1.5 rounded hover-elevate cursor-pointer text-sm"
                              onClick={() => toggleTagMutation.mutate({ tagId: tag.id, isAssigned: false })}
                            >
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.cor }} />
                              <span>{tag.nome}</span>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="md:col-span-4">
                  <Label className="text-sm">Observações</Label>
                  <Textarea
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                    placeholder="Detalhes do atendimento..."
                    rows={2}
                    data-testid="textarea-observacao"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setScheduleDialogOpen(true)}
                  data-testid="button-agendar-retorno"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Agendar Retorno
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSalvar}
                    disabled={registrarMutation.isPending}
                    data-testid="button-salvar"
                  >
                    {registrarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                  <Button
                    onClick={handleSalvarEProximo}
                    disabled={registrarMutation.isPending || proximoMutation.isPending}
                    data-testid="button-salvar-proximo"
                  >
                    {(registrarMutation.isPending || proximoMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    <SkipForward className="h-4 w-4 mr-2" />
                    Salvar e Próximo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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

      {/* Dialog Adicionar Contato */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo</Label>
              <Select
                value={newContact.tipo}
                onValueChange={(v) => setNewContact({ ...newContact, tipo: v })}
              >
                <SelectTrigger data-testid="select-contact-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor</Label>
              <Input
                value={newContact.valor}
                onChange={(e) => setNewContact({ ...newContact, valor: e.target.value })}
                placeholder={newContact.tipo === "telefone" ? "(00) 00000-0000" : "email@exemplo.com"}
                data-testid="input-contact-value"
              />
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Input
                value={newContact.observacao}
                onChange={(e) => setNewContact({ ...newContact, observacao: e.target.value })}
                placeholder="Ex: Celular pessoal"
                data-testid="input-contact-obs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddContactOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddContact} data-testid="button-save-contact">
              Salvar Contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
