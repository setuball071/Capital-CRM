# Domínio Próprio na Ficha do Ambiente (registro automático no Railway) — Plano de Implementação

> **For agentic workers:** Execute tarefa a tarefa, em ordem. Cada tarefa termina com um `npm run build` verde e um commit. Este repositório **NÃO tem suíte de testes** — a verificação é build + checagem manual no deploy (Railway). Não invente `npm test`.

**Goal:** Fazer o botão "Adicionar Domínio" da ficha do ambiente (Administração → Ambientes) registrar o domínio no Railway automaticamente (emissão de SSL) e devolver o alvo do CNAME para o dono repassar ao cliente — hoje ele só grava a linha no banco.

**Architecture:** O endpoint `POST /api/admin/tenants/:id/domains` passa a chamar `addCustomDomain()` (já existente em `server/railway.ts`, usado pelo wizard) em modo best-effort: a linha em `tenant_domains` continua sendo a fonte de verdade; se o Railway falhar ou não estiver configurado, o admin recebe um aviso e registra manualmente. O frontend passa a exibir o CNAME retornado num diálogo de resultado, com botão de copiar.

**Tech Stack:** Node/Express + Drizzle ORM (backend), React 18 + TanStack Query + shadcn/ui (frontend). Railway Public API (GraphQL).

## Global Constraints

- Deploy: `git push origin migracao-cloudfy` → Railway faz build/deploy automático. NÃO usar Replit/Vercel.
- Sem suíte de testes. Verificação = `npm run build` (sem erros) + checagem manual pós-deploy.
- Mudanças cirúrgicas: mexer só no fluxo de domínio. Não refatorar código adjacente.
- Best-effort no Railway: **nunca** deixar uma falha do Railway impedir a gravação em `tenant_domains` (o vínculo domínio↔tenant não pode se perder).
- Mensagens ao usuário em português.

---

## PRÉ-REQUISITO (ação manual do Fábio — fazer ANTES de testar, não bloqueia o código)

O código já funciona com ou sem token (best-effort). Mas para o registro automático no Railway funcionar, o Fábio precisa setar **`RAILWAY_API_TOKEN`**:

1. Gerar o token: **https://railway.com/account/tokens** → "Create Token".
   - Use um **Account Token** (ou **Team Token**, se o projeto `caring-adventure` estiver sob um time). **NÃO** use "Project Token" — o código autentica via `Authorization: Bearer`, que não aceita project token.
2. Railway → projeto `caring-adventure` → serviço do CRM → aba **Variables** → adicionar:
   - `RAILWAY_API_TOKEN` = `<token colado>`
   - **Não** precisa setar `RAILWAY_SERVICE_ID` nem `RAILWAY_ENVIRONMENT_ID` — o Railway injeta as duas automaticamente no runtime (confirmado em `server/railway.ts:7-8`).
3. Salvar (isso dispara um redeploy).
4. Conferir: abrir o CRM logado como master → o hint no diálogo "Adicionar Domínio" deve dizer que o registro é automático (Task 2), ou checar `GET /api/admin/saas-config` retornando `railwayConfigured: true`.

**Limite do plano Railway:** confirmar quantos custom domains o plano atual (Hobby) permite por serviço. Se forem muitos clientes, pode ser necessário subir de plano. Verificar no painel do Railway — não assumir um número.

---

## Task 1: Backend — registrar domínio no Railway ao adicionar pela ficha

**Files:**
- Modify: `server/routes.ts:21317-21367` (endpoint `POST /api/admin/tenants/:id/domains`)

**Interfaces:**
- Consome: `railwayConfigured()` e `addCustomDomain(domain): Promise<{ id: string; cnameAlvo: string | null }>` de `server/railway.ts` (já existem).
- Produz: a resposta do endpoint passa de `result[0]` (a linha) para `{ ...result[0], cnameAlvo: string | null, warnings: string[] }`. A Task 2 depende desse novo formato.

- [ ] **Step 1: Substituir o bloco de inserção + resposta**

Localize, no endpoint `POST /api/admin/tenants/:id/domains`, este trecho (o final do `try`, logo após a checagem de "Domínio já está em uso"):

```ts
        const result = await db
          .insert(tenantDomains)
          .values({
            tenantId,
            domain: cleanDomain,
            isPrimary: isPrimary || false,
          })
          .returning();

        res.status(201).json(result[0]);
```

Troque por:

