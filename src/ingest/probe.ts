// =====================================
// MODULE: Probe
// Purpose: ffprobe ile video metadata okuma
// Dependencies: core/exec, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { TIMEOUTS } from '../config/constants.js';
import { run } from '../core/exec.js';

export interface MediaInfo {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string };
}

function parseFps(rate: string | undefined): number {
  if (!rate) return 0;
  const [num, den] = rate.split('/').map(Number);
  if (!num || !den) return 0;
  return num / den;
}

/**
 * Video dosyasinin temel ozelliklerini dondurur.
 * @param filePath Video yolu
 * @returns Sure, cozunurluk, fps ve ses varligi
 */
export async function probe(filePath: string): Promise<MediaInfo> {
  const { stdout } = await run(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    TIMEOUTS.HTTP_REQUEST_MS,
  );

  const parsed = JSON.parse(stdout) as FfprobeOutput;
  const video = parsed.streams?.find((s) => s.codec_type === 'video');
  const audio = parsed.streams?.find((s) => s.codec_type === 'audio');

  return {
    durationSec: Number(parsed.format?.duration ?? 0),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps: parseFps(video?.avg_frame_rate),
    hasAudio: audio !== undefined,
  };
}
