import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft, FileText, Upload, X, ChevronDown, ChevronUp,
  Building2, BadgePercent, CheckCircle2, AlertCircle, Loader2,
  User, Users, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { parseSiapeContracheque, type SiapeParsedData } from "@/lib/siape-pdf-parser";

// ─── Constantes ──────────────────────────────────────────────────────────────

const CONVENIOS = [
  {
    id: "SIAPE",
    label: "SIAPE",
    description: "Servidores Federais",
    icon: "🏛️",
    hasPdfUpload: true,
  },
  {
    id: "INSS",
    label: "INSS",
    description: "Aposentados e Pensionistas",
    icon: "👴",
    hasPdfUpload: false,
  },
  {
    id: "GOV_MA",
    label: "Governo do Maranhão",
    description: "Estado do Maranhão",
    icon: "📍",
    hasPdfUpload: false,
  },
  {
    id: "GOV_SC",
    label: "Governo de Santa Catarina",
    description: "Estado de Santa Catarina",
    icon: "📍",
    hasPdfUpload: false,
  },
  {
    id: "GOV_SP",
    label: "Governo de São Paulo",
    description: "Estado de São Paulo",
    icon: "📍",
    hasPdfUpload: false,
  },
];

const PRODUCTS = [
  { value: "NOVO", label: "Novo" },
  { value: "PORTABILIDADE", label: "Portabilidade" },
  { value: "REFINANCIAMENTO", label: "Refinanciamento" },
  { value: "CARTAO", label: "Cartão" },
];

const DOCUMENT_TYPES = [
  { value: "RG_CNH", label: "RG / CNH" },
  { value: "COMPROVANTE_RESIDENCIA", label: "Comprovante de Residência" },
  { value: "CONTRACHEQUE", label: "Contracheque" },
  { value: "SELFIE", label: "Selfie" },
  { value: "EXTRATO_CONSIGNACOES", label: "Extrato de Consignações" },
  { value: "OUTRO", label: "Outro" },
];

// ─── Schema do formulário ─────────────────────────────────────────────────────

