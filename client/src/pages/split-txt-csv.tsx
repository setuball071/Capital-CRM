import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface SplitRun {
  id: number;
  status: string;
  originalFilename: string | null;
  currentPart: number;
  linesInCurrentPart: number;
  totalLinesProcessed: number;
  totalParts: number;
  linesPerPart: number;
  byteOffset: number;
  errorMessage: string | null;
  outputFiles: string[];
  canResume: boolean;
  nextStep: string | null;
}

interface ProcessResult {
  success: boolean;
  runId: number;
  status: "continue" | "completed" | "error";
  currentPart: number;
  linesInCurrentPart: number;
  totalLinesProcessed: number;
  totalParts: number;
  message: string;
  outputFiles?: string[];
  nextStep: string | null;
}

export default function SplitTxtCsvPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [linesPerPart, setLinesPerPart] = useState(100000);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const { data: runs = [], refetch: refetchRuns } = useQuery<SplitRun[]>({
    queryKey: ["/api/split/runs"],
    refetchInterval: isProcessing ? 3000 : false,
  });

  const { data: activeStatus, refetch: refetchStatus } = useQuery<SplitRun>({
    queryKey: ["/api/split/status", activeRunId],
    enabled: !!activeRunId,
    refetchInterval: isProcessing ? 2000 : false,
  });

  const startMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/split/start", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao iniciar split");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      toast({ title: "Job criado", description: "Iniciando processamento..." });
      startProcessing(data.runId);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processMutation = useMutation({
    mutationFn: async (runId: number) => {
      return apiRequest("POST", `/api/split/process/${runId}`);
    },
    onSuccess: (data: ProcessResult) => {
      refetchStatus();
      refetchRuns();

      if (data.status === "continue") {
        pollingRef.current = setTimeout(() => {
          processMutation.mutate(data.runId);
        }, 500);
      } else if (data.status === "completed") {
        setIsProcessing(false);
        toast({
          title: "Concluído!",
          description: `${data.totalParts} arquivos gerados com ${data.totalLinesProcessed.toLocaleString()} linhas.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/split/runs"] });
      } else if (data.status === "error") {
        setIsProcessing(false);
        toast({
          title: "Erro no processamento",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setIsProcessing(false);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startProcessing = (runId: number) => {
    setIsProcessing(true);
    processMutation.mutate(runId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "Selecione um arquivo", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", file);
    formData.append("linesPerPart", String(linesPerPart));

    startMutation.mutate(formData);
  };

  const handleResume = (runId: number) => {
    setActiveRunId(runId);
    startProcessing(runId);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Concluído
          </Badge>
        );
      case "processando":
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case "pausado":
        return (
          <Badge variant="outline">
            <Pause className="w-3 h-3 mr-1" />
            Pausado
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
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Split TXT → CSV
        </h1>
        <p className="text-muted-foreground">
          Converta arquivos TXT grandes em múltiplos arquivos CSV de 100.000 linhas
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Novo Split
            </CardTitle>
            <CardDescription>
              Selecione um arquivo TXT com colunas separadas por espaços múltiplos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Arquivo TXT *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  data-testid="input-file"
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="linesPerPart">Linhas por arquivo</Label>
                <Input
                  id="linesPerPart"
                  type="number"
                  value={linesPerPart}
                  onChange={(e) => setLinesPerPart(parseInt(e.target.value) || 100000)}
                  min={10000}
                  max={500000}
                  step={10000}
                  disabled={isProcessing}
                  data-testid="input-lines-per-part"
                />
                <p className="text-xs text-muted-foreground">
                  Padrão: 100.000 linhas por arquivo CSV
                </p>
              </div>

              <Button
                type="submit"
                disabled={!file || isProcessing || startMutation.isPending}
                className="w-full"
                data-testid="button-start-split"
              >
                {startMutation.isPending || isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Iniciar Split
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {activeStatus && isProcessing && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processando
              </CardTitle>
              <CardDescription>{activeStatus.originalFilename}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Parte atual</p>
                  <p className="font-semibold text-lg">{activeStatus.currentPart}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Linhas na parte</p>
                  <p className="font-semibold text-lg">
                    {activeStatus.linesInCurrentPart.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total processado</p>
                  <p className="font-semibold text-lg">
                    {activeStatus.totalLinesProcessed.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  {getStatusBadge(activeStatus.status)}
                </div>
              </div>

              {activeStatus.linesPerPart > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Progresso da parte atual</span>
                    <span>
                      {Math.round(
                        (activeStatus.linesInCurrentPart / activeStatus.linesPerPart) * 100
                      )}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      (activeStatus.linesInCurrentPart / activeStatus.linesPerPart) * 100
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Splits
            </CardTitle>
            <CardDescription>Jobs anteriores e em andamento</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchRuns()}
            data-testid="button-refresh-runs"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum split realizado ainda.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {runs.map((run: any) => (
                  <div
                    key={run.id}
                    className="border rounded-lg p-4 space-y-3"
                    data-testid={`split-run-${run.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {run.originalFilename || `Job #${run.id}`}
                        </span>
                      </div>
                      {getStatusBadge(run.status)}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Partes: </span>
                        <span className="font-medium">
                          {run.totalParts || run.currentPart}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Linhas: </span>
                        <span className="font-medium">
                          {run.totalLinesProcessed?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Por parte: </span>
                        <span className="font-medium">
                          {run.linesPerPart?.toLocaleString() || 100000}
                        </span>
                      </div>
                    </div>

                    {run.status === "pausado" && (
                      <Button
                        size="sm"
                        onClick={() => handleResume(run.id)}
                        disabled={isProcessing}
                        data-testid={`button-resume-${run.id}`}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Retomar
                      </Button>
                    )}

                    {run.status === "concluido" && run.outputFiles && run.outputFiles.length > 0 && (
                      <div className="space-y-2">
                        <Separator />
                        <p className="text-sm text-muted-foreground">
                          Arquivos gerados ({run.outputFiles.length}):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {run.outputFiles.slice(0, 5).map((filePath: string, idx: number) => {
                            const filename = filePath.split("/").pop() || `parte_${idx + 1}.csv`;
                            return (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  (window.location.href = `/api/split/download/${run.id}/${filename}`)
                                }
                                data-testid={`button-download-${run.id}-${idx}`}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                {filename}
                              </Button>
                            );
                          })}
                          {run.outputFiles.length > 5 && (
                            <Badge variant="outline">
                              +{run.outputFiles.length - 5} arquivos
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {run.errorMessage && (
                      <p className="text-sm text-destructive">{run.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
