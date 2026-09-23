// Testes do motor de regras de portabilidade (PAN SIAPE como modelo).
// Rodar:  npx tsx scripts/testar-motor-portabilidade.ts
// Sai com código 1 se qualquer caso falhar.
import assert from "node:assert/strict";
import {
  analisar, analisarBanco, normalizarOrigem, semComissao,
  type BancoParaAnalise, type ClienteEntrada, type ContratoEntrada, type Excecao, type Status,
} from "../shared/portability/engine";
import { MODELOS } from "../shared/portability/modelos";

const HOJE = new Date(2026, 8, 18); // 18/09/2026 — datas fixas para o teste não envelhecer
const PAN = MODELOS.find(m => m.id === "pan-siape-2026-09")!;
const EXC: Excecao[] = PAN.excecoesSugeridas!.map((e, i) => ({ id: 100 + i, tipo: "origem_pagas", parametros: e.parametros, motivo: e.motivo }));

const banco = (excecoes = EXC, regras = PAN.regras): BancoParaAnalise =>
  ({ bankId: 1, nome: "PAN", ruleSet: { id: 1, hash: "h", vigenciaInicio: "2026-09-18", regras }, excecoes });

const CLI: ClienteEntrada = { convenio: "SIAPE", situacaoFuncional: "1" };
let seq = 0;
const ct = (p: Partial<ContratoEntrada>): ContratoEntrada =>
  ({ id: "c" + (++seq), bancoOrigem: "Bradesco", prazoTotal: 96, prazoRestante: 60, taxa: 1.5, saldo: 20000, ...p });

let ok = 0, falhas = 0;
function caso(nome: string, fn: () => void) {
  try { fn(); ok++; console.log("  ok   " + nome); }
  catch (e: any) { falhas++; console.log("  FALHA " + nome + "\n        " + e.message.split("\n")[0]); }
}
/** status do 1o contrato e, opcionalmente, trecho do motivo da regra que decidiu */
function status(cli: ClienteEntrada, c: ContratoEntrada, esperado: Status, trecho?: string, b = banco()) {
  const r = analisarBanco(b, cli, [c], HOJE).contratos[0];
  assert.equal(r.status, esperado, `status ${r.status}, esperava ${esperado}\n${JSON.stringify(r.regras.map(x => [x.chave, x.status, x.motivo]))}`);
  if (trecho) {
    const todos = [...r.regras, ...analisarBanco(b, cli, [c], HOJE).cliente].map(x => x.motivo).join(" | ");
    assert.ok(todos.includes(trecho), `motivo sem "${trecho}": ${todos}`);
  }
}

console.log("\nNormalização do banco de origem");
caso("CEF -> Caixa", () => assert.equal(normalizarOrigem("EMPREST BCO OFICIAL - CEF"), "CAIXA"));
caso("DAYBCO -> Daycoval", () => assert.equal(normalizarOrigem("DAYBCO"), "DAYCOVAL"));
caso("BRB CFI -> BRB Financeira", () => assert.equal(normalizarOrigem("EMPREST BRB CFI"), "BRB_FINANCEIRA"));
caso("BRB sozinho -> BRB (ambíguo)", () => assert.equal(normalizarOrigem("BRB"), "BRB"));
// regressao: a excecao "BRB Financeira" caia no BRB Banco e liberava o banco errado
caso("\"BRB Financeira\" por extenso -> BRB Financeira", () => assert.equal(normalizarOrigem("BRB Financeira"), "BRB_FINANCEIRA"));
caso("\"Nubank Financeira\" -> Nubank", () => assert.equal(normalizarOrigem("NU FINANCEIRA"), "NUBANK"));
// toda excecao/linha do modelo PAN precisa resolver para um banco conhecido
caso("Todos os nomes do modelo PAN são reconhecidos", () => {
  const nomes = [...PAN.regras.origens!.lista.map(o => o.origem), ...PAN.excecoesSugeridas!.map(e => e.parametros.origem)];
  const soltos = nomes.filter(n => !normalizarOrigem(n));
  assert.deepEqual(soltos, []);
});
caso("Nenhuma exceção do PAN colide com outra regra por engano", () => {
  const chaves = PAN.excecoesSugeridas!.map(e => normalizarOrigem(e.parametros.origem));
  assert.deepEqual(chaves, ["CAIXA", "BRB_FINANCEIRA"]);
});
caso("BCO BRAS -> Banco do Brasil", () => assert.equal(normalizarOrigem("BCO BRAS"), "BB"));
caso("Itaú com acento", () => assert.equal(normalizarOrigem("Itaú Consignado"), "ITAU"));
caso("C6 BANK -> C6", () => assert.equal(normalizarOrigem("C6 BANK"), "C6"));
caso("INTERNACIONAL não vira Inter", () => assert.equal(normalizarOrigem("BANCO INTERNACIONAL"), null));
caso("nome vazio -> null", () => assert.equal(normalizarOrigem(""), null));

