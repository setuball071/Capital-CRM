import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Search, Loader2, CheckCircle, Clock, AlertCircle,
  XCircle, FileText, RefreshCw, ChevronDown, Eye, Pencil, Trash2, DollarSign, Upload, Download, Paperclip, X
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ── Tipos ─────────────────────────────────────────────────────
interface SolicitacaoBoleto {
  id: number;
  banco: string;
  tipo_boleto: string;
  nome_cliente: string;
  cpf_cliente: string;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  valor: string | null;
  observacao_vendedor: string | null;
  ultimos_digitos_cartao: string | null;
  status: string;
  observacao_operacional: string | null;
  boleto_anexo: string | null;
  boleto_anexo_nome: string | null;
  solicitado_por_id: number;
  solicitado_por_nome: string;
  atendido_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: string;
  pendentes: string;
  em_andamento: string;
  pendenciados: string;
  concluidos: string;
  cancelados: string;
  hoje: string;
  semana: string;
  valor_total: string;
  valor_hoje: string;
  valor_pendentes: string;
  valor_cancelados: string;
  valor_concluidos: string;
}

// ── Constantes ────────────────────────────────────────────────
const TIPOS_BOLETO = [
  { value: "credito_consignado", label: "Crédito Consignado" },
  { value: "cartao_beneficio", label: "Cartão Benefício" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente:           { label: "Pendente",           color: "bg-yellow-100 text-yellow-800 border-yellow-200",   icon: <Clock className="w-3 h-3" /> },
  em_andamento:       { label: "Em Andamento",        color: "bg-blue-100 text-blue-800 border-blue-200",         icon: <RefreshCw className="w-3 h-3" /> },
  solicitado_banco:   { label: "Solicitado ao Banco", color: "bg-purple-100 text-purple-800 border-purple-200",   icon: <FileText className="w-3 h-3" /> },
  aguardando_retorno: { label: "Aguardando Retorno",  color: "bg-orange-100 text-orange-800 border-orange-200",   icon: <Clock className="w-3 h-3" /> },
  pendenciado:        { label: "Pendenciado",          color: "bg-red-100 text-red-800 border-red-200",            icon: <AlertCircle className="w-3 h-3" /> },
  concluido:          { label: "Concluído",            color: "bg-green-100 text-green-800 border-green-200",      icon: <CheckCircle className="w-3 h-3" /> },
  cancelado:          { label: "Cancelado",            color: "bg-gray-100 text-gray-600 border-gray-200",         icon: <XCircle className="w-3 h-3" /> },
};

const STATUS_OPERACIONAL = [
  { value: "em_andamento",       label: "Em Andamento" },
  { value: "solicitado_banco",   label: "Solicitado ao Banco" },
  { value: "aguardando_retorno", label: "Aguardando Retorno" },
  { value: "pendenciado",        label: "Pendenciado" },
  { value: "concluido",          label: "Concluído" },
  { value: "cancelado",          label: "Cancelado" },
];

// ── Helper ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function formatCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatData(iso: string) {
  try { return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return iso; }
}

const ADMIN_ROLES = ["master", "coordenacao", "operacional", "atendimento"];

