// =====================================
// MODULE: Panel Publish Targets Router
// Purpose: Instagram/TikTok baglanti CRUD - credentials_env_key sadece .env degisken adini tutar
// Dependencies: express, core/db, core/logger, config/channels
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../core/db.js';
import { Logger } from '../../core/logger.js';
import { getChannel } from '../../config/channels.js';

const VALID_PLATFORMS = new Set(['facebook', 'instagram', 'tiktok']);

export function publishTargetsRouter(): Router {
  const router = Router();

  router.get('/channels/:id/publish-targets', (req: Request<{ id: string }>, res: Response) => {
    try {
      getChannel(req.params.id);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    const db = getDb();
    const rows = db.prepare('SELECT * FROM publish_target WHERE channel_id = ?').all(req.params.id);
    res.json(rows);
  });

  router.put('/channels/:id/publish-targets/:platform', (req: Request<{ id: string; platform: string }>, res: Response) => {
    try {
      getChannel(req.params.id);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    if (!VALID_PLATFORMS.has(req.params.platform)) {
      res.status(400).json({ error: `gecersiz platform: ${req.params.platform}` });
      return;
    }

    const credentialsEnvKey = typeof req.body?.credentialsEnvKey === 'string' ? req.body.credentialsEnvKey : null;
    const externalChannelRef = typeof req.body?.externalChannelRef === 'string' ? req.body.externalChannelRef : null;
    const enabled = req.body?.enabled === true ? 1 : 0;

    try {
      const db = getDb();
      const existing = db
        .prepare('SELECT id FROM publish_target WHERE channel_id = ? AND platform = ?')
        .get(req.params.id, req.params.platform) as { id: number } | undefined;

      if (existing) {
        db.prepare(
          'UPDATE publish_target SET credentials_env_key=?, external_channel_ref=?, enabled=? WHERE id=?',
        ).run(credentialsEnvKey, externalChannelRef, enabled, existing.id);
      } else {
        db.prepare(
          'INSERT INTO publish_target (channel_id, platform, credentials_env_key, external_channel_ref, enabled) VALUES (?, ?, ?, ?, ?)',
        ).run(req.params.id, req.params.platform, credentialsEnvKey, externalChannelRef, enabled);
      }

      Logger.success(`Bağlantı güncellendi: ${req.params.id}/${req.params.platform} (enabled=${enabled})`);
      const row = db
        .prepare('SELECT * FROM publish_target WHERE channel_id = ? AND platform = ?')
        .get(req.params.id, req.params.platform);
      res.json(row);
    } catch (error) {
      Logger.error('Bağlantı güncellenemedi', error);
      res.status(500).json({ error: 'bağlantı güncellenemedi' });
    }
  });

  return router;
}
