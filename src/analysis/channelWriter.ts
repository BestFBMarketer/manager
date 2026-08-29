// =====================================
// MODULE: Channel Writer
// Purpose: Kanalin dili ve kurulu baslik tarziyla metin uretir
// Dependencies: config/channels, llm/router, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import type { ChannelConfig } from '../config/channels.js';
import { Logger } from '../core/logger.js';
import { callLlmJson } from '../llm/router.js';

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  /** Thumbnail uzerine basilacak kisa vurucu metin */
  thumbnailText: string;
}

export interface WriteContext {
  /** Videonun konusu - cekim yeri, otel adi, bolge */
  subject: string;
  /** Videoda gorulen ilgi noktalari */
  highlights: string[];
  /** Video suresi - aciklamanin uzunlugunu etkiler */
  durationSec: number;
  /** Gunduz-gece gecisi var mi - kanalin sevdigi bir format */
  hasDayNight?: boolean;
}

const LANGUAGE_NAMES: Record<ChannelConfig['language'], string> = {
  de: 'Deutsch',
  tr: 'Türkçe',
  en: 'English',
};

function buildSystemPrompt(channel: ChannelConfig): string {
  const langName = LANGUAGE_NAMES[channel.language];

  const lines = [
    `You write YouTube metadata for the channel "${channel.label}".`,
    '',
    `CRITICAL: Write ALL output text in ${langName} (${channel.language}).`,
    `Audience: ${channel.audience}`,
    '',
    'Rules:',
    '- The title must create curiosity without clickbait lies; the video must deliver what the title promises.',
    '- Match the established tone of the channel shown in the examples below.',
    '- Description MUST open with a strong hook: a curiosity-driving question or a surprising claim about the subject ' +
      '(e.g. "Haben Sie sich je gefragt, was..."), NOT a plain summary sentence. Then 1-3 more sentences of context, ' +
      'then a short bullet list (with emoji bullets) of what the viewer will see. End with a short subscribe/CTA line.',
    '- Tags: 12-15 items, broad to specific (location, activity, audience, format), lowercase, no hash symbol.',
    '- thumbnailText: at most 4 words, high impact, same language.',
  ];

  if (channel.titleExamples.length > 0) {
    lines.push(
      '',
      'Existing titles from this channel (match this style, do not copy them):',
      ...channel.titleExamples.map((example) => `- ${example}`),
    );
  }

  lines.push(
    '',
    'Return ONLY this JSON schema:',
    '{"title": string, "description": string, "tags": string[], "thumbnailText": string}',
  );

  return lines.join('\n');
}

function isVideoMetadata(value: unknown): value is VideoMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;

  return (
    typeof data.title === 'string' &&
    data.title.length > 0 &&
    typeof data.description === 'string' &&
    Array.isArray(data.tags) &&
    data.tags.every((tag) => typeof tag === 'string') &&
    typeof data.thumbnailText === 'string'
  );
}

/**
 * Kanalin diline ve kurulu tarzina uygun baslik, aciklama ve etiket uretir.
 *
 * Kanalin mevcut basliklari LLM'e ornek olarak verilir; boylece uretilen
 * metin kanalin sesine yabanci durmaz.
 *
 * @param channel Hedef kanal yapilandirmasi
 * @param context Videonun konusu ve icerigi
 * @returns Kanal dilinde metadata
 */
export async function writeVideoMetadata(
  channel: ChannelConfig,
  context: WriteContext,
): Promise<VideoMetadata> {
  const minutes = Math.round(context.durationSec / 60);

  const userPrompt = [
    `Subject: ${context.subject}`,
    `Video length: ~${minutes} minutes`,
    context.hasDayNight ? 'The video shows the same location by day and by night.' : '',
    '',
    'Shown in the video:',
    ...context.highlights.map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join('\n');

  const { data } = await callLlmJson<VideoMetadata>(
    { task: 'metadata', system: buildSystemPrompt(channel), user: userPrompt },
    isVideoMetadata,
  );

  Logger.success(`Metadata (${channel.language}): "${data.title}"`);
  return data;
}

function isIntroNarration(value: unknown): value is { narration: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).narration === 'string' &&
    (value as Record<string, unknown>).narration !== ''
  );
}

/**
 * Videonun acilisinda seslendirilecek kisa, dogal karsilama metnini kanalin
 * dilinde uretir - TTS'e verilecek metin bu yuzden altyazi/aciklama gibi
 * degil, yuksek sesle soylenecek konusma dilinde olmali.
 *
 * @param channel Hedef kanal (dil ve ses tonu icin)
 * @param context Videonun konusu ve icerigi
 * @returns Kanal dilinde, 1-2 cumlelik konusma metni
 */
export async function writeIntroNarration(channel: ChannelConfig, context: WriteContext): Promise<string> {
  const langName = LANGUAGE_NAMES[channel.language];

  const system = [
    `You write a short SPOKEN video intro narration for the channel "${channel.label}", in ${langName} (${channel.language}).`,
    `Audience: ${channel.audience}`,
    '1-2 natural, welcoming sentences a narrator would say out loud at the start of the video - not a caption or description.',
    'No hashtags, no emoji, no bullet points, no quotation marks.',
    'Return ONLY this JSON: {"narration": string}',
  ].join('\n');

  const userPrompt = [`Subject: ${context.subject}`, 'Shown in the video:', ...context.highlights.map((item) => `- ${item}`)]
    .filter(Boolean)
    .join('\n');

  const { data } = await callLlmJson<{ narration: string }>(
    { task: 'metadata', system, user: userPrompt },
    isIntroNarration,
  );

  return data.narration;
}

/**
 * POI ekran kartlari icin kisa not uretir.
 *
 * Yalnizca verilen olgulari yeniden ifade eder - eksik bilgi tamamlanmaz,
 * yeni olgu uydurulmaz. Kaynak metin yoksa kart aciklamasiz kalir.
 *
 * @param channel Hedef kanal (dil icin)
 * @param name Ilgi noktasinin adi
 * @param sourceText Kaynak aciklama (Wikipedia/Wikidata)
 * @returns Kart icin kisaltilmis not
 */
export async function writePoiNote(
  channel: ChannelConfig,
  name: string,
  sourceText: string,
): Promise<string> {
  const langName = LANGUAGE_NAMES[channel.language];

  const system = [
    `Rewrite the given fact into one short sentence in ${langName} for a video overlay card.`,
    'Maximum 12 words. Keep it factual.',
    'Use ONLY information present in the source text. Do not add facts, numbers or superlatives.',
    'Return ONLY this JSON: {"note": string}',
  ].join('\n');

  const { data } = await callLlmJson<{ note: string }>(
    {
      task: 'classify',
      system,
      user: `Name: ${name}\nSource text: ${sourceText}`,
    },
    (value): value is { note: string } =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Record<string, unknown>).note === 'string',
  );

  return data.note;
}
