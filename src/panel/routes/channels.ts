// =====================================
// MODULE: Panel Channels Router
// Purpose: Kanal CRUD, zamanlama kurali degistirme, gercek yayin takvimi
// Dependencies: express, core/db, core/logger, config/channels, config/channelSettings
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../core/db.js';
import { Logger } from '../../core/logger.js';
import { getChannel, listChannels, type ChannelType, type TopicSource } from '../../config/channels.js';
import { parseChannelSettings, serializeChannelSettings, DEFAULT_CHANNEL_SETTINGS } from '../../config/channelSettings.js';
import type { PrimeTimeSlot } from '../../publish/publishSlots.js';

interface ScheduleRuleInput {
  kind: 'weekday_list' | 'every_n_days' | 'count_per_period';
  weekdays?: number[];
  intervalDays?: number;
  countPerPeriod?: number;
  periodMonths?: number;
  anchor?: string;
  slots: PrimeTimeSlot[];
}

interface ValidatedRule {
  kind: string;
  weekdaysJson: string | null;
  intervalDays: number | null;
  periodMonths: number | null;
  countPerPeriod: number | null;
  anchorDate: string;
  slotsJson: string;
}

function isValidSlot(value: unknown): value is PrimeTimeSlot {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.timeZone === 'string' &&
    typeof s.hour === 'number' &&
    typeof s.minute === 'number' &&
    typeof s.label === 'string'
  );
}

/** İstek govdesindeki zamanlama kuralini DB'ye yazilacak sekle dogrular/cevirir. */
function validateScheduleRule(body: unknown): ValidatedRule | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'schedule govdesi eksik' };
  const input = body as Partial<ScheduleRuleInput>;

  if (!Array.isArray(input.slots) || input.slots.length === 0 || !input.slots.every(isValidSlot)) {
    return { error: 'slots gecerli PrimeTimeSlot dizisi olmali' };
  }
  const slotsJson = JSON.stringify(input.slots);
  const anchorDate = input.anchor ?? new Date().toISOString().slice(0, 10);

  switch (input.kind) {
    case 'weekday_list':
      if (!Array.isArray(input.weekdays) || !input.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
        return { error: 'weekdays 0-6 arasi tam sayi dizisi olmali' };
      }
      return {
        kind: 'weekday_list',
        weekdaysJson: JSON.stringify(input.weekdays),
        intervalDays: null,
        periodMonths: null,
        countPerPeriod: null,
        anchorDate,
        slotsJson,
      };

    case 'every_n_days':
      if (!Number.isInteger(input.intervalDays) || (input.intervalDays as number) < 1) {
        return { error: 'intervalDays pozitif tam sayi olmali' };
      }
      return {
        kind: 'every_n_days',
        weekdaysJson: null,
        intervalDays: input.intervalDays as number,
        periodMonths: null,
        countPerPeriod: null,
        anchorDate,
        slotsJson,
      };

    case 'count_per_period':
      if (!Number.isInteger(input.countPerPeriod) || (input.countPerPeriod as number) < 1) {
        return { error: 'countPerPeriod pozitif tam sayi olmali' };
      }
      if (!Number.isInteger(input.periodMonths) || (input.periodMonths as number) < 1) {
        return { error: 'periodMonths pozitif tam sayi olmali' };
      }
      return {
        kind: 'count_per_period',
        weekdaysJson: null,
        intervalDays: null,
        periodMonths: input.periodMonths as number,
        countPerPeriod: input.countPerPeriod as number,
        anchorDate,
        slotsJson,
      };

    default:
      return { error: "kind 'weekday_list' | 'every_n_days' | 'count_per_period' olmali" };
  }
}

interface ChannelInput {
  id: string;
  label: string;
  channelType?: ChannelType;
  refreshTokenEnvKey: string;
  defaultTemplate: string;
  targetDurationSec: number;
  language: string;
  wikiLanguages?: string[];
  audience?: string;
  titleExamples?: string[];
  styleReference?: string | null;
  niche?: string | null;
  topicSource?: TopicSource;
  shortsDerivativeCount?: number;
  categoryId: string;
}

