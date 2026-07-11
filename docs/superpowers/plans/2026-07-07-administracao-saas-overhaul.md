# Administração → Painel SaaS — Plano de Implementação

> **Para o executor (Fable 5):** implemente **fase por fase, na ordem** (há dependências reais entre elas). Cada fase é um entregável que builda, deploya e é conferível sozinho. Marque os `- [ ]` conforme avança. Este repo **não tem suíte de testes automatizada** — a verificação de cada fase é **`npm run build` + deploy + conferência manual no app** (o fluxo que o time já usa). NÃO invente framework de teste.

**Goal:** Transformar a área de Administração do Capital CRM num verdadeiro painel de operação SaaS: excluir telas mortas, unificar preços+pedidos num módulo de "Serviços & Cobrança" com gateway Asaas, reformar Ambientes em painel de provisionamento de clientes, e ajustar Usuários/Identidade Visual/Atualizações/API Keys pro modelo dono-do-SaaS × clientes pagantes.

**Architecture:** Monolito TS (React/Vite + Express + Drizzle/Postgres-Supabase), multi-tenant. Novas tabelas/colunas entram no **bloco idempotente de boot** (`server/index.ts`). Pagamento via **Asaas** (checkout hospedado; o app guarda só IDs/status, nunca dado de cartão). A distinção **interno × cliente** é por **ambiente (tenant)** e é o interruptor de toda a lógica de assinatura/cobrança.

**Tech Stack:** React 18, Wouter, TanStack Query, shadcn/ui, Recharts, Express, Drizzle ORM, PostgreSQL (Supabase), multer, jsPDF, Asaas API, Railway Public API (domínios).

## Global Constraints (valem para TODAS as tarefas)

- **Deploy:** `git push origin migracao-cloudfy` → Railway builda e reinicia sozinho. Build: `npm run build` (Vite + esbuild). **Nunca** Replit nem Vercel.
- **Migrações:** não há migração versionada. Toda tabela/coluna nova entra no bloco **idempotente** de `server/index.ts` (`CREATE TABLE / ALTER … IF NOT EXISTS`) — esquecer = 500 "column does not exist".
- **Multi-tenant:** quase tudo tem `tenant_id`; middlewares `resolveTenant → requireTenant`. `isMaster=true` = dono do SaaS (Fábio, cross-ambiente). `role=master` + `isMaster=false` = **admin de um cliente**.
- **Pagamento:** usar **checkout/link hospedado do Asaas** (PIX/boleto/cartão). Guardar só `asaas_customer_id`, `asaas_charge_id`/`asaas_subscription_id`, status. **NUNCA** armazenar dado de cartão.
- **Base de clientes é global entre tenants** por design — não isolar.
- **Corretor nunca vê** comissão/flat/% da empresa/parceiro.
- **Design Capital Go:** roxo `#6C2BD9`, fonte Inter, ícones Material Symbols Rounded (componente `MatIcon`). Dark exato `#121016/#181521/#1E1B29`.
- **NÃO reescrever** os iframes legados (`financeiro-comissoes.html`, `ferramentas-portabilidade.html`, `simulador-contracheque.html`).
- **Segredos:** só em env vars (`ASAAS_API_KEY`, `RAILWAY_API_TOKEN`). Sandbox antes de produção.

## Ordem das fases (dependência)

```
Fase 0  Exclusões (independente, warm-up)
Fase 1  Fundações: flag `interno` · catálogo módulos×plano · cliente Asaas + webhook
Fase 2  Usuários + Minha Assinatura        (depende de 1: interno)
Fase 3  Serviços & Cobrança + Asaas avulso (depende de 1: módulos, Asaas)
Fase 4  Assinaturas religadas ao Asaas     (depende de 1,3)
Fase 5  Ambientes → painel SaaS            (depende de 1,3,4 — orquestra tudo)
Fase 6  Identidade Visual (9 pontos)       (depende de 1: seletor de ambiente)
Fase 7  Central de Atualizações + API Keys (depende de 1: módulos/plano)
```

---

## Fase 0 — Exclusões

**Objetivo:** remover as 3 telas mortas/decididas, limpando a Administração antes de construir.
**Depende de:** nada.
**Arquivos:** `client/src/components/app-sidebar.tsx` (itens de menu), `client/src/App.tsx` (rotas), `client/src/pages/funcionarios.tsx` + `config-dados.tsx` + `config-prompts.tsx` (deletar), `server/routes.ts` (endpoints), `server/index.ts` (drop de tabela pós-backup).

