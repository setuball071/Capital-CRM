// Contas de consignado que o Jarvis precisa responder com NÚMERO, não com fórmula.
// Um LLM erra taxa (exige iteração) e ainda despeja LaTeX na tela. Aqui a conta é
// feita em código, determinística, e o resultado entra no contexto da resposta.

export type ResultadoCalculo = {
  tipo: "taxa" | "parcela" | "saldo";
  texto: string;
};

/** "68.726,20" / "68726,20" / "1185.73" → number */
function parseNumeroBr(bruto: string): number {
  let s = bruto.trim().replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

// Ordem importa: milhar com ponto, decimal com vírgula, decimal com ponto, inteiro.
// Sem isso, "68726,20" casava só com "687".
const NUM = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d+\.\d{1,2}|\d+)`;

function acharDepois(texto: string, rotulos: string): number | null {
  const re = new RegExp(`(?:${rotulos})\\s*(?:de|:|=|em|r\\$)?\\s*(?:r\\$)?\\s*${NUM}`, "i");
  const m = texto.match(re);
  return m ? parseNumeroBr(m[1]) : null;
}

/** Parcela: PV × i ÷ (1 − (1+i)^−n). Com i = 0, é PV/n. */
function parcelaDe(pv: number, i: number, n: number): number {
  if (i <= 0) return pv / n;
  return (pv * i) / (1 - Math.pow(1 + i, -n));
}

/** Taxa mensal por bisseção — a única que não tem fórmula fechada. */
function taxaDe(pv: number, pmt: number, n: number): number | null {
  if (pmt * n <= pv) return null; // sem juros: não há taxa positiva
  let lo = 0.0000001;
  let hi = 1; // 100% a.m. é teto de sobra
  for (let k = 0; k < 200; k++) {
    const meio = (lo + hi) / 2;
    if (parcelaDe(pv, meio, n) > pmt) hi = meio;
    else lo = meio;
  }
  const i = (lo + hi) / 2;
  return i > 0.0000002 ? i : null;
}

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
const coefTxt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 7 });

/**
 * Lê a pergunta e, quando ela traz dados suficientes, resolve a conta.
 * Retorna null quando não é pergunta de cálculo — aí o fluxo normal segue.
 */
export function calcularDaPergunta(perguntaOriginal: string): ResultadoCalculo | null {
  const texto = perguntaOriginal.toLowerCase();

  // O que está sendo PEDIDO. Sem isso, "qual a parcela de 50000" leria 50000
  // como se fosse a parcela — e a conta sairia pelo avesso. As bordas de palavra
  // são obrigatórias: sem elas, o "do" de "salDO" virava verbo.
  const pedeTaxa = /\b(qual|calcul\w*|descobrir|achar)\b[^.?]{0,25}\b(taxa|juros)\b/.test(texto);
  const pedeParcela = /\b(qual|quanto|calcul\w*|quero)\b[^.?]{0,25}\b(parcela|prestação|mensalidade)\b/.test(texto);
  const pedeSaldo = /\b(quanto|qual)\b[^.?]{0,25}\b(financia\w*|libera\w*|valor financiado|saldo)\b/.test(texto);

  // Prazo: "120x", "120 meses", "em 120 parcelas"
  let prazo: number | null = null;
  const mPrazo = texto.match(/(\d{1,3})\s*(?:x\b|meses|vezes|parcelas\b|prestações\b)/);
  if (mPrazo) prazo = parseInt(mPrazo[1], 10);

  // Taxa só vale como ENTRADA quando não é ela a pergunta
  let taxa: number | null = null;
  if (!pedeTaxa) {
    const mTaxa = texto.match(new RegExp(`(?:taxa|juros)\\s*(?:de|:|=)?\\s*${NUM}\\s*%?|${NUM}\\s*%`, "i"));
    const bruto = mTaxa ? (mTaxa[1] ?? mTaxa[2]) : null;
    if (bruto) {
      const v = parseNumeroBr(bruto);
      if (Number.isFinite(v) && v > 0 && v < 100) taxa = v / 100;
    }
  }

  let saldo = pedeSaldo
    ? null
    : acharDepois(texto, "saldo devedor|saldo|valor financiado|financiamento|valor do contrato|contrato|montante|liberado|principal|valor");
  let parcela = pedeParcela
    ? null
    : acharDepois(texto, "parcela|prestação|mensalidade|pmt");

  // Números soltos (sem rótulo) completam o que faltou: o maior vira saldo, o
  // menor vira parcela. É como o corretor escreve na pressa.
  const usados = new Set<number>();
  if (prazo !== null) usados.add(prazo);
  if (saldo !== null) usados.add(saldo);
  if (parcela !== null) usados.add(parcela);
  const soltos = (texto.match(new RegExp(NUM, "g")) || [])
    .map(parseNumeroBr)
    .filter((v) => Number.isFinite(v) && v > 0 && !usados.has(v))
    .filter((v) => !(taxa !== null && Math.abs(v - taxa * 100) < 0.0001))
    .sort((a, b) => b - a);
  if (saldo === null && !pedeSaldo && soltos.length) saldo = soltos.shift()!;
  if (parcela === null && !pedeParcela && soltos.length) parcela = soltos.pop()!;

  const ok = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;

  // 1) Taxa: saldo + prazo + parcela
  if (ok(saldo) && ok(parcela) && ok(prazo) && saldo !== parcela) {
    const i = taxaDe(saldo, parcela, prazo);
    const total = parcela * prazo;
    if (i === null) {
      return {
        tipo: "taxa",
        texto:
          `Entrada: saldo ${brl(saldo)}, ${prazo} parcelas de ${brl(parcela)}.\n` +
          `Total pago ${brl(total)} — não cobre o saldo com juros, então não existe taxa positiva para esses números. Confirme os valores.`,
      };
    }
    const aa = Math.pow(1 + i, 12) - 1;
    return {
      tipo: "taxa",
      texto:
        `Entrada: saldo ${brl(saldo)}, ${prazo} parcelas de ${brl(parcela)}.\n` +
        `Taxa: ${pct(i)} ao mês (${pct(aa)} ao ano).\n` +
        `Coeficiente: ${coefTxt(parcela / saldo)}.\n` +
        `Total pago: ${brl(total)} — juros de ${brl(total - saldo)}.`,
    };
  }

  // 2) Parcela: saldo + prazo + taxa
  if (ok(saldo) && ok(prazo) && ok(taxa)) {
    const p = parcelaDe(saldo, taxa, prazo);
    return {
      tipo: "parcela",
      texto:
        `Entrada: saldo ${brl(saldo)}, ${prazo} meses, taxa ${pct(taxa)} ao mês.\n` +
        `Parcela: ${brl(p)}.\n` +
        `Coeficiente: ${coefTxt(p / saldo)}.\n` +
        `Total pago: ${brl(p * prazo)}.`,
    };
  }

  // 3) Saldo: parcela + prazo + taxa
  if (ok(parcela) && ok(prazo) && ok(taxa)) {
    const pv = (parcela * (1 - Math.pow(1 + taxa, -prazo))) / taxa;
    return {
      tipo: "saldo",
      texto:
        `Entrada: parcela ${brl(parcela)}, ${prazo} meses, taxa ${pct(taxa)} ao mês.\n` +
        `Valor financiado: ${brl(pv)}.\n` +
        `Total pago: ${brl(parcela * prazo)}.`,
    };
  }

  return null;
}
