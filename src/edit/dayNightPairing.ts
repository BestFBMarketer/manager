// =====================================
// MODULE: Day-Night Pairing
// Purpose: Ayni bolgenin ayni acidan gunduz ve gece cekimlerini eslestirir
// Dependencies: telemetry/*, analysis/daylight, config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { VIEWPOINT } from '../config/constants.js';
import { isDayNightContrast, sunPosition, type LightCondition } from '../analysis/daylight.js';
import { Logger } from '../core/logger.js';
import type { FlightCluster, ClipSummary } from '../telemetry/flightCluster.js';
import { compareViewpoints, extractViewpoints, type Viewpoint } from '../telemetry/viewpoint.js';

export interface ClipViewpoint {
  clipId: string;
  filePath: string;
  viewpoint: Viewpoint;
  condition: LightCondition;
  shotAt: Date | null;
}

export interface DayNightPair {
  /** Aydinlik cekim (gunduz veya altin saat) */
  bright: ClipViewpoint;
  /** Karanlik cekim (gece veya mavi saat) */
  dark: ClipViewpoint;
  /** Bakis acisi benzerligi (0-1) */
  score: number;
  distanceM: number;
  altDiffM: number;
  headingDiffDeg: number | null;
}

/** Klibin her bakis acisini isik kosuluyla etiketler. */
function describeClip(entry: ClipSummary): ClipViewpoint[] {
  const viewpoints = extractViewpoints(entry.clip.points);

  return viewpoints.map((viewpoint) => {
    // Her bakis acisi kendi anindaki gunes yuksekligiyle degerlendirilir:
    // uzun bir ucus altin saatten geceye gecebilir.
    const at = entry.shotAt
      ? new Date(entry.shotAt.getTime() + viewpoint.startSec * 1000)
      : null;

    const condition: LightCondition = at
      ? sunPosition(at, viewpoint.lat, viewpoint.lon).condition
      : 'day';

    return {
      clipId: entry.clip.clipId,
      filePath: entry.clip.filePath,
      viewpoint,
      condition,
      shotAt: at,
    };
  });
}

/**
 * Bir bolge kumesi icinde gunduz-gece eslesmelerini bulur.
 *
 * Ayni noktadan ayni yone bakan iki cekim, biri aydinlik biri karanlik ise
 * gecis efektiyle birlestirilmeye adaydir: izleyici ayni manzarayi iki farkli
 * zamanda gorur.
 *
 * @param cluster clusterFlights ciktisindaki bir bolge
 * @param maxPairs En fazla kac eslesme dondurulecegi
 * @returns Benzerlige gore azalan sirali eslesmeler
 */
export function findDayNightPairs(cluster: FlightCluster, maxPairs = 3): DayNightPair[] {
  const described = cluster.clips.flatMap(describeClip);

  const bright = described.filter((entry) => entry.condition === 'day' || entry.condition === 'goldenHour');
  const dark = described.filter((entry) => entry.condition === 'night' || entry.condition === 'blueHour');

  if (bright.length === 0 || dark.length === 0) {
    Logger.debug(`${cluster.id}: gunduz-gece karsitligi yok (${bright.length} aydinlik, ${dark.length} karanlik)`);
    return [];
  }

  const candidates: DayNightPair[] = [];

  for (const brightEntry of bright) {
    for (const darkEntry of dark) {
      // Ayni klipten iki kare eslestirilmez.
      if (brightEntry.clipId === darkEntry.clipId) continue;
      if (!isDayNightContrast(brightEntry.condition, darkEntry.condition)) continue;

      const match = compareViewpoints(brightEntry.viewpoint, darkEntry.viewpoint);
      if (match.score < VIEWPOINT.MIN_MATCH_SCORE) continue;

      candidates.push({
        bright: brightEntry,
        dark: darkEntry,
        score: match.score,
        distanceM: match.distanceM,
        altDiffM: match.altDiffM,
        headingDiffDeg: match.headingDiffDeg,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Ayni klip cifti birden fazla kez kullanilmasin - kurgu tekrara dusmesin.
  const used = new Set<string>();
  const chosen: DayNightPair[] = [];

  for (const candidate of candidates) {
    if (chosen.length >= maxPairs) break;
    const key = `${candidate.bright.clipId}|${candidate.dark.clipId}`;
    if (used.has(key)) continue;

    used.add(key);
    chosen.push(candidate);
  }

  if (chosen.length > 0) {
    Logger.success(
      `${cluster.id}: ${chosen.length} gunduz-gece eslesmesi ` +
        `(en iyi: ${chosen[0]!.distanceM.toFixed(0)}m, ` +
        `${chosen[0]!.headingDiffDeg?.toFixed(0) ?? '-'}° yon farki, puan ${chosen[0]!.score.toFixed(2)})`,
    );
  }

  return chosen;
}
