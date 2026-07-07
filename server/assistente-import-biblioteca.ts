/**
 * Importa a Biblioteca do WhatsApp CRM (capitalgo) como SUGESTÕES na fila de aprovação.
 * Uso (PowerShell):
 *   $env:WHATS_SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:WHATS_SUPABASE_SERVICE_KEY="service_role_key"
 *   $env:IMPORT_TENANT_ID="1"
 *   npx tsx server/assistente-import-biblioteca.ts
 * Idempotente: livro já importado (origemRef) é pulado.
 */
import { criarSugestao, classificarConteudo } from "./assistente";

const URL_BASE = process.env.WHATS_SUPABASE_URL;
const KEY = process.env.WHATS_SUPABASE_SERVICE_KEY;
const TENANT_ID = Number(process.env.IMPORT_TENANT_ID || 0);

if (!URL_BASE || !KEY || !TENANT_ID) {
  console.error("Faltam envs: WHATS_SUPABASE_URL, WHATS_SUPABASE_SERVICE_KEY, IMPORT_TENANT_ID");
  process.exit(1);
}

async function pgrest(path: string): Promise<any[]> {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`PostgREST ${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

(async () => {
  const files = await pgrest(
    "knowledge_files?select=id,file_name,file_type,status,chunk_count&chunk_count=gt.0&order=created_at.asc",
  );
  console.log(`Biblioteca: ${files.length} livros com conteúdo`);
  let criadas = 0, puladas = 0, erros = 0;

  for (const f of files) {
    try {
      const chunks = await pgrest(
        `knowledge_chunks?select=content,chunk_index&file_id=eq.${f.id}&order=chunk_index.asc`,
      );
      const textoBruto = chunks.map((c: any) => c.content).join("\n\n").trim();
      if (!textoBruto) { puladas++; continue; }

      const clas = await classificarConteudo(`Título original: ${f.file_name}\n\n${textoBruto}`);
      const { duplicada } = await criarSugestao({
        tenantId: TENANT_ID,
        titulo: clas.titulo,
        conteudo: clas.conteudo,
        categoria: clas.categoria,
        banco: clas.banco,
        origem: "whatsapp_biblioteca",
        origemRef: String(f.id),
        payloadBruto: textoBruto.slice(0, 100000),
      });
      if (duplicada) { puladas++; console.log(`  ~ já importado: ${f.file_name}`); }
      else { criadas++; console.log(`  + ${f.file_name} → "${clas.titulo}" [${clas.categoria}]`); }
    } catch (e: any) {
      erros++;
      console.error(`  ! erro em "${f.file_name}": ${e.message}`);
    }
  }
  console.log(`\nResumo: ${criadas} sugestões criadas, ${puladas} puladas, ${erros} erros.`);
  console.log("Agora é triar na tela Base de Conhecimento → Fila de Aprovação.");
  process.exit(0);
})();