```ts
        const result = await db
          .insert(tenantDomains)
          .values({
            tenantId,
            domain: cleanDomain,
            isPrimary: isPrimary || false,
          })
          .returning();

        // Registra no Railway para o SSL ser emitido (best-effort, igual ao wizard).
        // A linha em tenant_domains já está gravada e é a fonte de verdade: se o
        // Railway falhar ou não estiver configurado, devolvemos um aviso e o admin
        // registra manualmente no painel — o vínculo domínio↔tenant não se perde.
        let cnameAlvo: string | null = null;
        const warnings: string[] = [];
        try {
          const { railwayConfigured, addCustomDomain } = await import("./railway");
          if (railwayConfigured()) {
            const created = await addCustomDomain(cleanDomain);
            cnameAlvo = created.cnameAlvo;
          } else {
            warnings.push(
              "Railway API não configurada (RAILWAY_API_TOKEN) — registre o domínio manualmente no painel do Railway para o SSL ser emitido.",
            );
          }
        } catch (e: any) {
          warnings.push(
            `Railway: ${e?.message || "falha ao registrar domínio"} — registre manualmente no painel do Railway.`,
          );
        }

        res.status(201).json({ ...result[0], cnameAlvo, warnings });
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build conclui sem erro de TypeScript. (O warning pré-existente de `storageKey` duplicado em `shared/schema.ts` é esperado — ignore.)

- [ ] **Step 3: Commit**

```bash
git add server/routes.ts
git commit -m "feat: registra dominio no Railway ao adicionar pela ficha do ambiente"
```

---

## Task 2: Frontend — exibir o CNAME e avisos após adicionar

**Files:**
- Modify: `client/src/pages/admin-tenants.tsx` (mutation `addDomainMutation` ~381; diálogo "Adicionar Domínio" ~1105; adicionar um novo diálogo de resultado; novo state)

**Interfaces:**
- Consome: o novo formato de resposta da Task 1 (`{ domain, cnameAlvo, warnings }`) e `saasConfig.railwayConfigured` (já disponível via query em `admin-tenants.tsx:307`).
- Reusa símbolos já importados no arquivo: `CheckCircle2`, `AlertTriangle`, `Copy`, `DialogFooter`, e a função `copyText` (usados no diálogo de resultado do wizard).

- [ ] **Step 1: Adicionar o state do resultado**

Localize a linha do state do novo domínio (`admin-tenants.tsx:250`):

```ts
  const [newDomain, setNewDomain] = useState({ domain: "", isPrimary: false });
```

Logo abaixo dela, adicione:

```ts
  const [domainResult, setDomainResult] = useState<{ domain: string; cnameAlvo: string | null; warnings: string[] } | null>(null);
