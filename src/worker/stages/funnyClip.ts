// =====================================
// MODULE: Funny Clip Job Stage
// Purpose: Referans kanaldan (fasıl/army vb.) klip kes, iğneleyici yorum ekle, yayına hazırla
// Dependencies: ingest/downloader, story/transcribeSource, analysis/highlightPicker,
//               edit/ffmpegCut, edit/audioMix, tts, render
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
import { planFunnyClip } from '../../analysis/highlightPicker.js';
import { cutAndFrame } from '../../edit/ffmpegCut.js';
import { synthesizeSpeech, defaultVoiceRef } from '../../tts/router.js';
import { mixAudio } from '../../edit/audioMix.js';
import { renderRemotion } from '../../render/renderRemotion.js';
import { generateThumbnail } from '../../render/thumbnail.js';
import type { JobRow, StageResult } from './types.js';

interface FunnyClipInput {
  videoTitle?: string;
}

export async function runFunnyClipJob(
  db: Database.Database,
  job: JobRow,
  channel: ChannelConfig,
): Promise<StageResult> {
  const jobId = job.id;
  const workDir = `data/work/${jobId}`;
  const sourceUrl = job.source_ref;
  const jobInput = JSON.parse(job.input_json || '{}') as FunnyClipInput;
  const videoTitle = jobInput.videoTitle ?? sourceUrl;

  Logger.info(`[job ${jobId}] FunnyClip başlıyor: ${channel.label} → ${sourceUrl}`);

  try {
    // 1. Kaynak videoyu indir - bu sablon her zaman baska bir kanaldan besleniyor,
    // yerel dosya kabul etmez (HotelTour'un aksine).
    Logger.debug(`[job ${jobId}] Kaynak video indiriliyor`);
    const downloadedPath = join(workDir, `source_${jobId}.mp4`);
    await downloadVideo(sourceUrl, downloadedPath);

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('source_downloaded', jobId);

    const sourceInfo = await probe(downloadedPath);

    // 2. Zaman damgalı altyazı (varsa) - fasıl/parti içeriğinde konuşma az olabilir,
    // bu durumda highlightPicker.ts kaba bir fallback'e düşer.
    Logger.debug(`[job ${jobId}] Altyazı aranıyor`);
    const cues = await fetchTimedCaptions(sourceUrl, channel.language);
    db.prepare('UPDATE job SET stage=? WHERE id=?').run(cues ? 'captions_found' : 'captions_missing', jobId);

    // 3. Kesit seçimi + iğneleyici yorum metni (tek LLM çağrısında)
    Logger.debug(`[job ${jobId}] Kesit planlanıyor`);
    const plan = await planFunnyClip(channel, videoTitle, sourceInfo.durationSec, cues);
    db.prepare('UPDATE job SET stage=? WHERE id=?').run('clip_planned', jobId);

    // 4. Kes + dikeye çevir
    Logger.debug(`[job ${jobId}] Kesit alınıyor (${plan.startSec.toFixed(0)}s-${plan.endSec.toFixed(0)}s)`);
    const clipPath = join(workDir, `clip_${jobId}.mp4`);
    await cutAndFrame({
      inputPath: downloadedPath,
      outputPath: clipPath,
      startSec: plan.startSec,
      endSec: plan.endSec,
      orientation: 'vertical',
      framing: 'crop',
      normalizeAudio: true,
      stripWatermarks: true,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('clip_cut', jobId);
    const clipInfo = await probe(clipPath);

    // 5. Yorum seslendirmesi
    Logger.debug(`[job ${jobId}] Yorum seslendiriliyor`);
    const voicePath = join(workDir, `voice_${jobId}.wav`);
    await synthesizeSpeech({ text: plan.commentaryScript, voiceRef: defaultVoiceRef(), outputPath: voicePath });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('voice_synthesized', jobId);

    // 6. Miksaj - orijinal klip sesi (müzik/kalabalık) yorumun altında kısılır,
    // sessizleştirilmez (keepOriginalAudio) - "kendi kesim, üstüne voice over" tam olarak bu.
    Logger.debug(`[job ${jobId}] Ses karışılıyor`);
    const mixedPath = join(workDir, `mixed_${jobId}.mp4`);
    await mixAudio({
      videoPath: clipPath,
      voicePath,
      outputPath: mixedPath,
      videoDurationSec: clipInfo.durationSec,
      keepOriginalAudio: true,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('audio_mixed', jobId);

    // 7. Remotion render
    Logger.debug(`[job ${jobId}] Remotion render başlıyor`);
    const outputPath = join(workDir, `render_${jobId}.mp4`);
    const renderResult = await renderRemotion(
      'FunnyClip',
      {
        // renderRemotion goreli video yolunu kendi yerel HTTP sunucusu uzerinden servis eder.
        videoSrc: mixedPath,
        durationSec: clipInfo.durationSec,
        hookText: plan.hookText,
        hookDurationSec: Math.min(2.5, clipInfo.durationSec * 0.15),
        commentaryScript: plan.commentaryScript,
        channelHandle: channel.label,
      },
      outputPath,
      jobId,
    );

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('rendered', jobId);

    db.prepare(
      `INSERT INTO render (job_id, composition, output_path, status, duration_ms)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(jobId, 'FunnyClip', renderResult.outputPath, 'done', renderResult.durationMs);

    Logger.success(`[job ${jobId}] FunnyClip tamamlandı: "${plan.title}"`);

    // 8. Thumbnail - hookText kısa/vurucu olduğu için doğrudan overlay metni olarak kullanılır,
    // ayrı bir LLM çağrısı gerekmez.
    let thumbnailPath: string | undefined;
    try {
      thumbnailPath = await generateThumbnail(
        renderResult.outputPath,
        clipInfo.durationSec,
        plan.hookText,
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
        highlights: [plan.hookText],
        durationSec: clipInfo.durationSec,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    Logger.error(`[job ${jobId}] FunnyClip başarısız`, error);
    throw new Error(`FunnyClip render başarısız: ${errorMsg}`);
  }
}
