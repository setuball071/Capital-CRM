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
    id: "digio-siape-2026-09",
    banco: "Digio",
    convenio: "SIAPE",
    fonteDescricao: "Comparativo Bevi 18/09/2026 + cadastro antigo do simulador, conferidos com o Fábio em 25/09/2026",
    regras: {
      taxaEntradaMin: 1.39,
      saldoMin: 6000,
      trocoMinPorContrato: 250,
      idade: { min: 18, maxFimOperacao: 79 },   // terminar com 79 (Fábio, 25/09)
      origens: {
        padraoPagasMin: 12,
        redePagasMin: 0,                        // rede: porta e comissiona a partir de 0 pagas
        lista: [
          { origem: "Inter", porta: false },
          { origem: "C6", porta: true, pagasMin: 25 },   // acordo entre os bancos
        ],
      },
      avisos: [
        "Não unifica, não abate margem negativa e não agrega margem.",
        "Não tem simulador próprio; formalização figital.",
        "Falta cadastrar a comissão do Digio.",
      ],
      taxaRefin: 1.71,     // mínima do banco 1,65 + margem de segurança (Fábio, 25/09)
      comissao: null,      // a confirmar
    },
  },
  {
    id: "facta-siape-2026-09",
    banco: "Facta Financeira",
    convenio: "SIAPE",
    fonteDescricao: "Resumo Portabilidade SIAPE 08/06/2026 + comparativo Bevi 18/09/2026 (taxa do refin, comissão e idade a confirmar com o Fábio)",
    regras: {
      // o Bevi marca a Facta como "cálculo automático", sem taxa ponderada nem taxa mínima
      taxaEntradaMin: null,
      saldoMin: 2000,
      trocoMinPorContrato: 50,
      parcelaMinima: 50,
      // ⚠️ o PDF diz "22 a 74 anos 11 meses e 29 dias"; nos outros bancos isso
      // acabou sendo idade no FIM da operação — cadastrado assim, a confirmar.
      idade: { min: 22, maxFimOperacao: 74 },
      origens: {
        padraoPagasMin: 0,               // "demais bancos: 0 pagas"
        lista: [
          { origem: "Inbursa", porta: false },
          { origem: "Pine", porta: false },
          { origem: "Socicred", porta: false },     // código 917
          // só não porta quando o contrato nasceu na própria Facta: o sistema não
          // sabe disso sozinho, então manda conferir em vez de chutar
          { origem: "Paulista", porta: true, conferir: "o Facta não porta contrato originado pela própria Facta — confira a origem do contrato." },
          { origem: "Zema", porta: true, conferir: "o Facta não porta contrato originado pela própria Facta — confira a origem do contrato." },
          { origem: "Agibank", porta: true, pagasMin: 15 },
          { origem: "Paraná Banco", porta: true, pagasMin: 15 },
          { origem: "BMG", porta: true, pagasMin: 12 },
          { origem: "Santander", porta: true, pagasMin: 12 },
          { origem: "Olé", porta: true, pagasMin: 12 },
          { origem: "C6", porta: true, pagasMin: 25 },
          { origem: "Daycoval", porta: true, pagasMin: 24 },
          { origem: "Pan", porta: true, pagasMin: 30 },
        ],
      },
      avisos: [
        "Aceita CNH vencida como documento.",
        "Permite ajuste de tabela; se o troco variar mais de 10%, precisa de nova formalização.",
        "Atuação do saldo: segunda a quinta até as 16h, sexta até as 15h.",
      ],
      taxaRefin: 1.80,                                  // Fábio, 25/09/2026
      comissao: { percentual: 2.50, base: "saldo" },    // Fábio, 25/09/2026
    },
  },
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
      ],
      taxaRefin: 1.65,                                  // mínima do banco 1,60 + margem de segurança (Fábio, 23/09)
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
          { origem: "Digimais", porta: false },   // Fábio, 25/09/2026
        ],
      },
      // UPAGs não atendidas (arte do Inter, 23/09/2026)
      upagsNaoAtendidas: [
        { codigo: "42204", descricao: "DEPTO. NACIONAL DE OBRAS CONTRA AS SECAS", apenasAtivos: true },
        { codigo: "53205", descricao: "AGENCIA DE DESENVOLVIMENTO DA AMAZONIA - ADA" },
        { codigo: "53206", descricao: "AGENCIA DE DESENVOLVIMENTO DO NORDESTE - ADENE" },
        { codigo: "52233", descricao: "AMAZONIA AZUL TECNOLOGIAS DE DEFESA SA" },
        { codigo: "40301", descricao: "COMISSAO NACIONAL DE ENERGIA NUCLEAR - CNEN" },
        { codigo: "29214", descricao: "COMPANHIA BRASILEIRA DE TRENS URBANOS - CBTU" },
        { codigo: "20605", descricao: "COMPANHIA DE DESENVOLV. DE BARCAREMA - CODEBAR" },
        { codigo: "99010", descricao: "COMPANHIA DE PESQUISA DE REC. MINERAIS - CPRM" },
        { codigo: "22203", descricao: "COMPANHIA DESENV. DO VALE SAO FRANCISCO - CODEVASF" },
        { codigo: "22200", descricao: "COMPANHIA NACIONAL DE ABASTECIMENTO - CONAB" },
        { codigo: "37000", descricao: "DEFENSORIA PUBLICA DA UNIAO - DPU" },
        { codigo: null, descricao: "EMPRESA BRAS. DE SERVICOS HOSPITALARES" },
        { codigo: "20415", descricao: "EMPRESA BRASIL DE COMUNICACAO - EBC" },
        { codigo: "22202", descricao: "EMPRESA BRASILEIRA DE PESQ. AGROPECUARIA - EMBRAPA" },
        { codigo: "29205", descricao: "EMPRESA DE TRENS URBANOS DE PORTO ALEGRE - TRENSURB" },
        { codigo: null, descricao: "FACULDADE DE CIENCIAS AGRARIA DO PARA - FCAP" },
        { codigo: "26350", descricao: "FUND. UNIV FEDERAL DA GRANDE DOURADOS - UFGD" },
        { codigo: "26284", descricao: "FUND.UNIV.FED.CIENC.SAUDE D PORTO ALEGRE" },
        { codigo: "26230", descricao: "FUND.UNIV.FED.DO VALE SAO FRANCISCO - UNIVASF" },
        { codigo: "24205", descricao: "FUNDACAO BIBLIOTECA NACIONAL - FBN" },
        { codigo: "40403", descricao: "FUNDACAO CASA DE RUI BARBOSA - FCRB" },
        { codigo: "26292", descricao: "FUNDACAO JOAQUIM NABUCO - FJN" },
        { codigo: "24203", descricao: "FUNDACAO NACIONAL DE ARTES - FUNARTE" },
        { codigo: "36205", descricao: "FUNDACAO NACIONAL DE SAUDE - FUNASA" },
        { codigo: "30202", descricao: "FUNDACAO NACIONAL DO INDIO - FUNAI" },
        { codigo: "16100", descricao: "FUNDACAO OSORIO - F OSORIO" },
        { codigo: "26270", descricao: "FUNDACAO UNIVERSIDADE DO AMAZONAS - FUAM" },
        { codigo: "26272", descricao: "FUNDACAO UNIVERSIDADE DO MARANHAO - FUMA" },
        { codigo: "26251", descricao: "FUNDACAO UNIVERSIDADE FED. DO TOCANTINS - FUFT" },
        { codigo: "26281", descricao: "FUNDACAO UNIVERSIDADE FEDERAL DE SERGIPE - FUFS" },
        { codigo: "26286", descricao: "FUNDACAO UNVERSIDADE FEDERAL DO AMAPA - UNIFAP" },
        { codigo: "26352", descricao: "FUNDACAO UNIVERSIDADE FEDERAL DO ABC" },
        { codigo: "40202", descricao: "FUNDACAO ESCOLA NACIONAL DE ADM. PUBLICA" },
        { codigo: "40803", descricao: "GOVERNO DO EX-TERRITORIO DE RONDONIA - EX-TER/RO" },
        { codigo: "40804", descricao: "GOVERNO DO EX-TERRITORIO DE RORAIMA - EX-TER/RR" },
        { codigo: "40802", descricao: "GOVERNO DO EX-TERRITORIO DO ACRE - EX-TER/AC" },
        { codigo: "36211", descricao: "HOSPITAL CRISTO REDENTOR - HCR" },
        { codigo: "99013", descricao: "HOSPITAL DE CLINICAS DE PORTO ALEGRE - HCPA" },
        { codigo: "36210", descricao: "HOSPITAL NOSSA SENHORA DA CONCEICAO - HNSC" },
        { codigo: "20304", descricao: "INDUSTRIAS NUCLEARES DO BRASIL - INB" },
        { codigo: "40701", descricao: "INST. BR. MEIO AMB. REC. NAT. RENOVAVEIS - IBAMA" },
        { codigo: "40604", descricao: "INSTITUTO BRASILEIRO DE TURISMO - EMBRATUR" },
        { codigo: "26418", descricao: "INSTITUTO FEDERAL DE PERNAMBUCO - IFPE" },
        { codigo: "26433", descricao: "INSTITUTO FEDERAL DO RIO DE JANEIRO" },
        { codigo: "26412", descricao: "INSTITUTO FEDERAL DO SUL DE MINAS GERAIS" },
        { codigo: "41000", descricao: "MINISTERIO DAS COMUNICACOES - MC" },
        { codigo: "35000", descricao: "MINISTERIO DAS RELACOES EXTERIORES - MRE" },
        { codigo: "20302", descricao: "NUCLEBRAS EQUIPAMENTOS PESADOS - NUCLEP" },
        { codigo: "25207", descricao: "SERVICO FED. DE PROCESSAMENTO DE DADOS - SERPRO" },
        { codigo: "53203", descricao: "SUPERINTENDENCIA DO DESENV. DO NORDESTE - SUDENE" },
        { codigo: "40603", descricao: "SUPERINTENDENCIA ZONA FRANCA DE MANAUS - SUFRAMA" },
        { codigo: "49300", descricao: "VALEC ENG.CONSTRUCOES E FERROVIAS S/A - VALEC" },
      ],
      codigosAtivos: ["1", "21"],       // ativo permanente e ativo perm. L.8878/94
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
