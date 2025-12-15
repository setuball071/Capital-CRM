import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
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
import { calculateSimulation, calcularParcelaComMargem } from "@/lib/calculations";
import { formatCurrency } from "@/lib/formatters";

const OPERATION_TYPES = [
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "benefit_card", label: "Cartão Benefício" },
  { value: "consignado", label: "Consignado" },
] as const;

export default function CalculatorPage() {
  const [result, setResult] = useState<{ totalContractValue: number; clientRefund: number; saldoFinal: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [liquidPayment, setLiquidPayment] = useState<number>(0);
  const [ajusteSaldoPercentual, setAjusteSaldoPercentual] = useState<number>(0);
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

  // Fetch operation types by agreement
  const { data: availableOperationTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/calculator/operation-types", watchAgreementId],
    queryFn: async () => {
      if (!watchAgreementId || watchAgreementId === 0) return [];
      console.log('🔍 Buscando tipos de operação:', { agreementId: watchAgreementId });
      const res = await fetch(`/api/calculator/operation-types?agreementId=${watchAgreementId}`);
      if (!res.ok) throw new Error("Erro ao buscar tipos de operação");
      const types = await res.json();
      console.log('✅ Tipos de operação encontrados:', types);
      return types;
    },
    enabled: !!watchAgreementId && watchAgreementId > 0,
  });

  // Fetch banks by agreement and operation type
  const { data: availableBanks = [] } = useQuery<string[]>({
    queryKey: ["/api/calculator/banks", watchAgreementId, watchOperationType],
    queryFn: async () => {
      if (!watchAgreementId || watchAgreementId === 0 || !watchOperationType) return [];
      console.log('🔍 Buscando bancos:', { agreementId: watchAgreementId, operationType: watchOperationType });
      const res = await fetch(`/api/calculator/banks?agreementId=${watchAgreementId}&operationType=${watchOperationType}`);
      if (!res.ok) throw new Error("Erro ao buscar bancos");
      const banks = await res.json();
      console.log('✅ Bancos encontrados:', banks);
      return banks;
    },
    enabled: !!watchAgreementId && watchAgreementId > 0 && !!watchOperationType,
  });

  // Fetch terms by agreement, operation type and bank
  const { data: availableTerms = [] } = useQuery<number[]>({
    queryKey: ["/api/calculator/terms", watchAgreementId, watchOperationType, watchBank],
    queryFn: async () => {
      if (!watchAgreementId || watchAgreementId === 0 || !watchOperationType || !watchBank) return [];
      console.log('🔍 Buscando prazos:', { agreementId: watchAgreementId, operationType: watchOperationType, bank: watchBank });
      const res = await fetch(`/api/calculator/terms?agreementId=${watchAgreementId}&operationType=${watchOperationType}&bank=${watchBank}`);
      if (!res.ok) throw new Error("Erro ao buscar prazos");
      const terms = await res.json();
      console.log('✅ Prazos encontrados:', terms);
      return terms;
    },
    enabled: !!watchAgreementId && watchAgreementId > 0 && !!watchOperationType && !!watchBank,
  });

  // Fetch tables by agreement, operation type, bank and term
  const { data: availableTables = [] } = useQuery<CoefficientTable[]>({
    queryKey: ["/api/calculator/tables", watchAgreementId, watchOperationType, watchBank, watchTerm],
    queryFn: async () => {
      if (!watchAgreementId || watchAgreementId === 0 || !watchOperationType || !watchBank || !watchTerm || watchTerm === 0) return [];
      console.log('🔍 Buscando tabelas:', { agreementId: watchAgreementId, operationType: watchOperationType, bank: watchBank, termMonths: watchTerm });
      const res = await fetch(`/api/calculator/tables?agreementId=${watchAgreementId}&operationType=${watchOperationType}&bank=${watchBank}&termMonths=${watchTerm}`);
      if (!res.ok) throw new Error("Erro ao buscar tabelas");
      const tables = await res.json();
      console.log('✅ Tabelas encontradas:', tables);
      return tables;
    },
    enabled: !!watchAgreementId && watchAgreementId > 0 && !!watchOperationType && !!watchBank && !!watchTerm && watchTerm > 0,
  });

  // Save simulation mutation
  const saveSimulationMutation = useMutation({
    mutationFn: async (data: {
      clientName: string;
      agreementId: number;
      agreementName: string;
      operationType: string;
      bank: string;
      termMonths: number;
      tableName: string;
      coefficient: string;
      monthlyPayment: string;
      outstandingBalance: string;
      totalContractValue: string;
      clientRefund: string;
    }) => {
      return await apiRequest("POST", "/api/simulations", data);
    },
  });

  // Reset operation type when agreement changes and current type is not available
  useEffect(() => {
    const currentOperationType = form.getValues("operation.operationType");
    if (currentOperationType && !availableOperationTypes.includes(currentOperationType)) {
      // Reset to first available type or default
      const newType = availableOperationTypes[0] || "credit_card";
      form.setValue("operation.operationType", newType as "credit_card" | "benefit_card" | "consignado");
      form.setValue("operation.bank", "");
      form.setValue("operation.termMonths", 0);
      form.setValue("operation.coefficientTableId", 0);
    }
  }, [availableOperationTypes, form]);

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

  // Fetch bank balance adjustment when bank changes
  useEffect(() => {
    async function fetchBankAdjustment() {
      if (!watchBank) {
        setAjusteSaldoPercentual(0);
        return;
      }
      
      try {
        const res = await fetch(`/api/banks/by-name/${encodeURIComponent(watchBank)}`);
        if (res.ok) {
          const bankData = await res.json();
          const ajuste = parseFloat(bankData.ajusteSaldoPercentual || "0");
          setAjusteSaldoPercentual(ajuste);
        } else {
          setAjusteSaldoPercentual(0);
        }
      } catch (error) {
        console.error("Erro ao buscar ajuste do banco:", error);
        setAjusteSaldoPercentual(0);
      }
    }
    
    fetchBankAdjustment();
  }, [watchBank]);

  // Calculate liquid payment when monthly payment or selected table changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      const monthlyPayment = typeof value.operation?.monthlyPayment === 'number' ? value.operation.monthlyPayment : 0;
      const coefficientTableId = typeof value.operation?.coefficientTableId === 'number' ? value.operation.coefficientTableId : 0;
      
      if (monthlyPayment > 0 && coefficientTableId > 0) {
        const selectedTable = availableTables.find(t => t.id === coefficientTableId);
        
        if (selectedTable) {
          const safetyMargin = parseFloat(selectedTable.safetyMargin || "0");
          const marginType = (selectedTable.marginType as 'percentual' | 'fixo') || 'percentual';
          const liquid = calcularParcelaComMargem(monthlyPayment, marginType, safetyMargin);
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
            coefficient,
            ajusteSaldoPercentual
          );
          setResult(simulationResult);
        }
      } else {
        setResult(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, availableTables, liquidPayment, ajusteSaldoPercentual]);

  async function handleSave(format: 'png' | 'jpeg' | 'pdf') {
    if (!result) {
      toast({
        title: "Erro",
        description: "Não há simulação para salvar. Preencha todos os campos primeiro.",
        variant: "destructive",
      });
      return;
    }

    setIsCapturing(true);

    try {
      const formData = form.getValues();
      const selectedAgreement = agreements.find(a => a.id === formData.client.agreementId);
      const selectedTable = availableTables.find(t => t.id === formData.operation.coefficientTableId);
      const operationTypeLabel = OPERATION_TYPES.find(t => t.value === formData.operation.operationType)?.label || '';

      // Save simulation to database before exporting
      if (selectedAgreement && selectedTable) {
        try {
          await saveSimulationMutation.mutateAsync({
            clientName: formData.client.name,
            agreementId: selectedAgreement.id,
            agreementName: selectedAgreement.name,
            operationType: formData.operation.operationType,
            bank: formData.operation.bank,
            termMonths: formData.operation.termMonths,
            tableName: selectedTable.tableName,
            coefficient: selectedTable.coefficient,
            monthlyPayment: formData.operation.monthlyPayment.toString(),
            outstandingBalance: formData.operation.outstandingBalance.toString(),
            totalContractValue: result.totalContractValue.toString(),
            clientRefund: result.clientRefund.toString(),
          });
        } catch (saveError) {
          console.warn("Erro ao salvar simulação:", saveError);
          // Continue with export even if save fails
        }
      }

      if (format === 'pdf') {
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = 297;
        const pageHeight = 210;
        let yPos = 20;

        pdf.setFillColor(37, 99, 235);
        pdf.rect(0, 0, pageWidth, 15, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CRM pro', pageWidth / 2, 9, { align: 'center' });

        pdf.setTextColor(0, 0, 0);
        yPos = 25;

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Dados do Cliente', 15, yPos);
        yPos += 8;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Nome', 15, yPos);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.text(formData.client.name, 15, yPos + 5);
        yPos += 12;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Convênio', 15, yPos);
        pdf.text('Tipo de Operação', 150, yPos);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.text(selectedAgreement?.name || '', 15, yPos + 5);
        pdf.text(operationTypeLabel, 150, yPos + 5);
        yPos += 15;

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Dados da Operação', 15, yPos);
        yPos += 8;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Parcela Atual (R$)', 15, yPos);
        pdf.text('Banco', 150, yPos);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.text(formatCurrency(formData.operation.monthlyPayment), 15, yPos + 5);
        pdf.text(formData.operation.bank, 150, yPos + 5);
        yPos += 12;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Parcela Líquida (R$)', 15, yPos);
        pdf.text('Prazo', 150, yPos);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.text(formatCurrency(liquidPayment), 15, yPos + 5);
        pdf.text(`${formData.operation.termMonths} meses`, 150, yPos + 5);
        yPos += 12;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Saldo Devedor (R$)', 15, yPos);
        pdf.text('Tabela (Coeficiente)', 150, yPos);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.text(formatCurrency(formData.operation.outstandingBalance), 15, yPos + 5);
        pdf.setFontSize(8);
        pdf.text(selectedTable?.tableName || '', 150, yPos + 5);
        yPos += 15;

        // Add Saldo Final if there's an adjustment
        if (ajusteSaldoPercentual !== 0) {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 116, 139);
          pdf.text('Saldo Final', 15, yPos);
          pdf.setFontSize(8);
          pdf.text('Ajuste aplicado conforme regras do banco', 15, yPos + 4);
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'bold');
          pdf.text(formatCurrency(result.saldoFinal), 15, yPos + 9);
          yPos += 16;
        }

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Resultados da Simulação', 15, yPos);
        yPos += 8;

        pdf.setFillColor(240, 249, 255);
        pdf.rect(15, yPos, 120, 30, 'F');
        pdf.rect(150, yPos, 120, 30, 'F');

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Valor Total do Contrato', 75, yPos + 8, { align: 'center' });
        pdf.text('Troco do Cliente', 210, yPos + 8, { align: 'center' });

        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(formatCurrency(result.totalContractValue), 75, yPos + 18, { align: 'center' });

        if (result.clientRefund >= 0) {
          pdf.setTextColor(22, 163, 74);
        } else {
          pdf.setTextColor(220, 38, 38);
        }
        pdf.text(formatCurrency(result.clientRefund), 210, yPos + 18, { align: 'center' });

        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        const dateStr = new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        pdf.text(`Documento gerado em ${dateStr}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

        const timestamp = Date.now();
        pdf.save(`simulacao-crmpro-${timestamp}.pdf`);

        toast({
          title: "PDF salvo!",
          description: "O recibo foi salvo com sucesso.",
        });
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('Não foi possível criar canvas');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#2563eb';
        ctx.fillRect(0, 0, canvas.width, 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CRM pro', canvas.width / 2, 40);

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        let y = 90;

        ctx.font = 'bold 20px Arial';
        ctx.fillText('Dados do Cliente', 40, y);
        y += 30;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Nome', 40, y);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(formData.client.name, 40, y + 20);
        y += 50;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Convênio', 40, y);
        ctx.fillText('Tipo de Operação', 600, y);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(selectedAgreement?.name || '', 40, y + 20);
        ctx.fillText(operationTypeLabel, 600, y + 20);
        y += 60;

        ctx.font = 'bold 20px Arial';
        ctx.fillText('Dados da Operação', 40, y);
        y += 30;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Parcela Atual (R$)', 40, y);
        ctx.fillText('Banco', 600, y);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(formatCurrency(formData.operation.monthlyPayment), 40, y + 20);
        ctx.fillText(formData.operation.bank, 600, y + 20);
        y += 50;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Parcela Líquida (R$)', 40, y);
        ctx.fillText('Prazo', 600, y);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(formatCurrency(liquidPayment), 40, y + 20);
        ctx.fillText(`${formData.operation.termMonths} meses`, 600, y + 20);
        y += 50;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Saldo Devedor (R$)', 40, y);
        ctx.fillText('Tabela (Coeficiente)', 600, y);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(formatCurrency(formData.operation.outstandingBalance), 40, y + 20);
        ctx.font = 'bold 12px Arial';
        ctx.fillText(selectedTable?.tableName || '', 600, y + 20);
        y += 60;

        ctx.font = 'bold 20px Arial';
        ctx.fillText('Resultados da Simulação', 40, y);
        y += 40;

        ctx.fillStyle = '#f0f9ff';
        ctx.fillRect(40, y, 500, 100);
        ctx.fillRect(600, y, 500, 100);

        ctx.font = '14px Arial';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('Valor Total do Contrato', 290, y + 30);
        ctx.fillText('Troco do Cliente', 850, y + 30);

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#000000';
        ctx.fillText(formatCurrency(result.totalContractValue), 290, y + 65);

        ctx.fillStyle = result.clientRefund >= 0 ? '#16a34a' : '#dc2626';
        ctx.fillText(formatCurrency(result.clientRefund), 850, y + 65);

        ctx.font = '12px Arial';
        ctx.fillStyle = '#94a3b8';
        const dateStr = new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        ctx.fillText(`Documento gerado em ${dateStr}`, canvas.width / 2, canvas.height - 30);

        const timestamp = Date.now();
        const link = document.createElement('a');

        if (format === 'jpeg') {
          link.download = `simulacao-crmpro-${timestamp}.jpg`;
          link.href = canvas.toDataURL('image/jpeg', 1.0);
        } else {
          link.download = `simulacao-crmpro-${timestamp}.png`;
          link.href = canvas.toDataURL('image/png');
        }

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: format === 'jpeg' ? "JPEG salvo!" : "PNG salvo!",
          description: "O recibo foi salvo com sucesso.",
        });
      }
    } catch (error) {
      console.error('Erro ao salvar simulação:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Detalhes do erro:', errorMessage);

      toast({
        title: "Erro ao salvar",
        description: `Não foi possível salvar o recibo. ${errorMessage}`,
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
                  CRM pro
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
                            disabled={!watchAgreementId || watchAgreementId === 0 || availableOperationTypes.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10" data-testid="select-operation-type">
                                <SelectValue placeholder="Selecione o tipo de operação" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {OPERATION_TYPES
                                .filter(type => availableOperationTypes.includes(type.value))
                                .map((type) => (
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
                
                {/* Show Saldo Final when there's an adjustment */}
                {result && ajusteSaldoPercentual !== 0 && (
                  <Card className="mb-4">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Saldo Final
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            Ajuste aplicado conforme regras do banco
                          </p>
                        </div>
                        <p className="text-lg font-semibold font-mono text-foreground" data-testid="text-saldo-final">
                          {formatCurrency(result.saldoFinal)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
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
