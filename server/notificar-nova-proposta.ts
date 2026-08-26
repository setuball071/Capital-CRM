/**
 * server/notificar-nova-proposta.ts
 *
 * Avisa a responsável pelo andamento das propostas (hoje a Manu, login 3108)
 * sempre que OUTRO usuário cadastra uma proposta. Dois canais:
 *   1) aviso do Jarvis  → vira popup no sistema (sempre funciona)
 *   2) WhatsApp         → via edge function do WhatsApp CRM (best-effort)
 *
 * REGRAS:
 * - Só o ambiente INTERNO (Capital Go). Proposta de cliente white-label
 *   (ConsigOne etc.) não avisa ninguém daqui.
 * - Não avisa quando a própria responsável cadastra.
 * - NUNCA lança: falha aqui não pode derrubar o cadastro da proposta.
 *
 * Configuração (Railway) — sem elas o WhatsApp é pulado e só o popup sai:
 *   NOTIFICAR_PROPOSTA_LOGIN     login da responsável            (default "3108")
 *   NOTIFICAR_PROPOSTA_WHATS     número com DDD, só dígitos      (default "48991496349")
 *   WHATS_CRM_URL                https://<ref>.supabase.co
 *   WHATS_CRM_KEY                service role key do WhatsApp CRM
 *   WHATS_CRM_INSTANCE_ID        uuid da instância oficial em whatsapp_instances
 *   WHATS_CRM_TEMPLATE           nome do template aprovado (ver nota abaixo)
 *
 * NOTA DAS 24h: a Cloud API só aceita texto livre se a pessoa escreveu para o
 * número nas últimas 24h. Fora disso exige template aprovado (erro 131047).
 * Como esse aviso é iniciado pela empresa, o normal é precisar de template —
 * defina WHATS_CRM_TEMPLATE. Sem ele tentamos texto puro (funciona só na janela).
 */

import { db } from "./storage";
import { and, eq } from "drizzle-orm";
import { assistenteAvisos, users, userTenants, tenants } from "@shared/schema";

const LOGIN_RESPONSAVEL = process.env.NOTIFICAR_PROPOSTA_LOGIN || "3108";
const WHATS_RESPONSAVEL = (process.env.NOTIFICAR_PROPOSTA_WHATS || "48991496349").replace(/\D/g, "");

/** Manda o WhatsApp pela edge function do WhatsApp CRM. Best-effort. */
async function enviarWhatsApp(texto: string, cliente: string, autor: string): Promise<void> {
  const url = process.env.WHATS_CRM_URL;
  const key = process.env.WHATS_CRM_KEY;
  const instanceId = process.env.WHATS_CRM_INSTANCE_ID;
  const template = process.env.WHATS_CRM_TEMPLATE;

  if (!url || !key || !instanceId) {
    console.log("[nova-proposta] WhatsApp não configurado (WHATS_CRM_*) — só o popup foi criado.");
    return;
  }

  const corpo: Record<string, unknown> = {
    instance_id: instanceId,
    phone_number: WHATS_RESPONSAVEL,
  };
  if (template) {
    // Template com 2 variáveis, na ordem: {{1}} cliente, {{2}} quem cadastrou
    corpo.template_config = {
      name: template,
      language: "pt_BR",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: cliente },
            { type: "text", text: autor },
          ],
        },
      ],
    };
  } else {
    corpo.content = texto;
    corpo.message_type = "text";
  }

  const resp = await fetch(`${url.replace(/\/$/, "")}/functions/v1/send-meta-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify(corpo),
  });
  const dados: any = await resp.json().catch(() => ({}));
  if (!resp.ok || dados?.success === false) {
    console.error("[nova-proposta] WhatsApp não enviado:", dados?.error || `HTTP ${resp.status}`);
  }
}

/**
 * Cadastro em lote: UMA notificação para o lote inteiro, não uma por linha.
 * Dez propostas de uma vez virariam dez mensagens simultâneas no WhatsApp —
 * exatamente o padrão de disparo que já custou uma restrição na conta Meta.
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

    // 1) Popup no sistema — este é o canal garantido
    await db.insert(assistenteAvisos).values({
      tenantId,
      userId: resp.id,
      tipo: "proposta_cadastrada",
      titulo: "Nova proposta cadastrada 📝",
      mensagem,
      proposalId,
    });

    // 2) WhatsApp — best-effort, nunca derruba o cadastro
    await enviarWhatsApp(`*Nova proposta cadastrada*\n\n${mensagem}`, cliente, quem).catch((e) =>
      console.error("[nova-proposta] WhatsApp falhou:", e),
    );
  } catch (err) {
    console.error("[nova-proposta] falha ao notificar (não-fatal):", err);
  }
}
