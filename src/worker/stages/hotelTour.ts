// =====================================
// MODULE: Hotel Tour Job Stage
// Purpose: Drone video → otel tanıtım klibi (M2'nin somut kısmı)
// Dependencies: telemetry, edit, poi, music, tts, analysis, render
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import Database from 'better-sqlite3';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ChannelConfig } from '../../config/channels.js';
import { Logger } from '../../core/logger.js';
import { probe } from '../../ingest/probe.js';
import { parseDjiSrt } from '../../telemetry/djiSrtParser.js';
import { parseGoproTelemetry } from '../../telemetry/goproGpmf.js';
import type { TrackPoint } from '../../telemetry/types.js';
import { planSpeed, type SpeedPlan } from '../../edit/speedPlanner.js';
import { applySpeedPlan } from '../../edit/applySpeedPlan.js';
import { synthesizeSpeech, defaultVoiceRef } from '../../tts/router.js';
import { planMusicSegments, type MusicSegment } from '../../music/segmentPlanner.js';
import { selectTracksForSegments } from '../../music/selector.js';
import { loadMusicLibrary } from '../../music/library.js';
import { mixAudio, type MusicPlacement } from '../../edit/audioMix.js';
import { buildPoiCues } from '../../poi/poiTimeline.js';
import { writeVideoMetadata, writeIntroNarration } from '../../analysis/channelWriter.js';
import { renderRemotion } from '../../render/renderRemotion.js';
import { generateThumbnail } from '../../render/thumbnail.js';
import { resolveHotelFacts } from '../../hotelData/resolver.js';
import type { HotelFacts } from '../../hotelData/types.js';
import type { PoiCueProps } from '../../../remotion/compositions/HotelTour.js';
import type { InfoChip } from '../../../remotion/components/InfoChips.js';
import type { JobRow, StageResult } from './types.js';
import { VIDEO } from '../../config/constants.js';

interface HotelTourInput {
  hotelName?: string;
  hotelCity?: string;
}

/** Bilinen alanlari kartlara cevirir - eksik alan hic gorunmez (uydurma yok). */
function buildInfoChips(facts: HotelFacts): InfoChip[] {
  const chips: InfoChip[] = [];

  if (facts.roomCount) chips.push({ icon: '🛏', label: `${facts.roomCount.value} oda`, source: facts.roomCount.source });
  if (facts.capacity) chips.push({ icon: '👥', label: `${facts.capacity.value} kişi kapasite`, source: facts.capacity.source });
  if (facts.airportDistanceKm) {
    chips.push({ icon: '✈️', label: `havaalanına ${facts.airportDistanceKm.value.toFixed(0)} km`, source: facts.airportDistanceKm.source });
  }
  if (facts.allInclusive?.value) chips.push({ icon: '🍽', label: 'her şey dahil', source: facts.allInclusive.source });
  if (facts.rating) {
    const recommend = facts.recommendPercent ? ` · %${facts.recommendPercent.value} önerir` : '';
    chips.push({ icon: '⭐', label: `${facts.rating.value.toFixed(1)}${recommend}`, source: facts.rating.source });
  }

  return chips;
}

const HOTEL_TOUR_COMPOSITIONS = new Set(['HotelTourLandscape', 'HotelTourVertical']);

