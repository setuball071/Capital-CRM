# Oportunidades por CPF na ficha do cliente — Design

> Mostrar, ao abrir a ficha de um cliente, um popup com a oportunidade daquele CPF vinda dos **cortes de base** do Fábio. A inteligência é do corte (gerada pelo script da Bigdata), não do CRM.

## Objetivo

O corretor abre um CPF e vê **em 3 segundos** por que aquele cliente é uma oportunidade — a frase pronta do corte, a etiqueta e os números de apoio. Sem depender de o corte ter virado campanha.

## Contexto e decisões de rota (fechadas no brainstorming)

1. **A oportunidade vem do CORTE, não é calculada pelo CRM.** O script da Bigdata gera a frase (`RESUMO`) e a etiqueta (`OPORTUNIDADE`) por CPF. O CRM só preserva e apresenta.
2. **A chave é o CPF, não o lead/campanha.** O corte **nem sempre é importado como lead** — às vezes vai para discadora. Amarrar a oportunidade a `sales_leads` a tornaria invisível nesses casos.
3. **O import de leads NÃO é tocado.** É caminho crítico de venda ("área séria que não pode ter alteração" — Fábio). A feature vive inteiramente na área de **Observações por CPF** (`client_observations`), que já é indexada por CPF e já é lida pela ficha.
4. **O import precisa ser genérico.** Os cortes variam (o de cartão tem `MULTIPLO`, o de portabilidade tem `BANCO_PORTAVEL`, os próximos terão outras). Coluna desconhecida deve ser preservada **sem ninguém mexer no código**.
5. **Popup só para oportunidade**, e abre **toda vez** que a ficha carrega (decisão do Fábio) — mas **só se houver dado**; sem oportunidade, nada abre.

## Dado real (validado contra o arquivo)

`Bigdata/SIAPE/Leads/Cortes_Especificos/Corte_Reestruturacao_RESUMO_CPF.csv` — 43.540 CPFs, 17 MB, UTF-8 **com BOM**, **CRLF**, separador **`;`**, 27 colunas:

```
CPF;NOME;IDADE;TIPO;SIT_FUNCIONAL;ORGAO;OPORTUNIDADE;MARGEM_DISP;MARGEM_70;
POTENCIAL_EMPRESTIMO;QTD_CONTRATOS;TOTAL_PARCELAS;SALDO_CARTAO_QUITAVEL;BANCOS_CARTAO;
SALDO_EMPRESTIMO_QUITAVEL;QTD_EMPRESTIMO_QUITAR;SALDO_PORTAVEL;QTD_PORTAR;BANCOS_PORTAVEIS;
PARCELA_LIBERADA;TEM_OBITO;TEM_PROCESSO;MES_REF;RESUMO;TEL_1;TEL_2;TEL_3
```

- `RESUMO` = a frase de destaque, já formatada em BRL. Ex.: *"Margem R$ 3.403,43 -> potencial R$ 166.369,59. Quitar 1 emprestimo(s) pequeno(s): R$ 6.312,61. Portar 1 contrato(s) (BANCO DO BRASIL): R$ 238.517,33. Libera R$ 356,30/mes de parcela."*
- `OPORTUNIDADE` = etiqueta. Distribuição real: `PORT` 30.414 · `CARTAO` 8.465 · `CARTAO+PORT` 4.661.
- CPF vem **formatado** (`911.150.194-49`); números vêm com **ponto decimal** (`3403.43`, formato US — **não** BR).
- `TEM_OBITO`/`TEM_PROCESSO` = `NAO` nos 43.540 (o corte já filtrou). O tratamento de risco fica pronto para quando vier `SIM`.

## Estado atual da área (o que já funciona e o que não)

**Já resolvido pelo código existente — não mexer:**
- Import de observações já remove BOM (`routes.ts:30372`), detecta encoding UTF-8/Latin-1 (`:30364`), auto-detecta `;` vs `,` (`:30382`) e normaliza CPF para dígitos (`:30420`).
- A ficha já consulta `GET /api/client-observations/:cpf` (`vendas-consulta.tsx:478`) e tem um dialog de "Informações Complementares" atrás de um botão ℹ️ (`:1281`).

