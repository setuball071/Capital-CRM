import { useState, useEffect } from "react";
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
  type SimulationResult,
  agreements,
  banks,
  availableTerms
} from "@shared/schema";
import { calculateSimulation, getAvailableTables } from "@/lib/calculations";
import { formatCurrency, formatCPF } from "@/lib/formatters";

export default function CalculatorPage() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<SimulationInput>({
    resolver: zodResolver(simulationInputSchema),
    defaultValues: {
      client: {
        name: "",
        cpf: "",
        agreement: "",
      },
      operation: {
        monthlyPayment: 0,
        outstandingBalance: 0,
        bank: "",
        term: 0,
        coefficientTable: "",
      },
    },
  });

  const watchBank = form.watch("operation.bank");
  const watchTerm = form.watch("operation.term");

  useEffect(() => {
    if (watchBank && watchTerm) {
      const tables = getAvailableTables(watchBank, watchTerm);
      setAvailableTables(tables);
      
      // Reset table if current selection is not available
      const currentTable = form.getValues("operation.coefficientTable");
      if (!tables.includes(currentTable)) {
        form.setValue("operation.coefficientTable", "");
      }
    } else {
      setAvailableTables([]);
    }
  }, [watchBank, watchTerm, form]);

  function onSubmit(values: SimulationInput) {
    const simulationResult = calculateSimulation(values.operation);
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

  function handleCPFChange(e: React.ChangeEvent<HTMLInputElement>, field: any) {
    const formatted = formatCPF(e.target.value);
    field.onChange(formatted);
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
                  Simulador de Portabilidade
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Crédito Consignado
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      name="client.cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            CPF
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="000.000.000-00"
                              className="h-12"
                              maxLength={14}
                              data-testid="input-client-cpf"
                              {...field}
                              onChange={(e) => handleCPFChange(e, field)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="client.agreement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Convênio
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12" data-testid="select-agreement">
                              <SelectValue placeholder="Selecione o convênio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {agreements.map((agreement) => (
                              <SelectItem key={agreement} value={agreement}>
                                {agreement}
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12" data-testid="select-bank">
                                  <SelectValue placeholder="Selecione o banco" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {banks.map((bank) => (
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
                        name="operation.term"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Prazo (meses)
                            </FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={field.value?.toString()}
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
                        name="operation.coefficientTable"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Tabela (Coeficiente)
                            </FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value}
                              disabled={availableTables.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12" data-testid="select-coefficient-table">
                                  <SelectValue placeholder="Selecione a tabela" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableTables.map((table) => (
                                  <SelectItem key={table} value={table}>
                                    {table}
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
