// =====================================
// MODULE: Pipeline CLI
// Purpose: Asama bazli calistirma girisi - her asama tek basina test edilebilir
// Dependencies: tum cekirdek modulleri
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { CHANNELS } from './config/channels.js';
import { isAvailable } from './core/exec.js';
import { getDb, closeDb } from './core/db.js';
import { Logger } from './core/logger.js';
import { cutAndFrame } from './edit/ffmpegCut.js';
import { probe } from './ingest/probe.js';
import { listProviderStatus, callLlmJson } from './llm/router.js';
import { spentTodayUsd } from './llm/quotaTracker.js';
import { boundingBox, parseDjiSrt } from './telemetry/djiSrtParser.js';
import { parseGoproTelemetry } from './telemetry/goproGpmf.js';
import { guessSource } from './telemetry/clipSync.js';
import { listTtsStatus, synthesizeSpeech, defaultVoiceRef } from './tts/router.js';

interface Args {
  stage: string;
  values: Record<string, string>;
  flags: Set<string>;
}

function parseArgs(argv: string[]): Args {
  const values: Record<string, string> = {};
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      values[key] = next;
      i += 1;
    } else {
      flags.add(key);
    }
  }

  return { stage: values.stage ?? (flags.has('help') ? 'help' : 'help'), values, flags };
}

function printHelp(): void {
  console.log(`
shorts-factory - asama bazli calistirma

  npm run pipeline -- --stage doctor
      Ortam kontrolu: ffmpeg/ffprobe/yt-dlp, LLM saglayicilari, kanallar, DB.

  npm run pipeline -- --stage probe --input <video>
      Video suresini, cozunurlugunu ve fps'ini gosterir.

  npm run pipeline -- --stage cut --input <video> --start 12 --end 45 [--orientation vertical|landscape] [--framing crop|blurPad] --output <cikti.mp4>
      Verilen araligi keser, hedef cerceveye oturtur, sesi normalize eder.

  npm run pipeline -- --stage srt --input <ucus.SRT>
      DJI telemetrisini ayristirir; nokta sayisi ve sinir kutusunu yazar.

  npm run pipeline -- --stage gpmf --input <GX010001.MP4>
      GoPro videosuna gomulu GPS telemetrisini cikarir.

  npm run pipeline -- --stage tts --input "<metin>" [--voice <ses>] --output <ses.wav>
      Seslendirme zincirini test eder (Voicebox -> Piper, ikisi de ucretsiz).

  npm run pipeline -- --stage llm --task metadata --input "<metin>"
      LLM zincirini test eder (once ucretsiz katman denenir).

  npm run pipeline -- --stage cost
      Bugunku LLM harcamasini gosterir.
`);
}

async function stageDoctor(): Promise<void> {
  Logger.info('Ortam kontrolu basliyor');

  for (const binary of ['ffmpeg', 'ffprobe', 'yt-dlp']) {
    const ok = await isAvailable(binary);
    if (ok) Logger.success(`${binary} kurulu`);
    else Logger.warn(`${binary} BULUNAMADI - kurulmasi gerekiyor`);
  }

  Logger.info('Seslendirme saglayicilari:');
  for (const tts of await listTtsStatus()) {
    if (tts.ready) Logger.success(`  ${tts.name}: hazir`);
    else Logger.warn(`  ${tts.name}: hazir degil`);
  }

  Logger.info('LLM saglayicilari:');
  for (const provider of listProviderStatus()) {
    const tier = provider.free ? 'ucretsiz' : 'ucretli';
    if (!provider.configured) Logger.warn(`  ${provider.name} (${tier}): anahtar tanimli degil`);
    else if (!provider.quota) Logger.warn(`  ${provider.name} (${tier}): kota dolu`);
    else Logger.success(`  ${provider.name} (${tier}): hazir`);
  }

  Logger.info(`Kanallar: ${Object.values(CHANNELS).map((c) => `${c.id} (${c.label})`).join(', ')}`);

  getDb();
  Logger.success('SQLite semasi hazir');
  Logger.info(`Bugunku LLM harcamasi: $${spentTodayUsd().toFixed(4)}`);
}

