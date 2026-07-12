# Jarvis — Plantão de Perguntas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Quando o Jarvis não sabe, a pergunta vira pendência pros masters; o master responde PELO PRÓPRIO CHAT do Jarvis; o corretor recebe a resposta via canal de avisos (badge + card); o master decide na hora se a resposta vira artigo publicado na base.

**Architecture:** Nova tabela `assistente_perguntas`. No caminho "não sei" do chat, cria pergunta pendente (dedupe). Endpoints de gestão (listar/responder/descartar) em `server/assistente.ts`. Responder cria um AVISO (`assistente_avisos`, tipo `resposta_gestor`) pro corretor autor — reusa 100% a entrega existente (badge + cards no widget). Se "salvar na base": cria artigo publicado via `classificarConteudo` + `indexarArtigo`. Widget: seção "Perguntas da equipe" visível só pra gestão; badge do botão passa a somar perguntas pendentes quando o usuário é gestor.

**Tech Stack:** os mesmos do módulo (Express + Drizzle, React Query, widget do Jarvis).

## Global Constraints

- **Isolamento:** corretor só vê a resposta da PRÓPRIA pergunta (aviso criado com userId = autor). Perguntas pendentes são visíveis só pra `podeGerenciarKb` (masters), tenant-scoped.
- **Reuso:** entrega ao corretor usa `assistente_avisos` (NUNCA o sino do CRM). Salvar na base usa `classificarConteudo` + insert em `kbArtigos` + `indexarArtigo` (publicado direto — o master JÁ é o aprovador; não passa pela fila).
- **Não-sei:** o texto das variações passa a dizer que a pergunta foi registrada pro gestor. Dedupe: mesma pergunta (normalizada) do mesmo corretor com status `pendente` não duplica.
- **Deploy:** branch `feat/jarvis-plantao` de `migracao-cloudfy`; fetch+rebase antes de push (outra sessão trabalha no repo). Baseline tsc **~227** (medir no início; 0 novos). `npm run build` deve passar.
- **`req.tenantId`** (não `req.user.tenantId`). Rotas com try/catch → 500 (padrão do arquivo).
- Commits pt-BR + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## File Structure

- Modify `shared/schema.ts` — tabela `assistentePerguntas`.
- Modify `server/index.ts` — migração idempotente (padrão dos blocos vizinhos).
- Modify `server/assistente.ts` — criar pergunta no caminho não-sei; endpoints `GET /api/assistente/perguntas`, `POST /api/assistente/perguntas/:id/responder`, `POST /api/assistente/perguntas/:id/descartar`; variações do não-sei atualizadas.
- Modify `server/assistente-avisos.ts` — count do badge soma perguntas pendentes p/ gestores (novo param/consulta) OU novo endpoint count combinado — ver Task 3.
- Modify `client/src/components/assistente/useAssistenteAvisos.ts` + `AssistenteWidget.tsx` — seção "Perguntas da equipe" (gestão) com textarea + checkbox "Salvar na base" (default ON) + botões Responder/Descartar.

---

## Task 1: Tabela `assistente_perguntas` (schema + migração)

**Files:** Modify `shared/schema.ts` (após `assistenteAvisos`), `server/index.ts` (após o bloco assistente_avisos).

**Interfaces:** Produces Drizzle `assistentePerguntas` / SQL `assistente_perguntas`.

- [ ] **Step 1: Drizzle**

