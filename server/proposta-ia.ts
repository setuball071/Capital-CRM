import type { Express, Response, RequestHandler } from "express";
import { ocrClient, ocrModel } from "./openaiClient";

interface ContratoAtual {
  banco: string;
  parcela: string;
  prazo: string;
  acao: string;
}

interface ContratoFinal {
  banco: string;
  parcela: string;
  prazo: string;
}

export function registerPropostaIaRoutes(app: Express, requireAuth: RequestHandler) {
  app.post("/api/proposta-ia/gerar", requireAuth, async (req: any, res: Response) => {
    try {
      const { cliente, contratosAtuais, contratosFinals, economiaTotal, margemLivre } = req.body;

      if (!cliente?.trim() || !contratosAtuais?.length) {
        return res.status(400).json({ error: "Cliente e contratos atuais são obrigatórios" });
      }

      const contratosAtuaisStr = (contratosAtuais as ContratoAtual[])
        .map((c, i) => `${i + 1}. ${c.banco}: parcela ${c.parcela}, prazo ${c.prazo}, ação: ${c.acao}`)
        .join("\n");

      const contratosFinalStr = (contratosFinals as ContratoFinal[])
        .map((c, i) => `${i + 1}. ${c.banco}: parcela ${c.parcela}, prazo ${c.prazo}`)
        .join("\n");

      const prompt = `Você é especialista em crédito consignado da Capital Go, correspondente bancária. Monte uma proposta comercial personalizada em JSON para o cliente ${cliente}.

CONTRATOS ATUAIS DO CLIENTE:
${contratosAtuaisStr}

CONTRATOS FINAIS PROPOSTOS (após a operação):
${contratosFinalStr}

RESULTADO ESPERADO:
- Economia mensal: ${economiaTotal || "a calcular"}
- Margem livre liberada: ${margemLivre || "a calcular"}

Responda APENAS um JSON válido sem markdown com esta estrutura exata:
{
  "titulo": "título da proposta em até 10 palavras (ex: Reorganização de contratos com foco em economia mensal)",
  "subtitulo": "frase de até 2 linhas explicando o objetivo geral da operação para este cliente específico",
  "estrategia": "parágrafo de 3-4 linhas explicando como funciona a estratégia desta operação: por que cada etapa é necessária, quais contratos são liquidados/amortizados primeiro e por quê, e qual o benefício final para o cliente",
  "passos": [
    {"titulo": "título curto do passo 1", "descricao": "descrição objetiva do que será feito, mencionando bancos e valores reais"},
    {"titulo": "título curto do passo 2", "descricao": "..."}
  ],
  "observacao": "nota final sobre condições, prazos, diferenciais ou alertas importantes desta operação"
}

Use linguagem direta, profissional e focada no benefício do cliente. Mencione os bancos e valores reais. Os passos devem refletir a sequência real das operações. Mínimo 3 passos, máximo 5.`;

      const completion = await ocrClient.chat.completions.create({
        model: ocrModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 2000,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      const jsonStr = raw.replace(/^```(json)?/m, "").replace(/```$/m, "").trim();
      const data = JSON.parse(jsonStr);

      res.json(data);
    } catch (e: any) {
      console.error("[proposta-ia] erro:", e);
      res.status(500).json({ error: "Erro ao gerar proposta: " + e.message });
    }
  });
}
