import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Search, 
  User, 
  Phone, 
  ChevronLeft, 
  Copy,
  Check,
  MessageSquare,
  Plus,
  UserPlus,
  Send,
  Eye,
  Clock,
  CalendarDays
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LEAD_MARKERS, LEAD_MARKER_LABELS, TIPOS_CONTATO_LEAD, type LeadMarker } from "@shared/schema";

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
  tipo_busca: "cpf" | "matricula";
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
  sit_func: string | null;
  uf: string | null;
  municipio: string | null;
  telefones_base: string[] | null;
  base_tag_ultima: string | null;
}

interface FolhaAtual {
  competencia: string;
  margem_saldo_30: number | null;
  margem_saldo_35: number | null;
  margem_cartao_credito_saldo: number | null;
  margem_cartao_beneficio_saldo: number | null;
  salario_bruto: number | null;
  salario_liquido: number | null;
  base_tag: string | null;
}

interface Contrato {
  id: number;
  tipo_contrato: string | null;
  banco: string | null;
  valor_parcela: number | null;
  parcelas_restantes: number | null;
  numero_contrato: string | null;
  competencia: string | null;
}

interface ClienteDetalhado {
  pessoa: ClienteDetalhadoPessoa;
  folha: {
    atual: FolhaAtual | null;
    historico: any[];
  };
  contratos: Contrato[];
}

interface ClientInteraction {
  id: number;
  tipoContato: string;
  leadMarker: string;
  observacao: string | null;
  createdAt: string;
  userName: string;
  campaignName: string;
}

const MARKERS_REQUIRING_MOTIVO: LeadMarker[] = ["NAO_ATENDE", "TELEFONE_INVALIDO", "ENGANO", "SEM_INTERESSE"];
const MARKERS_REQUIRING_RETORNO: LeadMarker[] = ["AGUARDANDO_RETORNO", "RETORNAR_DEPOIS"];

function formatCPF(cpf: string | null): string {
  if (!cpf) return "-";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "MMM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
}

function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "-";
  }
}

