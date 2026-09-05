// =====================================
// MODULE: Ranking Planner
// Purpose: Aday kliplerden alayci seslendirmeli Top-5 ranking kurgusu uretir
// Dependencies: llm/router, config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { RANKING } from '../config/constants.js';
import type { ChannelConfig } from '../config/channels.js';
import { Logger } from '../core/logger.js';
import { callLlmJson } from '../llm/router.js';
import { getActiveRules } from './contentRules.js';

export interface RankingCandidate {
  clipId: string;
  /** Klipte ne oldugunu anlatan kisa ozet - transkript veya gorsel analizden */
  summary: string;
  durationSec: number;
}

export interface RankingItem {
  rank: number;
  clipId: string;
  startSec: number;
  endSec: number;
  /** Bu sira icin alayci seslendirme cumlesi */
  voiceLine: string;
}

export interface RankingPlan {
  title: string;
  hookLine: string;
  items: RankingItem[];
  outroLine: string;
  description: string;
  tags: string[];
}

const LANGUAGE_NAMES: Record<ChannelConfig['language'], string> = {
  de: 'Deutsch',
  tr: 'Türkçe',
  en: 'English',
};

export function buildSystemPrompt(
  language: ChannelConfig['language'],
  styleExamples: string[],
  requestedCategories: string[] = [],
  channelId?: string,
): string {
  const lines = [
    'You write scripts for a YouTube Shorts ranking channel.',
    `CRITICAL: Write ALL spoken lines and titles in ${LANGUAGE_NAMES[language]} (${language}).`,
    'Tone: humorous, teasing, sarcastic - but never insults, profanity, humiliation or personal attacks.',
    'Mock the situation, never the person.',
    `Format: countdown Top ${RANKING.ITEM_COUNT} (from #${RANKING.ITEM_COUNT} down to #1).`,
    `Total video duration must NEVER exceed ${RANKING.MAX_TOTAL_SEC} seconds.`,
    `Each rank clip must be between ${RANKING.MIN_ITEM_SEC} and ${RANKING.MAX_ITEM_SEC} seconds.`,
    `Each voice line: at most ${RANKING.MAX_WORDS_PER_LINE} words - speaking pace depends on it.`,
    'The hook must stop the viewer within the first 2 seconds.',
    'The outro should invite subscription without begging.',
    'Also write a YouTube description (2-3 sentences) and 5-8 lowercase tags (no hash symbol).',
    'Return ONLY this JSON schema:',
    '{"title": string, "hookLine": string, "items": [{"rank": number, "clipId": string,',
    '"startSec": number, "endSec": number, "voiceLine": string}], "outroLine": string,',
    '"description": string, "tags": string[]}',
  ];

  if (requestedCategories.length > 0) {
    lines.push(
      '',
      `CRITICAL SELECTION RULE: the channel owner only wants clips matching one of these` +
        ` requested themes: ${requestedCategories.join(', ')}.`,
      'Only pick candidates whose content clearly matches one of these themes, even if other',
      'candidates look more entertaining in isolation - a clip that does not match the requested',
      'theme must never be picked, no matter how good it looks. If fewer than',
      `${RANKING.ITEM_COUNT} candidates genuinely match, pick only the ones that do (do not pad`,
      'with off-theme clips).',
    );
  }

  if (styleExamples.length > 0) {
    lines.push(
      '',
      'Match this exact comedic voice from previously published videos on this channel',
      '(internet meme slang, "bro" register, absurd comparisons - do not copy lines, match the STYLE):',
      ...styleExamples.map((example, i) => `Example ${i + 1}: ${example}`),
    );
  }

  // Icerik zekasi modulunun onaylanmis kurallari - bkz analysis/contentRules.ts.
  // Kural onaylandikca/reddedildikce burasi DEGISMEZ, sadece DB satiri degisir.
  if (channelId) {
    const activeRules = getActiveRules(channelId);
    if (activeRules.length > 0) {
      lines.push(
        '',
        "This channel's own analytics have revealed the following rules - follow them:",
        ...activeRules.map((r) => `RULE (${r.category}): ${r.ruleText}`),
      );
    }
  }

  return lines.join(' ');
}

