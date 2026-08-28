// =====================================
// MODULE: Public Media Host
// Purpose: Instagram Graph API video_url ister - dosyayi gecici olarak herkese acik URL'de sunar
// Dependencies: config/env, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { copyFile, mkdir, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { optionalEnv } from '../config/env.js';
import { Logger } from '../core/logger.js';

export const PUBLIC_MEDIA_DIR = 'data/public';

/**
 * Instagram'ın Content Publishing API'si dosyayı doğrudan almaz - Meta'nın
 * sunucuları bir `video_url`'i kendisi indirir. Bu yüzden onaylanan dosya
 * kısa süreliğine tahmin edilemez bir isimle herkese açık bir klasöre
 * kopyalanır (panel/server.ts bu klasörü kimlik doğrulaması OLMADAN sunar -
 * Meta'nın crawler'ı oturum çerezi taşıyamaz). PUBLIC_MEDIA_BASE_URL VPS
 * kurulumunda nginx/Caddy'nin bu origin'e yönlendirdiği herkese açık adrestir.
 * @returns Herkese açık URL; PUBLIC_MEDIA_BASE_URL tanımlı değilse null (Rule 11 - uydurma URL yok)
 */
export async function publishFileTemporarily(filePath: string): Promise<{ url: string; cleanup: () => Promise<void> } | null> {
  const baseUrl = optionalEnv('PUBLIC_MEDIA_BASE_URL');
  if (!baseUrl) {
    Logger.warn('PUBLIC_MEDIA_BASE_URL tanımlı değil - Instagram gibi video_url gerektiren adapterlar çalışamaz');
    return null;
  }

  await mkdir(PUBLIC_MEDIA_DIR, { recursive: true });
  const fileName = `${randomUUID()}${extname(filePath)}`;
  const publicPath = join(PUBLIC_MEDIA_DIR, fileName);
  await copyFile(filePath, publicPath);

  const url = `${baseUrl.replace(/\/$/, '')}/${fileName}`;
  Logger.debug(`Dosya geçici olarak herkese açık: ${url}`);

  return {
    url,
    cleanup: async () => {
      await unlink(publicPath).catch(() => undefined);
    },
  };
}
