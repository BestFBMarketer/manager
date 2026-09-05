// =====================================
// MODULE: Competitor Radar Queue
// Purpose: Tek-seferlik, periyodik calistirilan script (runQueue.ts deseni) -
//          rakip kanallarin son 48 saatlik yuklemelerini tarar, VPH outlier
//          tespit eder. Onerilen zamanlama: 3 saatte bir.
// Dependencies: core/db, core/logger, core/notify, analysis/competitorRadar
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { closeDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { notify } from '../core/notify.js';
import { scanAllCompetitors } from '../analysis/competitorRadar.js';

async function run(): Promise<void> {
  try {
    await scanAllCompetitors();
    Logger.info('competitorRadarQueue turu tamamlandı');
  } catch (err) {
    Logger.error('competitorRadarQueue başarısız', err);
    await notify({
      subject: 'competitorRadarQueue çöktü',
      body: err instanceof Error ? err.message : String(err),
      severity: 'error',
    });
  } finally {
    closeDb();
  }
}

run();
