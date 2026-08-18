// =====================================
// MODULE: LLM Router
// Purpose: Is tipine gore saglayici zincirini sirayla dener - once ucretsiz katman
// Dependencies: config/llmChains, llm/providers/*, llm/quotaTracker, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { LLM_CHAINS } from '../config/llmChains.js';
import { Logger } from '../core/logger.js';
import { claudeProvider } from './providers/claude.js';
import { deepseekProvider } from './providers/deepseek.js';
import { geminiProvider } from './providers/gemini.js';
import { openaiProvider } from './providers/openai.js';
import { hasQuota, recordUsage } from './quotaTracker.js';
import type { LlmProvider, LlmRequest, LlmResult, LlmTask } from './types.js';

const PROVIDERS: Record<string, LlmProvider> = {
  gemini: geminiProvider,
  deepseek: deepseekProvider,
  openai: openaiProvider,
  claude: claudeProvider,
};

/** JSON ciktisi metnin icine kod bloguyla sarilmis olabilir - temizler. */
function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced?.[1] ?? text).trim();
}

/**
 * Zincirdeki ilk uygun saglayicidan JSON yanit alir.
 * @param request Is tipi, sistem promptu ve kullanici girdisi
 * @param validate Ayristirilmis JSON'u dogrulayan fonksiyon; false donerse sonraki saglayici denenir
 * @returns Dogrulanmis nesne ve hangi saglayicidan geldigi
 */
export async function callLlmJson<T>(
  request: LlmRequest,
  validate: (parsed: unknown) => parsed is T,
): Promise<{ data: T; result: LlmResult }> {
  const chain = LLM_CHAINS[request.task];
  const skipped: string[] = [];

  for (const providerName of chain) {
    const provider = PROVIDERS[providerName];
    if (!provider) {
      Logger.warn(`Zincirde tanimsiz saglayici: ${providerName}`);
      continue;
    }

    if (!provider.isConfigured()) {
      skipped.push(`${providerName} (anahtar yok)`);
      continue;
    }

    if (!hasQuota(provider)) {
      skipped.push(`${providerName} (kota dolu)`);
      continue;
    }

    try {
      const result = await provider.call(request);
      const parsed: unknown = JSON.parse(stripCodeFence(result.text));

      if (!validate(parsed)) {
        recordUsage({ ...result, task: request.task, succeeded: false });
        Logger.warn(`${providerName}: yanit sema dogrulamasini gecemedi, sonraki saglayici deneniyor`);
        skipped.push(`${providerName} (gecersiz sema)`);
        continue;
      }

      recordUsage({ ...result, task: request.task, succeeded: true });
      Logger.success(
        `LLM ${request.task} -> ${providerName}/${result.model} ` +
          `(${result.inTokens}+${result.outTokens} tok, $${result.costUsd.toFixed(4)})`,
      );
      return { data: parsed, result };
    } catch (error) {
      Logger.warn(`${providerName} basarisiz, zincirde ilerleniyor`, error);
      skipped.push(`${providerName} (hata)`);
    }
  }

  throw new Error(
    `LLM zinciri tukendi (${request.task}). Denenenler: ${skipped.join(', ') || 'yok'}`,
  );
}

export function listProviderStatus(): Array<{ name: string; free: boolean; configured: boolean; quota: boolean }> {
  return Object.values(PROVIDERS).map((provider) => ({
    name: provider.name,
    free: provider.free,
    configured: provider.isConfigured(),
    quota: provider.isConfigured() ? hasQuota(provider) : false,
  }));
}

export type { LlmTask };
