// =====================================
// MODULE: GoPro GPMF
// Purpose: GoPro MP4 icine gomulu GPS telemetrisini ortak TrackPoint yapisina cevirir
// Dependencies: gpmf-extract, gopro-telemetry, telemetry/types, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { readFile } from 'node:fs/promises';
import { TELEMETRY } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import type { TrackPoint } from './types.js';

// Bu iki paketin tip tanimi CommonJS oldugundan dinamik import ile yuklenir.
type GpmfExtractResult = { rawData: Buffer; timing?: unknown };

interface GpsSample {
  /** Klibin basindan itibaren milisaniye */
  cts?: number;
  date?: string | Date;
  /** GPS5: [lat, lon, alt, speed2d, speed3d] - GPS9 ek alanlar tasir */
  value?: number[];
}

interface TelemetryOutput {
  [deviceId: string]: {
    streams?: {
      [streamKey: string]: { samples?: GpsSample[] };
    };
  };
}

function toTrackPoints(output: TelemetryOutput): TrackPoint[] {
  const points: TrackPoint[] = [];

  for (const device of Object.values(output)) {
    for (const [streamKey, stream] of Object.entries(device.streams ?? {})) {
      if (!streamKey.startsWith('GPS')) continue;

      for (const sample of stream.samples ?? []) {
        const value = sample.value;
        if (!value || value.length < 3) continue;

        const [lat, lon, alt] = value;
        if (typeof lat !== 'number' || typeof lon !== 'number') continue;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
        if (lat === 0 && lon === 0) continue;

        points.push({
          tSec: (sample.cts ?? 0) / 1000,
          lat,
          lon,
          alt: typeof alt === 'number' ? alt : 0,
          wallClock: sample.date ? new Date(sample.date) : null,
        });
      }
    }
  }

  points.sort((a, b) => a.tSec - b.tSec);
  return points;
}

/**
 * GoPro videosundan (Hero5 ve sonrasi) GPS izini cikarir.
 * @param videoPath .MP4 dosyasinin yolu
 * @returns Zamana gore sirali izleme noktalari (telemetri yoksa bos dizi)
 */
export async function parseGoproTelemetry(videoPath: string): Promise<TrackPoint[]> {
  try {
    const [{ default: gpmfExtract }, { default: goproTelemetry }] = await Promise.all([
      import('gpmf-extract') as Promise<{ default: (input: Buffer) => Promise<GpmfExtractResult> }>,
      import('gopro-telemetry') as Promise<{
        default: (input: GpmfExtractResult, options: Record<string, unknown>) => Promise<TelemetryOutput>;
      }>,
    ]);

    const file = await readFile(videoPath);
    const extracted = await gpmfExtract(file);

    const output = await goproTelemetry(extracted, {
      // 'GPS' otomatik olarak eski kameralarda GPS5, yenilerde GPS9 secer
      stream: 'GPS',
      GPS5Fix: TELEMETRY.GPS_FIX_MIN,
      GPS5Precision: TELEMETRY.GPS_PRECISION_MAX,
    });

    const points = toTrackPoints(output);

    if (points.length < TELEMETRY.MIN_POINTS) {
      Logger.warn(`${videoPath}: yeterli GoPro GPS noktasi yok (${points.length}) - telemetri kullanilmayacak`);
      return [];
    }

    Logger.success(`${videoPath}: ${points.length} GoPro GPS noktasi cikarildi`);
    return points;
  } catch (error) {
    Logger.warn(`GoPro telemetrisi okunamadi: ${videoPath}`, error);
    return [];
  }
}

/**
 * gpmf-extract ciktisini (test amacli .raw tamponlari) dogrudan ayristirir.
 * @param rawData GPMF ham tamponu
 */
export async function parseGoproRaw(rawData: Buffer): Promise<TrackPoint[]> {
  try {
    const { default: goproTelemetry } = (await import('gopro-telemetry')) as unknown as {
      default: (input: GpmfExtractResult, options: Record<string, unknown>) => Promise<TelemetryOutput>;
    };

    const output = await goproTelemetry({ rawData }, {
      stream: 'GPS',
      GPS5Fix: TELEMETRY.GPS_FIX_MIN,
      GPS5Precision: TELEMETRY.GPS_PRECISION_MAX,
    });

    return toTrackPoints(output);
  } catch (error) {
    Logger.warn('GoPro ham telemetrisi ayristirilamadi', error);
    return [];
  }
}
