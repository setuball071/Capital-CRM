# Capital CRM — PRD do Sistema (estado atual)

> **Propósito deste documento.** Este PRD documenta o **sistema como ele existe hoje**. É o mapa para um agente (Fable 5) entender o domínio e **evoluir sem quebrar** — não uma proposta de reconstrução. A seção **15 — Guardrails** concentra os limites inegociáveis; a **13 — Regras críticas**, o conhecimento não-óbvio.
>
> **Fonte da verdade é o código.** Onde este texto e o código divergirem, o código vence — em especial `shared/schema.ts` (dados), `server/routes.ts` (rotas) e `client/src/components/app-sidebar.tsx` (navegação/papéis).

---

## 1. Visão & propósito

O **Capital CRM** é a plataforma de gestão de um **correspondente bancário de crédito consignado**. Cobre o ciclo completo:

- **Prospecção** — leads, pipeline, carteira de clientes.
- **Originação** — proposta → contrato (módulo Operacional).
- **Efetivação & comissionamento** — recebimento do banco e repasse ao corretor (Financeiro).
- **Inteligência de dados SIAPE** — margens, folha de pagamento, contracheque.
- **Apoio à venda** — simuladores, academia, IA interna.

**Quem usa (papéis):**

- **Master / dono** — visão total, configuração, financeiro.
- **Coordenação** — gestão comercial da equipe.
- **Operacional** — esteira de contratos.
- **Atendimento** — apoio de vendas.
- **Vendedor (corretor)** — só o que é dele; **nunca vê comissão da empresa**, apenas "Prêmio".

**Convênios / produtos:** SIAPE (servidor federal, o mais rico em dados), INSS, governos estaduais/municipais, militares (RMI). Produtos: contrato novo, portabilidade (com/sem troco), refinanciamento, cartão benefício/consignado.

---

## 2. Arquitetura & stack

Monolito full-stack TypeScript, multi-tenant, com deploy contínuo.

**Frontend**
- React 18 + **Vite**; roteamento **Wouter**.
- Dados via **TanStack Query** (`queryKey` = rota da API).
- UI **shadcn/ui** + Tailwind; gráficos **Recharts**.
- Design System **Capital Go**: roxo `#6C2BD9`, fonte **Inter**, ícones **Material Symbols Rounded**.

**Backend**
- Node + **Express** — rotas concentradas em `server/routes.ts`.
- ORM **Drizzle**; schema único em `shared/schema.ts`.
- Uploads via **multer** (memória); PDFs via **jsPDF**.
- Armazenamento de arquivos em `server/document-storage` (Supabase Storage).

**Infra & deploy**

| Item | Valor |
|---|---|
| Banco & Storage | **Supabase Cloud oficial** — Postgres + Storage (SP), conta `manudossantospj` |
| Hospedagem | **Railway** — produção roda `node dist/index.js` |
| Deploy | **`git push`** na branch `migracao-cloudfy` → Railway builda e reinicia sozinho |
| Build | `npm run build` (Vite p/ client + esbuild p/ server) |
| **NÃO usa** | **Replit · Vercel** — não sugerir nenhum dos dois |

> ⚠️ **Migrações no boot.** Não há migração versionada. Colunas/tabelas novas entram num bloco **idempotente** (`CREATE TABLE / ALTER … IF NOT EXISTS`) em `server/index.ts`, executado a cada boot. Esquecer disso = erro 500 *"column does not exist"* em produção.

**Multi-tenant.** Quase toda tabela tem `tenant_id`; o middleware `resolveTenant → requireTenant` injeta o tenant da requisição, e `user_tenants` liga usuário↔ambiente. A flag `isMaster` dá acesso a todos os tenants. Ambiente operante na prática: **Capital Go (tenant 4)**.

> ℹ️ **Exceção proposital:** a **base de clientes SIAPE é global entre tenants** (índice único de `clientes_pessoa` é só o CPF). É compartilhamento por design — **não é vazamento**. Privado por tenant: propostas/contratos, financeiro, leads, usuários.

---

## 3. Papéis & permissões

Cinco papéis (`ROLE_LABELS`): `master` (Administrador), `coordenacao` (Coordenador), `operacional` (Operacional), `atendimento` (Atendimento), `vendedor` (Vendedor).

- **`isMaster`** = acesso total, a todos os módulos e tenants. Operacional e Administrador têm paridade com o master dentro do Operacional.
- Permissões finas em `user_permissions` por **módulo + subitem**, com flags `canView / canEdit / canDelegate` (helpers `hasModuleAccess`, `hasSubItemAccess`).
- **Vendedor vê apenas o próprio**: suas propostas, sua carteira, seu painel. No Financeiro enxerga **"Prêmio"** — nunca comissão, flat ou % da empresa.