// ── Componente principal ──────────────────────────────────────
export default function SolicitacoesBoleto() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Verifica se o usuário atual tem permissão de admin (pode alterar qualquer status)
  const currentUserIsAdmin = ADMIN_ROLES.includes(user?.role ?? "");
  // Retorna true se o usuário pode apenas cancelar esta solicitação específica
  function canCancelOnlyFor(s: SolicitacaoBoleto): boolean {
    if (currentUserIsAdmin) return false;
    return user?.role === "vendedor" || user?.id === s.solicitado_por_id;
  }
  // Retorna true se o usuário pode ver o botão de editar status
  function canEditStatus(s: SolicitacaoBoleto): boolean {
    return currentUserIsAdmin || canCancelOnlyFor(s);
  }

  // Estado da UI
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [modalNova, setModalNova] = useState(false);
  const [modalDetalhe, setModalDetalhe] = useState<SolicitacaoBoleto | null>(null);
  const [modalStatus, setModalStatus] = useState<SolicitacaoBoleto | null>(null);

  // Form nova solicitação
  const [formBanco, setFormBanco] = useState("");
  const [formTipo, setFormTipo] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formNascimento, setFormNascimento] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formObs, setFormObs] = useState("");
  const [formDigitosCartao, setFormDigitosCartao] = useState("");

  // Form atualizar status
  const [novoStatus, setNovoStatus] = useState("");
  const [obsOperacional, setObsOperacional] = useState("");
  const [boletoFile, setBoletoFile] = useState<{ base64: string; nome: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──────────────────────────────────────────────────
  const { data: solicitacoes = [], isLoading } = useQuery<SolicitacaoBoleto[]>({
    queryKey: ["/api/solicitacoes-boleto"],
    queryFn: () => apiRequest("GET", "/api/solicitacoes-boleto").then(r => r.json()),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/solicitacoes-boleto/stats"],
    queryFn: () => apiRequest("GET", "/api/solicitacoes-boleto/stats").then(r => r.json()),
  });

  // ── Mutations ─────────────────────────────────────────────────
  const criarMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/solicitacoes-boleto", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes-boleto"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes-boleto/stats"] });
      toast({ title: "Solicitação criada!", description: "Sua solicitação foi enviada para o operacional." });
      setModalNova(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Erro ao criar solicitação", variant: "destructive" });
    },
  });

  const atualizarStatusMutation = useMutation({
    mutationFn: ({ id, status, observacaoOperacional, boletoAnexo, boletoAnexoNome }: any) =>
      apiRequest("PATCH", `/api/solicitacoes-boleto/${id}/status`, { status, observacaoOperacional, boletoAnexo, boletoAnexoNome }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes-boleto"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes-boleto/stats"] });
      toast({ title: "Status atualizado!" });
      setModalStatus(null);
      setNovoStatus("");
      setObsOperacional("");
      setBoletoFile(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const excluirMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/solicitacoes-boleto/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes-boleto"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes-boleto/stats"] });
      toast({ title: "Solicitação excluída com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Erro ao excluir solicitação", variant: "destructive" });
    },
  });

  function handleExcluir(id: number, nome: string) {
    if (window.confirm(`Deseja excluir a solicitação de "${nome}"? Esta ação não pode ser desfeita.`)) {
      excluirMutation.mutate(id);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function resetForm() {
    setFormBanco(""); setFormTipo(""); setFormNome(""); setFormCpf("");
    setFormNascimento(""); setFormTelefone(""); setFormEmail(""); setFormValor(""); setFormObs(""); setFormDigitosCartao("");
  }

  const bancosExigemDigitos = ["daycoval", "santander", "olé", "ole"];
  const tiposExigemDigitos = ["cartao_beneficio", "cartao_credito"];
  const exigeDigitosCartao = bancosExigemDigitos.some(b => formBanco.toLowerCase().includes(b)) && tiposExigemDigitos.includes(formTipo);

  function handleCriar() {
    if (!formBanco || !formTipo || !formNome || !formCpf) {
      toast({ title: "Campos obrigatórios", description: "Preencha banco, tipo, nome e CPF", variant: "destructive" });
      return;
    }
    if (exigeDigitosCartao && (!formDigitosCartao || formDigitosCartao.replace(/\D/g, "").length !== 4)) {
      toast({ title: "Campo obrigatório", description: "Informe os 4 últimos dígitos do cartão para este banco e tipo de boleto", variant: "destructive" });
      return;
    }
    criarMutation.mutate({
      banco: formBanco, tipoBoleto: formTipo, nomeCliente: formNome,
      cpfCliente: formCpf.replace(/\D/g, ""), dataNascimento: formNascimento || null,
      telefone: formTelefone || null, email: formEmail || null,
      valor: formValor || null, observacaoVendedor: formObs || null,
      ultimosDigitosCartao: exigeDigitosCartao ? formDigitosCartao.replace(/\D/g, "") : null,
    });
  }

  function handleAtualizarStatus() {
    if (!novoStatus || !modalStatus) return;
    atualizarStatusMutation.mutate({
      id: modalStatus.id,
      status: novoStatus,
      observacaoOperacional: obsOperacional || null,
      boletoAnexo: boletoFile?.base64 || null,
      boletoAnexoNome: boletoFile?.nome || null,
    });
  }

  function abrirModalStatus(s: SolicitacaoBoleto) {
    setModalStatus(s);
    // Se o usuário só pode cancelar, pré-seleciona "cancelado"
    if (!currentUserIsAdmin && (user?.role === "vendedor" || user?.id === s.solicitado_por_id)) {
      setNovoStatus("cancelado");
    } else {
      setNovoStatus(s.status);
    }
    setObsOperacional(s.observacao_operacional || "");
    setBoletoFile(null);
  }

  function handleBoletoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBoletoFile({ base64: reader.result as string, nome: file.name });
    };
    reader.readAsDataURL(file);
  }

  function downloadBoleto(base64: string, nome: string) {
    const link = document.createElement("a");
    link.href = base64;
    link.download = nome;
    link.click();
  }

  // ── Filtragem ─────────────────────────────────────────────────
  const filtradas = solicitacoes.filter(s => {
    const okBusca = !busca || [s.nome_cliente, s.cpf_cliente, s.banco].some(v =>
      v?.toLowerCase().includes(busca.toLowerCase())
    );
    const okStatus = filtroStatus === "todos" || s.status === filtroStatus;
    return okBusca && okStatus;
  });

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitações de Boleto</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie pedidos de boleto para a equipe operacional</p>
        </div>
        <Button onClick={() => setModalNova(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nova Solicitação
        </Button>
      </div>
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-gray-900">{stats.hoje || "0"}</div>
              <div className="text-sm font-semibold text-gray-900">
                {Number(stats.valor_hoje || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <div className="text-xs text-gray-500 mt-1">Solicitações hoje</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendentes || "0"}</div>
              <div className="text-sm font-semibold text-yellow-600">
                {Number(stats.valor_pendentes || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <div className="text-xs text-gray-500 mt-1">Pendentes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-red-600">{stats.cancelados || "0"}</div>
              <div className="text-sm font-semibold text-red-600">
                {Number(stats.valor_cancelados || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <div className="text-xs text-gray-500 mt-1">Cancelados</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-600">{stats.concluidos || "0"}</div>
              <div className="text-sm font-semibold text-green-600">
                {Number(stats.valor_concluidos || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <div className="text-xs text-gray-500 mt-1">Concluídos</div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, CPF ou banco..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhuma solicitação encontrada</p>
              <p className="text-sm mt-1">Clique em "Nova Solicitação" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Solicitado por</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map(s => (
                  <TableRow key={s.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="font-medium text-gray-900">{s.nome_cliente}</div>
                      <div className="text-xs text-gray-400">{formatCpf(s.cpf_cliente)}</div>
                    </TableCell>
                    <TableCell className="font-medium">{s.banco}</TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {TIPOS_BOLETO.find(t => t.value === s.tipo_boleto)?.label || s.tipo_boleto}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.valor ? (
                        <span className="font-medium text-gray-900">R$ {s.valor}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={s.status} />
                        {s.boleto_anexo && <Paperclip className="w-3.5 h-3.5 text-green-600" title="Boleto anexado" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600">{s.solicitado_por_nome || "—"}</div>
                      {s.atendido_por_nome && (
                        <div className="text-xs text-gray-400">Op: {s.atendido_por_nome}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatData(s.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setModalDetalhe(s)}
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canEditStatus(s) && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => abrirModalStatus(s)}
                            title={canCancelOnlyFor(s) ? "Cancelar solicitação" : "Atualizar status"}
                            className={canCancelOnlyFor(s) ? "text-red-600" : "text-blue-600"}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleExcluir(s.id, s.nome_cliente)}
                          title="Excluir solicitação"
                          disabled={excluirMutation.isPending}
                          className="text-red-600"
                          data-testid={`button-delete-solicitacao-${s.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* ── Modal: Nova Solicitação ── */}
      <Dialog open={modalNova} onOpenChange={setModalNova}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Boleto</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="boleto">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="boleto" className="flex-1">Dados do Boleto</TabsTrigger>
              <TabsTrigger value="cliente" className="flex-1">Dados do Cliente</TabsTrigger>
            </TabsList>

            <TabsContent value="boleto" className="space-y-4">
              <div>
                <Label>Banco <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Ex: Banco do Brasil, Caixa, BMG..."
                  value={formBanco}
                  onChange={e => setFormBanco(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Tipo de Boleto <span className="text-red-500">*</span></Label>
                <Select value={formTipo} onValueChange={setFormTipo}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_BOLETO.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {exigeDigitosCartao && (
                <div>
                  <Label>4 últimos dígitos do cartão <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Ex: 1234"
                    value={formDigitosCartao}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "").substring(0, 4);
                      setFormDigitosCartao(v);
                    }}
                    maxLength={4}
                    className="mt-1"
                    data-testid="input-digitos-cartao"
                  />
                </div>
              )}
              <div>
                <Label>Valor</Label>
                <Input
                  placeholder="Ex: 1.500,00"
                  value={formValor}
                  onChange={e => setFormValor(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Informações adicionais para o operacional..."
                  value={formObs}
                  onChange={e => setFormObs(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="cliente" className="space-y-4">
              <div>
                <Label>Nome Completo <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Nome do cliente"
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>CPF <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="000.000.000-00"
                  value={formCpf}
                  onChange={e => setFormCpf(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={formNascimento}
                  onChange={e => setFormNascimento(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={formTelefone}
                  onChange={e => setFormTelefone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="cliente@email.com"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setModalNova(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleCriar}
              disabled={criarMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {criarMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
              ) : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Modal: Detalhes ── */}
      <Dialog open={!!modalDetalhe} onOpenChange={() => setModalDetalhe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação #{modalDetalhe?.id}</DialogTitle>
          </DialogHeader>
          {modalDetalhe && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <StatusBadge status={modalDetalhe.status} />
                <span className="text-xs text-gray-400">{formatData(modalDetalhe.created_at)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Banco</span><p className="font-medium">{modalDetalhe.banco}</p></div>
                <div><span className="text-gray-500">Tipo</span><p className="font-medium">{TIPOS_BOLETO.find(t=>t.value===modalDetalhe.tipo_boleto)?.label || modalDetalhe.tipo_boleto}</p></div>
                <div><span className="text-gray-500">Valor</span><p className="font-medium">{modalDetalhe.valor ? `R$ ${modalDetalhe.valor}` : "—"}</p></div>
                <div><span className="text-gray-500">Solicitado por</span><p className="font-medium">{modalDetalhe.solicitado_por_nome || "—"}</p></div>
                {modalDetalhe.ultimos_digitos_cartao && (
                  <div><span className="text-gray-500">Últimos 4 dígitos</span><p className="font-medium tracking-widest">**** {modalDetalhe.ultimos_digitos_cartao}</p></div>
                )}
              </div>
              <hr />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Nome do Cliente</span><p className="font-medium">{modalDetalhe.nome_cliente}</p></div>
                <div><span className="text-gray-500">CPF</span><p className="font-medium">{formatCpf(modalDetalhe.cpf_cliente)}</p></div>
                {modalDetalhe.data_nascimento && <div><span className="text-gray-500">Nascimento</span><p className="font-medium">{modalDetalhe.data_nascimento}</p></div>}
                {modalDetalhe.telefone && <div><span className="text-gray-500">Telefone</span><p className="font-medium">{modalDetalhe.telefone}</p></div>}
                {modalDetalhe.email && <div className="col-span-2"><span className="text-gray-500">E-mail</span><p className="font-medium">{modalDetalhe.email}</p></div>}
              </div>
              {modalDetalhe.observacao_vendedor && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <span className="text-gray-500 block mb-1">Obs. do Vendedor</span>
                  <p>{modalDetalhe.observacao_vendedor}</p>
                </div>
              )}
              {modalDetalhe.observacao_operacional && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <span className="text-blue-600 block mb-1 font-medium">Retorno do Operacional</span>
                  <p>{modalDetalhe.observacao_operacional}</p>
                </div>
              )}
              {modalDetalhe.boleto_anexo && (
                <div className="bg-green-50 rounded-lg p-3 text-sm">
                  <span className="text-green-700 block mb-2 font-medium">Boleto Anexado</span>
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-sm truncate flex-1">{modalDetalhe.boleto_anexo_nome || "boleto"}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadBoleto(modalDetalhe.boleto_anexo!, modalDetalhe.boleto_anexo_nome || "boleto")}
                      data-testid="button-download-boleto"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Baixar
                    </Button>
                    {modalDetalhe.boleto_anexo.startsWith("data:image") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(modalDetalhe.boleto_anexo!, "_blank")}
                        data-testid="button-view-boleto"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* ── Modal: Atualizar Status ── */}
      <Dialog open={!!modalStatus} onOpenChange={() => setModalStatus(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalStatus && canCancelOnlyFor(modalStatus)
                ? `Cancelar Solicitação — #${modalStatus.id}`
                : `Atualizar Status — #${modalStatus?.id}`}
            </DialogTitle>
          </DialogHeader>
          {modalStatus && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{modalStatus.nome_cliente}</span> · {modalStatus.banco}
              </div>
              {canCancelOnlyFor(modalStatus) ? (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  Você pode apenas cancelar esta solicitação. Selecione "Cancelado" para prosseguir.
                </div>
              ) : null}
              <div>
                <Label>Novo Status</Label>
                <Select value={novoStatus} onValueChange={setNovoStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(canCancelOnlyFor(modalStatus)
                      ? STATUS_OPERACIONAL.filter(s => s.value === "cancelado")
                      : STATUS_OPERACIONAL
                    ).map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observação / Retorno</Label>
                <Textarea
                  placeholder="Ex: Pendente selfie do cliente, aguardando retorno do banco..."
                  value={obsOperacional}
                  onChange={e => setObsOperacional(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div>
                <Label>Anexar Documento (opcional)
</Label>
                <div className="mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleBoletoFileChange}
                    className="hidden"
                    data-testid="input-boleto-file"
                  />
                  {boletoFile ? (
                    <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/50">
                      <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate flex-1">{boletoFile.nome}</span>
                      <Button size="icon" variant="ghost" onClick={() => { setBoletoFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} data-testid="button-remove-boleto-file">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : modalStatus?.boleto_anexo ? (
                    <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/50">
                      <Paperclip className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="text-sm truncate flex-1 text-green-700">{modalStatus.boleto_anexo_nome || "boleto_anexo"}</span>
                      <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} data-testid="button-replace-boleto">
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full" data-testid="button-upload-boleto">
                      <Upload className="w-4 h-4 mr-2" />
                      Selecionar arquivo (PDF ou Imagem)
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalStatus(null)}>Cancelar</Button>
            <Button
              onClick={handleAtualizarStatus}
              disabled={atualizarStatusMutation.isPending || !novoStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {atualizarStatusMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