function isRankingPlan(value: unknown): value is RankingPlan {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Record<string, unknown>;

  if (typeof plan.title !== 'string' || typeof plan.hookLine !== 'string') return false;
  if (typeof plan.outroLine !== 'string' || !Array.isArray(plan.items)) return false;
  if (typeof plan.description !== 'string' || !Array.isArray(plan.tags)) return false;
  if (!plan.tags.every((t) => typeof t === 'string')) return false;

  return plan.items.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const entry = item as Record<string, unknown>;
    return (
      typeof entry.rank === 'number' &&
      typeof entry.clipId === 'string' &&
      typeof entry.startSec === 'number' &&
      typeof entry.endSec === 'number' &&
      typeof entry.voiceLine === 'string'
    );
  });
}

/**
 * Plani sert kurallara gore duzeltir: LLM sure butcesini asarsa kirpilir.
 * Boylece hatali bir yanit videoyu Shorts sinirinin disina tasimaz.
 */
export function enforceBudget(plan: RankingPlan): RankingPlan {
  // Once en iyi siralar tutulur (#1 asla elenmez), sonra geri sayim icin tersten dizilir.
  const items = [...plan.items]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, RANKING.ITEM_COUNT)
    .sort((a, b) => b.rank - a.rank)
    .map((item) => {
      const rawDuration = item.endSec - item.startSec;
      const duration = Math.min(Math.max(rawDuration, RANKING.MIN_ITEM_SEC), RANKING.MAX_ITEM_SEC);
      return { ...item, endSec: item.startSec + duration };
    });

  let total = items.reduce((sum, item) => sum + (item.endSec - item.startSec), 0);

  // Butce asiliyorsa en uzun kliplerden esit oranda kirp.
  if (total > RANKING.MAX_TOTAL_SEC) {
    const scale = RANKING.MAX_TOTAL_SEC / total;
    for (const item of items) {
      const scaled = Math.max(RANKING.MIN_ITEM_SEC, (item.endSec - item.startSec) * scale);
      item.endSec = item.startSec + scaled;
    }
    total = items.reduce((sum, item) => sum + (item.endSec - item.startSec), 0);
    Logger.warn(`Ranking sure butcesi asilmisti, ${total.toFixed(1)}sn'ye kirpildi`);
  }

  return { ...plan, items };
}

/**
 * Aday kliplerden ranking kurgusu uretir.
 * @param candidates Ozetleri cikarilmis aday klipler
 * @param topic Kanalin bu videodaki temasi (orn. "en komik hayvan anlari")
 * @param language Cikti dili
 * @param styleExamples Kanalin gercek, daha once yayinlanmis videolarindan
 *                       alinmis countdown metinleri (channel.settings.voiceLineExamples) -
 *                       LLM'e few-shot stil ornegi olarak verilir
 * @param channelId Panelin `channel.id` degeri - verilirse icerik-zekasi
 *                  modulunun onaylanmis kurallari (bkz analysis/contentRules.ts)
 *                  prompt'a otomatik eklenir. Verilmezse (orn. eski cagrilar/
 *                  test) davranis oncekiyle birebir ayni kalir.
 * @returns Sure butcesine uydurulmus ranking plani
 */
export async function planRanking(
  candidates: RankingCandidate[],
  topic: string,
  language: ChannelConfig['language'] = 'en',
  styleExamples: string[] = [],
  requestedCategories: string[] = [],
  channelId?: string,
): Promise<RankingPlan> {
  if (candidates.length < RANKING.ITEM_COUNT) {
    throw new Error(
      `Ranking icin en az ${RANKING.ITEM_COUNT} aday gerekli, ${candidates.length} tane var`,
    );
  }

  const userPrompt = [
    `Topic: ${topic}`,
    '',
    'Candidate clips:',
    ...candidates.map(
      (c) => `- clipId=${c.clipId} | duration=${c.durationSec.toFixed(1)}s | content: ${c.summary}`,
    ),
    '',
    `Pick the best ${RANKING.ITEM_COUNT} and build a countdown ranking.`,
    'startSec/endSec must stay within the duration of that specific clip.',
  ].join('\n');

  const { data } = await callLlmJson<RankingPlan>(
    { task: 'viralHook', system: buildSystemPrompt(language, styleExamples, requestedCategories, channelId), user: userPrompt },
    isRankingPlan,
  );

  const plan = enforceBudget(data);
  const total = plan.items.reduce((sum, item) => sum + (item.endSec - item.startSec), 0);
  Logger.success(`Ranking plani hazir: "${plan.title}" - ${plan.items.length} sira, ${total.toFixed(1)}sn`);

  return plan;
}
