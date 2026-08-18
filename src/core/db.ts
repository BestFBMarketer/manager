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

CREATE INDEX IF NOT EXISTS idx_job_stage   ON job(stage, status);
CREATE INDEX IF NOT EXISTS idx_usage_time  ON llm_usage(created_at);
`;

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
    connection.exec(SCHEMA);
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
