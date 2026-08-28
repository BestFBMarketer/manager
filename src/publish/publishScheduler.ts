// =====================================
// MODULE: Publish Scheduler
// Purpose: Bir isi bir sonraki bos prime-time slotuna atar, yukler ve DB'ye yazar
// Dependencies: core/db, core/logger, config/channels, publish/publishSlots, publish/uploader
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import type { ChannelConfig } from '../config/channels.js';
import { describeAcrossZones, nextPublishTimes } from './publishSlots.js';
import { uploadVideo, type UploadResult } from './uploader.js';

export interface ScheduleInput {
  jobId: number;
  channel: ChannelConfig;
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailPath?: string;
  /**
   * Belirli bir tarihe sabitlemek icin (orn. shorts_derivative: ebeveyn videonun
   * yayin tarihinden +N gun). Verilirse normal "bir sonraki bos slot" mantigi
   * atlanir, video dogrudan bu ana zamanlanir.
   */
  targetPublishAt?: Date;
}

/**
 * Bir sonraki bos prime-time slotunu bulur, videoyu yukler ve `upload`
 * tablosuna kaydeder.
 *
 * Ayni kanalda bugune kadar zaten kac is zamanlanmis oldugu DB'den sayilir;
 * yeni is bunlarin bir sonrasina duser. Boylece iki is ayni ana denk gelmez
 * ve kuyruk kendiliginden siralanir.
 *
 * @param input Is kimligi, kanal, dosya ve metadata
 * @returns Yuklenen videonun kimligi ve linkleri
 */
export async function scheduleAndUpload(input: ScheduleInput): Promise<UploadResult> {
  const db = getDb();

  let publishAt: Date;
  if (input.targetPublishAt) {
    publishAt = input.targetPublishAt;
    Logger.info(`Sabit tarihe zamanlanıyor: ${describeAcrossZones(publishAt)}`);
  } else {
    const alreadyScheduled = db
      .prepare(
        `SELECT COUNT(*) AS n FROM upload
         WHERE channel_id = ? AND status IN ('scheduled', 'published')
           AND publish_at >= datetime('now')`,
      )
      .get(input.channel.id) as { n: number };

    const upcoming = nextPublishTimes(
      input.channel.slots,
      alreadyScheduled.n + 1,
      new Date(),
      input.channel.scheduleRule,
    );
    const slot = upcoming[upcoming.length - 1];
    if (!slot) throw new Error(`${input.channel.id}: uygun yayin slotu bulunamadi`);
    publishAt = slot.publishAt;
    Logger.info(`Slot secildi (${alreadyScheduled.n} is zaten kuyrukta): ${slot.slot.label} -> ${describeAcrossZones(publishAt)}`);
  }

  const result = await uploadVideo({
    channel: input.channel,
    filePath: input.filePath,
    title: input.title,
    description: input.description,
    tags: input.tags,
    publishAt,
    thumbnailPath: input.thumbnailPath,
  });

  db.prepare(
    `INSERT INTO upload (job_id, channel_id, video_id, publish_at, status)
     VALUES (?, ?, ?, ?, 'scheduled')`,
  ).run(input.jobId, input.channel.id, result.videoId, publishAt.toISOString());

  db.prepare(
    `UPDATE job SET stage = 'published', status = 'done', updated_at = datetime('now') WHERE id = ?`,
  ).run(input.jobId);

  Logger.success(`Yayin planlandi: ${result.publicUrl} (${publishAt.toISOString()})`);
  return result;
}
