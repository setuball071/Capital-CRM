# Unificação de Parcelas (Portabilidade) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Goal:** Permitir unificar várias propostas de portabilidade do mesmo cliente numa acumuladora (refin único), marcando as demais como "Unificada" e desconsiderando-as em toda contagem de produção (operacional + financeiro), de forma reversível.

**Architecture:** Uma "etiqueta" `unificada_em_id` na proposta absorvida aponta para a acumuladora. A acumuladora soma os valores e recebe o ADE de refin. Todos os pontos que somam produção passam a ignorar dinamicamente as absorvidas — no operacional pela flag, no financeiro ligando `producoes_contratos` → proposta absorvida (por `proposal_id` ou `ade`). Reversível via `valor_pre_unificacao`.

**Tech Stack:** React/Vite (wouter, React Query, shadcn/ui) + Express/Drizzle/Postgres. Deploy no Railway.

## Global Constraints

- **Sem suíte de testes / sem build local.** Verificação de cada tarefa = deploy no Railway + checagem. Build de frontend → confirmar pela troca do hash `index-*.js`; mudança só de backend → aguardar ~3 min.
- **Branch deployada = `migracao-cloudfy`.** Fluxo de deploy de toda tarefa: commit em `main` → `git push origin main` → `git checkout migracao-cloudfy && git rebase origin/migracao-cloudfy && git cherry-pick <main HEAD>` → `git push origin migracao-cloudfy` → `git checkout main`.
- **Working copy:** `G:\Meu Drive\COWORK\Code\Capital-CRM` (use sempre caminhos absolutos).
- **Migração de schema** entra pelo bloco idempotente de auto-migração no boot (`server/index.ts`) — nunca rodar SQL à mão.
- **Permissão de unificar/desunificar:** `user.isMaster || ["master","operacional","coordenacao"].includes(user.role)`. Corretor comum NÃO unifica.
- Drizzle helpers já importados em `server/contracts.ts`: `eq, and, desc, asc, sql, inArray`.

---

### Task 1: Modelo de dados (campos + migração + GET)

**Files:**
- Modify: `shared/schema.ts` (tabela `proposals`, perto de `paidAt`)
- Modify: `server/index.ts` (bloco de auto-migração, após o `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS paid_at`)
- Modify: `server/contracts.ts` (SELECT de `GET /api/contracts/proposals`, após `paidAt: proposals.paidAt`)

**Produces:** coluna `proposals.unificada_em_id` (int null) e `valor_pre_unificacao` (decimal null); campo `unificadaEmId` no schema drizzle e na listagem de propostas.

- [ ] **Step 1: Schema** — em `shared/schema.ts`, logo após `paidAt: timestamp("paid_at"),`:

```ts
  // Unificação de parcelas (portabilidade): aponta para a acumuladora; valor original p/ desfazer
  unificadaEmId: integer("unificada_em_id"),
  valorPreUnificacao: decimal("valor_pre_unificacao", { precision: 12, scale: 2 }),
```

- [ ] **Step 2: Auto-migração** — em `server/index.ts`, logo após o bloco `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`:

```ts
          await migDb.execute(migSql`
            ALTER TABLE proposals ADD COLUMN IF NOT EXISTS unificada_em_id INTEGER
          `);
          await migDb.execute(migSql`
            ALTER TABLE proposals ADD COLUMN IF NOT EXISTS valor_pre_unificacao DECIMAL(12,2)
          `);
```

- [ ] **Step 3: GET retorna o campo** — em `server/contracts.ts`, no `.select({...})` de `GET /api/contracts/proposals`, após `paidAt: proposals.paidAt,`:

```ts
          unificadaEmId: proposals.unificadaEmId,
```

- [ ] **Step 4: Commit + deploy** (fluxo padrão do Global Constraints):

```bash
git -C "G:/Meu Drive/COWORK/Code/Capital-CRM" add shared/schema.ts server/index.ts server/contracts.ts
git -C "G:/Meu Drive/COWORK/Code/Capital-CRM" commit -m "feat(unificacao): coluna unificada_em_id + valor_pre_unificacao (migracao no boot) e campo na listagem"
# push main + cherry-pick migracao-cloudfy + push (ver Global Constraints)
```

- [ ] **Step 5: Verificar** — após ~3 min, a listagem de contratos continua carregando sem erro (a coluna foi criada no boot; senão dá 500 "column does not exist"). Abrir `/contratos` e confirmar que lista normal.

---

### Task 2: Endpoints unificar / desunificar

