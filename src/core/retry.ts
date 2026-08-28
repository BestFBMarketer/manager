// =====================================
// MODULE: Retry
// Purpose: Ag/API hatalari icin ustel geri cekilmeli yeniden deneme
// Dependencies: constants, logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { RETRY } from '../config/constants.js';
import { Logger } from './logger.js';

export interface RetryOptions {
  /** Islem adi - log mesajlarinda gorunur */
  label: string;
  maxAttempts?: number;
  /** false donerse yeniden denenmez (orn. 400 gibi kalici hatalar) */
  isRetryable?: (error: unknown) => boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Verilen islemi basarili olana kadar ustel gecikmeyle yeniden dener.
 * @param fn Calistirilacak async islem
 * @param options Etiket ve yeniden deneme politikasi
 * @returns islemin sonucu
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const maxAttempts = options.maxAttempts ?? RETRY.MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = options.isRetryable ? options.isRetryable(error) : true;
      if (!retryable || attempt === maxAttempts) break;

      const delay = RETRY.BASE_DELAY_MS * RETRY.BACKOFF_FACTOR ** (attempt - 1);
      Logger.warn(`${options.label}: deneme ${attempt}/${maxAttempts} basarisiz, ${delay}ms sonra tekrar`, error);
      await sleep(delay);
    }
  }

  throw new Error(`${options.label}: ${maxAttempts} denemede basarisiz - ${String(lastError)}`, {
    cause: lastError,
  });
}
