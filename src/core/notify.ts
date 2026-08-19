// =====================================
// MODULE: Notify
// Purpose: E-posta bildirimleri - hata, success, ve worker raporları
// Dependencies: nodemailer, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-19
// =====================================

import nodemailer from 'nodemailer';
import { Logger } from './logger.js';

export interface NotifyOptions {
  subject: string;
  body: string;
  severity: 'info' | 'warning' | 'error';
}

interface LastNotificationTime {
  key: string;
  timestamp: number;
}

const SPAM_PREVENTION_MS = 15 * 60 * 1000; // 15 dakika - aynı hata tekrar yazılmasın
const lastNotifications = new Map<string, number>();

/**
 * SMTP konfigürasyonu (process.env'den okunur).
 * Kurulum: .env'e
 *   NOTIFY_SMTP_HOST=smtp.gmail.com
 *   NOTIFY_SMTP_PORT=587
 *   NOTIFY_SMTP_USER=your-email@gmail.com
 *   NOTIFY_SMTP_PASS=app-password
 *   NOTIFY_EMAIL_TO=target@example.com
 */
function getTransporter() {
  const host = process.env.NOTIFY_SMTP_HOST;
  const port = parseInt(process.env.NOTIFY_SMTP_PORT || '587', 10);
  const user = process.env.NOTIFY_SMTP_USER;
  const pass = process.env.NOTIFY_SMTP_PASS;
  const to = process.env.NOTIFY_EMAIL_TO;

  if (!host || !user || !pass || !to) {
    Logger.warn(
      'Bildirim sistemi konfigüre edilmemiş (NOTIFY_SMTP_* veya NOTIFY_EMAIL_TO eksik) - e-posta gönderilemeyecek',
    );
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * E-posta gönder. Spam önlemek için aynı error 15 dakikada bir yazılır, tekrar tekrar değil.
 * @param opts subject, body, severity
 */
export async function notifyEmail(opts: NotifyOptions): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const key = `${opts.severity}:${opts.subject}`;
  const now = Date.now();
  const lastTime = lastNotifications.get(key) || 0;

  if (now - lastTime < SPAM_PREVENTION_MS) {
    Logger.debug(`Bildirim spam koruması: ${key} 15 dakikada bir gönderilir`);
    return;
  }

  lastNotifications.set(key, now);

  try {
    const to = process.env.NOTIFY_EMAIL_TO;
    const from = process.env.NOTIFY_SMTP_USER;

    await transporter.sendMail({
      from,
      to,
      subject: `[${opts.severity.toUpperCase()}] ${opts.subject}`,
      text: opts.body,
      replyTo: from,
    });

    Logger.success(`E-posta gönderildi: ${opts.subject}`);
  } catch (err) {
    Logger.error('E-posta gönderimi başarısız', err);
  }
}
