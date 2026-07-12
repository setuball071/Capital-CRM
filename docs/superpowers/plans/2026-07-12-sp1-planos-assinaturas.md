# SP1 — Planos & Assinaturas (interno) — Plano de Implementação

> **✅ EXECUTADO E DEPLOYADO (12/07/2026).** 7/7 tarefas na branch migracao-cloudfy. Commits: t1 `b785add`, t2 `997add9`, t3 `97aae9a`, t4+t5 `c46a262`, t6 `f0e9a62`, t7 `139f4df`. Verificação = build verde em cada tarefa; conferência manual no app pendente do Fábio. SP2 (landing page/self-serve) fica pra depois.

> **Para o executor:** implemente **tarefa por tarefa, na ordem** (há dependências). Cada tarefa termina em `npm run build` verde + commit. Este repo **NÃO tem suíte de testes** — a verificação é build + deploy (`git push origin migracao-cloudfy`) + conferência manual no app. NÃO invente framework de teste. Marque os `- [ ]`.

**Goal:** Assinaturas viram um módulo interno completo: catálogo de planos configuráveis, assinatura vinculada a um plano, limite de usuários aplicado, gestão com histórico, e fix dos ambientes excluídos em selects.

**Architecture:** Monolito TS (React/Vite + Express + Drizzle/Postgres-Supabase). Migrações no bloco idempotente de boot (`server/index.ts`). Assinatura (1:1 tenant) passa a referenciar `planos.plano_id`; enum `plan` vira derivado. Enforcement de usuários por ambiente. Tudo isMaster.

**Tech Stack:** React 18, Wouter, TanStack Query, shadcn/ui, Express, Drizzle, PostgreSQL, Asaas.