---

## 4. Mapa de módulos

A navegação lateral se organiza em três super-grupos (cada item respeita papel + permissão):

**GERAL**
- **Home** — dashboard por papel (equipe ou corretor)
- **Simuladores** — suíte de 6 abas

**OPERAÇÃO**
- **Operacional** — Minhas Propostas · Solicitar Boleto · Nota Promissória · Configurações
- **Vendas** — Pipeline · Consulta Individual · Lista Manual · Tags · Agenda · Campanhas · Gestão Pipeline · Minha Carteira
- **Referências** — Convênios · Bancos · Tabelas de Coeficientes · Roteiros · Material de Apoio
- **Desenvolvimento** — Profiler DISC · Feedbacks · Fundamentos · Roleplay IA · Abordagem IA · Criador de Criativos
- **Base de Clientes** — Importar · Filtros · Nomenclaturas · Consulta · Enriquecer

**GESTÃO**
- **Administração** — Usuários · Ambientes · Assinaturas · Config. Preços/Dados · Identidade Visual · API Keys · Regras de Carteira
- **Gestão Comercial** — Dashboard da Empresa · Equipes · Metas · Importar Produção · Relatórios · Regulamento
- **Financeiro** — Pagamentos · Produção · Proventos e Descontos · Tabelas · Configurações

---

## 5. Contratos & Propostas

Operacional → Contratos. A esteira que leva a proposta até "Pago".

Núcleo na tabela `proposals`. Wizard de nova proposta em 5 passos (convênio → upload → dados → tipo → conferência); ficha de trabalho em 2 colunas com copiar/editar por campo e seção de Documento (OCR editável). Ações: Clonar / Transferir / Excluir (só master). Anexos vão para o Object Storage (`proposal_documents.storage_key`), servidos por rota autenticada — o disco é efêmero.

- **Status & fases (configurável).** `contract_statuses` (flags `allowsVendorEdit`, `isFinal`, `returnStatusKey`, cor) e `contract_phases`, geridos em "Fases". Colunas novas migram no boot idempotente.
- **Pendência & CIP.** Status com `returnStatusKey` abre banner; regularizar exige observação. Contador **CIP** em dias úteis (`lib/cip.ts`), tag colorida que para quando o status é final. Corretor com pendência anexa/regulariza, mas não edita.

> ℹ️ Proposta marcada **PAGO** faz *upsert* em `producoes_contratos` (vínculo por `proposalId`, dedupe por ADE) — é a ponte Operacional → Financeiro. Parceiro (`partners`/`parceiroId`) propaga ao Financeiro; corretor não vê parceiro nem % empresa.

---

## 6. Financeiro & Produção

Recebimento da comissão do banco, repasse ao corretor e conta-corrente interna.

O modelo atual importa **relatórios de comissão** (parsers determinísticos por parceiro: D7, Gold, AMF, Bevi), que marcam **Recebido** e liberam o prêmio para "A Pagar" automaticamente. A tela **Produção** é a de recebimento (A Receber / Recebido). O corretor sempre vê **"Prêmio"**, nunca comissão/flat.

- **Pagamento ao consultor.** Produção marca "para pagar" → Contratos gera pagamento + **recibo PDF** + histórico (`pagamentos_consultor` + itens). Cálculo por grupo × tipo de produto × override por contrato, no frontend (`calcRepasseConsultorProd`).
- **Proventos e Descontos.** Conta-corrente interna do corretor (`lancamentos_corretor` + `lancamentos_compensacoes`). No fechamento o gestor decide **quanto** usar de cada lançamento (nunca 100% automático); o saldo remanescente persiste.
- **Repasse por tipo de produto.** Subgrupos no grupo de comissão (`repasseRules`); `mapTipoFront` normaliza o tipo bruto da planilha. Mudar a regra reflete sem reimportar.
- **Tabelas de coeficiente.** Com vigência: `vigenciaInicio` + `historico[]` (snapshot a cada edição). *(iframe legado.)*

> ⚠️ Boa parte do Financeiro é **HTML/JS legado em iframe** (`financeiro-comissoes.html`) que herda a paleta do CRM por `postMessage`. Mexe em dinheiro — alinhar só a nível de token; **não reescrever**.

---

## 7. Vendas & Pipeline

