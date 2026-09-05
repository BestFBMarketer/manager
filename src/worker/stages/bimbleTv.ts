// =====================================
// MODULE: Bimble TV Job Stage
// Purpose: Konu brief'i -> duygu-etiketli senaryo -> beat basina TTS -> render -> mix
// Dependencies: story/bimbleScriptWriter, tts, edit/audioMix, render, analysis/channelWriter
// Author: BestMarketer Team
// Last Modified: 2026-09-04
// =====================================

import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ChannelConfig } from '../../config/channels.js';
import { Logger } from '../../core/logger.js';
import { run } from '../../core/exec.js';
import { TIMEOUTS } from '../../config/constants.js';
import { writeBimbleScript, type BimbleTopicBrief } from '../../story/bimbleScriptWriter.js';
import { synthesizeSpeech, resolveChannelVoice } from '../../tts/router.js';
import { mixAudio } from '../../edit/audioMix.js';
import { writeVideoMetadata } from '../../analysis/channelWriter.js';
import { renderRemotion } from '../../render/renderRemotion.js';
import { generateThumbnail } from '../../render/thumbnail.js';
import type { BimbleBeat } from '../../../remotion/compositions/BimbleTV.js';
import type { JobRow, StageResult } from './types.js';

const TITLE_DURATION_SEC = 3;
const CHORUS_DURATION_SEC = 8;
/** Kanal sabit tema sarkisi - bkz DEVAM_NOTU.md, ACE-Step ile uretildi. Ileride konuya ozel sarkilar eklenebilir. */
const THEME_SONG_PATH = resolve('data/music/bimble/theme_song.wav');

/** Job.input_json bos gelirse (ornek/test job) kullanilacak varsayilan konu - 30-gunluk planin #14'u. */
const DEFAULT_BRIEF: BimbleTopicBrief = {
  topic: 'Sinirlenme (istek reddi)',
  suggestedTitle: '3 Breaths Changed Everything',
  premise:
    'Bimble sees a big red dinosaur toy at the store and wants it badly. Mom says not today - ' +
    'they only came for milk and bread. Bimble asks three times, bargains, and finally learns the ' +
    'real reason (already has a similar toy at home, saving for an upcoming birthday). The big ' +
    'feeling grows into a storm, then Bimble takes three big breaths and asks for a hug instead. ' +
    "Bimble doesn't get the toy but feels proud of getting through the big feeling.",
};

async function concatenateNarration(voicePaths: string[], workDir: string): Promise<string> {
  const silencePath = join(workDir, 'silence_title.wav');
  await run(
    'ffmpeg',
    ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(TITLE_DURATION_SEC), silencePath],
    TIMEOUTS.FFMPEG_MS,
  );

  const allPaths = [silencePath, ...voicePaths];
  const outputPath = join(workDir, 'narration_full.wav');

  const inputArgs = allPaths.flatMap((p) => ['-i', resolve(p)]);
  const filterInputs = allPaths.map((_, i) => `[${i}:a]`).join('');
  const filterComplex = `${filterInputs}concat=n=${allPaths.length}:v=0:a=1[out]`;

  await run(
    'ffmpeg',
    ['-y', ...inputArgs, '-filter_complex', filterComplex, '-map', '[out]', outputPath],
    TIMEOUTS.FFMPEG_MS,
  );

  return outputPath;
}

