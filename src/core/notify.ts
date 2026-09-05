// =====================================
// MODULE: Notify
// Purpose: E-posta + masaustu bildirimleri - hata, success, ve worker raporlari
// Dependencies: nodemailer, node-notifier, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import nodemailer from 'nodemailer';
import notifier from 'node-notifier';
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

/** Ayni anahtarin 15 dakika icinde tekrar gonderilmesini engeller. Email/desktop
 * ayri anahtar uzayinda (prefix ile) tutulur, biri digerini spam-korumasiyla
 * susturmasin diye - notify() ikisini ayni cagrida tetikleyince her ikisi de
 * bagimsiz kendi 15-dakikalik penceresini kontrol eder. */
function shouldSend(namespacedKey: string): boolean {
  const now = Date.now();
  const lastTime = lastNotifications.get(namespacedKey) || 0;
  if (now - lastTime < SPAM_PREVENTION_MS) {
    Logger.debug(`Bildirim spam koruması: ${namespacedKey} 15 dakikada bir gönderilir`);
    return false;
  }
  lastNotifications.set(namespacedKey, now);
  return true;
}

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

  if (!shouldSend(`email:${opts.severity}:${opts.subject}`)) return;

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

/**
 * Masaustu bildirimi gonder (Windows toast / macOS Notification Center / Linux
 * libnotify - node-notifier platforma gore uygun mekanizmayi secer). Bu makine
 * uzerinde calisan worker/cron scriptleri (analyticsQueue, competitorRadarQueue,
 * ruleSynthesisQueue vb) icin - VPS'e tasinirsa bu kanal sessizce no-op olur
 * (node-notifier hedef platformda bildirim mekanizmasi bulamayinca sadece
 * loglar, hata firlatmaz).
 */
export function notifyDesktop(opts: NotifyOptions): void {
  if (!shouldSend(`desktop:${opts.severity}:${opts.subject}`)) return;

  notifier.notify(
    {
      title: `[${opts.severity.toUpperCase()}] ${opts.subject}`,
      message: opts.body,
      sound: opts.severity === 'error',
      wait: false,
    },
    (err) => {
      if (err) Logger.error('Masaüstü bildirimi başarısız', err);
    },
  );
}

/**
 * Hem e-posta hem masaustu bildirimi birlikte gonderir - analytics/VPH/kural-
 * onay bildirimlerinin varsayilan kanali (kullanici talebi: "masaustu bildirim
 * + email"). Her iki kanal kendi spam-korumasini bagimsiz uygular.
 */
export async function notify(opts: NotifyOptions): Promise<void> {
  notifyDesktop(opts);
  await notifyEmail(opts);
}
