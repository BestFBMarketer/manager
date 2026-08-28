// =====================================
// MODULE: Piper TTS
// Purpose: Yerel, CPU'da calisan ucretsiz seslendirme - varsayilan yedek saglayici
// Dependencies: core/exec, config/env, ingest/probe
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { TIMEOUTS } from '../../config/constants.js';
import { optionalEnv } from '../../config/env.js';
import { isAvailable, run } from '../../core/exec.js';
import { probe } from '../../ingest/probe.js';
import type { TtsProvider, TtsRequest, TtsResult } from '../types.js';

const PIPER_BIN = optionalEnv('PIPER_BIN') ?? 'piper';

export const piperProvider: TtsProvider = {
  name: 'piper',
  free: true,

  isConfigured: () => isAvailable(PIPER_BIN),

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    await mkdir(dirname(request.outputPath), { recursive: true });

    // voiceRef burada .onnx ses modelinin yoludur.
    const args = ['--model', request.voiceRef, '--output_file', request.outputPath];
    if (request.speed && request.speed !== 1) {
      // Piper length_scale ters orantilidir: kucuk deger = hizli konusma
      args.push('--length_scale', String(1 / request.speed));
    }

    // Metin dogrudan stdin'e yazilir - shell pipe kullanilmaz (Windows'ta
    // ters slash'li yollar POSIX shell'de kacis karakteri sayilip bozuluyordu).
    await run(PIPER_BIN, args, TIMEOUTS.FFMPEG_MS, request.text);

    const info = await probe(request.outputPath);
    return { outputPath: request.outputPath, durationSec: info.durationSec, provider: 'piper', costUsd: 0 };
  },
};
