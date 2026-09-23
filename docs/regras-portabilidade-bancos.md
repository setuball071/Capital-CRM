# Regras de portabilidade por banco — SIAPE

Consolidado das três fontes que o Fábio mandou em 22/09/2026, para irmos banco a banco
cadastrando no simulador (Administração → Bancos e Regras).

| Fonte | O que é | Bancos |
|---|---|---|
| **Comparativo Bevi** (imagem, atualizado 18/09/2026) | tabela comparativa | BRB Financeira, Paraná, Safra, Digio, Facta, Daycoval, Quero+Crédito, C6 Consig, Banrisul, Mais |
| **Resumo Portabilidade SIAPE** (PDF, atualizado 08/06/2026) | 1 página por banco | BRB Consig360, BRB Banco de Brasília, Daycoval, Inter, Safra Financeira, Paraná, PicPay (suspenso), C6 Consig, Facta |
| **REGRAS PORT BRB** (Word) | anotações da casa | BRB e Safra |

⚠️ As fontes têm **datas diferentes** e em alguns pontos **se contradizem** (marcado com ❓ abaixo).
Antes de cadastrar cada banco, o Fábio confirma qual vale.

---

## Situação de cada banco no sistema hoje

| Banco | Cadastrado? | O que falta |
|---|---|---|
| PAN | ✅ regras + taxa refin 1,70% + comissão 0,75% | prazo do refin é escolhido na tela |
| Inter | ❌ | regras de aceite, comissão por tabela, prazo do refin |
| Demais 9 | ❌ | tudo |

---

## 1. BRB (duas entidades diferentes)

O PDF tem **duas páginas de BRB**: "BRB Consig360" e "BRB Banco de Brasília". O comparativo
Bevi mostra "Financeira BRB — **suspenso até 27/09**". O Word é das anotações da casa.

| Critério | BRB Consig360 (PDF) | BRB Banco de Brasília (PDF) | Word (casa) |
|---|---|---|---|
| Idade | 18 a 69 anos; fim da operação até 74 | 18 a 69; fim até 74 | estatutário até 64, celetista até 58 ❓ |
| Celetista | 18 a 64 anos 11m 29d; fim até 68 | igual | — |
| Saldo mínimo | R$ 4.000,01 | R$ 4.000,01 | R$ 4.000,00 |
| Troco mínimo | R$ 100,00 | R$ 100,00 | R$ 50,00 (refin da port) ❓ |
| Parcela mínima | R$ 25,00 | R$ 25,00 | — |
| Taxa de entrada | — | — | **não tem**; refin obrigatório p/ comissionar |
| Não porta | BRB, PicPay, Agibank, C6/C6 Consig, Pine, Inbursa | PicPay, Agibank, BRB, C6 e C6 Consig | C6 Bank, C6 Consig, Agibank, PicPay, BRB CFI |
| Pagas | Pan 12 · Mercantil rede 1 · Mercantil corresp. 12 · Inter 1 · QI 1 · rede 1 · demais 12 | Pan **25** ❓ · Mercantil rede 1 · corresp. 12 · Inter 1 · QI 1 · rede 1 · demais 12 | 1 paga: BB, Itaú, Caixa, Bradesco, Sicoob, Alfa, Alfa Financeira, Nu Financeira, Inter, QI, Mercantil, Santander (20/30/40), Daycoval · demais 12 **+ 360 dias de averbação** |
| Reduz negativo / agrega margem | reduz: sim | agrega margem: sim; unifica no refin: sim | — |
| Port pura | não | não | — |
| Saldo | automático pelo banco (até 16h15) | precisa atuar (até 17h) | — |

**Só do Word (não está no PDF):**
- **Convênios SIAPE suspensos:** Amazônia Azul, CBTU, EBSERH, EBC, EPL, Trensurb, FUNAI,
  HC Porto Alegre, INB, IPHAN, NUCLEP, Presidência da República, Telebrás, UFV, Valec.
- **Público-alvo:** ativo permanente, aposentado, pensão vitalícia, reserva/reforma,
  celetista/empregado, cedido (só refin), ativo para outro órgão.
- **Não faz:** cedido SUS nem pensionista temporário. Não aceita e-mail funcional no cadastro.

❓ **Perguntas:** as duas páginas são a mesma empresa? Qual é a atual: Word ou PDF?
O "suspenso até 27/09" do Bevi já venceu?

---

## 2. Safra Financeira

