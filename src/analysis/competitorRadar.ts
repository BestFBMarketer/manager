// =====================================
// MODULE: Competitor Radar
// Purpose: Rakip kanallarin son 48 saatlik yuklemelerini tarar, VPH (views-per-hour)
//          hesaplar, kanalin kendi ortalamasinin katinda bir outlier tespit
//          edilirse vph_alert olusturur + bildirir. OAuth GEREKMEZ - sadece
//          YOUTUBE_API_KEY (public veri), story/topicDiscovery.ts'deki desenle
//          ayni ruhta.
// Dependencies: googleapis, core/db, core/logger, core/notify, config/env
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { google } from 'googleapis';
import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { notify } from '../core/notify.js';
import { optionalEnv } from '../config/env.js';

const LOOKBACK_HOURS = 48;
const VPH_OUTLIER_MULTIPLIER = 5; // kullanicinin sinyal matrisi: "kanal ortalamasinin 5 kati"
const MIN_PRIOR_SAMPLES_FOR_BASELINE = 2; // ilk 1-2 ornekte anlamli ortalama yok, alarm basma

interface CompetitorChannelRow {
  id: number;
  channel_id: string;
  competitor_yt_id: string;
  label: string | null;
}

function getApiKey(): string {
  const apiKey = optionalEnv('YOUTUBE_API_KEY');
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY tanımlı değil - rakip radar çalışamaz (ücretsiz bir Google Cloud API anahtarı yeterli, OAuth gerekmiyor)');
  }
  return apiKey;
}

/** Bir rakip kanalin son LOOKBACK_HOURS icindeki video ID'lerini doner
 * (uploads playlist'i ters-kronolojik varsayilir - topicDiscovery.ts ile ayni yaklasim). */
async function fetchRecentVideoIds(apiKey: string, competitorYtId: string): Promise<string[]> {
  const youtube = google.youtube({ version: 'v3', auth: apiKey });
  const channelResp = await youtube.channels.list({ part: ['contentDetails'], id: [competitorYtId] });
  const uploadsPlaylistId = channelResp.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    Logger.warn(`${competitorYtId}: uploads playlist bulunamadı`);
    return [];
  }

  const cutoff = Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000;
  const videoIds: string[] = [];
  let pageToken: string | undefined;
  do {
    const itemsResp = await youtube.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
    });
    for (const item of itemsResp.data.items ?? []) {
      const publishedAt = item.contentDetails?.videoPublishedAt;
      const videoId = item.contentDetails?.videoId;
      if (!publishedAt || !videoId) continue;
      if (new Date(publishedAt).getTime() < cutoff) {
        return videoIds; // playlist ters-kronolojik - eski bir video gorunce dur
      }
      videoIds.push(videoId);
    }
    pageToken = itemsResp.data.nextPageToken ?? undefined;
  } while (pageToken && videoIds.length < 100);

  return videoIds;
}

/** Bu rakip kanalin daha once kaydedilmis VPH ortalamasi - "kanal ortalamasinin
 * X kati" kiyaslamasi icin baseline. Ayni video tekrar sayilmasin diye
 * excludeVideoId disinda kalan en son N farkli video kaydi kullanilir. */
function getBaselineVph(competitorChannelId: number, excludeVideoId: string): { avg: number; sampleCount: number } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT vph FROM competitor_video_snapshot
       WHERE competitor_channel_id = ? AND video_id != ?
       ORDER BY checked_at DESC LIMIT 20`,
    )
    .all(competitorChannelId, excludeVideoId) as Array<{ vph: number }>;
  if (rows.length === 0) return { avg: 0, sampleCount: 0 };
  const avg = rows.reduce((sum, r) => sum + r.vph, 0) / rows.length;
  return { avg, sampleCount: rows.length };
}

/** Tek bir rakip kanali tarar: VPH hesaplar, snapshot yazar, outlier ise alert acar. */
async function scanCompetitorChannel(apiKey: string, competitor: CompetitorChannelRow): Promise<void> {
  const youtube = google.youtube({ version: 'v3', auth: apiKey });
  const videoIds = await fetchRecentVideoIds(apiKey, competitor.competitor_yt_id);
  if (videoIds.length === 0) return;

  const db = getDb();
  const insertSnapshot = db.prepare(
    `INSERT INTO competitor_video_snapshot (competitor_channel_id, video_id, title, published_at, view_count, vph, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAlert = db.prepare(
    `INSERT OR IGNORE INTO vph_alert (channel_id, competitor_channel_id, video_id, title, vph, competitor_avg_vph, threshold_used)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const resp = await youtube.videos.list({ part: ['statistics', 'snippet'], id: batch });
    for (const video of resp.data.items ?? []) {
      if (!video.id || !video.snippet?.publishedAt) continue;
      const viewCount = Number(video.statistics?.viewCount ?? 0);
      const hoursSincePublished = Math.max(
        0.1,
        (Date.now() - new Date(video.snippet.publishedAt).getTime()) / (60 * 60 * 1000),
      );
      const vph = viewCount / hoursSincePublished;
      const title = video.snippet.title ?? '';

      insertSnapshot.run(competitor.id, video.id, title, video.snippet.publishedAt, viewCount, vph, JSON.stringify(video));

      const { avg: baselineVph, sampleCount } = getBaselineVph(competitor.id, video.id);
      if (sampleCount < MIN_PRIOR_SAMPLES_FOR_BASELINE || baselineVph <= 0) continue;

      const threshold = baselineVph * VPH_OUTLIER_MULTIPLIER;
      if (vph <= threshold) continue;

      const result = insertAlert.run(competitor.channel_id, competitor.id, video.id, title, vph, baselineVph, threshold);
      if (result.changes > 0) {
        const label = competitor.label ?? competitor.competitor_yt_id;
        Logger.success(`VPH outlier: ${label} - "${title}" (${vph.toFixed(0)} vph, kanal ort. ${baselineVph.toFixed(0)})`);
        await notify({
          subject: `Rakip kanal patlaması: ${label}`,
          body: `"${title}" son ${hoursSincePublished.toFixed(1)} saatte ${viewCount} izlenme aldı ` +
            `(${vph.toFixed(0)} vph, kanal ortalamasının ${(vph / baselineVph).toFixed(1)} katı). ` +
            `Video: https://youtu.be/${video.id}`,
          severity: 'info',
        });
      }
    }
  }
}

/**
 * Tum aktif competitor_channel satirlarini tarar. Bir kanalda hata olursa
 * digerlerini engellemez (Rule 11 - sessiz hata yok ama tek kanal tum taramayi
 * cokertmez).
 */
export async function scanAllCompetitors(): Promise<void> {
  const apiKey = getApiKey();
  const db = getDb();
  const competitors = db
    .prepare('SELECT id, channel_id, competitor_yt_id, label FROM competitor_channel WHERE enabled = 1')
    .all() as CompetitorChannelRow[];

  if (competitors.length === 0) {
    Logger.info('Hiçbir rakip kanal tanımlı değil (competitor_channel boş) - panelden ekle');
    return;
  }

  for (const competitor of competitors) {
    try {
      await scanCompetitorChannel(apiKey, competitor);
    } catch (err) {
      Logger.warn(`${competitor.label ?? competitor.competitor_yt_id}: tarama başarısız, sonraki rakibe geçiliyor`, err);
    }
  }
}
