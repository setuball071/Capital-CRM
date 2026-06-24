import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft, FileText, Upload, X, ChevronDown, ChevronUp,
  Building2, BadgePercent, CheckCircle2, AlertCircle, Loader2,
  User, MapPin, CreditCard, ImageIcon, TriangleAlert, Search, Eye,
  Landmark, Users, Flag, Sparkles, ArrowLeftRight, Coins, RotateCw,
  Trash2, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { parseSiapeContracheque, type SiapeParsedData } from "@/lib/siape-pdf-parser";
import { renderPdfFirstPageToBlob, isPdf } from "@/lib/pdf-render";

// ─── Constantes ──────────────────────────────────────────────────────────────

const CONVENIOS = [
  {
    id: "SIAPE",
    label: "SIAPE",
    description: "Servidores Federais",
    Icon: Landmark,
    iconColor: "text-blue-600 dark:text-blue-400",
    hasPdfUpload: true,
  },
  {
    id: "INSS",
    label: "INSS",
    description: "Aposentados e Pensionistas",
    Icon: Users,
    iconColor: "text-amber-600 dark:text-amber-400",
    hasPdfUpload: false,
  },
  {
    id: "GOV_MA",
    label: "Governo do Maranhão",
    description: "Estado do Maranhão",
    Icon: Flag,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    hasPdfUpload: false,
  },
  {
    id: "GOV_SC",
    label: "Governo de Santa Catarina",
    description: "Estado de Santa Catarina",
    Icon: Flag,
    iconColor: "text-indigo-600 dark:text-indigo-400",
    hasPdfUpload: false,
  },
  {
    id: "GOV_SP",
    label: "Governo de São Paulo",
    description: "Estado de São Paulo",
    Icon: Flag,
    iconColor: "text-rose-600 dark:text-rose-400",
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
    Icon: Sparkles,
    iconColor: "text-violet-600 dark:text-violet-400",
    product: "NOVO",
  },
  {
    id: "CARTAO",
    label: "Cartão com Saque",
    description: "Cartão consignado com saque",
    Icon: CreditCard,
    iconColor: "text-blue-600 dark:text-blue-400",
    product: "CARTAO",
  },
  {
    id: "PORTABILIDADE",
    label: "Portabilidade",
    description: "Portabilidade simples sem refinanciamento",
    Icon: ArrowLeftRight,
    iconColor: "text-cyan-600 dark:text-cyan-400",
    product: "PORTABILIDADE",
  },
  {
    id: "COMPRA_DIVIDA",
    label: "Compra de Dívida",
    description: "Quitação de dívida externa com consignado",
    Icon: Coins,
    iconColor: "text-amber-600 dark:text-amber-400",
    product: "PORTABILIDADE",
  },
  {
    id: "REFINANCIAMENTO",
    label: "Refinanciamento",
    description: "Refin de contrato existente na mesma instituição",
    Icon: RotateCw,
    iconColor: "text-indigo-600 dark:text-indigo-400",
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
  // Contato
  clientPhone: z.string().min(10, "Telefone obrigatório"),
  clientEmail: z.string().email("E-mail inválido"),
  // Endereço
  clientCep: z.string().min(8, "CEP obrigatório"),
  clientLogradouro: z.string().min(1, "Logradouro obrigatório"),
  clientNumero: z.string().min(1, "Número obrigatório"),
  clientComplemento: z.string().optional(),
  clientBairro: z.string().min(1, "Bairro obrigatório"),
  clientCidade: z.string().min(1, "Cidade obrigatória"),
  clientEstado: z.string().min(2, "Estado obrigatório"),
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

/** Formata número (com casas decimais) para "1.234,56" — só pra exibir nos inputs sincronizados */
function formatBRNumber(n: number): string {
  if (!isFinite(n) || n <= 0) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function formatCep(value: string) {
  return value.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{0,3})/, "$1-$2").replace(/-$/, "");
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

// ─── Portabilidade: tipos internos ───────────────────────────────────────────

interface PortabilidadeContrato {
  uid: string;
  source: "extrato" | "manual";
  banco: string;
  numeroContrato: string;
  parcelaAtual: string;
  prazoAtual: string;
  prazoTotal: string;
  inicio: string;
  fim: string;
  taxa: string;
  saldoDevedor: string;
  bancoDestino: string;
  novaParcela: string;
  troco: string;
  novoPrazo: string;
  tableId?: string;
}

interface SimulacaoPort {
  // formato novo (exportarParaDigitacao)
  exportado_em?: string;
  banco_destino?: string;
  contratos?: Array<{
    banco: string;
    numero_contrato: string;
    parcela_atual: number;
    prazo_restante: number;
    prazo_total?: number;
    taxa_atual: number;
    saldo_devedor: number;
    taxa_nova: number;
    prazo_novo: number;
    nova_parcela: number;
    troco?: number;
  }>;
  // formato antigo (salvarCotacao)
  tipo?: string;
  taxa_refim?: number;
  contratos_selecionados?: Array<{
    banco: string;
    parcela: number;
    prazo: number;
    taxa: number;
    saldo: number;
    numeroContrato?: string;
  }>;
  resultado?: {
    modo?: string;
    linhas?: Array<{
      banco?: string;
      parcela: number;
      troco?: number;
      prazo: number;
    }>;
  };
}

// ─── Tipos de step ────────────────────────────────────────────────────────────

type Step = "cpf" | "convenio" | "siape-upload" | "dados-cadastrais" | "tipo-contrato" | "contratos-portabilidade" | "conferencia";

// ─── Wizard progress indicator ────────────────────────────────────────────────

const WIZARD_STEPS_DEFAULT = [
  { key: "dados-cadastrais",        label: "Dados Cadastrais" },
  { key: "tipo-contrato",           label: "Tipo de Contrato" },
  { key: "conferencia",             label: "Conferência" },
];

const WIZARD_STEPS_PORT = [
  { key: "dados-cadastrais",        label: "Dados Cadastrais" },
  { key: "tipo-contrato",           label: "Tipo de Contrato" },
  { key: "contratos-portabilidade", label: "Contratos" },
  { key: "conferencia",             label: "Conferência" },
];

function StepIndicator({ current, steps = WIZARD_STEPS_DEFAULT }: { current: string; steps?: typeof WIZARD_STEPS_DEFAULT }) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
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
            {i < steps.length - 1 && (
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
  const [step, setStep] = useState<Step>("cpf");
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
  const [extratoError,       setExtratoError]       = useState<string | null>(null);
  const [extratoDrag,        setExtratoDrag]        = useState(false);
  // índice da conta selecionada do contracheque (0, 1) ou "manual"
  const [selectedContaIdx,      setSelectedContaIdx]      = useState<number | "manual" | null>(null);
  const [contaError,             setContaError]             = useState(false);
  const [showManualConfirm,      setShowManualConfirm]      = useState(false);

  // ── Portabilidade em lote ────────────────────────────────────────────────────
  const [portContratos,    setPortContratos]    = useState<PortabilidadeContrato[]>([]);
  const [simPortFile,  setSimPortFile]  = useState<File | null>(null);
  const [simPortData,  setSimPortData]  = useState<SimulacaoPort | null>(null);
  const simPortRef = useRef<HTMLInputElement>(null);

  // ── Memória de cliente (lookup por CPF) ─────────────────────────────────────
  interface ClientLookup {
    clientName: string;
    clientCpf?: string | null;
    clientMatricula: string | null;
    clientMeta: any;
    clientConvenio: string | null;
    proposalCount: number;
    lastProposalId: number;
    lastStatus: string;
    documents?: { id: number; documentType: string; fileName: string }[];
  }
  const [clientLookup, setClientLookup] = useState<ClientLookup | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  // Passo CPF (primeiro passo): reaproveitar cadastro/documentos existentes
  const [cpfInput, setCpfInput] = useState("");
  const [cpfSearched, setCpfSearched] = useState(false);
  // Documentos reaproveitados do cadastro anterior (exibidos no wizard, linkados ao salvar)
  const [reusedDocs, setReusedDocs] = useState<{ id: number; documentType: string; fileName: string }[]>([]);

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
    naturalidade: string | null;
  }
  const [docFrenteFile, setDocFrenteFile] = useState<File | null>(null);
  const [docVersoFile,  setDocVersoFile]  = useState<File | null>(null);
  const [docFrentePreview, setDocFrentePreview] = useState<string | null>(null);
  const [docVersoPreview,  setDocVersoPreview]  = useState<string | null>(null);
  const [docFrenteDrag, setDocFrenteDrag] = useState(false);
  const [docVersoDrag,  setDocVersoDrag]  = useState(false);
  const [isOcring,      setIsOcring]      = useState(false);
  const [ocrError,      setOcrError]      = useState<string | null>(null);
  const [docPhotoData,  setDocPhotoData]  = useState<DocPhotoData | null>(null);
  /** "ocr" = lido por IA agora | "cached" = vindo de proposta anterior | "manual" = digitado à mão */
  const [docPhotoSource, setDocPhotoSource] = useState<"ocr" | "cached" | "manual" | null>(null);
  // Edição inline dos campos do documento de identidade
  const [nameAlert,     setNameAlert]     = useState<string | null>(null);

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

  // Converte arquivo (imagem OU PDF) em imagem JPEG para o OCR
  async function fileToImageBlob(file: File): Promise<Blob> {
    if (isPdf(file)) return renderPdfFirstPageToBlob(file);
    return resizeImageToBlob(file);
  }

  // Chama o endpoint OCR com as imagens da frente e verso
  async function runDocOcr(frente: File, verso: File | null) {
    setIsOcring(true);
    setOcrError(null);
    try {
      const formData = new FormData();
      const frenteBlob = await fileToImageBlob(frente);
      formData.append("frente", new File([frenteBlob], "frente.jpg", { type: "image/jpeg" }));
      if (verso) {
        const versoBlob = await fileToImageBlob(verso);
        formData.append("verso", new File([versoBlob], "verso.jpg", { type: "image/jpeg" }));
      }
      const res = await fetch("/api/ocr/document", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        let serverMsg = "";
        try { serverMsg = (await res.json())?.message || ""; } catch {}
        throw new Error(serverMsg || "OCR falhou");
      }
      const data: DocPhotoData = await res.json();
      setDocPhotoData(data);
      setDocPhotoSource("ocr");
    } catch (err: any) {
      setOcrError(
        err?.message ||
          "Não foi possível ler o documento automaticamente. Preencha os dados abaixo."
      );
      // Libera os campos para preenchimento manual automaticamente (não trava o cadastro)
      startManualDoc();
    } finally {
      setIsOcring(false);
    }
  }

  // Abre os campos do documento em branco para preenchimento manual
  function startManualDoc() {
    setDocPhotoData({
      tipo: "RG",
      nome: null,
      numeroRegistro: null,
      cpf: null,
      filiacao: [null, null],
      dataNascimento: null,
      dataExpedicao: null,
      orgaoEmissor: null,
      naturalidade: null,
    });
    setDocPhotoSource("manual");
  }

  // Chamado quando frente+verso estão prontos: verifica cache ANTES de gastar IA
  async function handleBothImagesReady(frente: File, verso: File | null) {
    setDocPhotoData(null);
    setDocPhotoSource(null);
    setOcrError(null);

    // Se CPF do contracheque está disponível, tenta reusar docFoto de proposta anterior
    const cpf = parsedData?.cpf?.replace(/\D/g, "");
    if (cpf && cpf.length === 11) {
      const existing = clientLookup ?? (await lookupByCpf(cpf));
      const savedDoc = (existing as ClientLookup | null)?.clientMeta?.docFoto;
      if (savedDoc?.tipo) {
        // ✅ Dados já existem — usa sem chamar IA
        setDocPhotoData(savedDoc as DocPhotoData);
        setDocPhotoSource("cached");
        return;
      }
    }

    // Sem cache ou sem CPF → OCR com IA
    setDocPhotoSource("ocr");
    runDocOcr(frente, verso);
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


  // Atualiza um campo do documento direto (sem modo de edição) — preenchimento manual
  function setDocField(key: string, raw: string) {
    const v = raw;
    setDocPhotoData((prev) => {
      if (!prev) return prev;
      if (key === "filiacaoPai") return { ...prev, filiacao: [v || null, prev.filiacao?.[1] ?? null] };
      if (key === "filiacaoMae") return { ...prev, filiacao: [prev.filiacao?.[0] ?? null, v || null] };
      return { ...prev, [key]: v || null } as DocPhotoData;
    });
  }

  // Campo de input SEMPRE editável (borda roxa) p/ preenchimento manual do documento.
  // Função (não componente) para o input não perder o foco a cada tecla.
  const renderManualInput = (key: string, label: string, value: any, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        className="mt-0.5 w-full rounded-md border border-purple-300 dark:border-purple-800 bg-background px-2.5 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
        value={value ?? ""}
        onChange={(e) => setDocField(key, e.target.value)}
      />
    </div>
  );

  // ── Form state ──────────────────────────────────────────────────────────────
  const [bankMode, setBankMode] = useState<"select" | "text">("select");
  const [showComercial, setShowComercial] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [docDragOver, setDocDragOver] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  // ── Preview de anexo (visualizar arquivo em popup) ─────────────────────────
  const [previewAttachment, setPreviewAttachment] = useState<{ file: File; url: string } | null>(null);

  function openAttachmentPreview(file: File) {
    const url = URL.createObjectURL(file);
    setPreviewAttachment({ file, url });
  }
  function closeAttachmentPreview() {
    if (previewAttachment) URL.revokeObjectURL(previewAttachment.url);
    setPreviewAttachment(null);
  }

  // ── Buscador de CEP (busca reversa por endereço) ───────────────────────────
  const [cepSearchOpen, setCepSearchOpen] = useState(false);
  const [cepSearchUf,        setCepSearchUf]        = useState("");
  const [cepSearchCidade,    setCepSearchCidade]    = useState("");
  const [cepSearchLogradouro, setCepSearchLogradouro] = useState("");
  const [cepSearchResults, setCepSearchResults] = useState<any[]>([]);
  const [cepSearchLoading, setCepSearchLoading] = useState(false);
  const [cepSearchError, setCepSearchError] = useState<string | null>(null);

  async function searchCepByAddress() {
    const uf  = cepSearchUf.trim().toUpperCase();
    const cid = cepSearchCidade.trim();
    const log = cepSearchLogradouro.trim();
    if (uf.length !== 2 || cid.length < 3 || log.length < 3) {
      setCepSearchError("Preencha UF (2 letras), cidade (mín 3) e logradouro (mín 3).");
      return;
    }
    setCepSearchError(null);
    setCepSearchLoading(true);
    setCepSearchResults([]);
    try {
      const res = await fetch(
        `https://viacep.com.br/ws/${uf}/${encodeURIComponent(cid)}/${encodeURIComponent(log)}/json/`
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setCepSearchResults(data);
      } else {
        setCepSearchError("Nenhum endereço encontrado. Tente ajustar os termos.");
      }
    } catch {
      setCepSearchError("Falha na busca. Verifique sua conexão.");
    } finally {
      setCepSearchLoading(false);
    }
  }

  function pickCepResult(r: any) {
    form.setValue("clientCep",        formatCep(r.cep || ""));
    form.setValue("clientLogradouro", r.logradouro || "");
    form.setValue("clientBairro",     r.bairro || "");
    form.setValue("clientCidade",     r.localidade || "");
    form.setValue("clientEstado",     r.uf || "");
    setCepSearchOpen(false);
    setCepSearchResults([]);
    setCepSearchError(null);
    setTimeout(() => document.getElementById("field-numero")?.focus(), 50);
  }

  async function fetchCep(cepRaw: string) {
    const digits = cepRaw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (data.logradouro) form.setValue("clientLogradouro", data.logradouro);
        if (data.bairro)     form.setValue("clientBairro",     data.bairro);
        if (data.localidade) form.setValue("clientCidade",     data.localidade);
        if (data.uf)         form.setValue("clientEstado",     data.uf);
        // Foca o campo Número após autopreenchimento
        setTimeout(() => document.getElementById("field-numero")?.focus(), 50);
      }
    } catch { /* ignora falha silenciosa */ }
    finally  { setIsFetchingCep(false); }
  }

  // ── Dados auxiliares ────────────────────────────────────────────────────────
  const { user } = useAuth();

  // Fonte real das tabelas/bancos: Financeiro → Tabelas (mesmo store usado em /financeiro/tabelas)
  const { data: financeiroConfig } = useQuery<{ dados: any } | null>({
    queryKey: ["/api/financeiro/config"],
  });
  const financeiroTabelas: any[] = financeiroConfig?.dados?.tabelas ?? [];
  const financeiroGrupos: any[]  = financeiroConfig?.dados?.grupos   ?? [];
  const financeiroCorretores: any[] = financeiroConfig?.dados?.corretores ?? [];

  // Parceiro (interno) — só operacional/master define no cadastro; corretor não vê
  const canSetParceiro = !!(user?.isMaster || ["master", "operacional"].includes(user?.role || ""));
  const [parceiroId, setParceiroId] = useState<string>("");
  const { data: partnersList = [] } = useQuery<any[]>({
    queryKey: ["/api/contracts/partners"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/partners", { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: canSetParceiro,
  });

  /** Mapeia contractType → "tipo" usado nas tabelas de Financeiro */
  function mapTipoContrato(t: string | null): string | null {
    switch (t) {
      case "NOVO": return "Novo";
      case "PORTABILIDADE":
      case "PORTABILIDADE_REFIN": return "Portabilidade";
      case "REFINANCIAMENTO": return "Refinanciamento";
      case "COMPRA_DIVIDA": return "Compra de Dívida";
      case "CARTAO": return "Cartão";
      default: return null;
    }
  }

  /** Tabelas filtradas por convênio + tipo de contrato */
  const tabelasDoTipo = (() => {
    const tipoAlvo = mapTipoContrato(contractType);
    const conv = selectedConvenio?.id || "";
    return financeiroTabelas.filter((t: any) => {
      const okConv = !conv || (t.convenio || "").toUpperCase() === conv.toUpperCase();
      const okTipo = !tipoAlvo || (t.tipo || "") === tipoAlvo;
      return okConv && okTipo;
    });
  })();

  /** Lista de bancos disponíveis dentro das tabelas filtradas */
  const banks: string[] = Array.from(new Set(tabelasDoTipo.map((t: any) => t.banco))).filter(Boolean).sort();

  // ── Form ────────────────────────────────────────────────────────────────────
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: "", clientCpf: "", clientMatricula: "",
      clientPhone: "", clientEmail: "",
      clientCep: "", clientLogradouro: "", clientNumero: "",
      clientComplemento: "", clientBairro: "", clientCidade: "", clientEstado: "",
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

  // Filtra tabelas pelo banco selecionado (já filtrado por convênio + tipo acima)
  const filteredTables: any[] = watchedBank
    ? tabelasDoTipo.filter((t: any) => t.banco === watchedBank)
    : tabelasDoTipo;

  const contractValNum = parseBrNumber(watchedContractValue) || 0;

  // ── Cálculo do repasse LÍQUIDO do corretor (sem expor pctEmpresa) ──────────
  const watchedTableId = form.watch("tableId");
  const selectedTabela = financeiroTabelas.find((t: any) => String(t.id) === String(watchedTableId));

  /** Grupo do usuário logado — busca por email no array de corretores */
  const myCorretor = financeiroCorretores.find(
    (c: any) => c.email && user?.email && c.email.toLowerCase() === user.email.toLowerCase()
  );
  const myGrupo = myCorretor
    ? financeiroGrupos.find((g: any) => g.id === myCorretor.grupoId)
    : null;

  /** Percentual de repasse: usa regra por tipo de produto se houver, senão o padrão do grupo */
  function getMyRepasseGrupo(tipo: string | null): number {
    if (!myGrupo) return 0;
    const rules = Array.isArray(myGrupo.repasseRules) ? myGrupo.repasseRules : [];
    if (tipo) {
      const rule = rules.find((r: any) => r.tipo === tipo);
      if (rule && typeof rule.repasse === "number") return rule.repasse;
    }
    return typeof myGrupo.repasse === "number" ? myGrupo.repasse : 0;
  }

  const myRepassePerc = getMyRepasseGrupo(mapTipoContrato(contractType));
  const pctCorretor   = selectedTabela ? (selectedTabela.pctEmpresa * myRepassePerc) / 100 : 0;
  const valCorretor   = (contractValNum * pctCorretor) / 100;

  // ── Mutation ────────────────────────────────────────────────────────────────
  // Faz upload dos anexos para uma proposta; surfaça falhas (não engole silenciosamente)
  async function uploadAttachments(proposalIdToUpload: number, atts: FileAttachment[]) {
    const results = await Promise.allSettled(
      atts.map((att) => {
        const fd = new FormData();
        fd.append("file", att.file);
        fd.append("documentType", att.documentType || "OUTRO");
        return fetch(`/api/contracts/proposals/${proposalIdToUpload}/documents`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
      })
    );
    let failed = 0;
    let firstErr = "";
    for (const r of results) {
      if (r.status === "rejected") {
        failed++;
        if (!firstErr) firstErr = String(r.reason?.message || r.reason || "falha de rede");
      } else if (!r.value.ok) {
        failed++;
        if (!firstErr) {
          try { firstErr = (await r.value.json())?.message || `HTTP ${r.value.status}`; }
          catch { firstErr = `HTTP ${r.value.status}`; }
        }
      }
    }
    if (failed > 0) {
      toast({
        title: `${failed} anexo(s) não enviado(s)`,
        description: firstErr || "Tente reanexar pela proposta.",
        variant: "destructive",
      });
    }
  }

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
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
                // Campos exclusivos de pensionistas
                ...(parsedData.nomeInstituidor      ? { nomeInstituidor:      parsedData.nomeInstituidor }      : {}),
                ...(parsedData.matriculaInstituidor ? { matriculaInstituidor: parsedData.matriculaInstituidor } : {}),
                ...(parsedData.naturezaPensao       ? { naturezaPensao:       parsedData.naturezaPensao }       : {}),
                ...(parsedData.inicioPensao         ? { inicioPensao:         parsedData.inicioPensao }         : {}),
                ...(parsedData.terminoPensao        ? { terminoPensao:        parsedData.terminoPensao }        : {}),
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
                  naturalidade:    docPhotoData.naturalidade,
                },
              }),
            }
          : undefined;

      const _res = await apiRequest("POST", "/api/contracts/proposals", {
        ...data,
        clientConvenio: selectedConvenio?.id,
        contractValue: parseBrNumber(data.contractValue),
        installmentValue: parseBrNumber(data.installmentValue),
        tableId: undefined, // FK aponta para coefficient_tables (legado) — não enviar; ID real fica em clientMeta
        term: data.term || undefined,
        ade: data.ade || undefined,
        parceiroId: canSetParceiro && parceiroId ? parceiroId : undefined,
        reuseDocIds: reusedDocs.length ? reusedDocs.map((d) => d.id) : undefined,
        // Comissões calculadas a partir da tabela do Financeiro (não digitadas pelo usuário)
        commissionPercentage: selectedTabela?.pctEmpresa
          ? selectedTabela.pctEmpresa / 100
          : undefined,
        corretorCommissionPercentage: myRepassePerc
          ? myRepassePerc / 100
          : undefined,
        clientMeta: {
          ...(clientMeta || {}),
          ...(contractType ? { tipoContrato: contractType } : {}),
          // Referência à tabela do financeiro config (ID do JSONB, não FK do banco)
          ...(data.tableId ? { tabelaFinanceiroId: data.tableId, tabelaNome: selectedTabela?.nome } : {}),
          // Contato
          ...(data.clientPhone ? { telefone: data.clientPhone } : {}),
          ...(data.clientEmail ? { email:    data.clientEmail } : {}),
          // Endereço
          ...(data.clientCep ? {
            endereco: {
              cep:         data.clientCep,
              logradouro:  data.clientLogradouro,
              numero:      data.clientNumero,
              complemento: data.clientComplemento || undefined,
              bairro:      data.clientBairro,
              cidade:      data.clientCidade,
              estado:      data.clientEstado,
            },
          } : {}),
          ...(data.bancoOrigem ? { bancoOrigem: data.bancoOrigem } : {}),
          ...(data.saldoDevedor ? { saldoDevedor: data.saldoDevedor } : {}),
          ...(data.prazoAtual ? { prazoAtual: data.prazoAtual } : {}),
          ...(extratoFile ? {
            extrato: {
              anexado: true,
              nomeArquivo: extratoFile.name,
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
      const proposal: any = await _res.json();

      // Upload dos anexos para a proposta criada
      if (attachments.length > 0 && proposal?.id) {
        await uploadAttachments(proposal.id, attachments);
      }

      return proposal;
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

  // ── Mutation em lote (Portabilidade) ────────────────────────────────────────
  const batchMutation = useMutation({
    mutationFn: async () => {
      const v = form.getValues();
      const sharedMeta: Record<string, any> = {};
      if (parsedData) {
        if (parsedData.identSiape)   sharedMeta.identSiape   = parsedData.identSiape;
        if (parsedData.uf)           sharedMeta.uf           = parsedData.uf;
        if (parsedData.orgao)        sharedMeta.orgao        = parsedData.orgao;
        if (parsedData.regJuridico)  sharedMeta.regJuridico  = parsedData.regJuridico;
        if (parsedData.bancoSalario) sharedMeta.bancoSalario = parsedData.bancoSalario;
        if (parsedData.agencia)      sharedMeta.agencia      = parsedData.agencia;
        if (parsedData.conta)        sharedMeta.conta        = parsedData.conta;
        if (parsedData.mesAno)       sharedMeta.mesAno       = parsedData.mesAno;
        if (parsedData.vinculo)      sharedMeta.vinculo      = parsedData.vinculo;
        if (parsedData.nomeInstituidor)      sharedMeta.nomeInstituidor      = parsedData.nomeInstituidor;
        if (parsedData.matriculaInstituidor) sharedMeta.matriculaInstituidor = parsedData.matriculaInstituidor;
        if (parsedData.naturezaPensao)       sharedMeta.naturezaPensao       = parsedData.naturezaPensao;
        if (parsedData.inicioPensao)         sharedMeta.inicioPensao         = parsedData.inicioPensao;
        if (parsedData.terminoPensao)        sharedMeta.terminoPensao        = parsedData.terminoPensao;
      }
      if (docPhotoData) {
        sharedMeta.docFoto = {
          tipo:           docPhotoData.tipo,
          nome:           docPhotoData.nome,
          numeroRegistro: docPhotoData.numeroRegistro,
          dataNascimento: docPhotoData.dataNascimento,
          dataExpedicao:  docPhotoData.dataExpedicao,
          orgaoEmissor:   docPhotoData.orgaoEmissor,
          filiacao:       docPhotoData.filiacao,
          cpf:            docPhotoData.cpf,
          naturalidade:   docPhotoData.naturalidade,
        };
      }
      if (v.clientPhone) sharedMeta.telefone = v.clientPhone;
      if (v.clientEmail) sharedMeta.email    = v.clientEmail;
      if (v.clientCep) {
        sharedMeta.endereco = {
          cep: v.clientCep, logradouro: v.clientLogradouro,
          numero: v.clientNumero, complemento: v.clientComplemento || undefined,
          bairro: v.clientBairro, cidade: v.clientCidade, estado: v.clientEstado,
        };
      }
      sharedMeta.tipoContrato = contractType || "PORTABILIDADE";
      if (simPortData?.banco_destino) sharedMeta.bancoDestinoGlobal = simPortData.banco_destino;

      const proposalsBatch = portContratos.map((c) => {
        const tabela = c.tableId
          ? financeiroTabelas.find((t: any) => String(t.id) === c.tableId)
          : null;
        return {
          clientName:      v.clientName,
          clientCpf:       v.clientCpf.replace(/\D/g, ""),
          clientMatricula: v.clientMatricula || null,
          clientConvenio:  selectedConvenio?.id,
          product:         contractType || "PORTABILIDADE",
          bank:            c.bancoDestino || simPortData?.banco_destino || null,
          installmentValue: parseFloat(c.novaParcela) || null,
          contractValue:    parseFloat(c.saldoDevedor) || null,
          term:             parseInt(c.novoPrazo) || null,
          parceiroId:      canSetParceiro && parceiroId ? parceiroId : undefined,
          clientMeta: {
            ...sharedMeta,
            ...(tabela ? { tabelaFinanceiroId: c.tableId, tabelaNome: tabela.nome } : {}),
            ...(c.banco           ? { bancoOrigem:      c.banco }                  : {}),
            ...(c.numeroContrato  ? { numeroContrato:   c.numeroContrato }         : {}),
            ...(c.parcelaAtual    ? { parcelaOriginal:  parseFloat(c.parcelaAtual) } : {}),
            ...(c.prazoAtual      ? { prazoAtual:       parseInt(c.prazoAtual) }   : {}),
            ...(c.prazoTotal      ? { prazoTotal:       parseInt(c.prazoTotal) }   : {}),
            ...(c.inicio          ? { inicioContrato:   c.inicio }                 : {}),
            ...(c.fim             ? { fimContrato:      c.fim }                    : {}),
            ...(c.taxa            ? { taxa:             parseFloat(c.taxa) }       : {}),
            ...(c.troco           ? { troco:            parseFloat(c.troco) }      : {}),
            ...(c.novoPrazo       ? { novoPrazo:        parseInt(c.novoPrazo) }    : {}),
          },
        };
      });

      const _batchRes = await apiRequest("POST", "/api/contracts/proposals/batch", { proposals: proposalsBatch });
      const created: any[] = await _batchRes.json();

      // Upload dos anexos para cada proposta criada
      if (attachments.length > 0 && created.length > 0) {
        for (const proposal of created) {
          await uploadAttachments(proposal.id, attachments);
        }
      }

      return created;
    },
    onSuccess: (data: any[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals"] });
      toast({ title: `${data.length} proposta(s) de portabilidade cadastrada(s)!` });
      setLocation("/contratos");
    },
    onError: (e: any) => {
      toast({ title: "Erro ao cadastrar propostas", description: e.message, variant: "destructive" });
    },
  });

  // ── Helpers de portabilidade ─────────────────────────────────────────────────

  function makePortUid() {
    return Math.random().toString(36).slice(2, 9);
  }

  function handleSimPort(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sim: SimulacaoPort = JSON.parse(e.target?.result as string);
        setSimPortFile(file);
        setSimPortData(sim);

        // Bancos disponíveis nas tabelas de Portabilidade para este convênio
        const conv = selectedConvenio?.id || "";
        const availBanks = new Set<string>(
          financeiroTabelas
            .filter((t: any) => t.tipo === "Portabilidade" &&
              (!t.convenio || t.convenio.toUpperCase() === conv.toUpperCase()))
            .map((t: any) => t.banco as string)
            .filter(Boolean)
        );
        const rawBd = sim.banco_destino || "";
        const bdPort = availBanks.has(rawBd) ? rawBd : "";

        let novos: PortabilidadeContrato[] = [];

        if (sim.contratos && sim.contratos.length > 0) {
          // Formato novo (exportarParaDigitacao)
          novos = sim.contratos.map((c) => ({
            uid:            makePortUid(),
            source:         "extrato" as const,
            banco:          c.banco,
            numeroContrato: c.numero_contrato || "",
            parcelaAtual:   c.parcela_atual   ? String(c.parcela_atual)  : "",
            prazoAtual:     c.prazo_restante  ? String(c.prazo_restante) : "",
            prazoTotal:     c.prazo_total     ? String(c.prazo_total)    : "",
            inicio:         "",
            fim:            "",
            taxa:           c.taxa_atual      ? String(c.taxa_atual)     : "",
            saldoDevedor:   c.saldo_devedor   ? String(c.saldo_devedor)  : "",
            bancoDestino:   bdPort,
            novaParcela:    c.nova_parcela    ? String(c.nova_parcela)   : "",
            troco:          c.troco           ? String(c.troco)          : "0",
            novoPrazo:      c.prazo_novo      ? String(c.prazo_novo)     : "",
          }));
        } else if (sim.contratos_selecionados && sim.contratos_selecionados.length > 0) {
          // Formato antigo (salvarCotacao): contratos_selecionados + resultado.linhas
          novos = sim.contratos_selecionados.map((c, i) => {
            const linha = sim.resultado?.linhas?.[i];
            return {
              uid:            makePortUid(),
              source:         "extrato" as const,
              banco:          c.banco,
              numeroContrato: c.numeroContrato || "",
              parcelaAtual:   c.parcela ? String(c.parcela) : "",
              prazoAtual:     c.prazo   ? String(c.prazo)   : "",
              prazoTotal:     "",
              inicio:         "",
              fim:            "",
              taxa:           c.taxa    ? String(c.taxa)    : "",
              saldoDevedor:   c.saldo   ? String(Math.round(c.saldo * 100) / 100) : "",
              bancoDestino:   bdPort,
              novaParcela:    linha?.parcela ? String(Math.round(linha.parcela * 100) / 100) : "",
              troco:          linha?.troco   ? String(linha.troco) : "0",
              novoPrazo:      linha?.prazo   ? String(linha.prazo) : "",
            };
          });
        }

        if (novos.length > 0) {
          setPortContratos((prev) => {
            const manual = prev.filter((c) => c.source === "manual");
            return [...novos, ...manual];
          });
        } else {
          toast({ title: "Nenhum contrato encontrado no arquivo.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Arquivo inválido. Exporte novamente do simulador.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  }

  function updatePortContrato(uid: string, field: keyof PortabilidadeContrato, value: string) {
    setPortContratos((prev) => prev.map((c) => c.uid === uid ? { ...c, [field]: value } : c));
  }

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

    // Lookup por CPF — reutiliza se já foi feito no upload do documento
    let existing: ClientLookup | null = clientLookup;
    if (!existing && parsedData.cpf) {
      existing = await lookupByCpf(parsedData.cpf);
    }

    // Detecta divergência de nome entre contracheque e documento com foto
    const alert = detectNameAlert(parsedData.nome || undefined, docPhotoData?.nome ?? null);
    setNameAlert(alert);

    const nome      = parsedData.nome      || existing?.clientName      || "";
    const matricula = parsedData.matricula || existing?.clientMatricula || "";
    const meta      = existing?.clientMeta ?? {};
    const end       = meta.endereco ?? {};

    form.reset({
      clientName:       nome,
      clientCpf:        parsedData.cpf ? formatCpf(parsedData.cpf) : "",
      clientMatricula:  matricula,
      // Contato — reutiliza do cadastro anterior se disponível
      clientPhone:      meta.telefone ?? "",
      clientEmail:      meta.email    ?? "",
      // Endereço — reutiliza do cadastro anterior se disponível
      clientCep:        end.cep         ?? "",
      clientLogradouro: end.logradouro  ?? "",
      clientNumero:     end.numero      ?? "",
      clientComplemento:end.complemento ?? "",
      clientBairro:     end.bairro      ?? "",
      clientCidade:     end.cidade      ?? "",
      clientEstado:     end.estado      ?? "",
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

  function handleExtratoFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setExtratoError("Por favor selecione um arquivo PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setExtratoError("Arquivo muito grande (máx. 20MB).");
      return;
    }
    setExtratoFile(file);
    setExtratoError(null);
    // Adiciona aos documentos automaticamente
    setAttachments((prev) => {
      const filtered = prev.filter((a) => a.documentType !== "EXTRATO_CONSIGNACOES");
      return [...filtered, { file, documentType: "EXTRATO_CONSIGNACOES" }];
    });
  }

  // ─── STEP 0 — CPF do cliente (primeiro passo: reaproveitar cadastro) ──────────
  async function doCpfSearch() {
    const digits = cpfInput.replace(/\D/g, "");
    if (digits.length !== 11) return;
    setCpfSearched(true);
    await lookupByCpf(digits);
  }

  function goToConvenioFresh() {
    setReusedDocs([]); // cadastrar do zero — não reaproveita documentos
    setStep("convenio");
  }

  function handleReuseClient() {
    if (!clientLookup) return;
    const meta = clientLookup.clientMeta ?? {};
    const end = meta.endereco ?? {};
    // parsedData sintético do cadastro salvo → o submit reaproveita os dados SIAPE
    setParsedData({
      cpf: (clientLookup.clientCpf || cpfInput).replace(/\D/g, ""),
      nome: clientLookup.clientName || "",
      matricula: clientLookup.clientMatricula || "",
      identSiape: meta.identSiape, uf: meta.uf, orgao: meta.orgao,
      regJuridico: meta.regJuridico, bancoSalario: meta.bancoSalario,
      agencia: meta.agencia, conta: meta.conta, mesAno: meta.mesAno,
      vinculo: meta.vinculo, nomeInstituidor: meta.nomeInstituidor,
      matriculaInstituidor: meta.matriculaInstituidor, naturezaPensao: meta.naturezaPensao,
      inicioPensao: meta.inicioPensao, terminoPensao: meta.terminoPensao,
    } as any);
    if (meta.docFoto?.tipo) {
      setDocPhotoData(meta.docFoto as DocPhotoData); // dados do documento sem nova IA
      setDocPhotoSource("cached");
    }
    setReusedDocs(clientLookup.documents ?? []); // arquivos exibidos e linkados ao salvar
    const conv = CONVENIOS.find((c) => c.id === clientLookup.clientConvenio) || CONVENIOS.find((c) => c.id === "SIAPE");
    if (conv) setSelectedConvenio(conv);
    form.reset({
      clientName: clientLookup.clientName || "",
      clientCpf: formatCpf((clientLookup.clientCpf || cpfInput).replace(/\D/g, "")),
      clientMatricula: clientLookup.clientMatricula || "",
      clientPhone: meta.telefone ?? "",
      clientEmail: meta.email ?? "",
      clientCep: end.cep ?? "", clientLogradouro: end.logradouro ?? "",
      clientNumero: end.numero ?? "", clientComplemento: end.complemento ?? "",
      clientBairro: end.bairro ?? "", clientCidade: end.cidade ?? "", clientEstado: end.estado ?? "",
      bank: "", product: "", tableId: "", contractValue: "", installmentValue: "", term: "",
      ade: "", commissionPercentage: "", corretorCommissionPercentage: "",
    });
    setStep("dados-cadastrais");
  }

  if (step === "cpf") {
    const digits = cpfInput.replace(/\D/g, "");
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => setLocation("/contratos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Nova Proposta</h1>
            <p className="text-sm text-muted-foreground">Informe o CPF do cliente</p>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <div>
            <label className="text-sm font-medium">CPF do cliente</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={cpfInput}
                onChange={(e) => { setCpfInput(formatCpf(e.target.value.replace(/\D/g, ""))); setCpfSearched(false); setClientLookup(null); }}
                placeholder="000.000.000-00"
                inputMode="numeric"
                onKeyDown={(e) => { if (e.key === "Enter" && digits.length === 11) doCpfSearch(); }}
              />
              <Button disabled={digits.length !== 11 || isLookingUp} onClick={doCpfSearch}>
                {isLookingUp ? "Buscando..." : "Buscar"}
              </Button>
            </div>
            {!cpfSearched && (
              <p className="text-xs text-muted-foreground mt-2">
                Verificamos se o cliente já tem cadastro e documentos no sistema, para reaproveitar e evitar nova leitura por IA e novo upload.
              </p>
            )}
          </div>

          {cpfSearched && !isLookingUp && clientLookup && (
            <div className="rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-semibold text-sm">Cliente já cadastrado</span>
              </div>
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Nome: </span><span className="font-medium">{clientLookup.clientName}</span></div>
                {clientLookup.clientConvenio && <div><span className="text-muted-foreground">Convênio: </span><span className="font-medium">{clientLookup.clientConvenio}</span></div>}
                <div><span className="text-muted-foreground">Propostas anteriores: </span><span className="font-medium">{clientLookup.proposalCount}</span></div>
                {!!clientLookup.documents?.length && (
                  <div>
                    <span className="text-muted-foreground">Documentos no cadastro: </span>
                    <span className="font-medium">{clientLookup.documents.length}</span>
                    <ul className="mt-1 ml-1 text-xs text-muted-foreground list-disc list-inside">
                      {clientLookup.documents.slice(0, 6).map((d) => <li key={d.id}>{d.fileName}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={handleReuseClient} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Reaproveitar dados e documentos
                </Button>
                <Button variant="outline" onClick={goToConvenioFresh}>Cadastrar do zero</Button>
              </div>
              <p className="text-xs text-muted-foreground">Reaproveitar pula a leitura por IA e o novo upload — você confirma/edita os dados na próxima etapa.</p>
            </div>
          )}

          {cpfSearched && !isLookingUp && !clientLookup && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm">Nenhum cadastro encontrado para este CPF — cliente novo.</p>
              <Button onClick={goToConvenioFresh}>Continuar →</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── STEP 1 — Seleção de Convênio ─────────────────────────────────────────

  if (step === "convenio") {
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => setStep("cpf")}>
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
              <div className={`mb-3 inline-flex items-center justify-center h-10 w-10 rounded-lg bg-muted ${conv.iconColor}`}>
                <conv.Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
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
    // Gera URL de preview (imagem direta; PDF → renderiza 1ª página)
    async function makePreview(file: File): Promise<string> {
      if (isPdf(file)) return URL.createObjectURL(await renderPdfFirstPageToBlob(file));
      return URL.createObjectURL(file);
    }

    // Handler para frente do documento com foto (imagem ou PDF)
    async function handleFrenteFile(file: File) {
      if (!file.type.startsWith("image/") && !isPdf(file)) {
        setOcrError("Por favor selecione uma imagem ou PDF.");
        return;
      }
      let preview: string;
      try { preview = await makePreview(file); }
      catch { setOcrError("Não foi possível ler o PDF. Tente outro arquivo."); return; }
      setDocFrenteFile(file);
      setDocFrentePreview(preview);
      setDocPhotoData(null);
      setDocPhotoSource(null);
      setOcrError(null);
      // Verifica cache / dispara IA se verso já estiver carregado
      if (docVersoFile) handleBothImagesReady(file, docVersoFile);
    }

    async function handleVersoFile(file: File) {
      if (!file.type.startsWith("image/") && !isPdf(file)) {
        setOcrError("Por favor selecione uma imagem ou PDF.");
        return;
      }
      let preview: string;
      try { preview = await makePreview(file); }
      catch { setOcrError("Não foi possível ler o PDF. Tente outro arquivo."); return; }
      setDocVersoFile(file);
      setDocVersoPreview(preview);
      setDocPhotoData(null);
      setDocPhotoSource(null);
      setOcrError(null);
      // Verifica cache / dispara IA se frente já estiver carregada
      if (docFrenteFile) handleBothImagesReady(docFrenteFile, file);
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
            accept="image/*,application/pdf,.pdf"
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
                onRemove={() => { setDocFrenteFile(null); setDocFrentePreview(null); setDocPhotoData(null); setDocPhotoSource(null); setOcrError(null); }}
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
                onRemove={() => { setDocVersoFile(null); setDocVersoPreview(null); setDocPhotoData(null); setDocPhotoSource(null); setOcrError(null); }}
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
                <span>{ocrError}</span>
              </div>
            )}

            {/* Preenchimento manual do documento (fallback do OCR) — inputs sempre editáveis */}
            {docPhotoData && docPhotoSource === "manual" && (
              <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/10 p-3 space-y-3">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                  Preencha os dados do documento
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2.5">
                  {renderManualInput("nome", "Nome", docPhotoData.nome, true)}
                  {renderManualInput("cpf", "CPF", docPhotoData.cpf)}
                  {renderManualInput("numeroRegistro", "Nº Registro (RG/CNH)", docPhotoData.numeroRegistro)}
                  {renderManualInput("dataNascimento", "Nascimento", docPhotoData.dataNascimento)}
                  {renderManualInput("dataExpedicao", "Expedição", docPhotoData.dataExpedicao)}
                  {renderManualInput("orgaoEmissor", "Órgão Emissor", docPhotoData.orgaoEmissor)}
                  {renderManualInput("naturalidade", "Naturalidade", docPhotoData.naturalidade)}
                  {renderManualInput("filiacaoPai", "Filiação — Pai", docPhotoData.filiacao?.[0], true)}
                  {renderManualInput("filiacaoMae", "Filiação — Mãe", docPhotoData.filiacao?.[1], true)}
                </div>
              </div>
            )}

            {/* Dados do documento (OCR ou cache de proposta anterior) */}
            {docPhotoData && docPhotoSource !== "manual" && !isOcring && (
              <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {docPhotoData.tipo === "CNH" ? "CNH" : docPhotoData.tipo === "RG" ? "RG" : "Documento"}
                    {docPhotoSource === "cached" ? " — dados do cadastro anterior" : " lido"}
                  </p>
                  {docPhotoSource === "cached" && docFrenteFile && (
                    <button
                      type="button"
                      className="text-xs text-purple-600 dark:text-purple-400 underline underline-offset-2 hover:opacity-70 shrink-0"
                      onClick={() => {
                        setDocPhotoSource("ocr");
                        runDocOcr(docFrenteFile, docVersoFile);
                      }}
                    >
                      Ler novamente com IA
                    </button>
                  )}
                </div>
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


      {/* Alerta de divergência de nome entre contracheque e documento */}
      {nameAlert && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <span>{nameAlert}</span>
        </div>
      )}

      {/* Parceiro (interno — só operacional/master; corretor não vê) */}
      {canSetParceiro && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-1.5">Parceiro <span className="text-xs font-normal text-muted-foreground">(interno — por onde foi cadastrado)</span></p>
            <Select value={parceiroId || "none"} onValueChange={(v) => setParceiroId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Selecionar parceiro..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— nenhum —</SelectItem>
                {partnersList.filter((p: any) => p.isActive).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
          className="space-y-4"
        >
          {/* ── Dados do Cliente ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Nome — linha inteira */}
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-4">
                    <FormLabel>
                      Nome completo *
                      {hasExtracted && parsedData?.nome && <CheckIcon />}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do cliente" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* CPF */}
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
                          if (!hasExtracted) {
                            const found = await lookupByCpf(e.target.value);
                            if (found) {
                              if (!form.getValues("clientName") && found.clientName)
                                form.setValue("clientName", found.clientName);
                              if (!form.getValues("clientMatricula") && found.clientMatricula)
                                form.setValue("clientMatricula", found.clientMatricula);
                              const m = found.clientMeta ?? {};
                              const en = m.endereco ?? {};
                              if (!form.getValues("clientPhone") && m.telefone)
                                form.setValue("clientPhone", m.telefone);
                              if (!form.getValues("clientEmail") && m.email)
                                form.setValue("clientEmail", m.email);
                              if (!form.getValues("clientCep") && en.cep) {
                                form.setValue("clientCep",         en.cep);
                                form.setValue("clientLogradouro",  en.logradouro  ?? "");
                                form.setValue("clientNumero",      en.numero      ?? "");
                                form.setValue("clientComplemento", en.complemento ?? "");
                                form.setValue("clientBairro",      en.bairro      ?? "");
                                form.setValue("clientCidade",      en.cidade      ?? "");
                                form.setValue("clientEstado",      en.estado      ?? "");
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
              {/* Matrícula */}
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
                      <Input {...field} placeholder="Nº de matrícula" />
                    </FormControl>
                  </FormItem>
                )}
              />
              {/* Telefone */}
              <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="(11) 99999-9999"
                        onChange={(e) => field.onChange(formatPhone(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* E-mail */}
              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail *</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="cliente@email.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Dados do Documento com Foto (campos sempre editáveis) ── */}
          {docPhotoData && (
            <Card className="border-purple-200 dark:border-purple-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-purple-700 dark:text-purple-400">
                  <CreditCard className="h-4 w-4" />
                  {docPhotoData.tipo === "CNH" ? "CNH" : docPhotoData.tipo === "RG" ? "RG" : "Documento com Foto"}
                  <span className="text-xs font-normal text-muted-foreground">(corrija se necessário)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2.5">
                  {renderManualInput("nome", "Nome", docPhotoData.nome, true)}
                  {renderManualInput("cpf", "CPF", docPhotoData.cpf)}
                  {renderManualInput("numeroRegistro", "Nº Registro", docPhotoData.numeroRegistro)}
                  {renderManualInput("dataNascimento", "Nascimento", docPhotoData.dataNascimento)}
                  {renderManualInput("dataExpedicao", "Expedição", docPhotoData.dataExpedicao)}
                  {renderManualInput("orgaoEmissor", "Órgão Emissor", docPhotoData.orgaoEmissor)}
                  {renderManualInput("naturalidade", "Naturalidade", docPhotoData.naturalidade)}
                  {renderManualInput("filiacaoPai", "Filiação — Pai", docPhotoData.filiacao?.[0], true)}
                  {renderManualInput("filiacaoMae", "Filiação — Mãe", docPhotoData.filiacao?.[1], true)}
                </div>
              </CardContent>
            </Card>
          )}

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
                  {parsedData.naturezaPensao && (
                    <InfoField label="Natureza da Pensão" value={parsedData.naturezaPensao} />
                  )}
                  {parsedData.inicioPensao && (
                    <InfoField label="Início da Pensão" value={parsedData.inicioPensao} />
                  )}
                  {parsedData.terminoPensao && (
                    <InfoField label="Término da Pensão" value={parsedData.terminoPensao} />
                  )}
                  {parsedData.nomeInstituidor && (
                    <InfoField label="Instituidor" value={parsedData.nomeInstituidor} wide />
                  )}
                  {parsedData.matriculaInstituidor && (
                    <InfoField label="Matríc. Instituidor" value={parsedData.matriculaInstituidor} />
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

          {/* ── Endereço ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FormField
                control={form.control}
                name="clientCep"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-baseline justify-between gap-2">
                      <FormLabel>CEP *</FormLabel>
                      <button
                        type="button"
                        onClick={() => setCepSearchOpen(true)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Search className="h-3 w-3" />
                        Não sei o CEP
                      </button>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder="00000-000"
                          onChange={(e) => {
                            const v = formatCep(e.target.value);
                            field.onChange(v);
                            const digits = v.replace(/\D/g, "");
                            if (digits.length === 8) fetchCep(v);
                          }}
                          onBlur={(e) => { field.onBlur(); fetchCep(e.target.value); }}
                        />
                        {isFetchingCep && (
                          <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientLogradouro"
                render={({ field }) => (
                  <FormItem className="sm:col-span-1 lg:col-span-2">
                    <FormLabel>Logradouro *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Rua, Av., Trav..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientNumero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número *</FormLabel>
                    <FormControl>
                      <Input id="field-numero" {...field} placeholder="123" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientComplemento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Apto, Bloco..." />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientBairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Bairro" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientCidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Cidade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientEstado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="RJ" maxLength={2} className="uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

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

              {reusedDocs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                    Reaproveitados do cadastro anterior ({reusedDocs.length})
                  </p>
                  {reusedDocs.map((d) => (
                    <div
                      key={`reuse-${d.id}`}
                      className="flex items-center gap-3 p-3 rounded-md border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/10"
                    >
                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span className="text-sm flex-1 truncate">{d.fileName}</span>
                      <a
                        href={`/api/contracts/documents/${d.id}/file`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                      <Button
                        size="icon" variant="ghost" type="button"
                        title="Não reaproveitar este"
                        onClick={() => setReusedDocs((prev) => prev.filter((x) => x.id !== d.id))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

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
                        title="Visualizar"
                        onClick={() => openAttachmentPreview(att.file)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" type="button"
                        title="Remover"
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
                const valid = await form.trigger([
                  "clientName", "clientCpf",
                  "clientPhone", "clientEmail",
                  "clientCep", "clientLogradouro", "clientNumero",
                  "clientBairro", "clientCidade", "clientEstado",
                ]);
                if (!valid) {
                  // Foca o primeiro campo com erro para ajudar o usuário
                  const firstError = Object.keys(form.formState.errors)[0];
                  if (firstError) {
                    document.querySelector<HTMLInputElement>(`input[name="${firstError}"]`)?.focus();
                  }
                  return;
                }

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

      {/* ── Preview de anexo ── */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => { if (!open) closeAttachmentPreview(); }}>
        <DialogContent className="max-w-5xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-3 pb-2 shrink-0 border-b flex-row items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base flex-1 min-w-0">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{previewAttachment?.file.name}</span>
            </DialogTitle>
            {previewAttachment && (
              <a
                href={previewAttachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline shrink-0 mr-6"
              >
                Abrir em nova aba ↗
              </a>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-2 min-h-[60vh]">
            {previewAttachment && (() => {
              const f = previewAttachment.file;
              const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
              const isImg = f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(f.name);
              if (isPdf) {
                return (
                  <object
                    data={previewAttachment.url}
                    type="application/pdf"
                    className="w-full h-[78vh] bg-white"
                  >
                    <div className="text-center p-8">
                      <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-3">
                        Seu navegador bloqueou a visualização inline.
                      </p>
                      <a
                        href={previewAttachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                      >
                        Abrir PDF em nova aba ↗
                      </a>
                    </div>
                  </object>
                );
              }
              if (isImg) {
                return (
                  <img
                    src={previewAttachment.url}
                    alt={f.name}
                    className="max-w-full max-h-[78vh] object-contain"
                  />
                );
              }
              return (
                <div className="text-center p-8">
                  <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">Pré-visualização não disponível para este tipo de arquivo.</p>
                  <a
                    href={previewAttachment.url}
                    download={f.name}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Baixar arquivo
                  </a>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Buscador de CEP por endereço ── */}
      <Dialog open={cepSearchOpen} onOpenChange={setCepSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Buscar CEP pelo endereço
            </DialogTitle>
            <DialogDescription>
              Informe UF, cidade e parte do nome da rua para localizar o CEP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="text-xs font-medium block mb-1">UF</label>
                <Input
                  value={cepSearchUf}
                  onChange={(e) => setCepSearchUf(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="RJ"
                  maxLength={2}
                  className="uppercase"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-medium block mb-1">Cidade</label>
                <Input
                  value={cepSearchCidade}
                  onChange={(e) => setCepSearchCidade(e.target.value)}
                  placeholder="Rio de Janeiro"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="text-xs font-medium block mb-1">Logradouro (parte do nome)</label>
                <Input
                  value={cepSearchLogradouro}
                  onChange={(e) => setCepSearchLogradouro(e.target.value)}
                  placeholder="Av. das Américas"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchCepByAddress(); } }}
                />
              </div>
            </div>

            {cepSearchError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {cepSearchError}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={searchCepByAddress} disabled={cepSearchLoading}>
                {cepSearchLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" /> Buscar</>
                )}
              </Button>
            </div>

            {cepSearchResults.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto rounded-lg border bg-card p-1">
                <p className="text-xs text-muted-foreground px-2 pt-1">
                  {cepSearchResults.length} resultado{cepSearchResults.length !== 1 ? "s" : ""} — clique para selecionar:
                </p>
                {cepSearchResults.map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => pickCepResult(r)}
                    className="w-full text-left rounded-md p-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    <p className="text-sm font-medium">{r.logradouro}{r.complemento ? ` — ${r.complemento}` : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.bairro} · {r.localidade}/{r.uf} · <span className="font-mono">{r.cep}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

  if (step === "tipo-contrato") return (
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
      <StepIndicator current="tipo-contrato" steps={(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") ? WIZARD_STEPS_PORT : WIZARD_STEPS_DEFAULT} />

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
            <div className={`mb-2 inline-flex items-center justify-center h-9 w-9 rounded-lg bg-muted ${ct.iconColor}`}>
              <ct.Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className={`font-semibold text-sm ${contractType === ct.id ? "text-primary" : ""}`}>
              {ct.label}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{ct.description}</div>
          </button>
        ))}
      </div>

      {/* ── Upload do Extrato de Consignações (SIAPE) — não mostra para Portabilidade, que tem step próprio ── */}
      {selectedConvenio?.id === "SIAPE" && contractType && contractType !== "PORTABILIDADE" && (
        <div className="space-y-3 max-w-4xl">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold">Extrato de Consignações</span>
            <Badge variant="outline" className="text-xs">SIAPE obrigatório</Badge>
          </div>

          {extratoFile ? (
            /* ── Estado: arquivo anexado ── */
            <div className="rounded-xl border-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                      Extrato anexado
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{extratoFile.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExtratoFile(null);
                    setAttachments((prev) => prev.filter((a) => a.documentType !== "EXTRATO_CONSIGNACOES"));
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Remover
                </button>
              </div>
            </div>
          ) : (
            /* ── Estado: drop zone ── */
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                extratoDrag
                  ? "border-primary bg-primary/5"
                  : extratoError
                  ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                  : "border-border hover:border-primary hover:bg-primary/5"
              }`}
              onDragOver={(e) => { e.preventDefault(); setExtratoDrag(true); }}
              onDragLeave={() => setExtratoDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setExtratoDrag(false);
                if (e.dataTransfer.files[0]) handleExtratoFile(e.dataTransfer.files[0]);
              }}
              onClick={() => extratoRef.current?.click()}
            >
              <input
                ref={extratoRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleExtratoFile(e.target.files[0]); }}
              />
              {extratoError ? (
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
      {/* Campos só aparecem se: não for NOVO+SIAPE sem extrato, e não for PORTABILIDADE (que tem step próprio) */}
      {contractType && contractType !== "PORTABILIDADE" && (selectedConvenio?.id !== "SIAPE" || contractType !== "NOVO" || extratoFile !== null) && (
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
                              form.setValue("tableId", "");
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecione o banco..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {banks.map((b) => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
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

                {/* ── Tabela (filtrada por convênio + tipo + banco; oculta em cartão) ── */}
                {contractType !== "CARTAO" && (
                  <FormField
                    control={form.control}
                    name="tableId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Tabela
                          {!watchedBank && (
                            <span className="text-xs font-normal text-muted-foreground ml-1">(selecione o banco primeiro)</span>
                          )}
                        </FormLabel>
                        <Select
                          value={field.value}
                          disabled={!watchedBank}
                          onValueChange={(v) => {
                            field.onChange(v);
                            const tbl = filteredTables.find((t: any) => String(t.id) === v);
                            if (tbl?.prazo) form.setValue("term", String(tbl.prazo));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={
                                watchedBank && filteredTables.length === 0
                                  ? "Nenhuma tabela para este banco"
                                  : "Selecione..."
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredTables.map((t: any) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.nome}
                                {t.prazo ? ` · ${t.prazo}m` : ""}
                                {t.coef ? ` · coef ${Number(t.coef).toFixed(5).replace(".", ",")}` : ""}
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

                {/* ── Valor Liberado / Valor Saque / Troco ── (cálculo bidirecional com coef) */}
                <FormField
                  control={form.control}
                  name="contractValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        {contractType === "CARTAO" ? "Valor do Saque (R$)"
                          : contractType === "PORTABILIDADE_REFIN" ? "Troco / Refinanciamento (R$)"
                          : "Valor Liberado (R$)"}
                        {selectedTabela?.coef > 0 && (
                          <span className="text-[10px] font-normal text-muted-foreground">
                            coef {Number(selectedTabela.coef).toFixed(5).replace(".", ",")}
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="0,00"
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            const coef = selectedTabela?.coef;
                            if (coef && coef > 0) {
                              const val = parseBrNumber(e.target.value);
                              if (val && val > 0) {
                                form.setValue("installmentValue", formatBRNumber(val * coef));
                              } else {
                                form.setValue("installmentValue", "");
                              }
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* ── Parcela ── (cálculo bidirecional com coef) */}
                <FormField
                  control={form.control}
                  name="installmentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN")
                          ? "Nova Parcela (R$)"
                          : "Valor da Parcela (R$)"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="0,00"
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            const coef = selectedTabela?.coef;
                            if (coef && coef > 0) {
                              const parc = parseBrNumber(e.target.value);
                              if (parc && parc > 0) {
                                form.setValue("contractValue", formatBRNumber(parc / coef));
                              } else {
                                form.setValue("contractValue", "");
                              }
                            }
                          }}
                        />
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
            {/* ── Comissão do corretor (apenas % e R$ líquidos — sem expor pctEmpresa) ── */}
            {selectedTabela && (
              <Card className="border-green-200 dark:border-green-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                    <BadgePercent className="h-4 w-4" />
                    Sua Comissão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {myGrupo ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">% Repasse Corretor</p>
                        <div className="h-10 px-3 flex items-center rounded-md border bg-green-50 dark:bg-green-950/30 text-sm font-semibold text-green-700 dark:text-green-400">
                          {pctCorretor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">R$ Comissão Corretor</p>
                        <div className="h-10 px-3 flex items-center rounded-md border bg-green-50 dark:bg-green-950/30 text-sm font-semibold text-green-700 dark:text-green-400">
                          {fmtBRL(valCorretor)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-800 dark:text-amber-300">
                      <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        Seu usuário ainda não está vinculado a um grupo de comissão.
                        Peça ao administrador para cadastrá-lo em <strong>Financeiro → Configurações</strong>.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-3 pb-4">
              <Button type="button" variant="outline" onClick={() => setStep("dados-cadastrais")}>
                Voltar
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  // Validações mínimas antes de avançar para conferência
                  const okBank = !!form.getValues("bank");
                  const okValor = parseBrNumber(form.getValues("contractValue") || "") > 0;
                  const okParc  = parseBrNumber(form.getValues("installmentValue") || "") > 0;
                  if (!okBank) {
                    toast({ title: "Selecione o banco", variant: "destructive" });
                    return;
                  }
                  if (contractType !== "CARTAO" && !form.getValues("tableId")) {
                    toast({ title: "Selecione a tabela", variant: "destructive" });
                    return;
                  }
                  if (!okValor || !okParc) {
                    toast({ title: "Informe os valores (liberado e parcela)", variant: "destructive" });
                    return;
                  }
                  setStep("conferencia");
                }}
              >
                Conferência →
              </Button>
            </div>
          </form>
        </Form>
      )}

      {/* ── Portabilidade: avançar para step de contratos ── */}
      {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") && (
        <div className="space-y-4 max-w-4xl">
          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="flex items-start gap-3">
              <ArrowLeftRight className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Portabilidade em lote</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No próximo passo você informa os contratos a portar.
                  Cada contrato gerará uma proposta separada.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-between pb-4">
            <Button type="button" variant="outline" onClick={() => setStep("dados-cadastrais")}>
              Voltar
            </Button>
            <Button type="button" onClick={() => setStep("contratos-portabilidade")}>
              Contratos →
              {portContratos.length > 0 && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">{portContratos.length}</span>
              )}
            </Button>
          </div>
        </div>
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

  // ─── STEP 4.5 — Contratos de Portabilidade ───────────────────────────────
  if (step === "contratos-portabilidade") {
    const isSiapeConv = selectedConvenio?.id === "SIAPE";
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => setStep("tipo-contrato")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Contratos para Portabilidade</h1>
              {selectedConvenio && <Badge variant="outline">{selectedConvenio.label}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">Selecione os contratos a portar</p>
          </div>
        </div>

        <StepIndicator current="contratos-portabilidade" steps={WIZARD_STEPS_PORT} />

        {/* ── Uploads ── */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {/* Extrato de Consignações — apenas como documentação (sem parsing) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Extrato de Consignações
                <Badge variant="outline" className="text-xs ml-auto">PDF · obrigatório</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {extratoFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="flex-1 truncate text-green-700 dark:text-green-400">{extratoFile.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" type="button"
                    onClick={() => {
                      setExtratoFile(null);
                      setAttachments((prev) => prev.filter((a) => a.documentType !== "EXTRATO_CONSIGNACOES"));
                    }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => extratoRef.current?.click()}
                >
                  <input ref={extratoRef} type="file" accept="application/pdf" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleExtratoFile(e.target.files[0]); e.target.value = ""; }} />
                  <FileText className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Necessário para documentação no banco</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cotação JSON exportada pelo simulador */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Coins className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                Cotação do Simulador
                <Badge variant="outline" className="text-xs ml-auto">JSON</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {simPortFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="flex-1 truncate text-green-700 dark:text-green-400">{simPortFile.name}</span>
                  {simPortData?.banco_destino && (
                    <span className="text-xs text-muted-foreground shrink-0">→ {simPortData.banco_destino}</span>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" type="button"
                    onClick={() => { setSimPortFile(null); setSimPortData(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => simPortRef.current?.click()}
                >
                  <input ref={simPortRef} type="file" accept="application/json,.json" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleSimPort(e.target.files[0]); e.target.value = ""; }} />
                  <Coins className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">JSON exportado pelo Simulador de Portabilidade</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Tabela de contratos ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Contratos
                {portContratos.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">— {portContratos.length}</span>
                )}
              </CardTitle>
              <Button size="sm" variant="outline" type="button"
                onClick={() => setPortContratos((prev) => [...prev, {
                  uid: makePortUid(), source: "manual",
                  banco: "", numeroContrato: "",
                  parcelaAtual: "", prazoAtual: "", prazoTotal: "",
                  inicio: "", fim: "",
                  taxa: "", saldoDevedor: "",
                  bancoDestino: simPortData?.banco_destino || "",
                  novaParcela: "", troco: "",
                  novoPrazo: simPortData?.contratos?.[0]?.prazo_novo
                    ? String(simPortData.contratos[0].prazo_novo) : "",
                }])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Manual
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {portContratos.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Importe a cotação do simulador ou adicione contratos manualmente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Banco Origem</th>
                      <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Nº Contrato</th>
                      <th className="text-right py-2 pr-2 font-medium text-muted-foreground">Parc. Atual</th>
                      <th className="text-right py-2 pr-2 font-medium text-muted-foreground">Prazo Rest.</th>
                      <th className="text-right py-2 pr-2 font-medium text-muted-foreground">Saldo Dev.</th>
                      <th className="text-right py-2 pr-2 font-medium text-muted-foreground">Nova Parc.</th>
                      <th className="text-right py-2 pr-2 font-medium text-muted-foreground">Troco</th>
                      <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Banco Dest.</th>
                      <th className="text-right py-2 pr-2 font-medium text-muted-foreground">N. Prazo</th>
                      <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Tabela</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {portContratos.map((c) => (
                      <tr key={c.uid} className="border-b last:border-0">
                        <td className="py-1.5 pr-2">
                          <input className="w-28 border rounded px-1.5 py-0.5 text-xs bg-background"
                            value={c.banco} onChange={(e) => updatePortContrato(c.uid, "banco", e.target.value)}
                            placeholder="ex: AGIBANK" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input className="w-28 border rounded px-1.5 py-0.5 text-xs bg-background font-mono"
                            value={c.numeroContrato} onChange={(e) => updatePortContrato(c.uid, "numeroContrato", e.target.value)}
                            placeholder="Nº contrato" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input className="w-20 border rounded px-1.5 py-0.5 text-xs bg-background text-right"
                            value={c.parcelaAtual} onChange={(e) => updatePortContrato(c.uid, "parcelaAtual", e.target.value)}
                            placeholder="0.00" />
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          {c.prazoAtual && c.prazoTotal && c.source === "extrato" ? (
                            <span className="text-muted-foreground whitespace-nowrap">{c.prazoAtual}/{c.prazoTotal}m</span>
                          ) : (
                            <input className="w-16 border rounded px-1.5 py-0.5 text-xs bg-background text-right"
                              value={c.prazoAtual} onChange={(e) => updatePortContrato(c.uid, "prazoAtual", e.target.value)}
                              placeholder="meses" />
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          <input className="w-20 border rounded px-1.5 py-0.5 text-xs bg-background text-right"
                            value={c.saldoDevedor} onChange={(e) => updatePortContrato(c.uid, "saldoDevedor", e.target.value)}
                            placeholder="0.00" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input className="w-20 border rounded px-1.5 py-0.5 text-xs bg-background text-right"
                            value={c.novaParcela} onChange={(e) => updatePortContrato(c.uid, "novaParcela", e.target.value)}
                            placeholder="0.00" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input className="w-16 border rounded px-1.5 py-0.5 text-xs bg-background text-right"
                            value={c.troco} onChange={(e) => updatePortContrato(c.uid, "troco", e.target.value)}
                            placeholder="0" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <select
                            className="w-28 border rounded px-1.5 py-0.5 text-xs bg-background"
                            value={c.bancoDestino}
                            onChange={(e) => {
                              updatePortContrato(c.uid, "bancoDestino", e.target.value);
                              updatePortContrato(c.uid, "tableId", "");
                            }}
                          >
                            <option value="">— banco —</option>
                            {Array.from(new Set(
                              financeiroTabelas
                                .filter((t: any) => t.tipo === "Portabilidade" &&
                                  (!t.convenio || t.convenio.toUpperCase() === (selectedConvenio?.id || "").toUpperCase()))
                                .map((t: any) => t.banco as string)
                                .filter(Boolean)
                            )).map((banco) => (
                              <option key={banco} value={banco}>{banco}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2">
                          <input className="w-14 border rounded px-1.5 py-0.5 text-xs bg-background text-right"
                            value={c.novoPrazo} onChange={(e) => updatePortContrato(c.uid, "novoPrazo", e.target.value)}
                            placeholder="96" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <select
                            className="w-28 border rounded px-1.5 py-0.5 text-xs bg-background"
                            value={c.tableId || ""}
                            onChange={(e) => updatePortContrato(c.uid, "tableId", e.target.value)}
                          >
                            <option value="">— tabela —</option>
                            {financeiroTabelas
                              .filter((t: any) => {
                                if (t.tipo !== "Portabilidade") return false;
                                if (t.convenio && t.convenio.toUpperCase() !== (selectedConvenio?.id || "").toUpperCase()) return false;
                                if (c.bancoDestino && t.banco !== c.bancoDestino) return false;
                                return true;
                              })
                              .map((t: any) => (
                                <option key={String(t.id)} value={String(t.id)}>{t.nome}</option>
                              ))}
                          </select>
                        </td>
                        <td className="py-1.5">
                          <Button size="icon" variant="ghost" className="h-6 w-6" type="button"
                            onClick={() => setPortContratos((prev) => prev.filter((x) => x.uid !== c.uid))}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between pb-4">
          <Button type="button" variant="outline" onClick={() => setStep("tipo-contrato")}>
            ← Voltar
          </Button>
          <Button
            type="button"
            disabled={portContratos.length === 0 || !extratoFile}
            onClick={() => {
              if (!extratoFile) {
                toast({ title: "Anexe o extrato de consignações antes de prosseguir", variant: "destructive" });
                return;
              }
              if (portContratos.length === 0) {
                toast({ title: "Adicione ao menos um contrato", variant: "destructive" });
                return;
              }
              const semTabela = portContratos.filter((c) => !c.tableId);
              if (semTabela.length > 0) {
                toast({ title: `Selecione a tabela em todos os contratos (${semTabela.length} sem tabela)`, variant: "destructive" });
                return;
              }
              setStep("conferencia");
            }}
          >
            Conferência → ({portContratos.length})
          </Button>
        </div>
      </div>
    );
  }

  // ─── STEP 5 — Conferência ────────────────────────────────────────────────
  if (step === "conferencia") {
    const v = form.getValues();
    const contractTypeLabel = CONTRACT_TYPES.find((c) => c.id === contractType)?.label ?? contractType;
    const valorContrato     = parseBrNumber(v.contractValue) || 0;
    const valorParcela      = parseBrNumber(v.installmentValue) || 0;

    // Conta selecionada
    const contas = parsedData?.contas?.length
      ? parsedData.contas
      : parsedData?.bancoSalario
        ? [{ banco: parsedData.bancoSalario, agencia: parsedData.agencia, conta: parsedData.conta, tipo: "salario" as const, label: "Conta Salário" }]
        : [];
    const contaSel = selectedContaIdx === "manual"
      ? { banco: v.contaBanco, agencia: v.contaAgencia, conta: v.contaConta, label: "Conta informada manualmente" }
      : (typeof selectedContaIdx === "number" ? contas[selectedContaIdx] : null);

    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost"
            onClick={() => (contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") ? setStep("contratos-portabilidade") : setStep("tipo-contrato")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">
                {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") ? "Conferência — Portabilidade em Lote" : "Conferência da Proposta"}
              </h1>
              {selectedConvenio && <Badge variant="outline">{selectedConvenio.label}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN")
                ? `${portContratos.length} contrato(s) — revise antes de cadastrar`
                : "Revise todos os dados antes de cadastrar"}
            </p>
          </div>
        </div>

        <StepIndicator current="conferencia"
          steps={(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") ? WIZARD_STEPS_PORT : WIZARD_STEPS_DEFAULT} />

        {/* Card: Cliente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <InfoField label="Nome" value={v.clientName} wide />
            <InfoField label="CPF" value={v.clientCpf} />
            <InfoField label="Matrícula" value={v.clientMatricula || "—"} />
            <InfoField label="Telefone" value={v.clientPhone} />
            <InfoField label="E-mail" value={v.clientEmail} wide />
          </CardContent>
        </Card>

        {/* Card: Documento com foto */}
        {docPhotoData && (
          <Card className="border-purple-200 dark:border-purple-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <CreditCard className="h-4 w-4" />
                {docPhotoData.tipo === "CNH" ? "CNH" : docPhotoData.tipo === "RG" ? "RG" : "Documento com Foto"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
              {docPhotoData.numeroRegistro && <InfoField label="Nº Registro" value={docPhotoData.numeroRegistro} />}
              {docPhotoData.dataNascimento && <InfoField label="Nascimento" value={docPhotoData.dataNascimento} />}
              {docPhotoData.dataExpedicao && <InfoField label="Expedição" value={docPhotoData.dataExpedicao} />}
              {docPhotoData.orgaoEmissor && <InfoField label="Emissor" value={docPhotoData.orgaoEmissor} />}
              {docPhotoData.filiacao?.[0] && <InfoField label="Pai" value={docPhotoData.filiacao[0]} wide />}
              {docPhotoData.filiacao?.[1] && <InfoField label="Mãe" value={docPhotoData.filiacao[1]} wide />}
            </CardContent>
          </Card>
        )}

        {/* Card: SIAPE */}
        {parsedData && (
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                <MapPin className="h-4 w-4" /> Dados SIAPE
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
              {parsedData.identSiape && <InfoField label="Ident. SIAPE" value={parsedData.identSiape} />}
              {parsedData.uf && <InfoField label="UF" value={parsedData.uf} />}
              {parsedData.vinculo && <InfoField label="Vínculo" value={parsedData.vinculo} />}
              {parsedData.regJuridico && <InfoField label="Regime" value={parsedData.regJuridico} />}
              {parsedData.mesAno && <InfoField label="Competência" value={parsedData.mesAno} />}
              {parsedData.orgao && <InfoField label="Órgão" value={parsedData.orgao} wide />}
              {parsedData.naturezaPensao && <InfoField label="Natureza da Pensão" value={parsedData.naturezaPensao} />}
              {parsedData.inicioPensao && <InfoField label="Início da Pensão" value={parsedData.inicioPensao} />}
              {parsedData.terminoPensao && <InfoField label="Término da Pensão" value={parsedData.terminoPensao} />}
              {parsedData.nomeInstituidor && <InfoField label="Instituidor" value={parsedData.nomeInstituidor} wide />}
              {parsedData.matriculaInstituidor && <InfoField label="Matríc. Instituidor" value={parsedData.matriculaInstituidor} />}
              {contaSel && (
                <div className="col-span-2 md:col-span-3 lg:col-span-4 rounded-md border bg-blue-50/40 dark:bg-blue-950/20 p-3 mt-1">
                  <p className="text-xs text-muted-foreground">Conta para crédito · {contaSel.label}</p>
                  <p className="text-sm font-mono mt-1">
                    Banco <strong>{contaSel.banco}</strong>
                    {" · "}Ag <strong>{contaSel.agencia}</strong>
                    {" · "}Conta <strong>{contaSel.conta}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Card: Endereço */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <InfoField label="CEP" value={v.clientCep} />
            <InfoField label="Logradouro" value={`${v.clientLogradouro}, ${v.clientNumero}${v.clientComplemento ? ` — ${v.clientComplemento}` : ""}`} wide />
            <InfoField label="Bairro" value={v.clientBairro} />
            <InfoField label="Cidade" value={v.clientCidade} />
            <InfoField label="UF" value={v.clientEstado} />
          </CardContent>
        </Card>

        {/* Card: Contratos de Portabilidade */}
        {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") && (
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <ArrowLeftRight className="h-4 w-4" />
                Contratos a Portar
                <span className="text-xs font-normal text-muted-foreground ml-1">— {portContratos.length} contrato(s)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {simPortData?.banco_destino && (
                <p className="text-xs text-muted-foreground mb-3">
                  Banco destino: <strong>{simPortData.banco_destino}</strong>
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground">Banco Origem</th>
                      <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground">Nº Contrato</th>
                      <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground">Parc. Atual</th>
                      <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground">Nova Parc.</th>
                      <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground">Troco</th>
                      <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground">Banco Dest.</th>
                      <th className="text-right py-1.5 pr-0 font-medium text-muted-foreground">Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portContratos.map((c) => (
                      <tr key={c.uid} className="border-b last:border-0">
                        <td className="py-1.5 pr-2 font-medium">{c.banco || "—"}</td>
                        <td className="py-1.5 pr-2 font-mono text-muted-foreground">{c.numeroContrato || "—"}</td>
                        <td className="py-1.5 pr-2 text-right">{c.parcelaAtual ? `R$ ${c.parcelaAtual}` : "—"}</td>
                        <td className="py-1.5 pr-2 text-right text-green-700 dark:text-green-400 font-medium">{c.novaParcela ? `R$ ${c.novaParcela}` : "—"}</td>
                        <td className="py-1.5 pr-2 text-right">{c.troco ? `R$ ${c.troco}` : "—"}</td>
                        <td className="py-1.5 pr-2">{c.bancoDestino || simPortData?.banco_destino || "—"}</td>
                        <td className="py-1.5 pr-0 text-right">{c.novoPrazo ? `${c.novoPrazo}m` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card: Operação (oculto para PORTABILIDADE — dados já estão nos contratos acima) */}
        {contractType !== "PORTABILIDADE" && (
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Building2 className="h-4 w-4" />
                {contractTypeLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
              <InfoField label="Banco" value={v.bank || "—"} />
              {selectedTabela && <InfoField label="Tabela" value={selectedTabela.nome} wide />}
              {selectedTabela?.prazo && <InfoField label="Prazo" value={`${selectedTabela.prazo} meses`} />}
              <InfoField
                label={contractType === "CARTAO" ? "Valor do Saque" : contractType === "PORTABILIDADE_REFIN" ? "Troco" : "Valor Liberado"}
                value={fmtBRL(valorContrato)}
              />
              <InfoField
                label={(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") ? "Nova Parcela" : "Parcela"}
                value={fmtBRL(valorParcela)}
              />
              {v.bancoOrigem && <InfoField label="Banco de Origem" value={v.bancoOrigem} />}
              {v.saldoDevedor && <InfoField label="Saldo Devedor" value={`R$ ${v.saldoDevedor}`} />}
              {v.prazoAtual && <InfoField label="Prazo Restante" value={`${v.prazoAtual} meses`} />}
              {v.ade && <InfoField label="ADE" value={v.ade} />}
            </CardContent>
          </Card>
        )}

        {/* Card: Comissão (líquido do corretor) — não exibe para PORTABILIDADE pois não há tabela selecionada */}
        {selectedTabela && myGrupo && contractType !== "PORTABILIDADE" && (
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                <BadgePercent className="h-4 w-4" /> Sua Comissão
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <InfoField label="% Repasse Corretor" value={`${pctCorretor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`} />
              <InfoField label="R$ Comissão Corretor" value={fmtBRL(valCorretor)} />
            </CardContent>
          </Card>
        )}

        {/* Card: Documentos anexados (com possibilidade de adicionar/remover) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" /> Documentos Anexados
              {attachments.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">— {attachments.length}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Documentos reaproveitados do cadastro anterior */}
            {reusedDocs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                  Reaproveitados do cadastro anterior ({reusedDocs.length})
                </p>
                {reusedDocs.map((d) => (
                  <div key={`reuse-${d.id}`} className="flex items-center gap-3 p-2 rounded-md border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/10 text-sm">
                    <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="flex-1 truncate">{d.fileName}</span>
                    <a
                      href={`/api/contracts/documents/${d.id}/file`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Visualizar
                    </a>
                    <Button
                      size="icon" variant="ghost" type="button"
                      title="Não reaproveitar este"
                      onClick={() => setReusedDocs((prev) => prev.filter((x) => x.id !== d.id))}
                      className="h-7 w-7"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {/* Lista de anexos */}
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-md border bg-card text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{att.file.name}</span>
                    <Select
                      value={att.documentType}
                      onValueChange={(v) =>
                        setAttachments((prev) =>
                          prev.map((a, idx) => (idx === i ? { ...a, documentType: v } : a))
                        )
                      }
                    >
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => openAttachmentPreview(att.file)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Visualizar
                    </button>
                    <Button
                      size="icon" variant="ghost" type="button"
                      title="Remover"
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="h-7 w-7"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone para adicionar mais arquivos */}
            <div
              className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
                docDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDocDragOver(true); }}
              onDragLeave={() => setDocDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDocDragOver(false);
                handleDocFiles(e.dataTransfer.files);
              }}
              onClick={() => document.getElementById("conf-doc-upload")?.click()}
            >
              <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {attachments.length > 0
                  ? "Arraste mais documentos aqui ou clique para selecionar"
                  : "Arraste documentos aqui ou clique para selecionar"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Máx. 5MB por arquivo</p>
              <input
                id="conf-doc-upload"
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf"
                onChange={(e) => handleDocFiles(e.target.files)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer: confirmar e cadastrar */}
        <div className="flex justify-end gap-3 pb-4">
          <Button type="button" variant="outline"
            onClick={() => (contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") ? setStep("contratos-portabilidade") : setStep("tipo-contrato")}>
            ← Voltar e editar
          </Button>
          {(contractType === "PORTABILIDADE" || contractType === "PORTABILIDADE_REFIN") ? (
            <Button
              type="button"
              disabled={batchMutation.isPending || portContratos.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => batchMutation.mutate()}
            >
              {batchMutation.isPending
                ? "Cadastrando..."
                : `✓ Cadastrar ${portContratos.length} Proposta(s)`}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={createMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => createMutation.mutate(form.getValues())}
            >
              {createMutation.isPending ? "Cadastrando..." : "✓ Confirmar e Cadastrar Proposta"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Fallback impossível
  return null;
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
