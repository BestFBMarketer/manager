// =====================================
// MODULE: Script Writer
// Purpose: SADECE fact brief'ten yeni, özgün anlatım senaryosu üretir
// Dependencies: llm/router, config/channels, story/factBrief, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { callLlmJson } from '../llm/router.js';
import { Logger } from '../core/logger.js';
import type { ChannelConfig } from '../config/channels.js';
import type { FactBrief } from './factBrief.js';

export type SceneMood = 'tension' | 'neutral' | 'resolution';

export interface NarrativeScene {
  /** Bu sahnede seslendirilecek metin - kanal dilinde, orijinal ifade */
  text: string;
  /** Görsel kaynaklama için sahne anahtar kelimesi (visualSourcing.ts bunu kullanır) */
  sceneKeyword: string;
  mood: SceneMood;
}

export interface NarrativeScript {
  title: string;
  scenes: NarrativeScene[];
}

function isNarrativeScene(value: unknown): value is NarrativeScene {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.text === 'string' &&
    v.text.length > 0 &&
    typeof v.sceneKeyword === 'string' &&
    (v.mood === 'tension' || v.mood === 'neutral' || v.mood === 'resolution')
  );
}

function isNarrativeScript(value: unknown): value is NarrativeScript {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === 'string' && Array.isArray(v.scenes) && v.scenes.length > 0 && v.scenes.every(isNarrativeScene);
}

const LANGUAGE_NAMES: Record<ChannelConfig['language'], string> = {
  de: 'Deutsch',
  tr: 'Türkçe',
  en: 'English',
};

function buildSystemPrompt(channel: ChannelConfig): string {
  const langName = LANGUAGE_NAMES[channel.language];
  const lines = [
    `You write an original narrative video script for the channel "${channel.label}".`,
    `CRITICAL: write ALL scene text in ${langName} (${channel.language}).`,
    channel.niche ? `Channel niche: ${channel.niche}.` : '',
    channel.styleReference ? `Tone/style reference: ${channel.styleReference}` : '',
    '',
    'You are given ONLY a structured fact brief (entities, timeline, claims, numbers) - you have',
    'NEVER seen the source video or its transcript. Write your own narrative from these facts,',
    'in your own words and structure. Do not attempt to guess or reproduce the source phrasing.',
    '',
    'Break the story into scenes (8-20 depending on complexity). Each scene needs a short',
    'sceneKeyword (2-4 words, English, for stock footage search) describing what should be shown.',
    'Assign a mood to each scene: "tension" (rising stakes), "neutral" (exposition), or',
    '"resolution" (payoff/conclusion) - this drives music selection downstream.',
    '',
    'Return ONLY this JSON schema:',
    '{"title": string, "scenes": [{"text": string, "sceneKeyword": string, "mood": "tension"|"neutral"|"resolution"}]}',
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Yeni bir anlatım senaryosu üretir. TİP SEVİYESİNDE zorlanan kısıt: bu fonksiyon
 * transkript parametresi HİÇ kabul etmez - sadece `brief` (FactBrief) alır. İleride
 * biri "daha iyi bağlam için" orijinal transkripti sızdırmaya çalışsa derleme hatası
 * alır. Telif/özgünlük güvenliğinin ikinci ve son aşaması (EK2/E).
 * @param channel Hedef kanal - dil/ton/niş bağlamı sağlar
 * @param brief factBrief.ts çıktısı - orijinal ifade biçiminden arındırılmış olgular
 * @returns Kanal dilinde, sahne bazlı yeni senaryo
 */
export async function writeNarrativeScript(channel: ChannelConfig, brief: FactBrief): Promise<NarrativeScript> {
  const userPrompt = [
    `Entities: ${brief.entities.join(', ') || '(none)'}`,
    '',
    'Timeline:',
    ...brief.timeline.map((t) => `- ${t.when}: ${t.what}`),
    '',
    'Claims:',
    ...brief.claims.map((c) => `- ${c}`),
    '',
    'Numbers:',
    ...brief.numbers.map((n) => `- ${n.label}: ${n.value}`),
  ].join('\n');

  const { data } = await callLlmJson<NarrativeScript>(
    { task: 'narrativeScript', system: buildSystemPrompt(channel), user: userPrompt },
    isNarrativeScript,
  );

  Logger.success(`Senaryo üretildi (${channel.language}): "${data.title}" - ${data.scenes.length} sahne`);
  return data;
}