- **Pipeline (kanban).** `sales_leads` com marcadores: **Em Atendimento → Interessado → Aguardando Retorno → Proposta Enviada → Vendido**, mais colunas de descarte. Drag-and-drop, resumo de margens/propostas por coluna.
- **Minha Carteira.** `client_portfolio` + `portfolio_rules` + transferências; entradas expiram (EXPIRADO) por rotina 24h. Auto-importação pelo próprio vendedor.
- **Consulta Individual + Perfil.** Busca por CPF/matrícula/telefone → ficha completa: dados pessoais + bancários, situação de folha (margens), contratos, e simulador de portabilidade inline.
- **Agenda & Campanhas.** `lead_schedules`, `appointments` com lembretes; `sales_campaigns` para ações direcionadas.

---

## 8. Base de Clientes SIAPE

A central de inteligência: quem é o cliente, sua folha e suas margens. É a fonte que alimenta Consulta, Pipeline e Simuladores. Importação massiva por **streaming** (SQL-based, 10–50× mais rápido) com normalização de matrícula.

| Conceito | Regra |
|---|---|
| Margem 70% | Teto de **todos** os descontos da folha; baliza a mg35/mg5. `mg70_disp = mg70_bruta − (total_rend − total_liq)` |
| Margem militar (RMI) | base = total de rendimentos (todas as verbas). Civil (EST): base = soma das rubricas `in35=1` |
| Nome autoritativo | O **contracheque PDF** manda no nome — Lemit/Serasa nunca sobrescrevem |
| Nomenclaturas | Tabela `nomenclaturas` (ÓRGÃO, TIPO_CONTRATO, UPAG, UF, RUBRICA…), match em 4 estratégias; 1077 rubricas SIAPE |
| Matrícula | Sempre **normalizada** (zero à esquerda) — casar por matrícula bruta duplica vínculos |

---

## 9. Simuladores

Suíte de 6 abas sob um shell comum (sub-abas com borda inferior roxa na ativa; sem busca CPF no header).

| Aba | Tecnologia | O que faz |
|---|---|---|
| Criador de Proposta | React | Dados do cliente, contratos atuais e nova proposta → gera proposta |
| Portabilidade | iframe legado | Import de PDF, regras por banco, simples/com troco |
| Compra | React | Receber troco × reduzir parcela; banner de oportunidade |
| Amortização | React | Contrato Novo/Final + cronograma por prazo (10–96m) |
| Renda Fixa | React | Juros compostos: montante, investido × juros, mês a mês |
| Contracheque | iframe legado | Drop de PDF → OCR de margens/rubricas |

---

## 10. Dashboards

Um por papel; ambos priorizam o número **Efetivado**.

- **Da equipe (gestor).** Meta unificada (geral + cartão): **Efetivado no mês** (em destaque) × Em andamento (secundário), progresso da meta, mix por produto, e **ranking dos corretores** (Efetivado antes de Em aberto, com foto).
- **Do corretor.** Minha meta (mesmos KPIs), Ritmo de Desempenho (produção diária × meta do dia), "Quanto falta" e "Meta de hoje".

> ℹ️ O dashboard gerencial **sempre soma o financeiro** (`producoes_contratos` + `vendedor_contratos`), não só o CRM (`proposals`) — senão subconta o realizado e distorce o ranking. "Em aberto" conta os status **Aguardando envio CIP + Aguardando retorno CIP + Em Andamento**.

---

## 11. Academia & IA interna

- **Academia / Desenvolvimento.** Profiler **DISC**, Fundamentos, **Roleplay IA** (modo níveis), Abordagem IA, Feedbacks — mais perfis da equipe para a gestão.
- **Assistente (mascote Capi).** RAG com **pgvector + Gemini Flash** sobre base de conhecimento (`kb_artigos`). Fase 1 = só conhecimento (nunca dado de cliente); fila de aprovação para todo conteúdo importado (PDF/áudio/imagem/WhatsApp).

---

## 12. Modelo de dados

~90 tabelas Drizzle em `shared/schema.ts`, agrupadas por domínio. Todas as privadas carregam `tenant_id`.

