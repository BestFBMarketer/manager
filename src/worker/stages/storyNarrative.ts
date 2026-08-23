// =====================================
// MODULE: Story Narrative Job Stage
// Purpose: Referans kanalı / AI konu → Anlatım videosu (M5)
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import Database from 'better-sqlite3';
import type { ChannelConfig } from '../../config/channels.js';
import { Logger } from '../../core/logger.js';
import type { JobRow, StageResult } from './types.js';

export async function runStoryNarrativeJob(
  db: Database.Database,
  job: JobRow,
  channel: ChannelConfig,
): Promise<StageResult> {
  Logger.info(`[job ${job.id}] StoryNarrative henüz uygulanmadı (M5 kapsamı)`);
  throw new Error('StoryNarrative stage not yet implemented');
}
