// =====================================
// MODULE: Audio Mix
// Purpose: Soundtrack + seslendirme miksaji; konusma sirasinda muzik otomatik kisilir
// Dependencies: core/exec, config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AUDIO, TIMEOUTS, VIDEO } from '../config/constants.js';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';

export interface MixOptions {
  videoPath: string;
  musicPath?: string;
  /** Seslendirme dosyasi - varsa muzik bunun altinda kisilir (ducking) */
  voicePath?: string;
  outputPath: string;
  videoDurationSec: number;
  /** Orijinal video sesi korunsun mu (drone ruzgar sesi genelde istenmez) */
  keepOriginalAudio?: boolean;
}

/**
 * Videoya muzik ve seslendirme bindirir.
 *
 * Muzik video suresine gore donguleneir, basta/sonda fade uygulanir ve
 * seslendirme varken `sidechaincompress` ile otomatik kisilir - boylece
 * konusma her zaman anlasilir kalir.
 *
 * @param options Miksaj parametreleri
 * @returns Uretilen dosyanin yolu
 */
export async function mixAudio(options: MixOptions): Promise<string> {
  if (!options.musicPath && !options.voicePath) {
    Logger.debug('Miksaj icin ses kaynagi yok, video oldugu gibi birakiliyor');
    return options.videoPath;
  }

  await mkdir(dirname(options.outputPath), { recursive: true });

  const inputs: string[] = ['-i', options.videoPath];
  const filters: string[] = [];
  const duration = options.videoDurationSec;

  let musicLabel: string | null = null;
  let voiceLabel: string | null = null;
  let nextInput = 1;

  if (options.musicPath) {
    // stream_loop -1: kisa parca video boyunca dongulenir
    inputs.push('-stream_loop', '-1', '-i', options.musicPath);
    const index = nextInput++;
    filters.push(
      `[${index}:a]atrim=0:${duration},` +
        `afade=t=in:st=0:d=${AUDIO.FADE_IN_SEC},` +
        `afade=t=out:st=${Math.max(0, duration - AUDIO.FADE_OUT_SEC)}:d=${AUDIO.FADE_OUT_SEC},` +
        `volume=${AUDIO.MUSIC_GAIN}[music]`,
    );
    musicLabel = '[music]';
  }

  if (options.voicePath) {
    inputs.push('-i', options.voicePath);
    const index = nextInput++;
    filters.push(`[${index}:a]volume=${AUDIO.VOICE_GAIN},apad=whole_dur=${duration}[voice]`);
    voiceLabel = '[voice]';
  }

  let mixLabel: string;

  if (musicLabel && voiceLabel) {
    // Ducking: seslendirme yan zincir olarak muzigi bastirir
    filters.push(
      `[music][voice]sidechaincompress=` +
        `threshold=${AUDIO.DUCK_THRESHOLD}:ratio=${AUDIO.DUCK_RATIO}:` +
        `attack=${AUDIO.DUCK_ATTACK_MS}:release=${AUDIO.DUCK_RELEASE_MS}[ducked]`,
    );
    filters.push(`[ducked][voice]amix=inputs=2:duration=first:dropout_transition=0[mixed]`);
    mixLabel = '[mixed]';
  } else {
    mixLabel = musicLabel ?? voiceLabel!;
  }

  // Orijinal video sesi istenirse en son karistirilir.
  if (options.keepOriginalAudio) {
    filters.push(`[0:a]volume=${AUDIO.ORIGINAL_GAIN}[orig]`);
    filters.push(`${mixLabel}[orig]amix=inputs=2:duration=first[withorig]`);
    mixLabel = '[withorig]';
  }

  filters.push(
    `${mixLabel}loudnorm=I=${VIDEO.LOUDNESS_TARGET_LUFS}:TP=${VIDEO.LOUDNESS_TRUE_PEAK}:LRA=${VIDEO.LOUDNESS_RANGE}[out]`,
  );

  const args = [
    '-hide_banner',
    '-y',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '0:v',
    '-map', '[out]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    options.outputPath,
  ];

  try {
    await run('ffmpeg', args, TIMEOUTS.FFMPEG_MS);
    Logger.success(
      `Ses miksaji tamam: ${options.outputPath}` +
        `${options.musicPath ? ' (+muzik)' : ''}${options.voicePath ? ' (+seslendirme, ducking acik)' : ''}`,
    );
    return options.outputPath;
  } catch (error) {
    Logger.error('Ses miksaji basarisiz', error);
    throw error;
  }
}
