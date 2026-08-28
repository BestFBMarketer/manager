// =====================================
// MODULE: Voicebox TTS
// Purpose: Voicebox'in yerel REST API'si uzerinden klonlanmis karakter sesi
// Dependencies: config/env, core/logger, ingest/probe
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { TIMEOUTS } from '../../config/constants.js';
import { optionalEnv } from '../../config/env.js';
import { Logger } from '../../core/logger.js';
import { probe } from '../../ingest/probe.js';
import type { TtsProvider, TtsRequest, TtsResult } from '../types.js';

/** Voicebox varsayilan olarak yerelde dinler; uzak makinede ise .env ile ezilir. */
const BASE_URL = optionalEnv('VOICEBOX_URL') ?? 'http://127.0.0.1:5050';

export const voiceboxProvider: TtsProvider = {
  name: 'voicebox',
  free: true,

  async isConfigured(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    await mkdir(dirname(request.outputPath), { recursive: true });

    const response = await fetch(`${BASE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: request.text,
        voice: request.voiceRef,
        speed: request.speed ?? 1,
        format: 'wav',
      }),
      signal: AbortSignal.timeout(TIMEOUTS.LLM_REQUEST_MS),
    });

    if (!response.ok) {
      throw new Error(`voicebox HTTP ${response.status}: ${await response.text()}`);
    }

    await writeFile(request.outputPath, Buffer.from(await response.arrayBuffer()));
    Logger.debug(`Voicebox sesi yazildi: ${request.outputPath}`);

    const info = await probe(request.outputPath);
    return { outputPath: request.outputPath, durationSec: info.durationSec, provider: 'voicebox', costUsd: 0 };
  },
};