console.log("\nBanco de origem e parcelas pagas");
caso("Caixa com 0 pagas: exceção libera", () => status(CLI, ct({ bancoOrigem: "Caixa", prazoRestante: 96 }), "ELEGIVEL", "(exceção)"));
caso("Caixa sem a exceção cairia em demais (12)", () => status(CLI, ct({ bancoOrigem: "Caixa", prazoRestante: 96 }), "NAO_ELEGIVEL", "exige 12", banco([])));
caso("BRB Financeira confirmada, 2 pagas: exceção libera", () => status(CLI, ct({ bancoOrigem: "BRB", origemConfirmada: "BRB_FINANCEIRA", prazoRestante: 94 }), "ELEGIVEL"));
caso("BRB sem confirmar: pergunta, não reprova", () => status(CLI, ct({ bancoOrigem: "BRB" }), "PENDENTE_INFO", "BRB Banco ou da BRB Financeira"));
caso("BRB Banco confirmado: não porta", () => status(CLI, ct({ bancoOrigem: "BRB", origemConfirmada: "BRB" }), "NAO_ELEGIVEL", "não porta contratos do BRB Banco"));
// So pergunta quando BRB Banco e BRB Financeira dariam resultados diferentes.
// Sem a excecao, a financeira cai em "demais" (12) e o banco nao porta: ainda difere.
caso("Sem a exceção da financeira: ainda pergunta (banco não porta, financeira = demais)", () =>
  status(CLI, ct({ bancoOrigem: "BRB" }), "PENDENTE_INFO", "BRB Banco ou da BRB Financeira",
    banco(EXC.filter(e => e.parametros.origem !== "BRB Financeira"))));
caso("BRB fora da arte e sem exceção: os dois caem em demais, não pergunta", () =>
  status(CLI, ct({ bancoOrigem: "BRB" }), "ELEGIVEL", "demais bancos",
    banco([], { ...PAN.regras, origens: { ...PAN.regras.origens!, lista: PAN.regras.origens!.lista.filter(o => o.origem !== "BRB") } })));
caso("Agibank: não porta", () => status(CLI, ct({ bancoOrigem: "Agibank" }), "NAO_ELEGIVEL", "não porta"));
caso("Itaú 10 pagas: exige 15", () => status(CLI, ct({ bancoOrigem: "Itaú", prazoRestante: 86 }), "NAO_ELEGIVEL", "exige 15"));
caso("Itaú 15 pagas: ok", () => status(CLI, ct({ bancoOrigem: "Itaú", prazoRestante: 81 }), "ELEGIVEL"));
caso("C6 35 pagas: exige 36", () => status(CLI, ct({ bancoOrigem: "C6", prazoRestante: 61 }), "NAO_ELEGIVEL", "exige 36"));
caso("Bradesco (demais) 11 pagas: exige 12", () => status(CLI, ct({ bancoOrigem: "Bradesco", prazoRestante: 85 }), "NAO_ELEGIVEL", "demais bancos"));
caso("Bradesco (demais) 12 pagas: ok", () => status(CLI, ct({ bancoOrigem: "Bradesco", prazoRestante: 84 }), "ELEGIVEL"));
caso("Sem prazo total: pendente, não reprova", () => status(CLI, ct({ prazoTotal: null }), "PENDENTE_INFO", "prazo total"));
caso("Duas exceções para Caixa: conflito vai para análise manual", () => status(CLI, ct({ bancoOrigem: "Caixa" }), "ANALISE_MANUAL", "2 exceções",
  banco([...EXC, { id: 999, tipo: "origem_pagas", parametros: { origem: "CEF", porta: true, pagasMin: 6 } }])));

