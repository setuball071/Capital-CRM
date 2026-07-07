import { db } from "./storage";
import { sql } from "drizzle-orm";
import { ocrClient } from "./openaiClient";

const geminiKey = process.env.GEMINI_API_KEY;
export const EMBEDDING_MODEL =
  process.env.ASSISTENTE_EMBEDDING_MODEL ||
  (geminiKey ? "gemini-embedding-001" : "text-embedding-3-small");
export const EMBEDDING_DIM = 768;
export const CORTE_SIMILARIDADE = 0.5; // abaixo disso = "não sei"
export const CORTE_CONFLITO = 0.82; // acima disso = possível artigo duplicado/conflitante

export type ChunkEncontrado = {
  chunkId: number;
  artigoId: number;
  titulo: string;
  categoria: string;
  banco: string | null;
  texto: string;
  similaridade: number;
};

// linhas de resultado independem do driver (node-postgres = {rows}, postgres-js = array)
function pegarRows(res: unknown): any[] {
  return ((res as any)?.rows ?? res) as any[];
}

export function chunkarTexto(texto: string, tamanhoMax = 1800): string[] {
  const paragrafos = texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let atual = "";
  for (const p of paragrafos) {
    if (p.length > tamanhoMax) {
      if (atual) {
        chunks.push(atual);
        atual = "";
      }
      for (let i = 0; i < p.length; i += tamanhoMax) {
        chunks.push(p.slice(i, i + tamanhoMax));
      }
      continue;
    }
    if (atual && atual.length + p.length + 2 > tamanhoMax) {
      chunks.push(atual);
      atual = "";
    }
    atual = atual ? `${atual}\n\n${p}` : p;
  }
  if (atual) chunks.push(atual);
  return chunks;
}

function normalizarL2(v: number[]): number[] {
  const norma = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norma);
}

export async function gerarEmbeddings(textos: string[]): Promise<number[][]> {
  const res = await ocrClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: textos,
    dimensions: EMBEDDING_DIM,
  });
  return res.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => normalizarL2(d.embedding as number[]));
}

export async function removerChunksDoArtigo(artigoId: number): Promise<void> {
  await db.execute(sql`DELETE FROM kb_chunks WHERE artigo_id = ${artigoId}`);
}

export async function indexarArtigo(
  artigoId: number,
  titulo: string,
  conteudo: string,
): Promise<number> {
  await removerChunksDoArtigo(artigoId);
  const chunks = chunkarTexto(`${titulo}\n\n${conteudo}`);
  if (!chunks.length) return 0;
  const embeddings = await gerarEmbeddings(chunks);
  for (let i = 0; i < chunks.length; i++) {
    const vec = `[${embeddings[i].join(",")}]`;
    await db.execute(sql`
      INSERT INTO kb_chunks (artigo_id, ordem, texto, embedding)
      VALUES (${artigoId}, ${i}, ${chunks[i]}, ${vec}::vector)
    `);
  }
  return chunks.length;
}

export async function buscarChunks(
  tenantId: number,
  pergunta: string,
  limite = 8,
): Promise<ChunkEncontrado[]> {
  const [emb] = await gerarEmbeddings([pergunta]);
  const vec = `[${emb.join(",")}]`;
  const res = await db.execute(sql`
    SELECT kc.id AS chunk_id, kc.artigo_id, ka.titulo, ka.categoria, ka.banco, kc.texto,
           (1 - (kc.embedding <=> ${vec}::vector))::float AS similaridade
    FROM kb_chunks kc
    JOIN kb_artigos ka ON ka.id = kc.artigo_id
    WHERE ka.status = 'publicado' AND ka.tenant_id = ${tenantId}
    ORDER BY kc.embedding <=> ${vec}::vector
    LIMIT ${limite}
  `);
  return pegarRows(res).map((r) => ({
    chunkId: Number(r.chunk_id),
    artigoId: Number(r.artigo_id),
    titulo: r.titulo,
    categoria: r.categoria,
    banco: r.banco ?? null,
    texto: r.texto,
    similaridade: Number(r.similaridade),
  }));
}

export async function buscarArtigoConflitante(
  tenantId: number,
  titulo: string,
  conteudo: string,
): Promise<{ artigoId: number; titulo: string; similaridade: number } | null> {
  const top = await buscarChunks(
    tenantId,
    `${titulo}\n\n${conteudo.slice(0, 1500)}`,
    1,
  );
  if (top.length && top[0].similaridade >= CORTE_CONFLITO) {
    return {
      artigoId: top[0].artigoId,
      titulo: top[0].titulo,
      similaridade: top[0].similaridade,
    };
  }
  return null;
}
