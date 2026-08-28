// =====================================
// MODULE: Quota Tracker
// Purpose: Saglayici basina kullanim/maliyet kaydi - engelleme gorevini gercek API
//          hatasi (429/5xx) ustlenir, bu modul esas olarak raporlama ve tek gercek
//          on-engel olan ucretli gunluk butce tavani icin kullanilir
// Dependencies: core/db, config/llmChains
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { getDb } from '../core/db.js';
import { DAILY_PAID_BUDGET_USD } from '../config/llmChains.js';
import type { LlmProvider } from './types.js';

/**
 * Saglayicinin su an cagrilabilir olup olmadigini soyler.
 *
 * Dakikalik/gunluk istek sayisi onceden tahmin edilip engellenmez - gercek kota
 * her saglayicida netlik gerektirmeden bilinir ve fallback zaten gercek 429/5xx
 * hatasinda devreye giriyor (bkz. llm/router.ts). Tek gercek on-engel, ucretli
 * saglayicilar icin gunluk butce tavanidir - bu, kota hatasindan bagimsiz bir
 * maliyet guvenligi kontrolu oldugu icin korunur.
 *
 * @param provider Kontrol edilecek saglayici
 * @returns true ise cagri yapilabilir
 */
export function hasQuota(provider: LlmProvider): boolean {
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