console.log("\nTaxa e saldo");
caso("Taxa 1,15: abaixo de 1,20", () => status(CLI, ct({ taxa: 1.15 }), "NAO_ELEGIVEL", "abaixo do mínimo"));
caso("Taxa 1,1999 arredonda para 1,20: ok", () => status(CLI, ct({ taxa: 1.1999 }), "ELEGIVEL"));
caso("Sem taxa: pendente", () => status(CLI, ct({ taxa: null }), "PENDENTE_INFO", "taxa do contrato"));
caso("Saldo 5.999: abaixo de 6.000", () => status(CLI, ct({ saldo: 5999 }), "NAO_ELEGIVEL", "abaixo do mínimo"));
caso("Saldo 6.000: ok", () => status(CLI, ct({ saldo: 6000 }), "ELEGIVEL"));
caso("Sem saldo: pendente", () => status(CLI, ct({ saldo: null }), "PENDENTE_INFO", "saldo devedor"));
caso("Reprovação vence pendência", () => status(CLI, ct({ taxa: 1.0, saldo: null }), "NAO_ELEGIVEL"));

console.log("\nSituação funcional");
caso("Sem situação: pendente", () => status({ convenio: "SIAPE" }, ct({}), "PENDENTE_INFO", "situação funcional"));
caso("\"ATIVO\" do CRM não é adivinhado como ATIVO PERMANENTE", () => status({ convenio: "SIAPE", situacaoFuncional: "ATIVO" }, ct({}), "PENDENTE_INFO", "código SIAPE"));
caso("\"APOSENTADO\" casa pela descrição (código 2)", () => status({ convenio: "SIAPE", situacaoFuncional: "APOSENTADO" }, ct({}), "ELEGIVEL"));
caso("\"NES 94\" casa pelo código", () => status({ convenio: "SIAPE", situacaoFuncional: "nes 94" }, ct({}), "ELEGIVEL"));
caso("Código 99 fora da lista: pendente pedindo código", () => status({ convenio: "SIAPE", situacaoFuncional: "99" }, ct({}), "PENDENTE_INFO"));

console.log("\nPensionistas");
const pens = (p: Partial<ClienteEntrada>): ClienteEntrada => ({ convenio: "SIAPE", situacaoFuncional: "84", ...p });
caso("Pensionista sem tipo: pendente", () => status(pens({}), ct({}), "PENDENTE_INFO", "vitalícia ou temporária"));
caso("Vitalícia: ok", () => status(pens({ pensao: { tipo: "vitalicia" } }), ct({}), "ELEGIVEL"));
caso("Temporária sem fim, 24 anos: reprova", () => status(pens({ pensao: { tipo: "temporaria" }, dataNascimento: "2002-01-01" }), ct({}), "NAO_ELEGIVEL", "25 anos"));
caso("Temporária sem fim, 26 anos: ok", () => status(pens({ pensao: { tipo: "temporaria" }, dataNascimento: "2000-01-01" }), ct({}), "ELEGIVEL"));
caso("Temporária sem fim, sem nascimento: pendente", () => status(pens({ pensao: { tipo: "temporaria" } }), ct({}), "PENDENTE_INFO", "data de nascimento"));
caso("Temporária com fim 01/2030, contrato de 60 meses: passa do limite", () =>
  status(pens({ pensao: { tipo: "temporaria", dataFim: "2030-01-01" } }), ct({ prazoRestante: 60 }), "NAO_ELEGIVEL", "3 meses antes"));
caso("Temporária com fim 01/2030, contrato de 24 meses: ok", () =>
  status(pens({ pensao: { tipo: "temporaria", dataFim: "2030-01-01" } }), ct({ prazoRestante: 24 }), "ELEGIVEL"));
caso("Situação não-pensionista ignora dados de pensão", () =>
  status({ convenio: "SIAPE", situacaoFuncional: "1", pensao: { tipo: "temporaria" } }, ct({}), "ELEGIVEL"));

