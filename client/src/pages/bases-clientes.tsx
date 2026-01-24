import { useState, useEffect, useRef } from "react";
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
import { Loader2, Upload, Database, FileSpreadsheet, CheckCircle, XCircle, Clock, HelpCircle, Download, Trash2, AlertTriangle, Zap, RefreshCw, ChevronLeft, ChevronRight, Square, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ConvenioCombobox } from "@/components/convenio-combobox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import type { BaseImportada, ImportRun } from "@shared/schema";

// Queue item type for batch import
type ImportQueueItem = {
  id: string;
  file: File;
  tipo: string;
  convenio: string;
  competencia: string;
  layoutD8: string;
  status: "pending" | "processing" | "completed" | "error";
  progress?: number;
  result?: any;
  error?: string;
};

// Extended type for API response with real counts and rejection reasons
type ImportRunWithCounts = ImportRun & {
  realCounts?: {
    totalRows: number;
    successRows: number;
    errorRows: number;
  };
  report?: {
    totalLinhas: number;
    importadas: number;
    rejeitadas: number;
    motivosRejeicao: Record<string, number>;
  };
};

// Headers canônicos do modelo XLSX conforme especificação:
// Orgão, Matricula, Base Calc, Bruta 5%, Utilz 5%, Saldo 5%, 
// Beneficio Bruta 5%, Beneficio Utilizado 5%, Beneficio Saldo 5%, Bruta 35%, Utilz 35%, Saldo 35%, 
// Bruta 70%, Utilz 70%, Saldo 70%, Créditos, Débitos, Líquido, ARQ. UPAG, EXC QTD, EXC Soma, RJUR, Sit Func, CPF, Margem
const MODELO_COLUNAS = {
  identificacaoObrigatorios: [
    { nome: "CPF", descricao: "CPF do cliente (11 dígitos)", obrigatorio: true },
    { nome: "Matricula", descricao: "Matrícula no órgão/convênio", obrigatorio: true },
    { nome: "Orgão", descricao: "Nome do órgão (obrigatório para múltiplos vínculos)", obrigatorio: true },
  ],
  identificacaoOpcionais: [
    { nome: "Sit Func", descricao: "ATIVO, APOSENTADO, PENSIONISTA, CLT" },
    { nome: "RJUR", descricao: "Regime Jurídico (Ex: CLT, ESTATUTÁRIO)" },
    { nome: "ARQ. UPAG", descricao: "Unidade pagadora" },
  ],
  rendimentos: [
    { nome: "Créditos", descricao: "Valor bruto da folha (salário bruto)" },
    { nome: "Débitos", descricao: "Total de descontos da folha" },
    { nome: "Líquido", descricao: "Valor líquido do salário" },
    { nome: "Base Calc", descricao: "Base de cálculo" },
  ],
  margens70: [
    { nome: "Bruta 70%", descricao: "Margem 70% bruta" },
    { nome: "Utilz 70%", descricao: "Margem 70% utilizada" },
    { nome: "Saldo 70%", descricao: "Margem 70% disponível" },
  ],
  margens35: [
    { nome: "Bruta 35%", descricao: "Margem 35% bruta" },
    { nome: "Utilz 35%", descricao: "Margem 35% utilizada" },
    { nome: "Saldo 35%", descricao: "Margem 35% disponível" },
  ],
  margens5: [
    { nome: "Bruta 5%", descricao: "Margem 5% bruta (cartão crédito consignado)" },
    { nome: "Utilz 5%", descricao: "Margem 5% utilizada" },
    { nome: "Saldo 5%", descricao: "Margem 5% disponível" },
  ],
  margensBeneficio5: [
    { nome: "Beneficio Bruta 5%", descricao: "Margem benefício 5% bruta" },
    { nome: "Beneficio Utilizado 5%", descricao: "Margem benefício 5% utilizada" },
    { nome: "Beneficio Saldo 5%", descricao: "Margem benefício 5% disponível" },
  ],
  exclusoes: [
    { nome: "EXC QTD", descricao: "Quantidade de exclusões" },
    { nome: "EXC Soma", descricao: "Soma das exclusões" },
    { nome: "Margem", descricao: "Margem geral" },
  ],
};

