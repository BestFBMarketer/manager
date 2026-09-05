// =====================================
// MODULE: Panel Analytics Router
// Purpose: Icerik zekasi modulu API - kendi-kanal analytics, dusuk-etkilesim
//          videolar, kural onay kuyrugu, rakip izleme listesi, VPH uyarilari.
//          bkz DEVAM_NOTU.md "Retention/engagement analizi + panel-capi
//          viral-analiz araci" ve C:\Users\MONSTER\.claude\plans\dapper-spinning-sparkle.md
// Dependencies: express, core/db, core/logger, analysis/analyticsFetcher
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../core/db.js';
import { Logger } from '../../core/logger.js';
import { fetchAndStoreAnalytics } from '../../analysis/analyticsFetcher.js';

// Flagged videolar icin esik degerleri - "yeterince iyi degil, bak" cizgisi.
// bkz etkilesim-yorum-begeni-100k-esigi.md: retention yuksek olsa bile
// etkilesim (like+comment / views) dusukse ayri bir sorun.
const LOW_RETENTION_PCT = 40;
const LOW_ENGAGEMENT_RATIO = 0.005; // (likes+comments)/views < %0.5

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface LatestSnapshotRow {
  video_id: string;
  title: string | null;
  views: number;
  average_view_percentage: number | null;
  average_view_duration_sec: number | null;
  likes: number;
  comments: number;
  subscribers_gained: number;
  published_at: string | null;
  snapshot_date: string;
}

function getLatestSnapshotsForChannel(channelId: string): LatestSnapshotRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT video_id, title, views, average_view_percentage, average_view_duration_sec,
              likes, comments, subscribers_gained, published_at, snapshot_date
       FROM video_analytics_snapshot v1
       WHERE channel_id = ?
         AND snapshot_date = (
           SELECT MAX(snapshot_date) FROM video_analytics_snapshot v2
           WHERE v2.channel_id = v1.channel_id AND v2.video_id = v1.video_id
         )
       ORDER BY views DESC`,
    )
    .all(channelId) as LatestSnapshotRow[];
}

function suggestionFor(row: LatestSnapshotRow): string {
  const engagementRatio = row.views > 0 ? (row.likes + row.comments) / row.views : 0;
  const lowRetention = (row.average_view_percentage ?? 0) < LOW_RETENTION_PCT;
  const lowEngagement = engagementRatio < LOW_ENGAGEMENT_RATIO;

  if (lowRetention && lowEngagement) {
    return 'Hem retention hem etkileşim düşük - hook/klip seçimi ve description CTA\'sı birlikte gözden geçirilmeli.';
  }
  if (lowRetention) {
    return 'Retention düşük - hook zayıf veya klip peak-action anını yakalamıyor olabilir.';
  }
  if (lowEngagement) {
    return `Retention iyi (%${(row.average_view_percentage ?? 0).toFixed(1)}) ama yorum/beğeni çok az - description'da tartışma yaratan bir soru dene.`;
  }
  return '';
}