- [ ] **Funcionários (Nível B):** antes de dropar, **exportar** `employees` (endpoint pontual `GET /api/employees?export=1` → CSV, ou dump SQL manual do Fábio). Remover: item de menu, rota `/funcionarios`, `funcionarios.tsx`, endpoints `/api/employees*`. Adicionar no boot: `DROP TABLE IF EXISTS employees;` **somente após** confirmação do backup.
- [ ] **Config. Dados (Nível B):** remover item de menu, rota `/admin/configuracoes-dados`, `config-dados.tsx`, endpoints `GET/PUT /api/admin/configuracoes-dados`. Limpar a chave `fonte_margem` de `tenants.themeJson` (não há tabela dedicada).
- [ ] **Config. Prompts IA (sai da Administração):** remover **apenas** o item de menu + a rota `/config-prompts` + `config-prompts.tsx`. **MANTER** a tabela `ai_prompts` e os endpoints `/api/ai-prompts*` e `/api/roleplay-niveis/prompts` (o Roleplay depende — Fábio religa a config em outro lugar depois).

**Verificação:** `npm run build` ok · deploy · os 3 itens somem do menu; abrir `/funcionarios` e `/config-prompts` diretamente → 404/redirect; o Roleplay da Academia continua funcionando (prompts ativos carregam).
**Aceite:** menu Administração sem os 3 itens; Roleplay intacto; `employees` exportado antes do drop.

---

## Fase 1 — Fundações

**Objetivo:** criar os 3 alicerces que todas as fases seguintes consomem.
**Depende de:** nada (pode ir logo após a 0).

### 1a — Flag `interno` no ambiente
- [ ] Boot migration: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS interno BOOLEAN NOT NULL DEFAULT false;`
- [ ] Seed idempotente: marcar o tenant Capital Go como interno (`UPDATE tenants SET interno=true WHERE id=4;` — confirmar o id no boot por nome se preferir).
- [ ] `GET /api/tenant/current` e `/api/admin/tenants` passam a devolver `interno`.
- [ ] Tela **Ambientes** (`admin-tenants.tsx`): toggle "Ambiente interno (não paga)" no form de criar/editar; `PUT /api/admin/tenants/:id` grava `interno`.
- **Produz:** `tenants.interno: boolean`.

### 1b — Catálogo de módulos × plano
- [ ] Boot: criar `planos` (`id, tenant_id NULL /*global do dono*/, nome, descricao, preco_mensal, ativo, created_at`) e `plano_modulos` (`plano_id, modulo_key`). E `modulos_catalogo` como **constante no código** (não tabela) com as chaves: `crm, simuladores, criador_propostas, consulta_individual, discador, gestao_comercial, financeiro, relatorios, ia_jarvis, compra_leads`.
- [ ] Boot: `tenant_modulos` (`tenant_id, modulo_key, ativo BOOLEAN`) — módulos efetivamente ligados por ambiente (default = os do plano, com override manual).
- [ ] Endpoints: `GET/POST/PUT/DELETE /api/admin/planos` (isMaster); `GET /api/tenant/modulos` (retorna módulos ativos do tenant atual — para o front decidir o que mostrar).
- [ ] Helper front `hasTenantModule(key)` (via `/api/tenant/modulos`) usado no `app-sidebar.tsx`/rotas para esconder módulos não contratados. (Complementa o `hasModuleAccess` por-usuário existente — este é por-TENANT.)
- **Produz:** `modulos_catalogo` (const), `planos`, `plano_modulos`, `tenant_modulos`, `hasTenantModule()`.

### 1c — Cliente Asaas + webhook base
- [ ] Env: `ASAAS_API_KEY`, `ASAAS_BASE_URL` (sandbox `https://sandbox.asaas.com/api/v3`). Wrapper `server/asaas.ts`: `createCustomer`, `createSubscription`, `createCharge`, `getPayment`.
- [ ] Boot: colunas em `tenants`: `asaas_customer_id TEXT`. Boot: `cobrancas` (`id, tenant_id, tipo /*assinatura|avulso*/, ref_id, asaas_id, valor, status, metodo, vencimento, pago_em, created_at`).
- [ ] Endpoint webhook `POST /api/webhooks/asaas` (isento de auth de sessão/CSRF em `security.ts`, validado por token do Asaas): atualiza `cobrancas.status` e dispara os handlers (liberar serviço / ativar assinatura) — handlers preenchidos nas fases 3/4/5.
- **Produz:** `server/asaas.ts`, `cobrancas`, `tenants.asaas_customer_id`, `/api/webhooks/asaas`.

