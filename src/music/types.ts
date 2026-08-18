// =====================================
// MODULE: Music Types
// Purpose: Soundtrack kutuphanesi icin ortak yapi
// Dependencies: yok
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

/** Parcanin genel duygu tonu - tema ve gunun saatiyle eslesir. */
export type Mood =
  | 'epic'
  | 'chill'
  | 'uplifting'
  | 'cinematic'
  | 'dreamy'
  | 'energetic';

export interface MusicTrack {
  id: string;
  filePath: string;
  title: string;
  mood: Mood;
  durationSec: number;
  /** Dosya adindan veya elle verilen serbest etiketler (orn. "sunset", "drone") */
  tags: string[];
  /** Bu parcanin en son kullanildigi tarih - cesitlilik icin */
  lastUsedAt?: string;
}

export interface MusicQuery {
  /** Videonun temasi - "otel", "doga", "tarihi" gibi */
  theme: string;
  /** Cekimin (veya yayinin) gun icindeki saati - 0-23 */
  hourOfDay: number;
  /** Videonun suresi - parca en az bu kadar olmali, yoksa dongulenir */
  videoDurationSec: number;
  /** Bu kimlikler yakin zamanda kullanildi, mumkunse tekrarlanmasin */
  recentlyUsedIds?: string[];
}
