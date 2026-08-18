// =====================================
// MODULE: TTS Types
// Purpose: Seslendirme saglayicilari icin ortak sozlesme
// Dependencies: yok
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

export interface TtsRequest {
  text: string;
  /** Karakter sesi kimligi - saglayiciya gore model yolu, ses id'si veya referans ornek */
  voiceRef: string;
  outputPath: string;
  /** 1.0 normal; ranking hattinda tempo icin hafif hizlandirilir */
  speed?: number;
}

export interface TtsResult {
  outputPath: string;
  durationSec: number;
  provider: string;
  costUsd: number;
}

export interface TtsProvider {
  name: string;
  /** Ucretsiz/yerel mi - router once bunlari dener */
  free: boolean;
  isConfigured(): Promise<boolean>;
  synthesize(request: TtsRequest): Promise<TtsResult>;
}
