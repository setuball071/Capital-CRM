# Oportunidades por CPF na ficha — Plano de Implementação

> **Para o executor:** faça **tarefa por tarefa, na ordem**. Cada uma termina em `npm run build` verde + commit. Este repo **NÃO tem suíte de testes** — a verificação é build + deploy (`git push origin migracao-cloudfy`) + conferência manual. NÃO invente framework de teste. Marque os `- [ ]`.

**Goal:** Ao abrir a ficha de um cliente, mostrar num popup a oportunidade daquele CPF vinda dos cortes de base (frase pronta + etiqueta + campos), importada por CPF na área de Observações.

**Architecture:** A oportunidade vive em `client_observations` (chave = CPF, não lead/campanha — o corte às vezes vai pra discadora). O import vira genérico (coluna desconhecida → jsonb) e assíncrono. O import de leads **não é tocado**.

**Tech Stack:** React 18, TanStack Query, shadcn/ui, Express, Drizzle, PostgreSQL, Papa Parse (já é dependência).

## Global Constraints
- Deploy: push em `migracao-cloudfy` → Railway builda/sobe. Nunca Replit/Vercel.
- Migração nova = bloco idempotente em `server/index.ts` (`ADD COLUMN IF NOT EXISTS`).
- `apiRequest(method,url,body?)` no front retorna `Response` → usar `await res.json()`.
- **NÃO tocar** em `sales_leads`, no import de higienizados nem em campanhas.
- `GET /api/client-observations/:cpf` mantém **404 quando vazio** (os 2 clients tratam 404 → null; mudar quebra ambos).
- Números do corte vêm com **ponto decimal** (`3403.43`) — guardar como **string crua** no jsonb, nunca aplicar parsing BR.
- Popup só para `categoria='oportunidade'`; sem dado, não abre.

---

## Task 1 — Schema: colunas, índice e drift do Drizzle

**Files:** Modify `server/index.ts` (bloco boot Admin SaaS), `shared/schema.ts:3834` (tabela `clientObservations`).

- [ ] **1.1** `shared/schema.ts` — declarar as colunas que já existem no banco mas faltam no Drizzle (`batch_id`/`filename`, de `migrations/client-observations-batch.sql`) e as novas:
```ts
export const clientObservations = pgTable("client_observations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull(),
  observation: text("observation").notNull(),
  importedBy: integer("imported_by").references(() => users.id),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  batchId: text("batch_id"),       // já existe no banco — declarar evita drop em drizzle-kit push
  filename: text("filename"),      // idem
  categoria: varchar("categoria", { length: 30 }).notNull().default("observacao"), // oportunidade | observacao
  etiqueta: varchar("etiqueta", { length: 50 }), // OPORTUNIDADE do corte (PORT/CARTAO/CARTAO+PORT)
  dados: jsonb("dados").default({}), // demais colunas do corte, genéricas
});
```
Manter o restante do arquivo intacto.

- [ ] **1.2** `server/index.ts`, dentro do bloco `===== ADMIN SAAS`, antes do `log("✓ Migração Admin SaaS...")`:
```ts
// Oportunidades por CPF (cortes de base) — estrutura na área de observações
await saasDb.execute(saasSql`
  ALTER TABLE client_observations
    ADD COLUMN IF NOT EXISTS categoria VARCHAR(30) NOT NULL DEFAULT 'observacao',
    ADD COLUMN IF NOT EXISTS etiqueta  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS dados     JSONB DEFAULT '{}'::jsonb
`);
// A leitura por CPF normaliza a coluna com REGEXP_REPLACE e hoje faz seq scan; índice funcional resolve
await saasDb.execute(saasSql`
  CREATE INDEX IF NOT EXISTS idx_client_obs_cpf_norm
    ON client_observations (tenant_id, (REGEXP_REPLACE(cpf, '[^0-9]', '', 'g')))
`);
```
- [ ] **1.3** `npm run build` verde. Commit: `feat(oportunidades): t1 - schema client_observations (categoria/etiqueta/dados), indice funcional e fim do drift do Drizzle`.

**Produz:** colunas `client_observations.categoria` (default `'observacao'`), `.etiqueta`, `.dados` (jsonb); índice `idx_client_obs_cpf_norm`.

---

## Task 2 — Import genérico e assíncrono

**Files:** Modify `server/routes.ts` (`POST /api/client-observations/import`, ~`:30348`).

**Consome:** colunas da Task 1.
**Produz:** resposta `{ jobId, total }`; job legível em `GET /api/vendas/import-job/:jobId` (endpoint já existe, `routes.ts:15476`, e usa o Map `importJobs`).

