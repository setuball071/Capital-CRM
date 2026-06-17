import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, SkipForward,
  FileText, AlertCircle, ExternalLink, Download, Paperclip,
  Copy, Check, Pencil, X, User, Landmark, CreditCard, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Paleta dos badges de status (mesma da listagem)
const BADGE_COLORS: Record<string, string> = {
  zinc:   "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  red:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  green:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  rose:   "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  RG_CNH: "RG / CNH",
  CONTRACHEQUE: "Contracheque",
  EXTRATO_CONSIGNACOES: "Extrato de Consignações",
  SELFIE: "Selfie c/ Documento",
  COMPROVANTE_RESIDENCIA: "Comprovante de Residência",
  PROPOSTA: "Proposta Gerada",
  OUTRO: "Outro",
};

const ACTION_ICONS: Record<string, any> = {
  AVANCO: CheckCircle2,
  PENDENCIA: AlertTriangle,
  RESOLUCAO: CheckCircle2,
  CANCELAMENTO: X,
  PAGAMENTO: CheckCircle2,
  EDICAO: Pencil,
};

const TERMINAL = ["PAGO", "CANCELADA", "PERDIDA"];

interface StatusDef { id: number; key: string; label: string; color: string; allowsVendorEdit: boolean; }

function formatMoney(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "1.234,56" → 1234.56 ; também aceita "1234.56"
function parseBrNum(v: string): number {
  if (!v) return 0;
  const cleaned = v.replace(/\s/g, "");
  if (cleaned.includes(",")) return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(cleaned) || 0;
}

function numToBr(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ContratosDetalhePage() {
  const params = useParams<{ id: string }>();
  const proposalId = params.id;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [actionNotes, setActionNotes] = useState("");
  const [adeValue, setAdeValue] = useState("");
  const [nextStatus, setNextStatus] = useState("");

  // edição inline de campos
  const [editField, setEditField] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // comissão (ao marcar PAGO)
  const [commPercEmpresa, setCommPercEmpresa] = useState("");
  const [corretorPercRepasse, setCorretorPercRepasse] = useState("");
  const [contractValComm, setContractValComm] = useState("");
  const [commPrefilled, setCommPrefilled] = useState(false);

  const isOperacional = !!(user?.isMaster || ["coordenacao", "operacional", "master"].includes(user?.role || ""));
  const isVendedor = user?.role === "vendedor";

  const contractValNum  = parseBrNum(contractValComm);
  const commPercNum     = parseBrNum(commPercEmpresa);
  const corretorPercNum = parseBrNum(corretorPercRepasse);
  const companyCommVal  = commPercNum > 0 ? contractValNum * commPercNum / 100 : 0;
  const corretorCommVal = corretorPercNum > 0 ? companyCommVal * corretorPercNum / 100 : 0;

  const { data: proposal, isLoading } = useQuery<any>({
    queryKey: ["/api/contracts/proposals", proposalId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Proposta não encontrada");
      return res.json();
    },
  });

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["/api/contracts/proposals", proposalId, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}/history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Apenas documentos (chat removido) — vêm do endpoint /messages
  const { data: docsData } = useQuery<any>({
    queryKey: ["/api/contracts/proposals", proposalId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}/messages`, { credentials: "include" });
      if (!res.ok) return { documents: [] };
      return res.json();
    },
  });
  const documents: any[] = docsData?.documents ?? [];

  const { data: statusList = [] } = useQuery<StatusDef[]>({
    queryKey: ["/api/contracts/statuses"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/statuses", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: financeiroConfig } = useQuery<{ dados: any } | null>({
    queryKey: ["/api/financeiro/config"],
    queryFn: async () => {
      const res = await fetch("/api/financeiro/config", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });
  const financeiroTabelas: any[] = financeiroConfig?.dados?.tabelas ?? [];

  const statusConfigMap: Record<string, { label: string; className: string }> = {};
  statusList.forEach((s) => { statusConfigMap[s.key] = { label: s.label, className: BADGE_COLORS[s.color] ?? BADGE_COLORS.zinc }; });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals", proposalId] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals", proposalId, "history"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/producao"] });
  };

  // pré-preenche comissão uma vez
  if (proposal && !commPrefilled) {
    setCommPrefilled(true);
    if (proposal.contractValue) setContractValComm(numToBr(proposal.contractValue));
    if (proposal.commissionPercentage) setCommPercEmpresa((parseFloat(proposal.commissionPercentage) * 100).toFixed(2).replace(".", ","));
    if (proposal.corretorCommissionPercentage) setCorretorPercRepasse((parseFloat(proposal.corretorCommissionPercentage) * 100).toFixed(2).replace(".", ","));
  }

  const advanceStatusMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erro");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Status atualizado" }); invalidate(); setActionNotes(""); setAdeValue(""); setNextStatus(""); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erro");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Campo atualizado" }); invalidate(); setEditField(null); setEditVal(""); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-md bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Proposta não encontrada</p>
          <Button variant="outline" onClick={() => setLocation("/contratos")}>Voltar à lista</Button>
        </div>
      </div>
    );
  }

  const m: any = proposal.clientMeta || {};
  const currentStatusDef = statusList.find((s) => s.key === proposal.status);
  const isTerminal = TERMINAL.includes(proposal.status);
  const isPortabilidade = proposal.product === "PORTABILIDADE";

  // permissões de edição de campos
  const canEditFields = !isTerminal && (isOperacional || (isVendedor && !!currentStatusDef?.allowsVendorEdit));
  const canEditAde = !isTerminal && isOperacional;

  // dados bancários de crédito
  const cs = m.contaSelecionada || {};
  const bancoCredito = cs.banco || m.bancoSalario || "";
  const agencia = cs.agencia || m.agencia || "";
  const conta = cs.conta || m.conta || "";

  // endereço montado
  const end = m.endereco || {};
  const enderecoStr = [end.logradouro, end.numero && `nº ${end.numero}`, end.complemento, end.bairro, end.cidade, end.estado, end.cep]
    .filter(Boolean).join(", ");

  // ── helpers de UI ───────────────────────────────────────────────────────────

  function copy(key: string, text: string) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
  }

  function startEdit(key: string, current: string) {
    setEditField(key);
    setEditVal(current ?? "");
  }

  function saveEdit() {
    if (!editField) return;
    let body: any = {};
    switch (editField) {
      case "bank":             body = { bank: editVal.trim() }; break;
      case "contractValue":    body = { contractValue: parseBrNum(editVal) }; break;
      case "installmentValue": body = { installmentValue: parseBrNum(editVal) }; break;
      case "term":             body = { term: editVal.trim() ? parseInt(editVal) : null }; break;
      case "taxa":             body = { clientMetaPatch: { taxa: parseBrNum(editVal) } }; break;
      case "ade":              body = { ade: editVal.trim() }; break;
      case "adeRefin":         body = { adeRefin: editVal.trim() }; break;
      default: return;
    }
    editMutation.mutate(body);
  }

  function saveTabela(tableId: string) {
    const t = financeiroTabelas.find((x: any) => String(x.id) === tableId);
    editMutation.mutate({ clientMetaPatch: { tabelaFinanceiroId: tableId, tabelaNome: t?.nome || null } });
    setEditField(null);
  }

  // Campo da ficha com cópia e (opcional) edição inline.
  // É uma FUNÇÃO chamada diretamente (não <Field/>) para não criar fronteira de
  // componente — assim o input da edição inline não perde o foco a cada tecla.
  const renderField = (p: {
    fieldKey: string; label: string; value: any;
    copyable?: boolean; mono?: boolean; editable?: boolean; isAde?: boolean; money?: boolean;
  }) => {
    const {
      fieldKey, label, value, copyable = true, mono = false, editable = false, isAde = false, money = false,
    } = p;
    const display = money ? formatMoney(value) : (value || "—");
    const canCopy = copyable && value && display !== "—";
    const canEditThis = editable && (isAde ? canEditAde : canEditFields);
    const isEditing = editField === fieldKey;

    return (
      <div className="group min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-1 mt-0.5">
            <Input
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditField(null); }}
            />
            <button className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30" onClick={saveEdit} disabled={editMutation.isPending}>
              <Check className="h-3.5 w-3.5" />
            </button>
            <button className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setEditField(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mt-0.5">
            <button
              type="button"
              disabled={!canCopy}
              onClick={() => copy(fieldKey, money ? String(value) : String(value))}
              className={`font-medium text-sm text-left truncate ${canCopy ? "hover:text-primary cursor-pointer" : "cursor-default"} ${mono ? "font-mono text-xs" : ""}`}
              title={canCopy ? "Clique para copiar" : undefined}
            >
              {display}
            </button>
            {canCopy && (
              copiedKey === fieldKey
                ? <Check className="h-3 w-3 text-green-600 shrink-0" />
                : <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer" onClick={() => copy(fieldKey, money ? String(value) : String(value))} />
            )}
            {canEditThis && (
              <Pencil
                className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer hover:text-primary"
                onClick={() => startEdit(fieldKey, money ? numToBr(value) : (value ?? ""))}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLocation("/contratos")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold truncate">{proposal.clientName}</h1>
            <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${statusConfigMap[proposal.status]?.className ?? BADGE_COLORS.zinc}`}>
              {statusConfigMap[proposal.status]?.label ?? proposal.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Proposta #{proposal.id}</p>
        </div>
      </div>

      {/* Aviso de edição liberada para corretor */}
      {isVendedor && (
        <div className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
          currentStatusDef?.allowsVendorEdit
            ? "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300"
            : "border-border bg-muted/40 text-muted-foreground"
        }`}>
          {currentStatusDef?.allowsVendorEdit ? <Pencil className="h-4 w-4 shrink-0" /> : <Lock className="h-4 w-4 shrink-0" />}
          {currentStatusDef?.allowsVendorEdit
            ? "Edição liberada — você pode ajustar os campos da operação enquanto a proposta estiver neste status."
            : "Proposta em conferência pelo operacional. Edição bloqueada até liberação."}
        </div>
      )}

      {/* Layout 2 colunas: ficha à esquerda · ações + histórico à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">

      {/* 1 ─ DADOS DA PROPOSTA (ficha completa) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Dados do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {renderField({ fieldKey: "nome", label: "Nome", value: proposal.clientName })}
          {renderField({ fieldKey: "cpf", label: "CPF", value: proposal.clientCpf, mono: true })}
          {renderField({ fieldKey: "matricula", label: "Matrícula", value: proposal.clientMatricula, mono: true })}
          {m.identSiape && renderField({ fieldKey: "identSiape", label: "Ident. SIAPE", value: m.identSiape, mono: true })}
          {renderField({ fieldKey: "convenio", label: "Convênio", value: proposal.clientConvenio })}
          {m.orgao && renderField({ fieldKey: "orgao", label: "Órgão", value: m.orgao })}
          {m.uf && renderField({ fieldKey: "uf", label: "UF", value: m.uf })}
          {m.regJuridico && renderField({ fieldKey: "regJuridico", label: "Reg. Jurídico", value: m.regJuridico })}
          {m.vinculo && renderField({ fieldKey: "vinculo", label: "Vínculo", value: m.vinculo })}
          {m.mesAno && renderField({ fieldKey: "mesAno", label: "Mês/Ano Ref.", value: m.mesAno })}
          {m.telefone && renderField({ fieldKey: "telefone", label: "Telefone", value: m.telefone })}
          {m.email && renderField({ fieldKey: "email", label: "Email", value: m.email })}
          {enderecoStr && <div className="col-span-2 md:col-span-3">{renderField({ fieldKey: "endereco", label: "Endereço", value: enderecoStr })}</div>}
          {/* Pensão / instituidor */}
          {m.nomeInstituidor && renderField({ fieldKey: "nomeInstituidor", label: "Instituidor", value: m.nomeInstituidor })}
          {m.matriculaInstituidor && renderField({ fieldKey: "matInstituidor", label: "Matr. Instituidor", value: m.matriculaInstituidor, mono: true })}
          {m.naturezaPensao && renderField({ fieldKey: "naturezaPensao", label: "Natureza Pensão", value: m.naturezaPensao })}
        </CardContent>
      </Card>

      {/* Dados bancários de crédito */}
      {(bancoCredito || agencia || conta) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" /> Dados Bancários (crédito)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {renderField({ fieldKey: "bancoCredito", label: "Banco", value: bancoCredito })}
            {renderField({ fieldKey: "agencia", label: "Agência", value: agencia, mono: true })}
            {renderField({ fieldKey: "conta", label: "Conta", value: conta, mono: true })}
          </CardContent>
        </Card>
      )}

      {/* Dados da operação (editáveis) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Operação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {renderField({ fieldKey: "produto", label: "Produto", value: proposal.product, copyable: false })}
          {renderField({ fieldKey: "bank", label: "Banco", value: proposal.bank, editable: true })}
          {/* Tabela — edição via select */}
          <div className="group min-w-0">
            <p className="text-xs text-muted-foreground">Tabela</p>
            {editField === "tabela" ? (
              <div className="flex items-center gap-1 mt-0.5">
                <Select onValueChange={saveTabela}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {financeiroTabelas
                      .filter((t: any) => !t.convenio || t.convenio.toUpperCase() === (proposal.clientConvenio || "").toUpperCase())
                      .map((t: any) => (
                        <SelectItem key={String(t.id)} value={String(t.id)}>
                          {t.nome}{t.banco ? ` — ${t.banco}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <button className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setEditField(null)}><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-medium text-sm truncate">{m.tabelaNome || "—"}</span>
                {canEditFields && (
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer hover:text-primary" onClick={() => setEditField("tabela")} />
                )}
              </div>
            )}
          </div>
          {renderField({ fieldKey: "contractValue", label: "Valor Contrato", value: proposal.contractValue, money: true, editable: true })}
          {renderField({ fieldKey: "installmentValue", label: "Parcela", value: proposal.installmentValue, money: true, editable: true })}
          {renderField({ fieldKey: "term", label: "Prazo (meses)", value: proposal.term != null ? String(proposal.term) : "", editable: true, copyable: false })}
          {renderField({ fieldKey: "taxa", label: "Taxa (%)", value: m.taxa != null ? String(m.taxa) : "", editable: true, copyable: false })}
          {/* ADE */}
          {isPortabilidade ? (
            <>
              {renderField({ fieldKey: "ade", label: "ADE Portabilidade", value: proposal.ade, mono: true, editable: true, isAde: true })}
              {renderField({ fieldKey: "adeRefin", label: "ADE Refinanciamento", value: proposal.adeRefin, mono: true, editable: true, isAde: true })}
            </>
          ) : (
            renderField({ fieldKey: "ade", label: "ADE", value: proposal.ade, mono: true, editable: true, isAde: true })
          )}
          {/* Portabilidade — origem */}
          {m.bancoOrigem && renderField({ fieldKey: "bancoOrigem", label: "Banco Origem", value: m.bancoOrigem })}
          {m.numeroContrato && renderField({ fieldKey: "numContrato", label: "Nº Contrato Origem", value: m.numeroContrato, mono: true })}
        </CardContent>
      </Card>

      {/* 2 ─ DOCUMENTAÇÃO ANEXADA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Paperclip className="h-4 w-4" /> Documentação Anexada</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento anexado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName || "Documento"}</p>
                      <p className="text-xs text-muted-foreground">{DOC_TYPE_LABEL[doc.documentType] || doc.documentType || "Arquivo"}</p>
                    </div>
                  </div>
                  {doc.fileUrl && (
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-muted-foreground hover:text-primary hover:bg-muted transition-colors" title="Abrir">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <a href={doc.fileUrl} download={doc.fileName || ""} className="rounded p-1.5 text-muted-foreground hover:text-primary hover:bg-muted transition-colors" title="Baixar">
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        </div>{/* fim coluna esquerda */}

        {/* Coluna direita: Ações Operacionais + Histórico */}
        <div className="space-y-4">

      {/* 3 ─ AÇÕES OPERACIONAIS */}
      {isOperacional && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ações Operacionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Alterar status</p>
                <Select value={nextStatus} onValueChange={setNextStatus}>
                  <SelectTrigger data-testid="select-next-status"><SelectValue placeholder="Selecione o status..." /></SelectTrigger>
                  <SelectContent>
                    {statusList.filter((s) => s.key !== proposal.status).map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Registrar ADE {isPortabilidade ? "(Portabilidade)" : ""}</p>
                <Input value={adeValue} onChange={(e) => setAdeValue(e.target.value)} placeholder="Número ADE" data-testid="input-ade" />
              </div>
            </div>

            {nextStatus === "PAGO" && (
              <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Dados de Comissão
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-xs text-muted-foreground mb-1">Valor Liberado (R$)</p>
                    <Input value={contractValComm} onChange={(e) => setContractValComm(e.target.value)} placeholder="0,00" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Comissão Empresa (%)</p>
                    <Input value={commPercEmpresa} onChange={(e) => setCommPercEmpresa(e.target.value)} placeholder="7,00" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">R$ Empresa</p>
                    <p className="font-medium text-sm mt-2">{companyCommVal > 0 ? formatMoney(companyCommVal) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Repasse Corretor (%)</p>
                    <Input value={corretorPercRepasse} onChange={(e) => setCorretorPercRepasse(e.target.value)} placeholder="30,00" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">R$ Corretor</p>
                    <p className="font-semibold text-sm mt-2 text-green-700 dark:text-green-400">{corretorCommVal > 0 ? formatMoney(corretorCommVal) : "—"}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Observação</p>
              <Textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} placeholder="Observação sobre a movimentação..." className="resize-none" rows={2} data-testid="textarea-action-notes" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={(!nextStatus && !adeValue) || advanceStatusMutation.isPending}
                onClick={() =>
                  advanceStatusMutation.mutate({
                    status: nextStatus || undefined,
                    ade: adeValue || undefined,
                    notes: actionNotes,
                    action: nextStatus === "PAGO" ? "PAGAMENTO" : ["CANCELADA", "PERDIDA"].includes(nextStatus) ? "CANCELAMENTO" : "AVANCO",
                    ...(nextStatus === "PAGO" && commPercNum > 0 ? {
                      contractValue: contractValNum || undefined,
                      commissionPercentage: commPercNum / 100,
                      companyCommissionValue: companyCommVal,
                      corretorCommissionPercentage: corretorPercNum > 0 ? corretorPercNum / 100 : undefined,
                      corretorCommissionValue: corretorCommVal > 0 ? corretorCommVal : undefined,
                    } : {}),
                  })
                }
                data-testid="button-advance-status"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                {advanceStatusMutation.isPending ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4 ─ HISTÓRICO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem movimentações</p>
          ) : (
            <div className="space-y-4">
              {history.map((h: any, idx: number) => {
                const Icon = ACTION_ICONS[h.action] || Clock;
                const isLast = idx === history.length - 1;
                return (
                  <div key={h.id} className="flex gap-3" data-testid={`history-${h.id}`}>
                    <div className="flex flex-col items-center">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                        h.action === "AVANCO" ? "bg-green-100 text-green-600 dark:bg-green-900/40" :
                        h.action === "PENDENCIA" ? "bg-red-100 text-red-600 dark:bg-red-900/40" :
                        h.action === "EDICAO" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40" :
                        h.action === "PAGAMENTO" ? "bg-green-100 text-green-600 dark:bg-green-900/40" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-medium">
                          {h.action === "EDICAO" ? "Edição" : (h.toStatus ? (statusConfigMap[h.toStatus]?.label || h.toStatus) : h.action)}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0">{format(new Date(h.createdAt), "dd/MM HH:mm", { locale: ptBR })}</span>
                      </div>
                      {h.userName && <p className="text-xs text-muted-foreground mt-0.5">por {h.userName}</p>}
                      {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

        </div>{/* fim coluna direita */}
      </div>{/* fim grid */}
    </div>
  );
}
