// =====================================
// MODULE: Panel Review Router
// Purpose: Onay kuyrugu API - liste, approve/reject/request-changes/requeue, media stream
// Dependencies: express, core/db, core/logger, publish/reviewGate
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { createReadStream, existsSync, statSync } from 'node:fs';
import { Router, type Request, type Response } from 'express';
import { getDb } from '../../core/db.js';
import { Logger } from '../../core/logger.js';
import {
  approveReviewItem,
  rejectReviewItem,
  requestChanges,
  requeueReviewItem,
  regenerateReviewItem,
  updateProposedMetadata,
  type RequeueFields,
  type MetadataEdits,
} from '../../publish/reviewGate.js';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function reviewRouter(): Router {
  const router = Router();

  router.get('/review', (req: Request, res: Response) => {
    try {
      const db = getDb();
      const channelId = typeof req.query.channel === 'string' ? req.query.channel : null;

      const rows = channelId
        ? db
            .prepare(
              `SELECT r.*, c.label AS channel_label, c.channel_type, ren.id AS render_id
               FROM review_item r
               JOIN channel c ON c.id = r.channel_id
               LEFT JOIN render ren ON ren.job_id = r.job_id AND ren.status = 'done'
               WHERE r.status = 'pending_review' AND r.channel_id = ?
               ORDER BY r.created_at ASC`,
            )
            .all(channelId)
        : db
            .prepare(
              `SELECT r.*, c.label AS channel_label, c.channel_type, ren.id AS render_id
               FROM review_item r
               JOIN channel c ON c.id = r.channel_id
               LEFT JOIN render ren ON ren.job_id = r.job_id AND ren.status = 'done'
               WHERE r.status = 'pending_review'
               ORDER BY r.created_at ASC`,
            )
            .all();

      res.json(rows);
    } catch (error) {
      Logger.error('Onay kuyrugu okunamadi', error);
      res.status(500).json({ error: 'onay kuyrugu okunamadi' });
    }
  });

  router.post('/review/:id/approve', async (req: Request<{ id: string }>, res: Response) => {
    const decidedBy = typeof req.body?.decidedBy === 'string' ? req.body.decidedBy : '';
    if (!decidedBy.trim()) {
      res.status(400).json({ error: 'decidedBy zorunlu' });
      return;
    }

    try {
      const result = await approveReviewItem(Number(req.params.id), decidedBy);
      res.json(result);
    } catch (error) {
      Logger.error(`Onay basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.post('/review/:id/reject', async (req: Request<{ id: string }>, res: Response) => {
    const decidedBy = typeof req.body?.decidedBy === 'string' ? req.body.decidedBy : '';
    if (!decidedBy.trim()) {
      res.status(400).json({ error: 'decidedBy zorunlu' });
      return;
    }
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;

    try {
      await rejectReviewItem(Number(req.params.id), decidedBy, note);
      res.json({ ok: true });
    } catch (error) {
      Logger.error(`Reddetme basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.post('/review/:id/request-changes', async (req: Request<{ id: string }>, res: Response) => {
    const decidedBy = typeof req.body?.decidedBy === 'string' ? req.body.decidedBy : '';
    const note = typeof req.body?.note === 'string' ? req.body.note : '';
    if (!decidedBy.trim() || !note.trim()) {
      res.status(400).json({ error: 'decidedBy ve note zorunlu' });
      return;
    }

    try {
      await requestChanges(Number(req.params.id), decidedBy, note);
      res.json({ ok: true });
    } catch (error) {
      Logger.error(`Degisiklik istegi basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.post('/review/:id/requeue', async (req: Request<{ id: string }>, res: Response) => {
    const changedFields = (req.body?.changedFields ?? undefined) as RequeueFields | undefined;

    try {
      await requeueReviewItem(Number(req.params.id), changedFields);
      res.json({ ok: true });
    } catch (error) {
      Logger.error(`Requeue basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.patch('/review/:id', (req: Request<{ id: string }>, res: Response) => {
    try {
      const updated = updateProposedMetadata(Number(req.params.id), req.body as MetadataEdits);
      res.json(updated);
    } catch (error) {
      Logger.error(`Metadata guncelleme basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.post('/review/:id/regenerate', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const updated = await regenerateReviewItem(Number(req.params.id));
      res.json(updated);
    } catch (error) {
      Logger.error(`Yeniden olusturma basarisiz (#${req.params.id})`, error);
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.get('/review/:id/thumbnail', (req: Request<{ id: string }>, res: Response) => {
    try {
      const db = getDb();
      const item = db
        .prepare('SELECT thumbnail_path FROM review_item WHERE id = ?')
        .get(Number(req.params.id)) as { thumbnail_path: string | null } | undefined;

      if (!item?.thumbnail_path || !existsSync(item.thumbnail_path)) {
        res.status(404).json({ error: 'thumbnail yok' });
        return;
      }

      res.type('image/jpeg');
      createReadStream(item.thumbnail_path).pipe(res);
    } catch (error) {
      Logger.error(`Thumbnail servis edilemedi (#${req.params.id})`, error);
      res.status(500).json({ error: 'thumbnail servis edilemedi' });
    }
  });

  // Video scrubbing icin Range header destegi zorunlu - duz res.sendFile yetersiz kalir.
  router.get('/media/:renderId', (req: Request<{ renderId: string }>, res: Response) => {
    try {
      const db = getDb();
      const render = db
        .prepare('SELECT output_path FROM render WHERE id = ?')
        .get(Number(req.params.renderId)) as { output_path: string | null } | undefined;

      if (!render?.output_path || !existsSync(render.output_path)) {
        res.status(404).json({ error: 'medya dosyasi bulunamadi' });
        return;
      }

      const filePath = render.output_path;
      const stat = statSync(filePath);
      const range = req.headers.range;

      if (!range) {
        res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4' });
        createReadStream(filePath).pipe(res);
        return;
      }

      const match = /bytes=(\d+)-(\d*)/.exec(range);
      const start = match?.[1] ? Number(match[1]) : 0;
      const end = match?.[2] ? Number(match[2]) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });
      createReadStream(filePath, { start, end }).pipe(res);
    } catch (error) {
      Logger.error(`Medya akisi basarisiz (#${req.params.renderId})`, error);
      res.status(500).json({ error: 'medya akisi basarisiz' });
    }
  });

  return router;
}