export default function BasesClientes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMaster = user?.isMaster === true;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isModeloOpen, setIsModeloOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [convenio, setConvenio] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [nomeBase, setNomeBase] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [baseToDelete, setBaseToDelete] = useState<BaseImportada | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  
  // Reset tenant data states (async job system)
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetJobId, setResetJobId] = useState<string | null>(null);
  const [resetJobStatus, setResetJobStatus] = useState<{
    id: string;
    status: "pending" | "running" | "completed" | "error";
    currentStep: number;
    totalSteps: number;
    steps: Array<{
      name: string;
      status: "pending" | "running" | "completed" | "error";
      countBefore?: number;
      deleted?: number;
      elapsedMs?: number;
      error?: string;
    }>;
    countsBefore: Record<string, number>;
    deleted: Record<string, number>;
    elapsedMs: number;
    error?: string;
  } | null>(null);
  const resetPollingRef = useRef<NodeJS.Timeout | null>(null);
  const [sanityTestResult, setSanityTestResult] = useState<{
    cpfTested: string;
    clientsFound: number;
    tableCounts: Record<string, number>;
    passed: boolean;
  } | null>(null);
  
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
  
  // Import Queue states
  const [importQueue, setImportQueue] = useState<ImportQueueItem[]>([]);
  const [isQueueProcessing, setIsQueueProcessing] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const queueProcessingRef = useRef(false);
  
  // Import Runs detail states
  const [selectedImportRun, setSelectedImportRun] = useState<ImportRunWithCounts | null>(null);
  const [isRunDetailOpen, setIsRunDetailOpen] = useState(false);
  const [importRunsPage, setImportRunsPage] = useState(1);
  const IMPORT_RUNS_PER_PAGE = 15;
  const [isDownloadingErrors, setIsDownloadingErrors] = useState(false);
  
  // Bulk delete states for Import Runs
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ current: number; total: number } | null>(null);
  
  // D8 Delete confirmation states
  const [isD8DeleteDialogOpen, setIsD8DeleteDialogOpen] = useState(false);
  const [d8DeletePreview, setD8DeletePreview] = useState<{
    importRun: { id: number; baseTag: string; convenio: string; arquivoOrigem: string };
    preview: { contratos: number; pessoasAfetadas: number; vinculosOrfaos: number; pessoasOrfas: number };
  } | null>(null);
  const [d8DeleteConfirmText, setD8DeleteConfirmText] = useState("");
  const [isLoadingD8Preview, setIsLoadingD8Preview] = useState(false);
  const [isDeletingD8, setIsDeletingD8] = useState(false);

  const handleDownloadModelo = () => {
    // Headers canônicos conforme modelo XLSX
    const headers = [
      ...MODELO_COLUNAS.identificacaoObrigatorios.map((c) => c.nome),
      ...MODELO_COLUNAS.identificacaoOpcionais.map((c) => c.nome),
      ...MODELO_COLUNAS.rendimentos.map((c) => c.nome),
      ...MODELO_COLUNAS.margens70.map((c) => c.nome),
      ...MODELO_COLUNAS.margens35.map((c) => c.nome),
      ...MODELO_COLUNAS.margens5.map((c) => c.nome),
      ...MODELO_COLUNAS.margensBeneficio5.map((c) => c.nome),
      ...MODELO_COLUNAS.exclusoes.map((c) => c.nome),
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    
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
    if (e.target.files && e.target.files.length > 0) {
      // Se múltiplos arquivos, adicionar à fila
      if (e.target.files.length > 1) {
        const newItems: ImportQueueItem[] = Array.from(e.target.files).map((file, idx) => ({
          id: `${Date.now()}-${idx}`,
          file,
          tipo: fastImportTipo,
          convenio: fastImportConvenio,
          competencia: fastImportCompetencia,
          layoutD8: fastImportLayoutD8,
          status: "pending" as const,
        }));
        setImportQueue(prev => [...prev, ...newItems]);
        setFastImportFile(null);
      } else {
        setFastImportFile(e.target.files[0]);
      }
    }
  };

  // Adicionar arquivo único à fila
  const addToQueue = () => {
    if (!fastImportFile || !fastImportConvenio || !fastImportCompetencia) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos antes de adicionar à fila.",
        variant: "destructive",
      });
      return;
    }
    
    const newItem: ImportQueueItem = {
      id: `${Date.now()}`,
      file: fastImportFile,
      tipo: fastImportTipo,
      convenio: fastImportConvenio,
      competencia: fastImportCompetencia,
      layoutD8: fastImportLayoutD8,
      status: "pending",
    };
    
    setImportQueue(prev => [...prev, newItem]);
    setFastImportFile(null);
    toast({
      title: "Arquivo adicionado à fila",
      description: `${newItem.file.name} aguardando processamento.`,
    });
  };

  // Remover item da fila
  const removeFromQueue = (itemId: string) => {
    setImportQueue(prev => prev.filter(item => item.id !== itemId));
  };

  // Processar um item da fila
  const processQueueItem = async (item: ImportQueueItem): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.append("arquivo", item.file);
      formData.append("tipo_import", item.tipo);
      formData.append("convenio", item.convenio);
      formData.append("competencia", item.competencia);
      if (item.tipo === "d8") {
        formData.append("layout_d8", item.layoutD8);
        formData.append("banco", "DIVERSOS");
      }

      fetch("/api/fast-imports/start", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
        .then(res => {
          if (!res.ok) throw new Error("Erro ao iniciar importação");
          return res.json();
        })
        .then(data => {
          const runId = data.importRunId;
          
          // Polling para processar
          const pollProcess = async () => {
            try {
              const processRes = await apiRequest("POST", `/api/fast-imports/process/${runId}`);
              const processData = await processRes.json();
              
              if (processData.pausedForResume) {
                setTimeout(pollProcess, 100);
              } else if (processData.status === "concluida" || processData.phase === "completed") {
                resolve({ success: true });
              } else if (processData.status === "erro") {
                resolve({ success: false, error: processData.message || "Erro no processamento" });
              } else {
                setTimeout(pollProcess, 100);
              }
            } catch (err: any) {
              resolve({ success: false, error: err.message });
            }
          };
          
          pollProcess();
        })
        .catch(err => resolve({ success: false, error: err.message }));
    });
  };

  // Iniciar processamento da fila
  const startQueueProcessing = async () => {
    if (importQueue.length === 0) {
      toast({
        title: "Fila vazia",
        description: "Adicione arquivos à fila primeiro.",
        variant: "destructive",
      });
      return;
    }
    
    setIsQueueProcessing(true);
    setIsPolling(true);
    queueProcessingRef.current = true;
    
    let completedCount = 0;
    let processedAny = false;
    const totalItems = importQueue.length;
    
    for (let i = 0; i < totalItems; i++) {
      if (!queueProcessingRef.current) break;
      
      const item = importQueue[i];
      if (item.status === "completed" || item.status === "error") {
        if (item.status === "completed") completedCount++;
        continue;
      }
      
      processedAny = true;
      setCurrentQueueIndex(i);
      setImportQueue(prev => prev.map((q, idx) => 
        idx === i ? { ...q, status: "processing" as const } : q
      ));
      
      const result = await processQueueItem(item);
      
      if (result.success) {
        completedCount++;
        setImportQueue(prev => prev.map((q, idx) => 
          idx === i ? { ...q, status: "completed" as const } : q
        ));
        toast({
          title: `Importação ${i + 1}/${totalItems} concluída`,
          description: item.file.name,
        });
      } else {
        setImportQueue(prev => prev.map((q, idx) => 
          idx === i ? { ...q, status: "error" as const, error: result.error } : q
        ));
        toast({
          title: `Erro na importação ${i + 1}/${totalItems}`,
          description: result.error,
          variant: "destructive",
        });
      }
    }
    
    setIsQueueProcessing(false);
    setIsPolling(false);
    queueProcessingRef.current = false;
    
    // Só invalida cache se processou algo
    if (processedAny) {
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
    }
    
    toast({
      title: "Fila concluída!",
      description: `${completedCount} de ${totalItems} importações concluídas.`,
    });
  };

  // Pausar fila
  const pauseQueue = () => {
    queueProcessingRef.current = false;
    toast({
      title: "Fila pausada",
      description: "A importação atual será concluída, mas as próximas não serão iniciadas.",
    });
  };

  // Limpar fila
  const clearQueue = () => {
    if (isQueueProcessing) {
      toast({
        title: "Aguarde",
        description: "Pause a fila antes de limpar.",
        variant: "destructive",
      });
      return;
    }
    setImportQueue([]);
  };

  const handleStartFastImport = async () => {
    // Se há itens na fila, processar a fila
    if (importQueue.length > 0) {
      startQueueProcessing();
      return;
    }
    
    // Caso contrário, importação única (comportamento original)
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
    setImportQueue([]);
    setIsQueueProcessing(false);
    setCurrentQueueIndex(0);
    queueProcessingRef.current = false;
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
      // Buscar detalhes básicos primeiro
      const detailsRes = await fetch(`/api/import-runs/${runId}`, { credentials: "include" });
      if (!detailsRes.ok) throw new Error("Erro ao buscar detalhes");
      const details = await detailsRes.json();
      
      // Tentar buscar relatório apenas para usuários master (graceful failure)
      let report = null;
      if (isMaster) {
        try {
          const reportRes = await fetch(`/api/fast-imports/report/${runId}`, { credentials: "include" });
          if (reportRes.ok) {
            const reportData = await reportRes.json();
            report = reportData.report;
          }
        } catch {
          // Ignorar erros no relatório - ainda exibimos os detalhes básicos
        }
      }
      
      setSelectedImportRun({ ...details, report });
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
    if (!confirm(`Tem certeza que deseja excluir a importação #${runId}? Esta ação irá remover todos os dados importados (clientes, folhas, contratos) e não pode ser desfeita.`)) {
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
      const result = await response.json();
      toast({
        title: "Importação excluída",
        description: result.deleted 
          ? `Importação #${runId} excluída. Removidos: ${result.deleted.folhas} folhas, ${result.deleted.contratos} contratos, ${result.deleted.vinculos} vínculos, ${result.deleted.pessoasOrfas} pessoas.`
          : `Importação #${runId} foi excluída com sucesso.`,
      });
      // Invalidar todos os caches relacionados a clientes
      queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/consulta"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/filtros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/filtros/convenios"] });
      // Disparar evento para zerar estados em outras telas (consulta-cliente)
      window.dispatchEvent(new CustomEvent("clientDataDeleted"));
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a importação.",
        variant: "destructive",
      });
    }
  };

  // Funções de seleção múltipla para exclusão em massa
  const handleSelectRun = (runId: number, checked: boolean) => {
    setSelectedRunIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(runId);
      } else {
        newSet.delete(runId);
      }
      return newSet;
    });
  };

  const handleSelectAllRuns = (checked: boolean) => {
    if (checked) {
      const currentPageIds = importRuns
        .slice((importRunsPage - 1) * IMPORT_RUNS_PER_PAGE, importRunsPage * IMPORT_RUNS_PER_PAGE)
        .map(run => run.id);
      setSelectedRunIds(new Set(currentPageIds));
    } else {
      setSelectedRunIds(new Set());
    }
  };

  const isAllCurrentPageSelected = () => {
    const currentPageIds = importRuns
      .slice((importRunsPage - 1) * IMPORT_RUNS_PER_PAGE, importRunsPage * IMPORT_RUNS_PER_PAGE)
      .map(run => run.id);
    return currentPageIds.length > 0 && currentPageIds.every(id => selectedRunIds.has(id));
  };

  const getSelectedRunNames = () => {
    return importRuns
      .filter(run => selectedRunIds.has(run.id))
      .map(run => run.arquivoOrigem || `Import #${run.id}`);
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch("/api/import-runs/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir importações");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const successCount = data.deleted || 0;
      const errorCount = data.errors?.length || 0;
      
      if (errorCount > 0) {
        toast({
          title: "Exclusão parcial",
          description: `${successCount} importação(ões) excluída(s), ${errorCount} falhou(aram).`,
          variant: "default",
        });
      } else {
        toast({
          title: "Exclusão concluída",
          description: `${successCount} importação(ões) excluída(s) com sucesso.`,
        });
      }
      
      // Limpar seleções e invalidar caches
      setSelectedRunIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      setBulkDeleteProgress(null);
      queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      window.dispatchEvent(new CustomEvent("clientDataDeleted"));
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir as importações.",
        variant: "destructive",
      });
      setBulkDeleteProgress(null);
    },
  });

  const handleBulkDelete = () => {
    const ids = Array.from(selectedRunIds);
    setBulkDeleteProgress({ current: 0, total: ids.length });
    bulkDeleteMutation.mutate(ids);
  };

  // Abrir dialog de preview para exclusão D8
  const openD8DeleteDialog = async (runId: number) => {
    setIsLoadingD8Preview(true);
    setD8DeleteConfirmText("");
    try {
      const response = await fetch(`/api/d8/import-runs/${runId}/preview-delete`, {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao carregar preview");
      }
      const data = await response.json();
      setD8DeletePreview(data);
      setIsD8DeleteDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar preview de exclusão.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingD8Preview(false);
    }
  };

  // Executar exclusão D8 após confirmação
  const executeD8Delete = async () => {
    if (!d8DeletePreview || d8DeleteConfirmText !== "DELETE") return;
    
    setIsDeletingD8(true);
    try {
      const response = await fetch(`/api/d8/import-runs/${d8DeletePreview.importRun.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir contratos D8");
      }
      const result = await response.json();
      toast({
        title: "Contratos D8 excluídos",
        description: `Removidos: ${result.deleted.contratos} contratos, ${result.deleted.vinculosOrfaos || 0} vínculos órfãos, ${result.deleted.pessoasOrfas || 0} pessoas órfãs.`,
      });
      // Invalidar todos os caches relacionados a clientes
      queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/consulta"] });
      // Disparar evento para zerar estados em outras telas
      window.dispatchEvent(new CustomEvent("clientDataDeleted"));
      // Fechar dialog
      setIsD8DeleteDialogOpen(false);
      setD8DeletePreview(null);
      setD8DeleteConfirmText("");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir os contratos D8.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingD8(false);
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
    onSuccess: (data: { message: string; deleted?: { folhas: number; contratos: number; vinculos: number; contacts: number; pessoas: number } }) => {
      const deleted = data.deleted;
      toast({
        title: "Base excluída com sucesso",
        description: deleted 
          ? `Removidos: ${deleted.folhas} folhas, ${deleted.contratos} contratos, ${deleted.vinculos} vínculos, ${deleted.pessoas} clientes.`
          : "Todos os dados vinculados foram removidos.",
      });
      setDeleteDialogOpen(false);
      setBaseToDelete(null);
      setDeleteConfirmText("");
      // Invalidar todos os caches relacionados a clientes
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/consulta"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/filtros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/filtros/convenios"] });
      // Disparar evento para zerar estados em outras telas (consulta-cliente)
      window.dispatchEvent(new CustomEvent("clientDataDeleted"));
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir base",
        description: error.message || "Ocorreu um erro ao excluir a base.",
        variant: "destructive",
      });
    },
  });

  // Reset tenant data mutation (master only) - async job version
  const startResetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/reset-tenant");
      return response.json();
    },
    onSuccess: (data: { success: boolean; jobId: string }) => {
      setResetJobId(data.jobId);
      setResetConfirmText("");
      toast({
        title: "Reset iniciado",
        description: "O processo de limpeza foi iniciado em background.",
      });
      // Start polling
      startResetPolling(data.jobId);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao iniciar reset",
        description: error.message || "Ocorreu um erro ao iniciar o reset.",
        variant: "destructive",
      });
    },
  });

  // Sanity test after reset
  const runSanityTest = async () => {
    try {
      // Generate random CPF for test
      const randomCpf = String(Math.floor(Math.random() * 99999999999)).padStart(11, "0");
      
      // Test 1: Query for random CPF should return 0 results
      const consultaResponse = await apiRequest("GET", `/api/clientes/consulta?cpf=${randomCpf}`);
      const consultaData = await consultaResponse.json();
      const clientsFound = consultaData.clientes?.length || 0;
      
      // Test 2: Get table counts (snapshot)
      const countResponse = await apiRequest("GET", "/api/admin/tenant-counts");
      const countData = await countResponse.json();
      
      const tableCounts: Record<string, number> = {
        pessoas: parseInt(countData.clientes_pessoa || "0"),
        vinculos: parseInt(countData.clientes_vinculo || "0"),
        folhas: parseInt(countData.clientes_folha_mes || "0"),
        contratos: parseInt(countData.clientes_contratos || "0"),
        contatos: parseInt(countData.client_contacts || "0"),
      };
      
      const allZero = Object.values(tableCounts).every(v => v === 0);
      const passed = clientsFound === 0 && allZero;
      
      setSanityTestResult({
        cpfTested: randomCpf,
        clientsFound,
        tableCounts,
        passed,
      });
      
      if (passed) {
        toast({
          title: "Teste de sanidade: PASSOU",
          description: "Todas as tabelas estão zeradas corretamente.",
        });
      } else {
        toast({
          title: "Teste de sanidade: ALERTA",
          description: `Algumas tabelas ainda contêm dados.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Erro no teste de sanidade:", err);
      toast({
        title: "Erro no teste de sanidade",
        description: "Não foi possível executar o teste de verificação.",
        variant: "destructive",
      });
    }
  };

  // Polling for reset job status
  const startResetPolling = (jobId: string) => {
    if (resetPollingRef.current) {
      clearInterval(resetPollingRef.current);
    }
    
    const pollStatus = async () => {
      try {
        const response = await apiRequest("GET", `/api/admin/reset-tenant/status/${jobId}`);
        const status = await response.json();
        setResetJobStatus(status);
        
        if (status.status === "completed" || status.status === "error") {
          if (resetPollingRef.current) {
            clearInterval(resetPollingRef.current);
            resetPollingRef.current = null;
          }
          
          if (status.status === "completed") {
            toast({
              title: "Reset concluído",
              description: `Limpeza finalizada em ${(status.elapsedMs / 1000).toFixed(1)}s`,
            });
            
            // Invalidar TODOS os caches relacionados a clientes (targeted invalidation)
            queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
            queryClient.invalidateQueries({ queryKey: ["/api/import-runs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
            queryClient.invalidateQueries({ queryKey: ["/api/clientes/consulta"] });
            queryClient.invalidateQueries({ queryKey: ["/api/clientes/filtros"] });
            queryClient.invalidateQueries({ queryKey: ["/api/clientes/filtros/convenios"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/tenant-counts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/fast-imports"] });
            
            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent("clientDataDeleted"));
            
            // Reset sanity test result and run test automatically
            setSanityTestResult(null);
            setTimeout(() => runSanityTest(), 500);
          } else if (status.status === "error") {
            toast({
              title: "Erro no reset",
              description: status.error || "Ocorreu um erro durante o reset.",
              variant: "destructive",
            });
          }
        }
      } catch (err) {
        console.error("Erro ao consultar status do reset:", err);
      }
    };
    
    // Poll immediately then every 500ms
    pollStatus();
    resetPollingRef.current = setInterval(pollStatus, 500);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (resetPollingRef.current) {
        clearInterval(resetPollingRef.current);
      }
    };
  }, []);

  const handleResetTenant = () => {
    if (resetConfirmText === "RESET") {
      startResetMutation.mutate();
    }
  };

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
                    <h3 className="text-sm font-semibold text-primary mb-2">Rendimentos</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.rendimentos.map((col: { nome: string; descricao: string }) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Margens 70%</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {MODELO_COLUNAS.margens70.map((col: { nome: string; descricao: string }) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Margens 35%</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {MODELO_COLUNAS.margens35.map((col: { nome: string; descricao: string }) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Margens 5% (Cartão Crédito Consignado)</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {MODELO_COLUNAS.margens5.map((col: { nome: string; descricao: string }) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Margens Benefício 5% (Cartão Benefício)</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.margensBeneficio5.map((col: { nome: string; descricao: string }) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Exclusões e Outros</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {MODELO_COLUNAS.exclusoes.map((col: { nome: string; descricao: string }) => (
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
                    Modelo Dados Complementares
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
          
          {/* Reset Tenant Button - Master Only */}
          {isMaster && (
            <Dialog open={resetDialogOpen} onOpenChange={(open) => {
              setResetDialogOpen(open);
              if (!open && resetJobStatus?.status !== "running" && resetJobStatus?.status !== "pending") {
                setResetConfirmText("");
                setResetJobId(null);
                setResetJobStatus(null);
                setSanityTestResult(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="destructive" data-testid="button-reset-tenant">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Resetar dados do tenant
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    Resetar todos os dados do tenant
                  </DialogTitle>
                  <DialogDescription>
                    Esta ação irá remover PERMANENTEMENTE todos os clientes, vínculos, folhas, contratos, 
                    contatos, bases e importações do tenant atual. Esta ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                
                {/* Initial confirmation state */}
                {!resetJobId && !resetJobStatus && (
                  <>
                    <div className="space-y-4 py-4">
                      <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                        <p className="text-sm font-medium text-destructive">
                          Para confirmar, digite <code className="bg-destructive/20 px-1.5 py-0.5 rounded font-mono font-bold">RESET</code> abaixo:
                        </p>
                      </div>
                      <Input
                        value={resetConfirmText}
                        onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                        placeholder="Digite RESET para confirmar"
                        className="font-mono uppercase"
                        data-testid="input-reset-confirm"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setResetDialogOpen(false)}
                        data-testid="button-reset-cancel"
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleResetTenant}
                        disabled={resetConfirmText !== "RESET" || startResetMutation.isPending}
                        data-testid="button-reset-confirm"
                      >
                        {startResetMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Iniciando...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Resetar Tudo
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </>
                )}
                
                {/* Job in progress state */}
                {resetJobStatus && (resetJobStatus.status === "pending" || resetJobStatus.status === "running") && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Progresso</span>
                        <span className="text-muted-foreground">
                          Step {resetJobStatus.currentStep} de {resetJobStatus.totalSteps}
                        </span>
                      </div>
                      <Progress 
                        value={(resetJobStatus.currentStep / resetJobStatus.totalSteps) * 100} 
                        className="h-3"
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        Tempo decorrido: {(resetJobStatus.elapsedMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                    
                    <div className="space-y-1 max-h-[250px] overflow-y-auto">
                      {resetJobStatus.steps.map((step, idx) => (
                        <div 
                          key={step.name}
                          className={`flex items-center justify-between text-sm px-3 py-1.5 rounded ${
                            step.status === "running" 
                              ? "bg-primary/10 border border-primary/20" 
                              : step.status === "completed"
                              ? "bg-green-500/10"
                              : step.status === "error"
                              ? "bg-destructive/10"
                              : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {step.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                            {step.status === "completed" && <CheckCircle className="w-3 h-3 text-green-500" />}
                            {step.status === "error" && <XCircle className="w-3 h-3 text-destructive" />}
                            {step.status === "pending" && <Clock className="w-3 h-3 text-muted-foreground" />}
                            <span className={step.status === "running" ? "font-medium" : ""}>
                              {idx + 1}. {step.name}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {step.countBefore !== undefined && step.status === "pending" && (
                              <span>{step.countBefore.toLocaleString("pt-BR")} registros</span>
                            )}
                            {step.deleted !== undefined && step.status === "completed" && (
                              <span className="text-green-600">-{step.deleted.toLocaleString("pt-BR")}</span>
                            )}
                            {step.status === "running" && (
                              <span className="text-primary">processando...</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Job completed state */}
                {resetJobStatus && resetJobStatus.status === "completed" && (
                  <div className="space-y-4 py-4">
                    <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/20">
                      <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Reset concluído em {(resetJobStatus.elapsedMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Registros removidos por tabela:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {resetJobStatus.steps.map((step) => (
                          <div key={step.name} className="flex justify-between bg-muted/50 px-3 py-1.5 rounded">
                            <span className="truncate">{step.name}:</span>
                            <span className="font-mono text-destructive">
                              {(step.deleted || 0).toLocaleString("pt-BR")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Contagens iniciais (antes do reset):</h4>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="flex justify-between bg-muted/50 px-2 py-1 rounded text-xs">
                          <span>Pessoas:</span>
                          <span className="font-mono">{(resetJobStatus.countsBefore.pessoas || 0).toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="flex justify-between bg-muted/50 px-2 py-1 rounded text-xs">
                          <span>Vínculos:</span>
                          <span className="font-mono">{(resetJobStatus.countsBefore.vinculos || 0).toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="flex justify-between bg-muted/50 px-2 py-1 rounded text-xs">
                          <span>Folhas:</span>
                          <span className="font-mono">{(resetJobStatus.countsBefore.folhas || 0).toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Sanity Test Result */}
                    {sanityTestResult ? (
                      <div className={`p-3 rounded-lg border ${
                        sanityTestResult.passed 
                          ? "bg-green-500/10 border-green-500/20" 
                          : "bg-yellow-500/10 border-yellow-500/20"
                      }`}>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          {sanityTestResult.passed ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          )}
                          Teste de Sanidade: {sanityTestResult.passed ? "PASSOU" : "ALERTA"}
                        </h4>
                        <div className="text-xs space-y-1">
                          <p className="text-muted-foreground">
                            CPF testado: <span className="font-mono">{sanityTestResult.cpfTested}</span>
                            {" → "}<span className="font-medium">{sanityTestResult.clientsFound} resultados</span>
                          </p>
                          <div className="grid grid-cols-3 gap-1 mt-2">
                            {Object.entries(sanityTestResult.tableCounts).map(([table, count]) => (
                              <div key={table} className={`flex justify-between px-2 py-0.5 rounded ${
                                count === 0 ? "bg-green-500/20" : "bg-yellow-500/20"
                              }`}>
                                <span className="capitalize">{table}:</span>
                                <span className="font-mono">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Executando teste de sanidade...</span>
                      </div>
                    )}
                    
                    <DialogFooter>
                      <Button onClick={() => {
                        setResetDialogOpen(false);
                        setResetJobId(null);
                        setResetJobStatus(null);
                        setSanityTestResult(null);
                      }} data-testid="button-reset-close">
                        Fechar
                      </Button>
                    </DialogFooter>
                  </div>
                )}
                
                {/* Job error state */}
                {resetJobStatus && resetJobStatus.status === "error" && (
                  <div className="space-y-4 py-4">
                    <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                      <p className="text-sm font-medium text-destructive flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Erro no reset
                      </p>
                      <p className="text-xs text-destructive/80 mt-1">
                        {resetJobStatus.error || "Ocorreu um erro durante o processo de limpeza."}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      {resetJobStatus.steps.map((step, idx) => (
                        <div 
                          key={step.name}
                          className={`flex items-center justify-between text-sm px-3 py-1.5 rounded ${
                            step.status === "completed"
                              ? "bg-green-500/10"
                              : step.status === "error"
                              ? "bg-destructive/10"
                              : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {step.status === "completed" && <CheckCircle className="w-3 h-3 text-green-500" />}
                            {step.status === "error" && <XCircle className="w-3 h-3 text-destructive" />}
                            {step.status === "pending" && <Clock className="w-3 h-3 text-muted-foreground" />}
                            <span>{idx + 1}. {step.name}</span>
                          </div>
                          {step.error && (
                            <span className="text-xs text-destructive truncate max-w-[150px]">{step.error}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setResetDialogOpen(false);
                        setResetJobId(null);
                        setResetJobStatus(null);
                      }} data-testid="button-reset-close">
                        Fechar
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
          
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
                      <SelectItem value="contatos">Dados Complementares (Contatos/Endereço)</SelectItem>
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

                <div className="space-y-2">
                  <Label htmlFor="fast-file">Arquivo(s) CSV</Label>
                  <div className="flex gap-2">
                    <Input
                      id="fast-file"
                      type="file"
                      accept=".csv"
                      multiple
                      onChange={handleFastImportFileChange}
                      className="flex-1"
                      data-testid="input-fast-file"
                    />
                    {fastImportFile && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addToQueue}
                        data-testid="button-add-to-queue"
                      >
                        + Fila
                      </Button>
                    )}
                  </div>
                  {fastImportFile && (
                    <p className="text-sm text-muted-foreground">
                      Arquivo: {fastImportFile.name} ({(fastImportFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Selecione múltiplos arquivos para importar em sequência
                  </p>
                </div>
                
                {importQueue.length > 0 && (
                  <div className="space-y-2 border rounded-lg p-3 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Fila de Importação ({importQueue.length} arquivos)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearQueue}
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        data-testid="button-clear-queue"
                      >
                        Limpar
                      </Button>
                    </div>
                    <ScrollArea className="h-[120px]">
                      <div className="space-y-1">
                        {importQueue.map((item, idx) => (
                          <div 
                            key={item.id} 
                            className="flex items-center justify-between text-sm p-2 rounded bg-background"
                            data-testid={`queue-item-${idx}`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-muted-foreground w-4">{idx + 1}.</span>
                              <span className="truncate flex-1">{item.file.name}</span>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {item.tipo}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromQueue(item.id)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              data-testid={`button-remove-queue-${idx}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 py-6">
                {isQueueProcessing ? (
                  <>
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Processando fila de importação...</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {importQueue.filter(q => q.status === "completed").length} de {importQueue.length} concluídos
                      </p>
                    </div>
                    <Progress 
                      value={(importQueue.filter(q => q.status === "completed").length / importQueue.length) * 100} 
                      className="h-2" 
                    />
                    <div className="space-y-2 border rounded-lg p-3 bg-muted/50">
                      <ScrollArea className="h-[180px]">
                        <div className="space-y-1">
                          {importQueue.map((item, idx) => (
                            <div 
                              key={item.id} 
                              className="flex items-center justify-between text-sm p-2 rounded bg-background"
                              data-testid={`queue-processing-item-${idx}`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {item.status === "completed" && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                                {item.status === "processing" && <RefreshCw className="w-4 h-4 text-amber-500 animate-spin shrink-0" />}
                                {item.status === "error" && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                                {item.status === "pending" && <Clock className="w-4 h-4 text-muted-foreground shrink-0" />}
                                <span className="truncate flex-1">{item.file.name}</span>
                              </div>
                              <Badge 
                                variant={item.status === "completed" ? "default" : item.status === "error" ? "destructive" : "outline"}
                                className="text-xs shrink-0"
                              >
                                {item.status === "completed" ? "Concluído" : 
                                 item.status === "processing" ? "Processando" : 
                                 item.status === "error" ? "Erro" : "Aguardando"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </>
                ) : (
                  <>
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
                          
                          {fastImportStatus.report && (
                            <div className="mt-4 p-3 bg-muted rounded-lg text-left" data-testid="fast-import-report">
                              <h4 className="font-medium text-sm mb-2">Relatório da Importação</h4>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Total:</span>
                                  <p className="font-medium">{fastImportStatus.report.totalLinhas?.toLocaleString("pt-BR") || 0}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Importadas:</span>
                                  <p className="font-medium text-green-600">{fastImportStatus.report.importadas?.toLocaleString("pt-BR") || 0}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Rejeitadas:</span>
                                  <p className="font-medium text-red-600">{fastImportStatus.report.rejeitadas?.toLocaleString("pt-BR") || 0}</p>
                                </div>
                              </div>
                              {fastImportStatus.report.motivosRejeicao && Object.keys(fastImportStatus.report.motivosRejeicao).length > 0 && (
                                <div className="mt-3 pt-2 border-t">
                                  <span className="text-xs text-muted-foreground">Motivos de Rejeição:</span>
                                  <ul className="text-xs mt-1 space-y-1">
                                    {Object.entries(fastImportStatus.report.motivosRejeicao).map(([motivo, count]) => (
                                      <li key={motivo} className="flex justify-between">
                                        <span className="text-muted-foreground truncate max-w-[200px]">{motivo}</span>
                                        <span className="font-medium text-red-600">{(count as number).toLocaleString("pt-BR")}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {fastImportRunId && (fastImportStatus?.phase === "completed" || fastImportStatus?.status?.startsWith("concluido")) && (
                                <div className="mt-3 pt-2 border-t flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => {
                                      viewImportRunDetails(fastImportRunId);
                                      setIsFastImportOpen(false);
                                    }}
                                    data-testid="button-fast-view-report"
                                  >
                                    <HelpCircle className="w-4 h-4 mr-1" />
                                    Ver Relatório Completo
                                  </Button>
                                  {(fastImportStatus?.errorRows || 0) > 0 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="flex-1 text-red-600"
                                      onClick={() => downloadImportErrors(fastImportRunId)}
                                      disabled={isDownloadingErrors}
                                      data-testid="button-fast-download-errors"
                                    >
                                      <Download className="w-4 h-4 mr-1" />
                                      Baixar Erros CSV
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <Progress value={fastImportStatus?.phase === "completed" ? 100 : 
                                     fastImportStatus?.phase === "merge" ? 75 : 
                                     fastImportStatus?.phase === "staging" ? 25 : 0} 
                              className="h-2" />
                  </>
                )}
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
                    disabled={startFastImportMutation.isPending || (!fastImportFile && importQueue.length === 0)}
                    className="bg-amber-600 hover:bg-amber-700"
                    data-testid="button-fast-submit"
                  >
                    {startFastImportMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Iniciando...
                      </>
                    ) : importQueue.length > 0 ? (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Iniciar Fila ({importQueue.length})
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
                <div className="flex gap-2 w-full">
                  {isQueueProcessing && (
                    <Button
                      variant="destructive"
                      onClick={pauseQueue}
                      data-testid="button-pause-queue"
                    >
                      Pausar Fila
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setIsFastImportOpen(false)}
                    className="flex-1"
                    data-testid="button-fast-minimize"
                  >
                    Minimizar (continua em segundo plano)
                  </Button>
                </div>
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Histórico de Importações Rápidas
                </CardTitle>
                <CardDescription>
                  Rastreabilidade completa de cada linha importada ({importRuns.length} importações)
                </CardDescription>
              </div>
              {selectedRunIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteDialogOpen(true)}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Selecionados ({selectedRunIds.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={isAllCurrentPageSelected()}
                      onCheckedChange={handleSelectAllRuns}
                      aria-label="Selecionar todos"
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Arquivo</TableHead>
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
                {importRuns
                  .slice((importRunsPage - 1) * IMPORT_RUNS_PER_PAGE, importRunsPage * IMPORT_RUNS_PER_PAGE)
                  .map((run) => (
                  <TableRow key={run.id} data-testid={`row-import-run-${run.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRunIds.has(run.id)}
                        onCheckedChange={(checked) => handleSelectRun(run.id, checked === true)}
                        aria-label={`Selecionar importação ${run.id}`}
                        data-testid={`checkbox-run-${run.id}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex flex-col">
                        <span className="truncate font-medium" title={run.arquivoOrigem || `Import #${run.id}`}>
                          {run.arquivoOrigem || `Import #${run.id}`}
                        </span>
                        <span className="text-xs text-muted-foreground">#{run.id}</span>
                      </div>
                    </TableCell>
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
                      {run.tipoImport === 'd8' && run.status !== 'contratos_deletados' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openD8DeleteDialog(run.id)}
                          disabled={isLoadingD8Preview}
                          title="Excluir apenas contratos D8"
                          data-testid={`button-delete-d8-${run.id}`}
                        >
                          {isLoadingD8Preview ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 text-orange-500" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteImportRun(run.id)}
                        title="Excluir importação completa"
                        data-testid={`button-delete-run-${run.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Paginação */}
            {importRuns.length > IMPORT_RUNS_PER_PAGE && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Página {importRunsPage} de {Math.ceil(importRuns.length / IMPORT_RUNS_PER_PAGE)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportRunsPage(p => Math.max(1, p - 1))}
                    disabled={importRunsPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportRunsPage(p => Math.min(Math.ceil(importRuns.length / IMPORT_RUNS_PER_PAGE), p + 1))}
                    disabled={importRunsPage >= Math.ceil(importRuns.length / IMPORT_RUNS_PER_PAGE)}
                    data-testid="button-next-page"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
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
              
              {selectedImportRun.report?.motivosRejeicao && Object.keys(selectedImportRun.report.motivosRejeicao).length > 0 && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md" data-testid="motivos-rejeicao">
                  <h4 className="font-medium text-sm mb-2 text-red-700 dark:text-red-300">Motivos de Rejeição</h4>
                  <ScrollArea className="max-h-40">
                    <ul className="text-xs space-y-1">
                      {Object.entries(selectedImportRun.report.motivosRejeicao).map(([motivo, count]) => (
                        <li key={motivo} className="flex justify-between items-start gap-2">
                          <span className="text-muted-foreground break-words flex-1">{motivo}</span>
                          <span className="font-medium text-red-600 whitespace-nowrap">{(count as number).toLocaleString("pt-BR")}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
              
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

      {/* Dialog de confirmação de exclusão D8 com digitação de DELETE */}
      <Dialog open={isD8DeleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsD8DeleteDialogOpen(false);
          setD8DeletePreview(null);
          setD8DeleteConfirmText("");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Excluir contratos D8
            </DialogTitle>
            <DialogDescription>
              Esta ação remove apenas os contratos importados por este D8, preservando pessoas e vínculos que tenham outros dados.
            </DialogDescription>
          </DialogHeader>
          
          {d8DeletePreview && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                <div><strong>Import Run:</strong> #{d8DeletePreview.importRun.id}</div>
                <div><strong>Base Tag:</strong> {d8DeletePreview.importRun.baseTag || "-"}</div>
                <div><strong>Convênio:</strong> {d8DeletePreview.importRun.convenio || "-"}</div>
                <div><strong>Arquivo:</strong> {d8DeletePreview.importRun.arquivoOrigem || "-"}</div>
              </div>
              
              <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-md">
                <h4 className="font-medium text-sm mb-2 text-orange-700 dark:text-orange-300">O que será excluído:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Contratos:</span>
                    <span className="font-bold text-orange-600">{d8DeletePreview.preview.contratos.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pessoas afetadas:</span>
                    <span className="font-medium">{d8DeletePreview.preview.pessoasAfetadas.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vínculos órfãos:</span>
                    <span className="font-medium text-muted-foreground">{d8DeletePreview.preview.vinculosOrfaos.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pessoas órfãs:</span>
                    <span className="font-medium text-muted-foreground">{d8DeletePreview.preview.pessoasOrfas.toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm">
                  Para confirmar, digite <strong className="text-orange-600">DELETE</strong> no campo abaixo:
                </div>
                <Input
                  value={d8DeleteConfirmText}
                  onChange={(e) => setD8DeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="Digite DELETE para confirmar"
                  className="font-mono"
                  data-testid="input-confirm-d8-delete"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsD8DeleteDialogOpen(false);
                setD8DeletePreview(null);
                setD8DeleteConfirmText("");
              }}
              data-testid="button-cancel-d8-delete"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={executeD8Delete}
              disabled={d8DeleteConfirmText !== "DELETE" || isDeletingD8}
              data-testid="button-confirm-d8-delete"
            >
              {isDeletingD8 ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir contratos
                </>
              )}
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
