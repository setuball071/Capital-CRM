# SP1 — Planos & Assinaturas (interno) — Design

> Sub-projeto 1 do módulo de comercialização SaaS do Capital CRM. Cobre os itens 1, 2, 3 e 7 da spec de "Ajustes – Módulo de Assinaturas". A **Landing Page pública / self-serve** (itens 4, 5, 6) é o **SP2** e tem spec/plano próprios depois.

## Objetivo

Transformar Assinaturas num módulo interno completo: um **catálogo de planos configuráveis** (modelos), a **assinatura do cliente vinculada a um plano**, **limite de usuários aplicado de verdade**, gestão completa (com histórico de alterações) e a correção do bug de ambientes excluídos aparecendo em selects. Tudo é área do **dono do SaaS** (isMaster) — nenhuma superfície pública.

## Contexto (o que já existe)

- **`planos`** (Fase 1): tabela com `nome, descricao, preco_mensal, ativo` + `plano_modulos` (módulos por plano) + CRUD `/api/admin/planos` (isMaster). **Sem UI.**
- **`subscriptions`** (Fase 4): 1:1 com tenant (`tenant_id` UNIQUE). Hoje `plan` é um **enum fixo** (`SUBSCRIPTION_PLANS` = trial/basico/profissional/expert/enterprise) com preços em `PLAN_PRICES` (centavos, hardcoded em `shared/schema.ts`). Já religada ao Asaas: ativar cria recorrência, suspender/cancelar cortam, webhook renova período + grava `payment_history` (jsonb). Telas `admin-assinaturas.tsx` e `minha-assinatura.tsx` já mostram badge Asaas, adicionais (`assinatura_adicionais`) e histórico de pagamentos.
- **`produtos`** (Fase 3): catálogo de serviços vendáveis (`/api/servicos/produtos`), com cobrança avulsa Asaas e `assinatura_adicionais`.
- **`tenants`** (Fase 5): tem `interno` (ambiente do dono, não paga), `status` (ativo/suspenso/inativo/cancelado/excluido) e `is_active`. Soft delete marca `status='excluido'` + `is_active=false`.

## Decisões de arquitetura (fechadas no brainstorming)

1. **Assinatura aponta para um plano configurável** — o enum fixo sai da lógica/UI; label e preço vêm do plano (`planos`).
2. **1 conta = 1 ambiente** — a assinatura continua no tenant (`subscriptions.tenant_id` segue única). "Quantidade de ambientes" no plano **não vira campo** (é sempre 1).
3. **Limites**: `max_usuarios` é **aplicado** (bloqueia criação acima do teto). "Limites de utilização" genéricos ficam **só armazenados** (JSONB), sem enforcement por ora.
4. **Ciclo**: um plano é mensal **ou** anual (`ciclo`). Precisa dos dois? São dois planos (ex.: "Start Mensal" / "Start Anual").
5. **Serviços** = reaproveitam os `produtos` da Fase 3, via `plano_produtos.incluso` (true=grátis no plano; false=opcional/add-on).

## Modelo de dados

### Alterações em `planos` (boot idempotente, `ALTER ... IF NOT EXISTS`)
```
ADD ciclo         VARCHAR(10) NOT NULL DEFAULT 'mensal'   -- mensal | anual
ADD valor         DECIMAL(10,2) NOT NULL DEFAULT 0        -- unifica com preco_mensal (ver migração)
ADD max_usuarios  INTEGER                                  -- NULL = ilimitado
ADD limites       JSONB DEFAULT '{}'::jsonb                -- limites genéricos, só armazenados
```
- `preco_mensal` já existe; `valor` passa a ser o campo canônico de preço (o `ciclo` diz se é por mês ou por ano). Migração de dados: `UPDATE planos SET valor = preco_mensal WHERE valor = 0 AND preco_mensal > 0`. `preco_mensal` fica como coluna legada (não removida, para não quebrar nada; a UI usa `valor`).
- `plano_modulos` (existe) permanece como está — módulos liberados.

### Nova `plano_produtos`
```
plano_id  INTEGER NOT NULL REFERENCES planos(id) ON DELETE CASCADE
produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE
incluso   BOOLEAN NOT NULL DEFAULT true   -- true = grátis no plano; false = opcional/add-on
PRIMARY KEY (plano_id, produto_id)
```

### Alteração em `subscriptions`
```
ADD plano_id INTEGER REFERENCES planos(id)   -- FK ao plano contratado (nullable durante migração)
```
- O enum `plan` (coluna existente) **não é removido** (evita quebra); passa a ser **derivado/secundário**. Fonte de verdade do plano = `plano_id → planos`. Label/preço/ciclo vêm do join. A sincronização Asaas (Fase 4) passa a ler o **valor do plano** em vez de `PLAN_PRICES`.

### Nova `assinatura_historico`
```
id           SERIAL PK
tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
tipo         VARCHAR(30) NOT NULL     -- criada | plano_alterado | status_alterado | ativada | suspensa | cancelada
descricao    TEXT
por_user_id  INTEGER REFERENCES users(id)
criado_em    TIMESTAMP NOT NULL DEFAULT NOW()
```

