# Jarvis — Avisos de Contrato Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** O Jarvis avisa o corretor DONO da proposta quando ela **paga (PAGO)**, **pendencia (pendência do corretor)** ou **cancela (CANCELADA/PERDIDA)** — só no canal do Jarvis (bolinha no botão + mensagem no chat), com isolamento total por corretor.

**Architecture:** Canal próprio do Jarvis (tabela `assistente_avisos`, NÃO o sino genérico). Gatilho pendurado nos pontos de escrita de `proposals.status` em `server/contracts.ts`, via helper único em `server/assistente-avisos.ts`. Frontend: badge no botão do widget + avisos exibidos como mensagens do Jarvis ao abrir.

**Tech Stack:** Express + Drizzle (Postgres/Supabase), React + Wouter + React Query, widget existente do Jarvis.

## Global Constraints

- **🔒 REGRA DE OURO — isolamento por corretor:** todo aviso é criado com `userId` = dono da proposta (`updated.vendorId ?? current.createdBy`). TODA leitura filtra `userId = req.user.id AND tenant_id = req.tenantId`. Um corretor NUNCA vê aviso de contrato de outro. Nome de cliente só aparece no aviso do próprio dono. Teste obrigatório na Task 5.
- **Canal SÓ do Jarvis:** usar tabela nova `assistente_avisos`. NÃO usar a tabela `notifications` nem o sino (`notification-bell.tsx`). Não tocar no sistema de notificação existente.
- **Eventos e transição:** só notifica na TRANSIÇÃO real (status anterior ≠ novo, e o anterior não era já o alvo). Eventos:
  - `→ PAGO` (status literal `"PAGO"`)
  - `→ CANCELADA` ou `→ PERDIDA`
  - `→ pendência DO CORRETOR`: status com `returnStatusKey != null` (config em `contract_statuses`) OU status literal `"PENDENTE_CORRETOR"`. **EXCLUIR `"PENDENTE_BANCO"`** (pendência interna do banco).
- **Deploy:** branch `migracao-cloudfy` (é a que o Railway observa). Sem push sem o Fábio pedir. Rebase se a remota mover.
- **Sem runner de teste** no projeto: verificação = `npm run check` (baseline atual **240** erros — 227 pré-existentes + 13 do commit do colega em routes.ts; contar antes/depois, 0 novos) + `npm run build` + smoke manual descrito.
- **Acesso:** o widget já é gated por `podeUsarChat` (permissão `modulo_assistente.chat`). Corretor só vê o Jarvis/avisos se o master liberar. Nada a mudar aqui.
- **`db.execute` rows:** ler driver-agnóstico `(res as any).rows ?? res`.
- **Commits:** pt-BR, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## File Structure

- Modify `shared/schema.ts` — tabela Drizzle `assistenteAvisos`.
- Modify `server/index.ts` — bloco de migração idempotente (CREATE TABLE IF NOT EXISTS assistente_avisos), no mesmo padrão dos blocos existentes.
- Create `server/assistente-avisos.ts` — helper `notificarStatusProposta(...)` (decide mensagem + insere) e `registerAssistenteAvisosRoutes(app, requireAuth)` (GET avisos, GET count, POST marcar-lidas).
- Modify `server/routes.ts` — registrar `registerAssistenteAvisosRoutes(app, requireAuth)` (1 linha, junto de `registerAssistenteRoutes`).
- Modify `server/contracts.ts` — chamar `notificarStatusProposta(...)` nos pontos de escrita de status (PUT /status ~1010, bulk-status loop ~1313-1332, pause ~1404).
- Modify `client/src/components/assistente/useAssistenteAvisos.ts` (novo) — hook do badge + fetch/marcar.
- Modify `client/src/components/assistente/AssistenteWidget.tsx` — badge no botão + mostrar avisos ao abrir.

---

## Task 1: Tabela `assistente_avisos` (schema + migração boot)

**Files:**
- Modify: `shared/schema.ts` (junto das outras tabelas `assistente*`/`kb*`)
- Modify: `server/index.ts` (após o bloco de migração da IA interna `kb_*`/`assistente_*`)

**Interfaces:**
- Produces: tabela Drizzle `assistenteAvisos` e tabela SQL `assistente_avisos`.

