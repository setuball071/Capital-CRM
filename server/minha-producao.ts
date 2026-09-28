/**
 * server/minha-producao.ts
 *
 * Controle individual de produção e comissões — benefício do plano de vendedor
 * individual / venda própria.
 *
 * SEPARADO DO FINANCEIRO OFICIAL, de propósito: estas rotas leem e gravam APENAS
 * `vendedor_contratos`. Nunca tocam producoes_contratos, comissões, propostas nem
 * qualquer dado da operação interna. Liberar este módulo não pode virar porta dos
 * fundos para o financeiro da versão completa.
 *
 * Isolamento: cada usuário enxerga e altera somente os PRÓPRIOS registros, dentro
 * do próprio ambiente. Nem o master de outro tenant alcança.
 */

import type { Express, RequestHandler } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "./storage";
import { vendedorContratos } from "@shared/schema";

const MODULO = "modulo_minha_producao";

/** Registro ativo = conta como venda. Cancelada/estornada fica no histórico, fora dos totais. */
const STATUS_VALIDOS = new Set(["vendida", "cancelada", "estornada"]);

const num = (v: any): number => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** "2026-09" → primeiro e último instante do mês. Sem mês, devolve null (traz tudo). */
function intervaloDoMes(mes?: string): { ini: Date; fim: Date } | null {
  const m = String(mes || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const ano = Number(m[1]), mm = Number(m[2]);
  return { ini: new Date(ano, mm - 1, 1, 0, 0, 0), fim: new Date(ano, mm, 0, 23, 59, 59) };
}

/** Campos que o vendedor pode gravar. Nada de tenant/vendedor vindo do corpo. */
function corpoValido(body: any): { erro?: string; dados?: any } {
  const clienteNome = String(body?.clienteNome || "").trim();
  if (!clienteNome) return { erro: "Informe o nome do cliente" };
  const valorContrato = num(body?.valorContrato);
  if (valorContrato <= 0) return { erro: "Informe o valor do contrato" };

  const status = String(body?.status || "vendida");
  if (!STATUS_VALIDOS.has(status)) return { erro: "Status inválido" };

  const dataContrato = body?.dataContrato ? new Date(String(body.dataContrato)) : new Date();
  if (isNaN(dataContrato.getTime())) return { erro: "Data do contrato inválida" };

  return {
    dados: {
      clienteNome,
      clienteCpf: String(body?.clienteCpf || "").replace(/\D/g, "") || null,
      banco: String(body?.banco || "").trim() || null,
      convenio: String(body?.convenio || "").trim() || null,
      tipoOperacao: String(body?.tipoOperacao || "").trim() || null,
      prazo: body?.prazo ? parseInt(String(body.prazo), 10) || null : null,
      valorContrato: String(valorContrato),
      valorParcela: body?.valorParcela ? String(num(body.valorParcela)) : null,
      valorTroco: body?.valorTroco ? String(num(body.valorTroco)) : null,
      // Comissão é DIGITADA pelo vendedor (decisão do Fábio): o sistema não calcula
      comissaoPrevista: body?.comissaoPrevista ? String(num(body.comissaoPrevista)) : null,
      comissaoRecebida: body?.comissaoRecebida ? String(num(body.comissaoRecebida)) : null,
      dataPrevistaPagamento: String(body?.dataPrevistaPagamento || "").trim() || null,
      dataRecebimento: String(body?.dataRecebimento || "").trim() || null,
      dataContrato,
      status,
      observacoes: String(body?.observacoes || "").trim() || null,
    },
  };
}

/** Totais do período. Cancelada e estornada NÃO entram em venda nem em comissão. */
function resumir(registros: any[]) {
  const hoje = new Date().toISOString().slice(0, 10);
  let vendas = 0, valorVendido = 0, prevista = 0, recebida = 0, atrasada = 0;
  let canceladas = 0, valorCancelado = 0;

  for (const r of registros) {
    if (r.status === "cancelada" || r.status === "estornada") {
      canceladas++;
      valorCancelado += num(r.valorContrato);
      continue;
    }
    vendas++;
    valorVendido += num(r.valorContrato);
    const p = num(r.comissaoPrevista);
    const rec = num(r.comissaoRecebida);
    prevista += p;
    recebida += rec;
    // Atrasado: venceu a data prevista e ainda falta receber
    const falta = p - rec;
    if (falta > 0 && r.dataPrevistaPagamento && String(r.dataPrevistaPagamento) < hoje) atrasada += falta;
  }

  return {
    vendas,
    valorVendido,
    comissaoPrevista: prevista,
    comissaoRecebida: recebida,
    comissaoAReceber: Math.max(0, prevista - recebida),
    comissaoAtrasada: atrasada,
    canceladas,
    valorCancelado,
  };
}

export function registerMinhaProducaoRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireModuleAccess: (module: string, accessType?: "view" | "edit") => RequestHandler,
) {
  /** Só os registros do próprio usuário, no próprio ambiente. */
  const doUsuario = (req: any) =>
    and(
      eq(vendedorContratos.tenantId, req.tenantId!),
      eq(vendedorContratos.vendedorId, req.user!.id),
    );

  // Lista + resumo do período
  app.get("/api/minha-producao", requireAuth, requireModuleAccess(MODULO), async (req: any, res) => {
    try {
      const periodo = intervaloDoMes(req.query.mes as string | undefined);
      const filtros = [doUsuario(req)];
      if (periodo) {
        filtros.push(gte(vendedorContratos.dataContrato, periodo.ini));
        filtros.push(lte(vendedorContratos.dataContrato, periodo.fim));
      }
      const registros = await db
        .select()
        .from(vendedorContratos)
        .where(and(...filtros))
        .orderBy(desc(vendedorContratos.dataContrato), desc(vendedorContratos.id));

      return res.json({ registros, resumo: resumir(registros) });
    } catch (e) {
      console.error("[minha-producao] listar:", e);
      return res.status(500).json({ message: "Erro ao carregar seus registros" });
    }
  });

  // Novo registro: entrou aqui, já é venda (status padrão "vendida")
  app.post("/api/minha-producao", requireAuth, requireModuleAccess(MODULO, "edit"), async (req: any, res) => {
    try {
      const { erro, dados } = corpoValido(req.body);
      if (erro) return res.status(400).json({ message: erro });

      const [novo] = await db
        .insert(vendedorContratos)
        .values({ ...dados, tenantId: req.tenantId!, vendedorId: req.user!.id })
        .returning();
      return res.status(201).json(novo);
    } catch (e) {
      console.error("[minha-producao] criar:", e);
      return res.status(500).json({ message: "Erro ao salvar o registro" });
    }
  });

  app.patch("/api/minha-producao/:id", requireAuth, requireModuleAccess(MODULO, "edit"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Registro inválido" });
      const { erro, dados } = corpoValido(req.body);
      if (erro) return res.status(400).json({ message: erro });

      const [salvo] = await db
        .update(vendedorContratos)
        .set({ ...dados, updatedAt: new Date() })
        .where(and(eq(vendedorContratos.id, id), doUsuario(req)))
        .returning();
      if (!salvo) return res.status(404).json({ message: "Registro não encontrado" });
      return res.json(salvo);
    } catch (e) {
      console.error("[minha-producao] editar:", e);
      return res.status(500).json({ message: "Erro ao salvar o registro" });
    }
  });

  app.delete("/api/minha-producao/:id", requireAuth, requireModuleAccess(MODULO, "edit"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Registro inválido" });
      const [apagado] = await db
        .delete(vendedorContratos)
        .where(and(eq(vendedorContratos.id, id), doUsuario(req)))
        .returning({ id: vendedorContratos.id });
      if (!apagado) return res.status(404).json({ message: "Registro não encontrado" });
      return res.json({ ok: true });
    } catch (e) {
      console.error("[minha-producao] excluir:", e);
      return res.status(500).json({ message: "Erro ao excluir o registro" });
    }
  });
}