**Files:**
- Modify: `server/contracts.ts` — adicionar 2 endpoints logo após o endpoint `POST /api/contracts/proposals/:id/clone`.

**Consumes:** `proposals.unificadaEmId`, `proposals.valorPreUnificacao` (Task 1).
**Produces:** `POST /api/contracts/proposals/:id/unificar` (body `{ absorverIds:number[], adeRefin?:string }`) e `POST /api/contracts/proposals/:id/desunificar`.

- [ ] **Step 1: Endpoint unificar** — adicionar em `server/contracts.ts`:

```ts
  // ─── Unificar parcelas (portabilidade) ──────────────────────────────────────
  app.post("/api/contracts/proposals/:id/unificar", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = req.tenantId!;
      const user = req.user!;
      if (!user.isMaster && !["master", "operacional", "coordenacao"].includes(user.role)) {
        return res.status(403).json({ message: "Sem permissão para unificar parcelas" });
      }
      const { absorverIds, adeRefin } = req.body;
      if (!Array.isArray(absorverIds) || absorverIds.length === 0) {
        return res.status(400).json({ message: "Selecione ao menos uma parcela para unificar" });
      }
      const [acum] = await db.select().from(proposals)
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId))).limit(1);
      if (!acum) return res.status(404).json({ message: "Proposta não encontrada" });
      if ((acum as any).unificadaEmId) {
        return res.status(400).json({ message: "Esta proposta já está unificada em outra" });
      }
      const cpfAcum = (acum.clientCpf || "").replace(/\D/g, "");
      const ids = absorverIds
        .map((x: any) => parseInt(String(x), 10))
        .filter((n: number) => !isNaN(n) && n !== id);
      if (!ids.length) return res.status(400).json({ message: "Seleção inválida" });

      const filhas = await db.select().from(proposals)
        .where(and(inArray(proposals.id, ids), eq(proposals.tenantId, tenantId)));
      for (const f of filhas) {
        if ((f.clientCpf || "").replace(/\D/g, "") !== cpfAcum) {
          return res.status(400).json({ message: "Todas as parcelas devem ser do mesmo CPF da acumuladora" });
        }
        if ((f as any).unificadaEmId) {
          return res.status(400).json({ message: `A proposta #${f.id} já está unificada` });
        }
      }
      // alguma das selecionadas já é acumuladora de outro grupo?
      const jaAcum = await db.select({ id: proposals.id }).from(proposals)
        .where(and(eq(proposals.tenantId, tenantId), inArray(proposals.unificadaEmId, ids))).limit(1);
      if (jaAcum.length) {
        return res.status(400).json({ message: "Uma das parcelas selecionadas já é acumuladora de outro grupo" });
      }

      const soma = filhas.reduce((s, f) => s + (parseFloat(String(f.contractValue || "0")) || 0), 0);
      const valorAcumAtual = parseFloat(String(acum.contractValue || "0")) || 0;
      // preserva o valor original só na primeira unificação
      const valorPre = (acum as any).valorPreUnificacao != null
        ? parseFloat(String((acum as any).valorPreUnificacao))
        : valorAcumAtual;

      await db.update(proposals).set({
        contractValue: String(valorAcumAtual + soma),
        valorPreUnificacao: String(valorPre),
        adeRefin: adeRefin || (acum as any).adeRefin || null,
        updatedAt: new Date(),
      } as any).where(eq(proposals.id, id));

      await db.update(proposals).set({ unificadaEmId: id, updatedAt: new Date() } as any)
        .where(and(inArray(proposals.id, filhas.map((f) => f.id)), eq(proposals.tenantId, tenantId)));

      await db.insert(proposalHistory).values({
        proposalId: id,
        toStatus: acum.status,
        action: "AVANCO",
        notes: `Unificadas: ${filhas.map((f) => "#" + f.id).join(", ")}${adeRefin ? ` (ADE refin ${adeRefin})` : ""}`,
        performedBy: user.id,
      });

      return res.json({ ok: true, unificadas: filhas.map((f) => f.id) });
    } catch (e: any) {
      console.error("POST /api/contracts/proposals/:id/unificar error:", e);
      return res.status(500).json({ message: `Erro ao unificar: ${e?.message || e}` });
    }
  });

  // ─── Desfazer unificação ────────────────────────────────────────────────────
  app.post("/api/contracts/proposals/:id/desunificar", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = req.tenantId!;
      const user = req.user!;
      if (!user.isMaster && !["master", "operacional", "coordenacao"].includes(user.role)) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      const [acum] = await db.select().from(proposals)
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId))).limit(1);
      if (!acum) return res.status(404).json({ message: "Proposta não encontrada" });

      const valorPre = (acum as any).valorPreUnificacao;
      await db.update(proposals).set({
        ...(valorPre != null ? { contractValue: String(valorPre) } : {}),
        valorPreUnificacao: null,
        updatedAt: new Date(),
      } as any).where(eq(proposals.id, id));

      await db.update(proposals).set({ unificadaEmId: null, updatedAt: new Date() } as any)
        .where(and(eq(proposals.unificadaEmId, id), eq(proposals.tenantId, tenantId)));

      await db.insert(proposalHistory).values({
        proposalId: id, toStatus: acum.status, action: "AVANCO",
        notes: "Unificação desfeita", performedBy: user.id,
      });
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("POST /api/contracts/proposals/:id/desunificar error:", e);
      return res.status(500).json({ message: "Erro ao desfazer unificação" });
    }
  });
