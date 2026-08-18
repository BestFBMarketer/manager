// =====================================
// MODULE: POI Timeline
// Purpose: Ucus izine gore POI kartlarinin videoda ne zaman cikacagini hesaplar
// Dependencies: telemetry/clipSync, telemetry/types, config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { POI } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import { haversineMeters } from '../telemetry/clipSync.js';
import type { TrackPoint } from '../telemetry/types.js';
import type { PoiCue, PointOfInterest } from './types.js';

/**
 * Drone bir POI'ye en cok yaklastigi ani bulur.
 * @returns O andaki zaman ve mesafe; iz bossa null
 */
function closestApproach(track: TrackPoint[], poi: PointOfInterest): { tSec: number; distanceM: number } | null {
  let best: { tSec: number; distanceM: number } | null = null;

  for (const point of track) {
    const distanceM = haversineMeters(point, poi);
    if (!best || distanceM < best.distanceM) {
      best = { tSec: point.tSec, distanceM };
    }
  }

  return best;
}

/**
 * POI kartlarini ucus izine gore zamanlar: her kart, drone o noktaya
 * en cok yaklastigi anda ekrana gelir.
 *
 * Kurallar: cok uzak noktalar elenir, kartlar ust uste binmez,
 * video basi kart sayisi sinirlidir ve aciklamasi olmayan POI once elenir.
 *
 * @param track Klibin ucus izi
 * @param pois Bolgede bulunan ilgi noktalari
 * @param clipDurationSec Klip suresi - son saniyelerde kart baslatilmaz
 * @returns Zamana gore sirali kart ipuclari
 */
export function buildPoiCues(
  track: TrackPoint[],
  pois: PointOfInterest[],
  clipDurationSec: number,
): PoiCue[] {
  if (track.length === 0 || pois.length === 0) return [];

  const candidates: PoiCue[] = [];

  for (const poi of pois) {
    const approach = closestApproach(track, poi);
    if (!approach || approach.distanceM > POI.MAX_CUE_DISTANCE_M) continue;

    // Kart, video bitmeden tamamen gorunebilmeli.
    const latestStart = clipDurationSec - POI.CARD_DURATION_SEC;
    if (latestStart <= 0) continue;

    candidates.push({
      poi,
      atSec: Math.min(approach.tSec, latestStart),
      durationSec: POI.CARD_DURATION_SEC,
      distanceM: approach.distanceM,
    });
  }

  // Once aciklamasi olanlar ve daha yakin gecilenler secilir.
  candidates.sort((a, b) => {
    const aHasText = a.poi.description ? 0 : 1;
    const bHasText = b.poi.description ? 0 : 1;
    if (aHasText !== bHasText) return aHasText - bHasText;
    return a.distanceM - b.distanceM;
  });

  const chosen: PoiCue[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= POI.MAX_CARDS_PER_VIDEO) break;

    // Ekranda ayni anda tek kart olsun: mevcut kartlarla cakisma kontrolu
    const overlaps = chosen.some(
      (existing) =>
        Math.abs(existing.atSec - candidate.atSec) <
        existing.durationSec + POI.MIN_GAP_SEC,
    );
    if (overlaps) continue;

    chosen.push(candidate);
  }

  chosen.sort((a, b) => a.atSec - b.atSec);
  Logger.info(`POI zamanlamasi: ${pois.length} aday -> ${chosen.length} kart`);
  return chosen;
}
