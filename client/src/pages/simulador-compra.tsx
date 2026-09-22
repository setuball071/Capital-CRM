// ═══════════════════════════════════════════════════════════════════════════
// SIMULADOR DE COMPRA — o formato da planilha do Fábio: margem e saldo uma vez,
// todas as tabelas lado a lado. Conta em shared/compra/calculo.ts.
// Tabelas próprias (separadas do Financeiro); só o master cadastra e só ele vê
// percentual e comissão — o servidor nem manda o percentual para o corretor.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { calcularCompra, type TabelaCompra } from "@shared/compra/calculo";

interface TabelaApi extends TabelaCompra { id: number; ativo: boolean }

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/40";
const labelCls = "block text-[11px] font-semibold text-muted-foreground mb-1";
const cardCls = "rounded-xl border border-border bg-card p-4";

/** "R$ 3.442,06" / "154,36" / "0.0428" → número; vazio ou inválido = 0 */
function num(v: string): number {
  let s = String(v || "").replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + "%";
const coefTxt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 10 });

async function chamar(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || "Erro " + r.status);
  return j;
}

type Ordem = "padrao" | "banco" | "bruto" | "liberado" | "comissao";

export default function SimuladorCompra() {
  const { user } = useAuth();
  const master = Boolean(user?.isMaster || user?.role === "master");
  const [tabelas, setTabelas] = useState<TabelaApi[]>([]);
  const [podeVerCom, setVerCom] = useState(false);
  // master tirando print para o operacional: esconde percentual e comissão (só a tela)
  const [ocultarCom, setOcultarCom] = useState(false);
  const verCom = podeVerCom && !ocultarCom;
  const [erro, setErro] = useState("");
  const [parcela, setParcela] = useState("");
  const [fator, setFator] = useState("23");
  const [saldo, setSaldo] = useState("");
  const [margem, setMargem] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("padrao");
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [bancoFiltro, setBancoFiltro] = useState<string>("");   // "" = todos
  const [convenio, setConvenio] = useState<string>("");

  const carregar = useCallback(async () => {
    try {
      const j = await chamar("/api/compra/tabelas", "GET");
      setTabelas(j.tabelas || []); setVerCom(j.comissaoVisivel === true); setErro("");
    } catch (e: any) { setErro(e.message); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // cada tabela vale para um convênio: o simulador só mostra as do convênio escolhido
  const convenios = useMemo(() => Array.from(new Set(tabelas.filter(t => t.ativo !== false).map(t => t.convenio || "SIAPE"))).sort(), [tabelas]);
  const convAtual = convenios.includes(convenio) ? convenio : (convenios.includes("SIAPE") ? "SIAPE" : convenios[0] || "");
  const doConvenio = useMemo(() => tabelas.filter(t => t.ativo !== false && (t.convenio || "SIAPE") === convAtual), [tabelas, convAtual]);

  const res = useMemo(() => calcularCompra(
    { parcela: num(parcela), fator: num(fator), saldoReal: num(saldo), margem: num(margem) },
    doConvenio,
  ), [parcela, fator, saldo, margem, doConvenio]);

  const bancos = useMemo(() => Array.from(new Set(doConvenio.map(t => t.banco))).sort((a, b) => a.localeCompare(b, "pt-BR")), [doConvenio]);
  const linhas = useMemo(() => {
    const l = res.linhas.filter(x => !bancoFiltro || !bancos.includes(bancoFiltro) || x.tabela.banco === bancoFiltro);
    if (ordem === "banco") l.sort((a, b) => a.tabela.banco.localeCompare(b.tabela.banco, "pt-BR"));
    if (ordem === "bruto") l.sort((a, b) => b.bruto - a.bruto);
    if (ordem === "liberado") l.sort((a, b) => b.liberado - a.liberado);
    if (ordem === "comissao") l.sort((a, b) => (b.comissao ?? 0) - (a.comissao ?? 0));
    return l;
  }, [res, ordem, bancoFiltro, bancos]);

  const marcar = (id: number) => setMarcadas(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const limpar = () => { setParcela(""); setSaldo(""); setMargem(""); setFator("23"); setMarcadas(new Set()); };

  const Th = ({ k, children, right = true }: { k?: Ordem; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground ${right ? "text-right" : "text-left"}`}>
      {k ? <button onClick={() => setOrdem(ordem === k ? "padrao" : k)} className={`uppercase ${ordem === k ? "text-violet-600" : ""}`}>
        {children}{ordem === k ? " ↓" : ""}</button> : children}
    </th>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Simulador de Compra</h1>
        <p className="text-sm text-muted-foreground">Informe a parcela, o saldo e a margem uma vez: todas as tabelas aparecem lado a lado.</p>
      </div>

      <div className={cardCls}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div><label className={labelCls}>Convênio</label>
            <select className={inputCls} value={convAtual} onChange={e => { setConvenio(e.target.value); setMarcadas(new Set()); }} disabled={!convenios.length}>
              {convenios.length ? convenios.map(c => <option key={c} value={c}>{c}</option>) : <option value="">—</option>}
            </select></div>
          <div><label className={labelCls}>Parcela na folha</label>
            <input className={inputCls} inputMode="decimal" placeholder="154,36" value={parcela} onChange={e => setParcela(e.target.value)} /></div>
          <div><label className={labelCls}>Saldo do banco (se tiver)</label>
            <input className={inputCls} inputMode="decimal" placeholder="3.442,06" value={saldo} onChange={e => setSaldo(e.target.value)} /></div>
          <div><label className={labelCls}>Fator p/ estimar o saldo</label>
            <input className={inputCls} inputMode="decimal" value={fator} disabled={num(saldo) > 0} onChange={e => setFator(e.target.value)} /></div>
          <div><label className={labelCls}>Margem para a compra</label>
            <input className={inputCls} inputMode="decimal" placeholder={parcela ? `igual à parcela (${parcela})` : "250,00"} value={margem} onChange={e => setMargem(e.target.value)} /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>Saldo usado: <b>{brl(res.saldo)}</b>{" "}
            {res.saldo > 0 && (res.saldoEstimado
              ? <span className="ml-1 rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[11px] font-semibold">estimado: parcela × {fator || 0}</span>
              : <span className="ml-1 rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[11px] font-semibold">saldo do banco</span>)}
          </span>
          <span>Margem usada: <b>{brl(res.margemUsada)}</b>{res.margemEhParcela && res.margemUsada > 0 && <span className="text-muted-foreground"> (a parcela)</span>}</span>
          {podeVerCom && <button onClick={() => { setOcultarCom(!ocultarCom); if (ordem === "comissao") setOrdem("padrao"); }}
            className={`ml-auto rounded-md border px-2.5 py-1 text-xs font-semibold ${ocultarCom ? "border-violet-600 bg-violet-600 text-white" : "border-border hover:bg-muted"}`}>
            {ocultarCom ? "Mostrar comissão" : "Esconder comissão"}</button>}
          <button onClick={limpar} className={`${podeVerCom ? "" : "ml-auto "}text-xs text-muted-foreground hover:text-foreground underline`}>Limpar</button>
        </div>
      </div>

      {erro && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">{erro}</div>}

      {bancos.length > 1 && res.linhas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">Banco:</span>
          {["", ...bancos].map(b => (
            <button key={b || "todos"} onClick={() => setBancoFiltro(b)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${bancoFiltro === b ? "border-violet-600 bg-violet-600 text-white" : "border-border hover:bg-muted"}`}>
              {b || "Todos"}</button>
          ))}
        </div>
      )}

      <div className={cardCls + " p-0 overflow-x-auto"}>
        {!tabelas.length ? (
          <div className="p-6 text-sm text-muted-foreground">
            Nenhuma tabela cadastrada. {master ? "Cadastre abaixo, em Tabelas." : "Peça ao master para cadastrar as tabelas."}
          </div>
        ) : !linhas.length ? (
          <div className="p-6 text-sm text-muted-foreground">Informe a parcela ou a margem para ver as {doConvenio.length} tabelas {convAtual}.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr>
              <Th k="banco" right={false}>Banco</Th><Th>Coeficiente</Th>{verCom && <Th>Percentual</Th>}
              <Th k="bruto">Bruto</Th><Th k="liberado">Liberado</Th>{verCom && <Th k="comissao">Comissão</Th>}
            </tr></thead>
            <tbody>
              {linhas.map(l => {
                const id = l.tabela.id as number;
                const on = marcadas.has(id);
                return (
                  <tr key={id} onClick={() => marcar(id)} title="Clique para destacar"
                    className={`border-t border-border cursor-pointer ${on ? "bg-yellow-200 dark:bg-yellow-500/30" : "hover:bg-muted/40"}`}>
                    <td className="px-3 py-2 font-medium">{l.tabela.banco}
                      {(l.tabela.nome || l.tabela.prazo) && <span className="ml-2 text-xs text-muted-foreground">{[l.tabela.nome, l.tabela.prazo ? l.tabela.prazo + "x" : ""].filter(Boolean).join(" · ")}</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{coefTxt(l.tabela.coeficiente)}</td>
                    {verCom && <td className="px-3 py-2 text-right">{l.tabela.percentual == null ? "—" : pct(l.tabela.percentual)}</td>}
                    <td className="px-3 py-2 text-right">{brl(l.bruto)}</td>
                    <td className={`px-3 py-2 text-right text-base font-bold ${l.liberado > 0 ? "" : "text-red-600"}`}>
                      {brl(l.liberado)}{l.liberado <= 0 && <div className="text-[11px] font-normal">não cobre o saldo</div>}</td>
                    {verCom && <td className="px-3 py-2 text-right">{l.comissao == null ? "—" : brl(l.comissao)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {linhas.length > 0 && <p className="text-xs text-muted-foreground">Bruto = margem ÷ coeficiente · Liberado = bruto − saldo{verCom ? " · Comissão = bruto × percentual (só master vê)" : ""}. Clique no título da coluna para ordenar e na linha para destacar.</p>}

      {master && !ocultarCom && <PainelTabelas aoMudar={carregar} />}
    </div>
  );
}

// ── cadastro de tabelas (só master) ─────────────────────────────────────────
const VAZIA = { convenio: "SIAPE", banco: "", nome: "", coeficiente: "", percentual: "", prazo: "" };

function PainelTabelas({ aoMudar }: { aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [todas, setTodas] = useState<TabelaApi[]>([]);
  const [form, setForm] = useState(VAZIA);
  const [editando, setEditando] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    try { setTodas((await chamar("/api/compra/tabelas?todas=1", "GET")).tabelas || []); } catch (e: any) { setMsg(e.message); }
  }, []);
  useEffect(() => { if (aberto) carregar(); }, [aberto, carregar]);
  const depois = async (texto: string) => { setMsg(texto); await carregar(); aoMudar(); };

  const salvar = async () => {
    try {
      const corpo = { ...form, coeficiente: form.coeficiente.replace(",", "."), percentual: form.percentual.replace(",", ".") };
      if (editando) await chamar(`/api/compra/tabelas/${editando}`, "PATCH", corpo);
      else await chamar("/api/compra/tabelas", "POST", corpo);
      setForm(VAZIA); setEditando(null);
      await depois(editando ? "Tabela atualizada." : "Tabela cadastrada.");
    } catch (e: any) { setMsg(e.message); }
  };
  const editar = (t: TabelaApi) => {
    setEditando(t.id);
    setForm({ convenio: t.convenio || "SIAPE", banco: t.banco, nome: t.nome || "", coeficiente: String(t.coeficiente).replace(".", ","),
      percentual: t.percentual == null ? "" : String(t.percentual).replace(".", ","), prazo: t.prazo ? String(t.prazo) : "" });
  };
  const alternar = async (t: TabelaApi) => {
    try { await chamar(`/api/compra/tabelas/${t.id}`, "PATCH", { ativo: !t.ativo }); await depois(t.ativo ? "Tabela desativada." : "Tabela reativada."); }
    catch (e: any) { setMsg(e.message); }
  };
  const importar = async () => {
    try { const j = await chamar("/api/compra/tabelas/importar-planilha", "POST"); await depois(`${j.criadas} tabela(s) cadastrada(s); ${j.jaExistiam} já existia(m).`); }
    catch (e: any) { setMsg(e.message); }
  };

  const campo = (k: keyof typeof VAZIA, rot: string, ph: string, lista?: string) => (
    <div><label className={labelCls}>{rot}</label>
      <input className={inputCls} placeholder={ph} list={lista} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>
  );
  const conveniosCadastrados = Array.from(new Set(["SIAPE", ...todas.map(t => t.convenio || "SIAPE")]));

  return (
    <div className={cardCls}>
      <button onClick={() => setAberto(!aberto)} className="text-sm font-semibold">{aberto ? "▾" : "▸"} Tabelas <span className="text-xs font-normal text-muted-foreground">(só master)</span></button>
      {aberto && <div className="mt-3 space-y-3">
        <datalist id="compra-convenios">{conveniosCadastrados.map(c => <option key={c} value={c} />)}</datalist>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end">
          {campo("convenio", "Convênio", "SIAPE", "compra-convenios")}{campo("banco", "Banco", "Neo")}{campo("nome", "Nome (opcional)", "")}
          {campo("coeficiente", "Coeficiente", "0,042824888")}{campo("percentual", "Percentual %", "28")}
          {campo("prazo", "Prazo (opcional)", "96")}
          <div className="flex gap-2">
            <button onClick={salvar} className="rounded-md bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2">{editando ? "Salvar" : "Adicionar"}</button>
            {editando && <button onClick={() => { setEditando(null); setForm(VAZIA); }} className="text-xs underline">cancelar</button>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={importar} className="rounded-md border border-border text-xs px-3 py-1.5 hover:bg-muted">Cadastrar as 15 tabelas da planilha (Neo e Futuro)</button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
        {todas.length > 0 && <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase text-muted-foreground text-left">
            <th className="py-1">Convênio</th><th>Banco</th><th>Nome</th><th className="text-right">Coeficiente</th><th className="text-right">%</th><th className="text-right">Prazo</th><th></th></tr></thead>
          <tbody>{todas.map(t => (
            <tr key={t.id} className={`border-t border-border ${t.ativo ? "" : "opacity-50"}`}>
              <td className="py-1.5 text-xs font-semibold">{t.convenio || "SIAPE"}</td><td>{t.banco}</td><td className="text-xs text-muted-foreground">{t.nome}</td>
              <td className="text-right font-mono text-xs">{coefTxt(t.coeficiente)}</td>
              <td className="text-right">{t.percentual == null ? "—" : pct(t.percentual)}</td>
              <td className="text-right">{t.prazo || "—"}</td>
              <td className="text-right space-x-3 text-xs">
                <button onClick={() => editar(t)} className="underline">editar</button>
                <button onClick={() => alternar(t)} className="underline">{t.ativo ? "desativar" : "reativar"}</button></td>
            </tr>))}</tbody>
        </table>}
      </div>}
    </div>
  );
}
