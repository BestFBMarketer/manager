// =====================================
// MODULE: Cross Post
// Purpose: Onaylanan videoyu bağlı Instagram/TikTok hesaplarına da yayınlar
// Dependencies: core/db, core/logger, publish/adapters/*
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { instagramAdapter } from './adapters/instagram.js';
import { tiktokAdapter } from './adapters/tiktok.js';
import { facebookAdapter } from './adapters/facebook.js';
import type { PlatformAdapter, PublishTargetRow } from './adapters/types.js';

const ADAPTERS: Record<string, PlatformAdapter> = {
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
  facebook: facebookAdapter,
};

export interface CrossPostSummary {
  platform: string;
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Kanalın YouTube dışındaki bağlı ve aktif platformlarına aynı videoyu yayınlar.
 * Instagram/TikTok API'leri publishAt'i desteklemez - yayın anında (approve
 * anında) gerçekleşir, YouTube'un private+publishAt zamanlama numarası burada yok.
 * Bir platform başarısız olursa diğerleri denenmeye devam eder; hiçbiri
 * ana onay akışını (YouTube yüklemesini) engellemez veya geri almaz.
 * @param jobId `upload` tablosuna kaydetmek için
 */
export async function crossPostToConnectedPlatforms(
  channelId: string,
  jobId: number,
  filePath: string,
  title: string,
  description: string,
): Promise<CrossPostSummary[]> {
  const db = getDb();
  const targets = db
    .prepare("SELECT * FROM publish_target WHERE channel_id = ? AND enabled = 1 AND platform != 'youtube'")
    .all(channelId) as PublishTargetRow[];

  const results: CrossPostSummary[] = [];

  for (const target of targets) {
    const adapter = ADAPTERS[target.platform];
    if (!adapter) {
      Logger.warn(`Bilinmeyen platform, atlanıyor: ${target.platform}`);
      continue;
    }
    if (!adapter.isConfigured(target)) {
      Logger.debug(`${target.platform}: bağlantı bilgisi eksik, atlanıyor`);
      continue;
    }

    try {
      const result = await adapter.publish({ target, filePath, title, description });

      db.prepare(
        `INSERT INTO upload (job_id, channel_id, video_id, publish_at, status, platform, publish_target_id)
         VALUES (?, ?, ?, datetime('now'), 'published', ?, ?)`,
      ).run(jobId, channelId, result.externalId, target.platform, target.id);

      results.push({ platform: target.platform, ok: true, url: result.url });
      Logger.success(`${target.platform}: yayınlandı (${result.url})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ platform: target.platform, ok: false, error: message });
      Logger.warn(`${target.platform}: yayın başarısız, diğer platformlarla devam ediliyor`, error);
    }
  }

  return results;
}