console.log("\nFormalização, operação e agregação");
caso("Analfabeto: análise manual, não reprova", () => status({ ...CLI, alertas: { analfabeto: true } }, ct({}), "ANALISE_MANUAL", "Manual de Formalização"));
caso("Analfabeto não afeta banco sem regra de formalização", () => {
  // regressão: marcar analfabeto jogava para análise manual até banco sem essa regra
  const semRegra = { ...PAN.regras, alertasFormalizacao: [] };
  status({ ...CLI, alertas: { analfabeto: true } }, ct({}), "ELEGIVEL", undefined, banco(EXC, semRegra));
});
caso("Troco e comissão não decidem elegibilidade", () => {
  const r = analisarBanco(banco(), CLI, [ct({})], HOJE).contratos[0];
  assert.equal(r.status, "ELEGIVEL");
  const troco = r.operacao.find(o => o.chave === "troco")!;
  // taxa de refin cadastrada, mas sem prazo e sem pricing: não é "pendente" (não é dado do operador)
  assert.equal(troco.status, "REGRA_NAO_CADASTRADA");
  assert.match(troco.motivo, /1,70% a\.m\..*prazo do refin/);
});

console.log("\nComissão (0,75% sobre o saldo)");
caso("Contrato elegível: 0,75% do saldo", () => {
  const com = analisarBanco(banco(), CLI, [ct({ saldo: 20000 })], HOJE).contratos[0].operacao.find(o => o.chave === "comissao")!;
  assert.equal(com.status, "ELEGIVEL");
  assert.equal(com.valorAnalisado, "R$ 150,00");
});
caso("Contrato recusado não gera comissão", () => {
  const com = analisarBanco(banco(), CLI, [ct({ bancoOrigem: "Agibank" })], HOJE).contratos[0].operacao.find(o => o.chave === "comissao")!;
  assert.equal(com.status, "NAO_ELEGIVEL");
  assert.equal(com.valorAnalisado, null);
});
caso("Total do banco soma só elegíveis; análise manual fica à parte", () => {
  const r = analisarBanco(banco(), CLI, [ct({ saldo: 20000 }), ct({ saldo: 10000 }), ct({ bancoOrigem: "Agibank", saldo: 50000 })], HOJE);
  assert.deepEqual(r.comissao, { percentual: 0.75, base: "saldo", total: 225, contratos: 2, estimadaEmAnalise: 0 });
  const manual = analisarBanco(banco(), { ...CLI, alertas: { analfabeto: true } }, [ct({ saldo: 20000 })], HOJE);
  assert.equal(manual.comissao!.total, 0);
  assert.equal(manual.comissao!.estimadaEmAnalise, 150);
});
caso("Banco sem regra de comissão: resumo nulo", () => {
  const r = analisarBanco(banco(EXC, { ...PAN.regras, comissao: null }), CLI, [ct({})], HOJE);
  assert.equal(r.comissao, null);
});
caso("semComissao apaga tudo que revela a comissão (corretor)", () => {
  const r = semComissao(analisar([banco()], CLI, [ct({ saldo: 20000 })], HOJE));
  assert.equal(r.bancos[0].comissao, null);
  assert.ok(r.bancos[0].contratos.every(c => c.operacao.every(o => o.chave !== "comissao")));
  assert.ok(!JSON.stringify(r).includes("0,75%"));
});
caso("Sem regra vigente: banco inteiro 'regra não cadastrada'", () => {
  const r = analisarBanco({ bankId: 2, nome: "Safra", ruleSet: null, excecoes: [] }, CLI, [ct({})], HOJE);
  assert.equal(r.status, "REGRA_NAO_CADASTRADA");
});
caso("Banco com 2 de 3 elegíveis: status elegível e contagem certa", () => {
  const r = analisarBanco(banco(), CLI, [ct({}), ct({ bancoOrigem: "Agibank" }), ct({ bancoOrigem: "Caixa" })], HOJE);
  assert.equal(r.status, "ELEGIVEL");
  assert.equal(r.contagem.ELEGIVEL, 2);
  assert.equal(r.contagem.NAO_ELEGIVEL, 1);
  assert.match(r.resumo, /2 de 3/);
});
caso("Exceção usada fica registrada para auditoria", () => {
  const r = analisarBanco(banco(), CLI, [ct({ bancoOrigem: "Caixa" })], HOJE);
  assert.deepEqual(r.excecoesAplicadas, [100]);
  assert.equal(r.ruleSetId, 1);
});