### Seed dos planos legados
No boot, se `planos` estiver vazia, semear os 5 planos atuais (trial/basico/profissional/expert/enterprise) como linhas **editáveis** (nome=label PT, valor=PLAN_PRICES/100, ciclo=mensal, ativo=true). Assinaturas existentes: `UPDATE subscriptions s SET plano_id = (SELECT id FROM planos p WHERE lower(p.nome)=lower(<label do enum>)) WHERE plano_id IS NULL`. Só a assinatura interna existe hoje, então é trivial e idempotente.

## Componentes

### Backend (`server/routes.ts`, salvo indicação)
- **Planos CRUD ampliado**: `GET/POST/PUT/DELETE /api/admin/planos` passam a gravar/retornar `ciclo, valor, max_usuarios, limites`, `modulos` (via `plano_modulos`) e `servicos` (via `plano_produtos` com `incluso`). isMaster.
- **Enforcement de usuários**: helper `checarLimiteUsuarios(tenantId)` — busca o plano do tenant (via subscription→plano), conta usuários do tenant (`user_tenants`), retorna se pode criar mais. Chamado na criação de usuário (`POST /api/users` e no fluxo de convite/criação). Ambiente `interno=true` ou sem assinatura → sem limite. Bloqueio → 400 com mensagem clara ("Plano X permite até N usuários").
- **Nova Assinatura por plano**: `POST /api/admin/subscriptions` passa a aceitar `planoId` (Select de planos) em vez do enum; grava `plano_id` e deriva `plan` do plano. `PATCH .../:tenantId` idem para troca de plano. Toda mudança de plano/status grava em `assinatura_historico`.
- **Histórico**: `GET /api/admin/subscriptions/:tenantId/historico` → linhas de `assinatura_historico`.
- **GETs de assinatura** (`/api/admin/subscriptions`, `/api/subscription`) passam a trazer o plano resolvido (nome, ciclo, valor, max_usuarios) via join.
- **Fix excluídos**: helper central (ex.: `SQL de tenants selecionáveis` = `status <> 'excluido' AND is_active = true`) aplicado em `/api/admin/tenants-without-subscription` e em qualquer select de ambiente das telas de assinatura/cobrança.

### Frontend
- **Nova tela `client/src/pages/admin-planos.tsx`** (rota `/admin/planos`, MasterRoute): lista de planos + Dialog de criar/editar com todos os campos (nome, descrição, ciclo, valor, max_usuarios, limites como campos simples, checkboxes de módulos do catálogo, seleção de produtos com toggle incluso/opcional, ativo). Item de menu "Planos" na Administração.
- **`admin-assinaturas.tsx`**: "Nova Assinatura" vira Select de **plano** (não enum); preço/ciclo vêm do plano; adiciona coluna Plano e a aba/dialog "Histórico de alterações" (lê `/historico`). Remove os hardcodes de `PLAN_PRICES`/`PLAN_LABELS` de exibição (passam a vir do plano).
- **`minha-assinatura.tsx`**: mostra o plano contratado (nome/ciclo/valor do catálogo) e os serviços inclusos do plano.

## Fluxo de dados

1. Dono cadastra planos em `/admin/planos` (módulos + serviços inclusos/opcionais + limite de usuários).
2. Em Assinaturas, dono cria a assinatura de um ambiente escolhendo um **plano**; grava `plano_id`, deriva módulos ativos do ambiente (`tenant_modulos` = módulos do plano), e liga a recorrência Asaas com o `valor` do plano (fluxo Fase 4).
3. Ao criar usuários no ambiente, o sistema aplica `max_usuarios` do plano.
4. Toda alteração de plano/status entra em `assinatura_historico`; a tela mostra o histórico.
5. Ambientes excluídos somem de todos os selects.

## Tratamento de erros
- Enforcement de usuários: 400 com mensagem amigável; a UI de criar usuário mostra o aviso e não fecha o form.
- Plano sem `valor` (ex.: enterprise "sob consulta", `valor=0`): assinatura pode ser criada, mas a recorrência Asaas é pulada com `asaasWarning` (comportamento Fase 4 já existente).
- Excluir plano em uso: bloquear (400 "há assinaturas usando este plano") ou apenas desativar — **bloquear exclusão** se houver `subscriptions.plano_id` apontando; permitir inativar.

## Verificação
Repo sem suíte de testes automatizada. Verificação por **`npm run build` + deploy (push `migracao-cloudfy`) + conferência manual**:
- Cadastrar um plano com módulos + serviços + limite de 2 usuários.
- Criar assinatura de um ambiente de teste com esse plano; conferir módulos aplicados.
- Criar 3 usuários no ambiente → o 3º é bloqueado com aviso do limite.
- Trocar o plano da assinatura → histórico de alterações registra.
- Excluir (soft) um ambiente → ele some do Select de nova assinatura.
- Build passa; deploy verde.

## Sucesso
- Planos configuráveis com CRUD e tela.
- Assinatura referencia plano (enum aposentado da lógica/UI).
- Limite de usuários aplicado.
- Gestão com plano, ambiente, vencimento, situação, adicionais, histórico de pagamentos e de alterações.
- Nenhum ambiente excluído aparece em qualquer select.

## Fora de escopo (SP2)
Landing page pública, link de pagamento por plano, checkout self-serve, provisionamento disparado por pagamento, aprovação do Master no fluxo público.
