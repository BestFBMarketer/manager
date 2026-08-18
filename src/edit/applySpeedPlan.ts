// =====================================
// MODULE: Apply Speed Plan
// Purpose: Hiz planini FFmpeg ile uygular - kesme, hizlandirma, birlestirme
// Dependencies: core/exec, config/constants, edit/speedPlanner, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { TIMEOUTS, VIDEO } from '../config/constants.js';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';
import type { SpeedPlan } from './speedPlanner.js';

export interface ApplyOptions {
  inputPath: string;
  outputPath: string;
  plan: SpeedPlan;
  /** Orijinal ses korunacaksa tempo da ayarlanir (drone ruzgari genelde atilir) */
  keepAudio?: boolean;
}

/**
 * atempo filtresi 0.5-2.0 araligi disini kabul etmez; buyuk carpanlar
 * zincirlenerek uygulanir (orn. 2.5x -> 2.0 * 1.25).
 */
function atempoChain(factor: number): string {
  const steps: number[] = [];
  let remaining = factor;

  while (remaining > 2) {
    steps.push(2);
    remaining /= 2;
  }
  while (remaining < 0.5) {
    steps.push(0.5);
    remaining /= 0.5;
  }
  steps.push(Number(remaining.toFixed(4)));

  return steps.map((step) => `atempo=${step}`).join(',');
}

/**
 * Plani uygular: atilan bolumler cikarilir, kalanlar kendi hiz carpaniyla
 * yeniden zamanlanir ve tek bir akista birlestirilir.
 *
 * @param options Girdi, cikti ve plan
 * @returns Uretilen dosyanin yolu
 */
export async function applySpeedPlan(options: ApplyOptions): Promise<string> {
  const kept = options.plan.segments.filter((segment) => segment.action !== 'drop');

  if (kept.length === 0) {
    throw new Error('Hiz plani tum bolumleri atiyor - kurgulanacak goruntu kalmadi');
  }

  await mkdir(dirname(options.outputPath), { recursive: true });

  const filters: string[] = [];
  const videoLabels: string[] = [];
  const audioLabels: string[] = [];

  kept.forEach((segment, index) => {
    const videoLabel = `v${index}`;
    filters.push(
      `[0:v]trim=start=${segment.startSec.toFixed(3)}:end=${segment.endSec.toFixed(3)},` +
        `setpts=(PTS-STARTPTS)/${segment.factor}[${videoLabel}]`,
    );
    videoLabels.push(`[${videoLabel}]`);

    if (options.keepAudio) {
      const audioLabel = `a${index}`;
      filters.push(
        `[0:a]atrim=start=${segment.startSec.toFixed(3)}:end=${segment.endSec.toFixed(3)},` +
          `asetpts=PTS-STARTPTS,${atempoChain(segment.factor)}[${audioLabel}]`,
      );
      audioLabels.push(`[${audioLabel}]`);
    }
  });

  const streamsPerSegment = options.keepAudio ? 2 : 1;
  const concatInputs = options.keepAudio
    ? videoLabels.map((label, index) => `${label}${audioLabels[index]}`).join('')
    : videoLabels.join('');

  filters.push(
    `${concatInputs}concat=n=${kept.length}:v=1:a=${options.keepAudio ? 1 : 0}` +
      `[outv]${options.keepAudio ? '[outa]' : ''}`,
  );

  // Hizlandirma sonrasi kare tekrarlarini duzeltmek icin sabit fps'e oturtulur.
  filters.push(`[outv]fps=${VIDEO.FPS},format=${VIDEO.PIXEL_FORMAT}[outvf]`);

  const args = [
    '-hide_banner',
    '-y',
    '-i', options.inputPath,
    '-filter_complex', filters.join(';'),
    '-map', '[outvf]',
  ];

  if (options.keepAudio) args.push('-map', '[outa]', '-c:a', 'aac', '-b:a', '192k');
  else args.push('-an');

  args.push(
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '19',
    '-movflags', '+faststart',
    options.outputPath,
  );

  void streamsPerSegment;

  try {
    await run('ffmpeg', args, TIMEOUTS.FFMPEG_MS);
    Logger.success(
      `Kurgu uygulandi: ${options.plan.sourceDurationSec.toFixed(0)}sn -> ` +
        `${options.plan.outputDurationSec.toFixed(0)}sn (${kept.length} bolum)`,
    );
    return options.outputPath;
  } catch (error) {
    Logger.error('Hiz plani uygulanamadi', error);
    throw error;
  }
}
