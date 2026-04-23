import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet, Upload, Download, CheckCircle, AlertCircle, Loader2, Info,
} from "lucide-react";

interface ImportResult {
  linhas_lidas: number;
  pessoas_atualizadas: number;
  telefones_inseridos: number;
  cpfs_nao_encontrados: number;
  erros_por_linha: { linha: number; cpf: string | null; mensagem: string }[];
}

const COLUMNS = [
  { col: "CPF",              obrig: true,  desc: "Apenas números (11 dígitos)" },
  { col: "NOME",             obrig: false, desc: "Atualiza o nome se o cliente não tiver" },
  { col: "DATA_NASCIMENTO",  obrig: false, desc: "Formato DD/MM/AAAA" },
  { col: "BANCO_CODIGO",     obrig: false, desc: "Código do banco (ex: 001, 104)" },
  { col: "AGENCIA",          obrig: false, desc: "Número da agência" },
  { col: "CONTA",            obrig: false, desc: "Número da conta" },
  { col: "TELEFONE_1",       obrig: false, desc: "Telefone principal" },
  { col: "TELEFONE_2",       obrig: false, desc: "Telefone alternativo" },
  { col: "TELEFONE_3",       obrig: false, desc: "Telefone adicional" },
];

export default function ImportarDadosComplementaresPage() {
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

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("/api/imports/dados-complementares/template", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao baixar modelo");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo_dados_complementares.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao baixar modelo", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({ title: "Selecione um arquivo XLSX ou CSV", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("arquivo", selectedFile);
      const res = await fetch("/api/imports/dados-complementares", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao importar");
      setResult(data);
      toast({ title: `Importação concluída — ${data.pessoas_atualizadas} clientes atualizados` });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao importar", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar Dados Complementares</h1>
        <p className="text-muted-foreground mt-1">
          Enriqueça a base de clientes com telefones, dados bancários, nome e data de nascimento vindos de higienizações externas.
        </p>
      </div>

      {/* Colunas aceitas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Colunas aceitas na planilha
          </CardTitle>
          <CardDescription>
            Apenas CPF é obrigatório. As demais colunas são opcionais — somente o que estiver preenchido será atualizado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {COLUMNS.map(({ col, obrig, desc }) => (
              <div key={col} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/40">
                <code className="font-mono font-semibold text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 mt-0.5">{col}</code>
                <div>
                  {obrig && <Badge variant="destructive" className="text-[10px] px-1 py-0 mr-1">Obrigatório</Badge>}
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Importar arquivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={handleDownloadTemplate} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Baixar planilha modelo
            </Button>
          </div>

          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            {selectedFile ? (
              <div className="space-y-1">
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Clique para selecionar o arquivo</p>
                <p className="text-sm text-muted-foreground">XLSX, XLS ou CSV</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />

          <Button
            className="w-full"
            disabled={!selectedFile || isImporting}
            onClick={handleImport}
          >
            {isImporting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />Importar dados</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Resultado da importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{result.linhas_lidas}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Linhas lidas</div>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{result.pessoas_atualizadas}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Clientes atualizados</div>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{result.telefones_inseridos}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Telefones inseridos</div>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{result.cpfs_nao_encontrados}</div>
                <div className="text-xs text-muted-foreground mt-0.5">CPFs não encontrados</div>
              </div>
            </div>

            {result.erros_por_linha.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {result.erros_por_linha.length} erro{result.erros_por_linha.length > 1 ? "s" : ""}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {result.erros_por_linha.map((e, i) => (
                    <div key={i} className="text-xs bg-destructive/5 text-destructive px-3 py-1.5 rounded">
                      Linha {e.linha}{e.cpf ? ` · CPF ${e.cpf}` : ""}: {e.mensagem}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
