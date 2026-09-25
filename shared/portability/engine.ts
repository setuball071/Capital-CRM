// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE REGRAS — PORTABILIDADE MULTIBANCO
//
// Puro: não lê banco de dados nem tela. Recebe os dados do cliente, os
// contratos e as regras de cada banco, e devolve o resultado de cada regra com
// o valor analisado e o motivo. O servidor usa para registrar a análise
// (auditoria); a tela usa para recalcular ao vivo. Mesmo código nos dois.
//
// Duas camadas de regra por banco:
//   1. INFOGRÁFICO — o que o banco publica. Uma arte nova substitui a anterior.
//   2. EXCEÇÕES    — o que o operador sabe além da arte (ex.: o PAN porta Caixa
//                    com 0 pagas). Sobrevivem à troca de infográfico e sempre
//                    vencem a regra da arte.
//
// Invariante: faltar um dado NUNCA reprova. Vira PENDENTE_INFO dizendo qual é.
// ═══════════════════════════════════════════════════════════════════════════

import { precificarRefin, type OperacaoEntrada, type PrecoContrato, type ResumoRefin } from "./refin";
export type { OperacaoEntrada, PrecoContrato, ResumoRefin } from "./refin";

export const ENGINE_VERSION = "1.9.0";   // 1.8: UPAG · 1.9: origem que exige conferência

export type Status =
  | "ELEGIVEL"
  | "NAO_ELEGIVEL"
  | "PENDENTE_INFO"
  | "REGRA_NAO_CADASTRADA"
  | "ANALISE_MANUAL";

export const STATUS_LABEL: Record<Status, string> = {
  ELEGIVEL: "Elegível",
  NAO_ELEGIVEL: "Não elegível",
  PENDENTE_INFO: "Pendente de informação",
  REGRA_NAO_CADASTRADA: "Regra não cadastrada",
  ANALISE_MANUAL: "Análise manual",
};

// ── Entrada ────────────────────────────────────────────────────────────────

export interface ClienteEntrada {
  convenio: string;
  /** Unidade pagadora do servidor: código ("53205") ou nome. Vem do CRM. */
  upag?: string | null;
  /** Código SIAPE ("1", "84", "NES 94") ou a descrição ("ATIVO PERMANENTE"). */
  situacaoFuncional?: string | null;
  /** yyyy-mm-dd */
  dataNascimento?: string | null;
  pensao?: { tipo?: "vitalicia" | "temporaria" | null; dataFim?: string | null } | null;
  alertas?: { analfabeto?: boolean; naoAssina?: boolean; leiEstadualIdoso?: boolean } | null;
}

export interface ContratoEntrada {
  id: string;
  /** Nome como veio do extrato ou digitado. */
  bancoOrigem: string;
  /** Chave canônica escolhida pelo operador quando o nome é ambíguo (ex.: BRB). */
  origemConfirmada?: string | null;
  numeroContrato?: string | null;
  parcela?: number | null;
  prazoRestante?: number | null;
  prazoTotal?: number | null;
  /** % ao mês */
  taxa?: number | null;
  saldo?: number | null;
  /** O operador tirou do cálculo (sem excluir): segue analisado, mas não entra
   *  em troco, parcela, bruto nem comissão. */
  foraDoCalculo?: boolean | null;
}

export interface OrigemRegra {
  origem: string;
  porta: boolean;
  pagasMin?: number | null;
  /** Regra que depende de algo que o sistema não sabe (ex.: "só não porta se o
   *  contrato foi originado pela Facta"). Vai para conferência, não reprova. */
  conferir?: string | null;
}

/** Conteúdo de uma versão de regras (vem do infográfico). */
export interface RegrasBanco {
  taxaEntradaMin?: number | null;
  saldoMin?: number | null;
  saldoMax?: number | null;
  trocoMinPorContrato?: number | null;
  /** parcela mínima da operação nova (Daycoval 20, Paraná 200, Banrisul 8…) */
  parcelaMinima?: number | null;
  /** teto do contrato novo, já com o troco (Inter: 270 mil) */
  valorMaxContrato?: number | null;
  /** UPAGs/órgãos que o banco não atende. `apenasAtivos` = só barra servidor ativo. */
  upagsNaoAtendidas?: { codigo?: string | null; descricao: string; apenasAtivos?: boolean }[] | null;
  /** Códigos de situação que contam como "servidor ativo" para a regra acima. */
  codigosAtivos?: string[] | null;
  origens?: {
    padraoPagasMin?: number | null;
    /** pagas exigidas dos BANCOS DE REDE (ORIGENS.rede); vale entre a lista da arte e o padrão */
    redePagasMin?: number | null;
    lista: OrigemRegra[];
  } | null;
  situacaoFuncional?: { aceitos: { codigo: string; descricao: string }[] } | null;
  pensionistas?: {
    codigos: string[];
    /** false = o banco só faz pensão vitalícia (BRB). */
    temporariaAceita?: boolean;
    temporarioComFim?: { folgaMeses: number } | null;
    temporarioSemFim?: { idadeMin: number } | null;
  } | null;
  /** Idade do cliente na data da análise. Celetista costuma ter teto menor.
   *  `maxFimOperacao`: idade máxima na ÚLTIMA parcela (Safra: "terminar com 78"). */
  idade?: { min?: number | null; max?: number | null; maxCeletista?: number | null; maxFimOperacao?: number | null; codigosCeletista?: string[] } | null;
  /** Bancos que mudam taxa (e comissão) conforme o valor do contrato. A faixa é
   *  escolhida pelo valor financiado (saldo + troco). Quando existe, manda na taxaRefin. */
  faixasRefin?: FaixaRefin[] | null;
  /** Grupo do banco (ex.: "BRB"): não porta contrato de nenhuma empresa do mesmo grupo. */
  grupoBancario?: string | null;
  alertasFormalizacao?: string[];
  avisos?: string[];
  /** % a.m. do refin: a taxa que o banco aplica. O prazo quem escolhe é o operador. */
  taxaRefin?: number | null;
  /** Comissão que o banco paga à empresa. Hoje só base "saldo" (PAN: 0,75% do saldo devedor).
   *  Dado confidencial: o servidor tira da resposta para quem não é master. */
  comissao?: { percentual?: number | null; base?: "saldo" | null } | null;
}

export interface FaixaRefin {
  /** vale a partir deste valor de contrato */
  minValor: number;
  /** taxa que o sistema usa (já com a margem de segurança da casa, se houver) */
  taxa: number;
  /** taxa de tabela do banco, só para registro */
  taxaOficial?: number | null;
  /** % de comissão desta faixa (sobre o saldo devedor) */
  comissaoPercentual?: number | null;
  rotulo?: string | null;
}

export interface Excecao {
  id: number;
  tipo: "origem_pagas";
  parametros: OrigemRegra;
  motivo?: string | null;
}

export interface BancoParaAnalise {
  bankId: number;
  nome: string;
  /** null = não há regra vigente para este convênio. */
  ruleSet: { id: number; hash: string | null; vigenciaInicio: string; regras: RegrasBanco } | null;
  excecoes: Excecao[];
}

// ── Saída ──────────────────────────────────────────────────────────────────

export interface ResultadoRegra {
  chave: string;
  label: string;
  valorAnalisado: string | number | null;
  esperado: string | null;
  status: Status;
  motivo: string;
  fonte: "infografico" | "excecao" | "sistema";
  excecaoId?: number;
  /** Quando PENDENTE_INFO: o dado exato que falta. A tela pede só esse campo. */
  campo?: CampoPendente;
}

