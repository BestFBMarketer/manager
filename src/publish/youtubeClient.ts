// =====================================
// MODULE: YouTube Client
// Purpose: Kanal basina OAuth2 istemcisi - refresh token'dan kimlik dogrulama
// Dependencies: googleapis, config/env, config/channels
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { google, type youtube_v3 } from 'googleapis';
import { requireEnv } from '../config/env.js';
import type { ChannelConfig } from '../config/channels.js';

const clientCache = new Map<string, youtube_v3.Youtube>();

/**
 * Kanalin refresh token'iyla yetkilendirilmis YouTube Data API v3 istemcisi.
 * Ayni kanal icin sonraki cagrilarda onbellekten doner.
 *
 * @param channel Hedef kanal - kendi refresh token anahtarini tasir
 * @returns Yetkilendirilmis istemci
 */
export function getYoutubeClient(channel: ChannelConfig): youtube_v3.Youtube {
  const cached = clientCache.get(channel.id);
  if (cached) return cached;

  const oauth2Client = new google.auth.OAuth2(
    requireEnv('YOUTUBE_CLIENT_ID'),
    requireEnv('YOUTUBE_CLIENT_SECRET'),
  );
  oauth2Client.setCredentials({ refresh_token: requireEnv(channel.refreshTokenEnvKey) });

  const client = google.youtube({ version: 'v3', auth: oauth2Client });
  clientCache.set(channel.id, client);
  return client;
}

/** Test/CLI amacli - kimlik dogrulamanin gecerli olup olmadigini kontrol eder. */
export async function verifyChannelAccess(channel: ChannelConfig): Promise<{ ok: boolean; channelTitle?: string; error?: string }> {
  try {
    const youtube = getYoutubeClient(channel);
    const response = await youtube.channels.list({ part: ['snippet'], mine: true });
    const title = response.data.items?.[0]?.snippet?.title;
    return { ok: true, channelTitle: title ?? undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
