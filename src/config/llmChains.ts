// =====================================
// MODULE: LLM Chains
// Purpose: Her is tipi icin saglayici sirasi - ucretsiz katman once (Rule 8)
// Dependencies: llm/types
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import type { LlmTask } from '../llm/types.js';

/**
 * Zincirler soldan saga denenir. Kural: ucretsiz katmanda yapilabilen is
 * ucretli API'ye gitmez; sadece kalite-kritik isler ucretli ile baslar.
 */
export const LLM_CHAINS: Record<LlmTask, string[]> = {
  // Kolay isler - ucretsiz katman fazlasiyla yeterli
  classify: ['gemini', 'deepseek', 'claude'],
  metadata: ['gemini', 'deepseek', 'openai', 'claude'],
  highlight: ['gemini', 'deepseek', 'claude'],

  // Kalite-kritik isler - viral basari dogrudan bu ciktilara bagli
  viralHook: ['claude', 'openai', 'gemini'],
  shortsPlan: ['claude', 'openai', 'deepseek'],

  // Hikaye kanali - olgu ozetinin dogrulugu ve senaryonun izlenebilirligi
  // dogrudan buradan geldigi icin ucretsiz katmanla baslamiyor (EK2/E)
  factBrief: ['claude', 'openai', 'gemini'],
  narrativeScript: ['claude', 'openai', 'gemini'],
};

/** Ucretli saglayicilarin gunluk maliyet tavani (USD). Asilirsa sadece ucretsizler calisir. */
export const DAILY_PAID_BUDGET_USD = 1.0;
