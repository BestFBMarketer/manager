// One-off: queue a single test job for the Bimble TV pilot render.
import { getDb, closeDb } from '../src/core/db.js';
import { Logger } from '../src/core/logger.js';

const db = getDb();
db.prepare(
  `INSERT INTO job (channel_id, template, source_ref, input_json) VALUES (?, ?, ?, ?)`,
).run('bimble', 'BimbleTV', 'pilot-episode-14', '{}');

Logger.success('Bimble TV test job kuyruğa eklendi');
closeDb();
