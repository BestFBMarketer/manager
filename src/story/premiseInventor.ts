// =====================================
// MODULE: Premise Inventor
// Purpose: Referans video olmadan (topic_source='ai_generated') konu havuzu ve olgu ozeti uretir
// Dependencies: llm/router, config/channels, story/factBrief, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { callLlmJson } from '../llm/router.js';
import { Logger } from '../core/logger.js';
import type { ChannelConfig } from '../config/channels.js';
import { isFactBrief, type FactBrief } from './factBrief.js';

export interface StoryTopic {
  /** Ic referans - inventFactBrief'e aynen geri verilir, kaynak videoda source_ref yerine gecer */
  topic: string;
  /** Kanal dilinde calisma basligi - panelde/onizlemede gosterilir */
  videoTitle: string;
}

interface TopicGenResponse {
  topics: StoryTopic[];
}

function isStoryTopic(value: unknown): value is StoryTopic {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.topic === 'string' && v.topic.trim().length > 0 && typeof v.videoTitle === 'string' && v.videoTitle.trim().length > 0;
}

function isTopicGenResponse(value: unknown): value is TopicGenResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.topics) && v.topics.length > 0 && v.topics.every(isStoryTopic);
}

const LANGUAGE_NAMES: Record<ChannelConfig['language'], string> = {
  de: 'Deutsch',
  tr: 'Türkçe',
  en: 'English',
};

/**
 * Referans kanal kataloğu olmadan (topic_source='ai_generated') bir sonraki
 * video havuzu için konu üretir - gerçek, iyi belgelenmiş vakalar (reenkarnasyon
 * araştırmaları, açıklanamayan fenomenler, tarihi gizemler) ile tamamen kurgusal
 * öykü fikirlerinin karışımıdır. `avoidTopics` ile daha önce işlenmiş konular
 * tekrarlanmaz.
 * @param channel Hedef kanal - niş/ton/dil bağlamı sağlar
 * @param count İstenen konu sayısı
 * @param avoidTopics Bu kanalda daha önce iş açılmış konu metinleri (tekrar önlenir)
 */
export async function generateStoryTopics(
  channel: ChannelConfig,
  count: number,
  avoidTopics: string[] = [],
): Promise<StoryTopic[]> {
  const langName = LANGUAGE_NAMES[channel.language];
  const buffer = count + 5; // dedup sonrasi kirpma icin pay

  const system = [
    `You brainstorm video topics for the YouTube channel "${channel.label}".`,
    channel.niche ? `Channel niche: ${channel.niche}.` : '',
    channel.styleReference ? `Tone/style reference: ${channel.styleReference}` : '',
    `Working titles (videoTitle) must be written in ${langName} (${channel.language}). The "topic" field can stay in English (internal reference only, never shown to viewers).`,
    '',
    'Generate a MIX of two kinds of topics:',
    '1. Real, publicly documented cases (e.g. researched reincarnation claims, unexplained human phenomena, historical mysteries) - use the real case name as "topic".',
    '2. Original, wholly fictional mystery/mystical story premises (clearly invented, not claiming to be real) - give the invented premise a short descriptive "topic".',
    '',
    'Do not put two reincarnation-themed topics back to back - vary the sub-genre so the channel does not read as reincarnation-only.',
    'Never repeat a topic that appears in the avoid-list below.',
    '',
    'Return ONLY this JSON schema:',
    '{"topics": [{"topic": string, "videoTitle": string}]}',
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    `Generate ${buffer} topics.`,
    avoidTopics.length > 0 ? `Avoid these already-used topics:\n${avoidTopics.map((t) => `- ${t}`).join('\n')}` : 'No topics used yet.',
  ].join('\n\n');

  const { data } = await callLlmJson<TopicGenResponse>({ task: 'topicGen', system, user }, isTopicGenResponse);

  const avoidSet = new Set(avoidTopics);
  const deduped: StoryTopic[] = [];
  const seen = new Set<string>();
  for (const t of data.topics) {
    if (avoidSet.has(t.topic) || seen.has(t.topic)) continue;
    seen.add(t.topic);
    deduped.push(t);
  }

  const picked = deduped.slice(0, count);
  Logger.success(`${channel.id}: ${picked.length}/${count} yeni kurgu/konu üretildi`);
  return picked;
}

/**
 * Verilen konu icin FactBrief seklinde bir ozet uretir - transcribeSource +
 * extractFactBrief'in referanssiz (topic_source='ai_generated') karsiligi.
 * Konu gercek, belgelenmis bir vaka ise LLM kamuya acik bilgilerden ozet
 * cikarir; konu tamamen kurgusal bir onerme ise LLM tutarli, orijinal olgular
 * uydurur. Cikti scriptWriter.ts'e aynen girer - writeNarrativeScript zaten
 * transkripti hic gormeyecek sekilde tasarli (bkz. scriptWriter.ts basyorumu).
 * @param channel Hedef kanal - dil/ton baglami saglar
 * @param topic generateStoryTopics'ten gelen (veya elle girilen) konu metni
 */
export async function inventFactBrief(channel: ChannelConfig, topic: string): Promise<FactBrief> {
  const system = [
    'You produce a strictly structured fact brief for a mystery/mystical documentary-style video, given only a topic.',
    'If the topic names a real, publicly documented case, summarize its well-known public facts (no invented details).',
    'If the topic is a fictional premise, invent a coherent, original set of facts consistent with a mystical/mystery story - never claim a fictional premise is a real event.',
    'Output ONLY facts - no dramatization, no opinion, no narrative prose (that happens in a later step).',
    '',
    'Return ONLY this JSON schema:',
    '{',
    '  "entities": string[],',
    '  "timeline": [{"when": string, "what": string}],',
    '  "claims": string[],',
    '  "numbers": [{"label": string, "value": string}]',
    '}',
    '',
    'If a section has nothing, return an empty array for it.',
  ].join('\n');

  const user = `Topic: ${topic}`;

  const { data } = await callLlmJson<FactBrief>({ task: 'factBrief', system, user }, isFactBrief);

  Logger.success(
    `Kurgu/konu ozeti hazir (${topic}): ${data.entities.length} varlık, ${data.timeline.length} olay, ${data.claims.length} iddia`,
  );
  return data;
}
