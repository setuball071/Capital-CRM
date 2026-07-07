# IA Interna para Corretores (Mascote "Capi") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assistente de IA (mascote flutuante) no Capital CRM que responde dúvidas dos corretores APENAS com base numa base de conhecimento curada (RAG), com tela de gestão, fila de aprovação multi-origem (manual/PDF/áudio/imagem/WhatsApp), métricas e carga inicial importada da Biblioteca do WhatsApp CRM.

**Architecture:** Backend Express em módulos novos (`server/assistente*.ts`) registrados em `routes.ts`, tabelas via bloco de migração idempotente no boot (`server/index.ts`), RAG com pgvector no Supabase (embeddings 768d), chat com SSE streaming usando o Gemini 2.5 Flash via endpoint OpenAI-compatible (padrão do `ocrClient` existente). Frontend React: widget flutuante montado no shell + página "Base de Conhecimento" (Artigos / Fila / Métricas).

**Tech Stack:** Express + Drizzle ORM 0.39 (Postgres/Supabase + pgvector), OpenAI SDK v6 apontando pro Gemini (`generativelanguage.googleapis.com/v1beta/openai/`), multer, pdfjs-dist, React 18 + Wouter + React Query + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-07-07-ia-corretores-design.md`

## Global Constraints

- **Branch:** trabalhar em `feat/ia-corretores` criada a partir de `migracao-cloudfy`. NÃO fazer push sem o Fábio pedir (push pra main = deploy automático no Railway).
- **Sem runner de teste no projeto** (não há vitest/jest). Verificação de cada task = `npm run check` (tsc) + smoke manual (curl/navegador) + log de boot. NÃO adicionar runner de teste.
- **Fase 1 NUNCA acessa dados de cliente** (CPF, margens, contratos). A IA só enxerga `kb_artigos` publicados.
- **Nada publica sozinho:** PDF vira rascunho; áudio/imagem/WhatsApp viram `kb_sugestoes` pendentes. Só gestor publica.
- **Anti-alucinação:** corte de similaridade `>= 0.50` no melhor chunk; abaixo disso responde o texto padrão "não sei" e grava `semResposta = true`.
- **LLM:** Gemini 2.5 Flash via `ocrClient`/`ocrModel` de `server/openaiClient.ts` (se `GEMINI_API_KEY` ausente cai pro OpenAI `gpt-4o-mini` — fallback aceito). Embeddings: `gemini-embedding-001` com `dimensions: 768` (fallback OpenAI `text-embedding-3-small`, também 768). SEMPRE normalizar vetores (L2) antes de gravar/buscar.
- **Multi-tenant:** `kb_artigos`, `kb_sugestoes` e `assistente_conversas` têm `tenant_id`; toda query filtra pelo tenant do usuário (`req.user.tenantId`) ou da API key (`req.apiTenantId`).
- **Permissões:** gerenciar base/fila/métricas = `req.user.isMaster || ["master","operacional"].includes(req.user.role)` (helper `podeGerenciarKb`). Corretor (`vendedor`) só usa o chat.
- **Roles existentes:** `master | coordenacao | atendimento | operacional | vendedor` + flag `isMaster` (shared/schema.ts:220-226).
- **Mascote:** nome default **"Capi"** — constante única no front (`client/src/components/assistente/config.ts`) e no texto da persona default do back. Persona editável via tabela `aiPrompts` (`type = 'assistente'`, `scope = 'global'`), com fallback hardcoded.
- **`db.execute` e linhas:** dependendo do driver, o resultado é `{ rows }` (node-postgres) ou o próprio array (postgres-js). SEMPRE ler com `const rows = (res as any).rows ?? res;`.
- **Enums novos:** `kb_artigos.categoria ∈ {regras_banco, roteiros, dicas, atalhos_sistema}`; `kb_artigos.status ∈ {rascunho, publicado, arquivado}`; `origem ∈ {manual, pdf, audio, imagem, whatsapp, whatsapp_biblioteca}`; `kb_sugestoes.status ∈ {pendente, aprovada, rejeitada}`.
- **Commits:** frequentes, mensagens em pt-BR estilo conventional (`feat:`, `fix:`), com `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## File Structure

**Backend:**
- Modify `shared/schema.ts` — tabelas Drizzle `kbArtigos`, `kbSugestoes`, `assistenteConversas`, `assistenteMensagens` (a `kb_chunks` fica só em SQL cru por causa do tipo `vector`).
- Modify `server/index.ts` — bloco de migração idempotente (extensão pgvector + tabelas + índices), no mesmo estilo dos existentes (~linha 275-510).
- Create `server/assistente-rag.ts` — chunking, embeddings, indexação, busca vetorial, detecção de conflito.
- Create `server/assistente-media.ts` — transcrição de áudio (Gemini REST inline_data) e extração de texto de imagem (ocrClient visão).
- Create `server/assistente.ts` — `registerAssistenteRoutes(app, requireAuth)`: chat SSE, feedback, CRUD de artigos, upload PDF, fila de sugestões, endpoint externo, métricas. Exporta `criarSugestao` e `classificarConteudo` (reusados pelo script de import).
- Create `server/assistente-import-biblioteca.ts` — script CLI (rodado com `npx tsx`) que importa a Biblioteca do WhatsApp CRM como sugestões.
- Modify `server/routes.ts` — importar e chamar `registerAssistenteRoutes(app, requireAuth)` (2 linhas, junto de `registerContractRoutes`/`registerOcrRoutes`, ~linha 30191).

**Frontend:**
- Create `client/src/components/assistente/config.ts` — nome do mascote + categorias (labels).
- Create `client/src/components/assistente/useAssistenteChat.ts` — hook do chat (estado + SSE + envio de áudio/imagem).
- Create `client/src/components/assistente/AssistenteWidget.tsx` — balão flutuante + painel de chat.
- Create `client/src/pages/base-conhecimento.tsx` — página de gestão (tabs Artigos / Fila de Aprovação / Métricas).
- Modify `client/src/App.tsx` — rota `/base-conhecimento` + montar `<AssistenteWidget />` no shell autenticado.
- Modify `client/src/components/app-sidebar.tsx` — item de menu "Base de Conhecimento" (só gestão).

---

## Task 0: Branch de trabalho

**Files:** nenhum (git apenas)

- [ ] **Step 1: Criar branch a partir de migracao-cloudfy**

```bash
cd "C:\Users\Fabio Setubal\Desktop\COWORK\Code\Capital-CRM"
git checkout migracao-cloudfy
git checkout -b feat/ia-corretores
```

- [ ] **Step 2: Verificar**

Run: `git branch --show-current`
Expected: `feat/ia-corretores`

---

## Task 1: Schema Drizzle + migração de boot (pgvector e tabelas)

**Files:**
- Modify: `shared/schema.ts` (adicionar no final, antes de qualquer bloco de types/exports finais)
- Modify: `server/index.ts` (dentro do IIFE de migrações, após o último bloco existente, ~linha 510)

**Interfaces:**
- Produces: tabelas Drizzle exportadas `kbArtigos`, `kbSugestoes`, `assistenteConversas`, `assistenteMensagens` (import de `@shared/schema` no server).
- Produces: tabela SQL `kb_chunks(id, artigo_id, ordem, texto, embedding vector(768), created_at)` — acessada só por SQL cru.

- [ ] **Step 1: Adicionar tabelas no `shared/schema.ts`**

Seguir o estilo das tabelas existentes (ex.: `apiKeys` ~linha 4039). Adicionar:

```typescript
// ============ IA INTERNA (MASCOTE) — BASE DE CONHECIMENTO ============

export const kbArtigos = pgTable("kb_artigos", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  conteudo: text("conteudo").notNull(), // markdown
  categoria: varchar("categoria", { length: 30 }).notNull(), // regras_banco | roteiros | dicas | atalhos_sistema
  banco: varchar("banco", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("rascunho"), // rascunho | publicado | arquivado
  origem: varchar("origem", { length: 30 }).notNull().default("manual"), // manual | pdf | audio | imagem | whatsapp | whatsapp_biblioteca
  origemRef: varchar("origem_ref", { length: 100 }), // id externo (dedupe import)
  criadoPor: integer("criado_por").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kbSugestoes = pgTable("kb_sugestoes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  tituloProposto: varchar("titulo_proposto", { length: 255 }).notNull(),
  conteudoProposto: text("conteudo_proposto").notNull(),
  categoriaProposta: varchar("categoria_proposta", { length: 30 }),
  bancoProposto: varchar("banco_proposto", { length: 100 }),
  origem: varchar("origem", { length: 30 }).notNull(), // pdf | audio | imagem | whatsapp | whatsapp_biblioteca
  origemRef: varchar("origem_ref", { length: 100 }),
  payloadBruto: text("payload_bruto"), // transcrição/extração original
  artigoConflitanteId: integer("artigo_conflitante_id").references(
    () => kbArtigos.id,
    { onDelete: "set null" },
  ),
  status: varchar("status", { length: 20 }).notNull().default("pendente"), // pendente | aprovada | rejeitada
  decididoPor: integer("decidido_por").references(() => users.id),
  decididoEm: timestamp("decidido_em"),
  criadoPor: integer("criado_por").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const assistenteConversas = pgTable("assistente_conversas", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  iniciadaEm: timestamp("iniciada_em").notNull().defaultNow(),
});

export const assistenteMensagens = pgTable("assistente_mensagens", {
  id: serial("id").primaryKey(),
  conversaId: integer("conversa_id")
    .notNull()
    .references(() => assistenteConversas.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 10 }).notNull(), // user | assistant
  conteudo: text("conteudo").notNull(),
  chunksUsados: jsonb("chunks_usados").$type<number[]>(),
  tokens: integer("tokens"),
  feedback: varchar("feedback", { length: 5 }), // up | down | null
  semResposta: boolean("sem_resposta").notNull().default(false),
  criadaEm: timestamp("criada_em").notNull().defaultNow(),
});
```

(Os imports `pgTable, serial, integer, varchar, text, timestamp, boolean, jsonb` já existem no topo do arquivo.)

- [ ] **Step 2: Adicionar bloco de migração no boot (`server/index.ts`)**

Colocar DEPOIS do último bloco de migração existente, dentro do mesmo try/catch geral (seguir o padrão `lemit_jobs`, linhas ~284-299). Usar o mesmo `migDb`/`migSql` já importados no escopo:

