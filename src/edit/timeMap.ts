// =====================================
// MODULE: Time Map
// Purpose: Hiz plani uygulandiktan sonra kaynak zamanini cikti zamanina cevirir
// Dependencies: edit/speedPlanner
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import type { SpeedPlan } from './speedPlanner.js';

interface MapEntry {
  sourceStart: number;
  sourceEnd: number;
  outputStart: number;
  outputEnd: number;
  factor: number;
  dropped: boolean;
}

export interface TimeMap {
  entries: MapEntry[];
  outputDurationSec: number;
}

/**
 * Hiz planindan zaman haritasi kurar.
 *
 * Bu harita olmadan POI kartlari ve muzik bolumleri yanlis anda cikar:
 * kaynakta 120. saniyede olan bir sey, araya giren kesme ve hizlandirmalardan
 * sonra ciktida bambaska bir ana denk gelir.
 */
export function buildTimeMap(plan: SpeedPlan): TimeMap {
  const entries: MapEntry[] = [];
  let outputCursor = 0;

  for (const segment of plan.segments) {
    const dropped = segment.action === 'drop';
    const sourceSpan = segment.endSec - segment.startSec;
    const outputSpan = dropped ? 0 : sourceSpan / segment.factor;

    entries.push({
      sourceStart: segment.startSec,
      sourceEnd: segment.endSec,
      outputStart: outputCursor,
      outputEnd: outputCursor + outputSpan,
      factor: segment.factor,
      dropped,
    });

    outputCursor += outputSpan;
  }

  return { entries, outputDurationSec: outputCursor };
}

/**
 * Kaynak videodaki bir ani, kurgulanmis ciktidaki karsiligina cevirir.
 * @returns Cikti saniyesi; o an kurgudan atildiysa null
 */
export function sourceToOutput(map: TimeMap, sourceSec: number): number | null {
  for (const entry of map.entries) {
    if (sourceSec < entry.sourceStart || sourceSec >= entry.sourceEnd) continue;
    if (entry.dropped) return null;

    const offsetInSource = sourceSec - entry.sourceStart;
    return entry.outputStart + offsetInSource / entry.factor;
  }

  // Aralik disi kalan anlar en yakin sinira baglanir.
  const last = map.entries[map.entries.length - 1];
  if (last && sourceSec >= last.sourceEnd) return map.outputDurationSec;
  return null;
}

/**
 * Ciktidaki bir ani kaynak videodaki karsiligina cevirir.
 * Kurgu sonrasi bir kareyi ham malzemede bulmak icin kullanilir.
 */
export function outputToSource(map: TimeMap, outputSec: number): number | null {
  for (const entry of map.entries) {
    if (entry.dropped) continue;
    if (outputSec < entry.outputStart || outputSec >= entry.outputEnd) continue;

    const offsetInOutput = outputSec - entry.outputStart;
    return entry.sourceStart + offsetInOutput * entry.factor;
  }

  return null;
}

/**
 * Kaynak zamanina bagli olaylari (POI kartlari, muzik bolumleri) cikti
 * zaman eksenine tasir. Kurgudan atilan anlara denk gelen olaylar elenir.
 *
 * @param map buildTimeMap ciktisi
 * @param events Kaynak zamanli olaylar
 * @returns Cikti zamanli olaylar (atilanlar cikarilmis)
 */
export function remapEvents<T extends { atSec: number }>(
  map: TimeMap,
  events: T[],
): T[] {
  return events
    .map((event) => {
      const atSec = sourceToOutput(map, event.atSec);
      return atSec === null ? null : { ...event, atSec };
    })
    .filter((event): event is T => event !== null);
}

/**
 * Ucus izini kurgulanmis zaman eksenine tasir.
 *
 * Muzik bolumleri ve POI kartlari kurgu SONRASI telemetriye gore
 * hesaplanmalidir: hizlandirilmis bir bolumde drone'un algilanan hizi
 * degisir ve atilan bolumler iz uzerinde bosluk birakir.
 *
 * @param map buildTimeMap ciktisi
 * @param track Kaynak zamanli ucus izi
 * @returns Cikti zamanli iz (atilan bolumler cikarilmis)
 */
export function remapTrack<T extends { tSec: number }>(map: TimeMap, track: T[]): T[] {
  const result: T[] = [];

  for (const point of track) {
    const tSec = sourceToOutput(map, point.tSec);
    if (tSec === null) continue;
    result.push({ ...point, tSec });
  }

  return result;
}
