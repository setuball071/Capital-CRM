import type { Express, Request, Response, RequestHandler } from "express";
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
}
