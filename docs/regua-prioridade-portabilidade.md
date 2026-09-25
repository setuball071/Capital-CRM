# Régua de prioridade — portabilidade e margem (SIAPE)

Material para o RAG do CRM de atendimento. Gerado em 25/09/2026 a partir das regras
cadastradas no motor do simulador (`shared/portability/modelos.ts`, 8 bancos).

⚠️ **Como ler:** o que está marcado **[SISTEMA]** sai das regras cadastradas e é conferido
por teste. O que está **[DECIDIR]** é política comercial: precisa da palavra do Fábio, e até
lá o atendimento não deve afirmar.

> **Antes de portar, olhe os outros dois — [regra do Fábio]**
> **Margem de cartão** e **contrato novo** são os produtos mais rentáveis da casa e têm
> **prioridade no atendimento**. Portabilidade vem **depois** deles. Ver
> `regua-prioridade-cartao.md` e `regua-prioridade-credito-novo.md`.

---

## 1. Quando vale portar

### Taxa mínima do contrato atual — **[SISTEMA]**
Varia por banco. É a taxa do contrato que o cliente já tem:

| Taxa do contrato atual | Quem aceita |
|---|---|
| qualquer taxa | Inter, BRB Red, Facta (não exigem taxa mínima) |
| a partir de 1,00% | + Paraná |
| a partir de 1,20% | + PAN, Safra |
| a partir de 1,36% | + Daycoval |
| a partir de 1,39% | + Digio (todos os 8) |

Regra prática para o atendimento: **abaixo de 1,20% quase ninguém porta**; de 1,39% para cima,
qualquer um dos oito pode.

### Parcelas pagas mínimas — **[SISTEMA]**
Não existe "prazo restante mínimo"; o que manda é **quantas parcelas já foram pagas**, e isso
muda conforme o banco de ORIGEM:

- **Padrão ("demais bancos"):** 12 pagas (Facta e Inter são exceção: aceitam com **0**).
- **Bancos de rede** (BB, Caixa, Itaú, Bradesco, Santander, Nubank, Inter, Sicoob, Sicredi):
  Paraná, Safra e Digio com **0**; Daycoval com **6**; BRB Red com **1**.
- **Casos próprios:** Pan costuma exigir mais (25 no Safra e no Paraná, 30 no Facta);
  C6 idem (25 no Safra e no Digio, 36 no PAN).

### Bancos que NÃO portam — **[SISTEMA]**
- **Ninguém porta** entidades **fora da CIP**: Futuro, Sabemi, J17, Atlanta, Hoje,
  Capital Consig, Senff e Larca.
- **Ninguém porta o próprio banco nem o mesmo grupo:** PAN não porta Pan (isso é refin);
  BRB Red não porta BRB Consig360 nem BRB Brasília; Safra não porta Alfa.
- **Por banco:**
  - PAN: Agibank, BRB
  - BRB Red: C6, Agibank, PicPay, Pine, Inbursa
  - Safra: Daycoval, Inbursa
  - Daycoval: C6, Safra, Alfa
  - Inter: Facta, Master, Digimais
  - Paraná: Bari, Facta, Mercantil
  - Facta: Inbursa, Pine, Socicred — e **Paulista/Zema só se o contrato não tiver nascido na Facta** (vai para conferência humana)
  - Digio: Inter

### Bancos preferidos na chegada — **[DECIDIR]**
O sistema sabe quanto cada banco paga, mas **quem define a preferência é o Fábio**. Comissão
sobre o saldo devedor hoje:

| Banco | Comissão |
|---|---|
| Paraná | 2,70% |
| Safra | 2,55% (contrato de 10 a 20 mil) · 1,70% (acima de 20 mil) |
| Facta | 2,50% |
| BRB Red | 2,05% *(banco suspenso no momento)* |
| Inter | 0,35% a 2,05%, conforme a tabela que a taxa ponderada permitir |
| PAN | 0,75% |
| Daycoval | 0,75% |
| Digio | ainda não cadastrada |

⚠️ **Comissão é informação interna.** O atendimento nunca cita percentual de comissão ao cliente.

---

## 2. Troco

### Como calcula — **[SISTEMA]**
1. O saldo devedor do contrato atual é portado para o banco novo.
2. O banco refinancia esse saldo pela **taxa dele**, no **prazo escolhido**, na Tabela Price.
3. A diferença entre o que cabe na parcela e o saldo é o **troco bruto**.
4. **IOF:** o líquido que o cliente recebe é o bruto dividido por **1,032**.
5. **Valor do contrato novo** = saldo + troco bruto.

Taxas de refin cadastradas: Paraná e BRB Red 1,65% · PAN e Daycoval 1,70% · Digio 1,71% ·
Facta 1,80% · Safra 1,70% ou 1,65% conforme a faixa. O **Inter** não entra nessa conta: a
viabilidade dele é por **taxa ponderada** (mínimo 1,63% no SIAPE, 1,60% com seguro), feita na
aba Viabilidade Inter.

Três modos de operação: **liberar o máximo** (mantém a parcela), **reduzir a parcela**
(libera só o troco mínimo) e **troco desejado**.

