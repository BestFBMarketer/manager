// =====================================
// MODULE: Competitor Discovery Queue
// Purpose: Tek-seferlik, periyodik calistirilan script (runQueue.ts deseni) -
//          her kanal icin tanimli anahtar kelimelerle yeni rakip adaylari
//          arar. SADECE ONERIR (competitor_candidate, status='proposed') -
//          otomatik onaylamaz, insan panelden onaylamali. Onerilen zamanlama:
//          haftalik (nis kanal manzarasi hizli degismiyor).
// Dependencies: core/db, core/logger, core/notify, config/channels, analysis/competitorDiscovery
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { closeDb, getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { notify } from '../core/notify.js';
import { discoverCompetitorCandidates } from '../analysis/competitorDiscovery.js';

// Kanal basina arama anahtar kelimeleri - Fun&Rank hem Ranking (fail-derleme)
// hem TierList (marka/spor karsilastirma) formatinda uretim yaptigi icin
// ikisini de kapsayan bir kelime seti kullanilir.
const KEYWORDS_BY_CHANNEL: Record<string, string[]> = {
  shorts: [
    'fail compilation shorts',
    'ranking fails shorts',
    'top 5 fails',
    'tier list ranking shorts',
    'brand ads ranked',
    'sports moments ranked',
    'viral fails shorts',
  ],
};

async function run(): Promise<void> {
  try {
    const db = getDb();
    const channelIds = Object.keys(KEYWORDS_BY_CHANNEL).filter((id) => {
      const row = db.prepare('SELECT enabled FROM channel WHERE id = ?').get(id) as { enabled: number } | undefined;
      return row?.enabled === 1;
    });

    let totalDiscovered = 0;
    for (const channelId of channelIds) {
      try {
        const count = await discoverCompetitorCandidates(channelId, KEYWORDS_BY_CHANNEL[channelId]!);
        totalDiscovered += count;
        if (count > 0) {
          await notify({
            subject: `${count} yeni rakip adayı onay bekliyor: ${channelId}`,
            body: `Panelden /channels/${channelId}/competitors sayfasına gidip incele.`,
            severity: 'info',
          });
        }
      } catch (err) {
        Logger.warn(`${channelId}: rakip keşfi başarısız, sonraki kanala geçiliyor`, err);
      }
    }

    Logger.info(`competitorDiscoveryQueue turu tamamlandı (toplam ${totalDiscovered} yeni aday)`);
  } catch (err) {
    Logger.error('competitorDiscoveryQueue başarısız', err);
    await notify({
      subject: 'competitorDiscoveryQueue çöktü',
      body: err instanceof Error ? err.message : String(err),
      severity: 'error',
    });
  } finally {
    closeDb();
  }
}

run();
