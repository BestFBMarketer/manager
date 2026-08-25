// =====================================
// MODULE: Candidate Finder
// Purpose: Uzun video transkriptini rankingPlanner.ts'in secebilecegi aday pencerelere boler
// Dependencies: config/constants, core/logger, story/transcribeSource (TimedCue)
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { RANKING } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import type { TimedCue } from '../story/transcribeSource.js';
import type { RankingCandidate } from './rankingPlanner.js';

/** Aday pencere ne kadar buyuk olmali - final item (3-8sn) buradan alt-kirpilir. */
const CANDIDATE_WINDOW_SEC = 25;
/** Video basi/sonu genelde intro/outro/jenerik - aday aramasi disinda tutulur. */
const EDGE_SKIP_RATIO = 0.05;
/** Anlamli sayida aday cikmasi icin hedeflenen minimum aday sayisi. */
const MIN_CANDIDATES = Math.max(RANKING.ITEM_COUNT * 2, 8);

export interface ScoredCandidate {
  candidate: RankingCandidate;
  /** Bu adayin kaynak videodaki gercek baslangic zamani - planRanking'in
   * candidate-relatif startSec/endSec'ini mutlak zamana cevirmek icin gerekli. */
  absoluteStartSec: number;
}

/**
 * Zaman damgali transkripti, rankingPlanner.planRanking()'in aralarindan
 * en iyi 5'ini secebilecegi aday pencerelere böler. Konusma az/bos oldugu
 * bolgelerde (fasıl/parti icerigi) özet kısa/generic kalabilir - uydurma
 * icerik eklenmez (Rule 11).
 * @param cues transcribeSource.ts'in fetchTimedCaptions çıktısı (null ise [] döner)
 * @param sourceDurationSec Kaynak videonun toplam süresi
 * @returns Aday listesi + her adayin mutlak baslangic zamani
 */
export function findCandidates(cues: TimedCue[] | null, sourceDurationSec: number): ScoredCandidate[] {
  if (!cues || cues.length === 0) {
    Logger.warn('Transkript yok - aday pencere bulunamadı');
    return [];
  }

  const usableStart = sourceDurationSec * EDGE_SKIP_RATIO;
  const usableEnd = sourceDurationSec * (1 - EDGE_SKIP_RATIO);
  const usableDuration = usableEnd - usableStart;

  if (usableDuration < RANKING.MIN_ITEM_SEC) {
    Logger.warn(`Video çok kısa (${sourceDurationSec.toFixed(0)}s) - aday pencere üretilemedi`);
    return [];
  }

  // Video kisaysa MIN_CANDIDATES'e ulasmak icin pencere boyutu kucultulur.
  const windowSec = Math.min(CANDIDATE_WINDOW_SEC, Math.max(RANKING.MIN_ITEM_SEC, usableDuration / MIN_CANDIDATES));

  const candidates: ScoredCandidate[] = [];
  let index = 0;

  for (let start = usableStart; start < usableEnd; start += windowSec) {
    const end = Math.min(usableEnd, start + windowSec);
    const windowCues = cues.filter((c) => c.startSec < end && c.endSec > start);
    const summary = windowCues.map((c) => c.text).join(' ').trim();

    if (!summary) continue; // sessiz bolge - LLM'e aday olarak sunulacak icerik yok

    candidates.push({
      candidate: { clipId: `seg-${index}`, summary: summary.slice(0, 500), durationSec: end - start },
      absoluteStartSec: start,
    });
    index += 1;
  }

  Logger.success(`${candidates.length} aday pencere bulundu (${windowSec.toFixed(0)}sn'lik pencerelerle)`);
  return candidates;
}
