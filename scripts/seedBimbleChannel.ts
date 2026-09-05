// =====================================
// MODULE: Seed Bimble Channel
// Purpose: "Bimble TV" kanal + schedule_rule satirini DB'ye ekler (tek seferlik, elle calistirilir)
// Dependencies: core/db, config/channelSettings
// Author: BestMarketer Team
// Last Modified: 2026-09-04
// =====================================

import { getDb, closeDb } from '../src/core/db.js';
import { Logger } from '../src/core/logger.js';
import { serializeChannelSettings, DEFAULT_CHANNEL_SETTINGS } from '../src/config/channelSettings.js';
import type { PrimeTimeSlot } from '../src/publish/publishSlots.js';
import { YOUTUBE_CATEGORY } from '../src/config/channels.js';

const TODAY = new Date().toISOString().slice(0, 10);

const CHANNEL_ID = 'bimble';

/** ABD'de okul sonrasi/aksam ceyeri, toddler icerik icin dogru izleyici penceresi. */
const BIMBLE_SLOTS: PrimeTimeSlot[] = [
  { id: 'us-afternoon', timeZone: 'America/New_York', hour: 16, minute: 0, label: 'ABD okul sonrası (ET 16:00)' },
];

function main(): void {
  const db = getDb();

  const settings = serializeChannelSettings({
    ...DEFAULT_CHANNEL_SETTINGS,
    ttsProvider: 'voicebox',
    voiceRef: 'Bimble',
    shortsDerivativeEnabled: false, // 16:9 toddler hikaye - Shorts turetme ayri bir urun karari, simdilik kapali
  });

  const existing = db.prepare('SELECT id FROM channel WHERE id = ?').get(CHANNEL_ID);
  if (existing) {
    Logger.info(`${CHANNEL_ID}: channel satırı zaten var, atlanıyor`);
  } else {
    db.prepare(
      `INSERT INTO channel (
         id, label, channel_type, refresh_token_env_key, default_template,
         target_duration_sec, language, wiki_languages_json, audience,
         title_examples_json, topic_source, shorts_derivative_count, category_id,
         niche, settings_json
       ) VALUES (?, ?, 'story', ?, ?, ?, ?, ?, ?, ?, 'ai_generated', 0, ?, ?, ?)`,
    ).run(
      CHANNEL_ID,
      'Bimble TV',
      'YOUTUBE_REFRESH_TOKEN_BIMBLE',
      'BimbleTV',
      270, // ~4.5dk hedef (30-gunluk planda 4-5dk/video)
      'en',
      JSON.stringify(['en']),
      'US/English toddler (1-4 yaş) ebeveynleri; duygu ve sosyal beceri mini-hikayeleri',
      JSON.stringify(['3 Breaths Changed Everything', "I Almost Had A Meltdown At The Store", 'This Feeling Has A Name (Do You Know It?)']),
      YOUTUBE_CATEGORY.ENTERTAINMENT, // YouTube'da ayrı bir "Kids/Family" kategori kimliği yok, Entertainment en yakını
      'Kids/Toddler Emotional Learning',
      settings,
    );
    Logger.success(`${CHANNEL_ID}: channel satırı eklendi`);
  }

  const existingRule = db.prepare('SELECT id FROM schedule_rule WHERE channel_id = ? AND enabled = 1').get(CHANNEL_ID);
  if (existingRule) {
    Logger.info(`${CHANNEL_ID}: aktif schedule_rule zaten var, atlanıyor`);
  } else {
    db.prepare(
      `INSERT INTO schedule_rule (
         channel_id, kind, weekdays_json, anchor_date, slots_json
       ) VALUES (?, 'weekday_list', ?, ?, ?)`,
    ).run(
      CHANNEL_ID,
      JSON.stringify([1, 3, 5, 0]), // Pazartesi/Çarşamba/Cuma/Pazar - 30-günlük planın "haftada 4" varsayımı
      TODAY,
      JSON.stringify(BIMBLE_SLOTS),
    );
    Logger.success(`${CHANNEL_ID}: schedule_rule eklendi (weekday_list)`);
  }

  closeDb();
}

main();
