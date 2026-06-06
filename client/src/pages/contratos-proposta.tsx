import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft, FileText, Upload, X, ChevronDown, ChevronUp,
  Building2, BadgePercent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  clientName: z.string().min(1, "Nome obrigatório"),
  clientCpf: z.string().min(11, "CPF inválido"),
  clientMatricula: z.string().optional(),
  clientConvenio: z.string().optional(),
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

const DOCUMENT_TYPES = [
  { value: "RG_CNH", label: "RG / CNH" },
  { value: "COMPROVANTE_RESIDENCIA", label: "Comprovante de Residência" },
  { value: "CONTRACHEQUE", label: "Contracheque" },
  { value: "SELFIE", label: "Selfie" },
  { value: "EXTRATO_CONSIGNACOES", label: "Extrato de Consignações" },
  { value: "OUTRO", label: "Outro" },
];

const PRODUCTS = [
  { value: "NOVO", label: "Novo" },
  { value: "PORTABILIDADE", label: "Portabilidade" },
  { value: "REFINANCIAMENTO", label: "Refinanciamento" },
  { value: "CARTAO", label: "Cartão" },
];

interface FileAttachment {
  file: File;
  documentType: string;
  preview: string;
}

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
  // Permite "7,5" ou "7.5" — retorna string limpa com vírgula
  return value.replace(/[^0-9,\.]/g, "").slice(0, 6);
}

export default function ContratosPropostaPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [bankMode, setBankMode] = useState<"select" | "text">("select");
  const [convenioMode, setConvenioMode] = useState<"select" | "text">("select");
  const [showComercial, setShowComercial] = useState(false);

  // Dados auxiliares
  const { data: banks = [] } = useQuery<any[]>({
    queryKey: ["/api/banks"],
  });
  const { data: convenios = [] } = useQuery<any[]>({
    queryKey: ["/api/convenios"],
  });
  const { data: tables = [] } = useQuery<any[]>({
    queryKey: ["/api/coefficient-tables"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: "",
      clientCpf: "",
      clientMatricula: "",
      clientConvenio: "",
      bank: "",
      product: "",
      tableId: "",
      contractValue: "",
      installmentValue: "",
      term: "",
      ade: "",
      commissionPercentage: "",
      corretorCommissionPercentage: "",
    },
  });

  const watchedBank = form.watch("bank");
  const watchedConvenio = form.watch("clientConvenio");
  const watchedContractValue = form.watch("contractValue");
  const watchedCommPerc = form.watch("commissionPercentage");
  const watchedCorretorPerc = form.watch("corretorCommissionPercentage");

  // Cálculos de comissão esperada (read-only, só para visualização)
  const contractValNum = parseBrNumber(watchedContractValue) || 0;
  const commPercNum = parseBrNumber(watchedCommPerc) || 0;
  const corretorPercNum = parseBrNumber(watchedCorretorPerc) || 0;
  const companyCommCalc = commPercNum > 0 ? contractValNum * commPercNum / 100 : 0;
  const corretorCommCalc = corretorPercNum > 0 ? companyCommCalc * corretorPercNum / 100 : 0;

  const createMutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiRequest("POST", "/api/contracts/proposals", {
        ...data,
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
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals"] });
      toast({ title: "Proposta cadastrada com sucesso!" });
      setLocation("/contratos");
    },
    onError: (e: any) => {
      toast({ title: "Erro ao cadastrar proposta", description: e.message, variant: "destructive" });
    },
  });

  function handleAddFile(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Arquivo muito grande (máx 5MB)", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachments((prev) => [
          ...prev,
          { file, documentType: "OUTRO", preview: e.target?.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateDocType(idx: number, type: string) {
    setAttachments((prev) => prev.map((a, i) => (i === idx ? { ...a, documentType: type } : a)));
  }

  const fmtBRL = (v: number) =>
    v > 0
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—";

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLocation("/contratos")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Nova Proposta</h1>
          <p className="text-sm text-muted-foreground">Cadastre uma nova proposta de contrato</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">

          {/* ── Dados do Cliente ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do cliente" data-testid="input-client-name" />
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
                    <FormLabel>CPF *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="000.000.000-00"
                        data-testid="input-client-cpf"
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
                    <FormLabel>Matrícula</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Número de matrícula" data-testid="input-client-matricula" />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Convênio — Select ou text livre */}
              <FormField
                control={form.control}
                name="clientConvenio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Convênio</FormLabel>
                    {convenios.length > 0 && convenioMode === "select" ? (
                      <>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            if (v === "_outro_") {
                              setConvenioMode("text");
                              field.onChange("");
                            } else {
                              field.onChange(v);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-convenio">
                              <SelectValue placeholder="Selecione o convênio..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {convenios.map((c: any) => (
                              <SelectItem key={c.id} value={c.label}>
                                {c.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="_outro_">Outro (digitar)...</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ex: INSS, Prefeitura..."
                            data-testid="input-client-convenio"
                          />
                        </FormControl>
                        {convenios.length > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => {
                              setConvenioMode("select");
                              field.onChange("");
                            }}
                          >
                            ↩ Lista
                          </Button>
                        )}
                      </div>
                    )}
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Dados do Contrato ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Dados do Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Banco — Select ou text livre */}
              <FormField
                control={form.control}
                name="bank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
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
                          <SelectTrigger data-testid="select-bank">
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
                          <Input
                            {...field}
                            placeholder="Ex: Banco do Brasil"
                            data-testid="input-bank"
                          />
                        </FormControl>
                        {banks.length > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => {
                              setBankMode("select");
                              field.onChange("");
                            }}
                          >
                            ↩ Lista
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
                        <SelectTrigger data-testid="select-product">
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
                        <SelectTrigger data-testid="select-table">
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
                    <FormLabel>Valor do Contrato (R$)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="0,00" data-testid="input-contract-value" />
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
                      <Input {...field} placeholder="0,00" data-testid="input-installment-value" />
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
                      <Input
                        {...field}
                        type="number"
                        placeholder="Ex: 60"
                        data-testid="input-term"
                        min={1}
                      />
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
                      <Input {...field} placeholder="Número do banco (opcional)" data-testid="input-ade" />
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
                              data-testid="input-comm-perc"
                              onChange={(e) => field.onChange(formatPercent(e.target.value))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">R$ Empresa (calculado)</label>
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
                              data-testid="input-corretor-perc"
                              onChange={(e) => field.onChange(formatPercent(e.target.value))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">R$ Corretor (calculado)</label>
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
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleAddFile(e.dataTransfer.files); }}
                onClick={() => document.getElementById("doc-upload")?.click()}
                data-testid="dropzone-documents"
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Arraste arquivos aqui ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">Máx. 5MB por arquivo</p>
                <input
                  id="doc-upload"
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => handleAddFile(e.target.files)}
                />
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-md border bg-card"
                      data-testid={`attachment-item-${idx}`}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{att.file.name}</span>
                      <Select value={att.documentType} onValueChange={(v) => updateDocType(idx, v)}>
                        <SelectTrigger className="w-48" data-testid={`select-doc-type-${idx}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        data-testid={`button-remove-attachment-${idx}`}
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
              onClick={() => setLocation("/contratos")}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
              {createMutation.isPending ? "Cadastrando..." : "Cadastrar Proposta"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