**Verificação:** build/deploy ok; toggle interno grava; CRUD de planos grava; webhook Asaas responde 200 a um POST de teste do sandbox.
**Aceite:** `- [ ]` interno funcional; `- [ ]` planos+módulos CRUD; `- [ ]` webhook Asaas recebendo evento sandbox.

---

## Fase 2 — Usuários + Minha Assinatura

**Objetivo:** filtros + coluna/filtro Ambiente + visão cross-ambiente; esconder "Minha Assinatura" de quem não é admin de cliente.
**Depende de:** 1a (`interno`).
**Arquivos:** `client/src/pages/users.tsx`, `server/routes.ts` (`/api/users`), `client/src/components/app-sidebar.tsx` (visibilidade do item).

- [ ] Backend `/api/users`: se `req.user.isMaster`, retornar usuários de **todos os ambientes** com o campo `ambientes` (nome dos tenants via `user_tenants`); senão, só o ambiente atual. Adicionar `is_active` no payload (já existe) e a lista de ambientes por usuário.
- [ ] `users.tsx`: adicionar **filtro Ativo/Inativo** (client-side sobre `isActive`), **coluna "Ambiente"** e **filtro por ambiente** (dropdown com os ambientes presentes). Coluna só aparece quando `isMaster` (cross-ambiente); para admin de cliente é redundante.
- [ ] Ações por-usuário (editar/permissões/ativar) resolvem o tenant do usuário-alvo quando cross-ambiente (usar o `tenant_id` do usuário, não o da sessão).
- [ ] Sidebar: "Minha Assinatura" (`/assinatura`) só aparece se **`tenant.interno === false` E `role === 'master' E isMaster === false`** (admin do cliente). Some para interno e para o dono.

**Verificação:** como isMaster, a lista mostra usuários de vários ambientes com coluna Ambiente e filtros; logado como vendedor de um cliente, "Minha Assinatura" não aparece; logado como admin de cliente (role master, isMaster false, ambiente não-interno), aparece.
**Aceite:** `- [ ]` filtros ativo/inativo; `- [ ]` coluna+filtro Ambiente; `- [ ]` cross-ambiente pro dono; `- [ ]` regra de visibilidade de Minha Assinatura.

---

## Fase 3 — Serviços & Cobrança (Config. Preços + Admin Pedidos unificados)

**Objetivo:** módulo único de 2 abas (Pedidos + Produtos), com produtos gerenciáveis, promoções, notificação do Jarvis ao dono e cobrança Asaas avulsa.
**Depende de:** 1b (módulos/planos), 1c (Asaas).
**Arquivos (criar):** `client/src/pages/servicos-cobranca.tsx`; **modificar** `server/routes.ts`, `app-sidebar.tsx`, `App.tsx`. **Aposentar** `config-precos.tsx` e `admin-pedidos-lista.tsx` (conteúdo migra para as 2 abas; manter a lógica de geração de CSV do pedido de lista).

### Dados (boot)
- [ ] `produtos` (`id, tenant_id NULL /*global*/, nome, descricao, tipo /*lead|consulta|premium|dominio_proprio|outro*/, preco, gratuito BOOLEAN, cobravel BOOLEAN, ativo BOOLEAN, created_at`).
- [ ] `promocoes` (`id, produto_id NULL, tipo /*desconto_pct|desconto_valor|bonus|beneficio*/, valor, escopo /*global|cliente*/, tenant_alvo INT NULL, vigencia_inicio, vigencia_fim, ativo`).
- [ ] Generalizar pedidos: reaproveitar `pedidos_lista` renomeando conceito para "pedido de serviço" — adicionar `ALTER TABLE pedidos_lista ADD COLUMN IF NOT EXISTS produto_id INT, ADD COLUMN IF NOT EXISTS cobranca_id INT;` (mantém a geração de CSV existente para tipo lead).
- [ ] `assinatura_adicionais` (`id, tenant_id, produto_id, cobranca_id, ativo, created_at`) — o adicional que entra na assinatura.

