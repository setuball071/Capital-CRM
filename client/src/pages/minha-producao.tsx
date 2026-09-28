/**
 * Minha Produção — controle individual de produção e comissões.
 *
 * Benefício do plano de vendedor individual. É SEPARADO do Financeiro oficial:
 * consome só /api/minha-producao, que grava numa tabela própria. Um registro aqui
 * já é uma venda; cancelamento e estorno viram status e saem dos totais.
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
import { Plus, Pencil, Trash2, TrendingUp, Wallet, Clock, XCircle } from "lucide-react";

interface Registro {
  id: number;
  clienteNome: string;
  clienteCpf: string | null;
  banco: string | null;
  convenio: string | null;
  tipoOperacao: string | null;
  prazo: number | null;
  valorContrato: string;
  valorParcela: string | null;
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

const BRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<string, string> = {
  vendida: "Vendida",
  cancelada: "Cancelada",
  estornada: "Estornada",
};

const mesAtual = () => new Date().toISOString().slice(0, 7);

const VAZIO = {
  clienteNome: "", clienteCpf: "", banco: "", convenio: "", tipoOperacao: "",
  prazo: "", valorContrato: "", valorParcela: "",
  comissaoPrevista: "", comissaoRecebida: "",
  dataPrevistaPagamento: "", dataRecebimento: "",
  dataContrato: new Date().toISOString().slice(0, 10),
  status: "vendida", observacoes: "",
};

export default function MinhaProducaoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Registro | null>(null);
  const [form, setForm] = useState({ ...VAZIO });

  const { data, isLoading } = useQuery<{ registros: Registro[]; resumo: Resumo }>({
    queryKey: ["/api/minha-producao", mes],
    queryFn: async () => {
      const res = await fetch(`/api/minha-producao?mes=${mes}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Erro ao carregar (HTTP ${res.status})`);
      return res.json();
    },
  });

  const registros = data?.registros ?? [];
  const r = data?.resumo;
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["/api/minha-producao"] });

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
    },
    onError: (e: Error) => toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" }),
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
      prazo: reg.prazo != null ? String(reg.prazo) : "",
      valorContrato: reg.valorContrato || "",
      valorParcela: reg.valorParcela || "",
      comissaoPrevista: reg.comissaoPrevista || "",
      comissaoRecebida: reg.comissaoRecebida || "",
      dataPrevistaPagamento: reg.dataPrevistaPagamento || "",
      dataRecebimento: reg.dataRecebimento || "",
      dataContrato: (reg.dataContrato || "").slice(0, 10),
      status: reg.status || "vendida",
      observacoes: reg.observacoes || "",
    });
    setAberto(true);
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
    { titulo: "Comissão recebida", valor: BRL(r?.comissaoRecebida || 0), nota: "confirmada por você", Icon: Wallet, cor: "text-violet-600 dark:text-violet-400" },
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
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value || mesAtual())}
            className="w-40"
            data-testid="input-mes"
          />
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
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((reg) => {
                  const falta = Number(reg.comissaoPrevista || 0) - Number(reg.comissaoRecebida || 0);
                  const atrasado = reg.status === "vendida" && falta > 0 && !!reg.dataPrevistaPagamento
                    && reg.dataPrevistaPagamento < new Date().toISOString().slice(0, 10);
                  return (
                    <TableRow key={reg.id} data-testid={`row-registro-${reg.id}`}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(reg.dataContrato).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium">{reg.clienteNome}</TableCell>
                      <TableCell className="text-sm">{reg.banco || "—"}</TableCell>
                      <TableCell className="text-sm">{reg.tipoOperacao || "—"}</TableCell>
                      <TableCell className="text-right">{BRL(Number(reg.valorContrato || 0))}</TableCell>
                      <TableCell className="text-right">{BRL(Number(reg.comissaoPrevista || 0))}</TableCell>
                      <TableCell className="text-right">{BRL(Number(reg.comissaoRecebida || 0))}</TableCell>
                      <TableCell>
                        {reg.status === "vendida" ? (
                          atrasado
                            ? <Badge variant="outline" className="border-amber-400 text-amber-600">Atrasada</Badge>
                            : <Badge variant="secondary">{STATUS_LABEL[reg.status]}</Badge>
                        ) : (
                          <Badge variant="destructive">{STATUS_LABEL[reg.status] || reg.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
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

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar registro" : "Novo registro"}</DialogTitle>
            <DialogDescription>
              O registro já entra como venda. Use o status para cancelar ou estornar depois.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-2">{campo("clienteNome", "Cliente *")}</div>
            {campo("clienteCpf", "CPF")}
            {campo("banco", "Banco")}
            {campo("convenio", "Convênio")}
            {campo("tipoOperacao", "Tipo de operação")}
            {campo("valorContrato", "Valor do contrato *")}
            {campo("valorParcela", "Parcela")}
            {campo("prazo", "Prazo (meses)", "number")}
            {campo("comissaoPrevista", "Comissão prevista")}
            {campo("comissaoRecebida", "Comissão recebida")}
            {campo("dataContrato", "Data da venda", "date")}
            {campo("dataPrevistaPagamento", "Previsão de pagamento", "date")}
            {campo("dataRecebimento", "Data do recebimento", "date")}
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
    </div>
  );
}