```

- [ ] **Step 2: Commit + deploy** (fluxo padrão).
- [ ] **Step 3: Verificar** — backend buildou (aguardar ~3 min). Validação completa do comportamento ocorre na Task 5 (UI). Pode-se conferir os logs de boot sem erro.

---

### Task 3: Exclusão da produção no backend (financeiro + dashboards + relatório semanal)

**Files:**
- Modify: `server/routes.ts` — 4 locais: `/api/financeiro/producao`, `/api/dashboard-vendedor`, `/api/dashboard-gestor`, `/api/metas/digitacao-semanal`.

**Consumes:** `proposals.unificadaEmId` (Task 1).

- [ ] **Step 1: Financeiro/produção** — em `/api/financeiro/producao` (`server/routes.ts`), no array `conditions` (após `sql\`${producoesContratos.comissaoRepasseValor}::numeric > 0\``), adicionar:

```ts
      // Exclui contratos de propostas que foram UNIFICADAS em outra (não somam produção)
      conditions.push(sql`NOT EXISTS (
        SELECT 1 FROM proposals pa
        WHERE pa.tenant_id = ${producoesContratos.tenantId}
          AND pa.unificada_em_id IS NOT NULL
          AND (pa.id = ${producoesContratos.proposalId} OR pa.ade = ${producoesContratos.contratoId})
      )`);
```

- [ ] **Step 2: dashboard-vendedor** — em cada query de `producoes_contratos` desse endpoint (a de `prodContratosResult` e a de `prodTotaisResult`), adicionar dentro do `WHERE` (a tabela está sem alias, use o nome):

```sql
          AND NOT EXISTS (
            SELECT 1 FROM proposals pa
            WHERE pa.tenant_id = producoes_contratos.tenant_id
              AND pa.unificada_em_id IS NOT NULL
              AND (pa.id = producoes_contratos.proposal_id OR pa.ade = producoes_contratos.contrato_id)
          )
```

- [ ] **Step 3: dashboard-gestor** — nas subqueries `SELECT SUM(pc.valor_base) FROM producoes_contratos pc WHERE ...` (alias `pc`), adicionar:

```sql
          AND NOT EXISTS (
            SELECT 1 FROM proposals pa
            WHERE pa.tenant_id = pc.tenant_id
              AND pa.unificada_em_id IS NOT NULL
              AND (pa.id = pc.proposal_id OR pa.ade = pc.contrato_id)
          )
```

- [ ] **Step 4: Relatório semanal** — em `/api/metas/digitacao-semanal`, nas DUAS queries (linhas e propostas), o alias é `p`. Adicionar após `AND p.status NOT IN ('CANCELADA', 'PERDIDA')`:

```sql
          AND p.unificada_em_id IS NULL
```

- [ ] **Step 5: Commit + deploy** (fluxo padrão). Mudança só de backend (~3 min).
- [ ] **Step 6: Verificar** — após a Task 5, ao unificar parcelas, conferir que o Financeiro→Contratos, os dashboards e o relatório semanal deixam de somar as absorvidas.

---

### Task 4: Exclusão nas caixas + badge na listagem (frontend)

**Files:**
- Modify: `client/src/pages/contratos-lista.tsx` — função `prodValueOf` e a célula de Status da linha.

**Consumes:** campo `unificadaEmId` da proposta (Task 1).

- [ ] **Step 1: Caixas não somam absorvidas** — em `prodValueOf(p)`, na primeira linha do corpo:

```ts
  function prodValueOf(p: any) {
    if (p.unificadaEmId) return 0; // unificada em outra → não soma produção
    if (CANCEL_STATUSES.includes(p.status)) return 0;
    // ...resto inalterado
```

