# Régua de prioridade — CRÉDITO NOVO (margem livre de consignado)

Material para o RAG do CRM de atendimento. Gerado em 25/09/2026 a partir do que está
cadastrado no sistema (Tabelas de Coeficientes do Financeiro,
`client/public/simulador-contracheque.html`).

⚠️ **Como ler:** **[SISTEMA]** sai do que o sistema calcula. **[DECIDIR]** é política
comercial, precisa da palavra do Fábio. **[FALTA DADO]** ainda não existe cadastrado em
lugar nenhum — o atendimento não deve afirmar nada nesses pontos.

> **Prioridade no atendimento — [SISTEMA / regra do Fábio]**
> Cliente com **margem livre para contrato novo** entra **na frente** da portabilidade:
> é um dos dois produtos mais rentáveis da casa (o outro é a margem de cartão).
> Portabilidade só vira prioridade depois que cartão e contrato novo foram olhados.

---

## 1. Qual margem serve para contrato novo

### O balde do consignado — **[SISTEMA]**
- **35%** da base de cálculo para empréstimo consignado, desde **29/08/2026**, quando a MP
  dos 40% caiu e voltou a valer a Lei 14.509/2022.
- Os 5% do cartão RMC e os 5% do cartão RCC são **baldes separados** e **não entram** nesse
  cálculo. Quem usa muito cartão tem **mais** margem de consignado sobrando, não menos.
- **Teto de 70%:** limite de **todos** os descontos do contracheque.
  `margem de 70% disponível = margem bruta de 70% − (total de rendimentos − total líquido)`
- **Margem vendável = o MENOR** entre a margem de 35% e a de 70%. Se o cliente tem 35% livre
  mas o teto de 70% já estourou, não há contrato novo.

### Onde o atendimento vê isso — **[SISTEMA]**
O **Simulador de Contracheque** lê o PDF e devolve as três margens já com o teto aplicado.
Não precisa perguntar valores ao cliente: o contracheque manda.

---

## 2. Como o sistema calcula — **[SISTEMA]**

As **Tabelas de Coeficientes** do Financeiro, tipo `contrato_novo`, aceitam a conta nos dois
sentidos:

```
informando a margem/parcela  →  valor liberado = margem ÷ coeficiente
informando o valor           →  parcela        = valor × coeficiente
```

A busca é por **convênio + tipo de produto**, podendo filtrar **banco** e **prazo**, e
devolve as **10 melhores por pontos**, só as tabelas **ativas**.

Cadastra e edita: **master ou coordenação**. Aceita importação por CSV
(`nome, convenio, banco, tipoProduto, prazo, coeficiente, pontos`).

⚠️ **Pontos e coeficiente são informação interna.** O atendimento passa parcela e valor,
nunca pontuação ou remuneração.

---

## 3. O que falta para o RAG ficar completo — **[FALTA DADO]**

Diferente da portabilidade, **crédito novo não tem motor de regras**. Não existe nada
cadastrado sobre:

| O que falta | Por que importa |
|---|---|
| **Coeficientes por banco e prazo** | Estão no banco de dados de produção, por ambiente. Não há lista versionada no código, como em `modelos.ts` da portabilidade. |
| **Idade aceita** | Na portabilidade cada banco tem limite (terminar a operação com 74 a 79 anos). No crédito novo não temos nenhum. |
| **Prazos permitidos por banco** | Hoje o prazo é só um campo da tabela, sem validação. |
| **Margem mínima que vale trabalhar** | O atendimento não tem piso para descartar cliente. |
| **Comissão / pontos por banco** | Existe o campo `pontos`, mas sem tradução para remuneração. |
| **Restrição de órgão ou situação funcional** | Nada cadastrado (celetista, estatutário, pensionista, cedido). |

👉 Para fechar isso, o caminho é o mesmo que usamos na portabilidade: o Fábio passa banco
por banco e a gente cadastra, em vez de o sistema chutar.

---

## 4. Prioridade — **[DECIDIR: rascunho para o Fábio aprovar]**

- **ALTA:** margem de 35% livre **e** teto de 70% com folga. Dinheiro novo, sem depender de
  banco aceitar portabilidade e sem saldo devedor a comprar.
- **ALTA também:** cliente que já tem contrato, mas a margem de 35% sobrou o suficiente para
  um contrato novo além do que já existe.
- **MÉDIA:** margem de 35% livre, mas o **teto de 70% aperta** — a margem vendável cai para
  o menor dos dois e o valor fica baixo.
- **BAIXA / não mexer:** margem de 35% zerada, ou teto de 70% estourado. Aí o caminho é
  portabilidade com troco (ver `regua-prioridade-portabilidade.md`) ou compra de cartão
  (ver `regua-prioridade-cartao.md`).

---

## 5. O que o atendimento NÃO afirma

- **Prazo e banco** antes de conferir a tabela ativa — coeficiente muda o valor inteiro.
- **Idade**: não temos limite cadastrado, então não dizer que aceita nem que recusa.
- **Pontos, coeficiente e comissão**, em nenhuma hipótese.
- Margem calculada "de cabeça": sempre pelo contracheque, por causa do teto de 70%.

---

## Perguntas em aberto para o Fábio
1. Quais bancos e coeficientes de crédito novo entram no RAG (pode ser print ou export da
   tela de Tabelas de Coeficientes).
2. Idade aceita por banco — na contratação ou no fim da operação?
3. Prazos permitidos por banco.
4. Margem mínima que vale trabalhar.
5. Comissão por banco e tabela, e como os `pontos` se traduzem nela.
6. Restrição de órgão ou situação funcional.

---

Ver também: `regua-prioridade-cartao.md` e `regua-prioridade-portabilidade.md`.
