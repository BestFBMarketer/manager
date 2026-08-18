// =====================================
// MODULE: Music Segment Planner
// Purpose: Ucus hizi ve irtifasindan videonun muzik bolumlerini cikarir
// Dependencies: telemetry/*, config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { MUSIC_SEGMENT } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import { haversineMeters } from '../telemetry/clipSync.js';
import type { ClipSource, TrackPoint } from '../telemetry/types.js';
import type { Mood } from './types.js';

export type SegmentEnergy = 'low' | 'medium' | 'high';

export interface MusicSegment {
  startSec: number;
  endSec: number;
  energy: SegmentEnergy;
  avgSpeedMps: number;
  avgAltM: number;
  /** Bu bolume uygun tonlar - muzik secici bunlari tercih eder */
  suggestedMoods: Mood[];
}

/** Enerji seviyesi -> tercih edilen tonlar. */
const ENERGY_MOODS: Record<SegmentEnergy, Mood[]> = {
  high: ['energetic', 'epic', 'uplifting'],
  medium: ['uplifting', 'cinematic', 'epic'],
  low: ['dreamy', 'chill', 'cinematic'],
};

interface Window {
  startSec: number;
  endSec: number;
  speedMps: number;
  altM: number;
}

/**
 * Ardisik noktalardan yumusatilmis hiz/irtifa pencereleri uretir.
 * Pencere boyu video suresine gore buyur: 30 dakikalik bir klipte 5 saniyelik
 * pencerelerle calismak hem gereksiz hesap hem asiri parcali sonuc verir.
 */
function buildWindows(track: TrackPoint[], clipDurationSec: number): Window[] {
  if (track.length < 2) return [];

  const windows: Window[] = [];
  const windowSec = Math.max(
    MUSIC_SEGMENT.SMOOTH_WINDOW_SEC,
    minSegmentFor(clipDurationSec) / 4,
  );
  const lastPoint = track[track.length - 1]!;

  for (let start = track[0]!.tSec; start < lastPoint.tSec; start += windowSec) {
    const end = start + windowSec;
    const inWindow = track.filter((point) => point.tSec >= start && point.tSec < end);
    if (inWindow.length < 2) continue;

    let distanceM = 0;
    for (let i = 1; i < inWindow.length; i += 1) {
      distanceM += haversineMeters(inWindow[i - 1]!, inWindow[i]!);
    }

    const elapsed = inWindow[inWindow.length - 1]!.tSec - inWindow[0]!.tSec;
    const altSum = inWindow.reduce((sum, point) => sum + point.alt, 0);

    windows.push({
      startSec: start,
      endSec: end,
      speedMps: elapsed > 0 ? distanceM / elapsed : 0,
      altM: altSum / inWindow.length,
    });
  }

  return windows;
}

/**
 * Hiz ve irtifadan enerji seviyesi belirler.
 * Hiz baskin sinyaldir; irtifa kararsiz durumlarda yon verir.
 */
function classify(window: Window, source: ClipSource): SegmentEnergy {
  const { speedMps, altM } = window;

  if (speedMps >= MUSIC_SEGMENT.FAST_SPEED_MPS) return 'high';

  if (speedMps <= MUSIC_SEGMENT.SLOW_SPEED_MPS) {
    // Yavas + yuksek irtifa: sabit duran genis manzara - sinematik ama durgun degil
    return altM >= MUSIC_SEGMENT.HIGH_ALT_M ? 'medium' : 'low';
  }

  // Orta hizda alcak ucus genelde yakin plan takip cekimidir.
  if (altM <= MUSIC_SEGMENT.LOW_ALT_M) return 'low';

  // GoPro genelde yer seviyesinde aksiyon cekimidir; bir kademe yukari alinir.
  return source === 'gopro' ? 'high' : 'medium';
}

/** Ardisik ayni enerjili pencereleri birlestirir. */
function mergeWindows(windows: Window[], source: ClipSource): MusicSegment[] {
  const segments: MusicSegment[] = [];

  for (const window of windows) {
    const energy = classify(window, source);
    const last = segments[segments.length - 1];

    if (last && last.energy === energy) {
      // Ortalamalari agirlikli olarak guncelle
      const lastSpan = last.endSec - last.startSec;
      const windowSpan = window.endSec - window.startSec;
      const totalSpan = lastSpan + windowSpan;

      last.avgSpeedMps = (last.avgSpeedMps * lastSpan + window.speedMps * windowSpan) / totalSpan;
      last.avgAltM = (last.avgAltM * lastSpan + window.altM * windowSpan) / totalSpan;
      last.endSec = window.endSec;
      continue;
    }

    segments.push({
      startSec: window.startSec,
      endSec: window.endSec,
      energy,
      avgSpeedMps: window.speedMps,
      avgAltM: window.altM,
      suggestedMoods: ENERGY_MOODS[energy],
    });
  }

  return segments;
}

/**
 * Bitisik ve ayni enerjili bolumleri tek bolume indirir.
 * Emme/azaltma islemlerinden sonra cagrilmali: aksi halde ayni enerjide
 * iki komsu bolum kalir ve ayni muzik ust uste secilip gereksiz gecis olusur.
 */