**Limitações que esta spec resolve:**
- `client_observations` só tem `observation TEXT` — sem categoria, sem estrutura, sem etiqueta. Qualquer coluna além de `cpf,observacao` é ignorada.
- Import é **síncrono com INSERT linha a linha** (`routes.ts:30401`) → 43.540 linhas **estouram timeout**.
- Parser é manual (não usa Papa) e não trata aspas escapadas (`""`) nem quebra de linha dentro de campo.
- Sem data do fato: a UI mostra "Importado em" (data do upload). O `MES_REF` não tem onde morar.
- `GET /:cpf` faz `REGEXP_REPLACE` sobre a coluna (`:30336`) → **anula o índice**, seq scan a cada abertura de ficha (com 43k+ linhas isso pesa).
- **Drift do Drizzle:** `batch_id` e `filename` existem no banco (`migrations/client-observations-batch.sql`) mas **não estão declarados** em `shared/schema.ts:3834`. Um `drizzle-kit push` pode tentar dropá-los.

## Modelo de dados

### Alterações em `client_observations` (boot idempotente)
```sql
ALTER TABLE client_observations
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(30) NOT NULL DEFAULT 'observacao',
  ADD COLUMN IF NOT EXISTS etiqueta  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS dados     JSONB DEFAULT '{}'::jsonb;

-- Índice funcional: a query de leitura normaliza o CPF na coluna e hoje faz seq scan
CREATE INDEX IF NOT EXISTS idx_client_obs_cpf_norm
  ON client_observations (tenant_id, (REGEXP_REPLACE(cpf, '[^0-9]', '', 'g')));
```
- `categoria`: `oportunidade` (veio de corte) | `observacao` (texto comum). **Só `oportunidade` abre popup.**
- `etiqueta`: o `OPORTUNIDADE` do corte, em coluna própria — permite filtrar/priorizar depois sem escavar o jsonb.
- `dados`: **todas as demais colunas do CSV**, genéricas.
- `observation` (já existe): recebe o `RESUMO`.

### Correção do drift no Drizzle (`shared/schema.ts`)
Declarar as colunas que já existem no banco e as novas, para o schema TS refletir a realidade:
`batchId: text("batch_id")`, `filename: text("filename")`, `categoria`, `etiqueta`, `dados`.
Não altera comportamento (o server usa SQL raw); elimina o risco de `drizzle-kit push` dropar coluna em uso.

## Componentes

### 1. Import genérico e assíncrono — `POST /api/client-observations/import`
- **Parser**: trocar o manual por **Papa Parse** (`header: true`, `delimiter: ""` auto-detect, `dynamicTyping: false`, `skipEmptyLines: true`) — mesma configuração já usada e comprovada no import de higienizados (`routes.ts:15508`). Resolve aspas escapadas e quebra de linha em campo.
- **Mapeamento** (normalizando header: sem acento, maiúsculas):
  - `CPF` → `cpf` (dígitos, `padStart(11,'0')`)
  - `RESUMO` **ou** `OBSERVACAO` → `observation`
  - `OPORTUNIDADE` → `etiqueta`
  - **Qualquer outra coluna** → `dados[COLUNA] = valor` (cru, string)
  - `categoria` = `'oportunidade'` se houver `RESUMO` **ou** `OPORTUNIDADE`; senão `'observacao'`
- **Retrocompatível**: CSV antigo (`cpf,observacao`) continua funcionando → `categoria='observacao'`, `dados={}`, `etiqueta=NULL`.
- **Assíncrono**: responder `{ jobId, total }` na hora e processar em `setImmediate`, com `importJobs` + `GET /api/vendas/import-job/:jobId` — **o mesmo padrão já existente** no import de higienizados (`routes.ts:15476`). A tela passa a fazer polling e mostrar progresso.
- **Insert em lote** (não linha a linha): manter `ON CONFLICT (tenant_id, cpf, observation) DO NOTHING` (dedupe por texto idêntico já existente).
- **Reimport do mesmo corte**: como a UNIQUE é sobre o texto, reimportar o mesmo arquivo não duplica. Um corte novo (frase diferente) **acumula** — comportamento atual, mantido de propósito: o histórico de cortes fica visível.

