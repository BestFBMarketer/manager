// =====================================
// MODULE: TTS Router
// Purpose: Seslendirme saglayici zinciri - once yerel/ucretsiz motorlar
// Dependencies: tts/providers/*, core/logger, config/env
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { optionalEnv } from '../config/env.js';
import { Logger } from '../core/logger.js';
import { piperProvider } from './providers/piper.js';
import { voiceboxProvider } from './providers/voicebox.js';
import type { TtsProvider, TtsRequest, TtsResult } from './types.js';

/**
 * Zincir sirasi: Voicebox -> Piper.
 *
 * Voicebox GPU ister, bu yuzden VPS'te calismaz; erisilebilir oldugunda
 * (orn. kullanicinin makinesinde acikken, tunel uzerinden) klonlanmis
 * karakter sesi kullanilir. Erisim yoksa zincir sessizce Piper'a duser:
 * Piper CPU'da calisir, GPU istemez ve VPS'in varsayilan motorudur.
 * Ikisi de ucretsizdir.
 */
const CHAIN: TtsProvider[] = [voiceboxProvider, piperProvider];

/**
 * Metni sese cevirir; zincirdeki ilk calisir saglayiciyi kullanir.
 * @param request Metin, ses kimligi ve cikti yolu
 * @param preferredProvider Verilirse (kanalin settings.ttsProvider'i) o saglayici
 *                          once denenir - yine de hazir degilse/hata verirse zincir
 *                          normal sirasinda devam eder, is asla bu yuzden durmaz.
 * @returns Uretilen ses dosyasi ve suresi
 */
export async function synthesizeSpeech(request: TtsRequest, preferredProvider?: string | null): Promise<TtsResult> {
  const skipped: string[] = [];
  const chain = preferredProvider
    ? [...CHAIN].sort((a, b) => Number(b.name === preferredProvider) - Number(a.name === preferredProvider))
    : CHAIN;

  for (const provider of chain) {
    if (!(await provider.isConfigured())) {
      skipped.push(`${provider.name} (hazir degil)`);
      continue;
    }

    try {
      const result = await provider.synthesize(request);
      Logger.success(`Seslendirme ${provider.name}: ${result.durationSec.toFixed(1)}sn`);
      return result;
    } catch (error) {
      Logger.warn(`${provider.name} seslendirme basarisiz, zincirde ilerleniyor`, error);
      skipped.push(`${provider.name} (hata)`);
    }
  }

  throw new Error(`Seslendirme zinciri tukendi. Denenenler: ${skipped.join(', ') || 'yok'}`);
}

/** Yapilandirilmis karakter sesi kimligi (.env: TTS_VOICE_REF). */
export function defaultVoiceRef(): string {
  return optionalEnv('TTS_VOICE_REF') ?? '';
}

/**
 * Kanalin panelde secilmis sesini (Ses sekmesi -> settings.ttsProvider/voiceRef)
 * .env varsayilanina dusen bir cift olarak doner - worker stage'leri bunu tek
 * yerden cagirir, boylece her stage kendi fallback mantigini tekrar etmez.
 */
export function resolveChannelVoice(channel: { settings: { ttsProvider: string | null; voiceRef: string | null } }): {
  voiceRef: string;
  provider: string | null;
} {
  return {
    voiceRef: channel.settings.voiceRef ?? defaultVoiceRef(),
    provider: channel.settings.ttsProvider,
  };
}

export async function listTtsStatus(): Promise<Array<{ name: string; free: boolean; ready: boolean }>> {
  return Promise.all(
    CHAIN.map(async (provider) => ({
      name: provider.name,
      free: provider.free,
      ready: await provider.isConfigured(),
    })),
  );
}
