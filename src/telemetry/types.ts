// =====================================
// MODULE: Telemetry Types
// Purpose: DJI ve GoPro telemetrisi icin ortak veri yapisi
// Dependencies: yok
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

export type ClipSource = 'dji' | 'gopro' | 'unknown';

export interface TrackPoint {
  /** Klibin basindan itibaren saniye */
  tSec: number;
  lat: number;
  lon: number;
  /** Metre - DJI'da kalkisa gore, GoPro'da deniz seviyesine gore */
  alt: number;
  /** GPS'ten gelen gercek zaman - iki kaynagi hizalamak icin (yoksa null) */
  wallClock: Date | null;
}

export interface ClipTrack {
  /** Dosya icerik hash'i + cekim tarihinden turetilen kimlik */
  clipId: string;
  filePath: string;
  source: ClipSource;
  points: TrackPoint[];
  /** Klibin ilk karesinin gercek zamani (GPS'ten) */
  startWallClock: Date | null;
  durationSec: number;
}

/** Iki kaynaktan ayni ani gosteren eslesme. */
export interface ClipOverlap {
  droneClipId: string;
  goproClipId: string;
  /** Ortak zaman araliginin drone klibindeki karsiligi (saniye) */
  droneRange: { startSec: number; endSec: number };
  /** Ayni araligin GoPro klibindeki karsiligi */
  goproRange: { startSec: number; endSec: number };
  overlapSec: number;
  /** Ortak an boyunca iki kamera arasindaki ortalama mesafe (metre) */
  avgDistanceM: number;
}