| Domínio | Tabelas principais |
|---|---|
| Tenancy & acesso | `tenants` · `tenant_domains` · `users` · `user_tenants` · `user_permissions` · `audit_log` |
| Contratos | `proposals` · `proposal_documents` · `proposal_history` · `proposal_messages` · `contract_statuses` · `contract_phases` · `contract_flows` |
| Financeiro | `producoes_contratos` · `vendedor_contratos` · `producoes_importacoes` · `pagamentos_consultor`(+itens) · `lancamentos_corretor` · `lancamentos_compensacoes` · `commission_groups` · `commission_tables` · `coefficient_tables` · `financeiro_config` · `partners` |
| Vendas / CRM | `sales_leads` · `lead_interactions` · `lead_contacts` · `lead_schedules` · `sales_campaigns` · `client_portfolio` · `portfolio_rules` · `portfolio_transfers` |
| Base de clientes | cadastro de pessoa/vínculo/folha SIAPE (global) · `nomenclaturas` · `bases_importadas` · `import_runs`(+rows,errors) · `staging_folha` · `staging_contatos` |
| Referências | `agreements` · `banks` · `roteiros_bancarios` · `materials` · `companies` · `promissory_notes` |
| Gestão comercial | `commercial_teams` · `commercial_team_members` · `meta_niveis` · `regulamentos` |
| Academia & IA | `ai_prompts` · `kb_artigos` · `kb_sugestoes` · `roleplay_sessoes` · `quiz_tentativas` · `assistente_conversas`(+mensagens) |
| Assinaturas & preços | `subscriptions` · `pacotes_preco` · `pricing_settings` · `pedidos_lista` · `api_keys` |

*Consulte `shared/schema.ts` como fonte da verdade dos nomes e colunas.*

---

## 13. Regras de negócio críticas

O conhecimento não-óbvio que faz o sistema estar correto. Quebrar qualquer um destes gera bug silencioso de dinheiro ou de dados.

- **Margem 70% é o teto de tudo.** Baliza mg35 e mg5; a fórmula desconta a diferença rendimento − líquido.
- **Corretor nunca vê comissão/flat/% da empresa** — só "Prêmio". Vazar isso na UI é falha grave.
- **Base de clientes é global entre tenants** por design. Não "corrigir" para isolar.
- **Nunca apagar o cadastro matriz do cliente.** Importações não deletam linhas existentes nem sobrescrevem `comissaoRepassePerc`.
- **Matrícula sempre normalizada** (zero à esquerda) ao casar vínculos.
- **Nome vem do contracheque PDF**; outras fontes não sobrescrevem.
- **PAGO → upsert em produção** (dedupe por ADE). O Financeiro depende disso.
- **Dashboard soma financeiro + CRM**, senão subconta o realizado.
- **Toda coluna/tabela nova migra no boot idempotente** de `server/index.ts`.

---

## 14. Integrações externas

| Serviço | Uso | Observação |
|---|---|---|
| Supabase | Postgres + Storage | Conta oficial `manudossantospj` |
| Google Gemini | IA / RAG (assistente, roleplay, criativos) | Flash; embeddings via pgvector |
| Lemit | Enriquecimento de telefone/cadastro | **Sem API** — só login/senha; job assíncrono |
| OCR de documentos | Extrai dados de contracheque/documentos | Alimenta a ficha de contratos |
| WhatsApp (Evolution) | CRM de WhatsApp | **Sistema separado** — não é este repo |

---

## 15. Guardrails para o Fable 5

Os limites inegociáveis ao evoluir este sistema. **Leia antes de tocar em qualquer código.**

- ✕ **Deploy só via Railway** — `git push` na branch `migracao-cloudfy`. Nunca sugerir Replit ou Vercel, nem comandos deles.
- ⚠️ **Não reescrever os iframes legados** — `financeiro-comissoes.html`, `ferramentas-portabilidade.html`, `simulador-contracheque.html`. Mexem em cálculo de dinheiro e OCR; herdam a paleta do CRM por `postMessage`. Alinhamento visual só a nível de token (cor, raio, fonte).
- ⚠️ **Tabela/coluna nova = migração idempotente no boot** (`server/index.ts`), com `IF NOT EXISTS`. Não existe migração versionada separada.

**Preservar sempre**
- Cadastro matriz do cliente (nunca apagar).
- Isolamento por `tenant_id` no que é privado.
- Corretor sem acesso a comissão/parceiro/% empresa.
- Design System Capital Go (roxo `#6C2BD9`, Inter, Material Symbols). Se houver `.dc.html` de referência, ler o `renderVals()` e replicar valor-a-valor.

**Fonte da verdade**
- Schema: `shared/schema.ts`.
- Rotas: `server/routes.ts` (seções `// ===== … =====`).
- Navegação/papéis: `client/src/components/app-sidebar.tsx`.
- Regras SIAPE/financeiro: cálculos no frontend + parsers determinísticos.

> ℹ️ **Higiene de segredos:** há segredos que já estiveram expostos e cuja rotação ficou pendente (senha do banco e *service_role* do Supabase). Ao trabalhar com credenciais, tratar rotação como prioridade e nunca versionar valores em claro.