function CopyButton({ value, label, onCopy }: { value: string | null | undefined; label: string; onCopy: (text: string, label: string) => void }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy(value, label);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  
  if (!value) return null;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={handleCopy}
      data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

export default function CrmConsultaCliente() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchType, setSearchType] = useState<"cpf" | "matricula">("cpf");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConvenio, setSelectedConvenio] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ConsultaResultado[] | null>(null);
  const [selectedPessoaId, setSelectedPessoaId] = useState<number | null>(null);
  const [atendimentoDialogOpen, setAtendimentoDialogOpen] = useState(false);
  const [interactionFormData, setInteractionFormData] = useState({
    tipoContato: "ligacao" as typeof TIPOS_CONTATO_LEAD[number],
    leadMarker: "EM_ATENDIMENTO" as LeadMarker,
    telefoneUsado: "",
    motivo: "",
    observacao: "",
    retornoEm: "",
    margemValor: "",
    propostaValorEstimado: "",
  });

  const handleCopy = (text: string, label: string) => {
    toast({ title: "Copiado!", description: `${label} copiado.` });
  };

  const { data: conveniosDisponiveis } = useQuery<string[]>({
    queryKey: ["/api/clientes/filtros/convenios"],
  });

  const { data: clienteDetalhado, isLoading: isLoadingDetails } = useQuery<ClienteDetalhado>({
    queryKey: ["/api/clientes", selectedPessoaId],
    enabled: !!selectedPessoaId,
  });

  const { data: clientInteractions = [] } = useQuery<ClientInteraction[]>({
    queryKey: ["/api/crm/cliente", selectedPessoaId, "interactions"],
    enabled: !!selectedPessoaId,
  });

  const { data: campanhasAtivas } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["/api/vendas/campanhas/ativas"],
  });

  const { data: clientPipeline } = useQuery<{ leadId: number; campaignName: string; leadMarker: string }[]>({
    queryKey: ["/api/crm/cliente", selectedPessoaId, "pipeline"],
    enabled: !!selectedPessoaId,
  });

  const markerRequiresMotivo = MARKERS_REQUIRING_MOTIVO.includes(interactionFormData.leadMarker);
  const markerRequiresRetorno = MARKERS_REQUIRING_RETORNO.includes(interactionFormData.leadMarker);

  const registrarAtendimentoMutation = useMutation({
    mutationFn: async (data: typeof interactionFormData & { pessoaId: number }) => {
      const res = await apiRequest("POST", "/api/crm/consulta/registrar-atendimento", {
        pessoaId: data.pessoaId,
        tipoContato: data.tipoContato,
        leadMarker: data.leadMarker,
        telefoneUsado: data.telefoneUsado || null,
        motivo: data.motivo || null,
        observacao: data.observacao || null,
        retornoEm: data.retornoEm || null,
        margemValor: data.margemValor ? parseFloat(data.margemValor) : null,
        propostaValorEstimado: data.propostaValorEstimado ? parseFloat(data.propostaValorEstimado) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Atendimento registrado!", description: `Status: ${LEAD_MARKER_LABELS[interactionFormData.leadMarker]}` });
      setAtendimentoDialogOpen(false);
      resetInteractionForm();
      queryClient.invalidateQueries({ queryKey: ["/api/crm/cliente", selectedPessoaId, "interactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/cliente", selectedPessoaId, "pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/pipeline"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    },
  });

  const criarLeadMutation = useMutation({
    mutationFn: async ({ pessoaId, campaignId }: { pessoaId: number; campaignId: number }) => {
      const res = await apiRequest("POST", "/api/crm/cliente/criar-lead", { pessoaId, campaignId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Lead criado!", description: "Cliente adicionado à campanha." });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/cliente", selectedPessoaId, "pipeline"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar lead", description: error.message, variant: "destructive" });
    },
  });

  const resetInteractionForm = () => {
    setInteractionFormData({
      tipoContato: "ligacao",
      leadMarker: "EM_ATENDIMENTO",
      telefoneUsado: "",
      motivo: "",
      observacao: "",
      retornoEm: "",
      margemValor: "",
      propostaValorEstimado: "",
    });
  };

  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (!term) {
      toast({ title: "Campo obrigatório", description: `Informe ${searchType === "cpf" ? "o CPF" : "a matrícula"}.`, variant: "destructive" });
      return;
    }

    const convenioValue = selectedConvenio && selectedConvenio !== "__all__" ? selectedConvenio : "";
    if (searchType === "matricula" && !convenioValue) {
      toast({ title: "Convênio obrigatório", description: "Para buscar por matrícula, selecione o convênio.", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    setSearchResults(null);
    setSelectedPessoaId(null);

    try {
      const queryParams = new URLSearchParams();
      if (searchType === "cpf") {
        queryParams.set("cpf", term);
      } else {
        queryParams.set("matricula", term);
      }
      if (convenioValue) {
        queryParams.set("convenio", convenioValue);
      }

      const response = await fetch(`/api/clientes/consulta?${queryParams.toString()}`, { credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao consultar");
      }

      const data: ConsultaResponse = await response.json();
      setSearchResults(data.resultados);

      if (data.resultados.length === 1) {
        setSelectedPessoaId(data.resultados[0].pessoa_id);
      } else if (data.resultados.length === 0) {
        toast({ title: "Nenhum cliente encontrado", description: "Verifique os dados informados." });
      }
    } catch (error: any) {
      toast({ title: "Erro na consulta", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleRegistrarAtendimento = () => {
    if (markerRequiresMotivo && !interactionFormData.motivo.trim()) {
      toast({ title: "Informe o motivo", variant: "destructive" });
      return;
    }
    if (markerRequiresRetorno && !interactionFormData.retornoEm) {
      toast({ title: "Agende o retorno", variant: "destructive" });
      return;
    }
    if (!interactionFormData.margemValor || parseFloat(interactionFormData.margemValor) <= 0) {
      toast({ title: "Informe a margem", variant: "destructive" });
      return;
    }
    if (!interactionFormData.propostaValorEstimado || parseFloat(interactionFormData.propostaValorEstimado) <= 0) {
      toast({ title: "Informe a proposta", variant: "destructive" });
      return;
    }
    if (!selectedPessoaId) return;

    registrarAtendimentoMutation.mutate({ ...interactionFormData, pessoaId: selectedPessoaId });
  };

  const telefones = clienteDetalhado?.pessoa?.telefones_base || [];

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Consulta de Cliente</h1>
          <p className="text-sm text-muted-foreground">Central de decisão comercial para crédito consignado</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <Tabs value={searchType} onValueChange={(v) => setSearchType(v as "cpf" | "matricula")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="cpf" data-testid="tab-cpf">CPF</TabsTrigger>
                  <TabsTrigger value="matricula" data-testid="tab-matricula">Matrícula</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex-1">
              <Select value={selectedConvenio} onValueChange={setSelectedConvenio}>
                <SelectTrigger data-testid="select-convenio">
                  <SelectValue placeholder="Convênio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {conveniosDisponiveis?.map((conv) => (
                    <SelectItem key={conv} value={conv}>{conv}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 flex gap-2">
              <Input
                placeholder={searchType === "cpf" ? "000.000.000-00" : "Matrícula"}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                data-testid="input-search-term"
              />
              <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Buscando...</span>
        </div>
      )}

      {searchResults && searchResults.length > 1 && !selectedPessoaId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Múltiplos Resultados ({searchResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {searchResults.map((resultado) => (
                <div
                  key={resultado.pessoa_id}
                  className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer"
                  onClick={() => setSelectedPessoaId(resultado.pessoa_id)}
                  data-testid={`card-resultado-${resultado.pessoa_id}`}
                >
                  <div>
                    <p className="font-medium">{resultado.nome || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">
                      Mat: {resultado.matricula} | {resultado.convenio} | {resultado.sit_func}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" data-testid={`button-ver-${resultado.pessoa_id}`}>Ver</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedPessoaId && (
        <>
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : clienteDetalhado ? (
            <div className="space-y-4">
              {searchResults && searchResults.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedPessoaId(null)} data-testid="button-voltar">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
              )}

              {/* BLOCO 1 - Identificação do Cliente */}
              <Card data-testid="bloco-identificacao">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Identificação
                    </CardTitle>
                    <div className="flex gap-1">
                      <CopyButton value={clienteDetalhado.pessoa.cpf?.replace(/\D/g, "")} label="CPF" onCopy={handleCopy} />
                      {telefones[0] && <CopyButton value={telefones[0]} label="Telefone" onCopy={handleCopy} />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nome</p>
                      <p className="font-medium" data-testid="text-nome">{clienteDetalhado.pessoa.nome || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CPF</p>
                      <p className="font-medium" data-testid="text-cpf">{formatCPF(clienteDetalhado.pessoa.cpf)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Matrícula</p>
                      <p className="font-medium" data-testid="text-matricula">{clienteDetalhado.pessoa.matricula}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Convênio</p>
                      <p className="font-medium" data-testid="text-convenio">{clienteDetalhado.pessoa.convenio || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Situação Funcional</p>
                      <p className="font-medium" data-testid="text-sit-func">{clienteDetalhado.pessoa.sit_func || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">UF</p>
                      <p className="font-medium">{clienteDetalhado.pessoa.uf || "-"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Telefones</p>
                      <div className="flex flex-wrap gap-2">
                        {telefones.length > 0 ? telefones.map((tel, idx) => (
                          <span key={idx} className="font-medium">{tel}</span>
                        )) : <span className="text-muted-foreground">-</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* BLOCO 2 - Resumo Financeiro Atual */}
              <Card data-testid="bloco-financeiro">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resumo Financeiro Atual</CardTitle>
                </CardHeader>
                <CardContent>
                  {clienteDetalhado.folha.atual ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Margem Empréstimo</p>
                        <p className="font-medium text-green-600" data-testid="text-margem-emprestimo">
                          {formatCurrency(clienteDetalhado.folha.atual.margem_saldo_35)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Margem Cartão</p>
                        <p className="font-medium text-green-600" data-testid="text-margem-cartao">
                          {formatCurrency(clienteDetalhado.folha.atual.margem_cartao_credito_saldo)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Margem 5%</p>
                        <p className="font-medium text-green-600" data-testid="text-margem-5">
                          {formatCurrency(clienteDetalhado.folha.atual.margem_cartao_beneficio_saldo)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Salário Bruto</p>
                        <p className="font-medium" data-testid="text-salario-bruto">
                          {formatCurrency(clienteDetalhado.folha.atual.salario_bruto)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Salário Líquido</p>
                        <p className="font-medium" data-testid="text-salario-liquido">
                          {formatCurrency(clienteDetalhado.folha.atual.salario_liquido)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fonte / Atualização</p>
                        <p className="font-medium text-xs" data-testid="text-fonte">
                          {clienteDetalhado.folha.atual.base_tag || "-"} | {formatDate(clienteDetalhado.folha.atual.competencia)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Nenhum dado de folha disponível.</p>
                  )}
                </CardContent>
              </Card>

              {/* BLOCO 3 - Contratos Ativos */}
              <Card data-testid="bloco-contratos">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Contratos Ativos ({clienteDetalhado.contratos.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {clienteDetalhado.contratos.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Banco</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Prazo Restante</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clienteDetalhado.contratos.map((contrato) => (
                          <TableRow key={contrato.id} data-testid={`row-contrato-${contrato.id}`}>
                            <TableCell className="font-medium">{contrato.banco || "-"}</TableCell>
                            <TableCell>{contrato.tipo_contrato || "-"}</TableCell>
                            <TableCell>{formatCurrency(contrato.valor_parcela)}</TableCell>
                            <TableCell>{contrato.parcelas_restantes ?? "-"} parcelas</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">Ativo</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-sm">Nenhum contrato registrado.</p>
                  )}
                </CardContent>
              </Card>

              {/* BLOCO 4 - Histórico Comercial */}
              <Card data-testid="bloco-historico">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Histórico Comercial
                    </CardTitle>
                    <Dialog open={atendimentoDialogOpen} onOpenChange={setAtendimentoDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-registrar-atendimento">
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Registrar Atendimento
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Registrar Atendimento</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Tipo de Contato</Label>
                              <Select
                                value={interactionFormData.tipoContato}
                                onValueChange={(v) => setInteractionFormData({ ...interactionFormData, tipoContato: v as any })}
                              >
                                <SelectTrigger data-testid="select-tipo-contato">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIPOS_CONTATO_LEAD.map((t) => (
                                    <SelectItem key={t} value={t}>{t === "ligacao" ? "Ligação" : t === "whatsapp" ? "WhatsApp" : "Outro"}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Status</Label>
                              <Select
                                value={interactionFormData.leadMarker}
                                onValueChange={(v) => setInteractionFormData({ ...interactionFormData, leadMarker: v as LeadMarker })}
                              >
                                <SelectTrigger data-testid="select-lead-marker">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {LEAD_MARKERS.map((m) => (
                                    <SelectItem key={m} value={m}>{LEAD_MARKER_LABELS[m]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {telefones.length > 0 && (
                            <div>
                              <Label>Telefone Usado</Label>
                              <Select
                                value={interactionFormData.telefoneUsado}
                                onValueChange={(v) => setInteractionFormData({ ...interactionFormData, telefoneUsado: v })}
                              >
                                <SelectTrigger data-testid="select-telefone">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {telefones.map((tel, idx) => (
                                    <SelectItem key={idx} value={tel}>{tel}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Margem (R$)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={interactionFormData.margemValor}
                                onChange={(e) => setInteractionFormData({ ...interactionFormData, margemValor: e.target.value })}
                                placeholder="0,00"
                                data-testid="input-margem"
                              />
                            </div>
                            <div>
                              <Label>Proposta (R$)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={interactionFormData.propostaValorEstimado}
                                onChange={(e) => setInteractionFormData({ ...interactionFormData, propostaValorEstimado: e.target.value })}
                                placeholder="0,00"
                                data-testid="input-proposta"
                              />
                            </div>
                          </div>

                          {markerRequiresMotivo && (
                            <div>
                              <Label>Motivo</Label>
                              <Input
                                value={interactionFormData.motivo}
                                onChange={(e) => setInteractionFormData({ ...interactionFormData, motivo: e.target.value })}
                                placeholder="Informe o motivo"
                                data-testid="input-motivo"
                              />
                            </div>
                          )}

                          {markerRequiresRetorno && (
                            <div>
                              <Label>Data de Retorno</Label>
                              <Input
                                type="datetime-local"
                                value={interactionFormData.retornoEm}
                                onChange={(e) => setInteractionFormData({ ...interactionFormData, retornoEm: e.target.value })}
                                data-testid="input-retorno"
                              />
                            </div>
                          )}

                          <div>
                            <Label>Observação</Label>
                            <Textarea
                              value={interactionFormData.observacao}
                              onChange={(e) => setInteractionFormData({ ...interactionFormData, observacao: e.target.value })}
                              placeholder="Observações sobre o atendimento..."
                              rows={2}
                              data-testid="input-observacao"
                            />
                          </div>

                          <Button
                            className="w-full"
                            onClick={handleRegistrarAtendimento}
                            disabled={registrarAtendimentoMutation.isPending}
                            data-testid="button-confirmar-atendimento"
                          >
                            {registrarAtendimentoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Confirmar Atendimento
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {clientInteractions.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {clientInteractions.map((interaction) => (
                        <div key={interaction.id} className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3" data-testid={`interaction-${interaction.id}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{LEAD_MARKER_LABELS[interaction.leadMarker as LeadMarker] || interaction.leadMarker}</Badge>
                              <span className="text-muted-foreground text-xs">{interaction.tipoContato}</span>
                            </div>
                            {interaction.observacao && <p className="text-muted-foreground mt-1">{interaction.observacao}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                              {interaction.userName} | {interaction.campaignName} | {formatDateFull(interaction.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Nenhuma interação registrada.</p>
                  )}
                </CardContent>
              </Card>

              {/* BLOCO 5 - Ações Comerciais */}
              <Card data-testid="bloco-acoes">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Ações Comerciais</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full" data-testid="button-criar-lead">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Criar Lead
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Criar Lead para Campanha</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">Selecione a campanha para adicionar este cliente como lead:</p>
                          {campanhasAtivas && campanhasAtivas.length > 0 ? (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {campanhasAtivas.map((camp) => (
                                <Button
                                  key={camp.id}
                                  variant="outline"
                                  className="w-full justify-start"
                                  onClick={() => criarLeadMutation.mutate({ pessoaId: selectedPessoaId!, campaignId: camp.id })}
                                  disabled={criarLeadMutation.isPending}
                                  data-testid={`button-campanha-${camp.id}`}
                                >
                                  {camp.nome}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm">Nenhuma campanha ativa disponível.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button variant="outline" className="w-full" onClick={() => setAtendimentoDialogOpen(true)} data-testid="button-enviar-pipeline">
                      <Send className="w-4 h-4 mr-2" />
                      Enviar p/ Pipeline
                    </Button>

                    <Button variant="outline" className="w-full" disabled data-testid="button-criar-campanha">
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Campanha
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full" data-testid="button-ver-pipeline">
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Pipeline
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Pipeline do Cliente</DialogTitle>
                        </DialogHeader>
                        {clientPipeline && clientPipeline.length > 0 ? (
                          <div className="space-y-2">
                            {clientPipeline.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 border rounded text-sm">
                                <span>{item.campaignName}</span>
                                <Badge variant="outline">{LEAD_MARKER_LABELS[item.leadMarker as LeadMarker] || item.leadMarker}</Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">Cliente não está em nenhum pipeline ativo.</p>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                <p>Não foi possível carregar os detalhes do cliente.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {searchResults && searchResults.length === 0 && !isSearching && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            <p>Nenhum cliente encontrado. Verifique os dados e tente novamente.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