```

- [ ] **Step 2: Fazer a mutation ler o JSON e guardar o resultado**

Substitua a `addDomainMutation` inteira (`admin-tenants.tsx:381-397`) por:

```ts
  const addDomainMutation = useMutation({
    mutationFn: async (data: { tenantId: number; domain: string; isPrimary: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/tenants/${data.tenantId}/domains`, {
        domain: data.domain,
        isPrimary: data.isPrimary,
      });
      return (await res.json()) as { domain: string; cnameAlvo: string | null; warnings: string[] };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedTenant?.id, "domains"] });
      setIsAddDomainOpen(false);
      setNewDomain({ domain: "", isPrimary: false });
      setDomainResult(result);
      toast({ title: "Domínio adicionado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar domínio", description: error.message, variant: "destructive" });
    },
  });
```

(Mudanças: `mutationFn` agora faz `await res.json()`; `onSuccess` recebe `result` e chama `setDomainResult(result)`.)

- [ ] **Step 3: Melhorar a descrição do diálogo "Adicionar Domínio" conforme o Railway está ou não configurado**

Localize (`admin-tenants.tsx:1108-1110`):

```tsx
            <DialogDescription>
              Configure um domínio para este ambiente
            </DialogDescription>
```

Substitua por:

```tsx
            <DialogDescription>
              Configure um domínio próprio para este ambiente.
              {saasConfig?.railwayConfigured
                ? " O registro no Railway (SSL) é automático — o alvo do CNAME aparece após adicionar."
                : " Atenção: Railway API não configurada — o domínio será gravado, mas será preciso registrá-lo manualmente no painel do Railway."}
            </DialogDescription>
```

- [ ] **Step 4: Adicionar o diálogo de resultado (mostra o CNAME pro cliente apontar)**

Localize o fechamento do diálogo "Adicionar Domínio" (`admin-tenants.tsx:1167-1168`):

```tsx
        </DialogContent>
      </Dialog>
```

(É o `</Dialog>` que fecha o diálogo cujo `DialogTitle` é "Adicionar Domínio".)

Imediatamente **após** esse `</Dialog>`, insira um novo bloco:

```tsx
      {/* ===== Resultado ao adicionar domínio (mostra o CNAME pro cliente apontar) ===== */}
      <Dialog open={!!domainResult} onOpenChange={(open) => { if (!open) setDomainResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Domínio adicionado
            </DialogTitle>
            <DialogDescription>
              Repasse ao cliente o registro de DNS abaixo para o domínio começar a funcionar com SSL.
            </DialogDescription>
          </DialogHeader>
          {domainResult && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border p-4 space-y-1">
                <p className="text-muted-foreground text-xs">Domínio</p>
                <p className="font-mono">{domainResult.domain}</p>
              </div>
              {domainResult.cnameAlvo ? (
                <div className="rounded-md border p-4 space-y-2">
                  <p className="text-muted-foreground text-xs">O cliente deve criar um registro CNAME apontando para:</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-foreground break-all">{domainResult.cnameAlvo}</p>
                    <Button variant="ghost" size="icon" onClick={() => copyText(domainResult.cnameAlvo || "", "CNAME")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O SSL é emitido automaticamente pelo Railway assim que o DNS propagar (pode levar alguns minutos).
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Alvo de CNAME não retornado — pegue o alvo no painel do Railway (Settings → Networking) após registrar o domínio.
                </p>
              )}
              {domainResult.warnings.length > 0 && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-1">
                  {domainResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDomainResult(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: Confirmar imports**

Verifique no topo de `admin-tenants.tsx` que `CheckCircle2`, `AlertTriangle`, `Copy` estão importados de `lucide-react`, e que `DialogFooter` está importado junto dos outros `Dialog*` de `@/components/ui/dialog`. Todos já são usados no diálogo de resultado do wizard, então devem existir. Se algum faltar, adicione ao import existente (não crie import novo duplicado). Confirme também que `copyText` é uma função definida no componente (usada em `admin-tenants.tsx:1616`).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build sem erros de TypeScript.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin-tenants.tsx
git commit -m "feat: exibe CNAME e avisos ao adicionar dominio proprio na ficha"
```

---

## Task 3 (OPCIONAL, recomendada): DELETE também remove o domínio do Railway

**Por que:** hoje o DELETE (`routes.ts:21369`) só apaga a linha em `tenant_domains`. O domínio continua "registrado" no Railway, ocupando um slot do plano (relevante por causa do limite de custom domains). Esta tarefa libera o slot ao remover.

**Custo:** exige **uma coluna nova** (`railway_domain_id`) para guardar o id que o Railway devolve na criação, além de uma migração de boot e uma função `removeCustomDomain`. Se o Fábio preferir remover manualmente no painel do Railway por enquanto, **pule esta tarefa** — as Tasks 1 e 2 já entregam o pedido (Opção B).

**Files:**
- Modify: `shared/schema.ts` (tabela `tenantDomains` — adicionar `railwayDomainId`)
- Modify: `server/index.ts` (migração de boot idempotente)
- Modify: `server/railway.ts` (adicionar `removeCustomDomain`)
- Modify: `server/routes.ts` (guardar o id na criação; chamar remoção no DELETE)

- [ ] **Step 1: Declarar a coluna no schema**

Em `shared/schema.ts`, na definição da tabela `tenantDomains`, adicione a coluna (junto das demais colunas de texto):

```ts
  railwayDomainId: text("railway_domain_id"),
```

- [ ] **Step 2: Migração de boot idempotente**

Em `server/index.ts`, dentro do bloco de migrações de boot (junto das outras `ADD COLUMN IF NOT EXISTS`), adicione:

```ts
    await saasDb.execute(saasSql`
      ALTER TABLE tenant_domains
        ADD COLUMN IF NOT EXISTS railway_domain_id TEXT
    `);
```

(Use o mesmo `saasDb`/`saasSql` que as migrações vizinhas usam. Se o bloco usar outra variável de conexão, siga o padrão local.)

- [ ] **Step 3: Adicionar `removeCustomDomain` ao railway.ts**

No fim de `server/railway.ts`, adicione:

```ts
// Remove um domínio próprio do serviço no Railway, liberando o slot do plano.
// Recebe o id retornado por addCustomDomain (guardado em tenant_domains.railway_domain_id).
export async function removeCustomDomain(id: string): Promise<void> {
  if (!railwayConfigured()) {
    throw new Error("Railway API não configurada");
  }
  const res = await fetch(RAILWAY_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`,
    },
    body: JSON.stringify({
      query: `mutation customDomainDelete($id: String!) {
        customDomainDelete(id: $id)
      }`,
      variables: { id },
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data.errors?.length) {
    const msg = data.errors?.[0]?.message || `Railway API falhou (HTTP ${res.status})`;
    throw new Error(msg);
  }
}
```

> **Nota de verificação:** confira a assinatura da mutation `customDomainDelete` contra o schema atual da Railway Public API antes de confiar 100% (a Railway às vezes muda o tipo do argumento entre `String!` e `ID!`). Se a mutation falhar, ela cai no `catch` do Step 5 e vira apenas um aviso — não quebra a remoção no CRM.

- [ ] **Step 4: Guardar o `railwayDomainId` na criação (ajuste na Task 1)**

Em `server/routes.ts`, no endpoint de adicionar domínio (bloco da Task 1), quando `addCustomDomain` retornar, grave o id. Substitua o trecho:

```ts
          if (railwayConfigured()) {
            const created = await addCustomDomain(cleanDomain);
            cnameAlvo = created.cnameAlvo;
          } else {
```

por:

```ts
          if (railwayConfigured()) {
            const created = await addCustomDomain(cleanDomain);
            cnameAlvo = created.cnameAlvo;
            if (created.id) {
              await db
                .update(tenantDomains)
                .set({ railwayDomainId: created.id })
                .where(eq(tenantDomains.id, result[0].id));
            }
          } else {
```

- [ ] **Step 5: Remover do Railway no DELETE**

Substitua o corpo do endpoint DELETE (`routes.ts:21374-21382`) por:

```ts
      try {
        const domainId = parseInt(req.params.domainId);
        const [row] = await db
          .select()
          .from(tenantDomains)
          .where(eq(tenantDomains.id, domainId))
          .limit(1);

        // Best-effort: tira do Railway antes de apagar do banco. Se falhar, segue
        // apagando do CRM (o admin pode limpar o resto no painel do Railway).
        if (row?.railwayDomainId) {
          try {
            const { railwayConfigured, removeCustomDomain } = await import("./railway");
            if (railwayConfigured()) {
              await removeCustomDomain(row.railwayDomainId);
            }
          } catch (e) {
            console.error("Railway removeCustomDomain falhou:", e);
          }
        }

        await db.delete(tenantDomains).where(eq(tenantDomains.id, domainId));
        res.json({ message: "Domínio removido" });
      } catch (error) {
        console.error("Delete domain error:", error);
        res.status(500).json({ message: "Erro ao remover domínio" });
      }
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 7: Commit**

```bash
git add shared/schema.ts server/index.ts server/railway.ts server/routes.ts
git commit -m "feat: DELETE de dominio tambem remove o registro no Railway"
```

---

## Deploy

Após as tarefas escolhidas:

```bash
git push origin migracao-cloudfy
```

Railway faz build/deploy automático.

## Verificação manual (pós-deploy)

Sem suíte de testes — checar no ambiente real, logado como **master**:

1. **Sem token (estado atual, antes do Fábio setar `RAILWAY_API_TOKEN`):** Administração → Ambientes → abrir um ambiente → aba Domínios → "Adicionar Domínio" → digitar `crm.teste.com.br` → o diálogo de resultado abre com o **aviso âmbar** de "Railway API não configurada" e sem CNAME. A linha aparece na lista. **Nada quebra.**
2. **Com token setado:** repetir → o resultado mostra o **alvo do CNAME** com botão de copiar, sem aviso. Conferir no painel do Railway (serviço → Settings → Networking) que o domínio apareceu como custom domain.
3. **DNS + SSL (Task 3 não afeta isto):** apontar um CNAME real de teste para o alvo → aguardar propagação → acessar `https://crm.teste.com.br` → deve resolver no tenant certo (via `resolveTenant`) com cadeado válido.
4. **Remoção (se Task 3 feita):** remover o domínio na ficha → conferir no painel do Railway que ele sumiu (slot liberado).

## Self-Review (feita)

- **Cobertura:** o pedido (Opção B = botão da ficha registrar no Railway) é coberto por Tasks 1+2. Task 3 (liberar slot ao remover) é o complemento natural, marcada opcional.
- **Consistência de tipos:** resposta do endpoint `{ ...row, cnameAlvo, warnings }` casa com o que a mutation lê e o diálogo renderiza. `addCustomDomain` retorna `{ id, cnameAlvo }` — `id` usado na Task 3, `cnameAlvo` na Task 1.
- **Sem placeholders:** todo passo tem o código real e o comando exato.
- **Best-effort garantido:** em nenhum caminho uma falha do Railway impede a gravação/remoção em `tenant_domains`.
