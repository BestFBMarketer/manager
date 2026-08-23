// =====================================
// MODULE: Facebook Adapter (stub)
// Purpose: Veri modeli hazir (publish_target tablosu), gercek gonderi kodu yazilmadi
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import type { CrossPostInput, CrossPostResult, PlatformAdapter, PublishTargetRow } from './types.js';

// TODO: Facebook Page video yayını - Graph API /{page-id}/videos, Instagram'ınkine benzer
// bir video_url veya resumable upload akışı. Kullanıcı şu an sadece Instagram + TikTok
// istedi; bu adapter isConfigured() her zaman false döner, crossPost.ts onu atlar.
export const facebookAdapter: PlatformAdapter = {
  platform: 'facebook',
  isConfigured(_target: PublishTargetRow): boolean {
    return false;
  },
  async publish(_input: CrossPostInput): Promise<CrossPostResult> {
    throw new Error('Facebook adapter henüz uygulanmadı');
  },
};
