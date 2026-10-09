// ═══════════════════════════════════════════════════════════════════════════
// EVOLUÇÃO DE DÍVIDA — a calculadora que a gente pede ao banco, feita aqui.
//
// Informe três entre prazo, parcela, taxa e saldo devedor; a quarta sai sozinha.
// Embaixo vem a evolução mês a mês: quanto da parcela é juro, quanto abate, e
// como o saldo cai até zerar.
//
// A tabela se comporta como planilha: arraste (ou clique e Shift+clique) sobre
// as células e a barra de baixo mostra soma, contagem e média do que estiver
// selecionado — pedido do Fábio em 09/10/2026.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[11px] font-semibold text-muted-foreground mb-1";
const cardCls = "rounded-xl border border-border bg-card p-4";

/** "R$ 3.442,06" / "154,36" / "1.45" → número; vazio ou inválido = 0 */
function num(v: string): number {
  let s = String(v || "").replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nFmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Saldo devedor de `n` parcelas de `p` à taxa `i` ao mês (Price). */
const pvPrice = (p: number, i: number, n: number) => (i > 0 ? p * (1 - Math.pow(1 + i, -n)) / i : p * n);
/** Parcela de um saldo `s` em `n` meses à taxa `i`. */
const pmtPrice = (s: number, i: number, n: number) => (i > 0 ? s * i / (1 - Math.pow(1 + i, -n)) : s / n);

/**
 * Taxa que faz `n` parcelas de `p` valerem `saldo` hoje.
 * Não tem fórmula fechada: acha por bisseção. O saldo cai quando a taxa sobe,
 * então a busca é monótona e converge sempre.
 */
function taxaDe(saldo: number, p: number, n: number): number | null {
  if (!(saldo > 0 && p > 0 && n > 0)) return null;
  if (p * n <= saldo) return null;                 // nem sem juros fecha: impossível
  let lo = 1e-9, hi = 1;                           // 0% a 100% ao mês
  if (pvPrice(p, hi, n) > saldo) return null;      // nem a 100% a.m.
  for (let k = 0; k < 300; k++) {
    const m = (lo + hi) / 2;
    if (pvPrice(p, m, n) > saldo) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

interface Linha { mes: number; parcela: number; juros: number; amort: number; saldo: number }

/** Mês a mês: juro sobre o saldo, o resto abate. A última parcela fecha a conta. */
function gerarEvolucao(saldo: number, i: number, parcela: number, n: number): Linha[] {
  const linhas: Linha[] = [];
  let s = saldo;
  for (let mes = 1; mes <= n; mes++) {
    const juros = s * i;
    let amort = parcela - juros;
    let pagou = parcela;
    if (mes === n || amort >= s) {                 // fecha exatamente no fim
      amort = s;
      pagou = s + juros;
    }
    s = Math.max(0, s - amort);
    linhas.push({ mes, parcela: pagou, juros, amort, saldo: s });
    if (s <= 0.004) break;
  }
  return linhas;
}

type Modo = "saldo" | "taxa" | "parcela";
const COLUNAS = ["Mês", "Parcela", "Juros", "Amortização", "Saldo devedor"] as const;
/** A coluna "Mês" é contagem, não dinheiro: a barra não formata como R$. */
const COL_DINHEIRO = [false, true, true, true, true];

export default function EvolucaoDivida() {
  const [modo, setModo] = useState<Modo>("saldo");
  const [prazo, setPrazo] = useState("120");
  const [parcela, setParcela] = useState("");
  const [taxa, setTaxa] = useState("1,45");
  const [saldo, setSaldo] = useState("");

  // ── a conta ───────────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const n = Math.floor(num(prazo));
    const p = num(parcela);
    const iPct = num(taxa);
    const s = num(saldo);
    if (n <= 0 || n > 600) return { erro: "Informe um prazo entre 1 e 600 meses." };

    if (modo === "saldo") {
      if (p <= 0 || iPct <= 0) return { erro: "Informe a parcela e a taxa." };
      const i = iPct / 100;
      return { i, parcela: p, saldo: pvPrice(p, i, n), n };
    }
    if (modo === "parcela") {
      if (s <= 0 || iPct <= 0) return { erro: "Informe o saldo devedor e a taxa." };
      const i = iPct / 100;
      return { i, parcela: pmtPrice(s, i, n), saldo: s, n };
    }
    if (p <= 0 || s <= 0) return { erro: "Informe a parcela e o saldo devedor." };
    const i = taxaDe(s, p, n);
    if (i == null) {
      return {
        erro: p * n <= s
          ? `Com ${n} parcelas de ${brl(p)} o cliente paga ${brl(p * n)}, menos que o saldo de ${brl(s)}. Não existe taxa possível.`
          : "Taxa fora do alcance (acima de 100% ao mês). Confira os valores.",
      };
    }
    return { i, parcela: p, saldo: s, n };
  }, [modo, prazo, parcela, taxa, saldo]);

  const linhas = useMemo(
    () => ("erro" in calc ? [] : gerarEvolucao(calc.saldo, calc.i, calc.parcela, calc.n)),
    [calc],
  );

  // ── seleção estilo planilha ───────────────────────────────────────────────
  const [sel, setSel] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  const arrastando = useRef(false);

  useEffect(() => { setSel(null); }, [linhas.length, modo]);
  useEffect(() => {
    const soltar = () => { arrastando.current = false; };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); };
    window.addEventListener("mouseup", soltar);
    window.addEventListener("keydown", tecla);
    return () => { window.removeEventListener("mouseup", soltar); window.removeEventListener("keydown", tecla); };
  }, []);

  const dentro = (r: number, c: number) =>
    !!sel && r >= Math.min(sel.r1, sel.r2) && r <= Math.max(sel.r1, sel.r2)
          && c >= Math.min(sel.c1, sel.c2) && c <= Math.max(sel.c1, sel.c2);

  const valorDa = (r: number, c: number) => {
    const l = linhas[r];
    return [l.mes, l.parcela, l.juros, l.amort, l.saldo][c];
  };

  const resumoSel = useMemo(() => {
    if (!sel) return null;
    const vals: number[] = [];
    let soDinheiro = true;
    for (let r = Math.min(sel.r1, sel.r2); r <= Math.max(sel.r1, sel.r2); r++) {
      for (let c = Math.min(sel.c1, sel.c2); c <= Math.max(sel.c1, sel.c2); c++) {
        if (!linhas[r]) continue;
        vals.push(valorDa(r, c));
        if (!COL_DINHEIRO[c]) soDinheiro = false;
      }
    }
    if (!vals.length) return null;
    const soma = vals.reduce((a, v) => a + v, 0);
    return { soma, contagem: vals.length, media: soma / vals.length, soDinheiro };
  }, [sel, linhas]);

  const totalParcelas = linhas.reduce((a, l) => a + l.parcela, 0);
  const totalJuros = linhas.reduce((a, l) => a + l.juros, 0);

  const celaCls = (r: number, c: number) =>
    "px-3 py-1.5 tabular-nums select-none cursor-cell " +
    (c === 0 ? "text-left " : "text-right ") +
    (dentro(r, c) ? "bg-primary/20 " : "");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold">Evolução de Dívida</h1>
      <p className="text-[13px] text-muted-foreground mt-1">
        Informe três entre prazo, parcela, taxa e saldo. A quarta sai sozinha, e embaixo
        vem a dívida mês a mês.
      </p>

      <div className={cardCls + " mt-4"}>
        <div className="flex items-center gap-2 mb-3">
          <span className={labelCls + " mb-0"}>Calcular</span>
          {(["saldo", "taxa", "parcela"] as Modo[]).map((m) => (
            <button key={m} onClick={() => setModo(m)} data-testid={`modo-${m}`}
              className={`rounded-md px-3 py-1 text-xs font-semibold border ${
                modo === m ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
              {m === "saldo" ? "Saldo devedor" : m === "taxa" ? "Taxa" : "Parcela"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={labelCls}>Prazo (meses)</label>
            <input className={inputCls} inputMode="numeric" value={prazo}
              onChange={(e) => setPrazo(e.target.value)} data-testid="in-prazo" /></div>

          <div><label className={labelCls}>Parcela</label>
            {modo === "parcela"
              ? <div className="rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-sm font-bold text-primary" data-testid="out-parcela">
                  {"erro" in calc ? "—" : brl(calc.parcela)}</div>
              : <input className={inputCls} inputMode="decimal" placeholder="6.219,79" value={parcela}
                  onChange={(e) => setParcela(e.target.value)} data-testid="in-parcela" />}
          </div>

          <div><label className={labelCls}>Taxa (% ao mês)</label>
            {modo === "taxa"
              ? <div className="rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-sm font-bold text-primary" data-testid="out-taxa">
                  {"erro" in calc ? "—" : (calc.i * 100).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + "%"}</div>
              : <input className={inputCls} inputMode="decimal" placeholder="1,45" value={taxa}
                  onChange={(e) => setTaxa(e.target.value)} data-testid="in-taxa" />}
          </div>

          <div><label className={labelCls}>Saldo devedor</label>
            {modo === "saldo"
              ? <div className="rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-sm font-bold text-primary" data-testid="out-saldo">
                  {"erro" in calc ? "—" : brl(calc.saldo)}</div>
              : <input className={inputCls} inputMode="decimal" placeholder="305.899,12" value={saldo}
                  onChange={(e) => setSaldo(e.target.value)} data-testid="in-saldo" />}
          </div>
        </div>

        {"erro" in calc ? (
          <div className="mt-3 text-[13px] text-amber-700 dark:text-amber-500" data-testid="erro">{calc.erro}</div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            <span>Taxa: <b>{(calc.i * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% a.m.</b>
              <span className="text-muted-foreground"> ({((Math.pow(1 + calc.i, 12) - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a.)</span></span>
            <span>Total pago: <b>{brl(totalParcelas)}</b></span>
            <span>Juros: <b className="text-amber-600">{brl(totalJuros)}</b>
              <span className="text-muted-foreground"> ({(calc.saldo > 0 ? (totalJuros / calc.saldo) * 100 : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do saldo)</span></span>
          </div>
        )}
      </div>

      {linhas.length > 0 && (
        <div className={cardCls + " mt-4 p-0 overflow-hidden"}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold">Evolução da dívida</div>
              <div className="text-[11px] text-muted-foreground">
                arraste sobre as células (ou clique e Shift+clique) para somar, como numa planilha
              </div>
            </div>
            {sel && <button onClick={() => setSel(null)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline">limpar seleção</button>}
          </div>

          <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
            <table className="w-full text-[13px] border-collapse">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {COLUNAS.map((c, idx) => (
                    <th key={c} className={"px-3 py-2 font-semibold " + (idx === 0 ? "text-left" : "text-right")}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody data-testid="tbody-evolucao">
                {linhas.map((l, r) => (
                  <tr key={l.mes} className="border-t border-border/60">
                    {COLUNAS.map((_, c) => (
                      <td key={c} className={celaCls(r, c)}
                        onMouseDown={(e) => {
                          if (e.shiftKey && sel) { setSel({ ...sel, r2: r, c2: c }); return; }
                          arrastando.current = true;
                          setSel({ r1: r, c1: c, r2: r, c2: c });
                        }}
                        onMouseEnter={() => { if (arrastando.current) setSel((s) => (s ? { ...s, r2: r, c2: c } : s)); }}
                        data-testid={`cel-${r}-${c}`}>
                        {c === 0 ? l.mes : nFmt(valorDa(r, c))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-muted/90 backdrop-blur font-bold">
                <tr className="border-t-2 border-primary">
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2 text-right tabular-nums">{nFmt(totalParcelas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-600">{nFmt(totalJuros)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{nFmt(linhas.reduce((a, l) => a + l.amort, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">—</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* a barra da planilha */}
          <div className="border-t border-border px-4 py-2 text-[12px] flex flex-wrap gap-x-6 gap-y-1 bg-muted/40" data-testid="barra-selecao">
            {resumoSel ? (
              <>
                <span>Soma: <b>{resumoSel.soDinheiro ? brl(resumoSel.soma) : nFmt(resumoSel.soma)}</b></span>
                <span>Contagem: <b>{resumoSel.contagem}</b></span>
                <span>Média: <b>{resumoSel.soDinheiro ? brl(resumoSel.media) : nFmt(resumoSel.media)}</b></span>
              </>
            ) : (
              <span className="text-muted-foreground">Selecione células para ver soma, contagem e média.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
