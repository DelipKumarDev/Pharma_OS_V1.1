import { logger } from './logger';

/**
 * Provider-agnostic SMS / WhatsApp sender.
 *
 * Configure via env:
 *   SMS_PROVIDER=msg91 | twilio        (unset = console fallback, nothing sent)
 *   MSG91:  MSG91_AUTH_KEY, MSG91_SENDER_ID (6-char DLT-approved sender)
 *   Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (+91… or whatsapp:+91…)
 */

type Channel = 'sms' | 'whatsapp';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

async function sendViaMsg91(to: string, message: string): Promise<boolean> {
  const authKey = process.env['MSG91_AUTH_KEY'];
  const senderId = process.env['MSG91_SENDER_ID'] ?? 'PHRMOS';
  if (!authKey) return false;
  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: authKey },
    body: JSON.stringify({
      sender: senderId,
      route: '4',
      country: '91',
      sms: [{ message, to: [normalizePhone(to)] }],
    }),
  });
  return res.ok;
}

async function sendViaTwilio(to: string, message: string, channel: Channel): Promise<boolean> {
  const sid = process.env['TWILIO_ACCOUNT_SID'];
  const token = process.env['TWILIO_AUTH_TOKEN'];
  const from = process.env['TWILIO_FROM'];
  if (!sid || !token || !from) return false;
  const prefix = channel === 'whatsapp' ? 'whatsapp:' : '';
  const body = new URLSearchParams({
    To: `${prefix}+${normalizePhone(to)}`,
    From: channel === 'whatsapp' && !from.startsWith('whatsapp:') ? `whatsapp:${from}` : from,
    Body: message,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
    },
    body,
  });
  return res.ok;
}

/** Sends an SMS (or WhatsApp message). Returns true only when a provider accepted it.
 *  With no provider configured, logs to console and returns false — safe no-op. */
export async function sendSms(to: string, message: string, channel: Channel = 'sms'): Promise<boolean> {
  const provider = process.env['SMS_PROVIDER'];
  try {
    if (provider === 'msg91' && channel === 'sms') {
      const ok = await sendViaMsg91(to, message);
      if (!ok) logger.warn(`MSG91 send failed for ${to}`);
      return ok;
    }
    if (provider === 'twilio') {
      const ok = await sendViaTwilio(to, message, channel);
      if (!ok) logger.warn(`Twilio ${channel} send failed for ${to}`);
      return ok;
    }
  } catch (err) {
    logger.error(`SMS send error for ${to}: ${(err as Error).message}`);
    return false;
  }
  logger.info(`[SMS:console-fallback] To: ${to} (${channel}) | ${message}`);
  console.log(`[DEV ${channel.toUpperCase()}] To: ${to}\n${message}`);
  return false;
}

export async function sendAlertSms(to: string, message: string): Promise<boolean> {
  return sendSms(to, message, 'sms');
}

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  return sendSms(to, message, 'whatsapp');
}
