// ═══════════════════════════════════════════════════════════════════════════
// SIMULADOR DE COMPRA — a mesma conta da planilha do Fábio.
//
//   saldo    = saldo real do banco; sem ele, parcela da folha × fator (ex.: 23)
//   bruto    = margem ÷ coeficiente da tabela
//   liberado = bruto − saldo            (o líquido do cliente)
//   comissão = bruto × percentual       (sobre o BRUTO, não sobre o saldo)
//
// Parcela e margem são separadas de propósito: a parcela estima o saldo, a
// margem é a que se usa na compra (pode ser igual à parcela ou maior).
// ═══════════════════════════════════════════════════════════════════════════

export interface TabelaCompra {
  id: number | string;
  banco: string;
  /** SIAPE, INSS, GOV SP… cada tabela vale para um convênio. */
  convenio?: string | null;
  nome?: string | null;
  coeficiente: number;
  /** % da empresa. Ausente para quem não é master. */
  percentual?: number | null;
  prazo?: number | null;
}

export interface EntradaCompra {
  parcela: number;      // parcela da folha
  fator: number;        // multiplicador do saldo estimado
  saldoReal: number;    // 0 = não informado
  margem: number;       // 0 = usa a parcela
}

export interface LinhaCompra {
  tabela: TabelaCompra;
  bruto: number;
  liberado: number;
  comissao: number | null;
}

export interface ResultadoCompra {
  saldo: number;
  saldoEstimado: boolean;
  margemUsada: number;
  margemEhParcela: boolean;
  linhas: LinhaCompra[];
}

export function calcularCompra(e: EntradaCompra, tabelas: TabelaCompra[]): ResultadoCompra {
  const saldoEstimado = !(e.saldoReal > 0);
  const saldo = saldoEstimado ? Math.max(0, e.parcela) * Math.max(0, e.fator) : e.saldoReal;
  const margemEhParcela = !(e.margem > 0);
  const margemUsada = margemEhParcela ? Math.max(0, e.parcela) : e.margem;

  const linhas = margemUsada > 0
    ? tabelas.filter(t => t.coeficiente > 0).map(t => {
        const bruto = margemUsada / t.coeficiente;
        return {
          tabela: t,
          bruto,
          liberado: bruto - saldo,
          comissao: t.percentual == null ? null : bruto * t.percentual / 100,
        };
      })
    : [];
  return { saldo, saldoEstimado, margemUsada, margemEhParcela, linhas };
}

/** As 15 tabelas da planilha do Fábio (22/09/2026). O coeficiente da 3ª Neo
 *  aparecia formatado como "R$ 0,04"; 0,0390892 sai do bruto dela (6.395,63). */
export const TABELAS_PLANILHA: Omit<TabelaCompra, "id">[] = [
  { banco: "Neo", convenio: "SIAPE", coeficiente: 0.042824888, percentual: 28 },
  { banco: "Neo", convenio: "SIAPE", coeficiente: 0.0409485, percentual: 25 },
  { banco: "Neo", convenio: "SIAPE", coeficiente: 0.0390892, percentual: 22, nome: "confira o coeficiente" },
  { banco: "Neo", convenio: "SIAPE", coeficiente: 0.037249047, percentual: 16 },
  { banco: "Neo", convenio: "SIAPE", coeficiente: 0.035430218, percentual: 13 },
  { banco: "Neo", convenio: "SIAPE", coeficiente: 0.03363509, percentual: 7 },
  { banco: "Neo", convenio: "SIAPE", coeficiente: 0.032747199, percentual: 4 },
  { banco: "Neo", convenio: "SIAPE", coeficiente: 0.031866193, percentual: 2 },
  { banco: "Futuro", convenio: "SIAPE", coeficiente: 0.032902, percentual: 2 },
  { banco: "Futuro", convenio: "SIAPE", coeficiente: 0.037439, percentual: 7.2 },
  { banco: "Futuro", convenio: "SIAPE", coeficiente: 0.036092, percentual: 7.2 },
  { banco: "Futuro", convenio: "SIAPE", coeficiente: 0.048589, percentual: 34 },
  { banco: "Futuro", convenio: "SIAPE", coeficiente: 0.041346, percentual: 22 },
  { banco: "Futuro", convenio: "SIAPE", coeficiente: 0.044435, percentual: 28 },
  { banco: "Futuro", convenio: "SIAPE", coeficiente: 0.050119, percentual: 38 },
];
