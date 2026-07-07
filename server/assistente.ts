import type { Express, Request, Response, RequestHandler } from "express";
import multer from "multer";
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
import { extractTextFromPdf } from "./roteiros-pdf-service";
import { transcreverAudio, extrairTextoImagem } from "./assistente-media";
import {
  indexarArtigo,
  removerChunksDoArtigo,
  buscarArtigoConflitante,
  buscarChunks,
  CORTE_SIMILARIDADE,
} from "./assistente-rag";

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
  return !!user && (user.isMaster || ["master", "operacional"].includes(user.role));
}

function requireGestorKb(req: any, res: Response, next: Function) {
  if (!podeGerenciarKb(req.user)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

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

  // ---------- Chat (qualquer usuário autenticado) ----------
  app.post("/api/assistente/chat", requireAuth, uploadChat.single("arquivo"), async (req: any, res: Response) => {
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
      const categoria = (CATEGORIAS_KB as readonly string[]).includes(edicao?.categoria ?? sug.categoriaProposta)
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
}
