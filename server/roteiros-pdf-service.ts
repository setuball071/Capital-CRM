import { openai } from "./openaiClient";
import { roteirosImportSchema, type RoteirosImport } from "@shared/schema";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const ROTEIRO_EXTRACTION_PROMPT = `Você é um especialista em análise de documentos bancários brasileiros. Sua tarefa é extrair informações de roteiros operacionais de bancos e convertê-los em um formato JSON estruturado.

Analise o texto do documento PDF fornecido e extraia as seguintes informações para criar um ou mais roteiros bancários:

CAMPOS OBRIGATÓRIOS:
- banco: Nome do banco (ex: "BMG", "FACTA", "PH Tech")
- convenio: Nome do convênio (ex: "GOV_SP", "SIAPE", "INSS")
- segmento: Segmento do público (ex: "Servidor Estadual", "Aposentado")
- tipo_operacao: Tipo da operação - use um destes valores: "credito_novo", "refin", "compra_divida", "portabilidade", "cartao_beneficio", "cartao_consignado", "saque_complementar"

CAMPOS INFORMATIVOS (extraia do texto quando disponível):
- publico_alvo: Array de strings descrevendo quem pode contratar
- publico_nao_atendido: Array de strings descrevendo quem NÃO pode contratar
- faixas_idade: Array de objetos com {idade_minima, idade_maxima, limite_parcela, observacoes}
- limites_operacionais: Objeto com {prazo_minimo_meses, prazo_maximo_meses, parcela_minima, valor_minimo_liberado, margem_especifica, margem_negativa_permitida, descricao_margem_negativa}
- documentacao_obrigatoria: Array de strings com documentos necessários
- portais_acesso: Array de objetos com {orgao_ou_segmento, nome_portal, link_portal, instrucoes_acesso, observacoes}
- regras_especiais: Array de strings com regras importantes
- detalhes_adicionais: Array de strings com informações extras

FLAGS OPERACIONAIS (valores booleanos - APENAS true ou false, NUNCA null):
- flags_operacionais: Objeto com {
    aceita_spc_serasa, aceita_acao_judicial, aceita_margem_zerada, aceita_margem_negativa,
    aceita_clt, aceita_temporario, aceita_pensionista_temporario, aceita_procuracao,
    aceita_analfabeto, exige_senha_averbacao, pagamento_somente_conta_contracheque
  }

LIMITES POR SUBGRUPO (quando houver regras diferentes por subgrupo):
- limites_por_subgrupo: Array de objetos com {subgrupo, prazo_maximo_meses, idade_maxima, margem_seguranca, tabela_especifica, observacoes}

PERGUNTAS FREQUENTES:
- perguntas_frequentes_mapeadas: Array de objetos com {pergunta, resposta} baseado nas dúvidas comuns do roteiro

METADADOS PARA BUSCA:
- metadados_busca: Objeto com {
    produto: tipo do produto,
    convenio_principal: convênio principal,
    publico_chave: array de palavras-chave do público,
    risco_operacional: "baixo" | "medio" | "alto",
    complexidade_operacional: "baixa" | "media" | "alta",
    exige_analise_manual: boolean
  }

REGRAS DE FORMATAÇÃO DE TIPOS (OBRIGATÓRIO):
1. Campos de IDADE (idade_minima, idade_maxima): números inteiros SEM aspas (ex: 75, 18, 80)
2. Campos de PRAZO em meses (prazo_minimo_meses, prazo_maximo_meses): números inteiros SEM aspas (ex: 12, 84, 96)
3. Campos de VALOR MONETÁRIO (parcela_minima, valor_minimo_liberado, limite_parcela): strings formatadas com R$ (ex: "R$ 2.000,00")
4. Campos de PERCENTUAL (margem_especifica, margem_seguranca): strings com símbolo % (ex: "5%", "30%")
5. Campos BOOLEANOS (todas as flags): apenas true ou false, NUNCA null ou string
6. Campos de TEXTO: strings não vazias
7. Campos de ARRAY: arrays não vazios, ou OMITIR o campo se não houver dados

INSTRUÇÕES:
1. Retorne APENAS um objeto JSON válido no formato: {"roteiros": [...]}
2. Se o documento contiver múltiplos produtos/operações, crie um roteiro separado para cada um
3. NÃO inclua campos vazios, nulos ou sem informação - OMITA o campo completamente
4. Mantenha a fidelidade ao texto original - não invente informações
5. Identifique corretamente o banco e convênio pelo contexto do documento
6. Extraia perguntas frequentes baseadas em dúvidas comuns mencionadas no roteiro
7. O JSON deve ser diretamente validável pelo schema do sistema

TEXTO DO DOCUMENTO:
`;

