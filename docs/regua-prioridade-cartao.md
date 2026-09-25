# Régua de prioridade — margem de CARTÃO (RMC e RCC)

Material para o RAG do CRM de atendimento. Gerado em 25/09/2026 a partir do que está
cadastrado no sistema (`shared/compra/calculo.ts`, `client/public/simulador-contracheque.html`,
Tabelas de Coeficientes do Financeiro).

⚠️ **Como ler:** **[SISTEMA]** sai do que o sistema calcula e está conferido por teste.
**[DECIDIR]** é política comercial, precisa da palavra do Fábio. **[FALTA DADO]** é
informação que ainda não existe cadastrada em lugar nenhum — o atendimento não deve
afirmar nada nesses pontos.

> **Prioridade no atendimento — [SISTEMA / regra do Fábio]**
> Cliente com **margem de cartão** livre entra **na frente** da portabilidade: é um dos
> dois produtos mais rentáveis da casa (o outro é o contrato novo). Portabilidade só vira
> prioridade quando cartão e contrato novo já foram olhados.

---

## 1. O que é a margem de cartão

### Os dois baldes — **[SISTEMA]**
- **RMC — cartão consignado:** 5% da base de cálculo.
- **RCC — cartão benefício:** 5% da base de cálculo.
- Desde **29/08/2026**, quando a MP dos 40% caiu, os dois voltaram a ser **baldes
  independentes** do consignado (Lei 14.509/2022). O cartão **não come** os 35% do
  empréstimo — quem usa muito cartão na prática **ganha** margem de consignado.
- No **teto de 70%** os cartões entram como desconto, como qualquer outro: o teto limita
  **todos** os descontos do contracheque, não só o consignado.

### Onde o atendimento vê isso — **[SISTEMA]**
O **Simulador de Contracheque** lê o PDF e devolve as três margens (35% + 5% + 5%)
já com o teto de 70% aplicado.

---

## 2. Cartão não se porta — **[SISTEMA]**

Cartão RMC e RCC **não entram em portabilidade** como o consignado. O caminho é a
**compra da dívida do cartão**, no **Simulador de Compra**, que usa outra conta.

---

## 3. Como o sistema calcula a compra de cartão — **[SISTEMA]**

```
saldo    = saldo real do banco
           sem ele: parcela da folha × fator (o padrão é 23)
bruto    = margem ÷ coeficiente da tabela
liberado = bruto − saldo          ← o líquido que vai pro cliente
comissão = bruto × percentual     ← sobre o BRUTO (na portabilidade é sobre o saldo)
```

**Parcela e margem são campos separados de propósito:** a parcela da folha serve para
**estimar o saldo**; a margem é a que se usa **para comprar**. Podem ser iguais, mas a
margem pode ser maior — e aí a operação bruta cresce sem mexer no saldo.

⚠️ **O fator 23 é estimativa.** Saldo real do banco sempre ganha do estimado. Se o saldo
veio estimado, o sistema marca isso na tela e o atendimento não deve prometer o líquido.

---

## 4. Tabelas de compra cadastradas — **[SISTEMA]**

15 tabelas de SIAPE, todas da planilha do Fábio (22/09/2026):

| Banco | Tabelas | Coeficiente | Percentual |
|---|---|---|---|
| Neo | 8 | 0,031866 a 0,042825 | 2% a 28% |
| Futuro | 7 | 0,032902 a 0,050119 | 2% a 38% |

Regra da conta: **coeficiente maior = bruto menor = percentual maior**. É o trade-off que o
master resolve na hora, tabela por tabela.

⚠️ **Só o master cadastra tabela e só o master vê percentual e comissão.** No print para o
operacional digitar, comissão e percentual saem da tela (botão de esconder comissão).
O atendimento **nunca** cita percentual ao cliente.

### O que falta nessas 15 tabelas — **[FALTA DADO]**
- **Prazo** e **tipo** (RMC ou RCC) estão em branco nas 15.
- O coeficiente da 3ª tabela Neo (0,0390892) foi **deduzido do bruto da planilha** porque
  a célula vinha formatada como "R$ 0,04" — está marcado "confira o coeficiente".
- Só existe **SIAPE**. Outros convênios ainda não foram cadastrados.

---

## 5. Tabelas de Coeficientes do Financeiro — **[SISTEMA]**

Separado do Simulador de Compra, o Financeiro tem **Tabelas de Coeficientes** com os tipos
`cartao_consignado` e `cartao_beneficio` (além de `contrato_novo`). Cada tabela tem
convênio, banco, prazo, coeficiente e **pontos**. A simulação aceita os dois sentidos:

- informando a **parcela** → `valor do contrato = parcela ÷ coeficiente`
- informando o **valor do contrato** → `parcela = valor × coeficiente`

Devolve as **10 melhores por pontos**, só as ativas. Cadastra **master ou coordenação**.

⚠️ São duas bases diferentes: as 15 tabelas da planilha (Simulador de Compra) e as Tabelas
de Coeficientes (Financeiro). **[DECIDIR]** se ficam separadas ou se unificamos.

---

## 6. Prioridade — **[DECIDIR: rascunho para o Fábio aprovar]**

- **ALTA:** cliente com margem de cartão **livre** (não usa RMC nem RCC, ou usa pouco) e
  dentro do teto de 70%. É dinheiro novo, sem depender de banco aceitar portabilidade.
- **ALTA também:** cliente com cartão **em outro banco** cujo saldo cabe na compra e sobra
  líquido — dá troco ao cliente e comissão sobre o bruto.
- **MÉDIA:** cartão existente com saldo alto, onde o líquido fica apertado ou negativo;
  vale só se o margem permitir uma operação bruta maior.
- **BAIXA:** margem de cartão zerada e teto de 70% estourado — não tem o que vender.

---

## 7. O que o atendimento NÃO afirma

- Valor líquido quando o **saldo foi estimado** pelo fator 23 — só depois do saldo do banco.
- **Percentual e comissão**, em nenhuma hipótese.
- **Prazo** da operação, enquanto as tabelas estiverem sem prazo cadastrado.
- Idade ou órgão que aceita/não aceita: **não existe regra de cartão cadastrada** hoje.

---

## Perguntas em aberto para o Fábio
1. Prazo e tipo (RMC ou RCC) de cada uma das 15 tabelas.
2. Confirmar o coeficiente da 3ª tabela Neo (0,0390892).
3. O fator 23 vale para todo convênio, ou muda?
4. Margem mínima de cartão que vale trabalhar.
5. Existe regra de **idade** ou de **órgão** na compra de cartão?
6. Ordem de preferência entre Neo e Futuro.
7. As duas bases de tabela ficam separadas ou unificamos?

---

Ver também: `regua-prioridade-credito-novo.md` e `regua-prioridade-portabilidade.md`.
