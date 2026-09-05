import { getDb, closeDb } from '../src/core/db.js';
const db = getDb();
const rows = db.prepare('SELECT id, channel_id, template, status, stage FROM job').all();
console.log(JSON.stringify(rows, null, 2));
closeDb();