```typescript
// ===== IA INTERNA (MASCOTE) — base de conhecimento =====
try {
  // pgvector: no Supabase a extensão vive no schema "extensions" (que está no search_path)
  try {
    await migDb.execute(migSql`CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions`);
  } catch {
    await migDb.execute(migSql`CREATE EXTENSION IF NOT EXISTS vector`);
  }
  await migDb.execute(migSql`
    CREATE TABLE IF NOT EXISTS kb_artigos (
      id            SERIAL PRIMARY KEY,
      tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      titulo        VARCHAR(255) NOT NULL,
      conteudo      TEXT NOT NULL,
      categoria     VARCHAR(30) NOT NULL,
      banco         VARCHAR(100),
      status        VARCHAR(20) NOT NULL DEFAULT 'rascunho',
      origem        VARCHAR(30) NOT NULL DEFAULT 'manual',
      origem_ref    VARCHAR(100),
      criado_por    INTEGER REFERENCES users(id),
      created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await migDb.execute(migSql`
    CREATE TABLE IF NOT EXISTS kb_chunks (
      id            SERIAL PRIMARY KEY,
      artigo_id     INTEGER NOT NULL REFERENCES kb_artigos(id) ON DELETE CASCADE,
      ordem         INTEGER NOT NULL DEFAULT 0,
      texto         TEXT NOT NULL,
      embedding     vector(768),
      created_at    TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await migDb.execute(migSql`
    CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx ON kb_chunks
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)
  `);
  await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS kb_chunks_artigo_idx ON kb_chunks(artigo_id)`);
  await migDb.execute(migSql`
    CREATE TABLE IF NOT EXISTS kb_sugestoes (
      id                     SERIAL PRIMARY KEY,
      tenant_id              INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      titulo_proposto        VARCHAR(255) NOT NULL,
      conteudo_proposto      TEXT NOT NULL,
      categoria_proposta     VARCHAR(30),
      banco_proposto         VARCHAR(100),
      origem                 VARCHAR(30) NOT NULL,
      origem_ref             VARCHAR(100),
      payload_bruto          TEXT,
      artigo_conflitante_id  INTEGER REFERENCES kb_artigos(id) ON DELETE SET NULL,
      status                 VARCHAR(20) NOT NULL DEFAULT 'pendente',
      decidido_por           INTEGER REFERENCES users(id),
      decidido_em            TIMESTAMP,
      criado_por             INTEGER REFERENCES users(id),
      created_at             TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await migDb.execute(migSql`
    CREATE TABLE IF NOT EXISTS assistente_conversas (
      id            SERIAL PRIMARY KEY,
      tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      iniciada_em   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await migDb.execute(migSql`
    CREATE TABLE IF NOT EXISTS assistente_mensagens (
      id            SERIAL PRIMARY KEY,
      conversa_id   INTEGER NOT NULL REFERENCES assistente_conversas(id) ON DELETE CASCADE,
      role          VARCHAR(10) NOT NULL,
      conteudo      TEXT NOT NULL,
      chunks_usados JSONB,
      tokens        INTEGER,
      feedback      VARCHAR(5),
      sem_resposta  BOOLEAN NOT NULL DEFAULT FALSE,
      criada_em     TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_kb_sugestoes_status ON kb_sugestoes(tenant_id, status)`);
  await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_assistente_msgs_conversa ON assistente_mensagens(conversa_id)`);
  log("✓ Migração IA interna (kb_*, assistente_*) ok");
} catch (e) {
  log(`⚠ Migração IA interna falhou (non-fatal): ${e}`);
}
```

(Se o índice ivfflat falhar por a tabela estar vazia/permissão, é non-fatal — a busca funciona sem índice; só fica mais lenta.)

- [ ] **Step 3: Verificar tipos**

Run: `npm run check`
Expected: sem erros novos (erros pré-existentes do projeto, se houver, não contam).

- [ ] **Step 4: Verificar migração rodando o servidor**

Run: `npm run dev` (parar com Ctrl+C depois do boot)
Expected: log `✓ Migração IA interna (kb_*, assistente_*) ok` e servidor de pé. Se aparecer `⚠ ... type "vector" does not exist`, habilitar a extensão manualmente no Supabase (Dashboard → Database → Extensions → vector) e subir de novo.

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts server/index.ts
git commit -m "feat(assistente): tabelas da base de conhecimento + pgvector (migração boot)"
```

---

## Task 2: RAG core — chunking, embeddings, indexação e busca

**Files:**
- Create: `server/assistente-rag.ts`

**Interfaces:**
- Consumes: `db` de `./storage`, `ocrClient` de `./openaiClient`, tabela `kb_chunks` (Task 1).
- Produces (usadas nas Tasks 3-8):
  - `chunkarTexto(texto: string, tamanhoMax?: number): string[]`
  - `gerarEmbeddings(textos: string[]): Promise<number[][]>`
  - `indexarArtigo(artigoId: number, titulo: string, conteudo: string): Promise<number>` (retorna nº de chunks)
  - `removerChunksDoArtigo(artigoId: number): Promise<void>`
  - `buscarChunks(tenantId: number, pergunta: string, limite?: number): Promise<ChunkEncontrado[]>`
  - `buscarArtigoConflitante(tenantId: number, titulo: string, conteudo: string): Promise<{ artigoId: number; titulo: string; similaridade: number } | null>`
  - `type ChunkEncontrado = { chunkId: number; artigoId: number; titulo: string; categoria: string; banco: string | null; texto: string; similaridade: number }`

- [ ] **Step 1: Criar `server/assistente-rag.ts`**

```typescript
import { db } from "./storage";
import { sql } from "drizzle-orm";
import { ocrClient } from "./openaiClient";

const geminiKey = process.env.GEMINI_API_KEY;
export const EMBEDDING_MODEL =
  process.env.ASSISTENTE_EMBEDDING_MODEL ||
  (geminiKey ? "gemini-embedding-001" : "text-embedding-3-small");
export const EMBEDDING_DIM = 768;
export const CORTE_SIMILARIDADE = 0.5; // abaixo disso = "não sei"
export const CORTE_CONFLITO = 0.82; // acima disso = possível artigo duplicado/conflitante

export type ChunkEncontrado = {
  chunkId: number;
  artigoId: number;
  titulo: string;
  categoria: string;
  banco: string | null;
  texto: string;
  similaridade: number;
};

// linhas de resultado independem do driver (node-postgres = {rows}, postgres-js = array)
function pegarRows(res: unknown): any[] {
  return ((res as any)?.rows ?? res) as any[];
}

export function chunkarTexto(texto: string, tamanhoMax = 1800): string[] {
  const paragrafos = texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let atual = "";
  for (const p of paragrafos) {
    if (p.length > tamanhoMax) {
      if (atual) {
        chunks.push(atual);
        atual = "";
      }
      for (let i = 0; i < p.length; i += tamanhoMax) {
        chunks.push(p.slice(i, i + tamanhoMax));
      }
      continue;
    }
    if (atual && atual.length + p.length + 2 > tamanhoMax) {
      chunks.push(atual);
      atual = "";
    }
    atual = atual ? `${atual}\n\n${p}` : p;
  }
  if (atual) chunks.push(atual);
  return chunks;
}

function normalizarL2(v: number[]): number[] {
  const norma = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norma);
}

export async function gerarEmbeddings(textos: string[]): Promise<number[][]> {
  const res = await ocrClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: textos,
    dimensions: EMBEDDING_DIM,
  });
  return res.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => normalizarL2(d.embedding as number[]));
}

export async function removerChunksDoArtigo(artigoId: number): Promise<void> {
  await db.execute(sql`DELETE FROM kb_chunks WHERE artigo_id = ${artigoId}`);
}

export async function indexarArtigo(
  artigoId: number,
  titulo: string,
  conteudo: string,
): Promise<number> {
  await removerChunksDoArtigo(artigoId);
  const chunks = chunkarTexto(`${titulo}\n\n${conteudo}`);
  if (!chunks.length) return 0;
  const embeddings = await gerarEmbeddings(chunks);
  for (let i = 0; i < chunks.length; i++) {
    const vec = `[${embeddings[i].join(",")}]`;
    await db.execute(sql`
      INSERT INTO kb_chunks (artigo_id, ordem, texto, embedding)
      VALUES (${artigoId}, ${i}, ${chunks[i]}, ${vec}::vector)
    `);
  }
  return chunks.length;
}

export async function buscarChunks(
  tenantId: number,
  pergunta: string,
  limite = 8,
): Promise<ChunkEncontrado[]> {
  const [emb] = await gerarEmbeddings([pergunta]);
  const vec = `[${emb.join(",")}]`;
  const res = await db.execute(sql`
    SELECT kc.id AS chunk_id, kc.artigo_id, ka.titulo, ka.categoria, ka.banco, kc.texto,
           (1 - (kc.embedding <=> ${vec}::vector))::float AS similaridade
    FROM kb_chunks kc
    JOIN kb_artigos ka ON ka.id = kc.artigo_id
    WHERE ka.status = 'publicado' AND ka.tenant_id = ${tenantId}
    ORDER BY kc.embedding <=> ${vec}::vector
    LIMIT ${limite}
  `);
  return pegarRows(res).map((r) => ({
    chunkId: Number(r.chunk_id),
    artigoId: Number(r.artigo_id),
    titulo: r.titulo,
    categoria: r.categoria,
    banco: r.banco ?? null,
    texto: r.texto,
    similaridade: Number(r.similaridade),
  }));
}

