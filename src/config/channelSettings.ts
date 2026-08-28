// =====================================
// MODULE: Channel Settings
// Purpose: channel.settings_json icin tip guvenli parse/serialize - SQLite sema
//          seviyesinde tip garantisi vermedigi icin dogruluk burada yasar
// Dependencies: yok
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

export interface ChannelSettings {
  /** Uzun videodan otomatik Shorts turetme ac/kapa (sayi zaten shortsDerivativeCount'ta) */
  shortsDerivativeEnabled: boolean;
  /**
   * Capraz platform yayin ac/kapa - SADECE veri modeli/gostergesi, gercek
   * entegrasyon yok (bkz. publish_target tablosu, plan EK 2 / F).
   */
  crossPost: {
    facebook: boolean;
    instagram: boolean;
    tiktok: boolean;
  };
}

export const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  shortsDerivativeEnabled: true,
  crossPost: { facebook: false, instagram: false, tiktok: false },
};

/** Bilinmeyen/eksik alanlar sessizce varsayilana duser - eski satirlar da calisir kalir. */
export function parseChannelSettings(json: string): ChannelSettings {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return DEFAULT_CHANNEL_SETTINGS;
  }
  if (typeof raw !== 'object' || raw === null) return DEFAULT_CHANNEL_SETTINGS;

  const obj = raw as Record<string, unknown>;
  const crossPostRaw = typeof obj.crossPost === 'object' && obj.crossPost !== null
    ? (obj.crossPost as Record<string, unknown>)
    : {};

  return {
    shortsDerivativeEnabled:
      typeof obj.shortsDerivativeEnabled === 'boolean'
        ? obj.shortsDerivativeEnabled
        : DEFAULT_CHANNEL_SETTINGS.shortsDerivativeEnabled,
    crossPost: {
      facebook: typeof crossPostRaw.facebook === 'boolean' ? crossPostRaw.facebook : false,
      instagram: typeof crossPostRaw.instagram === 'boolean' ? crossPostRaw.instagram : false,
      tiktok: typeof crossPostRaw.tiktok === 'boolean' ? crossPostRaw.tiktok : false,
    },
  };
}

export function serializeChannelSettings(settings: ChannelSettings): string {
  return JSON.stringify(settings);
}