### Backend
- [ ] CRUD `GET/POST/PUT/DELETE /api/servicos/produtos` (isMaster) e `/api/servicos/promocoes`.
- [ ] Migrar endpoints de pedidos existentes (`/api/pedidos-lista/*`) para servirem qualquer produto; a aprovação passa a: criar **cobrança Asaas avulsa** (via `server/asaas.ts`) → salvar em `cobrancas` (tipo `avulso`) → status `pendente`.
- [ ] Handler do webhook (1c) para `tipo=avulso`: ao `pago`, **liberar o serviço** (se lead → dispara o `generatePedidoListaFile` já existente; senão marca liberado) e inserir em `assinatura_adicionais`.
- [ ] **Notificação Jarvis:** função `notificarDono(evento)` que grava em `notifications` **só para usuários `isMaster`** (nunca masters de cliente). Chamar em: novo pedido criado. Persona "Jarvis" no título/ícone.

### Frontend (`servicos-cobranca.tsx`, 2 abas)
- [ ] **Aba Pedidos:** herdar a UI atual de `admin-pedidos-lista.tsx` (abertos/processados/concluídos, aprovar/reprovar/reprocessar) + estado de cobrança/pagamento.
- [ ] **Aba Produtos:** tabela de produtos com criar/editar/ativar-desativar, preço/descrição, grátis×cobrável, e gestão de promoções/descontos/bônus/benefícios por cliente.
- [ ] Menu: substituir "Config. Preços" e "Admin Pedidos" por um item **"Serviços & Cobrança"**.

**Verificação:** criar produto; abrir pedido → dono (isMaster) recebe notificação Jarvis, masters de cliente não; aprovar → cobrança criada no sandbox Asaas; simular `pago` no webhook → serviço liberado + aparece em adicionais.
**Aceite:** `- [ ]` produtos CRUD; `- [ ]` pedidos generalizados; `- [ ]` notificação só ao dono; `- [ ]` cobrança avulsa Asaas + liberação por webhook; `- [ ]` adicional entra na assinatura.

---

## Fase 4 — Assinaturas religadas ao Asaas

**Objetivo:** billing deixa de ser manual; a tela reflete o status real e mostra adicionais.
**Depende de:** 1c, 3.
**Arquivos:** `client/src/pages/admin-assinaturas.tsx`, `minha-assinatura.tsx`, `server/routes.ts`.

- [ ] Colunas em `subscriptions` (boot): `asaas_subscription_id TEXT, proximo_vencimento DATE`.
- [ ] Ao criar/ativar assinatura: criar **subscription recorrente** no Asaas (via `server/asaas.ts`), guardar `asaas_subscription_id`.
- [ ] Handler webhook `tipo=assinatura`: sincronizar `subscriptions.status` (ativo/suspenso/cancelado) e `proximo_vencimento`.
- [ ] `admin-assinaturas.tsx`: mostrar status real (sync Asaas), vínculo com o ambiente, e a lista de **adicionais** (`assinatura_adicionais`). Remover preços hardcoded → puxar dos `planos` (1b).
- [ ] `minha-assinatura.tsx`: idem em leitura para o admin do cliente (plano, status, vencimento, adicionais).

**Verificação:** criar assinatura → subscription no sandbox Asaas; evento de pagamento no webhook muda o status na tela; adicionais da Fase 3 aparecem aqui.
**Aceite:** `- [ ]` subscription Asaas criada; `- [ ]` status sincronizado por webhook; `- [ ]` adicionais visíveis; `- [ ]` sem preços hardcoded.

---

## Fase 5 — Ambientes → Painel SaaS

**Objetivo:** o painel operacional onde o dono cria/configura/suspende/exclui clientes, com provisionamento e domínio automáticos.
**Depende de:** 1 (tudo), 3, 4.
**Arquivos:** `client/src/pages/admin-tenants.tsx` (reforma grande — considerar split em `admin-ambientes-lista.tsx` + `admin-ambiente-detalhe.tsx` + `novo-ambiente-wizard.tsx`), `server/routes.ts`, novo `server/provisioning.ts`, novo `server/railway.ts`.

### Status & exclusão
- [ ] `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ativo';` (valores: ativo/suspenso/inativo/cancelado/excluido). Filtro na listagem.
- [ ] "Excluir" = **soft** (status `excluido`, some da lista, reversível). **Hard-delete** num 2º passo: `POST /api/admin/tenants/:id/hard-delete` (isMaster) que **exporta um dump do tenant** (JSON dos dados privados) antes de `DELETE`, com dupla confirmação no front.

