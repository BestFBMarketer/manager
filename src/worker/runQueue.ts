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
import type { JobRow, StageResult } from './stages/types.js';

export type { JobRow };

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
 * İş başarıyla tamamlandı: render zaten stage fonksiyonu içinde `render` tablosuna
 * yazıldı. Burada `review_item` satırı yazılır (EK5 - onay anında LLM tekrar
 * çalışmasın diye önerilen metadata burada kalıcı hale gelir) ve job.stage
 * 'awaiting_review' olur - job.status bilerek 'processing' bırakılır ki
 * claimNextJob() (WHERE status='pending') bu işi bir daha asla kapmasın,
 * ve batch-progress bucket sorgusu status+stage kombinasyonuyla ayrıştırabilsin.
 */
async function onJobSuccess(db: Database.Database, job: JobRow, result: StageResult): Promise<void> {
  const channel = getChannel(job.channel_id);

  db.prepare('UPDATE job SET stage=?, error=NULL, updated_at=datetime(?) WHERE id=?').run(
    'awaiting_review',
    new Date().toISOString(),
    job.id,
  );

  db.prepare(
    `INSERT INTO review_item (job_id, channel_id, kind, status, preview_path, thumbnail_path, proposed_title, proposed_description, proposed_tags_json, metadata_context_json)
     VALUES (?, ?, 'primary', 'pending_review', ?, ?, ?, ?, ?, ?)`,
  ).run(
    job.id,
    job.channel_id,
    result.previewPath,
    result.thumbnailPath ?? null,
    result.proposedTitle,
    result.proposedDescription,
    JSON.stringify(result.proposedTags),
    JSON.stringify(result.metadataContext),
  );

  await notifyEmail({
    subject: `Render tamamlandı: ${channel.label}`,
    body: `İş #${job.id} başarıyla render edildi ve onay kuyruğunda bekleniyor.\nKanal: ${channel.label}\nŞablon: ${job.template}\nBaşlık önerisi: ${result.proposedTitle}`,
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
    let result: StageResult;

    switch (job.template) {
      case 'HotelTour': {
        const { runHotelTourJob } = await import('./stages/hotelTour.js');
        result = await runHotelTourJob(db, job, channel);
        break;
      }
      case 'FunnyRanking': {
        const { runFunnyRankingJob } = await import('./stages/funnyRanking.js');
        result = await runFunnyRankingJob(db, job, channel);
        break;
      }
      case 'StoryNarrative': {
        const { runStoryNarrativeJob } = await import('./stages/storyNarrative.js');
        result = await runStoryNarrativeJob(db, job, channel);
        break;
      }
      default:
        throw new Error(`Bilinmeyen şablon: ${job.template}`);
    }

    await onJobSuccess(db, job, result);
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
