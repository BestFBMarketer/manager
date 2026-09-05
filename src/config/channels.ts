// =====================================
// MODULE: Channels
// Purpose: Kanal tanimlari - DB'den okunur (panelden redeploy'suz duzenlenebilsin diye)
// Dependencies: core/db, publish/publishSlots, publish/scheduleRules
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { getDb } from '../core/db.js';
import type { PrimeTimeSlot } from '../publish/publishSlots.js';
import type { ScheduleRule } from '../publish/scheduleRules.js';
import { parseChannelSettings, type ChannelSettings } from './channelSettings.js';

export type TemplateName =
  | 'FunnyClip'
  | 'FunnyRanking'
  | 'HotelTourLandscape'
  | 'HotelTourVertical'
  | 'StoryNarrative'
  | 'BimbleTV';

export type ChannelType = 'standard' | 'story';
export type TopicSource = 'reference' | 'ai_generated' | 'both';

export interface ChannelConfig {
  id: string;
  label: string;
  channelType: ChannelType;
  /** .env icindeki refresh token anahtarinin adi */
  refreshTokenEnvKey: string;
  defaultTemplate: TemplateName;
  /**
   * Yayin slotlari hedef izleyicinin kendi saat dilimiyle tanimlanir
   * (bkz. publish/publishSlots.ts) - yaz saati gecisleri otomatik dogru olur.
   */
  slots: PrimeTimeSlot[];
  /** Yayin sikligi kurali - haftaici listesi / N gunde bir / M ayda N video (bkz. publish/scheduleRules.ts) */
  scheduleRule: ScheduleRule;
  targetDurationSec: number;
  /** Kanalin yayin dili - LLM metinleri, POI aciklamalari ve altyazilar bu dilde uretilir */
  language: 'tr' | 'en' | 'de';
  /** Wikipedia/Wikidata aciklamalari icin dil onceligi */
  wikiLanguages: string[];
  /** Hedef kitle - LLM'e baglam olarak verilir */
  audience: string;
  /**
   * Kanalin mevcut basliklarindan ornekler. LLM'e few-shot olarak verilir ki
   * uretilen basliklar kanalin kurulu tarziyla ayni tonda olsun.
   */
  titleExamples: string[];
  /** Hikaye kanallari icin ton/tur/ornek video notu - topic/senaryo uretimine few-shot baglam olarak verilir */
  styleReference: string | null;
  /** Kanal niş/kategorisi (Ör. Paranormal, Ekonomi, Gezi, Komedi) - panel'de settable, reportlarda filtrelenebilir */
  niche: string | null;
  /** Hikaye kanali konu kaynagi - referans kanal izleme / AI'nin kendi backlog'u / ikisi birden */
  topicSource: TopicSource;
  /** Bu kanalin uzun videolarindan kac Shorts turetilecek (0 = kapali) */
  shortsDerivativeCount: number;
  /** YouTube kategori kimligi - https://developers.google.com/youtube/v3/docs/videoCategories */
  categoryId: string;
  enabled: boolean;
  settings: ChannelSettings;
}

/** Sik kullanilan kategori kimlikleri - elle aramaktansa isimle referans verilsin. */
export const YOUTUBE_CATEGORY = {
  COMEDY: '23',
  TRAVEL_AND_EVENTS: '19',
  ENTERTAINMENT: '24',
} as const;

interface ChannelRow {
  id: string;
  label: string;
  channel_type: string;
  refresh_token_env_key: string;
  default_template: string;
  target_duration_sec: number;
  language: string;
  wiki_languages_json: string;
  audience: string;
  title_examples_json: string;
  style_reference: string | null;
  niche: string | null;
  topic_source: string;
  shorts_derivative_count: number;
  category_id: string;
  enabled: number;
  settings_json: string;
}

interface ScheduleRuleRow {
  kind: string;
  weekdays_json: string | null;
  interval_days: number | null;
  period_months: number | null;
  count_per_period: number | null;
  anchor_date: string;
  slots_json: string;
}

function toScheduleRule(row: ScheduleRuleRow): ScheduleRule {
  const anchor = new Date(row.anchor_date);
  switch (row.kind) {
    case 'weekday_list':
      return { kind: 'weekday_list', weekdays: JSON.parse(row.weekdays_json ?? '[]') as number[] };
    case 'every_n_days':
      return { kind: 'every_n_days', intervalDays: row.interval_days ?? 1, anchor };
    case 'count_per_period':
      return {
        kind: 'count_per_period',
        countPerPeriod: row.count_per_period ?? 1,
        periodMonths: row.period_months ?? 1,
        anchor,
      };
    default:
      throw new Error(`Bilinmeyen schedule_rule.kind: ${row.kind}`);
  }
}

function rowToChannelConfig(row: ChannelRow, ruleRow: ScheduleRuleRow): ChannelConfig {
  return {
    id: row.id,
    label: row.label,
    channelType: row.channel_type as ChannelType,
    refreshTokenEnvKey: row.refresh_token_env_key,
    defaultTemplate: row.default_template as TemplateName,
    slots: JSON.parse(ruleRow.slots_json) as PrimeTimeSlot[],
    scheduleRule: toScheduleRule(ruleRow),
    targetDurationSec: row.target_duration_sec,
    language: row.language as ChannelConfig['language'],
    wikiLanguages: JSON.parse(row.wiki_languages_json) as string[],
    audience: row.audience,
    titleExamples: JSON.parse(row.title_examples_json) as string[],
    styleReference: row.style_reference,
    niche: row.niche,
    topicSource: row.topic_source as TopicSource,
    shortsDerivativeCount: row.shorts_derivative_count,
    categoryId: row.category_id,
    enabled: row.enabled === 1,
    settings: parseChannelSettings(row.settings_json),
  };
}

/**
 * Kanal ayarlarini DB'den okur (panel redeploy gerektirmeden duzenleyebilsin diye).
 * Her kanalda tam olarak bir aktif `schedule_rule` satiri olmasi DB seviyesinde
 * zorlanir (bkz. idx_schedule_rule_one_active).
 */
export function getChannel(id: string): ChannelConfig {
  const db = getDb();
  const channelRow = db.prepare('SELECT * FROM channel WHERE id = ?').get(id) as ChannelRow | undefined;
  if (!channelRow) {
    const known = (db.prepare('SELECT id FROM channel').all() as Array<{ id: string }>).map((r) => r.id);
    throw new Error(`Bilinmeyen kanal: ${id} (tanimlilar: ${known.join(', ') || '(hic kanal tanimli degil)'})`);
  }

  const ruleRow = db
    .prepare('SELECT * FROM schedule_rule WHERE channel_id = ? AND enabled = 1')
    .get(id) as ScheduleRuleRow | undefined;
  if (!ruleRow) {
    throw new Error(`${id}: aktif schedule_rule bulunamadi - panelden veya migrasyon script'iyle tanimlanmali`);
  }

  return rowToChannelConfig(channelRow, ruleRow);
}

/** Tum tanimli kanallari doner (orn. stageDoctor'daki kanal listesi icin). */
export function listChannels(): ChannelConfig[] {
  const db = getDb();
  const rows = db.prepare('SELECT id FROM channel').all() as Array<{ id: string }>;
  return rows.map((r) => getChannel(r.id));
}
