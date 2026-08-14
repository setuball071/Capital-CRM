// Contas a Pagar — à vista, a prazo, parceladas e recorrentes, com painel
// mensal (em dia / vencendo / atrasada) e boleto por linha digitável.
// Fase 2 do Financeiro Empresarial (Master-only).
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, Plus, Barcode, CheckCircle2, Undo2, Trash2, XCircle } from "lucide-react";

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const mesAtual = () => new Date().toISOString().slice(0, 7);

interface ContaPagar {
  id: number; descricao: string; fornecedor: string | null; categoriaId: number | null;
  contaId: number | null; valor: string; vencimento: string; tipo: string;
  parcelaNum: number | null; parcelaTotal: number | null; grupoParcelamento: string | null;
  recorrente: boolean; status: string; dataPagamento: string | null;
  lancamentoId: number | null; boletoCodigo: string | null; observacao: string | null;
  statusDerivado: "paga" | "cancelada" | "atrasada" | "vencendo" | "em_dia";
}

const BADGE: Record<string, { label: string; cls: string }> = {
  em_dia:   { label: "Em dia",    cls: "bg-green-500/15 text-green-600" },
  vencendo: { label: "Vencendo",  cls: "bg-amber-500/15 text-amber-600" },
  atrasada: { label: "Em atraso", cls: "bg-red-500/15 text-red-600" },
  paga:     { label: "Paga",      cls: "bg-blue-500/15 text-blue-600" },
  cancelada:{ label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

export default function FinContasPagar() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [fStatus, setFStatus] = useState("");
  const [dlg, setDlg] = useState(false);

  const { data: cpData, isLoading } = useQuery<{ contas: ContaPagar[] }>({
    queryKey: ["fin-cp", mes],
    queryFn: async () => {
      const r = await fetch(`/api/fin/contas-pagar?mes=${mes}`, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar");
      return r.json();
    },
  });
  const { data: catsData } = useQuery<{ categorias: any[] }>({ queryKey: ["/api/fin/categorias"] });
  const { data: contasData } = useQuery<{ contas: any[] }>({ queryKey: ["/api/fin/contas"] });
  const categorias = catsData?.categorias ?? [];
  const contasBancarias = contasData?.contas ?? [];
  const catById = useMemo(() => new Map(categorias.map((c: any) => [c.id, c])), [categorias]);

  const todas = cpData?.contas ?? [];
  const lista = fStatus ? todas.filter(c => c.statusDerivado === fStatus) : todas;

  const tot = (st: string) => todas.filter(c => c.statusDerivado === st).reduce((s, c) => s + parseFloat(c.valor), 0);
  const nSt = (st: string) => todas.filter(c => c.statusDerivado === st).length;
  const totalMes = todas.filter(c => c.status !== "cancelada").reduce((s, c) => s + parseFloat(c.valor), 0);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["fin-cp"] });
    qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
  };

  const acaoMut = useMutation({
    mutationFn: async ({ id, acao }: { id: number; acao: string }) =>
      apiRequest("PATCH", `/api/fin/contas-pagar/${id}`, { acao }),
    onSuccess: (_r, v) => {
      toast({ title: v.acao === "pagar" ? "Conta baixada" : v.acao === "reabrir" ? "Conta reaberta" : "Conta cancelada" });
      invalidar();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: async ({ id, grupo }: { id: number; grupo: boolean }) =>
      apiRequest("DELETE", `/api/fin/contas-pagar/${id}${grupo ? "?grupo=1" : ""}`),
    onSuccess: () => { toast({ title: "Excluída" }); invalidar(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Form nova conta ──
  const [fDesc, setFDesc] = useState(""); const [fForn, setFForn] = useState("");
  const [fCat, setFCat] = useState(""); const [fContaB, setFContaB] = useState("");
  const [fValor, setFValor] = useState(""); const [fVenc, setFVenc] = useState(new Date().toISOString().slice(0, 10));
  const [fTipo, setFTipo] = useState("avista"); const [fParcelas, setFParcelas] = useState("2");
  const [fBoleto, setFBoleto] = useState(""); const [fObs, setFObs] = useState("");
  const [decodificando, setDecodificando] = useState(false);

  const criarMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/fin/contas-pagar", {
      descricao: fDesc, fornecedor: fForn, categoriaId: fCat || null, contaId: fContaB || null,
      valor: fValor, vencimento: fVenc,
      tipo: fTipo === "recorrente" ? "avista" : fTipo,
      parcelas: fTipo === "parcelada" ? Number(fParcelas) : 1,
      recorrente: fTipo === "recorrente",
      boletoCodigo: fBoleto || null, observacao: fObs || null,
    }),
    onSuccess: async (r) => {
      const d = await r.json();
      toast({ title: d.parcelasGeradas ? `${d.parcelasGeradas} parcelas geradas` : "Conta criada" });
      setDlg(false);
      setFDesc(""); setFForn(""); setFCat(""); setFContaB(""); setFValor(""); setFBoleto(""); setFObs("");
      invalidar();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  async function decodificarBoleto() {
    if (!fBoleto.trim()) return;
    setDecodificando(true);
    try {
      const r = await apiRequest("POST", "/api/fin/decodificar-boleto", { linha: fBoleto });
      const d = await r.json();
      if (d.valor) setFValor(String(d.valor));
      if (d.vencimento) setFVenc(d.vencimento);
      toast({
        title: "Boleto lido",
        description: `${d.valor ? `Valor ${fmtBRL(d.valor)}` : "Valor não identificado"}${d.vencimento ? ` · vence ${fmtData(d.vencimento)}` : ""}${d.banco ? ` · banco ${d.banco}` : ""}`,
      });
    } catch (e: any) {
      toast({ title: "Não consegui ler o boleto", description: e.message, variant: "destructive" });
    } finally {
      setDecodificando(false);
    }
  }

  const kpi = (st: string, onClick: () => void, ativo: boolean) => (
    <Card
      className={`cursor-pointer transition-colors ${ativo ? "border-primary" : "hover:border-primary/40"}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${BADGE[st].cls}`}>{BADGE[st].label}</span>
        <p className="text-xl font-bold mt-1.5">{fmtBRL(tot(st))}</p>
        <p className="text-xs text-muted-foreground">{nSt(st)} conta(s)</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock className="h-6 w-6 text-primary" /> Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">À vista, a prazo, parceladas e recorrentes — com baixa automática pelo extrato</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-40" />
          <Button size="sm" onClick={() => setDlg(true)}><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
        </div>
      </div>

      {/* KPIs clicáveis (filtram) */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Card className={`cursor-pointer ${!fStatus ? "border-primary" : ""}`} onClick={() => setFStatus("")}>
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Total do mês</p>
            <p className="text-xl font-bold mt-1.5 text-primary">{fmtBRL(totalMes)}</p>
            <p className="text-xs text-muted-foreground">{todas.length} conta(s)</p>
          </CardContent>
        </Card>
        {kpi("em_dia", () => setFStatus(fStatus === "em_dia" ? "" : "em_dia"), fStatus === "em_dia")}
        {kpi("vencendo", () => setFStatus(fStatus === "vencendo" ? "" : "vencendo"), fStatus === "vencendo")}
        {kpi("atrasada", () => setFStatus(fStatus === "atrasada" ? "" : "atrasada"), fStatus === "atrasada")}
        {kpi("paga", () => setFStatus(fStatus === "paga" ? "" : "paga"), fStatus === "paga")}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : lista.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma conta neste mês.</TableCell></TableRow>
              ) : lista.map(c => {
                const cat = c.categoriaId ? catById.get(c.categoriaId) : null;
                const b = BADGE[c.statusDerivado];
                return (
                  <TableRow key={c.id} className={c.status === "cancelada" ? "opacity-50" : ""}>
                    <TableCell className="whitespace-nowrap font-medium">{fmtData(c.vencimento)}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="truncate font-medium" title={c.descricao}>{c.descricao}</div>
                      {c.lancamentoId && <span className="text-[10px] text-green-600 font-semibold">✓ baixada pelo extrato</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.fornecedor || "—"}</TableCell>
                    <TableCell>
                      {cat ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${cat.cor}22`, color: cat.cor }}>{cat.nome}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.tipo === "parcelada" ? `Parcela ${c.parcelaNum}/${c.parcelaTotal}` : c.recorrente ? "Recorrente" : c.tipo === "prazo" ? "A prazo" : "À vista"}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">{fmtBRL(parseFloat(c.valor))}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                      {c.status === "paga" && c.dataPagamento && <div className="text-[10px] text-muted-foreground mt-0.5">{fmtData(c.dataPagamento)}</div>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {c.status === "aberta" && (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 px-2" title="Marcar como paga" onClick={() => acaoMut.mutate({ id: c.id, acao: "pagar" })}>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2" title="Cancelar" onClick={() => acaoMut.mutate({ id: c.id, acao: "cancelar" })}>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                      {c.status === "paga" && (
                        <Button variant="ghost" size="sm" className="h-8 px-2" title="Reabrir" onClick={() => acaoMut.mutate({ id: c.id, acao: "reabrir" })}>
                          <Undo2 className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 px-2" title={c.grupoParcelamento ? "Excluir (parcelas abertas do grupo)" : "Excluir"}
                        onClick={() => {
                          const grupo = !!c.grupoParcelamento && window.confirm("Excluir TODAS as parcelas em aberto deste parcelamento? (OK = todas · Cancelar = só esta)");
                          delMut.mutate({ id: c.id, grupo });
                        }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog nova conta */}
      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Boleto (linha digitável) — opcional</Label>
              <div className="flex gap-2">
                <Input value={fBoleto} onChange={e => setFBoleto(e.target.value)} placeholder="Cole a linha digitável para preencher valor e vencimento" />
                <Button variant="outline" size="sm" className="shrink-0" disabled={decodificando || !fBoleto.trim()} onClick={decodificarBoleto}>
                  <Barcode className="h-4 w-4 mr-1" /> Ler
                </Button>
              </div>
            </div>
            <div><Label>Descrição *</Label><Input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Aluguel do escritório" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fornecedor</Label><Input value={fForn} onChange={e => setFForn(e.target.value)} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={fCat} onValueChange={setFCat}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{categorias.filter((c: any) => c.tipo === "saida").map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor total (R$) *</Label><Input type="number" step="0.01" min="0.01" value={fValor} onChange={e => setFValor(e.target.value)} /></div>
              <div><Label>Vencimento (1ª parcela) *</Label><Input type="date" value={fVenc} onChange={e => setFVenc(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Forma</Label>
                <Select value={fTipo} onValueChange={setFTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avista">À vista</SelectItem>
                    <SelectItem value="prazo">A prazo</SelectItem>
                    <SelectItem value="parcelada">Parcelada</SelectItem>
                    <SelectItem value="recorrente">Recorrente (mensal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {fTipo === "parcelada" && (
                <div><Label>Nº de parcelas</Label><Input type="number" min="2" max="120" value={fParcelas} onChange={e => setFParcelas(e.target.value)} /></div>
              )}
              <div className={fTipo === "parcelada" ? "col-span-2" : ""}>
                <Label>Conta de débito</Label>
                <Select value={fContaB} onValueChange={setFContaB}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{contasBancarias.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {fTipo === "parcelada" && fValor && Number(fParcelas) > 1 && (
              <p className="text-xs text-muted-foreground">
                Serão geradas {fParcelas} parcelas de ~{fmtBRL(parseFloat(fValor) / Number(fParcelas))} com vencimentos mensais a partir de {fmtData(fVenc)}.
              </p>
            )}
            {fTipo === "recorrente" && (
              <p className="text-xs text-muted-foreground">Ao pagar, a conta do mês seguinte é criada automaticamente.</p>
            )}
            <div><Label>Observação</Label><Textarea rows={2} value={fObs} onChange={e => setFObs(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(false)}>Cancelar</Button>
            <Button disabled={criarMut.isPending || !fDesc.trim() || !fValor || !fVenc} onClick={() => criarMut.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
