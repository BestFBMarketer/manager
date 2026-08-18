// =====================================
// MODULE: Manual Override
// Purpose: Otomatik GPS eslestirmesini elle ezme ve arsiv/stok goruntu ekleme
// Dependencies: telemetry/types, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { readFile } from 'node:fs/promises';
import { Logger } from '../core/logger.js';
import type { ClipOverlap } from './types.js';

/** Elle tanimlanmis drone-GoPro eslesmesi - GPS verisi olmasa da calisir. */
export interface ManualPair {
  droneClipId: string;
  goproClipId: string;
  droneStartSec: number;
  goproStartSec: number;
  durationSec: number;
  note?: string;
}

/** Telemetrisi olmayan arsiv/stok goruntu - zaman cizelgesine elle yerlestirilir. */
export interface StockClip {
  filePath: string;
  /** Kurguda hangi saniyede gosterilecegi */
  atSec: number;
  durationSec: number;
  /** Ekranda gosterilecek isteğe bagli etiket (orn. "Arsiv: 2024") */
  label?: string;
}

export interface OverrideManifest {
  /** Bu eslesmeler otomatik sonuclarin yerine gecer */
  manualPairs?: ManualPair[];
  /** Kurguya elle eklenecek stok goruntuler */
  stockClips?: StockClip[];
  /** Otomatik bulunmus olsa bile kullanilmayacak klipler */
  excludeClipIds?: string[];
}

function isManifest(value: unknown): value is OverrideManifest {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = value as Record<string, unknown>;

  const arraysOk = (['manualPairs', 'stockClips', 'excludeClipIds'] as const).every(
    (key) => manifest[key] === undefined || Array.isArray(manifest[key]),
  );
  return arraysOk;
}

/**
 * Override dosyasini okur. Dosya yoksa bos manifest doner - override istege baglidir.
 * @param path Manifest yolu (varsayilan: is klasorundeki override.json)
 */
export async function loadManifest(path: string): Promise<OverrideManifest> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (!isManifest(parsed)) {
      Logger.warn(`${path}: manifest bicimi taninmadi, yok sayiliyor`);
      return {};
    }

    const counts = [
      `${parsed.manualPairs?.length ?? 0} elle eslesme`,
      `${parsed.stockClips?.length ?? 0} stok klip`,
      `${parsed.excludeClipIds?.length ?? 0} haric tutulan`,
    ].join(', ');
    Logger.info(`Override yuklendi (${counts})`);
    return parsed;
  } catch (error) {
    // Dosya yoksa bu normal bir durumdur - sessizce bos manifest.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    Logger.warn(`Override okunamadi: ${path}`, error);
    return {};
  }
}

/**
 * Otomatik eslesmelere elle mudahaleleri uygular.
 * Oncelik sirasi: haric tutma > elle eslesme > otomatik eslesme.
 *
 * @param automatic GPS'ten turetilmis eslesmeler
 * @param manifest Elle tanimlanmis mudahaleler
 * @returns Kurguda kullanilacak nihai eslesme listesi
 */
export function applyOverrides(
  automatic: ClipOverlap[],
  manifest: OverrideManifest,
): ClipOverlap[] {
  const excluded = new Set(manifest.excludeClipIds ?? []);
  const manualPairs = manifest.manualPairs ?? [];

  // Elle tanimlanan cift, ayni klipler icin bulunan otomatik eslesmeyi ezer.
  const overriddenKeys = new Set(
    manualPairs.map((pair) => `${pair.droneClipId}|${pair.goproClipId}`),
  );

  const kept = automatic.filter((overlap) => {
    if (excluded.has(overlap.droneClipId) || excluded.has(overlap.goproClipId)) return false;
    return !overriddenKeys.has(`${overlap.droneClipId}|${overlap.goproClipId}`);
  });

  const manual: ClipOverlap[] = manualPairs
    .filter((pair) => !excluded.has(pair.droneClipId) && !excluded.has(pair.goproClipId))
    .map((pair) => ({
      droneClipId: pair.droneClipId,
      goproClipId: pair.goproClipId,
      droneRange: { startSec: pair.droneStartSec, endSec: pair.droneStartSec + pair.durationSec },
      goproRange: { startSec: pair.goproStartSec, endSec: pair.goproStartSec + pair.durationSec },
      overlapSec: pair.durationSec,
      // Elle eslesmede mesafe olculmez; kurgu bunu "dogrulanmis" kabul eder.
      avgDistanceM: 0,
    }));

  const result = [...manual, ...kept].sort((a, b) => b.overlapSec - a.overlapSec);
  const dropped = automatic.length - kept.length;
  Logger.info(
    `Eslesme: ${automatic.length} otomatik -> ${result.length} nihai ` +
      `(${manual.length} elle eklendi, ${dropped} otomatik ezildi/elendi)`,
  );
  return result;
}
