import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DollarSign, Loader2, Package, AlertCircle, Info, Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PacotePreco {
  id: number;
  quantidadeMaxima: number;
  nomePacote: string;
  preco: string;
  ordem: number;
  ativo: boolean;
  atualizadoEm: string | null;
}

interface PricingSettingsResponse {
  pacotes: {
    quantidadeMaxima: number;
    nomePacote: string;
    preco: number;
  }[];
  message: string;
}

export default function ConfigPrecosPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    quantidadeMaxima: number;
    nomePacote: string;
    preco: number;
  } | null>(null);

  const { data, isLoading, error } = useQuery<PricingSettingsResponse>({
    queryKey: ["/api/pricing-settings"],
  });

  const { data: allPacotes, isLoading: loadingAll } = useQuery<PacotePreco[]>({
    queryKey: ["/api/pacotes-preco/all"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/pacotes-preco/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pacotes-preco/all"] });
      toast({
        title: "Sucesso",
        description: "Pacote atualizado com sucesso!",
      });
      setEditingId(null);
      setEditValues(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao atualizar pacote",
      });
    },
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

  const startEditing = (pacote: PacotePreco) => {
    setEditingId(pacote.id);
    setEditValues({
      quantidadeMaxima: pacote.quantidadeMaxima,
      nomePacote: pacote.nomePacote,
      preco: parseFloat(pacote.preco),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues(null);
  };

  const saveEditing = () => {
    if (!editingId || !editValues) return;
    updateMutation.mutate({ id: editingId, data: editValues });
  };

  if (isLoading || loadingAll) {
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
  const pacotesCompletos = allPacotes || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <DollarSign className="h-8 w-8" />
          Configuração de Preços
        </h1>
        <p className="text-muted-foreground">
          Visualize e edite a tabela de pacotes de preços para compra de listas
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-900 dark:text-blue-100">
            Modelo de Precificação por Pacotes
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            O sistema utiliza pacotes com preços fixos. Cada pedido é enquadrado no pacote que atende
            a quantidade de registros solicitada. Clique no ícone de edição para alterar os valores.
          </p>
        </div>
      </div>

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
                <TableHead className="text-right w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacotesCompletos.map((pacote, idx) => {
                const isEditing = editingId === pacote.id;
                const precoNum = parseFloat(pacote.preco);
                const precoUnitario = calculatePricePerRecord(precoNum, pacote.quantidadeMaxima);
                const faixaInferior = idx === 0 ? 1 : pacotesCompletos[idx - 1].quantidadeMaxima + 1;

                return (
                  <TableRow key={pacote.id} data-testid={`row-pacote-${pacote.id}`}>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editValues?.nomePacote || ""}
                          onChange={(e) =>
                            setEditValues((prev) =>
                              prev ? { ...prev, nomePacote: e.target.value } : null
                            )
                          }
                          className="w-full"
                          data-testid={`input-nome-pacote-${pacote.id}`}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {pacote.nomePacote}
                          </Badge>
                        </div>
                      )}
                      {!isEditing && (
                        <span className="text-xs text-muted-foreground">
                          {faixaInferior.toLocaleString("pt-BR")} – {pacote.quantidadeMaxima.toLocaleString("pt-BR")} nomes
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editValues?.quantidadeMaxima || 0}
                          onChange={(e) =>
                            setEditValues((prev) =>
                              prev ? { ...prev, quantidadeMaxima: parseInt(e.target.value) || 0 } : null
                            )
                          }
                          className="w-24 ml-auto text-right"
                          data-testid={`input-quantidade-${pacote.id}`}
                        />
                      ) : (
                        <span className="font-mono">{formatNumber(pacote.quantidadeMaxima)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editValues?.preco || 0}
                          onChange={(e) =>
                            setEditValues((prev) =>
                              prev ? { ...prev, preco: parseFloat(e.target.value) || 0 } : null
                            )
                          }
                          className="w-28 ml-auto text-right"
                          data-testid={`input-preco-${pacote.id}`}
                        />
                      ) : (
                        <span className="font-bold text-lg text-primary">
                          {formatCurrency(precoNum)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {!isEditing && `~${formatCurrency(precoUnitario)}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={saveEditing}
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-${pacote.id}`}
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                            disabled={updateMutation.isPending}
                            data-testid={`button-cancel-${pacote.id}`}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditing(pacote)}
                          data-testid={`button-edit-${pacote.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