- [ ] **2.1** Substituir o parser manual por Papa Parse (já importado no arquivo — mesma config do import de higienizados, `routes.ts:15508`). Trocar o bloco que hoje faz split manual por:
```ts
const parsed = Papa.parse(fileContent, {
  header: true,
  skipEmptyLines: true,
  delimiter: "",        // auto-detecta ; ou ,
  dynamicTyping: false, // tudo string — números vêm com ponto decimal, não parsear
});
if (!parsed.data || parsed.data.length === 0) {
  return res.status(400).json({ message: "Arquivo CSV vazio ou inválido" });
}
```
Manter acima o tratamento de encoding/BOM que já existe (`:30364-30372`).

- [ ] **2.2** Mapeamento genérico. Normalizador de header + classificação por linha:
```ts
const norm = (h: string) => h.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
const headers = Object.keys(parsed.data[0] as Record<string, string>);
const hCpf = headers.find(h => norm(h) === "CPF");
if (!hCpf) return res.status(400).json({ message: "O CSV precisa ter uma coluna CPF" });
const hTexto = headers.find(h => norm(h) === "RESUMO") || headers.find(h => ["OBSERVACAO", "OBSERVAÇÃO"].includes(norm(h)));
const hEtiqueta = headers.find(h => norm(h) === "OPORTUNIDADE");
const CONTROLE = new Set([norm(hCpf), hTexto ? norm(hTexto) : "", hEtiqueta ? norm(hEtiqueta) : ""]);
```
- [ ] **2.3** Responder na hora e processar em background (padrão do higienizados, `routes.ts:15505-15512`):
```ts
const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
importJobs.set(jobId, { status: "processing", progress: 0, total: parsed.data.length });
res.json({ jobId, total: parsed.data.length });
setImmediate(async () => { /* corpo do 2.4 */ });
```
- [ ] **2.4** Dentro do `setImmediate`: montar as linhas e inserir **em lote de 200**, mantendo o `ON CONFLICT` existente:
```ts
try {
  const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = req.file.originalname;
  let imported = 0, skipped = 0, errors = 0, done = 0;
  const linhas = parsed.data as Record<string, string>[];

  for (let i = 0; i < linhas.length; i += 200) {
    const fatia = linhas.slice(i, i + 200);
    for (const row of fatia) {
      const cpf = String(row[hCpf!] || "").replace(/\D/g, "");
      if (cpf.length < 11) { errors++; done++; continue; }
      const texto = hTexto ? String(row[hTexto] || "").trim() : "";
      const etiqueta = hEtiqueta ? String(row[hEtiqueta] || "").trim() : "";
      const dados: Record<string, string> = {};
      for (const [h, v] of Object.entries(row)) {
        if (CONTROLE.has(norm(h))) continue;
        const val = String(v ?? "").trim();
        if (val) dados[norm(h)] = val; // chave normalizada, valor cru
      }
      if (!texto && !etiqueta && Object.keys(dados).length === 0) { errors++; done++; continue; }
      const categoria = (texto && hTexto && norm(hTexto) === "RESUMO") || etiqueta ? "oportunidade" : "observacao";
      const obsFinal = texto || etiqueta || "Oportunidade importada";
      try {
        const r = await db.execute(sql`
          INSERT INTO client_observations (tenant_id, cpf, observation, imported_by, imported_at, batch_id, filename, categoria, etiqueta, dados)
          VALUES (${tenantId}, ${cpf}, ${obsFinal}, ${userId}, NOW(), ${batchId}, ${filename}, ${categoria}, ${etiqueta || null}, ${JSON.stringify(dados)}::jsonb)
          ON CONFLICT (tenant_id, cpf, observation) DO NOTHING
          RETURNING id
        `);
        if (r.rows.length > 0) imported++; else skipped++;
      } catch { errors++; }
      done++;
    }
    importJobs.set(jobId, { status: "processing", progress: done, total: linhas.length });
  }
  importJobs.set(jobId, { status: "done", progress: done, total: linhas.length, result: { imported, skipped, errors, batchId } });
} catch (e: any) {
  importJobs.set(jobId, { status: "error", progress: 0, total: 0, error: String(e?.message || e) });
}
```
- [ ] **2.5** `npm run build` verde. Commit: `feat(oportunidades): t2 - import de observacoes generico (coluna desconhecida vira jsonb) e assincrono`.

---

## Task 3 — Leitura devolve os campos novos

**Files:** Modify `server/routes.ts` (`GET /api/client-observations/:cpf`, ~`:30327`).

**Consome:** colunas da Task 1.
**Produz:** array `[{ id, cpf, observation, imported_at, filename, categoria, etiqueta, dados }]`; **404 quando vazio** (mantido).

