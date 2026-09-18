// ═══════════════════════════════════════════════════════════════════════════
// ANÁLISE MULTIBANCO — mesma entrada, todos os bancos ativos de uma vez.
//
// Módulo novo, separado do simulador de portabilidade antigo (que continua
// intacto). Lê a cotação que o simulador antigo salva, ou recebe os dados à mão,
// e roda o motor de regras compartilhado (@shared/portability/engine) — o MESMO
// código que o servidor usa ao registrar a análise.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  analisar, normalizarOrigem, nomeOrigem, ORIGENS, STATUS_LABEL,
  type BancoParaAnalise, type ClienteEntrada, type ContratoEntrada, type ResultadoBanco,
  type ResultadoRegra, type Status,
} from "@shared/portability/engine";

// ── helpers ────────────────────────────────────────────────────────────────

/** Número digitado em formato BR ou com ponto decimal. "1.20" é 1,2; "6.000" é 6000. */
function numBR(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  let s = String(v).replace(/[R$%\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const soDig = (v: string) => (v || "").replace(/\D/g, "");
function formatarCpf(v: string) {
  const d = soDig(v).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
/** Taxa pela Tabela Price quando só há saldo: a mesma dedução do simulador antigo. */
function taxaDoSaldo(parcela: number, saldo: number, n: number): number | null {
  if (!(parcela > 0 && saldo > 0 && n > 0) || saldo >= parcela * n) return null;
  const vp = (i: number) => parcela * (1 - Math.pow(1 + i, -n)) / i;
  let lo = 1e-7, hi = 0.1;
  if (vp(hi) > saldo) return null;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (vp(m) > saldo) lo = m; else hi = m; }
  return ((lo + hi) / 2) * 100;
}

const COR: Record<Status, { chip: string; ponto: string }> = {
  ELEGIVEL:             { chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300", ponto: "bg-emerald-500" },
  NAO_ELEGIVEL:         { chip: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300", ponto: "bg-red-500" },
  PENDENTE_INFO:        { chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300", ponto: "bg-amber-500" },
  REGRA_NAO_CADASTRADA: { chip: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300", ponto: "bg-slate-400" },
  ANALISE_MANUAL:       { chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300", ponto: "bg-sky-500" },
};
const Chip = ({ s }: { s: Status }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR[s].chip}`}>{STATUS_LABEL[s]}</span>
);

interface LinhaUI {
  id: string; bancoOrigem: string; origemConfirmada: string | null; numeroContrato: string;
  parcela: string; prazoRestante: string; prazoTotal: string; taxa: string; saldo: string;
}
let _seq = 0;
const novaLinha = (p: Partial<LinhaUI> = {}): LinhaUI => ({
  id: "l" + (++_seq) + "-" + Date.now().toString(36), bancoOrigem: "", origemConfirmada: null, numeroContrato: "",
  parcela: "", prazoRestante: "", prazoTotal: "", taxa: "", saldo: "", ...p,
});

interface BancoApi {
  id: number; nome: string; codigo: string | null; ativo: boolean; ordem: number;
  regraVigente: { id: number; hash: string; fonteDescricao: string | null; vigenciaInicio: string; regras: any } | null;
  excecoes: { id: number; tipo: string; parametros: any; motivo: string | null; criado_em: string }[];
}

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/40";
const labelCls = "block text-[11px] font-semibold text-muted-foreground mb-1";
const cardCls = "rounded-xl border border-border bg-card p-4";

// ═══════════════════════════════════════════════════════════════════════════

export default function SimAnaliseMultibanco() {
  const { user } = useAuth();
  const master = Boolean(user?.isMaster || user?.role === "master");

  // cliente
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [convenio, setConvenio] = useState("SIAPE");
  const [sitFunc, setSitFunc] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [pensaoTipo, setPensaoTipo] = useState<"" | "vitalicia" | "temporaria">("");
  const [pensaoFim, setPensaoFim] = useState("");
  const [alertas, setAlertas] = useState({ analfabeto: false, naoAssina: false, leiEstadualIdoso: false });
  const [linhas, setLinhas] = useState<LinhaUI[]>([]);

  // cadastro
  const [bancos, setBancos] = useState<BancoApi[]>([]);
  const [carregandoBancos, setCarregandoBancos] = useState(true);
  const [aba, setAba] = useState<string>("comparativo");
  const [mostrarAdmin, setMostrarAdmin] = useState(false);

  // cotações e histórico
  const [cotacoes, setCotacoes] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [status, setStatus] = useState<{ tipo: "ok" | "erro" | "info"; txt: string } | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const carregarBancos = useCallback(async () => {
    setCarregandoBancos(true);
    try {
      const r = await fetch(`/api/port/bancos?convenio=${encodeURIComponent(convenio)}`, { credentials: "include" });
      setBancos(r.ok ? await r.json() : []);
    } catch { setBancos([]); }
    setCarregandoBancos(false);
  }, [convenio]);
  useEffect(() => { carregarBancos(); }, [carregarBancos]);

  // ── entrada do motor ─────────────────────────────────────────────────────
  const clienteEntrada: ClienteEntrada = useMemo(() => ({
    convenio,
    situacaoFuncional: sitFunc.trim() || null,
    dataNascimento: nascimento || null,
    pensao: pensaoTipo ? { tipo: pensaoTipo, dataFim: pensaoTipo === "temporaria" ? (pensaoFim || null) : null } : null,
    alertas,
  }), [convenio, sitFunc, nascimento, pensaoTipo, pensaoFim, alertas]);

  const contratosEntrada: (ContratoEntrada & { taxaDeduzida: boolean })[] = useMemo(() => linhas.map(l => {
    const parcela = numBR(l.parcela), restante = numBR(l.prazoRestante), saldo = numBR(l.saldo);
    let taxa = numBR(l.taxa), taxaDeduzida = false;
    if (taxa === null && parcela && saldo && restante) { taxa = taxaDoSaldo(parcela, saldo, restante); taxaDeduzida = taxa !== null; }
    return {
      id: l.id, bancoOrigem: l.bancoOrigem, origemConfirmada: l.origemConfirmada, numeroContrato: l.numeroContrato || null,
      parcela, prazoRestante: restante, prazoTotal: numBR(l.prazoTotal), taxa, saldo, taxaDeduzida,
    };
  }), [linhas]);

  const ativos = useMemo(() => bancos.filter(b => b.ativo), [bancos]);
  const paraMotor: BancoParaAnalise[] = useMemo(() => ativos.map(b => ({
    bankId: b.id, nome: b.nome,
    ruleSet: b.regraVigente ? { id: b.regraVigente.id, hash: b.regraVigente.hash, vigenciaInicio: b.regraVigente.vigenciaInicio, regras: b.regraVigente.regras } : null,
    excecoes: b.excecoes.map(e => ({ id: e.id, tipo: "origem_pagas" as const, parametros: e.parametros, motivo: e.motivo })),
  })), [ativos]);

  // recalcula sozinho a cada alteração — mesmo motor do servidor
  const resultado = useMemo(() => analisar(paraMotor, clienteEntrada, contratosEntrada), [paraMotor, clienteEntrada, contratosEntrada]);

  // códigos de situação funcional conhecidos pelas regras cadastradas
  const codigosSit = useMemo(() => {
    const m = new Map<string, string>();
    ativos.forEach(b => (b.regraVigente?.regras?.situacaoFuncional?.aceitos || []).forEach((a: any) => m.set(a.codigo, a.descricao)));
    return Array.from(m.entries());
  }, [ativos]);

  // ── carregar cliente e cotação ─────────────────────────────────────────
  async function aoInformarCpf(v: string) {
    const f = formatarCpf(v);
    setCpf(f);
    if (soDig(f).length !== 11) { setCotacoes([]); setHistorico([]); return; }
    try {
      const [rc, rh, rp] = await Promise.all([
        fetch(`/api/cotacoes-simulador?cpf=${encodeURIComponent(f)}`, { credentials: "include" }),
        fetch(`/api/port/analises?cpf=${soDig(f)}`, { credentials: "include" }),
        fetch(`/api/port/cliente/${soDig(f)}`, { credentials: "include" }),
      ]);
      const todas = rc.ok ? await rc.json() : [];
      setCotacoes((Array.isArray(todas) ? todas : []).filter((c: any) => (c.tipoSimulador || "portabilidade") === "portabilidade"));
      setHistorico(rh.ok ? await rh.json() : []);
      const cli = rp.ok ? await rp.json() : null;
      if (cli) {
        if (cli.nome && !nome) setNome(cli.nome);
        if (cli.dataNascimento && !nascimento) setNascimento(cli.dataNascimento);
        const sf = cli.vinculos?.find((x: any) => x.sitFunc)?.sitFunc;
        if (sf && !sitFunc) setSitFunc(sf);
        setStatus({ tipo: "info", txt: `Cliente encontrado no CRM${sf ? ` — situação funcional "${sf}"` : ""}. Confira os dados abaixo.` });
      }
    } catch { /* busca é conveniência */ }
  }

  async function carregarCotacao(id: number) {
    try {
      const r = await fetch(`/api/cotacoes-simulador/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      const cot = await r.json();
      const lista = Array.isArray(cot?.dados?.contratos) ? cot.dados.contratos : [];
      setLinhas(lista.map((c: any) => novaLinha({
        bancoOrigem: c.banco || "", numeroContrato: c.numero_contrato || "",
        parcela: c.parcela ? String(c.parcela) : "", prazoRestante: c.prazo ? String(c.prazo) : "",
        prazoTotal: c.prazo_total ? String(c.prazo_total) : "",
        taxa: numBR(c.taxa) ? String(numBR(c.taxa)) : "", saldo: numBR(c.saldo) ? String(numBR(c.saldo)) : "",
      })));
      if (cot.nomeCliente && !nome) setNome(cot.nomeCliente);
      setStatus({ tipo: "ok", txt: `${lista.length} contrato(s) carregado(s) da cotação de ${new Date(cot.criadoEm).toLocaleDateString("pt-BR")}.` });
    } catch {
      setStatus({ tipo: "erro", txt: "Não foi possível carregar a cotação." });
    }
  }

  async function registrar() {
    if (!linhas.length) { setStatus({ tipo: "erro", txt: "Adicione ao menos um contrato." }); return; }
    setRegistrando(true);
    try {
      const r = await fetch("/api/port/analises", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, cliente: clienteEntrada, contratos: contratosEntrada.map(({ taxaDeduzida, ...c }) => c) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "erro");
      setStatus({ tipo: "ok", txt: `Análise #${j.id} registrada com as regras vigentes — fica no histórico deste CPF.` });
      if (soDig(cpf).length === 11) {
        const rh = await fetch(`/api/port/analises?cpf=${soDig(cpf)}`, { credentials: "include" });
        if (rh.ok) setHistorico(await rh.json());
      }
    } catch (e: any) {
      setStatus({ tipo: "erro", txt: "Não foi possível registrar: " + e.message });
    }
    setRegistrando(false);
  }

  const setLinha = (id: string, campo: keyof LinhaUI, valor: any) =>
    setLinhas(ls => ls.map(l => (l.id === id ? { ...l, [campo]: valor } : l)));

  const bancoAba = resultado.bancos.find(b => String(b.bankId) === aba) || null;

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Análise Multibanco</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Preencha o cliente uma vez: cada banco ativo analisa os mesmos contratos com as próprias regras.
          </p>
        </div>
        {master && (
          <button onClick={() => setMostrarAdmin(v => !v)}
            className="rounded-md border border-violet-300 dark:border-violet-800 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30">
            {mostrarAdmin ? "Voltar à análise" : "Bancos e regras"}
          </button>
        )}
      </div>

      {status && (
        <div className={`mt-4 rounded-md px-3 py-2 text-[12px] ${status.tipo === "erro" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : status.tipo === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"}`}>{status.txt}</div>
      )}

      {mostrarAdmin && master ? (
        <PainelBancos bancos={bancos} convenio={convenio} aoMudar={carregarBancos} />
      ) : (
        <>
          {/* ── CLIENTE ─────────────────────────────────────────────────── */}
          <div className={cardCls + " mt-5"}>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="md:col-span-1">
                <label className={labelCls}>CPF</label>
                <input className={inputCls} value={cpf} placeholder="000.000.000-00" maxLength={14} onChange={e => aoInformarCpf(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Nome</label>
                <input className={inputCls} value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Convênio</label>
                <select className={inputCls} value={convenio} onChange={e => setConvenio(e.target.value)}>
                  <option value="SIAPE">SIAPE</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Situação funcional</label>
                <input className={inputCls} list="codigos-sit" value={sitFunc} placeholder="código SIAPE" onChange={e => setSitFunc(e.target.value)} />
                <datalist id="codigos-sit">{codigosSit.map(([c, d]) => <option key={c} value={c}>{c} — {d}</option>)}</datalist>
              </div>
              <div>
                <label className={labelCls}>Nascimento</label>
                <input type="date" className={inputCls} value={nascimento} onChange={e => setNascimento(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Pensão</label>
                <select className={inputCls} value={pensaoTipo} onChange={e => setPensaoTipo(e.target.value as any)}>
                  <option value="">não se aplica / não sei</option>
                  <option value="vitalicia">vitalícia</option>
                  <option value="temporaria">temporária</option>
                </select>
              </div>
              {pensaoTipo === "temporaria" && (
                <div>
                  <label className={labelCls}>Fim da pensão</label>
                  <input type="date" className={inputCls} value={pensaoFim} onChange={e => setPensaoFim(e.target.value)} />
                </div>
              )}
              <div className="md:col-span-4 flex items-end gap-4 flex-wrap text-[12px] pb-1.5">
                {([["analfabeto", "Analfabeto"], ["naoAssina", "Impossibilitado de assinar"], ["leiEstadualIdoso", "Lei estadual de idoso"]] as const).map(([k, rot]) => (
                  <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={alertas[k]} onChange={e => setAlertas(a => ({ ...a, [k]: e.target.checked }))} />{rot}
                  </label>
                ))}
              </div>
            </div>

            {cotacoes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-[11px] font-bold text-violet-700 dark:text-violet-400 mb-1.5">Cotações salvas no simulador de portabilidade</div>
                <div className="flex flex-wrap gap-2">
                  {cotacoes.map(c => (
                    <button key={c.id} onClick={() => carregarCotacao(c.id)}
                      className="rounded-md border border-border px-2.5 py-1 text-[12px] hover:border-violet-400">
                      {new Date(c.criadoEm).toLocaleDateString("pt-BR")}{c.descricao ? ` — ${c.descricao}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── CONTRATOS ───────────────────────────────────────────────── */}
          <div className={cardCls + " mt-4"}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold">Contratos ({linhas.length})</div>
              <button onClick={() => setLinhas(ls => [...ls, novaLinha()])} className="text-[12px] font-semibold text-violet-700 dark:text-violet-300">+ adicionar contrato</button>
            </div>
            {!linhas.length ? (
              <div className="text-[12px] text-muted-foreground py-4 text-center">
                Informe o CPF para carregar uma cotação do simulador, ou adicione os contratos à mão.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-2 font-semibold">Banco de origem</th><th className="pr-2 font-semibold">Nº contrato</th>
                      <th className="pr-2 font-semibold">Parcela</th><th className="pr-2 font-semibold">Restam / total</th>
                      <th className="pr-2 font-semibold">Saldo devedor</th><th className="pr-2 font-semibold">Taxa % a.m.</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(l => {
                      const auto = normalizarOrigem(l.bancoOrigem);
                      const valorSel = l.origemConfirmada ?? auto ?? "";
                      const ambiguo = auto === "BRB" && !l.origemConfirmada;
                      const ce = contratosEntrada.find(c => c.id === l.id);
                      return (
                        <tr key={l.id} className="border-t border-border align-top">
                          <td className="py-1.5 pr-2 min-w-[170px]">
                            <select className={inputCls + (ambiguo ? " ring-2 ring-amber-400" : "")} value={valorSel}
                              onChange={e => setLinha(l.id, "origemConfirmada", e.target.value || null)}>
                              <option value="">{l.bancoOrigem ? `não reconhecido: ${l.bancoOrigem}` : "escolha"}</option>
                              {ORIGENS.map(o => <option key={o.chave} value={o.chave}>{o.nome}</option>)}
                            </select>
                            {l.bancoOrigem && <div className="text-[10px] text-muted-foreground mt-0.5">extrato: {l.bancoOrigem}{ambiguo ? " · confirme se é Banco ou Financeira" : ""}</div>}
                          </td>
                          <td className="pr-2 w-28"><input className={inputCls} value={l.numeroContrato} onChange={e => setLinha(l.id, "numeroContrato", e.target.value)} /></td>
                          <td className="pr-2 w-24"><input className={inputCls} value={l.parcela} onChange={e => setLinha(l.id, "parcela", e.target.value)} /></td>
                          <td className="pr-2 w-32">
                            <div className="flex items-center gap-1">
                              <input className={inputCls + " text-center"} value={l.prazoRestante} onChange={e => setLinha(l.id, "prazoRestante", e.target.value.replace(/\D/g, ""))} />
                              <span className="text-muted-foreground">/</span>
                              <input className={inputCls + " text-center"} value={l.prazoTotal} onChange={e => setLinha(l.id, "prazoTotal", e.target.value.replace(/\D/g, ""))} />
                            </div>
                          </td>
                          <td className="pr-2 w-28"><input className={inputCls} value={l.saldo} onChange={e => setLinha(l.id, "saldo", e.target.value)} /></td>
                          <td className="pr-2 w-24">
                            <input className={inputCls} value={l.taxa} placeholder={ce?.taxaDeduzida && ce.taxa ? ce.taxa.toFixed(2) : ""} onChange={e => setLinha(l.id, "taxa", e.target.value)} />
                            {ce?.taxaDeduzida && <div className="text-[10px] text-muted-foreground mt-0.5">deduzida do saldo</div>}
                          </td>
                          <td className="w-6">
                            <button title="Remover" onClick={() => setLinhas(ls => ls.filter(x => x.id !== l.id))} className="text-red-600 text-base leading-none px-1">×</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── RESULTADOS ──────────────────────────────────────────────── */}
          <div className="mt-5 flex items-center gap-1 flex-wrap border-b border-border">
            <Aba ativa={aba === "comparativo"} onClick={() => setAba("comparativo")}>Comparativo</Aba>
            {resultado.bancos.map(b => (
              <Aba key={b.bankId} ativa={aba === String(b.bankId)} onClick={() => setAba(String(b.bankId))}>
                <span className={`inline-block h-2 w-2 rounded-full ${COR[b.status].ponto}`} />{b.banco}
              </Aba>
            ))}
            <div className="flex-1" />
            <button onClick={registrar} disabled={registrando || !linhas.length}
              className="mb-1.5 rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2">
              {registrando ? "Registrando…" : "Registrar análise"}
            </button>
          </div>

          {carregandoBancos ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando bancos…</div>
          ) : !ativos.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum banco ativo cadastrado.{master ? " Abra \"Bancos e regras\" e importe o modelo do PAN." : " Peça ao master para cadastrar."}
            </div>
          ) : aba === "comparativo" || !bancoAba ? (
            <Comparativo bancos={resultado.bancos} aoAbrir={id => setAba(String(id))} semContratos={!linhas.length} />
          ) : (
            <AbaBanco b={bancoAba} linhas={linhas} />
          )}

          {historico.length > 0 && (
            <div className={cardCls + " mt-5"}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Análises registradas deste CPF</div>
              <div className="space-y-1">
                {historico.map(h => (
                  <div key={h.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-semibold">#{h.id}</span>
                    <span className="text-muted-foreground">{new Date(h.criado_em).toLocaleString("pt-BR")}{h.criado_por_nome ? ` · ${h.criado_por_nome}` : ""}</span>
                    {(h.bancos || []).map((b: any, i: number) => <span key={i} className="inline-flex items-center gap-1"><span>{b.banco}</span><Chip s={b.status} /></span>)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMPONENTES DA ANÁLISE
// ═══════════════════════════════════════════════════════════════════════════

function Aba({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 -mb-px ${ativa ? "border-violet-600 text-violet-700 dark:text-violet-300" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

const ORDEM_STATUS: Status[] = ["ELEGIVEL", "ANALISE_MANUAL", "PENDENTE_INFO", "REGRA_NAO_CADASTRADA", "NAO_ELEGIVEL"];

function Comparativo({ bancos, aoAbrir, semContratos }: { bancos: ResultadoBanco[]; aoAbrir: (id: number) => void; semContratos: boolean }) {
  // Ordem declarada e única: status, depois quantos contratos o banco aceita.
  // NÃO é "melhor condição" nem "maior comissão" — esses dois ficam separados abaixo.
  const ordenados = [...bancos].sort((a, b) =>
    ORDEM_STATUS.indexOf(a.status) - ORDEM_STATUS.indexOf(b.status) || b.contagem.ELEGIVEL - a.contagem.ELEGIVEL);
  const aceitam = ordenados.filter(b => b.status === "ELEGIVEL" || b.status === "ANALISE_MANUAL");

  const motivosRecusa = (b: ResultadoBanco) => Array.from(new Set(
    b.contratos.flatMap(c => c.regras.filter(r => r.status === "NAO_ELEGIVEL").map(r => r.motivo))));

  return (
    <div className="mt-4 space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <div className={cardCls}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aceitam a operação</div>
          <div className="text-2xl font-bold mt-1">{aceitam.length} <span className="text-sm font-normal text-muted-foreground">de {bancos.length} banco(s)</span></div>
          <div className="text-[11px] text-muted-foreground mt-1">{aceitam.map(b => b.banco).join(", ") || (semContratos ? "adicione contratos" : "nenhum")}</div>
        </div>
        <div className={cardCls}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Melhor condição para o cliente</div>
          <div className="text-sm font-semibold mt-1.5">Ainda não calculável</div>
          <div className="text-[11px] text-muted-foreground mt-1">Depende da taxa de refin de cada banco, que não está cadastrada. Quando estiver, este ranking aparece aqui — separado da comissão.</div>
        </div>
        <div className={cardCls}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Maior comissão</div>
          <div className="text-sm font-semibold mt-1.5">Ainda não calculável</div>
          <div className="text-[11px] text-muted-foreground mt-1">Nenhum banco tem regra de comissão cadastrada. Ranking próprio, nunca misturado com a condição do cliente.</div>
        </div>
      </div>

      <div className={cardCls + " overflow-x-auto"}>
        <div className="text-[11px] text-muted-foreground mb-2">Ordem: situação da análise e, empate, quantos contratos o banco aceita.</div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="py-1.5 pr-3 font-semibold">Banco</th><th className="pr-3 font-semibold">Situação</th>
              <th className="pr-3 font-semibold">Contratos aceitos</th><th className="pr-3 font-semibold">Por que recusa</th>
              <th className="pr-3 font-semibold">Falta informar</th><th className="font-semibold">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map(b => {
              const mot = motivosRecusa(b);
              return (
                <tr key={b.bankId} className="border-t border-border align-top cursor-pointer hover:bg-muted/40" onClick={() => aoAbrir(b.bankId)}>
                  <td className="py-2 pr-3 font-semibold">{b.banco}</td>
                  <td className="pr-3"><Chip s={b.status} /></td>
                  <td className="pr-3">{b.contratos.length ? `${b.contagem.ELEGIVEL + b.contagem.ANALISE_MANUAL} de ${b.contratos.length}` : "—"}</td>
                  <td className="pr-3 max-w-[260px]">{mot.length ? mot.slice(0, 2).join(" · ") + (mot.length > 2 ? ` (+${mot.length - 2})` : "") : "—"}</td>
                  <td className="pr-3 max-w-[260px] text-amber-700 dark:text-amber-400">{b.pendencias.length ? b.pendencias.slice(0, 2).join(" · ") + (b.pendencias.length > 2 ? ` (+${b.pendencias.length - 2})` : "") : "—"}</td>
                  <td className="text-muted-foreground">não cadastrada</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinhaRegra({ r }: { r: ResultadoRegra }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{r.label}</td>
      <td className="pr-3 whitespace-nowrap">{r.valorAnalisado ?? <span className="text-muted-foreground">—</span>}</td>
      <td className="pr-3 whitespace-nowrap text-muted-foreground">{r.esperado ?? "—"}</td>
      <td className="pr-3"><Chip s={r.status} /></td>
      <td className="pr-3">{r.motivo}</td>
      <td className="whitespace-nowrap">
        {r.fonte === "excecao" && <span className="rounded bg-violet-100 dark:bg-violet-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">exceção</span>}
      </td>
    </tr>
  );
}

const Tabela = ({ regras }: { regras: ResultadoRegra[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
          <th className="py-1 pr-3 font-semibold">Regra</th><th className="pr-3 font-semibold">Analisado</th>
          <th className="pr-3 font-semibold">Exigido</th><th className="pr-3 font-semibold">Resultado</th>
          <th className="pr-3 font-semibold">Motivo</th><th></th>
        </tr>
      </thead>
      <tbody>{regras.map((r, i) => <LinhaRegra key={r.chave + i} r={r} />)}</tbody>
    </table>
  </div>
);

function AbaBanco({ b, linhas }: { b: ResultadoBanco; linhas: LinhaUI[] }) {
  const elegiveis = b.contratos.filter(c => c.status === "ELEGIVEL" || c.status === "ANALISE_MANUAL");
  const outros = b.contratos.filter(c => !(c.status === "ELEGIVEL" || c.status === "ANALISE_MANUAL"));
  const titulo = (id: string) => {
    const l = linhas.find(x => x.id === id);
    if (!l) return id;
    const orig = nomeOrigem(l.origemConfirmada ?? normalizarOrigem(l.bancoOrigem)) || l.bancoOrigem;
    const p = numBR(l.parcela);
    return `${orig}${l.numeroContrato ? " · nº " + l.numeroContrato : ""}${p ? " · parcela " + fmtR(p) : ""}`;
  };
  const Contrato = ({ c }: { c: typeof b.contratos[number] }) => (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[13px] font-semibold">{titulo(c.contratoId)}</div><Chip s={c.status} />
      </div>
      <Tabela regras={c.regras} />
      <div className="mt-2 pt-2 border-t border-dashed border-border">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Operação — informativo, não decide a elegibilidade</div>
        <Tabela regras={c.operacao} />
      </div>
    </div>
  );

  return (
    <div className="mt-4 space-y-4">
      <div className={cardCls}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-lg font-bold">{b.banco}</div><Chip s={b.status} />
          <div className="text-sm">{b.resumo}</div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1.5">
          {b.ruleSetId
            ? <>Regras vigentes desde {b.vigenciaInicio ? new Date(b.vigenciaInicio).toLocaleString("pt-BR") : "—"} · versão #{b.ruleSetId}
                {b.excecoesAplicadas.length ? ` · ${b.excecoesAplicadas.length} exceção(ões) usada(s) nesta análise` : ""}</>
            : "Sem regras cadastradas para este convênio."}
        </div>
        {b.avisos.length > 0 && <div className="text-[11px] text-muted-foreground mt-1">Avisos do banco: {b.avisos.join(" · ")}</div>}
      </div>

      {b.pendencias.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1">Falta informar — nada foi reprovado por isso</div>
          <ul className="list-disc pl-5 text-[12px] text-amber-900 dark:text-amber-200 space-y-0.5">{b.pendencias.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}

      {b.cliente.length > 0 && (
        <div className={cardCls}>
          <div className="text-sm font-bold mb-2">Regras do cliente <span className="text-[11px] font-normal text-muted-foreground">— valem para todos os contratos</span></div>
          <Tabela regras={b.cliente} />
        </div>
      )}

      {elegiveis.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Aceitos ({elegiveis.length})</div>
          {elegiveis.map(c => <Contrato key={c.contratoId} c={c} />)}
        </div>
      )}
      {outros.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-bold text-muted-foreground">Não aceitos ou pendentes ({outros.length})</div>
          {outros.map(c => <Contrato key={c.contratoId} c={c} />)}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  PAINEL DE BANCOS E REGRAS (master)
// ═══════════════════════════════════════════════════════════════════════════

function PainelBancos({ bancos, convenio, aoMudar }: { bancos: BancoApi[]; convenio: string; aoMudar: () => void }) {
  const [modelos, setModelos] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [novoBanco, setNovoBanco] = useState("");
  const [historico, setHistorico] = useState<Record<number, any[]>>({});
  const [formExc, setFormExc] = useState<Record<number, { origem: string; porta: boolean; pagasMin: string; motivo: string }>>({});

  useEffect(() => {
    fetch("/api/port/modelos", { credentials: "include" }).then(r => r.ok ? r.json() : []).then(setModelos).catch(() => setModelos([]));
  }, []);

  async function chamar(url: string, metodo: string, corpo?: any) {
    const r = await fetch(url, { method: metodo, credentials: "include", headers: { "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || "erro " + r.status);
    return j;
  }
  const executar = async (fn: () => Promise<string>) => {
    try { setMsg(await fn()); aoMudar(); } catch (e: any) { setMsg("Erro: " + e.message); }
  };

  return (
    <div className="mt-5 space-y-4">
      {msg && <div className="rounded-md bg-violet-50 dark:bg-violet-950/40 px-3 py-2 text-[12px] text-violet-800 dark:text-violet-200">{msg}</div>}

      <div className={cardCls}>
        <div className="text-sm font-bold mb-1">Importar infográfico</div>
        <p className="text-[12px] text-muted-foreground mb-2">
          Cada modelo é uma arte já transcrita. Importar grava uma versão nova das regras — a vigência começa agora —
          e cria as exceções sugeridas que ainda não existirem. As exceções atuais continuam valendo.
        </p>
        {modelos.map(m => (
          <div key={m.id} className="flex items-center justify-between gap-3 border-t border-border py-2 text-[12px]">
            <div><b>{m.banco} · {m.convenio}</b><div className="text-muted-foreground">{m.fonteDescricao}{m.excecoesSugeridas ? ` · ${m.excecoesSugeridas} exceção(ões) sugerida(s)` : ""}</div></div>
            <button onClick={() => executar(async () => {
              const j = await chamar("/api/port/importar-modelo", "POST", { modeloId: m.id });
              return `${m.banco}: ${j.regraNova ? "nova versão de regras gravada" : "regras idênticas às vigentes, nada mudou"}; ${j.excecoesCriadas} exceção(ões) criada(s).`;
            })} className="rounded-md bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-1.5 whitespace-nowrap">Importar</button>
          </div>
        ))}
      </div>

      <div className={cardCls}>
        <div className="flex items-end gap-2 mb-3">
          <div className="flex-1 max-w-xs">
            <label className={labelCls}>Novo banco (fica sem regras até importar)</label>
            <input className={inputCls} value={novoBanco} onChange={e => setNovoBanco(e.target.value)} placeholder="ex.: Safra" />
          </div>
          <button onClick={() => executar(async () => { await chamar("/api/port/bancos", "POST", { nome: novoBanco }); setNovoBanco(""); return "Banco criado."; })}
            disabled={!novoBanco.trim()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Criar</button>
        </div>

        {!bancos.length && <div className="text-[12px] text-muted-foreground">Nenhum banco cadastrado ainda.</div>}
        {bancos.map(b => {
          const f = formExc[b.id] || { origem: "", porta: true, pagasMin: "0", motivo: "" };
          const setF = (p: Partial<typeof f>) => setFormExc(s => ({ ...s, [b.id]: { ...f, ...p } }));
          return (
            <div key={b.id} className="border-t border-border py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-sm font-bold">{b.nome}</div>
                <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                  <input type="checkbox" checked={b.ativo} onChange={e => executar(async () => {
                    await chamar(`/api/port/bancos/${b.id}`, "PATCH", { ativo: e.target.checked });
                    return `${b.nome} ${e.target.checked ? "ativado" : "desativado"} — ${e.target.checked ? "volta" : "sai"} da análise.`;
                  })} />ativo
                </label>
                <div className="text-[11px] text-muted-foreground">
                  {b.regraVigente
                    ? <>Regras {convenio}: {b.regraVigente.fonteDescricao || "cadastro manual"} · vigentes desde {new Date(b.regraVigente.vigenciaInicio).toLocaleString("pt-BR")} · #{b.regraVigente.id}</>
                    : <>Sem regras para {convenio}.</>}
                </div>
                <button className="text-[11px] font-semibold text-violet-700 dark:text-violet-300" onClick={async () => {
                  if (historico[b.id]) { setHistorico(h => { const n = { ...h }; delete n[b.id]; return n; }); return; }
                  const r = await fetch(`/api/port/bancos/${b.id}/regras`, { credentials: "include" });
                  setHistorico(h => ({ ...h, [b.id]: r.ok ? [] : [] }));
                  if (r.ok) { const j = await r.json(); setHistorico(h => ({ ...h, [b.id]: j })); }
                }}>{historico[b.id] ? "ocultar versões" : "versões"}</button>
              </div>

              {historico[b.id] && (
                <div className="mt-2 ml-2 text-[11px] space-y-0.5">
                  {historico[b.id].map((v: any) => (
                    <div key={v.id} className={v.vigencia_fim ? "text-muted-foreground" : ""}>
                      #{v.id} · {v.convenio} · {new Date(v.vigencia_inicio).toLocaleString("pt-BR")} → {v.vigencia_fim ? new Date(v.vigencia_fim).toLocaleString("pt-BR") : "vigente"}
                      {v.criado_por_nome ? ` · ${v.criado_por_nome}` : ""} · {v.fonte_descricao || "manual"}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 ml-2">
                <div className="text-[11px] font-bold text-muted-foreground mb-1">Exceções ({convenio}) — vencem o infográfico e sobrevivem à troca de arte</div>
                {!b.excecoes.length && <div className="text-[11px] text-muted-foreground">nenhuma</div>}
                {b.excecoes.map(e => (
                  <div key={e.id} className="flex items-start gap-2 text-[12px] py-0.5">
                    <span className="font-semibold whitespace-nowrap">{e.parametros.origem}</span>
                    <span className="whitespace-nowrap">{e.parametros.porta ? `porta com ${e.parametros.pagasMin ?? 0} pagas` : "não porta"}</span>
                    <span className="text-muted-foreground flex-1">{e.motivo}</span>
                    <button className="text-red-600 text-[11px] font-semibold whitespace-nowrap" onClick={() => {
                      if (!confirm(`Desativar a exceção de ${e.parametros.origem}? Ela fica no histórico.`)) return;
                      executar(async () => { await chamar(`/api/port/excecoes/${e.id}`, "DELETE"); return "Exceção desativada (continua no histórico)."; });
                    }}>desativar</button>
                  </div>
                ))}

                <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                  <div className="md:col-span-1">
                    <label className={labelCls}>Banco de origem</label>
                    <select className={inputCls} value={f.origem} onChange={e => setF({ origem: e.target.value })}>
                      <option value="">escolha</option>
                      {ORIGENS.map(o => <option key={o.chave} value={o.nome}>{o.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Regra</label>
                    <select className={inputCls} value={f.porta ? "sim" : "nao"} onChange={e => setF({ porta: e.target.value === "sim" })}>
                      <option value="sim">porta</option><option value="nao">não porta</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Pagas mín.</label>
                    <input className={inputCls} value={f.pagasMin} disabled={!f.porta} onChange={e => setF({ pagasMin: e.target.value.replace(/\D/g, "") })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Motivo (obrigatório)</label>
                    <input className={inputCls} value={f.motivo} onChange={e => setF({ motivo: e.target.value })} placeholder="de onde veio essa exceção" />
                  </div>
                  <button disabled={!f.origem || f.motivo.trim().length < 5}
                    onClick={() => executar(async () => {
                      await chamar(`/api/port/bancos/${b.id}/excecoes`, "POST", { convenio, parametros: { origem: f.origem, porta: f.porta, pagasMin: Number(f.pagasMin) || 0 }, motivo: f.motivo });
                      setFormExc(s => ({ ...s, [b.id]: { origem: "", porta: true, pagasMin: "0", motivo: "" } }));
                      return "Exceção criada.";
                    })}
                    className="rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2">+ exceção</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
