// =====================================
// MODULE: Panel Session Store
// Purpose: express-session icin SQLite tabanli store - bellek-ici varsayilan
//          store her worker/panel redeploy'unda oturumu siler, bu kabul edilemez
// Dependencies: express-session, core/db, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { Store } from 'express-session';
import type { SessionData } from 'express-session';
import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionRow {
  sess: string;
  expires_at: string;
}

function expiresAtFor(sessionData: SessionData): string {
  const maxAge = sessionData.cookie.maxAge ?? DEFAULT_MAX_AGE_MS;
  return new Date(Date.now() + maxAge).toISOString();
}

/** Suresi gecmis satirlar her yazma isleminde firsatci bicimde temizlenir - ayri bir zamanlayiciya gerek yok. */
function purgeExpired(): void {
  getDb().prepare(`DELETE FROM panel_session WHERE expires_at < datetime('now')`).run();
}

export class SqliteSessionStore extends Store {
  override get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    try {
      const row = getDb()
        .prepare(`SELECT sess, expires_at FROM panel_session WHERE id = ?`)
        .get(sid) as SessionRow | undefined;

      if (!row || new Date(row.expires_at).getTime() < Date.now()) {
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.sess) as SessionData);
    } catch (error) {
      Logger.error('Panel oturumu okunamadi', error);
      callback(error);
    }
  }

  override set(sid: string, sessionData: SessionData, callback?: (err?: unknown) => void): void {
    try {
      purgeExpired();
      getDb()
        .prepare(
          `INSERT INTO panel_session (id, sess, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at`,
        )
        .run(sid, JSON.stringify(sessionData), expiresAtFor(sessionData));
      callback?.();
    } catch (error) {
      Logger.error('Panel oturumu yazilamadi', error);
      callback?.(error);
    }
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      getDb().prepare('DELETE FROM panel_session WHERE id = ?').run(sid);
      callback?.();
    } catch (error) {
      Logger.error('Panel oturumu silinemedi', error);
      callback?.(error);
    }
  }

  override touch(sid: string, sessionData: SessionData, callback?: (err?: unknown) => void): void {
    try {
      getDb()
        .prepare('UPDATE panel_session SET expires_at = ? WHERE id = ?')
        .run(expiresAtFor(sessionData), sid);
      callback?.();
    } catch (error) {
      Logger.error('Panel oturumu suresi uzatilamadi', error);
      callback?.(error);
    }
  }
}