- [ ] **3.1** Adicionar as colunas ao SELECT existente (não mexer no `WHERE` nem no 404):
```sql
SELECT id, cpf, observation, imported_at, filename, categoria, etiqueta, dados
FROM client_observations
WHERE tenant_id = ... AND REGEXP_REPLACE(cpf,'[^0-9]','','g') = ...
ORDER BY imported_at DESC
```
- [ ] **3.2** `npm run build` verde. Commit: `feat(oportunidades): t3 - GET /:cpf devolve categoria, etiqueta, dados e filename`.

---

## Task 4 — Tela de import com progresso

**Files:** Modify `client/src/pages/importar-observacoes.tsx`.

**Consome:** `{ jobId, total }` da Task 2; `GET /api/vendas/import-job/:jobId`.

- [ ] **4.1** No handler de importar, trocar o `fetch` que espera o resultado por: enviar → receber `{jobId,total}` → **polling a cada 2s** em `/api/vendas/import-job/${jobId}` até `status === "done"` ou `"error"`; exibir progresso (`progress/total`) numa barra; ao concluir, mostrar os contadores `imported/skipped/errors` que já existem na tela. Copiar o padrão de `client/src/pages/vendas-importar-higienizados.tsx:140-161`.
- [ ] **4.2** Atualizar o texto de ajuda e o modelo CSV: além de `cpf,observacao`, o arquivo pode trazer `RESUMO`, `OPORTUNIDADE` e **quaisquer outras colunas** (viram detalhe automático).
- [ ] **4.3** `npm run build` verde. Commit: `feat(oportunidades): t4 - tela de import com progresso (43k linhas nao estouram mais)`.

---

## Task 5 — Popup de oportunidade na ficha

**Files:** Create `client/src/components/oportunidade-popup.tsx`; Modify `client/src/pages/vendas-consulta.tsx`.

**Consome:** `GET /api/client-observations/:cpf` (Task 3) — a query já existe em `vendas-consulta.tsx:478`.

- [ ] **5.1** Criar `oportunidade-popup.tsx` — `export function OportunidadePopup({ obs, onClose }: { obs: ObsOportunidade; onClose: () => void })`, com:
```ts
export interface ObsOportunidade {
  id: number; observation: string; imported_at: string;
  filename?: string | null; categoria?: string | null;
  etiqueta?: string | null; dados?: Record<string, string> | null;
}
```
Conteúdo, nessa ordem: (1) faixa vermelha se `dados.TEM_OBITO === "SIM"` ou `dados.TEM_PROCESSO === "SIM"`; (2) badge da `etiqueta` + `dados.MES_REF` como "dados de MM/AAAA"; (3) `observation` em destaque; (4) grid de cards, um por chave de `dados`, pulando `TEM_OBITO`/`TEM_PROCESSO`/`MES_REF` — rótulo = chave prettificada (`MARGEM_DISP` → "Margem disp"), valor numérico formatado em BR **sem "R$"** (`3403.43` → `3.403,43`; não-numérico sai cru); (5) rodapé com `filename` + data; (6) botão único **"Entendi"**. Usar `Dialog` do shadcn, `max-w-xl`, `max-h-[85vh]` com rolagem.
- [ ] **5.2** Em `vendas-consulta.tsx`: derivar `const oportunidade = observacoes?.find(o => o.categoria === "oportunidade") ?? null;` (a query já ordena por `imported_at DESC`, então é a mais recente). Estado `const [oportOpen, setOportOpen] = useState(false);` e um `useEffect` que abre quando `oportunidade` muda para não-nulo (por CPF — resetar ao trocar de cliente). Renderizar `{oportOpen && oportunidade && <OportunidadePopup obs={oportunidade} onClose={() => setOportOpen(false)} />}`. **Não alterar** o botão ℹ️ nem o dialog existente.
- [ ] **5.3** `npm run build` verde. Commit: `feat(oportunidades): t5 - popup de oportunidade abre ao carregar a ficha`.

---

## Self-review (cobertura × spec)
- Colunas `categoria`/`etiqueta`/`dados` + índice funcional + drift do Drizzle → Task 1 ✓
- Import genérico (coluna desconhecida → jsonb), Papa Parse, assíncrono, retrocompatível com `cpf,observacao`, lote → Task 2 ✓
- Leitura com os campos novos, 404 mantido → Task 3 ✓
- Tela com progresso (43.540 linhas) → Task 4 ✓
- Popup: risco → etiqueta+MES_REF → frase → cards genéricos → procedência → só "Entendi"; só `categoria='oportunidade'` → Task 5 ✓
- Import de leads intocado → nenhuma task toca `sales_leads`/higienizados ✓
- Fora de escopo (filtro por etiqueta, popup na ficha legada, endpoint `/limpar`) → nenhuma task ✓
- Tipos consistentes: `ObsOportunidade` (Task 5) bate com o SELECT da Task 3 (`categoria`, `etiqueta`, `dados`, `filename`); `importJobs`/`jobId` (Task 2) bate com o polling (Task 4) ✓