export type CampoPendente =
  | "situacaoFuncional" | "dataNascimento" | "pensaoTipo" | "pensaoFim" | "upag"   // do cliente
  | "origemConfirmada" | "prazoTotal" | "prazoRestante" | "taxa" | "saldo"; // do contrato

export interface CampoPendenteDetalhe {
  campo: CampoPendente;
  escopo: "cliente" | "contrato";
  contratoId?: string;
  motivo: string;
}

export interface ResultadoContrato {
  contratoId: string;
  bancoOrigem: string;
  origemCanonica: string | null;
  status: Status;
  regras: ResultadoRegra[];
  /** Bloco da operação (troco, comissão). Não decide elegibilidade. */
  operacao: ResultadoRegra[];
  /** Troco e parcela do refin (só contrato ELEGÍVEL, com taxa de refin e prazo informado). */
  preco?: PrecoContrato | null;
  /** true = o operador tirou este contrato do cálculo */
  foraDoCalculo?: boolean;
  /** true = o sistema não reconheceu o banco de origem (foi tratado como "demais bancos") */
  origemDesconhecida?: boolean;
}

export interface ResultadoBanco {
  bankId: number;
  banco: string;
  status: Status;
  resumo: string;
  ruleSetId: number | null;
  ruleSetHash: string | null;
  vigenciaInicio: string | null;
  excecoesAplicadas: number[];
  cliente: ResultadoRegra[];
  contratos: ResultadoContrato[];
  pendencias: string[];
  /** Mesmas pendências, estruturadas: qual campo, de quem. */
  camposPendentes: CampoPendenteDetalhe[];
  avisos: string[];
  contagem: Record<Status, number>;
  /** null = sem regra de comissão (ou oculta para quem não é master). */
  comissao: ResumoComissao | null;
  /** Totais do refin dos contratos aceitos e viáveis. null = não precificado. */
  refin: ResumoRefin | null;
}

export interface ResumoComissao {
  /** null = o banco usou mais de um percentual (faixas por valor) */
  percentual: number | null;
  base: "saldo";
  /** Soma só dos contratos ELEGÍVEIS: é o que o banco efetivamente paga. */
  total: number;
  contratos: number;
  /** Contratos em análise manual: estimativa à parte, não somada ao total. */
  estimadaEmAnalise: number;
}

export interface ResultadoAnalise {
  engineVersion: string;
  analisadoEm: string;
  bancos: ResultadoBanco[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  BANCO DE ORIGEM — normalização
//  O extrato traz o nome do jeito que a rubrica escreve ("CEF", "BCO BRAS",
//  "DAYBCO"). Regras e exceções são comparadas pela CHAVE canônica, nunca pelo
//  texto. Ordem importa: o mais específico vem antes (BRB Financeira antes de BRB).
// ═══════════════════════════════════════════════════════════════════════════

export const ORIGENS: { chave: string; nome: string; padroes: string[]; foraCip?: boolean; grupo?: string; rede?: boolean }[] = [
  // Padrões são PALAVRAS INTEIRAS — escreva a forma completa, nunca um prefixo.
  // ("BRB FINANC" não casa "BRB FINANCEIRA", e o nome cai no BRB Banco.)
  { chave: "BRB_FINANCEIRA", nome: "BRB Financeira", padroes: ["BRB FINANCEIRA", "BRB CFI", "BRB - CFI", "BRB CREDITO", "BRB CRED"], grupo: "BRB" },
  // BRB Red, BRB Consig360 e BRB Banco de Brasília são o mesmo grupo e não se portam entre si
  { chave: "BRB", nome: "BRB Banco", padroes: ["BRB", "BRB RED", "BRB CONSIG", "BRB CONSIG360", "BRB 360"], grupo: "BRB" },
  { chave: "CAIXA", nome: "Caixa", padroes: ["CAIXA", "CEF"], rede: true },
  { chave: "BB", nome: "Banco do Brasil", padroes: ["BANCO DO BRASIL", "BCO BRAS", "BCO DO BRASIL"], rede: true },
  { chave: "ITAU", nome: "Itaú", padroes: ["ITAU"], rede: true },
  { chave: "SAFRA", nome: "Safra", padroes: ["SAFRA", "SAFRA FINANCEIRA"], grupo: "SAFRA" },
  { chave: "FACTA", nome: "Facta", padroes: ["FACTA"] },
  { chave: "BANRISUL", nome: "Banrisul", padroes: ["BANRISUL"] },
  { chave: "C6", nome: "C6", padroes: ["C6"] },
  { chave: "AGIBANK", nome: "Agibank", padroes: ["AGIBANK", "AGI BANK", "AGIPLAN"] },
  { chave: "DAYCOVAL", nome: "Daycoval", padroes: ["DAYCOVAL", "DAYBCO"] },
  { chave: "INBURSA", nome: "Inbursa", padroes: ["INBURSA"] },
  { chave: "QI_TECH", nome: "QI Tech", padroes: ["QI TECH", "QI SCD", "QI SOCIEDADE"] },
  { chave: "ZEMA", nome: "Zema", padroes: ["ZEMA"] },
  { chave: "PINE", nome: "Pine", padroes: ["PINE"] },
  { chave: "BRADESCO", nome: "Bradesco", padroes: ["BRADESCO"], rede: true },
  { chave: "SANTANDER", nome: "Santander", padroes: ["SANTANDER"], rede: true },
  { chave: "PAN", nome: "Pan", padroes: ["BANCO PAN", "BCO PAN", "PAN"] },
  { chave: "BMG", nome: "BMG", padroes: ["BMG"] },
  { chave: "MERCANTIL", nome: "Mercantil", padroes: ["MERCANTIL"] },
  { chave: "INTER", nome: "Inter", padroes: ["INTERMEDIUM", "BANCO INTER", "INTER"], rede: true },
  { chave: "DIGIO", nome: "Digio", padroes: ["DIGIO"] },
  { chave: "SICOOB", nome: "Sicoob", padroes: ["SICOOB", "BANCOOB"], rede: true },
  { chave: "SICREDI", nome: "Sicredi", padroes: ["SICREDI"], rede: true },
  { chave: "NUBANK", nome: "Nubank", padroes: ["NUBANK", "NU FINANCEIRA", "NU PAGAMENTOS"], rede: true },
  { chave: "PICPAY", nome: "PicPay", padroes: ["PICPAY"] },
  { chave: "PARANA", nome: "Paraná Banco", padroes: ["PARANA"] },
  { chave: "OLE", nome: "Olé", padroes: ["OLE"] },
  { chave: "ALFA", nome: "Alfa", padroes: ["ALFA", "BANCO ALFA", "ALFA FINANCEIRA"], grupo: "SAFRA" },
  { chave: "NBC", nome: "NBC", padroes: ["NBC"] },
  { chave: "MASTER", nome: "Master", padroes: ["MASTER", "BANCO MASTER", "MAXIMA", "BANCO MAXIMA"] },
  { chave: "BARI", nome: "Bari", padroes: ["BARI", "BANCO BARI"] },
  { chave: "PAULISTA", nome: "Paulista", padroes: ["PAULISTA", "BANCO PAULISTA"] },
  { chave: "DIGIMAIS", nome: "Digimais", padroes: ["DIGIMAIS", "BANCO DIGIMAIS", "DIGI MAIS"] },
  { chave: "SOCICRED", nome: "Socicred", padroes: ["SOCICRED"] },
  // Entidades FORA DA CIP (previdências, associações): NENHUM banco porta — a
  // portabilidade passa pela CIP (Fábio, 22/09/2026). Só uma exceção cadastrada libera.
  { chave: "FUTURO", nome: "Futuro Previdência", padroes: ["FUTURO"], foraCip: true },
  { chave: "SABEMI", nome: "Sabemi", padroes: ["SABEMI"], foraCip: true },
  { chave: "J17", nome: "J17", padroes: ["J17", "J 17"], foraCip: true },
  { chave: "ATLANTA", nome: "Atlanta", padroes: ["ATLANTA"], foraCip: true },
  { chave: "HOJE", nome: "Hoje Previdência", padroes: ["HOJE"], foraCip: true },
  { chave: "CAPITAL_CONSIG", nome: "Capital Consig", padroes: ["CAPITAL CONSIG", "CAPITALCONSIG"], foraCip: true },
  { chave: "SENFF", nome: "Senff", padroes: ["SENFF"], foraCip: true },
  { chave: "LARCA", nome: "Larca", padroes: ["LARCA"], foraCip: true },
];
export const ehForaDaCip = (chave: string | null) => !!(chave && ORIGENS.find(o => o.chave === chave)?.foraCip);

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

/** Chave canônica do banco de origem, ou null se não reconhecido. */
export function normalizarOrigem(nome: string | null | undefined): string | null {
  if (!nome) return null;
  const t = " " + semAcento(nome) + " ";
  for (const o of ORIGENS) {
    for (const p of o.padroes) {
      // palavra inteira: "PAN" não pode casar dentro de "PANAMERICANO" nem de "EMPANAR"
      const re = new RegExp("(^|[^A-Z0-9])" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^A-Z0-9]|$)");
      if (re.test(t)) return o.chave;
    }
  }
  return null;
}

export const nomeOrigem = (chave: string | null) =>
  (chave && ORIGENS.find(o => o.chave === chave)?.nome) || chave || "desconhecido";

// ═══════════════════════════════════════════════════════════════════════════
//  REGRAS
// ═══════════════════════════════════════════════════════════════════════════

const r2 = (v: number) => Math.round(v * 100) / 100;
const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "% a.m.";
const temNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);

