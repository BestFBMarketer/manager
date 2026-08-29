// =====================================
// MODULE: Instagram Adapter
// Purpose: Instagram Content Publishing API - Reels yayını (Business hesap + Graph API)
// Dependencies: config/env, core/logger, core/retry, publish/publicMediaHost
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { Logger } from '../../core/logger.js';
import { withRetry } from '../../core/retry.js';
import { TIMEOUTS } from '../../config/constants.js';
import { publishFileTemporarily } from '../publicMediaHost.js';
import { resolveAccessToken, type CrossPostInput, type CrossPostResult, type PlatformAdapter, type PublishTargetRow } from './types.js';

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 36; // ~3 dakika - Reels islenmesi genelde bunun altinda biter

interface CreateContainerResponse {
  id?: string;
  error?: { message: string };
}

interface StatusResponse {
  status_code?: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED' | 'PUBLISHED';
  error?: { message: string };
}

interface PublishResponse {
  id?: string;
  error?: { message: string };
}

interface PermalinkResponse {
  permalink?: string;
}

async function pollUntilFinished(creationId: string, accessToken: string): Promise<void> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    const url = `${GRAPH_BASE}/${creationId}?fields=status_code&access_token=${accessToken}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS) });
    const data = (await response.json()) as StatusResponse;

    if (data.status_code === 'FINISHED' || data.status_code === 'PUBLISHED') return;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Instagram medya işleme başarısız: ${data.error?.message ?? data.status_code}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error('Instagram medya işleme zaman aşımına uğradı');
}

export const instagramAdapter: PlatformAdapter = {
  platform: 'instagram',

  isConfigured(target: PublishTargetRow): boolean {
    return Boolean((target.access_token || target.credentials_env_key) && target.external_channel_ref);
  },

  async publish(input: CrossPostInput): Promise<CrossPostResult> {
    const { target } = input;
    if (!this.isConfigured(target)) {
      throw new Error('Instagram bağlantısı eksik - access token veya business account id yok');
    }

    const accessToken = resolveAccessToken(target);
    const businessAccountId = target.external_channel_ref!;

    const hosted = await publishFileTemporarily(input.filePath);
    if (!hosted) {
      throw new Error('PUBLIC_MEDIA_BASE_URL tanımlı değil - Instagram video_url gerektirir, dosya barındırılamadı');
    }

    try {
      Logger.info(`[Instagram] Reel yükleniyor: ${input.title}`);

      const createUrl = `${GRAPH_BASE}/${businessAccountId}/media`;
      const createResponse = await withRetry(
        async () => {
          const res = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              video_url: hosted.url,
              caption: `${input.title}\n\n${input.description}`.slice(0, 2200),
              media_type: 'REELS',
              access_token: accessToken,
            }),
            signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
          });
          const data = (await res.json()) as CreateContainerResponse;
          if (!res.ok || !data.id) throw new Error(`Instagram container oluşturulamadı: ${data.error?.message ?? res.status}`);
          return data;
        },
        { label: 'Instagram media container' },
      );

      const creationId = createResponse.id!;
      await pollUntilFinished(creationId, accessToken);

      const publishUrl = `${GRAPH_BASE}/${businessAccountId}/media_publish`;
      const publishResponse = await withRetry(
        async () => {
          const res = await fetch(publishUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
            signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
          });
          const data = (await res.json()) as PublishResponse;
          if (!res.ok || !data.id) throw new Error(`Instagram yayınlanamadı: ${data.error?.message ?? res.status}`);
          return data;
        },
        { label: 'Instagram media publish' },
      );

      const mediaId = publishResponse.id!;

      const permalinkUrl = `${GRAPH_BASE}/${mediaId}?fields=permalink&access_token=${accessToken}`;
      const permalinkRes = await fetch(permalinkUrl, { signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS) });
      const permalinkData = (await permalinkRes.json()) as PermalinkResponse;

      Logger.success(`[Instagram] Reel yayınlandı: ${mediaId}`);
      return { externalId: mediaId, url: permalinkData.permalink ?? `https://instagram.com/reel/${mediaId}` };
    } finally {
      await hosted.cleanup();
    }
  },
};
