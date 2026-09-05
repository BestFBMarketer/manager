import { getDb, closeDb } from '../src/core/db.js';
const db = getDb();
db.prepare("DELETE FROM render WHERE job_id=4").run();
db.prepare("UPDATE job SET status='pending', stage='queued', error=NULL, claimed_at=NULL WHERE id=4").run();
console.log('requeued job 4 (stale render rows cleared)');
closeDb();
