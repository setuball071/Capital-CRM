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
import { Loader2, Upload, Database, FileSpreadsheet, CheckCircle, XCircle, Clock, HelpCircle, Download, Trash2, AlertTriangle, Zap, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ConvenioCombobox } from "@/components/convenio-combobox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import type { BaseImportada, ImportRun } from "@shared/schema";

// Extended type for API response with real counts
type ImportRunWithCounts = ImportRun & {
  realCounts?: {
    totalRows: number;
    successRows: number;
    errorRows: number;
  };
};

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
    { nome: "rejur", descricao: "Regime Jurídico (Ex: CLT, ESTATUTÁRIO)" },
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
  
  // Fast Import states
  const [isFastImportOpen, setIsFastImportOpen] = useState(false);
  const [fastImportFile, setFastImportFile] = useState<File | null>(null);
  const [fastImportTipo, setFastImportTipo] = useState<string>("folha");
  const [fastImportConvenio, setFastImportConvenio] = useState("");
  const [fastImportCompetencia, setFastImportCompetencia] = useState("");
  const [fastImportLayoutD8, setFastImportLayoutD8] = useState<string>("servidor");
  const [fastImportRunId, setFastImportRunId] = useState<number | null>(null);
  const [fastImportStatus, setFastImportStatus] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  // Import Runs detail states
  const [selectedImportRun, setSelectedImportRun] = useState<ImportRunWithCounts | null>(null);
  const [isRunDetailOpen, setIsRunDetailOpen] = useState(false);
  const [isDownloadingErrors, setIsDownloadingErrors] = useState(false);

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

  // Fast Import mutations
  const startFastImportMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/fast-imports/start", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao iniciar importação rápida");
      }
      return response.json();
    },
    onSuccess: (data: { importRunId: number; message: string }) => {
      setFastImportRunId(data.importRunId);
      toast({
        title: "Importação iniciada",
        description: data.message,
      });
      // Iniciar processamento
      processFastImportMutation.mutate(data.importRunId);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao iniciar importação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processFastImportMutation = useMutation({
    mutationFn: async (runId: number) => {
      const response = await apiRequest("POST", `/api/fast-imports/process/${runId}`);
      return response.json();
    },
    onSuccess: (data: any) => {
      setFastImportStatus(data);
      
      if (data.pausedForResume) {
        // Continuar processando
        setTimeout(() => {
          processFastImportMutation.mutate(fastImportRunId!);
        }, 100);
      } else if (data.status === "concluida" || data.phase === "completed") {
        toast({
          title: "Importação concluída!",
          description: `${data.mergedRows?.toLocaleString("pt-BR") || 0} registros processados em ${((data.elapsedMs || 0) / 1000).toFixed(1)}s`,
        });
        setIsPolling(false);
        // Invalidate both bases and import-runs caches
        queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
        queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
      } else if (data.status === "erro") {
        toast({
          title: "Erro na importação",
          description: data.message,
          variant: "destructive",
        });
        setIsPolling(false);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro no processamento",
        description: error.message,
        variant: "destructive",
      });
      setIsPolling(false);
    },
  });

  const handleFastImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFastImportFile(e.target.files[0]);
    }
  };

  const handleStartFastImport = async () => {
    if (!fastImportFile || !fastImportConvenio || !fastImportCompetencia) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", fastImportFile);
    formData.append("tipo_import", fastImportTipo);
    formData.append("convenio", fastImportConvenio);
    formData.append("competencia", fastImportCompetencia);
    if (fastImportTipo === "d8") {
      formData.append("layout_d8", fastImportLayoutD8);
      formData.append("banco", "DIVERSOS");
    }
    
    setIsPolling(true);
    startFastImportMutation.mutate(formData);
  };

  const resetFastImport = () => {
    setFastImportFile(null);
    setFastImportTipo("folha");
    setFastImportConvenio("");
    setFastImportCompetencia("");
    setFastImportLayoutD8("servidor");
    setFastImportRunId(null);
    setFastImportStatus(null);
    setIsPolling(false);
    setIsFastImportOpen(false);
  };

  const { data: bases = [], isLoading, refetch } = useQuery<BaseImportada[]>({
    queryKey: ["/api/bases"],
    refetchInterval: 5000,
  });

  // Query para Import Runs (apenas master)
  const { data: importRuns = [] } = useQuery<ImportRun[]>({
    queryKey: ["/api/import-runs"],
    enabled: isMaster,
  });

  // Funções para visualizar detalhes e download de erros
  const viewImportRunDetails = async (runId: number) => {
    try {
      const response = await fetch(`/api/import-runs/${runId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Erro ao buscar detalhes");
      const data = await response.json();
      setSelectedImportRun(data);
      setIsRunDetailOpen(true);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes da importação.",
        variant: "destructive",
      });
    }
  };

  const downloadImportErrors = async (runId: number) => {
    setIsDownloadingErrors(true);
    try {
      const response = await fetch(`/api/import-runs/${runId}/rows/errors/download`, { credentials: "include" });
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Sem erros",
            description: "Esta importação não possui linhas com erro.",
          });
          return;
        }
        throw new Error("Erro ao baixar erros");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `erros_import_${runId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Download concluído",
        description: "Arquivo CSV com erros baixado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível baixar os erros.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingErrors(false);
    }
  };

  const deleteImportRun = async (runId: number) => {
    if (!confirm(`Tem certeza que deseja excluir a importação #${runId}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/import-runs/${runId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Erro ao excluir importação");
      }
      toast({
        title: "Importação excluída",
        description: `Importação #${runId} foi excluída com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a importação.",
        variant: "destructive",
      });
    }
  };

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
      // Invalidate both bases and import-runs caches
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
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
      // Invalidate both bases and import-runs caches
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
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
        (baseToDelete.nome && deleteConfirmText.toLowerCase() === baseToDelete.nome.toLowerCase());
      if (isValidConfirmation) {
        deleteMutation.mutate(baseToDelete.id);
      }
    }
  };

  const isDeleteConfirmValid = baseToDelete && (
    deleteConfirmText === "EXCLUIR" || 
    (baseToDelete.nome && deleteConfirmText.toLowerCase() === baseToDelete.nome.toLowerCase())
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
                    onClick={() => window.location.href = "/api/import/templates/folha-pensionista"}
                    data-testid="button-download-modelo-folha-pensionista"
                    className="justify-start"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Modelo Folha Pensionista
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
                <ConvenioCombobox
                  value={convenio}
                  onChange={setConvenio}
                  placeholder="Selecione ou crie um convênio..."
                  testId="combobox-convenio"
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
        
        <Dialog open={isFastImportOpen} onOpenChange={(open) => {
          if (!open && !isPolling) resetFastImport();
          else if (open) setIsFastImportOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button variant="default" className="bg-amber-600 hover:bg-amber-700" data-testid="button-fast-import">
              <Zap className="w-4 h-4 mr-2" />
              Importação Rápida
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Importação Rápida (100x mais veloz)
              </DialogTitle>
              <DialogDescription>
                Sistema otimizado para grandes volumes. Processa 100k linhas em ~2 minutos.
              </DialogDescription>
            </DialogHeader>
            
            {!isPolling ? (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="fast-tipo">Tipo de Importação *</Label>
                  <Select value={fastImportTipo} onValueChange={setFastImportTipo}>
                    <SelectTrigger data-testid="select-fast-tipo">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="folha">Folha (Servidor/Pensionista)</SelectItem>
                      <SelectItem value="d8">D8 (Contratos)</SelectItem>
                      <SelectItem value="contatos">Contatos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {fastImportTipo === "d8" && (
                  <div className="space-y-2">
                    <Label htmlFor="fast-layout">Layout D8</Label>
                    <Select value={fastImportLayoutD8} onValueChange={setFastImportLayoutD8}>
                      <SelectTrigger data-testid="select-fast-layout">
                        <SelectValue placeholder="Selecione o layout" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="servidor">Servidor</SelectItem>
                        <SelectItem value="pensionista">Pensionista (com Instituidor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="fast-file">Arquivo CSV *</Label>
                  <Input
                    id="fast-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFastImportFileChange}
                    data-testid="input-fast-file"
                  />
                  {fastImportFile && (
                    <p className="text-sm text-muted-foreground">
                      Arquivo: {fastImportFile.name} ({(fastImportFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fast-convenio">Convênio *</Label>
                  <ConvenioCombobox
                    value={fastImportConvenio}
                    onChange={setFastImportConvenio}
                    placeholder="Selecione ou crie um convênio..."
                    testId="combobox-fast-convenio"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fast-competencia">Competência *</Label>
                  <Input
                    id="fast-competencia"
                    type="month"
                    value={fastImportCompetencia}
                    onChange={(e) => setFastImportCompetencia(e.target.value)}
                    data-testid="input-fast-competencia"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-6">
                <div className="flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Processando importação...</p>
                  {fastImportStatus && (
                    <>
                      <p className="text-sm text-muted-foreground mt-2">
                        Fase: {fastImportStatus.phase === "staging" ? "Carregando dados" : 
                               fastImportStatus.phase === "merge" ? "Mesclando registros" : 
                               fastImportStatus.phase === "completed" ? "Concluído" : fastImportStatus.phase}
                      </p>
                      {fastImportStatus.stagedRows > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Linhas carregadas: {fastImportStatus.stagedRows?.toLocaleString("pt-BR")}
                        </p>
                      )}
                      {fastImportStatus.mergedRows > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Registros mesclados: {fastImportStatus.mergedRows?.toLocaleString("pt-BR")}
                        </p>
                      )}
                      {fastImportStatus.elapsedMs > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Tempo: {(fastImportStatus.elapsedMs / 1000).toFixed(1)}s
                        </p>
                      )}
                    </>
                  )}
                </div>
                <Progress value={fastImportStatus?.phase === "completed" ? 100 : 
                                 fastImportStatus?.phase === "merge" ? 75 : 
                                 fastImportStatus?.phase === "staging" ? 25 : 0} 
                          className="h-2" />
              </div>
            )}
            
            <DialogFooter>
              {!isPolling ? (
                <>
                  <Button
                    variant="outline"
                    onClick={resetFastImport}
                    data-testid="button-fast-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleStartFastImport}
                    disabled={startFastImportMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700"
                    data-testid="button-fast-submit"
                  >
                    {startFastImportMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Iniciar Importação
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setIsFastImportOpen(false)}
                  data-testid="button-fast-minimize"
                >
                  Minimizar (continua em segundo plano)
                </Button>
              )}
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
                          title="Excluir base"
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

      {/* Seção de Histórico de Importações (Import Runs) - MASTER ONLY */}
      {isMaster && importRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Histórico de Importações Rápidas
            </CardTitle>
            <CardDescription>
              Rastreabilidade completa de cada linha importada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sucesso</TableHead>
                  <TableHead>Erros</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importRuns.slice(0, 10).map((run) => (
                  <TableRow key={run.id} data-testid={`row-import-run-${run.id}`}>
                    <TableCell className="font-mono">#{run.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{run.tipoImport}</Badge>
                    </TableCell>
                    <TableCell>{run.convenio || "-"}</TableCell>
                    <TableCell>
                      {run.status === "concluido" ? (
                        <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Concluído</Badge>
                      ) : run.status === "erro" ? (
                        <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>
                      ) : run.status === "processando" ? (
                        <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processando</Badge>
                      ) : (
                        <Badge variant="outline">{run.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {run.successRows?.toLocaleString("pt-BR") || 0}
                    </TableCell>
                    <TableCell className={run.errorRows > 0 ? "text-red-600 font-medium" : ""}>
                      {run.errorRows?.toLocaleString("pt-BR") || 0}
                    </TableCell>
                    <TableCell>
                      {run.createdAt ? format(new Date(run.createdAt), "dd/MM HH:mm", { locale: ptBR }) : "-"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewImportRunDetails(run.id)}
                        title="Ver detalhes"
                        data-testid={`button-view-run-${run.id}`}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </Button>
                      {run.errorRows > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadImportErrors(run.id)}
                          disabled={isDownloadingErrors}
                          title="Baixar erros CSV"
                          data-testid={`button-download-errors-${run.id}`}
                        >
                          <Download className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteImportRun(run.id)}
                        title="Excluir importação"
                        data-testid={`button-delete-run-${run.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog de detalhes de Import Run */}
      <Dialog open={isRunDetailOpen} onOpenChange={setIsRunDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Detalhes da Importação #{selectedImportRun?.id}
            </DialogTitle>
            <DialogDescription>
              Contadores reais baseados nas linhas registradas
            </DialogDescription>
          </DialogHeader>
          
          {selectedImportRun && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted p-3 rounded-md text-center">
                  <div className="text-2xl font-bold">
                    {(selectedImportRun.realCounts?.totalRows || selectedImportRun.processedRows || 0).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-xs text-muted-foreground">Total de Linhas</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(selectedImportRun.realCounts?.successRows || selectedImportRun.successRows || 0).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-xs text-muted-foreground">Sucesso</div>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {(selectedImportRun.realCounts?.errorRows || selectedImportRun.errorRows || 0).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-xs text-muted-foreground">Erros</div>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                <div><strong>Tipo:</strong> {selectedImportRun.tipoImport}</div>
                <div><strong>Convênio:</strong> {selectedImportRun.convenio || "-"}</div>
                <div><strong>Arquivo:</strong> {selectedImportRun.arquivoOrigem}</div>
                <div><strong>Status:</strong> {selectedImportRun.status}</div>
              </div>
              
              {(selectedImportRun.realCounts?.errorRows || selectedImportRun.errorRows || 0) > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadImportErrors(selectedImportRun.id)}
                  disabled={isDownloadingErrors}
                  data-testid="button-download-errors-detail"
                >
                  {isDownloadingErrors ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Baixar Erros CSV
                </Button>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRunDetailOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
