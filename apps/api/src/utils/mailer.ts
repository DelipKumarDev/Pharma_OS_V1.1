import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from './logger';

let transporter: Transporter | null = null;
let configured = false;

function getTransporter(): Transporter | null {
  if (configured) return transporter;
  configured = true;

  const host = process.env['SMTP_HOST'];
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASS'];

  // Real credentials required — placeholder values from .env.example are ignored
  if (!host || !user || !pass || user === 'your-email@gmail.com' || pass === 'your-app-password') {
    logger.warn('SMTP not configured — emails will be logged to console instead of sent');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env['SMTP_PORT'] ?? 587),
    secure: Number(process.env['SMTP_PORT'] ?? 587) === 465,
    auth: { user, pass },
  });
  logger.info(`SMTP configured: ${host}`);
  return transporter;
}

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Sends an email; falls back to console logging in dev when SMTP is unconfigured.
 *  Returns true if actually delivered to an SMTP server. */
export async function sendMail(opts: MailOptions): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.info(`[MAIL:console-fallback] To: ${opts.to} | Subject: ${opts.subject}`);
    console.log(`[DEV MAIL] To: ${opts.to}\nSubject: ${opts.subject}\n${opts.text ?? opts.html.replace(/<[^>]+>/g, ' ')}`);
    return false;
  }
  try {
    await t.sendMail({
      from: process.env['EMAIL_FROM'] ?? 'PharmaOS <noreply@pharmaos.in>',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return true;
  } catch (err) {
    logger.error(`Email send failed to ${opts.to}: ${(err as Error).message}`);
    return false;
  }
}

const BRAND_HEADER = `
  <div style="background:#0F766E;padding:20px 24px;border-radius:12px 12px 0 0;">
    <span style="color:#fff;font-size:18px;font-weight:bold;font-family:Arial,sans-serif;">PharmaOS</span>
  </div>`;

function wrap(body: string): string {
  return `<div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;color:#1e293b;">
    ${BRAND_HEADER}
    <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:24px;">${body}</div>
    <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:12px;">
      This is an automated message from PharmaOS. Please do not reply.
    </p>
  </div>`;
}

export async function sendOtpEmail(to: string, otp: string, purpose: string): Promise<boolean> {
  const purposeLabel = purpose === 'password_reset' ? 'password reset' : purpose.replace(/_/g, ' ');
  return sendMail({
    to,
    subject: `${otp} is your PharmaOS ${purposeLabel} code`,
    html: wrap(`
      <p>Your one-time code for ${purposeLabel}:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0F766E;text-align:center;margin:20px 0;">${otp}</p>
      <p style="font-size:13px;color:#64748b;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
    `),
    text: `Your PharmaOS ${purposeLabel} code is ${otp}. It expires in 10 minutes.`,
  });
}

export interface StockAlertItem {
  name: string;
  detail: string;
}

export async function sendAlertEmail(
  to: string,
  pharmacyName: string,
  kind: 'low_stock' | 'expiry',
  items: StockAlertItem[],
): Promise<boolean> {
  const title = kind === 'low_stock' ? 'Low Stock Alert' : 'Expiry Alert';
  const rows = items.slice(0, 20).map(i =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;">${i.name}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">${i.detail}</td></tr>`).join('');
  return sendMail({
    to,
    subject: `[${pharmacyName}] ${title} — ${items.length} item${items.length !== 1 ? 's' : ''}`,
    html: wrap(`
      <h2 style="font-size:16px;margin:0 0 12px;">${title}</h2>
      <p style="font-size:13px;color:#64748b;">The following items need your attention at ${pharmacyName}:</p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">${rows}</table>
      ${items.length > 20 ? `<p style="font-size:12px;color:#94a3b8;">…and ${items.length - 20} more. Open PharmaOS for the full list.</p>` : ''}
    `),
    text: `${title} at ${pharmacyName}: ${items.map(i => `${i.name} (${i.detail})`).join(', ')}`,
  });
}