const CHANNEL_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/;

function validateChannelInput(body: unknown): ChannelInput | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'channel govdesi eksik' };
  const c = body as Partial<ChannelInput>;

  if (typeof c.id !== 'string' || !CHANNEL_ID_PATTERN.test(c.id)) {
    return { error: 'id 2-32 karakter, kucuk harf/rakam/-/_ olmali' };
  }
  if (typeof c.label !== 'string' || c.label.trim().length === 0) return { error: 'label bos olamaz' };
  if (typeof c.refreshTokenEnvKey !== 'string' || c.refreshTokenEnvKey.trim().length === 0) {
    return { error: 'refreshTokenEnvKey bos olamaz (.env icindeki degisken adi)' };
  }
  if (typeof c.defaultTemplate !== 'string') return { error: 'defaultTemplate bos olamaz' };
  if (typeof c.targetDurationSec !== 'number' || c.targetDurationSec <= 0) {
    return { error: 'targetDurationSec pozitif sayi olmali' };
  }
  if (typeof c.language !== 'string') return { error: 'language bos olamaz' };
  if (typeof c.categoryId !== 'string') return { error: 'categoryId bos olamaz' };

  return {
    id: c.id,
    label: c.label,
    channelType: c.channelType === 'story' ? 'story' : 'standard',
    refreshTokenEnvKey: c.refreshTokenEnvKey,
    defaultTemplate: c.defaultTemplate,
    targetDurationSec: c.targetDurationSec,
    language: c.language,
    wikiLanguages: Array.isArray(c.wikiLanguages) ? c.wikiLanguages : [],
    audience: typeof c.audience === 'string' ? c.audience : '',
    titleExamples: Array.isArray(c.titleExamples) ? c.titleExamples : [],
    styleReference: typeof c.styleReference === 'string' ? c.styleReference : null,
    niche: typeof c.niche === 'string' ? c.niche : null,
    topicSource: c.topicSource === 'ai_generated' || c.topicSource === 'both' ? c.topicSource : 'reference',
    shortsDerivativeCount: typeof c.shortsDerivativeCount === 'number' ? c.shortsDerivativeCount : 0,
    categoryId: c.categoryId,
  };
}