function regra(p: Omit<ResultadoRegra, "fonte"> & { fonte?: ResultadoRegra["fonte"] }): ResultadoRegra {
  return { fonte: "infografico", ...p };
}

/** Regra de origem que vale para esta chave: exceção > lista da arte > "demais bancos". */
function resolverOrigem(chave: string | null, regras: RegrasBanco, excecoes: Excecao[]) {
  if (chave) {
    const exc = excecoes.filter(e => e.tipo === "origem_pagas" && normalizarOrigem(e.parametros.origem) === chave);
    if (exc.length > 1) return { conflito: exc };
    if (exc.length === 1) return { regra: exc[0].parametros, fonte: "excecao" as const, excecao: exc[0] };
    const daArte = (regras.origens?.lista || []).find(o => normalizarOrigem(o.origem) === chave);
    if (daArte) return { regra: daArte, fonte: "infografico" as const };
    // banco de rede (BB, Caixa, Itaú, Bradesco, Santander, Nubank, Inter, Sicoob, Sicredi…)
    const rede = regras.origens?.redePagasMin;
    if (ORIGENS.find(o => o.chave === chave)?.rede && temNum(rede)) {
      return { regra: { origem: "bancos de rede", porta: true, pagasMin: rede }, fonte: "infografico" as const, rede: true };
    }
  }
  const padrao = regras.origens?.padraoPagasMin;
  if (temNum(padrao)) return { regra: { origem: "demais bancos", porta: true, pagasMin: padrao }, fonte: "infografico" as const, padrao: true };
  return { naoCadastrada: true };
}

function avaliarOrigem(c: ContratoEntrada, chave: string | null, regras: RegrasBanco, excecoes: Excecao[], banco: string): ResultadoRegra {
  const base = { chave: "origem_pagas", label: "Banco de origem e parcelas pagas" };
  const nomeO = chave ? nomeOrigem(chave) : (c.bancoOrigem || "desconhecido");

  // empresas do mesmo grupo não se portam (ex.: BRB Red, BRB Consig360 e BRB Banco de Brasília)
  if (chave && regras.grupoBancario && ORIGENS.find(o => o.chave === chave)?.grupo === regras.grupoBancario) {
    return regra({ ...base, valorAnalisado: nomeO, esperado: "banco de fora do grupo", status: "NAO_ELEGIVEL", fonte: "infografico",
      motivo: `${nomeO} é do mesmo grupo do ${banco} (${regras.grupoBancario}): o grupo não porta ele mesmo.` });
  }
  // contrato do próprio banco não é portabilidade — é refin (vale para todo banco)
  if (chave && chave === normalizarOrigem(banco)) {
    return regra({ ...base, valorAnalisado: nomeO, esperado: "outro banco", status: "NAO_ELEGIVEL", fonte: "sistema",
      motivo: `Contrato já é do ${banco}: isso é refin, não portabilidade.` });
  }

  // BRB Banco x BRB Financeira: o extrato escreve só "BRB" para os dois. Só
  // pergunta quando a diferença muda o resultado neste banco.
  if (chave === "BRB" && !c.origemConfirmada) {
    const comoBanco = resolverOrigem("BRB", regras, excecoes);
    const comoFin = resolverOrigem("BRB_FINANCEIRA", regras, excecoes);
    const chaveDe = (x: any) => JSON.stringify(x.regra ? [x.regra.porta, x.regra.pagasMin ?? null] : x);
    if (chaveDe(comoBanco) !== chaveDe(comoFin)) {
      return regra({ ...base, campo: "origemConfirmada", valorAnalisado: c.bancoOrigem, esperado: null, status: "PENDENTE_INFO", fonte: "sistema",
        motivo: `Confirme se o contrato é do BRB Banco ou da BRB Financeira — o ${banco} trata os dois de forma diferente.` });
    }
  }

  const r: any = resolverOrigem(chave, regras, excecoes);
  if (r.conflito) {
    return regra({ ...base, valorAnalisado: nomeO, esperado: null, status: "ANALISE_MANUAL", fonte: "excecao",
      motivo: `Há ${r.conflito.length} exceções ativas para ${nomeO} com regras diferentes. Desative as que não valem.` });
  }
  if (r.naoCadastrada) {
    return regra({ ...base, valorAnalisado: nomeO, esperado: null, status: "REGRA_NAO_CADASTRADA", fonte: "sistema",
      motivo: `${nomeO} não está nas regras do ${banco} e não há regra para "demais bancos".` });
  }
  // entidade fora da CIP: nenhum banco porta (uma exceção cadastrada ainda vence)
  if (ehForaDaCip(chave) && r.fonte !== "excecao") {
    return regra({ ...base, valorAnalisado: nomeO, esperado: "entidade na CIP", status: "NAO_ELEGIVEL", fonte: "sistema",
      motivo: `${nomeO} é entidade fora da CIP: não pode ser portada.` });
  }
  const fonte = r.fonte as ResultadoRegra["fonte"];
  const excecaoId = r.excecao?.id;
  const rotuloOrigem = r.padrao ? `${nomeO} (demais bancos)` : r.rede ? `${nomeO} (banco de rede)` : nomeO;

  if (r.regra.conferir) {
    return regra({ ...base, valorAnalisado: rotuloOrigem, esperado: null, status: "ANALISE_MANUAL", fonte, excecaoId,
      motivo: `${nomeO}: ${r.regra.conferir}` });
  }
  if (!r.regra.porta) {
    return regra({ ...base, valorAnalisado: rotuloOrigem, esperado: "banco aceito", status: "NAO_ELEGIVEL", fonte, excecaoId,
      motivo: `O ${banco} não porta contratos do ${nomeO}.` });
  }
  const min = temNum(r.regra.pagasMin) ? r.regra.pagasMin : 0;
  if (!temNum(c.prazoTotal) || !temNum(c.prazoRestante) || c.prazoTotal <= 0) {
    return regra({ ...base, campo: "prazoTotal", valorAnalisado: rotuloOrigem, esperado: `${min} pagas`, status: "PENDENTE_INFO", fonte, excecaoId,
      motivo: "Falta o prazo total do contrato para contar as parcelas pagas." });
  }
  const pagas = Math.max(0, c.prazoTotal - c.prazoRestante);
  const ok = pagas >= min;
  return regra({ ...base, valorAnalisado: `${rotuloOrigem} · ${pagas} pagas`, esperado: `mín. ${min} pagas`,
    status: ok ? "ELEGIVEL" : "NAO_ELEGIVEL", fonte, excecaoId,
    motivo: ok
      ? `${pagas} pagas; o ${banco} exige ${min} para ${rotuloOrigem}${fonte === "excecao" ? " (exceção)" : ""}.`
      : `Tem ${pagas} pagas; o ${banco} exige ${min} para ${rotuloOrigem}${fonte === "excecao" ? " (exceção)" : ""}.` });
}

