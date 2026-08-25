// =====================================
// MODULE: Transcribe Source
// Purpose: Referans video icin transkript cikarir (yt-dlp otomatik altyazi)
// Dependencies: core/exec, core/logger, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';
import { TIMEOUTS } from '../config/constants.js';

export interface TimedCue {
  startSec: number;
  endSec: number;
  text: string;
}

const TIME_RANGE = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/;

function toSeconds(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

/** VTT bloklarini zaman damgali cue'lara cevirir; tekrarlanan (auto-caption rolling) satirlari birlestirir. */
function vttToCues(vtt: string): TimedCue[] {
  const blocks = vtt.split(/\r?\n\r?\n/);
  const cues: TimedCue[] = [];
  let lastText = '';

  for (const block of blocks) {
    const timeMatch = block.match(TIME_RANGE);
    if (!timeMatch) continue;

    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = timeMatch;
    const startSec = toSeconds(h1!, m1!, s1!, ms1!);
    const endSec = toSeconds(h2!, m2!, s2!, ms2!);

    const text = block
      .split(/\r?\n/)
      .filter((line) => !TIME_RANGE.test(line) && !/^\d+$/.test(line.trim()) && line.trim())
      .map((line) => line.replace(/<[^>]*>/g, '').trim())
      .filter(Boolean)
      .join(' ');

    if (!text || text === lastText) continue; // auto-caption ayni satiri tekrar tekrar yazar
    cues.push({ startSec, endSec, text });
    lastText = text;
  }

  return cues;
}

async function fetchCaptionVtt(videoUrl: string, language: string): Promise<string | null> {
  const workDir = join('data/work', `caption-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(workDir, { recursive: true });

  try {
    Logger.debug(`Altyazı indiriliyor: ${videoUrl}`);
    await run(
      'yt-dlp',
      [
        '--skip-download',
        '--write-auto-sub',
        '--sub-lang',
        `${language},en`,
        '--sub-format',
        'vtt',
        '-o',
        join(workDir, '%(id)s.%(ext)s'),
        videoUrl,
      ],
      TIMEOUTS.DOWNLOAD_MS,
    );

    const files = await readdir(workDir);
    const vttFile = files.find((f) => f.endsWith('.vtt'));
    if (!vttFile) return null;

    return await readFile(join(workDir, vttFile), 'utf-8');
  } catch (error) {
    Logger.warn(`Altyazı indirilemedi: ${videoUrl}`, error);
    return null;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Zaman damgalı altyazı cue'larını döner. Fasıl/parti tarzı içerikte konuşma
 * az/hiç olmayabilir - bu durumda null döner (throw ETMEZ), çağıran kod
 * (örn. highlightPicker.ts) kaba bir fallback'e düşer (Rule 11: sessizce
 * uydurma yok, ama altyazısız video da geçerli bir durum).
 */
export async function fetchTimedCaptions(videoUrl: string, language: string): Promise<TimedCue[] | null> {
  const vtt = await fetchCaptionVtt(videoUrl, language);
  if (!vtt) return null;

  const cues = vttToCues(vtt);
  return cues.length > 0 ? cues : null;
}

/**
 * Referans videonun otomatik altyazısını indirir ve düz metne çevirir.
 * @param videoUrl YouTube video URL'i
 * @param language Tercih edilen altyazı dili (yt-dlp bulamazsa otomatik ingilizceye düşer)
 * @returns Düz metin transkript
 * @throws Video altyazı içermiyorsa - StoryNarrative/factBrief için altyazı zorunlu (Rule 11)
 */
export async function transcribeSource(videoUrl: string, language: string): Promise<string> {
  const cues = await fetchTimedCaptions(videoUrl, language);
  if (!cues) {
    throw new Error(`Bu video için altyazı bulunamadı (auto-caption yok): ${videoUrl}`);
  }

  const text = cues.map((cue) => cue.text).join(' ');
  if (text.length < 50) {
    throw new Error(`Transkript çok kısa (${text.length} karakter) - kullanılamaz: ${videoUrl}`);
  }

  Logger.success(`Transkript hazır: ${text.length} karakter (${videoUrl})`);
  return text;
}