- [ ] **Step 2: Badge "Unificada" na linha** — na célula de Status (onde já existe o badge "Pend." e a tag CIP), adicionar dentro do `<div className="flex items-center gap-1">`, após o `<StatusBadge .../>`:

```tsx
                      {p.unificadaEmId && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          Unificada
                        </span>
                      )}
```

- [ ] **Step 3: Commit + deploy** (fluxo padrão; frontend → confirmar pela troca do hash).
- [ ] **Step 4: Verificar** — após a Task 5, uma proposta absorvida mostra o badge "Unificada" e não soma no valor das caixas.

---

### Task 5: UI no detalhe — Unificar, Desfazer, seção e bloqueio (frontend)

**Files:**
- Modify: `client/src/pages/contratos-detalhe.tsx`

**Consumes:** endpoints da Task 2; campo `unificadaEmId`.

- [ ] **Step 1: Estado + queries** — perto dos estados de clone (`showClone`...), adicionar:

```tsx
  // Unificação de parcelas
  const [showUnificar, setShowUnificar] = useState(false);
  const [unifSelecionadas, setUnifSelecionadas] = useState<number[]>([]);
  const [unifAdeRefin, setUnifAdeRefin] = useState("");
  const isUnifGestor = !!(user?.isMaster || ["master", "operacional", "coordenacao"].includes(user?.role || ""));

  // Outras propostas do mesmo CPF (para selecionar na unificação) + filhas desta acumuladora
  const cpfDigits = (proposal.clientCpf || "").replace(/\D/g, "");
  const { data: irmas = [] } = useQuery<any[]>({
    queryKey: ["/api/contracts/client-proposals", cpfDigits],
    enabled: isUnifGestor && cpfDigits.length === 11,
    queryFn: async () => {
      const res = await fetch(`/api/contracts/proposals?cpf=${cpfDigits}`, { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });
```

> NOTA: se `GET /api/contracts/proposals` ainda não filtrar por `cpf`, usar o lookup já existente OU filtrar no cliente a partir da listagem. Para manter simples e correto, FILTRAR NO CLIENTE: trocar a query acima por uma que busca todas as propostas e filtra por CPF. Implementação concreta abaixo no Step 2 (usa a listagem geral já carregada via React Query key `/api/contracts/proposals`).

- [ ] **Step 2: Substituir a query por filtro client-side** — em vez do fetch por cpf (não garantido no backend), reusar a listagem geral:

```tsx
  const { data: todasPropostas = [] } = useQuery<any[]>({
    queryKey: ["/api/contracts/proposals"],
    enabled: isUnifGestor,
  });
  const candidatasUnif = (todasPropostas as any[]).filter((p) =>
    (p.clientCpf || "").replace(/\D/g, "") === cpfDigits &&
    p.id !== proposal.id &&
    !p.unificadaEmId &&
    !["CANCELADA", "PERDIDA"].includes(p.status)
  );
  const filhasUnif = (todasPropostas as any[]).filter((p) => p.unificadaEmId === proposal.id);
```

- [ ] **Step 3: Mutations** — perto da `cloneMutation`:

```tsx
  const unificarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}/unificar`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ absorverIds: unifSelecionadas, adeRefin: unifAdeRefin || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Erro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals"] });
      invalidate(); setShowUnificar(false); setUnifSelecionadas([]); setUnifAdeRefin("");
      toast({ title: "Parcelas unificadas" });
    },
    onError: (e: any) => toast({ title: "Falha ao unificar", description: e.message, variant: "destructive" }),
  });
  const desunificarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contracts/proposals/${proposalId}/desunificar`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Erro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/proposals"] });
      invalidate(); toast({ title: "Unificação desfeita" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
```

- [ ] **Step 4: Banner na absorvida + bloqueio de edição** — logo no topo do conteúdo da ficha (antes da seção Dados do Cliente), adicionar:

```tsx
      {proposal.unificadaEmId && (
        <div className="rounded-md border border-purple-200 bg-purple-50 dark:border-purple-900/40 dark:bg-purple-950/20 p-3 text-sm text-purple-700 dark:text-purple-300">
          Esta parcela foi <strong>unificada na proposta #{proposal.unificadaEmId}</strong> e não conta na produção.
          {" "}
          <button className="underline" onClick={() => setLocation(`/contratos/${proposal.unificadaEmId}`)}>Abrir a acumuladora</button>
        </div>
      )}
```

E na variável `canEditFields` (linha onde é definida), bloquear se for absorvida:

