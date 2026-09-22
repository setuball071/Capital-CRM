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
   *  parcela = parcela total desejada (menor = reduz a parcela);
   *  troco = troco líquido total desejado. */
  modo: ModoRefin;
  prazo: number;
  /** parcela total (modo parcela) ou troco líquido total (modo troco) */
  valor?: number | null;
}

export interface PrecoContrato {
  contratoId: string;
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
  taxa: number;
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

/** Precifica os contratos aceitos por UM banco. Nos modos parcela/troco o valor
 *  total é distribuído pelo saldo de cada contrato, como no simulador antigo. */
export function precificarRefin(
  contratos: { id: string; saldo: number; parcela: number }[],
  taxaPct: number, trocoMin: number, op: OperacaoEntrada,
): { linhas: PrecoContrato[]; resumo: ResumoRefin } {
  const f = fatorPrice(taxaPct / 100, op.prazo);
  const pv = (pmt: number) => pmt / f;
  const pmt = (v: number) => v * f;
  const totalSaldo = contratos.reduce((a, c) => a + c.saldo, 0);
  const valor = Number(op.valor) || 0;

  const linhas = contratos.map((c): PrecoContrato => {
    const peso = totalSaldo > 0 ? c.saldo / totalSaldo : 0;
    let trocoBruto: number, parcelaNova: number;
    if (op.modo === "troco") {
      const liquido = valor * peso;
      trocoBruto = liquido * (1 + IOF_RATE);
      parcelaNova = pmt(c.saldo + trocoBruto);
    } else {
      parcelaNova = op.modo === "parcela" ? valor * peso : c.parcela;
      trocoBruto = pv(parcelaNova) - c.saldo;
    }
    const base = { contratoId: c.id, saldo: c.saldo, parcelaAtual: c.parcela };
    if (!(trocoBruto > 0)) {
      return { ...base, parcelaNova: pmt(c.saldo), trocoBruto: 0, iof: 0, trocoLiquido: 0, valorContrato: c.saldo,
        viavel: false, motivo: `Sem troco em ${op.prazo} meses: a parcela mínima é ${brl(pmt(c.saldo))}.` };
    }
    const iof = trocoBruto * (1 - 1 / (1 + IOF_RATE));
    const trocoLiquido = trocoBruto - iof;
    const erros: string[] = [];
    if (trocoLiquido < trocoMin - 0.01) erros.push(`troco abaixo do mínimo de ${brl(trocoMin)}`);
    if (parcelaNova > c.parcela + 0.01) erros.push(`parcela nova maior que a atual (${brl(c.parcela)})`);
    return { ...base, parcelaNova, trocoBruto, iof, trocoLiquido, valorContrato: c.saldo + trocoBruto,
      viavel: !erros.length, motivo: erros.length ? erros.join("; ") : "" };
  });

  const ok = linhas.filter(l => l.viavel);
  const soma = (k: keyof PrecoContrato) => ok.reduce((a, l) => a + (l[k] as number), 0);
  return {
    linhas,
    resumo: {
      modo: op.modo, prazo: op.prazo, taxa: taxaPct, trocoMin, contratos: ok.length,
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
  if (modo !== "maximo" && !(valor > 0)) return null;   // sem o valor desejado não há o que calcular
  return { modo, prazo, valor: modo === "maximo" ? null : valor };
}
