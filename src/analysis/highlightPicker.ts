// =====================================
// MODULE: Highlight Picker
// Purpose: Kaynak videodan 15-45sn'lik bir kesit seçer + iğneleyici yorum metni yazar
// Dependencies: llm/router, story/transcribeSource (TimedCue), config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { callLlmJson } from '../llm/router.js';
import { Logger } from '../core/logger.js';
import { VIDEO } from '../config/constants.js';
import type { ChannelConfig } from '../config/channels.js';
import type { TimedCue } from '../story/transcribeSource.js';

export interface ClipPlan {
  startSec: number;
  endSec: number;
  hookText: string;
  /** Seslendirilecek, iğneleyici/alaycı yorum metni - kanal dilinde */
  commentaryScript: string;
  title: string;
  description: string;
  tags: string[];
}

function isClipPlan(value: unknown): value is ClipPlan {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.startSec === 'number' &&
    typeof v.endSec === 'number' &&
    v.endSec > v.startSec &&
    typeof v.hookText === 'string' &&
    typeof v.commentaryScript === 'string' &&
    v.commentaryScript.length > 0 &&
    typeof v.title === 'string' &&
    typeof v.description === 'string' &&
    Array.isArray(v.tags) &&
    v.tags.every((t) => typeof t === 'string')
  );
}

function clampToBounds(plan: ClipPlan, sourceDurationSec: number): ClipPlan {
  const maxLen = Math.min(VIDEO.HIGHLIGHT_MAX_SEC, sourceDurationSec);
  const start = Math.max(0, Math.min(plan.startSec, sourceDurationSec - VIDEO.HIGHLIGHT_MIN_SEC));
  const rawLen = plan.endSec - plan.startSec;
  const len = Math.max(VIDEO.HIGHLIGHT_MIN_SEC, Math.min(rawLen, maxLen));
  const end = Math.min(sourceDurationSec, start + len);
  return { ...plan, startSec: start, endSec: end };
}

function buildSystemPrompt(channel: ChannelConfig, hasTranscript: boolean): string {
  const lines = [
    `You pick a highlight clip and write a mocking/sarcastic voiceover commentary for the channel "${channel.label}".`,
    `Write hookText, commentaryScript, title, description, and tags in ${channel.language}.`,
    `Audience: ${channel.audience}`,
    '',
    `Tone: biting, sarcastic, teasing ("iğneleyici" in Turkish) - the commentary pokes fun at what's`,
    'happening in the clip, in the voice of someone reacting to a video with friends. Not cruel or',
    'insulting toward real people by name - mock the situation/moment, not identity.',
    '',
    `Pick a ${VIDEO.HIGHLIGHT_MIN_SEC}-${VIDEO.HIGHLIGHT_MAX_SEC} second window that has a clear, funny/`,
    'awkward/over-the-top moment worth reacting to.',
  ];

  if (!hasTranscript) {
    lines.push(
      '',
      'IMPORTANT: no transcript is available for this source (likely music/dance content with little',
      'dialogue) - you have NO information about what specifically happens in the clip. Do not invent',
      'specific claims about it. Write a generic but still in-voice commentary reacting to the vibe/genre',
      'implied by the video title, and pick the window starting no earlier than 15% into the video',
      '(skip typical intros).',
    );
  }

  lines.push(
    '',
    'Return ONLY this JSON schema:',
    '{"startSec": number, "endSec": number, "hookText": string, "commentaryScript": string, "title": string, "description": string, "tags": string[]}',
  );

  return lines.join('\n');
}

function buildUserPrompt(videoTitle: string, sourceDurationSec: number, cues: TimedCue[] | null): string {
  const lines = [`Source video title: ${videoTitle}`, `Total duration: ${Math.round(sourceDurationSec)}s`];

  if (cues) {
    lines.push('', 'Time-coded transcript:');
    for (const cue of cues) {
      lines.push(`[${Math.round(cue.startSec)}s] ${cue.text}`);
    }
  } else {
    lines.push('', '(no transcript available)');
  }

  return lines.join('\n');
}

/**
 * Kaynak videodan bir kesit seçer ve iğneleyici yorum metni üretir.
 * Zaman damgalı transkript varsa içerik odaklı bir seçim yapılır; yoksa
 * (fasıl/parti tarzı içerikte konuşma az olabilir) kaba bir fallback'e
 * düşülür - LLM'in görsel/işitsel analiz yeteneği yok, bu yüzden transkriptsiz
 * durumda yorum metni jenerik kalır (Rule 11: olmayan bilgi uydurulmaz).
 * @param channel Hedef kanal
 * @param videoTitle Kaynak videonun başlığı
 * @param sourceDurationSec Kaynak videonun toplam süresi
 * @param cues transcribeSource.ts'in fetchTimedCaptions çıktısı (yoksa null)
 */
export async function planFunnyClip(
  channel: ChannelConfig,
  videoTitle: string,
  sourceDurationSec: number,
  cues: TimedCue[] | null,
): Promise<ClipPlan> {
  if (!cues) {
    Logger.warn(`Transkript yok - "${videoTitle}" için jenerik yorum planı üretilecek (kaba fallback)`);
  }

  const { data } = await callLlmJson<ClipPlan>(
    {
      task: 'clipCommentary',
      system: buildSystemPrompt(channel, cues !== null),
      user: buildUserPrompt(videoTitle, sourceDurationSec, cues),
    },
    isClipPlan,
  );

  const clamped = clampToBounds(data, sourceDurationSec);
  Logger.success(`Kesit planlandı: ${clamped.startSec.toFixed(0)}s-${clamped.endSec.toFixed(0)}s "${clamped.title}"`);
  return clamped;
}