### 2. Leitura — `GET /api/client-observations/:cpf`
- Passar a selecionar também `categoria`, `etiqueta`, `dados`.
- Manter o **404 quando vazio** (os dois clients já tratam 404 → `null`; mudar para `[]` quebraria ambos).
- A ordenação segue `imported_at DESC` (a mais recente primeiro).

### 3. Popup — `client/src/pages/vendas-consulta.tsx`
Abre ao carregar a ficha **se existir ao menos uma observação com `categoria='oportunidade'`**; usa a **mais recente**. Conteúdo, de cima para baixo:
1. **Faixa vermelha de risco** — se `dados.TEM_OBITO === 'SIM'` ou `dados.TEM_PROCESSO === 'SIM'`. **Vem antes de tudo**: risco não pode aparecer depois da venda. (Convenção de chave documentada; hoje o corte manda `NAO` em 100%.)
2. **Etiqueta** (`etiqueta`) como badge + **idade do dado** (`dados.MES_REF`, ex.: "dados de 06/2026") — o corretor precisa saber que a margem pode ter mudado.
3. **A frase** (`observation`) em destaque — é o que ele lê.
4. **Cards genéricos**: um por chave de `dados`, *rótulo: valor*. Rótulo = chave prettificada (`MARGEM_DISP` → "Margem disp"); valor numérico formatado em BR **sem "R$"** (a frase já carrega o dinheiro; não dá para inferir o que é moeda e o que é contagem — `QTD_CONTRATOS=2`). Chaves de controle (`TEM_OBITO`, `TEM_PROCESSO`, `MES_REF`) não viram card (já foram usadas acima).
5. **Procedência**: `filename` + data do import.
6. Botão único: **"Entendi"**.

O botão ℹ️ atual permanece, mostrando a lista completa de observações do CPF.

## Fluxo

1. Fábio roda o corte na Bigdata → CSV por CPF.
2. Administração → **Observações por CPF** → sobe o CSV → job assíncrono com progresso.
3. Corretor busca o CPF na Consulta Individual → a ficha carrega → se há oportunidade, **popup abre**.
4. O corte pode ir para discadora em paralelo — a oportunidade existe no CRM de qualquer forma, porque está atrelada ao CPF.

## Tratamento de erros
- CPF com menos de 11 dígitos → linha contabilizada em `errors` (comportamento atual mantido).
- Linha sem `cpf` **e** sem texto → ignorada.
- Arquivo sem coluna `cpf` → 400 com mensagem clara.
- `dados` vazio ou `observation` vazio → não vira oportunidade (`categoria='observacao'`), logo não abre popup.
- Falha do job → status `error` no `importJobs`, exibido na tela.

## Verificação
Repo sem suíte de testes. Verificação = **`npm run build` + deploy + conferência manual**:
- Subir o `Corte_Reestruturacao_RESUMO_CPF.csv` real (43.540 linhas) → job conclui com progresso, sem timeout.
- Conferir no banco: `categoria='oportunidade'`, `etiqueta='PORT'`, `dados` com as ~24 colunas.
- Abrir na Consulta o CPF `911.150.194-49` → popup abre com a frase, etiqueta PORT, "dados de 06/2026" e os cards.
- Abrir um CPF sem oportunidade → **nada abre**.
- Subir um CSV antigo (`cpf,observacao`) → continua importando, sem popup.
- Botão ℹ️ segue mostrando a lista completa.

## Sucesso
- 43.540 linhas importam sem timeout.
- Coluna nova em corte futuro aparece como card **sem mexer no código**.
- Popup só aparece quando há oportunidade.
- Import de leads/campanhas **inalterado**.

## Fora de escopo
- Filtrar/priorizar leads pela `etiqueta` no pipeline (o dado fica gravado; a tela é outro trabalho).
- O popup em `consulta-cliente.tsx` (ficha legada) — só a ficha principal recebe. O dialog duplicado entre as duas telas fica como está.
- O endpoint órfão e destrutivo `POST /api/client-observations/limpar` (`routes.ts:30447`) — sem callers, apaga todas as observações de um CPF sem confirmação. **Registrado como risco pré-existente**, não tratado aqui.
- Edição/criação manual de observação pela ficha.
