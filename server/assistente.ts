import type { Express, Request, Response, RequestHandler } from "express";
import multer from "multer";
import { db } from "./storage";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  kbArtigos,
  kbSugestoes,
  assistenteConversas,
  assistenteMensagens,
  aiPrompts,
  userPermissions,
} from "@shared/schema";
import { ocrClient, ocrModel } from "./openaiClient";
import { extractTextFromPdf } from "./roteiros-pdf-service";
import { transcreverAudio, extrairTextoImagem } from "./assistente-media";
import {
  indexarArtigo,
  removerChunksDoArtigo,
  buscarArtigoConflitante,
  buscarChunks,
  CORTE_SIMILARIDADE,
} from "./assistente-rag";
import { requireApiKey } from "./api-key-middleware";

const uploadKb = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// multer p/ mídia do chat (25MB)
const uploadChat = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const CATEGORIAS_KB = [
  "regras_banco",
  "roteiros",
  "dicas",
  "atalhos_sistema",
] as const;

export function podeGerenciarKb(user: any): boolean {
  // Gerenciar a base = SOMENTE master (admin@sistema.com, Manu). Operacional NÃO gerencia.
  return !!user && (user.isMaster || user.role === "master");
}

/** Quem pode CONVERSAR com o Jarvis automaticamente (gestão + operacional). Demais só via permissão marcada pelo master. */
function podeUsarChatAuto(user: any): boolean {
  return !!user && (user.isMaster || ["master", "operacional"].includes(user.role));
}

/** Permissão do assistente por sub-item; quem não tem acesso automático depende de user_permissions marcada pelo master. */
async function temPermissaoAssistente(
  user: any,
  subItem: "chat" | "base_conhecimento",
): Promise<boolean> {
  const auto = subItem === "base_conhecimento" ? podeGerenciarKb(user) : podeUsarChatAuto(user);
  if (auto) return true;
  const [perm] = await db
    .select()
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.userId, user.id),
        eq(userPermissions.module, `modulo_assistente.${subItem}`),
      ),
    )
    .limit(1);
  return perm?.canView === true;
}

