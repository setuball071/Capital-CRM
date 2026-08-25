import { useMemo, useState } from "react";

// ── Tabela Price ───────────────────────────────────────────────────────
function pmt(pv: number, i: number, n: number): number {
  if (pv <= 0 || n <= 0) return 0;
  if (i === 0) return pv / n;
  return pv * i / (1 - Math.pow(1 + i, -n));
}
// Saldo devedor após k parcelas pagas = VP das (n − k) parcelas restantes
function saldoApos(parcela: number, i: number, restantes: number): number {
  if (restantes <= 0) return 0;
  if (i === 0) return parcela * restantes;
  return parcela * (1 - Math.pow(1 + i, -restantes)) / i;
}

const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtN = (v: number, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
function parseBR(v: string): number {
  const t = (v || "").trim();
  if (!t) return 0;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return parseFloat(norm) || 0;
}

interface LinhaAno {
  ano: number;
  mesesPagos: number;        // meses de parcela pagos neste ano
  ativasAntes: number;
  parcelaAntes: number;      // parcela mensal durante o ano
  saldoFatia: number;        // saldo de cada fatia no momento da quitação
  quitadas: number;
  custoQuitacao: number;
  sobra: number;             // gratificação não usada (não acumula)
  ativasDepois: number;
  parcelaDepois: number;
  pagoNoAno: number;         // parcelas + quitações
  encerrouNoPrazo: boolean;  // contrato terminou naturalmente (sem quitar)
}

export default function SimAmortizacaoAnual() {
  const [valorStr, setValorStr] = useState("100.000,00");
  const [fatiasStr, setFatiasStr] = useState("5");
  const [gratStr, setGratStr] = useState("20.000,00");
  const [taxaStr, setTaxaStr] = useState("1,80");
  const [iofStr, setIofStr] = useState("4,5");
  const [prazoStr, setPrazoStr] = useState("96");

  const valor = parseBR(valorStr);
  const nFatias = Math.max(1, parseInt(fatiasStr) || 0);
  const grat = parseBR(gratStr);
  const taxa = parseBR(taxaStr);
  const prazo = parseInt(prazoStr) || 0;
  const iofPerc = parseBR(iofStr);
  // O cliente recebe o valor liquido; o financiado embute IOF/encargos automaticamente
  const financiado = valor * (1 + iofPerc / 100);

  const res = useMemo(() => {
    if (!(valor > 0) || !(nFatias > 0) || !(taxa > 0) || !(prazo > 0)) return null;
    const i = taxa / 100;
    const fatia = financiado / nFatias;
    const parcelaFatia = pmt(fatia, i, prazo);

    const linhas: LinhaAno[] = [];
    let ativas = nFatias;
    let mesesDecorridos = 0;
    let pagoParcelas = 0, pagoQuitacoes = 0;
    let mesQuitouTudo: number | null = null;
    let anosSemQuitar = 0;

    for (let ano = 1; ativas > 0 && mesesDecorridos < prazo; ano++) {
      const mesesAno = Math.min(12, prazo - mesesDecorridos);
      const parcelaAntes = ativas * parcelaFatia;
      const pagoAno = parcelaAntes * mesesAno;
      pagoParcelas += pagoAno;
      mesesDecorridos += mesesAno;

      const restantes = prazo - mesesDecorridos;
      const encerrou = restantes <= 0;
      const saldoFatia = encerrou ? 0 : saldoApos(parcelaFatia, i, restantes);

      let quitadas = 0, custo = 0, sobra = 0;
      if (!encerrou) {
        quitadas = saldoFatia > 0 ? Math.min(ativas, Math.floor(grat / saldoFatia + 1e-9)) : 0;
        custo = quitadas * saldoFatia;
        sobra = grat - custo;
        if (quitadas === 0) anosSemQuitar++;
        pagoQuitacoes += custo;
      }
      const ativasDepois = encerrou ? 0 : ativas - quitadas;

      linhas.push({
        ano, mesesPagos: mesesAno, ativasAntes: ativas, parcelaAntes, saldoFatia,
        quitadas, custoQuitacao: custo, sobra, ativasDepois,
        parcelaDepois: ativasDepois * parcelaFatia,
        pagoNoAno: pagoAno + custo, encerrouNoPrazo: encerrou,
      });

      ativas = ativasDepois;
      if (ativas === 0 && mesQuitouTudo === null) mesQuitouTudo = mesesDecorridos;
    }

    const custoEstrategia = pagoParcelas + pagoQuitacoes;
    const custoPadrao = nFatias * parcelaFatia * prazo;

    // Taxa EQUIVALENTE: que taxa, num contrato único no prazo padrão, custaria o mesmo
    // total da estratégia? (bisseção — custo total é crescente na taxa). A taxa real
    // continua sendo a contratual: quitação pelo saldo devedor não muda a taxa, muda o tempo.
    let taxaEquivalente: number | null = null;
    if (custoEstrategia > financiado && custoEstrategia < custoPadrao) {
      let lo = 0.000001, hi = i;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        if (pmt(financiado, mid, prazo) * prazo < custoEstrategia) lo = mid; else hi = mid;
      }
      taxaEquivalente = ((lo + hi) / 2) * 100;
    }

    return {
      taxaEquivalente,
      fatia, parcelaFatia, parcelaInicial: nFatias * parcelaFatia, linhas,
      pagoParcelas, pagoQuitacoes, custoEstrategia, custoPadrao,
      economia: custoPadrao - custoEstrategia,
      mesesTotal: mesQuitouTudo ?? prazo,
      anosSemQuitar,
    };
  }, [valor, financiado, nFatias, grat, taxa, prazo]);

  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40";
  const labelCls = "block text-xs font-semibold mb-1.5";
  const card = (label: string, valor: string, cor = "text-foreground", sub?: string) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-extrabold ${cor}`}>{valor}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );

  const maxParcela = res ? res.parcelaInicial : 1;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold">Amortização Anual</h1>
      <p className="text-[13px] text-muted-foreground mt-1 mb-5">
        O contrato é dividido em <strong>fatias iguais</strong>. A cada 12 meses o cliente usa a gratificação para{" "}
        <strong>quitar fatias inteiras</strong> pelo saldo devedor — quantas couberem. A sobra do ano não acumula.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div><label className={labelCls}>Valor p/ o cliente (R$)</label><input className={inputCls} value={valorStr} onChange={e => setValorStr(e.target.value)} /></div>
        <div><label className={labelCls}>Nº de fatias</label><input className={inputCls} value={fatiasStr} onChange={e => setFatiasStr(e.target.value.replace(/\D/g, ""))} /></div>
        <div><label className={labelCls}>Gratificação anual (R$)</label><input className={inputCls} value={gratStr} onChange={e => setGratStr(e.target.value)} /></div>
        <div><label className={labelCls}>Taxa (% a.m.)</label><input className={inputCls} value={taxaStr} onChange={e => setTaxaStr(e.target.value)} /></div>
        <div><label className={labelCls}>Prazo (meses)</label><input className={inputCls} value={prazoStr} onChange={e => setPrazoStr(e.target.value.replace(/\D/g, ""))} /></div>
        <div><label className={labelCls}>IOF / Encargos (%)</label><input className={inputCls} value={iofStr} onChange={e => setIofStr(e.target.value)} title="Embutido automaticamente no valor financiado — o cliente vê o valor líquido" /></div>
      </div>

      {res && (
        <>
          {/* Resumo da estrutura */}
          <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-900 px-4 py-2.5 text-[13px] mb-5">
            Cliente recebe <strong>{fmtR(valor)}</strong> em <strong>{nFatias} contratos</strong> · parcela de {fmtR(res.parcelaFatia)} cada ·{" "}
            parcela total inicial <strong>{fmtR(res.parcelaInicial)}</strong> · {prazo} meses a {fmtN(taxa)}% a.m.
            <span className="text-muted-foreground"> · IOF/encargos de {fmtN(iofPerc)}% já embutidos</span>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {card("Quita tudo em", `${res.mesesTotal} meses`, "text-violet-700 dark:text-violet-400",
              res.mesesTotal < prazo ? `${(prazo - res.mesesTotal)} meses antes do prazo (${prazo})` : "só termina no prazo normal")}
            {card("Custo com a estratégia", fmtR(res.custoEstrategia), "text-foreground",
              `parcelas ${fmtR(res.pagoParcelas)} + quitações ${fmtR(res.pagoQuitacoes)}`)}
            {card("Custo no prazo padrão", fmtR(res.custoPadrao), "text-red-600 dark:text-red-400",
              `${fmtR(res.parcelaInicial)} × ${prazo} meses`)}
            {card(res.economia >= 0 ? "Economia gerada" : "Custo a mais", fmtR(Math.abs(res.economia)),
              res.economia >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
              res.economia >= 0 ? "juros que o cliente deixa de pagar" : "")}
            {card("Taxa equivalente",
              res.taxaEquivalente != null ? `${fmtN(res.taxaEquivalente)}% a.m.` : "—",
              "text-violet-700 dark:text-violet-400",
              res.taxaEquivalente != null ? `no prazo padrão, pro mesmo custo (contrato: ${fmtN(taxa)}%)` : "")}
          </div>

          {res.anosSemQuitar > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-2.5 text-[13px] text-amber-800 dark:text-amber-300 mb-5">
              ⚠️ Em {res.anosSemQuitar} ano(s) a gratificação de {fmtR(grat)} não cobre o saldo de uma fatia — nenhuma quitação nesses anos.
              Aumente o nº de fatias (fatias menores) para a gratificação alcançar.
            </div>
          )}

          {/* Tabela ano a ano */}
          <div className="text-sm font-bold mb-2">Ano a ano — como a parcela cai</div>
          <div className="rounded-xl border border-border overflow-x-auto mb-6">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <th className="text-left px-3 py-2">Ano</th>
                  <th className="text-center px-3 py-2">Fatias ativas</th>
                  <th className="text-right px-3 py-2">Parcela mensal</th>
                  <th className="text-right px-3 py-2">Saldo por fatia</th>
                  <th className="text-center px-3 py-2">Quita no 13º</th>
                  <th className="text-right px-3 py-2">Custo da quitação</th>
                  <th className="text-right px-3 py-2">Sobra</th>
                  <th className="text-right px-3 py-2">Parcela após</th>
                  <th className="text-right px-3 py-2">Pago no ano</th>
                </tr>
              </thead>
              <tbody>
                {res.linhas.map(l => (
                  <tr key={l.ano} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold">{l.ano}º{l.mesesPagos < 12 ? <span className="text-[10px] text-muted-foreground"> ({l.mesesPagos}m)</span> : ""}</td>
                    <td className="px-3 py-2 text-center">{l.ativasAntes}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 rounded bg-violet-200 dark:bg-violet-900" style={{ width: `${Math.max(4, (l.parcelaAntes / maxParcela) * 90)}px` }} />
                        <span className="font-semibold">{fmtR(l.parcelaAntes)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{l.encerrouNoPrazo ? "—" : fmtR(l.saldoFatia)}</td>
                    <td className="px-3 py-2 text-center">
                      {l.encerrouNoPrazo
                        ? <span className="text-[11px] text-muted-foreground">fim do prazo</span>
                        : l.quitadas > 0
                          ? <span className="font-bold text-green-600 dark:text-green-400">{l.quitadas} fatia{l.quitadas > 1 ? "s" : ""}</span>
                          : <span className="text-amber-600 font-semibold">nenhuma</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{l.custoQuitacao > 0 ? fmtR(l.custoQuitacao) : "—"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{l.encerrouNoPrazo ? "—" : fmtR(l.sobra)}</td>
                    <td className="px-3 py-2 text-right font-bold text-violet-700 dark:text-violet-400">{fmtR(l.parcelaDepois)}</td>
                    <td className="px-3 py-2 text-right">{fmtR(l.pagoNoAno)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-violet-600 bg-muted/30 font-bold">
                  <td className="px-3 py-2" colSpan={5}>TOTAL</td>
                  <td className="px-3 py-2 text-right">{fmtR(res.pagoQuitacoes)}</td>
                  <td></td><td></td>
                  <td className="px-3 py-2 text-right">{fmtR(res.custoEstrategia)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Quitação pelo saldo devedor (valor presente das parcelas restantes) no 12º mês de cada ano.
            A ordem e a data das quitações ficam a critério do cliente; a simulação assume uma quitação por ano.
            <br />A taxa contratual não muda com a estratégia ({fmtN(taxa)}% a.m.) — a economia vem do tempo menor em que os juros correm.
            A <strong>taxa equivalente</strong> é a taxa que, num contrato normal de {prazo} meses, custaria o mesmo total.
          </p>
        </>
      )}
    </div>
  );
}
