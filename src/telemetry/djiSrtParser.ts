// =====================================
// MODULE: DJI SRT Parser
// Purpose: DJI ucus telemetrisini (.SRT) zaman damgali GPS noktalarina cevirir
// Dependencies: config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { readFile } from 'node:fs/promises';
import { TELEMETRY } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import type { TrackPoint } from './types.js';

/** Geriye donuk uyumluluk icin eski ad - GoPro ile ortak yapiya isaret eder. */
export type FlightPoint = TrackPoint;

// SRT bloklarindaki gercek zaman satiri: "2026-08-01 11:20:31,123"
const WALL_CLOCK = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})[.,]?(\d{0,3})/;

const TIME_RANGE = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->/;

// Yeni modeller: [latitude: 36.85] [longitude: 30.78] [rel_alt: 42.1 ...]
const BRACKET_LAT = /\[latitude\s*:\s*(-?\d+\.?\d*)\]/i;
const BRACKET_LON = /\[long?itude\s*:\s*(-?\d+\.?\d*)\]/i;
const BRACKET_ALT = /\[rel_alt\s*:\s*(-?\d+\.?\d*)/i;

// Eski modeller: GPS(30.78,36.85,20) veya GPS(30.78, 36.85, 20)
const LEGACY_GPS = /GPS\s*\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\)/i;
const LEGACY_ALT = /(?:REL_ALT|H)\s*[:=]\s*(-?\d+\.?\d*)/i;

function timeToSeconds(block: string): number | null {
  const match = block.match(TIME_RANGE);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

/**
 * Blok icindeki cekim zamanini okur. Bu deger GoPro kliplerinin GPS
 * zamaniyla karsilastirilarak ayni anin iki acisi eslestirilir; olmadan
 * drone-GoPro senkronu calismaz.
 */
function extractWallClock(block: string): Date | null {
  const match = block.match(WALL_CLOCK);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, ms] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number((ms ?? '').padEnd(3, '0')),
    ),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function extractPoint(block: string): { lat: number; lon: number; relAlt: number } | null {
  const bracketLat = block.match(BRACKET_LAT);
  const bracketLon = block.match(BRACKET_LON);

  if (bracketLat?.[1] && bracketLon?.[1]) {
    return {
      lat: Number(bracketLat[1]),
      lon: Number(bracketLon[1]),
      relAlt: Number(block.match(BRACKET_ALT)?.[1] ?? 0),
    };
  }

  const legacy = block.match(LEGACY_GPS);
  if (legacy?.[1] && legacy[2]) {
    // Eski formatta sira (boylam, enlem, ...) seklindedir.
    return {
      lon: Number(legacy[1]),
      lat: Number(legacy[2]),
      relAlt: Number(block.match(LEGACY_ALT)?.[1] ?? legacy[3] ?? 0),
    };
  }

  return null;
}

function isPlausible(point: { lat: number; lon: number }): boolean {
  const { lat, lon } = point;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  // 0,0 (Gine Korfezi) pratikte GPS kilidi olmadan yazilan bos degerdir.
  return !(lat === 0 && lon === 0);
}

/**
 * DJI .SRT dosyasini ayristirir. Format farkliliklarina ve GPS kilidi
 * olmayan bloklara toleransldir.
 * @param srtPath .SRT dosyasinin yolu
 * @returns Zamana gore sirali ucus noktalari (yetersizse bos dizi)
 */
export async function parseDjiSrt(srtPath: string): Promise<TrackPoint[]> {
  try {
    const raw = await readFile(srtPath, 'utf8');
    const blocks = raw.split(/\r?\n\r?\n/).filter((block) => block.trim().length > 0);
    const points: TrackPoint[] = [];

    for (const block of blocks) {
      const tSec = timeToSeconds(block);
      if (tSec === null) continue;

      const coords = extractPoint(block);
      if (!coords || !isPlausible(coords)) continue;

      points.push({
        tSec,
        lat: coords.lat,
        lon: coords.lon,
        alt: coords.relAlt,
        wallClock: extractWallClock(block),
      });
    }

    points.sort((a, b) => a.tSec - b.tSec);

    if (points.length < TELEMETRY.MIN_POINTS) {
      Logger.warn(
        `${srtPath}: sadece ${points.length} gecerli GPS noktasi bulundu - telemetri kullanilmayacak. ` +
          'DJI Fly icinde "Video Captions" ayari cekim oncesi acik olmali.',
      );
      return [];
    }

    Logger.success(`${srtPath}: ${points.length} ucus noktasi ayristirildi`);
    return points;
  } catch (error) {
    Logger.warn(`SRT okunamadi: ${srtPath}`, error);
    return [];
  }
}

/**
 * Verilen ana karsilik gelen konumu iki komsu nokta arasinda enterpolasyonla bulur.
 * Harita katmani her kare icin bunu cagirir.
 * @param points parseDjiSrt ciktisi (zamana gore sirali)
 * @param tSec Video zamani (saniye)
 * @returns Konum veya bulunamazsa null
 */
export function positionAt(points: TrackPoint[], tSec: number): TrackPoint | null {
  if (points.length === 0) return null;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (tSec <= first.tSec) return first;
  if (tSec >= last.tSec) return last;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    if (tSec > next.tSec) continue;

    const gap = next.tSec - prev.tSec;
    // Cok buyuk bosluklarda enterpolasyon yaniltici olur; en yakin noktayi ver.
    if (gap > TELEMETRY.MAX_GAP_SEC) {
      return tSec - prev.tSec < next.tSec - tSec ? prev : next;
    }

    const ratio = gap === 0 ? 0 : (tSec - prev.tSec) / gap;
    return {
      tSec,
      lat: prev.lat + (next.lat - prev.lat) * ratio,
      lon: prev.lon + (next.lon - prev.lon) * ratio,
      alt: prev.alt + (next.alt - prev.alt) * ratio,
      wallClock: prev.wallClock,
    };
  }

  return last;
}

/** Ucus izinin sinir kutusu - harita zoom seviyesini belirlemek icin. */
export function boundingBox(points: TrackPoint[]): {
  minLat: number; maxLat: number; minLon: number; maxLon: number;
} | null {
  if (points.length === 0) return null;

  return points.reduce(
    (box, point) => ({
      minLat: Math.min(box.minLat, point.lat),
      maxLat: Math.max(box.maxLat, point.lat),
      minLon: Math.min(box.minLon, point.lon),
      maxLon: Math.max(box.maxLon, point.lon),
    }),
    { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 },
  );
}
