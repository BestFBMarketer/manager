// =====================================
// MODULE: Constants
// Purpose: Tum zaman asimi, limit ve esik degerlerinin tek kaynagi (Rule 8)
// Dependencies: yok
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

export const TIMEOUTS = {
  LLM_REQUEST_MS: 120_000,
  HTTP_REQUEST_MS: 30_000,
  DOWNLOAD_MS: 600_000,
  FFMPEG_MS: 900_000,
  RENDER_MS: 3_600_000,
} as const;

export const RETRY = {
  MAX_ATTEMPTS: 4,
  BASE_DELAY_MS: 2_000,
  BACKOFF_FACTOR: 2,
} as const;

export const VIDEO = {
  VERTICAL_WIDTH: 1080,
  VERTICAL_HEIGHT: 1920,
  LANDSCAPE_WIDTH: 1920,
  LANDSCAPE_HEIGHT: 1080,
  FPS: 30,
  PIXEL_FORMAT: 'yuv420p',
  /** YouTube Shorts ust siniri 60sn; guvenli tavan biraz altinda tutulur */
  SHORT_MAX_SEC: 58,
  SHORT_MIN_SEC: 15,
  /** Komik hatta LLM'in secebilecegi highlight araligi */
  HIGHLIGHT_MIN_SEC: 15,
  HIGHLIGHT_MAX_SEC: 45,
  /** loudnorm hedefi (EBU R128) */
  LOUDNESS_TARGET_LUFS: -14,
  LOUDNESS_TRUE_PEAK: -1.5,
  LOUDNESS_RANGE: 11,
} as const;

export const AUDIO = {
  /** Soundtrack seviyesi - konusmanin altinda kalmali */
  MUSIC_GAIN: 0.35,
  VOICE_GAIN: 1.0,
  /** Orijinal kamera sesi (drone ruzgari) - sadece istenirse karisir */
  ORIGINAL_GAIN: 0.15,
  FADE_IN_SEC: 1.5,
  FADE_OUT_SEC: 2.5,
  /** Ducking: seslendirme basladiginda muzigi bastirma ayarlari */
  DUCK_THRESHOLD: 0.05,
  DUCK_RATIO: 8,
  DUCK_ATTACK_MS: 20,
  DUCK_RELEASE_MS: 400,
} as const;

export const SPEED = {
  /**
   * Hiz esikleri (m/s). DJI Neo bataryasi 7-12 dk dayandigi icin ham malzeme
   * kisadir; 30 dakikalik video birden fazla ucusun kesilip sikistirilmasiyla
   * elde edilir. Yavas gecisler hizlandirilir, guzel hizli anlar korunur.
   */
  GROUND_ALT_M: 3,
  STATIC_SPEED_MPS: 1.5,
  SLOW_SPEED_MPS: 3,
  MODERATE_SPEED_MPS: 5,
  GOOD_SPEED_MPS: 14,
  /** Bunun ustu otomatik donus/savrulma - guzel goruntu ama cok hizli geciyor */
  WHIP_SPEED_MPS: 18,

  /** Hiz carpanlari - elle kurguda kullanilan %200-250 araligiyla ayni */
  FACTOR_STATIC: 2.5,
  FACTOR_SLOW: 2.0,
  FACTOR_MODERATE: 1.5,
  FACTOR_NORMAL: 1.0,
  /** Savrulan guzel goruntuler hafifce yavaslatilir */
  FACTOR_WHIP: 0.75,

  /** Kurguda kullanilabilir en kisa parca - daha kisasi goz tirmalar */
  MIN_KEEP_SEC: 2,
  /** Analiz penceresi */
  WINDOW_SEC: 2,
  /** Hedef sureye ulasmak icin hizlandirma bu carpani asamaz */
  MAX_FACTOR: 3.0,
  /** Yerde/hareketsiz gecen bu sureden uzun bolumler tamamen atilir */
  DROP_STATIC_LONGER_THAN_SEC: 4,
} as const;

