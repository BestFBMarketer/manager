// =====================================
// MODULE: Rule Synthesis Queue
// Purpose: Tek-seferlik, periyodik calistirilan script (runQueue.ts deseni) -
//          her kanal icin birikmis analytics verisinden yeni kural onerir.
//          Onerilen zamanlama: haftalik (pattern-synthesis birikmis veri
//          ister, hizli bir dongu degil).
// Dependencies: core/db, core/logger, core/notify, config/channels, analysis/ruleSynthesizer
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { closeDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { notify } from '../core/notify.js';
import { listChannels } from '../config/channels.js';
import { synthesizeRulesForChannel } from '../analysis/ruleSynthesizer.js';

async function run(): Promise<void> {
  try {
    const channels = listChannels().filter((c) => c.enabled);
    for (const channel of channels) {
      try {
        await synthesizeRulesForChannel(channel.id);
      } catch (err) {
        Logger.warn(`${channel.id}: pattern-synthesis basarisiz, sonraki kanala geciliyor`, err);
      }
    }
    Logger.info('ruleSynthesisQueue turu tamamlandı');
  } catch (err) {
    Logger.error('ruleSynthesisQueue başarısız', err);
    await notify({
      subject: 'ruleSynthesisQueue çöktü',
      body: err instanceof Error ? err.message : String(err),
      severity: 'error',
    });
  } finally {
    closeDb();
  }
}

run();