## Global Constraints
- Deploy: push em `migracao-cloudfy` → Railway builda/sobe sozinho. Nunca Replit/Vercel.
- Migração nova = bloco idempotente em `server/index.ts` (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`) + espelho conceitual no `shared/schema.ts`.
- isMaster = dono do SaaS (endpoints admin usam `requireMaster` ou checagem `req.user?.isMaster`).
- `apiRequest(method,url,body?)` no front retorna `Response` → usar `await res.json()`.
- Design Capital Go: roxo `#6C2BD9`, Inter, ícones Material (`MatIcon`)/lucide como as telas vizinhas.
- 1 conta = 1 ambiente; assinatura fica no tenant. `max_usuarios` aplicado; limites genéricos só armazenados. Plano é mensal OU anual (ciclo). Serviços = `produtos` (Fase 3) via `plano_produtos.incluso`.

---

## Task 1 — Migrações de banco + schema

**Files:** `server/index.ts` (bloco boot Admin SaaS), `shared/schema.ts`.

- [ ] **1.1** `shared/schema.ts` na tabela `planos` (se declarada) — como `planos` foi criada só via SQL no boot (não há pgTable), NÃO precisa mexer no Drizzle para ela. Em `subscriptions` (pgTable existente) adicionar a coluna:
```ts
planoId: integer("plano_id"), // FK -> planos.id (fonte de verdade do plano contratado)
```
- [ ] **1.2** `server/index.ts`, dentro do bloco `===== ADMIN SAAS`, após a criação de `planos`/`plano_modulos`, adicionar:
```ts
await saasDb.execute(saasSql`
  ALTER TABLE planos
    ADD COLUMN IF NOT EXISTS ciclo VARCHAR(10) NOT NULL DEFAULT 'mensal',
    ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_usuarios INTEGER,
    ADD COLUMN IF NOT EXISTS limites JSONB DEFAULT '{}'::jsonb
`);
await saasDb.execute(saasSql`UPDATE planos SET valor = preco_mensal WHERE valor = 0 AND preco_mensal > 0`);
await saasDb.execute(saasSql`
  CREATE TABLE IF NOT EXISTS plano_produtos (
    plano_id   INTEGER NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    incluso    BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (plano_id, produto_id)
  )
`);
await saasDb.execute(saasSql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plano_id INTEGER REFERENCES planos(id)`);
await saasDb.execute(saasSql`
  CREATE TABLE IF NOT EXISTS assinatura_historico (
    id          SERIAL PRIMARY KEY,
    tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo        VARCHAR(30) NOT NULL,
    descricao   TEXT,
    por_user_id INTEGER REFERENCES users(id),
    criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);
await saasDb.execute(saasSql`CREATE INDEX IF NOT EXISTS idx_assinatura_hist_tenant ON assinatura_historico(tenant_id)`);
```
- [ ] **1.3** Seed dos planos legados (mesmo bloco, idempotente — só semeia se `planos` vazia). Usa os 5 do enum:
```ts
const planosCount = (await saasDb.execute(saasSql`SELECT COUNT(*)::int AS n FROM planos`)).rows[0] as any;
if (Number(planosCount.n) === 0) {
  const seed = [
    ["Trial", 0], ["Básico", 127], ["Profissional", 197], ["Expert", 277], ["Enterprise", 0],
  ];
  for (const [nome, valor] of seed) {
    await saasDb.execute(saasSql`INSERT INTO planos (nome, valor, preco_mensal, ciclo, ativo) VALUES (${nome}, ${valor}, ${valor}, 'mensal', true)`);
  }
}
await saasDb.execute(saasSql`
  UPDATE subscriptions s SET plano_id = p.id
  FROM planos p
  WHERE s.plano_id IS NULL AND (
    lower(p.nome) = lower(s.plan)
    OR (s.plan = 'basico' AND p.nome = 'Básico')
    OR (s.plan = 'profissional' AND p.nome = 'Profissional')
  )
`);
```
- [ ] **1.4** `npm run build` → verde. Commit: `feat(assinaturas): SP1 t1 - schema planos ampliado, plano_produtos, subscriptions.plano_id, assinatura_historico, seed`.

**Produz:** colunas `planos.ciclo/valor/max_usuarios/limites`, tabela `plano_produtos(plano_id,produto_id,incluso)`, `subscriptions.plano_id`, tabela `assinatura_historico(tenant_id,tipo,descricao,por_user_id,criado_em)`.

---

## Task 2 — Planos CRUD ampliado (backend)

**Files:** `server/routes.ts` (bloco `/api/admin/planos` da Fase 1).

**Consome:** tabelas da Task 1.

- [ ] **2.1** `GET /api/admin/planos` — expandir o SELECT para trazer `ciclo, valor, max_usuarios, limites`, os módulos (já faz via `plano_modulos`) e os serviços:
```ts
const servRows = await db.execute(sql`SELECT plano_id, produto_id, incluso FROM plano_produtos`);
const servicosPorPlano: Record<number, any[]> = {};
for (const s of servRows.rows as any[]) (servicosPorPlano[s.plano_id] ||= []).push({ produtoId: s.produto_id, incluso: s.incluso });
// no map final: { ...p, modulos: [...], servicos: servicosPorPlano[p.id] || [] }
```
- [ ] **2.2** `POST /api/admin/planos` — aceitar `{ nome, descricao, ciclo, valor, maxUsuarios, limites, modulos: string[], servicos: {produtoId, incluso}[] }`. Validar `ciclo ∈ {mensal,anual}` (default mensal), `valor >= 0`. Inserir em `planos` (gravar `valor` e também `preco_mensal = valor` para compat), depois popular `plano_modulos` e `plano_produtos`.
- [ ] **2.3** `PUT /api/admin/planos/:id` — atualizar os campos novos; substituir `plano_modulos` e `plano_produtos` (DELETE + re-INSERT) quando enviados.
- [ ] **2.4** `DELETE /api/admin/planos/:id` — **bloquear** se houver assinatura usando: `SELECT 1 FROM subscriptions WHERE plano_id = :id` → se existir, `400 { message: "Há assinaturas usando este plano. Inative-o em vez de excluir." }`. Senão, DELETE (cascade limpa `plano_modulos`/`plano_produtos`).
- [ ] **2.5** `npm run build` verde. Commit: `feat(assinaturas): SP1 t2 - CRUD de planos com ciclo/valor/limite/modulos/servicos`.

**Produz:** endpoints de planos aceitando/retornando `ciclo, valor, maxUsuarios, limites, modulos, servicos`.

---

## Task 3 — Assinatura vinculada a plano + histórico + Asaas por valor do plano (backend)

**Files:** `server/routes.ts` (bloco ASSINATURAS ~30259 e o helper `sincronizarAssinaturaAsaas`).

**Consome:** `subscriptions.plano_id`, `planos.valor`, `assinatura_historico`.

- [ ] **3.1** Helper de histórico (perto do bloco ASSINATURAS):
```ts
async function registrarHistoricoAssinatura(tenantId: number, tipo: string, descricao: string, userId?: number) {
  await db.execute(sql`INSERT INTO assinatura_historico (tenant_id, tipo, descricao, por_user_id) VALUES (${tenantId}, ${tipo}, ${descricao}, ${userId ?? null})`);
}
```
- [ ] **3.2** `POST /api/admin/subscriptions` — aceitar `planoId` (além de manter compat com `plan` string). Se vier `planoId`, buscar o plano e derivar `plan = lower(nome)`, gravar `plano_id`. Registrar histórico `tipo='criada'`. Aplicar `tenant_modulos` = módulos do plano (INSERT em `tenant_modulos` a partir de `plano_modulos`, com ON CONFLICT DO UPDATE ativo=true).
- [ ] **3.3** `PATCH /api/admin/subscriptions/:tenantId` — aceitar `planoId`; se mudou, registrar histórico `tipo='plano_alterado'` com descrição "de X para Y" e re-aplicar `tenant_modulos`. Mudança de status registra `tipo='status_alterado'`.
- [ ] **3.4** `sincronizarAssinaturaAsaas` — trocar a leitura de preço de `PLAN_PRICES` para o **valor do plano**: `SELECT p.valor, p.nome FROM subscriptions s JOIN planos p ON p.id = s.plano_id WHERE s.tenant_id = :id`. Se `valor <= 0` → warning "plano sem preço fixo" (mantém o comportamento). Ciclo: se `ciclo='anual'`, `createSubscription` deve usar cycle anual — adicionar parâmetro `cycle` opcional em `server/asaas.ts` `createSubscription` (default MONTHLY, aceitar YEARLY).
- [ ] **3.5** GETs `/api/admin/subscriptions` e `/api/subscription` — juntar o plano: `LEFT JOIN planos p ON p.id = s.plano_id`, retornar `plano_nome, plano_valor, plano_ciclo, plano_max_usuarios`.
- [ ] **3.6** `GET /api/admin/subscriptions/:tenantId/historico` (requireMaster) → `SELECT h.*, u.name AS por_nome FROM assinatura_historico h LEFT JOIN users u ON u.id = h.por_user_id WHERE h.tenant_id = :id ORDER BY h.criado_em DESC`.
- [ ] **3.7** `npm run build` verde. Commit: `feat(assinaturas): SP1 t3 - assinatura por plano, historico de alteracoes, Asaas usa valor/ciclo do plano`.

**Produz:** assinatura referencia plano; `registrarHistoricoAssinatura`; endpoint `/historico`; Asaas por valor/ciclo do plano; `createSubscription({..., cycle?})`.

---

## Task 4 — Enforcement de limite de usuários (backend)

**Files:** `server/routes.ts` (helper + fluxo de criação de usuário, `POST /api/users` ~criação, e `POST /api/auth/register`/convite se houver).

**Consome:** `planos.max_usuarios`, `subscriptions.plano_id`.

- [ ] **4.1** Helper:
```ts
async function checarLimiteUsuarios(tenantId: number): Promise<{ ok: boolean; limite?: number; atual?: number; plano?: string }> {
  const [tenant] = (await db.execute(sql`SELECT interno FROM tenants WHERE id = ${tenantId}`)).rows as any[];
  if (!tenant || tenant.interno === true) return { ok: true }; // interno = sem limite
  const [row] = (await db.execute(sql`
    SELECT p.max_usuarios, p.nome FROM subscriptions s JOIN planos p ON p.id = s.plano_id WHERE s.tenant_id = ${tenantId}
  `)).rows as any[];
  if (!row || row.max_usuarios == null) return { ok: true }; // sem plano ou ilimitado
  const [cnt] = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM user_tenants WHERE tenant_id = ${tenantId}`)).rows as any[];
  const atual = Number(cnt.n);
  return { ok: atual < row.max_usuarios, limite: row.max_usuarios, atual, plano: row.nome };
}
```
- [ ] **4.2** No handler de criação de usuário (onde hoje faz o INSERT em `users` + vínculo `user_tenants` — localizar por `INSERT INTO users` / `storage.createUser` no fluxo admin), ANTES de criar, chamar `checarLimiteUsuarios(tenantIdAlvo)`; se `!ok`, retornar `400 { message: \`O plano ${r.plano} permite até ${r.limite} usuários (você já tem ${r.atual}).\` }`. Aplicar só quando o alvo é um ambiente cliente (não master global criando em interno).
- [ ] **4.3** `npm run build` verde. Commit: `feat(assinaturas): SP1 t4 - aplica limite de usuarios do plano na criacao`.

**Produz:** `checarLimiteUsuarios`; bloqueio na criação de usuário acima do teto.

---

## Task 5 — Fix ambientes excluídos em selects (backend)

**Files:** `server/routes.ts`.

- [ ] **5.1** Padrão central: em toda query que lista tenants para SELEÇÃO em telas de assinatura/cobrança, filtrar `status <> 'excluido' AND is_active = true`. Alvos concretos:
  - `GET /api/admin/tenants-without-subscription` — adicionar `AND t.status <> 'excluido' AND t.is_active = true` no WHERE.
  - Qualquer endpoint que alimente Select de ambiente em cobrança avulsa (`/api/admin/tenants` é usado; o filtro do front já tira `interno`, mas adicionar no back o corte de excluído no que for select). Conferir `/api/admin/subscriptions` (lista de assinaturas) — manter mostrando todas, só os SELECTS de criação é que filtram.
- [ ] **5.2** `npm run build` verde. Commit: `fix(assinaturas): SP1 t5 - ambientes excluidos somem dos selects`.

**Produz:** selects de ambiente sem excluídos.

---

## Task 6 — Tela de Cadastro de Planos (frontend)

**Files:** Create `client/src/pages/admin-planos.tsx`; Modify `client/src/App.tsx` (rota), `client/src/components/app-sidebar.tsx` (menu + MS_ITEM).

**Consome:** endpoints da Task 2; `/api/servicos/produtos` (Fase 3) para a lista de serviços; `@shared/modulos` `MODULOS_CATALOGO`.

- [ ] **6.1** Criar `admin-planos.tsx` (MasterRoute): tabela de planos (nome, ciclo, valor R$, nº usuários, ativo, ações) + Dialog criar/editar com: nome, descrição, ciclo (Select mensal/anual), valor (number), maxUsuarios (number, vazio=ilimitado), limites (por ora um textarea "chave: valor" simples OU campos livres — manter simples: um Input de "observações de limite" que grava em `limites.observacao`), checkboxes de módulos (de `MODULOS_CATALOGO`), e lista de produtos (de `/api/servicos/produtos`) cada um com toggle tri-estado: Não incluído / Incluso / Opcional (mapear para: ausente / `{incluso:true}` / `{incluso:false}`), switch ativo. Salvar → POST/PUT. Excluir com AlertDialog (trata o 400 "há assinaturas" mostrando o toast).
- [ ] **6.2** `App.tsx`: `import AdminPlanosPage from "@/pages/admin-planos";` + rota `<Route path="/admin/planos">{() => <MasterRoute component={AdminPlanosPage} />}</Route>`.
- [ ] **6.3** `app-sidebar.tsx`: item de menu em Administração `{ title: "Planos", url: "/admin/planos", icon: Layers, masterOnly: true }` (usar um ícone lucide já importado ou importar `Layers`); adicionar `"Planos": "workspaces"` no `MS_ITEM`.
- [ ] **6.4** `npm run build` verde. Commit: `feat(assinaturas): SP1 t6 - tela de cadastro de planos`.

**Produz:** `/admin/planos` funcional; menu "Planos".

---

## Task 7 — Assinaturas por plano + histórico na UI (frontend)

**Files:** Modify `client/src/pages/admin-assinaturas.tsx`, `client/src/pages/minha-assinatura.tsx`.

**Consome:** GETs com plano resolvido (Task 3), `/historico` (Task 3), `GET /api/admin/planos` (Task 2).

- [ ] **7.1** `admin-assinaturas.tsx`: no Dialog de Nova/Editar Assinatura, trocar o Select de `plan` (enum) por um Select de **plano** carregado de `/api/admin/planos` (mostrar `nome — R$ valor/ciclo`), enviando `planoId`. Coluna "Plano" na tabela usa `sub.plano_nome` (fallback ao `plan`). Preço exibido = `sub.plano_valor` + ciclo. Remover dependência de `PLAN_PRICES`/`PLAN_LABELS` para exibição.
- [ ] **7.2** `admin-assinaturas.tsx`: botão "Histórico de alterações" por linha (Dialog) → query `["/api/admin/subscriptions", tenantId, "historico"]`, lista `tipo`, `descricao`, `por_nome`, `criado_em` (pt-BR).
- [ ] **7.3** `minha-assinatura.tsx`: mostrar o plano do catálogo (`plano_nome`, `plano_valor`, `plano_ciclo`) e a lista de serviços inclusos do plano (se o GET `/api/subscription` trouxer; senão, buscar `/api/admin/planos` não serve p/ cliente — expor os serviços inclusos no `/api/subscription` via join em `plano_produtos`+`produtos` com `incluso=true`). Ajuste backend mínimo: incluir `servicos_inclusos` no `/api/subscription`.
- [ ] **7.4** `npm run build` verde. Commit: `feat(assinaturas): SP1 t7 - UI de assinatura por plano + historico + servicos inclusos`.

**Produz:** Nova Assinatura escolhe plano; coluna/preço do plano; histórico na tela; cliente vê plano e serviços inclusos.

---

## Self-review (cobertura × spec)
- Item 1 (excluídos em selects) → Task 5 ✓
- Item 2 (modelos × assinatura do cliente) → Task 1 (plano_id) + Task 3 (vínculo) + Task 7 (UI) ✓
- Item 3 (cadastro de planos) → Task 1 (campos) + Task 2 (CRUD) + Task 6 (tela) ✓
- Item 7 (gestão: cliente/plano/datas/situação/ambiente/adicionais/histórico pagamentos/histórico alterações) → Task 3 (histórico + GETs) + Task 7 (UI); adicionais e histórico de pagamentos já existiam (Fase 4) ✓
- Limite de usuários aplicado → Task 4 ✓
- Tipos consistentes: `plano_id`/`planoId`, `plano_produtos(incluso)`, `assinatura_historico(tipo,descricao,por_user_id)`, `checarLimiteUsuarios`, `registrarHistoricoAssinatura`, `createSubscription({cycle?})` — referenciados igual entre tarefas ✓
- Fora de escopo (landing/self-serve) → SP2 ✓
