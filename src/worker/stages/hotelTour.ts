// =====================================
// MODULE: Hotel Tour Job Stage
// Purpose: Drone video → otel tanıtım klibi (M2'nin somut kısmı)
// Dependencies: telemetry, edit, poi, music, tts, analysis, render
// Author: BestMarketer Team
// Last Modified: 2026-08-19
// =====================================

import Database from 'better-sqlite3';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ChannelConfig } from '../../config/channels.js';
import { Logger } from '../../core/logger.js';
import { probe } from '../../ingest/probe.js';
import { parseDjiSrt } from '../../telemetry/djiSrtParser.js';
import { parseGoproTelemetry } from '../../telemetry/goproGpmf.js';
import { planSpeed } from '../../edit/speedPlanner.js';
import { applySpeedPlan } from '../../edit/applySpeedPlan.js';
import { synthesizeSpeech, defaultVoiceRef } from '../../tts/router.js';
import { planMusicSegments, type MusicSegment } from '../../music/segmentPlanner.js';
import { selectTracksForSegments } from '../../music/selector.js';
import { loadMusicLibrary } from '../../music/library.js';
import { mixAudio, type MusicPlacement } from '../../edit/audioMix.js';
import type { SpeedPlan } from '../../edit/speedPlanner.js';
import { buildPoiCues } from '../../poi/poiTimeline.js';
import { writeVideoMetadata } from '../../analysis/channelWriter.js';
import { renderRemotion } from '../../render/renderRemotion.js';
import type { JobRow, StageResult } from './types.js';

/**
 * Drone video → render aşaması. Tüm bağımlı modülleri zincirler:
 * telemetri → kurgu → müzik → seslendirme → veri kartları → Remotion render.
 * @returns Onay kuyruğuna yazılacak önerilen metadata + önizleme yolu
 */