- [ ] **Step 1: Drizzle em `shared/schema.ts`** (após `assistenteMensagens`)

```typescript
export const assistenteAvisos = pgTable("assistente_avisos", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 30 }).notNull(), // contrato_pago | contrato_pendencia | contrato_cancelado
  titulo: varchar("titulo", { length: 255 }).notNull(),
  mensagem: text("mensagem").notNull(),
  proposalId: integer("proposal_id"),
  lida: boolean("lida").notNull().default(false),
  criadaEm: timestamp("criada_em").notNull().defaultNow(),
});
```

- [ ] **Step 2: Migração no boot (`server/index.ts`)** — no mesmo padrão dos blocos existentes (bloco próprio try/catch com import local `db`/`sql`), após o bloco `kb_*`:

```typescript
try {
  const { db: avDb } = await import("./storage");
  const { sql: avSql } = await import("drizzle-orm");
  await avDb.execute(avSql`
    CREATE TABLE IF NOT EXISTS assistente_avisos (
      id          SERIAL PRIMARY KEY,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tipo        VARCHAR(30) NOT NULL,
      titulo      VARCHAR(255) NOT NULL,
      mensagem    TEXT NOT NULL,
      proposal_id INTEGER,
      lida        BOOLEAN NOT NULL DEFAULT FALSE,
      criada_em   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await avDb.execute(avSql`CREATE INDEX IF NOT EXISTS idx_assistente_avisos_user ON assistente_avisos(user_id, lida)`);
  log("✓ Migração assistente_avisos ok");
} catch (e) {
  log(`⚠ Migração assistente_avisos falhou (non-fatal): ${e}`);
}
```

(Conferir o nome exato da função de log e do import usados nos blocos vizinhos e casar com eles.)

- [ ] **Step 3: Verificar** — `npm run check` (0 erros novos vs baseline 240). Commit: `feat(jarvis): tabela assistente_avisos (canal de avisos do Jarvis)`.

---

## Task 2: Helper de notificação + endpoints do Jarvis

**Files:**
- Create: `server/assistente-avisos.ts`
- Modify: `server/routes.ts` (registrar rotas, 1 linha junto de `registerAssistenteRoutes(app, requireAuth)`)

**Interfaces:**
- Consumes: `db` de `./storage`, `assistenteAvisos` de `@shared/schema`.
- Produces:
  - `notificarStatusProposta(dados: { tenantId: number; userId: number; proposalId: number; clientName: string | null; statusAntigo: string | null; statusNovo: string; pendenciaCorretorKeys: Set<string> }): Promise<void>` — decide tipo/mensagem e insere se for transição relevante. Best-effort (try/catch interno, nunca lança).
  - `registerAssistenteAvisosRoutes(app: Express, requireAuth: RequestHandler): void`
  - HTTP: `GET /api/assistente/avisos` (não lidos do usuário), `GET /api/assistente/avisos/count` (`{count}`), `POST /api/assistente/avisos/marcar-lidas` (body `{ ids?: number[] }` — se ausente, marca todos do usuário).

- [ ] **Step 1: Criar `server/assistente-avisos.ts`**

```typescript
import type { Express, Response } from "express";
import type { RequestHandler } from "express";
import { db } from "./storage";
import { and, desc, eq, inArray } from "drizzle-orm";
import { assistenteAvisos } from "@shared/schema";

const STATUS_CANCELAMENTO = new Set(["CANCELADA", "PERDIDA"]);

/**
 * Cria um aviso do Jarvis para o DONO da proposta quando o status entra em
 * PAGO / cancelamento / pendência do corretor. Best-effort — nunca lança.
 * ISOLAMENTO: userId é sempre o dono da proposta; a leitura (endpoints) filtra por usuário.
 */
