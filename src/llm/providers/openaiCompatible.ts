// =====================================
// MODULE: OpenAI-Compatible Provider
// Purpose: OpenAI ve DeepSeek gibi /chat/completions uyumlu servisler icin ortak istemci
// Dependencies: config/env, config/constants, llm/types
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { optionalEnv } from '../../config/env.js';
import { TIMEOUTS } from '../../config/constants.js';
import { ProviderUnavailableError, type LlmProvider, type LlmRequest, type LlmResult } from '../types.js';

const DEFAULT_MAX_TOKENS = 4_096;

interface CompatibleConfig {
  name: string;
  free: boolean;
  baseUrl: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
  requestsPerMinute: number;
  requestsPerDay: number;
  /** USD / 1M token */
  inputPricePerMTok: number;
  outputPricePerMTok: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export function createOpenAiCompatibleProvider(config: CompatibleConfig): LlmProvider {
  const model = optionalEnv(config.modelEnv) ?? config.defaultModel;

  return {
    name: config.name,
    model,
    free: config.free,
    limits: {
      requestsPerMinute: config.requestsPerMinute,
      requestsPerDay: config.requestsPerDay,
    },

    isConfigured: () => optionalEnv(config.apiKeyEnv) !== undefined,

    async call(request: LlmRequest): Promise<LlmResult> {
      const apiKey = optionalEnv(config.apiKeyEnv);
      if (!apiKey) throw new ProviderUnavailableError(config.name, 'API anahtari tanimli degil');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUTS.LLM_REQUEST_MS);

      try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: request.system },
              { role: 'user', content: request.user },
            ],
          }),
          signal: controller.signal,
        });

        if (response.status === 429 || response.status >= 500) {
          throw new ProviderUnavailableError(config.name, `HTTP ${response.status} - kota/servis sorunu`);
        }

        const payload = (await response.json()) as ChatCompletionResponse;
        if (!response.ok) {
          throw new Error(`${config.name} HTTP ${response.status}: ${payload.error?.message ?? 'bilinmeyen hata'}`);
        }

        const text = payload.choices?.[0]?.message?.content;
        if (!text) throw new Error(`${config.name}: bos yanit`);

        const inTokens = payload.usage?.prompt_tokens ?? 0;
        const outTokens = payload.usage?.completion_tokens ?? 0;

        return {
          text,
          provider: config.name,
          model,
          inTokens,
          outTokens,
          costUsd:
            (inTokens / 1_000_000) * config.inputPricePerMTok +
            (outTokens / 1_000_000) * config.outputPricePerMTok,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
