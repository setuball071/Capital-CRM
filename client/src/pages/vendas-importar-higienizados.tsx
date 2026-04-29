import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, Sparkles, CheckCircle2, FileSpreadsheet, ArrowLeft } from "lucide-react";

interface ImportResult {
  imported: number;
  updated: number;
  ignored: number;
  removedByPortfolio: number;
  campaignId: number;
  nomeCampanha: string;
  total?: number;
}

const KNOWN_COLUMNS = [
  "cpf", "nome", "telefone1", "telefone2", "telefone3",
  "matricula", "margem70", "margemCartao", "parcela",
  "taxa", "banco", "convenioCol", "orgao", "sitfunc", "observacoes"
];

const COLUMN_LABELS: Record<string, string> = {
  cpf: "CPF",
  nome: "Nome",
  telefone1: "Telefone 1",
  telefone2: "Telefone 2",
  telefone3: "Telefone 3",
  matricula: "Matrícula",
  margem70: "Margem 70%",
  margemCartao: "Margem Cartão",
  parcela: "Parcela",
  taxa: "Taxa",
  banco: "Banco",
  convenioCol: "Convênio",
  orgao: "Órgão",
  sitfunc: "Sit. Funcional",
  observacoes: "Observações",
};

export default function VendasImportarHigienizados() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [convenio, setConvenio] = useState("");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [detectedMapping, setDetectedMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobTotal, setJobTotal] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const COLUMN_MAP: Record<string, string> = {
    cpf: "cpf",
    nome: "nome",
    telefone1: "telefone1", telefone: "telefone1", celular: "telefone1", fone1: "telefone1",
    telefone2: "telefone2", fone2: "telefone2",
    telefone3: "telefone3", fone3: "telefone3",
    matricula: "matricula",
    margem: "margem70", margem70: "margem70",
    margemcartao: "margemCartao", margemcartão: "margemCartao",
    parcela: "parcela", valorparcela: "parcela",
    taxa: "taxa", taxareal: "taxa",
    banco: "banco", bancooferta: "banco",
    convenio: "convenioCol", convênio: "convenioCol",
    orgao: "orgao", orgão: "orgao",
    sitfunc: "sitfunc", situacaofuncional: "sitfunc",
    observacoes: "observacoes", observações: "observacoes", obs: "observacoes",
  };

  const normalizeHeader = (h: string) => {
    return h.toLowerCase().trim()
      .replace(/[_\s]+/g, '')
      .replace(/[áàã]/g, 'a')
      .replace(/[éè]/g, 'e')
      .replace(/[íì]/g, 'i')
      .replace(/[óòõ]/g, 'o')
      .replace(/[úù]/g, 'u')
      .replace(/ç/g, 'c');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length === 0) return;

      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
      setPreviewHeaders(headers);

      const mapping: Record<string, string> = {};
      for (const h of headers) {
        const norm = normalizeHeader(h);
        for (const [key, mappedField] of Object.entries(COLUMN_MAP)) {
          const normKey = key.replace(/[_\s]+/g, '');
          if (norm === normKey || norm.includes(normKey)) {
            mapping[h] = mappedField;
            break;
          }
        }
      }
      setDetectedMapping(mapping);

      const rows: Record<string, string>[] = [];
      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        const vals = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = vals[idx] || '';
        });
        rows.push(row);
      }
      setPreviewData(rows);
    };
    reader.readAsText(selected, 'utf-8');
  };

  // Poll job status while processing
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/vendas/import-job/${jobId}`, { credentials: "include" });
        if (!res.ok) return;
        const job = await res.json();
        setJobProgress(job.progress || 0);
        if (job.status === "done") {
          clearInterval(pollRef.current!);
          setJobId(null);
          setResult({ ...job.result, total: job.total });
          toast({ title: "Importação concluída!", description: `${job.result.imported} leads importados` });
        } else if (job.status === "error") {
          clearInterval(pollRef.current!);
          setJobId(null);
          toast({ title: "Erro na importação", description: job.error || "Erro desconhecido", variant: "destructive" });
        }
      } catch { /* ignore poll errors */ }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, toast]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("file", file!);
      formData.append("nomeCampanha", nomeCampanha);
      if (convenio) formData.append("convenio", convenio);
      if (descricao) formData.append("descricao", descricao);

      const response = await fetch("/api/vendas/importar-higienizados", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Erro na importação");
      }
      return response.json() as Promise<{ jobId: string; total: number }>;
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setJobTotal(data.total);
      setJobProgress(0);
      toast({ title: "Processando importação…", description: `${data.total.toLocaleString("pt-BR")} linhas sendo importadas em background` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    },
  });

  const isProcessing = importMutation.isPending || !!jobId;
  const mappedCount = useMemo(() => Object.keys(detectedMapping).length, [detectedMapping]);
  const canSubmit = nomeCampanha.trim() && file && previewData.length > 0 && !isProcessing;

  if (result) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <CardTitle data-testid="text-import-success">Importação Concluída</CardTitle>
                <CardDescription>Campanha "{result.nomeCampanha}" criada com sucesso</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {result.total && (
                <div className="text-center p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold" data-testid="text-total-lines">{result.total.toLocaleString("pt-BR")}</div>
                  <div className="text-sm text-muted-foreground">Total no CSV</div>
                </div>
              )}
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <div className="text-2xl font-bold text-green-600" data-testid="text-imported-count">{result.imported.toLocaleString("pt-BR")}</div>
                <div className="text-sm text-muted-foreground">Importados</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="text-2xl font-bold text-blue-600" data-testid="text-updated-count">{result.updated.toLocaleString("pt-BR")}</div>
                <div className="text-sm text-muted-foreground">Atualizados</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-muted-foreground" data-testid="text-ignored-count">{result.ignored.toLocaleString("pt-BR")}</div>
                <div className="text-sm text-muted-foreground">Ignorados</div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={() => navigate("/vendas/campanhas")} data-testid="button-go-to-campaigns">
                Ver Campanhas
              </Button>
              <Button variant="outline" onClick={() => { setResult(null); setFile(null); setPreviewData([]); setPreviewHeaders([]); setDetectedMapping({}); setNomeCampanha(""); setConvenio(""); setDescricao(""); }} data-testid="button-new-import">
                Nova Importação
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/vendas/campanhas")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Importar Lista Higienizada</h1>
          <p className="text-muted-foreground">Importe um CSV enriquecido para criar uma nova campanha</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Dados da Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nomeCampanha">Nome da Campanha *</Label>
              <Input
                id="nomeCampanha"
                value={nomeCampanha}
                onChange={(e) => setNomeCampanha(e.target.value)}
                placeholder="Ex: Higienizados SIAPE Jan/2026"
                data-testid="input-nome-campanha"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="convenio">Convênio</Label>
              <Input
                id="convenio"
                value={convenio}
                onChange={(e) => setConvenio(e.target.value)}
                placeholder="Ex: SIAPE"
                data-testid="input-convenio"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição da campanha"
              data-testid="input-descricao"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload do CSV
          </CardTitle>
          <CardDescription>
            O sistema detecta automaticamente as colunas do seu arquivo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csvFile">Arquivo CSV</Label>
            <Input
              id="csvFile"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              data-testid="input-file-upload"
            />
          </div>

          {previewHeaders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label>Mapeamento de Colunas Detectado</Label>
                <Badge variant="secondary" data-testid="text-mapped-count">
                  {mappedCount} de {previewHeaders.length} colunas mapeadas
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {previewHeaders.map((h) => (
                  <div key={h} className="flex items-center gap-1">
                    <Badge variant={detectedMapping[h] ? "default" : "outline"}>
                      {h}
                    </Badge>
                    {detectedMapping[h] && (
                      <span className="text-xs text-muted-foreground">
                        → {COLUMN_LABELS[detectedMapping[h]] || detectedMapping[h]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewData.length > 0 && (
            <div className="space-y-2">
              <Label>Prévia das primeiras {previewData.length} linhas</Label>
              <div className="overflow-auto border rounded-lg max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewHeaders.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-xs">
                          {h}
                          {detectedMapping[h] && (
                            <span className="block text-[10px] text-green-600 font-normal">
                              {COLUMN_LABELS[detectedMapping[h]] || detectedMapping[h]}
                            </span>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i}>
                        {previewHeaders.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap text-xs">
                            {row[h] || "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress bar while background job is running */}
      {jobId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Importando em background… {jobProgress.toLocaleString("pt-BR")} / {jobTotal.toLocaleString("pt-BR")} linhas
            </div>
            <Progress value={jobTotal > 0 ? (jobProgress / jobTotal) * 100 : 0} className="h-2" />
            <p className="text-xs text-muted-foreground">Você pode continuar usando o sistema enquanto a importação é processada.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/vendas/campanhas")} data-testid="button-cancel" disabled={isProcessing}>
          Cancelar
        </Button>
        <Button
          onClick={() => importMutation.mutate()}
          disabled={!canSubmit}
          data-testid="button-confirm-import"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Confirmar Importação
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
