import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Check
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
  agencia: string | null;
  conta: string | null;
  base_tag_ultima: string | null;
  extras_pessoa: any;
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
  higienizacao: null;
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
    return format(new Date(dateStr), "MMM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
}

function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
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

// Componente para dados copiáveis com tooltip - não usa hooks internos
function CopyableField({ 
  value, 
  displayValue, 
  label,
  onCopy 
}: { 
  value: string | null | undefined; 
  displayValue?: string;
  label?: string;
  onCopy?: (text: string, label?: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (onCopy) onCopy(value, label);
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

export default function ConsultaCliente() {
  const { toast } = useToast();
  const [searchType, setSearchType] = useState<"cpf" | "matricula">("cpf");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConvenio, setSelectedConvenio] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ConsultaResultado[] | null>(null);
  const [selectedPessoaId, setSelectedPessoaId] = useState<number | null>(null);
  const [selectedVinculoId, setSelectedVinculoId] = useState<number | null>(null);
  const [showExcModal, setShowExcModal] = useState(false);

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
  
  // Auto-sincronizar o vínculo selecionado com o retornado pelo backend
  useEffect(() => {
    if (clienteDetalhado?.vinculo_selecionado && !selectedVinculoId) {
      // Se o backend retornou um vínculo selecionado e não temos um local, usar o do backend
      setSelectedVinculoId(clienteDetalhado.vinculo_selecionado);
    }
  }, [clienteDetalhado?.vinculo_selecionado, selectedVinculoId]);

  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (!term) {
      toast({
        title: "Campo obrigatório",
        description: `Informe ${searchType === "cpf" ? "o CPF" : "a matrícula"} para consultar.`,
        variant: "destructive",
      });
      return;
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
      } else {
        queryParams.set("matricula", term);
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
          description: `Não encontramos clientes com ${searchType === "cpf" ? "o CPF" : "a matrícula"} informado${convenioMsg}.`,
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
                <Tabs value={searchType} onValueChange={(v) => setSearchType(v as "cpf" | "matricula")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="cpf" data-testid="tab-cpf">
                      Buscar por CPF
                    </TabsTrigger>
                    <TabsTrigger value="matricula" data-testid="tab-matricula">
                      Buscar por Matrícula
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
                  {searchType === "cpf" ? "CPF" : "Matrícula"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="search-term"
                    placeholder={searchType === "cpf" ? "000.000.000-00" : "Digite a matrícula"}
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
              Encontramos {searchResults.length} matrículas para este CPF. Selecione qual deseja visualizar.
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
                          <p className="text-sm text-muted-foreground truncate max-w-md">{resultado.orgao}</p>
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
            // VARIÁVEL CENTRALIZADA: folhaAtual - usar em TUDO (cards, EXC, debug)
            // ═══════════════════════════════════════════════════════════════════════════
            const folhaAtual = clienteDetalhado?.folha?.atual ?? null;
            
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
                          <span className="font-medium">{vinculo.orgao}</span>
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1 group">
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium" data-testid="text-nome">
                        <CopyableField value={clienteDetalhado.pessoa.nome} label="Nome" onCopy={handleCopy} />
                      </p>
                    </div>
                    <div className="space-y-1 group">
                      <p className="text-sm text-muted-foreground">CPF</p>
                      <p className="font-mono" data-testid="text-cpf">
                        <CopyableField 
                          value={clienteDetalhado.pessoa.cpf} 
                          displayValue={formatCPF(clienteDetalhado.pessoa.cpf)} 
                          label="CPF" 
                          onCopy={handleCopy}
                        />
                      </p>
                    </div>
                    <div className="space-y-1 group">
                      <p className="text-sm text-muted-foreground">Matrícula</p>
                      <p className="font-mono" data-testid="text-matricula">
                        <CopyableField value={vinculoAtual?.matricula || clienteDetalhado.pessoa.matricula} label="Matrícula" onCopy={handleCopy} />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Convênio</p>
                      <Badge variant="outline">{clienteDetalhado.pessoa.convenio || "-"}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Situação Funcional</p>
                      <Badge variant="secondary">{vinculoAtual?.sit_func || clienteDetalhado.pessoa.sit_func || "-"}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Natureza</p>
                      <p>{clienteDetalhado.pessoa.natureza || "-"}</p>
                    </div>
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
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">UPAG</p>
                      <p>{vinculoAtual?.upag || clienteDetalhado.pessoa.upag || "-"}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        Órgão
                      </p>
                      <p>{vinculoAtual?.orgao || clienteDetalhado.pessoa.orgao || "-"}</p>
                      {clienteDetalhado.pessoa.orgaocod && (
                        <p className="text-xs text-muted-foreground">Código: {clienteDetalhado.pessoa.orgaocod}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Regime Jurídico (REJUR)</p>
                      <p>{vinculoAtual?.rjur || clienteDetalhado.pessoa.rjur || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Localização
                      </p>
                      <p>
                        {[clienteDetalhado.pessoa.municipio, clienteDetalhado.pessoa.uf].filter(Boolean).join(" - ") || "-"}
                      </p>
                    </div>
                    
                    {/* Telefones - empilhados verticalmente */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        Telefones
                      </p>
                      <div className="flex flex-col gap-1">
                        {clienteDetalhado.pessoa.telefones_base && clienteDetalhado.pessoa.telefones_base.length > 0 ? (
                          clienteDetalhado.pessoa.telefones_base.map((tel, idx) => (
                            <div key={idx} className="group">
                              <CopyableField value={tel} label={`Telefone ${idx + 1}`} onCopy={handleCopy} />
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">Nenhum telefone</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Dados Bancários do cliente (onde recebe salário) */}
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Landmark className="w-4 h-4" />
                        Dados Bancários
                      </p>
                      {clienteDetalhado.pessoa.banco_codigo || clienteDetalhado.pessoa.agencia || clienteDetalhado.pessoa.conta ? (
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="group">
                            <span className="text-muted-foreground">Banco: </span>
                            <CopyableField value={clienteDetalhado.pessoa.banco_codigo} label="Banco" onCopy={handleCopy} />
                          </div>
                          <div className="group">
                            <span className="text-muted-foreground">Ag: </span>
                            <CopyableField value={clienteDetalhado.pessoa.agencia} label="Agência" onCopy={handleCopy} />
                          </div>
                          <div className="group">
                            <span className="text-muted-foreground">Conta: </span>
                            <CopyableField value={clienteDetalhado.pessoa.conta} label="Conta" onCopy={handleCopy} />
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Dados bancários não informados</p>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Última Base</p>
                      <Badge>{clienteDetalhado.pessoa.base_tag_ultima || "-"}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ═══════════════════════════════════════════════════════════════════════════
                  DEBUG BLOCK - REMOVER APÓS DIAGNÓSTICO
                  ═══════════════════════════════════════════════════════════════════════════ */}
              {folhaAtual && (() => {
                const excQtd = folhaAtual.exc_qtd;
                const excSoma = folhaAtual.exc_soma;
                const margemReal = folhaAtual.margem;
                const showAlert = ((excQtd ?? 0) > 0 || (excSoma ?? 0) > 0);
                return (
                  <div style={{ background: 'yellow', color: 'black', padding: '10px', marginBottom: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
                    <strong>DEBUG EXC:</strong><br/>
                    exc_qtd: {String(excQtd)} (typeof: {typeof excQtd})<br/>
                    exc_soma: {String(excSoma)} (typeof: {typeof excSoma})<br/>
                    margem: {String(margemReal)} (typeof: {typeof margemReal})<br/>
                    (excQtd ?? 0) &gt; 0: {String((excQtd ?? 0) > 0)}<br/>
                    (excSoma ?? 0) &gt; 0: {String((excSoma ?? 0) > 0)}<br/>
                    <strong>showAlert: {String(showAlert)}</strong>
                  </div>
                );
              })()}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Situação de Folha
                  </CardTitle>
                  <CardDescription>
                    {folhaAtual 
                      ? `Competência mais recente: ${formatDate(folhaAtual.competencia)}`
                      : "Nenhum dado de folha disponível"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {folhaAtual ? (
                    <div className="space-y-6">
                      {/* ═══════════════════════════════════════════════════════════════════════════
                          DESCONTO FORA DE FOLHA (EXC) - Alerta Visual
                          ═══════════════════════════════════════════════════════════════════════════ */}
                      {((folhaAtual.exc_qtd ?? 0) > 0 || (folhaAtual.exc_soma ?? 0) > 0) && (
                        <Alert 
                          variant="destructive" 
                          className="border-2 border-red-500 bg-red-50 dark:bg-red-950 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900 transition-colors" 
                          data-testid="alert-exc-fora-folha"
                          onClick={() => setShowExcModal(true)}
                        >
                          <AlertTriangle className="h-5 w-5" />
                          <AlertTitle className="text-lg font-bold">Cliente com desconto fora de folha</AlertTitle>
                          <AlertDescription className="flex gap-4 mt-2">
                            <span className="text-sm">Clique para ver detalhes</span>
                          </AlertDescription>
                        </Alert>
                      )}
                      
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
                                <p className="text-2xl font-bold">{folhaAtual.exc_qtd ?? 0}</p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <p className="text-sm text-muted-foreground">EXC Soma</p>
                                <p className="text-2xl font-bold">{formatCurrency(folhaAtual.exc_soma)}</p>
                              </div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                              <p className="text-sm text-muted-foreground">Margem real (após desconto fora de folha)</p>
                              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                                {formatCurrency(folhaAtual.margem)}
                              </p>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Margem 70% - Compulsória (SIAPE) */}
                        <Card className="bg-muted/50" data-testid="card-margem-70">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Margem 70%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(folhaAtual.margem_bruta_70)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(folhaAtual.margem_utilizada_70)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className="text-green-600">{formatCurrency(folhaAtual.margem_saldo_70)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Margem 35% - Consignado */}
                        <Card className="bg-muted/50" data-testid="card-margem-35">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Margem 35%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(folhaAtual.margem_bruta_35)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(folhaAtual.margem_utilizada_35)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className="text-green-600">{formatCurrency(folhaAtual.margem_saldo_35)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Margem 5% - Cartão Crédito Consignado */}
                        <Card className="bg-muted/50" data-testid="card-margem-5">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Margem 5%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(folhaAtual.margem_bruta_5)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(folhaAtual.margem_utilizada_5)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className="text-green-600">{formatCurrency(folhaAtual.margem_saldo_5)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Margem Benefício 5% - Cartão Benefício */}
                        <Card className="bg-muted/50" data-testid="card-margem-beneficio-5">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Benefício 5%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(folhaAtual.margem_beneficio_bruta_5)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(folhaAtual.margem_beneficio_utilizada_5)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className="text-green-600">{formatCurrency(folhaAtual.margem_beneficio_saldo_5)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>


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

                      {clienteDetalhado.folha.historico.length > 0 && (
                        <Accordion type="single" collapsible>
                          <AccordionItem value="historico">
                            <AccordionTrigger className="text-sm">
                              <Calendar className="w-4 h-4 mr-2" />
                              Ver histórico de folha ({clienteDetalhado.folha.historico.length} meses)
                            </AccordionTrigger>
                            <AccordionContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Competência</TableHead>
                                    <TableHead>70%</TableHead>
                                    <TableHead>35%</TableHead>
                                    <TableHead>5%</TableHead>
                                    <TableHead>Benef. 5%</TableHead>
                                    <TableHead>Líquido</TableHead>
                                    <TableHead>Base</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {clienteDetalhado.folha.historico.map((f, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{formatDate(f.competencia)}</TableCell>
                                      <TableCell>{formatCurrency(f.margem_saldo_70)}</TableCell>
                                      <TableCell>{formatCurrency(f.margem_saldo_35)}</TableCell>
                                      <TableCell>{formatCurrency(f.margem_saldo_5)}</TableCell>
                                      <TableCell>{formatCurrency(f.margem_beneficio_saldo_5)}</TableCell>
                                      <TableCell>{formatCurrency(f.liquido)}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-xs">{f.base_tag}</Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum dado de folha disponível para este cliente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Contratos
                  </CardTitle>
                  <CardDescription>
                    {clienteDetalhado.contratos.length > 0 
                      ? `${clienteDetalhado.contratos.length} contrato(s) encontrado(s)`
                      : "Nenhum contrato registrado"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {clienteDetalhado.contratos.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Banco do Empréstimo</TableHead>
                          <TableHead>Nº Contrato</TableHead>
                          <TableHead>Valor Parcela</TableHead>
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
                                {contrato.tipo_contrato || "N/D"}
                              </Badge>
                            </TableCell>
                            <TableCell className="group">
                              <CopyableField value={contrato.banco} label="Banco do Empréstimo" onCopy={handleCopy} />
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
                            <TableCell className="group">
                              <CopyableField 
                                value={contrato.saldo_devedor?.toString()} 
                                displayValue={formatCurrency(contrato.saldo_devedor)}
                                label="Saldo Devedor" 
                                onCopy={handleCopy}
                              />
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

              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="w-5 h-5" />
                    Dados de Contato / Higienização
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">Higienização ainda não configurada. (Parte 3 do projeto)</p>
                    <Button disabled data-testid="button-higienizacao">
                      <Lock className="w-4 h-4 mr-2" />
                      Consultar dados externos (Lemit)
                    </Button>
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
            <p>Nenhum cliente encontrado para {searchType === "cpf" ? "o CPF" : "a matrícula"} informado.</p>
            <p className="text-sm mt-2">Verifique os dados e tente novamente.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