### Troco mínimo por contrato — **[SISTEMA]**
PAN, BRB Red e Facta R$ 50 · Daycoval e Paraná R$ 100 · Digio R$ 250 · Inter R$ 300 · Safra R$ 500.

### Troco mínimo para a operação "valer a pena" — **[DECIDIR]**
Diferente do mínimo do banco. Precisa da régua do Fábio (ex.: "abaixo de R$ 1.000 de troco
não vale o esforço"). Enquanto não houver, o atendimento usa só o mínimo do banco.

### Base de dias — **[SISTEMA]**
- Motor do simulador: **Price mensal**, sem contagem de dias.
- Viabilidade Inter: troco em **base 360** (DAYS360) e taxa ponderada em **base 365** (XIRR).
  ⚠️ Não misturar as duas: trocar a base muda a tabela de comissionamento.

---

## 3. Margem

### Regras do SIAPE — **[SISTEMA / base Bigdata]**
- Consignado: **35% + 5% (cartão) + 5% (cartão benefício)**, em baldes independentes
  (voltou a valer em 29/08/2026, quando a MP dos 40% caiu).
- **Teto de 70%:** é o limite de **todos os descontos** do contracheque, não só do consignado.
  Margem de 70% disponível = margem bruta de 70% − (total de rendimentos − total líquido).
- Margem vendável = o **menor** entre a margem de 35% e a de 70%.

### Margem mínima que interessa — **[DECIDIR]**
Precisa da régua do Fábio (ex.: "abaixo de R$ 50 de margem não trabalha").
Nos cortes da base o piso usado é R$ 50 de margem.

### Margem negativa — **[SISTEMA]**
- O simulador cobre margem negativa por **contrato individual**, nunca no total.
- Bancos que reduzem ou abatem negativo: Daycoval, Paraná, Inter, C6, Quero+Crédito e BRB
  (no refin da port). Safra abate no refin da port. Digio **não** abate.

---

## 4. Prioridade — **[DECIDIR: rascunho para o Fábio aprovar]**

⚠️ Esta régua vale **dentro** da portabilidade. Na fila do atendimento, cliente com margem
de cartão ou de contrato novo passa na frente de tudo o que está abaixo.

Proposta, usando o que o sistema calcula:

- **ALTA:** contrato que pelo menos um banco aceita **e** libera troco acima do mínimo, com
  parcela igual ou menor que a atual. Cliente com mais de um contrato elegível no mesmo banco
  (soma saldo e troco) entra aqui.
- **MÉDIA:** contrato elegível, mas com troco baixo, ou que só fecha reduzindo a parcela
  (portabilidade "limpa", sem dinheiro no bolso). Também entra o que depende de dado que
  falta: data de nascimento, situação funcional ou UPAG.
- **BAIXA / não mexer:** contrato que nenhum banco aceita, entidade fora da CIP, contrato do
  próprio banco (isso é refin, não portabilidade) e cliente fora da idade de todos.

---

## 5. Casos que não valem — **[SISTEMA]**

O simulador recusa sozinho quando:

- **Saldo devedor abaixo do mínimo** do banco: Inter R$ 1.000 · Facta R$ 2.000 ·
  BRB Red R$ 4.000,01 · Daycoval R$ 5.000 · PAN e Digio R$ 6.000 · Safra R$ 10.000.
- **Parcela nova abaixo da mínima:** Daycoval R$ 20 · Facta R$ 50 · Paraná R$ 200.
- **Contrato acima do teto do banco:** Inter R$ 270.000, já somando o troco.
- **Faltam parcelas pagas** conforme o banco de origem (ver item 1).
- **Idade:** quase todos exigem **terminar a operação** dentro de um limite — Facta 74,
  Daycoval 75, Paraná 77, Safra 78, Inter e Digio 79. O BRB Red olha a idade **na
  contratação**: 64 anos, ou 58 se celetista.
- **Entidade fora da CIP** ou **contrato do próprio banco/grupo**.
- **UPAG não atendida:** o Inter tem 52 UPAGs de fora (EBSERH, FUNAI, CBTU, SUDENE,
  ex-territórios e outras). O DNOCS só é barrado para servidor **ativo**.
- **Pensão:** o BRB Red só faz **vitalícia**; o Safra só aceita temporária sem data fim para
  **mulheres** (vai para conferência humana).

### Não é portabilidade — **[SISTEMA]**
- **Cartão RMC e cartão benefício RCC** não se portam como consignado: o caminho é o
  **Simulador de Compra** (compra de dívida do cartão), que usa outra conta:
  bruto = margem ÷ coeficiente, líquido = bruto − saldo.
- **Contrato do próprio banco** é refinanciamento, não portabilidade.

---

## Perguntas em aberto para o Fábio
1. Troco mínimo para a operação valer a pena (item 2).
2. Margem mínima que interessa (item 3).
3. Confirmar a régua de prioridade do item 4.
4. Ordem de preferência dos bancos na chegada (item 1).
5. Comissão do Digio.

---

Ver também: `regua-prioridade-cartao.md` e `regua-prioridade-credito-novo.md`.