function avaliarTaxa(c: ContratoEntrada, regras: RegrasBanco, banco: string): ResultadoRegra | null {
  if (!temNum(regras.taxaEntradaMin)) return null;
  const base = { chave: "taxa_entrada_min", label: "Taxa mínima do contrato", esperado: `≥ ${pct(regras.taxaEntradaMin)}` };
  if (!temNum(c.taxa) || c.taxa <= 0) {
    return regra({ ...base, campo: "taxa", valorAnalisado: null, status: "PENDENTE_INFO", motivo: "Falta a taxa do contrato (ou o saldo devedor, para deduzi-la)." });
  }
  // compara com 2 casas: a taxa costuma vir deduzida do saldo e sair 1,1999
  const t = r2(c.taxa);
  const ok = t >= regras.taxaEntradaMin;
  return regra({ ...base, valorAnalisado: pct(t), status: ok ? "ELEGIVEL" : "NAO_ELEGIVEL",
    motivo: ok ? `Taxa de ${pct(t)} atende o mínimo do ${banco}.` : `Taxa de ${pct(t)} abaixo do mínimo de ${pct(regras.taxaEntradaMin)} do ${banco}.` });
}

function avaliarSaldo(c: ContratoEntrada, regras: RegrasBanco, banco: string): ResultadoRegra[] {
  const out: ResultadoRegra[] = [];
  const temMin = temNum(regras.saldoMin), temMax = temNum(regras.saldoMax);
  if (!temMin && !temMax) return out;
  const esperado = [temMin ? `≥ ${brl(regras.saldoMin!)}` : "", temMax ? `≤ ${brl(regras.saldoMax!)}` : ""].filter(Boolean).join(" e ");
  const base = { chave: "saldo", label: "Saldo devedor", esperado };
  if (!temNum(c.saldo) || c.saldo <= 0) {
    out.push(regra({ ...base, campo: "saldo", valorAnalisado: null, status: "PENDENTE_INFO", motivo: "Falta o saldo devedor do contrato." }));
    return out;
  }
  const abaixo = temMin && c.saldo < regras.saldoMin!;
  const acima = temMax && c.saldo > regras.saldoMax!;
  out.push(regra({ ...base, valorAnalisado: brl(c.saldo), status: abaixo || acima ? "NAO_ELEGIVEL" : "ELEGIVEL",
    motivo: abaixo ? `Saldo abaixo do mínimo de ${brl(regras.saldoMin!)} do ${banco}.`
          : acima ? `Saldo acima do máximo de ${brl(regras.saldoMax!)} do ${banco}.`
          : `Saldo dentro do que o ${banco} aceita.` }));
  return out;
}

/** Código da situação funcional: casa por código exato ou descrição exata. Nunca adivinha. */
function resolverSituacao(valor: string, aceitos: { codigo: string; descricao: string }[]) {
  const v = semAcento(valor).replace(/\s*\*$/, "");
  const porCodigo = aceitos.find(a => semAcento(a.codigo) === v);
  if (porCodigo) return porCodigo;
  return aceitos.find(a => semAcento(a.descricao).replace(/\s*\*$/, "") === v) || null;
}

function idadeEm(nascimento: string, ref: Date): number | null {
  const d = new Date(nascimento + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  let idade = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) idade--;
  return idade;
}

