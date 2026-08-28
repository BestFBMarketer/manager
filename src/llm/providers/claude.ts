// =====================================
// MODULE: Claude Provider
// Purpose: Kalite-kritik isler icin ucretli saglayici; prompt cache + dusuk efor ile maliyet kontrolu
// Dependencies: @anthropic-ai/sdk, config/env, llm/types
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import Anthropic from '@anthropic-ai/sdk';
import { optionalEnv } from '../../config/env.js';
import { ProviderUnavailableError, type LlmProvider, type LlmRequest, type LlmResult } from '../types.js';

const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_MAX_TOKENS = 4_096;

// Claude Opus 5 liste fiyati (USD / 1M token)
const INPUT_PRICE_PER_MTOK = 5.0;
const OUTPUT_PRICE_PER_MTOK = 25.0;
// Onbellekten okunan girdi cok daha ucuzdur; muhafazakar bir katsayi kullanilir.
const CACHE_READ_DISCOUNT = 0.1;

const model = optionalEnv('CLAUDE_MODEL') ?? DEFAULT_MODEL;
const effort = (optionalEnv('CLAUDE_EFFORT') ?? 'low') as 'low' | 'medium' | 'high';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export const claudeProvider: LlmProvider = {
  name: 'claude',
  model,
  free: false,
  limits: { requestsPerMinute: 30, requestsPerDay: 0 },

  isConfigured: () => optionalEnv('ANTHROPIC_API_KEY') !== undefined,

  async call(request: LlmRequest): Promise<LlmResult> {
    if (!optionalEnv('ANTHROPIC_API_KEY')) {
      throw new ProviderUnavailableError('claude', 'API anahtari tanimli degil');
    }

    const response = await getClient().messages.create({
      model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort },
      // Sistem promptu sabit tutulur; prompt cache bu onekten faydalanir.
      system: [
        {
          type: 'text',
          text: request.system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: request.user }],
    });

    // Guvenlik siniflandiricisi reddederse router bir sonraki saglayiciya gecsin.
    if (response.stop_reason === 'refusal') {
      throw new ProviderUnavailableError('claude', 'istek reddedildi (refusal)');
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    if (!text) throw new Error('claude: bos yanit');

    const usage = response.usage;
    const cachedIn = usage.cache_read_input_tokens ?? 0;
    const freshIn = usage.input_tokens ?? 0;
    const outTokens = usage.output_tokens ?? 0;

    return {
      text,
      provider: 'claude',
      model,
      inTokens: freshIn + cachedIn,
      outTokens,
      costUsd:
        (freshIn / 1_000_000) * INPUT_PRICE_PER_MTOK +
        (cachedIn / 1_000_000) * INPUT_PRICE_PER_MTOK * CACHE_READ_DISCOUNT +
        (outTokens / 1_000_000) * OUTPUT_PRICE_PER_MTOK,
    };
  },
};
