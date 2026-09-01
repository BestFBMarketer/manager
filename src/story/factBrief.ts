// =====================================
// MODULE: Fact Brief
// Purpose: Kaynak transkriptten katı şemalı olgu özeti çıkarır - serbest metin yok
// Dependencies: llm/router, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { callLlmJson } from '../llm/router.js';
import { Logger } from '../core/logger.js';

export interface FactBrief {
  entities: string[];
  timeline: Array<{ when: string; what: string }>;
  claims: string[];
  numbers: Array<{ label: string; value: string }>;
}

function isTimelineEntry(value: unknown): value is FactBrief['timeline'][number] {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.when === 'string' && typeof v.what === 'string';
}

function isNumberEntry(value: unknown): value is FactBrief['numbers'][number] {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.label === 'string' && typeof v.value === 'string';
}

export function isFactBrief(value: unknown): value is FactBrief {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;

  return (
    Array.isArray(v.entities) &&
    v.entities.every((e) => typeof e === 'string') &&
    Array.isArray(v.timeline) &&
    v.timeline.every(isTimelineEntry) &&
    Array.isArray(v.claims) &&
    v.claims.every((c) => typeof c === 'string') &&
    Array.isArray(v.numbers) &&
    v.numbers.every(isNumberEntry)
  );
}

const SYSTEM_PROMPT = `You extract a strictly structured fact brief from a video transcript. Output ONLY facts present in the source - no interpretation, no embellishment, no opinion.

Return ONLY this JSON schema:
{
  "entities": string[],           // people, places, organizations named in the transcript
  "timeline": [{"when": string, "what": string}],  // chronological events, "when" as stated in source (may be relative, e.g. "3 years later")
  "claims": string[],             // factual assertions made in the source, verbatim in meaning but your own wording
  "numbers": [{"label": string, "value": string}]  // any figures mentioned (dates, ages, amounts, counts)
}

Do not add facts not present in the transcript. If a section has nothing, return an empty array for it.`;

/**
 * Kaynak transkripti yapılandırılmış bir olgu özetine çevirir. Serbest metin
 * çıkışı yok, bu yüzden orijinal ifade biçimi burada doğal olarak elenir -
 * telif/özgünlük güvenliğinin ilk aşaması (EK2/E).
 * @param transcript Kaynak videonun transkripti (yt-dlp auto-caption veya whisper)
 * @param sourceLanguage Transkriptin dili - LLM'e bağlam olarak verilir
 * @returns Yapılandırılmış olgu özeti
 */
export async function extractFactBrief(transcript: string, sourceLanguage: string): Promise<FactBrief> {
  const { data } = await callLlmJson<FactBrief>(
    {
      task: 'factBrief',
      system: SYSTEM_PROMPT,
      user: `Source language: ${sourceLanguage}\n\nTranscript:\n${transcript}`,
    },
    isFactBrief,
  );

  Logger.success(
    `Fact brief: ${data.entities.length} varlık, ${data.timeline.length} olay, ${data.claims.length} iddia`,
  );
  return data;
}
