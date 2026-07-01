/**
 * server/ocr.ts
 *
 * Endpoint de OCR para documentos com foto (RG / CNH).
 * Usa a integração OpenAI do Replit (openaiClient.ts) com visão de imagem.
 *
 * POST /api/ocr/document
 *   multipart/form-data:
 *     frente: File (imagem)
 *     verso:  File (imagem, opcional mas recomendado)
 *
 * Aceita imagem (o cliente converte PDF → imagem antes de enviar).
 *
 * Retorna JSON com:
 *   tipo, nome, numeroRegistro, cpf, filiacao, dataNascimento,
 *   dataExpedicao, orgaoEmissor, naturalidade
 */

import type { Express } from "express";
import multer from "multer";
import { ocrClient, ocrModel } from "./openaiClient";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB por arquivo
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas imagens são aceitas"));
    }
  },
});

// A IA às vezes devolve a STRING "null"/"undefined" (ou "N/A", "-") em vez de null real.
// Converte esses casos e strings vazias para null, recursivamente — assim os campos não
// chegam ao formulário preenchidos com a palavra "null" (que travava a próxima tela).
function nullifyStrings(obj: any): any {
  if (Array.isArray(obj)) return obj.map(nullifyStrings);
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) out[k] = nullifyStrings(v);
    return out;
  }
  if (typeof obj === "string") {
    const t = obj.trim().toLowerCase();
    if (t === "" || t === "null" || t === "undefined" || t === "n/a" || t === "na" || t === "-") return null;
  }
  return obj;
}

export interface DocPhotoExtracted {
  tipo: "RG" | "CNH" | "outro";
  nome: string | null;
  numeroRegistro: string | null;
  cpf: string | null;
  filiacao: [string | null, string | null];
  dataNascimento: string | null;
  dataExpedicao: string | null;
  orgaoEmissor: string | null;
  naturalidade: string | null;
}

export function registerOcrRoutes(app: Express, requireAuth: Function) {
  app.post(
    "/api/ocr/document",
    requireAuth,
    upload.fields([
      { name: "frente", maxCount: 1 },
      { name: "verso", maxCount: 1 },
    ]),
    async (req: any, res) => {
      try {
        const files = req.files as Record<string, Express.Multer.File[]>;
        const frenteFile = files?.frente?.[0];
        const versoFile = files?.verso?.[0];

        if (!frenteFile) {
          return res
            .status(400)
            .json({ message: "Imagem da frente é obrigatória" });
        }

        // ── Monta os blocos de imagem para o modelo ──────────────────────────
        const imageBlocks: any[] = [
          {
            type: "image_url",
            image_url: {
              url: `data:${frenteFile.mimetype};base64,${frenteFile.buffer.toString("base64")}`,
              detail: "high",
            },
          },
        ];

        if (versoFile) {
          imageBlocks.push({
            type: "image_url",
            image_url: {
              url: `data:${versoFile.mimetype};base64,${versoFile.buffer.toString("base64")}`,
              detail: "high",
            },
          });
        }

        const systemPrompt = `Você é um especialista em leitura de documentos de identidade brasileiros (RG, CNH e CNH-e digital).
Analise as imagens fornecidas (frente e, se disponível, verso do documento) e extraia os dados.
Seja preciso: transcreva exatamente o que está escrito, sem corrigir ou inferir.
ATENÇÃO à FILIAÇÃO: na seção "FILIAÇÃO" há dois nomes, um ACIMA do outro. Retorne-os EXATAMENTE na ordem em que aparecem, de cima para baixo. NÃO tente deduzir quem é pai ou mãe pelo nome — apenas preserve a ordem impressa. Por convenção do RG, o 1º (de cima) é o PAI e o 2º (de baixo) é a MÃE. Em CNH-e o documento pode estar embutido como imagem na página; leia mesmo assim.
Para campos realmente não legíveis ou ausentes, use null.`;

        const userPrompt = `Extraia os dados deste documento de identidade brasileiro e retorne SOMENTE um JSON válido, sem markdown, sem explicações.

Formato exato:
{
  "tipo": "RG" ou "CNH",
  "nome": "NOME COMPLETO COMO NO DOCUMENTO",
  "numeroRegistro": "número do RG (sem pontos/traços) ou nº de registro da CNH",
  "cpf": "11 dígitos sem pontuação, ou null",
  "filiacao": ["1º nome da filiação (o de CIMA — normalmente o PAI) ou null", "2º nome da filiação (o de BAIXO — normalmente a MÃE) ou null"],
  "dataNascimento": "DD/MM/AAAA",
  "dataExpedicao": "DD/MM/AAAA",
  "orgaoEmissor": "ex: SSP/RJ, DETRAN/RJ, COREN/RJ",
  "naturalidade": "cidade/UF de nascimento (ex: RIO DE JANEIRO/RJ), ou null se não constar"
}`;

        const response = await ocrClient.chat.completions.create({
          model: ocrModel,
          max_tokens: 1500,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                ...imageBlocks,
              ],
            },
          ],
        });

        const raw = response.choices[0]?.message?.content ?? "";
        const finish = response.choices[0]?.finish_reason ?? "?";

        // Extrai JSON da resposta (pode vir com markdown ```json ... ```)
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("[OCR] resposta sem JSON. finish:", finish, "raw:", raw);
          return res
            .status(422)
            .json({ message: "Não foi possível extrair os dados do documento. Preencha manualmente." });
        }

        let extracted: DocPhotoExtracted;
        try {
          extracted = nullifyStrings(JSON.parse(jsonMatch[0]));
        } catch {
          return res
            .status(422)
            .json({ message: "Resposta do modelo inválida" });
        }

        // Limpa CPF (remove pontuação se veio formatado)
        if (extracted.cpf) {
          extracted.cpf = extracted.cpf.replace(/\D/g, "");
          if (extracted.cpf.length !== 11) extracted.cpf = null;
        }

        return res.json(extracted);
      } catch (e: any) {
        console.error("POST /api/ocr/document error:", e);
        const status = e?.status ?? e?.response?.status;
        const msg = String(e?.message || "");
        if (
          status === 401 || status === 403 || status === 429 ||
          /api[_ ]?key|authentication|invalid_api_key|sk-missing|quota|rate limit|insufficient/i.test(msg)
        ) {
          return res.status(503).json({
            message: "Leitura automática indisponível no momento. Preencha os dados do documento manualmente.",
          });
        }
        return res.status(500).json({ message: "Erro ao processar documento" });
      }
    }
  );
}
