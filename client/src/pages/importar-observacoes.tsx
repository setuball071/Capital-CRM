import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Download, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

interface RemoveResult {
  removed: number;
  errors: number;
}

export default function ImportarObservacoesPage() {
  const { toast } = useToast();

  // Importar
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Remover
  const removeFileRef = useRef<HTMLInputElement>(null);
  const [removeFile, setRemoveFile] = useState<File | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeResult, setRemoveResult] = useState<RemoveResult | null>(null);

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
    } catch (err: any) {
      toast({ title: err.message || "Erro ao importar", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemove = async () => {
    if (!removeFile) {
      toast({ title: "Selecione um arquivo CSV", variant: "destructive" });
      return;
    }
    setIsRemoving(true);
    setRemoveResult(null);
    try {
      const formData = new FormData();
      formData.append("file", removeFile);
      const res = await fetch("/api/client-observations/limpar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao remover");
      }
      const data: RemoveResult = await res.json();
      setRemoveResult(data);
      toast({ title: `${data.removed} observação(ões) removida(s)` });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao remover", variant: "destructive" });
    } finally {
      setIsRemoving(false);
    }
  };

  const handleDownloadModeloImportar = () => {
    const csv = `cpf,observacao\n96177837700,"Cliente VIP - contato preferencial WhatsApp"`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importar-observacoes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadModeloRemover = () => {
    const csv = `cpf,observacao\n96177837700,"Cliente VIP - contato preferencial WhatsApp"\n12345678901,`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-remover-observacoes.csv";
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
          <TabsTrigger value="remover" className="flex-1 gap-2">
            <Trash2 className="h-4 w-4" /> Remover
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
                <Button variant="outline" onClick={handleDownloadModeloImportar}>
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

        {/* ─── Remover ─── */}
        <TabsContent value="remover" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Remover observações</CardTitle>
              <CardDescription>
                CSV com coluna <code className="bg-muted px-1 rounded text-xs">cpf</code> obrigatória.
                Se incluir a coluna <code className="bg-muted px-1 rounded text-xs">observacao</code>, remove somente aquela observação específica.
                Se omitir (ou deixar vazia), remove <strong>todas</strong> as observações do CPF.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed border-destructive/40 rounded-md p-8 text-center cursor-pointer hover:border-destructive/70 transition-colors"
                onClick={() => removeFileRef.current?.click()}
              >
                <Trash2 className="h-8 w-8 text-destructive/50 mx-auto mb-2" />
                {removeFile ? (
                  <div>
                    <p className="font-medium">{removeFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(removeFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-muted-foreground">Clique para selecionar o arquivo CSV</p>
                    <p className="text-xs text-muted-foreground mt-1">Formato: .csv</p>
                  </div>
                )}
              </div>
              <input
                ref={removeFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { setRemoveFile(e.target.files?.[0] || null); setRemoveResult(null); }}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="destructive" onClick={handleRemove} disabled={isRemoving || !removeFile}>
                  {isRemoving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Remover observações
                </Button>
                <Button variant="outline" onClick={handleDownloadModeloRemover}>
                  <Download className="h-4 w-4 mr-2" />Baixar modelo CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {removeResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />Resultado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-green-600">{removeResult.removed}</p>
                    <p className="text-sm text-muted-foreground">Removidas</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-destructive">{removeResult.errors}</p>
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                      {removeResult.errors > 0 && <AlertCircle className="h-3 w-3" />}Erros
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
