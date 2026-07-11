/**
 * email-service.ts — Serviço de email transacional do Capital Go CRM
 *
 * Usado para:
 * - Alertas de segurança (conta bloqueada, scraping detectado)
 * - Notificações de login suspeito
 *
 * Configuração via variáveis de ambiente:
 *   SMTP_HOST     → Ex: smtp.gmail.com
 *   SMTP_PORT     → Ex: 587
 *   SMTP_USER     → Email remetente
 *   SMTP_PASS     → Senha ou App Password
 *   ALERT_EMAIL   → Email que recebe os alertas (seu email de admin)
 */

import nodemailer from "nodemailer";

const isConfigured =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const alertEmail = process.env.ALERT_EMAIL || process.env.SMTP_USER || "";

async function sendEmail(subject: string, html: string): Promise<void> {
  if (!transporter || !alertEmail) {
    // Email não configurado — só loga no console
    console.warn(`[EMAIL-ALERT] ${subject} (email não configurado)`);
    return;
  }

  try {
    await transporter.sendMail({
      // TODO(fase6): estes alertas são internos (vão só para ALERT_EMAIL do dono
      // do SaaS) e são disparados fora do contexto de requisição/tenant, então não
      // há tenant "atual" para usar aqui. Se um dia houver e-mail transacional
      // para usuários finais, o remetente deve usar o nome do tenant.
      from: `"Capital Go Security" <${process.env.SMTP_USER}>`,
      to: alertEmail,
      subject,
      html,
    });
  } catch (err) {
    console.error("[EMAIL-ALERT] Erro ao enviar email:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTAS DE SEGURANÇA
// ─────────────────────────────────────────────────────────────────────────────

export async function sendAccountLockedAlert(
  email: string,
  ip: string,
  attempts: number
): Promise<void> {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await sendEmail(
    `🔒 Conta bloqueada por tentativas — ${email}`,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ Conta Bloqueada</h2>
      </div>
      <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 20px;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>IP:</strong> ${ip}</p>
        <p><strong>Tentativas:</strong> ${attempts} falhas consecutivas</p>
        <p><strong>Quando:</strong> ${now}</p>
        <p><strong>Ação:</strong> Conta bloqueada por 30 minutos automaticamente.</p>
        <hr style="border-color: #fca5a5; margin: 16px 0;">
        <p style="font-size: 12px; color: #666;">
          Se foi você tentando logar, aguarde 30 minutos ou redefina sua senha.<br>
          Se não foi você, sua conta pode estar sendo atacada.
        </p>
      </div>
    </div>
    `
  );
}

export async function sendSuspiciousLoginAlert(
  email: string,
  ip: string,
  userAgent: string
): Promise<void> {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await sendEmail(
    `🚨 Tentativa de login suspeita — ${email}`,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #d97706; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ Login Suspeito Detectado</h2>
      </div>
      <div style="background: #fffbeb; border: 1px solid #fcd34d; padding: 20px;">
        <p><strong>Conta:</strong> ${email}</p>
        <p><strong>IP:</strong> ${ip}</p>
        <p><strong>Agente:</strong> ${userAgent || "Desconhecido"}</p>
        <p><strong>Quando:</strong> ${now}</p>
        <p><strong>Motivo:</strong> 3+ tentativas de senha incorreta.</p>
      </div>
    </div>
    `
  );
}

export async function sendScrapingDetectedAlert(
  userId: number,
  userName: string,
  queryCount: number,
  ip: string
): Promise<void> {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await sendEmail(
    `🤖 Comportamento de scraping detectado — usuário ${userId}`,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">🤖 Scraping Detectado</h2>
      </div>
      <div style="background: #f5f3ff; border: 1px solid #c4b5fd; padding: 20px;">
        <p><strong>Usuário ID:</strong> ${userId}</p>
        <p><strong>Nome:</strong> ${userName}</p>
        <p><strong>Consultas em 1 min:</strong> ${queryCount}</p>
        <p><strong>IP:</strong> ${ip}</p>
        <p><strong>Quando:</strong> ${now}</p>
        <p><strong>Ação:</strong> Usuário bloqueado por 5 minutos automaticamente.</p>
      </div>
    </div>
    `
  );
}
