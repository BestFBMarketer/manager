// =====================================
// MODULE: Analytics Queue
// Purpose: Tek-seferlik, periyodik calistirilan script (runQueue.ts deseni,
//          kalici daemon degil) - external_credential'i olan her kanalin
//          kendi YouTube Analytics verisini ceker. Onerilen zamanlama: gunluk
//          (Analytics API taze video icin 24-48 saat gecikmeli, daha sik
//          cekmenin degeri yok).
// Dependencies: core/db, core/logger, core/notify, analysis/analyticsFetcher
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { getDb, closeDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { notify } from '../core/notify.js';
import { fetchAndStoreAnalytics } from '../analysis/analyticsFetcher.js';

async function run(): Promise<void> {
  const db = getDb();

  try {
    const channelIds = (
      db.prepare("SELECT DISTINCT channel_id FROM external_credential WHERE purpose = 'youtube_analytics'").all() as Array<{
        channel_id: string;
      }>
    ).map((r) => r.channel_id);

    if (channelIds.length === 0) {
      Logger.warn('Hicbir kanalda youtube_analytics kimlik bilgisi yok - once scripts/importYoutubeCredentials.ts calistir');
      return;
    }

    for (const channelId of channelIds) {
      try {
        await fetchAndStoreAnalytics(channelId);
      } catch (err) {
        Logger.warn(`${channelId}: analytics cekimi basarisiz, sonraki kanala geciliyor`, err);
        await notify({
          subject: `Analytics cekimi basarisiz: ${channelId}`,
          body: err instanceof Error ? err.message : String(err),
          severity: 'warning',
        });
      }
    }

    Logger.info('analyticsQueue turu tamamlandi');
  } catch (err) {
    Logger.error('analyticsQueue basarisiz', err);
    await notify({
      subject: 'analyticsQueue çöktü',
      body: err instanceof Error ? err.message : String(err),
      severity: 'error',
    });
  } finally {
    closeDb();
  }
}

run();
