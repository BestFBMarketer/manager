// =====================================
// MODULE: Review Gate
// Purpose: Onay kuyruğu kararları - approve/reject/requestChanges/requeue
// Dependencies: core/db, core/logger, config/channels, publish/publishScheduler
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { getChannel } from '../config/channels.js';
import { scheduleAndUpload } from './publishScheduler.js';
import type { UploadResult } from './uploader.js';
import { writeVideoMetadata } from '../analysis/channelWriter.js';
import { probe } from '../ingest/probe.js';
import { generateThumbnail } from '../render/thumbnail.js';
import { crossPostToConnectedPlatforms } from './crossPost.js';

export interface ReviewItemRow {
  id: number;
  job_id: number;
  channel_id: string;
  kind: string;
  status: string;
  preview_path: string | null;
  thumbnail_path: string | null;
  proposed_title: string;
  proposed_description: string;
  proposed_tags_json: string;
  metadata_context_json: string;
  fact_checked_at: string | null;
  reviewer_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

interface RenderRow {
  id: number;
  job_id: number;
  composition: string;
  output_path: string | null;
  status: string;
  duration_ms: number | null;
}

function getPendingReviewItem(reviewItemId: number): ReviewItemRow {
  const db = getDb();
  const item = db.prepare('SELECT * FROM review_item WHERE id = ?').get(reviewItemId) as
    | ReviewItemRow
    | undefined;

  if (!item) throw new Error(`review_item bulunamadı: #${reviewItemId}`);
  if (item.status !== 'pending_review') {
    throw new Error(
      `review_item #${reviewItemId} zaten karara bağlanmış (status=${item.status}) - çift onay engellendi`,
    );
  }
  return item;
}

export interface MetadataEdits {
  proposedTitle?: string;
  proposedDescription?: string;
  proposedTags?: string[];
}

/**
 * Onaydan önce küçük metin düzeltmesi - job'a veya render'a dokunmaz, sadece
 * review_item.proposed_* alanlarını günceller. requeue'dan farkı: requeue işi
 * baştan render eder, bu sadece DB'deki öneriyi değiştirir (EK2/D'de tarif
 * edilen "onay öncesi küçük düzeltme" tam olarak budur).
 */
export function updateProposedMetadata(reviewItemId: number, edits: MetadataEdits): ReviewItemRow {
  const db = getDb();
  const item = getPendingReviewItem(reviewItemId);

  db.prepare(
    `UPDATE review_item SET proposed_title=?, proposed_description=?, proposed_tags_json=? WHERE id=?`,
  ).run(
    edits.proposedTitle ?? item.proposed_title,
    edits.proposedDescription ?? item.proposed_description,
    JSON.stringify(edits.proposedTags ?? JSON.parse(item.proposed_tags_json)),
    reviewItemId,
  );

  return db.prepare('SELECT * FROM review_item WHERE id = ?').get(reviewItemId) as ReviewItemRow;
}

/**
 * Onaylanan videoyu yayına planlar. LLM'i tekrar ÇALIŞTIRMAZ - review_item'da
 * DB'ye zaten yazılmış olan proposed_* alanları doğrudan kullanılır (EK5).
 *
 * `status='pending_review'` koşulu (getPendingReviewItem içinde) aynı zamanda
 * çifte-tıklama koruması sağlar: art arda iki approve isteğinden ikincisi bu
 * koşulu bulamayıp temiz bir hatayla döner, iki kez yayınlama olmaz.
 */
export async function approveReviewItem(reviewItemId: number, decidedBy: string): Promise<UploadResult> {
  const db = getDb();
  const item = getPendingReviewItem(reviewItemId);

  const render = db
    .prepare("SELECT * FROM render WHERE job_id = ? AND status = 'done'")
    .get(item.job_id) as RenderRow | undefined;

  if (!render || !render.output_path) {
    throw new Error(`İş #${item.job_id} için tamamlanmış render bulunamadı - onaylanacak dosya yok`);
  }

  const channel = getChannel(item.channel_id);
  const tags = JSON.parse(item.proposed_tags_json) as string[];

  const result = await scheduleAndUpload({
    jobId: item.job_id,
    channel,
    filePath: render.output_path,
    title: item.proposed_title,
    description: item.proposed_description,
    tags,
    thumbnailPath: item.thumbnail_path ?? undefined,
  });

  db.prepare(
    "UPDATE review_item SET status='approved', decided_by=?, decided_at=datetime('now') WHERE id=?",
  ).run(decidedBy, reviewItemId);

  // Baglanti kurulmus Instagram/TikTok hesaplarina da yayinlar - basarisizlik
  // YouTube yuklemesini geri almaz, sadece o platform icin loglanir.
  const crossPostResults = await crossPostToConnectedPlatforms(
    item.channel_id,
    item.job_id,
    render.output_path,
    item.proposed_title,
    item.proposed_description,
  );
  if (crossPostResults.length > 0) {
    Logger.info(
      `[review ${reviewItemId}] Çapraz yayın: ${crossPostResults.map((r) => `${r.platform}=${r.ok ? 'ok' : 'hata'}`).join(', ')}`,
    );
  }

  Logger.success(`[review ${reviewItemId}] Onaylandı ve yayına planlandı (${decidedBy})`);
  return result;
}

/**
 * Reddedilen iş bir daha worker kuyruğuna düşmez - job.status claimNextJob'ın
 * aradığı 'pending' değerinden çıkarılır, elle müdahale (requeue) beklenir.
 */
export async function rejectReviewItem(reviewItemId: number, decidedBy: string, note?: string): Promise<void> {
  const db = getDb();
  const item = getPendingReviewItem(reviewItemId);

  db.prepare(
    "UPDATE review_item SET status='rejected', decided_by=?, decided_at=datetime('now'), reviewer_note=? WHERE id=?",
  ).run(decidedBy, note ?? null, reviewItemId);

  db.prepare("UPDATE job SET status='rejected', updated_at=datetime('now') WHERE id=?").run(item.job_id);

  Logger.info(`[review ${reviewItemId}] Reddedildi (${decidedBy})${note ? `: ${note}` : ''}`);
}

/**
 * "Değişiklik gerekli" - reddetmekten farkı sadece durum etiketi ve niyet;
 * job da aynı şekilde claimNextJob'ın göremeyeceği bir duruma alınır.
 */
export async function requestChanges(reviewItemId: number, decidedBy: string, note: string): Promise<void> {
  const db = getDb();
  const item = getPendingReviewItem(reviewItemId);

  db.prepare(
    "UPDATE review_item SET status='needs_changes', decided_by=?, decided_at=datetime('now'), reviewer_note=? WHERE id=?",
  ).run(decidedBy, note, reviewItemId);

  db.prepare("UPDATE job SET status='needs_changes', updated_at=datetime('now') WHERE id=?").run(item.job_id);

  Logger.info(`[review ${reviewItemId}] Değişiklik istendi (${decidedBy}): ${note}`);
}

export interface RequeueFields {
  proposedTitle?: string;
  proposedDescription?: string;
  proposedTags?: string[];
}

/**
 * Reddedilmiş / değişiklik istenmiş bir işi yeniden işlem kuyruğuna sokar:
 * job.status='pending' olur (claimNextJob tekrar görebilir), review_item
 * 'pending_review'a döner. changedFields verilirse önerilen metadata da
 * güncellenir (worker'ı tekrar tetiklemeden küçük düzeltme yapılabilsin diye).
 */
export async function requeueReviewItem(reviewItemId: number, changedFields?: RequeueFields): Promise<void> {
  const db = getDb();
  const item = db.prepare('SELECT * FROM review_item WHERE id = ?').get(reviewItemId) as
    | ReviewItemRow
    | undefined;

  if (!item) throw new Error(`review_item bulunamadı: #${reviewItemId}`);
  if (item.status !== 'rejected' && item.status !== 'needs_changes') {
    throw new Error(
      `review_item #${reviewItemId} requeue edilemez (status=${item.status}) - sadece rejected/needs_changes yeniden kuyruğa alınabilir`,
    );
  }

  db.prepare(
    `UPDATE review_item
     SET status='pending_review', decided_by=NULL, decided_at=NULL,
         proposed_title=?, proposed_description=?, proposed_tags_json=?
     WHERE id=?`,
  ).run(
    changedFields?.proposedTitle ?? item.proposed_title,
    changedFields?.proposedDescription ?? item.proposed_description,
    JSON.stringify(changedFields?.proposedTags ?? JSON.parse(item.proposed_tags_json)),
    reviewItemId,
  );

  db.prepare("UPDATE job SET status='pending', error=NULL, updated_at=datetime('now') WHERE id=?").run(
    item.job_id,
  );

  Logger.info(`[review ${reviewItemId}] Yeniden kuyruğa alındı (job #${item.job_id})`);
}

/**
 * Beğenilmeyen başlık/açıklama/etiket/thumbnail için ucuz bir "yeniden dene" yolu -
 * tüm render'ı (video/ses) tekrar etmez, sadece LLM'i orijinal bağlamla
 * (metadata_context_json) tekrar çağırır ve yeni metne göre thumbnail'i yeniden
 * üretir. Onaylanmadan önce istenildiği kadar tekrarlanabilir; status
 * pending_review'da kalır.
 */
export async function regenerateReviewItem(reviewItemId: number): Promise<ReviewItemRow> {
  const db = getDb();
  const item = getPendingReviewItem(reviewItemId);

  const channel = getChannel(item.channel_id);
  const context = JSON.parse(item.metadata_context_json) as {
    subject: string;
    highlights: string[];
    durationSec: number;
  };

  const metadata = await writeVideoMetadata(channel, context);

  let thumbnailPath = item.thumbnail_path;
  const render = db
    .prepare("SELECT output_path FROM render WHERE job_id = ? AND status = 'done'")
    .get(item.job_id) as { output_path: string | null } | undefined;

  if (render?.output_path) {
    try {
      const info = await probe(render.output_path);
      thumbnailPath = await generateThumbnail(
        render.output_path,
        info.durationSec,
        metadata.thumbnailText,
        `${render.output_path}.thumb_${Date.now()}.jpg`,
      );
    } catch (error) {
      Logger.warn(`[review ${reviewItemId}] Thumbnail yeniden üretilemedi, eskisi korunuyor`, error);
    }
  }

  db.prepare(
    `UPDATE review_item
     SET proposed_title=?, proposed_description=?, proposed_tags_json=?, thumbnail_path=?
     WHERE id=?`,
  ).run(metadata.title, metadata.description, JSON.stringify(metadata.tags), thumbnailPath, reviewItemId);

  Logger.success(`[review ${reviewItemId}] Metadata ve thumbnail yeniden oluşturuldu: "${metadata.title}"`);

  return db.prepare('SELECT * FROM review_item WHERE id = ?').get(reviewItemId) as ReviewItemRow;
}