export async function buscarArtigoConflitante(
  tenantId: number,
  titulo: string,
  conteudo: string,
): Promise<{ artigoId: number; titulo: string; similaridade: number } | null> {
  const top = await buscarChunks(
    tenantId,
    `${titulo}\n\n${conteudo.slice(0, 1500)}`,
    1,
  );
  if (top.length && top[0].similaridade >= CORTE_CONFLITO) {
    return {
      artigoId: top[0].artigoId,
      titulo: top[0].titulo,
      similaridade: top[0].similaridade,
    };
  }
  return null;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run check`
Expected: sem erros novos. (Se o SDK OpenAI reclamar de `dimensions`, checar se está dentro de `embeddings.create` — o v6 aceita.)

- [ ] **Step 3: Smoke do embedding (chave real)**

Run (PowerShell, na raiz do projeto, com `.env`/envs do dev carregados como o `npm run dev` usa — se as envs estão só no Railway, pular este step e validar na Task 3 via endpoint):

```bash
npx tsx -e "import('./server/assistente-rag.ts').then(async m => { const [e] = await m.gerarEmbeddings(['portabilidade BRB']); console.log('dim:', e.length, 'norma~1:', e.reduce((s,x)=>s+x*x,0).toFixed(3)); })"
```

Expected: `dim: 768 norma~1: 1.000`

- [ ] **Step 4: Commit**

```bash
git add server/assistente-rag.ts
git commit -m "feat(assistente): RAG core (chunking, embeddings Gemini 768d, busca pgvector)"
```

---

## Task 3: Rotas de gestão da base (CRUD de artigos) + registro em routes.ts

**Files:**
- Create: `server/assistente.ts`
- Modify: `server/routes.ts` (~linha 546 o import, ~linha 30194 a chamada)

**Interfaces:**
- Consumes: `indexarArtigo`, `removerChunksDoArtigo`, `buscarArtigoConflitante` (Task 2); tabelas Drizzle (Task 1); `requireAuth` (recebido por parâmetro, mesmo padrão de `registerContractRoutes(app, requireAuth)`).
- Produces:
  - `registerAssistenteRoutes(app: Express, requireAuth: Function): void`
  - `podeGerenciarKb(user: any): boolean` (exportada)
  - `classificarConteudo(texto: string): Promise<{ titulo: string; categoria: string; banco: string | null; conteudo: string }>` (exportada — usada por upload/captura/import)
  - `criarSugestao(dados: { tenantId: number; titulo: string; conteudo: string; categoria?: string | null; banco?: string | null; origem: string; origemRef?: string | null; payloadBruto?: string | null; criadoPor?: number | null }): Promise<{ id: number; duplicada: boolean }>` (exportada)
  - HTTP: `GET /api/assistente/kb` (lista, gestão), `POST /api/assistente/kb` (cria), `PATCH /api/assistente/kb/:id` (edita/publica/arquiva)

- [ ] **Step 1: Criar `server/assistente.ts` com CRUD + helpers**

```typescript
import type { Express, Request, Response } from "express";
import { db } from "./storage";
import { and, desc, eq } from "drizzle-orm";
import {
  kbArtigos,
  kbSugestoes,
  assistenteConversas,
  assistenteMensagens,
  aiPrompts,
} from "@shared/schema";
import { ocrClient, ocrModel } from "./openaiClient";
import {
  indexarArtigo,
  removerChunksDoArtigo,
  buscarArtigoConflitante,
  buscarChunks,
  CORTE_SIMILARIDADE,
} from "./assistente-rag";

export const CATEGORIAS_KB = [
  "regras_banco",
  "roteiros",
  "dicas",
  "atalhos_sistema",
] as const;

export function podeGerenciarKb(user: any): boolean {
  return !!user && (user.isMaster || ["master", "operacional"].includes(user.role));
}

function requireGestorKb(req: any, res: Response, next: Function) {
  if (!podeGerenciarKb(req.user)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

/** Classifica conteúdo bruto em título/categoria/banco via LLM (JSON). */
export async function classificarConteudo(texto: string): Promise<{
  titulo: string;
  categoria: string;
  banco: string | null;
  conteudo: string;
}> {
  const completion = await ocrClient.chat.completions.create({
    model: ocrModel,
    messages: [
      {
        role: "user",
        content: `Você organiza uma base de conhecimento de uma correspondente bancária de crédito consignado.
Analise o conteúdo abaixo e responda SOMENTE um JSON válido, sem markdown, no formato:
{"titulo": "título curto e claro", "categoria": "regras_banco|roteiros|dicas|atalhos_sistema", "banco": "nome do banco ou null", "conteudo": "o conteúdo reescrito limpo em markdown, preservando TODAS as informações"}

CONTEÚDO:
${texto.slice(0, 12000)}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 4000,
  });
  const raw = completion.choices[0]?.message?.content || "{}";
  const jsonStr = raw.replace(/^```(json)?/m, "").replace(/```$/m, "").trim();
  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = {};
  }
  const categoria = CATEGORIAS_KB.includes(parsed.categoria)
    ? parsed.categoria
    : "dicas";
  return {
    titulo: String(parsed.titulo || "Conhecimento sem título").slice(0, 255),
    categoria,
    banco: parsed.banco ? String(parsed.banco).slice(0, 100) : null,
    conteudo: String(parsed.conteudo || texto),
  };
}

/** Cria sugestão na fila com dedupe por origem+origemRef e detecção de conflito. */
export async function criarSugestao(dados: {
  tenantId: number;
  titulo: string;
  conteudo: string;
  categoria?: string | null;
  banco?: string | null;
  origem: string;
  origemRef?: string | null;
  payloadBruto?: string | null;
  criadoPor?: number | null;
}): Promise<{ id: number; duplicada: boolean }> {
  if (dados.origemRef) {
    const [existente] = await db
      .select({ id: kbSugestoes.id })
      .from(kbSugestoes)
      .where(
        and(
          eq(kbSugestoes.tenantId, dados.tenantId),
          eq(kbSugestoes.origem, dados.origem),
          eq(kbSugestoes.origemRef, dados.origemRef),
        ),
      )
      .limit(1);
    if (existente) return { id: existente.id, duplicada: true };
  }
  let conflitanteId: number | null = null;
  try {
    const conflito = await buscarArtigoConflitante(
      dados.tenantId,
      dados.titulo,
      dados.conteudo,
    );
    conflitanteId = conflito?.artigoId ?? null;
  } catch {
    // detecção de conflito é best-effort; sem embedding a sugestão entra mesmo assim
  }
  const [nova] = await db
    .insert(kbSugestoes)
    .values({
      tenantId: dados.tenantId,
      tituloProposto: dados.titulo.slice(0, 255),
      conteudoProposto: dados.conteudo,
      categoriaProposta: dados.categoria ?? null,
      bancoProposto: dados.banco ?? null,
      origem: dados.origem,
      origemRef: dados.origemRef ?? null,
      payloadBruto: dados.payloadBruto ?? null,
      artigoConflitanteId: conflitanteId,
      criadoPor: dados.criadoPor ?? null,
    })
    .returning({ id: kbSugestoes.id });
  return { id: nova.id, duplicada: false };
}

export function registerAssistenteRoutes(app: Express, requireAuth: Function) {
  // ---------- CRUD de artigos (gestão) ----------
  app.get("/api/assistente/kb", requireAuth, requireGestorKb, async (req: any, res) => {
    const artigos = await db
      .select()
      .from(kbArtigos)
      .where(eq(kbArtigos.tenantId, req.user.tenantId))
      .orderBy(desc(kbArtigos.updatedAt));
    res.json(artigos);
  });

  app.post("/api/assistente/kb", requireAuth, requireGestorKb, async (req: any, res) => {
    const { titulo, conteudo, categoria, banco, status } = req.body || {};
    if (!titulo || !conteudo || !CATEGORIAS_KB.includes(categoria)) {
      return res.status(422).json({ message: "titulo, conteudo e categoria válida são obrigatórios" });
    }
    const [artigo] = await db
      .insert(kbArtigos)
      .values({
        tenantId: req.user.tenantId,
        titulo: String(titulo).slice(0, 255),
        conteudo,
        categoria,
        banco: banco || null,
        status: status === "publicado" ? "publicado" : "rascunho",
        origem: "manual",
        criadoPor: req.user.id,
      })
      .returning();
    if (artigo.status === "publicado") {
      await indexarArtigo(artigo.id, artigo.titulo, artigo.conteudo);
    }
    res.json(artigo);
  });

  app.patch("/api/assistente/kb/:id", requireAuth, requireGestorKb, async (req: any, res) => {
    const id = Number(req.params.id);
    const [atual] = await db
      .select()
      .from(kbArtigos)
      .where(and(eq(kbArtigos.id, id), eq(kbArtigos.tenantId, req.user.tenantId)))
      .limit(1);
    if (!atual) return res.status(404).json({ message: "Artigo não encontrado" });

    const { titulo, conteudo, categoria, banco, status } = req.body || {};
    if (categoria && !CATEGORIAS_KB.includes(categoria)) {
      return res.status(422).json({ message: "categoria inválida" });
    }
    if (status && !["rascunho", "publicado", "arquivado"].includes(status)) {
      return res.status(422).json({ message: "status inválido" });
    }
    const [artigo] = await db
      .update(kbArtigos)
      .set({
        titulo: titulo !== undefined ? String(titulo).slice(0, 255) : atual.titulo,
        conteudo: conteudo !== undefined ? conteudo : atual.conteudo,
        categoria: categoria ?? atual.categoria,
        banco: banco !== undefined ? banco || null : atual.banco,
        status: status ?? atual.status,
        updatedAt: new Date(),
      })
      .where(eq(kbArtigos.id, id))
      .returning();

    if (artigo.status === "publicado") {
      await indexarArtigo(artigo.id, artigo.titulo, artigo.conteudo);
    } else {
      await removerChunksDoArtigo(artigo.id); // rascunho/arquivado sai da busca
    }
    res.json(artigo);
  });
}
```

- [ ] **Step 2: Registrar em `server/routes.ts`**

Junto dos imports dos módulos (~linha 546):

```typescript
import { registerAssistenteRoutes } from "./assistente";
```

Junto das chamadas (~linha 30194, depois de `registerOcrRoutes(app, requireAuth);`):

```typescript
registerAssistenteRoutes(app, requireAuth);
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run check`
Expected: sem erros novos.

- [ ] **Step 4: Smoke manual (navegador logado como master)**

Com `npm run dev` rodando e logado no app, no console do navegador:

```javascript
await fetch("/api/assistente/kb", { method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include", body: JSON.stringify({ titulo: "TESTE - Bancos que o BRB porta", conteudo: "O BRB PORTA: BB, Itaú, Caixa, Bradesco, Sicoob, Alfa, Nu Financeira, Inter, QI, Mercantil, Santander (só contratos 20/30/40) e Daycoval. NÃO PORTA: C6, AgiBank, PicPay, BRB CFI.", categoria: "regras_banco", banco: "BRB", status: "publicado" }) }).then(r => r.json())
```

Expected: JSON do artigo com `id` e `status: "publicado"`. Depois `SELECT count(*) FROM kb_chunks` no Supabase (ou via listagem) deve mostrar chunk(s) criado(s).

- [ ] **Step 5: Commit**

```bash
git add server/assistente.ts server/routes.ts
git commit -m "feat(assistente): CRUD de artigos da base de conhecimento com indexação automática"
```

---

## Task 4: Chat SSE com RAG + persona + feedback

**Files:**
- Modify: `server/assistente.ts`

**Interfaces:**
- Consumes: `buscarChunks`, `CORTE_SIMILARIDADE` (Task 2), tabelas de conversa (Task 1), `aiPrompts`.
- Produces (HTTP):
  - `POST /api/assistente/chat` body JSON `{ conversaId?: number, mensagem: string }` → SSE (`text/event-stream`): eventos `data: {"delta": "..."}` durante o stream e final `data: {"done": true, "conversaId": n, "mensagemId": n, "semResposta": bool, "fontes": [{"artigoId": n, "titulo": "..."}]}`
  - `POST /api/assistente/feedback` body `{ mensagemId: number, feedback: "up" | "down" }` → `{ ok: true }`

- [ ] **Step 1: Adicionar persona default e helper de prompt no topo de `server/assistente.ts`**

```typescript
export const NOME_MASCOTE = process.env.ASSISTENTE_NOME || "Capi";

const PERSONA_DEFAULT = `Você é ${NOME_MASCOTE}, o mascote assistente interno dos corretores da Capital (crédito consignado).
Personalidade: simpático, direto, didático, brasileiro. Trata o corretor como colega de equipe.

REGRAS INEGOCIÁVEIS:
1. Responda APENAS com base nos TRECHOS DA BASE DE CONHECIMENTO fornecidos abaixo. NUNCA use conhecimento externo sobre regras de banco, taxas, prazos ou processos.
2. Se os trechos não respondem a pergunta, diga exatamente que não tem essa informação na base e oriente procurar o gestor. NÃO tente adivinhar.
3. Ao final da resposta, cite as fontes usadas no formato: "📎 Fonte: <título do artigo>" (uma linha por fonte distinta).
4. Seja conciso: responda em poucos parágrafos ou passos numerados.
5. NUNCA invente números, percentuais, nomes de banco ou regras que não estejam nos trechos.`;

async function obterPersona(): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(aiPrompts)
      .where(
        and(
          eq(aiPrompts.type, "assistente"),
          eq(aiPrompts.scope, "global"),
          eq(aiPrompts.isActive, true),
        ),
      )
      .limit(1);
    if (row?.promptText) return row.promptText;
  } catch {
    // fallback silencioso
  }
  return PERSONA_DEFAULT;
}

const RESPOSTA_NAO_SEI = `Hmm, essa eu ainda não tenho na minha base de conhecimento. 🙈
Recomendo confirmar com seu gestor — e se a resposta for útil pra todo mundo, pede pra ele me ensinar que eu guardo pra próxima!`;
```

- [ ] **Step 2: Adicionar as rotas de chat e feedback dentro de `registerAssistenteRoutes`**

```typescript
  // ---------- Chat (qualquer usuário autenticado) ----------
  app.post("/api/assistente/chat", requireAuth, async (req: any, res: Response) => {
    const { conversaId, mensagem } = req.body || {};
    const texto = String(mensagem || "").trim();
    if (!texto) return res.status(422).json({ message: "mensagem é obrigatória" });

    // resolve conversa (do próprio usuário)
    let convId = Number(conversaId) || 0;
    if (convId) {
      const [conv] = await db
        .select()
        .from(assistenteConversas)
        .where(
          and(
            eq(assistenteConversas.id, convId),
            eq(assistenteConversas.userId, req.user.id),
          ),
        )
        .limit(1);
      if (!conv) convId = 0;
    }
    if (!convId) {
      const [nova] = await db
        .insert(assistenteConversas)
        .values({ tenantId: req.user.tenantId, userId: req.user.id })
        .returning({ id: assistenteConversas.id });
      convId = nova.id;
    }

    // grava a pergunta
    await db.insert(assistenteMensagens).values({
      conversaId: convId,
      role: "user",
      conteudo: texto,
    });

    // SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const enviar = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
      const chunks = await buscarChunks(req.user.tenantId, texto, 8);
      const relevantes = chunks.filter((c) => c.similaridade >= CORTE_SIMILARIDADE);

      if (!relevantes.length) {
        const [msg] = await db
          .insert(assistenteMensagens)
          .values({
            conversaId: convId,
            role: "assistant",
            conteudo: RESPOSTA_NAO_SEI,
            semResposta: true,
          })
          .returning({ id: assistenteMensagens.id });
        enviar({ delta: RESPOSTA_NAO_SEI });
        enviar({ done: true, conversaId: convId, mensagemId: msg.id, semResposta: true, fontes: [] });
        return res.end();
      }

      // histórico recente da conversa (máx 20 mensagens anteriores)
      const historico = await db
        .select()
        .from(assistenteMensagens)
        .where(eq(assistenteMensagens.conversaId, convId))
        .orderBy(desc(assistenteMensagens.id))
        .limit(21);
      const anteriores = historico
        .slice(1) // remove a pergunta que acabou de ser gravada
        .reverse()
        .map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
          content: m.conteudo,
        }));

      const trechos = relevantes
        .map((c, i) => `[${i + 1}] (Artigo: "${c.titulo}"${c.banco ? `, Banco: ${c.banco}` : ""})\n${c.texto}`)
        .join("\n\n---\n\n");
      const persona = await obterPersona();
      const system = `${persona}\n\n===== TRECHOS DA BASE DE CONHECIMENTO =====\n${trechos}`;

      const stream = await ocrClient.chat.completions.create({
        model: ocrModel,
        stream: true,
        temperature: 0.3,
        max_tokens: 1500,
        messages: [
          { role: "system", content: system },
          ...anteriores,
          { role: "user", content: texto },
        ],
      });

      let resposta = "";
      const timeoutMs = 30000;
      const inicio = Date.now();
      for await (const parte of stream) {
        const delta = parte.choices?.[0]?.delta?.content || "";
        if (delta) {
          resposta += delta;
          enviar({ delta });
        }
        if (Date.now() - inicio > timeoutMs) break;
      }
      if (!resposta.trim()) resposta = RESPOSTA_NAO_SEI;

      const fontesUnicas = Array.from(
        new Map(relevantes.map((c) => [c.artigoId, { artigoId: c.artigoId, titulo: c.titulo }])).values(),
      );
      const [msg] = await db
        .insert(assistenteMensagens)
        .values({
          conversaId: convId,
          role: "assistant",
          conteudo: resposta,
          chunksUsados: relevantes.map((c) => c.chunkId),
          semResposta: false,
        })
        .returning({ id: assistenteMensagens.id });
      enviar({ done: true, conversaId: convId, mensagemId: msg.id, semResposta: false, fontes: fontesUnicas });
      res.end();
    } catch (err: any) {
      console.error("[assistente/chat] erro:", err);
      enviar({ delta: "Opa, tive um probleminha técnico aqui. 😵 Tenta de novo em instantes!" });
      enviar({ done: true, conversaId: convId, erro: true, fontes: [] });
      res.end();
    }
  });

  // ---------- Feedback ----------
  app.post("/api/assistente/feedback", requireAuth, async (req: any, res) => {
    const { mensagemId, feedback } = req.body || {};
    if (!["up", "down"].includes(feedback)) {
      return res.status(422).json({ message: "feedback deve ser up ou down" });
    }
    // garante que a mensagem pertence a uma conversa do usuário
    const res1 = await db
      .select({ id: assistenteMensagens.id })
      .from(assistenteMensagens)
      .innerJoin(
        assistenteConversas,
        eq(assistenteMensagens.conversaId, assistenteConversas.id),
      )
      .where(
        and(
          eq(assistenteMensagens.id, Number(mensagemId)),
          eq(assistenteConversas.userId, req.user.id),
        ),
      )
      .limit(1);
    if (!res1.length) return res.status(404).json({ message: "Mensagem não encontrada" });
    await db
      .update(assistenteMensagens)
      .set({ feedback })
      .where(eq(assistenteMensagens.id, Number(mensagemId)));
    res.json({ ok: true });
  });
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run check`
Expected: sem erros novos.

- [ ] **Step 4: Smoke manual do chat (com o artigo TESTE da Task 3 publicado)**

No console do navegador logado:

```javascript
const r = await fetch("/api/assistente/chat", { method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include", body: JSON.stringify({ mensagem: "quais bancos o BRB porta?" }) });
const reader = r.body.getReader(); const dec = new TextDecoder(); let out = "";
while (true) { const {done, value} = await reader.read(); if (done) break; out += dec.decode(value); }
console.log(out);
```

Expected: sequência de `data: {"delta": ...}` citando BB/Itaú/etc, terminando com `data: {"done":true,...,"fontes":[{"artigoId":..,"titulo":"TESTE - Bancos que o BRB porta"}]}`.

Testar também o "não sei": mandar `{ mensagem: "qual a receita de bolo de fubá?" }` → resposta padrão + `"semResposta":true`.

- [ ] **Step 5: Commit**

```bash
git add server/assistente.ts
git commit -m "feat(assistente): chat SSE com RAG, persona editável, corte anti-alucinação e feedback"
```

---

## Task 5: Upload de PDF → artigo rascunho

**Files:**
- Modify: `server/assistente.ts`

**Interfaces:**
- Consumes: `extractTextFromPdf(buffer: Buffer): Promise<string>` de `./roteiros-pdf-service` (já existe); `classificarConteudo` (Task 3); multer.
- Produces (HTTP): `POST /api/assistente/kb/upload` multipart campo `arquivo` (PDF) → `{ artigo: {...} }` (status sempre `rascunho`).

- [ ] **Step 1: Adicionar imports e o multer no topo de `server/assistente.ts`**

```typescript
import multer from "multer";
import { extractTextFromPdf } from "./roteiros-pdf-service";

const uploadKb = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});
```

(Conferir o nome exato da função exportada em `server/roteiros-pdf-service.ts` — se for outro nome, usar o real; a função existente usa `pdfjs-dist` e retorna o texto completo.)

- [ ] **Step 2: Adicionar a rota dentro de `registerAssistenteRoutes`**

```typescript
  // ---------- Upload PDF → rascunho ----------
  app.post(
    "/api/assistente/kb/upload",
    requireAuth,
    requireGestorKb,
    uploadKb.single("arquivo"),
    async (req: any, res) => {
      const file = req.file;
      if (!file) return res.status(422).json({ message: "arquivo é obrigatório" });
      if (!file.originalname.toLowerCase().endsWith(".pdf")) {
        return res.status(422).json({ message: "Apenas PDF é aceito por enquanto" });
      }
      let texto = "";
      try {
        texto = await extractTextFromPdf(file.buffer);
      } catch (e) {
        console.error("[assistente/upload] extração falhou:", e);
        return res.status(422).json({ message: "Não consegui extrair texto deste PDF" });
      }
      if (!texto.trim() || texto.trim().length < 50) {
        return res.status(422).json({ message: "PDF sem texto legível (pode ser imagem escaneada)" });
      }
      const clas = await classificarConteudo(texto);
      const [artigo] = await db
        .insert(kbArtigos)
        .values({
          tenantId: req.user.tenantId,
          titulo: clas.titulo,
          conteudo: clas.conteudo,
          categoria: clas.categoria,
          banco: clas.banco,
          status: "rascunho", // SEMPRE rascunho — revisão humana obrigatória
          origem: "pdf",
          origemRef: file.originalname.slice(0, 100),
          criadoPor: req.user.id,
        })
        .returning();
      res.json({ artigo });
    },
  );
```

- [ ] **Step 3: Verificar tipos e smoke**

Run: `npm run check` → sem erros novos.
Smoke (navegador logado, com um PDF qualquer de comunicado):

```javascript
const fd = new FormData();
fd.append("arquivo", document.querySelector('input[type=file]')?.files?.[0] ?? await (await fetch("/favicon.ico")).blob(), "teste.pdf");
// mais fácil: testar depois pela tela da Task 11; aqui basta conferir 422 p/ arquivo inválido:
await fetch("/api/assistente/kb/upload", { method: "POST", credentials: "include", body: fd }).then(r => r.json())
```

Expected: com arquivo não-PDF → `{"message":"Apenas PDF é aceito por enquanto"}`. Teste com PDF real fica pro smoke da tela (Task 11).

- [ ] **Step 4: Commit**

```bash
git add server/assistente.ts
git commit -m "feat(assistente): upload de PDF vira artigo rascunho com classificação automática"
```

---

## Task 6: Fila de sugestões — listar, aprovar (novo/substituir), rejeitar

**Files:**
- Modify: `server/assistente.ts`

**Interfaces:**
- Consumes: `criarSugestao` (Task 3), `indexarArtigo`/`removerChunksDoArtigo` (Task 2).
- Produces (HTTP):
  - `GET /api/assistente/kb/sugestoes?status=pendente` → lista com artigo conflitante embutido (`conflito: { id, titulo, conteudo } | null`)
  - `POST /api/assistente/kb/sugestoes/:id/decidir` body `{ acao: "aprovar" | "rejeitar", modo?: "novo" | "substituir", edicao?: { titulo?, conteudo?, categoria?, banco? } }` → `{ ok: true, artigoId?: number }`

- [ ] **Step 1: Adicionar rotas dentro de `registerAssistenteRoutes`**

```typescript
  // ---------- Fila de sugestões ----------
  app.get("/api/assistente/kb/sugestoes", requireAuth, requireGestorKb, async (req: any, res) => {
    const status = String(req.query.status || "pendente");
    const sugestoes = await db
      .select()
      .from(kbSugestoes)
      .where(
        and(
          eq(kbSugestoes.tenantId, req.user.tenantId),
          eq(kbSugestoes.status, status),
        ),
      )
      .orderBy(desc(kbSugestoes.createdAt));
    // embute o artigo conflitante (para o comparativo lado a lado)
    const resultado = [];
    for (const s of sugestoes) {
      let conflito = null;
      if (s.artigoConflitanteId) {
        const [art] = await db
          .select({ id: kbArtigos.id, titulo: kbArtigos.titulo, conteudo: kbArtigos.conteudo })
          .from(kbArtigos)
          .where(eq(kbArtigos.id, s.artigoConflitanteId))
          .limit(1);
        conflito = art ?? null;
      }
      resultado.push({ ...s, conflito });
    }
    res.json(resultado);
  });

  app.post(
    "/api/assistente/kb/sugestoes/:id/decidir",
    requireAuth,
    requireGestorKb,
    async (req: any, res) => {
      const id = Number(req.params.id);
      const { acao, modo, edicao } = req.body || {};
      if (!["aprovar", "rejeitar"].includes(acao)) {
        return res.status(422).json({ message: "acao deve ser aprovar ou rejeitar" });
      }
      const [sug] = await db
        .select()
        .from(kbSugestoes)
        .where(
          and(
            eq(kbSugestoes.id, id),
            eq(kbSugestoes.tenantId, req.user.tenantId),
            eq(kbSugestoes.status, "pendente"),
          ),
        )
        .limit(1);
      if (!sug) return res.status(404).json({ message: "Sugestão pendente não encontrada" });

      if (acao === "rejeitar") {
        await db
          .update(kbSugestoes)
          .set({ status: "rejeitada", decididoPor: req.user.id, decididoEm: new Date() })
          .where(eq(kbSugestoes.id, id));
        return res.json({ ok: true });
      }

      // aprovar
      const titulo = String(edicao?.titulo || sug.tituloProposto).slice(0, 255);
      const conteudo = String(edicao?.conteudo || sug.conteudoProposto);
      const categoria = CATEGORIAS_KB.includes(edicao?.categoria ?? sug.categoriaProposta)
        ? (edicao?.categoria ?? sug.categoriaProposta)
        : "dicas";
      const banco = edicao?.banco !== undefined ? edicao.banco || null : sug.bancoProposto;

      const [artigo] = await db
        .insert(kbArtigos)
        .values({
          tenantId: req.user.tenantId,
          titulo,
          conteudo,
          categoria,
          banco,
          status: "publicado",
          origem: sug.origem,
          origemRef: sug.origemRef,
          criadoPor: req.user.id,
        })
        .returning();
      await indexarArtigo(artigo.id, artigo.titulo, artigo.conteudo);

      // substituir: arquiva o antigo e tira da busca (histórico preservado)
      if (modo === "substituir" && sug.artigoConflitanteId) {
        await db
          .update(kbArtigos)
          .set({ status: "arquivado", updatedAt: new Date() })
          .where(
            and(
              eq(kbArtigos.id, sug.artigoConflitanteId),
              eq(kbArtigos.tenantId, req.user.tenantId),
            ),
          );
        await removerChunksDoArtigo(sug.artigoConflitanteId);
      }

      await db
        .update(kbSugestoes)
        .set({ status: "aprovada", decididoPor: req.user.id, decididoEm: new Date() })
        .where(eq(kbSugestoes.id, id));
      res.json({ ok: true, artigoId: artigo.id });
    },
  );
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run check`
Expected: sem erros novos.

- [ ] **Step 3: Smoke manual (console do navegador, logado como gestor)**

```javascript
// cria uma sugestão "na mão" via SQL não dá pelo navegador — teste indireto:
// 1. cria sugestão parecida com o artigo TESTE (deve detectar conflito quando o endpoint externo/áudio existir);
// por ora valida listagem vazia e decisão 404:
await fetch("/api/assistente/kb/sugestoes?status=pendente", { credentials: "include" }).then(r => r.json()); // → []
await fetch("/api/assistente/kb/sugestoes/99999/decidir", { method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include", body: JSON.stringify({ acao: "aprovar" }) }).then(r => r.status); // → 404
```

Expected: `[]` e `404`. O fluxo completo aprova-se no smoke da Task 8 (endpoint externo cria sugestão de verdade).

- [ ] **Step 4: Commit**

```bash
git add server/assistente.ts
git commit -m "feat(assistente): fila de sugestões com aprovação, substituição de artigo conflitante e rejeição"
```

---

## Task 7: Áudio e imagem no chat (pergunta por voz + captura de conhecimento)

**Files:**
- Create: `server/assistente-media.ts`
- Modify: `server/assistente.ts`

**Interfaces:**
- Consumes: `GEMINI_API_KEY` (env), `ocrClient`/`ocrModel`.
- Produces:
  - `transcreverAudio(buffer: Buffer, mimeType: string): Promise<string>`
  - `extrairTextoImagem(buffer: Buffer, mimeType: string): Promise<string>`
  - HTTP: `POST /api/assistente/chat` passa a aceitar **multipart** com campo `arquivo` (audio/* ou image/*) + campos texto `conversaId`, `mensagem`, `modoCaptura` ("1" = gestor quer guardar conhecimento). Resposta: mesmo SSE da Task 4; no modo captura, evento final `data: {"done":true,"captura":true,"sugestaoId":n,"resumo":"..."}`.

- [ ] **Step 1: Criar `server/assistente-media.ts`**

```typescript
import { ocrClient, ocrModel } from "./openaiClient";

/** Transcreve áudio via Gemini REST (inline_data) — mesmo padrão do WhatsApp CRM. */
export async function transcreverAudio(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY não configurada — áudio requer Gemini");
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Transcreva este áudio em português do Brasil. Responda SOMENTE com a transcrição, sem comentários.",
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: buffer.toString("base64"),
                },
              },
            ],
          },
        ],
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini áudio: HTTP ${res.status}`);
  const data: any = await res.json();
  const texto =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || "")
      .join("") ?? "";
  return texto.trim();
}

/** Extrai texto/conteúdo de imagem (print, comunicado, tabela) via visão. */
export async function extrairTextoImagem(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const completion = await ocrClient.chat.completions.create({
    model: ocrModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extraia TODO o texto e as informações relevantes desta imagem (comunicado, tabela ou print de sistema bancário). Responda SOMENTE com o conteúdo extraído, organizado em português.",
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}` },
          },
        ],
      },
    ],
    max_tokens: 3000,
  });
  return (completion.choices[0]?.message?.content || "").trim();
}
```

- [ ] **Step 2: Adaptar `POST /api/assistente/chat` em `server/assistente.ts`**

Trocar a assinatura da rota para aceitar multipart opcional e resolver o texto de entrada antes do fluxo atual:

```typescript
import { transcreverAudio, extrairTextoImagem } from "./assistente-media";

