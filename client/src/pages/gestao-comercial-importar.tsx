import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, X, CreditCard, DollarSign, FileCheck, FileX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ContratoPreview {
  contratoId: string;
  nomeCliente: string;
  cpfCliente: string;
  banco: string;
  tipoContrato: string;
  convenio: string;
  prazo: string;
  nomeCorretor: string;
  codigoCorretor: string;
  grupoVendedor: string;
  filial: string;
  status: string;
  dataPagamento: string;
  valorBase: number;
  valorBruto: number;
  valorLiquido: number;
  comissaoRepasseValor: number;
  comissaoRepassePerc: number;
  isCartao: boolean;
  mesReferencia: string;
}

interface ResumoImportacao {
  totalImportado: number;
  totalPagoValido: number;
  totalValorGeral: number;
  totalValorCartao: number;
  totalIgnorados: number;
}

interface ContratoIgnorado {
  linha: number;
  contratoId: string;
  nomeCliente: string;
  cpfCliente?: string;
  banco?: string;
  status: string;
  dataPagamento: string;
  valorBase?: number;
  motivo: string;
}

type Step = "upload" | "preview" | "confirmed";

export default function GestaoComercialImportarPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [fileName, setFileName] = useState("");
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [contratos, setContratos] = useState<ContratoPreview[]>([]);
  const [ignorados, setIgnorados] = useState<ContratoIgnorado[]>([]);
  const [showIgnorados, setShowIgnorados] = useState(false);
  const [resultado, setResultado] = useState<{ inseridos: number; atualizados: number; ignorados: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const handleFile = useCallback(async (file: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!validTypes.includes(file.type) && !["xlsx", "xls", "csv"].includes(ext || "")) {
      toast({ title: "Formato inválido", description: "Envie um arquivo .xlsx, .xls ou .csv", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/gestao-comercial/importar/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao processar arquivo");
      }

      const data = await response.json();
      setResumo(data.resumo);
      setContratos(data.contratos);
      setIgnorados(data.ignorados || []);
      setShowIgnorados(false);
      setStep("preview");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao processar arquivo", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const response = await apiRequest("POST", "/api/gestao-comercial/importar/confirmar", { contratos });
      const data = await response.json();
      setResultado(data.resultado);
      setStep("confirmed");
      toast({ title: "Importação confirmada", description: data.message });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao confirmar importação", variant: "destructive" });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setFileName("");
    setResumo(null);
    setContratos([]);
    setIgnorados([]);
    setShowIgnorados(false);
    setResultado(null);
  };

  const validContratos = contratos.filter((c) => c.status === "PAGO AO CLIENTE" && c.dataPagamento);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="page-gestao-importar">
      <div className="flex items-center gap-3">
        <Upload className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Importar Produção</h1>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload de Planilha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-md p-12 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              data-testid="dropzone-upload"
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Processando {fileName}...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Upload className="h-12 w-12 text-muted-foreground/50" />
                  <div>
                    <p className="text-lg font-medium">Arraste a planilha aqui</p>
                    <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar o arquivo</p>
                  </div>
                  <label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileInput}
                      data-testid="input-file-upload"
                    />
                    <Button variant="outline" asChild>
                      <span data-testid="button-select-file">Selecionar Arquivo</span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground">Formatos aceitos: .xlsx, .xls, .csv</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && resumo && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Validação da Importação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Arquivo: {fileName}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card className="border">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold" data-testid="text-total-importado">{resumo.totalImportado}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Importado</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-2xl font-bold text-green-600" data-testid="text-total-pago">{resumo.totalPagoValido}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Pagos Válidos</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <p className="text-2xl font-bold" data-testid="text-total-valor-geral">{formatCurrency(resumo.totalValorGeral)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Valor Geral</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CreditCard className="h-4 w-4 text-purple-600" />
                      <p className="text-2xl font-bold text-purple-600" data-testid="text-total-valor-cartao">{formatCurrency(resumo.totalValorCartao)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Valor Cartão</p>
                  </CardContent>
                </Card>
                <Card
                  className={`border ${resumo.totalIgnorados > 0 ? "cursor-pointer hover-elevate" : ""}`}
                  onClick={() => {
                    if (resumo.totalIgnorados > 0) {
                      setShowIgnorados(true);
                      setTimeout(() => {
                        document.getElementById("section-ignorados")?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }
                  }}
                >
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <p className="text-2xl font-bold text-amber-500" data-testid="text-total-ignorados">{resumo.totalIgnorados}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Ignorados</p>
                    {resumo.totalIgnorados > 0 && (
                      <p className="text-xs text-primary mt-1">Clique para ver</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contratos Pagos Válidos ({validContratos.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-contratos-preview">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2 font-medium whitespace-nowrap">Contrato</th>
                      <th className="p-2 font-medium whitespace-nowrap">Corretor</th>
                      <th className="p-2 font-medium whitespace-nowrap">Cliente</th>
                      <th className="p-2 font-medium whitespace-nowrap">CPF</th>
                      <th className="p-2 font-medium whitespace-nowrap">Banco</th>
                      <th className="p-2 font-medium whitespace-nowrap">Convênio</th>
                      <th className="p-2 font-medium whitespace-nowrap">Tipo</th>
                      <th className="p-2 font-medium whitespace-nowrap">Prazo</th>
                      <th className="p-2 font-medium whitespace-nowrap">Data Pgto</th>
                      <th className="p-2 font-medium whitespace-nowrap text-right">Valor Base</th>
                      <th className="p-2 font-medium whitespace-nowrap text-right">Valor Bruto</th>
                      <th className="p-2 font-medium whitespace-nowrap text-right">Comissão %</th>
                      <th className="p-2 font-medium whitespace-nowrap text-right">Comissão R$</th>
                      <th className="p-2 font-medium whitespace-nowrap text-center">Cartão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validContratos.map((c, i) => (
                      <tr key={c.contratoId + "-" + i} className="border-b hover-elevate">
                        <td className="p-2 whitespace-nowrap">{c.contratoId}</td>
                        <td className="p-2 max-w-[160px] truncate" title={c.nomeCorretor}>{c.nomeCorretor}</td>
                        <td className="p-2 max-w-[160px] truncate" title={c.nomeCliente}>{c.nomeCliente}</td>
                        <td className="p-2 whitespace-nowrap">{c.cpfCliente}</td>
                        <td className="p-2 max-w-[100px] truncate" title={c.banco}>{c.banco}</td>
                        <td className="p-2 whitespace-nowrap">{c.convenio}</td>
                        <td className="p-2 max-w-[120px] truncate" title={c.tipoContrato}>{c.tipoContrato}</td>
                        <td className="p-2 text-center">{c.prazo}</td>
                        <td className="p-2 whitespace-nowrap">{c.dataPagamento}</td>
                        <td className="p-2 text-right font-medium whitespace-nowrap">{formatCurrency(c.valorBase)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(c.valorBruto)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{c.comissaoRepassePerc}%</td>
                        <td className="p-2 text-right font-medium whitespace-nowrap">{formatCurrency(c.comissaoRepasseValor)}</td>
                        <td className="p-2 text-center">
                          {c.isCartao ? (
                            <CreditCard className="h-4 w-4 text-purple-600 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {ignorados.length > 0 && (
            <Card id="section-ignorados">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileX className="h-5 w-5 text-amber-500" />
                  Contratos Ignorados ({ignorados.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowIgnorados(!showIgnorados)}
                  data-testid="button-toggle-ignorados"
                >
                  {showIgnorados ? "Ocultar detalhes" : "Ver detalhes"}
                </Button>
              </CardHeader>
              {showIgnorados && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-ignorados">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-2 font-medium">Linha</th>
                          <th className="p-2 font-medium">Contrato</th>
                          <th className="p-2 font-medium">Cliente</th>
                          <th className="p-2 font-medium">Status</th>
                          <th className="p-2 font-medium">Data Pgto</th>
                          <th className="p-2 font-medium">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ignorados.map((ig, i) => (
                          <tr key={ig.contratoId + "-" + i} className="border-b">
                            <td className="p-2 text-muted-foreground">{ig.linha}</td>
                            <td className="p-2">{ig.contratoId}</td>
                            <td className="p-2 max-w-[150px] truncate">{ig.nomeCliente}</td>
                            <td className="p-2">
                              <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-xs">
                                <AlertTriangle className="h-3 w-3" /> {ig.status || "(vazio)"}
                              </span>
                            </td>
                            <td className="p-2 text-muted-foreground">{ig.dataPagamento}</td>
                            <td className="p-2">
                              <span className="text-destructive text-xs">{ig.motivo}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Button variant="outline" onClick={handleReset} data-testid="button-cancel">
              <X className="h-4 w-4 mr-2" /> Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isConfirming || resumo.totalPagoValido === 0}
              data-testid="button-confirm"
            >
              {isConfirming ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirmar Importação ({resumo.totalPagoValido} contratos)
            </Button>
          </div>
        </>
      )}

      {step === "confirmed" && resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Importação Concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-green-600" data-testid="text-inseridos">{resultado.inseridos}</p>
                  <p className="text-sm text-muted-foreground mt-1">Novos Contratos</p>
                </CardContent>
              </Card>
              <Card className="border">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600" data-testid="text-atualizados">{resultado.atualizados}</p>
                  <p className="text-sm text-muted-foreground mt-1">Atualizados</p>
                </CardContent>
              </Card>
              <Card className="border">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-amber-500" data-testid="text-ignorados-final">{resultado.ignorados}</p>
                  <p className="text-sm text-muted-foreground mt-1">Ignorados</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              <Button onClick={handleReset} data-testid="button-nova-importacao">
                <Upload className="h-4 w-4 mr-2" />
                Nova Importação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
