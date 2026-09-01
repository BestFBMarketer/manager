// =====================================
// MODULE: Story Narrative Job Stage
// Purpose: Referans video → transkript → olgu özeti → yeni senaryo → sahne bazlı render
// Dependencies: story/*, tts, music, edit/audioMix, render, analysis/channelWriter
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ChannelConfig } from '../../config/channels.js';
import { Logger } from '../../core/logger.js';
import { run } from '../../core/exec.js';
import { TIMEOUTS } from '../../config/constants.js';
import { transcribeSource } from '../../story/transcribeSource.js';
import { extractFactBrief, type FactBrief } from '../../story/factBrief.js';
import { inventFactBrief } from '../../story/premiseInventor.js';
import { writeNarrativeScript, type NarrativeScene } from '../../story/scriptWriter.js';
import { sourceVisualForScene } from '../../story/visualSourcing.js';
import { synthesizeSpeech, resolveChannelVoice } from '../../tts/router.js';
import { selectTracksForSegments } from '../../music/selector.js';
import { loadMusicLibrary } from '../../music/library.js';
import { mixAudio, type MusicPlacement } from '../../edit/audioMix.js';
import { writeVideoMetadata } from '../../analysis/channelWriter.js';
import { renderRemotion } from '../../render/renderRemotion.js';
import { generateThumbnail } from '../../render/thumbnail.js';
import type { MusicSegment, SegmentEnergy } from '../../music/segmentPlanner.js';
import type { Mood } from '../../music/types.js';
import type { StoryScene } from '../../../remotion/compositions/StoryNarrative.js';
import type { JobRow, StageResult } from './types.js';

const TITLE_DURATION_SEC = 3;

interface StoryNarrativeInput {
  /** 'invented' ise source_ref bir video URL'i degil, premiseInventor.ts'e verilecek konu metnidir (topic_source='ai_generated') */
  mode?: 'reference' | 'invented';
}

const MOOD_ENERGY: Record<NarrativeScene['mood'], SegmentEnergy> = {
  tension: 'high',
  neutral: 'medium',
  resolution: 'low',
};

const MOOD_MUSIC_MOODS: Record<NarrativeScene['mood'], Mood[]> = {
  tension: ['energetic', 'epic'],
  neutral: ['cinematic', 'dreamy'],
  resolution: ['uplifting', 'chill'],
};

/** Sahnelerin TTS'ten ölçülen gerçek sürelerinden müzik segmentlerini çıkarır (GPS yok, senaryonun kendi temposu esas). */
function buildMusicSegments(scenes: Array<{ mood: NarrativeScene['mood']; durationSec: number }>): MusicSegment[] {
  let cursor = TITLE_DURATION_SEC;
  return scenes.map((scene) => {
    const segment: MusicSegment = {
      startSec: cursor,
      endSec: cursor + scene.durationSec,
      energy: MOOD_ENERGY[scene.mood],
      avgSpeedMps: 0,
      avgAltM: 0,
      suggestedMoods: MOOD_MUSIC_MOODS[scene.mood],
    };
    cursor += scene.durationSec;
    return segment;
  });
}

/** Baştaki sessiz başlık aralığı + sahne seslendirmelerini tek bir sürekli parça halinde birleştirir. */
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

