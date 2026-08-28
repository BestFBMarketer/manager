// =====================================
// MODULE: Speed Planner
// Purpose: Ham ucus goruntusunu akici bir kurguya cevirir - gereksiz yerleri
//          atar, yavas gecisleri hizlandirir, guzel hizli anlari korur
// Dependencies: telemetry/*, config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { SPEED } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import { haversineMeters } from '../telemetry/clipSync.js';
import type { TrackPoint } from '../telemetry/types.js';

export type SpeedAction = 'keep' | 'speedup' | 'slowdown' | 'drop';

export interface SpeedSegment {
  /** Kaynak videodaki aralik */
  startSec: number;
  endSec: number;
  action: SpeedAction;
  /** 1.0 = normal, 2.5 = %250 hiz, 0.75 = hafif agir cekim */
  factor: number;
  speedMps: number;
  altM: number;
  reason: string;
}

export interface SpeedPlan {
  segments: SpeedSegment[];
  /** Kaynak malzemenin toplam suresi */
  sourceDurationSec: number;
  /** Plan uygulandiktan sonraki sure */
  outputDurationSec: number;
}

interface Window {
  startSec: number;
  endSec: number;
  speedMps: number;
  altM: number;
  /** Goruntu analizi sinyali (0-1): 0 = hicbir sey degismiyor */
  sceneChange?: number;
}

