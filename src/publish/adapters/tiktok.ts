// =====================================
// MODULE: TikTok Adapter
// Purpose: TikTok Content Posting API v2 - FILE_UPLOAD (public hosting gerektirmez)
// Dependencies: config/env, core/logger, core/retry, node:fs
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { readFile, stat } from 'node:fs/promises';
import { requireEnv } from '../../config/env.js';
import { Logger } from '../../core/logger.js';
import { withRetry } from '../../core/retry.js';
import { TIMEOUTS } from '../../config/constants.js';
import type { CrossPostInput, CrossPostResult, PlatformAdapter, PublishTargetRow } from './types.js';

const API_BASE = 'https://open.tiktokapis.com/v2';
/** Tek parçada yüklenebilecek azami boyut - üstü çok parçalı yükleme gerektirir (henüz uygulanmadı). */
const MAX_SINGLE_CHUNK_BYTES = 64 * 1024 * 1024;

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 24;

interface InitResponse {
  data?: { publish_id: string; upload_url: string };
  error?: { code: string; message: string };
}

interface StatusResponse {
  data?: { status: string; publicaly_available_post_id?: string[] };
  error?: { code: string; message: string };
}

async function pollUntilPublished(publishId: string, accessToken: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    const res = await fetch(`${API_BASE}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_id: publishId }),
      signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
    });
    const data = (await res.json()) as StatusResponse;

    if (data.data?.status === 'PUBLISH_COMPLETE') return data.data.publicaly_available_post_id?.[0];
    if (data.data?.status === 'FAILED') throw new Error(`TikTok yayını başarısız: ${data.error?.message ?? 'bilinmeyen hata'}`);

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error('TikTok yayın durumu zaman aşımına uğradı');
}

export const tiktokAdapter: PlatformAdapter = {
  platform: 'tiktok',

  isConfigured(target: PublishTargetRow): boolean {
    return Boolean(target.credentials_env_key);
  },

  async publish(input: CrossPostInput): Promise<CrossPostResult> {
    const { target } = input;
    if (!this.isConfigured(target)) {
      throw new Error('TikTok bağlantısı eksik - access token yok');
    }

    const accessToken = requireEnv(target.credentials_env_key!);
    const fileStat = await stat(input.filePath);

    if (fileStat.size > MAX_SINGLE_CHUNK_BYTES) {
      throw new Error(
        `Video çok büyük (${(fileStat.size / 1_048_576).toFixed(1)} MB) - tek parçalı yükleme ${MAX_SINGLE_CHUNK_BYTES / 1_048_576}MB ile sınırlı, çok parçalı yükleme henüz uygulanmadı`,
      );
    }

    Logger.info(`[TikTok] Video yükleniyor: ${input.title}`);

    const initResponse = await withRetry(
      async () => {
        const res = await fetch(`${API_BASE}/post/publish/video/init/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_info: {
              title: input.title.slice(0, 150),
              privacy_level: 'PUBLIC_TO_EVERYONE',
              disable_duet: false,
              disable_comment: false,
              disable_stitch: false,
            },
            source_info: {
              source: 'FILE_UPLOAD',
              video_size: fileStat.size,
              chunk_size: fileStat.size,
              total_chunk_count: 1,
            },
          }),
          signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
        });
        const data = (await res.json()) as InitResponse;
        if (!res.ok || !data.data) throw new Error(`TikTok init başarısız: ${data.error?.message ?? res.status}`);
        return data.data;
      },
      { label: 'TikTok publish init' },
    );

    const videoBuffer = await readFile(input.filePath);
    await withRetry(
      async () => {
        const res = await fetch(initResponse.upload_url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Range': `bytes 0-${fileStat.size - 1}/${fileStat.size}`,
          },
          body: videoBuffer,
          signal: AbortSignal.timeout(TIMEOUTS.UPLOAD_MS),
        });
        if (!res.ok) throw new Error(`TikTok dosya yükleme HTTP ${res.status}`);
      },
      { label: 'TikTok video upload' },
    );

    const publicPostId = await pollUntilPublished(initResponse.publish_id, accessToken);

    Logger.success(`[TikTok] Video yayınlandı: ${initResponse.publish_id}`);
    return {
      externalId: initResponse.publish_id,
      url: publicPostId ? `https://www.tiktok.com/@/video/${publicPostId}` : 'https://www.tiktok.com/',
    };
  },
};
