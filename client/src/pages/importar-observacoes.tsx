import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Upload, Download, CheckCircle, AlertCircle, Loader2, Trash2, History, RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

interface ImportBatch {
  batch_id: string;
  filename: string | null;
  imported_at: string;
  count: number;
  imported_by_name: string | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ImportarObservacoesPage() {
  const { toast } = useToast();

  // ─── Importar ───
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ─── Histórico ───
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmBatch, setConfirmBatch] = useState<ImportBatch | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/client-observations/imports", { credentials: "include" });
      if (!res.ok) throw new Error();
      const data: ImportBatch[] = await res.json();
      setBatches(data);
    } catch {
      toast({ title: "Erro ao carregar histórico", variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  }, [toast]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleImport = async () => {
    if (!importFile) {
      toast({ title: "Selecione um arquivo CSV", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch("/api/client-observations/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao importar");
      }
      const data: ImportResult = await res.json();
      setImportResult(data);
      toast({ title: `Importação concluída: ${data.imported} novas, ${data.skipped} já existiam` });
      // Refresh history so the new batch appears
      fetchHistory();
    } catch (err: any) {
      toast({ title: err.message || "Erro ao importar", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteBatch = async (batch: ImportBatch) => {
    setDeletingId(batch.batch_id);
    try {
      const res = await fetch(`/api/client-observations/imports/${encodeURIComponent(batch.batch_id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao excluir");
      }
      const data = await res.json();
      toast({ title: `${data.removed} observação(ões) removida(s)` });
      setBatches(prev => prev.filter(b => b.batch_id !== batch.batch_id));
    } catch (err: any) {
      toast({ title: err.message || "Erro ao excluir lote", variant: "destructive" });
    } finally {
      setDeletingId(null);
      setConfirmBatch(null);
    }
  };

  const handleDownloadModelo = () => {
    const csv = `cpf,observacao\n96177837700,"Cliente VIP - contato preferencial WhatsApp"`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importar-observacoes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Observações de Clientes
        </h1>
        <p className="text-muted-foreground mt-1">
          Importe ou remova observações vinculadas aos clientes por CPF.
        </p>
      </div>

      <Tabs defaultValue="importar">
        <TabsList className="w-full">
          <TabsTrigger value="importar" className="flex-1 gap-2">
            <Upload className="h-4 w-4" /> Importar
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex-1 gap-2">
            <History className="h-4 w-4" /> Histórico / Remover
          </TabsTrigger>
        </TabsList>

        {/* ─── Importar ─── */}
        <TabsContent value="importar" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload do arquivo</CardTitle>
              <CardDescription>
                CSV com colunas <code className="bg-muted px-1 rounded text-xs">cpf</code> e{" "}
                <code className="bg-muted px-1 rounded text-xs">observacao</code>. Reimportar o mesmo arquivo não cria duplicatas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover-elevate"
                onClick={() => importFileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                {importFile ? (
                  <div>
                    <p className="font-medium">{importFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-muted-foreground">Clique para selecionar o arquivo CSV</p>
                    <p className="text-xs text-muted-foreground mt-1">Formato: .csv</p>
                  </div>
                )}
              </div>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleImport} disabled={isImporting || !importFile}>
                  {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Importar
                </Button>
                <Button variant="outline" onClick={handleDownloadModelo}>
                  <Download className="h-4 w-4 mr-2" />Baixar modelo CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />Resultado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                    <p className="text-sm text-muted-foreground">Novas</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-blue-600">{importResult.skipped}</p>
                    <p className="text-sm text-muted-foreground">Já existiam</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-destructive">{importResult.errors}</p>
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                      {importResult.errors > 0 && <AlertCircle className="h-3 w-3" />}Erros
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Histórico / Remover ─── */}
        <TabsContent value="historico" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Importações realizadas
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Clique em <strong>Excluir lote</strong> para remover todas as observações daquela importação.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchHistory} disabled={loadingHistory}>
                  <RefreshCw className={`h-4 w-4 ${loadingHistory ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : batches.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma importação registrada</p>
                  <p className="text-xs mt-1">Importe um arquivo CSV na aba "Importar" para começar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {batches.map((batch) => (
                    <div
                      key={batch.batch_id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {batch.filename || "arquivo.csv"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(batch.imported_at)}
                          {batch.imported_by_name && (
                            <span className="ml-2 text-muted-foreground/70">· {batch.imported_by_name}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold tabular-nums">
                          {Number(batch.count).toLocaleString("pt-BR")}
                          <span className="text-xs font-normal text-muted-foreground ml-1">obs.</span>
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmBatch(batch)}
                          disabled={deletingId === batch.batch_id}
                        >
                          {deletingId === batch.batch_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1.5">Excluir lote</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Confirm Dialog ─── */}
      <AlertDialog open={!!confirmBatch} onOpenChange={(open) => { if (!open) setConfirmBatch(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote de importação?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai remover <strong>{confirmBatch ? Number(confirmBatch.count).toLocaleString("pt-BR") : 0} observação(ões)</strong> importadas
              {confirmBatch?.filename ? ` do arquivo "${confirmBatch.filename}"` : ""} em{" "}
              {confirmBatch ? formatDate(confirmBatch.imported_at) : ""}.<br /><br />
              Esta ação <strong>não pode ser desfeita</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmBatch && handleDeleteBatch(confirmBatch)}
            >
              Sim, excluir lote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
