import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Database, FileSpreadsheet, CheckCircle, XCircle, Clock, HelpCircle, Download, Trash2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

interface BaseImportada {
  id: number;
  nome: string;
  baseTag: string;
  convenio: string;
  competencia: string;
  totalLinhas: number;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

const MODELO_COLUNAS = {
  identificacaoObrigatorios: [
    { nome: "cpf", descricao: "CPF do cliente", obrigatorio: true },
    { nome: "matricula", descricao: "Matrícula no órgão/convênio", obrigatorio: true },
    { nome: "nome", descricao: "Nome completo do cliente", obrigatorio: true },
  ],
  identificacaoOpcionais: [
    { nome: "orgao", descricao: "Nome do órgão/secretaria/autarquia" },
    { nome: "uf", descricao: "Estado do vínculo (opcional)" },
    { nome: "municipio", descricao: "Município (se existir)" },
    { nome: "situacao_funcional", descricao: "ATIVO, APOSENTADO, PENSIONISTA, CLT" },
    { nome: "data_nascimento", descricao: "Data de nascimento" },
    { nome: "idade", descricao: "Idade já calculada (se vier na planilha)" },
  ],
  contatos: [
    { nome: "telefone_1", descricao: "Telefone principal" },
    { nome: "telefone_2", descricao: "Telefone alternativo" },
    { nome: "telefone_3", descricao: "Telefone alternativo 2" },
    { nome: "email", descricao: "E-mail do cliente" },
  ],
  dadosBancarios: [
    { nome: "banco_salario", descricao: "Código/nome do banco onde recebe salário" },
    { nome: "agencia_salario", descricao: "Agência do banco" },
    { nome: "conta_salario", descricao: "Número da conta" },
    { nome: "upag", descricao: "Unidade pagadora (se existir)" },
  ],
  rendimentos: [
    { nome: "salario_bruto", descricao: "Valor bruto da folha" },
    { nome: "descontos_brutos", descricao: "Total de descontos" },
    { nome: "salario_liquido", descricao: "Valor líquido do salário" },
  ],
  folhaMargens: [
    { nome: "competencia_folha", descricao: "Mês da folha (ex: 2025-10)" },
    { nome: "margem_70_bruta", descricao: "Margem 70% bruta" },
    { nome: "margem_70_utilizada", descricao: "Margem 70% utilizada" },
    { nome: "margem_70_saldo", descricao: "Margem 70% disponível" },
    { nome: "margem_35_bruta", descricao: "Margem 35% bruta" },
    { nome: "margem_35_utilizada", descricao: "Margem 35% utilizada" },
    { nome: "margem_35_saldo", descricao: "Margem 35% disponível" },
    { nome: "margem_cartao_credito_bruta", descricao: "Margem cartão crédito bruta" },
    { nome: "margem_cartao_credito_utilizada", descricao: "Margem cartão crédito utilizada" },
    { nome: "margem_cartao_credito_saldo", descricao: "Margem cartão crédito disponível" },
    { nome: "margem_cartao_beneficio_bruta", descricao: "Margem cartão benefício bruta" },
    { nome: "margem_cartao_beneficio_utilizada", descricao: "Margem cartão benefício utilizada" },
    { nome: "margem_cartao_beneficio_saldo", descricao: "Margem cartão benefício disponível" },
  ],
  contratos: [
    { nome: "banco_emprestimo", descricao: "Banco do contrato (BMG, PAN, etc.)" },
    { nome: "tipo_produto", descricao: "consignado, cartao_credito, cartao_beneficio (opcional)" },
    { nome: "valor_parcela", descricao: "Valor da parcela mensal" },
    { nome: "saldo_devedor", descricao: "Saldo devedor (opcional)" },
    { nome: "prazo_remanescente", descricao: "Parcelas restantes" },
    { nome: "numero_contrato", descricao: "ID do contrato (chave única)" },
    { nome: "situacao_contrato", descricao: "ATIVO, QUITADO (opcional)" },
    { nome: "competencia_contrato", descricao: "Mês da folha (opcional)" },
  ],
};

export default function BasesClientes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMaster = user?.role === "master";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isModeloOpen, setIsModeloOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [convenio, setConvenio] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [nomeBase, setNomeBase] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [baseToDelete, setBaseToDelete] = useState<BaseImportada | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleDownloadModelo = () => {
    const headers = [
      ...MODELO_COLUNAS.identificacaoObrigatorios.map((c) => c.nome),
      ...MODELO_COLUNAS.identificacaoOpcionais.map((c) => c.nome),
      ...MODELO_COLUNAS.contatos.map((c) => c.nome),
      ...MODELO_COLUNAS.dadosBancarios.map((c) => c.nome),
      ...MODELO_COLUNAS.rendimentos.map((c) => c.nome),
      ...MODELO_COLUNAS.folhaMargens.map((c) => c.nome),
      ...MODELO_COLUNAS.contratos.map((c) => c.nome),
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    
    ws["!cols"] = headers.map(() => ({ wch: 25 }));

    XLSX.writeFile(wb, "modelo_importacao_base.xlsx");
    toast({
      title: "Modelo baixado",
      description: "Use este arquivo como base para sua planilha de importação.",
    });
  };

  const { data: bases = [], isLoading, refetch } = useQuery<BaseImportada[]>({
    queryKey: ["/api/bases"],
    refetchInterval: 5000,
  });

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/bases/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao importar");
      }
      return response.json();
    },
    onSuccess: (data: { message: string; totalLinhas: number; baseTag: string }) => {
      toast({
        title: "Importação concluída",
        description: `${data.totalLinhas} registros importados com sucesso para a base ${data.baseTag}.`,
      });
      setIsDialogOpen(false);
      setFile(null);
      setConvenio("");
      setCompetencia("");
      setNomeBase("");
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na importação",
        description: error.message || "Ocorreu um erro ao importar a base.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file || !convenio || !competencia) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", file);
    formData.append("convenio", convenio);
    formData.append("competencia", competencia);
    if (nomeBase) {
      formData.append("nome_base", nomeBase);
    }
    
    importMutation.mutate(formData);
  };

  const deleteMutation = useMutation({
    mutationFn: async (baseId: number) => {
      const response = await apiRequest("DELETE", `/api/bases/${baseId}`);
      return response.json();
    },
    onSuccess: (data: { message: string; deletedFolhas: number; deletedContratos: number; deletedPessoas: number }) => {
      toast({
        title: "Base excluída com sucesso",
        description: `Todos os dados vinculados foram removidos: ${data.deletedFolhas} folhas, ${data.deletedContratos} contratos, ${data.deletedPessoas} clientes.`,
      });
      setDeleteDialogOpen(false);
      setBaseToDelete(null);
      setDeleteConfirmText("");
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir base",
        description: error.message || "Ocorreu um erro ao excluir a base.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (base: BaseImportada) => {
    setBaseToDelete(base);
    setDeleteConfirmText("");
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (baseToDelete) {
      const isValidConfirmation = 
        deleteConfirmText === "EXCLUIR" || 
        deleteConfirmText.toLowerCase() === baseToDelete.nome.toLowerCase();
      if (isValidConfirmation) {
        deleteMutation.mutate(baseToDelete.id);
      }
    }
  };

  const isDeleteConfirmValid = baseToDelete && (
    deleteConfirmText === "EXCLUIR" || 
    deleteConfirmText.toLowerCase() === baseToDelete.nome.toLowerCase()
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluida":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Concluída
          </Badge>
        );
      case "processando":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case "erro":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Base de Clientes</h1>
          <p className="text-muted-foreground">
            Importe e gerencie bases de clientes (SIAPE, INSS, estaduais)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isModeloOpen} onOpenChange={setIsModeloOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-view-modelo">
                <HelpCircle className="w-4 h-4 mr-2" />
                Ver modelo de planilha
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Modelo de Planilha para Importação</DialogTitle>
                <DialogDescription>
                  Sua planilha precisa conter uma linha de cabeçalho com os nomes exatos das colunas abaixo.
                  Nem todas são obrigatórias, mas quanto mais campos você preencher, mais completa será a consulta.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Identificação (obrigatórios)</h3>
                    <p className="text-xs text-muted-foreground mb-2">Estes campos são obrigatórios para cada linha</p>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.identificacaoObrigatorios.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-primary/20 px-1.5 py-0.5 rounded text-xs font-mono font-bold">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic">O convênio é informado na tela de importação, não precisa estar na planilha.</p>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Identificação (opcionais)</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.identificacaoOpcionais.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Contatos (opcionais)</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.contatos.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Dados Bancários do Salário</h3>
                    <p className="text-xs text-muted-foreground mb-2">Onde o cliente recebe o salário (diferente do banco do empréstimo)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.dadosBancarios.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Rendimentos (opcionais)</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.rendimentos.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Folha / Margens</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.folhaMargens.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Contratos / Descontos em Folha</h3>
                    <p className="text-xs text-muted-foreground mb-2">Nem toda base terá todos os campos. O número do contrato é usado como chave única para evitar duplicação.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.contratos.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <Separator className="my-4" />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Modelos para Importação Massiva (Streaming)</h3>
                <p className="text-xs text-muted-foreground">
                  Para bases com milhões de registros, use os modelos específicos abaixo. Siga a ordem: 1) Folha → 2) D8 → 3) Contatos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/api/import/templates/folha"}
                    data-testid="button-download-modelo-folha"
                    className="justify-start"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Modelo Folha
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/api/import/templates/d8-servidor"}
                    data-testid="button-download-modelo-d8-servidor"
                    className="justify-start"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Modelo D8 Servidor
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/api/import/templates/d8-pensionista"}
                    data-testid="button-download-modelo-d8-pensionista"
                    className="justify-start"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Modelo D8 Pensionista
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/api/import/templates/contatos"}
                    data-testid="button-download-modelo-contatos"
                    className="justify-start"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Modelo Contatos
                  </Button>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={handleDownloadModelo} data-testid="button-download-modelo">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar modelo geral Excel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-import-base">
                <Upload className="w-4 h-4 mr-2" />
                Importar Base
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Importar Base de Clientes</DialogTitle>
              <DialogDescription>
                Faça upload de um arquivo Excel (.xlsx) ou CSV (.csv) com os dados da base.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file">Arquivo *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  data-testid="input-file"
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Arquivo selecionado: {file.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="convenio">Convênio *</Label>
                <Input
                  id="convenio"
                  placeholder="Ex: SIAPE, INSS, GOV SP"
                  value={convenio}
                  onChange={(e) => setConvenio(e.target.value)}
                  data-testid="input-convenio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="competencia">Competência *</Label>
                <Input
                  id="competencia"
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  data-testid="input-competencia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Base (opcional)</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Base SIAPE Novembro 2025"
                  value={nomeBase}
                  onChange={(e) => setNomeBase(e.target.value)}
                  data-testid="input-nome-base"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending}
                data-testid="button-submit-import"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Bases Importadas
          </CardTitle>
          <CardDescription>
            Lista de todas as bases de clientes importadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : bases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma base importada ainda.</p>
              <p className="text-sm">Clique em "Importar Base" para começar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Linhas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Importado em</TableHead>
                  {isMaster && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bases.map((base) => (
                  <TableRow key={base.id} data-testid={`row-base-${base.id}`}>
                    <TableCell className="font-medium">{base.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{base.convenio}</Badge>
                    </TableCell>
                    <TableCell>
                      {base.competencia
                        ? format(new Date(base.competencia), "MMM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>{base.totalLinhas?.toLocaleString("pt-BR") || 0}</TableCell>
                    <TableCell>{getStatusBadge(base.status)}</TableCell>
                    <TableCell>
                      {format(new Date(base.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    {isMaster && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(base)}
                          disabled={base.status === "processando"}
                          title={base.status === "processando" ? "Aguarde a conclusão" : "Excluir base"}
                          data-testid={`button-delete-base-${base.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Excluir base de clientes
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="font-semibold text-destructive">
                  Tem certeza que deseja excluir esta base? Todos os dados vinculados 
                  (clientes, folhas e contratos desta base) serão removidos permanentemente 
                  e não poderão ser recuperados.
                </div>
                
                {baseToDelete && (
                  <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                    <div><strong>Nome:</strong> {baseToDelete.nome}</div>
                    <div><strong>Convênio:</strong> {baseToDelete.convenio}</div>
                    <div><strong>Competência:</strong> {baseToDelete.competencia 
                      ? format(new Date(baseToDelete.competencia), "MMM/yyyy", { locale: ptBR }) 
                      : "-"}</div>
                    <div><strong>Total de linhas:</strong> {baseToDelete.totalLinhas?.toLocaleString("pt-BR") || 0}</div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="text-sm">
                    Para confirmar, digite <strong className="text-destructive">EXCLUIR</strong> ou o <strong>nome da base</strong> no campo abaixo:
                  </div>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Digite EXCLUIR ou o nome da base"
                    data-testid="input-confirm-delete"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setBaseToDelete(null);
                setDeleteConfirmText("");
              }}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!isDeleteConfirmValid || deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir definitivamente
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