export async function runStoryNarrativeJob(
  db: Database.Database,
  job: JobRow,
  channel: ChannelConfig,
): Promise<StageResult> {
  const jobId = job.id;
  const workDir = `data/work/${jobId}`;
  // invented modda source_ref bir URL degil, premiseInventor.ts'e giden konu metnidir.
  const sourceRef = job.source_ref;
  const jobInput = JSON.parse(job.input_json || '{}') as StoryNarrativeInput;
  const mode = jobInput.mode ?? 'reference';

  Logger.info(`[job ${jobId}] StoryNarrative başlıyor: ${channel.label} → ${sourceRef} (${mode})`);
  await mkdir(workDir, { recursive: true });

  try {
    // 1-2. Olgu özeti - referans videodan (transkript -> özet) veya konu
    // basliginden dogrudan uydurma/ozetleme (premiseInventor). Her iki yolda
    // da writeNarrativeScript SADECE brief'i gorur, kaynagin kendisini degil.
    let brief: FactBrief;
    if (mode === 'invented') {
      Logger.debug(`[job ${jobId}] Konu özeti üretiliyor (referans video yok)`);
      brief = await inventFactBrief(channel, sourceRef);
      db.prepare('UPDATE job SET stage=? WHERE id=?').run('fact_brief_ready', jobId);
    } else {
      Logger.debug(`[job ${jobId}] Transkript çekiliyor`);
      const transcript = await transcribeSource(sourceRef, channel.language);
      db.prepare('UPDATE job SET stage=? WHERE id=?').run('transcribed', jobId);

      Logger.debug(`[job ${jobId}] Olgu özeti çıkarılıyor`);
      brief = await extractFactBrief(transcript, channel.language);
      db.prepare('UPDATE job SET stage=? WHERE id=?').run('fact_brief_ready', jobId);
    }

    // 3. Yeni senaryo - SADECE brief'ten, transkripti hiç görmez (tip seviyesinde zorlanan kısıt)
    Logger.debug(`[job ${jobId}] Senaryo yazılıyor`);
    const script = await writeNarrativeScript(channel, brief);
    db.prepare('UPDATE job SET stage=? WHERE id=?').run('script_written', jobId);

    // 4. Sahne başına seslendirme + görsel kaynaklama
    Logger.debug(`[job ${jobId}] Sahneler seslendiriliyor ve görsel kaynaklanıyor`);
    const sceneResults: Array<{ mood: NarrativeScene['mood']; durationSec: number; scene: StoryScene }> = [];
    const voicePaths: string[] = [];
    const voice = resolveChannelVoice(channel);

    for (let i = 0; i < script.scenes.length; i += 1) {
      const scene = script.scenes[i]!;
      const voicePath = join(workDir, `scene_voice_${i}.wav`);
      const voiceResult = await synthesizeSpeech(
        { text: scene.text, voiceRef: voice.voiceRef, outputPath: voicePath, language: channel.language },
        voice.provider,
      );
      voicePaths.push(voicePath);

      const visual = await sourceVisualForScene(scene.sceneKeyword, join(workDir, 'visuals'), i);

      sceneResults.push({
        mood: scene.mood,
        durationSec: voiceResult.durationSec,
        scene: {
          // renderRemotion goreli gorsel yolunu kendi yerel HTTP sunucusu uzerinden servis eder.
          visualSrc: visual.localPath,
          visualKind: visual.kind,
          text: scene.text,
          durationSec: voiceResult.durationSec,
          attribution: visual.attribution,
        },
      });
    }

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('scenes_ready', jobId);

    // 5. Müzik segmentleri (senaryonun kendi temposundan - GPS yok)
    Logger.debug(`[job ${jobId}] Müzik segmentleri planlanıyor`);
    const musicSegments = buildMusicSegments(sceneResults);
    const musicLibrary = await loadMusicLibrary();
    const selectedTracks = selectTracksForSegments(musicLibrary, musicSegments, {
      theme: channel.niche ?? 'hikaye',
      hourOfDay: new Date().getHours(),
    });
    const musicPlacements: MusicPlacement[] = selectedTracks.map((entry) => ({
      trackPath: entry.track.filePath,
      startSec: entry.startSec,
      endSec: entry.endSec,
    }));

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('music_selected', jobId);

    // 6. Seslendirmeleri tek parçada birleştir
    Logger.debug(`[job ${jobId}] Seslendirme birleştiriliyor`);
    const narrationPath = await concatenateNarration(voicePaths, workDir);
    const totalDurationSec = TITLE_DURATION_SEC + sceneResults.reduce((sum, s) => sum + s.durationSec, 0);

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('narration_concatenated', jobId);

    // 7. Remotion render (görsel-only, ses yok - sahneler kendi video/görsel kaynağını sessiz oynatır)
    Logger.debug(`[job ${jobId}] Remotion render başlıyor`);
    const silentOutputPath = join(workDir, `render_silent_${jobId}.mp4`);
    const renderResult = await renderRemotion(
      'StoryNarrative',
      {
        title: script.title,
        scenes: sceneResults.map((s) => s.scene),
        channelHandle: channel.label,
        titleDurationSec: TITLE_DURATION_SEC,
      },
      silentOutputPath,
      jobId,
    );

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('rendered', jobId);

    // 8. Ses miksajı - render edilmiş sessiz videonun üstüne anlatım + müzik biner
    Logger.debug(`[job ${jobId}] Ses katmanları karışılıyor`);
    const finalOutputPath = join(workDir, `final_${jobId}.mp4`);
    await mixAudio({
      videoPath: renderResult.outputPath,
      musicSegments: musicPlacements,
      voicePath: narrationPath,
      outputPath: finalOutputPath,
      videoDurationSec: totalDurationSec,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('audio_mixed', jobId);

    // 9. Metadata
    Logger.debug(`[job ${jobId}] Metadata oluşturuluyor`);
    const metadataContext = {
      subject: script.title,
      highlights: brief.entities,
      durationSec: totalDurationSec,
    };
    const metadata = await writeVideoMetadata(channel, metadataContext);

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('metadata_generated', jobId);

    // 10. Render tablosuna yaz (final = ses+görsel birleşmiş dosya)
    db.prepare(
      `INSERT INTO render (job_id, composition, output_path, status, duration_ms)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(jobId, 'StoryNarrative', finalOutputPath, 'done', renderResult.durationMs);

    Logger.success(`[job ${jobId}] StoryNarrative tamamlandı: "${script.title}"`);

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
    Logger.error(`[job ${jobId}] StoryNarrative başarısız`, error);
    throw new Error(`StoryNarrative render başarısız: ${errorMsg}`);
  }
}