export const MUSIC_SEGMENT = {
  /** Hiz/irtifa serisini yumusatma penceresi - anlik GPS gurultusu segment uretmesin */
  SMOOTH_WINDOW_SEC: 5,
  /**
   * En kisa muzik bolumu (taban). Bunun altindaki bolumler komsusuna katilir:
   * her birkac saniyede muzik degistirmek izleyicide huzursuzluk yaratir.
   */
  BASE_MIN_SEGMENT_SEC: 12,
  /**
   * Uzun videolarda taban yetmez: 30 dakikalik bir videoda 12 saniyede bir
   * muzik degistirmek felaket olur. En kisa bolum, video suresinin bu orani
   * kadar da olabilir (hangisi buyukse o gecerli).
   */
  MIN_SEGMENT_DURATION_RATIO: 1 / 20,
  /** Kisa videolarda parca tavani - ucus fazlari degisse bile bu asilmaz */
  BASE_MAX_TRACKS: 3,
  /** Uzun videolarda her bu kadar saniye icin bir parca hakki eklenir */
  SEC_PER_EXTRA_TRACK: 300,
  /** Parca sayisi tavani - 16-30 dakikalik gezi videolari icin ust sinir */
  HARD_MAX_TRACKS: 6,
  /** Iki parca arasi gecis suresi (crossfade) */
  CROSSFADE_SEC: 2,
  /** Hiz esikleri (m/s): bunun ustu hizli gecis, alti yakin plan/hover */
  FAST_SPEED_MPS: 10,
  SLOW_SPEED_MPS: 3,
  /** Irtifa esikleri (m): yuksek = genis manzara, alcak = yakin plan */
  HIGH_ALT_M: 80,
  LOW_ALT_M: 30,
} as const;

export const POI = {
  /** Overpass'tan istenecek azami sonuc sayisi */
  MAX_RESULTS: 60,
  /** Ucus izinin sinir kutusunun her yone genisletilecegi mesafe (km) */
  SEARCH_PAD_KM: 3,
  /** Bir POI kartinin gosterilmesi icin drone'un ona yaklasmasi gereken mesafe (m) */
  MAX_CUE_DISTANCE_M: 1_500,
  /** Ekranda ayni anda tek kart; iki kart arasi en az bu kadar bosluk (sn) */
  MIN_GAP_SEC: 4,
  /** Bir kartin ekranda kalma suresi (sn) */
  CARD_DURATION_SEC: 4,
  /** Bir videoda gosterilecek azami kart sayisi - ekrani bogmamak icin */
  MAX_CARDS_PER_VIDEO: 6,
} as const;

export const RANKING = {
  /** Geri sayimli ranking'te kac sira gosterilecek */
  ITEM_COUNT: 5,
  /** Videonun toplam sure tavani - Shorts tempesi icin kisa tutulur */
  MAX_TOTAL_SEC: 30,
  MIN_ITEM_SEC: 3,
  MAX_ITEM_SEC: 8,
  /** Seslendirme cumlesi kelime siniri - okuma suresi klip suresine sigmali */
  MAX_WORDS_PER_LINE: 12,
} as const;

export const PIPELINE = {
  FUNNY_DAILY_TARGET: 3,
  TRAVEL_WEEKLY_TARGET: 3,
  /** Bir uzun videodan turetilecek Shorts sayisi */
  SHORTS_PER_LONG_VIDEO: 3,
  /** Turetilmis Shorts'larin uzun videodan kac gun sonra yayinlanacagi */
  DERIVATIVE_PUBLISH_OFFSET_DAYS: [1, 3, 6],
} as const;

export const HOTEL_DATA = {
  CACHE_TTL_DAYS: 30,
  SCRAPE_DELAY_MS: 4_000,
  MAX_SCRAPE_RETRIES: 2,
} as const;

export const TELEMETRY = {
  /** DJI SRT kayit sikligi ~1 Hz; interpolasyon icin kabul edilen bosluk */
  MAX_GAP_SEC: 5,
  /** Bu sayidan az nokta varsa telemetri kullanilmaz sayilir */
  MIN_POINTS: 5,
  /** GoPro GPS kilidi: 0=yok, 2=2D, 3=3D. 2'nin altindaki ornekler elenir. */
  GPS_FIX_MIN: 2,
  /**
   * GoPro DOP esigi (x100). Uretici 500 altini "iyi" sayar, ancak gercek
   * kayitlarda 3D kilitli ornekler 600-700 uretebiliyor. Harita animasyonu
   * santimetre hassasiyeti gerektirmediginden esik gevsek tutulur.
   */
  GPS_PRECISION_MAX: 1_000,
} as const;
