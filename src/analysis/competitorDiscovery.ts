// =====================================
// MODULE: Competitor Discovery
// Purpose: Anahtar kelimelerle YouTube'da benzer/rakip kanal adaylarini
//          arar, competitor_candidate(status='proposed') olarak yazar.
//          Insan onayindan gecmeden competitor_channel'a (gercek VPH izleme
//          listesi) HIC eklenmez - competitor_channel yalnizca
//          promoteCandidateToCompetitor() ile, approve sonrasi doldurulur.
// Dependencies: googleapis, core/db, core/logger, config/env
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { google } from 'googleapis';
import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { optionalEnv } from '../config/env.js';

const MAX_RESULTS_PER_KEYWORD = 10;
const MIN_SUBSCRIBER_COUNT = 500; // olu/tek-videoluk kanallari elemek icin kaba bir taban

function getApiKey(): string {
  const apiKey = optionalEnv('YOUTUBE_API_KEY');
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY tanımlı değil - rakip keşfi çalışamaz (ücretsiz bir Google Cloud API anahtarı yeterli)');
  }
  return apiKey;
}

interface DiscoveredCandidate {
  competitorYtId: string;
  channelTitle: string;
  subscriberCount: number | null;
  matchedKeyword: string;
}

/**
 * Verilen anahtar kelimelerle YouTube kanal aramasi yapar, zaten izlenen veya
 * daha once onerilmis/reddedilmis kanallari eler, kalanlari competitor_candidate'a
 * yazar. Abone sayisi cok dusuk (MIN_SUBSCRIBER_COUNT altinda) kanallar da elenir.
 *
 * @param channelId Panelin `channel.id` degeri - hangi kanalimiz icin rakip araniyor
 * @param keywords Arama anahtar kelimeleri (orn. ["pool fails compilation", "top 5 ranking fails"])
 * @returns yeni eklenen aday sayisi
 */
export async function discoverCompetitorCandidates(channelId: string, keywords: string[]): Promise<number> {
  if (keywords.length === 0) {
    throw new Error('En az bir anahtar kelime gerekli');
  }

  const apiKey = getApiKey();
  const youtube = google.youtube({ version: 'v3', auth: apiKey });
  const db = getDb();

  const alreadyKnown = new Set(
    [
      ...(db.prepare('SELECT competitor_yt_id FROM competitor_channel WHERE channel_id = ?').all(channelId) as Array<{ competitor_yt_id: string }>),
      ...(db.prepare('SELECT competitor_yt_id FROM competitor_candidate WHERE channel_id = ?').all(channelId) as Array<{ competitor_yt_id: string }>),
    ].map((r) => r.competitor_yt_id),
  );

  const found = new Map<string, DiscoveredCandidate>();

  for (const keyword of keywords) {
    try {
      const resp = await youtube.search.list({
        part: ['snippet'],
        type: ['channel'],
        q: keyword,
        maxResults: MAX_RESULTS_PER_KEYWORD,
      });
      for (const item of resp.data.items ?? []) {
        const ytId = item.snippet?.channelId ?? item.id?.channelId;
        if (!ytId || alreadyKnown.has(ytId) || found.has(ytId)) continue;
        found.set(ytId, {
          competitorYtId: ytId,
          channelTitle: item.snippet?.channelTitle ?? item.snippet?.title ?? ytId,
          subscriberCount: null,
          matchedKeyword: keyword,
        });
      }
    } catch (err) {
      Logger.warn(`"${keyword}" için kanal araması başarısız, sonraki kelimeye geçiliyor`, err);
    }
  }

  if (found.size === 0) {
    Logger.info(`${channelId}: yeni rakip adayı bulunamadı`);
    return 0;
  }

  // Abone sayisini toplu cek - dusuk-kaliteli/olu kanallari elemek icin.
  const ids = [...found.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const resp = await youtube.channels.list({ part: ['statistics'], id: batch });
    for (const item of resp.data.items ?? []) {
      if (!item.id) continue;
      const candidate = found.get(item.id);
      if (candidate) candidate.subscriberCount = Number(item.statistics?.subscriberCount ?? 0);
    }
  }

  const insert = db.prepare(
    `INSERT INTO competitor_candidate (channel_id, competitor_yt_id, channel_title, subscriber_count, matched_keyword)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(channel_id, competitor_yt_id) DO NOTHING`,
  );

  let inserted = 0;
  for (const candidate of found.values()) {
    if (candidate.subscriberCount !== null && candidate.subscriberCount < MIN_SUBSCRIBER_COUNT) continue;
    const result = insert.run(channelId, candidate.competitorYtId, candidate.channelTitle, candidate.subscriberCount, candidate.matchedKeyword);
    if (result.changes > 0) inserted++;
  }

  Logger.success(`${channelId}: ${inserted} yeni rakip adayı bulundu (onay bekliyor)`);
  return inserted;
}

/**
 * Onaylanmis bir competitor_candidate'i gercek competitor_channel izleme
 * listesine tasir - bundan sonra competitorRadarQueue bu kanali da tarar.
 */
export function promoteCandidateToCompetitor(candidateId: number, decidedBy: string): void {
  const db = getDb();
  const candidate = db.prepare('SELECT * FROM competitor_candidate WHERE id = ?').get(candidateId) as
    | { channel_id: string; competitor_yt_id: string; channel_title: string }
    | undefined;
  if (!candidate) throw new Error(`competitor_candidate #${candidateId} bulunamadı`);

  const transaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO competitor_channel (channel_id, competitor_yt_id, label) VALUES (?, ?, ?)
       ON CONFLICT(channel_id, competitor_yt_id) DO UPDATE SET enabled = 1`,
    ).run(candidate.channel_id, candidate.competitor_yt_id, candidate.channel_title);
    db.prepare(
      "UPDATE competitor_candidate SET status='approved', decided_by=?, decided_at=datetime('now') WHERE id=?",
    ).run(decidedBy, candidateId);
  });
  transaction();
}