const formSchema = z.object({
  clientName: z.string().min(1, "Nome obrigatório"),
  clientCpf: z.string().min(11, "CPF inválido"),
  clientMatricula: z.string().optional(),
  bank: z.string().optional(),
  product: z.string().optional(),
  tableId: z.string().optional(),
  contractValue: z.string().optional(),
  installmentValue: z.string().optional(),
  term: z.string().optional(),
  ade: z.string().optional(),
  commissionPercentage: z.string().optional(),
  corretorCommissionPercentage: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBrNumber(value: string | undefined) {
  if (!value) return undefined;
  const clean = String(value).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? undefined : n;
}

function formatCpf(value: string) {
  return value.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatPercent(value: string) {
  return value.replace(/[^0-9,\.]/g, "").slice(0, 6);
}

function fmtBRL(v: number) {
  return v > 0
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
}

interface FileAttachment {
  file: File;
  documentType: string;
}

// ─── Tipos de step ────────────────────────────────────────────────────────────

type Step = "convenio" | "siape-upload" | "form";

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ContratosPropostaPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("convenio");
  const [selectedConvenio, setSelectedConvenio] = useState<typeof CONVENIOS[0] | null>(null);

  // ── SIAPE parse state ───────────────────────────────────────────────────────
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<SiapeParsedData | null>(null);
  const [siapeFile, setSiapeFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [bankMode, setBankMode] = useState<"select" | "text">("select");
  const [showComercial, setShowComercial] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [docDragOver, setDocDragOver] = useState(false);

  // ── Dados auxiliares ────────────────────────────────────────────────────────
  const { data: banks = [] } = useQuery<any[]>({
    queryKey: ["/api/banks"],
  });
  const { data: tables = [] } = useQuery<any[]>({
    queryKey: ["/api/coefficient-tables"],
  });

  // ── Form ────────────────────────────────────────────────────────────────────
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: "", clientCpf: "", clientMatricula: "",
      bank: "", product: "", tableId: "",
      contractValue: "", installmentValue: "", term: "",
      ade: "", commissionPercentage: "", corretorCommissionPercentage: "",
    },
  });

  const watchedContractValue = form.watch("contractValue");
  const watchedCommPerc = form.watch("commissionPercentage");
  const watchedCorretorPerc = form.watch("corretorCommissionPercentage");

  const contractValNum = parseBrNumber(watchedContractValue) || 0;
  const commPercNum = parseBrNumber(watchedCommPerc) || 0;
  const corretorPercNum = parseBrNumber(watchedCorretorPerc) || 0;
  const companyCommCalc = commPercNum > 0 ? contractValNum * commPercNum / 100 : 0;
  const corretorCommCalc = corretorPercNum > 0 ? companyCommCalc * corretorPercNum / 100 : 0;

  // ── Mutation ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const clientMeta = parsedData
        ? {
            identSiape: parsedData.identSiape || undefined,
            uf: parsedData.uf || undefined,
            orgao: parsedData.orgao || undefined,
            regJuridico: parsedData.regJuridico || undefined,
            bancoSalario: parsedData.bancoSalario || undefined,
            agencia: parsedData.agencia || undefined,
            conta: parsedData.conta || undefined,
            mesAno: parsedData.mesAno || undefined,
            vinculo: parsedData.vinculo || undefined,
          }
        : undefined;

      return apiRequest("POST", "/api/contracts/proposals", {
        ...data,
        clientConvenio: selectedConvenio?.id,
        contractValue: parseBrNumber(data.contractValue),
        installmentValue: parseBrNumber(data.installmentValue),
        tableId: data.tableId || undefined,
        term: data.term || undefined,
        ade: data.ade || undefined,
        commissionPercentage: data.commissionPercentage
          ? (parseBrNumber(data.commissionPercentage) || 0) / 100
          : undefined,
        corretorCommissionPercentage: data.corretorCommissionPercentage
          ? (parseBrNumber(data.corretorCommissionPercentage) || 0) / 100
          : undefined,
        clientMeta: clientMeta || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals"] });
      toast({ title: "Proposta cadastrada com sucesso!" });
      setLocation("/contratos");
    },
    onError: (e: any) => {
      toast({
        title: "Erro ao cadastrar proposta",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  // ── Handlers SIAPE ──────────────────────────────────────────────────────────

  async function handlePdfFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setParseError("Por favor selecione um arquivo PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setParseError("Arquivo muito grande (máx. 20MB).");
      return;
    }

    setSiapeFile(file);
    setIsParsing(true);
    setParseError(null);

    try {
      const data = await parseSiapeContracheque(file);
      setParsedData(data);

      // Pré-preenche o formulário com os dados extraídos
      form.reset({
        clientName: data.nome || "",
        clientCpf: data.cpf
          ? formatCpf(data.cpf)
          : "",
        clientMatricula: data.matricula || "",
        bank: form.getValues("bank"),
        product: form.getValues("product"),
        tableId: form.getValues("tableId"),
        contractValue: "",
        installmentValue: "",
        term: "",
        ade: "",
        commissionPercentage: "",
        corretorCommissionPercentage: "",
      });

      setStep("form");
    } catch (err: any) {
      console.error("Erro ao processar PDF:", err);
      setParseError(
        "Não foi possível ler o contracheque. Verifique se é um PDF válido do SIAPE."
      );
    } finally {
      setIsParsing(false);
    }
  }

  function handleDocFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Arquivo muito grande (máx 5MB)", variant: "destructive" });
        return;
      }
      setAttachments((prev) => [...prev, { file, documentType: "OUTRO" }]);
    });
  }

  // ─── STEP 1 — Seleção de Convênio ─────────────────────────────────────────

  if (step === "convenio") {
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => setLocation("/contratos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Nova Proposta</h1>
            <p className="text-sm text-muted-foreground">Selecione o convênio do cliente</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
          {CONVENIOS.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setSelectedConvenio(conv);
                setStep(conv.hasPdfUpload ? "siape-upload" : "form");
              }}
              className="text-left p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <div className="text-3xl mb-3">{conv.icon}</div>
              <div className="font-semibold text-sm group-hover:text-primary transition-colors">
                {conv.label}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{conv.description}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── STEP 2 — Upload Contracheque SIAPE ──────────────────────────────────

  if (step === "siape-upload") {
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => setStep("convenio")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Nova Proposta — SIAPE</h1>
            <p className="text-sm text-muted-foreground">
              Carregue o contracheque para preenchimento automático
            </p>
          </div>
        </div>

        <div className="max-w-xl space-y-4">
          {/* Drop zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : isParsing
                ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                : parseError
                ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                : "border-border hover:border-primary hover:bg-primary/5"
            }`}
            onDragOver={(e) => { e.preventDefault(); if (!isParsing) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!isParsing && e.dataTransfer.files[0]) {
                handlePdfFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => !isParsing && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handlePdfFile(e.target.files[0]);
              }}
            />

            {isParsing ? (
              <>
                <Loader2 className="h-12 w-12 mx-auto mb-3 text-blue-500 animate-spin" />
                <p className="font-medium text-blue-600 dark:text-blue-400">
                  Lendo contracheque...
                </p>
                <p className="text-sm text-muted-foreground mt-1">Aguarde</p>
              </>
            ) : parseError ? (
              <>
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-500" />
                <p className="font-medium text-red-600 dark:text-red-400">
                  Não foi possível ler o arquivo
                </p>
                <p className="text-sm text-muted-foreground mt-1">{parseError}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Clique ou arraste outro arquivo
                </p>
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Arraste o contracheque SIAPE aqui</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Apenas PDF · Máx. 20MB
                </p>
              </>
            )}
          </div>

          {/* Botão alternativo */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setStep("form")}
          >
            Preencher manualmente
          </Button>
        </div>
      </div>
    );
  }

  // ─── STEP 3 — Formulário (SIAPE pré-preenchido ou manual) ────────────────

  const isSiape = selectedConvenio?.id === "SIAPE";
  const hasExtracted = isSiape && parsedData !== null;

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            isSiape ? setStep("siape-upload") : setStep("convenio")
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Nova Proposta</h1>
            {selectedConvenio && (
              <Badge variant="outline">{selectedConvenio.label}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {hasExtracted
              ? "Dados extraídos do contracheque — revise e confirme"
              : "Preencha os dados da proposta"}
          </p>
        </div>
      </div>

      {/* Banner de extração bem-sucedida */}
      {hasExtracted && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Contracheque lido com sucesso — confira os dados abaixo e edite se necessário.
          </span>
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
          className="space-y-4"
        >
          {/* ── Dados do Cliente ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>
                      Nome completo *
                      {hasExtracted && parsedData?.nome && (
                        <CheckIcon />
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do cliente" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientCpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      CPF *
                      {hasExtracted && parsedData?.cpf && <CheckIcon />}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="000.000.000-00"
                        onChange={(e) => field.onChange(formatCpf(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientMatricula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Matrícula
                      {hasExtracted && parsedData?.matricula && <CheckIcon />}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Número de matrícula" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Info SIAPE extraída (somente leitura) ── */}
          {hasExtracted && parsedData && (
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                  <MapPin className="h-4 w-4" />
                  Dados SIAPE Extraídos
                  <span className="text-xs font-normal text-muted-foreground">(apenas informação)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                  {parsedData.identSiape && (
                    <InfoField label="Ident. SIAPE" value={parsedData.identSiape} />
                  )}
                  {parsedData.uf && (
                    <InfoField label="UF" value={parsedData.uf} />
                  )}
                  {parsedData.vinculo && (
                    <InfoField label="Vínculo" value={parsedData.vinculo} />
                  )}
                  {parsedData.regJuridico && (
                    <InfoField label="Regime Jurídico" value={parsedData.regJuridico} />
                  )}
                  {parsedData.mesAno && (
                    <InfoField label="Competência" value={parsedData.mesAno} />
                  )}
                  {parsedData.orgao && (
                    <InfoField
                      label="Órgão / Secretaria"
                      value={parsedData.orgao}
                      wide
                    />
                  )}
                  {(parsedData.bancoSalario || parsedData.agencia || parsedData.conta) && (
                    <div className="col-span-2 md:col-span-3 lg:col-span-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Conta Salário
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {parsedData.bancoSalario && (
                          <InfoField label="Banco" value={parsedData.bancoSalario} />
                        )}
                        {parsedData.agencia && (
                          <InfoField label="Agência" value={parsedData.agencia} />
                        )}
                        {parsedData.conta && (
                          <InfoField label="Conta" value={parsedData.conta} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Dados do Contrato ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Dados do Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Banco do empréstimo */}
              <FormField
                control={form.control}
                name="bank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco (credor)</FormLabel>
                    {banks.length > 0 && bankMode === "select" ? (
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          if (v === "_outro_") {
                            setBankMode("text");
                            field.onChange("");
                          } else {
                            field.onChange(v);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o banco..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {banks.map((b: any) => (
                            <SelectItem key={b.id} value={b.name}>
                              {b.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="_outro_">Outro banco...</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2">
                        <FormControl>
                          <Input {...field} placeholder="Nome do banco" />
                        </FormControl>
                        {banks.length > 0 && (
                          <Button
                            type="button" size="sm" variant="outline"
                            className="shrink-0"
                            onClick={() => { setBankMode("select"); field.onChange(""); }}
                          >
                            ↩
                          </Button>
                        )}
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRODUCTS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tableId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tabela</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tables.map((t: any) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.tableName || t.name || `Tabela ${t.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contractValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Liberado (R$)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="0,00" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="installmentValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Parcela (R$)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="0,00" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="term"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo (meses)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="Ex: 60" min={1} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ADE / Nº Protocolo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Número do banco (opcional)" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Comissão Esperada (expansível) ── */}
          <Card>
            <CardHeader className="pb-2">
              <button
                type="button"
                className="flex items-center justify-between w-full"
                onClick={() => setShowComercial((v) => !v)}
              >
                <CardTitle className="text-base flex items-center gap-2">
                  <BadgePercent className="h-4 w-4" />
                  Comissão Esperada
                  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </CardTitle>
                {showComercial ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>

            {showComercial && (
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Preencha para acompanhar a comissão esperada. Estes dados serão pré-carregados ao marcar como PAGO.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="commissionPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>% Comissão Empresa</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              placeholder="Ex: 7,5"
                              onChange={(e) => field.onChange(formatPercent(e.target.value))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">R$ Empresa</label>
                    <div className="h-10 px-3 flex items-center rounded-md border bg-muted/50 text-sm font-medium">
                      {fmtBRL(companyCommCalc)}
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="corretorCommissionPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>% Repasse Corretor</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              placeholder="Ex: 50"
                              onChange={(e) => field.onChange(formatPercent(e.target.value))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">R$ Corretor</label>
                    <div className="h-10 px-3 flex items-center rounded-md border bg-green-50 dark:bg-green-950/30 text-sm font-semibold text-green-700 dark:text-green-400">
                      {fmtBRL(corretorCommCalc)}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* ── Documentos ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Documentos
                {isSiape && siapeFile && (
                  <span className="text-xs font-normal text-muted-foreground">
                    — contracheque já carregado
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Arquivo SIAPE já carregado */}
              {isSiape && siapeFile && (
                <div className="flex items-center gap-3 p-3 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm flex-1 truncate">{siapeFile.name}</span>
                  <Badge variant="secondary">Contracheque SIAPE</Badge>
                </div>
              )}

              {/* Drop zone para documentos adicionais */}
              <div
                className={`border-2 border-dashed rounded-md p-5 text-center cursor-pointer transition-colors ${
                  docDragOver ? "border-primary bg-primary/5" : "border-border"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDocDragOver(true); }}
                onDragLeave={() => setDocDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDocDragOver(false);
                  handleDocFiles(e.dataTransfer.files);
                }}
                onClick={() => document.getElementById("doc-upload")?.click()}
              >
                <Upload className="h-7 w-7 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste documentos adicionais aqui
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Máx. 5MB por arquivo</p>
                <input
                  id="doc-upload"
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => handleDocFiles(e.target.files)}
                />
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-md border bg-card"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{att.file.name}</span>
                      <Select
                        value={att.documentType}
                        onValueChange={(v) =>
                          setAttachments((prev) =>
                            prev.map((a, i) => (i === idx ? { ...a, documentType: v } : a))
                          )
                        }
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon" variant="ghost" type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => isSiape ? setStep("siape-upload") : setStep("convenio")}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Cadastrando..." : "Cadastrar Proposta"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <CheckCircle2 className="inline-block h-3.5 w-3.5 ml-1 text-green-600 dark:text-green-400" />
  );
}

function InfoField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}
