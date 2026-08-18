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
  language: 'tr' | 'en';
  /** Bu kanalin uzun videolarindan kac Shorts turetilecek (0 = kapali) */
  shortsDerivativeCount: number;
}

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
    language: 'tr',
    shortsDerivativeCount: 0,
  },
  travel: {
    id: 'travel',
    label: 'Gezi / Seyahat',
    refreshTokenEnvKey: 'YOUTUBE_REFRESH_TOKEN_TRAVEL',
    defaultTemplate: 'HotelTourLandscape',
    // Haftada 3 video: Avrupa prime time (gezi izleyicisinin agirligi Avrupa'da)
    primeTimeSlots: [RANKING_SLOTS[1]!],
    publishWeekdays: [2, 4, 6],
    targetDurationSec: 600,
    language: 'tr',
    shortsDerivativeCount: PIPELINE.SHORTS_PER_LONG_VIDEO,
  },
};

export function getChannel(id: string): ChannelConfig {
  const channel = CHANNELS[id];
  if (!channel) {
    throw new Error(`Bilinmeyen kanal: ${id} (tanimlilar: ${Object.keys(CHANNELS).join(', ')})`);
  }
  return channel;
}