export function channelsRouter(): Router {
  const router = Router();

  router.get('/channels', (_req: Request, res: Response) => {
    try {
      res.json(listChannels());
    } catch (error) {
      Logger.error('Kanal listesi okunamadi', error);
      res.status(500).json({ error: 'kanal listesi okunamadi' });
    }
  });

  router.get('/channels/:id', (req: Request<{ id: string }>, res: Response) => {
    try {
      res.json(getChannel(req.params.id));
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
    }
  });

  router.post('/channels', (req: Request, res: Response) => {
    const input = validateChannelInput(req.body);
    if ('error' in input) {
      res.status(400).json(input);
      return;
    }
    const rule = validateScheduleRule(req.body?.scheduleRule);
    if ('error' in rule) {
      res.status(400).json(rule);
      return;
    }

    try {
      const db = getDb();
      const createTx = db.transaction(() => {
        db.prepare(
          `INSERT INTO channel (
             id, label, channel_type, refresh_token_env_key, default_template,
             target_duration_sec, language, wiki_languages_json, audience,
             title_examples_json, style_reference, niche, topic_source,
             shorts_derivative_count, category_id, settings_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          input.id,
          input.label,
          input.channelType,
          input.refreshTokenEnvKey,
          input.defaultTemplate,
          input.targetDurationSec,
          input.language,
          JSON.stringify(input.wikiLanguages),
          input.audience,
          JSON.stringify(input.titleExamples),
          input.styleReference,
          input.niche,
          input.topicSource,
          input.shortsDerivativeCount,
          input.categoryId,
          serializeChannelSettings(DEFAULT_CHANNEL_SETTINGS),
        );

        db.prepare(
          `INSERT INTO schedule_rule (
             channel_id, kind, weekdays_json, interval_days, period_months,
             count_per_period, anchor_date, slots_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          input.id,
          rule.kind,
          rule.weekdaysJson,
          rule.intervalDays,
          rule.periodMonths,
          rule.countPerPeriod,
          rule.anchorDate,
          rule.slotsJson,
        );
      });
      createTx();

      Logger.success(`Yeni kanal olusturuldu: ${input.id}`);
      res.status(201).json(getChannel(input.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: `kanal zaten var: ${input.id}` });
        return;
      }
      Logger.error('Kanal olusturulamadi', error);
      res.status(500).json({ error: 'kanal olusturulamadi' });
    }
  });

  router.patch('/channels/:id', (req: Request<{ id: string }>, res: Response) => {
    try {
      getChannel(req.params.id); // 404 erken firlatir
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const fields: Array<{ column: string; value: unknown }> = [];

    if (typeof body.label === 'string') fields.push({ column: 'label', value: body.label });
    if (typeof body.audience === 'string') fields.push({ column: 'audience', value: body.audience });
    if (typeof body.styleReference === 'string' || body.styleReference === null) {
      fields.push({ column: 'style_reference', value: body.styleReference });
    }
    if (typeof body.niche === 'string' || body.niche === null) {
      fields.push({ column: 'niche', value: body.niche });
    }
    if (body.topicSource === 'reference' || body.topicSource === 'ai_generated' || body.topicSource === 'both') {
      fields.push({ column: 'topic_source', value: body.topicSource });
    }
    if (typeof body.targetDurationSec === 'number' && body.targetDurationSec > 0) {
      fields.push({ column: 'target_duration_sec', value: body.targetDurationSec });
    }
    if (typeof body.language === 'string') fields.push({ column: 'language', value: body.language });
    if (Array.isArray(body.wikiLanguages)) fields.push({ column: 'wiki_languages_json', value: JSON.stringify(body.wikiLanguages) });
    if (Array.isArray(body.titleExamples)) fields.push({ column: 'title_examples_json', value: JSON.stringify(body.titleExamples) });
    if (typeof body.shortsDerivativeCount === 'number') fields.push({ column: 'shorts_derivative_count', value: body.shortsDerivativeCount });
    if (typeof body.categoryId === 'string') fields.push({ column: 'category_id', value: body.categoryId });
    if (typeof body.enabled === 'boolean') fields.push({ column: 'enabled', value: body.enabled ? 1 : 0 });
    if (typeof body.settings === 'object' && body.settings !== null) {
      fields.push({ column: 'settings_json', value: serializeChannelSettings(parseChannelSettings(JSON.stringify(body.settings))) });
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'guncellenecek gecerli alan yok' });
      return;
    }

    try {
      const db = getDb();
      const setClause = fields.map((f) => `${f.column} = ?`).join(', ');
      db.prepare(`UPDATE channel SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(
        ...fields.map((f) => f.value),
        req.params.id,
      );
      Logger.success(`Kanal guncellendi: ${req.params.id} (${fields.map((f) => f.column).join(', ')})`);
      res.json(getChannel(req.params.id));
    } catch (error) {
      Logger.error('Kanal guncellenemedi', error);
      res.status(500).json({ error: 'kanal guncellenemedi' });
    }
  });

  router.put('/channels/:id/schedule', (req: Request<{ id: string }>, res: Response) => {
    try {
      getChannel(req.params.id);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    const rule = validateScheduleRule(req.body);
    if ('error' in rule) {
      res.status(400).json(rule);
      return;
    }

    try {
      const db = getDb();
      const replaceTx = db.transaction(() => {
        db.prepare('UPDATE schedule_rule SET enabled = 0 WHERE channel_id = ? AND enabled = 1').run(req.params.id);
        db.prepare(
          `INSERT INTO schedule_rule (
             channel_id, kind, weekdays_json, interval_days, period_months,
             count_per_period, anchor_date, slots_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          req.params.id,
          rule.kind,
          rule.weekdaysJson,
          rule.intervalDays,
          rule.periodMonths,
          rule.countPerPeriod,
          rule.anchorDate,
          rule.slotsJson,
        );
      });
      replaceTx();

      Logger.success(`Zamanlama kurali degisti: ${req.params.id} -> ${rule.kind}`);
      res.json(getChannel(req.params.id));
    } catch (error) {
      Logger.error('Zamanlama kurali guncellenemedi', error);
      res.status(500).json({ error: 'zamanlama kurali guncellenemedi' });
    }
  });

  router.get('/channels/:id/calendar', (req: Request<{ id: string }>, res: Response) => {
    try {
      getChannel(req.params.id);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    try {
      const db = getDb();
      const from = typeof req.query.from === 'string' ? req.query.from : new Date(0).toISOString();
      const to = typeof req.query.to === 'string' ? req.query.to : '9999-12-31';

      const rows = db
        .prepare(
          `SELECT u.id, u.video_id, u.publish_at, u.status, u.platform,
                  j.template, j.source_ref, j.stage AS job_stage
           FROM upload u
           JOIN job j ON j.id = u.job_id
           WHERE u.channel_id = ? AND u.publish_at BETWEEN ? AND ?
           ORDER BY u.publish_at ASC`,
        )
        .all(req.params.id, from, to);

      // "Gercek planlanmis" ile "onaylaninca olacak" karistirilmasin diye scheduled
      // satirlari bugun icin DB'de kayitli, gercek upload satirlaridir - projeksiyon
      // degil. pendingReview ise henuz karar bekleyen, planlanMAmis islerdir - takvim
      // UI'i ikisini ayri bolumlerde gostersin diye ayri anahtarda doner.
      const pendingReview = db
        .prepare(
          `SELECT id, job_id, kind, preview_path, proposed_title, created_at
           FROM review_item
           WHERE channel_id = ? AND status = 'pending_review'
           ORDER BY created_at ASC`,
        )
        .all(req.params.id);

      res.json({ scheduled: rows, pendingReview });
    } catch (error) {
      Logger.error('Takvim okunamadi', error);
      res.status(500).json({ error: 'takvim okunamadi' });
    }
  });

  router.get('/batches/:id', (req: Request<{ id: string }>, res: Response) => {
    try {
      const db = getDb();

      // Duz GROUP BY status yeterli degil: 'processing' hem "hala render ediliyor"
      // hem "render bitti, onay bekliyor" durumunu kapsar (job.status kasitli olarak
      // 'processing' kalir, ayrim job.stage='awaiting_review' ile yapilir - bkz.
      // worker/runQueue.ts onJobSuccess). Bu yuzden status+stage kombinasyonuyla
      // bucket'lanir (EK5/KRITIS #2).
      const rows = db
        .prepare(
          `SELECT
             CASE
               WHEN status = 'pending' THEN 'pending'
               WHEN status = 'processing' AND stage = 'awaiting_review' THEN 'awaitingReview'
               WHEN status = 'processing' THEN 'processing'
               WHEN status = 'done' THEN 'done'
               WHEN status = 'failed' THEN 'failed'
               WHEN status = 'rejected' THEN 'rejected'
               WHEN status = 'needs_changes' THEN 'needsChanges'
               ELSE status
             END AS bucket,
             COUNT(*) AS count
           FROM job
           WHERE batch_id = ?
           GROUP BY bucket`,
        )
        .all(req.params.id) as Array<{ bucket: string; count: number }>;

      if (rows.length === 0) {
        res.status(404).json({ error: `batch bulunamadi: ${req.params.id}` });
        return;
      }

      const buckets: Record<string, number> = {
        pending: 0,
        processing: 0,
        awaitingReview: 0,
        done: 0,
        failed: 0,
        rejected: 0,
        needsChanges: 0,
      };
      let total = 0;
      for (const row of rows) {
        buckets[row.bucket] = row.count;
        total += row.count;
      }

      res.json({ batchId: req.params.id, total, ...buckets });
    } catch (error) {
      Logger.error('Batch ilerlemesi okunamadi', error);
      res.status(500).json({ error: 'batch ilerlemesi okunamadi' });
    }
  });

  return router;
}