/** Telemetriden hiz/irtifa pencereleri cikarir. */
function buildWindows(track: TrackPoint[]): Window[] {
  if (track.length < 2) return [];

  const windows: Window[] = [];
  const last = track[track.length - 1]!;

  for (let start = track[0]!.tSec; start < last.tSec; start += SPEED.WINDOW_SEC) {
    const end = start + SPEED.WINDOW_SEC;
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
 * Bir pencereye ne yapilacagini belirler.
 *
 * Goruntu analizi sinyali (sceneChange) varsa telemetriyi ezer: yavas ucusta
 * bile kadrajda cok sey oluyorsa (yakin gecis, hareketli ozne) hizlandirilmaz.
 */
function decide(window: Window): { action: SpeedAction; factor: number; reason: string } {
  const { speedMps, altM, sceneChange } = window;

  // Yerde gecen sureler kurguya girmez.
  if (altM < SPEED.GROUND_ALT_M) {
    return { action: 'drop', factor: 0, reason: 'yerde/kalkis oncesi' };
  }

  // Kadrajda belirgin hareket varsa yavas ucus bile ilginctir.
  const visuallyBusy = sceneChange !== undefined && sceneChange > 0.35;

  if (speedMps < SPEED.STATIC_SPEED_MPS && !visuallyBusy) {
    return { action: 'speedup', factor: SPEED.FACTOR_STATIC, reason: 'hareketsiz hover' };
  }

  if (speedMps < SPEED.SLOW_SPEED_MPS) {
    return visuallyBusy
      ? { action: 'keep', factor: SPEED.FACTOR_NORMAL, reason: 'yavas ama kadraj hareketli' }
      : { action: 'speedup', factor: SPEED.FACTOR_SLOW, reason: 'yavas gecis' };
  }

  if (speedMps < SPEED.MODERATE_SPEED_MPS) {
    return visuallyBusy
      ? { action: 'keep', factor: SPEED.FACTOR_NORMAL, reason: 'orta tempo, kadraj dolu' }
      : { action: 'speedup', factor: SPEED.FACTOR_MODERATE, reason: 'orta tempo' };
  }

  if (speedMps > SPEED.WHIP_SPEED_MPS) {
    // Otomatik donuslerde yakalanan guzel goruntu - hafif agir cekim izlenebilir kilar
    return { action: 'slowdown', factor: SPEED.FACTOR_WHIP, reason: 'hizli donus/savrulma' };
  }

  return { action: 'keep', factor: SPEED.FACTOR_NORMAL, reason: 'iyi tempo' };
}

/** Ardisik ayni kararli pencereleri birlestirir. */
function mergeDecisions(windows: Window[]): SpeedSegment[] {
  const segments: SpeedSegment[] = [];

  for (const window of windows) {
    const decision = decide(window);
    const last = segments[segments.length - 1];

    if (last && last.action === decision.action && last.factor === decision.factor) {
      const lastSpan = last.endSec - last.startSec;
      const span = window.endSec - window.startSec;
      const total = lastSpan + span;

      last.speedMps = (last.speedMps * lastSpan + window.speedMps * span) / total;
      last.altM = (last.altM * lastSpan + window.altM * span) / total;
      last.endSec = window.endSec;
      continue;
    }

    segments.push({
      startSec: window.startSec,
      endSec: window.endSec,
      action: decision.action,
      factor: decision.factor,
      speedMps: window.speedMps,
      altM: window.altM,
      reason: decision.reason,
    });
  }

  return segments;
}

/** Cok kisa parcalari temizler: goz tirmalayan bir saniyelik kesitler olusmasin. */
function removeSlivers(segments: SpeedSegment[]): SpeedSegment[] {
  const result: SpeedSegment[] = [];

  for (const segment of segments) {
    const span = segment.endSec - segment.startSec;
    const last = result[result.length - 1];

    if (span < SPEED.MIN_KEEP_SEC && last) {
      // Kisa parca komsusuna katilir; atilan parca ise sadece yutulur.
      last.endSec = segment.endSec;
      continue;
    }

    result.push({ ...segment });
  }

  return result;
}

/** Segmentin cikti suresi (atilanlar sifir surer). */
function outputSpan(segment: SpeedSegment): number {
  if (segment.action === 'drop') return 0;
  return (segment.endSec - segment.startSec) / segment.factor;
}

/**
 * Hedef sureye ulasmak icin hizlandirmayi kademeli artirir.
 * Once en sikici bolumler (hover, yavas gecis) sikistirilir; iyi tempolu
 * ve agir cekim bolumlere son ana kadar dokunulmaz.
 */
function fitToTarget(segments: SpeedSegment[], targetSec: number): SpeedSegment[] {
  const result = segments.map((segment) => ({ ...segment }));
  const total = () => result.reduce((sum, segment) => sum + outputSpan(segment), 0);

  if (total() <= targetSec) return result;

  // Sikistirma onceligi: once hizlandirilmis bolumler, sonra normal tempolu olanlar.
  const order: SpeedAction[] = ['speedup', 'keep'];

  for (const action of order) {
    const targets = result.filter((segment) => segment.action === action);

    for (const segment of targets) {
      if (total() <= targetSec) break;

      const excess = total() - targetSec;
      const span = segment.endSec - segment.startSec;
      const currentOut = outputSpan(segment);
      const desiredOut = Math.max(SPEED.MIN_KEEP_SEC, currentOut - excess);
      const neededFactor = span / desiredOut;

      segment.factor = Math.min(SPEED.MAX_FACTOR, Math.max(segment.factor, neededFactor));
      if (segment.action === 'keep' && segment.factor > 1) {
        segment.action = 'speedup';
        segment.reason = `${segment.reason} (hedef sureye sigdirildi)`;
      }
    }
  }

  return result;
}

/**
 * Ham ucus goruntusu icin kurgu plani uretir.
 *
 * @param track Klibin ucus izi
 * @param sourceDurationSec Ham klip suresi
 * @param options targetDurationSec verilirse plan o sureye sigdirilir;
 *                sceneScores verilirse goruntu analizi telemetriyi tamamlar
 * @returns Segment bazli hiz plani
 */
export function planSpeed(
  track: TrackPoint[],
  sourceDurationSec: number,
  options: { targetDurationSec?: number; sceneScores?: Array<{ tSec: number; score: number }> } = {},
): SpeedPlan {
  const windows = buildWindows(track);

  if (windows.length === 0) {
    Logger.warn('Telemetri yok - hiz optimizasyonu atlaniyor, klip oldugu gibi kullanilacak');
    return {
      segments: [
        {
          startSec: 0,
          endSec: sourceDurationSec,
          action: 'keep',
          factor: 1,
          speedMps: 0,
          altM: 0,
          reason: 'telemetri yok',
        },
      ],
      sourceDurationSec,
      outputDurationSec: sourceDurationSec,
    };
  }

  // Goruntu analizi skorlari varsa pencerelere islenir.
  if (options.sceneScores?.length) {
    for (const window of windows) {
      const inWindow = options.sceneScores.filter(
        (entry) => entry.tSec >= window.startSec && entry.tSec < window.endSec,
      );
      if (inWindow.length > 0) {
        window.sceneChange = Math.max(...inWindow.map((entry) => entry.score));
      }
    }
  }

  let segments = removeSlivers(mergeDecisions(windows));
  if (options.targetDurationSec) {
    segments = fitToTarget(segments, options.targetDurationSec);
  }

  let outputDurationSec = segments.reduce((sum, segment) => sum + outputSpan(segment), 0);
  let kept = segments.filter((segment) => segment.action !== 'drop');

  // Tum bolumler "yerde/kalkis oncesi" sayilip atildiysa (orn. dusuk irtifada
  // seyreden gercek bir cekim) is'i cokertmek yerine ham klibi oldugu gibi
  // kullan - telemetri-yok yolundaki fallback ile ayni mantik.
  if (kept.length === 0) {
    Logger.warn('Hiz plani tum bolumleri atti (dusuk irtifa) - klip oldugu gibi kullanilacak');
    segments = [
      {
        startSec: 0,
        endSec: sourceDurationSec,
        action: 'keep',
        factor: 1,
        speedMps: 0,
        altM: 0,
        reason: 'tum bolumler atilmisti, ham klip korundu',
      },
    ];
    outputDurationSec = sourceDurationSec;
    kept = segments;
  }
  Logger.info(
    `Hiz plani: ${sourceDurationSec.toFixed(0)}sn -> ${outputDurationSec.toFixed(0)}sn ` +
      `(${segments.length - kept.length} bolum atildi, ` +
      `${kept.filter((s) => s.factor > 1).length} bolum hizlandirildi)`,
  );

  return { segments, sourceDurationSec, outputDurationSec };
}
