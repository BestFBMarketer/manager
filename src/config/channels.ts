// =====================================
// MODULE: Channels
// Purpose: Kanal tanimlari - yeni kanal eklemek icin sadece bu dosya degisir
// Dependencies: constants
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { PIPELINE, VIDEO } from './constants.js';

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
  /** Haftanin gunu (0=Pazar) ve TRT saati olarak yayin slotlari */
  publishSlots: Array<{ weekday: number; hour: number; minute: number }>;
  targetDurationSec: number;
  language: 'tr' | 'en';
  /** Bu kanalin uzun videolarindan kac Shorts turetilecek (0 = kapali) */
  shortsDerivativeCount: number;
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export const CHANNELS: Record<string, ChannelConfig> = {
  shorts: {
    id: 'shorts',
    label: 'Komik Shorts',
    refreshTokenEnvKey: 'YOUTUBE_REFRESH_TOKEN_SHORTS',
    defaultTemplate: 'FunnyShort',
    publishSlots: EVERY_DAY.flatMap((weekday) => [
      { weekday, hour: 12, minute: 0 },
      { weekday, hour: 17, minute: 0 },
      { weekday, hour: 21, minute: 0 },
    ]),
    targetDurationSec: VIDEO.SHORT_MAX_SEC,
    language: 'tr',
    shortsDerivativeCount: 0,
  },
  travel: {
    id: 'travel',
    label: 'Gezi / Seyahat',
    refreshTokenEnvKey: 'YOUTUBE_REFRESH_TOKEN_TRAVEL',
    defaultTemplate: 'HotelTourLandscape',
    // Haftada 3: Sali, Persembe, Cumartesi 19:00
    publishSlots: [
      { weekday: 2, hour: 19, minute: 0 },
      { weekday: 4, hour: 19, minute: 0 },
      { weekday: 6, hour: 19, minute: 0 },
    ],
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
