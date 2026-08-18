// =====================================
// MODULE: Quota Tracker
// Purpose: Saglayici basina dakikalik/gunluk kullanim sayimi - 429 yemeden gecis
// Dependencies: core/db, config/llmChains
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { getDb } from '../core/db.js';
import { DAILY_PAID_BUDGET_USD } from '../config/llmChains.js';
import type { LlmProvider } from './types.js';

/**
 * Saglayicinin su an kota siniri icinde olup olmadigini soyler.
 * @param provider Kontrol edilecek saglayici
 * @returns true ise cagri yapilabilir
 */
export function hasQuota(provider: LlmProvider): boolean {
  const db = getDb();

  const perMinute = db
    .prepare(
      `SELECT COUNT(*) AS n FROM llm_usage
       WHERE provider = ? AND created_at >= datetime('now', '-60 seconds')`,
    )
    .get(provider.name) as { n: number };

  if (perMinute.n >= provider.limits.requestsPerMinute) return false;

  if (provider.limits.requestsPerDay > 0) {
    const perDay = db
      .prepare(
        `SELECT COUNT(*) AS n FROM llm_usage
         WHERE provider = ? AND created_at >= datetime('now', 'start of day')`,
      )
      .get(provider.name) as { n: number };

    if (perDay.n >= provider.limits.requestsPerDay) return false;
  }

  // Ucretli saglayicilar gunluk butce tavanina takilir
  if (!provider.free && spentTodayUsd() >= DAILY_PAID_BUDGET_USD) return false;

  return true;
}

/** Bugun ucretli saglayicilara harcanan toplam (USD). */
export function spentTodayUsd(): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM llm_usage
       WHERE created_at >= datetime('now', 'start of day')`,
    )
    .get() as { total: number };
  return row.total;
}

export function recordUsage(params: {
  provider: string;
  model: string;
  task: string;
  inTokens: number;
  outTokens: number;
  costUsd: number;
  succeeded: boolean;
}): void {
  getDb()
    .prepare(
      `INSERT INTO llm_usage (provider, model, task, in_tokens, out_tokens, cost_usd, succeeded)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.provider,
      params.model,
      params.task,
      params.inTokens,
      params.outTokens,
      params.costUsd,
      params.succeeded ? 1 : 0,
    );
}
