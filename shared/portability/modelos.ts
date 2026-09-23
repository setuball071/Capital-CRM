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
    id: "parana-siape-2026-09",
    banco: "Paraná Banco",
    convenio: "SIAPE",
    fonteDescricao: "Resumo Portabilidade SIAPE 08/06/2026 + comparativo Bevi 18/09/2026 (taxa do refin, comissão e idade a confirmar com o Fábio)",
    regras: {
      taxaEntradaMin: 1.00,             // comparativo Bevi
      // o PDF não traz saldo mínimo
      trocoMinPorContrato: 100,         // "valor liberado: refin de port 100,00"
      parcelaMinima: 200,
      // ⚠️ o PDF diz "18 a 77 anos 11 meses e 29 dias". Nos outros bancos isso
      // acabou sendo idade no FIM da operação — cadastrado assim, a confirmar.
      idade: { min: 18, maxFimOperacao: 77 },
      origens: {
        padraoPagasMin: 12,
        redePagasMin: 0,
        lista: [
          { origem: "Bari", porta: false },
          { origem: "Facta", porta: false },
          { origem: "Mercantil", porta: false },   // códigos 389 e 926
          // Fábio corrigiu em 23/09: Agibank, C6 e Inbursa com 12 (o PDF dizia 13 e 25)
          { origem: "Agibank", porta: true, pagasMin: 12 },
          { origem: "Inbursa", porta: true, pagasMin: 12 },
          { origem: "C6", porta: true, pagasMin: 12 },
          { origem: "Pan", porta: true, pagasMin: 25 },
        ],
      },
      avisos: [
        "Faz port pura (único da lista) e unifica a parcela.",
        "Reduz margem negativa.",
        "O banco faz cálculo manual quando o contracheque tem comissão, abono ou gratificação.",
        "Formaliza na digitação e de novo quando o saldo chega; não permite ajuste de tabela; saldo até as 17h.",
        "Falta cadastrar a taxa do refin do Paraná (o mínimo do banco é 1,60).",
      ],
      taxaRefin: null,                                  // a confirmar com o Fábio
      comissao: { percentual: 2.70, base: "saldo" },    // Fábio, 23/09/2026
    },
  },
  {
    id: "inter-siape-2026-09",
    banco: "Inter",
    convenio: "SIAPE",
    fonteDescricao: "Resumo Portabilidade SIAPE 08/06/2026 + cadastro antigo do simulador, conferidos com o Fábio em 23/09/2026",
    regras: {
      // o Inter não tem taxa de entrada: o contrato pode vir com qualquer taxa,
      // desde que a PONDERADA passe (conta feita na aba Viabilidade Inter)
      taxaEntradaMin: null,
      saldoMin: 1000,
      trocoMinPorContrato: 300,
      valorMaxContrato: 270000,          // limite da operação, já somando o troco
      idade: { min: 21, maxFimOperacao: 79 },   // terminar com 79 anos e 11 meses
      origens: {
        padraoPagasMin: 0,               // o Inter porta tudo com 0 pagas
        lista: [
          { origem: "Facta", porta: false },
          { origem: "Master", porta: false },
        ],
      },
      avisos: [
        "Quem decide o Inter é a TAXA PONDERADA (mínimo 1,63% no SIAPE, 1,60% com seguro): use o botão \"Validar no Inter\" para a conta oficial.",
        "Coobrigação de 90 dias.",
        "Ajuste de tabela quando o saldo chega: normal, flex 1 ou flex 2.",
        "Formalização: contrato da port, nuvídeo quando o saldo chega e novo contrato no refin.",
        "Comissão por tabela (parte da casa, informada pelo Fábio em 23/09/2026): T1 0,35% · T2 0,65% · T3 1,00% · T4 1,35% · T5 1,70% · T6 2,05%.",
      ],
      // taxa do refin e comissão ficam na Viabilidade Inter (31 tabelas + taxa ponderada)
      taxaRefin: null,
      comissao: null,
    },
  },
  {
    id: "daycoval-siape-2026-09",
    banco: "Daycoval",
    convenio: "SIAPE",
    fonteDescricao: "Resumo Portabilidade SIAPE 08/06/2026 + comparativo Bevi 18/09/2026, completado com o Fábio em 23/09/2026",
    regras: {
      taxaEntradaMin: 1.36,             // comparativo Bevi
      saldoMin: 5000,                   // Fábio, 23/09/2026
      trocoMinPorContrato: 100,
      parcelaMinima: 20,
      // 75 anos é a idade no FIM da operação (Fábio, 23/09): com 120 meses, no
      // máximo 64 anos e 11 meses na contratação.
      idade: { min: 18, maxFimOperacao: 75 },
      origens: {
        padraoPagasMin: 12,
        redePagasMin: 6,                // "bancos de rede — 6"
        lista: [
          { origem: "C6", porta: false },
          { origem: "Safra", porta: false },
          { origem: "Alfa", porta: false },
          { origem: "Facta", porta: true, pagasMin: 24 },
          { origem: "Inbursa", porta: true, pagasMin: 13 },
          { origem: "Agibank", porta: true, pagasMin: 15 },
          { origem: "Pan", porta: true, pagasMin: 25 },
          { origem: "Itaú", porta: true, pagasMin: 12 },   // mesmo sendo banco de rede, o PDF dá regra própria
          { origem: "BRB", porta: true, pagasMin: 12 },   // Fábio corrigiu em 23/09 (o PDF dizia 0)
          { origem: "Pine", porta: true, pagasMin: 0 },
          { origem: "QI Tech", porta: true, pagasMin: 0 },
          { origem: "NBC", porta: true, pagasMin: 24 },
        ],
      },
      avisos: [
        "Reduz margem negativa; não agrega margem.",
        "Permite ajuste de tabela; o saldo precisa de atuação até as 16h50.",
        "Não faz port pura.",
      ],
      taxaRefin: 1.70,                                   // Fábio, 23/09/2026 (mínima do banco: 1,55)
      comissao: { percentual: 0.75, base: "saldo" },     // Fábio, 23/09/2026
    },
  },
  {
    id: "safra-siape-2026-09",
    banco: "Safra Financeira",
    convenio: "SIAPE",
    fonteDescricao: "Resumo Portabilidade SIAPE 08/06/2026 + anotações da casa, conferidos com o Fábio em 22/09/2026",
    regras: {
      taxaEntradaMin: 1.20,
      saldoMin: 10000,                  // Fábio: abaixo de 10 mil o Safra não porta
      trocoMinPorContrato: 500,
      grupoBancario: "SAFRA",           // Safra e Alfa são o mesmo grupo: um não porta o outro
      // não há teto de idade hoje: o que manda é terminar a operação com até 78 anos
      idade: { min: 21, maxFimOperacao: 78 },
      // duas frentes de refin. A taxa é a da casa (tabela do banco + margem de segurança)
      faixasRefin: [
        { minValor: 10000, taxa: 1.70, taxaOficial: 1.65, comissaoPercentual: 2.55, rotulo: "10k a 20k" },
        { minValor: 20000, taxa: 1.65, taxaOficial: 1.59, comissaoPercentual: 1.70, rotulo: "a partir de 20k" },
      ],
      origens: {
        padraoPagasMin: 12,
        redePagasMin: 0,                // bancos de rede portam com 0 pagas
        lista: [
          { origem: "Daycoval", porta: false },
          { origem: "Inbursa", porta: false },
          { origem: "Facta", porta: true, pagasMin: 24 },
          // ⚠️ C6 e Pan: o PDF do banco diz 25 e as anotações da casa dizem 18 e 15.
          // Ficou com o valor mais exigente até o Fábio confirmar.
          { origem: "C6", porta: true, pagasMin: 25 },
          { origem: "Pan", porta: true, pagasMin: 25 },
          { origem: "Banrisul", porta: true, pagasMin: 12 },
        ],
      },
      avisos: [
        "O banco tem cálculo próprio de viabilidade: digite com o saldo mais atualizado possível.",
        "A proposta trava no STOP até o saldo voltar; o saldo só é pago depois da liberação.",
        "Atuação do saldo até as 12h.",
        "Não atende secretarias de ex-territórios (Amapá, Roraima, Rondônia e demais).",
        "Pensionista temporário sem data fim: o banco só aceita mulheres — o sistema manda para conferência.",
      ],
    },
  },
  {
    id: "brb-red-siape-2026-09",
    banco: "BRB Red",
    convenio: "SIAPE",
    fonteDescricao: "Anotações da casa (REGRAS PORT BRB) + Resumo Portabilidade SIAPE 08/06/2026, conferidos com o Fábio em 22/09/2026",
    regras: {
      // o BRB não tem taxa de entrada na portabilidade (o refin é que remunera)
      taxaEntradaMin: null,
      saldoMin: 4000.01,
      trocoMinPorContrato: 50,          // confirmado pelo Fábio (o PDF dizia 100)
      grupoBancario: "BRB",             // BRB Red, Consig360 e Banco de Brasília não se portam
      idade: { max: 64, maxCeletista: 58, codigosCeletista: ["25", "27", "43"] },
      situacaoFuncional: {
        // lista do Word confirmada com o Fábio em 22/09/2026. Cedido SUS (45) fica de fora.
        aceitos: [
          { codigo: "1", descricao: "ATIVO PERMANENTE" },
          { codigo: "2", descricao: "APOSENTADO" },
          { codigo: "8", descricao: "CEDIDO" },
          { codigo: "25", descricao: "CLT ANS DEC JUDICIAL" },
          { codigo: "27", descricao: "CLT ANS JUD. CEDIDO" },
          { codigo: "33", descricao: "REFORMA CBM / PM" },
          { codigo: "34", descricao: "RESERVA CBM / PM" },
          { codigo: "43", descricao: "CLT ANS - DEC 6657/08" },
          { codigo: "84", descricao: "PENSIONISTA" },
          { codigo: "93", descricao: "BENEFICIARIO PENSÃO" },
        ],
      },
      pensionistas: { codigos: ["84", "93"], temporariaAceita: false },   // BRB só faz pensão vitalícia
      origens: {
        padraoPagasMin: 12,             // demais bancos: 12 pagas (+ 360 dias de averbação, ainda não conferido pelo sistema)
        lista: [
          { origem: "C6", porta: false },
          { origem: "Agibank", porta: false },
          { origem: "PicPay", porta: false },
          { origem: "Pine", porta: false },
          { origem: "Inbursa", porta: false },
          // porta com 1 parcela paga
          { origem: "Banco do Brasil", porta: true, pagasMin: 1 },
          { origem: "Itaú", porta: true, pagasMin: 1 },
          { origem: "Caixa", porta: true, pagasMin: 1 },
          { origem: "Bradesco", porta: true, pagasMin: 1 },
          { origem: "Sicoob", porta: true, pagasMin: 1 },
          { origem: "Alfa", porta: true, pagasMin: 1 },
          { origem: "Nubank", porta: true, pagasMin: 1 },
          { origem: "Inter", porta: true, pagasMin: 1 },
          { origem: "QI Tech", porta: true, pagasMin: 1 },
          { origem: "Mercantil", porta: true, pagasMin: 1 },
          { origem: "Santander", porta: true, pagasMin: 1 },
          { origem: "Daycoval", porta: true, pagasMin: 1 },
          { origem: "Pan", porta: true, pagasMin: 12 },
        ],
      },
      avisos: [
        "Refin obrigatório para comissionamento.",
        "Santander: a regra de 1 paga vale para contratos iniciados em 20, 30 ou 40 — confira o número.",
        "Demais bancos: além das 12 pagas, o contrato precisa de 360 dias de averbação (o sistema ainda não confere isso).",
        "Cedido: o BRB só faz refinanciamento nesses casos.",
        "Cedido SUS (código 45) não é atendido: fica fora da lista de situações aceitas.",
        "Não aceita e-mail funcional no cadastro.",
        "Convênios suspensos: Amazônia Azul, CBTU, EBSERH, EBC, EPL, Trensurb, FUNAI, HC Porto Alegre, INB, IPHAN, NUCLEP, Presidência da República, Telebrás, UFV e Valec.",
      ],
      taxaRefin: 1.65,                                   // mínima do banco é 1,60; o Fábio calcula com 1,65 (margem de segurança)
      comissao: { percentual: 2.05, base: "saldo" },     // informado pelo Fábio em 22/09/2026
    },
  },
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
