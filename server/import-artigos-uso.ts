/**
 * Importa artigos "como usar o CRM" para a FILA DE APROVAÇÃO do Jarvis.
 * Lê um JSON (array de { titulo, categoria, conteudo }) e cria uma sugestão por artigo.
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL="postgresql://..."      # banco do Capital CRM
 *   $env:IMPORT_TENANT_ID="4"                  # tenant Capital Go
 *   $env:ARTIGOS_JSON="exports\artigos-uso-crm.json"
 *   npx tsx server/import-artigos-uso.ts
 *
 * Idempotente: re-rodar não duplica (dedupe por origemRef = "uso:<titulo>").
 * NÃO precisa de OPENAI (a categoria já vem definida; a detecção de conflito é best-effort).
 */
import fs from "fs";

const TENANT_ID = Number(process.env.IMPORT_TENANT_ID || 0);
const ARQ = process.env.ARTIGOS_JSON;

if (!process.env.DATABASE_URL || !TENANT_ID || !ARQ) {
  console.error("Faltam envs: DATABASE_URL, IMPORT_TENANT_ID, ARTIGOS_JSON");
  process.exit(1);
}

(async () => {
  const { criarSugestao } = await import("./assistente");
  const artigos: Array<{ titulo: string; categoria?: string; conteudo: string }> =
    JSON.parse(fs.readFileSync(ARQ!, "utf-8"));
  console.log(`${artigos.length} artigos no arquivo`);
  let criadas = 0,
    puladas = 0,
    erros = 0;

  for (const a of artigos) {
    try {
      if (!a.titulo || !a.conteudo) {
        erros++;
        continue;
      }
      const { duplicada } = await criarSugestao({
        tenantId: TENANT_ID,
        titulo: a.titulo,
        conteudo: a.conteudo,
        categoria: a.categoria || "atalhos_sistema",
        banco: null,
        origem: "sistema",
        origemRef: `uso:${a.titulo}`,
        payloadBruto: null,
      });
      if (duplicada) {
        puladas++;
        console.log(`  ~ já existe: ${a.titulo}`);
      } else {
        criadas++;
        console.log(`  + ${a.titulo} [${a.categoria || "atalhos_sistema"}]`);
      }
    } catch (e: any) {
      erros++;
      console.error(`  ! erro em "${a.titulo}": ${e.message}`);
    }
  }

  console.log(`\nResumo: ${criadas} criadas, ${puladas} puladas, ${erros} erros.`);
  console.log("Agora é revisar/publicar na tela Base de Conhecimento → Fila de Aprovação.");
  process.exit(0);
})();
