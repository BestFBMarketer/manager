// =====================================
// MODULE: Bimble Script Writer
// Purpose: Bimble TV icin duygu/sosyal-beceri mini-hikaye senaryosu uretir
// Dependencies: llm/router, config/channels, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-09-04
// =====================================

import { callLlmJson } from '../llm/router.js';
import { Logger } from '../core/logger.js';
import type { ChannelConfig } from '../config/channels.js';

/** Bimble'in gorsel/duygusal durumu - 5 sabit-seed FLUX gorseline birebir eslenir (public/bimble/*.png). */
export type BimbleEmotion = 'calm' | 'happy' | 'sad' | 'bigfeeling' | 'proud';

export interface BimbleBeat {
  emotion: BimbleEmotion;
  /** Bu beat'te seslendirilecek/altyazi olarak gosterilecek metin */
  text: string;
  /** Bu beat basinda calinacak tek-seferlik SFX ipucu - public/bimble/sfx/<isim>.mp3 */
  sfx?: 'chime_breath' | 'pop_sparkle' | 'giggle' | 'tada';
}

export interface BimbleScript {
  title: string;
  beats: BimbleBeat[];
  /** 4 satirlik kisa, kafiyeli nakarat - kapanis sarki anina eslik eden altyazi/soylenen metin */
  chorus: string[];
}

export interface BimbleTopicBrief {
  /** 30-gun icerik planindaki konu basligi (orn. "Sinirlenme (istek reddi)") */
  topic: string;
  /** Onerilen tik-tuzagi baslik */
  suggestedTitle: string;
  /** Hikayenin ana cizgisi - kisa prompt olarak LLM'e verilir */
  premise: string;
}

function isBimbleEmotion(value: unknown): value is BimbleEmotion {
  return value === 'calm' || value === 'happy' || value === 'sad' || value === 'bigfeeling' || value === 'proud';
}

function isBimbleBeat(value: unknown): value is BimbleBeat {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isBimbleEmotion(v.emotion) || typeof v.text !== 'string' || v.text.length === 0) return false;
  if (v.sfx !== undefined && !['chime_breath', 'pop_sparkle', 'giggle', 'tada'].includes(v.sfx as string)) return false;
  return true;
}

function isBimbleScript(value: unknown): value is BimbleScript {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === 'string' &&
    v.title.length > 0 &&
    Array.isArray(v.beats) &&
    v.beats.length >= 12 &&
    v.beats.every(isBimbleBeat) &&
    Array.isArray(v.chorus) &&
    v.chorus.length >= 2 &&
    v.chorus.every((line) => typeof line === 'string' && line.length > 0)
  );
}

function buildSystemPrompt(channel: ChannelConfig): string {
  return [
    `You write short animated story episodes for "Bimble TV", a toddler emotional/social-skill YouTube channel.`,
    `CRITICAL: write ALL text in English (the channel's language, regardless of channel.language default).`,
    `Audience: ${channel.audience}`,
    '',
    'Bimble is a small, soft, round cloud-creature whose color and shape visibly change with its feelings.',
    'Every episode follows ONE fixed emotional arc, told in first person AS Bimble, talking directly to the child viewer:',
    '1. calm - warm opening hook, Bimble greets the viewer, teases what happens today',
    '2. happy - Bimble wants something / is excited about something',
    '3. calm or happy - the setup: what Bimble is doing, building toward the problem',
    '4. sad - disappointment hits (a "no", a mistake, a loss) - Bimble names the feeling out loud',
    '5. bigfeeling - the feeling grows into a "big feeling storm" - the hardest moment',
    '6. calm - the coping tool: a concrete, repeatable action (breathing, asking for a hug, counting) - Bimble does it ON SCREEN',
    '7. proud - resolution: Bimble did not get what it wanted, but got through the big feeling - genuine small pride, not preachy',
    '8. proud or happy - soft natural tease for a related next episode',
    '',
    'CRITICAL LENGTH: the channel standard is a MINIMUM 5-minute video. Write 16-22 beats total following this arc',
    '(repeat calm/happy/proud/sad beats as needed to pace a fuller story - add extra small moments, side details,',
    'a second smaller setback before the big feeling storm, etc. - this is a real constraint, not a suggestion).',
    'Each beat is 2-4 sentences, simple conversational language a toddler can follow, specific concrete details',
    '(a named toy, a specific place) instead of vague advice. No moralizing narrator voice - Bimble is a kid too.',
    '',
    'Attach an "sfx" cue to AT MOST 3 beats, only where it truly lands: "pop_sparkle" on a magical/transformation beat,',
    '"chime_breath" on the breathing/coping beat, "giggle" on a genuinely funny/warm beat, "tada" on the resolution beat.',
    '',
    'Also write a 4-line "chorus": a short, simple, RHYMING singalong verse that summarizes the episode\'s coping lesson -',
    'this becomes the lyrics of a recurring sung moment, so keep it universal and reusable in tone (like a nursery rhyme',
    'chorus), 3-7 words per line.',
    '',
    'Return ONLY this JSON schema:',
    '{"title": string, "beats": [{"emotion": "calm"|"happy"|"sad"|"bigfeeling"|"proud", "text": string, "sfx"?: string}], "chorus": string[]}',
  ].join('\n');
}

/**
 * Bimble TV icin bir bolum senaryosu uretir. Referans video/transkript yok -
 * konu dogrudan 30-gunluk icerik planindan/fikir bankasindan gelen bir
 * premise brief'i (bkz DEVAM_NOTU.md).
 * @param channel Hedef kanal (audience/dil baglami icin)
 * @param brief Konu basligi + onerilen premise
 * @returns Duygu-etiketli beat'ler + nakarat
 */
export async function writeBimbleScript(channel: ChannelConfig, brief: BimbleTopicBrief): Promise<BimbleScript> {
  const userPrompt = [
    `Topic: ${brief.topic}`,
    `Suggested title direction: ${brief.suggestedTitle}`,
    '',
    `Premise:`,
    brief.premise,
  ].join('\n');

  const { data } = await callLlmJson<BimbleScript>(
    { task: 'bimbleScript', system: buildSystemPrompt(channel), user: userPrompt },
    isBimbleScript,
  );

  Logger.success(`Bimble senaryosu üretildi: "${data.title}" - ${data.beats.length} beat`);
  return data;
}