function coalesce(segments: MusicSegment[]): MusicSegment[] {
  const result: MusicSegment[] = [];

  for (const segment of segments) {
    const last = result[result.length - 1];

    if (last && last.energy === segment.energy) {
      const lastSpan = last.endSec - last.startSec;
      const span = segment.endSec - segment.startSec;
      const total = lastSpan + span;

      last.avgSpeedMps = (last.avgSpeedMps * lastSpan + segment.avgSpeedMps * span) / total;
      last.avgAltM = (last.avgAltM * lastSpan + segment.avgAltM * span) / total;
      last.endSec = segment.endSec;
      continue;
    }

    result.push({ ...segment });
  }

  return result;
}

/**
 * Video suresine gore parca tavani.
 * Kisa videolarda taban (3) gecerlidir; uzun videolarda her ~5 dakika icin
 * bir parca hakki eklenir ve sert tavanda (6) durur.
 */
export function maxTracksFor(durationSec: number): number {
  const byDuration = Math.ceil(durationSec / MUSIC_SEGMENT.SEC_PER_EXTRA_TRACK);
  return Math.min(
    MUSIC_SEGMENT.HARD_MAX_TRACKS,
    Math.max(MUSIC_SEGMENT.BASE_MAX_TRACKS, byDuration),
  );
}

/**
 * Video suresine gore en kisa bolum suresi.
 * Uzun videoda kisa bolum, kisa videoda uzun bolum ayni derecede yanlistir.
 */
export function minSegmentFor(durationSec: number): number {
  return Math.max(
    MUSIC_SEGMENT.BASE_MIN_SEGMENT_SEC,
    durationSec * MUSIC_SEGMENT.MIN_SEGMENT_DURATION_RATIO,
  );
}

/** Cok kisa bolumleri komsusuna katar - sik muzik degisimi izleyiciyi yorar. */
function absorbShortSegments(segments: MusicSegment[], minSegmentSec: number): MusicSegment[] {
  if (segments.length <= 1) return segments;

  const result = [...segments];

  for (let i = 0; i < result.length; i += 1) {
    const segment = result[i]!;
    if (segment.endSec - segment.startSec >= minSegmentSec) continue;
    if (result.length === 1) break;

    // Daha uzun komsuya katilir; esitlikte oncekine.
    const prev = result[i - 1];
    const next = result[i + 1];
    const prevSpan = prev ? prev.endSec - prev.startSec : -1;
    const nextSpan = next ? next.endSec - next.startSec : -1;

    if (prev && prevSpan >= nextSpan) {
      prev.endSec = segment.endSec;
    } else if (next) {
      next.startSec = segment.startSec;
    }

    result.splice(i, 1);
    i -= 1;
  }

  return result;
}

/**
 * Videonun muzik bolumlerini cikarir. Her bolum kendi enerjisine uygun
 * bir soundtrack alir; boylece tek videoda hizli gecis ve yakin plan
 * sahneleri farkli parcalarla desteklenir.
 *
 * @param track Klibin ucus izi
 * @param clipDurationSec Klip suresi
 * @param source Kaynak tipi - GoPro aksiyon cekimleri bir kademe yukari alinir
 * @returns Zamana gore sirali muzik bolumleri (telemetri yoksa tek bolum)
 */
export function planMusicSegments(
  track: TrackPoint[],
  clipDurationSec: number,
  source: ClipSource = 'dji',
): MusicSegment[] {
  const windows = buildWindows(track, clipDurationSec);

  // Telemetri yoksa video tek parcayla dosenir - eski davranis korunur.
  if (windows.length === 0) {
    Logger.debug('Telemetri yok - muzik tek bolum olarak planlaniyor');
    return [
      {
        startSec: 0,
        endSec: clipDurationSec,
        energy: 'medium',
        avgSpeedMps: 0,
        avgAltM: 0,
        suggestedMoods: ENERGY_MOODS.medium,
      },
    ];
  }

  const maxTracks = maxTracksFor(clipDurationSec);
  const minSegmentSec = minSegmentFor(clipDurationSec);

  let segments = coalesce(absorbShortSegments(mergeWindows(windows, source), minSegmentSec));

  // Parca sayisi tavani: en kisa bolumler komsusuna katilarak azaltilir.
  while (segments.length > maxTracks) {
    let shortestIndex = 0;
    let shortestSpan = Number.POSITIVE_INFINITY;

    segments.forEach((segment, index) => {
      const span = segment.endSec - segment.startSec;
      if (span < shortestSpan) {
        shortestSpan = span;
        shortestIndex = index;
      }
    });

    const shortest = segments[shortestIndex]!;
    const prev = segments[shortestIndex - 1];
    const next = segments[shortestIndex + 1];

    if (prev) prev.endSec = shortest.endSec;
    else if (next) next.startSec = shortest.startSec;

    segments = coalesce(segments.filter((_, index) => index !== shortestIndex));
  }

  // Son bolum klip sonuna kadar uzatilir.
  const last = segments[segments.length - 1];
  if (last && last.endSec < clipDurationSec) last.endSec = clipDurationSec;

  Logger.info(
    `Muzik bolumleri (tavan ${maxTracks}, en kisa ${minSegmentSec.toFixed(0)}sn): ${segments
      .map((s) => `${s.energy}(${(s.endSec - s.startSec).toFixed(0)}sn)`)
      .join(' -> ')}`,
  );
  return segments;
}
