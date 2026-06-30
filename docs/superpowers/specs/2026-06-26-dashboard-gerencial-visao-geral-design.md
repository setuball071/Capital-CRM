# Dashboard Gerencial — Base + Aba 1 (Visão Geral)

**Data:** 2026-06-26
**Status:** Design aprovado (Fábio aprovou o desenho da base + Aba 1 em conversa; revisão do spec escrito pendente — ele delegou "siga com todas as etapas").
**Escopo deste spec:** apenas a **base reutilizável** + a **Aba 1 (Visão Geral)**. As abas 2–7 são fases futuras (cada uma com seu próprio spec).

---

## 1. Contexto e objetivo

Criar um **Dashboard Gerencial exclusivo para usuário Master** na área já existente
**Gestão Comercial → "Dashboard da Empresa"** (`/vendas/gestao-comercial/dashboard`),
hoje vazia ("Painel de indicadores da empresa em desenvolvimento").

A visão completa do Fábio tem **7 abas** (Visão Geral, Performance Comercial,
Portabilidades, Perfil dos Clientes, Gestão Operacional, Inteligência Comercial,
DNA do Corretor) com ~100+ indicadores, filtros globais, drill-down, score do
corretor e insights automáticos. É um projeto grande → **construído uma aba por vez**.

Este spec entrega a **fundação** (acesso, filtros, drill-down, layout de abas) +
a **primeira aba (Visão Geral)**, 100% viável com os dados atuais.

## 2. Decisões já tomadas (com o Fábio)

- **Ponto de partida:** Aba 1 (Visão Geral) + base reutilizável.
- **Fonte da produção:** tabela **`proposals`** (pipeline operacional), NÃO
  `producoes_contratos`. Reflete o trabalho da equipe no CRM e conecta com
  corretor/parceiro/status.
- **Definição de produção (dois recortes):**
  - **Produção paga:** propostas com `status = 'PAGO'`, contabilizadas pela
    **data de pagamento** (`paidAt`).
  - **Cadastro/entrada:** todas as propostas, pela **data de cadastro** (`createdAt`).
  - **Conversão %:** produção paga ÷ cadastrado.
- **Acesso:** somente Master.

## 3. Viabilidade de dados (resumo da investigação)

Aba 1 é **100% viável** com `proposals`:
`contractValue`, `product`, `bank`, `clientConvenio`, `vendorId` (corretor),
`parceiroId`, `status`, `createdAt`, `paidAt` — todos existem em `shared/schema.ts`
(tabela `proposals`, ~linha 3459).

Filtros **deferidos** (dado ainda fraco, fora do v1): Operador (derivar de
`proposal_history`), Subconvênio, Estado (join cliente por CPF).

## 4. Arquitetura

### 4.1 Acesso (base)
- A página de dashboard passa a renderizar um **container de abas**.
- Visível **somente para `user.isMaster === true`**. Reaproveita o middleware
  `requireMaster` já existente (`server/routes.ts` ~linha 896). Usuário não-Master
  não vê o item/rota (ou recebe 403 no endpoint).

### 4.2 Filtros globais (base)
Barra de filtros no topo, aplicada à aba ativa. **Conjunto v1:**
- **Período** — presets (mês atual, mês anterior, últimos 30d, últimos 90d, custom).
- **Banco**, **Produto**, **Convênio**, **Corretor**, **Parceiro** (multi-select,
  opções carregadas de valores distintos em `proposals` do tenant).
- Estado dos filtros refletido na **URL** (compartilhável) e mantido ao navegar
  entre abas.
- **Deferidos** (não no v1): Operador, Subconvênio, Estado.

### 4.3 Drill-down (base)
- Todo gráfico/indicador é **clicável**. Ao clicar, abre um painel/modal com a
  **lista das propostas** que compõem aquele número, respeitando os filtros ativos
  + a dimensão clicada (ex.: clicar na fatia "Banco X" → propostas do banco X).
- Colunas da lista: cliente, CPF, corretor, banco, produto, convênio, valor,
  data (cadastro/pagamento), status.
- Lista **exportável em CSV** (mesmo padrão BR já usado no projeto).