```typescript
export const assistentePerguntas = pgTable("assistente_perguntas", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  corretorId: integer("corretor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pergunta: text("pergunta").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pendente"), // pendente | respondida | descartada
  resposta: text("resposta"),
  respondidaPor: integer("respondida_por").references(() => users.id),
  respondidaEm: timestamp("respondida_em"),
  artigoId: integer("artigo_id"), // quando a resposta virou artigo
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Migração boot** (bloco próprio, padrão vizinho: import local db/sql, try/catch non-fatal, log):

```sql
CREATE TABLE IF NOT EXISTS assistente_perguntas (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  corretor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pergunta      TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pendente',
  resposta      TEXT,
  respondida_por INTEGER REFERENCES users(id),
  respondida_em TIMESTAMP,
  artigo_id     INTEGER,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assistente_perguntas_status ON assistente_perguntas(tenant_id, status);
```

- [ ] **Step 3:** `npm run check` (0 novos). Commit `feat(jarvis): tabela assistente_perguntas (plantão de dúvidas)`.

---

## Task 2: Backend — criar pergunta no não-sei + endpoints do plantão

**Files:** Modify `server/assistente.ts` (+ import de `assistentePerguntas` e `assistenteAvisos` do schema).

**Interfaces (Produces):**
- No caminho não-sei do chat (os DOIS pontos: sem chunks relevantes E resposta vazia do LLM): após persistir a mensagem, chamar `registrarPerguntaPendente(req.tenantId, req.user.id, texto)` — best-effort try/catch.
- `registrarPerguntaPendente(tenantId, corretorId, pergunta)`: normaliza (trim/lower/espacos), dedupe contra pendentes do mesmo corretor+tenant (`lower(pergunta) = lower($x)` com status pendente), insere se novo.
- `GET /api/assistente/perguntas` (requireAuth + requireGestorKb): pendentes do tenant, mais antigas primeiro, com nome do corretor (join users), limit 50. Shape: `[{id, pergunta, corretorId, corretorNome, createdAt}]`.
- `POST /api/assistente/perguntas/:id/responder` (gestão) body `{resposta: string, salvarNaBase?: boolean}`:
  1. 422 sem resposta; 404 se não for pendente do tenant.
  2. Se `salvarNaBase`: `classificarConteudo(\`Pergunta: ${pergunta}\nResposta do gestor: ${resposta}\`)` → insere `kbArtigos` **publicado** (origem `"plantao"`, criadoPor = master) → `indexarArtigo`. Guarda `artigoId`. Falha aqui NÃO impede a resposta (try/catch; segue sem artigo).
  3. Atualiza pergunta: status `respondida`, resposta, respondidaPor/Em, artigoId.
  4. Cria AVISO pro corretor: insert direto em `assistenteAvisos` `{tenantId, userId: corretorId, tipo: "resposta_gestor", titulo: "O gestor respondeu sua pergunta 💬", mensagem: \`Você perguntou: "${pergunta}"\n\nResposta: ${resposta}\`, proposalId: null}`.
  5. `res.json({ok: true, artigoId})`.
- `POST /api/assistente/perguntas/:id/descartar` (gestão): status `descartada`. `{ok:true}`.

- [ ] **Step 1:** Atualizar `NAO_SEI_VARIANTES` para dizer que registrou pro gestor (manter o caráter). Ex.:
```typescript
const NAO_SEI_VARIANTES = [
  `Essa aí ainda não tá na minha base — e eu não chuto regra de banco. Já deixei sua pergunta registrada pro gestor; assim que responderem, te aviso aqui. 👌`,
  `Não tenho isso registrado, e prefiro não inventar. Mandei sua pergunta pro plantão do gestor — fica de olho que a resposta chega por aqui.`,
  `Essa me pegou. Registrei pro gestor responder; te aviso aqui assim que sair. Enquanto isso, se for urgente, chama ele direto.`,
  `Ainda não aprendi essa. Sem vergonha de admitir — vergonha é inventar. 🙈 Sua pergunta já foi pro gestor; aviso você por aqui quando responderem.`,
];
```
- [ ] **Step 2:** `registrarPerguntaPendente` + chamadas nos 2 caminhos não-sei (best-effort, nunca quebra o SSE).
- [ ] **Step 3:** os 3 endpoints (código completo conforme interfaces acima, com guards de tenant + try/catch padrão).
- [ ] **Step 4:** `npm run check` (0 novos) + self-trace (dedupe; falha de artigo não bloqueia resposta; aviso vai pro corretor certo). Commit `feat(jarvis): plantão de perguntas — não-sei registra pro gestor + endpoints responder/descartar`.

---

## Task 3: Frontend — seção "Perguntas da equipe" + badge do gestor

**Files:** Modify `client/src/components/assistente/useAssistenteAvisos.ts`, `AssistenteWidget.tsx`.

**Interfaces:**
- Hook ganha (quando `gestor === true`): query `["/api/assistente/perguntas"]` (refetchInterval 60000) e mutations `responder({id, resposta, salvarNaBase})` / `descartar(id)`, invalidando a lista.
- Badge do botão: `count + (gestor ? perguntas.length : 0)`.
- Widget (só quando `podeCaptura`/gestão): acima dos avisos, seção com header "Perguntas da equipe (N)"; cada card: nome do corretor + pergunta + textarea de resposta + checkbox **"Salvar na base"** (default marcado) + botões **Responder** e **Descartar**. Ao responder com sucesso: toast/feedback simples (o card some ao invalidar).

- [ ] **Step 1:** hook (passar flag `gestor` como segundo argumento; queries `enabled: enabled && gestor`).
- [ ] **Step 2:** widget — estado local por card (`respostaDraft[id]`, `salvarFlag[id]` default true). Hooks incondicionais (regras dos hooks: tudo antes dos early returns, como já é feito).
- [ ] **Step 3:** `npm run check` + `npm run build`. Commit `feat(jarvis): gestor responde perguntas da equipe pelo chat (salvar na base opcional)`.

---

## Task 4: Verificação + review whole-branch

- [ ] Build final (tsc baseline, vite ok).
- [ ] Review whole-branch (modelo mais capaz): isolamento (corretor A não vê pergunta/resposta de B; gestão-only nos endpoints), não-sei nunca quebra o SSE, dedupe, falha do salvar-na-base não engole a resposta, hooks do React ok.
- [ ] Fix wave se necessário; ledger; SEM push até o controller decidir (fetch+rebase antes).

## Self-Review (na escrita)
- Cobre as 3 decisões do Fábio (master responde no chat; corretor recebe no Jarvis; master decide salvar com default sim). Artigo publicado direto (master é o aprovador). Badge soma pro gestor. Variações do não-sei atualizadas mantêm a persona. Interfaces batem entre tasks.
