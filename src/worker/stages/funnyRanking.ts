// =====================================
// MODULE: Funny Ranking Job Stage
// Purpose: Komik video → Shorts (M3+)
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import Database from 'better-sqlite3';
import type { ChannelConfig } from '../../config/channels.js';
import { Logger } from '../../core/logger.js';
import type { JobRow, StageResult } from './types.js';

export async function runFunnyRankingJob(
  db: Database.Database,
  job: JobRow,
  channel: ChannelConfig,
): Promise<StageResult> {
  Logger.info(`[job ${job.id}] FunnyRanking henüz uygulanmadı (discovery/curation kaynağı yok)`);
  throw new Error('FunnyRanking stage not yet implemented');
}
