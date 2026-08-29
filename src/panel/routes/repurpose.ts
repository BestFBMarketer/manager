// =====================================
// MODULE: Panel Repurpose Router
// Purpose: Yayinlanmis uzun videolari listeler, manuel Shorts turetme tetikler
// Dependencies: express, core/db, core/logger, config/channels, publish/repurpose
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../core/db.js';
import { Logger } from '../../core/logger.js';
import { getChannel } from '../../config/channels.js';
import { queueShortsDerivatives } from '../../publish/repurpose.js';

const LONG_VIDEO_TEMPLATES = new Set(['HotelTourLandscape', 'StoryNarrative']);

interface LongVideoRow {
  job_id: number;
  template: string;
  metadata_context_json: string;
  output_path: string;
  video_id: string;
  publish_at: string;
  proposed_title: string;
  derivative_count: number;
}

export function repurposeRouter(): Router {
  const router = Router();

  /** Bir kanalin yayinlanmis uzun videolarini, her biri icin kac Shorts turevi acilmis oldugunu gostererek listeler. */
  router.get('/channels/:id/long-videos', (req: Request<{ id: string }>, res: Response) => {
    try {
      getChannel(req.params.id);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT j.id AS job_id, j.template, r.metadata_context_json, r.proposed_title,
                ren.output_path, u.video_id, u.publish_at,
                (SELECT COUNT(*) FROM shorts_derivative sd WHERE sd.parent_job_id = j.id) AS derivative_count
         FROM job j
         JOIN review_item r ON r.job_id = j.id AND r.status = 'approved'
         JOIN render ren ON ren.job_id = j.id AND ren.status = 'done'
         JOIN upload u ON u.job_id = j.id AND u.status IN ('scheduled', 'published')
         WHERE j.status = 'done' AND j.channel_id = ?
         ORDER BY u.publish_at DESC`,
      )
      .all(req.params.id) as LongVideoRow[];

    const eligible = rows
      .filter((row) => LONG_VIDEO_TEMPLATES.has(row.template))
      .map((row) => {
        const context = JSON.parse(row.metadata_context_json) as { subject?: string; highlights?: string[]; durationSec?: number };
        return {
          jobId: row.job_id,
          template: row.template,
          title: row.proposed_title,
          videoId: row.video_id,
          videoUrl: `https://youtu.be/${row.video_id}`,
          publishAt: row.publish_at,
          durationSec: context.durationSec ?? null,
          derivativeCount: row.derivative_count,
        };
      });

    res.json(eligible);
  });

  /** Belirli bir uzun video icin manuel olarak N Shorts kesiti planlar ve kuyruga ekler. */
  router.post('/channels/:id/long-videos/:jobId/repurpose', async (req: Request<{ id: string; jobId: string }>, res: Response) => {
    let channel;
    try {
      channel = getChannel(req.params.id);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    const jobId = Number(req.params.jobId);
    if (!Number.isInteger(jobId)) {
      res.status(400).json({ error: 'gecersiz jobId' });
      return;
    }

    const count = Number(req.body?.count);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      res.status(400).json({ error: 'count 1-10 arasi tam sayi olmali' });
      return;
    }

    const offsetDays = Array.isArray(req.body?.offsetDays)
      ? (req.body.offsetDays as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n >= 0)
      : undefined;

    const db = getDb();
    const row = db
      .prepare(
        `SELECT j.id AS job_id, j.template, r.metadata_context_json,
                ren.output_path, u.video_id, u.publish_at
         FROM job j
         JOIN review_item r ON r.job_id = j.id AND r.status = 'approved'
         JOIN render ren ON ren.job_id = j.id AND ren.status = 'done'
         JOIN upload u ON u.job_id = j.id AND u.status IN ('scheduled', 'published')
         WHERE j.status = 'done' AND j.channel_id = ? AND j.id = ?`,
      )
      .get(req.params.id, jobId) as LongVideoRow | undefined;

    if (!row) {
      res.status(404).json({ error: 'video bulunamadi (yayinlanmis + onayli olmali)' });
      return;
    }
    if (!LONG_VIDEO_TEMPLATES.has(row.template)) {
      res.status(400).json({ error: `bu sablon Shorts turetmeyi desteklemiyor: ${row.template}` });
      return;
    }

    const context = JSON.parse(row.metadata_context_json) as { subject?: string; highlights?: string[]; durationSec?: number };
    if (!context.subject || !context.durationSec) {
      res.status(409).json({ error: 'videonun metadata baglamı eksik, turetme yapilamiyor' });
      return;
    }

    try {
      const queued = await queueShortsDerivatives(db, {
        parentJobId: row.job_id,
        channelId: channel.id,
        outputPath: row.output_path,
        videoId: row.video_id,
        publishAt: row.publish_at,
        subject: context.subject,
        highlights: context.highlights ?? [],
        durationSec: context.durationSec,
        count,
        offsetDays,
      });

      Logger.success(`[repurpose] Manuel tetikleme: ${channel.label} iş #${jobId} için ${queued} Shorts kuyruğa eklendi`);
      res.status(201).json({ queued });
    } catch (error) {
      Logger.error('Manuel Shorts türetme başarısız', error);
      const message = error instanceof Error ? error.message : 'shorts turetme basarisiz';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
