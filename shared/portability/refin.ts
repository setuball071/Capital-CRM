// ═══════════════════════════════════════════════════════════════════════════
// REFIN DA PORTABILIDADE — troco e parcela por contrato.
//
// A MESMA matemática do simulador antigo (ferramentas-portabilidade.html:
// mkPrice, calcIOF, trocoBrutoDeLiquido e o modo "Separado"), com uma diferença
// pedida pelo Fábio: o prazo não é fixo em 120 — o operador escolhe; a taxa é
// sempre a do banco (taxaRefin da regra vigente).
//
//   parcela   = Price(taxa do banco, prazo escolhido) sobre (saldo + troco bruto)
//   IOF       = troco bruto − troco bruto ÷ 1,032
//   líquido   = troco bruto − IOF           (o que o cliente recebe)
//   contrato  = saldo + troco bruto          (valor bruto do contrato novo)
// ═══════════════════════════════════════════════════════════════════════════

export const IOF_RATE = 0.032;

export type ModoRefin = "maximo" | "parcela" | "troco";

export interface OperacaoEntrada {
  /** maximo = mantém a parcela de cada contrato e libera o maior troco;
   *  parcela = reduz a parcela o máximo possível: cada contrato libera só o
   *  TROCO MÍNIMO do banco (regra do Fábio);
   *  troco = troco líquido total desejado. */
  modo: ModoRefin;
  prazo: number;
  /** troco líquido total (só no modo troco) */
  valor?: number | null;
}

export interface PrecoContrato {
  contratoId: string;
  /** taxa usada neste contrato (bancos com faixa cobram taxas diferentes por valor) */
  taxa: number;
  saldo: number;
  parcelaAtual: number;
  parcelaNova: number;
  trocoBruto: number;
  iof: number;
  trocoLiquido: number;
  valorContrato: number;
  /** false = não fecha (sem troco, troco abaixo do mínimo ou parcela maior que a atual) */
  viavel: boolean;
  motivo: string;
}

export interface ResumoRefin {
  modo: ModoRefin;
  prazo: number;
  /** null = o banco usou mais de uma taxa (faixas por valor) */
  taxa: number | null;
  trocoMin: number;
  /** somas só dos contratos viáveis */
  contratos: number;
  saldo: number;
  valorContrato: number;
  trocoLiquido: number;
  parcelaAtual: number;
  parcelaNova: number;
}

export function fatorPrice(taxaMes: number, prazo: number): number {
  const q = Math.pow(1 + taxaMes, prazo);
  return taxaMes * q / (q - 1);
}

const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Precifica os contratos aceitos por UM banco. No modo troco o valor total é
 *  distribuído pelo saldo de cada contrato, como no simulador antigo.
 *  `taxa` pode ser um número ou uma função do valor do contrato — bancos como o
 *  Safra cobram taxas diferentes por faixa de valor. Como a taxa muda o valor e o
 *  valor escolhe a taxa, calculamos duas vezes: pelo saldo e depois pelo valor. */
