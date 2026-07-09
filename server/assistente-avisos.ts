import type { Express, Response } from "express";
import type { RequestHandler } from "express";
import { db } from "./storage";
import { and, desc, eq, inArray } from "drizzle-orm";
import { assistenteAvisos } from "@shared/schema";

const STATUS_CANCELAMENTO = new Set(["CANCELADA", "PERDIDA"]);

/**
 * Cria um aviso do Jarvis para o DONO da proposta quando o status entra em
 * PAGO / cancelamento / pendência do corretor. Best-effort — nunca lança.
 * ISOLAMENTO: userId é sempre o dono da proposta; a leitura (endpoints) filtra por usuário.
 */
export async function notificarStatusProposta(dados: {
  tenantId: number;
  userId: number;
  proposalId: number;
  clientName: string | null;
  statusAntigo: string | null;
  statusNovo: string;
  pendenciaCorretorKeys: Set<string>;
}): Promise<void> {
  try {
    const { tenantId, userId, proposalId, statusNovo, statusAntigo } = dados;
    if (!tenantId || !userId || !statusNovo) return;
    if (statusAntigo === statusNovo) return; // só na transição

    const cliente = dados.clientName?.trim() || "seu cliente";
    let tipo: string | null = null;
    let titulo = "";
    let mensagem = "";

    if (statusNovo === "PAGO") {
      tipo = "contrato_pago";
      titulo = "Contrato pago 🎉";
      mensagem = `Boa notícia! O contrato do cliente ${cliente} foi PAGO. Parabéns!`;
    } else if (STATUS_CANCELAMENTO.has(statusNovo)) {
      tipo = "contrato_cancelado";
      titulo = "Contrato cancelado";
      mensagem = `A proposta do cliente ${cliente} foi cancelada.`;
    } else if (
      statusNovo === "PENDENTE_CORRETOR" ||
      dados.pendenciaCorretorKeys.has(statusNovo)
    ) {
      // EXCLUI PENDENTE_BANCO (não está no set de pendência do corretor)
      tipo = "contrato_pendencia";
      titulo = "Proposta com pendência ⚠️";
      mensagem = `A proposta do cliente ${cliente} está com pendência e precisa da sua atenção. Regularize quando puder.`;
    }

    if (!tipo) return;

    await db.insert(assistenteAvisos).values({
      tenantId,
      userId,
      tipo,
      titulo,
      mensagem,
      proposalId,
    });
  } catch (err) {
    console.error("[assistente-avisos] falha ao notificar (não-fatal):", err);
  }
}

export function registerAssistenteAvisosRoutes(app: Express, requireAuth: RequestHandler) {
  app.get("/api/assistente/avisos", requireAuth, async (req: any, res: Response) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
      const avisos = await db
        .select()
        .from(assistenteAvisos)
        .where(
          and(
            eq(assistenteAvisos.userId, req.user.id),
            eq(assistenteAvisos.tenantId, req.tenantId),
            eq(assistenteAvisos.lida, false),
          ),
        )
        .orderBy(desc(assistenteAvisos.id))
        .limit(20);
      res.json(avisos);
    } catch (err) {
      console.error("[assistente/avisos] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });

  app.get("/api/assistente/avisos/count", requireAuth, async (req: any, res: Response) => {
    try {
      if (!req.tenantId) return res.json({ count: 0 });
      const rows = await db
        .select({ id: assistenteAvisos.id })
        .from(assistenteAvisos)
        .where(
          and(
            eq(assistenteAvisos.userId, req.user.id),
            eq(assistenteAvisos.tenantId, req.tenantId),
            eq(assistenteAvisos.lida, false),
          ),
        );
      res.json({ count: rows.length });
    } catch (err) {
      console.error("[assistente/avisos/count] erro:", err);
      res.json({ count: 0 });
    }
  });

  app.post("/api/assistente/avisos/marcar-lidas", requireAuth, async (req: any, res: Response) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: "Tenant não resolvido" });
      const ids: number[] = Array.isArray(req.body?.ids)
        ? req.body.ids.map(Number).filter((n: number) => Number.isInteger(n))
        : [];
      const base = and(
        eq(assistenteAvisos.userId, req.user.id),
        eq(assistenteAvisos.tenantId, req.tenantId),
      );
      await db
        .update(assistenteAvisos)
        .set({ lida: true })
        .where(ids.length ? and(base, inArray(assistenteAvisos.id, ids)) : base);
      res.json({ ok: true });
    } catch (err) {
      console.error("[assistente/avisos/marcar-lidas] erro:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });
}
