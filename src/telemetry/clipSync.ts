// =====================================
// MODULE: Clip Sync
// Purpose: Drone ve GoPro kliplerini GPS + gercek zaman uzerinden eslestirir
// Dependencies: telemetry/types, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { Logger } from '../core/logger.js';
import type { ClipOverlap, ClipTrack, TrackPoint } from './types.js';

const EARTH_RADIUS_M = 6_371_000;

/** Iki kameranin ayni sahneyi cektigini kabul ettigimiz azami mesafe (metre). */
const MAX_PAIR_DISTANCE_M = 500;
/** Bir eslesmenin kurguda kullanilabilmesi icin gereken en kisa ortak sure. */
const MIN_OVERLAP_SEC = 2;
/** Mesafe orneklemesinde kullanilan adim (saniye). */
const SAMPLE_STEP_SEC = 1;

/**
 * Iki koordinat arasindaki buyuk daire mesafesi.
 * @returns Metre cinsinden mesafe
 */
export function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Klibin gercek zaman araligini dondurur (telemetri yoksa null). */
function wallClockRange(clip: ClipTrack): { startMs: number; endMs: number } | null {
  const start = clip.startWallClock ?? clip.points.find((p) => p.wallClock)?.wallClock ?? null;
  if (!start) return null;

  const last = clip.points[clip.points.length - 1];
  const spanSec = last ? last.tSec : clip.durationSec;
  return { startMs: start.getTime(), endMs: start.getTime() + spanSec * 1000 };
}

/** Verilen gercek zamana karsilik gelen klip-ici konumu bulur. */
function positionAtWallClock(clip: ClipTrack, targetMs: number, startMs: number): TrackPoint | null {
  const tSec = (targetMs - startMs) / 1000;
  if (clip.points.length === 0) return null;

  let closest: TrackPoint | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const point of clip.points) {
    const delta = Math.abs(point.tSec - tSec);
    if (delta < bestDelta) {
      bestDelta = delta;
      closest = point;
    }
  }

  return bestDelta <= SAMPLE_STEP_SEC * 2 ? closest : null;
}

/**
 * Bir drone klibi ile bir GoPro klibinin ayni ani cekip cekmedigini olcer.
 * @returns Eslesme veya kosullar saglanmiyorsa null
 */
export function findOverlap(drone: ClipTrack, gopro: ClipTrack): ClipOverlap | null {
  const droneRange = wallClockRange(drone);
  const goproRange = wallClockRange(gopro);
  if (!droneRange || !goproRange) return null;

  const startMs = Math.max(droneRange.startMs, goproRange.startMs);
  const endMs = Math.min(droneRange.endMs, goproRange.endMs);
  const overlapSec = (endMs - startMs) / 1000;
  if (overlapSec < MIN_OVERLAP_SEC) return null;

  const distances: number[] = [];
  for (let ms = startMs; ms <= endMs; ms += SAMPLE_STEP_SEC * 1000) {
    const dronePoint = positionAtWallClock(drone, ms, droneRange.startMs);
    const goproPoint = positionAtWallClock(gopro, ms, goproRange.startMs);
    if (!dronePoint || !goproPoint) continue;
    distances.push(haversineMeters(dronePoint, goproPoint));
  }

  if (distances.length === 0) return null;

  const avgDistanceM = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  if (avgDistanceM > MAX_PAIR_DISTANCE_M) return null;

  return {
    droneClipId: drone.clipId,
    goproClipId: gopro.clipId,
    droneRange: {
      startSec: (startMs - droneRange.startMs) / 1000,
      endSec: (endMs - droneRange.startMs) / 1000,
    },
    goproRange: {
      startSec: (startMs - goproRange.startMs) / 1000,
      endSec: (endMs - goproRange.startMs) / 1000,
    },
    overlapSec,
    avgDistanceM,
  };
}

/**
 * Tum klip havuzunda drone-GoPro eslesmelerini bulur.
 * Kurgu bu eslesmeleri A-roll (drone genis) / B-roll (GoPro yakin) olarak kullanir.
 * @param clips Telemetrisi cikarilmis klipler
 * @returns Ortak sureye gore azalan sirali eslesmeler
 */
export function matchClips(clips: ClipTrack[]): ClipOverlap[] {
  const drones = clips.filter((c) => c.source === 'dji');
  const gopros = clips.filter((c) => c.source === 'gopro');
  const overlaps: ClipOverlap[] = [];

  for (const drone of drones) {
    for (const gopro of gopros) {
      const overlap = findOverlap(drone, gopro);
      if (overlap) overlaps.push(overlap);
    }
  }

  overlaps.sort((a, b) => b.overlapSec - a.overlapSec);

  Logger.info(
    `Klip eslestirme: ${drones.length} drone x ${gopros.length} GoPro -> ${overlaps.length} ortak an`,
  );
  return overlaps;
}

/**
 * Dosya adindan kaynak tipini tahmin eder.
 * DJI: DJI_0001.MP4 / GoPro: GX010001.MP4, GH010001.MP4, GOPR0001.MP4
 */
export function guessSource(fileName: string): ClipTrack['source'] {
  const upper = fileName.toUpperCase();
  if (upper.startsWith('DJI_')) return 'dji';
  if (/^(GX|GH|GP|GOPR)/.test(upper)) return 'gopro';
  return 'unknown';
}
