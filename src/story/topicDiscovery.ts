// =====================================
// MODULE: Topic Discovery
// Purpose: Referans kanal kataloglarini izleme sayisina gore siralar, uyarlanmamis konuyu secer
// Dependencies: googleapis, config/env, core/db, core/logger, config/channels
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { google } from 'googleapis';
import { optionalEnv } from '../config/env.js';
import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import type { ChannelConfig } from '../config/channels.js';

export interface DiscoveredTopic {
  sourceRef: string;
  videoTitle: string;
  viewCount: number;
}

interface StoryReferenceRow {
  id: number;
  source_url: string;
  label: string | null;
}

/** URL'den handle/username/channel id cikarir - kesin degil, en yaygin YouTube URL kaliplarini kapsar. */
function parseReferenceUrl(url: string): { kind: 'handle' | 'channelId' | 'username'; value: string } | null {
  const handleMatch = url.match(/youtube\.com\/@([^/?]+)/);
  if (handleMatch?.[1]) return { kind: 'handle', value: handleMatch[1] };

  const channelMatch = url.match(/youtube\.com\/channel\/([^/?]+)/);
  if (channelMatch?.[1]) return { kind: 'channelId', value: channelMatch[1] };

  const userMatch = url.match(/youtube\.com\/(?:c\/|user\/)([^/?]+)/);
  if (userMatch?.[1]) return { kind: 'username', value: userMatch[1] };

  return null;
}

/**
 * Bir referans kanalin video kataloğunu (en fazla 200 video) izlenme sayısına göre
 * azalan sıralı döner. API hatası/tanınmayan URL formatında boş dizi döner ve
 * loglanır - tüm keşif akışını çökertmez (Rule 11).
 */
async function fetchChannelCatalog(apiKey: string, referenceUrl: string): Promise<DiscoveredTopic[]> {
  const parsed = parseReferenceUrl(referenceUrl);
  if (!parsed) {
    Logger.warn(`Referans URL formatı tanınmadı, atlanıyor: ${referenceUrl}`);
    return [];
  }

  const youtube = google.youtube({ version: 'v3', auth: apiKey });

  try {
    const channelResponse = await youtube.channels.list({
      part: ['contentDetails'],
      ...(parsed.kind === 'handle' ? { forHandle: `@${parsed.value}` } : {}),
      ...(parsed.kind === 'username' ? { forUsername: parsed.value } : {}),
      ...(parsed.kind === 'channelId' ? { id: [parsed.value] } : {}),
    });

    const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      Logger.warn(`Referans kanal bulunamadı: ${referenceUrl}`);
      return [];
    }

    const videoIds: string[] = [];
    let pageToken: string | undefined;
    do {
      const itemsResponse = await youtube.playlistItems.list({
        part: ['contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken,
      });
      for (const item of itemsResponse.data.items ?? []) {
        const videoId = item.contentDetails?.videoId;
        if (videoId) videoIds.push(videoId);
      }
      pageToken = itemsResponse.data.nextPageToken ?? undefined;
    } while (pageToken && videoIds.length < 200);

    const topics: DiscoveredTopic[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const statsResponse = await youtube.videos.list({ part: ['statistics', 'snippet'], id: batch });
      for (const video of statsResponse.data.items ?? []) {
        if (!video.id || !video.snippet?.title) continue;
        topics.push({
          sourceRef: `https://www.youtube.com/watch?v=${video.id}`,
          videoTitle: video.snippet.title,
          viewCount: Number(video.statistics?.viewCount ?? 0),
        });
      }
    }

    Logger.success(`${referenceUrl}: ${topics.length} video katalogda bulundu`);
    return topics;
  } catch (error) {
    Logger.warn(`Referans kanal kataloğu çekilemedi: ${referenceUrl}`, error);
    return [];
  }
}

/**
 * Kanalin aktif referans kanallarının kataloğunu birleştirip izlenme sayısına göre
 * sıralar, bu kanalda daha önce iş açılmamış (job.source_ref eşleşmeyen) ilk `count`
 * videoyu döner. "Kanıtlanmış içeriği uyarla" mantığı - en performanslı içerikten başlar.
 */
export async function discoverNextTopics(channel: ChannelConfig, count: number): Promise<DiscoveredTopic[]> {
  const apiKey = optionalEnv('YOUTUBE_API_KEY');
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY tanımlı değil - referans kanal keşfi çalışamaz');
  }

  const db = getDb();
  const references = db
    .prepare('SELECT id, source_url, label FROM story_reference WHERE channel_id = ? AND enabled = 1')
    .all(channel.id) as StoryReferenceRow[];

  if (references.length === 0) {
    throw new Error(`${channel.id}: aktif referans kanal yok - önce panelden ekleyin`);
  }

  const allTopics = (await Promise.all(references.map((ref) => fetchChannelCatalog(apiKey, ref.source_url)))).flat();
  allTopics.sort((a, b) => b.viewCount - a.viewCount);

  const alreadyAdapted = new Set(
    (db.prepare('SELECT source_ref FROM job WHERE channel_id = ?').all(channel.id) as Array<{ source_ref: string }>).map(
      (r) => r.source_ref,
    ),
  );

  const fresh = allTopics.filter((t) => !alreadyAdapted.has(t.sourceRef));
  const picked = fresh.slice(0, count);

  Logger.success(`${channel.id}: ${picked.length}/${count} yeni konu seçildi (${allTopics.length} katalogda, ${fresh.length} uyarlanmamış)`);
  return picked;
}
