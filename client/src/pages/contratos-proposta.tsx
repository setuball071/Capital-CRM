import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft, FileText, Upload, X, ChevronDown, ChevronUp,
  Building2, BadgePercent, CheckCircle2, AlertCircle, Loader2,
  User, MapPin, History, ExternalLink, CreditCard, ImageIcon, TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { parseSiapeContracheque, type SiapeParsedData } from "@/lib/siape-pdf-parser";
import {
  parseExtratoConsignacao,
  type ExtratoConsignacaoParsed,
} from "@/lib/extrato-consignacao-parser";

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

const CONTRACT_TYPES = [
  {
    id: "NOVO",
    label: "Contrato Novo",
    description: "Empréstimo consignado novo",
    icon: "✨",
    product: "NOVO",
  },
  {
    id: "CARTAO",
    label: "Cartão com Saque",
    description: "Cartão consignado com saque",
    icon: "💳",
    product: "CARTAO",
  },
  {
    id: "PORTABILIDADE",
    label: "Portabilidade",
    description: "Portabilidade simples sem refinanciamento",
    icon: "🔄",
    product: "PORTABILIDADE",
  },
  {
    id: "PORTABILIDADE_REFIN",
    label: "Portabilidade + Refinanciamento",
    description: "Portabilidade com troco refinanciado",
    icon: "🔄📋",
    product: "PORTABILIDADE",
  },
  {
    id: "COMPRA_DIVIDA",
    label: "Compra de Dívida",
    description: "Quitação de dívida externa com consignado",
    icon: "💰",
    product: "PORTABILIDADE",
  },
  {
    id: "REFINANCIAMENTO",
    label: "Refinanciamento",
    description: "Refin de contrato existente na mesma instituição",
    icon: "📋",
    product: "REFINANCIAMENTO",
  },
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
  // Portabilidade / Compra de Dívida
  bancoOrigem: z.string().optional(),
  saldoDevedor: z.string().optional(),
  prazoAtual: z.string().optional(),
  // Conta bancária para crédito (manual)
  contaBanco: z.string().optional(),
  contaAgencia: z.string().optional(),
  contaConta: z.string().optional(),
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

type Step = "convenio" | "siape-upload" | "dados-cadastrais" | "tipo-contrato";

// ─── Wizard progress indicator ────────────────────────────────────────────────

const WIZARD_STEPS = [
  { key: "dados-cadastrais", label: "Dados Cadastrais" },
  { key: "tipo-contrato",    label: "Tipo de Contrato" },
  { key: "conferencia",      label: "Conferência" },
];

function StepIndicator({ current }: { current: string }) {
  const idx = WIZARD_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center">
      {WIZARD_STEPS.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs mt-1 whitespace-nowrap ${
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={`h-0.5 w-10 sm:w-16 mx-1 mb-4 transition-colors ${
                  done ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ContratosPropostaPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("convenio");
  const [selectedConvenio, setSelectedConvenio] = useState<typeof CONVENIOS[0] | null>(null);
  const [contractType, setContractType] = useState<string | null>(null);

  // ── SIAPE parse state ───────────────────────────────────────────────────────
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<SiapeParsedData | null>(null);
  const [siapeFile, setSiapeFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const docFrenteRef  = useRef<HTMLInputElement>(null);
  const docVersoRef   = useRef<HTMLInputElement>(null);
  const extratoRef    = useRef<HTMLInputElement>(null);

  // ── Extrato de Consignações ─────────────────────────────────────────────────
  const [extratoFile,        setExtratoFile]        = useState<File | null>(null);
  const [extratoData,        setExtratoData]        = useState<ExtratoConsignacaoParsed | null>(null);
  const [isParsingExtrato,   setIsParsingExtrato]   = useState(false);
  // índice da conta selecionada do contracheque (0, 1) ou "manual"
  const [selectedContaIdx,      setSelectedContaIdx]      = useState<number | "manual" | null>(null);
  const [contaError,             setContaError]             = useState(false);
  const [showManualConfirm,      setShowManualConfirm]      = useState(false);
  const [extratoError,       setExtratoError]       = useState<string | null>(null);
  const [extratoDrag,        setExtratoDrag]        = useState(false);

  // ── Memória de cliente (lookup por CPF) ─────────────────────────────────────
  interface ClientLookup {
    clientName: string;
    clientMatricula: string | null;
    clientMeta: any;
    clientConvenio: string | null;
    proposalCount: number;
    lastProposalId: number;
    lastStatus: string;
  }
  const [clientLookup, setClientLookup] = useState<ClientLookup | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  async function lookupByCpf(cpf: string): Promise<ClientLookup | null> {
    const raw = cpf.replace(/\D/g, "");
    if (raw.length !== 11) return null;
    try {
      setIsLookingUp(true);
      const res = await fetch(`/api/contracts/client-lookup/${raw}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setClientLookup(null);
        return null;
      }
      const existing: ClientLookup = await res.json();
      setClientLookup(existing);
      return existing;
    } catch {
      setClientLookup(null);
      return null;
    } finally {
      setIsLookingUp(false);
    }
  }

  // ── Estado do documento com foto (RG / CNH) ─────────────────────────────────
  interface DocPhotoData {
    tipo: "RG" | "CNH" | string;
    nome: string | null;
    numeroRegistro: string | null;
    cpf: string | null;
    filiacao: [string | null, string | null];
    dataNascimento: string | null;
    dataExpedicao: string | null;
    orgaoEmissor: string | null;
  }
  const [docFrenteFile, setDocFrenteFile] = useState<File | null>(null);
  const [docVersoFile,  setDocVersoFile]  = useState<File | null>(null);
  const [docFrentePreview, setDocFrentePreview] = useState<string | null>(null);
  const [docVersoPreview,  setDocVersoPreview]  = useState<string | null>(null);
  const [docFrenteDrag, setDocFrenteDrag] = useState(false);
  const [docVersoDrag,  setDocVersoDrag]  = useState(false);
  const [isOcring,    setIsOcring]    = useState(false);
  const [ocrError,    setOcrError]    = useState<string | null>(null);
  const [docPhotoData, setDocPhotoData] = useState<DocPhotoData | null>(null);
  const [nameAlert,    setNameAlert]    = useState<string | null>(null);

  // Redimensiona imagem no browser antes de enviar (economiza banda + custo de IA)
  async function resizeImageToBlob(file: File, maxPx = 1600): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao comprimir imagem"))),
          "image/jpeg",
          0.88
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao carregar imagem")); };
      img.src = url;
    });
  }

  // Chama o endpoint OCR com as imagens da frente e verso
  async function runDocOcr(frente: File, verso: File | null) {
    setIsOcring(true);
    setOcrError(null);
    try {
      const formData = new FormData();
      const frenteBlob = await resizeImageToBlob(frente);
      formData.append("frente", new File([frenteBlob], "frente.jpg", { type: "image/jpeg" }));
      if (verso) {
        const versoBlob = await resizeImageToBlob(verso);
        formData.append("verso", new File([versoBlob], "verso.jpg", { type: "image/jpeg" }));
      }
      const res = await fetch("/api/ocr/document", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("OCR falhou");
      const data: DocPhotoData = await res.json();
      setDocPhotoData(data);
    } catch {
      setOcrError("Não foi possível ler o documento. Tente uma foto mais nítida.");
    } finally {
      setIsOcring(false);
    }
  }

  // Verifica divergência entre nomes (contracheque x documento)
  function detectNameAlert(siapeName: string | undefined, docName: string | null): string | null {
    if (!siapeName || !docName) return null;
    const norm = (s: string) =>
      s.toUpperCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z\s]/g, "").replace(/\s+/g, " ").trim();
    const n1 = norm(siapeName);
    const n2 = norm(docName);
    if (n1 === n2) return null;
    const w1 = new Set(n1.split(" ").filter((w) => w.length > 2));
    const w2 = new Set(n2.split(" ").filter((w) => w.length > 2));
    const shared = [...w1].filter((w) => w2.has(w)).length;
    if (shared / Math.max(w1.size, w2.size) >= 0.65) return null;
    return `⚠️ Nome divergente: contracheque "${siapeName}" × documento "${docName}". Verifique antes de continuar (pode ser casamento, emancipação ou erro de cadastro).`;
  }

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
      bancoOrigem: "", saldoDevedor: "", prazoAtual: "",
    },
  });

  const watchedContractValue = form.watch("contractValue");
  const watchedCommPerc      = form.watch("commissionPercentage");
  const watchedCorretorPerc  = form.watch("corretorCommissionPercentage");
  const watchedBank          = form.watch("bank");

  // Filtra tabelas pelo banco selecionado (para Contrato Novo)
  const filteredTables: any[] = contractType === "NOVO" && watchedBank
    ? tables.filter((t: any) => t.bank === watchedBank)
    : tables;

  const contractValNum = parseBrNumber(watchedContractValue) || 0;
  const commPercNum = parseBrNumber(watchedCommPerc) || 0;
  const corretorPercNum = parseBrNumber(watchedCorretorPerc) || 0;
  const companyCommCalc = commPercNum > 0 ? contractValNum * commPercNum / 100 : 0;
  const corretorCommCalc = corretorPercNum > 0 ? companyCommCalc * corretorPercNum / 100 : 0;

  // ── Mutation ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const clientMeta =
        parsedData || docPhotoData
          ? {
              // ── SIAPE contracheque ──
              ...(parsedData && {
                identSiape:   parsedData.identSiape   || undefined,
                uf:           parsedData.uf           || undefined,
                orgao:        parsedData.orgao        || undefined,
                regJuridico:  parsedData.regJuridico  || undefined,
                bancoSalario: parsedData.bancoSalario || undefined,
                agencia:      parsedData.agencia      || undefined,
                conta:        parsedData.conta        || undefined,
                mesAno:       parsedData.mesAno       || undefined,
                vinculo:      parsedData.vinculo      || undefined,
              }),
              // ── Documento com foto (RG / CNH) ──
              ...(docPhotoData && {
                docFoto: {
                  tipo:            docPhotoData.tipo,
                  nome:            docPhotoData.nome,
                  numeroRegistro:  docPhotoData.numeroRegistro,
                  dataNascimento:  docPhotoData.dataNascimento,
                  dataExpedicao:   docPhotoData.dataExpedicao,
                  orgaoEmissor:    docPhotoData.orgaoEmissor,
                  filiacao:        docPhotoData.filiacao,
                  cpf:             docPhotoData.cpf,
                },
              }),
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
        clientMeta: {
          ...(clientMeta || {}),
          ...(contractType ? { tipoContrato: contractType } : {}),
          ...(data.bancoOrigem ? { bancoOrigem: data.bancoOrigem } : {}),
          ...(data.saldoDevedor ? { saldoDevedor: data.saldoDevedor } : {}),
          ...(data.prazoAtual ? { prazoAtual: data.prazoAtual } : {}),
          ...(extratoData ? {
            extrato: {
              emitidoEm:                        extratoData.emitidoEm,
              margemLiquidaFacultativaGlobal:   extratoData.margemLiquidaFacultativaGlobal,
              margemLiquidaCompulsoria:          extratoData.margemLiquidaCompulsoria,
              margemLiquidaCartao:               extratoData.margemLiquidaCartao,
              margemLiquidaCartaoBeneficio:      extratoData.margemLiquidaCartaoBeneficio,
              margemUtilizadaFacultativa:        extratoData.margemUtilizadaFacultativa,
              margemUtilizadaCartao:             extratoData.margemUtilizadaCartao,
              contratos:                         extratoData.contratos,
            },
          } : {}),
          // Conta bancária selecionada para crédito
          ...(() => {
            if (selectedContaIdx === "manual") {
              return {
                contaSelecionada: {
                  banco:   data.contaBanco   || "",
                  agencia: data.contaAgencia || "",
                  conta:   data.contaConta   || "",
                  origem:  "manual" as const,
                },
              };
            }
            if (typeof selectedContaIdx === "number" && parsedData?.contas?.[selectedContaIdx]) {
              const c = parsedData.contas[selectedContaIdx];
              return {
                contaSelecionada: {
                  banco:   c.banco,
                  agencia: c.agencia,
                  conta:   c.conta,
                  origem:  c.tipo as string,
                },
              };
            }
            return {};
          })(),
        } || undefined,
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
      // Não avança automaticamente — o usuário clica em "Continuar"
      // para ter tempo de também enviar o documento com foto
    } catch (err: any) {
      console.error("Erro ao processar PDF:", err);
      setParseError(
        "Não foi possível ler o contracheque. Verifique se é um PDF válido do SIAPE."
      );
    } finally {
      setIsParsing(false);
    }
  }

  // Avança para o formulário: faz lookup, detecta divergências e pré-preenche
  async function handleContinue() {
    if (!parsedData) return;

    // Lookup por CPF para dados anteriores
    let existing: ClientLookup | null = null;
    if (parsedData.cpf) {
      existing = await lookupByCpf(parsedData.cpf);
    }

    // Detecta divergência de nome entre contracheque e documento com foto
    const alert = detectNameAlert(parsedData.nome || undefined, docPhotoData?.nome ?? null);
    setNameAlert(alert);

    const nome      = parsedData.nome      || existing?.clientName      || "";
    const matricula = parsedData.matricula || existing?.clientMatricula || "";

    form.reset({
      clientName: nome,
      clientCpf: parsedData.cpf ? formatCpf(parsedData.cpf) : "",
      clientMatricula: matricula,
      bank: "", product: "", tableId: "",
      contractValue: "", installmentValue: "", term: "",
      ade: "", commissionPercentage: "", corretorCommissionPercentage: "",
    });

    // Adiciona todos os arquivos carregados à seção de Documentos
    setAttachments((prev) => {
      // Remove eventuais duplicatas de upload anterior
      let updated = prev.filter(
        (a) => a.documentType !== "RG_CNH" && a.documentType !== "CONTRACHEQUE"
      );
      if (siapeFile) {
        updated = [{ file: siapeFile, documentType: "CONTRACHEQUE" }, ...updated];
      }
      if (docFrenteFile) {
        updated = [...updated, { file: docFrenteFile, documentType: "RG_CNH" }];
      }
      if (docVersoFile) {
        updated = [...updated, { file: docVersoFile, documentType: "RG_CNH" }];
      }
      return updated;
    });

    setStep("dados-cadastrais");
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

  async function handleExtratoFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setExtratoError("Por favor selecione um arquivo PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setExtratoError("Arquivo muito grande (máx. 20MB).");
      return;
    }
    setExtratoFile(file);
    setIsParsingExtrato(true);
    setExtratoError(null);
    setExtratoData(null);
    try {
      const data = await parseExtratoConsignacao(file);
      setExtratoData(data);
      // Adiciona aos documentos automaticamente
      setAttachments((prev) => {
        const filtered = prev.filter((a) => a.documentType !== "EXTRATO_CONSIGNACOES");
        return [...filtered, { file, documentType: "EXTRATO_CONSIGNACOES" }];
      });
    } catch {
      setExtratoError("Não foi possível ler o extrato. Verifique se é um PDF válido do SIAPE.");
    } finally {
      setIsParsingExtrato(false);
    }
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
                setStep(conv.hasPdfUpload ? "siape-upload" : "dados-cadastrais");
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

  // ─── STEP 2 — Upload Contracheque + Documento com Foto ──────────────────────

  if (step === "siape-upload") {
    // Handler para frente do documento com foto
    function handleFrenteFile(file: File) {
      if (!file.type.startsWith("image/")) {
        setOcrError("Por favor selecione uma imagem (JPG, PNG, etc.).");
        return;
      }
      const preview = URL.createObjectURL(file);
      setDocFrenteFile(file);
      setDocFrentePreview(preview);
      setDocPhotoData(null);
      setOcrError(null);
      // Dispara OCR se verso já estiver carregado
      if (docVersoFile) runDocOcr(file, docVersoFile);
    }

    function handleVersoFile(file: File) {
      if (!file.type.startsWith("image/")) {
        setOcrError("Por favor selecione uma imagem (JPG, PNG, etc.).");
        return;
      }
      const preview = URL.createObjectURL(file);
      setDocVersoFile(file);
      setDocVersoPreview(preview);
      setDocPhotoData(null);
      setOcrError(null);
      // Dispara OCR se frente já estiver carregada
      if (docFrenteFile) runDocOcr(docFrenteFile, file);
    }

    // Miniatura de imagem carregada
    function ImageSlot({
      label, preview, file,
      onDrop, onDragOver, onDragLeave, onDrop2, dragOver: isDragOver,
      inputRef, onFileChange, onRemove,
    }: {
      label: string; preview: string | null; file: File | null;
      onDrop: (f: File) => void; onDragOver: () => void; onDragLeave: () => void;
      onDrop2?: never; dragOver: boolean;
      inputRef: React.RefObject<HTMLInputElement>; onFileChange: (f: File) => void;
      onRemove: () => void;
    }) {
      return (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {preview ? (
            <div className="relative group rounded-xl overflow-hidden border-2 border-green-300 dark:border-green-800">
              <img
                src={preview}
                alt={label}
                className="w-full h-36 object-cover"
              />
              {/* Overlay de remoção ao passar o mouse */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <button
                  type="button"
                  onClick={onRemove}
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-black/80 text-destructive rounded-full p-1.5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Badge de confirmação */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-green-600 text-white rounded-full px-2 py-0.5 text-xs font-medium">
                <CheckCircle2 className="h-3 w-3" /> {label}
              </div>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer transition-colors text-center px-3 ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary hover:bg-primary/5"
              }`}
              onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
              onDragLeave={onDragLeave}
              onDrop={(e) => {
                e.preventDefault(); onDragLeave();
                if (e.dataTransfer.files[0]) onDrop(e.dataTransfer.files[0]);
              }}
              onClick={() => inputRef.current?.click()}
            >
              <ImageIcon className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="text-xs font-medium">Arraste aqui</p>
              <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); }}
          />
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => setStep("convenio")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Nova Proposta — SIAPE</h1>
            <p className="text-sm text-muted-foreground">
              Carregue os documentos para preenchimento automático
            </p>
          </div>
        </div>

        {/* ── Duas colunas: Contracheque | Documento com Foto ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">

          {/* ───── Coluna 1: Contracheque ───── */}
          <div className="space-y-4">
            {/* Header da coluna */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Contracheque SIAPE</p>
                <p className="text-xs text-muted-foreground">PDF do contracheque de pagamento</p>
              </div>
            </div>

            {/* Estado: carregado com sucesso */}
            {siapeFile && parsedData ? (
              <div className="rounded-xl border-2 border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-6 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-600 dark:text-green-400" />
                <p className="font-semibold text-sm text-green-700 dark:text-green-400">
                  Contracheque lido com sucesso
                </p>
                {parsedData.nome && (
                  <p className="text-sm font-medium">{parsedData.nome}</p>
                )}
                <p className="text-xs text-muted-foreground truncate">{siapeFile.name}</p>
                <button
                  type="button"
                  onClick={() => { setSiapeFile(null); setParsedData(null); setParseError(null); }}
                  className="text-xs text-destructive hover:underline mt-1"
                >
                  Remover e enviar outro
                </button>
              </div>
            ) : (
              /* Estado: drop zone */
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
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
                  e.preventDefault(); setDragOver(false);
                  if (!isParsing && e.dataTransfer.files[0]) handlePdfFile(e.dataTransfer.files[0]);
                }}
                onClick={() => !isParsing && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handlePdfFile(e.target.files[0]); }}
                />
                {isParsing ? (
                  <>
                    <Loader2 className="h-10 w-10 mx-auto mb-3 text-blue-500 animate-spin" />
                    <p className="font-medium text-blue-600 dark:text-blue-400">Lendo contracheque...</p>
                    <p className="text-xs text-muted-foreground mt-1">Aguarde</p>
                  </>
                ) : parseError ? (
                  <>
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" />
                    <p className="font-medium text-red-600 dark:text-red-400 text-sm">Não foi possível ler o arquivo</p>
                    <p className="text-xs text-muted-foreground mt-1">{parseError}</p>
                    <p className="text-xs text-muted-foreground mt-2">Clique ou arraste outro arquivo</p>
                  </>
                ) : (
                  <>
                    <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium text-sm">Arraste o contracheque SIAPE aqui</p>
                    <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
                    <p className="text-xs text-muted-foreground mt-3">Apenas PDF · Máx. 20MB</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ───── Coluna 2: Documento com Foto ───── */}
          <div className="space-y-4">
            {/* Header da coluna */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Documento com Foto</p>
                <p className="text-xs text-muted-foreground">RG ou CNH — frente e verso obrigatórios</p>
              </div>
            </div>

            {/* Frente + Verso lado a lado */}
            <div className="grid grid-cols-2 gap-3">
              <ImageSlot
                label="Frente"
                preview={docFrentePreview}
                file={docFrenteFile}
                dragOver={docFrenteDrag}
                onDragOver={() => setDocFrenteDrag(true)}
                onDragLeave={() => setDocFrenteDrag(false)}
                onDrop={handleFrenteFile}
                inputRef={docFrenteRef}
                onFileChange={handleFrenteFile}
                onRemove={() => { setDocFrenteFile(null); setDocFrentePreview(null); setDocPhotoData(null); setOcrError(null); }}
              />
              <ImageSlot
                label="Verso"
                preview={docVersoPreview}
                file={docVersoFile}
                dragOver={docVersoDrag}
                onDragOver={() => setDocVersoDrag(true)}
                onDragLeave={() => setDocVersoDrag(false)}
                onDrop={handleVersoFile}
                inputRef={docVersoRef}
                onFileChange={handleVersoFile}
                onRemove={() => { setDocVersoFile(null); setDocVersoPreview(null); setDocPhotoData(null); setOcrError(null); }}
              />
            </div>

            {/* Status do OCR */}
            {isOcring && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Lendo documento com IA...
              </div>
            )}
            {ocrError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {ocrError}
              </div>
            )}

            {/* Dados extraídos pelo OCR */}
            {docPhotoData && !isOcring && (
              <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {docPhotoData.tipo === "CNH" ? "CNH" : docPhotoData.tipo === "RG" ? "RG" : "Documento"} lido
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {docPhotoData.nome && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Nome: </span>
                      <span className="font-medium">{docPhotoData.nome}</span>
                    </div>
                  )}
                  {docPhotoData.numeroRegistro && (
                    <div>
                      <span className="text-muted-foreground">Nº Registro: </span>
                      <span className="font-medium">{docPhotoData.numeroRegistro}</span>
                    </div>
                  )}
                  {docPhotoData.dataNascimento && (
                    <div>
                      <span className="text-muted-foreground">Nascimento: </span>
                      <span className="font-medium">{docPhotoData.dataNascimento}</span>
                    </div>
                  )}
                  {docPhotoData.dataExpedicao && (
                    <div>
                      <span className="text-muted-foreground">Expedição: </span>
                      <span className="font-medium">{docPhotoData.dataExpedicao}</span>
                    </div>
                  )}
                  {docPhotoData.orgaoEmissor && (
                    <div>
                      <span className="text-muted-foreground">Emissor: </span>
                      <span className="font-medium">{docPhotoData.orgaoEmissor}</span>
                    </div>
                  )}
                  {docPhotoData.filiacao?.[0] && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Pai: </span>
                      <span className="font-medium">{docPhotoData.filiacao[0]}</span>
                    </div>
                  )}
                  {docPhotoData.filiacao?.[1] && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Mãe: </span>
                      <span className="font-medium">{docPhotoData.filiacao[1]}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instrução quando nenhuma imagem ainda enviada */}
            {!docFrenteFile && !docVersoFile && (
              <p className="text-xs text-muted-foreground">
                Envie a frente e o verso do documento. O sistema extrai os dados automaticamente.
              </p>
            )}
          </div>
        </div>

        {/* ── Botões de ação ── */}
        <div className="flex flex-wrap items-center gap-3 max-w-4xl">
          <Button
            onClick={handleContinue}
            disabled={!parsedData || isParsing || isOcring}
            className="flex-1 sm:flex-none"
          >
            {isParsing || isOcring
              ? "Processando..."
              : !parsedData
              ? "Aguardando contracheque..."
              : "Continuar →"}
          </Button>
          <button
            type="button"
            onClick={() => setStep("dados-cadastrais")}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Preencher manualmente sem contracheque
          </button>
        </div>
      </div>
    );
  }

  // ─── STEP 3 — Dados Cadastrais ────────────────────────────────────────────

  if (step === "dados-cadastrais") {
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
              : "Preencha os dados do cliente"}
          </p>
        </div>
      </div>

      {/* Indicador de progresso */}
      <StepIndicator current="dados-cadastrais" />

      {/* Banner de extração bem-sucedida */}
      {hasExtracted && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Contracheque lido com sucesso — confira os dados abaixo e edite se necessário.
          </span>
        </div>
      )}

      {/* Banner de cliente recorrente */}
      {clientLookup && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3 text-sm text-blue-700 dark:text-blue-400">
          <History className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-medium">Cliente já cadastrado</span>
            {" — "}
            <span>
              {clientLookup.proposalCount} proposta{clientLookup.proposalCount !== 1 ? "s" : ""} anterior{clientLookup.proposalCount !== 1 ? "es" : ""}.
              {" "}Dados do último cadastro pré-carregados automaticamente.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLocation(`/contratos/${clientLookup.lastProposalId}`)}
            className="flex items-center gap-1 shrink-0 underline underline-offset-2 hover:opacity-70"
          >
            Ver última <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Indicador de lookup em andamento */}
      {isLookingUp && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Verificando cadastro anterior...
        </div>
      )}

      {/* Alerta de divergência de nome entre contracheque e documento */}
      {nameAlert && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <span>{nameAlert}</span>
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
                        onBlur={async (e) => {
                          field.onBlur();
                          // Para entrada manual: lookup ao sair do campo
                          if (!hasExtracted) {
                            const found = await lookupByCpf(e.target.value);
                            if (found) {
                              // Preenche nome e matrícula apenas se estiverem vazios
                              if (!form.getValues("clientName") && found.clientName) {
                                form.setValue("clientName", found.clientName);
                              }
                              if (!form.getValues("clientMatricula") && found.clientMatricula) {
                                form.setValue("clientMatricula", found.clientMatricula);
                              }
                            }
                          }
                        }}
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
                  {/* ── Seleção de conta bancária para crédito (sempre para SIAPE) ── */}
                  {isSiape && (
                    <div id="conta-selecao" className={`col-span-2 md:col-span-3 lg:col-span-4 space-y-2 rounded-lg p-3 transition-colors ${
                      contaError ? "bg-destructive/5 ring-2 ring-destructive/40" : ""
                    }`}>
                      <p className={`text-xs font-medium ${contaError ? "text-destructive" : "text-muted-foreground"}`}>
                        Conta para Crédito
                        {contaError && <span className="ml-1 font-semibold">— selecione uma das opções abaixo para continuar</span>}
                      </p>

                      {/* Lista de contas extraídas do contracheque (0, 1 ou 2) */}
                      <div className="grid gap-2">
                        {(() => {
                          const contas = parsedData?.contas?.length
                            ? parsedData.contas
                            : parsedData?.bancoSalario
                              ? [{ banco: parsedData.bancoSalario, agencia: parsedData.agencia, conta: parsedData.conta, tipo: "salario" as const, label: "Conta Salário" }]
                              : [];
                          return contas;
                        })().map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setSelectedContaIdx(i); setContaError(false); }}
                            className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                              selectedContaIdx === i
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                : "border-border hover:border-blue-300 dark:hover:border-blue-700"
                            }`}
                          >
                            {/* Radio circle */}
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selectedContaIdx === i ? "border-blue-500" : "border-muted-foreground/40"
                            }`}>
                              {selectedContaIdx === i && (
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground leading-none mb-1">{c.label}</p>
                              <p className="text-sm font-mono">
                                Banco <strong>{c.banco}</strong>
                                {" · "}Ag <strong>{c.agencia}</strong>
                                {" · "}Conta <strong>{c.conta}</strong>
                              </p>
                            </div>
                            {selectedContaIdx === i && (
                              <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                            )}
                          </button>
                        ))}

                        {/* Opção manual */}
                        <button
                          type="button"
                          onClick={() => { setSelectedContaIdx("manual"); setContaError(false); }}
                          className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                            selectedContaIdx === "manual"
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                              : "border-border hover:border-amber-300 dark:hover:border-amber-700"
                          }`}
                        >
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selectedContaIdx === "manual" ? "border-amber-500" : "border-muted-foreground/40"
                          }`}>
                            {selectedContaIdx === "manual" && (
                              <div className="h-2 w-2 rounded-full bg-amber-500" />
                            )}
                          </div>
                          <div className="flex-1 flex items-center gap-2 flex-wrap">
                            <span className="text-sm">Informar conta manualmente</span>
                            {selectedContaIdx === "manual" && (
                              <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                                <TriangleAlert className="h-3 w-3" />
                                Conta diferente do contracheque
                              </span>
                            )}
                          </div>
                        </button>
                      </div>

                      {/* Campos de entrada manual */}
                      {selectedContaIdx === "manual" && (
                        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/10 p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <TriangleAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              Esta conta não consta no contracheque. Confirme os dados com o cliente antes de prosseguir.
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <FormField
                              control={form.control}
                              name="contaBanco"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Cód. Banco</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Ex: 033" maxLength={4} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="contaAgencia"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Agência</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Ex: 022840" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="contaConta"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Conta</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Ex: 0000710177973" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Dados do Documento com Foto (somente leitura) ── */}
          {docPhotoData && (
            <Card className="border-purple-200 dark:border-purple-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-purple-700 dark:text-purple-400">
                  <CreditCard className="h-4 w-4" />
                  {docPhotoData.tipo === "CNH" ? "CNH" : docPhotoData.tipo === "RG" ? "RG" : "Documento com Foto"}
                  <span className="text-xs font-normal text-muted-foreground">(apenas informação)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                  {docPhotoData.numeroRegistro && (
                    <InfoField label="Nº Registro" value={docPhotoData.numeroRegistro} />
                  )}
                  {docPhotoData.dataNascimento && (
                    <InfoField label="Nascimento" value={docPhotoData.dataNascimento} />
                  )}
                  {docPhotoData.dataExpedicao && (
                    <InfoField label="Expedição" value={docPhotoData.dataExpedicao} />
                  )}
                  {docPhotoData.orgaoEmissor && (
                    <InfoField label="Órgão Emissor" value={docPhotoData.orgaoEmissor} />
                  )}
                  {docPhotoData.filiacao?.[0] && (
                    <InfoField label="Filiação — Pai" value={docPhotoData.filiacao[0]} wide />
                  )}
                  {docPhotoData.filiacao?.[1] && (
                    <InfoField label="Filiação — Mãe" value={docPhotoData.filiacao[1]} wide />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Documentos ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Documentos
                {attachments.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    — {attachments.length} arquivo{attachments.length !== 1 ? "s" : ""} anexado{attachments.length !== 1 ? "s" : ""}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
            <Button
              type="button"
              onClick={async () => {
                const valid = await form.trigger(["clientName", "clientCpf"]);
                if (!valid) return;

                // Barreira: conta bancária sempre obrigatória para SIAPE
                if (isSiape && parsedData && selectedContaIdx === null) {
                  setContaError(true);
                  document.getElementById("conta-selecao")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  return;
                }

                // Confirmação para QUALQUER conta selecionada (contracheque ou manual)
                if (isSiape && parsedData && selectedContaIdx !== null) {
                  setShowManualConfirm(true);
                  return;
                }

                setStep("tipo-contrato");
              }}
            >
              Próximo →
            </Button>
          </div>
        </form>
      </Form>

      {/* ── Popup de confirmação de conta bancária ── */}
      <AlertDialog open={showManualConfirm} onOpenChange={setShowManualConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {selectedContaIdx === "manual" ? (
              <AlertDialogTitle className="flex items-center gap-2">
                <TriangleAlert className="h-5 w-5 text-amber-500" />
                Conta informada manualmente
              </AlertDialogTitle>
            ) : (
              <AlertDialogTitle className="flex items-center gap-2">
                <TriangleAlert className="h-5 w-5 text-blue-500" />
                Confirmar conta para crédito
              </AlertDialogTitle>
            )}
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {selectedContaIdx === "manual" ? (
                  <>
                    <p>
                      A conta bancária que você digitou <strong>não consta no contracheque</strong> do cliente.
                      Usar uma conta diferente pode gerar problemas no crédito da operação.
                    </p>
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300 font-medium">
                      ⚠️ Você confirmou esses dados diretamente com o cliente antes de continuar?
                    </div>
                  </>
                ) : (
                  <>
                    {(() => {
                      const contas = parsedData?.contas?.length
                        ? parsedData.contas
                        : parsedData?.bancoSalario
                          ? [{ banco: parsedData.bancoSalario, agencia: parsedData.agencia, conta: parsedData.conta, label: "Conta Salário" }]
                          : [];
                      const c = typeof selectedContaIdx === "number" ? contas[selectedContaIdx] : null;
                      return c ? (
                        <div className="rounded-lg bg-muted border p-3 space-y-1 text-sm font-mono">
                          <p><span className="text-muted-foreground font-sans font-medium">Banco:</span> {c.banco}</p>
                          <p><span className="text-muted-foreground font-sans font-medium">Agência:</span> {c.agencia}</p>
                          <p><span className="text-muted-foreground font-sans font-medium">Conta:</span> {c.conta}</p>
                          <p className="font-sans text-xs text-muted-foreground pt-1">{(c as any).label}</p>
                        </div>
                      ) : null;
                    })()}
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300 font-medium">
                      Você confirmou com o cliente que o crédito será realizado nessa conta?
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e corrigir</AlertDialogCancel>
            <AlertDialogAction
              className={selectedContaIdx === "manual"
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"}
              onClick={() => {
                setShowManualConfirm(false);
                setStep("tipo-contrato");
              }}
            >
              Sim, confirmei com o cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
  } // end dados-cadastrais

  // ─── STEP 4 — Tipo de Contrato ────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setStep("dados-cadastrais")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Nova Proposta</h1>
            {selectedConvenio && <Badge variant="outline">{selectedConvenio.label}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Selecione o tipo de operação</p>
        </div>
      </div>

      {/* Indicador de progresso */}
      <StepIndicator current="tipo-contrato" />

      {/* ── Seleção do tipo de contrato ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
        {CONTRACT_TYPES.map((ct) => (
          <button
            key={ct.id}
            type="button"
            onClick={() => {
              setContractType(ct.id);
              form.setValue("product", ct.product);
            }}
            className={`text-left p-4 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              contractType === ct.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary hover:bg-primary/5"
            }`}
          >
            <div className="text-2xl mb-2">{ct.icon}</div>
            <div className={`font-semibold text-sm ${contractType === ct.id ? "text-primary" : ""}`}>
              {ct.label}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{ct.description}</div>
          </button>
        ))}
      </div>

      {/* ── Upload do Extrato de Consignações (SIAPE) ── */}
      {selectedConvenio?.id === "SIAPE" && contractType && (
        <div className="space-y-3 max-w-4xl">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold">Extrato de Consignações</span>
            <Badge variant="outline" className="text-xs">SIAPE obrigatório</Badge>
          </div>

          {extratoFile && extratoData && !isParsingExtrato ? (
            /* ── Estado: extrato lido com sucesso ── */
            <div className="rounded-xl border-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    Extrato lido — {extratoFile.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExtratoFile(null);
                    setExtratoData(null);
                    setAttachments((prev) => prev.filter((a) => a.documentType !== "EXTRATO_CONSIGNACOES"));
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Remover
                </button>
              </div>

              {/* ── Contrato Novo: margem líquida disponível (1 linha) ── */}
              {contractType === "NOVO" && extratoData.margemLiquidaFacultativaGlobal !== null && (
                <div className="flex items-center gap-3 rounded-lg bg-white dark:bg-black/30 border border-blue-200 dark:border-blue-900 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Margem disponível (Líquida Facult. Global)</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 leading-tight">
                      {extratoData.margemLiquidaFacultativaGlobal.toLocaleString("pt-BR", {
                        style: "currency", currency: "BRL",
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Cartão com Saque: margem de cartão (1 linha) ── */}
              {contractType === "CARTAO" && extratoData.margemLiquidaCartao !== null && (
                <div className="flex items-center gap-3 rounded-lg bg-white dark:bg-black/30 border border-blue-200 dark:border-blue-900 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Margem disponível (Cartão)</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 leading-tight">
                      {extratoData.margemLiquidaCartao.toLocaleString("pt-BR", {
                        style: "currency", currency: "BRL",
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Portabilidade / Refinanciamento / Compra: exibe contratos ── */}
              {(contractType === "PORTABILIDADE" ||
                contractType === "PORTABILIDADE_REFIN" ||
                contractType === "COMPRA_DIVIDA" ||
                contractType === "REFINANCIAMENTO") &&
                extratoData.contratos.filter((c) => c.tipoContrato === "EMPRESTIMO").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Contratos ativos no extrato
                  </p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {extratoData.contratos
                      .filter((c) => c.tipoContrato === "EMPRESTIMO")
                      .map((c, idx) => (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 p-2 rounded-md border bg-white dark:bg-black/20 text-xs"
                        >
                          <span className="font-mono font-semibold text-foreground">{c.numeroContrato}</span>
                          <span className="text-muted-foreground flex-1 min-w-0 truncate">{c.nomeRubrica}</span>
                          <span className="font-medium">
                            {c.valorParcela.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="text-muted-foreground">
                            {c.prazoAtual}/{c.prazoTotal} parc.
                          </span>
                          <span className="text-muted-foreground">até {c.fim}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Emissão */}
              {extratoData.emitidoEm && (
                <p className="text-xs text-muted-foreground">
                  Extrato emitido em {extratoData.emitidoEm}
                </p>
              )}
            </div>
          ) : (
            /* ── Estado: drop zone ── */
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                extratoDrag
                  ? "border-primary bg-primary/5"
                  : isParsingExtrato
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                  : extratoError
                  ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                  : "border-border hover:border-primary hover:bg-primary/5"
              }`}
              onDragOver={(e) => { e.preventDefault(); if (!isParsingExtrato) setExtratoDrag(true); }}
              onDragLeave={() => setExtratoDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setExtratoDrag(false);
                if (!isParsingExtrato && e.dataTransfer.files[0]) handleExtratoFile(e.dataTransfer.files[0]);
              }}
              onClick={() => !isParsingExtrato && extratoRef.current?.click()}
            >
              <input
                ref={extratoRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleExtratoFile(e.target.files[0]); }}
              />
              {isParsingExtrato ? (
                <>
                  <Loader2 className="h-8 w-8 mx-auto mb-2 text-blue-500 animate-spin" />
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Lendo extrato...</p>
                  <p className="text-xs text-muted-foreground mt-1">Extraindo margens e contratos</p>
                </>
              ) : extratoError ? (
                <>
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{extratoError}</p>
                  <p className="text-xs text-muted-foreground mt-1">Clique ou arraste outro arquivo</p>
                </>
              ) : (
                <>
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Arraste o Extrato de Consignações aqui</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF emitido pelo SIAPE · Máx. 20MB</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Campos específicos por tipo ── */}
      {/* Campos só aparecem se: não for NOVO+SIAPE OU extrato já foi carregado */}
      {contractType && (selectedConvenio?.id !== "SIAPE" || contractType !== "NOVO" || extratoData !== null) && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
            className="space-y-4 max-w-4xl"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {CONTRACT_TYPES.find((c) => c.id === contractType)?.label}
                  <span className="text-xs font-normal text-muted-foreground">— dados da operação</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* ── Banco Origem (portabilidade / compra dívida) ── */}
                {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN" || contractType === "COMPRA_DIVIDA") && (
                  <FormField
                    control={form.control}
                    name="bancoOrigem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banco de Origem</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Banco atual do cliente" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {/* ── Saldo devedor (portabilidade / refin / compra) ── */}
                {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN" || contractType === "COMPRA_DIVIDA" || contractType === "REFINANCIAMENTO") && (
                  <FormField
                    control={form.control}
                    name="saldoDevedor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saldo Devedor (R$)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="0,00" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {/* ── Prazo atual (portabilidade) ── */}
                {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") && (
                  <FormField
                    control={form.control}
                    name="prazoAtual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prazo Restante (meses)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="Ex: 48" min={1} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {/* ── Banco credor / destino / emissor ── */}
                <FormField
                  control={form.control}
                  name="bank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN" || contractType === "COMPRA_DIVIDA")
                          ? "Banco de Destino"
                          : contractType === "CARTAO"
                          ? "Banco Emissor"
                          : "Banco (credor)"}
                      </FormLabel>
                      {banks.length > 0 && bankMode === "select" ? (
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            if (v === "_outro_") { setBankMode("text"); field.onChange(""); }
                            else {
                              field.onChange(v);
                              // Limpa tabela ao trocar banco
                              if (contractType === "NOVO") form.setValue("tableId", "");
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecione o banco..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {banks.map((b: any) => (
                              <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
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
                            <Button type="button" size="sm" variant="outline" className="shrink-0"
                              onClick={() => { setBankMode("select"); field.onChange(""); }}>↩</Button>
                          )}
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                {/* ── Tabela (filtrada por banco para NOVO; oculta em cartão) ── */}
                {contractType !== "CARTAO" && (
                  <FormField
                    control={form.control}
                    name="tableId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Tabela
                          {contractType === "NOVO" && !watchedBank && (
                            <span className="text-xs font-normal text-muted-foreground ml-1">(selecione o banco primeiro)</span>
                          )}
                        </FormLabel>
                        <Select
                          value={field.value}
                          disabled={contractType === "NOVO" && !watchedBank}
                          onValueChange={(v) => {
                            field.onChange(v);
                            // Auto-preenche prazo da tabela selecionada
                            if (contractType === "NOVO") {
                              const tbl = filteredTables.find((t: any) => String(t.id) === v);
                              if (tbl?.termMonths) form.setValue("term", String(tbl.termMonths));
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={
                                contractType === "NOVO" && watchedBank && filteredTables.length === 0
                                  ? "Nenhuma tabela para este banco"
                                  : "Selecione..."
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredTables.map((t: any) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.tableName || t.name || `Tabela ${t.id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                )}

                {/* ── Prazo: auto-preenchido pela tabela no NOVO; editável nos demais ── */}
                {contractType === "NOVO" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prazo</label>
                    <div className="h-10 px-3 flex items-center rounded-md border bg-muted/50 text-sm">
                      {form.watch("term")
                        ? `${form.watch("term")} meses`
                        : <span className="text-muted-foreground">preenchido ao selecionar a tabela</span>}
                    </div>
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="term"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN")
                            ? "Novo Prazo (meses)"
                            : "Prazo (meses)"}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="Ex: 60" min={1} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {/* ── Valor Liberado / Valor Saque / Troco ── */}
                <FormField
                  control={form.control}
                  name="contractValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {contractType === "CARTAO" ? "Valor do Saque (R$)"
                          : contractType === "PORTABILIDADE_REFIN" ? "Troco / Refinanciamento (R$)"
                          : "Valor Liberado (R$)"}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0,00" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* ── Parcela ── */}
                <FormField
                  control={form.control}
                  name="installmentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN")
                          ? "Nova Parcela (R$)"
                          : "Valor da Parcela (R$)"}
                        {contractType === "NOVO" && extratoData?.margemLiquidaFacultativaGlobal != null && (
                          <span className="text-xs font-normal text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                            máx. {fmtBRL(extratoData.margemLiquidaFacultativaGlobal)}
                          </span>
                        )}
                        {contractType === "CARTAO" && extratoData?.margemLiquidaCartao != null && (
                          <span className="text-xs font-normal text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                            máx. {fmtBRL(extratoData.margemLiquidaCartao)}
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0,00" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* ── ADE — somente para operações que precisam (não no Contrato Novo) ── */}
                {contractType !== "NOVO" && (
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
                )}
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
                    Preencha para acompanhar a comissão esperada. Serão pré-carregados ao marcar como PAGO.
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
                              <Input {...field} placeholder="Ex: 7,5"
                                onChange={(e) => field.onChange(formatPercent(e.target.value))} />
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
                              <Input {...field} placeholder="Ex: 50"
                                onChange={(e) => field.onChange(formatPercent(e.target.value))} />
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

            <div className="flex justify-end gap-3 pb-4">
              <Button type="button" variant="outline" onClick={() => setStep("dados-cadastrais")}>
                Voltar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Cadastrando..." : "Cadastrar Proposta"}
              </Button>
            </div>
          </form>
        </Form>
      )}

      {/* Footer sem tipo selecionado */}
      {!contractType && (
        <div className="flex justify-start pb-4">
          <Button type="button" variant="outline" onClick={() => setStep("dados-cadastrais")}>
            Voltar
          </Button>
        </div>
      )}
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
