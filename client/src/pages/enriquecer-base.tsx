import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function EnriquecerBasePage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ total: number; encontrados: number; blob: Blob } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("arquivo", file);

      const res = await fetch("/api/bases/enriquecer-cpf", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao processar arquivo");
      }

      const blob = await res.blob();

      // Count rows from content-disposition or just show download
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      void contentDisposition;

      setResult({ total: 0, encontrados: 0, blob });
      toast({ title: "Arquivo gerado com sucesso!" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao processar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base_enriquecida_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enriquecer Base por CPF</h1>
        <p className="text-muted-foreground mt-1">
          Importe um Excel com CPFs na primeira coluna e receba de volta os dados completos do sistema: nome, data de nascimento, telefones e margens atualizadas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Formato esperado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Arquivo <strong>.xlsx</strong> ou <strong>.csv</strong></p>
          <p>• CPFs na <strong>primeira coluna</strong> (com ou sem formatação)</p>
          <p>• Limite: <strong>50.000 CPFs</strong> por arquivo</p>
          <p>• A primeira linha pode ser cabeçalho — CPFs não-numéricos são ignorados</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            {file ? (
              <div className="space-y-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Clique para selecionar o arquivo</p>
                <p className="text-sm text-muted-foreground">.xlsx, .xls ou .csv</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />

          <Button
            className="w-full"
            disabled={!file || loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Processar e Baixar Excel
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Arquivo gerado com sucesso!</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                Pronto para download
              </Badge>
            </div>
            <Button onClick={handleDownload} className="w-full" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Baixar Excel Enriquecido
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground font-medium mb-2">Dados retornados por CPF:</p>
          <div className="flex flex-wrap gap-1.5">
            {["Nome", "Data Nascimento", "Telefone 1/2/3", "Margem Empréstimo", "Margem Cartão", "Margem 5%", "Convênio", "Órgão", "UF", "Município", "Situação Funcional", "Salário Bruto"].map(d => (
              <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
