// =====================================
// MODULE: Migrate Channels To Db
// Purpose: Eski statik CHANNELS nesnesini DB'ye tek seferlik tasir (elle calistirilir)
// Dependencies: core/db, core/logger, publish/publishSlots, config/channels, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { getDb, closeDb } from '../src/core/db.js';
import { Logger } from '../src/core/logger.js';
import { RANKING_SLOTS } from '../src/publish/publishSlots.js';
import { YOUTUBE_CATEGORY } from '../src/config/channels.js';
import { PIPELINE, RANKING } from '../src/config/constants.js';

const TODAY = new Date().toISOString().slice(0, 10);

interface SeedChannel {
  id: string;
  label: string;
  refreshTokenEnvKey: string;
  defaultTemplate: string;
  targetDurationSec: number;
  language: string;
  wikiLanguages: string[];
  audience: string;
  titleExamples: string[];
  shortsDerivativeCount: number;
  categoryId: string;
  rule:
    | { kind: 'weekday_list'; weekdays: number[] }
    | { kind: 'every_n_days'; intervalDays: number };
  slots: typeof RANKING_SLOTS;
}

// Eski src/config/channels.ts'teki statik CHANNELS nesnesiyle birebir ayni degerler.
const SEED_CHANNELS: SeedChannel[] = [
  {
    id: 'shorts',
    label: 'Komik Shorts',
    refreshTokenEnvKey: 'YOUTUBE_REFRESH_TOKEN_SHORTS',
    defaultTemplate: 'FunnyRanking',
    // Gunde 3 video: ABD prime, Avrupa prime ve ABD sabah yogunlugu
    targetDurationSec: RANKING.MAX_TOTAL_SEC,
    language: 'tr',
    wikiLanguages: ['tr'],
    audience: 'Turkce izleyici; referans kanaldaki uzun videolardan Top-5 viral an + igneleyici seslendirmeli countdown',
    titleExamples: [],
    shortsDerivativeCount: 0,
    categoryId: YOUTUBE_CATEGORY.COMEDY,
    rule: { kind: 'every_n_days', intervalDays: 1 },
    slots: RANKING_SLOTS,
  },
  {
    id: 'travel',
    label: 'Gezi / Seyahat',
    refreshTokenEnvKey: 'YOUTUBE_REFRESH_TOKEN_TRAVEL',
    defaultTemplate: 'HotelTourLandscape',
    // Kanal 18-42 dakikalik videolar yayinliyor; hedef bu araligin ortasi
    targetDurationSec: 1_500,
    // Kanal ALMANCA yayin yapiyor - tum metinler Almanca uretilmeli
    language: 'de',
    wikiLanguages: ['de', 'en', 'tr'],
    audience:
      'Deutschsprachige Türkei-Urlauber (DACH); Reiseziele, Ausflüge, Hotels und ' +
      'Sehenswürdigkeiten an der türkischen Riviera',
    titleExamples: [
      'Die dunkle Wahrheit über Side: Piraten, Mythen und Wahrheit',
      'The Land Of Legends Bei Tag & Nacht und Vieles Mehr',
      'Versteckte Naturorte der Türkei ohne Rummel',
      'Antalya\'s Digital Exhibition Center "Digiverse"',
      'Sandland Und Deepo Outlet Center Ausflug',
    ],
    shortsDerivativeCount: PIPELINE.SHORTS_PER_LONG_VIDEO,
    categoryId: YOUTUBE_CATEGORY.TRAVEL_AND_EVENTS,
    // Haftada 3 video: Sal/Per/Cmt, Avrupa prime time (gezi izleyicisinin agirligi Avrupa'da).
    // Eski kod bu listeyi hicbir yerde okumuyordu (dogrulanmis hata) - bu satir asil duzeltmedir.
    rule: { kind: 'weekday_list', weekdays: [2, 4, 6] },
    slots: [RANKING_SLOTS[1]!],
  },
];

function seedChannel(seed: SeedChannel): void {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM channel WHERE id = ?').get(seed.id);
  if (existing) {
    Logger.info(`${seed.id}: channel satiri zaten var, atlaniyor`);
  } else {
    db.prepare(
      `INSERT INTO channel (
         id, label, channel_type, refresh_token_env_key, default_template,
         target_duration_sec, language, wiki_languages_json, audience,
         title_examples_json, topic_source, shorts_derivative_count, category_id
       ) VALUES (?, ?, 'standard', ?, ?, ?, ?, ?, ?, ?, 'reference', ?, ?)`,
    ).run(
      seed.id,
      seed.label,
      seed.refreshTokenEnvKey,
      seed.defaultTemplate,
      seed.targetDurationSec,
      seed.language,
      JSON.stringify(seed.wikiLanguages),
      seed.audience,
      JSON.stringify(seed.titleExamples),
      seed.shortsDerivativeCount,
      seed.categoryId,
    );
    Logger.success(`${seed.id}: channel satiri eklendi`);
  }

  const existingRule = db
    .prepare('SELECT id FROM schedule_rule WHERE channel_id = ? AND enabled = 1')
    .get(seed.id);
  if (existingRule) {
    Logger.info(`${seed.id}: aktif schedule_rule zaten var, atlaniyor`);
    return;
  }

  db.prepare(
    `INSERT INTO schedule_rule (
       channel_id, kind, weekdays_json, interval_days, anchor_date, slots_json
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    seed.id,
    seed.rule.kind,
    seed.rule.kind === 'weekday_list' ? JSON.stringify(seed.rule.weekdays) : null,
    seed.rule.kind === 'every_n_days' ? seed.rule.intervalDays : null,
    TODAY,
    JSON.stringify(seed.slots),
  );
  Logger.success(`${seed.id}: schedule_rule eklendi (${seed.rule.kind})`);
}

function main(): void {
  for (const seed of SEED_CHANNELS) seedChannel(seed);
  closeDb();
}

main();
