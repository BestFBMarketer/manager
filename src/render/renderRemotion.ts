// =====================================
// MODULE: Render Remotion
// Purpose: Remotion kompozisyonlarını programatik olarak render etmek
// Dependencies: core/exec, core/logger, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-19
// =====================================

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';
import { TIMEOUTS } from '../config/constants.js';

export interface RenderProps {
  [key: string]: unknown;
}

export interface RenderResult {
  outputPath: string;
  durationMs: number;
}

/**
 * Remotion kompozisyonunu render et (npx remotion render ile subprocess olarak).
 * @param compositionId Remotion'da kayıtlı composition id (ör. 'FunnyClip', 'HotelTourLandscape')
 * @param inputProps Render için input props (props.json olarak temp file'a yazılır)
 * @param outputPath Çıkış MP4 dosya yolu
 * @param jobId İşi izlemek için (log ve hata raporunda)
 * @returns {outputPath, durationMs}
 */
export async function renderRemotion(
  compositionId: string,
  inputProps: RenderProps,
  outputPath: string,
  jobId: number,
): Promise<RenderResult> {
  const startMs = Date.now();
  Logger.debug(`[job ${jobId}] Remotion render başlıyor: ${compositionId} → ${outputPath}`);

  // Remotion CLI'nin --props bayrağı ya doğrudan bir JSON string ya da bir
  // .json dosya yolu bekler (base64 desteklemez - @remotion/cli/dist/get-input-props.js
  // JSON.parse(props) ya da dosyayı okuyup JSON.parse eder, üçüncü bir yol yok).
  const propsPath = join('data/work', `props_${jobId}_${Date.now()}.json`);

  try {
    await mkdir('data/work', { recursive: true });
    await writeFile(propsPath, JSON.stringify(inputProps));

    // Windows'ta npx bir .cmd betigidir - Node'un spawn()'i shell olmadan
    // bunu calistiramaz (ENOENT/EINVAL), bu yuzden Windows'ta shell:true gerekir.
    //
    // --public-dir: is'e ozel dosyalar (data/work/<jobId>/...) Remotion'un
    // public/ klasorunun disinda uretiliyor. public-dir proje koku olarak
    // verilmezse Remotion'un dahili statik sunucusu bu dosyalari kendi gecici
    // webpack bundle dizinine gore aramaya calisir (404) - mutlak yol vermek
    // de cozum degil, cunku Remotion onu file:// URI'sine cevirip kendi
    // downloader'inda reddediyor (sadece http(s) kabul eder). Dogru yol:
    // goreli path + public-dir proje koku.
    const result = await run(
      'npx',
      [
        'remotion',
        'render',
        'remotion/index.ts',
        compositionId,
        outputPath,
        `--props=${propsPath}`,
        `--public-dir=${resolve('.')}`,
        '--concurrency=1',
      ],
      TIMEOUTS.RENDER_MS,
      undefined,
      process.platform === 'win32',
    );

    const durationMs = Date.now() - startMs;
    Logger.success(`[job ${jobId}] Render tamamlandı (${(durationMs / 1000).toFixed(1)}s)`);

    return { outputPath, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    Logger.error(`[job ${jobId}] Render başarısız (${(durationMs / 1000).toFixed(1)}s)`, err);
    throw err;
  } finally {
    await rm(propsPath, { force: true }).catch(() => undefined);
  }
}

/**
 * Composition'ın render süresi tahmini (frame sayısı / FPS).
 * Gerçek render süresi buna bağlı olacak (+ encoder overhead).
 * @param durationInFrames Frames cinsinden süre
 * @param fps Frame rate
 * @returns Tahmini render süresi (ms)
 */
export function estimateRenderTime(durationInFrames: number, fps: number): number {
  const durationSec = durationInFrames / fps;
  // Tahmini: video süresi + %50 encoder overhead
  return Math.round((durationSec * 1.5) * 1000);
}