console.log("\nCampos pendentes (o que a tela pede)");
caso("Contrato já recusado não pede saldo nem taxa", () => {
  const r = analisarBanco(banco(), CLI, [ct({ bancoOrigem: "Agibank", saldo: null, taxa: null })], HOJE);
  assert.equal(r.contratos[0].status, "NAO_ELEGIVEL");
  assert.deepEqual(r.camposPendentes, []);
});
caso("Contrato pendente pede exatamente o que falta", () => {
  const r = analisarBanco(banco(), CLI, [ct({ id: "x1", saldo: null, taxa: null })], HOJE);
  assert.deepEqual(r.camposPendentes.map(c => c.campo + "@" + c.contratoId), ["taxa@x1", "saldo@x1"]);
});
caso("Dado do cliente só é pedido se sobrou contrato pendente", () => {
  const todosRecusados = analisarBanco(banco(), { convenio: "SIAPE" }, [ct({ bancoOrigem: "Agibank" })], HOJE);
  assert.deepEqual(todosRecusados.camposPendentes, []);
  const comPendente = analisarBanco(banco(), { convenio: "SIAPE" }, [ct({})], HOJE);
  assert.deepEqual(comPendente.camposPendentes.map(c => c.escopo + ":" + c.campo), ["cliente:situacaoFuncional"]);
});
caso("Contador do resumo usa o mesmo critério da lista de pendências", () => {
  // Itaú sem saldo já está recusado por pagas: não conta como pendência
  const r = analisarBanco(banco(), CLI, [ct({ bancoOrigem: "Itaú", prazoRestante: 86, saldo: null }), ct({ saldo: null })], HOJE);
  assert.equal(r.pendencias.length, r.camposPendentes.length);
  assert.match(r.resumo, /\(1\)/);
});
caso("BRB ambíguo pede a confirmação no próprio contrato", () => {
  const r = analisarBanco(banco(), CLI, [ct({ id: "b1", bancoOrigem: "BRB" })], HOJE);
  assert.deepEqual(r.camposPendentes.map(c => c.campo + "@" + c.contratoId), ["origemConfirmada@b1"]);
});

console.log("\nFora da CIP, próprio banco e origem desconhecida");
caso("Contrato do próprio PAN: não porta (é refin)", () => status(CLI, ct({ bancoOrigem: "Pan" }), "NAO_ELEGIVEL", "Contrato já é do PAN"));
caso("Contrato do Pan em OUTRO banco: porta normalmente (só o PAN não porta ele mesmo)", () => {
  const outro: BancoParaAnalise = { bankId: 2, nome: "Digio", ruleSet: { id: 2, hash: "d", vigenciaInicio: "2026-09-18",
    regras: { taxaEntradaMin: 1.2, saldoMin: 6000, origens: { padraoPagasMin: 12, lista: [] } } }, excecoes: [] };
  const r = analisarBanco(outro, CLI, [ct({ bancoOrigem: "Pan" })], HOJE).contratos[0];
  assert.equal(r.status, "ELEGIVEL", JSON.stringify(r.regras.map(x => x.motivo)));
});
caso("Futuro no PAN (fora da CIP): não porta", () => status(CLI, ct({ bancoOrigem: "FUTURO" }), "NAO_ELEGIVEL", "fora da CIP: não pode ser portada"));
for (const nome of ["SABEMI", "J17", "ATLANTA", "HOJE PREVIDENCIA", "CAPITAL CONSIG", "SENFF", "LARCA"]) {
  caso(`${nome} é reconhecida como fora da CIP`, () => status(CLI, ct({ bancoOrigem: nome }), "NAO_ELEGIVEL", "fora da CIP"));
}
caso("Fora da CIP vale para QUALQUER banco, mesmo sem regra própria", () => {
  const outro: BancoParaAnalise = { bankId: 2, nome: "Digio", ruleSet: { id: 2, hash: "d", vigenciaInicio: "2026-09-18",
    regras: { taxaEntradaMin: 1.2, saldoMin: 6000, origens: { padraoPagasMin: 12, lista: [] } } }, excecoes: [] };
  const r = analisarBanco(outro, CLI, [ct({ bancoOrigem: "SABEMI" })], HOJE).contratos[0];
  assert.equal(r.status, "NAO_ELEGIVEL"); assert.match(r.regras[0].motivo, /fora da CIP/);
});
caso("Exceção cadastrada vence a regra de CIP", () =>
  status(CLI, ct({ bancoOrigem: "SENFF" }), "ELEGIVEL", "(exceção)",
    banco([...EXC, { id: 300, tipo: "origem_pagas", parametros: { origem: "Senff", porta: true, pagasMin: 0 } }])));
