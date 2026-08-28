// =====================================
// MODULE: Viewpoint
// Purpose: Bir cekimin "nereden nereye baktigini" olcer ve iki cekimi karsilastirir
// Dependencies: telemetry/*, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { VIEWPOINT } from '../config/constants.js';
import { haversineMeters } from './clipSync.js';
import type { TrackPoint } from './types.js';

export interface Viewpoint {
  lat: number;
  lon: number;
  altM: number;
  /** Ucus yonu (derece, 0=kuzey). Kamera genelde bu yone bakar. */
  headingDeg: number;
  /** Bu bakis acisinin cikarildigi klip-ici zaman araligi */
  startSec: number;
  endSec: number;
}

/**
 * Iki koordinat arasindaki azimut (bearing).
 * @returns 0-360 derece, 0 = kuzey
 */
export function bearingDeg(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLon = toRad(to.lon - from.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * Iki aci arasindaki en kisa fark (0-180 derece).
 * 350° ile 10° arasindaki fark 340 degil 20 derecedir.
 */
export function angleDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Ucus izini bakis acilarina boler.
 *
 * Her pencere icin ortalama konum, irtifa ve gidis yonu hesaplanir; drone
 * genelde ucus yonune baktigi icin bu, kabaca kamera acisidir.
 *
 * @param track Ucus izi
 * @param windowSec Pencere boyu
 * @returns Bakis acisi listesi
 */
export function extractViewpoints(track: TrackPoint[], windowSec = VIEWPOINT.WINDOW_SEC): Viewpoint[] {
  if (track.length < 2) return [];

  const viewpoints: Viewpoint[] = [];
  const last = track[track.length - 1]!;

  for (let start = track[0]!.tSec; start < last.tSec; start += windowSec) {
    const end = start + windowSec;
    const inWindow = track.filter((point) => point.tSec >= start && point.tSec < end);
    if (inWindow.length < 2) continue;

    const first = inWindow[0]!;
    const final = inWindow[inWindow.length - 1]!;

    // Yer degistirme cok kucukse yon guvenilmez; hover kabul edilir.
    const moved = haversineMeters(first, final);
    const heading = moved >= VIEWPOINT.MIN_MOVE_FOR_HEADING_M ? bearingDeg(first, final) : Number.NaN;

    viewpoints.push({
      lat: inWindow.reduce((sum, p) => sum + p.lat, 0) / inWindow.length,
      lon: inWindow.reduce((sum, p) => sum + p.lon, 0) / inWindow.length,
      altM: inWindow.reduce((sum, p) => sum + p.alt, 0) / inWindow.length,
      headingDeg: heading,
      startSec: start,
      endSec: end,
    });
  }

  return viewpoints;
}

export interface ViewpointMatch {
  distanceM: number;
  altDiffM: number;
  /** Yon farki (derece); iki taraftan biri hover ise null */
  headingDiffDeg: number | null;
  /** 0-1 arasi benzerlik - 1 = ayni yerden ayni yone */
  score: number;
}

/**
 * Iki bakis acisinin ne kadar ortustugunu olcer.
 *
 * Gunduz ve gece cekimlerini eslestirmek icin kullanilir: ayni noktadan
 * ayni yone bakan iki kare, gecis efektiyle birlestirildiginde izleyici
 * ayni manzarayi iki farkli zamanda gorur.
 */
export function compareViewpoints(a: Viewpoint, b: Viewpoint): ViewpointMatch {
  const distanceM = haversineMeters(a, b);
  const altDiffM = Math.abs(a.altM - b.altM);

  const bothHaveHeading = !Number.isNaN(a.headingDeg) && !Number.isNaN(b.headingDeg);
  const headingDiffDeg = bothHaveHeading ? angleDiff(a.headingDeg, b.headingDeg) : null;

  // Her olcut kendi toleransina gore 0-1'e normalize edilir.
  const distScore = Math.max(0, 1 - distanceM / VIEWPOINT.MAX_DISTANCE_M);
  const altScore = Math.max(0, 1 - altDiffM / VIEWPOINT.MAX_ALT_DIFF_M);
  const headingScore =
    headingDiffDeg === null
      ? VIEWPOINT.HOVER_HEADING_SCORE
      : Math.max(0, 1 - headingDiffDeg / VIEWPOINT.MAX_HEADING_DIFF_DEG);

  const score =
    distScore * VIEWPOINT.WEIGHT_DISTANCE +
    altScore * VIEWPOINT.WEIGHT_ALT +
    headingScore * VIEWPOINT.WEIGHT_HEADING;

  return { distanceM, altDiffM, headingDiffDeg, score };
}
