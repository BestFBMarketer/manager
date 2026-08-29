// =====================================
// MODULE: Funny Ranking Job Stage
// Purpose: Uzun referans videodan Top-5 viral an secip alaycı seslendirmeli countdown üretir
// Dependencies: ingest/downloader, story/transcribeSource, analysis/candidateFinder,
//               analysis/rankingPlanner, edit/ffmpegCut, edit/audioMix, tts, render
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import Database from 'better-sqlite3';
import { join } from 'node:path';
import type { ChannelConfig } from '../../config/channels.js';
import { Logger } from '../../core/logger.js';
import { downloadVideo } from '../../ingest/downloader.js';
import { probe } from '../../ingest/probe.js';
import { fetchTimedCaptions } from '../../story/transcribeSource.js';
import { findCandidates } from '../../analysis/candidateFinder.js';
import { planRanking } from '../../analysis/rankingPlanner.js';
import { cutAndFrame } from '../../edit/ffmpegCut.js';
import { synthesizeSpeech, defaultVoiceRef } from '../../tts/router.js';
import { mixAudio } from '../../edit/audioMix.js';
import { renderRemotion } from '../../render/renderRemotion.js';
import { generateThumbnail } from '../../render/thumbnail.js';
import type { RankingItemProps } from '../../../remotion/compositions/FunnyRanking.js';
import type { JobRow, StageResult } from './types.js';

interface FunnyRankingInput {
  videoTitle?: string;
}

const HOOK_DURATION_SEC = 2;
const OUTRO_DURATION_SEC = 2;

export async function runFunnyRankingJob(
  db: Database.Database,
  job: JobRow,
  channel: ChannelConfig,
): Promise<StageResult> {
  const jobId = job.id;
  const workDir = `data/work/${jobId}`;
  const sourceUrl = job.source_ref;
  const jobInput = JSON.parse(job.input_json || '{}') as FunnyRankingInput;
  const videoTitle = jobInput.videoTitle ?? sourceUrl;

  Logger.info(`[job ${jobId}] FunnyRanking başlıyor: ${channel.label} → ${sourceUrl}`);

  try {
    // 1. Kaynak videoyu indir
    Logger.debug(`[job ${jobId}] Kaynak video indiriliyor`);
    const downloadedPath = join(workDir, `source_${jobId}.mp4`);
    await downloadVideo(sourceUrl, downloadedPath);
    db.prepare('UPDATE job SET stage=? WHERE id=?').run('source_downloaded', jobId);

    const sourceInfo = await probe(downloadedPath);

    // 2. Zaman damgalı altyazı - aday pencereler bundan çıkarılır
    Logger.debug(`[job ${jobId}] Altyazı aranıyor`);
    const cues = await fetchTimedCaptions(sourceUrl, channel.language);

    // 3. Aday pencereler
    const scoredCandidates = findCandidates(cues, sourceInfo.durationSec);
    if (scoredCandidates.length < 5) {
      throw new Error(
        `Yeterli aday bulunamadı (${scoredCandidates.length}/5) - video altyazısız/çok kısa olabilir, ranking üretilemez`,
      );
    }
    db.prepare('UPDATE job SET stage=? WHERE id=?').run('candidates_found', jobId);

    // 4. Top-5 ranking planı
    Logger.debug(`[job ${jobId}] Ranking planlanıyor`);
    const plan = await planRanking(
      scoredCandidates.map((c) => c.candidate),
      videoTitle,
      channel.language,
    );
    db.prepare('UPDATE job SET stage=? WHERE id=?').run('ranking_planned', jobId);

    // 5. Her sıra için: mutlak zamana çevir, kes, seslendir, karış
    const items: RankingItemProps[] = [];
    for (const item of plan.items) {
      const scored = scoredCandidates.find((c) => c.candidate.clipId === item.clipId);
      if (!scored) {
        Logger.warn(`[job ${jobId}] clipId eşleşmedi, sıra atlanıyor: ${item.clipId}`);
        continue;
      }

      const absoluteStart = scored.absoluteStartSec + item.startSec;
      const absoluteEnd = scored.absoluteStartSec + item.endSec;

      const itemClipPath = join(workDir, `rank${item.rank}_${jobId}.mp4`);
      await cutAndFrame({
        inputPath: downloadedPath,
        outputPath: itemClipPath,
        startSec: absoluteStart,
        endSec: absoluteEnd,
        orientation: 'vertical',
        framing: 'crop',
        normalizeAudio: true,
        stripWatermarks: true,
      });

      const itemInfo = await probe(itemClipPath);

      const voicePath = join(workDir, `voice_rank${item.rank}_${jobId}.wav`);
      await synthesizeSpeech({ text: item.voiceLine, voiceRef: defaultVoiceRef(), outputPath: voicePath });

      const mixedItemPath = join(workDir, `mixed_rank${item.rank}_${jobId}.mp4`);
      await mixAudio({
        videoPath: itemClipPath,
        voicePath,
        outputPath: mixedItemPath,
        videoDurationSec: itemInfo.durationSec,
        keepOriginalAudio: true,
      });

      // renderRemotion goreli video yolunu kendi yerel HTTP sunucusu uzerinden servis eder.
      items.push({ rank: item.rank, videoSrc: mixedItemPath, voiceLine: item.voiceLine, durationSec: itemInfo.durationSec });
    }

    if (items.length < 5) {
      throw new Error(`Sadece ${items.length}/5 sıra tamamlanabildi - ranking eksik kalır, iş başarısız sayılır`);
    }

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('items_ready', jobId);

    // 6. Remotion render
    Logger.debug(`[job ${jobId}] Remotion render başlıyor`);
    const outputPath = join(workDir, `render_${jobId}.mp4`);
    const renderResult = await renderRemotion(
      'FunnyRanking',
      {
        hookLine: plan.hookLine,
        items,
        outroLine: plan.outroLine,
        channelHandle: channel.label,
        hookDurationSec: HOOK_DURATION_SEC,
        outroDurationSec: OUTRO_DURATION_SEC,
      },
      outputPath,
      jobId,
    );

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('rendered', jobId);

    db.prepare(
      `INSERT INTO render (job_id, composition, output_path, status, duration_ms)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(jobId, 'FunnyRanking', renderResult.outputPath, 'done', renderResult.durationMs);

    Logger.success(`[job ${jobId}] FunnyRanking tamamlandı: "${plan.title}"`);

    const totalDurationSec =
      HOOK_DURATION_SEC + items.reduce((sum, i) => sum + i.durationSec, 0) + OUTRO_DURATION_SEC;

    let thumbnailPath: string | undefined;
    try {
      thumbnailPath = await generateThumbnail(
        renderResult.outputPath,
        totalDurationSec,
        plan.hookLine,
        join(workDir, `thumbnail_${jobId}.jpg`),
      );
    } catch {
      Logger.warn(`[job ${jobId}] Thumbnail üretilemedi`);
    }

    return {
      previewPath: renderResult.outputPath,
      thumbnailPath,
      proposedTitle: plan.title,
      proposedDescription: plan.description,
      proposedTags: plan.tags,
      metadataContext: {
        subject: plan.title,
        highlights: items.map((i) => i.voiceLine),
        durationSec: totalDurationSec,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    Logger.error(`[job ${jobId}] FunnyRanking başarısız`, error);
    throw new Error(`FunnyRanking render başarısız: ${errorMsg}`);
  }
}
