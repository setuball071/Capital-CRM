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
import { Loader2, Play, Phone, MessageSquare, Mail, User, Building, CreditCard, Save, SkipForward, Landmark, Briefcase, Copy, Tag, Plus, X, Check, Calendar } from "lucide-react";
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

export default function VendasAtendimento() {
  const { toast } = useToast();
  const [atendimentoAtual, setAtendimentoAtual] = useState<AtendimentoData | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/atendimento/resumo"] });
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
    await registrarMutation.mutateAsync(formData);
    proximoMutation.mutate(undefined);
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "R$ 0,00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatCPF = (cpf: string | null | undefined) => {
    if (!cpf) return "-";
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    return cpf;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR");
    } catch {
      return "-";
    }
  };

  if (loadingResumo) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-vendas-atendimento">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM de Vendas</h1>
          <p className="text-muted-foreground">Atenda seus leads e registre cada contato</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-leads-pendentes">{resumo?.leadsPendentes || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Novos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{resumo?.leadsNovos || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Atendimento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{resumo?.emAtendimento || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{resumo?.vendidos || 0}</p>
          </CardContent>
        </Card>
      </div>

      {!atendimentoAtual ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Play className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Iniciar Atendimento</h2>
            <p className="text-muted-foreground mb-6">
              Clique no botão abaixo para começar a atender o próximo lead da sua fila
            </p>
            <Button
              size="lg"
              onClick={() => proximoMutation.mutate(undefined)}
              disabled={proximoMutation.isPending || (resumo?.leadsPendentes || 0) === 0}
              data-testid="button-iniciar-atendimento"
            >
              {proximoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Play className="h-4 w-4 mr-2" />
              Iniciar / Próximo Cliente
            </Button>
            {(resumo?.leadsPendentes || 0) === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                Você não tem leads pendentes na fila.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {atendimentoAtual.clienteBase?.nome || atendimentoAtual.lead.nome}
                    </CardTitle>
                    <CardDescription>
                      {atendimentoAtual.campanha?.nome && (
                        <Badge variant="outline" className="mr-2">{atendimentoAtual.campanha.nome}</Badge>
                      )}
                    </CardDescription>
                  </div>
                  <Badge>{LEAD_STATUS[atendimentoAtual.assignment.status as keyof typeof LEAD_STATUS] || atendimentoAtual.assignment.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-6 px-2" data-testid="button-manage-tags">
                        <Plus className="h-3 w-3 mr-1" />
                        Tags
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">CPF</p>
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
                    <p className="text-sm text-muted-foreground">Matrícula</p>
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
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium" data-testid="text-nome">
                      {atendimentoAtual.clienteBase?.nome || atendimentoAtual.lead.nome}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                    <p data-testid="text-data-nascimento">
                      {formatDate(atendimentoAtual.clienteBase?.data_nascimento || atendimentoAtual.clienteBase?.dataNascimento)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Situação Funcional</p>
                    <p data-testid="text-sit-func">
                      {atendimentoAtual.clienteBase?.sit_func || atendimentoAtual.clienteBase?.sitFunc || "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Lotação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Convênio</p>
                    <p data-testid="text-convenio">
                      {atendimentoAtual.clienteBase?.convenio || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Órgão</p>
                    <p data-testid="text-orgao">
                      {atendimentoAtual.clienteBase?.orgao || atendimentoAtual.clienteBase?.orgaodesc || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">UF</p>
                    <p data-testid="text-uf">
                      {atendimentoAtual.clienteBase?.uf || atendimentoAtual.lead.uf || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Município</p>
                    <p data-testid="text-municipio">
                      {atendimentoAtual.clienteBase?.municipio || atendimentoAtual.lead.cidade || "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  Dados Bancários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Banco</p>
                    <p data-testid="text-banco">
                      {atendimentoAtual.clienteBase?.banco_codigo || atendimentoAtual.clienteBase?.bancoCodigo || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Agência</p>
                    <p data-testid="text-agencia">
                      {atendimentoAtual.clienteBase?.agencia || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Conta</p>
                    <p data-testid="text-conta">
                      {atendimentoAtual.clienteBase?.conta || "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {atendimentoAtual.lead.observacoes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Observações do Lead</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{atendimentoAtual.lead.observacoes}</p>
                </CardContent>
              </Card>
            )}

            {atendimentoAtual.clienteBase && atendimentoAtual.folhaAtual && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Margens Disponíveis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Margem 70%</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(atendimentoAtual.folhaAtual?.margem_saldo_70)}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Margem 35%</p>
                      <p className="text-xl font-bold text-blue-600">
                        {formatCurrency(atendimentoAtual.folhaAtual?.margem_saldo_35)}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Cartão Crédito</p>
                      <p className="text-xl font-bold text-purple-600">
                        {formatCurrency(atendimentoAtual.folhaAtual?.margemCartaoCreditoSaldo)}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Cartão Benefício</p>
                      <p className="text-xl font-bold text-orange-600">
                        {formatCurrency(atendimentoAtual.folhaAtual?.margemCartaoBeneficioSaldo)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {atendimentoAtual.contratos && atendimentoAtual.contratos.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Contratos Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Banco</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Parcela</TableHead>
                        <TableHead className="text-right">Saldo Devedor</TableHead>
                        <TableHead className="text-right">Parcelas Rest.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atendimentoAtual.contratos.map((contrato, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{contrato.banco || "-"}</TableCell>
                          <TableCell>{contrato.tipoContrato || contrato.tipo_contrato || "-"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(contrato.valorParcela || contrato.valor_parcela)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(contrato.saldoDevedor || contrato.saldo_devedor)}</TableCell>
                          <TableCell className="text-right">{contrato.parcelasRestantes || contrato.parcelas_restantes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {atendimentoAtual.eventos && atendimentoAtual.eventos.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Histórico de Contatos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {atendimentoAtual.eventos.map((evento, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="p-2 bg-muted rounded">
                          {evento.tipo === "ligacao" && <Phone className="h-4 w-4" />}
                          {evento.tipo === "whatsapp" && <MessageSquare className="h-4 w-4" />}
                          {evento.tipo === "email" && <Mail className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{TIPOS_CONTATO[evento.tipo as keyof typeof TIPOS_CONTATO] || evento.tipo}</span>
                            {evento.resultado && <Badge variant="outline">{evento.resultado}</Badge>}
                          </div>
                          {evento.observacao && <p className="text-sm text-muted-foreground mt-1">{evento.observacao}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
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

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Registrar Atendimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tipo de Contato</Label>
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
                  <Label>Status do Lead</Label>
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

                <div>
                  <Label>Resultado</Label>
                  <Input
                    value={formData.resultado}
                    onChange={(e) => setFormData({ ...formData, resultado: e.target.value })}
                    placeholder="Ex: Cliente interessado, aguardando proposta"
                    data-testid="input-resultado"
                  />
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                    placeholder="Detalhes do atendimento..."
                    rows={4}
                    data-testid="textarea-observacao"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setScheduleDialogOpen(true)}
                    data-testid="button-agendar-retorno"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Agendar Retorno
                    {currentLeadSchedule && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Agendado
                      </Badge>
                    )}
                  </Button>
                  <Button
                    className="w-full"
                    onClick={handleSalvar}
                    disabled={registrarMutation.isPending}
                    data-testid="button-salvar"
                  >
                    {registrarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                  <Button
                    className="w-full"
                    variant="secondary"
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
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => proximoMutation.mutate(undefined)}
                    disabled={proximoMutation.isPending}
                    data-testid="button-proximo"
                  >
                    {proximoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Próximo Cliente
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

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
    </div>
  );
}
