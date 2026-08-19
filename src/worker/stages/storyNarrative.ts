// =====================================
// MODULE: Story Narrative Job Stage
// Purpose: Referans kanalı / AI konu → Anlatım videosu (M5)
// Author: BestMarketer Team
// Last Modified: 2026-08-19
// =====================================

import Database from 'better-sqlite3';
import type { ChannelConfig } from '../../config/channels.js';
import { Logger } from '../../core/logger.js';

interface JobRow {
  id: number;
  channel_id: string;
  template: string;
  source_ref: string;
  status: string;
  stage: string;
  error: string | null;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  batch_id?: string;
}

export async function runStoryNarrativeJob(
  db: Database.Database,
  job: JobRow,
  channel: ChannelConfig,
): Promise<void> {
  Logger.info(`[job ${job.id}] StoryNarrative henüz uygulanmadı (M5 kapsamı)`);
  throw new Error('StoryNarrative stage not yet implemented');
}