| Critério | PDF (08/06) | Word (casa) |
|---|---|---|
| Idade | 21 a 78 anos 11m 29d | até 66 anos, ou terminar com 78 ❓ |
| Saldo de port mínimo | R$ 800,00 | R$ 800,00 |
| Troco mínimo | R$ 500,00 | R$ 500,00 |
| Taxa de entrada | — | **1,20%** |
| Taxa do refin por faixa | 1,55% até 20k · 1,65% até 10k (troco + saldo) | 1,65% 10k · **1,59%** 20k ❓ |
| Não porta | Daycoval, Inbursa | Daycoval, Inbursa e **Alfa** |
| Pagas | Banrisul 12 · Facta 24 · Pan 25 · C6 25 · rede 0 · demais 12 | rede 0 · Facta 24 · C6 **18** ❓ · Pan **15** ❓ · demais autorregulação |
| Outros | trava no STOP até o saldo voltar; saldo só pago após liberação; atuação até 12h; não unifica; port pura não | banco tem cálculo próprio de viabilidade: digitar com o saldo mais novo possível |

**Público-alvo (Word):** ativo permanente, inativo/aposentado, aposentado TCU 733/94, ativo em
outro órgão, ativo perm. L. 8.878/94, reforma e reserva (bombeiro/PM/polícia civil),
beneficiário de pensão e pensionista, **pensionista temporário sem data fim só feminino**,
pensionista vitalício. **Não atende** ex-territórios (Amapá, Roraima, Rondônia e demais).

Bevi: taxa mínima port **1,20** · parcela mínima "saldo mín. 10.000" · mínimo liberado R$ 800 ·
taxa mínima refin da port **1,59** · não unifica · abate negativo no refin da port · faz cálculo manual.

---

## 3. Daycoval (PDF pág. 3)

- **Idade:** 18 a 75 anos 11m 29d · **reduz negativo:** sim · **agrega margem:** não
- **Parcela mínima** R$ 20,00 · **troco mínimo** R$ 100,00
- **Não porta:** C6, Safra e Alfa
- **Pagas:** Facta 24 · Inbursa 13 · Agibank 15 · Pan 25 · Itaú 12 · BRB 0 · Pine 0 · QI 0 · NBC 24 · rede 6 · demais 12
- **Ajuste de tabela:** permite · saldo precisa de atuação, até 16h50 · port pura: não
- Bevi: taxa mínima port **1,36** · taxa mínima refin **1,55** · parcela mínima R$ 20 ·
  mínimo liberado R$ 100 · valida só a margem negativa · unifica e abate negativo no refin da port

## 4. Inter (PDF pág. 4)

- **Idade:** 21 a 79 anos e 11 meses completos · **agrega margem:** não · **margem negativa:** sim
- **Saldo devedor mínimo** R$ 1.000,00 · **mínimo liberado** R$ 300,00
- **Não porta:** Facta e Master
- **Pagas:** em branco no PDF ❓ (a nossa Viabilidade Inter trabalha com 0 pagas)
- **Ajuste de tabela:** quando o saldo chega dá para escolher normal, flex 1 ou flex 2
- **Formalização:** contrato da port + nuvídeo quando o saldo chega + novo contrato no refin

## 5. Paraná Banco (PDF pág. 6)

- **Idade:** 18 a 77 anos 11m 29d · **agrega margem:** não · **margem negativa:** sim ·
  **unifica parcela:** sim · **port pura: sim** (único da lista)
- **Parcela mínima** R$ 200,00 · **sem saldo mínimo** · **liberado no refin da port** R$ 100,00
- **Não porta:** Bari, Facta, Mercantil (389 e 926)
- **Pagas:** Agibank 13 · C6 25 · Pan 25 · rede 0 · Inbursa 13 · demais 12
- Bevi: taxa mínima port **1,00** · taxa mínima refin **1,60** · faz cálculo manual se tiver
  comissão, abono ou gratificação no contracheque

## 6. PicPay — **SUSPENSO** (PDF pág. 7)

- Idade 21 a 70 · não reduz negativo · agrega margem: sim · parcela mínima R$ 25 ·
  mínimo liberado R$ 500 · não porta Inbursa e BRB · pagas: Pan 25 · C6 25 · rede 0 · demais 12
- ❓ Cadastrar já inativo, ou deixar fora por enquanto?

## 7. C6 Consig (PDF pág. 8)

- **Idade:** 21 a 77 anos · **agrega margem:** não · **margem negativa:** sim · **não unifica**
- **Saldo mínimo** R$ 2.000,00 · **valor liberado:** o **menor** entre R$ 200,00 e 5% do financiado ⚠️ regra nova para o motor
- **Não porta:** Daycoval, Agibank, Inbursa, Safra e BRB
- **Pagas:** Paraná 13 · QI 13 (só os iniciados com BYX) ⚠️ · Pan 37 · Facta 13 · rede 0 · demais 12
- **Ajuste de tabela:** sim · saldo precisa de atuação, até 16h
- Bevi: taxa mínima port **1,60** · taxa mínima refin **1,65** · "não, ticket mínimo" na parcela ·
  mínimo liberado 100 ❓ (o PDF diz 200/5%)

## 8. Facta Financeira (PDF pág. 9)

