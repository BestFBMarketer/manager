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
  /**
   * Bu kanal icin panelde secilmis ses (Ses sekmesi). Bos ise TTS_VOICE_REF
   * (.env, tum kanallarda paylasilan tek varsayilan) + zincirin ilk hazir
   * saglayicisi (Voicebox -> Piper) kullanilir.
   */
  ttsProvider: 'voicebox' | 'piper' | null;
  /** ttsProvider='voicebox' ise profil id'si; 'piper' ise .onnx dosya yolu. */
  voiceRef: string | null;
  /**
   * FunnyRanking icin gercek, daha once yayinlanmis videolardan alinmis
   * ornek voice line dizileri (her string bir videonun tum countdown metni,
   * "No.5 ... No.1 ..." sirasiyla) - LLM'e few-shot stil ornegi olarak verilir,
   * boylece uretilen alay/mizah tonu kanalin kurulu sesinden sapmaz.
   */
  voiceLineExamples: string[];
  /**
   * FunnyRanking/FunnyClip icin nis/kategori anahtar kelimeleri (orn. "pool fails",
   * "DIY fails", "dance fails"). Bos ise topicDiscovery filtrelemez (eski davranis).
   * Doluysa, referans kanal kataloğundaki bir video sadece basligi/aciklamasi bu
   * anahtar kelimelerden en az birini iceriyorsa aday sayilir.
   */
  discoveryCategories: string[];
  /**
   * TierList (Crash Dummy) icerik turu icin kaynak modu: 'manual' = kullanici
   * her marka reklami icin dogrudan video linkini kendi girer (en guvenilir,
   * yanlis/resmi olmayan yukleme riski yok). 'search_suggest' = worker
   * YOUTUBE_API_KEY ile isme gore arar, birkac aday sunar, kullanici panelde
   * tek tikla secer (kor otomatik secim YOK - hep bir onay adimi var).
   */
  tierListSourceMode: 'manual' | 'search_suggest';
}

export const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  shortsDerivativeEnabled: true,
  crossPost: { facebook: false, instagram: false, tiktok: false },
  ttsProvider: null,
  voiceRef: null,
  voiceLineExamples: [],
  discoveryCategories: [],
  tierListSourceMode: 'manual',
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
    ttsProvider: obj.ttsProvider === 'voicebox' || obj.ttsProvider === 'piper' ? obj.ttsProvider : null,
    voiceRef: typeof obj.voiceRef === 'string' ? obj.voiceRef : null,
    voiceLineExamples:
      Array.isArray(obj.voiceLineExamples) && obj.voiceLineExamples.every((v) => typeof v === 'string')
        ? (obj.voiceLineExamples as string[])
        : [],
    discoveryCategories:
      Array.isArray(obj.discoveryCategories) && obj.discoveryCategories.every((v) => typeof v === 'string')
        ? (obj.discoveryCategories as string[])
        : [],
    tierListSourceMode: obj.tierListSourceMode === 'search_suggest' ? 'search_suggest' : 'manual',
  };
}

export function serializeChannelSettings(settings: ChannelSettings): string {
  return JSON.stringify(settings);
}