export async function notificarStatusProposta(dados: {
  tenantId: number;
  userId: number;
  proposalId: number;
  clientName: string | null;
  statusAntigo: string | null;
  statusNovo: string;
  pendenciaCorretorKeys: Set<string>;
}): Promise<void> {
  try {
    const { tenantId, userId, proposalId, statusNovo, statusAntigo } = dados;
    if (!tenantId || !userId || !statusNovo) return;
    if (statusAntigo === statusNovo) return; // só na transição

    const cliente = dados.clientName?.trim() || "seu cliente";
    let tipo: string | null = null;
    let titulo = "";
    let mensagem = "";

    if (statusNovo === "PAGO") {
      tipo = "contrato_pago";
      titulo = "Contrato pago 🎉";
      mensagem = `Boa notícia! O contrato do cliente ${cliente} foi PAGO. Parabéns!`;
    } else if (STATUS_CANCELAMENTO.has(statusNovo)) {
      tipo = "contrato_cancelado";
      titulo = "Contrato cancelado";
      mensagem = `A proposta do cliente ${cliente} foi cancelada.`;
    } else if (
      statusNovo === "PENDENTE_CORRETOR" ||
      dados.pendenciaCorretorKeys.has(statusNovo)
    ) {
      // EXCLUI PENDENTE_BANCO (não está no set de pendência do corretor)
      tipo = "contrato_pendencia";
      titulo = "Proposta com pendência ⚠️";
      mensagem = `A proposta do cliente ${cliente} está com pendência e precisa da sua atenção. Regularize quando puder.`;
    }

    if (!tipo) return;

    await db.insert(assistenteAvisos).values({
      tenantId,
      userId,
      tipo,
      titulo,
      mensagem,
      proposalId,
    });
  } catch (err) {
    console.error("[assistente-avisos] falha ao notificar (não-fatal):", err);
  }
}