/** SRT/GoPro her ikisi de bulunamadığında/yetersiz kaldığında bile [] döner, asla throw etmez. */
async function detectTelemetry(
  db: Database.Database,
  jobId: number,
  videoPath: string,
): Promise<TrackPoint[]> {
  const srtPath = videoPath.replace(/\.[^.]+$/, '.SRT');

  try {
    await access(srtPath);
    const points = await parseDjiSrt(srtPath);
    if (points.length > 0) {
      db.prepare('UPDATE job SET stage=? WHERE id=?').run('telemetry_dji', jobId);
      return points;
    }
  } catch {
    // SRT dosyası yok - GoPro'ya düş
  }

  const goproPoints = await parseGoproTelemetry(videoPath);
  if (goproPoints.length > 0) {
    db.prepare('UPDATE job SET stage=? WHERE id=?').run('telemetry_gopro', jobId);
    return goproPoints;
  }

  Logger.warn(`[job ${jobId}] Telemetri bulunamadı, sabit hız planı kullanılacak`);
  db.prepare('UPDATE job SET stage=? WHERE id=?').run('telemetry_fallback', jobId);
  return [];
}

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

  if (!HOTEL_TOUR_COMPOSITIONS.has(job.template)) {
    throw new Error(
      `HotelTour stage'i '${job.template}' şablonunu desteklemiyor (beklenen: HotelTourLandscape | HotelTourVertical)`,
    );
  }
  const compositionId = job.template as 'HotelTourLandscape' | 'HotelTourVertical';

  Logger.info(`[job ${jobId}] HotelTour başlıyor: ${channel.label} → ${videoPath} (${compositionId})`);

  const jobInput = JSON.parse(job.input_json || '{}') as HotelTourInput;

  try {
    // 0. Otel verisi - hotelName/hotelCity batch girdisinde varsa saglayici
    // zincirinden cekilir (bkz. src/hotelData/resolver.ts); yoksa InfoChips atlanir.
    let hotelFacts: HotelFacts = {};
    if (jobInput.hotelName && jobInput.hotelCity) {
      Logger.debug(`[job ${jobId}] Otel verisi çözümleniyor: ${jobInput.hotelName}`);
      hotelFacts = await resolveHotelFacts(jobInput.hotelName, jobInput.hotelCity);
      db.prepare('UPDATE job SET stage=? WHERE id=?').run('hotel_data_resolved', jobId);
    } else {
      Logger.debug(`[job ${jobId}] Otel adı/şehri verilmemiş - bilgi kartları atlanacak`);
    }

    // 1. Probe videoyu
    Logger.debug(`[job ${jobId}] Video probelanıyor`);
    const info = await probe(videoPath);
    const sourceDurationSec = info.durationSec;

    // 2. Telemetri arayışı (SRT varsa DJI, yoksa GoPro, yoksa fallback)
    const telemetry = await detectTelemetry(db, jobId, videoPath);
    const hasTelemetry = telemetry.length > 0;

    // 3. Hız planlama (telemetri varsa, yoksa minimum kurgu)
    Logger.debug(`[job ${jobId}] Hız planı oluşturuluyor`);
    const speedPlan: SpeedPlan = hasTelemetry
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
          outputDurationSec: sourceDurationSec,
        };

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('speed_planned', jobId);

    // 4. Kurguyu uygula
    Logger.debug(`[job ${jobId}] Kurgu uygulanıyor`);
    const editedVideoPath = join(workDir, `edited_${jobId}.mp4`);
    // Kaynak (drone) genelde 4K - Remotion'a hedeften daha yuksek cozunurluk
    // vermek kaliteyi artirmiyor, sadece OffthreadVideo'nun frame-frame decode
    // suresini kata kata uzatiyor (bkz. applySpeedPlan.ts targetWidth/Height notu).
    const isVertical = compositionId === 'HotelTourVertical';
    await applySpeedPlan({
      inputPath: videoPath,
      outputPath: editedVideoPath,
      plan: speedPlan,
      targetWidth: isVertical ? VIDEO.VERTICAL_WIDTH : VIDEO.LANDSCAPE_WIDTH,
      targetHeight: isVertical ? VIDEO.VERTICAL_HEIGHT : VIDEO.LANDSCAPE_HEIGHT,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('speed_applied', jobId);

    // 5. POI zamanlaması (ilgi noktaları / bilgi kartları) - bölgedeki POI listesi
    // henüz ayrı bir keşif adımından gelmiyor (hotelData/M4 kapsamı); boş POI
    // listesiyle çağrılır, sonuç da boş kart listesi olur (Rule 11: uydurma yok).
    Logger.debug(`[job ${jobId}] POI zamanlaması oluşturuluyor`);
    const poiCues = hasTelemetry ? buildPoiCues(telemetry, [], speedPlan.outputDurationSec) : [];

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('poi_generated', jobId);

    // 6. Müzik planlama
    Logger.debug(`[job ${jobId}] Müzik segmentleri planlanıyor`);
    const musicSegments: MusicSegment[] = hasTelemetry
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

    // 8. Metadata + acilis anlatimi - TTS'ten once uretilir cunku seslendirme
    // metni kanalin dilinde (channel.language) olmali; ikisi ayni baglami
    // (metadataContext) kullanir, tek LLM turu icin degil ama tutarlilik icin.
    Logger.debug(`[job ${jobId}] Metadata oluşturuluyor`);
    const metadataContext = {
      subject: jobInput.hotelName ? `${jobInput.hotelName} ve çevresindeki turizm noktaları` : 'Otel ve çevresindeki turizm noktaları',
      highlights: [
        ...poiCues.map((cue) => cue.poi.name),
        ...(hotelFacts.roomCount ? [`${hotelFacts.roomCount.value} odalı otel`] : []),
        ...(hotelFacts.allInclusive?.value ? ['her şey dahil konsept'] : []),
      ],
      durationSec: speedPlan.outputDurationSec,
    };
    const metadata = await writeVideoMetadata(channel, metadataContext);

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('metadata_generated', jobId);

    // 9. Seslendirme - anlatim metni kanalin diline gore LLM'den gelir
    // (sabit tek-dilli metin TTS'e yanlis dilde metin vererek bozuk/robotik
    // sese yol aciyordu - orn. Almanca kanalda Turkce metin).
    Logger.debug(`[job ${jobId}] Seslendirme yapılıyor`);
    const narrativeText = await writeIntroNarration(channel, metadataContext);
    const voicePath = join(workDir, `voice_${jobId}.wav`);
    await synthesizeSpeech({
      text: narrativeText,
      voiceRef: defaultVoiceRef(),
      outputPath: voicePath,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('voice_synthesized', jobId);

    // 10. Ses karışımı - mixAudio hem videoyu hem miksajlanmış sesi tek dosyada
    // birleştirir (-map 0:v + -map [out]), çıktı doğrudan Remotion'a girecek
    // videoSrc'dir; ayrı bir muxing adımına gerek yoktur.
    Logger.debug(`[job ${jobId}] Ses katmanları karışılıyor`);
    const mixedVideoPath = join(workDir, `mixed_${jobId}.mp4`);
    await mixAudio({
      videoPath: editedVideoPath,
      musicSegments: musicPlacements,
      voicePath,
      outputPath: mixedVideoPath,
      videoDurationSec: speedPlan.outputDurationSec,
    });

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('audio_mixed', jobId);

    // 11. Remotion render - HotelTourProps sözleşmesine göre
    Logger.debug(`[job ${jobId}] Remotion render başlıyor (${compositionId})`);
    const outputPath = join(workDir, `render_${jobId}.mp4`);
    const cues: PoiCueProps[] = poiCues.map((cue) => ({
      name: cue.poi.name,
      description: cue.poi.description,
      source: cue.poi.descriptionSource,
      atSec: cue.atSec,
      durationSec: cue.durationSec,
    }));

    const renderResult = await renderRemotion(
      compositionId,
      {
        videoSrc: mixedVideoPath,
        title: metadata.title,
        cues,
        channelHandle: channel.label,
        titleDurationSec: 3,
        totalDurationSec: speedPlan.outputDurationSec,
        infoChips: buildInfoChips(hotelFacts),
      },
      outputPath,
      jobId,
    );

    db.prepare('UPDATE job SET stage=? WHERE id=?').run('rendered', jobId);

    // 12. Render tablosuna yaz
    Logger.debug(`[job ${jobId}] Render kaydı yazılıyor`);
    db.prepare(
      `INSERT INTO render (job_id, composition, output_path, status, duration_ms)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(jobId, compositionId, renderResult.outputPath, 'done', renderResult.durationMs);

    Logger.success(`[job ${jobId}] HotelTour tamamlandı (${(renderResult.durationMs / 1000).toFixed(1)}s)`);

    // 13. Thumbnail - başarısız olursa video yine de onay kuyruğuna düşer (YouTube kendi karesini seçer)
    let thumbnailPath: string | undefined;
    try {
      thumbnailPath = await generateThumbnail(
        renderResult.outputPath,
        speedPlan.outputDurationSec,
        metadata.thumbnailText,
        join(workDir, `thumbnail_${jobId}.jpg`),
      );
    } catch {
      Logger.warn(`[job ${jobId}] Thumbnail üretilemedi, video kapak resmi olmadan onaya düşecek`);
    }

    return {
      previewPath: renderResult.outputPath,
      thumbnailPath,
      proposedTitle: metadata.title,
      proposedDescription: metadata.description,
      proposedTags: metadata.tags,
      metadataContext,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    Logger.error(`[job ${jobId}] HotelTour başarısız`, error);
    throw new Error(`HotelTour render başarısız: ${errorMsg}`);
  }
}
