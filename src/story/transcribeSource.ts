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

/** VTT zaman damgalarini, tag'lerini ve tekrarlanan (auto-caption rolling) satirlari temizler. */
function vttToPlainText(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const textLines: string[] = [];
  let lastLine = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'WEBVTT' || /^\d+$/.test(trimmed)) continue;
    if (/-->/.test(trimmed)) continue;
    if (trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) continue;

    // Etiketleri (<c>, <00:00:01.000>) temizle
    const clean = trimmed.replace(/<[^>]*>/g, '').trim();
    if (!clean || clean === lastLine) continue; // auto-caption ayni satiri tekrar tekrar yazar

    textLines.push(clean);
    lastLine = clean;
  }

  return textLines.join(' ');
}

/**
 * Referans videonun otomatik altyazısını indirir ve düz metne çevirir.
 * @param videoUrl YouTube video URL'i
 * @param language Tercih edilen altyazı dili (yt-dlp bulamazsa otomatik ingilizceye düşer)
 * @returns Düz metin transkript
 * @throws Video altyazı içermiyorsa - bu durumda çağıran kod bu konuyu atlamalı (Rule 11)
 */
export async function transcribeSource(videoUrl: string, language: string): Promise<string> {
  const workDir = join('data/work', `transcript-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(workDir, { recursive: true });

  try {
    Logger.debug(`Transkript indiriliyor: ${videoUrl}`);
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
    if (!vttFile) {
      throw new Error(`Bu video için altyazı bulunamadı (auto-caption yok): ${videoUrl}`);
    }

    const vttContent = await readFile(join(workDir, vttFile), 'utf-8');
    const text = vttToPlainText(vttContent);

    if (text.length < 50) {
      throw new Error(`Transkript çok kısa (${text.length} karakter) - kullanılamaz: ${videoUrl}`);
    }

    Logger.success(`Transkript hazır: ${text.length} karakter (${videoUrl})`);
    return text;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
