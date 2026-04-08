import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Download, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

export default function ImportarObservacoesPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setResult(null);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({ title: "Selecione um arquivo CSV", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
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
      setResult(data);
      toast({ title: `Importação concluída: ${data.imported} novos, ${data.skipped} ignorados (já existiam)` });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao importar", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadModelo = () => {
    const csv = `cpf,observacao\n96177837700,"Cliente VIP - contato preferencial WhatsApp"`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-observacoes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Importação de Observações de Clientes
        </h1>
        <p className="text-muted-foreground mt-1">
          Importe um CSV com CPF e observação para complementar as informações dos clientes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload do arquivo</CardTitle>
          <CardDescription>
            O CSV deve ter duas colunas: <code className="bg-muted px-1 rounded text-xs">cpf</code> e{" "}
            <code className="bg-muted px-1 rounded text-xs">observacao</code>. Cada linha é adicionada como nova observação. Reimportar o mesmo arquivo não cria duplicatas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover-elevate"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            {selectedFile ? (
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground">Clique para selecionar o arquivo CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Formato: .csv</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleImport} disabled={isImporting || !selectedFile}>
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Importar
            </Button>
            <Button variant="outline" onClick={handleDownloadModelo}>
              <Download className="h-4 w-4 mr-2" />
              Baixar modelo CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                <p className="text-sm text-muted-foreground">Novos registros</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-blue-600">{result.skipped}</p>
                <p className="text-sm text-muted-foreground">Já existiam (ignorados)</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-destructive">{result.errors}</p>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  {result.errors > 0 && <AlertCircle className="h-3 w-3" />}
                  Erros / ignorados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
