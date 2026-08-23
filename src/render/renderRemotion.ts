// =====================================
// MODULE: Render Remotion
// Purpose: Remotion kompozisyonlarını programatik olarak render etmek
// Dependencies: core/exec, core/logger, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-19
// =====================================

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
 * @param compositionId Remotion'da kayıtlı composition id (ör. 'FunnyRanking', 'HotelTourLandscape')
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

  try {
    // Props'ları JSON olarak serialize et ve render komutuna ver
    const propsJson = JSON.stringify(inputProps);

    const result = await run(
      'npx',
      [
        'remotion',
        'render',
        'remotion/index.ts',
        compositionId,
        outputPath,
        '--props=' + Buffer.from(propsJson).toString('base64'),
        '--concurrency=1',
      ],
      TIMEOUTS.RENDER_MS,
    );

    const durationMs = Date.now() - startMs;
    Logger.success(`[job ${jobId}] Render tamamlandı (${(durationMs / 1000).toFixed(1)}s)`);

    return { outputPath, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    Logger.error(`[job ${jobId}] Render başarısız (${(durationMs / 1000).toFixed(1)}s)`, err);
    throw err;
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
