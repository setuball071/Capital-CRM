// Caixa — conta-corrente consolidada das contas bancárias da empresa.
// Fase 1 do Financeiro Empresarial (Master-only).
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet, Upload, Plus, Landmark, Tags, Trash2, Pencil, RefreshCw,
} from "lucide-react";

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => (d ? d.split("-").reverse().join("/") : "—");
const mesAtual = () => new Date().toISOString().slice(0, 7);

interface Conta { id: number; nome: string; banco: string | null; cor: string; saldoInicial: string; saldoAtual: number; ativa: boolean; }
interface Categoria { id: number; nome: string; tipo: string; cor: string; tetoMensal: string | null; }
interface Regra { id: number; padraoTexto: string; categoriaId: number; }
interface Lancamento { id: number; contaId: number; data: string; valor: string; descricao: string | null; categoriaId: number | null; contaPagarId: number | null; origem: string; }

export default function FinCaixa() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [fConta, setFConta] = useState("");
  const [fCat, setFCat] = useState("");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [catLote, setCatLote] = useState("");
  const [regraTexto, setRegraTexto] = useState("");

  // Dialogs
  const [dlgConta, setDlgConta] = useState(false);
  const [contaEdit, setContaEdit] = useState<Conta | null>(null);
  const [dlgImport, setDlgImport] = useState(false);
  const [dlgLanc, setDlgLanc] = useState(false);
  const [dlgCats, setDlgCats] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importConta, setImportConta] = useState("");
  const [importando, setImportando] = useState(false);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["/api/fin/contas"] });
    qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
    qc.invalidateQueries({ queryKey: ["/api/fin/categorias"] });
  };

  const { data: contasData, isLoading: loadContas } = useQuery<{ contas: Conta[] }>({ queryKey: ["/api/fin/contas"] });
  const { data: catsData } = useQuery<{ categorias: Categoria[]; regras: Regra[] }>({ queryKey: ["/api/fin/categorias"] });
  const { data: lancData, isLoading: loadLanc } = useQuery<{ lancamentos: Lancamento[] }>({
    queryKey: ["fin-lancamentos", mes],
    queryFn: async () => {
      const params = mes ? `?de=${mes}-01&ate=${mes}-31` : "";
      const r = await fetch(`/api/fin/lancamentos${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar lançamentos");
      return r.json();
    },
  });

  const contas = contasData?.contas ?? [];
  const categorias = catsData?.categorias ?? [];
  const contaById = useMemo(() => new Map(contas.map(c => [c.id, c])), [contas]);
  const catById = useMemo(() => new Map(categorias.map(c => [c.id, c])), [categorias]);

  const lancamentos = useMemo(() => {
    let l = lancData?.lancamentos ?? [];
    if (fConta) l = l.filter(x => String(x.contaId) === fConta);
    if (fCat === "sem") l = l.filter(x => !x.categoriaId);
    else if (fCat) l = l.filter(x => String(x.categoriaId) === fCat);
    if (busca) {
      const b = busca.toLowerCase();
      l = l.filter(x => (x.descricao || "").toLowerCase().includes(b));
    }
    return l;
  }, [lancData, fConta, fCat, busca]);

  const saldoConsolidado = contas.filter(c => c.ativa).reduce((s, c) => s + (c.saldoAtual || 0), 0);
  const entradas = lancamentos.reduce((s, l) => s + Math.max(0, parseFloat(l.valor)), 0);
  const saidas = lancamentos.reduce((s, l) => s + Math.min(0, parseFloat(l.valor)), 0);
  const semCategoria = (lancData?.lancamentos ?? []).filter(l => !l.categoriaId).length;

  // ── Mutations ──
  const salvarConta = useMutation({
    mutationFn: async (body: any) =>
      contaEdit
        ? apiRequest("PATCH", `/api/fin/contas/${contaEdit.id}`, body)
        : apiRequest("POST", "/api/fin/contas", body),
    onSuccess: () => { toast({ title: "Conta salva" }); setDlgConta(false); setContaEdit(null); invalidar(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const criarLanc = useMutation({
    mutationFn: async (body: any) => apiRequest("POST", "/api/fin/lancamentos", body),
    onSuccess: () => { toast({ title: "Lançamento criado" }); setDlgLanc(false); invalidar(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Categorização inline (linha a linha) — essencial no fluxo pós-importação OFX
  const catInline = useMutation({
    mutationFn: async ({ id, categoriaId }: { id: number; categoriaId: number | null }) =>
      apiRequest("PATCH", "/api/fin/lancamentos/categorizar", { ids: [id], categoriaId }),
    onSuccess: () => invalidar(),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const categorizarLote = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/fin/lancamentos/categorizar", {
      ids: [...sel],
      categoriaId: catLote ? Number(catLote) : null,
      criarRegra: !!regraTexto.trim(),
      padraoTexto: regraTexto.trim() || undefined,
    }),
    onSuccess: () => {
      toast({ title: `${sel.size} lançamento(s) categorizados` });
      setSel(new Set()); setCatLote(""); setRegraTexto(""); invalidar();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  async function importarOfx() {
    const files = Array.from(fileRef.current?.files ?? []);
    if (!importConta) { toast({ title: "Selecione a conta bancária", variant: "destructive" }); return; }
    if (!files.length) { toast({ title: "Selecione o(s) arquivo(s) OFX", variant: "destructive" }); return; }
    setImportando(true);
    try {
      // Importa em sequência — o dedupe por FITID torna a ordem irrelevante
      let inseridos = 0, duplicados = 0, conciliadas = 0;
      let saldoCalibrado: number | null = null;
      const falhas: string[] = [];
      for (const file of files) {
        try {
          const fd = new FormData();
          fd.append("contaId", importConta);
          fd.append("arquivo", file);
          const r = await fetch("/api/fin/importar-ofx", { method: "POST", body: fd, credentials: "include" });
          const d = await r.json();
          if (!r.ok) throw new Error(d.message || "Erro");
          inseridos += d.inseridos || 0;
          duplicados += d.duplicados || 0;
          conciliadas += d.conciliadas || 0;
          if (d.saldoCalibrado != null) saldoCalibrado = d.saldoCalibrado;
        } catch (e: any) {
          falhas.push(`${file.name}: ${e.message}`);
        }
      }
      if (falhas.length === files.length) throw new Error(falhas.join(" · "));
      toast({
        title: `${files.length - falhas.length} arquivo(s) importado(s)`,
        description: `${inseridos} novos · ${duplicados} já existiam${conciliadas ? ` · ${conciliadas} conta(s) a pagar baixada(s)` : ""}${saldoCalibrado != null ? ` · saldo ajustado pelo extrato: ${fmtBRL(saldoCalibrado)}` : ""}${falhas.length ? ` · falhou: ${falhas.join("; ")}` : ""}`,
        variant: falhas.length ? "destructive" : undefined,
      });
      setDlgImport(false);
      if (fileRef.current) fileRef.current.value = "";
      invalidar();
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setImportando(false);
    }
  }

  // ── Categoria form (dialog gerenciar) ──
  const [catNome, setCatNome] = useState("");
  const [catTipo, setCatTipo] = useState("saida");
  const [catCor, setCatCor] = useState("#7c3aed");
  const criarCategoria = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/fin/categorias", { nome: catNome, tipo: catTipo, cor: catCor }),
    onSuccess: () => { setCatNome(""); invalidar(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
  const seedCategorias = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/fin/categorias/seed"),
    onSuccess: async (r) => {
      const d = await r.json();
      toast({
        title: d.criadas ? `${d.criadas} categorias criadas` : "Nada a criar",
        description: d.puladas ? `${d.puladas} já existiam e foram mantidas.` : undefined,
      });
      invalidar();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
  const delCategoria = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/fin/categorias/${id}`),
    onSuccess: () => invalidar(),
  });
  const delRegra = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/fin/regras/${id}`),
    onSuccess: () => invalidar(),
  });

  // ── Form nova conta / lançamento ──
  const [fcNome, setFcNome] = useState(""); const [fcBanco, setFcBanco] = useState("");
  const [fcCor, setFcCor] = useState("#7c3aed"); const [fcSaldo, setFcSaldo] = useState("");
  const [nlConta, setNlConta] = useState(""); const [nlData, setNlData] = useState(new Date().toISOString().slice(0, 10));
  const [nlValor, setNlValor] = useState(""); const [nlDesc, setNlDesc] = useState("");
  const [nlTipo, setNlTipo] = useState("saida"); const [nlCat, setNlCat] = useState("");

  function abrirNovaConta() {
    setContaEdit(null); setFcNome(""); setFcBanco(""); setFcCor("#7c3aed"); setFcSaldo(""); setDlgConta(true);
  }
  function abrirEditarConta(c: Conta) {
    setContaEdit(c); setFcNome(c.nome); setFcBanco(c.banco || ""); setFcCor(c.cor); setFcSaldo(c.saldoInicial); setDlgConta(true);
  }

  return (
    <div className="p-6 space-y-5 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> Caixa</h1>
          <p className="text-sm text-muted-foreground">Conta-corrente consolidada da empresa</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setDlgCats(true)}><Tags className="h-4 w-4 mr-1" /> Categorias</Button>
          <Button variant="outline" size="sm" onClick={abrirNovaConta}><Landmark className="h-4 w-4 mr-1" /> Nova Conta</Button>
          <Button variant="outline" size="sm" onClick={() => setDlgLanc(true)}><Plus className="h-4 w-4 mr-1" /> Lançamento</Button>
          <Button size="sm" onClick={() => setDlgImport(true)}><Upload className="h-4 w-4 mr-1" /> Importar Extrato (OFX)</Button>
        </div>
      </div>

      {/* Saldos */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Card className="border-primary/40">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo consolidado</p>
            <p className={`text-2xl font-bold ${saldoConsolidado < 0 ? "text-red-600" : "text-primary"}`}>{fmtBRL(saldoConsolidado)}</p>
          </CardContent>
        </Card>
        {contas.filter(c => c.ativa).map(c => (
          <Card key={c.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => abrirEditarConta(c)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c.cor }} />
                <p className="text-xs uppercase tracking-wide text-muted-foreground truncate">{c.nome}</p>
                <Pencil className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
              </div>
              <p className={`text-xl font-bold ${c.saldoAtual < 0 ? "text-red-600" : ""}`}>{fmtBRL(c.saldoAtual)}</p>
            </CardContent>
          </Card>
        ))}
        {!loadContas && contas.length === 0 && (
          <Card className="border-dashed"><CardContent className="p-4 text-sm text-muted-foreground">
            Cadastre suas contas (Nubank, Santander, Unicred, C6) em <b>Nova Conta</b> e importe o primeiro OFX.
          </CardContent></Card>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-40" />
        <Select value={fConta || "all"} onValueChange={v => setFConta(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {contas.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fCat || "all"} onValueChange={v => setFCat(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            <SelectItem value="sem">— Sem categoria —</SelectItem>
            {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="🔍 Buscar na descrição..." value={busca} onChange={e => setBusca(e.target.value)} className="w-56" />
        <Button variant="ghost" size="sm" onClick={invalidar}><RefreshCw className="h-4 w-4" /></Button>
        <div className="ml-auto flex gap-4 text-sm">
          <span className="text-green-600 font-semibold">↑ {fmtBRL(entradas)}</span>
          <span className="text-red-600 font-semibold">↓ {fmtBRL(Math.abs(saidas))}</span>
          {semCategoria > 0 && <span className="text-amber-600">{semCategoria} sem categoria</span>}
        </div>
      </div>

      {/* Barra de categorização em lote */}
      {sel.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap rounded-lg border border-primary/40 border-l-4 border-l-primary bg-card p-3 shadow-sm">
          <span className="text-sm font-semibold">{sel.size} selecionado(s)</span>
          <Select value={catLote} onValueChange={setCatLote}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Escolher categoria..." /></SelectTrigger>
            <SelectContent>
              {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder='Criar regra: texto contém... (opcional)' value={regraTexto} onChange={e => setRegraTexto(e.target.value)} className="w-64" />
          <Button size="sm" disabled={!catLote || categorizarLote.isPending} onClick={() => categorizarLote.mutate()}>
            Aplicar categoria
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Limpar</Button>
        </div>
      )}

      {/* Extrato */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={lancamentos.length > 0 && sel.size === lancamentos.length}
                    onCheckedChange={(v) => setSel(v ? new Set(lancamentos.map(l => l.id)) : new Set())}
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadLanc ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : lancamentos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Nenhum lançamento no período — importe um extrato OFX para começar.
                </TableCell></TableRow>
              ) : lancamentos.map(l => {
                const v = parseFloat(l.valor);
                const conta = contaById.get(l.contaId);
                const cat = l.categoriaId ? catById.get(l.categoriaId) : null;
                return (
                  <TableRow key={l.id} className={sel.has(l.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox checked={sel.has(l.id)} onCheckedChange={(ck) => {
                        const n = new Set(sel); ck ? n.add(l.id) : n.delete(l.id); setSel(n);
                      }} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtData(l.data)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ background: conta?.cor || "#999" }} />
                        {conta?.nome || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[380px] truncate text-sm" title={l.descricao || ""}>
                      {l.descricao || "—"}
                      {l.contaPagarId && <span className="ml-2 text-[10px] text-green-600 font-semibold">✓ conciliado</span>}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={l.categoriaId ? String(l.categoriaId) : "none"}
                        onValueChange={(v) => {
                          if (v === "__nova") { setDlgCats(true); return; }
                          catInline.mutate({ id: l.id, categoriaId: v === "none" ? null : Number(v) });
                        }}
                      >
                        <SelectTrigger className="h-7 w-44 text-xs border-dashed bg-transparent">
                          {cat ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium truncate" style={{ background: `${cat.cor}22`, color: cat.cor }}>{cat.nome}</span>
                          ) : (
                            <span className="text-xs text-amber-600">sem categoria</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— sem categoria —</SelectItem>
                          {categorias.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ background: c.cor }} />
                                {c.nome}
                              </span>
                            </SelectItem>
                          ))}
                          <SelectItem value="__nova">＋ Criar nova categoria...</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className={`text-right font-semibold whitespace-nowrap ${v < 0 ? "text-red-600" : "text-green-600"}`}>
                      {fmtBRL(v)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: nova/editar conta */}
      <Dialog open={dlgConta} onOpenChange={setDlgConta}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{contaEdit ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Apelido</Label><Input value={fcNome} onChange={e => setFcNome(e.target.value)} placeholder="Nubank PJ" /></div>
            <div><Label>Banco</Label><Input value={fcBanco} onChange={e => setFcBanco(e.target.value)} placeholder="Nubank" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cor</Label><Input type="color" value={fcCor} onChange={e => setFcCor(e.target.value)} /></div>
              <div><Label>Saldo inicial (R$)</Label><Input type="number" step="0.01" value={fcSaldo} onChange={e => setFcSaldo(e.target.value)} placeholder="0,00" /></div>
            </div>
            <p className="text-xs text-muted-foreground">O saldo inicial é o saldo da conta na data em que você começa a importar extratos.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgConta(false)}>Cancelar</Button>
            <Button disabled={salvarConta.isPending} onClick={() => salvarConta.mutate({ nome: fcNome, banco: fcBanco, cor: fcCor, saldoInicial: fcSaldo || 0 })}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: importar OFX */}
      <Dialog open={dlgImport} onOpenChange={setDlgImport}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar Extrato (OFX)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Conta bancária</Label>
              <Select value={importConta} onValueChange={setImportConta}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.filter(c => c.ativa).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Arquivo(s) OFX — pode selecionar vários</Label><Input ref={fileRef} type="file" accept=".ofx,.OFX,.qfx,.ofc,.money" multiple /></div>
            <p className="text-xs text-muted-foreground">
              Importar o mesmo arquivo duas vezes não duplica nada — cada transação tem identificador único.
              Débitos que baterem com contas a pagar em aberto são baixados automaticamente, e o saldo da
              conta é calibrado pelo saldo oficial que vem dentro do extrato.
              <br />No <b>Santander</b>, exporte pela opção <b>"Money 2000 e superior"</b> — é o formato OFX.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgImport(false)}>Cancelar</Button>
            <Button disabled={importando} onClick={importarOfx}>{importando ? "Importando..." : "Importar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: lançamento manual */}
      <Dialog open={dlgLanc} onOpenChange={setDlgLanc}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Lançamento Manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Conta</Label>
                <Select value={nlConta} onValueChange={setNlConta}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{contas.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data</Label><Input type="date" value={nlData} onChange={e => setNlData(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={nlTipo} onValueChange={setNlTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada (+)</SelectItem>
                    <SelectItem value="saida">Saída (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0.01" value={nlValor} onChange={e => setNlValor(e.target.value)} /></div>
            </div>
            <div><Label>Descrição</Label><Input value={nlDesc} onChange={e => setNlDesc(e.target.value)} /></div>
            <div>
              <Label>Categoria (opcional)</Label>
              <Select value={nlCat} onValueChange={setNlCat}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgLanc(false)}>Cancelar</Button>
            <Button disabled={criarLanc.isPending} onClick={() => {
              const v = Math.abs(parseFloat(nlValor) || 0) * (nlTipo === "saida" ? -1 : 1);
              criarLanc.mutate({ contaId: nlConta, data: nlData, valor: v, descricao: nlDesc, categoriaId: nlCat || null });
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: categorias + regras */}
      <Dialog open={dlgCats} onOpenChange={setDlgCats}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Categorias e Regras</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[140px]"><Label>Nova categoria</Label><Input value={catNome} onChange={e => setCatNome(e.target.value)} placeholder="Marketing" /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={catTipo} onValueChange={setCatTipo}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Cor</Label><Input type="color" value={catCor} onChange={e => setCatCor(e.target.value)} className="w-16" /></div>
              <Button size="sm" disabled={!catNome.trim() || criarCategoria.isPending} onClick={() => criarCategoria.mutate()}>Criar</Button>
            </div>
            <div className="space-y-1.5">
              {categorias.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} />
                  <span className="font-medium">{c.nome}</span>
                  <span className="text-xs text-muted-foreground">{c.tipo}</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0" onClick={() => delCategoria.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              {categorias.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria ainda — use o botão abaixo para criar o kit padrão da operação.</p>}
            </div>
            <div className="rounded-lg border border-dashed p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium">Kit padrão de categorias</p>
                <p className="text-xs text-muted-foreground">Cria as categorias comuns da operação (aluguel, folha, impostos, tráfego pago, dízimo, etc.). Não duplica o que já existe.</p>
              </div>
              <Button size="sm" variant="outline" disabled={seedCategorias.isPending} onClick={() => seedCategorias.mutate()}>
                {seedCategorias.isPending ? "Criando..." : "Criar categorias padrão"}
              </Button>
            </div>
            {(catsData?.regras?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm font-semibold mb-1.5">Regras de auto-categorização</p>
                <div className="space-y-1.5">
                  {catsData!.regras.map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs border rounded-md px-3 py-1.5">
                      <span>descrição contém <b>"{r.padraoTexto}"</b> → {catById.get(r.categoriaId)?.nome || "?"}</span>
                      <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => delRegra.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
