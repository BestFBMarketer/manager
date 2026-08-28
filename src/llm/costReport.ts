// =====================================
// MODULE: Cost Report
// Purpose: LLM harcama gecmisini saglayici/gorev bazinda ozetler (npm run cost)
// Dependencies: core/db, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { closeDb, getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';

interface UsageRow {
  provider: string;
  task: string;
  calls: number;
  in_tokens: number;
  out_tokens: number;
  cost_usd: number;
  failed: number;
}

function parseArgs(argv: string[]): { month: boolean } {
  return { month: argv.includes('--month') };
}

async function main(): Promise<void> {
  const { month } = parseArgs(process.argv.slice(2));
  const db = getDb();

  const since = month ? "datetime('now', 'start of month')" : "datetime('now', 'start of day')";

  const rows = db
    .prepare(
      `SELECT provider, task, COUNT(*) AS calls,
              SUM(in_tokens) AS in_tokens, SUM(out_tokens) AS out_tokens,
              SUM(cost_usd) AS cost_usd, SUM(1 - succeeded) AS failed
       FROM llm_usage
       WHERE created_at >= ${since}
       GROUP BY provider, task
       ORDER BY cost_usd DESC`,
    )
    .all() as UsageRow[];

  const label = month ? 'Bu ay' : 'Bugun';
  Logger.info(`${label} LLM kullanimi:`);

  if (rows.length === 0) {
    Logger.info('  (henuz kayit yok)');
  } else {
    for (const row of rows) {
      Logger.info(
        `  ${row.provider.padEnd(10)} ${row.task.padEnd(12)} ${String(row.calls).padStart(4)} cagri | ` +
          `${row.in_tokens}+${row.out_tokens} tok | $${row.cost_usd.toFixed(4)}` +
          `${row.failed > 0 ? ` | ${row.failed} basarisiz` : ''}`,
      );
    }
  }

  const total = rows.reduce((sum, row) => sum + row.cost_usd, 0);
  Logger.success(`Toplam: $${total.toFixed(4)}`);

  closeDb();
}

void main();
