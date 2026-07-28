import { useState, useMemo } from "react";

// ── helpers financeiros (Tabela Price) ─────────────────────────────────
function saldoPrice(pmt: number, i: number, n: number): number {
  if (pmt <= 0 || n <= 0) return 0;
  if (i === 0) return pmt * n;
  return pmt * (1 - Math.pow(1 + i, -n)) / i;
}

// Inverso do saldoPrice: taxa mensal implícita via bisseção (RATE do Excel).
// saldoPrice é monotonicamente decrescente em i → convergência garantida.
function taxaFromSaldo(pmt: number, saldo: number, n: number): number {
  if (pmt <= 0 || saldo <= 0 || n <= 0) return 0;
  if (saldo >= pmt * n) return 0; // exigiria taxa <= 0
  let lo = 0.0000001, hi = 0.10; // 0% a 10% a.m.
  if (saldoPrice(pmt, hi, n) > saldo) return 0; // fora da faixa realista
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (saldoPrice(pmt, mid, n) > saldo) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

interface PriceLine {
  mes: number;
  parcela: number;
  juros: number;
  amortizacao: number;
  saldoDevedor: number;
}

function gerarTabelaPrice(parcela: number, taxaPerc: number, n: number): PriceLine[] {
  const i = taxaPerc / 100;
  let saldo = saldoPrice(parcela, i, n);
  const lines: PriceLine[] = [];
  for (let mes = 1; mes <= n; mes++) {
    const juros = saldo * i;
    const amort = parcela - juros;
    const novoSaldo = Math.max(0, saldo - amort);
    lines.push({ mes, parcela, juros, amortizacao: amort, saldoDevedor: novoSaldo });
    saldo = novoSaldo;
  }
  return lines;
}

// ── formato BR ─────────────────────────────────────────────────────────
const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtN = (v: number, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function parseBR(v: string): number {
  if (!v) return 0;
  const clean = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

export default function SimEvolucaoDivida() {
  const [parcelaStr, setParcelaStr] = useState("");
  const [prazoStr, setPrazoStr] = useState("");
  const [taxaStr, setTaxaStr] = useState("");
  const [saldoStr, setSaldoStr] = useState("");
  // Qual campo é a âncora: o último editado entre taxa e saldo manda no outro
  const [ancora, setAncora] = useState<"taxa" | "saldo">("taxa");
  const [amortStr, setAmortStr] = useState("");

  const parcela = parseBR(parcelaStr);
  const prazo = parseInt(prazoStr) || 0;

  // Resolve taxa e saldo conforme a âncora
  const { taxa, saldo, taxaEstimada } = useMemo(() => {
    if (ancora === "saldo") {
      const s = parseBR(saldoStr);
      const t = taxaFromSaldo(parcela, s, prazo);
      return { taxa: t, saldo: s, taxaEstimada: true };
    }
    const t = parseBR(taxaStr);
    const s = parcela > 0 && t > 0 && prazo > 0 ? saldoPrice(parcela, t / 100, prazo) : 0;
    return { taxa: t, saldo: s, taxaEstimada: false };
  }, [ancora, parcela, prazo, taxaStr, saldoStr]);

  const completo = parcela > 0 && prazo > 0 && taxa > 0 && saldo > 0;

  const tabela = useMemo(
    () => (completo ? gerarTabelaPrice(parcela, taxa, prazo) : []),
    [completo, parcela, taxa, prazo],
  );

  // ── Antecipação de parcelas ──────────────────────────────────────────
  // Identidade da Price: a amortização do mês m equivale ao valor presente da
  // parcela de nº (n − m + 1) — ou seja, a coluna Amortização do INÍCIO da
  // tabela é o custo de quitar as parcelas do FIM. Abater as últimas k parcelas
  // custa a soma das k primeiras amortizações.
  const amortDesejada = parseBR(amortStr);
  const resultado = useMemo(() => {
    if (!completo || amortDesejada <= 0 || !tabela.length) return null;
    let custo = 0, k = 0;
    for (const l of tabela) {
      if (custo + l.amortizacao > amortDesejada) break;
      custo += l.amortizacao;
      k++;
    }
    if (k === 0) return { k: 0, custo: 0, sobra: amortDesejada, economia: 0, restantes: prazo, saldoRestante: saldo };
    return {
      k,
      custo,
      sobra: amortDesejada - custo,
      economia: k * parcela - custo,
      restantes: prazo - k,
      saldoRestante: Math.max(0, saldo - custo),
    };
  }, [completo, amortDesejada, tabela, parcela, prazo, saldo]);

  // Linhas do fim abatidas pela antecipação (para riscar na tabela)
  const abatidaAPartirDe = resultado && resultado.k > 0 ? prazo - resultado.k + 1 : Infinity;

  const exportarCSV = () => {
    const numBR = (v: number) => v.toFixed(2).replace(".", ",");
    const head = ["Mês", "Parcela", "Juros", "Amortização", "Saldo Devedor"].join(";");
    const corpo = tabela
      .map(l => [String(l.mes).padStart(2, "0"), numBR(l.parcela), numBR(l.juros), numBR(l.amortizacao), numBR(l.saldoDevedor)].join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + head + "\n" + corpo], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `evolucao-divida-${prazo}m.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40";
  const labelCls = "block text-xs font-semibold mb-1.5";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold">Evolução de Dívida</h1>
      <p className="text-[13px] text-muted-foreground mt-1 mb-5">
        Informe parcela, prazo e <strong>taxa</strong> (calcula o saldo) ou parcela, prazo e{" "}
        <strong>saldo</strong> (descobre a taxa). Depois simule quanto uma amortização abate do contrato.
      </p>

      {/* ── Entradas ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div>
          <label className={labelCls}>Parcela (R$)</label>
          <input className={inputCls} value={parcelaStr} onChange={e => setParcelaStr(e.target.value)} placeholder="4.490,00" />
        </div>
        <div>
          <label className={labelCls}>Prazo (meses)</label>
          <input className={inputCls} value={prazoStr} onChange={e => setPrazoStr(e.target.value.replace(/\D/g, ""))} placeholder="120" />
        </div>
        <div>
          <label className={labelCls}>
            Taxa (% a.m.)
            {taxaEstimada && taxa > 0 && (
              <span className="ml-1.5 text-[10px] font-medium text-violet-600" title="Taxa estimada a partir do saldo informado">
                estimada
              </span>
            )}
          </label>
          <input
            className={inputCls}
            style={taxaEstimada ? { color: "#6C2BD9" } : undefined}
            value={ancora === "saldo" ? (taxa > 0 ? fmtN(taxa, 2) : "") : taxaStr}
            onChange={e => { setTaxaStr(e.target.value); setAncora("taxa"); }}
            placeholder="1,88"
          />
        </div>
        <div>
          <label className={labelCls}>
            Saldo devedor (R$)
            {!taxaEstimada && saldo > 0 && (
              <span className="ml-1.5 text-[10px] font-medium text-violet-600" title="Saldo calculado a partir da taxa informada">
                calculado
              </span>
            )}
          </label>
          <input
            className={inputCls}
            style={!taxaEstimada ? { color: "#6C2BD9" } : undefined}
            value={ancora === "taxa" ? (saldo > 0 ? fmtN(saldo, 2) : "") : saldoStr}
            onChange={e => { setSaldoStr(e.target.value); setAncora("saldo"); }}
            placeholder="204.090,91"
          />
        </div>
      </div>

      {ancora === "saldo" && parseBR(saldoStr) > 0 && parcela > 0 && prazo > 0 && taxa === 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-2.5 text-[13px] text-red-700 dark:text-red-400 mb-5">
          Saldo incompatível com parcela e prazo — não há taxa entre 0% e 10% a.m. que feche essa conta. Confira os valores.
        </div>
      )}

      {completo && (
        <>
          {/* ── Antecipação ── */}
          <div className="rounded-xl border border-border bg-card p-4 mb-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-56">
                <label className={labelCls}>Quero amortizar (R$)</label>
                <input className={inputCls} value={amortStr} onChange={e => setAmortStr(e.target.value)} placeholder="10.000,00" />
              </div>
              {resultado && resultado.k > 0 && (
                <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Parcelas abatidas</div>
                    <div className="text-sm font-semibold text-green-600 dark:text-green-400">{resultado.k}</div>
                    <div className="text-[9px] text-muted-foreground">as últimas ({abatidaAPartirDe}ª à {prazo}ª)</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Custo real</div>
                    <div className="text-sm font-semibold">{fmtR(resultado.custo)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Sobra</div>
                    <div className="text-sm font-semibold">{fmtR(resultado.sobra)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Economia em juros</div>
                    <div className="text-sm font-semibold text-green-600 dark:text-green-400">{fmtR(resultado.economia)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Parcelas restantes</div>
                    <div className="text-sm font-semibold">{resultado.restantes}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Saldo restante</div>
                    <div className="text-sm font-semibold">{fmtR(resultado.saldoRestante)}</div>
                  </div>
                </div>
              )}
              {resultado && resultado.k === 0 && (
                <div className="text-[13px] text-amber-700 dark:text-amber-400">
                  Valor insuficiente para abater a última parcela (custa {fmtR(tabela[0]?.amortizacao || 0)}).
                </div>
              )}
            </div>
          </div>

          {/* ── Evolução ── */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold">Evolução do Contrato — {prazo} meses</div>
              <div className="text-[11px] text-muted-foreground">
                Saldo: {fmtR(saldo)} · Parcela: {fmtR(parcela)} · Taxa: {fmtN(taxa, 2)}% a.m.
                {taxaEstimada ? " (estimada pelo saldo)" : ""}
              </div>
            </div>
            <button
              onClick={exportarCSV}
              className="rounded-md bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-4 py-2"
            >
              Exportar CSV
            </button>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <th className="text-left px-4 py-2">Mês</th>
                  <th className="text-right px-4 py-2">Parcela</th>
                  <th className="text-right px-4 py-2">Juros</th>
                  <th className="text-right px-4 py-2">Amortização</th>
                  <th className="text-right px-4 py-2">Saldo Devedor</th>
                </tr>
              </thead>
              <tbody>
                {tabela.map(l => {
                  const abatida = l.mes >= abatidaAPartirDe;
                  return (
                    <tr
                      key={l.mes}
                      className={`border-t border-border ${abatida ? "opacity-40 line-through" : ""} ${l.mes % 6 === 0 ? "bg-muted/20" : ""}`}
                    >
                      <td className="px-4 py-1.5">{String(l.mes).padStart(2, "0")}{abatida && <span className="ml-2 no-underline text-[9px] font-semibold text-green-600">ABATIDA</span>}</td>
                      <td className="px-4 py-1.5 text-right font-medium">{fmtR(l.parcela)}</td>
                      <td className="px-4 py-1.5 text-right text-red-500">{fmtR(l.juros)}</td>
                      <td className="px-4 py-1.5 text-right text-green-600 dark:text-green-400">{fmtR(l.amortizacao)}</td>
                      <td className="px-4 py-1.5 text-right font-medium text-violet-700 dark:text-violet-400">{fmtR(l.saldoDevedor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
