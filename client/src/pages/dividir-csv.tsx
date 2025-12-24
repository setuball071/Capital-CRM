import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Download, RefreshCw, CheckCircle, XCircle, Clock, Loader2, FileText, Scissors, AlertCircle, Archive } from "lucide-react";

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
  fileSize: number;
  bytesProcessed: number;
  canResume: boolean;
}

export default function DividirCsvPage() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [baseName, setBaseName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: runs = [], refetch: refetchRuns } = useQuery<CsvSplitRun[]>({
    queryKey: ["/api/csv-split/runs"],
    refetchInterval: 5000,
  });

  const { data: activeStatus, refetch: refetchStatus } = useQuery<StatusResponse>({
    queryKey: ["/api/csv-split/status", activeRunId],
    enabled: !!activeRunId,
    refetchInterval: (data) => {
      if (!data) return 2000;
      const status = data.status;
      if (status === "concluido" || status === "erro") return false;
      return 2000;
    },
  });

  useEffect(() => {
    if (activeStatus?.status === "concluido") {
      toast({
        title: "Divisão concluída!",
        description: `${activeStatus.currentPart} partes criadas com ${activeStatus.totalLinesProcessed.toLocaleString("pt-BR")} linhas.`,
      });
      refetchRuns();
    } else if (activeStatus?.status === "erro") {
      toast({
        title: "Erro no processamento",
        description: activeStatus.errorMessage || "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, [activeStatus?.status]);

  const resetMutation = useMutation({
    mutationFn: async (runId: number) => {
      const response = await apiRequest("POST", `/api/csv-split/reset/${runId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Job resetado",
        description: "O processamento será retomado automaticamente.",
      });
      refetchRuns();
      refetchStatus();
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
        description: "Processamento iniciado em background.",
      });

      setSelectedFile(null);
      setBaseName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setActiveRunId(data.runId);
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

  const handleViewStatus = (runId: number) => {
    setActiveRunId(runId);
  };

  const handleDownloadZip = async (runId: number) => {
    setIsDownloadingZip(true);
    try {
      const response = await fetch(`/api/csv-split/download-zip/${runId}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao gerar ZIP");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeStatus?.baseName || "partes"}_completo.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download iniciado",
        description: "O arquivo ZIP está sendo baixado.",
      });
    } catch (error: any) {
      toast({
        title: "Erro no download",
        description: error.message || "Erro ao baixar ZIP",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Concluído</Badge>;
      case "processando":
        return <Badge variant="default" className="bg-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processando</Badge>;
      case "convertendo":
        return <Badge variant="default" className="bg-purple-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Convertendo XLSX</Badge>;
      case "pendente":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "erro":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatNumber = (n: number) => n.toLocaleString("pt-BR");
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getProgressPercent = () => {
    if (!activeStatus || !activeStatus.fileSize || activeStatus.fileSize === 0) return 0;
    return Math.min(100, Math.round((activeStatus.bytesProcessed / activeStatus.fileSize) * 100));
  };

  const isProcessing = activeStatus && ["pendente", "processando", "convertendo"].includes(activeStatus.status);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scissors className="w-6 h-6" />
          Dividir CSV em Partes
        </h1>
        <p className="text-muted-foreground mt-1">
          Divide arquivos CSV/XLSX grandes (até 300MB+) em partes de 100.000 linhas, mantendo o cabeçalho em cada parte.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Enviar CSV ou XLSX
          </CardTitle>
          <CardDescription>
            Selecione um arquivo CSV ou XLSX grande para dividir. O processamento acontece em background.
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
              disabled={isUploading}
              data-testid="input-csv-file"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground mt-1">
                Selecionado: {selectedFile.name} ({formatBytes(selectedFile.size)})
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
              disabled={isUploading}
              data-testid="input-base-name"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Os arquivos serão nomeados: nome_parte_000001.csv, nome_parte_000002.csv, etc.
            </p>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
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
              {activeStatus.fileSize > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tamanho:</span>
                  <span className="font-bold">{formatBytes(activeStatus.fileSize)}</span>
                </div>
              )}
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
              {activeStatus.fileSize > 0 && activeStatus.bytesProcessed > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Progresso:</span>
                  <span className="font-bold">{formatBytes(activeStatus.bytesProcessed)} / {formatBytes(activeStatus.fileSize)}</span>
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {activeStatus.status === "convertendo" ? "Convertendo XLSX..." : `Processando parte ${activeStatus.currentPart + 1}...`}
                  </span>
                  {activeStatus.fileSize > 0 && (
                    <span className="font-bold">{getProgressPercent()}%</span>
                  )}
                </div>
                {activeStatus.fileSize > 0 && (
                  <Progress value={getProgressPercent()} className="h-2" />
                )}
              </div>
            )}

            {activeStatus.errorMessage && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {activeStatus.errorMessage}
              </div>
            )}

            {activeStatus.status === "concluido" && activeStatus.outputFiles && activeStatus.outputFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Arquivos gerados ({activeStatus.outputFiles.length} partes):</Label>
                  <Button
                    size="sm"
                    onClick={() => handleDownloadZip(activeStatus.id)}
                    disabled={isDownloadingZip}
                    data-testid="button-download-zip"
                  >
                    {isDownloadingZip ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Gerando ZIP...
                      </>
                    ) : (
                      <>
                        <Archive className="w-3 h-3 mr-1" />
                        Baixar Tudo (ZIP)
                      </>
                    )}
                  </Button>
                </div>
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

            {activeStatus.status === "erro" && (
              <Button
                onClick={() => resetMutation.mutate(activeStatus.id)}
                className="w-full"
                variant="outline"
                data-testid="button-reset"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
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
                      {run.currentPart} partes | {formatNumber(run.totalLinesProcessed)} linhas
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