/** Regras que dependem só do cliente (valem para todos os contratos). */
function avaliarCliente(cli: ClienteEntrada, regras: RegrasBanco, banco: string, hoje: Date, operacao?: OperacaoEntrada | null) {
  const out: ResultadoRegra[] = [];
  let codigoCliente: string | null = null;
  let ehPensionista = false;

  const aceitos = regras.situacaoFuncional?.aceitos;
  if (aceitos && aceitos.length) {
    const base = { chave: "situacao_funcional", label: "Situação funcional", esperado: `uma das ${aceitos.length} aceitas` };
    if (!cli.situacaoFuncional) {
      out.push(regra({ ...base, campo: "situacaoFuncional", valorAnalisado: null, status: "PENDENTE_INFO", motivo: "Falta a situação funcional do cliente." }));
    } else {
      const achou = resolverSituacao(cli.situacaoFuncional, aceitos);
      if (achou) {
        codigoCliente = achou.codigo;
        out.push(regra({ ...base, valorAnalisado: `${achou.codigo} — ${achou.descricao}`, status: "ELEGIVEL",
          motivo: `Situação ${achou.codigo} é aceita pelo ${banco}.` }));
      } else {
        // pode ser só que o CRM guarda "ATIVO" e a regra fala em "ATIVO PERMANENTE"
        out.push(regra({ ...base, campo: "situacaoFuncional", valorAnalisado: cli.situacaoFuncional, status: "PENDENTE_INFO",
          motivo: `"${cli.situacaoFuncional}" não bate com nenhum código da lista do ${banco}. Informe o código SIAPE da situação funcional.` }));
      }
    }
  }

  const upags = regras.upagsNaoAtendidas || [];
  if (upags.length) {
    const base = { chave: "upag", label: "UPAG (unidade pagadora)", esperado: `fora da lista de ${upags.length} não atendidas` };
    const informada = (cli.upag || "").trim();
    if (!informada) {
      out.push(regra({ ...base, campo: "upag", valorAnalisado: null, status: "PENDENTE_INFO",
        motivo: `O ${banco} não atende algumas UPAGs: informe a unidade pagadora do cliente.` }));
    } else {
      const digitos = informada.replace(/\D/g, "");
      const texto = semAcento(informada);
      const achada = upags.find(u => {
        if (u.codigo && digitos && semAcento(u.codigo).replace(/\D/g, "") === digitos) return true;
        const d = semAcento(u.descricao);
        return d.length >= 6 && texto.length >= 6 && (d.includes(texto) || texto.includes(d));
      });
      if (!achada) {
        out.push(regra({ ...base, valorAnalisado: informada, status: "ELEGIVEL", motivo: `UPAG atendida pelo ${banco}.` }));
      } else if (achada.apenasAtivos) {
        // só barra servidor ativo: sem a situação funcional, não dá para decidir
        const ativos = (regras.codigosAtivos || []).map(semAcento);
        const codigo = semAcento(codigoCliente || cli.situacaoFuncional || "");
        if (!codigo) {
          out.push(regra({ ...base, campo: "situacaoFuncional", valorAnalisado: informada, status: "PENDENTE_INFO",
            motivo: `${achada.descricao} só não é atendida para servidor ativo: informe a situação funcional.` }));
        } else if (ativos.includes(codigo)) {
          out.push(regra({ ...base, valorAnalisado: informada, status: "NAO_ELEGIVEL",
            motivo: `${achada.descricao}: o ${banco} não atende servidor ativo desta UPAG.` }));
        } else {
          out.push(regra({ ...base, valorAnalisado: informada, status: "ELEGIVEL",
            motivo: `${achada.descricao} só é barrada para servidor ativo; este cliente não é.` }));
        }
      } else {
        out.push(regra({ ...base, valorAnalisado: informada, status: "NAO_ELEGIVEL",
          motivo: `${achada.descricao}: UPAG não atendida pelo ${banco}.` }));
      }
    }
  }

  const id = regras.idade;
  if (id && (temNum(id.min) || temNum(id.max) || temNum(id.maxCeletista))) {
    // sem lista de situações cadastrada, o código vem direto do que o operador informou
    const codigoSit = codigoCliente || (cli.situacaoFuncional || "").trim();
    const celetista = !!(codigoSit && (id.codigosCeletista || []).map(semAcento).includes(semAcento(codigoSit)));
    const max = celetista && temNum(id.maxCeletista) ? id.maxCeletista : id.max;
    const partes = [temNum(id.min) ? `a partir de ${id.min}` : null, temNum(max) ? `até ${max} anos` : null].filter(Boolean);
    const base = { chave: "idade", label: "Idade do cliente", esperado: partes.join(", ") + (celetista ? " (celetista)" : "") };
    const anos = cli.dataNascimento ? idadeEm(cli.dataNascimento, hoje) : null;
    if (anos === null) {
      out.push(regra({ ...base, campo: "dataNascimento", valorAnalisado: null, status: "PENDENTE_INFO",
        motivo: `Falta a data de nascimento: o ${banco} tem limite de idade.` }));
    } else {
      const cedo = temNum(id.min) && anos < id.min!;
      const tarde = temNum(max) && anos > max!;
      out.push(regra({ ...base, valorAnalisado: `${anos} anos`, status: cedo || tarde ? "NAO_ELEGIVEL" : "ELEGIVEL",
        motivo: cedo ? `Cliente tem ${anos} anos; o ${banco} atende a partir de ${id.min}.`
              : tarde ? `Cliente tem ${anos} anos; o ${banco} atende até ${max}${celetista ? " (celetista)" : ""}.`
              : `${anos} anos: dentro do limite do ${banco}.` }));
    }
  }

  if (id && temNum(id.maxFimOperacao)) {
    const base = { chave: "idade_fim", label: "Idade no fim da operação", esperado: `terminar com até ${id.maxFimOperacao} anos` };
    if (!cli.dataNascimento) {
      out.push(regra({ ...base, campo: "dataNascimento", valorAnalisado: null, status: "PENDENTE_INFO",
        motivo: `Falta a data de nascimento: o ${banco} exige terminar a operação com até ${id.maxFimOperacao} anos.` }));
    } else if (!operacao) {
      out.push(regra({ ...base, valorAnalisado: null, status: "REGRA_NAO_CADASTRADA", fonte: "sistema",
        motivo: `Depende do prazo do refin: informe o prazo para conferir a idade no fim da operação.` }));
    } else {
      const fim = new Date(hoje.getTime());
      fim.setMonth(fim.getMonth() + operacao.prazo);
      const idadeFim = idadeEm(cli.dataNascimento, fim);
      const hojeIdade = idadeEm(cli.dataNascimento, hoje);
      const ok = idadeFim !== null && idadeFim <= id.maxFimOperacao!;
      // prazo máximo = meses que faltam para ele passar do limite
      let prazoMax: number | null = null;
      if (!ok && hojeIdade !== null) {
        const virada = new Date(cli.dataNascimento + "T00:00:00");
        virada.setFullYear(virada.getFullYear() + id.maxFimOperacao! + 1);
        prazoMax = Math.max(0, (virada.getFullYear() - hoje.getFullYear()) * 12 + (virada.getMonth() - hoje.getMonth()) - (virada.getDate() < hoje.getDate() ? 1 : 0));
      }
      out.push(regra({ ...base, valorAnalisado: idadeFim === null ? cli.dataNascimento : `${idadeFim} anos em ${operacao.prazo} meses`,
        status: idadeFim === null ? "PENDENTE_INFO" : ok ? "ELEGIVEL" : "NAO_ELEGIVEL",
        motivo: idadeFim === null ? "Data de nascimento inválida."
          : ok ? `Termina com ${idadeFim} anos: dentro do limite do ${banco}.`
               : `Em ${operacao.prazo} meses o cliente termina com ${idadeFim} anos; o ${banco} aceita até ${id.maxFimOperacao}. Prazo máximo: ${prazoMax} meses.` }));
    }
  }

  const pens = regras.pensionistas;
  if (pens && codigoCliente && pens.codigos.map(semAcento).includes(semAcento(codigoCliente))) {
    ehPensionista = true;
    const base = { chave: "pensao", label: "Tipo de pensão" };
    const tipo = cli.pensao?.tipo;
    if (!tipo) {
      out.push(regra({ ...base, campo: "pensaoTipo", valorAnalisado: null, esperado: "vitalícia ou temporária", status: "PENDENTE_INFO",
        motivo: "Cliente é pensionista: informe se a pensão é vitalícia ou temporária." }));
    } else if (tipo === "vitalicia") {
      out.push(regra({ ...base, valorAnalisado: "vitalícia", esperado: null, status: "ELEGIVEL", motivo: "Pensão vitalícia é aceita." }));
    } else if (pens.temporariaAceita === false) {
      out.push(regra({ ...base, valorAnalisado: "temporária", esperado: "vitalícia", status: "NAO_ELEGIVEL",
        motivo: `O ${banco} só atende pensão vitalícia.` }));
    } else if (!cli.pensao?.dataFim) {
      const min = pens.temporarioSemFim?.idadeMin;
      if (!temNum(min)) {
        out.push(regra({ ...base, valorAnalisado: "temporária sem data de término", esperado: null, status: "REGRA_NAO_CADASTRADA", fonte: "sistema",
          motivo: `Sem regra do ${banco} para pensão temporária sem data de término.` }));
      } else if (!cli.dataNascimento) {
        out.push(regra({ ...base, campo: "dataNascimento", valorAnalisado: "temporária sem data de término", esperado: `${min} anos completos`, status: "PENDENTE_INFO",
          motivo: `Pensão temporária sem data de término exige ${min} anos: falta a data de nascimento.` }));
      } else {
        const idade = idadeEm(cli.dataNascimento, hoje);
        const ok = idade !== null && idade >= min;
        out.push(regra({ ...base, campo: idade === null ? "dataNascimento" : undefined, valorAnalisado: idade === null ? cli.dataNascimento : `${idade} anos`, esperado: `≥ ${min} anos`,
          status: idade === null ? "PENDENTE_INFO" : ok ? "ELEGIVEL" : "NAO_ELEGIVEL",
          motivo: idade === null ? "Data de nascimento inválida."
            : ok ? `Pensão temporária sem término: ${idade} anos atende o mínimo de ${min}.`
                 : `Pensão temporária sem término exige ${min} anos completos; cliente tem ${idade}.` }));
      }
    }
    // temporária COM data de término é avaliada por contrato (depende do prazo)
  }

  const al = cli.alertas || {};
  const marcados = [al.analfabeto && "analfabeto", al.naoAssina && "impossibilitado de assinar", al.leiEstadualIdoso && "lei estadual de idoso"].filter(Boolean) as string[];
  // Só vale para banco que TEM regra de formalização cadastrada: sem ela, marcar
  // "analfabeto" não pode mandar o banco para análise manual por conta própria.
  if (marcados.length && (regras.alertasFormalizacao || []).length) {
    out.push(regra({ chave: "formalizacao", label: "Formalização", valorAnalisado: marcados.join(", "), esperado: null,
      status: "ANALISE_MANUAL", motivo: `Cliente ${marcados.join(", ")}: seguir o Manual de Formalização do ${banco}. Não reprova, mas exige conferência.` }));
  }

  return { regras: out, ehPensionista };
}

