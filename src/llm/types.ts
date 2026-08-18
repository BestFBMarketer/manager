// =====================================
// MODULE: LLM Types
// Purpose: Saglayici-agnostik istek/yanit sozlesmesi
// Dependencies: yok
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

/** Boru hattindaki LLM is tipleri - her biri kendi saglayici zincirine sahip. */
export type LlmTask =
  | 'classify'
  | 'metadata'
  | 'highlight'
  | 'viralHook'
  | 'shortsPlan';

export interface LlmRequest {
  task: LlmTask;
  /** Sabit tutulmali - prompt cache bu onekten faydalanir */
  system: string;
  user: string;
  maxTokens?: number;
}

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  inTokens: number;
  outTokens: number;
  costUsd: number;
}

export interface ProviderLimits {
  /** Dakikada istek - ucretsiz katmanlarda dusuktur */
  requestsPerMinute: number;
  /** Gunde istek - 0 = sinirsiz */
  requestsPerDay: number;
}

export interface LlmProvider {
  name: string;
  model: string;
  /** Ucretsiz katman mi - router once bunlari dener */
  free: boolean;
  limits: ProviderLimits;
  /** API anahtari tanimli mi */
  isConfigured(): boolean;
  call(request: LlmRequest): Promise<LlmResult>;
}

/** Saglayici kalici olarak kullanilamaz oldugunda (kota/oturum) firlatilir. */
export class ProviderUnavailableError extends Error {
  constructor(public readonly provider: string, message: string) {
    super(`${provider}: ${message}`);
    this.name = 'ProviderUnavailableError';
  }
}
