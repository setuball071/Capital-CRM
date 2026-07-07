# IA Interna para Corretores (Mascote) — Design

**Data:** 2026-07-07
**Status:** Aprovado pelo Fábio (design validado por seções em conversa)
**Projeto:** Capital CRM (Railway + Supabase, branch de trabalho atual: `migracao-cloudfy`)

## 1. Objetivo

Assistente de IA interno no Capital CRM para os corretores tirarem dúvidas de
regras de banco, roteiros operacionais, dicas e atalhos do sistema. Ele responde
**apenas** com base numa base de conhecimento curada — nunca inventa regra.
Com o tempo, a base cresce por captura de conteúdo (texto, PDF, áudio, imagem,
sugestões vindas do WhatsApp CRM) e pelas métricas de uso (perguntas sem resposta
viram pauta de conteúdo).

**Fase 1 não acessa dados de cliente** (CPF, margens, contratos). A arquitetura
fica preparada para tools de consulta ao CRM na fase 2.

## 2. Mascote e experiência do corretor

- **Nome:** configurável (armazenado junto à persona editável). Sugestão default:
  **Capi** (Capital + capivara). Alternativas discutidas: Sabiá, Marge. Decisão
  final do nome não bloqueia implementação.
- **Interface:** balão flutuante no canto inferior direito em todas as telas do
  CRM; abre painel de chat lateral.
- Saudação inicial com 3–4 perguntas sugeridas.
- **Toda resposta cita a fonte** ("📎 Baseado em: _Tabela BRB — Portabilidade_").
- Se a busca não achar conteúdo relevante (similaridade baixa), responde que
  **não sabe** e orienta procurar o gestor. Nunca força resposta.
- Botões 👍/👎 por resposta (alimenta métricas).
- Memória = histórico da conversa atual apenas; conversa nova começa limpa.
- Entrada por **texto, áudio ou imagem** (Gemini 2.5 Flash é multimodal nativo):
  - Corretor pode perguntar por áudio.
  - Gestor (papel com permissão de gestão) pode mandar áudio/imagem com conteúdo
    novo ("o BRB mudou a regra...") → o mascote transcreve/extrai, estrutura como
    artigo e pergunta "quer que eu guarde isso na base?" → vira item na fila de
    aprovação.

## 3. Arquitetura

Tudo dentro do Capital CRM existente. Sem serviço novo.

- **LLM:** Gemini 2.5 Flash via `ocrClient`/padrão de `server/openaiClient.ts`
  (endpoint OpenAI-compatible do Gemini; chave `GEMINI_API_KEY` já existe no
  Railway). Respostas com streaming.
- **Embeddings:** API de embeddings do Gemini (`gemini-embedding-001`, dimensão
  768), free tier.
- **Vetores:** extensão `pgvector` no Supabase (habilitar via migração).
- **Retrieval:** RAG — pergunta → embedding → top ~8 chunks por similaridade de
  cosseno → prompt com persona + trechos + instrução "responda só com base nos
  trechos".
- **Persona editável:** reutilizar o padrão da tabela `aiPrompts` (novo `type`,
  ex.: `assistente`) para editar persona/nome do mascote sem deploy.
- **Backend:** módulo novo `server/assistente.ts` registrado em `routes.ts`,
  seguindo o padrão do projeto (migração idempotente no boot em
  `server/index.ts` — esquecer = 500 "column does not exist").
- **Frontend:** componente de balão/painel montado no shell do app (visível em
  todas as telas), + tela de gestão "Base de Conhecimento".

### 3.1 Tabelas novas

| Tabela | Campos principais |
|---|---|
| `kb_artigos` | id, titulo, conteudo (markdown), categoria (`regras_banco` \| `roteiros` \| `dicas` \| `atalhos_sistema`), banco (opcional), status (`rascunho` \| `publicado` \| `arquivado`), origem (`manual` \| `pdf` \| `audio` \| `imagem` \| `whatsapp`), criadoPor, timestamps |
| `kb_chunks` | id, artigoId, ordem, texto (~500 tokens), embedding `vector(768)` |
| `kb_sugestoes` | fila de aprovação: id, conteudo proposto, origem, payload bruto (transcrição/extração), artigoConflitanteId (opcional), status (`pendente` \| `aprovada` \| `rejeitada`), decididoPor, timestamps |
| `assistente_conversas` | id, userId, iniciadaEm |
| `assistente_mensagens` | id, conversaId, role, conteudo, chunksUsados (ids), tokens, feedback (`up` \| `down` \| null), semResposta (bool), criadaEm |

Indexação: publicar/editar artigo → chunking (~500 tokens) → embeddings → upsert
em `kb_chunks`. Arquivar/despublicar → chunks fora da busca.

### 3.2 Endpoints

- `POST /api/assistente/chat` — mensagem (texto/áudio/imagem) + conversaId;
  resposta em streaming. Estrutura de tools **vazia** já prevista (fase 2).
- `POST /api/assistente/feedback` — 👍/👎 por mensagem.
- CRUD `GET/POST/PATCH /api/assistente/kb` — artigos (gestão).
- `POST /api/assistente/kb/upload` — PDF/planilha → extração → artigo rascunho.
- `GET/POST /api/assistente/kb/sugestoes` — fila de aprovação
  (aprovar/rejeitar/mesclar/substituir).
