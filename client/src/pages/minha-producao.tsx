/**
 * Minha Produção — controle individual de produção e comissões.
 *
 * Benefício do plano de vendedor individual. É SEPARADO do Financeiro oficial:
 * consome só /api/minha-producao, que grava numa tabela própria.
 *
 * Formulário enxuto de propósito: prazo, parcela e os campos de recebimento
 * saíram daqui. O recebimento entra pela ação "marcar como recebido", que
 * pergunta a data e o valor já sugerindo o previsto.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, TrendingUp, Wallet, Clock, XCircle, CheckCircle2 } from "lucide-react";

interface Registro {
  id: number;
  clienteNome: string;
  clienteCpf: string | null;
  banco: string | null;
  convenio: string | null;
  tipoOperacao: string | null;
  parceiroNome: string | null;
  valorContrato: string;
  comissaoPrevista: string | null;
  comissaoRecebida: string | null;
  dataPrevistaPagamento: string | null;
  dataRecebimento: string | null;
  dataContrato: string;
  status: string;
  observacoes: string | null;
}

interface Resumo {
  vendas: number; valorVendido: number;
  comissaoPrevista: number; comissaoRecebida: number;
  comissaoAReceber: number; comissaoAtrasada: number;
  canceladas: number; valorCancelado: number;
}

const BRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeISO = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);

const STATUS_LABEL: Record<string, string> = {
  vendida: "Vendida", cancelada: "Cancelada", estornada: "Estornada",
};

const VAZIO = {
  clienteNome: "", clienteCpf: "", banco: "", convenio: "", tipoOperacao: "",
  parceiroNome: "", valorContrato: "", comissaoPrevista: "",
  dataContrato: hojeISO(), dataPrevistaPagamento: "",
  status: "vendida", observacoes: "",
};

export default function MinhaProducaoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Registro | null>(null);
  const [form, setForm] = useState({ ...VAZIO });
  const [recebendo, setRecebendo] = useState<Registro | null>(null);
  const [receb, setReceb] = useState({ valor: "", data: hojeISO() });

  const { data, isLoading } = useQuery<{ registros: Registro[]; resumo: Resumo }>({
    queryKey: ["/api/minha-producao", mes],
    queryFn: async () => {
      const res = await fetch(`/api/minha-producao?mes=${mes}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Erro ao carregar (HTTP ${res.status})`);
      return res.json();
    },
  });

  const { data: parceiros = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["/api/minha-producao/parceiros"],
    queryFn: async () => {
      const res = await fetch("/api/minha-producao/parceiros", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const registros = data?.registros ?? [];
  const r = data?.resumo;
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["/api/minha-producao"] });

  const salvarParceiro = useMutation({
    mutationFn: async (nome: string) => apiRequest("POST", "/api/minha-producao/parceiros", { nome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/minha-producao/parceiros"] });
      toast({ title: "Parceiro salvo para os próximos registros" });
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const metodo = editando ? "PATCH" : "POST";
      const url = editando ? `/api/minha-producao/${editando.id}` : "/api/minha-producao";
      const res = await apiRequest(metodo, url, form);
      return res.json();
    },
    onSuccess: () => {
      invalidar();
      setAberto(false);
      toast({ title: editando ? "Registro atualizado" : "Registro salvo" });
      // Parceiro digitado que ainda não está na lista: oferece guardar para reusar
      const nome = form.parceiroNome.trim();
      const jaSalvo = parceiros.some((p) => p.nome.toLowerCase() === nome.toLowerCase());
      if (nome && !jaSalvo && confirm(`Salvar "${nome}" para selecionar nos próximos registros?`)) {
        salvarParceiro.mutate(nome);
      }
    },
    onError: (e: Error) => toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" }),
  });

  const confirmarRecebimento = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/minha-producao/${recebendo!.id}/recebimento`, receb);
      return res.json();
    },
    onSuccess: () => { invalidar(); setRecebendo(null); toast({ title: "Recebimento registrado" }); },
    onError: (e: Error) => toast({ title: "Não foi possível registrar", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/minha-producao/${id}`),
    onSuccess: () => { invalidar(); toast({ title: "Registro excluído" }); },
    onError: (e: Error) => toast({ title: "Não foi possível excluir", description: e.message, variant: "destructive" }),
  });

  function abrirNovo() {
    setEditando(null);
    setForm({ ...VAZIO });
    setAberto(true);
  }

  function abrirEdicao(reg: Registro) {
    setEditando(reg);
    setForm({
      clienteNome: reg.clienteNome || "",
      clienteCpf: reg.clienteCpf || "",
      banco: reg.banco || "",
      convenio: reg.convenio || "",
      tipoOperacao: reg.tipoOperacao || "",
      parceiroNome: reg.parceiroNome || "",
      valorContrato: reg.valorContrato || "",
      comissaoPrevista: reg.comissaoPrevista || "",
      dataContrato: (reg.dataContrato || "").slice(0, 10),
      dataPrevistaPagamento: reg.dataPrevistaPagamento || "",
      status: reg.status || "vendida",
      observacoes: reg.observacoes || "",
    });
    setAberto(true);
  }

  function abrirRecebimento(reg: Registro) {
    setRecebendo(reg);
    // Valor já vem preenchido com o previsto; o vendedor ajusta se veio diferente
    setReceb({ valor: reg.comissaoPrevista || "", data: hojeISO() });
  }

  const campo = (k: keyof typeof VAZIO, label: string, tipo = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={k} className="text-xs">{label}</Label>
      <Input
        id={k}
        type={tipo}
        value={(form as any)[k]}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        data-testid={`input-${k}`}
      />
    </div>
  );

  const cards = [
    { titulo: "Vendido no mês", valor: BRL(r?.valorVendido || 0), nota: `${r?.vendas || 0} venda(s)`, Icon: TrendingUp, cor: "text-emerald-600 dark:text-emerald-400" },
    { titulo: "Comissão prevista", valor: BRL(r?.comissaoPrevista || 0), nota: `a receber ${BRL(r?.comissaoAReceber || 0)}`, Icon: Wallet, cor: "text-blue-600 dark:text-blue-400" },
    { titulo: "Comissão recebida", valor: BRL(r?.comissaoRecebida || 0), nota: "confirmada por você", Icon: CheckCircle2, cor: "text-violet-600 dark:text-violet-400" },
    { titulo: "Atrasada", valor: BRL(r?.comissaoAtrasada || 0), nota: "passou da data prevista", Icon: Clock, cor: "text-amber-600 dark:text-amber-400" },
    { titulo: "Cancelado", valor: BRL(r?.valorCancelado || 0), nota: `${r?.canceladas || 0} registro(s)`, Icon: XCircle, cor: "text-rose-600 dark:text-rose-400" },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Minha Produção</h1>
          <p className="text-sm text-muted-foreground">
            Seu controle de vendas e comissões. Só você enxerga estes registros.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value || mesAtual())} className="w-40" data-testid="input-mes" />
          <Button onClick={abrirNovo} data-testid="button-novo-registro">
            <Plus className="h-4 w-4 mr-1.5" /> Novo registro
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.titulo}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-xs font-medium flex items-center gap-1.5 ${c.cor}`}>
                <c.Icon className="h-3.5 w-3.5" /> {c.titulo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{c.valor}</p>
              <p className="text-[11px] text-muted-foreground">{c.nota}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : registros.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhum registro neste mês. Clique em "Novo registro" para lançar uma venda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead className="text-right">Contrato</TableHead>
                  <TableHead className="text-right">Comissão prevista</TableHead>
                  <TableHead className="text-right">Recebida</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((reg) => {
                  const falta = Number(reg.comissaoPrevista || 0) - Number(reg.comissaoRecebida || 0);
                  const ativo = reg.status === "vendida";
                  const atrasado = ativo && falta > 0 && !!reg.dataPrevistaPagamento && reg.dataPrevistaPagamento < hojeISO();
                  return (
                    <TableRow key={reg.id} data-testid={`row-registro-${reg.id}`}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(reg.dataContrato).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{reg.clienteNome}</span>
                        {reg.parceiroNome && (
                          <span className="block text-[11px] text-muted-foreground">via {reg.parceiroNome}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{reg.banco || "—"}</TableCell>
                      <TableCell className="text-sm">{reg.tipoOperacao || "—"}</TableCell>
                      <TableCell className="text-right">{BRL(Number(reg.valorContrato || 0))}</TableCell>
                      <TableCell className="text-right">{BRL(Number(reg.comissaoPrevista || 0))}</TableCell>
                      <TableCell className="text-right">
                        {reg.comissaoRecebida ? BRL(Number(reg.comissaoRecebida)) : "—"}
                        {reg.dataRecebimento && (
                          <span className="block text-[11px] text-muted-foreground">
                            {new Date(reg.dataRecebimento + "T12:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {ativo ? (
                          atrasado
                            ? <Badge variant="outline" className="border-amber-400 text-amber-600">Atrasada</Badge>
                            : <Badge variant="secondary">{STATUS_LABEL[reg.status]}</Badge>
                        ) : (
                          <Badge variant="destructive">{STATUS_LABEL[reg.status] || reg.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {ativo && falta > 0 && (
                            <Button
                              variant="ghost" size="icon" title="Marcar comissão como recebida"
                              onClick={() => abrirRecebimento(reg)}
                              data-testid={`button-receber-${reg.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => abrirEdicao(reg)} data-testid={`button-editar-${reg.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => { if (confirm(`Excluir o registro de ${reg.clienteNome}?`)) excluir.mutate(reg.id); }}
                            data-testid={`button-excluir-${reg.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cadastro */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar registro" : "Novo registro"}</DialogTitle>
            <DialogDescription>
              O registro já entra como venda. Use o status para cancelar ou estornar depois.
            </DialogDescription>
          </DialogHeader>

          {/* Opções de parceiro já salvas: digita e a lista filtra sozinha */}
          <datalist id="lista-parceiros">
            {parceiros.map((p) => <option key={p.id} value={p.nome} />)}
          </datalist>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2">{campo("clienteNome", "Cliente *")}</div>
            {campo("clienteCpf", "CPF")}
            {campo("banco", "Banco")}
            {campo("convenio", "Convênio")}
            {campo("tipoOperacao", "Tipo de operação")}
            <div className="space-y-1.5">
              <Label htmlFor="parceiroNome" className="text-xs">Parceiro</Label>
              <Input
                id="parceiroNome"
                list="lista-parceiros"
                value={form.parceiroNome}
                onChange={(e) => setForm((f) => ({ ...f, parceiroNome: e.target.value }))}
                placeholder="digite ou escolha"
                data-testid="input-parceiroNome"
              />
            </div>
            {campo("valorContrato", "Valor do contrato *")}
            {campo("comissaoPrevista", "Comissão prevista")}
            {campo("dataContrato", "Data da venda", "date")}
            {campo("dataPrevistaPagamento", "Data que entra a comissão", "date")}
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendida">Vendida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="estornada">Estornada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-3">{campo("observacoes", "Observações")}</div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} data-testid="button-salvar-registro">
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recebimento da comissão */}
      <Dialog open={!!recebendo} onOpenChange={(o) => { if (!o) setRecebendo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Comissão recebida</DialogTitle>
            <DialogDescription>
              {recebendo ? `Venda de ${recebendo.clienteNome}. Confira o valor e a data.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="receb-valor" className="text-xs">Quanto recebeu</Label>
              <Input
                id="receb-valor" value={receb.valor}
                onChange={(e) => setReceb((v) => ({ ...v, valor: e.target.value }))}
                data-testid="input-receb-valor"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receb-data" className="text-xs">Data do recebimento</Label>
              <Input
                id="receb-data" type="date" value={receb.data}
                onChange={(e) => setReceb((v) => ({ ...v, data: e.target.value }))}
                data-testid="input-receb-data"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecebendo(null)}>Cancelar</Button>
            <Button
              onClick={() => confirmarRecebimento.mutate()}
              disabled={confirmarRecebimento.isPending}
              data-testid="button-confirmar-recebimento"
            >
              {confirmarRecebimento.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
