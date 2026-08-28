// =====================================
// MODULE: Audio Mix
// Purpose: Soundtrack + seslendirme miksaji; konusma sirasinda muzik otomatik kisilir
// Dependencies: core/exec, config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AUDIO, MUSIC_SEGMENT, TIMEOUTS, VIDEO } from '../config/constants.js';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';

/** Videonun bir bolumunu kaplayan soundtrack. */
export interface MusicPlacement {
  trackPath: string;
  startSec: number;
  endSec: number;
}

export interface MixOptions {
  videoPath: string;
  /** Tek parca ile dosemek icin - basit kullanim */
  musicPath?: string;
  /** Bolum bolum farkli parcalar - hizli gecis / yakin plan icin ayri muzik */
  musicSegments?: MusicPlacement[];
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
  const segments = options.musicSegments ?? [];
  const hasSegments = segments.length > 0;

  if (!options.musicPath && !hasSegments && !options.voicePath) {
    Logger.debug('Miksaj icin ses kaynagi yok, video oldugu gibi birakiliyor');
    return options.videoPath;
  }

  await mkdir(dirname(options.outputPath), { recursive: true });

  const inputs: string[] = ['-i', options.videoPath];
  const filters: string[] = [];
  const duration = options.videoDurationSec;

  let musicLabel: string | null = null;
  /** sidechaincompress'in yan zinciri icin ayrilmis seslendirme etiketi */
  let voiceDuckLabel: string | null = null;
  /** Nihai miksa girecek seslendirme etiketi */
  let voiceMixLabel: string | null = null;
  let nextInput = 1;

  // Kaynaklar farkli ornekleme hizi/kanal duzenine sahip olabilir; amix ve
  // sidechaincompress ayni formati bekler, bu yuzden hepsi once normalize edilir.
  const NORMALIZE = `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo`;

  if (hasSegments) {
    // Her bolum kendi parcasini alir; bolum sinirlarinda fade'ler ust uste
    // bindigi icin gecis crossfade gibi duyulur.
    const crossfade = MUSIC_SEGMENT.CROSSFADE_SEC;
    const segmentLabels: string[] = [];

    segments.forEach((segment, order) => {
      // stream_loop -1: bolumden kisa parca bolum boyunca dongulenir
      inputs.push('-stream_loop', '-1', '-i', segment.trackPath);
      const index = nextInput++;
      const label = `m${order}`;
      const span = Math.max(0.1, segment.endSec - segment.startSec);
      // Gecis payi: ilk bolum disinda parca biraz erken baslar
      const lead = order === 0 ? 0 : crossfade;
      const startMs = Math.round(Math.max(0, segment.startSec - lead) * 1000);
      const takeSec = span + lead;

      filters.push(
        `[${index}:a]${NORMALIZE},atrim=0:${takeSec.toFixed(3)},asetpts=PTS-STARTPTS,` +
          `afade=t=in:st=0:d=${order === 0 ? AUDIO.FADE_IN_SEC : crossfade},` +
          `afade=t=out:st=${Math.max(0, takeSec - crossfade).toFixed(3)}:d=${crossfade},` +
          `volume=${AUDIO.MUSIC_GAIN},adelay=${startMs}:all=1[${label}]`,
      );
      segmentLabels.push(`[${label}]`);
    });

    if (segmentLabels.length === 1) {
      musicLabel = segmentLabels[0]!;
    } else {
      filters.push(
        `${segmentLabels.join('')}amix=inputs=${segmentLabels.length}:` +
          `duration=longest:normalize=0[music]`,
      );
      musicLabel = '[music]';
    }
  } else if (options.musicPath) {
    // stream_loop -1: kisa parca video boyunca dongulenir
    inputs.push('-stream_loop', '-1', '-i', options.musicPath);
    const index = nextInput++;
    filters.push(
      `[${index}:a]${NORMALIZE},atrim=0:${duration},` +
        `afade=t=in:st=0:d=${AUDIO.FADE_IN_SEC},` +
        `afade=t=out:st=${Math.max(0, duration - AUDIO.FADE_OUT_SEC)}:d=${AUDIO.FADE_OUT_SEC},` +
        `volume=${AUDIO.MUSIC_GAIN}[music]`,
    );
    musicLabel = '[music]';
  }

  if (options.voicePath) {
    inputs.push('-i', options.voicePath);
    const index = nextInput++;
    const voiceBase =
      `[${index}:a]${NORMALIZE},volume=${AUDIO.VOICE_GAIN},apad=whole_dur=${duration}`;

    if (musicLabel) {
      // asplit sart: muzik varsa seslendirme hem ducking yan zincirinde hem
      // nihai miksta kullanilir; ayni etiketi iki kez tuketmek filtergraph
      // hatasi verir. Muzik yoksa split gereksiz - kullanilmayan cikis
      // "unconnected" filtergraph hatasina yol acar.
      filters.push(`${voiceBase},asplit=2[voice_duck][voice_mix]`);
      voiceDuckLabel = '[voice_duck]';
      voiceMixLabel = '[voice_mix]';
    } else {
      filters.push(`${voiceBase}[voice_only]`);
      voiceMixLabel = '[voice_only]';
    }
  }

  let mixLabel: string;

  if (musicLabel && voiceDuckLabel && voiceMixLabel) {
    // Ducking: seslendirme yan zincir olarak muzigi bastirir
    filters.push(
      `${musicLabel}${voiceDuckLabel}sidechaincompress=` +
        `threshold=${AUDIO.DUCK_THRESHOLD}:ratio=${AUDIO.DUCK_RATIO}:` +
        `attack=${AUDIO.DUCK_ATTACK_MS}:release=${AUDIO.DUCK_RELEASE_MS}[ducked]`,
    );
    filters.push(`[ducked]${voiceMixLabel}amix=inputs=2:duration=first:dropout_transition=0[mixed]`);
    mixLabel = '[mixed]';
  } else if (musicLabel) {
    mixLabel = musicLabel;
  } else {
    // Sadece seslendirme var: split yok, dogrudan kullan.
    mixLabel = voiceMixLabel!;
  }

  // Orijinal video sesi istenirse en son karistirilir.
  if (options.keepOriginalAudio) {
    filters.push(`[0:a]${NORMALIZE},volume=${AUDIO.ORIGINAL_GAIN}[orig]`);
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
    const musicNote = hasSegments
      ? ` (+${segments.length} bolum muzigi, gecisli)`
      : options.musicPath
        ? ' (+muzik)'
        : '';
    Logger.success(
      `Ses miksaji tamam: ${options.outputPath}${musicNote}` +
        `${options.voicePath ? ' (+seslendirme, ducking acik)' : ''}`,
    );
    return options.outputPath;
  } catch (error) {
    Logger.error('Ses miksaji basarisiz', error);
    throw error;
  }
}
