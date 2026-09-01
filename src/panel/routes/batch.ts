// =====================================
// MODULE: Panel Batch Router
// Purpose: Stok uretim - N is satirini batch_id ile aninda ekler, worker'i beklemez
// Dependencies: express, core/db, core/logger, config/channels
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { getDb } from '../../core/db.js';
import { Logger } from '../../core/logger.js';
import { getChannel } from '../../config/channels.js';
import { discoverNextTopics } from '../../story/topicDiscovery.js';
import { generateStoryTopics } from '../../story/premiseInventor.js';

/** Gercek Remotion kompozisyon id'leri (remotion/Root.tsx) - hatali sablon adiyla is acilmasin. */
const VALID_TEMPLATES = new Set(['FunnyClip', 'FunnyRanking', 'HotelTourLandscape', 'HotelTourVertical', 'StoryNarrative']);

interface BatchItem {
  sourceRef: string;
  hotelName?: string;
  hotelCity?: string;
  /** discoverNextTopics'ten geliyorsa - transkriptsiz kaldığında (fasıl/parti içeriği) tek içerik ipucu */
  videoTitle?: string;
  /**
   * StoryNarrative icin: 'invented' ise sourceRef bir video URL'i degil,
   * premiseInventor.ts'e giden konu metnidir (topic_source='ai_generated').
   * Belirtilmezse 'reference' varsayilir (mevcut davranis, geriye donuk uyumlu).
   */
  mode?: 'reference' | 'invented';
}

export function batchRouter(): Router {
  const router = Router();

  router.post('/channels/:id/batch', async (req: Request<{ id: string }>, res: Response) => {
    let channel;
    try {
      channel = getChannel(req.params.id);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${req.params.id}` });
      return;
    }

    if (!VALID_TEMPLATES.has(channel.defaultTemplate)) {
      res.status(400).json({
        error: `kanalin default_template degeri gecersiz: '${channel.defaultTemplate}' (beklenen: ${[...VALID_TEMPLATES].join(', ')})`,
      });
      return;
    }

    const count = Number(req.body?.count);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      res.status(400).json({ error: 'count 1-50 arasi tam sayi olmali' });
      return;
    }

    let items = req.body?.items as BatchItem[] | undefined;

    // items verilmemisse topicDiscovery referans kataloglarindan secim yapar -
    // bu hikaye kanallarina ozel bir sey degil, "referans kanaldan kaynak bul"
    // her kanal turune uygulanabilir (FunnyClip de fasıl/army gibi referans
    // kanallardan besleniyor). topic_source='ai_generated' henuz kapsanmiyor -
    // referans kanal olmadan LLM'in kendi konu listesini urettigi ayri bir yol.
    if (!items) {
      if (channel.topicSource === 'ai_generated') {
        try {
          const db = getDb();
          const alreadyUsed = (
            db.prepare('SELECT source_ref FROM job WHERE channel_id = ?').all(channel.id) as Array<{ source_ref: string }>
          ).map((r) => r.source_ref);

          const topics = await generateStoryTopics(channel, count, alreadyUsed);
          if (topics.length < count) {
            res.status(409).json({
              error: `sadece ${topics.length}/${count} yeni kurgu/konu üretilebildi - tekrar deneyin`,
            });
            return;
          }
          items = topics.map((t) => ({ sourceRef: t.topic, videoTitle: t.videoTitle, mode: 'invented' as const }));
        } catch (error) {
          Logger.error('Otomatik konu üretimi başarısız', error);
          res.status(400).json({ error: error instanceof Error ? error.message : 'konu üretimi başarısız' });
          return;
        }
      } else {
        try {
          const topics = await discoverNextTopics(channel, count);
          if (topics.length < count) {
            res.status(409).json({
              error: `sadece ${topics.length}/${count} yeni konu bulundu (referans kanal kataloğu tükendi veya hepsi zaten uyarlanmış)`,
            });
            return;
          }
          items = topics.map((t) => ({ sourceRef: t.sourceRef, videoTitle: t.videoTitle }));
        } catch (error) {
          Logger.error('Otomatik konu keşfi başarısız', error);
          res.status(400).json({ error: error instanceof Error ? error.message : 'konu keşfi başarısız' });
          return;
        }
      }
    }

    if (!Array.isArray(items) || items.length !== count || !items.every((i) => typeof i?.sourceRef === 'string' && i.sourceRef.trim())) {
      res.status(400).json({ error: `items, count (${count}) kadar {sourceRef} nesnesi icermeli` });
      return;
    }

    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.sourceRef)) {
        res.status(400).json({ error: `batch icinde tekrarlanan sourceRef: ${item.sourceRef}` });
        return;
      }
      seen.add(item.sourceRef);
    }

    try {
      const db = getDb();
      const batchId = randomUUID();

      const insertJob = db.prepare(
        `INSERT INTO job (channel_id, template, source_ref, target_dur_sec, status, batch_id, input_json)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      );

      const jobIds: number[] = [];
      const insertAll = db.transaction((rows: BatchItem[]) => {
        for (const row of rows) {
          const inputJson = JSON.stringify({
            hotelName: row.hotelName,
            hotelCity: row.hotelCity,
            videoTitle: row.videoTitle,
            mode: row.mode,
          });
          const result = insertJob.run(
            channel.id,
            channel.defaultTemplate,
            row.sourceRef,
            channel.targetDurationSec,
            batchId,
            inputJson,
          );
          jobIds.push(Number(result.lastInsertRowid));
        }
      });
      insertAll(items);

      Logger.success(`Batch olusturuldu: ${batchId} (${channel.id}, ${items.length} is)`);
      res.status(201).json({ batchId, jobIds });
    } catch (error) {
      Logger.error('Batch olusturulamadi', error);
      res.status(500).json({ error: 'batch olusturulamadi' });
    }
  });

  return router;
}
