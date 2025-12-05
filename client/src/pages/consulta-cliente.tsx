import { useState } from "react";
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
  Wallet,
  Calendar,
  Lock
} from "lucide-react";
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
  natureza: string | null;
  sit_func: string | null;
  uf: string | null;
  municipio: string | null;
  telefones_base: string[] | null;
  base_tag_ultima: string | null;
  extras_pessoa: any;
}

interface FolhaAtual {
  competencia: string;
  margem_bruta_30: number | null;
  margem_utilizada_30: number | null;
  margem_saldo_30: number | null;
  margem_bruta_35: number | null;
  margem_utilizada_35: number | null;
  margem_saldo_35: number | null;
  margem_bruta_70: number | null;
  margem_utilizada_70: number | null;
  margem_saldo_70: number | null;
  creditos: number | null;
  debitos: number | null;
  liquido: number | null;
  base_tag: string | null;
  extras_folha: any;
}

interface FolhaHistorico {
  competencia: string;
  margem_saldo_30: number | null;
  liquido: number | null;
  base_tag: string | null;
}

interface Contrato {
  id: number;
  tipo_contrato: string | null;
  banco: string | null;
  valor_parcela: number | null;
  competencia: string | null;
  base_tag: string | null;
  dados_brutos: any;
}

interface ClienteDetalhado {
  pessoa: ClienteDetalhadoPessoa;
  folha: {
    atual: FolhaAtual | null;
    historico: FolhaHistorico[];
  };
  contratos: Contrato[];
  higienizacao: null;
}

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

export default function ConsultaCliente() {
  const { toast } = useToast();
  const [searchType, setSearchType] = useState<"cpf" | "matricula">("cpf");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ConsultaResultado[] | null>(null);
  const [selectedPessoaId, setSelectedPessoaId] = useState<number | null>(null);

  const { data: clienteDetalhado, isLoading: isLoadingDetails } = useQuery<ClienteDetalhado>({
    queryKey: ["/api/clientes", selectedPessoaId],
    enabled: !!selectedPessoaId,
  });

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

    setIsSearching(true);
    setSearchResults(null);
    setSelectedPessoaId(null);

    try {
      const queryParam = searchType === "cpf" ? `cpf=${encodeURIComponent(term)}` : `matricula=${encodeURIComponent(term)}`;
      const response = await fetch(`/api/clientes/consulta?${queryParam}`, {
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
        toast({
          title: "Nenhum cliente encontrado",
          description: `Não encontramos clientes com ${searchType === "cpf" ? "o CPF" : "a matrícula"} informado.`,
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
  };

  const handleBackToResults = () => {
    setSelectedPessoaId(null);
  };

  const handleNewSearch = () => {
    setSearchResults(null);
    setSelectedPessoaId(null);
    setSearchTerm("");
  };

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
          ) : clienteDetalhado ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium" data-testid="text-nome">{clienteDetalhado.pessoa.nome || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">CPF</p>
                      <p className="font-mono" data-testid="text-cpf">{formatCPF(clienteDetalhado.pessoa.cpf)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Matrícula</p>
                      <p className="font-mono" data-testid="text-matricula">{clienteDetalhado.pessoa.matricula}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Convênio</p>
                      <Badge variant="outline">{clienteDetalhado.pessoa.convenio || "-"}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Situação Funcional</p>
                      <Badge variant="secondary">{clienteDetalhado.pessoa.sit_func || "-"}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Natureza</p>
                      <p>{clienteDetalhado.pessoa.natureza || "-"}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        Órgão
                      </p>
                      <p>{clienteDetalhado.pessoa.orgao || "-"}</p>
                      {clienteDetalhado.pessoa.orgaocod && (
                        <p className="text-xs text-muted-foreground">Código: {clienteDetalhado.pessoa.orgaocod}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Unidade Pagadora</p>
                      <p>{clienteDetalhado.pessoa.undpagadoradesc || "-"}</p>
                      {clienteDetalhado.pessoa.undpagadoracod && (
                        <p className="text-xs text-muted-foreground">Código: {clienteDetalhado.pessoa.undpagadoracod}</p>
                      )}
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
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        Telefones da Base
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {clienteDetalhado.pessoa.telefones_base && clienteDetalhado.pessoa.telefones_base.length > 0 ? (
                          clienteDetalhado.pessoa.telefones_base.map((tel, idx) => (
                            <Badge key={idx} variant="outline">{tel}</Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">Nenhum telefone cadastrado</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Última Base</p>
                      <Badge>{clienteDetalhado.pessoa.base_tag_ultima || "-"}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Situação de Folha
                  </CardTitle>
                  <CardDescription>
                    {clienteDetalhado.folha.atual 
                      ? `Competência mais recente: ${formatDate(clienteDetalhado.folha.atual.competencia)}`
                      : "Nenhum dado de folha disponível"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {clienteDetalhado.folha.atual ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-muted/50">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Margem 30%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(clienteDetalhado.folha.atual.margem_bruta_30)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(clienteDetalhado.folha.atual.margem_utilizada_30)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className="text-green-600">{formatCurrency(clienteDetalhado.folha.atual.margem_saldo_30)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/50">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Margem 35%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(clienteDetalhado.folha.atual.margem_bruta_35)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(clienteDetalhado.folha.atual.margem_utilizada_35)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className="text-green-600">{formatCurrency(clienteDetalhado.folha.atual.margem_saldo_35)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/50">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium mb-2">Margem 70%</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bruta:</span>
                                <span>{formatCurrency(clienteDetalhado.folha.atual.margem_bruta_70)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Utilizada:</span>
                                <span>{formatCurrency(clienteDetalhado.folha.atual.margem_utilizada_70)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Saldo:</span>
                                <span className="text-green-600">{formatCurrency(clienteDetalhado.folha.atual.margem_saldo_70)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Créditos</p>
                          <p className="text-lg font-semibold text-green-600">{formatCurrency(clienteDetalhado.folha.atual.creditos)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Débitos</p>
                          <p className="text-lg font-semibold text-red-600">{formatCurrency(clienteDetalhado.folha.atual.debitos)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Líquido</p>
                          <p className="text-lg font-semibold">{formatCurrency(clienteDetalhado.folha.atual.liquido)}</p>
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
                                    <TableHead>Saldo 30%</TableHead>
                                    <TableHead>Líquido</TableHead>
                                    <TableHead>Base</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {clienteDetalhado.folha.historico.map((f, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{formatDate(f.competencia)}</TableCell>
                                      <TableCell>{formatCurrency(f.margem_saldo_30)}</TableCell>
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
                          <TableHead>Banco</TableHead>
                          <TableHead>Valor Parcela</TableHead>
                          <TableHead>Competência</TableHead>
                          <TableHead>Base</TableHead>
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
                            <TableCell>{contrato.banco || "-"}</TableCell>
                            <TableCell>{formatCurrency(contrato.valor_parcela)}</TableCell>
                            <TableCell>{formatDate(contrato.competencia)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{contrato.base_tag || "-"}</Badge>
                            </TableCell>
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
          ) : (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Não foi possível carregar os detalhes do cliente.</p>
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
