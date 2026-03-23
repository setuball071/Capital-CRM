import type { Express } from "express";
import { db } from "./storage";
import {
  proposals,
  proposalHistory,
  proposalMessages,
  proposalDocuments,
  contractFlows,
  contractFlowSteps,
  commissionGroups,
  financialDebits,
} from "../shared/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { addToPortfolio } from "./portfolio";

export function registerContractRoutes(app: Express, requireAuth: Function) {

  // ===================== FLUXOS =====================

  app.get("/api/contracts/flows", requireAuth, async (req: any, res) => {
    try {
      const flows = await db
        .select()
        .from(contractFlows)
        .where(eq(contractFlows.tenantId, req.tenantId!))
        .orderBy(asc(contractFlows.name));
      return res.json(flows);
    } catch (e: any) {
      console.error("GET /api/contracts/flows error:", e);
      return res.status(500).json({ message: "Erro ao listar fluxos" });
    }
  });

  app.post("/api/contracts/flows", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const { name, bank, convenio, product } = req.body;
      if (!name || !bank || !convenio || !product) {
        return res.status(400).json({ message: "Campos obrigatórios: name, bank, convenio, product" });
      }
      const [flow] = await db
        .insert(contractFlows)
        .values({ tenantId: req.tenantId!, name, bank, convenio, product, isActive: true })
        .returning();
      return res.status(201).json(flow);
    } catch (e: any) {
      console.error("POST /api/contracts/flows error:", e);
      return res.status(500).json({ message: "Erro ao criar fluxo" });
    }
  });

  app.put("/api/contracts/flows/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      const [flow] = await db
        .update(contractFlows)
        .set(req.body)
        .where(and(eq(contractFlows.id, id), eq(contractFlows.tenantId, req.tenantId!)))
        .returning();
      if (!flow) return res.status(404).json({ message: "Fluxo não encontrado" });
      return res.json(flow);
    } catch (e: any) {
      console.error("PUT /api/contracts/flows/:id error:", e);
      return res.status(500).json({ message: "Erro ao atualizar fluxo" });
    }
  });

  app.delete("/api/contracts/flows/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      await db
        .delete(contractFlows)
        .where(and(eq(contractFlows.id, id), eq(contractFlows.tenantId, req.tenantId!)));
      return res.json({ message: "Fluxo removido" });
    } catch (e: any) {
      console.error("DELETE /api/contracts/flows/:id error:", e);
      return res.status(500).json({ message: "Erro ao remover fluxo" });
    }
  });

  // ===================== ETAPAS DO FLUXO =====================

  app.get("/api/contracts/flows/:id/steps", requireAuth, async (req: any, res) => {
    try {
      const flowId = parseInt(req.params.id);
      const flow = await db
        .select()
        .from(contractFlows)
        .where(and(eq(contractFlows.id, flowId), eq(contractFlows.tenantId, req.tenantId!)))
        .limit(1);
      if (!flow.length) return res.status(404).json({ message: "Fluxo não encontrado" });

      const steps = await db
        .select()
        .from(contractFlowSteps)
        .where(eq(contractFlowSteps.flowId, flowId))
        .orderBy(asc(contractFlowSteps.stepOrder));
      return res.json(steps);
    } catch (e: any) {
      console.error("GET /api/contracts/flows/:id/steps error:", e);
      return res.status(500).json({ message: "Erro ao listar etapas" });
    }
  });

  app.post("/api/contracts/flows/:id/steps", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const flowId = parseInt(req.params.id);
      const flow = await db
        .select()
        .from(contractFlows)
        .where(and(eq(contractFlows.id, flowId), eq(contractFlows.tenantId, req.tenantId!)))
        .limit(1);
      if (!flow.length) return res.status(404).json({ message: "Fluxo não encontrado" });

      const { stepOrder, name, description, requiredRole, requiresDocuments } = req.body;
      const [step] = await db
        .insert(contractFlowSteps)
        .values({ flowId, stepOrder, name, description, requiredRole, requiresDocuments: !!requiresDocuments })
        .returning();
      return res.status(201).json(step);
    } catch (e: any) {
      console.error("POST /api/contracts/flows/:id/steps error:", e);
      return res.status(500).json({ message: "Erro ao criar etapa" });
    }
  });

  app.put("/api/contracts/flows/steps/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      const [step] = await db
        .update(contractFlowSteps)
        .set(req.body)
        .where(eq(contractFlowSteps.id, id))
        .returning();
      if (!step) return res.status(404).json({ message: "Etapa não encontrada" });
      return res.json(step);
    } catch (e: any) {
      console.error("PUT /api/contracts/flows/steps/:id error:", e);
      return res.status(500).json({ message: "Erro ao atualizar etapa" });
    }
  });

  app.delete("/api/contracts/flows/steps/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      await db.delete(contractFlowSteps).where(eq(contractFlowSteps.id, id));
      return res.json({ message: "Etapa removida" });
    } catch (e: any) {
      console.error("DELETE /api/contracts/flows/steps/:id error:", e);
      return res.status(500).json({ message: "Erro ao remover etapa" });
    }
  });

  app.put("/api/contracts/flows/:id/steps/reorder", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const flowId = parseInt(req.params.id);
      const items: { id: number; stepOrder: number }[] = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Body deve ser array de {id, stepOrder}" });
      }
      // neon-http does not support transactions — sequential updates
      for (const item of items) {
        await db
          .update(contractFlowSteps)
          .set({ stepOrder: item.stepOrder })
          .where(and(eq(contractFlowSteps.id, item.id), eq(contractFlowSteps.flowId, flowId)));
      }
      return res.json({ message: "Ordem atualizada" });
    } catch (e: any) {
      console.error("PUT /api/contracts/flows/:id/steps/reorder error:", e);
      return res.status(500).json({ message: "Erro ao reordenar etapas" });
    }
  });

  // ===================== PROPOSTAS =====================

  app.get("/api/contracts/proposals", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;

      let query = db
        .select({
          id: proposals.id,
          clientName: proposals.clientName,
          clientCpf: proposals.clientCpf,
          clientMatricula: proposals.clientMatricula,
          clientConvenio: proposals.clientConvenio,
          bank: proposals.bank,
          product: proposals.product,
          tableId: proposals.tableId,
          contractValue: proposals.contractValue,
          installmentValue: proposals.installmentValue,
          term: proposals.term,
          status: proposals.status,
          isPaused: proposals.isPaused,
          ade: proposals.ade,
          commissionStatus: proposals.commissionStatus,
          vendorId: proposals.vendorId,
          flowId: proposals.flowId,
          currentStepId: proposals.currentStepId,
          createdAt: proposals.createdAt,
          updatedAt: proposals.updatedAt,
        })
        .from(proposals)
        .$dynamic();

      const conditions = [eq(proposals.tenantId, tenantId)];

      if (user.role === "vendedor") {
        conditions.push(eq(proposals.vendorId, user.id));
      }

      const { status, bank, product, startDate, endDate, vendorId } = req.query;
      if (status) conditions.push(eq(proposals.status, status as string));
      if (bank) conditions.push(eq(proposals.bank, bank as string));
      if (product) conditions.push(eq(proposals.product, product as string));
      if (vendorId && user.role !== "vendedor") {
        conditions.push(eq(proposals.vendorId, parseInt(vendorId as string)));
      }

      const results = await db
        .select()
        .from(proposals)
        .where(and(...conditions))
        .orderBy(desc(proposals.createdAt));

      return res.json(results);
    } catch (e: any) {
      console.error("GET /api/contracts/proposals error:", e);
      return res.status(500).json({ message: "Erro ao listar propostas" });
    }
  });

  app.post("/api/contracts/proposals", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;
      const {
        clientName, clientCpf, clientMatricula, clientConvenio,
        bank, product, tableId, contractValue, installmentValue, term,
      } = req.body;

      if (!clientName || !clientCpf) {
        return res.status(400).json({ message: "Nome e CPF do cliente são obrigatórios" });
      }

      // Auto-find matching active flow
      let matchedFlowId: number | null = null;
      let firstStepId: number | null = null;

      if (bank && product) {
        const matchedFlows = await db
          .select()
          .from(contractFlows)
          .where(
            and(
              eq(contractFlows.tenantId, tenantId),
              eq(contractFlows.isActive, true),
              eq(contractFlows.bank, bank),
              eq(contractFlows.product, product),
              clientConvenio ? eq(contractFlows.convenio, clientConvenio) : sql`1=1`,
            )
          )
          .limit(1);

        if (matchedFlows.length) {
          matchedFlowId = matchedFlows[0].id;
          const firstStep = await db
            .select()
            .from(contractFlowSteps)
            .where(eq(contractFlowSteps.flowId, matchedFlowId))
            .orderBy(asc(contractFlowSteps.stepOrder))
            .limit(1);
          firstStepId = firstStep.length ? firstStep[0].id : null;
        }
      }

      const vendorId = user.role === "vendedor" ? user.id : (req.body.vendorId || user.id);

      const [proposal] = await db
        .insert(proposals)
        .values({
          tenantId,
          clientName,
          clientCpf,
          clientMatricula: clientMatricula || null,
          clientConvenio: clientConvenio || null,
          bank: bank || null,
          product: product || null,
          tableId: tableId ? parseInt(tableId) : null,
          contractValue: contractValue || null,
          installmentValue: installmentValue || null,
          term: term ? parseInt(term) : null,
          status: "CADASTRADA",
          isPaused: false,
          flowId: matchedFlowId,
          currentStepId: firstStepId,
          vendorId,
          createdBy: user.id,
        })
        .returning();

      // Record initial history
      await db.insert(proposalHistory).values({
        proposalId: proposal.id,
        toStatus: "CADASTRADA",
        action: "AVANCO",
        notes: "Proposta cadastrada",
        performedBy: user.id,
      });

      return res.status(201).json(proposal);
    } catch (e: any) {
      console.error("POST /api/contracts/proposals error:", e);
      return res.status(500).json({ message: "Erro ao criar proposta" });
    }
  });

  app.get("/api/contracts/proposals/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user!;
      const tenantId = req.tenantId!;

      const conditions = [eq(proposals.id, id), eq(proposals.tenantId, tenantId)];
      if (user.role === "vendedor") {
        conditions.push(eq(proposals.vendorId, user.id));
      }

      const [proposal] = await db
        .select()
        .from(proposals)
        .where(and(...conditions))
        .limit(1);

      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });

      // Load steps if flow is set
      let steps: any[] = [];
      if (proposal.flowId) {
        steps = await db
          .select()
          .from(contractFlowSteps)
          .where(eq(contractFlowSteps.flowId, proposal.flowId))
          .orderBy(asc(contractFlowSteps.stepOrder));
      }

      return res.json({ ...proposal, steps });
    } catch (e: any) {
      console.error("GET /api/contracts/proposals/:id error:", e);
      return res.status(500).json({ message: "Erro ao buscar proposta" });
    }
  });

  app.put("/api/contracts/proposals/:id/status", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user!;
      const tenantId = req.tenantId!;

      if (!["operacional", "coordenacao", "master"].includes(user.role || "") && !user.isMaster) {
        return res.status(403).json({ message: "Sem permissão para avançar status" });
      }

      const [current] = await db
        .select()
        .from(proposals)
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)))
        .limit(1);

      if (!current) return res.status(404).json({ message: "Proposta não encontrada" });

      const { status, nextStepId, ade, notes, action } = req.body;

      const updateData: any = {};
      if (status) updateData.status = status;
      if (nextStepId) updateData.currentStepId = nextStepId;
      if (ade !== undefined) updateData.ade = ade;
      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(proposals)
        .set(updateData)
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)))
        .returning();

      await db.insert(proposalHistory).values({
        proposalId: id,
        fromStatus: current.status,
        toStatus: status || current.status,
        fromStepId: current.currentStepId,
        toStepId: nextStepId || current.currentStepId,
        action: action || "AVANCO",
        notes: notes || null,
        performedBy: user.id,
      });

      // Carteira de Clientes: when proposal is marked PAGO, add to portfolio
      if (status === "PAGO" && current.clientCpf && (updated.vendorId || current.createdBy)) {
        try {
          const productTypeMap: Record<string, any> = {
            CARTAO: "CARTAO",
            NOVO: "NOVO",
            PORTABILIDADE: "PORTABILIDADE",
            REFINANCIAMENTO: "REFINANCIAMENTO",
          };
          const productType = (updated.product && productTypeMap[updated.product]) || "CONSIGNADO";
          const vendorIdForPortfolio = updated.vendorId || current.createdBy;
          await addToPortfolio(
            tenantId,
            current.clientCpf,
            current.clientName || null,
            vendorIdForPortfolio,
            productType,
            "CONTRATO",
            id,
          );
        } catch (portfolioErr) {
          console.error("[PORTFOLIO] addToPortfolio (contracts) error (non-fatal):", portfolioErr);
        }
      }

      return res.json(updated);
    } catch (e: any) {
      console.error("PUT /api/contracts/proposals/:id/status error:", e);
      return res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  app.post("/api/contracts/proposals/:id/pause", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user!;
      const tenantId = req.tenantId!;

      const [current] = await db
        .select()
        .from(proposals)
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)))
        .limit(1);
      if (!current) return res.status(404).json({ message: "Proposta não encontrada" });

      const { type, notes } = req.body;
      const newStatus = type === "BANCO" ? "PENDENTE_BANCO" : "PENDENTE_CORRETOR";

      const [updated] = await db
        .update(proposals)
        .set({ isPaused: true, pausedAtStepId: current.currentStepId, status: newStatus, updatedAt: new Date() })
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)))
        .returning();

      await db.insert(proposalHistory).values({
        proposalId: id,
        fromStatus: current.status,
        toStatus: newStatus,
        fromStepId: current.currentStepId,
        toStepId: current.currentStepId,
        action: "PENDENCIA",
        notes: notes || null,
        performedBy: user.id,
      });

      return res.json(updated);
    } catch (e: any) {
      console.error("POST /api/contracts/proposals/:id/pause error:", e);
      return res.status(500).json({ message: "Erro ao pendenciar proposta" });
    }
  });

  app.post("/api/contracts/proposals/:id/resume", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user!;
      const tenantId = req.tenantId!;

      const [current] = await db
        .select()
        .from(proposals)
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)))
        .limit(1);
      if (!current) return res.status(404).json({ message: "Proposta não encontrada" });

      const prevStatus = current.pausedAtStepId ? "EM_ANDAMENTO" : "CADASTRADA";

      const [updated] = await db
        .update(proposals)
        .set({ isPaused: false, pausedAtStepId: null, status: prevStatus, updatedAt: new Date() })
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)))
        .returning();

      await db.insert(proposalHistory).values({
        proposalId: id,
        fromStatus: current.status,
        toStatus: prevStatus,
        fromStepId: current.currentStepId,
        toStepId: current.currentStepId,
        action: "RESOLUCAO",
        notes: req.body.notes || "Pendência resolvida",
        performedBy: user.id,
      });

      return res.json(updated);
    } catch (e: any) {
      console.error("POST /api/contracts/proposals/:id/resume error:", e);
      return res.status(500).json({ message: "Erro ao retomar proposta" });
    }
  });

  app.get("/api/contracts/proposals/:id/history", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = req.tenantId!;

      const history = await db
        .select()
        .from(proposalHistory)
        .where(eq(proposalHistory.proposalId, id))
        .orderBy(desc(proposalHistory.createdAt));

      return res.json(history);
    } catch (e: any) {
      console.error("GET /api/contracts/proposals/:id/history error:", e);
      return res.status(500).json({ message: "Erro ao buscar histórico" });
    }
  });

  app.get("/api/contracts/proposals/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);

      const messages = await db
        .select()
        .from(proposalMessages)
        .where(eq(proposalMessages.proposalId, id))
        .orderBy(asc(proposalMessages.createdAt));

      const docs = await db
        .select()
        .from(proposalDocuments)
        .where(eq(proposalDocuments.proposalId, id))
        .orderBy(asc(proposalDocuments.createdAt));

      return res.json({ messages, documents: docs });
    } catch (e: any) {
      console.error("GET /api/contracts/proposals/:id/messages error:", e);
      return res.status(500).json({ message: "Erro ao buscar mensagens" });
    }
  });

  app.post("/api/contracts/proposals/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const user = req.user!;
      const tenantId = req.tenantId!;

      const [proposal] = await db
        .select()
        .from(proposals)
        .where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)))
        .limit(1);
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });

      const { message, documentType, fileUrl, fileName } = req.body;
      if (!message) return res.status(400).json({ message: "Mensagem é obrigatória" });

      const [msg] = await db
        .insert(proposalMessages)
        .values({ proposalId, senderId: user.id, message })
        .returning();

      if (documentType && fileUrl && fileName) {
        await db.insert(proposalDocuments).values({
          proposalId,
          documentType,
          fileUrl,
          fileName,
          uploadedBy: user.id,
          messageId: msg.id,
        });
      }

      return res.status(201).json(msg);
    } catch (e: any) {
      console.error("POST /api/contracts/proposals/:id/messages error:", e);
      return res.status(500).json({ message: "Erro ao enviar mensagem" });
    }
  });

  // ===================== GRUPOS DE COMISSÃO =====================

  app.get("/api/contracts/commission-groups", requireAuth, async (req: any, res) => {
    try {
      const groups = await db
        .select()
        .from(commissionGroups)
        .where(eq(commissionGroups.tenantId, req.tenantId!))
        .orderBy(asc(commissionGroups.name));
      return res.json(groups);
    } catch (e: any) {
      console.error("GET /api/contracts/commission-groups error:", e);
      return res.status(500).json({ message: "Erro ao listar grupos de comissão" });
    }
  });

  app.post("/api/contracts/commission-groups", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const { name, percentage } = req.body;
      if (!name || percentage === undefined) {
        return res.status(400).json({ message: "Nome e percentual são obrigatórios" });
      }
      const [group] = await db
        .insert(commissionGroups)
        .values({ tenantId: req.tenantId!, name, percentage })
        .returning();
      return res.status(201).json(group);
    } catch (e: any) {
      console.error("POST /api/contracts/commission-groups error:", e);
      return res.status(500).json({ message: "Erro ao criar grupo" });
    }
  });

  app.put("/api/contracts/commission-groups/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      const [group] = await db
        .update(commissionGroups)
        .set(req.body)
        .where(and(eq(commissionGroups.id, id), eq(commissionGroups.tenantId, req.tenantId!)))
        .returning();
      if (!group) return res.status(404).json({ message: "Grupo não encontrado" });
      return res.json(group);
    } catch (e: any) {
      console.error("PUT /api/contracts/commission-groups/:id error:", e);
      return res.status(500).json({ message: "Erro ao atualizar grupo" });
    }
  });

  app.delete("/api/contracts/commission-groups/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      await db
        .delete(commissionGroups)
        .where(and(eq(commissionGroups.id, id), eq(commissionGroups.tenantId, req.tenantId!)));
      return res.json({ message: "Grupo removido" });
    } catch (e: any) {
      console.error("DELETE /api/contracts/commission-groups/:id error:", e);
      return res.status(500).json({ message: "Erro ao remover grupo" });
    }
  });
}
