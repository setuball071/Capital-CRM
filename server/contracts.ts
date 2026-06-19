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
  contractPhases,
  contractStatuses,
  partners,
  producoesContratos,
  users,
} from "../shared/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { addToPortfolio } from "./portfolio";
import multer from "multer";
import fs from "fs";
import path from "path";
import { Client as ObjectStorageClient } from "@replit/object-storage";

const uploadDocMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Replit Object Storage — instanciado sob demanda (evita derrubar o boot se o bucket
// ainda não estiver ativado). Persiste anexos entre deploys (disco do Replit é efêmero).
let _objStore: ObjectStorageClient | null = null;
function getObjectStore(): ObjectStorageClient {
  if (!_objStore) _objStore = new ObjectStorageClient();
  return _objStore;
}

// Content-Type simples por extensão (para servir o anexo com o tipo certo)
function contentTypeFor(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
  };
  return map[ext] || "application/octet-stream";
}

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
          commissionPercentage: proposals.commissionPercentage,
          companyCommissionValue: proposals.companyCommissionValue,
          corretorCommissionPercentage: proposals.corretorCommissionPercentage,
          corretorCommissionValue: proposals.corretorCommissionValue,
          commissionPaidAt: proposals.commissionPaidAt,
          vendorId: proposals.vendorId,
          vendorName: users.name,
          parceiroId: proposals.parceiroId,
          parceiroNome: partners.name,
          clientMeta: proposals.clientMeta,
          flowId: proposals.flowId,
          currentStepId: proposals.currentStepId,
          createdAt: proposals.createdAt,
          updatedAt: proposals.updatedAt,
        })
        .from(proposals)
        .leftJoin(users, eq(proposals.vendorId, users.id))
        .leftJoin(partners, eq(proposals.parceiroId, partners.id))
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
        ade, commissionPercentage, corretorCommissionPercentage,
        clientMeta, parceiroId,
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
          ade: ade || null,
          commissionPercentage: commissionPercentage != null && commissionPercentage !== ""
            ? String(commissionPercentage) : null,
          corretorCommissionPercentage: corretorCommissionPercentage != null && corretorCommissionPercentage !== ""
            ? String(corretorCommissionPercentage) : null,
          clientMeta: clientMeta || null,
          parceiroId: parceiroId ? parseInt(parceiroId) : null,
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
      return res.status(500).json({ message: `Erro ao criar proposta: ${String(e?.message || e)}` });
    }
  });

  // ─── Cadastro em lote (Portabilidade) ───────────────────────────────────────
  app.post("/api/contracts/proposals/batch", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;
      const { proposals: batch } = req.body;

      if (!Array.isArray(batch) || batch.length === 0) {
        return res.status(400).json({ message: "Nenhuma proposta no lote" });
      }

      const created = [];

      for (const item of batch) {
        const {
          clientName, clientCpf, clientMatricula, clientConvenio,
          bank, product, contractValue, installmentValue, term,
          commissionPercentage, corretorCommissionPercentage, clientMeta, parceiroId,
        } = item;

        if (!clientName || !clientCpf) continue;

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

        const vendorId = user.role === "vendedor" ? user.id : (item.vendorId || user.id);

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
            tableId: null,
            contractValue: contractValue || null,
            installmentValue: installmentValue || null,
            term: term ? parseInt(term) : null,
            ade: null,
            commissionPercentage: commissionPercentage != null && commissionPercentage !== ""
              ? String(commissionPercentage) : null,
            corretorCommissionPercentage: corretorCommissionPercentage != null && corretorCommissionPercentage !== ""
              ? String(corretorCommissionPercentage) : null,
            clientMeta: clientMeta || null,
            parceiroId: parceiroId ? parseInt(parceiroId) : null,
            status: "CADASTRADA",
            isPaused: false,
            flowId: matchedFlowId,
            currentStepId: firstStepId,
            vendorId,
            createdBy: user.id,
          })
          .returning();

        await db.insert(proposalHistory).values({
          proposalId: proposal.id,
          toStatus: "CADASTRADA",
          action: "AVANCO",
          notes: "Proposta cadastrada em lote",
          performedBy: user.id,
        });

        created.push(proposal);
      }

      return res.status(201).json(created);
    } catch (e: any) {
      console.error("POST /api/contracts/proposals/batch error:", e);
      return res.status(500).json({ message: `Erro ao criar propostas em lote: ${String(e?.message || e)}` });
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

      const {
        status, nextStepId, ade, notes, action,
        contractValue: contractValueInput,
        commissionPercentage: commissionPctInput,
        companyCommissionValue: companyCommInput,
        corretorCommissionPercentage: corretorPctInput,
        corretorCommissionValue: corretorCommInput,
      } = req.body;

      const updateData: any = {};
      if (status) updateData.status = status;
      if (nextStepId) updateData.currentStepId = nextStepId;
      if (ade !== undefined) updateData.ade = ade;
      updateData.updatedAt = new Date();

      // Ao marcar PAGO: salva dados de comissão e inicializa commissionStatus = PENDENTE
      if (status === "PAGO") {
        if (contractValueInput !== undefined) updateData.contractValue = String(contractValueInput);
        if (commissionPctInput !== undefined) updateData.commissionPercentage = String(commissionPctInput);
        if (companyCommInput !== undefined) updateData.companyCommissionValue = String(companyCommInput);
        if (corretorPctInput !== undefined) updateData.corretorCommissionPercentage = String(corretorPctInput);
        if (corretorCommInput !== undefined) updateData.corretorCommissionValue = String(corretorCommInput);
        updateData.commissionStatus = "PENDENTE"; // aguarda recebimento do banco
      }

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

      // Integração operacional → financeiro: ao marcar PAGO, cria/atualiza o contrato
      // na produção (recebimento/repasse), vinculado por proposalId. Dedupe por ADE.
      if (status === "PAGO") {
        try {
          const ade = (updated.ade || current.ade) || null;
          const contratoIdVal = ade || `PROP-${id}`;
          let vendedorNome: string | null = null;
          if (updated.vendorId) {
            const [v] = await db.select({ name: users.name }).from(users).where(eq(users.id, updated.vendorId)).limit(1);
            vendedorNome = v?.name || null;
          }
          const mesRef = new Date().toISOString().slice(0, 7);
          const dataPag = new Date().toISOString().slice(0, 10);
          const valBruto = updated.contractValue ? String(updated.contractValue) : null;
          const compEmp = updated.companyCommissionValue ? String(updated.companyCommissionValue) : null;
          const compRep = updated.corretorCommissionValue ? String(updated.corretorCommissionValue) : null;
          const percEmp = updated.commissionPercentage ? String(parseFloat(updated.commissionPercentage) * 100) : null;
          const percRep = updated.corretorCommissionPercentage ? String(parseFloat(updated.corretorCommissionPercentage) * 100) : null;

          const payload: any = {
            tenantId, proposalId: id, contratoId: contratoIdVal,
            nomeCliente: current.clientName, cpfCliente: current.clientCpf,
            banco: updated.bank, tipoContrato: updated.product, convenio: current.clientConvenio,
            prazo: updated.term ? String(updated.term) : null,
            vendedorId: updated.vendorId || null, vendedorNome,
            nomeCorretor: vendedorNome,
            valorBase: valBruto, valorBruto: valBruto,
            comissaoEmpresaValor: compEmp, comissaoRepasseValor: compRep,
            comissaoEmpresaPerc: percEmp, comissaoRepassePerc: percRep,
            mesReferencia: mesRef, dataPagamento: dataPag,
          };

          // Dedupe: já existe pelo vínculo (proposalId) ou pelo ADE (vindo do CSV)?
          let [existing] = await db.select({ id: producoesContratos.id }).from(producoesContratos)
            .where(and(eq(producoesContratos.tenantId, tenantId), eq(producoesContratos.proposalId, id))).limit(1);
          if (!existing && ade) {
            [existing] = await db.select({ id: producoesContratos.id }).from(producoesContratos)
              .where(and(eq(producoesContratos.tenantId, tenantId), eq(producoesContratos.contratoId, ade))).limit(1);
          }
          if (existing) {
            await db.update(producoesContratos).set(payload).where(eq(producoesContratos.id, existing.id));
          } else {
            await db.insert(producoesContratos).values(payload);
          }
        } catch (finErr) {
          console.error("[FINANCEIRO auto] erro ao alimentar produção (não bloqueia):", finErr);
        }
      }

      return res.json(updated);
    } catch (e: any) {
      console.error("PUT /api/contracts/proposals/:id/status error:", e);
      return res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  // Edição operacional de campos da proposta (valor, parcela, banco, tabela, prazo, taxa, ADE)
  app.patch("/api/contracts/proposals/:id", requireAuth, async (req: any, res) => {
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

      const isOper = user.isMaster || ["operacional", "coordenacao", "master"].includes(user.role || "");

      // Corretor só edita se o status atual permitir (flag allowsVendorEdit) e for dono da proposta
      let canEdit = isOper;
      if (!canEdit && user.role === "vendedor" && current.vendorId === user.id) {
        const [st] = await db
          .select()
          .from(contractStatuses)
          .where(and(eq(contractStatuses.tenantId, tenantId), eq(contractStatuses.key, current.status)))
          .limit(1);
        canEdit = !!st?.allowsVendorEdit;
      }
      if (!canEdit) return res.status(403).json({ message: "Sem permissão para editar esta proposta" });

      const { bank, contractValue, installmentValue, term, ade, adeRefin, vendorId, parceiroId, clientMetaPatch, notes } = req.body;

      const updateData: any = { updatedAt: new Date() };

      // Parceiro (uso interno) — só operacional/master
      if (parceiroId !== undefined) {
        if (!isOper) return res.status(403).json({ message: "Sem permissão para alterar o parceiro" });
        updateData.parceiroId = parceiroId ? parseInt(parceiroId) : null;
      }
      if (bank !== undefined) updateData.bank = bank || null;
      if (contractValue !== undefined) updateData.contractValue = (contractValue === null || contractValue === "") ? null : String(contractValue);
      if (installmentValue !== undefined) updateData.installmentValue = (installmentValue === null || installmentValue === "") ? null : String(installmentValue);
      if (term !== undefined) updateData.term = (term === null || term === "") ? null : parseInt(term);

      // ADE só operacional/master pode registrar/alterar
      if (ade !== undefined || adeRefin !== undefined) {
        if (!isOper) return res.status(403).json({ message: "Apenas o operacional pode gerenciar o ADE" });
        if (ade !== undefined) updateData.ade = ade || null;
        if (adeRefin !== undefined) updateData.adeRefin = adeRefin || null;
      }

      // Transferir contrato (mudar corretor responsável) — só master/admin/operacional
      if (vendorId !== undefined) {
        if (!user.isMaster && !["master", "operacional"].includes(user.role || "")) {
          return res.status(403).json({ message: "Sem permissão para transferir o contrato" });
        }
        updateData.vendorId = vendorId ? parseInt(vendorId) : null;
      }

      // Merge raso em clientMeta (taxa, tabelaFinanceiroId, tabelaNome, etc.)
      if (clientMetaPatch && typeof clientMetaPatch === "object") {
        updateData.clientMeta = { ...(current.clientMeta as any || {}), ...clientMetaPatch };
      }

      const [updated] = await db
        .update(proposals)
        .set(updateData)
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)))
        .returning();

      await db.insert(proposalHistory).values({
        proposalId: id,
        fromStatus: current.status,
        toStatus: current.status,
        action: "EDICAO",
        notes: notes || "Dados da proposta editados",
        performedBy: user.id,
      });

      return res.json(updated);
    } catch (e: any) {
      console.error("PATCH /api/contracts/proposals/:id error:", e);
      return res.status(500).json({ message: "Erro ao editar proposta" });
    }
  });

  // Usuários para os quais um contrato pode ser transferido (master/admin/operacional)
  app.get("/api/contracts/assignable-users", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      if (!user.isMaster && !["master", "operacional"].includes(user.role || "")) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const result = await db.execute(sql`
        SELECT u.id, u.name, u.role
        FROM users u
        JOIN user_tenants ut ON ut.user_id = u.id
        WHERE ut.tenant_id = ${req.tenantId!} AND u.is_active = true
        ORDER BY u.name ASC
      `);
      return res.json(result.rows);
    } catch (e: any) {
      console.error("GET /api/contracts/assignable-users error:", e);
      return res.status(500).json({ message: "Erro ao listar usuários" });
    }
  });

  // Pendência regularizada — volta a proposta para o status anterior à pendência (corretor ou operacional)
  app.post("/api/contracts/proposals/:id/regularize", requireAuth, async (req: any, res) => {
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

      // Definição do status atual (regra de retorno configurada)
      const [st] = await db
        .select()
        .from(contractStatuses)
        .where(and(eq(contractStatuses.tenantId, tenantId), eq(contractStatuses.key, current.status)))
        .limit(1);

      // Permissão: operacional/master, OU o corretor dono quando o status é uma pendência
      // (tem returnStatusKey definido) ou permite edição.
      const isOper = user.isMaster || ["operacional", "coordenacao", "master"].includes(user.role || "");
      let allowed = isOper;
      if (!allowed && user.role === "vendedor" && current.vendorId === user.id) {
        allowed = !!st?.returnStatusKey || !!st?.allowsVendorEdit;
      }
      if (!allowed) return res.status(403).json({ message: "Sem permissão para regularizar a pendência" });

      // Status de retorno: o configurado no status atual; senão o anterior à pendência (histórico)
      let target: string | null = st?.returnStatusKey || null;
      if (!target) {
        const hist = await db
          .select()
          .from(proposalHistory)
          .where(eq(proposalHistory.proposalId, id))
          .orderBy(desc(proposalHistory.createdAt));
        for (const h of hist) {
          if (h.toStatus === current.status && h.fromStatus && h.fromStatus !== current.status) {
            target = h.fromStatus;
            break;
          }
        }
      }
      if (!target) target = req.body?.fallbackStatus || null;
      if (!target) return res.status(400).json({ message: "Não foi possível identificar a fase de retorno" });

      const [updated] = await db
        .update(proposals)
        .set({ status: target, updatedAt: new Date() })
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)))
        .returning();

      await db.insert(proposalHistory).values({
        proposalId: id,
        fromStatus: current.status,
        toStatus: target,
        action: "RESOLUCAO",
        notes: req.body?.notes || "Pendência regularizada",
        performedBy: user.id,
      });

      return res.json(updated);
    } catch (e: any) {
      console.error("POST /api/contracts/proposals/:id/regularize error:", e);
      return res.status(500).json({ message: "Erro ao regularizar pendência" });
    }
  });

  // Excluir proposta — SOMENTE master (super-admin)
  app.delete("/api/contracts/proposals/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster) return res.status(403).json({ message: "Apenas o master pode excluir propostas" });
    try {
      const id = parseInt(req.params.id);
      const tenantId = req.tenantId!;

      const [current] = await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)))
        .limit(1);
      if (!current) return res.status(404).json({ message: "Proposta não encontrada" });

      // Remove débitos financeiros vinculados (sem cascade) para não travar a exclusão
      await db.delete(financialDebits).where(eq(financialDebits.proposalId, id));
      // Histórico, mensagens e documentos saem por ON DELETE CASCADE
      await db.delete(proposals).where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)));

      return res.status(204).send();
    } catch (e: any) {
      console.error("DELETE /api/contracts/proposals/:id error:", e);
      return res.status(500).json({ message: `Erro ao excluir proposta: ${String(e?.message || e)}` });
    }
  });

  // Alteração de status em lote
  app.post("/api/contracts/proposals/bulk-status", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;

      if (!["operacional", "coordenacao", "master"].includes(user.role || "") && !user.isMaster) {
        return res.status(403).json({ message: "Sem permissão para alteração em lote" });
      }

      const { ids, status, notes } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "Nenhuma proposta selecionada" });
      if (!status) return res.status(400).json({ message: "Status é obrigatório" });

      const numericIds = ids.map((n: any) => parseInt(n)).filter((n: number) => !isNaN(n));

      const rows = await db
        .select()
        .from(proposals)
        .where(and(inArray(proposals.id, numericIds), eq(proposals.tenantId, tenantId)));

      if (rows.length === 0) return res.status(404).json({ message: "Nenhuma proposta encontrada" });

      const okIds = rows.map((r) => r.id);
      await db
        .update(proposals)
        .set({ status, updatedAt: new Date() })
        .where(and(inArray(proposals.id, okIds), eq(proposals.tenantId, tenantId)));

      for (const r of rows) {
        await db.insert(proposalHistory).values({
          proposalId: r.id,
          fromStatus: r.status,
          toStatus: status,
          action: ["CANCELADA", "PERDIDA"].includes(status) ? "CANCELAMENTO" : status === "PAGO" ? "PAGAMENTO" : "AVANCO",
          notes: notes || "Alteração em lote",
          performedBy: user.id,
        });
      }

      return res.json({ updated: rows.length });
    } catch (e: any) {
      console.error("POST /api/contracts/proposals/bulk-status error:", e);
      return res.status(500).json({ message: "Erro na alteração em lote" });
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
        .select({
          id: proposalHistory.id,
          proposalId: proposalHistory.proposalId,
          fromStatus: proposalHistory.fromStatus,
          toStatus: proposalHistory.toStatus,
          action: proposalHistory.action,
          notes: proposalHistory.notes,
          performedBy: proposalHistory.performedBy,
          userName: users.name,
          createdAt: proposalHistory.createdAt,
        })
        .from(proposalHistory)
        .leftJoin(users, eq(proposalHistory.performedBy, users.id))
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

  // ===================== UPLOAD DE DOCUMENTOS =====================

  app.post(
    "/api/contracts/proposals/:id/documents",
    requireAuth,
    uploadDocMemory.single("file"),
    async (req: any, res) => {
      try {
        const proposalId = parseInt(req.params.id);
        const tenantId   = req.tenantId!;
        const user       = req.user!;

        if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });

        const documentType: string = req.body.documentType || "OUTRO";

        const [proposal] = await db
          .select({ id: proposals.id })
          .from(proposals)
          .where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)))
          .limit(1);
        if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });

        // Grava no Replit Object Storage (persistente entre deploys)
        const ext = path.extname(req.file.originalname);
        const storageKey = `proposals/${proposalId}/${documentType}-${Date.now()}${ext}`;
        try {
          const result: any = await getObjectStore().uploadFromBytes(storageKey, req.file.buffer);
          if (result && result.ok === false) throw new Error(result.error?.message || "upload falhou");
        } catch (storErr: any) {
          console.error("[Object Storage] upload error:", storErr);
          return res.status(500).json({
            message: "Falha ao salvar no Object Storage. Verifique se o Object Storage está ativado no Repl.",
          });
        }

        const [doc] = await db
          .insert(proposalDocuments)
          .values({
            proposalId,
            documentType,
            fileUrl: storageKey,        // referência (a leitura é via /documents/:id/file)
            storageKey,
            fileName: req.file.originalname,
            uploadedBy: user.id,
          })
          .returning();

        return res.status(201).json(doc);
      } catch (e: any) {
        console.error("POST /api/contracts/proposals/:id/documents error:", e);
        return res.status(500).json({ message: `Erro ao fazer upload: ${e.message}` });
      }
    },
  );

  // Servir/baixar um documento (lê do Object Storage) — autenticado e por tenant
  app.get("/api/contracts/documents/:docId/file", requireAuth, async (req: any, res) => {
    try {
      const docId = parseInt(req.params.docId);
      const tenantId = req.tenantId!;

      // Garante que o documento pertence a uma proposta do tenant
      const [doc] = await db
        .select({
          id: proposalDocuments.id,
          fileName: proposalDocuments.fileName,
          storageKey: proposalDocuments.storageKey,
          fileUrl: proposalDocuments.fileUrl,
        })
        .from(proposalDocuments)
        .innerJoin(proposals, eq(proposalDocuments.proposalId, proposals.id))
        .where(and(eq(proposalDocuments.id, docId), eq(proposals.tenantId, tenantId)))
        .limit(1);

      if (!doc) return res.status(404).json({ message: "Documento não encontrado" });
      if (!doc.storageKey) {
        return res.status(410).json({ message: "Arquivo legado indisponível (enviado antes do armazenamento permanente). Reenvie o documento." });
      }

      const result: any = await getObjectStore().downloadAsBytes(doc.storageKey);
      if (!result || result.ok === false) {
        return res.status(404).json({ message: "Arquivo não encontrado no armazenamento" });
      }
      const buffer: Buffer = Array.isArray(result.value) ? result.value[0] : result.value;

      res.setHeader("Content-Type", contentTypeFor(doc.fileName));
      const disposition = req.query.download ? "attachment" : "inline";
      res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(doc.fileName)}"`);
      return res.send(buffer);
    } catch (e: any) {
      console.error("GET /api/contracts/documents/:docId/file error:", e);
      return res.status(500).json({ message: "Erro ao carregar documento" });
    }
  });

  // ===================== BUSCA POR CPF (memória de cadastro) =====================

  /**
   * GET /api/contracts/client-lookup/:cpf
   *
   * Retorna dados do cliente mais recente com este CPF no tenant.
   * Usado pelo wizard de Nova Proposta para pré-preencher o formulário
   * quando o mesmo cliente já foi cadastrado antes.
   */
  app.get("/api/contracts/client-lookup/:cpf", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const rawCpf = req.params.cpf.replace(/\D/g, "");

      if (rawCpf.length !== 11) {
        return res.status(400).json({ message: "CPF inválido" });
      }

      // Busca todas as propostas deste CPF neste tenant (CPF pode estar formatado ou não)
      const rows = await db
        .select({
          id: proposals.id,
          clientName: proposals.clientName,
          clientCpf: proposals.clientCpf,
          clientMatricula: proposals.clientMatricula,
          clientMeta: proposals.clientMeta,
          clientConvenio: proposals.clientConvenio,
          status: proposals.status,
          createdAt: proposals.createdAt,
        })
        .from(proposals)
        .where(
          and(
            eq(proposals.tenantId, tenantId),
            sql`regexp_replace(${proposals.clientCpf}, '[^0-9]', '', 'g') = ${rawCpf}`
          )
        )
        .orderBy(desc(proposals.createdAt))
        .limit(50);

      if (!rows.length) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      const latest = rows[0];

      return res.json({
        clientName: latest.clientName,
        clientCpf: latest.clientCpf,
        clientMatricula: latest.clientMatricula,
        clientMeta: latest.clientMeta,
        clientConvenio: latest.clientConvenio,
        proposalCount: rows.length,
        lastProposalId: latest.id,
        lastStatus: latest.status,
      });
    } catch (e: any) {
      console.error("GET /api/contracts/client-lookup/:cpf error:", e);
      return res.status(500).json({ message: "Erro ao buscar cliente" });
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

  // ===================== STATUS DE CONTRATOS =====================

  const DEFAULT_STATUSES = [
    { key: "CADASTRADA",        label: "Cadastrada",     color: "zinc",   ordem: 0 },
    { key: "EM_ANALISE",        label: "Em Análise",     color: "blue",   ordem: 1 },
    { key: "DIGITADA",          label: "Digitada",       color: "violet", ordem: 2 },
    { key: "EM_ANDAMENTO",      label: "Em Andamento",   color: "orange", ordem: 3 },
    { key: "PENDENTE_CORRETOR", label: "Pend. Corretor", color: "red",    ordem: 4 },
    { key: "PENDENTE_BANCO",    label: "Pend. Banco",    color: "yellow", ordem: 5 },
    { key: "PAGO",              label: "Pago",           color: "green",  ordem: 6, isFinal: true },
    { key: "CANCELADA",         label: "Cancelada",      color: "red",    ordem: 7, isFinal: true },
    { key: "PERDIDA",           label: "Perdida",        color: "rose",   ordem: 8, isFinal: true },
  ];

  app.get("/api/contracts/statuses", requireAuth, async (req: any, res) => {
    try {
      let list = await db
        .select()
        .from(contractStatuses)
        .where(eq(contractStatuses.tenantId, req.tenantId!))
        .orderBy(asc(contractStatuses.ordem), asc(contractStatuses.id));

      if (list.length === 0) {
        const rows = DEFAULT_STATUSES.map((s) => ({
          tenantId: req.tenantId!,
          ...s,
          isDefault: true,
        }));
        list = await db.insert(contractStatuses).values(rows).returning();
      }

      return res.json(list);
    } catch (e: any) {
      console.error("GET /api/contracts/statuses error:", e);
      return res.status(500).json({ message: "Erro ao listar status" });
    }
  });

  app.post("/api/contracts/statuses", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster && !["master", "operacional"].includes(req.user?.role)) return res.status(403).json({ message: "Acesso negado" });
    try {
      const { key, label, color = "zinc", ordem = 99, allowsVendorEdit = false, isFinal = false, returnStatusKey = null } = req.body;
      if (!key || !label) return res.status(400).json({ message: "key e label são obrigatórios" });
      const [row] = await db
        .insert(contractStatuses)
        .values({ tenantId: req.tenantId!, key, label, color, ordem, isDefault: false, allowsVendorEdit, isFinal, returnStatusKey: returnStatusKey || null })
        .returning();
      return res.status(201).json(row);
    } catch (e: any) {
      if (e.code === "23505") return res.status(409).json({ message: "Já existe um status com este código" });
      console.error("POST /api/contracts/statuses error:", e);
      return res.status(500).json({ message: "Erro ao criar status" });
    }
  });

  app.patch("/api/contracts/statuses/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster && !["master", "operacional"].includes(req.user?.role)) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      const { label, color, allowsVendorEdit, isFinal, returnStatusKey } = req.body;
      const updates: any = {};
      if (label !== undefined) updates.label = label;
      if (color !== undefined) updates.color = color;
      if (allowsVendorEdit !== undefined) updates.allowsVendorEdit = allowsVendorEdit;
      if (isFinal !== undefined) updates.isFinal = isFinal;
      if (returnStatusKey !== undefined) updates.returnStatusKey = returnStatusKey || null;
      const [row] = await db
        .update(contractStatuses)
        .set(updates)
        .where(and(eq(contractStatuses.id, id), eq(contractStatuses.tenantId, req.tenantId!)))
        .returning();
      if (!row) return res.status(404).json({ message: "Status não encontrado" });
      return res.json(row);
    } catch (e: any) {
      console.error("PATCH /api/contracts/statuses/:id error:", e);
      return res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  app.delete("/api/contracts/statuses/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster && !["master", "operacional"].includes(req.user?.role)) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db
        .select()
        .from(contractStatuses)
        .where(and(eq(contractStatuses.id, id), eq(contractStatuses.tenantId, req.tenantId!)));
      if (!existing) return res.status(404).json({ message: "Status não encontrado" });
      if (existing.isDefault) return res.status(400).json({ message: "Status padrão não pode ser excluído" });
      await db
        .delete(contractStatuses)
        .where(and(eq(contractStatuses.id, id), eq(contractStatuses.tenantId, req.tenantId!)));
      return res.status(204).send();
    } catch (e: any) {
      console.error("DELETE /api/contracts/statuses/:id error:", e);
      return res.status(500).json({ message: "Erro ao excluir status" });
    }
  });

  // ===================== FASES DE CONTRATOS =====================

  app.get("/api/contracts/phases", requireAuth, async (req: any, res) => {
    try {
      const phases = await db
        .select()
        .from(contractPhases)
        .where(eq(contractPhases.tenantId, req.tenantId!))
        .orderBy(asc(contractPhases.ordem), asc(contractPhases.id));
      return res.json(phases);
    } catch (e: any) {
      console.error("GET /api/contracts/phases error:", e);
      return res.status(500).json({ message: "Erro ao listar fases" });
    }
  });

  app.post("/api/contracts/phases", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster && !["master", "operacional"].includes(req.user?.role)) return res.status(403).json({ message: "Acesso negado" });
    try {
      const { name, color = "blue", statuses = [], ordem = 0 } = req.body;
      if (!name) return res.status(400).json({ message: "Nome é obrigatório" });
      const [phase] = await db
        .insert(contractPhases)
        .values({ tenantId: req.tenantId!, name, color, statuses, ordem })
        .returning();
      return res.status(201).json(phase);
    } catch (e: any) {
      console.error("POST /api/contracts/phases error:", e);
      return res.status(500).json({ message: "Erro ao criar fase" });
    }
  });

  app.patch("/api/contracts/phases/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster && !["master", "operacional"].includes(req.user?.role)) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      const { name, color, statuses, ordem } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      if (statuses !== undefined) updates.statuses = statuses;
      if (ordem !== undefined) updates.ordem = ordem;
      const [phase] = await db
        .update(contractPhases)
        .set(updates)
        .where(and(eq(contractPhases.id, id), eq(contractPhases.tenantId, req.tenantId!)))
        .returning();
      if (!phase) return res.status(404).json({ message: "Fase não encontrada" });
      return res.json(phase);
    } catch (e: any) {
      console.error("PATCH /api/contracts/phases/:id error:", e);
      return res.status(500).json({ message: "Erro ao atualizar fase" });
    }
  });

  app.delete("/api/contracts/phases/:id", requireAuth, async (req: any, res) => {
    if (!req.user?.isMaster && !["master", "operacional"].includes(req.user?.role)) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      await db
        .delete(contractPhases)
        .where(and(eq(contractPhases.id, id), eq(contractPhases.tenantId, req.tenantId!)));
      return res.status(204).send();
    } catch (e: any) {
      console.error("DELETE /api/contracts/phases/:id error:", e);
      return res.status(500).json({ message: "Erro ao excluir fase" });
    }
  });

  // ===================== PARCEIROS (uso interno) =====================

  const isOperOrMaster = (u: any) => u?.isMaster || ["master", "operacional"].includes(u?.role || "");

  app.get("/api/contracts/partners", requireAuth, async (req: any, res) => {
    try {
      const list = await db
        .select()
        .from(partners)
        .where(eq(partners.tenantId, req.tenantId!))
        .orderBy(asc(partners.name));
      return res.json(list);
    } catch (e: any) {
      console.error("GET /api/contracts/partners error:", e);
      return res.status(500).json({ message: "Erro ao listar parceiros" });
    }
  });

  app.post("/api/contracts/partners", requireAuth, async (req: any, res) => {
    if (!isOperOrMaster(req.user)) return res.status(403).json({ message: "Acesso negado" });
    try {
      const { name } = req.body;
      if (!name || !String(name).trim()) return res.status(400).json({ message: "Nome é obrigatório" });
      const [row] = await db
        .insert(partners)
        .values({ tenantId: req.tenantId!, name: String(name).trim(), isActive: true })
        .returning();
      return res.status(201).json(row);
    } catch (e: any) {
      console.error("POST /api/contracts/partners error:", e);
      return res.status(500).json({ message: "Erro ao criar parceiro" });
    }
  });

  app.patch("/api/contracts/partners/:id", requireAuth, async (req: any, res) => {
    if (!isOperOrMaster(req.user)) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      const { name, isActive } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = String(name).trim();
      if (isActive !== undefined) updates.isActive = isActive;
      const [row] = await db
        .update(partners)
        .set(updates)
        .where(and(eq(partners.id, id), eq(partners.tenantId, req.tenantId!)))
        .returning();
      if (!row) return res.status(404).json({ message: "Parceiro não encontrado" });
      return res.json(row);
    } catch (e: any) {
      console.error("PATCH /api/contracts/partners/:id error:", e);
      return res.status(500).json({ message: "Erro ao atualizar parceiro" });
    }
  });

  app.delete("/api/contracts/partners/:id", requireAuth, async (req: any, res) => {
    if (!isOperOrMaster(req.user)) return res.status(403).json({ message: "Acesso negado" });
    try {
      const id = parseInt(req.params.id);
      await db.delete(partners).where(and(eq(partners.id, id), eq(partners.tenantId, req.tenantId!)));
      return res.status(204).send();
    } catch (e: any) {
      console.error("DELETE /api/contracts/partners/:id error:", e);
      return res.status(500).json({ message: "Erro ao excluir parceiro" });
    }
  });

  // Contagem de pendências do corretor (para o badge da sidebar)
  app.get("/api/contracts/pending-count", requireAuth, async (req: any, res) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId!;
      // "Pendência do corretor" = status com returnStatusKey definido
      const allStatuses = await db
        .select()
        .from(contractStatuses)
        .where(eq(contractStatuses.tenantId, tenantId));
      const keys = allStatuses.filter((s: any) => !!s.returnStatusKey).map((s: any) => s.key);
      if (keys.length === 0) return res.json({ count: 0 });

      // Badge é pessoal: conta as propostas do próprio usuário (corretor) nesses status
      const rows = await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(and(
          eq(proposals.tenantId, tenantId),
          eq(proposals.vendorId, user.id),
          inArray(proposals.status, keys),
        ));
      return res.json({ count: rows.length });
    } catch (e: any) {
      console.error("GET /api/contracts/pending-count error:", e);
      return res.json({ count: 0 });
    }
  });
}
