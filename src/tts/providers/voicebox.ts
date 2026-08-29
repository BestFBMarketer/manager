// =====================================
// MODULE: Voicebox TTS
// Purpose: Voicebox'in yerel REST API'si uzerinden klonlanmis karakter sesi
// Dependencies: config/env, core/logger, core/constants, ingest/probe
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { TIMEOUTS } from '../../config/constants.js';
import { optionalEnv } from '../../config/env.js';
import { Logger } from '../../core/logger.js';
import { probe } from '../../ingest/probe.js';
import type { TtsProvider, TtsRequest, TtsResult } from '../types.js';

/** Voicebox varsayilan olarak yerelde dinler; uzak makinede ise .env ile ezilir. */
const BASE_URL = optionalEnv('VOICEBOX_URL') ?? 'http://127.0.0.1:17493';

const POLL_INTERVAL_MS = 1_000;
const POLL_MAX_ATTEMPTS = 60; // ~1 dakika - uzun metinler (hikaye kanali) daha uzun surebilir

export interface VoiceProfile {
  id: string;
  name: string;
  language: string;
}

/** Panelin "Ses" sekmesi icin - kullanicinin Voicebox'ta olusturdugu tum profilleri listeler. */
export async function listVoiceboxProfiles(): Promise<VoiceProfile[]> {
  const response = await fetch(`${BASE_URL}/profiles`, { signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS) });
  if (!response.ok) throw new Error(`voicebox profil listesi alinamadi: HTTP ${response.status}`);
  return (await response.json()) as VoiceProfile[];
}

interface ProfileSample {
  id: string;
}

/**
 * Onizleme icin - profilin klonlama sirasinda kaydedilen ilk ses orneginin
 * ham bytes'ini doner (gercek bir uretim degil, aninda calar). Panel bunu
 * kanal ayarlarinda "dinle" butonu icin proxy'ler.
 */
export async function fetchVoiceboxPreviewAudio(profileId: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const samplesRes = await fetch(`${BASE_URL}/profiles/${profileId}/samples`, {
    signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
  });
  if (!samplesRes.ok) throw new Error(`voicebox profil ornekleri alinamadi: HTTP ${samplesRes.status}`);
  const samples = (await samplesRes.json()) as ProfileSample[];
  if (samples.length === 0) throw new Error('bu profilin kayitli bir ses ornegi yok');

  const audioRes = await fetch(`${BASE_URL}/samples/${samples[0]!.id}`, {
    signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
  });
  if (!audioRes.ok) throw new Error(`voicebox ornek sesi alinamadi: HTTP ${audioRes.status}`);

  return { bytes: await audioRes.arrayBuffer(), contentType: audioRes.headers.get('content-type') ?? 'audio/wav' };
}

interface GenerationResponse {
  id: string;
  status: string; // 'completed' | 'processing' | 'failed' | ...
  error?: string | null;
}

/**
 * voiceRef bir Voicebox profil id'si veya adi olabilir - kullanicinin panelde
 * gordugu ad (orn. "HKG2") ile calisan gercek id'yi eslestirir.
 */
async function resolveProfileId(voiceRef: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/profiles`, { signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS) });
  if (!response.ok) throw new Error(`voicebox profil listesi alinamadi: HTTP ${response.status}`);

  const profiles = (await response.json()) as VoiceProfile[];
  const match = profiles.find((p) => p.id === voiceRef || p.name === voiceRef);
  if (!match) {
    throw new Error(
      `voicebox profili bulunamadi: "${voiceRef}" (mevcut: ${profiles.map((p) => p.name).join(', ') || 'hicbiri'})`,
    );
  }
  return match.id;
}

/** /generate hemen "completed" donmezse (uzun metin) durumu polling ile bekler. */
async function waitUntilDone(generationId: string): Promise<GenerationResponse> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${BASE_URL}/generate/${generationId}/status`, {
      signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
    });
    const data = (await response.json()) as GenerationResponse;

    if (data.status === 'completed') return data;
    if (data.status === 'failed') throw new Error(`voicebox uretimi basarisiz: ${data.error ?? 'bilinmeyen hata'}`);

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error('voicebox uretimi zaman asimina ugradi');
}

export const voiceboxProvider: TtsProvider = {
  name: 'voicebox',
  free: true,

  async isConfigured(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { status?: string; model_loaded?: boolean };
      return data.status === 'healthy' && data.model_loaded === true;
    } catch {
      return false;
    }
  },

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    await mkdir(dirname(request.outputPath), { recursive: true });

    const profileId = await resolveProfileId(request.voiceRef);

    const createResponse = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: profileId,
        text: request.text,
        language: request.language ?? 'en',
      }),
      signal: AbortSignal.timeout(TIMEOUTS.LLM_REQUEST_MS),
    });

    if (!createResponse.ok) {
      throw new Error(`voicebox HTTP ${createResponse.status}: ${await createResponse.text()}`);
    }

    let generation = (await createResponse.json()) as GenerationResponse;
    if (generation.status !== 'completed') {
      generation = await waitUntilDone(generation.id);
    }

    const audioResponse = await fetch(`${BASE_URL}/audio/${generation.id}`, {
      signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
    });
    if (!audioResponse.ok) {
      throw new Error(`voicebox ses dosyasi alinamadi: HTTP ${audioResponse.status}`);
    }

    await writeFile(request.outputPath, Buffer.from(await audioResponse.arrayBuffer()));
    Logger.debug(`Voicebox sesi yazildi: ${request.outputPath}`);

    const info = await probe(request.outputPath);
    return { outputPath: request.outputPath, durationSec: info.durationSec, provider: 'voicebox', costUsd: 0 };
  },
};