export function precificarRefin(
  contratos: { id: string; saldo: number; parcela: number }[],
  taxa: number | ((valor: number) => number | null), trocoMin: number, op: OperacaoEntrada,
  parcelaMin = 0, valorMax = 0,
): { linhas: PrecoContrato[]; resumo: ResumoRefin } {
  const taxaDe = typeof taxa === "function" ? taxa : () => taxa;
  const totalSaldo = contratos.reduce((a, c) => a + c.saldo, 0);
  const valor = Number(op.valor) || 0;

  const linhas = contratos.map((c): PrecoContrato => {
    const peso = totalSaldo > 0 ? c.saldo / totalSaldo : 0;
    const base = { contratoId: c.id, saldo: c.saldo, parcelaAtual: c.parcela };
    const semTrocoOk = op.modo === "parcela" && trocoMin <= 0;   // portabilidade pura

    const calcular = (taxaPct: number) => {
      const f = fatorPrice(taxaPct / 100, op.prazo);
      const pv = (pmt: number) => pmt / f;
      const pmt = (v: number) => v * f;
      let trocoBruto: number, parcelaNova: number;
      if (op.modo === "maximo") {
        parcelaNova = c.parcela;
        trocoBruto = pv(parcelaNova) - c.saldo;
      } else {
        const liquido = op.modo === "parcela" ? trocoMin : valor * peso;
        trocoBruto = liquido * (1 + IOF_RATE);
        parcelaNova = pmt(c.saldo + trocoBruto);
      }
      if (!(trocoBruto > 0) && !semTrocoOk) {
        return { ...base, taxa: taxaPct, parcelaNova: pmt(c.saldo), trocoBruto: 0, iof: 0, trocoLiquido: 0, valorContrato: c.saldo,
          viavel: false, motivo: `Sem troco em ${op.prazo} meses: a parcela mínima é ${brl(pmt(c.saldo))}.` };
      }
      const iof = trocoBruto * (1 - 1 / (1 + IOF_RATE));
      const trocoLiquido = trocoBruto - iof;
      const erros: string[] = [];
      if (trocoLiquido < trocoMin - 0.01) erros.push(`troco abaixo do mínimo de ${brl(trocoMin)}`);
      if (parcelaNova > c.parcela + 0.01) erros.push(`parcela nova maior que a atual (${brl(c.parcela)})`);
      if (parcelaMin > 0 && parcelaNova < parcelaMin - 0.01) erros.push(`parcela nova abaixo da mínima do banco (${brl(parcelaMin)})`);
      if (valorMax > 0 && c.saldo + trocoBruto > valorMax + 0.01) erros.push(`contrato de ${brl(c.saldo + trocoBruto)} acima do limite do banco (${brl(valorMax)})`);
      return { ...base, taxa: taxaPct, parcelaNova, trocoBruto, iof, trocoLiquido, valorContrato: c.saldo + trocoBruto,
        viavel: !erros.length, motivo: erros.length ? erros.join("; ") : "" };
    };

    const t0 = taxaDe(c.saldo);
    if (t0 === null) {
      return { ...base, taxa: 0, parcelaNova: 0, trocoBruto: 0, iof: 0, trocoLiquido: 0, valorContrato: c.saldo,
        viavel: false, motivo: `Saldo de ${brl(c.saldo)} não cai em nenhuma faixa de taxa do banco.` };
    }
    const primeira = calcular(t0);
    const t1 = taxaDe(primeira.valorContrato);
    return t1 !== null && t1 !== t0 ? calcular(t1) : primeira;
  });

  const ok = linhas.filter(l => l.viavel);
  const soma = (k: keyof PrecoContrato) => ok.reduce((a, l) => a + (l[k] as number), 0);
  return {
    linhas,
    resumo: {
      modo: op.modo, prazo: op.prazo, trocoMin, contratos: ok.length,
      taxa: ok.length && ok.every(l => l.taxa === ok[0].taxa) ? ok[0].taxa : null,
      saldo: soma("saldo"), valorContrato: soma("valorContrato"), trocoLiquido: soma("trocoLiquido"),
      parcelaAtual: soma("parcelaAtual"), parcelaNova: soma("parcelaNova"),
    },
  };
}

/** Valida o que vem da tela. null = operação inválida/ausente (não precifica). */
export function normalizarOperacao(v: any): OperacaoEntrada | null {
  if (!v || typeof v !== "object") return null;
  const modo = v.modo === "parcela" || v.modo === "troco" ? v.modo : "maximo";
  const prazo = Math.round(Number(v.prazo));
  if (!Number.isFinite(prazo) || prazo < 1 || prazo > 240) return null;
  const valor = Number(v.valor);
  if (modo === "troco" && !(valor > 0)) return null;   // sem o troco desejado não há o que calcular
  return { modo, prazo, valor: modo === "troco" ? valor : null };
}
