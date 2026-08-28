// =====================================
// MODULE: Gemini Provider
// Purpose: Ucretsiz katman - boru hattinin varsayilan is gucu
// Dependencies: config/env, config/constants, llm/types
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { optionalEnv } from '../../config/env.js';
import { TIMEOUTS } from '../../config/constants.js';
import { ProviderUnavailableError, type LlmProvider, type LlmRequest, type LlmResult } from '../types.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.6-flash';
const DEFAULT_MAX_TOKENS = 4_096;

// Ucretsiz katman limitleri saglayici tarafindan degistirilebilir; .env ile ezilebilir.
const FREE_RPM = Number(optionalEnv('GEMINI_FREE_RPM') ?? 10);
const FREE_RPD = Number(optionalEnv('GEMINI_FREE_RPD') ?? 250);

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; status?: string };
}

const model = optionalEnv('GEMINI_MODEL') ?? DEFAULT_MODEL;

export const geminiProvider: LlmProvider = {
  name: 'gemini',
  model,
  free: true,
  limits: { requestsPerMinute: FREE_RPM, requestsPerDay: FREE_RPD },

  isConfigured: () => optionalEnv('GEMINI_API_KEY') !== undefined,

  async call(request: LlmRequest): Promise<LlmResult> {
    const apiKey = optionalEnv('GEMINI_API_KEY');
    if (!apiKey) throw new ProviderUnavailableError('gemini', 'API anahtari tanimli degil');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUTS.LLM_REQUEST_MS);

    try {
      const response = await fetch(`${API_BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts: [{ text: request.user }] }],
          generationConfig: {
            maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        throw new ProviderUnavailableError('gemini', `HTTP ${response.status} - ucretsiz kota dolmus olabilir`);
      }

      const payload = (await response.json()) as GeminiResponse;
      if (!response.ok) {
        throw new Error(`gemini HTTP ${response.status}: ${payload.error?.message ?? 'bilinmeyen hata'}`);
      }

      const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
      if (!text) throw new Error('gemini: bos yanit');

      return {
        text,
        provider: 'gemini',
        model,
        inTokens: payload.usageMetadata?.promptTokenCount ?? 0,
        outTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
        costUsd: 0, // ucretsiz katman
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
