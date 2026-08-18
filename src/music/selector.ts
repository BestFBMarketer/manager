// =====================================
// MODULE: Music Selector
// Purpose: Temaya, gunun saatine ve sureye en uygun soundtrack'i secer
// Dependencies: music/types, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { Logger } from '../core/logger.js';
import type { Mood, MusicQuery, MusicTrack } from './types.js';

/** Gunun saati -> tercih edilen tonlar (ilk sirada olan en yuksek puani alir). */
const HOUR_MOODS: Array<{ from: number; to: number; moods: Mood[] }> = [
  { from: 5, to: 9, moods: ['dreamy', 'chill', 'uplifting'] },      // sabah
  { from: 9, to: 16, moods: ['uplifting', 'energetic', 'epic'] },   // gunduz
  { from: 16, to: 20, moods: ['cinematic', 'epic', 'dreamy'] },     // gun batimi
  { from: 20, to: 24, moods: ['chill', 'cinematic', 'dreamy'] },    // aksam
  { from: 0, to: 5, moods: ['chill', 'dreamy', 'cinematic'] },      // gece
];

/** Tema anahtar kelimesi -> tercih edilen tonlar. */
const THEME_MOODS: Record<string, Mood[]> = {
  otel: ['uplifting', 'chill', 'cinematic'],
  doga: ['cinematic', 'dreamy', 'epic'],
  tarihi: ['cinematic', 'epic', 'dreamy'],
  selale: ['epic', 'cinematic', 'energetic'],
  plaj: ['chill', 'uplifting', 'dreamy'],
  manzara: ['cinematic', 'dreamy', 'epic'],
};

const SCORE = {
  HOUR_TOP_MATCH: 30,
  THEME_TOP_MATCH: 40,
  /** Sirada geriye dustukce puan bu kadar azalir */
  RANK_PENALTY: 10,
  /** Parca video suresini karsiliyorsa - donguye gerek kalmaz */
  DURATION_FITS: 25,
  /**
   * Etiket videonun temasiyla birebir tutuyorsa. Dogrudan etiket eslesmesi,
   * ton tahmininden daha guclu bir sinyaldir; bu yuzden tema puaniyla yarisir.
   */
  TAG_MATCH: 30,
  /**
   * Yakin zamanda kullanilmis parca cezasi. Kutuphanede alternatif varsa
   * pratikte her zaman baska bir parca secilir; alternatif yoksa yine de
   * bir parca doner (video muziksiz kalmasin).
   */
  RECENTLY_USED: -150,
} as const;

function moodsForHour(hour: number): Mood[] {
  const slot = HOUR_MOODS.find((entry) =>
    entry.from <= entry.to ? hour >= entry.from && hour < entry.to : hour >= entry.from || hour < entry.to,
  );
  return slot?.moods ?? ['cinematic'];
}

function moodsForTheme(theme: string): Mood[] {
  const normalized = theme.toLocaleLowerCase('tr');
  for (const [key, moods] of Object.entries(THEME_MOODS)) {
    if (normalized.includes(key)) return moods;
  }
  return [];
}

function rankScore(list: Mood[], mood: Mood, topScore: number): number {
  const index = list.indexOf(mood);
  if (index < 0) return 0;
  return Math.max(0, topScore - index * SCORE.RANK_PENALTY);
}

/**
 * Kutuphaneden sorguya en uygun parcayi secer.
 * Esit puanlilar arasinda rastgele secim yapar - ayni video hep ayni muzigi almasin.
 *
 * @param library Kullanilabilir parcalar
 * @param query Tema, saat, sure ve yakin gecmis
 * @returns Secilen parca veya kutuphane bossa null
 */
export function selectTrack(library: MusicTrack[], query: MusicQuery): MusicTrack | null {
  if (library.length === 0) {
    Logger.warn('Muzik kutuphanesi bos - video muziksiz uretilecek');
    return null;
  }

  const hourMoods = moodsForHour(query.hourOfDay);
  const themeMoods = moodsForTheme(query.theme);
  const recent = new Set(query.recentlyUsedIds ?? []);
  const normalizedTheme = query.theme.toLocaleLowerCase('tr');

  const scored = library.map((track) => {
    let score = 0;
    score += rankScore(hourMoods, track.mood, SCORE.HOUR_TOP_MATCH);
    score += rankScore(themeMoods, track.mood, SCORE.THEME_TOP_MATCH);
    if (track.durationSec >= query.videoDurationSec) score += SCORE.DURATION_FITS;
    if (track.tags.some((tag) => normalizedTheme.includes(tag.toLocaleLowerCase('tr')))) {
      score += SCORE.TAG_MATCH;
    }
    if (recent.has(track.id)) score += SCORE.RECENTLY_USED;
    return { track, score };
  });

  const best = Math.max(...scored.map((entry) => entry.score));
  const tied = scored.filter((entry) => entry.score === best);
  const chosen = tied[Math.floor(Math.random() * tied.length)]!.track;

  Logger.success(
    `Muzik secildi: "${chosen.title}" (${chosen.mood}, ${chosen.durationSec.toFixed(0)}sn, puan ${best}` +
      `${tied.length > 1 ? `, ${tied.length} esit adaydan rastgele` : ''})`,
  );
  return chosen;
}
