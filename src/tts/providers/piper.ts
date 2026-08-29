// =====================================
// MODULE: Piper TTS
// Purpose: Yerel, CPU'da calisan ucretsiz seslendirme - varsayilan yedek saglayici
// Dependencies: core/exec, config/env, ingest/probe
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { TIMEOUTS } from '../../config/constants.js';
import { optionalEnv } from '../../config/env.js';
import { isAvailable, run } from '../../core/exec.js';
import { probe } from '../../ingest/probe.js';
import type { TtsProvider, TtsRequest, TtsResult } from '../types.js';

const PIPER_BIN = optionalEnv('PIPER_BIN') ?? 'piper';
const TTS_VOICE_DIR = 'data/tts-voices';

const PREVIEW_TEXT: Record<string, string> = {
  de: 'Hallo, dies ist eine Sprachprobe.',
  en: 'Hello, this is a voice sample.',
  tr: 'Merhaba, bu bir ses örneğidir.',
};

export interface PiperVoice {
  /** --model bayragina verilecek dosya yolu - kanal ayarina (voiceProfileId) bu yazilir */
  modelPath: string;
  /** Dosya adindan cikarilan goruntu adi, orn. "thorsten (de, medium)" */
  label: string;
  language: string;
}

/** Panelin "Ses" sekmesi icin - data/tts-voices altina indirilmis tum Piper modellerini listeler. */
export async function listPiperVoices(): Promise<PiperVoice[]> {
  let files: string[];
  try {
    files = await readdir(TTS_VOICE_DIR);
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith('.onnx'))
    .map((file) => {
      // Piper dosya adi kurali: {dil}_{bolge}-{konusmaci}-{kalite}.onnx
      const match = /^([a-z]{2})_[A-Z]{2}-([^-]+)-([a-z]+)\.onnx$/.exec(file);
      const language = match?.[1] ?? 'en';
      const speaker = match?.[2] ?? file.replace('.onnx', '');
      const quality = match?.[3] ?? '';
      return {
        modelPath: join(TTS_VOICE_DIR, file),
        label: `${speaker} (${language}${quality ? `, ${quality}` : ''})`,
        language,
      };
    });
}

/** Onizleme icin - kisa sabit bir cumleyi bu modelle seslendirip ham WAV bytes'ini doner. */
export async function synthesizePiperPreview(modelPath: string, language: string): Promise<ArrayBuffer> {
  const text = PREVIEW_TEXT[language] ?? PREVIEW_TEXT.en!;
  const tmpPath = join(TTS_VOICE_DIR, `.preview-${Date.now()}.wav`);
  try {
    await run(PIPER_BIN, ['--model', modelPath, '--output_file', tmpPath], TIMEOUTS.FFMPEG_MS, text);
    const buffer = await readFile(tmpPath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  } finally {
    await rm(tmpPath, { force: true }).catch(() => undefined);
  }
}

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
