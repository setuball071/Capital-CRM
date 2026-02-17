import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, FileSpreadsheet, ArrowLeft, CreditCard, ChevronRight, Calendar, User, Upload, DollarSign, CheckCircle2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

interface ImportacaoHistorico {
  id: number;
  tenantId: number;
  fileName: string | null;
  importadoPor: number | null;
  importadoPorNome: string | null;
  totalContratos: number | null;
  totalIgnorados: number | null;
  totalInseridos: number | null;
  totalAtualizados: number | null;
  totalValorGeral: string | null;
  totalValorCartao: string | null;
  mesReferencia: string | null;
  status: string | null;
  createdAt: string;
}

interface ContratoDetalhe {
  id: number;
  contratoId: string;
  nomeCliente: string | null;
  cpfCliente: string | null;
  banco: string | null;
  tipoContrato: string | null;
  convenio: string | null;
  prazo: string | null;
  nomeCorretor: string | null;
  vendedorNome: string | null;
  vendedorId: number | null;
  status: string | null;
  dataPagamento: string | null;
  valorBase: string | null;
  valorBruto: string | null;
  valorLiquido: string | null;
  comissaoRepasseValor: string | null;
  comissaoRepassePerc: string | null;
  isCartao: boolean | null;
  mesReferencia: string | null;
}

export default function GestaoComercialHistoricoPage() {
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: importacoes = [], isLoading } = useQuery<ImportacaoHistorico[]>({
    queryKey: ["/api/gestao-comercial/importacoes"],
  });

  const { data: detalhe, isLoading: loadingDetalhe } = useQuery<{ importacao: ImportacaoHistorico; contratos: ContratoDetalhe[] }>({
    queryKey: ["/api/gestao-comercial/importacoes", selectedId],
    enabled: !!selectedId,
  });

  const formatCurrency = (value: string | number | null) => {
    const num = typeof value === "string" ? parseFloat(value) : (value || 0);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (selectedId && detalhe) {
    const imp = detalhe.importacao;
    const contratos = detalhe.contratos;

    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="page-importacao-detalhe">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setSelectedId(null)} data-testid="button-voltar">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold" data-testid="text-detalhe-title">
              Importação #{imp.id}
            </h1>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  <p className="font-medium">{formatDate(imp.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Importado por</p>
                  <p className="font-medium">{imp.importadoPorNome || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Arquivo</p>
                  <p className="font-medium truncate max-w-[180px]" title={imp.fileName || ""}>{imp.fileName || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Mês Referência</p>
                  <p className="font-medium">{imp.mesReferencia || "—"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{imp.totalContratos || 0}</p>
                  <p className="text-xs text-muted-foreground">Contratos</p>
                </CardContent>
              </Card>
              <Card className="border">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold">{formatCurrency(imp.totalValorGeral)}</p>
                  <p className="text-xs text-muted-foreground">Valor Geral</p>
                </CardContent>
              </Card>
              <Card className="border">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-purple-600">{formatCurrency(imp.totalValorCartao)}</p>
                  <p className="text-xs text-muted-foreground">Valor Cartão</p>
                </CardContent>
              </Card>
              <Card className="border">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-amber-500">{imp.totalIgnorados || 0}</p>
                  <p className="text-xs text-muted-foreground">Ignorados</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contratos Importados ({contratos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetalhe ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-contratos-detalhe">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2 font-medium whitespace-nowrap">Contrato</th>
                      <th className="p-2 font-medium whitespace-nowrap">Corretor</th>
                      <th className="p-2 font-medium whitespace-nowrap">Vendedor</th>
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
                    {contratos.map((c) => (
                      <tr key={c.id} className="border-b hover-elevate">
                        <td className="p-2 whitespace-nowrap">{c.contratoId}</td>
                        <td className="p-2 max-w-[160px] truncate" title={c.nomeCorretor || ""}>{c.nomeCorretor}</td>
                        <td className="p-2 whitespace-nowrap">
                          {c.vendedorNome ? (
                            <span className="text-green-600 font-medium text-xs">{c.vendedorNome}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="p-2 max-w-[160px] truncate" title={c.nomeCliente || ""}>{c.nomeCliente}</td>
                        <td className="p-2 whitespace-nowrap">{c.cpfCliente}</td>
                        <td className="p-2 max-w-[100px] truncate" title={c.banco || ""}>{c.banco}</td>
                        <td className="p-2 whitespace-nowrap">{c.convenio}</td>
                        <td className="p-2 max-w-[120px] truncate" title={c.tipoContrato || ""}>{c.tipoContrato}</td>
                        <td className="p-2 text-center">{c.prazo}</td>
                        <td className="p-2 whitespace-nowrap">{c.dataPagamento}</td>
                        <td className="p-2 text-right font-medium whitespace-nowrap">{formatCurrency(c.valorBase)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(c.valorBruto)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{parseFloat(c.comissaoRepassePerc || "0")}%</td>
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
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" data-testid="page-historico-importacoes">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-historico-title">Histórico de Importações</h1>
        </div>
        <Button
          onClick={() => navigate("/vendas/gestao-comercial/importar-producao")}
          data-testid="button-nova-importacao"
        >
          <Upload className="h-4 w-4 mr-2" />
          Nova Importação
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : importacoes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma importação realizada ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {importacoes.map((imp) => (
            <Card
              key={imp.id}
              className="cursor-pointer hover-elevate"
              onClick={() => setSelectedId(imp.id)}
              data-testid={`card-importacao-${imp.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 shrink-0">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate" data-testid={`text-filename-${imp.id}`}>
                          {imp.fileName || "Importação sem nome"}
                        </p>
                        <Badge variant="secondary" className="no-default-active-elevate text-xs">
                          #{imp.id}
                        </Badge>
                        {imp.mesReferencia && (
                          <Badge variant="outline" className="no-default-active-elevate text-xs">
                            {imp.mesReferencia}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDate(imp.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {imp.importadoPorNome || "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" /> {imp.totalContratos || 0} contratos
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> {formatCurrency(imp.totalValorGeral)}
                        </span>
                        {parseFloat(imp.totalValorCartao || "0") > 0 && (
                          <span className="flex items-center gap-1 text-purple-600">
                            <CreditCard className="h-3 w-3" /> {formatCurrency(imp.totalValorCartao)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
