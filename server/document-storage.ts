/**
 * Storage de anexos das propostas.
 *
 * Dois back-ends, escolhidos por variável de ambiente:
 *  - Supabase Storage  → quando SUPABASE_URL e SUPABASE_SERVICE_KEY estão setados
 *                        (produção no Cloudfy: bucket privado).
 *  - Disco local       → fallback (comportamento antigo do Replit). Mantém o app
 *                        funcionando enquanto o Supabase não está configurado.
 *
 * A chave do objeto (`objectPath`) é sempre relativa, ex.: "proposals/123/RG-...pdf".
 */
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "anexos";

export function isSupabaseStorage(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

// Cliente Supabase (lazy + cache) — importado dinamicamente para não carregar
// quando rodando só com disco.
let _client: any = null;
let _bucketReady = false;
async function getClient(): Promise<any> {
  if (_client) return _client;
  // @supabase/supabase-js >=2.108 instancia o RealtimeClient no construtor, que
  // exige um WebSocket global. O Node 20 não tem WebSocket nativo, então o
  // createClient lança "Node.js 20 detected without native WebSocket support" e
  // derruba upload/download de anexos. Fazemos polyfill com o pacote `ws` (já
  // é dependência) antes de criar o cliente.
  if (typeof (globalThis as any).WebSocket === "undefined") {
    const wsmod: any = await import("ws");
    (globalThis as any).WebSocket = wsmod.default || wsmod.WebSocket || wsmod;
  }
  const { createClient } = await import("@supabase/supabase-js");
  _client = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  });
  return _client;
}

async function ensureBucket(client: any): Promise<void> {
  if (_bucketReady) return;
  // createBucket é idempotente o suficiente: se já existe, retorna erro que ignoramos.
  await client.storage.createBucket(BUCKET, { public: false }).catch(() => {});
  _bucketReady = true;
}

function diskPathFor(objectPath: string): string {
  return path.join(process.cwd(), "uploads", objectPath);
}

/** Grava o arquivo e retorna a chave do objeto (objectPath). */
export async function saveDocument(
  objectPath: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (isSupabaseStorage()) {
    const client = await getClient();
    await ensureBucket(client);
    const { error } = await client.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: true });
    if (error) throw new Error(`Supabase Storage upload: ${error.message}`);
    return objectPath;
  }

  const full = diskPathFor(objectPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  return objectPath;
}

/** Lê o arquivo de volta. Retorna o buffer e o content-type (quando disponível). */
export async function getDocument(
  objectPath: string,
): Promise<{ buffer: Buffer; contentType?: string }> {
  if (isSupabaseStorage()) {
    const client = await getClient();
    const { data, error } = await client.storage.from(BUCKET).download(objectPath);
    if (error || !data) throw new Error(`Supabase Storage download: ${error?.message || "vazio"}`);
    const buffer = Buffer.from(await data.arrayBuffer());
    return { buffer, contentType: data.type || undefined };
  }

  const full = diskPathFor(objectPath);
  if (!fs.existsSync(full)) throw new Error("Arquivo não encontrado no disco");
  return { buffer: fs.readFileSync(full) };
}

/** Remove o arquivo (best-effort). */
export async function deleteDocument(objectPath: string): Promise<void> {
  if (isSupabaseStorage()) {
    const client = await getClient();
    await client.storage.from(BUCKET).remove([objectPath]).catch(() => {});
    return;
  }
  const full = diskPathFor(objectPath);
  fs.promises.unlink(full).catch(() => {});
}
