// =====================================
// MODULE: Import YouTube Credentials
// Purpose: historisches-kapital/youtube_upload/token_*.json dosyalarindaki
//          calisan OAuth kimlik bilgilerini panelin external_credential
//          tablosuna aktarir (tek seferlik, tekrar calistirilabilir - upsert).
//          historisches-kapital kanali panelde hic kayitli degildi, bu script
//          onu 5. bir `channel` satiri olarak da olusturur.
// Dependencies: core/db, core/logger, publish/publishSlots
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb, closeDb } from '../src/core/db.js';
import { Logger } from '../src/core/logger.js';
import { RANKING_SLOTS } from '../src/publish/publishSlots.js';

const TOKEN_DIR = 'E:/claaudeproje/historisches-kapital/youtube_upload';
const TODAY = new Date().toISOString().slice(0, 10);
const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/yt-analytics.readonly';

/** token dosyasi dosya-adi govdesi -> panel channel_id eslemesi. `historisches-kapital`
 * panelde hic kayitli olmadigi icin bu script tarafindan YENI bir `channel`
 * satiri olarak da olusturulur (bkz createHistorischesKapitalChannelIfMissing). */
const TOKEN_STEM_TO_CHANNEL_ID: Record<string, string> = {
  'funandrank': 'shorts',
  'turkei-urlaub': 'travel',
  'mystisches-echo': 'mystic',
  'bimble-tv': 'bimble',
  'historisches-kapital': 'historisches-kapital',
};

interface TokenFile {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  scopes: string[];
}

function readTokenFile(stem: string): TokenFile | null {
  const path = join(TOKEN_DIR, `token_${stem}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as TokenFile;
  } catch (err) {
    Logger.warn(`${stem}: token dosyasi okunamadi (${path})`, err);
    return null;
  }
}

/** historisches-kapital'in panelde `channel` satiri yok - bu, uretimi tamamen
 * manuel/script-tabanli oldugu icin worker/template alanlari INERT kalir
 * (hicbir job asla bu kanal icin otomatik olusturulmaz). Satirin tek amaci
 * external_credential/video_analytics_snapshot gibi tablolarin channel_id
 * FK'sine baglanabilmesi. `getChannel`/`listChannels` her kanalda aktif bir
 * schedule_rule bekledigi icin (yoksa TUM listChannels() cagrisi patlar),
 * inert bir schedule_rule de eklenir. */
function createHistorischesKapitalChannelIfMissing(): void {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM channel WHERE id = ?').get('historisches-kapital');
  if (existing) {
    Logger.info('historisches-kapital: channel satiri zaten var, atlaniyor');
  } else {
    db.prepare(
      `INSERT INTO channel (
         id, label, channel_type, refresh_token_env_key, default_template,
         target_duration_sec, language, wiki_languages_json, audience,
         title_examples_json, topic_source, shorts_derivative_count, category_id, enabled
       ) VALUES (?, ?, 'story', ?, ?, ?, ?, ?, ?, ?, 'reference', 0, ?, 1)`,
    ).run(
      'historisches-kapital',
      'Historisches Kapital',
      // Bu kanal panelin .env/refresh_token_env_key sistemini KULLANMIYOR (uretimi
      // tamamen manuel, upload da ayri historisches-kapital/youtube_upload/upload.py
      // script'iyle yapiliyor) - bu alan sadece NOT NULL kisitini karsilamak icin var.
      'YOUTUBE_REFRESH_TOKEN_HISTORISCHES_KAPITAL_UNUSED',
      // Worker/dispatchJob bu kanal icin hicbir zaman cagrilmiyor (uretim manuel) -
      // en yakin kavramsal karsilik olarak StoryNarrative secildi, INERT.
      'StoryNarrative',
      1500,
      'de',
      JSON.stringify(['de']),
      'AI-gorsel dokumanter izleyicisi (tarihi/mistik konular) - bu kanalin gercek uretimi panel disinda, manuel script tabanli calisir',
      JSON.stringify([]),
      '27', // Education
    );
    Logger.success('historisches-kapital: channel satiri eklendi (INERT - worker bu kanali hic kullanmiyor)');
  }

  const existingRule = db
    .prepare('SELECT id FROM schedule_rule WHERE channel_id = ? AND enabled = 1')
    .get('historisches-kapital');
  if (existingRule) {
    Logger.info('historisches-kapital: aktif schedule_rule zaten var, atlaniyor');
    return;
  }
  db.prepare(
    `INSERT INTO schedule_rule (
       channel_id, kind, interval_days, anchor_date, slots_json
     ) VALUES (?, 'every_n_days', ?, ?, ?)`,
  ).run('historisches-kapital', 999999, TODAY, JSON.stringify([RANKING_SLOTS[0]]));
  Logger.success('historisches-kapital: inert schedule_rule eklendi (interval_days=999999, worker asla tetiklemez)');
}

function upsertCredential(channelId: string, stem: string, token: TokenFile): void {
  const db = getDb();
  const hasAnalyticsScope = token.scopes.includes(REQUIRED_SCOPE);

  db.prepare(
    `INSERT INTO external_credential (
       channel_id, purpose, source_token_path, client_id, client_secret, refresh_token, scopes_json, imported_at
     ) VALUES (?, 'youtube_analytics', ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(channel_id, purpose) DO UPDATE SET
       source_token_path = excluded.source_token_path,
       client_id = excluded.client_id,
       client_secret = excluded.client_secret,
       refresh_token = excluded.refresh_token,
       scopes_json = excluded.scopes_json,
       imported_at = datetime('now')`,
  ).run(
    channelId,
    join(TOKEN_DIR, `token_${stem}.json`),
    token.client_id,
    token.client_secret,
    token.refresh_token,
    JSON.stringify(token.scopes),
  );

  if (hasAnalyticsScope) {
    Logger.success(`${channelId} (${stem}): external_credential aktarildi, yt-analytics.readonly scope MEVCUT`);
  } else {
    Logger.warn(
      `${channelId} (${stem}): external_credential aktarildi AMA yt-analytics.readonly scope YOK - ` +
        `analyticsQueue bu kanal icin veri cekemeyecek, once bu kanali analytics scope'uyla yeniden yetkilendir ` +
        `(ayni sekilde bugun funandrank icin yapildigi gibi, historisches-kapital/youtube_upload/authorize.py + eklenmis scope).`,
    );
  }
}

function main(): void {
  createHistorischesKapitalChannelIfMissing();

  for (const [stem, channelId] of Object.entries(TOKEN_STEM_TO_CHANNEL_ID)) {
    const token = readTokenFile(stem);
    if (!token) continue;
    upsertCredential(channelId, stem, token);
  }

  closeDb();
}

main();