export async function runHotelTourJob(
  db: Database.Database,
  job: JobRow,
  channel: ChannelConfig,
): Promise<StageResult> {
  const jobId = job.id;
  const workDir = `data/work/${jobId}`;
  const videoPath = job.source_ref;

  Logger.info(`[job ${jobId}] HotelTour başlıyor: ${channel.label} → ${videoPath}`);

  try {
    // 1. Probe videoyu
    Logger.debug(`[job ${jobId}] Video probelanıyor`);
    const info = await probe(videoPath);
    const sourceDurationSec = info.durationSec;

    // 2. Telemetri arayışı (SRT varsa DJI, yoksa GoPro, yoksa fallback)
    let telemetry: any = null;
    const srtPath = videoPath.replace(/\.[^.]+$/, '.SRT');

    try {
      await access(srtPath);
      Logger.debug(`[job ${jobId}] DJI SRT bulundu: ${srtPath}`);
      telemetry = await parseDjiSrt(srtPath);
      db.prepare('UPDATE job SET stage=? WHERE id=?').run('telemetry_dji', jobId);
    } catch {
      try {
        Logger.debug(`[job ${jobId}] GoPro GPMF aranıyor`);
        telemetry = await parseGoproTelemetry(videoPath);
        db.prepare('UPDATE job SET stage=? WHERE id=?').run('telemetry_gopro', jobId);
      } catch {
        Logger.warn(`[job ${jobId}] Telemetri bulunamadı, şablon rota kullanılacak`);
        db.prepare('UPDATE job SET stage=? WHERE id=?').run('telemetry_fallback', jobId);
      }
    }

    // 3. Hız planlama (telemetri varsa, yoksa minimum kurgu)
    Logger.debug(`[job ${jobId}] Hız planı oluşturuluyor`);
    const speedPlan: SpeedPlan = telemetry
      ? planSpeed(telemetry, sourceDurationSec, { targetDurationSec: channel.targetDurationSec })
      : {
          segments: [
            {
              startSec: 0,
              endSec: sourceDurationSec,
              action: 'keep',
              factor: 1,
              speedMps: 0,
              altM: 0,
              reason: 'telemetri yok',
            },
          ],
          sourceDurationSec,
          outputDurationSec: channel.targetDurationSec,
        };

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('speed_planned', jobId);

    // 4. Kurguyu uygula
    Logger.debug(`[job ${jobId}] Kurgu uygulanıyor`);
    const editedVideoPath = join(workDir, `edited_${jobId}.mp4`);
    await applySpeedPlan({
      inputPath: videoPath,
      outputPath: editedVideoPath,
      plan: speedPlan,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('speed_applied', jobId);

    // 5. POI zamanlaması (ilgi noktaları / bilgi kartları)
    Logger.debug(`[job ${jobId}] POI zamanlaması oluşturuluyor`);
    const poiCues = telemetry
      ? buildPoiCues(telemetry, [], speedPlan.outputDurationSec)
      : [];

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('poi_generated', jobId);

    // 6. Müzik planlama
    Logger.debug(`[job ${jobId}] Müzik segmentleri planlanıyor`);
    const musicSegments: MusicSegment[] = telemetry
      ? planMusicSegments(telemetry, speedPlan.outputDurationSec, 'dji')
      : [
          {
            startSec: 0,
            endSec: speedPlan.outputDurationSec,
            energy: 'medium',
            avgSpeedMps: 0,
            avgAltM: 0,
            suggestedMoods: ['cinematic'],
          },
        ];

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('music_planned', jobId);

    // 7. Müzik seçimi
    Logger.debug(`[job ${jobId}] Müzik parçaları seçiliyor`);
    const musicLibrary = await loadMusicLibrary();
    const selectedTracks = selectTracksForSegments(musicLibrary, musicSegments, {
      theme: 'otel',
      hourOfDay: new Date().getHours(),
    });
    const musicPlacements: MusicPlacement[] = selectedTracks.map((entry) => ({
      trackPath: entry.track.filePath,
      startSec: entry.startSec,
      endSec: entry.endSec,
    }));

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('music_selected', jobId);

    // 8. Seslendirme
    Logger.debug(`[job ${jobId}] Seslendirme yapılıyor`);
    const narrativeText = `Hoş geldiniz! Bu muhteşem otel ve çevresini keşfetmeye hazır mısınız?`;
    const voicePath = join(workDir, `voice_${jobId}.wav`);
    await synthesizeSpeech({
      text: narrativeText,
      voiceRef: defaultVoiceRef(),
      outputPath: voicePath,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('voice_synthesized', jobId);

    // 9. Ses karışımı
    Logger.debug(`[job ${jobId}] Ses katmanları karışılıyor`);
    const mixedOutputPath = join(workDir, `mixed_${jobId}.wav`);
    await mixAudio({
      videoPath: editedVideoPath,
      musicSegments: musicPlacements,
      voicePath,
      outputPath: mixedOutputPath,
      videoDurationSec: speedPlan.outputDurationSec,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('audio_mixed', jobId);

    // 10. Metadata oluşturma
    Logger.debug(`[job ${jobId}] Metadata oluşturuluyor`);
    const metadata = await writeVideoMetadata(channel, {
      subject: 'Otel ve çevresindeki turizm noktaları',
      highlights: poiCues.map((cue) => cue.poi.name),
      durationSec: speedPlan.outputDurationSec,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('metadata_generated', jobId);

    // 11. Remotion render
    Logger.debug(`[job ${jobId}] Remotion render başlıyor`);
    const outputPath = join(workDir, `render_${jobId}.mp4`);
    const renderProps = {
      videoPath: editedVideoPath,
      audioPath: mixedOutputPath,
      poiCues,
      durationSec: speedPlan.outputDurationSec,
      metadata,
      channelId: job.channel_id,
    };

    const renderResult = await renderRemotion('HotelTour', renderProps, outputPath, jobId);

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('rendered', jobId);

    // 12. Render tablosuna yaz
    Logger.debug(`[job ${jobId}] Render kaydı yazılıyor`);
    db.prepare(
      `INSERT INTO render (job_id, composition, output_path, status, duration_ms)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(jobId, 'HotelTour', renderResult.outputPath, 'done', renderResult.durationMs);

    Logger.success(`[job ${jobId}] HotelTour tamamlandı (${(renderResult.durationMs / 1000).toFixed(1)}s)`);

    return {
      previewPath: renderResult.outputPath,
      proposedTitle: metadata.title,
      proposedDescription: metadata.description,
      proposedTags: metadata.tags,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    Logger.error(`[job ${jobId}] HotelTour başarısız`, error);
    throw new Error(`HotelTour render başarısız: ${errorMsg}`);
  }
}