caso("\"Capital Go\" não vira Capital Consig", () => assert.equal(normalizarOrigem("CAPITAL GO"), null));
caso("Banco que o sistema não conhece: tratado como demais, mas marcado", () => {
  const r = analisarBanco(banco(), CLI, [ct({ bancoOrigem: "BANCO XYZ" })], HOJE).contratos[0];
  assert.equal(r.status, "ELEGIVEL"); assert.equal(r.origemDesconhecida, true);
  assert.equal(analisarBanco(banco(), CLI, [ct({})], HOJE).contratos[0].origemDesconhecida, undefined);
});

console.log("\nBRB Red (idade e grupo)");
const BRB = MODELOS.find(m => m.id === "brb-red-siape-2026-09")!;
const bancoBRB = (regras = BRB.regras): BancoParaAnalise =>
  ({ bankId: 9, nome: "BRB Red", ruleSet: { id: 9, hash: "b", vigenciaInicio: "2026-09-22", regras }, excecoes: [] });
const nasc = (anos: number) => `${HOJE.getFullYear() - anos}-01-10`;   // faz aniversário antes de 18/09
const CLI_BRB = (anos: number, situacao = "1"): ClienteEntrada => ({ convenio: "SIAPE", situacaoFuncional: situacao, dataNascimento: nasc(anos) });

caso("BRB Red não porta BRB Banco (mesmo grupo)", () => status(CLI_BRB(50), ct({ bancoOrigem: "BRB" }), "NAO_ELEGIVEL", "mesmo grupo do BRB Red", bancoBRB()));
caso("BRB Red não porta BRB Financeira (mesmo grupo)", () => status(CLI_BRB(50), ct({ bancoOrigem: "BRB CFI" }), "NAO_ELEGIVEL", "mesmo grupo", bancoBRB()));
caso("BRB Red não porta BRB Consig360 (mesmo grupo)", () => status(CLI_BRB(50), ct({ bancoOrigem: "BRB CONSIG360" }), "NAO_ELEGIVEL", "mesmo grupo", bancoBRB()));
caso("Caixa com 1 paga: BRB porta", () => status(CLI_BRB(50), ct({ bancoOrigem: "Caixa", prazoRestante: 95 }), "ELEGIVEL", "exige 1", bancoBRB()));
caso("Bradesco entra na lista de 1 paga do BRB", () => status(CLI_BRB(50), ct({ bancoOrigem: "Bradesco", prazoRestante: 95 }), "ELEGIVEL", "exige 1", bancoBRB()));
caso("BMG (demais bancos) com 11 pagas: exige 12", () => status(CLI_BRB(50), ct({ bancoOrigem: "BMG", prazoRestante: 85 }), "NAO_ELEGIVEL", "exige 12", bancoBRB()));
caso("C6: BRB não porta", () => status(CLI_BRB(50), ct({ bancoOrigem: "C6 BANK" }), "NAO_ELEGIVEL", "não porta", bancoBRB()));
caso("BRB não tem taxa de entrada: contrato a 1,00% passa", () => status(CLI_BRB(50), ct({ taxa: 1.0, prazoRestante: 84 }), "ELEGIVEL", undefined, bancoBRB()));
caso("Saldo 4.000,00 fica abaixo do mínimo (4.000,01)", () => status(CLI_BRB(50), ct({ saldo: 4000, prazoRestante: 84 }), "NAO_ELEGIVEL", "abaixo do mínimo", bancoBRB()));
caso("Estatutário com 64 anos: passa", () => status(CLI_BRB(64), ct({ prazoRestante: 84 }), "ELEGIVEL", "dentro do limite", bancoBRB()));
caso("Estatutário com 65 anos: não passa", () => status(CLI_BRB(65), ct({ prazoRestante: 84 }), "NAO_ELEGIVEL", "atende até 64", bancoBRB()));
caso("Celetista (código 25) com 58 anos: passa", () => status(CLI_BRB(58, "25"), ct({ prazoRestante: 84 }), "ELEGIVEL", undefined, bancoBRB()));
caso("Celetista (código 25) com 59 anos: não passa", () => status(CLI_BRB(59, "25"), ct({ prazoRestante: 84 }), "NAO_ELEGIVEL", "atende até 58 (celetista)", bancoBRB()));
caso("Sem data de nascimento: pergunta, não reprova", () =>
  status({ convenio: "SIAPE", situacaoFuncional: "1" }, ct({ prazoRestante: 84 }), "PENDENTE_INFO", "Falta a data de nascimento", bancoBRB()));
