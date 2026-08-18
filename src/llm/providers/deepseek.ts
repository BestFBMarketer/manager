// =====================================
// MODULE: DeepSeek Provider
// Purpose: Cok dusuk maliyetli OpenAI-uyumlu saglayici
// Dependencies: llm/providers/openaiCompatible
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { createOpenAiCompatibleProvider } from './openaiCompatible.js';

export const deepseekProvider = createOpenAiCompatibleProvider({
  name: 'deepseek',
  free: false,
  baseUrl: 'https://api.deepseek.com',
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  modelEnv: 'DEEPSEEK_MODEL',
  defaultModel: 'deepseek-chat',
  requestsPerMinute: 30,
  requestsPerDay: 0,
  inputPricePerMTok: 0.28,
  outputPricePerMTok: 0.42,
});
