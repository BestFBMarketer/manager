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
import { WORKER, PIPELINE } from '../config/constants.js';
import { getChannel } from '../config/channels.js';
import { planShortsDerivatives } from '../publish/repurpose.js';
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
     VALUES (?, ?, ?, 'pending_review', ?, ?, ?, ?, ?, ?)`,
  ).run(
    job.id,
    job.channel_id,
    job.template === 'ShortsDerivative' ? 'shorts_derivative' : 'primary',
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
      case 'HotelTourLandscape':
      case 'HotelTourVertical': {
        const { runHotelTourJob } = await import('./stages/hotelTour.js');
        result = await runHotelTourJob(db, job, channel);
        break;
      }
      case 'FunnyClip': {
        const { runFunnyClipJob } = await import('./stages/funnyClip.js');
        result = await runFunnyClipJob(db, job, channel);
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
      case 'ShortsDerivative': {
        const { runShortsDerivativeJob } = await import('./stages/shortsDerivative.js');
        result = await runShortsDerivativeJob(db, job, channel);
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

const LONG_VIDEO_TEMPLATES = new Set(['HotelTourLandscape', 'StoryNarrative']);

interface PublishedLongVideoRow {
  job_id: number;
  channel_id: string;
  template: string;
  metadata_context_json: string;
  output_path: string;
  video_id: string;
  publish_at: string;
}

/**
 * Yayınlanmış (job.status='done') uzun videolardan, henüz Shorts türevi
 * planlanmamış olanlar için repurpose.ts'i çağırıp `count` kadar kesit
 * planlar ve her biri için yeni bir job + shorts_derivative satırı açar.
 * shorts_derivative(parent_job_id, slot_index) UNIQUE kısıtı aynı kesidin
 * iki kez üretilmesini DB seviyesinde engeller - bu fonksiyon idempotenttir.
 */
async function planPendingRepurposing(db: Database.Database): Promise<void> {
  const rows = db
    .prepare(
      `SELECT j.id AS job_id, j.channel_id, j.template, r.metadata_context_json,
              ren.output_path, u.video_id, u.publish_at
       FROM job j
       JOIN review_item r ON r.job_id = j.id AND r.status = 'approved'
       JOIN render ren ON ren.job_id = j.id AND ren.status = 'done'
       JOIN upload u ON u.job_id = j.id AND u.status IN ('scheduled', 'published')
       WHERE j.status = 'done'
         AND NOT EXISTS (SELECT 1 FROM shorts_derivative sd WHERE sd.parent_job_id = j.id)`,
    )
    .all() as PublishedLongVideoRow[];

  const eligible = rows.filter((row) => LONG_VIDEO_TEMPLATES.has(row.template));
  if (eligible.length === 0) return;

  for (const row of eligible) {
    let channel;
    try {
      channel = getChannel(row.channel_id);
    } catch {
      continue;
    }

    if (!channel.settings.shortsDerivativeEnabled || channel.shortsDerivativeCount <= 0) continue;

    const count = Math.min(channel.shortsDerivativeCount, PIPELINE.DERIVATIVE_PUBLISH_OFFSET_DAYS.length);
    const context = JSON.parse(row.metadata_context_json) as { subject: string; highlights: string[]; durationSec: number };
    const longVideoUrl = `https://youtu.be/${row.video_id}`;

    Logger.info(`[repurpose] ${channel.label}: iş #${row.job_id} için ${count} Shorts kesiti planlanıyor`);

    try {
      const plans = await planShortsDerivatives(context.subject, context.highlights, context.durationSec, count);
      const parentPublishAt = new Date(row.publish_at);

      const insertJob = db.prepare(
        `INSERT INTO job (channel_id, template, source_ref, target_dur_sec, status, input_json, target_publish_at)
         VALUES (?, 'ShortsDerivative', ?, ?, 'pending', ?, ?)`,
      );
      const insertDerivative = db.prepare(
        `INSERT INTO shorts_derivative (parent_job_id, child_job_id, start_sec, end_sec, slot_index) VALUES (?, ?, ?, ?, ?)`,
      );

      const tx = db.transaction(() => {
        plans.forEach((plan, index) => {
          const offsetDays = PIPELINE.DERIVATIVE_PUBLISH_OFFSET_DAYS[index] ?? 1;
          const targetPublishAt = new Date(parentPublishAt.getTime() + offsetDays * 24 * 60 * 60 * 1000);

          const inputJson = JSON.stringify({
            parentVideoPath: row.output_path,
            startSec: plan.startSec,
            endSec: plan.endSec,
            hook: plan.hook,
            derivativeTitle: plan.title,
            longVideoUrl,
          });

          const jobResult = insertJob.run(
            channel.id,
            row.output_path,
            Math.round(plan.endSec - plan.startSec),
            inputJson,
            targetPublishAt.toISOString(),
          );

          insertDerivative.run(row.job_id, Number(jobResult.lastInsertRowid), plan.startSec, plan.endSec, index);
        });
      });
      tx();

      Logger.success(`[repurpose] ${channel.label}: ${plans.length} Shorts işi kuyruğa eklendi (iş #${row.job_id})`);
    } catch (error) {
      Logger.warn(`[repurpose] ${channel.label}: iş #${row.job_id} için planlama başarısız, sonraki turda tekrar denenecek`, error);
    }
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

    // Adım 3: Yayınlanmış uzun videolardan otomatik Shorts türetme planla
    // (kullanıcı isteği: kanala trafik çekmek için belirli aralıklarla otomatik).
    await planPendingRepurposing(db);

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