caso("Banco sem regra de idade não pede nascimento", () =>
  assert.ok(!analisarBanco(banco(), { convenio: "SIAPE", situacaoFuncional: "1" }, [ct({})], HOJE).cliente.some(r => r.chave === "idade")));
caso("BRB: pensão vitalícia passa", () =>
  status({ ...CLI_BRB(60, "84"), pensao: { tipo: "vitalicia" } }, ct({ prazoRestante: 84 }), "ELEGIVEL", "vitalícia é aceita", bancoBRB()));
caso("BRB: pensão temporária não passa (só vitalícia)", () =>
  status({ ...CLI_BRB(60, "84"), pensao: { tipo: "temporaria", dataFim: "2030-01-01" } }, ct({ prazoRestante: 84 }), "NAO_ELEGIVEL", "só atende pensão vitalícia", bancoBRB()));
caso("BRB: cedido SUS (45) fora da lista de situações", () =>
  status(CLI_BRB(50, "45"), ct({ prazoRestante: 84 }), "PENDENTE_INFO", "não bate com nenhum código", bancoBRB()));
caso("BRB: cedido comum (8) é aceito", () => status(CLI_BRB(50, "8"), ct({ prazoRestante: 84 }), "ELEGIVEL", "é aceita pelo BRB Red", bancoBRB()));
caso("PAN segue aceitando pensão temporária (regra não vazou)", () =>
  status({ convenio: "SIAPE", situacaoFuncional: "84", dataNascimento: "1966-01-10", pensao: { tipo: "temporaria" } }, ct({}), "ELEGIVEL"));
caso("Comissão do BRB: 2,05% do saldo", () => {
  const r = analisarBanco(bancoBRB(), CLI_BRB(50), [ct({ saldo: 20000, prazoRestante: 84 })], HOJE);
  assert.deepEqual([r.comissao!.percentual, r.comissao!.total], [2.05, 410]);
});

console.log("\nSafra (faixas de taxa/comissão e idade no fim da operação)");
const SAF = MODELOS.find(m => m.id === "safra-siape-2026-09")!;
const bancoSAF = (): BancoParaAnalise =>
  ({ bankId: 5, nome: "Safra Financeira", ruleSet: { id: 5, hash: "s", vigenciaInicio: "2026-09-22", regras: SAF.regras }, excecoes: [] });
const cliSAF = (anos: number): ClienteEntrada => ({ convenio: "SIAPE", situacaoFuncional: "1", dataNascimento: nasc(anos) });
const ctSAF = (p: Partial<ContratoEntrada>) => ct({ bancoOrigem: "Bradesco", taxa: 1.5, prazoTotal: 96, prazoRestante: 60, ...p });

