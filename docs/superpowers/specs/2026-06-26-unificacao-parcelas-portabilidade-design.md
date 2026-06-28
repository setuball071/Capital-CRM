# Unificação de Parcelas (Portabilidade) — Design

**Data:** 2026-06-26
**Status:** Aprovado (aguardando revisão final da spec)

## Problema

Em portabilidade, cada parcela portada vira uma proposta/digitação separada e conta como produção. Depois de pagar os saldos, o cliente pode **unificar** várias parcelas num **refinanciamento único** (1 ADE de refin, valor acumulado). A partir daí, só a operação unificada deveria contar como produção — mas hoje **todas** contam.

**Gambiarra atual:** o usuário zera manualmente a produção das parcelas unificadas (menos uma), e acumula o valor total + ADE de refin numa só, para que na importação as outras não somem. É trabalhoso, perde os valores originais e é propenso a erro.

## Objetivo

Criar a feature **"Unificar parcelas"**: o usuário seleciona um grupo de propostas do mesmo cliente, escolhe a **acumuladora** e informa o ADE de refin. As demais ficam marcadas como **"Unificada"** — visíveis, com valores preservados, mas **desconsideradas em toda contagem de produção** (operacional E financeiro), sem zerar nada à mão. Reversível.

## Conceito central

Cada proposta absorvida guarda **para qual acumuladora foi unificada** (campo `unificada_em_id`). O sistema NÃO adivinha os grupos — o usuário seleciona os membros em cada unificação, podendo formar vários grupos por cliente (ex.: 101+102 e 103+104; ou 101+102+104 deixando 103 de fora). Toda soma de produção ignora dinamicamente quem tem esse vínculo. Nada é apagado nem zerado.

## 1. Modelo de dados

Em `proposals` (shared/schema.ts + auto-migração idempotente em server/index.ts):
- `unificada_em_id` INTEGER NULL — id da proposta acumuladora. NULL = proposta normal ou acumuladora.
- `valor_pre_unificacao` DECIMAL(12,2) NULL — valor de contrato da acumuladora antes de somar (para desfazer).

A acumuladora continua uma proposta normal (`unificada_em_id` NULL), porém com `ade_refin` preenchido e `contract_value` = total do grupo.

## 2. Backend — endpoints (server/contracts.ts)

**POST `/api/contracts/proposals/:id/unificar`** — `:id` é a acumuladora.
Body: `{ absorverIds: number[], adeRefin: string }`.
- Permissão: `isMaster || role in [master, operacional, coordenacao]` (NÃO corretor comum).
- Valida (tudo do mesmo tenant): a acumuladora não pode estar absorvida; cada `absorverId` deve ter o **mesmo CPF** da acumuladora, não ser a própria, não estar já absorvido nem ser acumuladora de outro grupo; ignora status cancelados/perdidos.
- Ação:
  - `valor_pre_unificacao` = `contract_value` atual da acumuladora (só seta se ainda nulo).
  - `contract_value` da acumuladora += soma dos `contract_value` das absorvidas.
  - `ade_refin` da acumuladora = `adeRefin`.
  - Cada absorvida: `unificada_em_id` = id da acumuladora.
  - Histórico na acumuladora: "Unificadas: #102, #104 (ADE refin X)".

**POST `/api/contracts/proposals/:id/desunificar`** — desfaz.
- Mesma permissão.
- Limpa `unificada_em_id` das filhas; restaura `contract_value` da acumuladora a partir de `valor_pre_unificacao` e zera `valor_pre_unificacao`. Mantém o `ade_refin` (o usuário ajusta se quiser).
- Histórico: "Unificação desfeita".

**GET de propostas** passa a retornar `unificadaEmId`. A ficha da acumuladora lista as filhas (`unificada_em_id = acumuladora.id`).

## 3. Pontos de exclusão da produção (o coração)

**Operacional (lê `proposals`):**
- Caixas da listagem (`contratos-lista.tsx`, soma `prodForPhase`/`prodValueOf`): valor das absorvidas = 0 (exclui `unificadaEmId != null`).
- Relatório de digitação semanal (`/api/metas/digitacao-semanal`): `AND p.unificada_em_id IS NULL` (junto à exclusão de canceladas e de clones já existente).

**Financeiro (lê `producoes_contratos`):** excluir contratos ligados a uma proposta absorvida — por vínculo de proposta (PAGO) ou por ADE (planilha):
```sql
AND NOT EXISTS (
  SELECT 1 FROM proposals pa
  WHERE pa.tenant_id = pc.tenant_id
    AND pa.unificada_em_id IS NOT NULL
    AND (pa.id = pc.proposal_id OR pa.ade = pc.contrato_id)
)
```
Aplicar em: `/api/financeiro/producao`, `/api/dashboard-vendedor`, `/api/dashboard-gestor` (todas as queries de produção sobre `producoes_contratos`).

A produção da acumuladora no financeiro vem naturalmente da linha do **ADE de refin** (PAGO ou planilha); as absorvidas (ADEs de portabilidade) ficam excluídas.

## 4. Interface (contratos-detalhe.tsx + contratos-lista.tsx)

- **Botão "Unificar parcelas"** na ficha (operacional/admin/master), numa proposta que NÃO está absorvida. Abre modal: lista das outras propostas do mesmo CPF (checkboxes) + campo "ADE de refin" + Confirmar.
- **Acumuladora:** seção "Parcelas unificadas" listando as filhas (nº, valor) + botão **"Desfazer unificação"**.
- **Absorvida:** banner "Unificada na #X" (link) + edição/mudança de status bloqueada (é uma parcela absorvida); valores preservados visíveis.
- **Listagem:** badge "Unificada" nas linhas absorvidas.

## 5. Regras / casos de borda

- Só propostas do **mesmo CPF** entram num grupo.
- Sem correntes: uma proposta já absorvida ou já acumuladora não pode ser absorvida noutro grupo.
- Propostas em status cancelado/perdido não entram na seleção.
- Desfazer restaura o valor original da acumuladora a partir de `valor_pre_unificacao`.

## Fora de escopo (YAGNI)

- Detecção automática de grupos (o usuário seleciona manualmente).
- Unificação parcial de valor (sempre soma o `contract_value` cheio das absorvidas).
- Recalcular comissão/repasse da unificação (segue o fluxo normal de PAGO da acumuladora).
