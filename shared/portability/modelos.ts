// ═══════════════════════════════════════════════════════════════════════════
// MODELOS DE REGRA — transcritos dos infográficos que os bancos mandam.
//
// Um modelo NÃO vale sozinho: ele pré-preenche o cadastro, o operador confere
// na tela e salva. A vigência começa quando ele salva (decisão do Fábio:
// "sempre a partir do momento que importa o infográfico").
// ═══════════════════════════════════════════════════════════════════════════
import type { RegrasBanco, OrigemRegra } from "./engine";

export interface ModeloRegra {
  id: string;
  banco: string;
  convenio: string;
  fonteDescricao: string;
  regras: RegrasBanco;
  /** Exceções que o operador já informou junto com a arte. */
  excecoesSugeridas?: { parametros: OrigemRegra; motivo: string }[];
}

export const MODELOS: ModeloRegra[] = [
  {
    id: "pan-siape-2026-09",
    banco: "PAN",
    convenio: "SIAPE",
    fonteDescricao: "Infográfico \"Portabilidade PAN SIAPE — regras atualizadas\" (recebido em 18/09/2026)",
    regras: {
      taxaEntradaMin: 1.20,
      saldoMin: 6000,
      trocoMinPorContrato: 50,         // por contrato (confirmado pelo Fábio)
      origens: {
        padraoPagasMin: 12,            // "demais bancos: autorregulação" = 12 (confirmado pelo Fábio)
        lista: [
          { origem: "Agibank", porta: false },
          { origem: "BRB", porta: false },          // BRB BANCO. A BRB Financeira é exceção, abaixo.
          { origem: "Daycoval", porta: true, pagasMin: 12 },
          { origem: "Inbursa", porta: true, pagasMin: 12 },
          { origem: "QI Tech", porta: true, pagasMin: 12 },
          { origem: "Zema", porta: true, pagasMin: 12 },
          { origem: "Pine", porta: true, pagasMin: 12 },  // arte diz "Pine BPC/LOAS"; em SIAPE vale para o Pine (confirmado)
          { origem: "Itaú", porta: true, pagasMin: 15 },
          { origem: "Safra", porta: true, pagasMin: 15 },
          { origem: "Facta", porta: true, pagasMin: 16 },
          { origem: "Banrisul", porta: true, pagasMin: 30 },
          { origem: "C6", porta: true, pagasMin: 36 },
        ],
      },
      situacaoFuncional: {
        aceitos: [
          { codigo: "1", descricao: "ATIVO PERMANENTE" },
          { codigo: "2", descricao: "APOSENTADO" },
          { codigo: "8", descricao: "CEDIDO" },
          { codigo: "9", descricao: "REDISTRIBUIÇÃO" },
          { codigo: "11", descricao: "EXCEDENTE A LOTAÇÃO" },
          { codigo: "15", descricao: "INSTITUIDOR PENSÃO" },
          { codigo: "17", descricao: "APOSENTADO TCU733/94" },
          { codigo: "21", descricao: "ATIVO PERM. L.8878/94" },
          { codigo: "25", descricao: "CLT ANS DEC JUDICIAL" },
          { codigo: "27", descricao: "CLT ANS JUD. CEDIDO" },
          { codigo: "33", descricao: "REFORMA CBM / PM" },
          { codigo: "34", descricao: "RESERVA CBM / PM" },
          { codigo: "36", descricao: "ANSIT. PUBLICO L10559" },
          { codigo: "37", descricao: "ANSIT. PRIVADO L10559" },
          { codigo: "43", descricao: "CLT ANS - DEC 6657/08" },
          { codigo: "45", descricao: "CEDIDO SUS/LEI 8270" },
          { codigo: "84", descricao: "PENSIONISTA" },
          { codigo: "93", descricao: "BENEFICIARIO PENSÃO" },
          { codigo: "NES 94", descricao: "BENEF. INDENIZ. ANS46" },
          { codigo: "NES 95", descricao: "BENEF. INDENIZ. ANS47" },
        ],
      },
      pensionistas: {
        codigos: ["84", "93"],                        // os dois marcados com * na arte
        temporarioComFim: { folgaMeses: 3 },          // contrato encerrado 3 meses antes do fim da pensão
        temporarioSemFim: { idadeMin: 25 },           // acima de 25 anos completos
      },
      alertasFormalizacao: [
        "Analfabeto",
        "Impossibilitado de assinar",
        "Leis estaduais específicas para idosos (Manual de Formalização — Empréstimo)",
      ],
      avisos: ["Averbação online."],
      taxaRefin: 1.70,                                   // informado pelo Fábio em 18/09/2026
      comissao: { percentual: 0.75, base: "saldo" },     // só sobre o saldo devedor (Fábio, 18/09/2026)
    },
    excecoesSugeridas: [
      { parametros: { origem: "Caixa", porta: true, pagasMin: 0 },
        motivo: "Informado pelo Fábio em 18/09/2026: o PAN porta Caixa com 0 pagas (a arte deixaria em 12, como demais bancos)." },
      { parametros: { origem: "BRB Financeira", porta: true, pagasMin: 0 },
        motivo: "Informado pelo Fábio em 18/09/2026: o PAN não porta o BRB Banco, mas porta a BRB Financeira com 0 pagas." },
    ],
  },
];