caso("Safra não porta Alfa (mesmo grupo)", () => status(cliSAF(50), ctSAF({ bancoOrigem: "Banco Alfa", saldo: 30000 }), "NAO_ELEGIVEL", "mesmo grupo", bancoSAF()));
caso("Safra: saldo de 9.999 fica abaixo do mínimo de 10 mil", () => status(cliSAF(50), ctSAF({ saldo: 9999 }), "NAO_ELEGIVEL", "abaixo do mínimo", bancoSAF()));
caso("Safra: taxa de entrada 1,20", () => status(cliSAF(50), ctSAF({ saldo: 30000, taxa: 1.19 }), "NAO_ELEGIVEL", "abaixo do mínimo", bancoSAF()));
caso("Contrato de 12 mil usa a faixa 10k–20k: 1,70% e comissão 2,55%", () => {
  const r = analisarBanco(bancoSAF(), cliSAF(50), [ctSAF({ saldo: 12000, parcela: 600 })], HOJE, { modo: "parcela", prazo: 96 });
  assert.equal(r.contratos[0].preco!.taxa, 1.70);
  assert.equal(r.comissao!.percentual, 2.55);
  assert.equal(r.comissao!.total, Math.round(12000 * 2.55) / 100);
});
caso("Contrato que passa de 20 mil usa a faixa de cima: 1,65% e comissão 1,70%", () => {
  const r = analisarBanco(bancoSAF(), cliSAF(50), [ctSAF({ saldo: 30000, parcela: 1200 })], HOJE, { modo: "parcela", prazo: 96 });
  assert.equal(r.contratos[0].preco!.taxa, 1.65);
  assert.equal(r.comissao!.percentual, 1.70);
});
caso("Dois contratos em faixas diferentes: taxa e comissão saem como 'varia'", () => {
  const r = analisarBanco(bancoSAF(), cliSAF(50), [ctSAF({ id: "a", saldo: 12000, parcela: 600 }), ctSAF({ id: "b", saldo: 30000, parcela: 1200 })], HOJE, { modo: "parcela", prazo: 96 });
  assert.equal(r.refin!.taxa, null); assert.equal(r.comissao!.percentual, null);
  assert.equal(r.comissao!.total, Math.round((12000 * 2.55 + 30000 * 1.70)) / 100);
});
caso("Idade no fim da operação: 70 anos em 120 meses estoura os 78", () => {
  const r = analisarBanco(bancoSAF(), cliSAF(70), [ctSAF({ saldo: 30000, parcela: 1200 })], HOJE, { modo: "parcela", prazo: 120 });
  assert.equal(r.contratos[0].status, "NAO_ELEGIVEL");
  const f = r.cliente.find(x => x.chave === "idade_fim")!;
  assert.match(f.motivo, /termina com 80 anos.*Prazo máximo: \d+ meses/);
});
caso("Idade no fim da operação: 70 anos em 84 meses passa", () => {
  const r = analisarBanco(bancoSAF(), cliSAF(70), [ctSAF({ saldo: 30000, parcela: 1200 })], HOJE, { modo: "parcela", prazo: 84 });
  assert.equal(r.contratos[0].status, "ELEGIVEL");
});
caso("Sem prazo informado, a idade do fim não reprova: fica como regra não calculada", () => {
  const r = analisarBanco(bancoSAF(), cliSAF(70), [ctSAF({ saldo: 30000 })], HOJE, null);
  assert.equal(r.cliente.find(x => x.chave === "idade_fim")!.status, "REGRA_NAO_CADASTRADA");
});
caso("Sem data de nascimento: pergunta em vez de reprovar", () => {
  const r = analisarBanco(bancoSAF(), { convenio: "SIAPE", situacaoFuncional: "1" }, [ctSAF({ saldo: 30000 })], HOJE, { modo: "maximo", prazo: 96 });
  assert.equal(r.cliente.find(x => x.chave === "idade_fim")!.status, "PENDENTE_INFO");
});
caso("PAN (taxa única) não virou 'varia'", () => {
  const r = analisarBanco(banco(), CLI, [ct({ saldo: 20000, parcela: 520 })], HOJE, { modo: "maximo", prazo: 96 });
  assert.equal(r.refin!.taxa, 1.70); assert.equal(r.comissao!.percentual, 0.75);
});

console.log(`\n${ok} ok, ${falhas} falha(s)\n`);
process.exit(falhas ? 1 : 0);