### Wizard "Novo Ambiente" + provisionamento
- [ ] `novo-ambiente-wizard.tsx`: dados do cliente → domínio (subdomínio | próprio) → plano → confirmar.
- [ ] `server/provisioning.ts` `provisionTenant({dados, planoId, dominio})`: cria tenant, **seed de `contract_statuses`/`contract_phases` padrão**, cria **usuário admin do cliente** (role master, isMaster false, senha temporária), aplica `tenant_modulos` = módulos do plano, cria customer + subscription Asaas, envia **e-mail com credenciais**.

### Domínio (Railway)
- [ ] `server/railway.ts`: `addCustomDomain(host)` via **Railway Public API** (GraphQL, `RAILWAY_API_TOKEN`), retorna o CNAME alvo. Subdomínio `*.<dominio-curinga-do-dono>` já coberto por **1 wildcard** (config manual única) → subdomínio novo é instantâneo, sem chamar a API.
- [ ] Domínio próprio: cria o produto `dominio_proprio` (Fase 3) como **adicional pago**; o wizard mostra o CNAME pro cliente apontar; status "aguardando DNS" até o Railway verificar.
- [ ] Nota operacional no README do plano: **subir Railway Hobby→Pro** antes de vender o 1º domínio próprio (limite 2→20 domínios/serviço).

### Integração assinatura + onboarding automático
- [ ] Fluxo self-serve: assinatura criada → `pago` (webhook) → `provisionTenant` dispara automático → subdomínio + módulos + credenciais. (para domínio próprio, provisiona o ambiente e deixa o passo DNS pendente.)

### Ficha do ambiente
- [ ] `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMP;` — atualizar no login. "Espaço utilizado" = query de tamanho (soma de storage/linhas principais do tenant).
- [ ] `admin-ambiente-detalhe.tsx`: empresa, responsável, domínio, plano, status, criação, último acesso, nº usuários, espaço, módulos ativos (toggle por módulo → `tenant_modulos`), recursos/adicionais.

**Verificação:** wizard cria ambiente com admin + módulos do plano; subdomínio resolve; domínio próprio mostra CNAME; soft-delete some/reaparece; hard-delete exige backup+confirmação; ficha mostra métricas.
**Aceite:** `- [ ]` status+exclusão; `- [ ]` wizard+provisionamento; `- [ ]` domínio (sub auto + próprio via Railway API); `- [ ]` módulos por plano aplicados; `- [ ]` onboarding pós-pagamento; `- [ ]` ficha completa.

---

## Fase 6 — Identidade Visual (9 melhorias)

**Objetivo:** white-label completo (logo que adapta, marca em PDF/e-mail, dark, presets, preview real).
**Depende de:** 1a (seletor de ambiente cross-tenant).
**Arquivos:** `admin-branding.tsx`, `app-sidebar.tsx`, `tenant-theme-provider.tsx`, `schema.ts`/boot, geradores de PDF, `client/index.html`/head.

- [ ] **Logo clara/escura:** boot `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url_dark TEXT;`. 2º upload "Logo fundo escuro" na tela; `POST /api/tenant/logo` aceita `type='sidebar-dark'`; `app-sidebar.tsx` escolhe `logoUrl`/`logoUrlDark` por tema; **remover o `brightness-0 invert`** dos clientes; fallback = 1 logo nos dois modos.
- [ ] **Branding no dark:** estender `TenantTheme` com overrides opcionais de dark (sidebar bg/texto, login bg); `tenant-theme-provider` aplica no tema escuro.
- [ ] **Marca em PDFs e e-mails:** geradores jsPDF (recibo do consultor, proposta) e envios de e-mail puxam logo/nome/cor do tenant (hoje sai Capital Go fixo).
- [ ] **Título/favicon/meta:** injetar `document.title` = nome do tenant e `faviconUrl` no `<head>` dinamicamente.
- [ ] **Salvar unificado:** um botão "Salvar tudo" que sobe logos pendentes + grava themeJson numa ação.
- [ ] **Preview real:** preview mostra dashboard/sidebar reais + arquivos pendentes (`URL.createObjectURL`) + toggle claro/escuro.
- [ ] **Presets + paleta + contraste:** botão "gerar paleta da cor primária" (deriva secundária/estados), presets, aviso WCAG de contraste.
- [ ] **"Restaurar padrão" = Capital Go:** trocar `DEFAULT_THEME` do azul `#3b82f6` pela paleta Capital Go (`#6C2BD9`).
- [ ] **Seletor de ambiente pro dono:** se isMaster, select "Editar marca do ambiente [X]" (carrega/salva o tenant escolhido).