async function stageGpmf(input: string): Promise<void> {
  Logger.info(`Kaynak tahmini: ${guessSource(input.split('/').pop() ?? input)}`);
  const points = await parseGoproTelemetry(input);
  if (points.length === 0) {
    Logger.warn('GoPro telemetrisi yok - bu klip harita senkronuna katilmaz');
    return;
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  Logger.success(
    `${points.length} nokta | ${first.tSec.toFixed(1)}-${last.tSec.toFixed(1)}sn | ` +
      `baslangic ${first.lat.toFixed(5)},${first.lon.toFixed(5)} | ` +
      `saat ${first.wallClock?.toISOString() ?? 'yok'}`,
  );
}

async function stageTts(args: Args): Promise<void> {
  const text = args.values.input;
  const output = args.values.output;
  if (!text || !output) throw new Error('tts asamasi --input "<metin>" --output <ses.wav> gerektirir');

  const result = await synthesizeSpeech({
    text,
    voiceRef: args.values.voice ?? defaultVoiceRef(),
    outputPath: output,
  });
  Logger.success(`Ses uretildi: ${result.outputPath} (${result.durationSec.toFixed(1)}sn, $${result.costUsd})`);
}

async function stageProbe(input: string): Promise<void> {
  const info = await probe(input);
  Logger.success(
    `${input}: ${info.durationSec.toFixed(1)}sn, ${info.width}x${info.height}, ` +
      `${info.fps.toFixed(2)}fps, ses: ${info.hasAudio ? 'var' : 'yok'}`,
  );
}

async function stageCut(args: Args): Promise<void> {
  const { input, output, start, end, orientation, framing } = args.values;
  if (!input || !output || start === undefined || end === undefined) {
    throw new Error('cut asamasi --input --output --start --end gerektirir');
  }

  await cutAndFrame({
    inputPath: input,
    outputPath: output,
    startSec: Number(start),
    endSec: Number(end),
    orientation: orientation === 'landscape' ? 'landscape' : 'vertical',
    framing: framing === 'blurPad' ? 'blurPad' : 'crop',
  });
}

async function stageSrt(input: string): Promise<void> {
  const points = await parseDjiSrt(input);
  if (points.length === 0) {
    Logger.warn('Telemetri yok - harita katmani sablon rotaya dusecek');
    return;
  }

  const box = boundingBox(points);
  const last = points[points.length - 1]!;
  Logger.success(
    `${points.length} nokta, ucus suresi ~${last.tSec.toFixed(0)}sn, ` +
      `sinirlar: ${box?.minLat.toFixed(5)},${box?.minLon.toFixed(5)} -> ${box?.maxLat.toFixed(5)},${box?.maxLon.toFixed(5)}`,
  );
}

interface MetadataOutput {
  title: string;
  description: string;
  hashtags: string[];
}

function isMetadataOutput(value: unknown): value is MetadataOutput {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.description === 'string' &&
    Array.isArray(candidate.hashtags)
  );
}

async function stageLlm(args: Args): Promise<void> {
  const input = args.values.input;
  if (!input) throw new Error('llm asamasi --input "<metin>" gerektirir');

  const { data, result } = await callLlmJson<MetadataOutput>(
    {
      task: 'metadata',
      system:
        'Sen bir YouTube icerik editorusun. Verilen video ozetinden Turkce, merak uyandiran ' +
        'ama abartisiz bir baslik, kisa bir aciklama ve 3-5 hashtag uret. ' +
        'Yalnizca su JSON semasini dondur: {"title": string, "description": string, "hashtags": string[]}',
      user: input,
    },
    isMetadataOutput,
  );

  Logger.success(`Saglayici: ${result.provider}/${result.model}`);
  console.log(JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  try {
    switch (args.stage) {
      case 'doctor': await stageDoctor(); break;
      case 'probe': await stageProbe(args.values.input ?? ''); break;
      case 'cut': await stageCut(args); break;
      case 'srt': await stageSrt(args.values.input ?? ''); break;
      case 'gpmf': await stageGpmf(args.values.input ?? ''); break;
      case 'tts': await stageTts(args); break;
      case 'llm': await stageLlm(args); break;
      case 'cost': Logger.info(`Bugunku LLM harcamasi: $${spentTodayUsd().toFixed(4)}`); break;
      default: printHelp();
    }
  } catch (error) {
    Logger.error(`Asama basarisiz: ${args.stage}`, error);
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}

void main();
