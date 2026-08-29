// =====================================
// MODULE: Transitions
// Purpose: Gunduz-gece eslesmelerini gecis efektiyle birlestirir
// Dependencies: core/exec, config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { TIMEOUTS, TRANSITION, VIDEO } from '../config/constants.js';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';
import { videoEncoderArgs } from './videoEncoder.js';

/**
 * FFmpeg xfade gecis tipleri.
 * `fade` gunduz-gece gecisinde en dogal duran; `wipeleft`/`circleopen`
 * daha gosterisli ama ayni kadrajda dikkat dagitabilir.
 */
export type TransitionKind = 'fade' | 'fadeblack' | 'wipeleft' | 'circleopen' | 'dissolve';

export interface TransitionOptions {
  /** Aydinlik cekim */
  brightPath: string;
  /** Karanlik cekim */
  darkPath: string;
  outputPath: string;
  /** Her iki taraftan alinacak sure */
  holdSec?: number;
  durationSec?: number;
  kind?: TransitionKind;
  /** Aydinlik klipte gecise girilecek an */
  brightStartSec?: number;
  /** Karanlik klipte gecisten sonra devam edilecek an */
  darkStartSec?: number;
}

/**
 * Ayni acidan cekilmis gunduz ve gece goruntusunu tek bir gecise baglar.
 *
 * Kadraj ayni oldugu icin capraz gecis "zaman atlamasi" hissi verir:
 * izleyici ayni manzarayi gunduzden geceye donerken gorur.
 *
 * @param options Iki klip, gecis tipi ve sureler
 * @returns Uretilen dosyanin yolu
 */
export async function renderDayNightTransition(options: TransitionOptions): Promise<string> {
  const hold = options.holdSec ?? TRANSITION.HOLD_SEC;
  const duration = options.durationSec ?? TRANSITION.DURATION_SEC;
  const kind = options.kind ?? 'fade';
  const brightStart = options.brightStartSec ?? 0;
  const darkStart = options.darkStartSec ?? 0;

  await mkdir(dirname(options.outputPath), { recursive: true });

  // xfade, ikinci akisi birinci akisin sonuna gore konumlandirir.
  const offset = Math.max(0, hold - duration);

  const filters = [
    `[0:v]trim=start=${brightStart}:duration=${hold},setpts=PTS-STARTPTS,` +
      `scale=${VIDEO.LANDSCAPE_WIDTH}:${VIDEO.LANDSCAPE_HEIGHT}:force_original_aspect_ratio=increase,` +
      `crop=${VIDEO.LANDSCAPE_WIDTH}:${VIDEO.LANDSCAPE_HEIGHT},fps=${VIDEO.FPS}[a]`,
    `[1:v]trim=start=${darkStart}:duration=${hold},setpts=PTS-STARTPTS,` +
      `scale=${VIDEO.LANDSCAPE_WIDTH}:${VIDEO.LANDSCAPE_HEIGHT}:force_original_aspect_ratio=increase,` +
      `crop=${VIDEO.LANDSCAPE_WIDTH}:${VIDEO.LANDSCAPE_HEIGHT},fps=${VIDEO.FPS}[b]`,
    `[a][b]xfade=transition=${kind}:duration=${duration}:offset=${offset},` +
      `format=${VIDEO.PIXEL_FORMAT}[out]`,
  ];

  const args = [
    '-hide_banner',
    '-y',
    '-i', options.brightPath,
    '-i', options.darkPath,
    '-filter_complex', filters.join(';'),
    '-map', '[out]',
    '-an',
    ...videoEncoderArgs(19),
    '-movflags', '+faststart',
    options.outputPath,
  ];

  try {
    await run('ffmpeg', args, TIMEOUTS.FFMPEG_MS);
    Logger.success(
      `Gunduz-gece gecisi uretildi: ${options.outputPath} ` +
        `(${kind}, ${duration}sn gecis, toplam ${(hold * 2 - duration).toFixed(1)}sn)`,
    );
    return options.outputPath;
  } catch (error) {
    Logger.error('Gecis uretilemedi', error);
    throw error;
  }
}
