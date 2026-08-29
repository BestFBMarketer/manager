// =====================================
// MODULE: Facebook Adapter
// Purpose: Facebook Sayfasina video postlar - Graph API /{page-id}/videos
// Dependencies: core/logger, core/retry, publish/publicMediaHost, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { Logger } from '../../core/logger.js';
import { withRetry } from '../../core/retry.js';
import { TIMEOUTS } from '../../config/constants.js';
import { publishFileTemporarily } from '../publicMediaHost.js';
import { resolveAccessToken, type CrossPostInput, type CrossPostResult, type PlatformAdapter, type PublishTargetRow } from './types.js';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface VideoUploadResponse {
  id?: string;
  post_id?: string;
  error?: { message: string };
}

export const facebookAdapter: PlatformAdapter = {
  platform: 'facebook',

  isConfigured(target: PublishTargetRow): boolean {
    return Boolean((target.access_token || target.credentials_env_key) && target.external_channel_ref);
  },

  async publish(input: CrossPostInput): Promise<CrossPostResult> {
    const { target } = input;
    if (!this.isConfigured(target)) {
      throw new Error('Facebook bağlantısı eksik - access token veya sayfa id yok');
    }

    // Sayfa token'i kullanilir (kullanicinin kendi token'i degil) - OAuth akisinda
    // (panel/routes/oauth.ts) Sayfa secildiginde bu token zaten kaydedilir.
    const accessToken = resolveAccessToken(target);
    const pageId = target.external_channel_ref!;

    const hosted = await publishFileTemporarily(input.filePath);
    if (!hosted) {
      throw new Error('PUBLIC_MEDIA_BASE_URL tanımlı değil - Facebook video_url gerektirir, dosya barındırılamadı');
    }

    try {
      Logger.info(`[Facebook] Sayfaya video yükleniyor: ${input.title}`);

      const uploadUrl = `${GRAPH_BASE}/${pageId}/videos`;
      const response = await withRetry(
        async () => {
          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_url: hosted.url,
              title: input.title,
              description: input.description,
              access_token: accessToken,
            }),
            signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
          });
          const data = (await res.json()) as VideoUploadResponse;
          if (!res.ok || !data.id) throw new Error(`Facebook sayfa postu başarısız: ${data.error?.message ?? res.status}`);
          return data;
        },
        { label: 'Facebook sayfa video postu' },
      );

      const videoId = response.id!;
      Logger.success(`[Facebook] Sayfaya postlandı: ${videoId}`);
      return { externalId: videoId, url: `https://www.facebook.com/${videoId}` };
    } finally {
      await hosted.cleanup();
    }
  },
};