- **Idade:** 22 a 74 anos 11m 29d · **margem negativa:** sim · **não unifica**
- **Parcela mínima** R$ 50,00 · **saldo mínimo** R$ 2.000,00 · **valor liberado** R$ 50,00 ❓
  (Bevi diz R$ 2.000,00 de mínimo liberado no refin da port)
- **Não porta:** Paulista e Zema **quando o contrato foi originado pela Facta** ⚠️ regra nova ·
  Inbursa · Pine · Socicred 917
- **Pagas:** Agibank 15 · Paraná 15 · BMG 12 · Santander/Olé 12 · C6 25 · Daycoval 24 · Pan 30 · **demais 0**
- **Aceita CNH vencida** · ajuste de tabela: sim · saldo seg–qui até 16h, sexta até 15h
- Bevi: cálculo automático · sem taxa ponderada · sem parcela mínima

## 9. Digio (só no Bevi)

- Idade 18 a 79 anos 11m 29d · taxa ponderada: sim · **taxa mínima port 1,39** ·
  **taxa mínima refin 1,65** · saldo mínimo R$ 6.000 · mínimo liberado R$ 250 ·
  não unifica · não abate negativo · não agrega margem · sem simulador · formalização figital
- ⚠️ Já existe no cadastro ANTIGO do simulador (entrada 1,35 · refin 1,65 · saldo mín 5.500 ·
  troco mín 250 · 12 pagas) ❓ qual vale?

## 10. Quero+Crédito (só no Bevi)

- Idade 18 a 77 anos 11m 29d · taxa ponderada: sim · **taxa mínima port 1,38** ·
  **taxa mínima refin 1,55** · parcela mínima R$ 20 · mínimo liberado R$ 100 ·
  unifica e abate negativo no refin da port · não faz cálculo manual

## 11. Banrisul (só no Bevi)

- Idade 18 a 73 anos · taxa ponderada: sim · **taxa mínima port 1,50** ·
  **taxa mínima refin 1,75** · parcela mínima R$ 8,00 · mínimo liberado R$ 300 ·
  não faz cálculo manual · sem dados de unifica/abate/agrega

## 12. Mais (Bevi)

- Idade 18 a 80 anos · sem taxa ponderada · **taxa mínima port 1,73** · sem taxa de refin ·
  sem parcela mínima · sem mínimo liberado · unifica, abate negativo e agrega margem **na renovação**

---

## O que o motor já entende (pode cadastrar hoje)

- taxa mínima de entrada (taxa do contrato atual)
- saldo mínimo e máximo por contrato
- troco mínimo por contrato
- lista "não porta" e parcelas pagas por banco de origem (+ padrão "demais bancos")
- situação funcional aceita (códigos SIAPE)
- pensionista (vitalício/temporário, folga de meses, idade mínima)
- alertas de formalização (analfabeto, impossibilitado de assinar, lei estadual de idoso)
- taxa do refin e comissão (% sobre o saldo devedor)
- entidades fora da CIP e "não porta o próprio banco" (regra geral, já valendo)

## O que precisa de campo novo no motor

1. **Idade do cliente:** mínima e máxima (quase todos têm) — hoje a idade só é usada para pensionista.
2. **Idade no fim da operação** (BRB: fim até 74; Safra: "terminar com 78") — depende do prazo escolhido.
3. **Regra diferente para celetista** (BRB: 64 anos, fim em 68).
4. **Parcela mínima** do contrato novo (R$ 8 a R$ 200 conforme o banco).
5. **Mínimo liberado em fórmula** (C6: menor entre R$ 200 e 5% do financiado).
6. **Taxa do refin por faixa de valor** (Safra: 1,55% até 20k, 1,65% até 10k).
7. **Órgão/convênio suspenso** (lista do BRB) — precisa do órgão do cliente, que o extrato traz.
8. **Prazo de averbação do contrato de origem** (BRB: 360 dias para os "demais bancos").
9. **Regra por origem + condição** (C6: QI só com contrato iniciado em BYX; Facta: Paulista e
   Zema só quando originados pela Facta).
10. **Marcadores informativos** (port pura, unifica, agrega margem, abate negativo, retenção,
    ajuste de tabela, horário de atuação do saldo, documentos aceitos): não decidem elegibilidade,
    mas ajudam quem está digitando.

## Perguntas antes de começar

1. Quando PDF e Word divergirem, qual manda? (Word parece mais novo para BRB e Safra.)
2. BRB Consig360 e BRB Banco de Brasília são cadastros separados?
3. Bancos suspensos (PicPay, BRB Financeira) entram já desativados?
4. Para cada banco ainda falta o principal para o cálculo: **taxa do refin, prazo do refin e a
   comissão (% sobre o saldo)**. O Bevi traz a "taxa mínima refin da port", que não é
   necessariamente a taxa que vocês usam.