### 4.4 Backend
- **`GET /api/gestao-comercial/dashboard/visao-geral`** (protegido por Master) —
  recebe os filtros por query string e retorna, em **uma chamada**:
  - KPIs: produção paga (R$, qtd), ticket médio, cadastrado (R$, qtd), conversão %.
  - Comparativo: mesmos KPIs do **período anterior equivalente** (para ▲▼).
  - Série temporal: produção paga × cadastrado por granularidade (dia/semana/mês).
  - Quebras (Top N + "outros"): por produto, por banco, por convênio.
- **`GET /api/gestao-comercial/dashboard/visao-geral/drill`** — recebe filtros +
  `dim` (produto|banco|convenio|periodo) + `valor`, retorna a **lista detalhada**
  de propostas para o drill-down/export.
- Agregação via **SQL ao vivo** sobre `proposals` do tenant. Volume operacional é
  baixo (milhares de linhas) → não precisa de cache/materialização agora.
- **Multi-tenant:** todas as queries filtram por `tenantId` do usuário.

### 4.5 Frontend
- `client/src/pages/.../dashboard.tsx` (gestao-comercial) vira um **container de abas**
  (7 abas). Apenas a **Aba 1** implementada; abas 2–7 como **placeholders**
  ("Em desenvolvimento") — navegação já pronta.
- Componentes reutilizáveis: `<DashboardFilters>`, `<KpiCard>`, `<DrillChart>`
  (wrapper de Recharts que dispara o drill-down), `<DrillDownPanel>`.
- Gráficos com **Recharts** (já usado no projeto, ex.: `coefficient-tables`).
- Dados via React Query (padrão do projeto).

## 5. Layout da Aba 1 (Visão Geral)
1. **Barra de filtros globais** (topo).
2. **Linha de KPIs** (cards com comparativo ▲▼ vs período anterior):
   Produção paga (R$ + qtd) · Ticket médio · Cadastrado (R$ + qtd) · Conversão %.
3. **Evolução temporal:** linha/barra de produção paga × cadastrado, com toggle
   de granularidade (dia/semana/mês).
4. **Quebras (Top N):** produção por Produto · por Banco · por Convênio
   (gráficos clicáveis → drill-down).

## 6. Componentes e responsabilidades (isolamento)
- **`<DashboardFilters>`** — controla estado dos filtros + URL. Entrada: opções
  disponíveis; Saída: objeto de filtros. Não conhece indicadores.
- **`<KpiCard>`** — exibe um valor + comparativo. Puro/apresentacional.
- **`<DrillChart>`** — recebe dados + dimensão; renderiza gráfico Recharts e emite
  evento de clique (dimensão+valor) para abrir o drill.
- **`<DrillDownPanel>`** — recebe filtros+dim+valor, busca a lista detalhada e
  exibe/exporta. Reutilizável por todas as abas.
- **Endpoint visão-geral** — só agrega; não sabe de UI.
- **Endpoint drill** — só lista; reutilizável.

## 7. Tratamento de erros
- Endpoint sem permissão Master → 403.
- Sem dados no período → estados vazios claros ("Sem produção no período").
- Falha de query → 500 com mensagem genérica + log no servidor (padrão do projeto).
- Filtros inválidos → ignora/normaliza, não quebra.

## 8. Testes / verificação
- Conferir KPIs contra uma consulta SQL manual em `proposals` (amostra de período).
- Conversão = pago/cadastrado bate com contagens.
- Drill-down: soma das linhas detalhadas = valor do indicador clicado.
- Acesso: usuário não-Master recebe 403 / não vê a aba.

## 9. Fora de escopo (fases futuras)
- Abas 2–7 (cada uma seu spec).
- Filtros Operador, Subconvênio, Estado.
- Rastreamento de portabilidade (CIP/saldo/efetividade), sexo do cliente, motivo de
  perda estruturado, link lead→proposta — dependências de dados a capturar.

## 10. Deploy
- Implementação numa branch; **deploy via push para `migracao-cloudfy`** (Railway
  publica sozinho) — **somente quando a importação em andamento terminar** e com o
  Fábio ciente (um deploy reinicia o app).