/** Pensão temporária com data de término: o contrato tem que acabar N meses antes. */
function avaliarPensaoContrato(c: ContratoEntrada, cli: ClienteEntrada, regras: RegrasBanco, banco: string, hoje: Date): ResultadoRegra | null {
  const folga = regras.pensionistas?.temporarioComFim?.folgaMeses;
  if (cli.pensao?.tipo !== "temporaria" || !cli.pensao?.dataFim || !temNum(folga)) return null;
  const base = { chave: "pensao_fim", label: "Término do contrato x término da pensão" };
  const fimPensao = new Date(cli.pensao.dataFim + "T00:00:00");
  if (isNaN(fimPensao.getTime())) {
    return regra({ ...base, campo: "pensaoFim", valorAnalisado: cli.pensao.dataFim, esperado: null, status: "PENDENTE_INFO", motivo: "Data de término da pensão inválida." });
  }
  if (!temNum(c.prazoRestante)) {
    return regra({ ...base, campo: "prazoRestante", valorAnalisado: null, esperado: null, status: "PENDENTE_INFO", motivo: "Falta o prazo restante do contrato." });
  }
  const limite = new Date(fimPensao); limite.setMonth(limite.getMonth() - folga);
  const fimContrato = new Date(hoje.getFullYear(), hoje.getMonth() + c.prazoRestante, 1);
  const ok = fimContrato <= limite;
  const f = (d: Date) => String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  return regra({ ...base, valorAnalisado: `contrato até ${f(fimContrato)}`, esperado: `até ${f(limite)}`,
    status: ok ? "ELEGIVEL" : "NAO_ELEGIVEL",
    motivo: (ok
      ? `Contrato termina ${folga} meses antes do fim da pensão, como o ${banco} exige.`
      : `Contrato terminaria em ${f(fimContrato)}, depois do limite de ${f(limite)} (${folga} meses antes do fim da pensão).`)
      + " Considera o prazo atual — se o refin alongar o prazo, reavalie." });
}

const pctSimples = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

/** Faixa de taxa que vale para um valor de contrato (a maior que couber). */
export function faixaPara(valor: number, faixas?: FaixaRefin[] | null): FaixaRefin | null {
  if (!faixas || !faixas.length) return null;
  const ordenadas = [...faixas].sort((a, b) => a.minValor - b.minValor);
  let achada: FaixaRefin | null = null;
  for (const f of ordenadas) if (valor >= f.minValor - 0.01) achada = f;
  return achada;
}

/** Percentual de comissão sobre o saldo, se a regra existir e for suportada. */
function percentualComissao(regras: RegrasBanco): number | null {
  const c = regras.comissao;
  if (!c || !temNum(c.percentual) || c.percentual <= 0) return null;
  if (c.base && c.base !== "saldo") return null;   // só "saldo" por enquanto
  return c.percentual;
}

/** Bloco da operação: troco e comissão. Informa, não decide elegibilidade. */
function avaliarOperacao(c: ContratoEntrada, statusContrato: Status, regras: RegrasBanco, banco: string): ResultadoRegra[] {
  const out: ResultadoRegra[] = [];
  const p = percentualComissao(regras);
  const base = { chave: "comissao", label: "Comissão" };
  if (p === null && (regras.faixasRefin || []).some(f => temNum(f.comissaoPercentual))) {
    // a faixa (e com ela a comissão) só se sabe depois de calcular o contrato
    out.push(regra({ ...base, valorAnalisado: null, esperado: "conforme a faixa de valor", status: "REGRA_NAO_CADASTRADA", fonte: "sistema",
      motivo: `A comissão do ${banco} depende da faixa de valor: informe o prazo do refin para calcular.` }));
    return out;
  }
  if (p === null) {
    out.push(regra({ ...base, valorAnalisado: null, esperado: null, status: "REGRA_NAO_CADASTRADA", fonte: "sistema",
      motivo: `Regra de comissão do ${banco} não cadastrada.` }));
    return out;
  }
  const esperado = `${pctSimples(p)} do saldo devedor`;
  if (statusContrato === "NAO_ELEGIVEL") {
    out.push(regra({ ...base, valorAnalisado: null, esperado, status: "NAO_ELEGIVEL",
      motivo: `Sem comissão: o ${banco} não aceita este contrato.` }));
  } else if (!temNum(c.saldo) || c.saldo <= 0) {
    out.push(regra({ ...base, valorAnalisado: null, esperado, status: "PENDENTE_INFO",
      motivo: "A comissão depende do saldo devedor do contrato." }));
  } else {
    const valor = r2(c.saldo * p / 100);
    const sufixo: Partial<Record<Status, string>> = {
      ELEGIVEL: `${pctSimples(p)} sobre o saldo devedor de ${brl(c.saldo)}.`,
      ANALISE_MANUAL: "Estimada — o contrato depende de análise manual.",
      PENDENTE_INFO: "Estimada — o contrato ainda tem informação pendente.",
      REGRA_NAO_CADASTRADA: "Estimada — parte da análise não tem regra cadastrada.",
    };
    out.push(regra({ ...base, valorAnalisado: brl(valor), esperado, status: statusContrato,
      motivo: sufixo[statusContrato] || "" }));
  }
  return out;
}