async function requireGestorKb(req: any, res: Response, next: Function) {
  try {
    if (await temPermissaoAssistente(req.user, "base_conhecimento")) return next();
    return res.status(403).json({ message: "Acesso negado" });
  } catch (err) {
    console.error("[assistente/requireGestorKb] erro:", err);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export const NOME_MASCOTE = process.env.ASSISTENTE_NOME || "Jarvis";

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

export function registerAssistenteRoutes(app: Express, requireAuth: RequestHandler) {
  // ---------- CRUD de artigos (gestão) ----------
  app.get("/api/assistente/kb", requireAuth, requireGestorKb, async (req: any, res) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
      const artigos = await db
        .select()
        .from(kbArtigos)
        .where(eq(kbArtigos.tenantId, req.tenantId))
        .orderBy(desc(kbArtigos.updatedAt));
      res.json(artigos);
    } catch (err) {
      console.error("[assistente/kb] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });

  app.post("/api/assistente/kb", requireAuth, requireGestorKb, async (req: any, res) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
      const { titulo, conteudo, categoria, banco, status } = req.body || {};
      if (!titulo || !conteudo || !CATEGORIAS_KB.includes(categoria)) {
        return res.status(422).json({ message: "titulo, conteudo e categoria válida são obrigatórios" });
      }
      const [artigo] = await db
        .insert(kbArtigos)
        .values({
          tenantId: req.tenantId,
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
    } catch (err) {
      console.error("[assistente/kb] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });

  app.patch("/api/assistente/kb/:id", requireAuth, requireGestorKb, async (req: any, res) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
      const id = Number(req.params.id);
      const [atual] = await db
        .select()
        .from(kbArtigos)
        .where(and(eq(kbArtigos.id, id), eq(kbArtigos.tenantId, req.tenantId)))
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
    } catch (err) {
      console.error("[assistente/kb/:id] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });

  // ---------- Upload PDF → rascunho ----------
  app.post(
    "/api/assistente/kb/upload",
    requireAuth,
    requireGestorKb,
    uploadKb.single("arquivo"),
    async (req: any, res) => {
      try {
        if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
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
            tenantId: req.tenantId,
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
      } catch (err) {
        console.error("[assistente/kb/upload] erro:", err);
        res.status(500).json({ message: "Erro interno" });
      }
    },
  );

  // ---------- Chat (qualquer usuário autenticado) ----------
  app.post("/api/assistente/chat", requireAuth, uploadChat.single("arquivo"), async (req: any, res: Response) => {
    if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
    const { conversaId, mensagem, modoCaptura } = req.body || {};
    let texto = String(mensagem || "").trim();
    let extraidoDeMidia = "";
    let origemMidia: "audio" | "imagem" | null = null;
    let convId = 0;

    try {
      if (!(await temPermissaoAssistente(req.user, "chat"))) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      try {
        if (req.file) {
          // Alguns navegadores mandam o mimetype vazio/octet-stream — cair na extensão também.
          const rawMime = (req.file.mimetype || "").toLowerCase();
          const nome = (req.file.originalname || "").toLowerCase();
          const isAudio =
            rawMime.startsWith("audio/") || /\.(webm|ogg|oga|mp3|m4a|wav|mpeg|mpga)$/.test(nome);
          const isImagem =
            rawMime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/.test(nome);
          if (isAudio) {
            extraidoDeMidia = await transcreverAudio(req.file.buffer, rawMime || "audio/webm");
            origemMidia = "audio";
          } else if (isImagem) {
            const mimeImg = rawMime.startsWith("image/")
              ? rawMime
              : nome.endsWith(".png")
                ? "image/png"
                : nome.endsWith(".gif")
                  ? "image/gif"
                  : nome.endsWith(".webp")
                    ? "image/webp"
                    : nome.endsWith(".bmp")
                      ? "image/bmp"
                      : nome.endsWith(".heic") || nome.endsWith(".heif")
                        ? "image/heic"
                        : "image/jpeg";
            extraidoDeMidia = await extrairTextoImagem(req.file.buffer, mimeImg);
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
          tenantId: req.tenantId,
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

      // resolve conversa (do próprio usuário)
      convId = Number(conversaId) || 0;
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
          .values({ tenantId: req.tenantId, userId: req.user.id })
          .returning({ id: assistenteConversas.id });
        convId = nova.id;
      }

      // grava a pergunta
      await db.insert(assistenteMensagens).values({
        conversaId: convId,
        role: "user",
        conteudo: texto,
      });
    } catch (err) {
      console.error("[assistente/chat] erro:", err);
      if (!res.headersSent) res.status(500).json({ message: "Erro interno" });
      return;
    }

    // SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const enviar = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    const ac = new AbortController();
    let clienteDesconectou = false;
    req.on("close", () => {
      clienteDesconectou = true;
      ac.abort();
    });

    try {
      const chunks = await buscarChunks(req.tenantId, texto, 8);
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

      let resposta = "";
      const timer = setTimeout(() => ac.abort(), 45_000); // teto duro de 45s (upstream travado)
      try {
        const stream = await ocrClient.chat.completions.create(
          {
            model: ocrModel,
            stream: true,
            temperature: 0.3,
            max_tokens: 1500,
            messages: [
              { role: "system", content: system },
              ...anteriores,
              { role: "user", content: texto },
            ],
          },
          { signal: ac.signal },
        );

        for await (const parte of stream) {
          const delta = parte.choices?.[0]?.delta?.content || "";
          if (delta) {
            resposta += delta;
            enviar({ delta });
          }
        }
      } catch (e) {
        if (!ac.signal.aborted) throw e; // erro real → catch externo
        if (clienteDesconectou) {
          // cliente foi embora: persiste o parcial (se houver) e encerra em silêncio
          if (resposta.trim()) {
            await db.insert(assistenteMensagens).values({
              conversaId: convId,
              role: "assistant",
              conteudo: resposta,
              chunksUsados: relevantes.map((c) => c.chunkId),
              semResposta: false,
            });
          }
          return res.end();
        }
        // timeout com cliente conectado: segue o fluxo normal com o parcial
      } finally {
        clearTimeout(timer);
      }

      const semResposta = !resposta.trim();
      if (semResposta) {
        resposta = RESPOSTA_NAO_SEI;
        enviar({ delta: resposta }); // nenhum delta foi emitido — sem isso o cliente mostra bolha vazia
      }

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
          semResposta,
        })
        .returning({ id: assistenteMensagens.id });
      enviar({ done: true, conversaId: convId, mensagemId: msg.id, semResposta, fontes: fontesUnicas });
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
    try {
      if (!(await temPermissaoAssistente(req.user, "chat"))) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const { mensagemId, feedback } = req.body || {};
      if (!["up", "down"].includes(feedback)) {
        return res.status(422).json({ message: "feedback deve ser up ou down" });
      }
      const mid = Number(mensagemId);
      if (!Number.isInteger(mid) || mid <= 0) {
        return res.status(422).json({ message: "mensagemId inválido" });
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
            eq(assistenteMensagens.id, mid),
            eq(assistenteConversas.userId, req.user.id),
          ),
        )
        .limit(1);
      if (!res1.length) return res.status(404).json({ message: "Mensagem não encontrada" });
      await db
        .update(assistenteMensagens)
        .set({ feedback })
        .where(eq(assistenteMensagens.id, mid));
      res.json({ ok: true });
    } catch (err) {
      console.error("[assistente/feedback] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });

  // ---------- Fila de sugestões ----------
  app.get("/api/assistente/kb/sugestoes", requireAuth, requireGestorKb, async (req: any, res) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
      const status = String(req.query.status || "pendente");
      const sugestoes = await db
        .select()
        .from(kbSugestoes)
        .where(
          and(
            eq(kbSugestoes.tenantId, req.tenantId),
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
            .where(
              and(
                eq(kbArtigos.id, s.artigoConflitanteId),
                eq(kbArtigos.tenantId, req.tenantId),
              ),
            )
            .limit(1);
          conflito = art ?? null;
        }
        resultado.push({ ...s, conflito });
      }
      res.json(resultado);
    } catch (err) {
      console.error("[assistente/kb/sugestoes] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });

  app.post(
    "/api/assistente/kb/sugestoes/:id/decidir",
    requireAuth,
    requireGestorKb,
    async (req: any, res) => {
      try {
        if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
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
              eq(kbSugestoes.tenantId, req.tenantId),
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
        const categoria = (CATEGORIAS_KB as readonly string[]).includes(edicao?.categoria ?? sug.categoriaProposta)
          ? (edicao?.categoria ?? sug.categoriaProposta)
          : "dicas";
        const banco = edicao?.banco !== undefined ? edicao.banco || null : sug.bancoProposto;

        const [artigo] = await db
          .insert(kbArtigos)
          .values({
            tenantId: req.tenantId,
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
                eq(kbArtigos.tenantId, req.tenantId),
              ),
            );
          await removerChunksDoArtigo(sug.artigoConflitanteId);
        }

        await db
          .update(kbSugestoes)
          .set({ status: "aprovada", decididoPor: req.user.id, decididoEm: new Date() })
          .where(eq(kbSugestoes.id, id));
        res.json({ ok: true, artigoId: artigo.id });
      } catch (err) {
        console.error("[assistente/kb/sugestoes/decidir] erro:", err);
        res.status(500).json({ message: "Erro interno" });
      }
    },
  );

  // ---------- Sugestões vindas do WhatsApp CRM (API key, sem sessão) ----------
  app.post("/api/assistente/kb/sugestoes/externa", requireApiKey, async (req: any, res) => {
    try {
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
    } catch (err) {
      console.error("[assistente/kb/sugestoes/externa] erro:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  });

  // ---------- Métricas (gestão) ----------
  app.get("/api/assistente/metricas", requireAuth, requireGestorKb, async (req: any, res) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
      const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);
      const tenantId = req.tenantId;
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
    } catch (err) {
      console.error("[assistente/metricas] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });
}
