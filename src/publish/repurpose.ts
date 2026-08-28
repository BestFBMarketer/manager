// =====================================
// MODULE: Repurpose
// Purpose: Yayınlanmış uzun videodan N adet Shorts kesiti planlar (LLM shortsPlan görevi)
// Dependencies: llm/router, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { callLlmJson } from '../llm/router.js';
import { Logger } from '../core/logger.js';

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
