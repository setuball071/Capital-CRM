import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Upload, Search, ChevronDown, ChevronUp, ExternalLink, FileText, AlertCircle, Check, X, Pencil, Sparkles, Loader2 } from "lucide-react";
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
  DialogFooter,
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

const TIPOS_OPERACAO = [
  { value: "credito_novo", label: "Crédito Novo" },
  { value: "refin", label: "Refinanciamento" },
  { value: "compra_divida", label: "Compra de Dívida" },
  { value: "compra_cartao_beneficio", label: "Compra de Cartão Benefício" },
  { value: "cartao_beneficio", label: "Cartão Benefício" },
  { value: "cartao_consignado", label: "Cartão Consignado" },
  { value: "nao_especificado", label: "Não Especificado" },
];

interface IASearchResult {
  id: number;
  banco: string;
  convenio: string;
  segmento: string | null;
  tipo_operacao: string;
  updated_at: string;
  resumo: {
    publico_alvo: string[];
    faixas_idade: any[];
    portais: string[];
  };
}

interface IASearchResponse {
  query: string;
  filters_interpreted: {
    convenio: string | null;
    segmento: string | null;
    tipo_operacao: string | null;
    idade: number | null;
    palavras_chave: string[];
  };
  results: IASearchResult[];
  total: number;
  resposta: string;
}

