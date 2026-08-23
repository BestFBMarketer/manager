// =====================================
// MODULE: Visual Sourcing
// Purpose: Sahne anahtar kelimesinden stok GÖRSEL veya VIDEO bulur (Pexels)
// Dependencies: config/env, core/logger, core/retry, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { optionalEnv } from '../config/env.js';
import { Logger } from '../core/logger.js';
import { withRetry } from '../core/retry.js';
import { TIMEOUTS } from '../config/constants.js';

export interface SceneVisual {
  kind: 'video' | 'image' | 'none';
  /** İndirilmiş yerel dosya yolu - Remotion render sırasında ağa bağımlı kalınmasın diye */
  localPath?: string;
  attribution?: string;
}

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality: string;
}

interface PexelsVideoResult {
  video_files: PexelsVideoFile[];
  user?: { name: string };
}

interface PexelsVideoSearchResponse {
  videos: PexelsVideoResult[];
}

interface PexelsPhotoResult {
  src: { large2x: string };
  photographer?: string;
}

interface PexelsPhotoSearchResponse {
  photos: PexelsPhotoResult[];
}

async function downloadTo(url: string, destPath: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUTS.DOWNLOAD_MS) });
  if (!response.ok) throw new Error(`Dosya indirilemedi (HTTP ${response.status}): ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, buffer);
}

function pickBestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  // "hd" tercih edilir - "sd" cok kucuk, orijinal cok buyuk olabilir
  return files.find((f) => f.quality === 'hd') ?? files[0];
}

async function searchVideo(apiKey: string, keyword: string): Promise<{ url: string; attribution?: string } | null> {
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', keyword);
  url.searchParams.set('per_page', '3');
  url.searchParams.set('orientation', 'landscape');

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
  });
  if (!response.ok) throw new Error(`Pexels video arama HTTP ${response.status}`);

  const data = (await response.json()) as PexelsVideoSearchResponse;
  const first = data.videos[0];
  const file = first ? pickBestVideoFile(first.video_files) : undefined;
  if (!first || !file) return null;

  return { url: file.link, attribution: first.user?.name ? `Pexels · ${first.user.name}` : 'Pexels' };
}

async function searchPhoto(apiKey: string, keyword: string): Promise<{ url: string; attribution?: string } | null> {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', keyword);
  url.searchParams.set('per_page', '3');
  url.searchParams.set('orientation', 'landscape');

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
  });
  if (!response.ok) throw new Error(`Pexels foto arama HTTP ${response.status}`);

  const data = (await response.json()) as PexelsPhotoSearchResponse;
  const first = data.photos[0];
  if (!first) return null;

  return { url: first.src.large2x, attribution: first.photographer ? `Pexels · ${first.photographer}` : 'Pexels' };
}

/**
 * Bir sahne için stok görsel/video bulur ve indirir. Önce video denenir (daha
 * sinematik), bulunamazsa fotoğrafa düşülür, o da yoksa 'none' döner - render
 * katmanı bu durumda Remotion başlık kartına düşer (uydurma görsel yok).
 * @param keyword scriptWriter.ts'in ürettiği sahne anahtar kelimesi
 * @param workDir İndirilen dosyanın yazılacağı klasör
 * @param index Dosya adı çakışmasın diye sahne sırası
 */
export async function sourceVisualForScene(keyword: string, workDir: string, index: number): Promise<SceneVisual> {
  const apiKey = optionalEnv('PEXELS_API_KEY');
  if (!apiKey) {
    Logger.debug('PEXELS_API_KEY tanımlı değil - görsel kaynaklama atlanıyor');
    return { kind: 'none' };
  }

  await mkdir(workDir, { recursive: true });

  try {
    const video = await withRetry(() => searchVideo(apiKey, keyword), { label: `Pexels video (${keyword})`, maxAttempts: 2 });
    if (video) {
      const localPath = join(workDir, `scene_${index}.mp4`);
      await downloadTo(video.url, localPath);
      return { kind: 'video', localPath, attribution: video.attribution };
    }
  } catch (error) {
    Logger.warn(`Pexels video araması başarısız (${keyword}) - fotoğrafa düşülüyor`, error);
  }

  try {
    const photo = await withRetry(() => searchPhoto(apiKey, keyword), { label: `Pexels foto (${keyword})`, maxAttempts: 2 });
    if (photo) {
      const localPath = join(workDir, `scene_${index}.jpg`);
      await downloadTo(photo.url, localPath);
      return { kind: 'image', localPath, attribution: photo.attribution };
    }
  } catch (error) {
    Logger.warn(`Pexels foto araması başarısız (${keyword}) - başlık kartına düşülüyor`, error);
  }

  return { kind: 'none' };
}
