import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { 
  simulationInputSchema, 
  type SimulationInput,
  type Agreement,
  type CoefficientTable,
} from "@shared/schema";
import { calculateSimulation } from "@/lib/calculations";
import { formatCurrency } from "@/lib/formatters";

export default function CalculatorPage() {
  const [result, setResult] = useState<{ totalContractValue: number; clientRefund: number } | null>(null);
  const { toast } = useToast();

  // Fetch active agreements
  const { data: agreements = [] } = useQuery<Agreement[]>({
    queryKey: ["/api/agreements/active"],
  });

  const form = useForm<SimulationInput>({
    resolver: zodResolver(simulationInputSchema),
    defaultValues: {
      client: {
        name: "",
        agreementId: 0,
      },
      operation: {
        monthlyPayment: 0,
        outstandingBalance: 0,
        bank: "",
        termMonths: 0,
        coefficientTableId: 0,
      },
    },
  });

  const watchAgreementId = form.watch("client.agreementId");
  const watchBank = form.watch("operation.bank");
  const watchTerm = form.watch("operation.termMonths");

  // Fetch banks by agreement
  const { data: availableBanks = [] } = useQuery<string[]>({
    queryKey: ["/api/calculator/banks", watchAgreementId],
    queryFn: async () => {
      if (!watchAgreementId) return [];
      const res = await fetch(`/api/calculator/banks?agreementId=${watchAgreementId}`);
      if (!res.ok) throw new Error("Erro ao buscar bancos");
      return res.json();
    },
    enabled: !!watchAgreementId,
  });

  // Fetch terms by agreement and bank
  const { data: availableTerms = [] } = useQuery<number[]>({
    queryKey: ["/api/calculator/terms", watchAgreementId, watchBank],
    queryFn: async () => {
      if (!watchAgreementId || !watchBank) return [];
      const res = await fetch(`/api/calculator/terms?agreementId=${watchAgreementId}&bank=${watchBank}`);
      if (!res.ok) throw new Error("Erro ao buscar prazos");
      return res.json();
    },
    enabled: !!watchAgreementId && !!watchBank,
  });

  // Fetch tables by agreement, bank and term
  const { data: availableTables = [] } = useQuery<CoefficientTable[]>({
    queryKey: ["/api/calculator/tables", watchAgreementId, watchBank, watchTerm],
    queryFn: async () => {
      if (!watchAgreementId || !watchBank || !watchTerm) return [];
      const res = await fetch(`/api/calculator/tables?agreementId=${watchAgreementId}&bank=${watchBank}&termMonths=${watchTerm}`);
      if (!res.ok) throw new Error("Erro ao buscar tabelas");
      return res.json();
    },
    enabled: !!watchAgreementId && !!watchBank && !!watchTerm,
  });

  // Reset bank when agreement changes
  useEffect(() => {
    const currentBank = form.getValues("operation.bank");
    if (currentBank && !availableBanks.includes(currentBank)) {
      form.setValue("operation.bank", "");
      form.setValue("operation.termMonths", 0);
      form.setValue("operation.coefficientTableId", 0);
    }
  }, [availableBanks, form]);

  // Reset term when bank changes
  useEffect(() => {
    const currentTerm = form.getValues("operation.termMonths");
    if (currentTerm && !availableTerms.includes(currentTerm)) {
      form.setValue("operation.termMonths", 0);
      form.setValue("operation.coefficientTableId", 0);
    }
  }, [availableTerms, form]);

  // Reset table when term changes
  useEffect(() => {
    const currentTableId = form.getValues("operation.coefficientTableId");
    if (currentTableId && !availableTables.find(t => t.id === currentTableId)) {
      form.setValue("operation.coefficientTableId", 0);
    }
  }, [availableTables, form]);

  function onSubmit(values: SimulationInput) {
    // Find the selected coefficient table
    const selectedTable = availableTables.find(
      t => t.id === values.operation.coefficientTableId
    );

    if (!selectedTable) {
      toast({
        title: "Erro",
        description: "Tabela de coeficiente não encontrada",
        variant: "destructive",
      });
      return;
    }

    // Calculate using the coefficient from the selected table
    const coefficient = parseFloat(selectedTable.coefficient);
    const simulationResult = calculateSimulation(
      values.operation.monthlyPayment,
      values.operation.outstandingBalance,
      coefficient
    );
    
    setResult(simulationResult);
    
    toast({
      title: "Simulação criada com sucesso",
      description: "Os resultados foram calculados.",
    });
  }

  function onError() {
    toast({
      title: "Erro na validação",
      description: "Por favor, preencha todos os campos obrigatórios corretamente.",
      variant: "destructive",
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                  Simulador GoldCard
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Cartão de Crédito e Benefício
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
              {/* Client Data Section */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="client.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Nome
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nome completo do cliente"
                            className="h-12"
                            data-testid="input-client-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client.agreementId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Convênio
                        </FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))} 
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12" data-testid="select-agreement">
                              <SelectValue placeholder="Selecione o convênio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {agreements.map((agreement) => (
                              <SelectItem key={agreement.id} value={agreement.id.toString()}>
                                {agreement.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Operation Data Section */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">
                    Dados da Operação
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Preencha os dados para calcular o refinanciamento.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column - Valores */}
                    <div className="space-y-6">
                      <h3 className="text-base font-semibold text-primary">
                        Valores (R$)
                      </h3>

                      <FormField
                        control={form.control}
                        name="operation.monthlyPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Parcela (R$)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                className="h-12"
                                data-testid="input-monthly-payment"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="operation.outstandingBalance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Saldo Devedor (R$)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                className="h-12"
                                data-testid="input-outstanding-balance"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Right Column - Coeficientes */}
                    <div className="space-y-6">
                      <h3 className="text-base font-semibold text-primary">
                        Coeficientes
                      </h3>

                      <FormField
                        control={form.control}
                        name="operation.bank"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Banco
                            </FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value}
                              disabled={availableBanks.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12" data-testid="select-bank">
                                  <SelectValue placeholder={watchAgreementId ? "Selecione o banco" : "Selecione um convênio primeiro"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableBanks.map((bank) => (
                                  <SelectItem key={bank} value={bank}>
                                    {bank}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="operation.termMonths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Prazo (meses)
                            </FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={field.value?.toString()}
                              disabled={availableTerms.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12" data-testid="select-term">
                                  <SelectValue placeholder="Selecione o prazo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableTerms.map((term) => (
                                  <SelectItem key={term} value={term.toString()}>
                                    {term} meses
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="operation.coefficientTableId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Tabela (Coeficiente)
                            </FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={field.value?.toString()}
                              disabled={availableTables.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12" data-testid="select-coefficient-table">
                                  <SelectValue placeholder="Selecione a tabela" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableTables.map((table) => (
                                  <SelectItem key={table.id} value={table.id.toString()}>
                                    {table.tableName} (Coef: {table.coefficient})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results Section */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Resultados da Simulação
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="pt-6 pb-8 text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Valor Total do Contrato
                      </p>
                      <p className="text-3xl font-bold font-mono text-foreground" data-testid="text-total-contract">
                        {result ? formatCurrency(result.totalContractValue) : "R$ 0,00"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6 pb-8 text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Troco do Cliente
                      </p>
                      <p className="text-3xl font-bold font-mono text-chart-2" data-testid="text-client-refund">
                        {result ? formatCurrency(result.clientRefund) : "R$ 0,00"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-14 text-base font-semibold"
                data-testid="button-create-simulation"
              >
                Criar Simulação
              </Button>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}