/** Linha "Troco" do bloco operação de um contrato aceito. Informa, não decide elegibilidade. */
function linhaTroco(preco: PrecoContrato | null | undefined, regras: RegrasBanco, banco: string, op: OperacaoEntrada | null | undefined): ResultadoRegra {
  const min = temNum(regras.trocoMinPorContrato) ? regras.trocoMinPorContrato : 0;
  const base = { chave: "troco", label: "Troco", esperado: min ? `≥ ${brl(min)}` : null, fonte: "sistema" as const };
  const temFaixa = (regras.faixasRefin || []).some(f => temNum(f.taxa));
  if (!temFaixa && (!temNum(regras.taxaRefin) || regras.taxaRefin <= 0)) {
    return regra({ ...base, valorAnalisado: null, status: "REGRA_NAO_CADASTRADA",
      motivo: `Troco não calculável: a taxa de refin do ${banco} não está cadastrada.` });
  }
  if (!op) {
    return regra({ ...base, valorAnalisado: null, status: "REGRA_NAO_CADASTRADA",
      motivo: temFaixa
        ? `Troco não calculado: o ${banco} tem taxa por faixa de valor; informe o prazo do refin.`
        : `Troco não calculado: taxa de refin de ${pct(regras.taxaRefin || 0)} cadastrada; informe o prazo do refin.` });
  }
  if (!preco) {
    return regra({ ...base, valorAnalisado: null, status: "PENDENTE_INFO",
      motivo: "Falta a parcela atual ou o saldo devedor para calcular o troco." });
  }
  return regra({ ...base, valorAnalisado: brl(preco.trocoLiquido), status: preco.viavel ? "ELEGIVEL" : "NAO_ELEGIVEL",
    motivo: preco.viavel
      ? `Parcela ${brl(preco.parcelaAtual)} → ${brl(preco.parcelaNova)} em ${op.prazo} meses a ${pct(preco.taxa)}.`
      : preco.motivo });
}

/** Linha "Comissão" de um contrato, com um percentual já conhecido. */
function linhaComissao(saldo: number | null | undefined, statusContrato: Status, p: number, banco: string, sufixoFaixa = ""): ResultadoRegra {
  const base = { chave: "comissao", label: "Comissão" };
  const esperado = `${pctSimples(p)} do saldo devedor${sufixoFaixa}`;
  if (statusContrato === "NAO_ELEGIVEL") {
    return regra({ ...base, valorAnalisado: null, esperado, status: "NAO_ELEGIVEL", motivo: `Sem comissão: o ${banco} não aceita este contrato.` });
  }
  if (!temNum(saldo) || saldo <= 0) {
    return regra({ ...base, valorAnalisado: null, esperado, status: "PENDENTE_INFO", motivo: "A comissão depende do saldo devedor do contrato." });
  }
  const sufixo: Partial<Record<Status, string>> = {
    ELEGIVEL: `${pctSimples(p)} sobre o saldo devedor de ${brl(saldo)}${sufixoFaixa}.`,
    ANALISE_MANUAL: "Estimada — o contrato depende de análise manual.",
    PENDENTE_INFO: "Estimada — o contrato ainda tem informação pendente.",
    REGRA_NAO_CADASTRADA: "Estimada — parte da análise não tem regra cadastrada.",
  };
  return regra({ ...base, valorAnalisado: brl(r2(saldo * p / 100)), esperado, status: statusContrato, motivo: sufixo[statusContrato] || "" });
}