```tsx
  const canEditFields = !proposal.unificadaEmId && (masterEditAll || (!isTerminal && (isOperacional || (isVendedor && (!!currentStatusDef?.allowsVendorEdit || !!currentStatusDef?.returnStatusKey)))));
```

- [ ] **Step 5: Botão "Unificar parcelas" + "Desfazer"** — no grupo de botões do cabeçalho (perto de Clonar/Editar tudo), adicionar:

```tsx
          {isUnifGestor && !proposal.unificadaEmId && filhasUnif.length === 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setUnifSelecionadas([]); setUnifAdeRefin(""); setShowUnificar(true); }} title="Unificar parcelas">
              <Copy className="h-4 w-4" /> Unificar
            </Button>
          )}
          {isUnifGestor && filhasUnif.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => desunificarMutation.mutate()} disabled={desunificarMutation.isPending} title="Desfazer unificação">
              <X className="h-4 w-4" /> Desfazer unificação
            </Button>
          )}
```

- [ ] **Step 6: Seção "Parcelas unificadas" na acumuladora** — após a seção Operação (ou perto do Histórico), adicionar:

```tsx
      {filhasUnif.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Copy className="h-4 w-4" /> Parcelas unificadas ({filhasUnif.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {filhasUnif.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                <button className="text-left hover:underline" onClick={() => setLocation(`/contratos/${f.id}`)}>
                  #{f.id} · {f.bank || "—"} · {f.ade || "sem ADE"}
                </button>
                <span className="font-medium">{formatMoney(f.contractValue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 7: Modal de unificação** — perto do diálogo de Clonar, adicionar:

```tsx
      <Dialog open={showUnificar} onOpenChange={setShowUnificar}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Unificar parcelas em #{proposal.id}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Selecione as parcelas do mesmo cliente que serão absorvidas nesta. Elas deixam de contar na produção; o valor é somado aqui.
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {candidatasUnif.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma outra parcela disponível para este CPF.</p>
            ) : candidatasUnif.map((c) => {
              const checked = unifSelecionadas.includes(c.id);
              return (
                <label key={c.id} className="flex items-center gap-2 text-sm border rounded-md p-2 cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={(e) =>
                    setUnifSelecionadas((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id))
                  } />
                  <span className="flex-1">#{c.id} · {c.bank || "—"} · {c.ade || "sem ADE"}</span>
                  <span className="font-medium">{formatMoney(c.contractValue)}</span>
                </label>
              );
            })}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">ADE de refin</p>
            <Input value={unifAdeRefin} onChange={(e) => setUnifAdeRefin(e.target.value)} placeholder="Número do ADE de refinanciamento" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowUnificar(false)}>Cancelar</Button>
            <Button disabled={unifSelecionadas.length === 0 || unificarMutation.isPending} onClick={() => unificarMutation.mutate()}>
              {unificarMutation.isPending ? "Unificando..." : "Unificar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 8: Commit + deploy** (fluxo padrão; frontend → confirmar pela troca do hash).
- [ ] **Step 9: Verificar (fluxo completo)** — Ctrl+Shift+R; abrir uma proposta de portabilidade de um cliente com várias parcelas → "Unificar" → selecionar 2 parcelas + ADE de refin → confirmar. Esperado:
  - Acumuladora: valor somado, ADE de refin, seção "Parcelas unificadas" com as 2.
  - Absorvidas: badge "Unificada" na listagem, banner na ficha, edição bloqueada.
  - Caixas/relatório/financeiro: produção das absorvidas não soma; só a acumuladora.
  - "Desfazer unificação" → tudo volta ao normal (valor restaurado, badges somem).

---

## Self-Review (feito)

- **Cobertura da spec:** modelo de dados (T1) ✓; endpoints unificar/desunificar (T2) ✓; exclusão financeiro + 2 dashboards + relatório semanal (T3) ✓; caixas + badge (T4) ✓; UI detalhe — botão, modal, seção, desfazer, banner, bloqueio (T5) ✓; regras de borda (mesmo CPF, sem correntes, sem absorvida) nas validações do endpoint (T2) ✓; permissão operacional/admin/master ✓.
- **Sem placeholders:** todo passo de código tem o código real. (Exceção consciente: T5 Step 1 traz uma NOTA e o Step 2 a substitui pela versão definitiva client-side — usar o Step 2.)
- **Consistência de nomes:** `unificadaEmId`/`unificada_em_id`, `valorPreUnificacao`/`valor_pre_unificacao` usados de forma consistente entre schema, migração, endpoints, queries e UI. Endpoints `/unificar` e `/desunificar` referenciados igualmente na UI.
