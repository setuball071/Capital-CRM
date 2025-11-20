import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Calculator, Download, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { 
  simulationInputSchema, 
  type SimulationInput,
  type Agreement,
  type CoefficientTable,
} from "@shared/schema";
import { calculateSimulation } from "@/lib/calculations";
import { formatCurrency } from "@/lib/formatters";

const OPERATION_TYPES = [
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "benefit_card", label: "Cartão Benefício" },
  { value: "consignado", label: "Consignado" },
] as const;

export default function CalculatorPage() {
  const [result, setResult] = useState<{ totalContractValue: number; clientRefund: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [liquidPayment, setLiquidPayment] = useState<number>(0);
  const simulatorRef = useRef<HTMLDivElement>(null);
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
        operationType: "credit_card" as const,
        monthlyPayment: 0,
        outstandingBalance: 0,
        bank: "",
        termMonths: 0,
        coefficientTableId: 0,
      },
    },
  });

  const watchAgreementId = form.watch("client.agreementId");
  const watchOperationType = form.watch("operation.operationType");
  const watchBank = form.watch("operation.bank");
  const watchTerm = form.watch("operation.termMonths");

  // Fetch banks by agreement and operation type
  const { data: availableBanks = [] } = useQuery<string[]>({
    queryKey: ["/api/calculator/banks", watchAgreementId, watchOperationType],
    queryFn: async () => {
      if (!watchAgreementId || watchAgreementId === 0 || !watchOperationType) return [];
      const res = await fetch(`/api/calculator/banks?agreementId=${watchAgreementId}&operationType=${watchOperationType}`);
      if (!res.ok) throw new Error("Erro ao buscar bancos");
      return res.json();
    },
    enabled: !!watchAgreementId && watchAgreementId > 0 && !!watchOperationType,
  });

  // Fetch terms by agreement, operation type and bank
  const { data: availableTerms = [] } = useQuery<number[]>({
    queryKey: ["/api/calculator/terms", watchAgreementId, watchOperationType, watchBank],
    queryFn: async () => {
      if (!watchAgreementId || watchAgreementId === 0 || !watchOperationType || !watchBank) return [];
      const res = await fetch(`/api/calculator/terms?agreementId=${watchAgreementId}&operationType=${watchOperationType}&bank=${watchBank}`);
      if (!res.ok) throw new Error("Erro ao buscar prazos");
      return res.json();
    },
    enabled: !!watchAgreementId && watchAgreementId > 0 && !!watchOperationType && !!watchBank,
  });

  // Fetch tables by agreement, operation type, bank and term
  const { data: availableTables = [] } = useQuery<CoefficientTable[]>({
    queryKey: ["/api/calculator/tables", watchAgreementId, watchOperationType, watchBank, watchTerm],
    queryFn: async () => {
      if (!watchAgreementId || watchAgreementId === 0 || !watchOperationType || !watchBank || !watchTerm || watchTerm === 0) return [];
      const res = await fetch(`/api/calculator/tables?agreementId=${watchAgreementId}&operationType=${watchOperationType}&bank=${watchBank}&termMonths=${watchTerm}`);
      if (!res.ok) throw new Error("Erro ao buscar tabelas");
      return res.json();
    },
    enabled: !!watchAgreementId && watchAgreementId > 0 && !!watchOperationType && !!watchBank && !!watchTerm && watchTerm > 0,
  });

  // Reset bank when agreement or operation type changes
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
    const currentTermNum = typeof currentTerm === 'string' ? parseInt(currentTerm, 10) : currentTerm;
    if (currentTermNum && !availableTerms.includes(currentTermNum)) {
      form.setValue("operation.termMonths", 0);
      form.setValue("operation.coefficientTableId", 0);
    }
  }, [availableTerms, form]);

  // Reset table when term changes
  useEffect(() => {
    const currentTableId = form.getValues("operation.coefficientTableId");
    const currentTableIdNum = typeof currentTableId === 'string' ? parseInt(currentTableId, 10) : currentTableId;
    if (currentTableIdNum && !availableTables.find(t => t.id === currentTableIdNum)) {
      form.setValue("operation.coefficientTableId", 0);
    }
  }, [availableTables, form]);

  // Calculate liquid payment when monthly payment or selected table changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      const monthlyPayment = typeof value.operation?.monthlyPayment === 'number' ? value.operation.monthlyPayment : 0;
      const coefficientTableId = typeof value.operation?.coefficientTableId === 'number' ? value.operation.coefficientTableId : 0;
      
      if (monthlyPayment > 0 && coefficientTableId > 0) {
        const selectedTable = availableTables.find(t => t.id === coefficientTableId);
        
        if (selectedTable) {
          const safetyMargin = parseFloat(selectedTable.safetyMargin || "0");
          const liquid = monthlyPayment * (1 - safetyMargin / 100);
          setLiquidPayment(liquid);
        } else if (availableTables.length === 0) {
          // Don't reset if tables haven't loaded yet
          return;
        } else {
          setLiquidPayment(0);
        }
      } else if (monthlyPayment > 0 && coefficientTableId === 0) {
        // Monthly payment is set but no table selected - keep previous liquid payment or set to 0
        setLiquidPayment(0);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, availableTables]);

  // Auto-calculate when all fields are filled
  useEffect(() => {
    const subscription = form.watch((value) => {
      const monthlyPayment = value.operation?.monthlyPayment;
      const outstandingBalance = value.operation?.outstandingBalance;
      const coefficientTableId = value.operation?.coefficientTableId;

      if (monthlyPayment && monthlyPayment > 0 && outstandingBalance && outstandingBalance > 0 && coefficientTableId && coefficientTableId > 0 && liquidPayment > 0) {
        const selectedTable = availableTables.find(t => t.id === coefficientTableId);
        
        if (selectedTable) {
          const coefficient = parseFloat(selectedTable.coefficient);
          const simulationResult = calculateSimulation(
            liquidPayment,
            outstandingBalance,
            coefficient
          );
          setResult(simulationResult);
        }
      } else {
        setResult(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, availableTables, liquidPayment]);

  async function handleSave(format: 'png' | 'jpeg' | 'pdf') {
    if (!simulatorRef.current || !result) {
      toast({
        title: "Erro",
        description: "Não há simulação para capturar. Preencha todos os campos primeiro.",
        variant: "destructive",
      });
      return;
    }

    setIsCapturing(true);

    try {
      const element = simulatorRef.current;
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 4,
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.classList.remove('dark');
        },
      });

      const timestamp = Date.now();
      const link = document.createElement('a');

      if (format === 'pdf') {
        const pageWidthMM = 297;
        const pageHeightMM = 210;
        const margin = 15;
        const maxWidth = pageWidthMM - (margin * 2);
        const maxHeight = pageHeightMM - (margin * 2);
        
        const canvasRatio = canvas.width / canvas.height;
        const pageRatio = maxWidth / maxHeight;
        
        let imgWidth, imgHeight;
        
        if (canvasRatio > pageRatio) {
          imgWidth = maxWidth;
          imgHeight = maxWidth / canvasRatio;
        } else {
          imgHeight = maxHeight;
          imgWidth = maxHeight * canvasRatio;
        }
        
        const xOffset = (pageWidthMM - imgWidth) / 2;
        const yOffset = (pageHeightMM - imgHeight) / 2;
        
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, imgWidth, imgHeight);
        pdf.save(`simulacao-goldcard-${timestamp}.pdf`);

        toast({
          title: "PDF salvo!",
          description: "O arquivo foi salvo com sucesso.",
        });
      } else if (format === 'jpeg') {
        link.download = `simulacao-goldcard-${timestamp}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 1.0);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "JPEG salvo!",
          description: "A imagem foi salva com sucesso.",
        });
      } else {
        link.download = `simulacao-goldcard-${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "PNG salvo!",
          description: "A imagem foi salva com sucesso.",
        });
      }
    } catch (error) {
      console.error('Erro ao salvar simulação:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Detalhes do erro:', errorMessage);
      
      toast({
        title: "Erro ao salvar",
        description: `Não foi possível salvar a simulação. ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsCapturing(false);
    }
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
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto">
          <Form {...form}>
            <div className="space-y-4" ref={simulatorRef}>
              {/* Client Data Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pt-3 pb-4">
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
                            className="h-10"
                            data-testid="input-client-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              <SelectTrigger className="h-10" data-testid="select-agreement">
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

                    <FormField
                      control={form.control}
                      name="operation.operationType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Tipo de Operação
                          </FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10" data-testid="select-operation-type">
                                <SelectValue placeholder="Selecione o tipo de operação" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {OPERATION_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Operation Data Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Dados da Operação
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Preencha os dados para calcular o troco.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-[2fr,3fr] gap-6">
                    {/* Left Column - Valores */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-primary">
                        Valores (R$)
                      </h3>

                      <FormField
                        control={form.control}
                        name="operation.monthlyPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              Parcela Atual (R$)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                className="h-10"
                                data-testid="input-monthly-payment"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          Parcela Líquida (R$)
                        </label>
                        <div 
                          className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm items-center"
                          data-testid="text-liquid-payment"
                        >
                          {formatCurrency(liquidPayment)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Valor após desconto da margem de segurança
                        </p>
                      </div>

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
                                className="h-10"
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
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-primary">
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
                                <SelectTrigger className="h-10" data-testid="select-bank">
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
                                <SelectTrigger className="h-10" data-testid="select-term">
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
                                <SelectTrigger className="h-10 w-full" data-testid="select-coefficient-table">
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
                <h2 className="text-base font-semibold text-foreground mb-3">
                  Resultados da Simulação
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-5 pb-6 text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Valor Total do Contrato
                      </p>
                      <p className="text-2xl font-bold font-mono text-foreground" data-testid="text-total-contract">
                        {result ? formatCurrency(result.totalContractValue) : "R$ 0,00"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-5 pb-6 text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Troco do Cliente
                      </p>
                      <p 
                        className={`text-2xl font-bold font-mono ${result && result.clientRefund < 0 ? 'text-destructive' : 'text-chart-2'}`}
                        data-testid="text-client-refund"
                      >
                        {result ? formatCurrency(result.clientRefund) : "R$ 0,00"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Save Button with Format Options - Outside capture area */}
            <div className="mt-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    disabled={!result || isCapturing}
                    className="w-full h-12 text-base font-semibold"
                    data-testid="button-save"
                  >
                    {isCapturing ? (
                      <>Gerando arquivo...</>
                    ) : (
                      <>
                        <Download className="h-5 w-5 mr-2" />
                        Salvar
                        <ChevronDown className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full" align="center">
                  <DropdownMenuItem 
                    onClick={() => handleSave('pdf')}
                    data-testid="option-save-pdf"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Salvar como PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleSave('jpeg')}
                    data-testid="option-save-jpeg"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Salvar como JPEG
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleSave('png')}
                    data-testid="option-save-png"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Salvar como PNG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
}