export function analyticsRouter(): Router {
  const router = Router();

  router.get('/channels/:id/analytics', (req: Request<{ id: string }>, res: Response) => {
    try {
      res.json(getLatestSnapshotsForChannel(req.params.id));
    } catch (error) {
      Logger.error(`Analytics okunamadi (${req.params.id})`, error);
      res.status(500).json({ error: 'analytics okunamadı' });
    }
  });

  router.post('/channels/:id/analytics/refresh', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const count = await fetchAndStoreAnalytics(req.params.id);
      res.json({ ok: true, videosUpdated: count });
    } catch (error) {
      Logger.error(`Analytics yenileme basarisiz (${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.get('/channels/:id/analytics/flagged', (req: Request<{ id: string }>, res: Response) => {
    try {
      const flagged = getLatestSnapshotsForChannel(req.params.id)
        .map((row) => ({ ...row, suggestion: suggestionFor(row) }))
        .filter((row) => row.suggestion !== '');
      res.json(flagged);
    } catch (error) {
      Logger.error(`Flagged video listesi okunamadi (${req.params.id})`, error);
      res.status(500).json({ error: 'flagged video listesi okunamadı' });
    }
  });

  router.get('/rules', (req: Request, res: Response) => {
    try {
      const db = getDb();
      const channelId = typeof req.query.channel === 'string' ? req.query.channel : null;
      const status = typeof req.query.status === 'string' ? req.query.status : 'proposed';

      const rows = channelId
        ? db
            .prepare('SELECT * FROM content_rule WHERE channel_id = ? AND status = ? ORDER BY created_at DESC')
            .all(channelId, status)
        : db.prepare('SELECT * FROM content_rule WHERE status = ? ORDER BY created_at DESC').all(status);

      res.json(rows);
    } catch (error) {
      Logger.error('Kural listesi okunamadi', error);
      res.status(500).json({ error: 'kural listesi okunamadı' });
    }
  });

  router.get('/channels/:id/rules/active', (req: Request<{ id: string }>, res: Response) => {
    try {
      const db = getDb();
      const rows = db
        .prepare("SELECT category, rule_text, rationale FROM content_rule WHERE channel_id = ? AND status = 'approved' ORDER BY created_at ASC")
        .all(req.params.id);
      res.json(rows);
    } catch (error) {
      Logger.error(`Aktif kurallar okunamadi (${req.params.id})`, error);
      res.status(500).json({ error: 'aktif kurallar okunamadı' });
    }
  });

  router.post('/rules/:id/approve', (req: Request<{ id: string }>, res: Response) => {
    const decidedBy = typeof req.body?.decidedBy === 'string' ? req.body.decidedBy : '';
    if (!decidedBy.trim()) {
      res.status(400).json({ error: 'decidedBy zorunlu' });
      return;
    }
    try {
      const db = getDb();
      const result = db
        .prepare("UPDATE content_rule SET status='approved', decided_by=?, decided_at=datetime('now') WHERE id = ? AND status='proposed'")
        .run(decidedBy, Number(req.params.id));
      if (result.changes === 0) {
        res.status(404).json({ error: 'kural bulunamadı veya zaten karara bağlanmış' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      Logger.error(`Kural onayi basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.post('/rules/:id/reject', (req: Request<{ id: string }>, res: Response) => {
    const decidedBy = typeof req.body?.decidedBy === 'string' ? req.body.decidedBy : '';
    if (!decidedBy.trim()) {
      res.status(400).json({ error: 'decidedBy zorunlu' });
      return;
    }
    const note = typeof req.body?.note === 'string' ? req.body.note : null;
    try {
      const db = getDb();
      const result = db
        .prepare("UPDATE content_rule SET status='rejected', decided_by=?, decided_at=datetime('now'), reviewer_note=? WHERE id = ? AND status='proposed'")
        .run(decidedBy, note, Number(req.params.id));
      if (result.changes === 0) {
        res.status(404).json({ error: 'kural bulunamadı veya zaten karara bağlanmış' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      Logger.error(`Kural reddi basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.get('/channels/:id/competitors', (req: Request<{ id: string }>, res: Response) => {
    try {
      const db = getDb();
      const rows = db
        .prepare('SELECT * FROM competitor_channel WHERE channel_id = ? ORDER BY created_at DESC')
        .all(req.params.id);
      res.json(rows);
    } catch (error) {
      Logger.error(`Rakip listesi okunamadi (${req.params.id})`, error);
      res.status(500).json({ error: 'rakip listesi okunamadı' });
    }
  });

  router.post('/channels/:id/competitors', (req: Request<{ id: string }>, res: Response) => {
    const competitorYtId = typeof req.body?.competitorYtId === 'string' ? req.body.competitorYtId.trim() : '';
    const label = typeof req.body?.label === 'string' ? req.body.label : null;
    if (!competitorYtId) {
      res.status(400).json({ error: 'competitorYtId zorunlu' });
      return;
    }
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO competitor_channel (channel_id, competitor_yt_id, label) VALUES (?, ?, ?)
         ON CONFLICT(channel_id, competitor_yt_id) DO UPDATE SET label = excluded.label, enabled = 1`,
      ).run(req.params.id, competitorYtId, label);
      res.json({ ok: true });
    } catch (error) {
      Logger.error(`Rakip ekleme basarisiz (${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.delete('/competitors/:id', (req: Request<{ id: string }>, res: Response) => {
    try {
      const db = getDb();
      db.prepare('UPDATE competitor_channel SET enabled = 0 WHERE id = ?').run(Number(req.params.id));
      res.json({ ok: true });
    } catch (error) {
      Logger.error(`Rakip silme basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.get('/channels/:id/vph-alerts', (req: Request<{ id: string }>, res: Response) => {
    try {
      const db = getDb();
      const status = typeof req.query.status === 'string' ? req.query.status : 'new';
      const rows = db
        .prepare('SELECT * FROM vph_alert WHERE channel_id = ? AND status = ? ORDER BY created_at DESC')
        .all(req.params.id, status);
      res.json(rows);
    } catch (error) {
      Logger.error(`VPH uyarilari okunamadi (${req.params.id})`, error);
      res.status(500).json({ error: 'VPH uyarıları okunamadı' });
    }
  });

  router.post('/vph-alerts/:id/dismiss', (req: Request<{ id: string }>, res: Response) => {
    try {
      const db = getDb();
      db.prepare("UPDATE vph_alert SET status = 'dismissed' WHERE id = ?").run(Number(req.params.id));
      res.json({ ok: true });
    } catch (error) {
      Logger.error(`VPH uyari kapatma basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  return router;
}