**Verificação:** logo do cliente troca no claro/escuro sem sumir; PDF de recibo sai com a marca do cliente; presets/contraste funcionam; dono edita a marca de outro ambiente pelo seletor.
**Aceite:** `- [ ]` logo par claro/escuro; `- [ ]` dark; `- [ ]` PDF/e-mail; `- [ ]` head; `- [ ]` salvar unificado; `- [ ]` preview real; `- [ ]` presets/contraste; `- [ ]` default Capital Go; `- [ ]` seletor de ambiente.

---

## Fase 7 — Central de Atualizações (plataforma) + API Keys (vendável)

**Objetivo:** dono publica novidades pra todos os clientes; acesso à API vira capacidade vendável com painel de uso.
**Depende de:** 1b (módulos/plano).
**Arquivos:** `system-updates.tsx` + `UpdatesPopup.tsx` + `server/routes.ts`; `api-keys.tsx` + `server/routes.ts`.

- [ ] **Central de Atualizações — nível plataforma:** boot `ALTER TABLE system_updates ADD COLUMN IF NOT EXISTS nivel VARCHAR(20) NOT NULL DEFAULT 'tenant';` (`plataforma|tenant`). Só isMaster cria `plataforma`. `GET /api/system-updates/pending` passa a incluir os `plataforma` (de qualquer tenant) para todos os usuários, além dos `tenant` do ambiente. UI: seletor de nível ao criar (só isMaster vê "Plataforma").
- [ ] **API Keys vendável:** amarrar ao módulo `compra_leads`/plano — o item de menu e a capacidade só aparecem se o tenant tem o módulo/adição de API contratada (`hasTenantModule`). Painel de **uso**: expor `totalRequisicoes`/`ultimoUso` (já gravados pelo `api-key-middleware.ts`) numa aba de estatística por chave; rate-limit ajustável por plano.

**Verificação:** dono cria aviso "Plataforma" → aparece pra usuários de todos os ambientes; tenant sem o módulo de API não vê a tela; painel de uso mostra requisições/último uso.
**Aceite:** `- [ ]` nível plataforma; `- [ ]` API por plano; `- [ ]` painel de uso.

---

## Pendências do Fábio (fora do código)

- [ ] Criar conta **Asaas** + gerar `ASAAS_API_KEY` (sandbox → produção).
- [ ] Definir o **domínio-curinga** do dono para os subdomínios (ex.: `*.capitalgo.app`) e configurar o **wildcard** no Railway (config única).
- [ ] Gerar `RAILWAY_API_TOKEN` (para o painel adicionar domínios próprios).
- [ ] Subir Railway **Hobby → Pro** quando vender o 1º domínio próprio.
- [ ] Fechar o **catálogo de módulos × plano** (o que cada plano libera) — insumo da Fase 1b/3.
- [ ] Confirmar o backup de `employees` antes do hard-delete (Fase 0).

## Self-review (cobertura × spec)

- Exclusões (Func./Config.Dados/Prompts IA) → Fase 0 ✓
- Serviços & Cobrança + Jarvis + Asaas → Fase 3 ✓ · Assinaturas Asaas → Fase 4 ✓
- Ambientes (status/exclusão/wizard/domínio/módulos/onboarding/ficha) → Fase 5 ✓
- Usuários (filtros/Ambiente/cross-ambiente) + Minha Assinatura visibilidade → Fase 2 ✓
- Identidade Visual (9 pontos) → Fase 6 ✓
- Central de Atualizações plataforma + API Keys vendável → Fase 7 ✓
- Fundações compartilhadas (interno/módulos/Asaas) → Fase 1 ✓
- Tipos consistentes entre fases: `tenants.interno/status/asaas_customer_id/logo_url_dark/ultimo_acesso`; `cobrancas`; `planos/plano_modulos/tenant_modulos`; `assinatura_adicionais`; `hasTenantModule()` — referenciados igual em todas as fases ✓