export default function RoteirosPage() {
  const { toast } = useToast();
  const [selectedRoteiro, setSelectedRoteiro] = useState<RoteiroBancario | null>(null);
  const [editingRoteiro, setEditingRoteiro] = useState<RoteiroBancario | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  
  const [editBanco, setEditBanco] = useState("");
  const [editConvenio, setEditConvenio] = useState("");
  const [editSegmento, setEditSegmento] = useState("");
  const [editTipoOperacao, setEditTipoOperacao] = useState("");
  
  const [iaQuery, setIaQuery] = useState("");
  const [iaSearchResults, setIaSearchResults] = useState<IASearchResponse | null>(null);
  const [isIaSearching, setIsIaSearching] = useState(false);

  const { data: roteiros = [], isLoading } = useQuery<RoteiroBancario[]>({
    queryKey: ["/api/roteiros"],
  });

  const { data: convenios = [] } = useQuery<string[]>({
    queryKey: ["/api/roteiros/filters/convenios"],
  });

  const { data: tiposOperacao = [] } = useQuery<string[]>({
    queryKey: ["/api/roteiros/filters/tipos-operacao"],
  });

  const importMutation = useMutation({
    mutationFn: async (jsonData: string) => {
      const parsed = JSON.parse(jsonData);
      const response = await apiRequest("POST", "/api/roteiros/importar-json", parsed);
      return response.json();
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PUT", `/api/roteiros/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Roteiro atualizado",
        description: "Os metadados foram atualizados com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/roteiros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roteiros/filters/convenios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roteiros/filters/tipos-operacao"] });
      setEditingRoteiro(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Erro ao atualizar roteiro",
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

  const openEditDialog = (roteiro: RoteiroBancario) => {
    setEditingRoteiro(roteiro);
    setEditBanco(roteiro.banco);
    setEditConvenio(roteiro.convenio);
    setEditSegmento(roteiro.segmento || "");
    setEditTipoOperacao(roteiro.tipoOperacao);
  };

  const handleUpdateRoteiro = () => {
    if (!editingRoteiro) return;
    
    const data: any = {};
    if (editBanco !== editingRoteiro.banco) data.banco = editBanco;
    if (editConvenio !== editingRoteiro.convenio) data.convenio = editConvenio;
    if (editSegmento !== (editingRoteiro.segmento || "")) data.segmento = editSegmento || null;
    if (editTipoOperacao !== editingRoteiro.tipoOperacao) data.tipo_operacao = editTipoOperacao;
    
    if (Object.keys(data).length === 0) {
      toast({
        title: "Sem alterações",
        description: "Nenhuma alteração foi feita",
      });
      setEditingRoteiro(null);
      return;
    }
    
    updateMutation.mutate({ id: editingRoteiro.id, data });
  };

  const handleIASearch = async () => {
    if (!iaQuery.trim()) {
      toast({
        title: "Consulta vazia",
        description: "Digite uma consulta para pesquisar",
        variant: "destructive",
      });
      return;
    }

    setIsIaSearching(true);
    setIaSearchResults(null);
    
    try {
      const response = await fetch(`/api/roteiros/ia-search?q=${encodeURIComponent(iaQuery)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro na pesquisa");
      }
      
      const data: IASearchResponse = await response.json();
      setIaSearchResults(data);
    } catch (error: any) {
      toast({
        title: "Erro na pesquisa",
        description: error.message || "Erro ao pesquisar com IA",
        variant: "destructive",
      });
    } finally {
      setIsIaSearching(false);
    }
  };

  const clearIASearch = () => {
    setIaQuery("");
    setIaSearchResults(null);
  };

  const handleViewFromIAResult = async (result: IASearchResult) => {
    const roteiro = roteiros.find(r => r.id === result.id);
    if (roteiro) {
      setSelectedRoteiro(roteiro);
    } else {
      const response = await fetch(`/api/roteiros/${result.id}`);
      if (response.ok) {
        const fullRoteiro = await response.json();
        setSelectedRoteiro(fullRoteiro);
      }
    }
  };

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
          <TabsTrigger value="pesquisa" data-testid="tab-pesquisa">
            <Sparkles className="w-4 h-4 mr-1" />
            Pesquisa Inteligente
          </TabsTrigger>
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
                      <TableHead className="text-right">Ações</TableHead>
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
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(roteiro)}
                              data-testid={`button-edit-${roteiro.id}`}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRoteiro(roteiro)}
                              data-testid={`button-view-${roteiro.id}`}
                            >
                              Ver detalhes
                            </Button>
                          </div>
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
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Pesquisa Inteligente
              </CardTitle>
              <CardDescription>
                Digite sua consulta em linguagem natural. Por exemplo: "siape 60 anos cartão benefício" ou "gov sp documentação portal"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Ex.: siape 60 anos cartão benefício spprev"
                    value={iaQuery}
                    onChange={(e) => setIaQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleIASearch()}
                    data-testid="input-ia-query"
                    className="h-11"
                  />
                </div>
                <Button 
                  onClick={handleIASearch} 
                  disabled={isIaSearching}
                  data-testid="button-ia-search"
                  className="h-11"
                >
                  {isIaSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Pesquisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Pesquisar
                    </>
                  )}
                </Button>
                {iaSearchResults && (
                  <Button variant="outline" onClick={clearIASearch} className="h-11">
                    Limpar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {iaSearchResults && (
            <>
              {/* Human-readable AI Response */}
              {iaSearchResults.resposta && (
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Resposta do Consultor IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-ia-response">
                      {iaSearchResults.resposta}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">Filtros interpretados pela IA:</p>
                  <div className="flex flex-wrap gap-2">
                    {iaSearchResults.filters_interpreted.convenio && (
                      <Badge variant="secondary">Convênio: {iaSearchResults.filters_interpreted.convenio}</Badge>
                    )}
                    {iaSearchResults.filters_interpreted.segmento && (
                      <Badge variant="secondary">Segmento: {iaSearchResults.filters_interpreted.segmento}</Badge>
                    )}
                    {iaSearchResults.filters_interpreted.tipo_operacao && (
                      <Badge variant="secondary">Tipo: {iaSearchResults.filters_interpreted.tipo_operacao}</Badge>
                    )}
                    {iaSearchResults.filters_interpreted.idade && (
                      <Badge variant="secondary">Idade: {iaSearchResults.filters_interpreted.idade} anos</Badge>
                    )}
                    {iaSearchResults.filters_interpreted.palavras_chave?.length > 0 && (
                      <Badge variant="outline">
                        Palavras-chave: {iaSearchResults.filters_interpreted.palavras_chave.join(", ")}
                      </Badge>
                    )}
                    {!iaSearchResults.filters_interpreted.convenio && 
                     !iaSearchResults.filters_interpreted.segmento && 
                     !iaSearchResults.filters_interpreted.tipo_operacao && 
                     !iaSearchResults.filters_interpreted.idade && 
                     iaSearchResults.filters_interpreted.palavras_chave?.length === 0 && (
                      <span className="text-sm text-muted-foreground">Nenhum filtro específico identificado</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Resultados ({iaSearchResults.total})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {iaSearchResults.results.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhum roteiro encontrado com essa consulta</p>
                      <p className="text-sm text-muted-foreground mt-2">Tente termos diferentes ou mais específicos</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {iaSearchResults.results.map((result) => (
                        <Card key={result.id} className="hover-elevate cursor-pointer" onClick={() => handleViewFromIAResult(result)}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-semibold">{result.banco}</h4>
                                <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                                  <span>{result.convenio}</span>
                                  {result.segmento && <span>• {result.segmento}</span>}
                                  <span>•</span>
                                  <Badge variant="outline">{result.tipo_operacao}</Badge>
                                </div>
                                {result.resumo.publico_alvo.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Público: {result.resumo.publico_alvo.join(", ")}
                                    {result.resumo.publico_alvo.length >= 3 && "..."}
                                  </p>
                                )}
                                {result.resumo.faixas_idade.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Faixas de idade: {result.resumo.faixas_idade.map((f: any) => 
                                      `${f.idade_minima || 0}-${f.idade_maxima || '∞'} anos`
                                    ).join(", ")}
                                  </p>
                                )}
                              </div>
                              <Button variant="ghost" size="sm">
                                Ver detalhes
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!iaSearchResults && !isIaSearching && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Pesquisa Inteligente com IA</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Digite uma consulta em linguagem natural e a IA irá interpretar e buscar os roteiros mais relevantes.
                  Você pode mencionar convênios, tipos de operação, idades, bancos e palavras-chave.
                </p>
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

      <Dialog open={!!editingRoteiro} onOpenChange={() => setEditingRoteiro(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Metadados do Roteiro</DialogTitle>
            <DialogDescription>
              Altere as informações básicas do roteiro. O conteúdo detalhado (dados) não será alterado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-banco">Banco</Label>
              <Input
                id="edit-banco"
                value={editBanco}
                onChange={(e) => setEditBanco(e.target.value)}
                data-testid="input-edit-banco"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-convenio">Convênio</Label>
              <Input
                id="edit-convenio"
                value={editConvenio}
                onChange={(e) => setEditConvenio(e.target.value)}
                data-testid="input-edit-convenio"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-segmento">Segmento</Label>
              <Input
                id="edit-segmento"
                value={editSegmento}
                onChange={(e) => setEditSegmento(e.target.value)}
                placeholder="Opcional"
                data-testid="input-edit-segmento"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-tipo-operacao">Tipo de Operação</Label>
              <Select value={editTipoOperacao} onValueChange={setEditTipoOperacao}>
                <SelectTrigger data-testid="select-edit-tipo-operacao">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_OPERACAO.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoteiro(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateRoteiro} 
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
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
                      <Button variant="ghost" size="sm" asChild>
                        <a href={portal.link_portal} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
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
        <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
          <h4 className="font-semibold text-sm">{title}</h4>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
