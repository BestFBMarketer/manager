// =====================================
// MODULE: Flight Cluster
// Purpose: Klipleri bolgeye ve cekim gunune gore gruplar; ayni yerin farkli
//          tarihlerdeki cekimlerini bir araya getirir
// Dependencies: telemetry/*, config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { CLUSTER } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import { haversineMeters } from './clipSync.js';
import type { ClipTrack } from './types.js';

export interface ClipSummary {
  clip: ClipTrack;
  centroid: { lat: number; lon: number };
  /** Cekim ani - SRT/GPMF saatinden; yoksa null */
  shotAt: Date | null;
  /** Yerel takvim gunu (YYYY-MM-DD) - ayni gunun cekimlerini gruplamak icin */
  dayKey: string | null;
}

export interface FlightCluster {
  id: string;
  /** Bolgenin merkezi */
  centroid: { lat: number; lon: number };
  clips: ClipSummary[];
  /** Bu bolgede cekim yapilan farkli gunler */
  dayKeys: string[];
  /** Ayni gun ardisik cekilmis alt gruplar (batarya degisimi arasi seriler) */
  sessions: ClipSummary[][];
}

function centroidOf(clip: ClipTrack): { lat: number; lon: number } | null {
  if (clip.points.length === 0) return null;
  return {
    lat: clip.points.reduce((sum, p) => sum + p.lat, 0) / clip.points.length,
    lon: clip.points.reduce((sum, p) => sum + p.lon, 0) / clip.points.length,
  };
}

function summarize(clip: ClipTrack): ClipSummary | null {
  const centroid = centroidOf(clip);
  if (!centroid) return null;

  const shotAt = clip.startWallClock ?? clip.points.find((p) => p.wallClock)?.wallClock ?? null;

  return {
    clip,
    centroid,
    shotAt,
    dayKey: shotAt ? shotAt.toISOString().slice(0, 10) : null,
  };
}

/**
 * Ayni gun ardisik cekilmis klipleri seri (session) olarak ayirir.
 * DJI Neo bataryasi ~7-12 dakika dayandigi icin bir bolge genelde
 * pes pese birkac ucusla cekilir; bunlar tek bir cekim seansidir.
 */
function splitSessions(clips: ClipSummary[]): ClipSummary[][] {
  const timed = clips.filter((entry) => entry.shotAt).sort(
    (a, b) => a.shotAt!.getTime() - b.shotAt!.getTime(),
  );
  const untimed = clips.filter((entry) => !entry.shotAt);

  const sessions: ClipSummary[][] = [];
  let current: ClipSummary[] = [];

  for (const entry of timed) {
    const previous = current[current.length - 1];

    if (
      previous &&
      entry.shotAt!.getTime() - previous.shotAt!.getTime() > CLUSTER.SESSION_GAP_MIN * 60_000
    ) {
      sessions.push(current);
      current = [];
    }

    current.push(entry);
  }

  if (current.length > 0) sessions.push(current);
  // Zamansiz klipler kendi basina bir seans sayilir.
  if (untimed.length > 0) sessions.push(untimed);

  return sessions;
}

/**
 * Klipleri cografi bolgelere gore kumeler.
 *
 * Ayni otelin/bolgenin farkli tarihlerdeki cekimleri ayni kumede toplanir;
 * kurgu bunlari birlikte degerlendirip gunduz-gece eslesmesi kurabilir.
 *
 * @param tracks Telemetrisi cikarilmis klipler
 * @returns Bolge kumeleri (klip sayisina gore azalan)
 */
export function clusterFlights(tracks: ClipTrack[]): FlightCluster[] {
  const summaries = tracks
    .map(summarize)
    .filter((entry): entry is ClipSummary => entry !== null);

  const clusters: FlightCluster[] = [];

  for (const summary of summaries) {
    // En yakin kumeye katilir; hicbiri yeterince yakin degilse yeni kume acilir.
    let best: { cluster: FlightCluster; distanceM: number } | null = null;

    for (const cluster of clusters) {
      const distanceM = haversineMeters(summary.centroid, cluster.centroid);
      if (distanceM > CLUSTER.REGION_RADIUS_M) continue;
      if (!best || distanceM < best.distanceM) best = { cluster, distanceM };
    }

    if (best) {
      best.cluster.clips.push(summary);
      // Merkez, yeni klip eklendikce guncellenir.
      const count = best.cluster.clips.length;
      best.cluster.centroid = {
        lat: best.cluster.centroid.lat + (summary.centroid.lat - best.cluster.centroid.lat) / count,
        lon: best.cluster.centroid.lon + (summary.centroid.lon - best.cluster.centroid.lon) / count,
      };
      continue;
    }

    clusters.push({
      id: `region-${clusters.length + 1}`,
      centroid: { ...summary.centroid },
      clips: [summary],
      dayKeys: [],
      sessions: [],
    });
  }

  for (const cluster of clusters) {
    cluster.dayKeys = [...new Set(cluster.clips.map((c) => c.dayKey).filter((k): k is string => k !== null))].sort();
    cluster.sessions = splitSessions(cluster.clips);
  }

  clusters.sort((a, b) => b.clips.length - a.clips.length);

  Logger.info(
    `Ucus kumeleme: ${tracks.length} klip -> ${clusters.length} bolge ` +
      `(${clusters.map((c) => `${c.clips.length} klip/${c.dayKeys.length} gun`).join(', ')})`,
  );
  return clusters;
}
