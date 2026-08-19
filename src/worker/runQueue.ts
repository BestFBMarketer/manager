// =====================================
// MODULE: Run Queue
// Purpose: İş kuyruğunu işle - atomic claiming, crash recovery, dispatch
// Dependencies: core/db, core/logger, core/notify, config/constants, stages/*
// Author: BestMarketer Team
// Last Modified: 2026-08-19
// =====================================

import Database from 'better-sqlite3';
import { getDb, closeDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { notifyEmail } from '../core/notify.js';
import { WORKER } from '../config/constants.js';
import { getChannel } from '../config/channels.js';

interface JobRow {
  id: number;
  channel_id: string;
  template: string;
  source_ref: string;
  status: string;
  stage: string;
  error: string | null;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  batch_id?: string;
}

/**
 * İşin ortasında ölmüş worker'ları kurtarmak için: 30+ dakika önce claimed ama
 * hâlâ processing olan işleri pending'e geri dök.
 *
 * TIMEOUT_MS = render_timeout * 1.5'den büyük olmalı (config/constants.ts'te tanımlanmış).
 */
function sweepStaleClaims(db: Database.Database, timeoutMs: number): void {
  const cutoff = new Date(Date.now() - timeoutMs).toISOString();
  const result = db
    .prepare(
      `UPDATE job
       SET status='pending', updated_at=datetime('now')
       WHERE status='processing'
         AND claimed_at IS NOT NULL
         AND claimed_at < ?`,
    )
    .run(cutoff);

  if (result.changes && result.changes > 0) {
    Logger.warn(`${result.changes} orphan job(s) kurtarıldı (stale claim sweep)`);
  }
}

/**
 * Kuyruktan bir işi atomik olarak al. İkinci bir process aynı işi almayacak.
 * @returns İş satırı veya null (kuyruk boş)
 */
function claimNextJob(db: Database.Database): JobRow | null {
  const result = db
    .prepare(
      `UPDATE job
       SET status='processing', claimed_at=datetime('now'), updated_at=datetime('now')
       WHERE id = (
         SELECT id FROM job WHERE status='pending' ORDER BY created_at LIMIT 1
       )
       AND status='pending'`,
    )
    .run();

  // .changes === 1 olmadığı sürece, işi hazırlamaya başlama (başka process aldı)
  if (!result.changes || result.changes !== 1) return null;

  const job = db
    .prepare('SELECT * FROM job WHERE status=? ORDER BY updated_at DESC LIMIT 1')
    .get('processing') as JobRow | undefined;

  return job || null;
}

/**
 * İş başarıyla tamamlandı: render satırı ve review_item yazılmış, job.stage='awaiting_review'.
 * E-posta bildirimi gönder (M3 onayı bekleniyor).
 */
async function onJobSuccess(db: Database.Database, job: JobRow): Promise<void> {
  const channel = getChannel(job.channel_id);

  db.prepare('UPDATE job SET status=?, error=NULL, updated_at=datetime(?) WHERE id=?').run(
    'awaiting_review',
    new Date().toISOString(),
    job.id,
  );

  await notifyEmail({
    subject: `Render tamamlandı: ${channel.label}`,
    body: `İş #${job.id} başarıyla render edildi ve onay kuyruğunda bekleniyor.\nKanal: ${channel.label}\nŞablon: ${job.template}`,
    severity: 'info',
  });

  Logger.success(`[job ${job.id}] Onay kuyruğuna alındı`);
}

/**
 * İş başarısız: hata kaydedilmiş, job.status='failed'.
 * E-posta uyarısı gönder (teknik hata).
 */
async function onJobFailure(db: Database.Database, job: JobRow, error: unknown): Promise<void> {
  const errorMsg = error instanceof Error ? error.message : String(error);

  db.prepare('UPDATE job SET status=?, error=?, updated_at=datetime(?) WHERE id=?').run(
    'failed',
    errorMsg.slice(0, 2000),
    new Date().toISOString(),
    job.id,
  );

  const channel = getChannel(job.channel_id);

  await notifyEmail({
    subject: `İş başarısız: ${channel.label} #${job.id}`,
    body: `İş #${job.id} işlenirken hata oluştu.\nKanal: ${channel.label}\nŞablon: ${job.template}\n\nHata:\n${errorMsg}`,
    severity: 'error',
  });

  Logger.error(`[job ${job.id}] Başarısız`, error);
}

/**
 * İş'i uygun worker stage'ine gönder. Şu an sadece hotelTour destekleniyor.
 */
async function dispatchJob(db: Database.Database, job: JobRow): Promise<void> {
  const channel = getChannel(job.channel_id);

  Logger.info(`[job ${job.id}] İş dispatch ediliyor (${job.template})`);

  try {
    switch (job.template) {
      case 'HotelTour': {
        const { runHotelTourJob } = await import('./stages/hotelTour.js');
        await runHotelTourJob(db, job, channel);
        await onJobSuccess(db, job);
        break;
      }
      case 'FunnyRanking': {
        const { runFunnyRankingJob } = await import('./stages/funnyRanking.js');
        await runFunnyRankingJob(db, job, channel);
        await onJobSuccess(db, job);
        break;
      }
      case 'StoryNarrative': {
        const { runStoryNarrativeJob } = await import('./stages/storyNarrative.js');
        await runStoryNarrativeJob(db, job, channel);
        await onJobSuccess(db, job);
        break;
      }
      default:
        throw new Error(`Bilinmeyen şablon: ${job.template}`);
    }
  } catch (err) {
    await onJobFailure(db, job, err);
  }
}

/**
 * Kuyruktaki işleri işle: sweep + claim + dispatch.
 * Tek bir cron tetiklemesinde WORKER_BATCH_SIZE kadar işi al.
 */
async function processQueue(): Promise<void> {
  const db = getDb();

  try {
    // Adım 1: Orphan işleri kurtar
    sweepStaleClaims(db, WORKER.STALE_CLAIM_TIMEOUT_MS);

    // Adım 2: Toplu işle
    for (let i = 0; i < WORKER.BATCH_SIZE; i++) {
      const job = claimNextJob(db);
      if (!job) break; // Kuyruk boş

      await dispatchJob(db, job);
    }

    Logger.info('Worker turu tamamlandı');
  } catch (err) {
    Logger.error('Worker başarısız', err);
    await notifyEmail({
      subject: 'Worker çöktü',
      body: `Worker process beklenmeyen hata ile başarısız oldu:\n${err instanceof Error ? err.message : String(err)}`,
      severity: 'error',
    });
  } finally {
    closeDb();
  }
}

processQueue();
