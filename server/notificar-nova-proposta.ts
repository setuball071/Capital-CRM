/**
 * server/notificar-nova-proposta.ts
 *
 * Avisa a responsável pelo andamento das propostas (hoje a Manu, login 3108)
 * sempre que OUTRO usuário cadastra uma proposta. O aviso entra na caixa do
 * Jarvis e o painel dela abre sozinho na tela (ver AssistenteWidget).
 *
 * REGRAS:
 * - Só o ambiente INTERNO (Capital Go). Proposta de cliente white-label
 *   (ConsigOne etc.) não avisa ninguém daqui.
 * - Não avisa quando a própria responsável cadastra.
 * - NUNCA lança: falha aqui não pode derrubar o cadastro da proposta.
 *
 * Configuração opcional (Railway):
 *   NOTIFICAR_PROPOSTA_LOGIN   login de quem recebe o aviso (default "3108")
 */

import { db } from "./storage";
import { and, eq } from "drizzle-orm";
import { assistenteAvisos, users, userTenants, tenants } from "@shared/schema";

const LOGIN_RESPONSAVEL = process.env.NOTIFICAR_PROPOSTA_LOGIN || "3108";

/**
 * Cadastro em lote: UM aviso para o lote inteiro, não um por linha.
 * Dez propostas de uma vez virariam dez popups empilhados.
 */
export async function notificarLoteCadastrado(dados: {
  tenantId: number;
  autorId: number;
  propostas: { id: number; clientName: string | null }[];
}): Promise<void> {
  const { propostas } = dados;
  if (!propostas.length) return;
  if (propostas.length === 1) {
    return notificarPropostaCadastrada({
      tenantId: dados.tenantId,
      autorId: dados.autorId,
      proposalId: propostas[0].id,
      clientName: propostas[0].clientName,
    });
  }
  const nomes = propostas.map((p) => p.clientName?.trim() || "sem nome");
  const lista = nomes.slice(0, 5).join(", ") + (nomes.length > 5 ? ` e mais ${nomes.length - 5}` : "");
  return notificarPropostaCadastrada({
    tenantId: dados.tenantId,
    autorId: dados.autorId,
    proposalId: propostas[0].id,
    clientName: null,
    frase: `cadastrou ${propostas.length} propostas (${lista}). Estão aguardando andamento.`,
  });
}

export async function notificarPropostaCadastrada(dados: {
  tenantId: number;
  autorId: number;
  proposalId: number;
  clientName: string | null;
  /** Sobrescreve o texto após o nome de quem cadastrou — usado pelo resumo de lote */
  frase?: string;
}): Promise<void> {
  try {
    const { tenantId, autorId, proposalId } = dados;
    if (!tenantId || !autorId || !proposalId) return;

    // Só o ambiente interno (Capital Go)
    const [tenant] = await db
      .select({ interno: tenants.interno })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant?.interno) return;

    // A responsável, dentro deste ambiente
    const [resp] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userTenants, eq(userTenants.userId, users.id))
      .where(
        and(
          eq(users.email, LOGIN_RESPONSAVEL),
          eq(users.isActive, true),
          eq(userTenants.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!resp) {
      console.warn(`[nova-proposta] responsável (login ${LOGIN_RESPONSAVEL}) não encontrado no tenant ${tenantId}`);
      return;
    }
    if (resp.id === autorId) return; // ela mesma cadastrou

    const [autor] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, autorId))
      .limit(1);

    const cliente = dados.clientName?.trim() || "cliente sem nome";
    const quem = autor?.name?.trim() || "outro usuário";
    const mensagem = dados.frase
      ? `${quem} ${dados.frase}`
      : `${quem} cadastrou uma proposta para ${cliente}. Ela está aguardando andamento.`;

    await db.insert(assistenteAvisos).values({
      tenantId,
      userId: resp.id,
      tipo: "proposta_cadastrada",
      titulo: "Nova proposta cadastrada 📝",
      mensagem,
      proposalId,
    });
  } catch (err) {
    console.error("[nova-proposta] falha ao notificar (não-fatal):", err);
  }
}
