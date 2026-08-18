// =====================================
// MODULE: Channels
// Purpose: Kanal tanimlari - yeni kanal eklemek icin sadece bu dosya degisir
// Dependencies: constants
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { PIPELINE, VIDEO } from './constants.js';
import { RANKING_SLOTS, type PrimeTimeSlot } from '../publish/publishSlots.js';

export type TemplateName =
  | 'FunnyShort'
  | 'HotelTourLandscape'
  | 'HotelTourVertical';

export interface ChannelConfig {
  id: string;
  label: string;
  /** .env icindeki refresh token anahtarinin adi */
  refreshTokenEnvKey: string;
  defaultTemplate: TemplateName;
  /**
   * Yayin slotlari hedef izleyicinin kendi saat dilimiyle tanimlanir
   * (bkz. publish/publishSlots.ts) - yaz saati gecisleri otomatik dogru olur.
   */
  primeTimeSlots: PrimeTimeSlot[];
  /** Haftanin hangi gunleri yayin yapilacagi (0=Pazar). Bos = her gun. */
  publishWeekdays: number[];
  targetDurationSec: number;
  /** Kanalin yayin dili - LLM metinleri, POI aciklamalari ve altyazilar bu dilde uretilir */
  language: 'tr' | 'en' | 'de';
  /** Wikipedia/Wikidata aciklamalari icin dil onceligi */
  wikiLanguages: string[];
  /** Hedef kitle - LLM'e baglam olarak verilir */
  audience: string;
  /**
   * Kanalin mevcut basliklarindan ornekler. LLM'e few-shot olarak verilir ki
   * uretilen basliklar kanalin kurulu tarziyla ayni tonda olsun.
   */
  titleExamples: string[];
  /** Bu kanalin uzun videolarindan kac Shorts turetilecek (0 = kapali) */
  shortsDerivativeCount: number;
  /** YouTube kategori kimligi - https://developers.google.com/youtube/v3/docs/videoCategories */
  categoryId: string;
}

/** Sik kullanilan kategori kimlikleri - elle aramaktansa isimle referans verilsin. */
export const YOUTUBE_CATEGORY = {
  COMEDY: '23',
  TRAVEL_AND_EVENTS: '19',
  ENTERTAINMENT: '24',
} as const;

export const CHANNELS: Record<string, ChannelConfig> = {
  shorts: {
    id: 'shorts',
    label: 'Komik Shorts',
    refreshTokenEnvKey: 'YOUTUBE_REFRESH_TOKEN_SHORTS',
    defaultTemplate: 'FunnyShort',
    // Gunde 3 video: ABD prime, Avrupa prime ve ABD sabah yogunlugu
    primeTimeSlots: RANKING_SLOTS,
    publishWeekdays: [],
    targetDurationSec: VIDEO.SHORT_MAX_SEC,
    language: 'en',
    wikiLanguages: ['en'],
    audience: 'Global short-form viewers; countdown/ranking format with sarcastic commentary',
    titleExamples: [],
    shortsDerivativeCount: 0,
    categoryId: YOUTUBE_CATEGORY.COMEDY,
  },
  travel: {
    id: 'travel',
    label: 'Gezi / Seyahat',
    refreshTokenEnvKey: 'YOUTUBE_REFRESH_TOKEN_TRAVEL',
    defaultTemplate: 'HotelTourLandscape',
    // Haftada 3 video: Avrupa prime time (gezi izleyicisinin agirligi Avrupa'da)
    primeTimeSlots: [RANKING_SLOTS[1]!],
    publishWeekdays: [2, 4, 6],
    // Kanal 18-42 dakikalik videolar yayinliyor; hedef bu araligin ortasi
    targetDurationSec: 1_500,
    // Kanal ALMANCA yayin yapiyor - tum metinler Almanca uretilmeli
    language: 'de',
    wikiLanguages: ['de', 'en', 'tr'],
    audience:
      'Deutschsprachige Türkei-Urlauber (DACH); Reiseziele, Ausflüge, Hotels und ' +
      'Sehenswürdigkeiten an der türkischen Riviera',
    titleExamples: [
      'Die dunkle Wahrheit über Side: Piraten, Mythen und Wahrheit',
      'The Land Of Legends Bei Tag & Nacht und Vieles Mehr',
      'Versteckte Naturorte der Türkei ohne Rummel',
      'Antalya\'s Digital Exhibition Center "Digiverse"',
      'Sandland Und Deepo Outlet Center Ausflug',
    ],
    shortsDerivativeCount: PIPELINE.SHORTS_PER_LONG_VIDEO,
    categoryId: YOUTUBE_CATEGORY.TRAVEL_AND_EVENTS,
  },
};

export function getChannel(id: string): ChannelConfig {
  const channel = CHANNELS[id];
  if (!channel) {
    throw new Error(`Bilinmeyen kanal: ${id} (tanimlilar: ${Object.keys(CHANNELS).join(', ')})`);
  }
  return channel;
}
