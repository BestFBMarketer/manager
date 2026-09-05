// =====================================
// MODULE: YouTube Analytics Client
// Purpose: Kanal basina YouTube Analytics API v2 istemcisi - kimlik bilgisi
//          external_credential tablosundan okunur (panelin .env/refreshTokenEnvKey
//          sisteminden BAGIMSIZ, sadece analytics amacli bir kopru - bkz
//          scripts/importYoutubeCredentials.ts). Upload akisi (youtubeClient.ts)
//          bu dosyaya hic dokunmaz.
// Dependencies: googleapis, core/db
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { google, type youtubeAnalytics_v2, type youtube_v3 } from 'googleapis';
import { getDb } from '../core/db.js';

const clientCache = new Map<string, youtubeAnalytics_v2.Youtubeanalytics>();
const dataClientCache = new Map<string, youtube_v3.Youtube>();

interface ExternalCredentialRow {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  scopes_json: string;
}

function getCredentialRow(channelId: string): ExternalCredentialRow {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT client_id, client_secret, refresh_token, scopes_json FROM external_credential WHERE channel_id = ? AND purpose = 'youtube_analytics'",
    )
    .get(channelId) as ExternalCredentialRow | undefined;

  if (!row) {
    throw new Error(
      `${channelId}: youtube_analytics kimlik bilgisi yok - once "npx tsx scripts/importYoutubeCredentials.ts" calistir`,
    );
  }
  return row;
}

function buildOAuth2Client(row: ExternalCredentialRow) {
  const oauth2Client = new google.auth.OAuth2(row.client_id, row.client_secret);
  oauth2Client.setCredentials({ refresh_token: row.refresh_token });
  return oauth2Client;
}

/**
 * Kanalin external_credential(purpose='youtube_analytics') satirindan
 * yetkilendirilmis YouTube Analytics API v2 istemcisi kurar. Onbelleklenir.
 *
 * @param channelId Panelin `channel.id` degeri (orn. 'shorts')
 * @throws satir yoksa veya scope'ta yt-analytics.readonly eksikse
 */
export function getYoutubeAnalyticsClient(channelId: string): youtubeAnalytics_v2.Youtubeanalytics {
  const cached = clientCache.get(channelId);
  if (cached) return cached;

  const row = getCredentialRow(channelId);
  const scopes = JSON.parse(row.scopes_json) as string[];
  if (!scopes.includes('https://www.googleapis.com/auth/yt-analytics.readonly')) {
    throw new Error(
      `${channelId}: token'da yt-analytics.readonly scope yok - bu kanali once yeniden yetkilendir ` +
        `(historisches-kapital/youtube_upload/authorize.py, ekli scope ile)`,
    );
  }

  const client = google.youtubeAnalytics({ version: 'v2', auth: buildOAuth2Client(row) });
  clientCache.set(channelId, client);
  return client;
}

/**
 * Ayni external_credential satirindan (temel 'youtube' scope, upload/yonetim
 * icin zaten var olan) bir YouTube Data API v3 istemcisi kurar - sadece video
 * baslik/yayin-tarihi gibi okuma amacli (analiz modulunun snapshot'lari icin).
 * Upload/yonetim akisi icin bunu KULLANMA - o `youtubeClient.ts::getYoutubeClient`'te.
 */
export function getYoutubeDataClientFromCredential(channelId: string): youtube_v3.Youtube {
  const cached = dataClientCache.get(channelId);
  if (cached) return cached;

  const row = getCredentialRow(channelId);
  const client = google.youtube({ version: 'v3', auth: buildOAuth2Client(row) });
  dataClientCache.set(channelId, client);
  return client;
}
