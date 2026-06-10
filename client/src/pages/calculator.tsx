import { useState, useEffect, useRef } from "react";
import { useProposta } from "@/contexts/proposta-context";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { Calculator, Download, ChevronDown, Sparkles, Wallet, TrendingDown, TrendingUp, Gift, Lock, ArrowDown, ArrowUp } from "lucide-react";
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
  const { user } = useAuth();
  const [result, setResult] = useState<{ totalContractValue: number; clientRefund: number; saldoFinal: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [liquidPayment, setLiquidPayment] = useState<number>(0);
  const [ajusteSaldoPercentual, setAjusteSaldoPercentual] = useState<number>(0);
  // Modo de cálculo: 'troco' (parcela mantém igual e gera troco) ou
  // 'reducao' (cliente quer parcela menor, sem troco necessariamente).
  const [modoCalculo, setModoCalculo] = useState<'troco' | 'reducao'>('troco');
  // Quando modo = 'reducao', o consultor digita a parcela nova desejada.
  const [parcelaDesejada, setParcelaDesejada] = useState<number>(0);
  const simulatorRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const propostaCtx = useProposta();

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

  // Calculate liquid payment when monthly payment or selected table changes.
  // No modo "reducao", usa parcelaDesejada como base em vez de monthlyPayment.
  useEffect(() => {
    const subscription = form.watch((value) => {
      const monthlyPayment = typeof value.operation?.monthlyPayment === 'number' ? value.operation.monthlyPayment : 0;
      const coefficientTableId = typeof value.operation?.coefficientTableId === 'number' ? value.operation.coefficientTableId : 0;
      const parcelaBase = modoCalculo === 'reducao' && parcelaDesejada > 0 ? parcelaDesejada : monthlyPayment;

      if (parcelaBase > 0 && coefficientTableId > 0) {
        const selectedTable = availableTables.find(t => t.id === coefficientTableId);
        if (selectedTable) {
          const safetyMargin = parseFloat(selectedTable.safetyMargin || "0");
          const marginType = (selectedTable.marginType as 'percentual' | 'fixo') || 'percentual';
          const liquid = calcularParcelaComMargem(parcelaBase, marginType, safetyMargin);
          setLiquidPayment(liquid);
        } else if (availableTables.length === 0) {
          return;
        } else {
          setLiquidPayment(0);
        }
      } else if (parcelaBase > 0 && coefficientTableId === 0) {
        setLiquidPayment(0);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, availableTables, modoCalculo, parcelaDesejada]);

  // Recalcula liquidPayment quando muda modo ou parcelaDesejada (sem precisar mexer no form)
  useEffect(() => {
    const monthlyPayment = form.getValues("operation.monthlyPayment") || 0;
    const coefficientTableId = form.getValues("operation.coefficientTableId") || 0;
    const parcelaBase = modoCalculo === 'reducao' && parcelaDesejada > 0 ? parcelaDesejada : monthlyPayment;
    if (parcelaBase > 0 && coefficientTableId > 0) {
      const selectedTable = availableTables.find(t => t.id === coefficientTableId);
      if (selectedTable) {
        const safetyMargin = parseFloat(selectedTable.safetyMargin || "0");
        const marginType = (selectedTable.marginType as 'percentual' | 'fixo') || 'percentual';
        setLiquidPayment(calcularParcelaComMargem(parcelaBase, marginType, safetyMargin));
      }
    }
  }, [modoCalculo, parcelaDesejada, availableTables, form]);

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
        // PDF reformulado: A4 RETRATO (mais natural pra WhatsApp), foco no troco
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = 210;
        const pageHeight = 297;
        const ml = 16, mr = 16;
        const cw = pageWidth - ml - mr;
        let y = 0;

        // === Faixa roxa Capital Go ===
        pdf.setFillColor(124, 58, 237); // #7C3AED
        pdf.rect(0, 0, pageWidth, 4, 'F');
        y = 16;

        // === Logo / Header ===
        pdf.setTextColor(124, 58, 237);
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Capital Go', ml, y);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text('Crédito Consignado', ml, y + 4);
        // Data e nº proposta no canto direito
        const dt = new Date();
        const dataStr = dt.toLocaleDateString('pt-BR');
        const propNum = 'CG-' + String(Date.now()).slice(-6);
        pdf.text(`Proposta nº ${propNum}`, pageWidth - mr, y, { align: 'right' });
        pdf.text(dataStr, pageWidth - mr, y + 4, { align: 'right' });
        y += 12;

        // === Saudação ===
        pdf.setFillColor(248, 247, 255);
        pdf.rect(ml, y, cw, 14, 'F');
        pdf.setTextColor(40, 40, 40);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        const nomeCli = (formData.client.name || 'Cliente').split(' ')[0];
        pdf.text(`Olá, ${nomeCli}!`, ml + 4, y + 6);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Olha a oportunidade que separamos para você:', ml + 4, y + 11);
        y += 20;

        // === DESTAQUE PRINCIPAL — muda conforme o modo ===
        const trocoVal = result.clientRefund;
        const parcAtual = formData.operation.monthlyPayment;
        const diffParc = parcAtual - liquidPayment;
        const isReducao = modoCalculo === 'reducao';

        pdf.setFillColor(124, 58, 237);
        pdf.roundedRect(ml, y, cw, 32, 3, 3, 'F');
        pdf.setTextColor(220, 200, 255);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        if (isReducao) {
          pdf.text('SUA NOVA PARCELA MENSAL', pageWidth / 2, y + 7, { align: 'center' });
          pdf.setFontSize(28);
          pdf.setTextColor(255, 255, 255);
          pdf.text(formatCurrency(liquidPayment), pageWidth / 2, y + 19, { align: 'center' });
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(220, 200, 255);
          if (diffParc > 0.01) {
            pdf.text(`Economia de ${formatCurrency(diffParc)} por mês`, pageWidth / 2, y + 27, { align: 'center' });
          }
        } else {
          pdf.text('DINHEIRO NA SUA CONTA', pageWidth / 2, y + 7, { align: 'center' });
          pdf.setFontSize(28);
          pdf.setTextColor(255, 255, 255);
          pdf.text(formatCurrency(trocoVal), pageWidth / 2, y + 19, { align: 'center' });
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(220, 200, 255);
          pdf.text('Liberado em até 5 dias úteis', pageWidth / 2, y + 27, { align: 'center' });
        }
        y += 38;

        // === Comparativo PARCELA Antes/Agora ===
        pdf.setTextColor(80, 80, 80);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('A MUDANÇA NA SUA PARCELA:', ml, y);
        y += 6;

        const colW = (cw - 4) / 2;
        const boxH = 28;
        // ANTES (esquerda)
        pdf.setFillColor(245, 245, 247);
        pdf.roundedRect(ml, y, colW, boxH, 2, 2, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(120, 120, 120);
        pdf.text('PARCELA ANTES', ml + 4, y + 7);
        pdf.setFontSize(18);
        pdf.setTextColor(40, 40, 40);
        pdf.text(formatCurrency(parcAtual), ml + 4, y + 18);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text('por mês', ml + 4, y + 24);

        // AGORA (direita)
        pdf.setFillColor(232, 250, 240);
        pdf.roundedRect(ml + colW + 4, y, colW, boxH, 2, 2, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(22, 100, 60);
        pdf.text('PARCELA AGORA', ml + colW + 8, y + 7);
        pdf.setFontSize(18);
        pdf.setTextColor(22, 163, 74);
        pdf.text(formatCurrency(liquidPayment), ml + colW + 8, y + 18);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(50, 100, 70);
        if (diffParc > 0.01) {
          pdf.text(`Economia de ${formatCurrency(diffParc)}/mês`, ml + colW + 8, y + 24);
        } else if (diffParc < -0.01) {
          pdf.text(`+ ${formatCurrency(Math.abs(diffParc))}/mês`, ml + colW + 8, y + 24);
        } else {
          pdf.text('por mês', ml + colW + 8, y + 24);
        }
        y += boxH + 6;

        // Troco extra no modo redução (quando houver)
        if (isReducao && trocoVal > 0.01) {
          pdf.setFillColor(235, 245, 255);
          pdf.roundedRect(ml, y, cw, 10, 2, 2, 'F');
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 100, 200);
          pdf.text(`E ainda libera ${formatCurrency(trocoVal)} de troco`, pageWidth / 2, y + 6, { align: 'center' });
          y += 14;
        }

        // === DÍVIDA QUITADA NA OPERAÇÃO ===
        if (formData.operation.outstandingBalance > 0) {
          pdf.setFillColor(245, 245, 247);
          pdf.roundedRect(ml, y, cw, 10, 2, 2, 'F');
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text('Dívida a ser quitada:', ml + 4, y + 6);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(40, 40, 40);
          pdf.text(formatCurrency(formData.operation.outstandingBalance), pageWidth - mr - 4, y + 6, { align: 'right' });
          y += 14;
        }

        // === Detalhes técnicos — sem Prazo ===
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(80, 80, 80);
        pdf.text('DETALHES DA OPERAÇÃO:', ml, y);
        y += 5;
        pdf.setFillColor(250, 250, 252);
        pdf.roundedRect(ml, y, cw, 16, 2, 2, 'F');
        const det1x = ml + 4, det2x = ml + cw / 2 + 4;
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(130, 130, 130);
        pdf.text('Banco', det1x, y + 5);
        pdf.text('Total do contrato', det2x, y + 5);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(40, 40, 40);
        pdf.text(formData.operation.bank || '—', det1x, y + 11);
        pdf.text(formatCurrency(result.totalContractValue), det2x, y + 11);
        y += 22;

        // === Bloco do Consultor ===
        const consNome = user?.name || 'Consultor';
        const consPhoneRaw = (user as any)?.phone || (user as any)?.whatsapp || '';
        const consPhoneDigits = String(consPhoneRaw).replace(/\D/g, '');
        const consPhoneFmt = consPhoneDigits.length >= 10
          ? `(${consPhoneDigits.slice(0, 2)}) ${consPhoneDigits.slice(2, -4)}-${consPhoneDigits.slice(-4)}`
          : consPhoneRaw;
        pdf.setFillColor(248, 247, 255);
        pdf.roundedRect(ml, y, cw, 18, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(124, 58, 237);
        pdf.text('SEU CONSULTOR', ml + 4, y + 5);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(40, 40, 40);
        pdf.text(consNome, ml + 4, y + 11);
        if (consPhoneFmt) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(80, 80, 80);
          const waText = `WhatsApp: ${consPhoneFmt}`;
          pdf.text(waText, ml + 4, y + 16);
          // Link clicável no número
          const waUrl = `https://wa.me/55${consPhoneDigits}`;
          pdf.link(ml + 4, y + 12, 60, 5, { url: waUrl });
        }
        y += 24;

        // === Selo de segurança === (cadeado desenhado com vetor)
        pdf.setFillColor(245, 250, 245);
        pdf.roundedRect(ml, y, cw, 10, 2, 2, 'F');
        // Cadeado mini desenhado
        const padX = ml + 6, padY = y + 3.5;
        pdf.setDrawColor(22, 100, 60);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(padX, padY + 1, 3, 2.5, 0.3, 0.3, 'S');
        pdf.setFillColor(245, 250, 245);
        pdf.line(padX + 0.5, padY + 1, padX + 0.5, padY);
        pdf.line(padX + 2.5, padY + 1, padX + 2.5, padY);
        pdf.line(padX + 0.5, padY, padX + 2.5, padY);
        pdf.setLineWidth(0.2);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(22, 100, 60);
        pdf.text('Operação 100% segura', pageWidth / 2, y + 4, { align: 'center' });
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(80, 100, 80);
        pdf.text('Crédito Consignado regulamentado pelo Banco Central · Seus dados protegidos', pageWidth / 2, y + 8, { align: 'center' });

        // === Rodapé ===
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Documento gerado em ${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          pageWidth / 2, pageHeight - 10, { align: 'center' }
        );

        pdf.save(`proposta-capital-go-${Date.now()}.pdf`);

        toast({
          title: "Proposta gerada!",
          description: "PDF pronto para enviar ao cliente.",
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
        ctx.fillText('Simulador de Compra', canvas.width / 2, 40);

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
                  Simulador de Compra
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Simulação de Compra de Margem
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
                  {/* Toggle: modo de cálculo (troco ou reduzir parcela) */}
                  <div className="mb-5">
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      O que o cliente quer?
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1 rounded-lg" data-testid="modo-calculo-toggle">
                      <button
                        type="button"
                        onClick={() => setModoCalculo('troco')}
                        className={`px-3 py-2 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                          modoCalculo === 'troco'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        data-testid="button-modo-troco"
                      >
                        <Wallet className="h-4 w-4" />
                        Receber troco
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoCalculo('reducao')}
                        className={`px-3 py-2 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                          modoCalculo === 'reducao'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        data-testid="button-modo-reducao"
                      >
                        <TrendingDown className="h-4 w-4" />
                        Reduzir parcela
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {modoCalculo === 'troco'
                        ? 'Mantém a parcela atual e libera o valor que sobra após quitar a dívida'
                        : 'Diminui a parcela mensal. O cliente paga menos por mês, sem foco em troco'}
                    </p>
                  </div>

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

                      {/* Input "Parcela desejada" — só no modo redução */}
                      {modoCalculo === 'reducao' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-primary">
                            Nova parcela desejada (R$)
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 300,00"
                            className="h-10 border-primary/40"
                            data-testid="input-parcela-desejada"
                            value={parcelaDesejada || ''}
                            onChange={(e) => setParcelaDesejada(parseFloat(e.target.value) || 0)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Quanto o cliente quer pagar por mês a partir de agora
                          </p>
                        </div>
                      )}

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

              {/* Results Section — foco no que muda pro cliente (parcela + troco) */}
              <div>
                {(() => {
                  const parcelaAtual = form.getValues("operation.monthlyPayment") || 0;
                  const saldoDevedorAtual = form.getValues("operation.outstandingBalance") || 0;
                  const novaParcela = liquidPayment;
                  const bancoNome = form.getValues("operation.bank") || "—";
                  const troco = result?.clientRefund ?? 0;
                  const totalNovo = result?.totalContractValue ?? 0;
                  const diffParcela = parcelaAtual - novaParcela; // positivo = parcela reduzida
                  const temResultado = !!result;
                  const trocoPositivo = troco > 0;
                  const parcelaReduziu = diffParcela > 0.01;
                  const parcelaAumentou = diffParcela < -0.01;
                  const isModoReducao = modoCalculo === 'reducao';

                  return (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-border" />
                        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground px-2 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-primary" />
                          Oportunidade pro Cliente
                        </h2>
                        <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-border" />
                      </div>

                      {/* DESTAQUE PRINCIPAL: muda conforme o modo */}
                      <Card className="mb-4 overflow-hidden border-0 shadow-xl" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)" }}>
                        <CardContent className="p-6 text-center text-white">
                          {isModoReducao ? (
                            <>
                              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-200 mb-2 flex items-center justify-center gap-1.5">
                                <TrendingDown className="h-3.5 w-3.5" />
                                Nova parcela mensal
                              </p>
                              <p className="text-5xl font-black tracking-tight mb-1" data-testid="text-nova-parcela-destaque" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                {temResultado ? formatCurrency(novaParcela) : "R$ 0,00"}
                              </p>
                              <p className="text-xs text-purple-200">
                                {parcelaReduziu
                                  ? `Você economiza ${formatCurrency(diffParcela)} por mês`
                                  : temResultado
                                    ? "Preencha a parcela desejada"
                                    : "Preencha os dados acima"}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-200 mb-2 flex items-center justify-center gap-1.5">
                                <Wallet className="h-3.5 w-3.5" />
                                Dinheiro na sua conta
                              </p>
                              <p className="text-5xl font-black tracking-tight mb-1" data-testid="text-client-refund" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                {temResultado ? formatCurrency(troco) : "R$ 0,00"}
                              </p>
                              <p className="text-xs text-purple-200">
                                {trocoPositivo ? "Liberado em até 5 dias úteis" : temResultado ? "Operação sem troco" : "Preencha os dados acima"}
                              </p>
                            </>
                          )}
                        </CardContent>
                      </Card>

                      {/* DÍVIDA QUITADA NA OPERAÇÃO */}
                      {saldoDevedorAtual > 0 && (
                        <div className="flex items-center justify-between gap-3 mb-4 bg-muted/40 border border-border rounded-lg px-4 py-2.5">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Dívida a ser quitada
                          </span>
                          <span className="text-base font-bold text-foreground font-mono">
                            {formatCurrency(saldoDevedorAtual)}
                          </span>
                        </div>
                      )}

                      {/* COMPARATIVO — só PARCELA Antes/Agora (mais honesto e direto) */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {/* ANTES */}
                        <Card className="border-muted bg-muted/30">
                          <CardContent className="p-4 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Parcela antes
                            </p>
                            <p className="text-2xl font-bold text-foreground font-mono" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                              {formatCurrency(parcelaAtual)}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">por mês</p>
                          </CardContent>
                        </Card>

                        {/* AGORA */}
                        <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
                          <CardContent className="p-4 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 mb-2">
                              Parcela agora
                            </p>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-400 font-mono" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                              {temResultado ? formatCurrency(novaParcela) : "—"}
                            </p>
                            <p className="text-[10px] text-green-700/80 dark:text-green-400/80 mt-0.5 flex items-center justify-center gap-1">
                              {parcelaReduziu && temResultado ? (
                                <>
                                  <ArrowDown className="h-3 w-3" />
                                  {formatCurrency(diffParcela)} de economia
                                </>
                              ) : parcelaAumentou && temResultado ? (
                                <>
                                  <ArrowUp className="h-3 w-3" />
                                  {formatCurrency(Math.abs(diffParcela))} a mais
                                </>
                              ) : (
                                "por mês"
                              )}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* TROCO COMO ADICIONAL — só aparece no modo redução (no modo troco, já é o destaque) */}
                      {temResultado && trocoPositivo && isModoReducao && (
                        <div className="flex items-center justify-center gap-2 mb-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg py-2 px-3">
                          <Gift className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            E ainda libera <strong className="font-mono">{formatCurrency(troco)}</strong> de troco
                          </span>
                        </div>
                      )}

                      {/* DETALHES — sem Prazo */}
                      <Card className="bg-muted/30 mb-3">
                        <CardContent className="p-3">
                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Banco</p>
                              <p className="text-xs font-semibold text-foreground truncate">{bancoNome}</p>
                            </div>
                            <div className="border-l border-border">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total do novo contrato</p>
                              <p className="text-xs font-semibold text-foreground font-mono" data-testid="text-total-contract">{temResultado ? formatCurrency(totalNovo) : "—"}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* SALDO FINAL (quando tem ajuste) */}
                      {result && ajusteSaldoPercentual !== 0 && (
                        <div className="text-[10px] text-muted-foreground text-center mb-3">
                          Saldo final ajustado: <span className="font-mono font-semibold text-foreground" data-testid="text-saldo-final">{formatCurrency(result.saldoFinal)}</span>
                          <span className="text-muted-foreground/70"> · regras do banco</span>
                        </div>
                      )}

                      {/* SELO DE SEGURANÇA */}
                      <div className="flex items-center justify-center gap-2 text-[10px] font-medium text-muted-foreground py-2">
                        <Lock className="h-3 w-3" />
                        Operação 100% segura · Crédito Consignado regulamentado pelo Banco Central
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Bridge: Enviar para Criador de Proposta */}
            {result && propostaCtx && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const banco = form.getValues("operation.bank") as string || "Banco";
                    const prazo = form.getValues("operation.termMonths") as number || 0;
                    propostaCtx.sendToProposta({
                      contratos: [],
                      novas: [{ parcela: liquidPayment, prazo, troco: result.clientRefund > 0 ? result.clientRefund : 0 }],
                    });
                  }}
                  className="w-full h-10 rounded-lg font-semibold text-[13px] text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)", boxShadow: "0 4px 14px rgba(124,58,237,.28)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  Enviar para Criador de Proposta
                </button>
              </div>
            )}

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
