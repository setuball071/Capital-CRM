import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Play, Download, RefreshCw, CheckCircle, XCircle, Clock, Loader2, FileText, Scissors, AlertCircle } from "lucide-react";

interface CsvSplitRun {
  id: number;
  tenantId: number;
  storagePath: string;
  originalFilename: string | null;
  baseName: string | null;
  status: string;
  currentPart: number;
  lineOffset: number;
  headerLine: string | null;
  totalParts: number | null;
  totalLinesProcessed: number;
  linesPerPart: number;
  outputFolder: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StatusResponse {
  id: number;
  status: string;
  originalFilename: string | null;
  baseName: string | null;
  currentPart: number;
  lineOffset: number;
  headerLine: string | null;
  totalLinesProcessed: number;
  totalParts: number | null;
  linesPerPart: number;
  errorMessage: string | null;
  outputFiles: { name: string; path: string }[];
  canResume: boolean;
  nextStep: string | null;
}

interface ProcessResponse {
  success: boolean;
  runId: number;
  status: "continue" | "completed" | "error";
  currentPart: number;
  lineOffset: number;
  totalLinesProcessed: number;
  totalParts: number;
  message: string;
  nextStep: string | null;
}

export default function DividirCsvPage() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [baseName, setBaseName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: runs = [], refetch: refetchRuns } = useQuery<CsvSplitRun[]>({
    queryKey: ["/api/csv-split/runs"],
    refetchInterval: activeRunId ? 2000 : false,
  });

  const { data: activeStatus, refetch: refetchStatus } = useQuery<StatusResponse>({
    queryKey: ["/api/csv-split/status", activeRunId],
    enabled: !!activeRunId,
    refetchInterval: isProcessing ? 1000 : false,
  });

  const processChunk = useMutation({
    mutationFn: async (runId: number) => {
      const response = await apiRequest("POST", `/api/csv-split/process/${runId}`);
      return response.json() as Promise<ProcessResponse>;
    },
    onSuccess: async (data) => {
      if (data.status === "continue") {
        setTimeout(() => {
          processChunk.mutate(data.runId);
        }, 100);
      } else if (data.status === "completed") {
        setIsProcessing(false);
        setActiveRunId(null);
        toast({
          title: "Divisão concluída!",
          description: data.message,
        });
        refetchRuns();
      } else if (data.status === "error") {
        setIsProcessing(false);
        toast({
          title: "Erro no processamento",
          description: data.message,
          variant: "destructive",
        });
      }
      refetchStatus();
    },
    onError: (error: any) => {
      setIsProcessing(false);
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar",
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (runId: number) => {
      const response = await apiRequest("POST", `/api/csv-split/reset/${runId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Job resetado",
        description: "Você pode retomar o processamento.",
      });
      refetchRuns();
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx")) {
        toast({
          title: "Formato inválido",
          description: "Selecione um arquivo .csv ou .xlsx",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      if (!baseName) {
        const nameWithoutExt = file.name.replace(/\.(csv|xlsx)$/i, "");
        setBaseName(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", selectedFile);
      if (baseName.trim()) {
        formData.append("baseName", baseName.trim());
      }

      const response = await fetch("/api/csv-split/start", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao enviar arquivo");
      }

      const data = await response.json();
      
      toast({
        title: "Arquivo enviado!",
        description: "Iniciando processamento...",
      });

      setSelectedFile(null);
      setBaseName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setActiveRunId(data.runId);
      setIsProcessing(true);
      processChunk.mutate(data.runId);
      refetchRuns();
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message || "Erro ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleResume = (runId: number) => {
    setActiveRunId(runId);
    setIsProcessing(true);
    processChunk.mutate(runId);
  };

  const handleViewStatus = (runId: number) => {
    setActiveRunId(runId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Concluído</Badge>;
      case "processando":
        return <Badge variant="default" className="bg-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processando</Badge>;
      case "pendente":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "erro":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatNumber = (n: number) => n.toLocaleString("pt-BR");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scissors className="w-6 h-6" />
          Dividir CSV em Partes
        </h1>
        <p className="text-muted-foreground mt-1">
          Divide arquivos CSV grandes em partes de 100.000 linhas, mantendo o cabeçalho em cada parte.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Enviar CSV ou XLSX
          </CardTitle>
          <CardDescription>
            Selecione um arquivo CSV ou XLSX para dividir. O cabeçalho será copiado em todas as partes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="csv-file">Arquivo CSV ou XLSX</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,.xlsx"
              ref={fileInputRef}
              onChange={handleFileSelect}
              disabled={isUploading || isProcessing}
              data-testid="input-csv-file"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground mt-1">
                Selecionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="base-name">Nome base (opcional)</Label>
            <Input
              id="base-name"
              placeholder="Ex: minha_base"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              disabled={isUploading || isProcessing}
              data-testid="input-base-name"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Os arquivos serão nomeados: nome_parte_000001.csv, nome_parte_000002.csv, etc.
            </p>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || isProcessing}
            className="w-full"
            data-testid="button-upload"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Enviar e Dividir
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {activeStatus && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Status do Job #{activeStatus.id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              {getStatusBadge(activeStatus.status)}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Arquivo:</span>
                <span className="font-mono">{activeStatus.originalFilename}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Nome base:</span>
                <span className="font-mono">{activeStatus.baseName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Partes criadas:</span>
                <span className="font-bold">{activeStatus.currentPart}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Linhas processadas:</span>
                <span className="font-bold">{formatNumber(activeStatus.totalLinesProcessed)}</span>
              </div>
            </div>

            {activeStatus.status === "processando" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando parte {activeStatus.currentPart + 1}...
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}

            {activeStatus.errorMessage && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {activeStatus.errorMessage}
              </div>
            )}

            {activeStatus.outputFiles && activeStatus.outputFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Arquivos gerados:</Label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {activeStatus.outputFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                      <span className="font-mono truncate">{file.name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        data-testid={`button-download-${idx}`}
                      >
                        <a href={`/api/csv-split/download/${activeStatus.id}/${file.name}`} download>
                          <Download className="w-3 h-3 mr-1" />
                          Baixar
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeStatus.canResume && !isProcessing && (
              <Button
                onClick={() => handleResume(activeStatus.id)}
                className="w-full"
                data-testid="button-resume"
              >
                <Play className="w-4 h-4 mr-2" />
                Continuar Processamento
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Jobs
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchRuns()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum job de divisão encontrado.
            </p>
          ) : (
            <div className="space-y-3">
              {runs.slice().reverse().map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">#{run.id}</span>
                      {getStatusBadge(run.status)}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {run.originalFilename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.currentPart} partes · {formatNumber(run.totalLinesProcessed)} linhas
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {run.status === "erro" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetMutation.mutate(run.id)}
                        data-testid={`button-reset-${run.id}`}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Resetar
                      </Button>
                    )}
                    {(run.status === "processando" || run.status === "pendente") && !isProcessing && (
                      <Button
                        size="sm"
                        onClick={() => handleResume(run.id)}
                        data-testid={`button-resume-${run.id}`}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Retomar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewStatus(run.id)}
                      data-testid={`button-view-${run.id}`}
                    >
                      Ver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
