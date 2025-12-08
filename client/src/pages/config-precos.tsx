import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DollarSign, Loader2, TrendingDown, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const pricingFormSchema = z.object({
  qtdAncoraMin: z.coerce.number().min(1, "Quantidade mínima deve ser pelo menos 1"),
  precoAncoraMin: z.string().regex(/^\d+(\.\d{1,4})?$/, "Formato inválido"),
  qtdAncoraMax: z.coerce.number().min(1, "Quantidade máxima deve ser pelo menos 1"),
  precoAncoraMax: z.string().regex(/^\d+(\.\d{1,4})?$/, "Formato inválido"),
});

type PricingFormValues = z.infer<typeof pricingFormSchema>;

interface PricingExample {
  quantidade: number;
  precoTotal: number;
  precoUnitario: number;
}

interface PricingSettingsResponse {
  settings: {
    precoAncoraMin: string;
    qtdAncoraMin: number;
    precoAncoraMax: string;
    qtdAncoraMax: number;
    atualizadoEm: string;
  };
  examples: PricingExample[];
  loteMinimo: number;
}

export default function ConfigPrecosPage() {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<PricingSettingsResponse>({
    queryKey: ["/api/pricing-settings"],
  });

  const form = useForm<PricingFormValues>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: {
      qtdAncoraMin: 100,
      precoAncoraMin: "0.5000",
      qtdAncoraMax: 50000,
      precoAncoraMax: "0.0300",
    },
    values: data?.settings ? {
      qtdAncoraMin: data.settings.qtdAncoraMin,
      precoAncoraMin: data.settings.precoAncoraMin,
      qtdAncoraMax: data.settings.qtdAncoraMax,
      precoAncoraMax: data.settings.precoAncoraMax,
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: PricingFormValues) => {
      return apiRequest("PUT", "/api/pricing-settings", values);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Configurações de preço atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-settings"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: PricingFormValues) => {
    updateMutation.mutate(values);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
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
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Erro ao carregar configurações</CardTitle>
            <CardDescription>
              Não foi possível carregar as configurações de preço. Tente novamente.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Configuração de Preços
          </h1>
          <p className="text-muted-foreground">
            Configure os preços para compra de listas de clientes
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Modelo de Precificação
            </CardTitle>
            <CardDescription>
              Define duas âncoras de preço unitário. O sistema interpola o preço por registro 
              linearmente entre as âncoras.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                  <h4 className="font-medium text-sm">Âncora Mínima (V1, P1)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="qtdAncoraMin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade (V1)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              data-testid="input-qtd-ancora-min"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="precoAncoraMin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço Unitário (P1)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                R$
                              </span>
                              <Input
                                {...field}
                                className="pl-9"
                                placeholder="0.2000"
                                data-testid="input-preco-ancora-min"
                              />
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs">
                            Preço por registro até V1 registros
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                  <h4 className="font-medium text-sm">Âncora Máxima (V2, P2)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="qtdAncoraMax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade (V2)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              data-testid="input-qtd-ancora-max"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="precoAncoraMax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço Unitário (P2)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                R$
                              </span>
                              <Input
                                {...field}
                                className="pl-9"
                                placeholder="0.1000"
                                data-testid="input-preco-ancora-max"
                              />
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs">
                            Preço por registro a partir de V2 registros
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={updateMutation.isPending}
                  data-testid="button-save-pricing"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configurações
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tabela de Preços</CardTitle>
            <CardDescription>
              Exemplos de preços calculados com base nas configurações atuais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quantidade</TableHead>
                  <TableHead className="text-right">Preço Total</TableHead>
                  <TableHead className="text-right">Preço/Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.examples.map((example) => (
                  <TableRow key={example.quantidade} data-testid={`row-example-${example.quantidade}`}>
                    <TableCell className="font-medium">
                      {formatNumber(example.quantidade)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(example.precoTotal)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(example.precoUnitario)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {data?.settings.atualizadoEm && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Última atualização: {new Date(data.settings.atualizadoEm).toLocaleString("pt-BR")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Como funciona o cálculo</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-primary m-0">
              Lote mínimo: {data?.loteMinimo || 100} registros
            </p>
            <p className="text-xs text-muted-foreground m-0 mt-1">
              Pedidos com menos de {data?.loteMinimo || 100} registros são cobrados como se fossem {data?.loteMinimo || 100}.
            </p>
          </div>
          
          <p>
            O sistema usa <strong>interpolação linear no preço unitário</strong> entre as duas âncoras:
          </p>
          <ul>
            <li>
              <strong>Até V1 registros</strong>: Usa o preço unitário P1 (âncora mínima)
            </li>
            <li>
              <strong>Entre V1 e V2</strong>: Interpolação linear do preço unitário entre P1 e P2
            </li>
            <li>
              <strong>Acima de V2</strong>: Usa o preço unitário P2 (âncora máxima)
            </li>
          </ul>
          <p className="text-muted-foreground">
            Fórmula para V entre V1 e V2: Preço Unitário = P1 - ((V - V1) / (V2 - V1)) × (P1 - P2)
          </p>
          <p className="text-muted-foreground">
            O preço total é sempre: Quantidade (mín. {data?.loteMinimo || 100}) × Preço Unitário
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
