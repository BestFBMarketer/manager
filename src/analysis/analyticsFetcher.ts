// =====================================
// MODULE: Analytics Fetcher
// Purpose: Kanalin kendi YouTube Analytics verisini ceker, video_analytics_snapshot'a
//          gunluk anlik goruntu olarak yazar (trend gorulebilsin diye "en son"
//          degil, gun-gun birikir).
// Dependencies: googleapis, core/db, core/logger, publish/youtubeAnalyticsClient
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { getYoutubeAnalyticsClient, getYoutubeDataClientFromCredential } from '../publish/youtubeAnalyticsClient.js';

const METRICS = 'views,averageViewPercentage,averageViewDuration,likes,comments,shares,subscribersGained,subscribersLost';

// Kanalin en eski videosundan bugune kadar her seferinde tam aralik cekilir -
// "son cekimden bu yana" state takibi tutmaya gerek yok, upsert zaten
// (channel_id, video_id, snapshot_date) uzerinde idempotent. YouTube Analytics
// API tarihsel veriyi tekrar tekrar sorgulamaya izin veriyor, maliyeti onemsiz
// (gunde bir kez calisan bir script icin).
const HISTORY_START_DATE = '2026-01-01';

interface AnalyticsRow {
  video: string;
  views: number;
  averageViewPercentage: number | null;
  averageViewDuration: number | null;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  subscribersLost: number;
}

function rowsFromApiResponse(
  columnHeaders: Array<{ name?: string | null }> | undefined,
  rows: unknown[][] | undefined,
): AnalyticsRow[] {
  if (!columnHeaders || !rows) return [];
  const names = columnHeaders.map((h) => h.name ?? '');
  return rows.map((r) => {
    const obj: Record<string, unknown> = {};
    names.forEach((name, i) => (obj[name] = r[i]));
    return obj as unknown as AnalyticsRow;
  });
}

/** Bu kanalin butun videolarinin (analytics'te gorunen) baslik/yayin-tarihini
 * tek bir Data API cagrisiyla (50'lik batch'ler) getirir - snapshot satirlarini
 * insan-okunabilir kilmak icin (raw video_id yerine baslik gostermek). */
async function fetchTitles(channelId: string, videoIds: string[]): Promise<Map<string, { title: string; publishedAt: string }>> {
  const result = new Map<string, { title: string; publishedAt: string }>();
  if (videoIds.length === 0) return result;

  const youtube = getYoutubeDataClientFromCredential(channelId);
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const resp = await youtube.videos.list({ part: ['snippet'], id: batch });
    for (const item of resp.data.items ?? []) {
      if (!item.id) continue;
      result.set(item.id, {
        title: item.snippet?.title ?? '',
        publishedAt: item.snippet?.publishedAt ?? '',
      });
    }
  }
  return result;
}

/**
 * Bir kanalin tum-gecmis per-video analytics'ini ceker ve bugunun tarihiyle
 * video_analytics_snapshot'a upsert eder.
 *
 * @param channelId Panelin `channel.id` degeri
 * @returns yazilan satir sayisi
 */
export async function fetchAndStoreAnalytics(channelId: string): Promise<number> {
  const analytics = getYoutubeAnalyticsClient(channelId);
  const today = new Date().toISOString().slice(0, 10);

  const resp = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate: HISTORY_START_DATE,
    endDate: today,
    metrics: METRICS,
    dimensions: 'video',
    sort: '-views',
    maxResults: 200,
  });

  const rows = rowsFromApiResponse(resp.data.columnHeaders ?? undefined, (resp.data.rows ?? undefined) as unknown[][] | undefined);
  if (rows.length === 0) {
    Logger.info(`${channelId}: analytics'te henuz hicbir video verisi yok (yeni video 24-48 saat gecikmeli islenir)`);
    return 0;
  }

  const titles = await fetchTitles(channelId, rows.map((r) => r.video));

  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO video_analytics_snapshot (
       channel_id, video_id, snapshot_date, views, average_view_percentage,
       average_view_duration_sec, likes, comments, shares, subscribers_gained,
       subscribers_lost, title, published_at, raw_json, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(channel_id, video_id, snapshot_date) DO UPDATE SET
       views = excluded.views,
       average_view_percentage = excluded.average_view_percentage,
       average_view_duration_sec = excluded.average_view_duration_sec,
       likes = excluded.likes, comments = excluded.comments, shares = excluded.shares,
       subscribers_gained = excluded.subscribers_gained, subscribers_lost = excluded.subscribers_lost,
       title = excluded.title, published_at = excluded.published_at,
       raw_json = excluded.raw_json, fetched_at = datetime('now')`,
  );

  const insertMany = db.transaction((items: AnalyticsRow[]) => {
    for (const r of items) {
      const meta = titles.get(r.video);
      upsert.run(
        channelId,
        r.video,
        today,
        r.views,
        r.averageViewPercentage,
        r.averageViewDuration,
        r.likes,
        r.comments,
        r.shares,
        r.subscribersGained,
        r.subscribersLost,
        meta?.title ?? null,
        meta?.publishedAt ?? null,
        JSON.stringify(r),
      );
    }
  });
  insertMany(rows);

  Logger.success(`${channelId}: ${rows.length} video icin analytics anlik goruntusu yazildi (${today})`);
  return rows.length;
}
