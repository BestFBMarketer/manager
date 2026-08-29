// =====================================
// MODULE: Repurpose
// Purpose: Yayınlanmış uzun videodan N adet Shorts kesiti planlar (LLM shortsPlan görevi)
//          ve is kuyruguna yazar - hem otomatik zamanlayici (worker/runQueue.ts) hem de
//          panelden manuel tetikleme (panel/routes/repurpose.ts) ayni fonksiyonu kullanir.
// Dependencies: llm/router, core/logger, core/db
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import type Database from 'better-sqlite3';
import { callLlmJson } from '../llm/router.js';
import { Logger } from '../core/logger.js';
import { PIPELINE } from '../config/constants.js';

export interface DerivativePlan {
  startSec: number;
  endSec: number;
  hook: string;
  title: string;
}

function isDerivativePlan(value: unknown): value is DerivativePlan {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.startSec === 'number' &&
    typeof v.endSec === 'number' &&
    v.endSec > v.startSec &&
    typeof v.hook === 'string' &&
    typeof v.title === 'string'
  );
}

function isDerivativePlanList(value: unknown): value is DerivativePlan[] {
  return Array.isArray(value) && value.length > 0 && value.every(isDerivativePlan);
}

/**
 * Uzun videodan `count` adet Shorts kesiti planlar. Tam transkript yerine
 * video metadata'sını (konu + öne çıkanlar) kullanır - kesin saniye
 * doğruluğu garanti değildir, bu yüzden aday aralıklar clip süresine göre
 * clamp edilir (bkz. shortsDerivative.ts).
 * @param subject Videonun konusu (review_item.metadata_context_json.subject)
 * @param highlights Öne çıkan noktalar
 * @param durationSec Kaynak videonun toplam süresi
 * @param count Kaç kesit isteniyor
 */
export async function planShortsDerivatives(
  subject: string,
  highlights: string[],
  durationSec: number,
  count: number,
): Promise<DerivativePlan[]> {
  const system = [
    'You plan short-form video derivatives from a long-form video, to drive traffic back to the full video.',
    'Rules: each clip is 15-50 seconds, clips do not overlap, clips are ordered by start time,',
    'each needs a punchy hook (first line spoken/shown) and a short title.',
    'Clips should represent the most interesting/curiosity-inducing moments implied by the subject and highlights.',
    '',
    'Return ONLY this JSON schema (array, exactly the requested count of items):',
    '[{"startSec": number, "endSec": number, "hook": string, "title": string}]',
  ].join('\n');

  const user = [
    `Subject: ${subject}`,
    `Total duration: ${Math.round(durationSec)}s`,
    `Requested clip count: ${count}`,
    '',
    'Highlights:',
    ...highlights.map((h) => `- ${h}`),
  ].join('\n');

  const { data } = await callLlmJson<DerivativePlan[]>({ task: 'shortsPlan', system, user }, isDerivativePlanList);

  // LLM saniyeleri yanlis tahmin edebilir - video sinirlarina clamp edilir, tekrar cakismasin diye siralanir.
  const clamped = data
    .map((plan) => ({
      ...plan,
      startSec: Math.max(0, Math.min(plan.startSec, durationSec - 15)),
      endSec: Math.max(15, Math.min(plan.endSec, durationSec)),
    }))
    .filter((plan) => plan.endSec - plan.startSec >= 10)
    .sort((a, b) => a.startSec - b.startSec)
    .slice(0, count);

  Logger.success(`${clamped.length}/${count} Shorts kesiti planlandı (${subject})`);
  return clamped;
}

export interface QueueDerivativesInput {
  parentJobId: number;
  channelId: string;
  outputPath: string;
  videoId: string;
  publishAt: string;
  subject: string;
  highlights: string[];
  durationSec: number;
  count: number;
  /** Verilmezse PIPELINE.DERIVATIVE_PUBLISH_OFFSET_DAYS kullanilir. */
  offsetDays?: number[];
}

/**
 * Bir uzun video icin N Shorts kesiti planlar ve her biri icin yeni bir
 * job + shorts_derivative satiri acar. Ayni ebeveyn icin birden fazla kez
 * cagrilabilir (otomatik zamanlayici + panelden manuel tetikleme ayni
 * fonksiyonu kullanir) - slot_index her zaman mevcut en yuksek degerin
 * ustune eklenir, boylece shorts_derivative(parent_job_id, slot_index)
 * UNIQUE kisiti hicbir zaman ihlal edilmez.
 * @returns Kuyruga eklenen is sayisi
 */
export async function queueShortsDerivatives(db: Database.Database, input: QueueDerivativesInput): Promise<number> {
  const plans = await planShortsDerivatives(input.subject, input.highlights, input.durationSec, input.count);
  if (plans.length === 0) return 0;

  const offsetDays = input.offsetDays ?? [...PIPELINE.DERIVATIVE_PUBLISH_OFFSET_DAYS];
  const parentPublishAt = new Date(input.publishAt);
  const longVideoUrl = `https://youtu.be/${input.videoId}`;

  const { maxSlot } = db
    .prepare('SELECT COALESCE(MAX(slot_index), -1) AS maxSlot FROM shorts_derivative WHERE parent_job_id = ?')
    .get(input.parentJobId) as { maxSlot: number };

  const insertJob = db.prepare(
    `INSERT INTO job (channel_id, template, source_ref, target_dur_sec, status, input_json, target_publish_at)
     VALUES (?, 'ShortsDerivative', ?, ?, 'pending', ?, ?)`,
  );
  const insertDerivative = db.prepare(
    `INSERT INTO shorts_derivative (parent_job_id, child_job_id, start_sec, end_sec, slot_index) VALUES (?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    plans.forEach((plan, index) => {
      const offsetDay = offsetDays[index] ?? offsetDays[offsetDays.length - 1] ?? 1;
      const targetPublishAt = new Date(parentPublishAt.getTime() + offsetDay * 24 * 60 * 60 * 1000);

      const inputJson = JSON.stringify({
        parentVideoPath: input.outputPath,
        startSec: plan.startSec,
        endSec: plan.endSec,
        hook: plan.hook,
        derivativeTitle: plan.title,
        longVideoUrl,
      });

      const jobResult = insertJob.run(
        input.channelId,
        input.outputPath,
        Math.round(plan.endSec - plan.startSec),
        inputJson,
        targetPublishAt.toISOString(),
      );

      insertDerivative.run(input.parentJobId, Number(jobResult.lastInsertRowid), plan.startSec, plan.endSec, maxSlot + 1 + index);
    });
  });
  tx();

  Logger.success(`[repurpose] iş #${input.parentJobId} için ${plans.length} Shorts işi kuyruğa eklendi`);
  return plans.length;
}
