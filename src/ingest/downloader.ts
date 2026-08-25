// =====================================
// MODULE: Downloader
// Purpose: Kaynak videoyu tam olarak indirir (yt-dlp) - klip kesimi icin gerekli
// Dependencies: core/exec, core/logger, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';
import { TIMEOUTS } from '../config/constants.js';

/**
 * Kaynak videoyu tam olarak indirir. transcribeSource.ts'in aksine (sadece
 * altyazı çeker) burada videonun kendisi gerekir - kesim (cutAndFrame) yerel
 * bir dosya bekler.
 * @param url Kaynak video URL'i
 * @param outputPath Çıkış dosya yolu (uzantı yt-dlp'nin seçtiği formata göre olmalı - .mp4 sabitlenir)
 * @returns outputPath
 */
export async function downloadVideo(url: string, outputPath: string): Promise<string> {
  await mkdir(dirname(outputPath), { recursive: true });

  Logger.info(`Video indiriliyor: ${url}`);
  try {
    await run(
      'yt-dlp',
      [
        '-f',
        'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format',
        'mp4',
        '-o',
        outputPath,
        url,
      ],
      TIMEOUTS.DOWNLOAD_MS,
    );
    Logger.success(`Video indirildi: ${outputPath}`);
    return outputPath;
  } catch (error) {
    Logger.error(`Video indirilemedi: ${url}`, error);
    throw error;
  }
}
