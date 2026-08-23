// =====================================
// MODULE: Panel Story References Router
// Purpose: Hikaye kanali referans kanal CRUD - M5 topicDiscovery bunu okur
// Dependencies: express, core/db, core/logger, config/channels
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../core/db.js';
import { Logger } from '../../core/logger.js';
import { getChannel } from '../../config/channels.js';

export function storyReferencesRouter(): Router {
  const router = Router();

  router.get('/channels/:id/story-reference', (req: Request<{ id: string }>, res: Response) => {
    try {
      getChannel(req.params.id);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM story_reference WHERE channel_id = ? ORDER BY created_at ASC')
      .all(req.params.id);
    res.json(rows);
  });

  router.post('/channels/:id/story-reference', (req: Request<{ id: string }>, res: Response) => {
    try {
      getChannel(req.params.id);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    const sourceUrl = typeof req.body?.sourceUrl === 'string' ? req.body.sourceUrl.trim() : '';
    const label = typeof req.body?.label === 'string' ? req.body.label : null;

    if (!sourceUrl || !/^https?:\/\//.test(sourceUrl)) {
      res.status(400).json({ error: 'sourceUrl gecerli bir http(s) URL olmali' });
      return;
    }

    try {
      const db = getDb();
      const result = db
        .prepare('INSERT INTO story_reference (channel_id, source_url, label) VALUES (?, ?, ?)')
        .run(req.params.id, sourceUrl, label);
      const row = db.prepare('SELECT * FROM story_reference WHERE id = ?').get(result.lastInsertRowid);
      Logger.success(`Referans kanal eklendi: ${req.params.id} -> ${sourceUrl}`);
      res.status(201).json(row);
    } catch (error) {
      Logger.error('Referans kanal eklenemedi', error);
      res.status(500).json({ error: 'referans kanal eklenemedi' });
    }
  });

  router.delete(
    '/channels/:id/story-reference/:refId',
    (req: Request<{ id: string; refId: string }>, res: Response) => {
      try {
        const db = getDb();
        const result = db
          .prepare('DELETE FROM story_reference WHERE id = ? AND channel_id = ?')
          .run(Number(req.params.refId), req.params.id);

        if (result.changes === 0) {
          res.status(404).json({ error: 'referans kanal bulunamadi' });
          return;
        }

        Logger.success(`Referans kanal silindi: #${req.params.refId}`);
        res.json({ ok: true });
      } catch (error) {
        Logger.error('Referans kanal silinemedi', error);
        res.status(500).json({ error: 'referans kanal silinemedi' });
      }
    },
  );

  return router;
}
