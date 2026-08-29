// =====================================
// MODULE: Shorts Derivative Job Stage
// Purpose: Uzun videodan kesilmiş, hook'lu bir Shorts üretir (repurpose.ts'in planladığı kesit)
// Dependencies: edit/ffmpegCut, render, analysis/channelWriter, tts
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import Database from 'better-sqlite3';
import { join } from 'node:path';
import type { ChannelConfig } from '../../config/channels.js';
import { Logger } from '../../core/logger.js';
import { cutAndFrame } from '../../edit/ffmpegCut.js';
import { probe } from '../../ingest/probe.js';
import { writeVideoMetadata } from '../../analysis/channelWriter.js';
import { renderRemotion } from '../../render/renderRemotion.js';
import { generateThumbnail } from '../../render/thumbnail.js';
import type { JobRow, StageResult } from './types.js';

interface ShortsDerivativeInput {
  parentVideoPath: string;
  startSec: number;
  endSec: number;
  hook: string;
  derivativeTitle: string;
  longVideoUrl?: string;
}

export async function runShortsDerivativeJob(
  db: Database.Database,
  job: JobRow,
  channel: ChannelConfig,
): Promise<StageResult> {
  const jobId = job.id;
  const workDir = `data/work/${jobId}`;
  const input = JSON.parse(job.input_json || '{}') as ShortsDerivativeInput;

  if (!input.parentVideoPath || input.startSec === undefined || input.endSec === undefined) {
    throw new Error('ShortsDerivative job.input_json eksik alan içeriyor (parentVideoPath/startSec/endSec)');
  }

  Logger.info(`[job ${jobId}] ShortsDerivative başlıyor: ${input.startSec}s-${input.endSec}s (${channel.label})`);

  try {
    // 1. Kesit al, dikeye çevir
    Logger.debug(`[job ${jobId}] Kesit alınıyor ve dikeye çevriliyor`);
    const clipPath = join(workDir, `clip_${jobId}.mp4`);
    await cutAndFrame({
      inputPath: input.parentVideoPath,
      outputPath: clipPath,
      startSec: input.startSec,
      endSec: input.endSec,
      orientation: 'vertical',
      framing: 'crop',
      normalizeAudio: true,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('clip_cut', jobId);

    const info = await probe(clipPath);

    // 2. Metadata
    Logger.debug(`[job ${jobId}] Metadata oluşturuluyor`);
    const metadataContext = {
      subject: input.derivativeTitle,
      highlights: [input.hook],
      durationSec: info.durationSec,
    };
    const metadata = await writeVideoMetadata(channel, metadataContext);

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('metadata_generated', jobId);

    // 3. Remotion render - hook + kesit + CTA
    Logger.debug(`[job ${jobId}] Remotion render başlıyor`);
    const outputPath = join(workDir, `render_${jobId}.mp4`);
    const renderResult = await renderRemotion(
      'ShortsDerivative',
      {
        // renderRemotion goreli video yolunu kendi yerel HTTP sunucusu uzerinden servis eder.
        videoSrc: clipPath,
        durationSec: info.durationSec,
        hookText: input.hook,
        hookDurationSec: Math.min(2.5, info.durationSec * 0.15),
        channelHandle: channel.label,
        ctaText: input.longVideoUrl ? 'Tamamı kanalda' : undefined,
      },
      outputPath,
      jobId,
    );

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('rendered', jobId);

    db.prepare(
      `INSERT INTO render (job_id, composition, output_path, status, duration_ms)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(jobId, 'ShortsDerivative', renderResult.outputPath, 'done', renderResult.durationMs);

    Logger.success(`[job ${jobId}] ShortsDerivative tamamlandı (${(renderResult.durationMs / 1000).toFixed(1)}s)`);

    let thumbnailPath: string | undefined;
    try {
      thumbnailPath = await generateThumbnail(renderResult.outputPath, info.durationSec, metadata.thumbnailText, join(workDir, `thumbnail_${jobId}.jpg`));
    } catch {
      Logger.warn(`[job ${jobId}] Thumbnail üretilemedi`);
    }

    const description = input.longVideoUrl
      ? `${metadata.description}\n\nBu videonun devamı: ${input.longVideoUrl}`
      : metadata.description;

    return {
      previewPath: renderResult.outputPath,
      thumbnailPath,
      proposedTitle: metadata.title,
      proposedDescription: description,
      proposedTags: metadata.tags,
      metadataContext,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    Logger.error(`[job ${jobId}] ShortsDerivative başarısız`, error);
    throw new Error(`ShortsDerivative render başarısız: ${errorMsg}`);
  }
}
