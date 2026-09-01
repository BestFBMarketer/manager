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
    // Ozel format secici (bestvideo+bestaudio ext=mp4/m4a) YouTube'un guncel
    // format listesiyle 403 Forbidden veriyordu (yt-dlp'nin varsayilan format
    // secimi hala calisiyor, sorun secici degil, YouTube'un o an sundugu spesifik
    // format kombinasyonuydu) - varsayilana birakip sadece cikti konteynerini sabitliyoruz.
    await run(
      'yt-dlp',
      ['--merge-output-format', 'mp4', '-o', outputPath, url],
      TIMEOUTS.DOWNLOAD_MS,
    );
    Logger.success(`Video indirildi: ${outputPath}`);
    return outputPath;
  } catch (error) {
    Logger.error(`Video indirilemedi: ${url}`, error);
    throw error;
  }
}