export interface PdfExtractionResult {
  success: boolean;
  roteiros?: RoteirosImport;
  rawText?: string;
  error?: string;
  validationErrors?: any[];
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    console.log("[PDF-Parse] Extracting text from PDF buffer, size:", buffer.length);
    
    // Convert Buffer to Uint8Array for pdfjs-dist
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;
    
    console.log("[PDF-Parse] PDF loaded, pages:", pdfDocument.numPages);
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
    
    console.log("[PDF-Parse] Text extracted, length:", fullText.length);
    
    if (!fullText.trim()) {
      throw new Error("Este PDF não contém texto legível. Por favor, envie um PDF com texto.");
    }
    
    return fullText;
  } catch (error: any) {
    console.error("[PDF-Parse] Error extracting text:", error);
    if (error.message?.includes("não contém texto")) {
      throw error;
    }
    throw new Error("Erro ao extrair texto do PDF. Verifique se o arquivo é um PDF válido.");
  }
}

export async function convertPdfTextToRoteiros(pdfText: string): Promise<PdfExtractionResult> {
  try {
    const prompt = ROTEIRO_EXTRACTION_PROMPT + pdfText;

    console.log("[Roteiros-PDF] Calling OpenAI for PDF extraction...");
    console.log("[Roteiros-PDF] Text length:", pdfText.length, "characters");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Você é um assistente especializado em análise de documentos bancários brasileiros. Responda APENAS com JSON válido, sem markdown ou texto adicional."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 8000,
    });

    const aiResponse = response.choices[0]?.message?.content;
    
    if (!aiResponse) {
      return {
        success: false,
        rawText: pdfText,
        error: "A IA não retornou nenhuma resposta"
      };
    }

    console.log("[Roteiros-PDF] OpenAI response length:", aiResponse.length);

    let jsonResponse: any;
    try {
      const cleanedResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      jsonResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("[Roteiros-PDF] JSON parse error:", parseError);
      return {
        success: false,
        rawText: pdfText,
        error: "A IA retornou um JSON inválido. Tente novamente ou edite manualmente."
      };
    }

    const validation = roteirosImportSchema.safeParse(jsonResponse);

    if (!validation.success) {
      console.error("[Roteiros-PDF] Validation errors:", validation.error.errors);
      return {
        success: false,
        roteiros: jsonResponse,
        rawText: pdfText,
        error: "O JSON extraído não passou na validação. Revise os campos obrigatórios.",
        validationErrors: validation.error.errors
      };
    }

    console.log("[Roteiros-PDF] Successfully extracted", validation.data.roteiros.length, "roteiro(s)");

    return {
      success: true,
      roteiros: validation.data,
      rawText: pdfText
    };

  } catch (error: any) {
    console.error("[Roteiros-PDF] OpenAI error:", error);
    
    if (error.code === 'FREE_CLOUD_BUDGET_EXCEEDED') {
      return {
        success: false,
        rawText: pdfText,
        error: "Créditos de IA esgotados. Contate o administrador."
      };
    }

    return {
      success: false,
      rawText: pdfText,
      error: error.message || "Erro ao processar com IA"
    };
  }
}

export async function processPdfBuffer(buffer: Buffer): Promise<PdfExtractionResult> {
  const pdfText = await extractTextFromPdf(buffer);
  
  if (!pdfText || pdfText.trim().length < 100) {
    return {
      success: false,
      rawText: pdfText,
      error: "O PDF parece estar vazio ou contém muito pouco texto."
    };
  }

  return await convertPdfTextToRoteiros(pdfText);
}
