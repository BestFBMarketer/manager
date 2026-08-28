// =====================================
// MODULE: Music Library
// Purpose: MUSIC_LIBRARY_DIR icindeki library.json manifestini MusicTrack[] olarak yukler
// Dependencies: config/env, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { optionalEnv } from '../config/env.js';
import { Logger } from '../core/logger.js';
import type { MusicTrack } from './types.js';

interface LibraryManifest {
  tracks: MusicTrack[];
}

let cached: MusicTrack[] | null = null;

/**
 * MUSIC_LIBRARY_DIR/library.json'dan parca listesini okur.
 * Manifest formatı: { "tracks": [{ id, filePath, title, mood, durationSec, tags }] }
 * @returns Parça listesi; dizin/manifest yoksa boş dizi (Rule 11: sessizce çökme yerine loglanır)
 */
export async function loadMusicLibrary(): Promise<MusicTrack[]> {
  if (cached) return cached;

  const dir = optionalEnv('MUSIC_LIBRARY_DIR') ?? 'data/music';
  const manifestPath = join(dir, 'library.json');

  try {
    const raw = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw) as LibraryManifest;
    cached = manifest.tracks ?? [];
    Logger.debug(`Müzik kütüphanesi yüklendi: ${cached.length} parça (${manifestPath})`);
    return cached;
  } catch (error) {
    Logger.warn(`Müzik kütüphanesi bulunamadı (${manifestPath}) - video müziksiz kalabilir`, error);
    cached = [];
    return cached;
  }
}