/** Pior status vence: reprovação > falta dado > regra ausente > manual > ok. */
const PESO: Record<Status, number> = { NAO_ELEGIVEL: 5, PENDENTE_INFO: 4, REGRA_NAO_CADASTRADA: 3, ANALISE_MANUAL: 2, ELEGIVEL: 1 };
function pior(lista: Status[]): Status {
  return lista.reduce<Status>((a, b) => (PESO[b] > PESO[a] ? b : a), "ELEGIVEL");
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXECUÇÃO
// ═══════════════════════════════════════════════════════════════════════════

export function analisarBanco(banco: BancoParaAnalise, cliente: ClienteEntrada, contratos: ContratoEntrada[], hoje = new Date(),
  operacao: OperacaoEntrada | null = null): ResultadoBanco {
  const contagem = { ELEGIVEL: 0, NAO_ELEGIVEL: 0, PENDENTE_INFO: 0, REGRA_NAO_CADASTRADA: 0, ANALISE_MANUAL: 0 } as Record<Status, number>;
  const vazio: ResultadoBanco = {
    bankId: banco.bankId, banco: banco.nome, status: "REGRA_NAO_CADASTRADA",
    resumo: `Sem regras vigentes do ${banco.nome} para o convênio ${cliente.convenio}.`,
    ruleSetId: null, ruleSetHash: null, vigenciaInicio: null, excecoesAplicadas: [],
    cliente: [], contratos: [], pendencias: [], camposPendentes: [], avisos: [], contagem, comissao: null, refin: null,
  };
  if (!banco.ruleSet) return vazio;

  const regras = banco.ruleSet.regras;
  const cli = avaliarCliente(cliente, regras, banco.nome, hoje, operacao);
  const excecoesAplicadas = new Set<number>();

  const resultadoContratos: ResultadoContrato[] = contratos.map(c => {
    const chave = c.origemConfirmada || normalizarOrigem(c.bancoOrigem);
    const lista: ResultadoRegra[] = [];
    lista.push(avaliarOrigem(c, chave, regras, banco.excecoes, banco.nome));
    const t = avaliarTaxa(c, regras, banco.nome); if (t) lista.push(t);
    lista.push(...avaliarSaldo(c, regras, banco.nome));
    const p = avaliarPensaoContrato(c, cliente, regras, banco.nome, hoje); if (p) lista.push(p);
    lista.forEach(r => { if (r.excecaoId) excecoesAplicadas.add(r.excecaoId); });

    const status = pior([...lista, ...cli.regras].map(r => r.status));
    contagem[status]++;
    return { contratoId: c.id, bancoOrigem: c.bancoOrigem, origemCanonica: chave, status, regras: lista,
      operacao: avaliarOperacao(c, status, regras, banco.nome), ...(c.foraDoCalculo ? { foraDoCalculo: true } : {}),
      ...(chave ? {} : { origemDesconhecida: true }) };
  });

  // troco e parcela: só dos contratos que o banco aceitou, na taxa DELE e no prazo escolhido
  let refin: ResumoRefin | null = null;
  const aceitos = resultadoContratos.map((rc, i) => ({ rc, c: contratos[i] })).filter(x => x.rc.status === "ELEGIVEL" && !x.c.foraDoCalculo);
  const faixas = (regras.faixasRefin || []).filter(f => temNum(f.minValor) && temNum(f.taxa));
  const temTaxa = faixas.length > 0 || (temNum(regras.taxaRefin) && regras.taxaRefin > 0);
  if (temTaxa && operacao && aceitos.length) {
    const precificaveis = aceitos.filter(x => temNum(x.c.saldo) && x.c.saldo > 0 && temNum(x.c.parcela) && x.c.parcela > 0);
    if (precificaveis.length) {
      const trocoMin = temNum(regras.trocoMinPorContrato) ? regras.trocoMinPorContrato : 0;
      const taxaParam = faixas.length
        ? (valor: number) => faixaPara(valor, faixas)?.taxa ?? null
        : regras.taxaRefin!;
      const p = precificarRefin(precificaveis.map(x => ({ id: x.c.id, saldo: x.c.saldo!, parcela: x.c.parcela! })),
        taxaParam, trocoMin, operacao, temNum(regras.parcelaMinima) ? regras.parcelaMinima : 0,
        temNum(regras.valorMaxContrato) ? regras.valorMaxContrato : 0);
      refin = p.resumo;
      const porId = new Map(p.linhas.map(l => [l.contratoId, l]));
      aceitos.forEach(x => { x.rc.preco = porId.get(x.c.id) || null; });
    }
  }
  aceitos.forEach(x => x.rc.operacao.unshift(linhaTroco(x.rc.preco, regras, banco.nome, operacao)));

  // status do banco: se ao menos um contrato passa, o banco atende
  let status: Status;
  if (!contratos.length) status = pior(cli.regras.map(r => r.status).concat(["PENDENTE_INFO"]));
  else if (contagem.ELEGIVEL) status = "ELEGIVEL";
  else if (contagem.ANALISE_MANUAL) status = "ANALISE_MANUAL";
  else if (contagem.PENDENTE_INFO) status = "PENDENTE_INFO";
  else if (contagem.REGRA_NAO_CADASTRADA) status = "REGRA_NAO_CADASTRADA";
  else status = "NAO_ELEGIVEL";

  const camposPendentes: CampoPendenteDetalhe[] = [];
  const vistos = new Set<string>();
  const anota = (r: ResultadoRegra, escopo: "cliente" | "contrato", contratoId?: string) => {
    if (r.status !== "PENDENTE_INFO" || !r.campo) return;
    const k = escopo + ":" + r.campo + ":" + (contratoId || "");
    if (vistos.has(k)) return;
    vistos.add(k);
    camposPendentes.push({ campo: r.campo, escopo, contratoId, motivo: r.motivo });
  };
  // Só pede o dado que ainda muda o resultado: contrato já recusado por outra
  // regra não precisa de saldo/taxa; e dado do cliente só importa se sobrou
  // algum contrato pendente.
  const aindaPendentes = resultadoContratos.filter(c => c.status === "PENDENTE_INFO");
  if (aindaPendentes.length) cli.regras.forEach(r => anota(r, "cliente"));
  aindaPendentes.forEach(c => c.regras.forEach(r => anota(r, "contrato", c.contratoId)));

  // mesmo critério dos camposPendentes: só o que ainda muda o resultado
  const pendencias = Array.from(new Set(
    [...(aindaPendentes.length ? cli.regras : []), ...aindaPendentes.flatMap(c => c.regras)]
      .filter(r => r.status === "PENDENTE_INFO").map(r => r.motivo)
  ));

  const total = contratos.length;
  const resumo = !total ? "Nenhum contrato informado."
    : status === "ELEGIVEL" ? `${contagem.ELEGIVEL} de ${total} contrato(s) elegível(is).`
    : status === "NAO_ELEGIVEL" ? "Nenhum contrato atende as regras."
    : status === "PENDENTE_INFO" ? `Faltam informações para concluir (${pendencias.length}).`
    : status === "ANALISE_MANUAL" ? "Precisa de conferência manual."
    : "Regra não cadastrada para parte da análise.";

  // comissão do banco = só contratos ELEGÍVEIS (é o que ele paga); análise manual fica à parte
  const pc = percentualComissao(regras);
  const comissaoPorFaixa = faixas.some(f => temNum(f.comissaoPercentual));
  let comissao: ResumoComissao | null = null;
  if (pc !== null || comissaoPorFaixa) {
    let total = 0, n = 0, manual = 0;
    const usados = new Set<number>();
    resultadoContratos.forEach((rc, i) => {
      const saldo = contratos[i].saldo;
      if (!temNum(saldo) || saldo <= 0 || contratos[i].foraDoCalculo) return;
      // com faixas, o percentual sai da faixa do valor do contrato calculado
      const daFaixa = comissaoPorFaixa && rc.preco ? faixaPara(rc.preco.valorContrato, faixas)?.comissaoPercentual : null;
      const p = temNum(daFaixa) ? daFaixa : pc;
      if (p === null || p === undefined) return;
      usados.add(p);
      // a linha da comissão do contrato é refeita com o percentual certo
      if (temNum(daFaixa)) {
        const faixa = faixaPara(rc.preco!.valorContrato, faixas);
        const sufixo = faixa ? ` (faixa ${faixa.rotulo || "a partir de " + brl(faixa.minValor)})` : "";
        const nova = linhaComissao(saldo, rc.status, p, banco.nome, sufixo);
        const idx = rc.operacao.findIndex(o => o.chave === "comissao");
        if (idx >= 0) rc.operacao[idx] = nova; else rc.operacao.push(nova);
      }
      if (rc.status === "ELEGIVEL") { total += saldo * p / 100; n++; }
      else if (rc.status === "ANALISE_MANUAL") manual += saldo * p / 100;
    });
    comissao = { percentual: usados.size === 1 ? Array.from(usados)[0] : pc, base: "saldo", total: r2(total), contratos: n, estimadaEmAnalise: r2(manual) };
  }

  return {
    comissao, refin,
    bankId: banco.bankId, banco: banco.nome, status, resumo,
    ruleSetId: banco.ruleSet.id, ruleSetHash: banco.ruleSet.hash, vigenciaInicio: banco.ruleSet.vigenciaInicio,
    excecoesAplicadas: Array.from(excecoesAplicadas),
    cliente: cli.regras, contratos: resultadoContratos, pendencias, camposPendentes,
    avisos: regras.avisos || [], contagem,
  };
}

/** Resposta da análise ao vivo do simulador: resultado + o que a tela precisa
 *  para pedir dados (códigos de situação funcional e alertas de formalização
 *  que as regras ATIVAS conhecem). Puro — a rota e os testes usam o mesmo. */
export function respostaSimulacao(bancos: BancoParaAnalise[], cliente: ClienteEntrada, contratos: ContratoEntrada[], hoje = new Date(),
  operacao: OperacaoEntrada | null = null) {
  const codigos = new Map<string, string>();
  bancos.forEach(b => (b.ruleSet?.regras.situacaoFuncional?.aceitos || [])
    .forEach(a => { if (!codigos.has(a.codigo)) codigos.set(a.codigo, a.descricao); }));
  return {
    resultado: analisar(bancos, cliente, contratos, hoje, operacao),
    codigosSituacao: Array.from(codigos, ([codigo, descricao]) => ({ codigo, descricao })),
    alertasFormalizacao: bancos
      .filter(b => (b.ruleSet?.regras.alertasFormalizacao || []).length)
      .map(b => ({ banco: b.nome, itens: b.ruleSet!.regras.alertasFormalizacao! })),
  };
}

/** Remove tudo que revela a comissão da empresa. Corretor NUNCA vê a
 *  remuneração do banco — regra da casa. O servidor aplica antes de responder. */
export function semComissao(r: ResultadoAnalise): ResultadoAnalise {
  return {
    ...r,
    bancos: r.bancos.map(b => ({
      ...b,
      comissao: null,
      contratos: b.contratos.map(c => ({ ...c, operacao: c.operacao.filter(o => o.chave !== "comissao") })),
    })),
  };
}

export function analisar(bancos: BancoParaAnalise[], cliente: ClienteEntrada, contratos: ContratoEntrada[], hoje = new Date(),
  operacao: OperacaoEntrada | null = null): ResultadoAnalise {
  return {
    engineVersion: ENGINE_VERSION,
    analisadoEm: hoje.toISOString(),
    bancos: bancos.map(b => analisarBanco(b, cliente, contratos, hoje, operacao)),
  };
}
