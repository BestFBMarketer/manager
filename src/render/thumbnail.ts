// =====================================
// MODULE: Thumbnail Generator
// Purpose: Video karesi + vurucu metinden YouTube kapak resmi üretir
// Dependencies: core/exec, core/logger, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';
import { TIMEOUTS } from '../config/constants.js';
import { startAssetServer, rewriteAssetPaths } from './renderRemotion.js';

/**
 * Videodan bir kare çıkarır, sonra Remotion'ın Thumbnail still kompozisyonuyla
 * üstüne vurucu metni bindirip 1280x720 YouTube kapak resmi üretir.
 * @param videoPath Kaynak video (render edilmiş final dosya)
 * @param videoDurationSec Karenin nereden alınacağını hesaplamak için toplam süre
 * @param thumbnailText channelWriter.ts'in ürettiği kısa vurucu metin
 * @param outputPath Çıkış JPG yolu
 * @returns outputPath
 */
export async function generateThumbnail(
  videoPath: string,
  videoDurationSec: number,
  thumbnailText: string,
  outputPath: string,
): Promise<string> {
  await mkdir(dirname(outputPath), { recursive: true });

  // %30 noktasindan kare al - intro/outro kartlarindan kacinmak icin makul bir orta nokta.
  const frameTimestampSec = Math.max(0.5, videoDurationSec * 0.3);
  const framePath = outputPath.replace(/\.jpg$/, '_frame.jpg');
  const propsPath = join('data/work', `thumb_props_${Date.now()}.json`);
  let assetServer: { port: number; close: () => Promise<void> } | undefined;

  try {
    Logger.debug(`Thumbnail için kare çıkarılıyor: ${videoPath} @ ${frameTimestampSec.toFixed(1)}s`);
    await run(
      'ffmpeg',
      ['-y', '-ss', String(frameTimestampSec), '-i', videoPath, '-vframes', '1', '-q:v', '2', framePath],
      TIMEOUTS.FFMPEG_MS,
    );

    // Remotion CLI'nin --props bayrağı base64 desteklemez, JSON dosya yolu bekler.
    // imageSrc yerel HTTP sunucusu uzerinden servis edilir (renderRemotion.ts ile ayni gerekce).
    await mkdir('data/work', { recursive: true });
    assetServer = await startAssetServer(process.cwd());
    const props = rewriteAssetPaths({ imageSrc: framePath, text: thumbnailText }, `http://127.0.0.1:${assetServer.port}`);
    await writeFile(propsPath, JSON.stringify(props));

    // Windows'ta npx bir .cmd betigidir - shell:true olmadan spawn EINVAL verir.
    await run(
      'npx',
      ['remotion', 'still', 'remotion/index.ts', 'Thumbnail', outputPath, `--props=${propsPath}`],
      TIMEOUTS.RENDER_MS,
      undefined,
      process.platform === 'win32',
    );

    Logger.success(`Thumbnail hazır: ${outputPath}`);
    return outputPath;
  } catch (error) {
    Logger.warn(`Thumbnail üretimi başarısız - video yine de yayınlanabilir, sadece kapak resmi eksik kalır`, error);
    throw error;
  } finally {
    await rm(propsPath, { force: true }).catch(() => undefined);
    await assetServer?.close();
  }
}
