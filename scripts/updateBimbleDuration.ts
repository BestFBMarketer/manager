import { getDb, closeDb } from '../src/core/db.js';
const db = getDb();
db.prepare("UPDATE channel SET target_duration_sec=330 WHERE id='bimble'").run();
console.log('bimble target_duration_sec -> 330 (5.5dk)');
closeDb();
