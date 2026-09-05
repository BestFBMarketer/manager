// =====================================
// MODULE: Db
// Purpose: SQLite semasi ve baglanti - tum boru hattinin durum kaydi
// Dependencies: better-sqlite3, logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Logger } from './logger.js';

const DB_PATH = process.env.SHORTS_DB_PATH ?? 'data/shorts.db';

let connection: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS candidate (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url    TEXT NOT NULL,
  url_hash      TEXT NOT NULL UNIQUE,
  platform      TEXT NOT NULL,
  title         TEXT,
  duration_sec  REAL,
  license_tier  TEXT NOT NULL DEFAULT 'unknown',
  score         REAL DEFAULT 0,
  thumb_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id   INTEGER REFERENCES candidate(id),
  channel_id     TEXT NOT NULL,
  template       TEXT NOT NULL,
  source_ref     TEXT NOT NULL,
  content_hash   TEXT UNIQUE,
  target_dur_sec INTEGER,
  stage          TEXT NOT NULL DEFAULT 'queued',
  status         TEXT NOT NULL DEFAULT 'pending',
  has_telemetry  INTEGER NOT NULL DEFAULT 0,
  error          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hotel (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  place_key    TEXT NOT NULL UNIQUE,
  lat          REAL,
  lon          REAL,
  fields_json  TEXT NOT NULL DEFAULT '{}',
  fetched_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS render (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      INTEGER NOT NULL REFERENCES job(id),
  composition TEXT NOT NULL,
  output_path TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS upload (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id       INTEGER NOT NULL REFERENCES job(id),
  channel_id   TEXT NOT NULL,
  video_id     TEXT,
  publish_at   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shorts_derivative (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_job_id  INTEGER NOT NULL REFERENCES job(id),
  child_job_id   INTEGER REFERENCES job(id),
  start_sec      REAL NOT NULL,
  end_sec        REAL NOT NULL,
  slot_index     INTEGER NOT NULL,
  UNIQUE (parent_job_id, slot_index)
);

CREATE TABLE IF NOT EXISTS llm_usage (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  task         TEXT NOT NULL,
  in_tokens    INTEGER NOT NULL DEFAULT 0,
  out_tokens   INTEGER NOT NULL DEFAULT 0,
  cost_usd     REAL NOT NULL DEFAULT 0,
  succeeded    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================
-- Coklu kanal admin paneli (EK 2) - kanal config'i DB'ye tasinir
-- =====================================

CREATE TABLE IF NOT EXISTS channel (
  id                      TEXT PRIMARY KEY,
  label                   TEXT NOT NULL,
  channel_type            TEXT NOT NULL DEFAULT 'standard',   -- 'standard' | 'story'
  refresh_token_env_key   TEXT NOT NULL,
  default_template        TEXT NOT NULL,
  target_duration_sec     INTEGER NOT NULL,
  language                TEXT NOT NULL,
  wiki_languages_json     TEXT NOT NULL DEFAULT '[]',
  audience                TEXT NOT NULL DEFAULT '',
  title_examples_json     TEXT NOT NULL DEFAULT '[]',
  style_reference         TEXT,
  topic_source            TEXT NOT NULL DEFAULT 'reference',  -- 'reference' | 'ai_generated' | 'both'
  shorts_derivative_count INTEGER NOT NULL DEFAULT 0,
  category_id             TEXT NOT NULL,
  enabled                 INTEGER NOT NULL DEFAULT 1,
  settings_json           TEXT NOT NULL DEFAULT '{}',
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_rule (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id       TEXT NOT NULL REFERENCES channel(id),
  kind             TEXT NOT NULL CHECK (kind IN ('weekday_list','every_n_days','count_per_period')),
  weekdays_json    TEXT,
  interval_days    INTEGER,
  period_months    INTEGER,
  count_per_period INTEGER,
  anchor_date      TEXT NOT NULL,
  slots_json       TEXT NOT NULL,
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_rule_one_active
  ON schedule_rule(channel_id) WHERE enabled = 1;

CREATE TABLE IF NOT EXISTS review_item (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id               INTEGER NOT NULL REFERENCES job(id),
  channel_id           TEXT NOT NULL REFERENCES channel(id),
  kind                 TEXT NOT NULL DEFAULT 'primary',  -- 'primary' | 'shorts_derivative'
  status               TEXT NOT NULL DEFAULT 'pending_review'
                         CHECK (status IN ('pending_review','approved','rejected','needs_changes')),
  preview_path         TEXT,
  proposed_title       TEXT NOT NULL,
  proposed_description TEXT NOT NULL,
  proposed_tags_json   TEXT NOT NULL DEFAULT '[]',
  fact_checked_at      TEXT,
  reviewer_note        TEXT,
  decided_by           TEXT,
  decided_at           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_review_item_status ON review_item(status, created_at);

-- Capraz platform - sadece veri modeli, gercek entegrasyon yok (EK 2 / F)
CREATE TABLE IF NOT EXISTS publish_target (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id            TEXT NOT NULL REFERENCES channel(id),
  platform              TEXT NOT NULL CHECK (platform IN ('youtube','facebook','instagram','tiktok')),
  external_channel_ref  TEXT,
  enabled               INTEGER NOT NULL DEFAULT 0,
  credentials_env_key   TEXT,
  config_json           TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_publish_target_channel_platform
  ON publish_target(channel_id, platform);

-- Hikaye kanali referans kanallari - panelden, kanal bazli girilir
CREATE TABLE IF NOT EXISTS story_reference (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id  TEXT NOT NULL REFERENCES channel(id),
  source_url  TEXT NOT NULL,
  label       TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Panel oturumlari - bellek-ici varsayilan store her redeploy'da oturumu siler,
-- bu yuzden express-session icin ozel bir SQLite store kullanilir (panel/sessionStore.ts).
CREATE TABLE IF NOT EXISTS panel_session (
  id          TEXT PRIMARY KEY,
  sess        TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_panel_session_expires ON panel_session(expires_at);

CREATE INDEX IF NOT EXISTS idx_job_stage    ON job(stage, status);
CREATE INDEX IF NOT EXISTS idx_usage_time   ON llm_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_upload_channel_status ON upload(channel_id, status, publish_at);

-- =====================================
-- Icerik zekasi modulu (EK 3, 2026-09-05) - kendi-kanal analytics, rakip VPH
-- radar, kural onay dongusu. bkz DEVAM_NOTU.md "Retention/engagement analizi
-- + panel-capi viral-analiz araci" ve plan C:\Users\MONSTER\.claude\plans\dapper-spinning-sparkle.md
-- =====================================

-- Panelin .env/refresh_token_env_key sistemi disinda kalan OAuth kimlik
-- bilgilerini (historisches-kapital/youtube_upload/token_*.json'dan
-- ice aktarilir) koprulemek icin. Sadece analytics amacli - upload akisi
-- (youtubeClient.ts) buna dokunmaz.
CREATE TABLE IF NOT EXISTS external_credential (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id        TEXT NOT NULL REFERENCES channel(id),
  purpose           TEXT NOT NULL DEFAULT 'youtube_analytics',
  source_token_path TEXT,
  client_id         TEXT NOT NULL,
  client_secret     TEXT NOT NULL,
  refresh_token     TEXT NOT NULL,
  scopes_json       TEXT NOT NULL DEFAULT '[]',
  imported_at       TEXT NOT NULL DEFAULT (datetime('now')),
  last_verified_at  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_credential_channel_purpose
  ON external_credential(channel_id, purpose);

-- Kanal basina, video basina, gun basina anlik goruntu - "en son" degil
-- trend gorebilelim diye. YouTube Analytics API'nin taze video icin
-- 24-48 saat gecikmesi var, bu yuzden gunluk cekim yeterli.
CREATE TABLE IF NOT EXISTS video_analytics_snapshot (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id                TEXT NOT NULL REFERENCES channel(id),
  video_id                  TEXT NOT NULL,
  snapshot_date             TEXT NOT NULL,
  views                     INTEGER NOT NULL DEFAULT 0,
  average_view_percentage   REAL,
  average_view_duration_sec REAL,
  likes                     INTEGER NOT NULL DEFAULT 0,
  comments                  INTEGER NOT NULL DEFAULT 0,
  shares                    INTEGER NOT NULL DEFAULT 0,
  subscribers_gained        INTEGER NOT NULL DEFAULT 0,
  subscribers_lost          INTEGER NOT NULL DEFAULT 0,
  title                     TEXT,
  published_at              TEXT,
  raw_json                  TEXT NOT NULL DEFAULT '{}',
  fetched_at                TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_analytics_snapshot_unique
  ON video_analytics_snapshot(channel_id, video_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_video_analytics_snapshot_lookup
  ON video_analytics_snapshot(channel_id, video_id, snapshot_date);

-- Hangi rakip kanallarin hangi kanalimiz icin izlendigi
CREATE TABLE IF NOT EXISTS competitor_channel (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id       TEXT NOT NULL REFERENCES channel(id),
  competitor_yt_id TEXT NOT NULL,
  label            TEXT,
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_channel_unique
  ON competitor_channel(channel_id, competitor_yt_id);

-- Ham VPH ornekleri (trend/debug icin saklanir, sadece alert degil)
CREATE TABLE IF NOT EXISTS competitor_video_snapshot (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  competitor_channel_id INTEGER NOT NULL REFERENCES competitor_channel(id),
  video_id              TEXT NOT NULL,
  title                 TEXT,
  published_at          TEXT NOT NULL,
  checked_at            TEXT NOT NULL DEFAULT (datetime('now')),
  view_count            INTEGER NOT NULL,
  vph                   REAL NOT NULL,
  raw_json              TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_competitor_video_snapshot_lookup
  ON competitor_video_snapshot(competitor_channel_id, video_id, checked_at);

-- Tetiklenen uyarilar (competitor+video basina dedup, tekrar tarama spam yapmasin)
CREATE TABLE IF NOT EXISTS vph_alert (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id            TEXT NOT NULL REFERENCES channel(id),
  competitor_channel_id INTEGER NOT NULL REFERENCES competitor_channel(id),
  video_id              TEXT NOT NULL,
  title                 TEXT NOT NULL,
  vph                   REAL NOT NULL,
  competitor_avg_vph    REAL NOT NULL DEFAULT 0,
  threshold_used        REAL NOT NULL,
  status                TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','dismissed')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vph_alert_unique ON vph_alert(competitor_channel_id, video_id);
CREATE INDEX IF NOT EXISTS idx_vph_alert_status ON vph_alert(channel_id, status, created_at);

-- Uretim tarafinin okudugu kural tablosu - proposed/approved/rejected
-- review_item'in onay dongusunu taklit eder. getActiveRules() (contentRules.ts)
-- sadece status='approved' okur.
CREATE TABLE IF NOT EXISTS content_rule (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id    TEXT NOT NULL REFERENCES channel(id),
  category      TEXT NOT NULL,
  rule_text     TEXT NOT NULL,
  rationale     TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected')),
  proposed_by   TEXT NOT NULL DEFAULT 'rule_synthesizer',
  decided_by    TEXT,
  decided_at    TEXT,
  reviewer_note TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_rule_channel_status ON content_rule(channel_id, status, created_at);
`;

/**
 * SQLite'in ADD COLUMN'u "sutun zaten var" durumunda hata firlatir; bu
 * fonksiyon eklemeli kolon degisikliklerini tekrar tekrar calistirmaya
 * guvenli hale getirir (CREATE TABLE IF NOT EXISTS ile ayni ruhta).
 */
function applyIncrementalMigrations(db: Database.Database): void {
  const alterations: Array<{ table: string; column: string; ddl: string }> = [
    { table: 'upload', column: 'platform', ddl: "ALTER TABLE upload ADD COLUMN platform TEXT NOT NULL DEFAULT 'youtube'" },
    { table: 'upload', column: 'publish_target_id', ddl: 'ALTER TABLE upload ADD COLUMN publish_target_id INTEGER REFERENCES publish_target(id)' },
    { table: 'job', column: 'batch_id', ddl: 'ALTER TABLE job ADD COLUMN batch_id TEXT' },
    { table: 'job', column: 'claimed_at', ddl: 'ALTER TABLE job ADD COLUMN claimed_at TEXT' },
    {
      table: 'job',
      column: 'input_json',
      ddl: "ALTER TABLE job ADD COLUMN input_json TEXT NOT NULL DEFAULT '{}'",
    },
    { table: 'channel', column: 'niche', ddl: 'ALTER TABLE channel ADD COLUMN niche TEXT DEFAULT NULL' },
    { table: 'render', column: 'duration_ms', ddl: 'ALTER TABLE render ADD COLUMN duration_ms INTEGER' },
    {
      table: 'review_item',
      column: 'metadata_context_json',
      ddl: "ALTER TABLE review_item ADD COLUMN metadata_context_json TEXT NOT NULL DEFAULT '{}'",
    },
    { table: 'review_item', column: 'thumbnail_path', ddl: 'ALTER TABLE review_item ADD COLUMN thumbnail_path TEXT' },
    {
      table: 'job',
      column: 'target_publish_at',
      ddl: 'ALTER TABLE job ADD COLUMN target_publish_at TEXT',
    },
    // OAuth ile baglanan platformlar (Facebook/Instagram/TikTok) icin token DB'de
    // tutulur - credentials_env_key (manuel .env pointer) hala destekleniyor ama
    // OAuth akisi artik token'i dogrudan buraya yaziyor.
    { table: 'publish_target', column: 'access_token', ddl: 'ALTER TABLE publish_target ADD COLUMN access_token TEXT' },
    { table: 'publish_target', column: 'refresh_token', ddl: 'ALTER TABLE publish_target ADD COLUMN refresh_token TEXT' },
    { table: 'publish_target', column: 'token_expires_at', ddl: 'ALTER TABLE publish_target ADD COLUMN token_expires_at TEXT' },
    { table: 'publish_target', column: 'account_label', ddl: 'ALTER TABLE publish_target ADD COLUMN account_label TEXT' },
  ];

  for (const { table, column, ddl } of alterations) {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (existing.some((col) => col.name === column)) continue;
    db.exec(ddl);
    Logger.debug(`Migrasyon uygulandi: ${table}.${column}`);
  }

  // Bu indeksler migrasyonla eklenen kolonlara bagli oldugu icin ana SCHEMA
  // calistiktan hemen sonra degil, kolonlar kesinlikle var olduktan sonra kurulur.
  db.exec('CREATE INDEX IF NOT EXISTS idx_job_batch ON job(batch_id) WHERE batch_id IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_render_job_status ON render(job_id, status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_channel_niche ON channel(niche) WHERE niche IS NOT NULL');
}

/**
 * Acik SQLite baglantisini dondurur, ilk cagrida semayi kurar.
 * @returns better-sqlite3 baglantisi
 */
export function getDb(): Database.Database {
  if (connection) return connection;

  try {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    connection = new Database(DB_PATH);
    connection.pragma('journal_mode = WAL');
    // Panel (API sureci) ve worker (cron) ayni SQLite dosyasina yazar; WAL
    // eszamanli okuyucuya izin verir ama yazicilar hala carpisabilir.
    // busy_timeout olmadan bu carpismalar aninda SQLITE_BUSY hatasi verir.
    connection.pragma('busy_timeout = 5000');
    connection.exec(SCHEMA);
    applyIncrementalMigrations(connection);
    Logger.debug(`SQLite hazir: ${DB_PATH}`);
    return connection;
  } catch (error) {
    Logger.error('SQLite acilamadi', error);
    throw error;
  }
}

export function closeDb(): void {
  try {
    connection?.close();
    connection = null;
  } catch (error) {
    Logger.warn('SQLite kapatilirken hata', error);
  }
}
