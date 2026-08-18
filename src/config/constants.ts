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
} as const;
