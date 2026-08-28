// =====================================
// MODULE: FFmpeg Cut
// Purpose: Kesim + cerceveleme + ses normalizasyonu -> Remotion'a girecek temiz taban
// Dependencies: core/exec, config/constants, edit/verticalFrame, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { TIMEOUTS, VIDEO } from '../config/constants.js';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';
import { landscapeFilter, verticalFilter, type FramingMode } from './verticalFrame.js';

export interface CutOptions {
  inputPath: string;
  outputPath: string;
  startSec: number;
  endSec: number;
  orientation: 'vertical' | 'landscape';
  framing?: FramingMode;
  /** Sesi EBU R128 hedefine normalize et */
  normalizeAudio?: boolean;
  /** Referans kanal/videodan kesiliyorsa true - baska kanalin logo/watermark/handle'i disari itilir/bulaniklastirilir */
  stripWatermarks?: boolean;
}

/**
 * Kaynaktan verilen araligi keser, hedef cerceveye oturtur ve sesi normalize eder.
 * @param options Kesim parametreleri
 * @returns Uretilen dosyanin yolu
 */
export async function cutAndFrame(options: CutOptions): Promise<string> {
  const duration = options.endSec - options.startSec;
  if (duration <= 0) {
    throw new Error(`Gecersiz kesim araligi: ${options.startSec} -> ${options.endSec}`);
  }

  await mkdir(dirname(options.outputPath), { recursive: true });

  const videoFilter =
    options.orientation === 'vertical'
      ? verticalFilter(options.framing ?? 'crop', options.stripWatermarks ?? false)
      : landscapeFilter();

  const filterFlag = videoFilter.includes(';') ? '-filter_complex' : '-vf';

  const args = [
    '-hide_banner',
    '-y',
    // Once kaba arama (hizli), sonra girdi sonrasi hassas arama (kare dogrulugu)
    '-ss', String(options.startSec),
    '-i', options.inputPath,
    '-t', String(duration),
    filterFlag, videoFilter,
  ];

  if (options.normalizeAudio !== false) {
    args.push(
      '-af',
      `loudnorm=I=${VIDEO.LOUDNESS_TARGET_LUFS}:TP=${VIDEO.LOUDNESS_TRUE_PEAK}:LRA=${VIDEO.LOUDNESS_RANGE}`,
    );
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', VIDEO.PIXEL_FORMAT,
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    options.outputPath,
  );

  try {
    await run('ffmpeg', args, TIMEOUTS.FFMPEG_MS);
    Logger.success(`Kesildi: ${options.outputPath} (${duration.toFixed(1)}sn, ${options.orientation})`);
    return options.outputPath;
  } catch (error) {
    Logger.error('FFmpeg kesimi basarisiz', error);
    throw error;
  }
}