export async function runBimbleTvJob(db: Database.Database, job: JobRow, channel: ChannelConfig): Promise<StageResult> {
  const jobId = job.id;
  const workDir = `data/work/${jobId}`;
  const brief = (JSON.parse(job.input_json || '{}') as Partial<BimbleTopicBrief>).premise
    ? (JSON.parse(job.input_json) as BimbleTopicBrief)
    : DEFAULT_BRIEF;

  Logger.info(`[job ${jobId}] BimbleTV başlıyor: ${channel.label} → ${brief.topic}`);
  await mkdir(workDir, { recursive: true });

  try {
    // 1. Senaryo - duygu-etiketli beat'ler + nakarat
    Logger.debug(`[job ${jobId}] Senaryo yazılıyor`);
    const script = await writeBimbleScript(channel, brief);
    db.prepare('UPDATE job SET stage=? WHERE id=?').run('script_written', jobId);

    // 2. Beat başına seslendirme
    Logger.debug(`[job ${jobId}] Beat'ler seslendiriliyor`);
    const voice = resolveChannelVoice(channel);
    const voicePaths: string[] = [];
    const renderBeats: BimbleBeat[] = [];

    for (let i = 0; i < script.beats.length; i += 1) {
      const beat = script.beats[i]!;
      const voicePath = join(workDir, `beat_voice_${i}.wav`);
      const voiceResult = await synthesizeSpeech(
        { text: beat.text, voiceRef: voice.voiceRef, outputPath: voicePath, language: channel.language },
        voice.provider,
      );
      voicePaths.push(voicePath);
      renderBeats.push({ emotion: beat.emotion, text: beat.text, durationSec: voiceResult.durationSec, sfx: beat.sfx });
    }

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('beats_ready', jobId);

    // 3. Seslendirmeleri birleştir (nakarat bölümü kasıtlı sessiz - şarkı orada öne çıksın)
    Logger.debug(`[job ${jobId}] Seslendirme birleştiriliyor`);
    const narrationPath = await concatenateNarration(voicePaths, workDir);
    const beatsDurationSec = renderBeats.reduce((sum, b) => sum + b.durationSec, 0);
    const totalDurationSec = TITLE_DURATION_SEC + beatsDurationSec + CHORUS_DURATION_SEC;

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('narration_concatenated', jobId);

    // 4. Remotion render (görsel + tek-seferlik SFX ipuçları - müzik/anlatım burada yok)
    Logger.debug(`[job ${jobId}] Remotion render başlıyor`);
    const silentOutputPath = join(workDir, `render_silent_${jobId}.mp4`);
    const renderResult = await renderRemotion(
      'BimbleTV',
      {
        title: script.title,
        beats: renderBeats,
        channelHandle: channel.label,
        titleDurationSec: TITLE_DURATION_SEC,
        chorus: script.chorus,
        chorusDurationSec: CHORUS_DURATION_SEC,
      },
      silentOutputPath,
      jobId,
    );

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('rendered', jobId);

    // 5. Ses miksajı - anlatım + tema şarkısı + Remotion'ın kendi SFX'i (keepOriginalAudio)
    Logger.debug(`[job ${jobId}] Ses katmanları karışılıyor`);
    const finalOutputPath = join(workDir, `final_${jobId}.mp4`);
    await mixAudio({
      videoPath: renderResult.outputPath,
      musicPath: THEME_SONG_PATH,
      voicePath: narrationPath,
      outputPath: finalOutputPath,
      videoDurationSec: totalDurationSec,
      keepOriginalAudio: true,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('audio_mixed', jobId);

    // 6. Metadata
    Logger.debug(`[job ${jobId}] Metadata oluşturuluyor`);
    const metadataContext = {
      subject: script.title,
      highlights: renderBeats.map((b) => b.text),
      durationSec: totalDurationSec,
    };
    const metadata = await writeVideoMetadata(channel, metadataContext);

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('metadata_generated', jobId);

    db.prepare(
      `INSERT INTO render (job_id, composition, output_path, status, duration_ms)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(jobId, 'BimbleTV', finalOutputPath, 'done', renderResult.durationMs);

    Logger.success(`[job ${jobId}] BimbleTV tamamlandı: "${script.title}"`);

    let thumbnailPath: string | undefined;
    try {
      thumbnailPath = await generateThumbnail(finalOutputPath, totalDurationSec, metadata.thumbnailText, join(workDir, `thumbnail_${jobId}.jpg`));
    } catch {
      Logger.warn(`[job ${jobId}] Thumbnail üretilemedi, video kapak resmi olmadan onaya düşecek`);
    }

    return {
      previewPath: finalOutputPath,
      thumbnailPath,
      proposedTitle: metadata.title,
      proposedDescription: metadata.description,
      proposedTags: metadata.tags,
      metadataContext,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    Logger.error(`[job ${jobId}] BimbleTV başarısız`, error);
    throw new Error(`BimbleTV render başarısız: ${errorMsg}`);
  }
}
