// =====================================
// MODULE: Backup Db
// Purpose: SQLite'i .backup() ile tutarli sekilde kopyalar, eski yedekleri budar
// Kullanim: npx tsx scripts/backupDb.ts (cron ile gunluk calistirilmasi onerilir)
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import Database from 'better-sqlite3';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '../src/core/logger.js';

const DB_PATH = process.env.SHORTS_DB_PATH ?? 'data/shorts.db';
const BACKUP_DIR = process.env.SHORTS_DB_BACKUP_DIR ?? 'data/backups';
const RETENTION_DAYS = Number(process.env.SHORTS_DB_BACKUP_RETENTION_DAYS ?? 14);

async function pruneOldBackups(): Promise<void> {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = await readdir(BACKUP_DIR).catch(() => []);

  for (const file of files) {
    if (!file.startsWith('shorts-') || !file.endsWith('.db')) continue;
    const filePath = join(BACKUP_DIR, file);
    const info = await stat(filePath);
    if (info.mtimeMs < cutoffMs) {
      await unlink(filePath);
      Logger.info(`Eski yedek silindi: ${file}`);
    }
  }
}

async function main(): Promise<void> {
  await mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `shorts-${timestamp}.db`);

  const db = new Database(DB_PATH, { readonly: true });
  try {
    // .backup() SQLite'in kendi tutarli kopyalama API'si - WAL modunda bile
    // yari yazilmis dosya kopyalanmaz (duz `cp` ile bu garanti edilemez).
    await db.backup(backupPath);
    Logger.success(`Yedek alındı: ${backupPath}`);
  } finally {
    db.close();
  }

  await pruneOldBackups();
}

main().catch((error) => {
  Logger.error('Yedekleme başarısız', error);
  process.exitCode = 1;
});
