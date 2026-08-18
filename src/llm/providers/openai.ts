// =====================================
// MODULE: OpenAI Provider
// Purpose: Ucretli yedek saglayici
// Dependencies: llm/providers/openaiCompatible
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { createOpenAiCompatibleProvider } from './openaiCompatible.js';

export const openaiProvider = createOpenAiCompatibleProvider({
  name: 'openai',
  free: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKeyEnv: 'OPENAI_API_KEY',
  modelEnv: 'OPENAI_MODEL',
  defaultModel: 'gpt-4o-mini',
  requestsPerMinute: 60,
  requestsPerDay: 0,
  inputPricePerMTok: 0.15,
  outputPricePerMTok: 0.6,
});