export function registerAssistenteAvisosRoutes(app: Express, requireAuth: RequestHandler) {
  app.get("/api/assistente/avisos", requireAuth, async (req: any, res: Response) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
      const avisos = await db
        .select()
        .from(assistenteAvisos)
        .where(
          and(
            eq(assistenteAvisos.userId, req.user.id),
            eq(assistenteAvisos.tenantId, req.tenantId),
            eq(assistenteAvisos.lida, false),
          ),
        )
        .orderBy(desc(assistenteAvisos.id))
        .limit(20);
      res.json(avisos);
    } catch (err) {
      console.error("[assistente/avisos] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });

  app.get("/api/assistente/avisos/count", requireAuth, async (req: any, res: Response) => {
    try {
      if (!req.tenantId) return res.json({ count: 0 });
      const rows = await db
        .select({ id: assistenteAvisos.id })
        .from(assistenteAvisos)
        .where(
          and(
            eq(assistenteAvisos.userId, req.user.id),
            eq(assistenteAvisos.tenantId, req.tenantId),
            eq(assistenteAvisos.lida, false),
          ),
        );
      res.json({ count: rows.length });
    } catch (err) {
      console.error("[assistente/avisos/count] erro:", err);
      res.json({ count: 0 });
    }
  });

  app.post("/api/assistente/avisos/marcar-lidas", requireAuth, async (req: any, res: Response) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
      const ids: number[] = Array.isArray(req.body?.ids)
        ? req.body.ids.map(Number).filter((n: number) => Number.isInteger(n))
        : [];
      const base = and(
        eq(assistenteAvisos.userId, req.user.id),
        eq(assistenteAvisos.tenantId, req.tenantId),
      );
      await db
        .update(assistenteAvisos)
        .set({ lida: true })
        .where(ids.length ? and(base, inArray(assistenteAvisos.id, ids)) : base);
      res.json({ ok: true });
    } catch (err) {
      console.error("[assistente/avisos/marcar-lidas] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });
}
```

- [ ] **Step 2: Registrar em `server/routes.ts`** — junto de `registerAssistenteRoutes(app, requireAuth);`:

```typescript
import { registerAssistenteAvisosRoutes } from "./assistente-avisos";
// ...
registerAssistenteAvisosRoutes(app, requireAuth);
```

- [ ] **Step 3: Verificar** — `npm run check` (0 novos). Commit: `feat(jarvis): helper de aviso de status + endpoints (avisos/count/marcar-lidas)`.

---

## Task 3: Pendurar o gatilho em `server/contracts.ts` (a task sensível)

**Files:**
- Modify: `server/contracts.ts`

**Interfaces:**
- Consumes: `notificarStatusProposta` (Task 2).

**Contexto (do mapeamento):** não há funil único. Pontos de escrita de `proposals.status`:
- A: `PUT /api/contracts/proposals/:id/status` (~836) — genérico: PAGO, cancelar, pendência. Upsert PAGO termina ~1010. `current` = proposta antes; `updated` = depois. Pendurar após o bloco de produção, antes do `return res.json(updated)` (~1012).
- B: `POST /api/contracts/proposals/bulk-status` (loop ~1313-1332) — lote.
- E: `POST /api/contracts/proposals/:id/pause` (~1404) — grava PENDENTE_BANCO/PENDENTE_CORRETOR.

**IMPORTANTE:** LER o arquivo nesses ranges antes de editar; nomes de variáveis e a forma de obter `current`/`updated`/`clientName`/`vendorId` variam por rota. NÃO alterar nenhuma lógica existente — só ADICIONAR a chamada `notificarStatusProposta(...)` (best-effort, não bloqueia) após o status já ter sido gravado.

- [ ] **Step 1: Helper local em `contracts.ts` para montar o set de pendência do corretor**

No topo do módulo (ou dentro de cada rota antes da chamada), buscar os status com `returnStatusKey != null` do tenant e montar o Set. Padrão canônico já existe no arquivo (ex.: `contracts.ts:2059-2064`). Exemplo de helper:

```typescript
import { notificarStatusProposta } from "./assistente-avisos";
import { contractStatuses } from "@shared/schema"; // conferir nome real da tabela Drizzle

async function pendenciaCorretorKeys(tenantId: number): Promise<Set<string>> {
  try {
    const rows = await db
      .select()
      .from(contractStatuses)
      .where(eq(contractStatuses.tenantId, tenantId));
    const keys = rows.filter((s: any) => !!s.returnStatusKey).map((s: any) => s.key);
    keys.push("PENDENTE_CORRETOR"); // hardcoded do pause
    return new Set(keys);
  } catch {
    return new Set(["PENDENTE_CORRETOR"]);
  }
}
```

- [ ] **Step 2: Ponto A** — em `PUT /api/contracts/proposals/:id/status`, após o status gravado e o bloco de produção (~1010), antes do `return res.json(updated)`:

```typescript
      // Aviso do Jarvis (best-effort, isolado por dono) — não bloqueia
      try {
        const pkeys = await pendenciaCorretorKeys(req.tenantId);
        await notificarStatusProposta({
          tenantId: req.tenantId,
          userId: updated.vendorId ?? current.createdBy,
          proposalId: updated.id,
          clientName: updated.clientName ?? current.clientName ?? null,
          statusAntigo: current.status ?? null,
          statusNovo: updated.status,
          pendenciaCorretorKeys: pkeys,
        });
      } catch {}
```

(Ajustar nomes `current`/`updated`/`req.tenantId` aos reais da rota.)

- [ ] **Step 3: Ponto E (pause)** — em `POST .../pause`, após gravar `newStatus`, com o dono da proposta e o status anterior disponíveis, chamar o mesmo helper passando `statusNovo = newStatus`. (PENDENTE_BANCO NÃO gera aviso porque não está no set; PENDENTE_CORRETOR gera.)

- [ ] **Step 4: Ponto B (bulk-status)** — dentro do loop por proposta (~1313-1332), após gravar o status de cada uma, chamar o helper por item (com o dono e status anterior daquela proposta). Buscar `pendenciaCorretorKeys` UMA vez antes do loop e reutilizar.

- [ ] **Step 5: Verificar** — `npm run check` (0 novos) + `npm run build`. Smoke: descrito na Task 5. Commit: `feat(jarvis): dispara aviso ao pagar/pendenciar/cancelar (isolado por corretor)`.

---

## Task 4: Frontend — badge no botão + avisos no chat

**Files:**
- Create: `client/src/components/assistente/useAssistenteAvisos.ts`
- Modify: `client/src/components/assistente/AssistenteWidget.tsx`

**Interfaces:**
- Consumes: `GET /api/assistente/avisos`, `GET /api/assistente/avisos/count`, `POST /api/assistente/avisos/marcar-lidas`.

- [ ] **Step 1: Hook `useAssistenteAvisos.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type Aviso = {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  proposalId: number | null;
  criadaEm: string;
};

export function useAssistenteAvisos(enabled: boolean) {
  const qc = useQueryClient();

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/assistente/avisos/count"],
    enabled,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: avisos = [] } = useQuery<Aviso[]>({
    queryKey: ["/api/assistente/avisos"],
    enabled,
    refetchInterval: 60000,
  });

  const marcarLidas = useMutation({
    mutationFn: async (ids?: number[]) => {
      const res = await apiRequest("POST", "/api/assistente/avisos/marcar-lidas", ids ? { ids } : {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assistente/avisos/count"] });
      qc.invalidateQueries({ queryKey: ["/api/assistente/avisos"] });
    },
  });

  return { count: countData?.count ?? 0, avisos, marcarLidas };
}
```

- [ ] **Step 2: Integrar no `AssistenteWidget.tsx`**

- Importar e usar `const { count, avisos, marcarLidas } = useAssistenteAvisos(podeUsarChat);` (após `podeUsarChat`).
- **Badge no botão flutuante:** sobre o `<button>` do avatar, se `count > 0`, renderizar um ponto vermelho com o número:

```tsx
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-5 right-5 z-50 h-16 w-16 transition hover:scale-110"
          title={`Perguntar pro ${NOME_MASCOTE}`}
        >
          <img src={AVATAR_URL} alt={NOME_MASCOTE} className="h-full w-full object-contain drop-shadow-lg" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      )}
```

- **Ao abrir o chat:** exibir os avisos como uma seção "Novidades" no topo da área de mensagens (quando `mensagens.length === 0` e há avisos), e marcar como lidos ao abrir. Ex.: num `useEffect(() => { if (aberto && count > 0) marcarLidas.mutate(undefined); }, [aberto])` — marca lidos ao abrir; e renderizar os `avisos` como cartões antes da saudação:

```tsx
            {avisos.length > 0 && (
              <div className="space-y-2">
                {avisos.map((a) => (
                  <div key={a.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    <div className="font-medium">{a.titulo}</div>
                    <div className="text-muted-foreground">{a.mensagem}</div>
                    {a.proposalId && (
                      <a href={`/contratos/${a.proposalId}`} className="mt-1 inline-block text-xs text-primary underline">
                        Ver proposta
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
```

(Ajustar ao layout real do widget; os avisos aparecem acima da saudação/mensagens.)

- [ ] **Step 3: Verificar** — `npm run check` + `npm run build`. Commit: `feat(jarvis): badge de avisos no botão + avisos no chat`.

---

## Task 5: Verificação e2e + isolamento

**Files:** nenhum (verificação).

- [ ] **Step 1: Build** — `npm run check` (0 novos vs 240) + `npm run build`.

- [ ] **Step 2: Smoke de isolamento (o crítico)** — via SQL/endpoint no dev/prod controlado:
  1. Criar aviso p/ user A (corretor 1) sobre proposta dele.
  2. `GET /api/assistente/avisos` logado como user B → NÃO retorna o aviso do A.
  3. `GET /api/assistente/avisos/count` do B → não conta o do A.
  4. Confirmar que a query SEMPRE tem `userId = req.user.id` (os 3 endpoints).

- [ ] **Step 3: Smoke funcional:**
  - Mudar uma proposta (do corretor X) para PAGO → aviso "contrato_pago" criado p/ X; badge aparece no Jarvis do X; abrir marca lido.
  - Pendenciar (status corretor) → aviso pendência. Pendenciar via PENDENTE_BANCO → NÃO gera aviso.
  - Cancelar → aviso cancelamento.
  - Re-salvar PAGO (já pago) → NÃO duplica (guard de transição).

- [ ] **Step 4: Review whole-branch** (superpowers:requesting-code-review) com foco em: isolamento (nenhuma query sem `userId`), não-quebra de `contracts.ts`, transição sem duplicar.

---

## Self-Review (na escrita)

- Cobertura: PAGO/pendência-corretor/cancelada (Task 3 pontos A/B/E), canal próprio (Task 1), endpoints isolados (Task 2), badge+chat (Task 4), isolamento testado (Task 5). PENDENTE_BANCO excluído (helper Task 2). Só-Jarvis (tabela própria, não toca sino).
- Sem placeholders: código concreto; pontos de "ler o arquivo real" em contracts.ts são instruções de verificação (nomes de variáveis por rota), não lacunas.
- Tipos: `notificarStatusProposta` e as rotas batem entre Task 2/3/4; `Aviso` do front bate com as colunas.
