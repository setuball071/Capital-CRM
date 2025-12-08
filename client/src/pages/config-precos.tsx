import { useQuery } from "@tanstack/react-query";
import { DollarSign, Loader2, Package, AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PacotePreco {
  quantidadeMaxima: number;
  nomePacote: string;
  preco: number;
}

interface PricingSettingsResponse {
  pacotes: PacotePreco[];
  message: string;
}

export default function ConfigPrecosPage() {
  const { data, isLoading, error } = useQuery<PricingSettingsResponse>({
    queryKey: ["/api/pricing-settings"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  const calculatePricePerRecord = (preco: number, quantidade: number) => {
    return preco / quantidade;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Erro ao carregar configurações de preços</p>
      </div>
    );
  }

  const pacotes = data?.pacotes || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <DollarSign className="h-8 w-8" />
          Configuração de Preços
        </h1>
        <p className="text-muted-foreground">
          Visualize a tabela de pacotes de preços para compra de listas
        </p>
      </div>

      {/* Banner informativo */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-900 dark:text-blue-100">
            Modelo de Precificação por Pacotes
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            O sistema utiliza pacotes com preços fixos. Cada pedido é enquadrado no pacote que atende
            a quantidade de registros solicitada. Para alterar os valores, entre em contato com o suporte técnico.
          </p>
        </div>
      </div>

      {/* Tabela de pacotes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Tabela de Pacotes
          </CardTitle>
          <CardDescription>
            Preços fixos por faixa de quantidade de registros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Pacote</TableHead>
                <TableHead className="text-right">Até (registros)</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Preço/Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacotes.map((pacote, idx) => {
                const precoUnitario = calculatePricePerRecord(pacote.preco, pacote.quantidadeMaxima);
                const faixaInferior = idx === 0 ? 1 : pacotes[idx - 1].quantidadeMaxima + 1;
                
                return (
                  <TableRow key={pacote.nomePacote} data-testid={`row-pacote-${idx}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {pacote.nomePacote}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {faixaInferior.toLocaleString("pt-BR")} – {pacote.quantidadeMaxima.toLocaleString("pt-BR")} nomes
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(pacote.quantidadeMaxima)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg text-primary">
                      {formatCurrency(pacote.preco)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      ~{formatCurrency(precoUnitario)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo visual dos pacotes */}
      <Card>
        <CardHeader>
          <CardTitle>Visão Geral</CardTitle>
          <CardDescription>
            Distribuição visual dos pacotes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {pacotes.map((pacote) => (
              <div
                key={pacote.nomePacote}
                className="p-4 rounded-lg border bg-card hover-elevate cursor-default"
              >
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {pacote.nomePacote}
                </p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(pacote.preco)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Até {formatNumber(pacote.quantidadeMaxima)} nomes
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
