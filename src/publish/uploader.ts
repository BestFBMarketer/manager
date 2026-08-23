// =====================================
// MODULE: Uploader
// Purpose: YouTube'a resumable video yukleme - private + publishAt ile zamanlanmis yayin
// Dependencies: googleapis, core/*, config/channels, publish/youtubeClient
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { TIMEOUTS } from '../config/constants.js';
import type { ChannelConfig } from '../config/channels.js';
import { Logger } from '../core/logger.js';
import { withRetry } from '../core/retry.js';
import { getYoutubeClient } from './youtubeClient.js';

export interface UploadOptions {
  channel: ChannelConfig;
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  /** Videonun otomatik public olacagi an - once private olarak yuklenir */
  publishAt: Date;
  /** Cocuklara yonelik icerik beyani - YouTube icin zorunlu alan, varsayilan false */
  madeForKids?: boolean;
  /** Uretilmis kapak resmi - verilmezse YouTube kendi karesini secer (Rule 11: eksikse sessizce atlanir) */
  thumbnailPath?: string;
}

export interface UploadResult {
  videoId: string;
  studioUrl: string;
  publicUrl: string;
}

interface ApiError {
  code?: number;
  response?: { status?: number };
}

/**
 * Kalici hatalar (kota asimi, gecersiz istek, yetkisiz) yeniden denenmez -
 * aksi halde sonsuz denemede zaman ve bant genisligi bosa harcanir.
 */
function isRetryableUploadError(error: unknown): boolean {
  const apiError = error as ApiError;
  const status = apiError.code ?? apiError.response?.status;

  if (status === undefined) return true; // taniyamadigimiz hata - agsal olabilir, dene
  if (status === 400 || status === 401 || status === 403) return false;
  return status >= 500 || status === 429;
}

/**
 * Videoyu YouTube'a yukler; `private` + `publishAt` ile zamanlanir, verilen
 * an geldiginde YouTube otomatik olarak public yapar.
 *
 * @param options Kanal, dosya yolu, metadata ve yayin zamani
 * @returns Uretilen video kimligi ve linkler
 */
export async function uploadVideo(options: UploadOptions): Promise<UploadResult> {
  const info = await stat(options.filePath);
  if (info.size === 0) throw new Error(`Yuklenecek dosya bos: ${options.filePath}`);

  const youtube = getYoutubeClient(options.channel);
  const sizeMb = info.size / 1_048_576;

  Logger.info(
    `Yukleme basliyor: "${options.title}" (${sizeMb.toFixed(1)} MB, ${options.channel.label}) -> ` +
      `publishAt ${options.publishAt.toISOString()}`,
  );

  const response = await withRetry(
    () =>
      youtube.videos.insert(
        {
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: options.title,
              description: options.description,
              tags: options.tags,
              categoryId: options.channel.categoryId,
            },
            status: {
              privacyStatus: 'private',
              publishAt: options.publishAt.toISOString(),
              selfDeclaredMadeForKids: options.madeForKids ?? false,
            },
          },
          media: { body: createReadStream(options.filePath) },
        },
        { timeout: TIMEOUTS.UPLOAD_MS },
      ),
    { label: 'YouTube yukleme', isRetryable: isRetryableUploadError },
  );

  const videoId = response.data.id;
  if (!videoId) throw new Error('YouTube yanitinda video kimligi yok');

  Logger.success(`Yuklendi: ${videoId} (${options.channel.label})`);

  if (options.thumbnailPath) {
    try {
      await withRetry(
        () => youtube.thumbnails.set({ videoId, media: { body: createReadStream(options.thumbnailPath!) } }),
        { label: 'YouTube thumbnail', isRetryable: isRetryableUploadError },
      );
      Logger.success(`Thumbnail ayarlandı: ${videoId}`);
    } catch (error) {
      // Video zaten yuklendi - thumbnail basarisizligi tum yuklemeyi geri almaz,
      // sadece YouTube'un kendi secip koydugu kareyle kalir.
      Logger.warn(`Thumbnail ayarlanamadı (${videoId}) - video otomatik seçilen kareyle yayınlanacak`, error);
    }
  }

  return {
    videoId,
    studioUrl: `https://studio.youtube.com/video/${videoId}/edit`,
    publicUrl: `https://youtu.be/${videoId}`,
  };
}
