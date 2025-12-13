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
  Users, Clock, CheckCircle, ShoppingCart, Trash2, Star, Pencil
} from "lucide-react";
import { LEAD_STATUS, TIPOS_CONTATO, type SalesLeadAssignment, type SalesLead, type SalesLeadEvent, type LeadSchedule, type LeadContact, type ContactTag, type LeadTag } from "@shared/schema";

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
  const [editingContact, setEditingContact] = useState<LeadContact | null>(null);
  const [newContact, setNewContact] = useState({ tipo: "phone", valor: "" });
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


  const { data: leadContacts = [], isLoading: loadingContacts } = useQuery<LeadContact[]>({
    queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "contacts"],
    enabled: !!atendimentoAtual?.lead?.id,
  });

  // Tag management queries - use the unified vendas tags system
  const { data: allContactTags = [] } = useQuery<LeadTag[]>({
    queryKey: ["/api/vendas/tags"],
  });

  const { data: contactsWithTagsRaw = [] } = useQuery<{ contact: { id: number }; tags: { id: number; nome: string; cor: string }[] }[]>({
    queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "contacts-with-tags"],
    enabled: !!atendimentoAtual?.lead?.id,
  });

  // Transform the API response to a flat format for easier lookup
  const contactsWithTags = contactsWithTagsRaw.flatMap(item => 
    item.tags.map(tag => ({ contactId: item.contact.id, tagId: tag.id }))
  );

  // Tag popover state
  const [tagPopoverOpen, setTagPopoverOpen] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [showNewTagForm, setShowNewTagForm] = useState(false);

  // Get tags for a specific contact
  const getTagsForContact = (contactId: number): LeadTag[] => {
    const tagIds = contactsWithTags
      .filter(ct => ct.contactId === contactId)
      .map(ct => ct.tagId);
    return allContactTags.filter(tag => tagIds.includes(tag.id));
  };

  // Check if contact has a specific tag
  const contactHasTag = (contactId: number, tagId: number): boolean => {
    return contactsWithTags.some(ct => ct.contactId === contactId && ct.tagId === tagId);
  };

  // Get all unique tags for the lead (across all contacts)
  const getAllLeadTags = (): LeadTag[] => {
    const uniqueTagIds = Array.from(new Set(contactsWithTags.map(ct => ct.tagId)));
    return allContactTags.filter(tag => uniqueTagIds.includes(tag.id));
  };

  const leadTags = getAllLeadTags();

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

  // Tag mutations - use unified vendas tags system
  const createTagMutation = useMutation({
    mutationFn: async (data: { nome: string; cor: string }) => {
      return apiRequest("POST", "/api/vendas/tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/tags"] });
      setNewTagName("");
      setNewTagColor("#3B82F6");
      setShowNewTagForm(false);
      toast({ title: "Etiqueta criada!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar etiqueta", variant: "destructive" });
    },
  });

  const assignTagMutation = useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: number; tagId: number }) => {
      return apiRequest("POST", `/api/crm/contacts/${contactId}/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "contacts-with-tags"] });
    },
    onError: () => {
      toast({ title: "Erro ao atribuir etiqueta", variant: "destructive" });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: number; tagId: number }) => {
      return apiRequest("DELETE", `/api/crm/contacts/${contactId}/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", atendimentoAtual?.lead?.id, "contacts-with-tags"] });
    },
    onError: () => {
      toast({ title: "Erro ao remover etiqueta", variant: "destructive" });
    },
  });

  const handleToggleTag = (contactId: number, tagId: number) => {
    if (contactHasTag(contactId, tagId)) {
      removeTagMutation.mutate({ contactId, tagId });
    } else {
      assignTagMutation.mutate({ contactId, tagId });
    }
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast({ title: "Informe o nome da etiqueta", variant: "destructive" });
      return;
    }
    createTagMutation.mutate({ nome: newTagName.trim(), cor: newTagColor });
  };

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
      setDrawerOpen(false);
      proximoMutation.mutate(undefined);
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
                {/* Tag chips */}
                {leadTags.length > 0 && (
                  <>
                    {leadTags.slice(0, 2).map(tag => (
                      <Badge 
                        key={tag.id}
                        variant="secondary"
                        className="text-xs"
                        style={{ 
                          backgroundColor: `${tag.cor}20`, 
                          borderColor: tag.cor,
                          color: tag.cor 
                        }}
                        data-testid={`badge-tag-${tag.id}`}
                      >
                        <div 
                          className="w-2 h-2 rounded-full mr-1.5"
                          style={{ backgroundColor: tag.cor }}
                        />
                        {tag.nome}
                      </Badge>
                    ))}
                    {leadTags.length > 2 && (
                      <Badge variant="outline" className="text-xs" data-testid="badge-more-tags">
                        +{leadTags.length - 2}
                      </Badge>
                    )}
                  </>
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

              {/* Parcelas por Banco - Resumo de empréstimos */}
              {atendimentoAtual.contratos && atendimentoAtual.contratos.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Parcelas por Banco
                    </CardTitle>
                    <CardDescription>Resumo de descontos em folha por banco</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Banco</TableHead>
                          <TableHead className="text-right">Total Parcela</TableHead>
                          <TableHead className="text-right">Saldo Devedor</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const porBanco: Record<string, { parcela: number; saldo: number; qtd: number }> = {};
                          atendimentoAtual.contratos.forEach((c) => {
                            const banco = c.banco || c.BANCO_DO_EMPRESTIMO || "Não Informado";
                            if (!porBanco[banco]) {
                              porBanco[banco] = { parcela: 0, saldo: 0, qtd: 0 };
                            }
                            porBanco[banco].parcela += (c.valor_parcela || c.valorParcela || 0);
                            porBanco[banco].saldo += (c.saldo_devedor || c.saldoDevedor || 0);
                            porBanco[banco].qtd += 1;
                          });
                          return Object.entries(porBanco).map(([banco, dados]) => (
                            <TableRow key={banco}>
                              <TableCell className="font-medium">{banco}</TableCell>
                              <TableCell className="text-right">{formatCurrency(dados.parcela)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(dados.saldo)}</TableCell>
                              <TableCell className="text-right">{dados.qtd}</TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

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
                    <TabsContent value="telefones" className="p-4 space-y-2">
                      {loadingContacts ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : leadContacts.length === 0 && !atendimentoAtual.lead.telefone1 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          Sem contatos cadastrados
                        </div>
                      ) : (
                        <>
                          {leadContacts.map((contact) => {
                            const contactTags = getTagsForContact(contact.id);
                            return (
                              <div 
                                key={contact.id} 
                                className="flex items-center gap-2 p-2 border rounded text-sm hover-elevate"
                                data-testid={`contact-item-${contact.id}`}
                              >
                                {/* Tag indicators */}
                                {contactTags.length > 0 && (
                                  <div className="flex gap-0.5 shrink-0">
                                    {contactTags.slice(0, 3).map(tag => (
                                      <div 
                                        key={tag.id}
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: tag.cor }}
                                        title={tag.nome}
                                      />
                                    ))}
                                    {contactTags.length > 3 && (
                                      <span className="text-xs text-muted-foreground">+{contactTags.length - 3}</span>
                                    )}
                                  </div>
                                )}
                                <span className="font-medium flex-1 truncate">
                                  {contact.type === "phone" ? formatPhone(contact.value) : contact.value}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Tag popover button */}
                                  <Popover 
                                    open={tagPopoverOpen === contact.id} 
                                    onOpenChange={(open) => {
                                      setTagPopoverOpen(open ? contact.id : null);
                                      if (!open) {
                                        setShowNewTagForm(false);
                                        setNewTagName("");
                                        setNewTagColor("#3B82F6");
                                      }
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        className={`h-7 w-7 ${contactTags.length > 0 ? "text-primary" : ""}`}
                                        data-testid={`button-tag-contact-${contact.id}`}
                                      >
                                        <Tag className="h-3 w-3" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2" align="end">
                                      <div className="space-y-2">
                                        <p className="text-sm font-medium px-1">Etiquetas</p>
                                        <ScrollArea className="max-h-48">
                                          <div className="space-y-1">
                                            {allContactTags.length === 0 ? (
                                              <p className="text-xs text-muted-foreground px-1 py-2">
                                                Nenhuma etiqueta criada
                                              </p>
                                            ) : (
                                              allContactTags.map(tag => (
                                                <button
                                                  key={tag.id}
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleToggleTag(contact.id, tag.id);
                                                  }}
                                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
                                                  data-testid={`tag-option-${tag.id}`}
                                                >
                                                  <div 
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: tag.cor }}
                                                  />
                                                  <span className="flex-1 text-left truncate">{tag.nome}</span>
                                                  {contactHasTag(contact.id, tag.id) && (
                                                    <Check className="h-3 w-3 text-primary shrink-0" />
                                                  )}
                                                </button>
                                              ))
                                            )}
                                          </div>
                                        </ScrollArea>
                                        <Separator />
                                        {showNewTagForm ? (
                                          <div className="space-y-2 p-1">
                                            <Input
                                              value={newTagName}
                                              onChange={(e) => setNewTagName(e.target.value)}
                                              placeholder="Nome da etiqueta"
                                              className="h-8 text-sm"
                                              data-testid="input-new-tag-name"
                                            />
                                            <div className="flex items-center gap-2">
                                              <Label className="text-xs">Cor:</Label>
                                              <input
                                                type="color"
                                                value={newTagColor}
                                                onChange={(e) => setNewTagColor(e.target.value)}
                                                className="w-8 h-6 rounded cursor-pointer border"
                                                data-testid="input-new-tag-color"
                                              />
                                              <div className="flex-1" />
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                  setShowNewTagForm(false);
                                                  setNewTagName("");
                                                  setNewTagColor("#3B82F6");
                                                }}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                onClick={handleCreateTag}
                                                disabled={createTagMutation.isPending}
                                                data-testid="button-save-new-tag"
                                              >
                                                {createTagMutation.isPending ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <Check className="h-3 w-3" />
                                                )}
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start"
                                            onClick={() => setShowNewTagForm(true)}
                                            data-testid="button-create-new-tag"
                                          >
                                            <Plus className="h-3 w-3 mr-2" />
                                            Criar nova etiqueta
                                          </Button>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
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
                            );
                          })}
                          {atendimentoAtual.lead.telefone1 && leadContacts.length === 0 && (
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
              Registrar Atendimento
              {currentLeadSchedule && (
                <Badge variant="secondary" className="text-xs ml-2">
                  <Calendar className="h-3 w-3 mr-1" />
                  Retorno agendado
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
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
            </div>

            <div>
              <Label className="text-sm">Observações</Label>
              <Textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                placeholder="Detalhes do atendimento..."
                rows={3}
                data-testid="textarea-observacao"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setScheduleDialogOpen(true)}
              data-testid="button-agendar-retorno"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Agendar Retorno
            </Button>
            <div className="flex-1" />
            <Button
              onClick={handleSalvarEProximo}
              disabled={registrarMutation.isPending || proximoMutation.isPending}
              data-testid="button-salvar-proximo"
            >
              {(registrarMutation.isPending || proximoMutation.isPending) && (
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
            <DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Telefone *</Label>
              <Input
                value={newContact.valor}
                onChange={(e) => setNewContact({ ...newContact, valor: e.target.value })}
                placeholder="(00) 00000-0000"
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
