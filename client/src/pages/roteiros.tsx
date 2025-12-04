import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Upload, Search, ChevronDown, ChevronUp, ExternalLink, FileText, AlertCircle, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RoteiroBancario, RoteiroDados } from "@shared/schema";

export default function RoteirosPage() {
  const { toast } = useToast();
  const [selectedRoteiro, setSelectedRoteiro] = useState<RoteiroBancario | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [searchConvenio, setSearchConvenio] = useState<string>("");
  const [searchTipoOperacao, setSearchTipoOperacao] = useState<string>("");
  const [searchIdade, setSearchIdade] = useState<string>("");
  const [isSearchMode, setIsSearchMode] = useState(false);

  const { data: roteiros = [], isLoading } = useQuery<RoteiroBancario[]>({
    queryKey: ["/api/roteiros"],
  });

  const { data: convenios = [] } = useQuery<string[]>({
    queryKey: ["/api/roteiros/filters/convenios"],
  });

  const { data: tiposOperacao = [] } = useQuery<string[]>({
    queryKey: ["/api/roteiros/filters/tipos-operacao"],
  });

  const searchQuery = useQuery<RoteiroBancario[]>({
    queryKey: ["/api/roteiros/search", searchConvenio, searchTipoOperacao, searchIdade],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchConvenio && searchConvenio !== "all") params.set("convenio", searchConvenio);
      if (searchTipoOperacao && searchTipoOperacao !== "all") params.set("tipoOperacao", searchTipoOperacao);
      if (searchIdade) params.set("idade", searchIdade);
      
      const res = await fetch(`/api/roteiros/search?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao pesquisar");
      return res.json();
    },
    enabled: isSearchMode,
  });

  const importMutation = useMutation({
    mutationFn: async (jsonData: string) => {
      const parsed = JSON.parse(jsonData);
      return apiRequest("/api/roteiros/importar-json", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Importação concluída",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/roteiros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roteiros/filters/convenios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roteiros/filters/tipos-operacao"] });
      setImportDialogOpen(false);
      setJsonInput("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro na importação",
        description: error.message || "Erro ao importar JSON",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!jsonInput.trim()) {
      toast({
        title: "JSON vazio",
        description: "Por favor, cole o JSON para importar",
        variant: "destructive",
      });
      return;
    }

    try {
      JSON.parse(jsonInput);
      importMutation.mutate(jsonInput);
    } catch {
      toast({
        title: "JSON inválido",
        description: "O JSON informado não é válido",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setJsonInput(content);
      };
      reader.readAsText(file);
    }
  };

  const handleSearch = () => {
    setIsSearchMode(true);
    searchQuery.refetch();
  };

  const clearSearch = () => {
    setIsSearchMode(false);
    setSearchConvenio("");
    setSearchTipoOperacao("");
    setSearchIdade("");
  };

  const displayedRoteiros = isSearchMode ? (searchQuery.data || []) : roteiros;

  const getDados = (roteiro: RoteiroBancario): RoteiroDados => {
    return roteiro.dados as RoteiroDados;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Roteiros Bancários</h1>
          <p className="text-muted-foreground">
            Consulte e gerencie os roteiros bancários por convênio e tipo de operação
          </p>
        </div>
        
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-import-json">
              <Upload className="w-4 h-4 mr-2" />
              Importar JSON
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importar Roteiros</DialogTitle>
              <DialogDescription>
                Cole o JSON dos roteiros ou envie um arquivo .json
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Arquivo JSON (opcional)</Label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  data-testid="input-file-upload"
                />
              </div>
              
              <div>
                <Label>JSON</Label>
                <Textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='{"roteiros": [...]}'
                  className="h-64 font-mono text-sm"
                  data-testid="input-json-content"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={importMutation.isPending}
                  data-testid="button-confirm-import"
                >
                  {importMutation.isPending ? "Importando..." : "Importar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lista" data-testid="tab-lista">Lista</TabsTrigger>
          <TabsTrigger value="pesquisa" data-testid="tab-pesquisa">Pesquisa</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Carregando roteiros...</p>
              </CardContent>
            </Card>
          ) : roteiros.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Nenhum roteiro encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  Importe um arquivo JSON para adicionar roteiros bancários
                </p>
                <Button onClick={() => setImportDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar JSON
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banco</TableHead>
                      <TableHead>Convênio</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Tipo de Operação</TableHead>
                      <TableHead>Atualizado em</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roteiros.map((roteiro) => (
                      <TableRow key={roteiro.id} data-testid={`row-roteiro-${roteiro.id}`}>
                        <TableCell className="font-medium">{roteiro.banco}</TableCell>
                        <TableCell>{roteiro.convenio}</TableCell>
                        <TableCell>{roteiro.segmento || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{roteiro.tipoOperacao}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(roteiro.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRoteiro(roteiro)}
                            data-testid={`button-view-${roteiro.id}`}
                          >
                            Ver detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pesquisa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros de Pesquisa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Convênio</Label>
                  <Select value={searchConvenio} onValueChange={setSearchConvenio}>
                    <SelectTrigger data-testid="select-convenio">
                      <SelectValue placeholder="Todos os convênios" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os convênios</SelectItem>
                      {convenios.map((conv) => (
                        <SelectItem key={conv} value={conv}>{conv}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Tipo de Operação</Label>
                  <Select value={searchTipoOperacao} onValueChange={setSearchTipoOperacao}>
                    <SelectTrigger data-testid="select-tipo-operacao">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {tiposOperacao.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Idade</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 45"
                    value={searchIdade}
                    onChange={(e) => setSearchIdade(e.target.value)}
                    data-testid="input-idade"
                  />
                </div>
                
                <div className="flex items-end gap-2">
                  <Button onClick={handleSearch} data-testid="button-search">
                    <Search className="w-4 h-4 mr-2" />
                    Pesquisar
                  </Button>
                  {isSearchMode && (
                    <Button variant="outline" onClick={clearSearch}>
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {isSearchMode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Resultados ({displayedRoteiros.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchQuery.isLoading ? (
                  <p className="text-muted-foreground">Pesquisando...</p>
                ) : displayedRoteiros.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum roteiro encontrado com os filtros selecionados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedRoteiros.map((roteiro) => {
                      const dados = getDados(roteiro);
                      return (
                        <Card key={roteiro.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedRoteiro(roteiro)}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">{roteiro.banco}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {roteiro.convenio} • {roteiro.tipoOperacao}
                                </p>
                                {dados.publico_alvo && dados.publico_alvo.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Público: {dados.publico_alvo[0]}
                                    {dados.publico_alvo.length > 1 && ` (+${dados.publico_alvo.length - 1})`}
                                  </p>
                                )}
                              </div>
                              <Button variant="ghost" size="sm">
                                Ver detalhes
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRoteiro} onOpenChange={() => setSelectedRoteiro(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedRoteiro && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRoteiro.banco}</DialogTitle>
                <DialogDescription>
                  {selectedRoteiro.convenio} • {selectedRoteiro.tipoOperacao}
                  {selectedRoteiro.segmento && ` • ${selectedRoteiro.segmento}`}
                </DialogDescription>
              </DialogHeader>
              
              <RoteiroDetails roteiro={selectedRoteiro} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoteiroDetails({ roteiro }: { roteiro: RoteiroBancario }) {
  const dados = roteiro.dados as RoteiroDados;
  
  return (
    <div className="space-y-4">
      <CollapsibleSection title="Público-Alvo" defaultOpen>
        {dados.publico_alvo && dados.publico_alvo.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {dados.publico_alvo.map((item, idx) => (
              <li key={idx} className="text-sm">{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Não especificado</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Público Não Atendido">
        {dados.publico_nao_atendido && dados.publico_nao_atendido.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {dados.publico_nao_atendido.map((item, idx) => (
              <li key={idx} className="text-sm text-destructive">{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Não especificado</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Faixas de Idade">
        {dados.faixas_idade && dados.faixas_idade.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Idade Mínima</TableHead>
                <TableHead>Idade Máxima</TableHead>
                <TableHead>Limite Parcela</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.faixas_idade.map((faixa, idx) => (
                <TableRow key={idx}>
                  <TableCell>{faixa.idade_minima ?? "-"}</TableCell>
                  <TableCell>{faixa.idade_maxima ?? "-"}</TableCell>
                  <TableCell>
                    {faixa.limite_parcela 
                      ? `R$ ${faixa.limite_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : "-"
                    }
                  </TableCell>
                  <TableCell>{faixa.observacoes || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Não especificado</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Limites Operacionais">
        {dados.limites_operacionais ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Prazo Mínimo:</span>
              <span className="ml-2 font-medium">
                {dados.limites_operacionais.prazo_minimo_meses 
                  ? `${dados.limites_operacionais.prazo_minimo_meses} meses`
                  : "-"
                }
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Prazo Máximo:</span>
              <span className="ml-2 font-medium">
                {dados.limites_operacionais.prazo_maximo_meses 
                  ? `${dados.limites_operacionais.prazo_maximo_meses} meses`
                  : "-"
                }
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Parcela Mínima:</span>
              <span className="ml-2 font-medium">
                {dados.limites_operacionais.parcela_minima 
                  ? `R$ ${dados.limites_operacionais.parcela_minima.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : "-"
                }
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Valor Mínimo Liberado:</span>
              <span className="ml-2 font-medium">
                {dados.limites_operacionais.valor_minimo_liberado || "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Margem Específica:</span>
              <span className="ml-2 font-medium">
                {dados.limites_operacionais.margem_especifica || "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Margem Negativa:</span>
              <span className="ml-2 font-medium flex items-center gap-1">
                {dados.limites_operacionais.margem_negativa_permitida === true ? (
                  <><Check className="w-4 h-4 text-green-600" /> Permitida</>
                ) : dados.limites_operacionais.margem_negativa_permitida === false ? (
                  <><X className="w-4 h-4 text-red-600" /> Não permitida</>
                ) : "-"}
              </span>
            </div>
            {dados.limites_operacionais.descricao_margem_negativa && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Descrição Margem Negativa:</span>
                <span className="ml-2">{dados.limites_operacionais.descricao_margem_negativa}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Não especificado</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Documentação Obrigatória">
        {dados.documentacao_obrigatoria && dados.documentacao_obrigatoria.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {dados.documentacao_obrigatoria.map((doc, idx) => (
              <li key={idx} className="text-sm">{doc}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Não especificado</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Portais de Acesso">
        {dados.portais_acesso && dados.portais_acesso.length > 0 ? (
          <div className="space-y-3">
            {dados.portais_acesso.map((portal, idx) => (
              <Card key={idx}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium">{portal.nome_portal || "Portal"}</h5>
                      {portal.orgao_ou_segmento && (
                        <p className="text-sm text-muted-foreground">{portal.orgao_ou_segmento}</p>
                      )}
                      {portal.instrucoes_acesso && (
                        <p className="text-sm mt-1">{portal.instrucoes_acesso}</p>
                      )}
                      {portal.observacoes && (
                        <p className="text-xs text-muted-foreground mt-1">{portal.observacoes}</p>
                      )}
                    </div>
                    {portal.link_portal && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={portal.link_portal} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Acessar
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Não especificado</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Regras Especiais">
        {dados.regras_especiais && dados.regras_especiais.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {dados.regras_especiais.map((regra, idx) => (
              <li key={idx} className="text-sm">{regra}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Não especificado</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Detalhes Adicionais">
        {dados.detalhes_adicionais && dados.detalhes_adicionais.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {dados.detalhes_adicionais.map((detalhe, idx) => (
              <li key={idx} className="text-sm">{detalhe}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Não especificado</p>
        )}
      </CollapsibleSection>
    </div>
  );
}

function CollapsibleSection({ 
  title, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-2 h-10">
          <span className="font-medium">{title}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