- `POST /api/assistente/kb/sugestoes/externa` — recebe sugestões do WhatsApp
  CRM, autenticado por **API key** dedicada (header), não por sessão.
- `GET /api/assistente/metricas` — dados da aba Métricas.

## 4. Alimentação da base

Tela "Base de Conhecimento" (menu master/admin/operacional; corretor não vê):

1. **Manual:** formulário título/categoria/banco/conteúdo; publicar = indexa na
   hora; editar = reindexa. Busca e filtros para gerenciar o acervo.
2. **Upload PDF/planilha:** extrai texto e cria artigo(s) **em rascunho** —
   revisão humana obrigatória antes de publicar (extração erra; regra de banco
   errada é pior que nenhuma). Publicação em 2 cliques.
3. **Áudio/imagem via chat do mascote** (gestores): transcrição/extração →
   proposta de artigo → fila de aprovação.
4. **WhatsApp CRM (fase 1, incluída no núcleo):** a inteligência que lê grupos
   no WhatsApp CRM envia sugestões via endpoint com API key → mesma fila de
   aprovação. Nada entra sozinho.

### 4.1 Carga inicial: importação da Biblioteca do WhatsApp CRM

O WhatsApp CRM (capitalgo) já tem uma "Biblioteca" com ~55 memórias indexadas
(`knowledge_files` + `knowledge_chunks`, Supabase próprio, embeddings 384d
`text-embedding-004`) — tutoriais, passo-a-passo, regras operacionais (livros
"azuis", curados) e Sínteses geradas automaticamente da leitura de grupos
(livros "Síntese", qualidade variável).

Importação **única, via fila de aprovação** (mesma triagem de tudo):

1. Script/rotina lê os livros da Biblioteca (texto dos chunks reagrupado por
   livro) no Supabase do WhatsApp CRM (service key em env, execução manual).
2. Cada livro vira uma `kb_sugestao` com **classificação proposta pelo LLM**
   (categoria + banco + título limpo) e marcação da origem
   (`whatsapp_biblioteca`, guardando o id original para não reimportar).
3. Fábio/gestor tria na fila: aprova (vira artigo publicado), edita ou rejeita.
   Expectativa: azuis aprovam quase direto; Sínteses exigem mais edição.
4. **Não copiar embeddings** — dimensão/modelo diferentes (384d vs 768d);
   reindexar com o pipeline próprio na aprovação.

A Biblioteca continua existindo e servindo o WhatsApp CRM normalmente; a
importação é uma cópia curada, não uma migração destrutiva.

### 4.2 Atualização inteligente (anti-conflito)

Todo conhecimento novo (qualquer origem) passa por busca de similaridade contra
artigos publicados. Se houver artigo muito parecido, a fila de aprovação mostra
**comparativo lado a lado** (antigo vs. novo) e o gestor decide:
**substituir** (antigo vira `arquivado`, histórico preservado), **mesclar** ou
**manter os dois**. Evita a base acumular regra velha contradizendo regra nova.

## 5. Permissões

- **Corretor:** só conversa com o mascote (texto/áudio/imagem como pergunta).
- **Master / Admin (role master) / Operacional:** gerenciam a base, aprovam a
  fila, veem métricas — paridade conforme padrão do módulo Contratos.
- Endpoints de gestão rejeitam corretor (testar explicitamente).
- Fase 1: nenhum dado de cliente no contexto da IA.

## 6. Monitoramento e logs

Aba "Métricas" na tela de gestão:

- Perguntas mais frequentes (agrupamento simples por similaridade/temas).
- Respostas com 👎.
- Perguntas em que a IA respondeu "não sei" (`semResposta = true`) — pauta
  direta de conteúdo novo.
- Volume de uso por corretor/período.

Toda mensagem logada em `assistente_mensagens` com chunks usados e tokens.

## 7. Tratamento de erros

- Falta de chave/quota do Gemini → mensagem amigável no chat + log no servidor.
- Timeout de 30s por resposta.
- Similaridade abaixo do corte → resposta "não sei" padrão (nunca alucinar).
- Upload com extração vazia/ilegível → avisa e não cria artigo.
- Fila externa (WhatsApp): payload inválido/key errada → 401/422, sem efeito.

## 8. Testes

- Conjunto de ~15 perguntas reais de corretor com resposta esperada (Fábio
  fornece exemplos), validado antes de liberar para a equipe.
- Teste de permissão: corretor não acessa endpoints de gestão/métricas.
- Teste do pipeline de indexação (artigo → chunks → busca encontra).
- Teste do fluxo "não sei" (pergunta fora da base).

## 9. Fase 2 (preparada, não construída)

- Tools de consulta ao CRM ("qual a margem do cliente X?") plugadas na
  estrutura de tools do endpoint de chat, com controle de permissão por
  corretor.
- Memória persistente por corretor, se as métricas mostrarem valor.

## 10. Fora de escopo

- Envio de mensagens por WhatsApp (regra de ouro: nunca automatizar envio).
- Acesso a dados de cliente na fase 1.
- Publicação automática sem revisão humana (qualquer origem).