// multer p/ mídia do chat (25MB)
const uploadChat = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
```

Na rota (substituir `app.post("/api/assistente/chat", requireAuth, async ...)` por):

```typescript
  app.post(
    "/api/assistente/chat",
    requireAuth,
    uploadChat.single("arquivo"),
    async (req: any, res: Response) => {
      const { conversaId, mensagem, modoCaptura } = req.body || {};
      let texto = String(mensagem || "").trim();
      let extraidoDeMidia = "";
      let origemMidia: "audio" | "imagem" | null = null;

      try {
        if (req.file) {
          const mime = req.file.mimetype || "";
          if (mime.startsWith("audio/")) {
            extraidoDeMidia = await transcreverAudio(req.file.buffer, mime);
            origemMidia = "audio";
          } else if (mime.startsWith("image/")) {
            extraidoDeMidia = await extrairTextoImagem(req.file.buffer, mime);
            origemMidia = "imagem";
          } else {
            return res.status(422).json({ message: "Arquivo deve ser áudio ou imagem" });
          }
        }
      } catch (e: any) {
        console.error("[assistente/chat] mídia falhou:", e);
        return res.status(422).json({ message: "Não consegui processar o áudio/imagem" });
      }

      if (extraidoDeMidia) {
        texto = texto
          ? `${texto}\n\n[Conteúdo do ${origemMidia}]:\n${extraidoDeMidia}`
          : extraidoDeMidia;
      }
      if (!texto) return res.status(422).json({ message: "mensagem é obrigatória" });

      // ---- MODO CAPTURA (só gestores): guarda conhecimento em vez de responder ----
      if (modoCaptura === "1" && podeGerenciarKb(req.user)) {
        const clas = await classificarConteudo(texto);
        const { id: sugestaoId } = await criarSugestao({
          tenantId: req.user.tenantId,
          titulo: clas.titulo,
          conteudo: clas.conteudo,
          categoria: clas.categoria,
          banco: clas.banco,
          origem: origemMidia ?? "manual",
          payloadBruto: texto,
          criadoPor: req.user.id,
        });
        return res.json({
          captura: true,
          sugestaoId,
          resumo: `Guardei como sugestão: "${clas.titulo}" (${clas.categoria}${clas.banco ? `, ${clas.banco}` : ""}). Aprova lá na Base de Conhecimento → Fila!`,
        });
      }

      // ---- fluxo normal do chat (código da Task 4, a partir de "resolve conversa") ----
      // ... (o restante do handler permanece IGUAL, usando a variável `texto`)
```

(O corpo do RAG/SSE da Task 4 permanece o mesmo — só muda a resolução do `texto` no início e o retorno JSON no modo captura, que NÃO usa SSE.)

- [ ] **Step 3: Verificar tipos**

Run: `npm run check`
Expected: sem erros novos.

- [ ] **Step 4: Smoke do modo captura (console navegador, gestor)**

```javascript
const fd = new FormData();
fd.append("mensagem", "O Daycoval agora exige 5% de margem livre no cartão. Guarda isso.");
fd.append("modoCaptura", "1");
await fetch("/api/assistente/chat", { method: "POST", credentials: "include", body: fd }).then(r => r.json());
```

Expected: `{"captura":true,"sugestaoId":N,"resumo":"Guardei como sugestão: ..."}`. Depois `GET /api/assistente/kb/sugestoes?status=pendente` mostra a sugestão. Aprovar via `POST /api/assistente/kb/sugestoes/N/decidir {acao:"aprovar"}` → cria artigo publicado (valida o ciclo completo da Task 6). Áudio/imagem reais valida-se pela tela (Task 10).

- [ ] **Step 5: Commit**

```bash
git add server/assistente-media.ts server/assistente.ts
git commit -m "feat(assistente): áudio e imagem no chat + modo captura de conhecimento p/ gestores"
```

---

## Task 8: Endpoint externo para o WhatsApp CRM (API key)

**Files:**
- Modify: `server/assistente.ts`

**Interfaces:**
- Consumes: `requireApiKey` e types de `./api-key-middleware` (já existe: valida header `X-API-Key`, seta `req.apiTenantId` e `req.apiKeyEscopos`); `criarSugestao` (Task 3).
- Produces (HTTP): `POST /api/assistente/kb/sugestoes/externa` header `X-API-Key: <chave>` body JSON `{ titulo: string, conteudo: string, categoria?: string, banco?: string, origemRef?: string }` → `201 { sugestaoId, duplicada }`. Exige escopo `"kb_sugestoes"` na chave.

- [ ] **Step 1: Adicionar rota (fora do `requireAuth` de sessão) em `registerAssistenteRoutes`**

```typescript
import { requireApiKey } from "./api-key-middleware";
```

```typescript
  // ---------- Sugestões vindas do WhatsApp CRM (API key, sem sessão) ----------
  app.post("/api/assistente/kb/sugestoes/externa", requireApiKey, async (req: any, res) => {
    const escopos: string[] = req.apiKeyEscopos || [];
    if (!escopos.includes("kb_sugestoes")) {
      return res.status(403).json({ error: "API key sem escopo kb_sugestoes" });
    }
    const { titulo, conteudo, categoria, banco, origemRef } = req.body || {};
    if (!titulo || !conteudo) {
      return res.status(422).json({ error: "titulo e conteudo são obrigatórios" });
    }
    const { id, duplicada } = await criarSugestao({
      tenantId: req.apiTenantId,
      titulo: String(titulo),
      conteudo: String(conteudo),
      categoria: categoria || null,
      banco: banco || null,
      origem: "whatsapp",
      origemRef: origemRef ? String(origemRef).slice(0, 100) : null,
      payloadBruto: null,
    });
    res.status(201).json({ sugestaoId: id, duplicada });
  });
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run check` → sem erros novos.

- [ ] **Step 3: Smoke com curl (criar uma chave antes via tela/endpoint de API keys existente, com escopo kb_sugestoes)**

```bash
curl -s -X POST http://localhost:5000/api/assistente/kb/sugestoes/externa \
  -H "Content-Type: application/json" -H "X-API-Key: SUA_CHAVE" \
  -d '{"titulo":"BRB porta Santander?","conteudo":"Nos grupos: BRB só porta Santander em contratos 20/30/40 parcelas.","categoria":"regras_banco","banco":"BRB","origemRef":"grupo-msg-123"}'
```

Expected: `201 {"sugestaoId":N,"duplicada":false}`. Repetir o MESMO curl → `{"duplicada":true}` com o mesmo id. Sem header → `401`. **Bônus do smoke:** essa sugestão é parecida com o artigo TESTE da Task 3 → na listagem `GET /api/assistente/kb/sugestoes` ela deve vir com `conflito` preenchido (valida a detecção de conflito).

(Porta do dev: conferir em `server/index.ts` qual porta o Express usa; ajustar o curl.)

- [ ] **Step 4: Commit**

```bash
git add server/assistente.ts
git commit -m "feat(assistente): endpoint externo de sugestões p/ WhatsApp CRM via API key com escopo"
```

---

## Task 9: Métricas

**Files:**
- Modify: `server/assistente.ts`

**Interfaces:**
- Produces (HTTP): `GET /api/assistente/metricas?dias=30` (gestão) → JSON:
  ```ts
  {
    periodoDias: number,
    totalPerguntas: number,
    totalSemResposta: number,
    totalFeedbackDown: number,
    semResposta: Array<{ conteudo: string, quando: string }>,      // últimas 50
    feedbackDown: Array<{ pergunta: string, resposta: string, quando: string }>, // últimas 50
    perguntasFrequentes: Array<{ pergunta: string, vezes: number }>, // agrupamento por texto normalizado
    volumePorDia: Array<{ dia: string, perguntas: number }>,
  }
  ```

- [ ] **Step 1: Adicionar rota em `registerAssistenteRoutes` (usa SQL cru p/ agregações; lembrar do helper de rows)**

```typescript
import { sql } from "drizzle-orm";
```

```typescript
  // ---------- Métricas (gestão) ----------
  app.get("/api/assistente/metricas", requireAuth, requireGestorKb, async (req: any, res) => {
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);
    const tenantId = req.user.tenantId;
    const rows = (r: unknown) => ((r as any)?.rows ?? r) as any[];

    const [tot] = rows(await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE m.role = 'user') AS total_perguntas,
        count(*) FILTER (WHERE m.role = 'assistant' AND m.sem_resposta) AS total_sem_resposta,
        count(*) FILTER (WHERE m.role = 'assistant' AND m.feedback = 'down') AS total_down
      FROM assistente_mensagens m
      JOIN assistente_conversas c ON c.id = m.conversa_id
      WHERE c.tenant_id = ${tenantId} AND m.criada_em >= NOW() - (${dias} || ' days')::interval
    `));

    const semResposta = rows(await db.execute(sql`
      SELECT prev.conteudo, m.criada_em AS quando
      FROM assistente_mensagens m
      JOIN assistente_conversas c ON c.id = m.conversa_id
      JOIN LATERAL (
        SELECT conteudo FROM assistente_mensagens p
        WHERE p.conversa_id = m.conversa_id AND p.id < m.id AND p.role = 'user'
        ORDER BY p.id DESC LIMIT 1
      ) prev ON true
      WHERE c.tenant_id = ${tenantId} AND m.role = 'assistant' AND m.sem_resposta
        AND m.criada_em >= NOW() - (${dias} || ' days')::interval
      ORDER BY m.criada_em DESC LIMIT 50
    `));

    const feedbackDown = rows(await db.execute(sql`
      SELECT prev.conteudo AS pergunta, m.conteudo AS resposta, m.criada_em AS quando
      FROM assistente_mensagens m
      JOIN assistente_conversas c ON c.id = m.conversa_id
      JOIN LATERAL (
        SELECT conteudo FROM assistente_mensagens p
        WHERE p.conversa_id = m.conversa_id AND p.id < m.id AND p.role = 'user'
        ORDER BY p.id DESC LIMIT 1
      ) prev ON true
      WHERE c.tenant_id = ${tenantId} AND m.role = 'assistant' AND m.feedback = 'down'
        AND m.criada_em >= NOW() - (${dias} || ' days')::interval
      ORDER BY m.criada_em DESC LIMIT 50
    `));

    const perguntasFrequentes = rows(await db.execute(sql`
      SELECT lower(trim(m.conteudo)) AS pergunta, count(*)::int AS vezes
      FROM assistente_mensagens m
      JOIN assistente_conversas c ON c.id = m.conversa_id
      WHERE c.tenant_id = ${tenantId} AND m.role = 'user'
        AND m.criada_em >= NOW() - (${dias} || ' days')::interval
      GROUP BY 1 HAVING count(*) > 1
      ORDER BY vezes DESC LIMIT 20
    `));

    const volumePorDia = rows(await db.execute(sql`
      SELECT to_char(m.criada_em::date, 'YYYY-MM-DD') AS dia, count(*)::int AS perguntas
      FROM assistente_mensagens m
      JOIN assistente_conversas c ON c.id = m.conversa_id
      WHERE c.tenant_id = ${tenantId} AND m.role = 'user'
        AND m.criada_em >= NOW() - (${dias} || ' days')::interval
      GROUP BY 1 ORDER BY 1
    `));

    res.json({
      periodoDias: dias,
      totalPerguntas: Number(tot?.total_perguntas || 0),
      totalSemResposta: Number(tot?.total_sem_resposta || 0),
      totalFeedbackDown: Number(tot?.total_down || 0),
      semResposta,
      feedbackDown,
      perguntasFrequentes,
      volumePorDia,
    });
  });
```

- [ ] **Step 2: Verificar + smoke**

Run: `npm run check` → sem erros novos.
Smoke (navegador gestor): `await fetch("/api/assistente/metricas", {credentials:"include"}).then(r=>r.json())` → totais coerentes com os smokes anteriores (≥ 2 perguntas, ≥ 1 sem resposta). Logado como `vendedor` → `403`.

- [ ] **Step 3: Commit**

```bash
git add server/assistente.ts
git commit -m "feat(assistente): endpoint de métricas (sem resposta, feedback down, frequentes, volume)"
```

---

## Task 10: Frontend — widget flutuante do mascote

**Files:**
- Create: `client/src/components/assistente/config.ts`
- Create: `client/src/components/assistente/useAssistenteChat.ts`
- Create: `client/src/components/assistente/AssistenteWidget.tsx`
- Modify: `client/src/App.tsx` (montar o widget no shell autenticado)

**Interfaces:**
- Consumes: `POST /api/assistente/chat` (SSE/JSON multipart — Tasks 4/7), `POST /api/assistente/feedback` (Task 4), `useAuth()` de `@/lib/auth`.
- Produces: `<AssistenteWidget />` — auto-contido, visível pra qualquer usuário logado.

- [ ] **Step 1: Criar `client/src/components/assistente/config.ts`**

```typescript
export const NOME_MASCOTE = "Capi";
export const EMOJI_MASCOTE = "🦫"; // capivara honorária até ter avatar próprio

export const PERGUNTAS_SUGERIDAS = [
  "Quais bancos o BRB porta?",
  "Como regularizo uma pendência?",
  "Qual o passo a passo do refin no app do BB?",
];

export const CATEGORIAS_LABEL: Record<string, string> = {
  regras_banco: "Regras de Banco",
  roteiros: "Roteiros",
  dicas: "Dicas",
  atalhos_sistema: "Atalhos do Sistema",
};
```

- [ ] **Step 2: Criar `client/src/components/assistente/useAssistenteChat.ts`**

```typescript
import { useCallback, useRef, useState } from "react";

export type MsgChat = {
  id: string;
  role: "user" | "assistant";
  texto: string;
  mensagemId?: number;
  fontes?: { artigoId: number; titulo: string }[];
  feedback?: "up" | "down";
  captura?: boolean;
};

export function useAssistenteChat() {
  const [mensagens, setMensagens] = useState<MsgChat[]>([]);
  const [carregando, setCarregando] = useState(false);
  const conversaIdRef = useRef<number | null>(null);

  const novaConversa = useCallback(() => {
    conversaIdRef.current = null;
    setMensagens([]);
  }, []);

  /** Envia texto e/ou arquivo (áudio/imagem). modoCaptura=true = gestor guardando conhecimento. */
  const enviar = useCallback(
    async (texto: string, arquivo?: File | Blob, modoCaptura?: boolean) => {
      if (carregando) return;
      const idUser = crypto.randomUUID();
      const rotulo =
        texto ||
        (arquivo && (arquivo as File).type?.startsWith("audio/") ? "🎤 (áudio)" : "🖼️ (imagem)");
      setMensagens((m) => [...m, { id: idUser, role: "user", texto: rotulo }]);
      setCarregando(true);

      const idBot = crypto.randomUUID();
      try {
        let res: Response;
        if (arquivo) {
          const fd = new FormData();
          if (texto) fd.append("mensagem", texto);
          if (conversaIdRef.current) fd.append("conversaId", String(conversaIdRef.current));
          if (modoCaptura) fd.append("modoCaptura", "1");
          fd.append("arquivo", arquivo, (arquivo as File).name || "midia");
          res = await fetch("/api/assistente/chat", { method: "POST", credentials: "include", body: fd });
        } else if (modoCaptura) {
          const fd = new FormData();
          fd.append("mensagem", texto);
          fd.append("modoCaptura", "1");
          res = await fetch("/api/assistente/chat", { method: "POST", credentials: "include", body: fd });
        } else {
          res = await fetch("/api/assistente/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ mensagem: texto, conversaId: conversaIdRef.current }),
          });
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          // modo captura retorna JSON simples
          const data = await res.json();
          setMensagens((m) => [
            ...m,
            { id: idBot, role: "assistant", texto: data.resumo || "Guardado!", captura: true },
          ]);
          return;
        }

        // SSE
        setMensagens((m) => [...m, { id: idBot, role: "assistant", texto: "" }]);
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          const linhas = buffer.split("\n\n");
          buffer = linhas.pop() || "";
          for (const linha of linhas) {
            if (!linha.startsWith("data: ")) continue;
            let ev: any;
            try {
              ev = JSON.parse(linha.slice(6));
            } catch {
              continue;
            }
            if (ev.delta) {
              setMensagens((m) =>
                m.map((msg) => (msg.id === idBot ? { ...msg, texto: msg.texto + ev.delta } : msg)),
              );
            }
            if (ev.done) {
              if (ev.conversaId) conversaIdRef.current = ev.conversaId;
              setMensagens((m) =>
                m.map((msg) =>
                  msg.id === idBot
                    ? { ...msg, mensagemId: ev.mensagemId, fontes: ev.fontes || [] }
                    : msg,
                ),
              );
            }
          }
        }
      } catch (e: any) {
        setMensagens((m) => [
          ...m.filter((x) => x.id !== idBot),
          { id: idBot, role: "assistant", texto: `Deu ruim aqui: ${e.message}. Tenta de novo!` },
        ]);
      } finally {
        setCarregando(false);
      }
    },
    [carregando],
  );

  const darFeedback = useCallback(async (mensagemId: number, feedback: "up" | "down") => {
    setMensagens((m) => m.map((msg) => (msg.mensagemId === mensagemId ? { ...msg, feedback } : msg)));
    await fetch("/api/assistente/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mensagemId, feedback }),
    }).catch(() => {});
  }, []);

  return { mensagens, carregando, enviar, darFeedback, novaConversa };
}
```

- [ ] **Step 3: Criar `client/src/components/assistente/AssistenteWidget.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useAssistenteChat } from "./useAssistenteChat";
import { NOME_MASCOTE, EMOJI_MASCOTE, PERGUNTAS_SUGERIDAS } from "./config";
import {
  MessageCircle,
  X,
  Send,
  Mic,
  Square,
  ImagePlus,
  ThumbsUp,
  ThumbsDown,
  BookmarkPlus,
  RotateCcw,
} from "lucide-react";

export default function AssistenteWidget() {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [modoCaptura, setModoCaptura] = useState(false);
  const [gravando, setGravando] = useState(false);
  const { mensagens, carregando, enviar, darFeedback, novaConversa } = useAssistenteChat();
  const fimRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const podeCaptura = !!user && (user.isMaster || ["master", "operacional"].includes(user.role));

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  if (!user) return null;

  const enviarTexto = () => {
    const t = texto.trim();
    if (!t || carregando) return;
    setTexto("");
    enviar(t, undefined, modoCaptura);
  };

  const toggleGravacao = async () => {
    if (gravando) {
      recorderRef.current?.stop();
      setGravando(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const partes: BlobPart[] = [];
      rec.ondataavailable = (e) => partes.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(partes, { type: "audio/webm" });
        enviar(texto.trim(), blob, modoCaptura);
        setTexto("");
      };
      recorderRef.current = rec;
      rec.start();
      setGravando(true);
    } catch {
      alert("Não consegui acessar o microfone");
    }
  };

  return (
    <>
      {/* balão flutuante */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl shadow-lg transition hover:scale-110"
          title={`Perguntar pro ${NOME_MASCOTE}`}
        >
          {EMOJI_MASCOTE}
        </button>
      )}

      {/* painel de chat */}
      {aberto && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b bg-primary/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{EMOJI_MASCOTE}</span>
              <div>
                <div className="text-sm font-semibold">{NOME_MASCOTE}</div>
                <div className="text-xs text-muted-foreground">Assistente da equipe</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title="Nova conversa" onClick={novaConversa}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setAberto(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {mensagens.length === 0 && (
              <div className="space-y-2">
                <div className="rounded-lg bg-muted p-3 text-sm">
                  Oi! Eu sou o {NOME_MASCOTE} {EMOJI_MASCOTE}. Me pergunta qualquer coisa sobre
                  regras de banco, roteiros e o sistema!
                </div>
                {PERGUNTAS_SUGERIDAS.map((p) => (
                  <button
                    key={p}
                    onClick={() => enviar(p)}
                    className="block w-full rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            {mensagens.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
                  }
                >
                  <div className="whitespace-pre-wrap">{m.texto || "…"}</div>
                  {m.role === "assistant" && m.mensagemId && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => darFeedback(m.mensagemId!, "up")}
                        className={m.feedback === "up" ? "text-green-600" : "text-muted-foreground hover:text-foreground"}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => darFeedback(m.mensagemId!, "down")}
                        className={m.feedback === "down" ? "text-red-600" : "text-muted-foreground hover:text-foreground"}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={fimRef} />
          </div>

          <div className="border-t p-2">
            {podeCaptura && (
              <label className="mb-1 flex cursor-pointer items-center gap-1.5 px-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={modoCaptura}
                  onChange={(e) => setModoCaptura(e.target.checked)}
                />
                <BookmarkPlus className="h-3.5 w-3.5" />
                Guardar como conhecimento (vai pra fila de aprovação)
              </label>
            )}
            <div className="flex items-end gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) enviar(texto.trim(), f, modoCaptura);
                  setTexto("");
                  e.target.value = "";
                }}
              />
              <Button variant="ghost" size="icon" title="Enviar imagem" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Button
                variant={gravando ? "destructive" : "ghost"}
                size="icon"
                title={gravando ? "Parar e enviar" : "Gravar áudio"}
                onClick={toggleGravacao}
              >
                {gravando ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviarTexto();
                  }
                }}
                rows={1}
                placeholder={modoCaptura ? "Descreva o conhecimento pra guardar..." : `Pergunta pro ${NOME_MASCOTE}...`}
                className="max-h-24 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm"
              />
              <Button size="icon" disabled={carregando} onClick={enviarTexto}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Montar no shell autenticado em `client/src/App.tsx`**

Importar e renderizar junto do layout autenticado (mesmo nível do `<AppSidebar />`, dentro do `SidebarProvider` — só renderiza quando há usuário, o próprio componente já retorna `null` sem user):

```tsx
import AssistenteWidget from "@/components/assistente/AssistenteWidget";
// ... dentro do JSX do layout autenticado, após o container das rotas:
<AssistenteWidget />
```

(Localizar no App.tsx o bloco que renderiza `<AppSidebar />` + `<Switch>` das rotas autenticadas e adicionar o widget como irmão.)

- [ ] **Step 5: Verificar**

Run: `npm run check` → sem erros novos. `npm run dev` → no navegador: balão 🦫 no canto inferior direito em qualquer tela; abrir; clicar numa pergunta sugerida sobre BRB → resposta em streaming citando "📎 Fonte: TESTE - Bancos que o BRB porta"; 👍/👎 funcionam; pergunta fora da base → resposta "não sei"; logado como gestor o checkbox "Guardar como conhecimento" aparece; gravação de áudio pede microfone e envia.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/assistente client/src/App.tsx
git commit -m "feat(assistente): widget flutuante do mascote com chat SSE, áudio, imagem e feedback"
```

---

## Task 11: Frontend — página Base de Conhecimento (Artigos / Fila / Métricas)

**Files:**
- Create: `client/src/pages/base-conhecimento.tsx`
- Modify: `client/src/App.tsx` (rota)
- Modify: `client/src/components/app-sidebar.tsx` (item de menu)

**Interfaces:**
- Consumes: todos os endpoints de gestão (Tasks 3, 5, 6, 9) via `apiRequest` de `@/lib/queryClient` + React Query; `useAuth()`.
- Produces: rota `/base-conhecimento` visível só pra gestão.

- [ ] **Step 1: Criar `client/src/pages/base-conhecimento.tsx`**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIAS_LABEL, NOME_MASCOTE, EMOJI_MASCOTE } from "@/components/assistente/config";

type Artigo = {
  id: number; titulo: string; conteudo: string; categoria: string;
  banco: string | null; status: string; origem: string; updatedAt: string;
};
type Sugestao = {
  id: number; tituloProposto: string; conteudoProposto: string;
  categoriaProposta: string | null; bancoProposto: string | null;
  origem: string; createdAt: string;
  conflito: { id: number; titulo: string; conteudo: string } | null;
};

const FORM_VAZIO = { id: 0, titulo: "", conteudo: "", categoria: "regras_banco", banco: "", status: "rascunho" };

export default function BaseConhecimentoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof FORM_VAZIO | null>(null);

  const podeGerenciar = !!user && (user.isMaster || ["master", "operacional"].includes(user.role));

  const { data: artigos = [] } = useQuery<Artigo[]>({
    queryKey: ["/api/assistente/kb"],
    enabled: podeGerenciar,
  });
  const { data: sugestoes = [] } = useQuery<Sugestao[]>({
    queryKey: ["/api/assistente/kb/sugestoes"],
    enabled: podeGerenciar,
  });
  const { data: metricas } = useQuery<any>({
    queryKey: ["/api/assistente/metricas"],
    enabled: podeGerenciar,
  });

  const salvar = useMutation({
    mutationFn: async (f: typeof FORM_VAZIO) => {
      const body = { titulo: f.titulo, conteudo: f.conteudo, categoria: f.categoria, banco: f.banco || null, status: f.status };
      const res = f.id
        ? await apiRequest("PATCH", `/api/assistente/kb/${f.id}`, body)
        : await apiRequest("POST", "/api/assistente/kb", body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assistente/kb"] });
      setForm(null);
    },
  });

  const decidir = useMutation({
    mutationFn: async (p: { id: number; acao: "aprovar" | "rejeitar"; modo?: "novo" | "substituir" }) => {
      const res = await apiRequest("POST", `/api/assistente/kb/sugestoes/${p.id}/decidir`, { acao: p.acao, modo: p.modo });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assistente/kb/sugestoes"] });
      qc.invalidateQueries({ queryKey: ["/api/assistente/kb"] });
    },
  });

  const uploadPdf = async (file: File) => {
    const fd = new FormData();
    fd.append("arquivo", file);
    const res = await fetch("/api/assistente/kb/upload", { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || "Falha no upload");
      return;
    }
    qc.invalidateQueries({ queryKey: ["/api/assistente/kb"] });
    alert("PDF importado como rascunho — revise e publique!");
  };

  if (!podeGerenciar) return <div className="p-6">Acesso restrito.</div>;

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">
        {EMOJI_MASCOTE} Base de Conhecimento do {NOME_MASCOTE}
      </h1>

      <Tabs defaultValue="artigos">
        <TabsList>
          <TabsTrigger value="artigos">Artigos ({artigos.length})</TabsTrigger>
          <TabsTrigger value="fila">
            Fila de Aprovação{sugestoes.length > 0 && <Badge className="ml-2">{sugestoes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        {/* -------- ARTIGOS -------- */}
        <TabsContent value="artigos" className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={() => setForm({ ...FORM_VAZIO })}>Novo artigo</Button>
            <label>
              <Button variant="outline" asChild><span>Importar PDF</span></Button>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ""; }}
              />
            </label>
          </div>
          <div className="space-y-2">
            {artigos.map((a) => (
              <Card key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() =>
                setForm({ id: a.id, titulo: a.titulo, conteudo: a.conteudo, categoria: a.categoria, banco: a.banco || "", status: a.status })
              }>
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium">{a.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {CATEGORIAS_LABEL[a.categoria] || a.categoria}
                      {a.banco ? ` · ${a.banco}` : ""} · origem: {a.origem}
                    </div>
                  </div>
                  <Badge variant={a.status === "publicado" ? "default" : a.status === "rascunho" ? "secondary" : "outline"}>
                    {a.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* -------- FILA -------- */}
        <TabsContent value="fila" className="space-y-3">
          {sugestoes.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma sugestão pendente. 🎉</div>}
          {sugestoes.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.tituloProposto}</CardTitle>
                <div className="text-xs text-muted-foreground">
                  origem: {s.origem}
                  {s.categoriaProposta ? ` · ${CATEGORIAS_LABEL[s.categoriaProposta] || s.categoriaProposta}` : ""}
                  {s.bancoProposto ? ` · ${s.bancoProposto}` : ""}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.conflito ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-amber-400 p-2">
                      <div className="mb-1 text-xs font-semibold text-amber-600">JÁ EXISTE: {s.conflito.titulo}</div>
                      <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs">{s.conflito.conteudo}</div>
                    </div>
                    <div className="rounded border border-green-500 p-2">
                      <div className="mb-1 text-xs font-semibold text-green-600">NOVO</div>
                      <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs">{s.conteudoProposto}</div>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded border p-2 text-xs">{s.conteudoProposto}</div>
                )}
                <div className="flex gap-2">
                  {s.conflito ? (
                    <>
                      <Button size="sm" onClick={() => decidir.mutate({ id: s.id, acao: "aprovar", modo: "substituir" })}>
                        Substituir o antigo
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decidir.mutate({ id: s.id, acao: "aprovar", modo: "novo" })}>
                        Manter os dois
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => decidir.mutate({ id: s.id, acao: "aprovar" })}>
                      Aprovar e publicar
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => decidir.mutate({ id: s.id, acao: "rejeitar" })}>
                    Rejeitar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* -------- MÉTRICAS -------- */}
        <TabsContent value="metricas" className="space-y-4">
          {metricas && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="p-4"><div className="text-2xl font-bold">{metricas.totalPerguntas}</div><div className="text-xs text-muted-foreground">Perguntas ({metricas.periodoDias}d)</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-2xl font-bold">{metricas.totalSemResposta}</div><div className="text-xs text-muted-foreground">Sem resposta (pauta de conteúdo!)</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-2xl font-bold">{metricas.totalFeedbackDown}</div><div className="text-xs text-muted-foreground">Respostas com 👎</div></CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Perguntas sem resposta — o que falta cadastrar</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {(metricas.semResposta || []).map((x: any, i: number) => (
                    <div key={i} className="border-b py-1 text-sm">{x.conteudo}</div>
                  ))}
                  {!metricas.semResposta?.length && <div className="text-xs text-muted-foreground">Nenhuma 🎉</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Respostas com 👎</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(metricas.feedbackDown || []).map((x: any, i: number) => (
                    <div key={i} className="border-b pb-1 text-xs">
                      <div className="font-medium">P: {x.pergunta}</div>
                      <div className="text-muted-foreground">R: {String(x.resposta).slice(0, 200)}…</div>
                    </div>
                  ))}
                  {!metricas.feedbackDown?.length && <div className="text-xs text-muted-foreground">Nenhuma 🎉</div>}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* -------- dialog de edição/criação -------- */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <input
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                placeholder="Título"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
              <div className="flex gap-2">
                <select
                  className="rounded border bg-background px-2 py-2 text-sm"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                >
                  {Object.entries(CATEGORIAS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  className="flex-1 rounded border bg-background px-3 py-2 text-sm"
                  placeholder="Banco (opcional)"
                  value={form.banco}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                />
                <select
                  className="rounded border bg-background px-2 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="publicado">Publicado</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>
              <textarea
                className="h-64 w-full rounded border bg-background px-3 py-2 text-sm"
                placeholder="Conteúdo (markdown)"
                value={form.conteudo}
                onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button
                  disabled={!form.titulo.trim() || !form.conteudo.trim() || salvar.isPending}
                  onClick={() => salvar.mutate(form)}
                >
                  {salvar.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

(Se `@/components/ui/tabs` não existir no projeto, usar botões de estado manual no mesmo padrão de outra página com abas — conferir `client/src/components/ui/`.)

- [ ] **Step 2: Rota no `client/src/App.tsx`**

```tsx
import BaseConhecimentoPage from "@/pages/base-conhecimento";
// junto das outras rotas autenticadas:
<Route path="/base-conhecimento" component={BaseConhecimentoPage} />
```

- [ ] **Step 3: Item no `client/src/components/app-sidebar.tsx`**

Seguir o padrão dos itens existentes (Material Symbols + verificação de permissão). Adicionar na seção adequada (ex.: junto de Configurações/gestão), visível apenas quando `user.isMaster || ["master","operacional"].includes(user.role)`:

```tsx
// no mapa de ícones MS_ITEM:
"Base de Conhecimento": "menu_book",
// item de menu (dentro da render, com a condição de role):
{(user?.isMaster || ["master", "operacional"].includes(user?.role ?? "")) && (
  <SidebarMenuItem>
    {/* seguir EXATAMENTE o padrão dos SidebarMenuItem vizinhos, apontando pra /base-conhecimento */}
  </SidebarMenuItem>
)}
```

- [ ] **Step 4: Verificar**

Run: `npm run check` e `npm run build` → sem erros novos.
Navegador (gestor): menu mostra "Base de Conhecimento"; criar artigo publicado; importar um PDF real → vira rascunho classificado; fila mostra a sugestão do curl da Task 8 com comparativo âmbar/verde (conflito com o artigo TESTE); "Substituir o antigo" → antigo vira `arquivado`; métricas mostram números. Logado como `vendedor`: item não aparece no menu e `/base-conhecimento` mostra "Acesso restrito".

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/base-conhecimento.tsx client/src/App.tsx client/src/components/app-sidebar.tsx
git commit -m "feat(assistente): página Base de Conhecimento (artigos, fila de aprovação, métricas)"
```

---

## Task 12: Script de importação da Biblioteca do WhatsApp CRM

**Files:**
- Create: `server/assistente-import-biblioteca.ts`

**Interfaces:**
- Consumes: `criarSugestao`, `classificarConteudo` (Task 3). Supabase do WhatsApp CRM via REST (PostgREST): tabelas `knowledge_files (id, file_name, file_type, status, chunk_count)` e `knowledge_chunks (file_id, content, chunk_index)`.
- Produces: script CLI — `npx tsx server/assistente-import-biblioteca.ts` com envs `WHATS_SUPABASE_URL`, `WHATS_SUPABASE_SERVICE_KEY`, `IMPORT_TENANT_ID`. Idempotente (dedupe por `origemRef = knowledge_files.id`).

- [ ] **Step 1: Criar `server/assistente-import-biblioteca.ts`**

```typescript
/**
 * Importa a Biblioteca do WhatsApp CRM (capitalgo) como SUGESTÕES na fila de aprovação.
 * Uso (PowerShell):
 *   $env:WHATS_SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:WHATS_SUPABASE_SERVICE_KEY="service_role_key"
 *   $env:IMPORT_TENANT_ID="1"
 *   npx tsx server/assistente-import-biblioteca.ts
 * Idempotente: livro já importado (origemRef) é pulado.
 */
import { criarSugestao, classificarConteudo } from "./assistente";

const URL_BASE = process.env.WHATS_SUPABASE_URL;
const KEY = process.env.WHATS_SUPABASE_SERVICE_KEY;
const TENANT_ID = Number(process.env.IMPORT_TENANT_ID || 0);

if (!URL_BASE || !KEY || !TENANT_ID) {
  console.error("Faltam envs: WHATS_SUPABASE_URL, WHATS_SUPABASE_SERVICE_KEY, IMPORT_TENANT_ID");
  process.exit(1);
}

async function pgrest(path: string): Promise<any[]> {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`PostgREST ${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

(async () => {
  const files = await pgrest(
    "knowledge_files?select=id,file_name,file_type,status,chunk_count&chunk_count=gt.0&order=created_at.asc",
  );
  console.log(`Biblioteca: ${files.length} livros com conteúdo`);
  let criadas = 0, puladas = 0, erros = 0;

  for (const f of files) {
    try {
      const chunks = await pgrest(
        `knowledge_chunks?select=content,chunk_index&file_id=eq.${f.id}&order=chunk_index.asc`,
      );
      const textoBruto = chunks.map((c: any) => c.content).join("\n\n").trim();
      if (!textoBruto) { puladas++; continue; }

      const clas = await classificarConteudo(`Título original: ${f.file_name}\n\n${textoBruto}`);
      const { duplicada } = await criarSugestao({
        tenantId: TENANT_ID,
        titulo: clas.titulo,
        conteudo: clas.conteudo,
        categoria: clas.categoria,
        banco: clas.banco,
        origem: "whatsapp_biblioteca",
        origemRef: String(f.id),
        payloadBruto: textoBruto.slice(0, 100000),
      });
      if (duplicada) { puladas++; console.log(`  ~ já importado: ${f.file_name}`); }
      else { criadas++; console.log(`  + ${f.file_name} → "${clas.titulo}" [${clas.categoria}]`); }
    } catch (e: any) {
      erros++;
      console.error(`  ! erro em "${f.file_name}": ${e.message}`);
    }
  }
  console.log(`\nResumo: ${criadas} sugestões criadas, ${puladas} puladas, ${erros} erros.`);
  console.log("Agora é triar na tela Base de Conhecimento → Fila de Aprovação.");
  process.exit(0);
})();
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run check` → sem erros novos.

- [ ] **Step 3: Rodar contra o Supabase do WhatsApp CRM (com o Fábio fornecendo URL/service key do projeto do capitalgo e o tenant id)**

Run (PowerShell):
```powershell
$env:WHATS_SUPABASE_URL="https://<ref-do-whats>.supabase.co"; $env:WHATS_SUPABASE_SERVICE_KEY="<service_key>"; $env:IMPORT_TENANT_ID="<tenant>"; npx tsx server/assistente-import-biblioteca.ts
```
Expected: `Biblioteca: ~55 livros...`, linhas `+ <arquivo> → "<título>" [categoria]`, resumo final sem erros (ou poucos). Rodar de novo → tudo `~ já importado`. Fila no CRM mostra as sugestões pra triagem.

- [ ] **Step 4: Commit**

```bash
git add server/assistente-import-biblioteca.ts
git commit -m "feat(assistente): script de importação da Biblioteca do WhatsApp CRM (idempotente)"
```

---

## Task 13: Verificação final de ponta a ponta

**Files:** nenhum (verificação) — corrigir o que aparecer.

- [ ] **Step 1: Build completo**

Run: `npm run check` e `npm run build`
Expected: ambos sem erros.

- [ ] **Step 2: Checklist funcional (navegador, dev)**

Como **gestor (master)**:
1. Base de Conhecimento → criar/editar/publicar/arquivar artigo ✔
2. Importar PDF real → rascunho classificado → publicar ✔
3. Fila → aprovar com "Substituir o antigo" e ver o antigo arquivado ✔
4. Chat: modo captura por texto E por áudio → sugestão na fila ✔
5. Métricas com números coerentes ✔

Como **corretor (vendedor)**:
6. Balão aparece; pergunta com resposta na base → resposta com fonte ✔
7. Pergunta fora da base → "não sei" (sem inventar) ✔
8. 👍/👎 registram ✔
9. Menu NÃO mostra Base de Conhecimento; `GET /api/assistente/kb` direto → 403 ✔
10. Checkbox de captura NÃO aparece ✔

Perguntas reais: pedir ao Fábio ~15 perguntas típicas de corretor e validar as respostas contra a base importada da Biblioteca (as que falharem viram conteúdo novo ou ajuste de artigo).

- [ ] **Step 3: Commit final e entrega**

```bash
git add -A
git commit -m "chore(assistente): ajustes finais da verificação e2e"
```

NÃO fazer push — entregar ao Fábio o resumo + comando de merge/push quando ele aprovar:

```bash
git checkout migracao-cloudfy && git merge feat/ia-corretores
# push só quando o Fábio mandar (deploy automático no Railway)
```

---

## Self-Review (feito na escrita do plano)

- **Cobertura do spec:** mascote/persona (T4/T10), citação de fonte (T4), "não sei" + corte (T4), feedback (T4/T10), áudio/imagem + captura (T7/T10), CRUD/tela (T3/T11), PDF rascunho (T5), fila + conflito + substituir (T6/T11), endpoint externo API key (T8), métricas (T9/T11), import Biblioteca (T12), permissões (T3 helper + T11 menu + T13 checklist), erros (422/401/403, timeout 30s, "não sei", extração vazia — T4/T5/T7/T8), fase 2 preparada (estrutura modular; tools entram no handler do chat depois). Nome do mascote: constante + env `ASSISTENTE_NOME` + persona editável em `aiPrompts`.
- **Sem placeholders:** todo step tem código/comando/expectativa. Pontos de "conferir no código real" são instruções explícitas de verificação (nome de export do PDF service, posição no App.tsx/sidebar), não lacunas de design.
- **Consistência de tipos:** `criarSugestao`/`classificarConteudo`/`buscarChunks`/`indexarArtigo` usados nas Tasks 5-8/12 batem com as assinaturas produzidas nas Tasks 2-3; eventos SSE do back (T4/T7) batem com o parser do front (T10); rotas do front (T10/T11) batem com os paths do back.
