// =====================================
// MODULE: Render Remotion
// Purpose: Remotion kompozisyonlarını programatik olarak render etmek
// Dependencies: core/exec, core/logger, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { join, extname, sep } from 'node:path';
import { run } from '../core/exec.js';
import { Logger } from '../core/logger.js';
import { TIMEOUTS } from '../config/constants.js';
import { optionalEnv } from '../config/env.js';

export interface RenderProps {
  [key: string]: unknown;
}

export interface RenderResult {
  outputPath: string;
  durationMs: number;
}

const ASSET_EXTENSIONS = new Set(['.mp4', '.mov', '.wav', '.mp3', '.m4a', '.jpg', '.jpeg', '.png', '.webp', '.gif']);
const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Isin ozel dosyalarini (data/work/<jobId>/...) render sirasinda Remotion'a
 * sunmak icin gecici, tek kullanimlik bir HTTP sunucusu. Remotion'un
 * --public-dir mekanizmasi tum klasoru render oncesi kopyalar (yuz binlerce
 * MB video icin pratik degil, ayrica kopyalama tamamlanmadan sunucu istek
 * kabul edebiliyor - 404). Duz http(s) URL'ler ise Remotion'un kendi
 * downloader'i tarafindan dogrudan (ve talep uzerine, kopyasiz) okunuyor.
 */
export function startAssetServer(rootDir: string): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const filePath = join(rootDir, relPath);

      // Yol asimi koruması: cozulen yol rootDir disina cikamaz.
      if (!filePath.startsWith(rootDir + sep) && filePath !== rootDir) {
        res.writeHead(403);
        res.end();
        return;
      }

      stat(filePath)
        .then((info) => {
          if (!info.isFile()) throw new Error('not a file');
          const contentType = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
          res.writeHead(200, { 'content-type': contentType, 'content-length': info.size });
          createReadStream(filePath).pipe(res);
        })
        .catch(() => {
          res.writeHead(404);
          res.end();
        });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Asset sunucusu port alamadi'));
        return;
      }
      resolve({
        port: address.port,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

/** inputProps icindeki dosya-yolu gibi gorunen string'leri yerel HTTP URL'ine cevirir. */
export function rewriteAssetPaths(value: unknown, baseUrl: string): unknown {
  if (typeof value === 'string') {
    const ext = extname(value).toLowerCase();
    if (ASSET_EXTENSIONS.has(ext) && !/^https?:\/\//i.test(value)) {
      return `${baseUrl}/${value.split(/[\\/]/).map(encodeURIComponent).join('/')}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteAssetPaths(item, baseUrl));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, rewriteAssetPaths(val, baseUrl)]),
    );
  }
  return value;
}

/**
 * Remotion kompozisyonunu render et (npx remotion render ile subprocess olarak).
 * @param compositionId Remotion'da kayıtlı composition id (ör. 'FunnyClip', 'HotelTourLandscape')
 * @param inputProps Render için input props (props.json olarak temp file'a yazılır) - icindeki
 *                    video/ses/gorsel dosya yollari otomatik olarak yerel HTTP URL'ine cevrilir
 * @param outputPath Çıkış MP4 dosya yolu
 * @param jobId İşi izlemek için (log ve hata raporunda)
 * @returns {outputPath, durationMs}
 */
export async function renderRemotion(
  compositionId: string,
  inputProps: RenderProps,
  outputPath: string,
  jobId: number,
): Promise<RenderResult> {
  const startMs = Date.now();
  Logger.debug(`[job ${jobId}] Remotion render başlıyor: ${compositionId} → ${outputPath}`);

  // Remotion CLI'nin --props bayrağı ya doğrudan bir JSON string ya da bir
  // .json dosya yolu bekler (base64 desteklemez - @remotion/cli/dist/get-input-props.js
  // JSON.parse(props) ya da dosyayı okuyup JSON.parse eder, üçüncü bir yol yok).
  const propsPath = join('data/work', `props_${jobId}_${Date.now()}.json`);
  let assetServer: { port: number; close: () => Promise<void> } | undefined;

  try {
    await mkdir('data/work', { recursive: true });
    assetServer = await startAssetServer(process.cwd());
    const rewrittenProps = rewriteAssetPaths(inputProps, `http://127.0.0.1:${assetServer.port}`) as RenderProps;
    await writeFile(propsPath, JSON.stringify(rewrittenProps));

    // Windows'ta npx bir .cmd betigidir - Node'un spawn()'i shell olmadan
    // bunu calistiramaz (ENOENT/EINVAL), bu yuzden Windows'ta shell:true gerekir.
    //
    // Concurrency: REMOTION_CONCURRENCY verilmezse Remotion kendi mantikli
    // varsayilanini kullanir (min(8, cekirdek/2)) - dusuk RAM'li VPS'lerde her
    // paralel is kendi headless Chrome sekmesini actigi icin bellek sinirliysa
    // .env'den dusurulebilir; bu is istasyonu gibi cok cekirdekli/GPU'lu
    // makinelerde yukseltilerek render suresi ciddi kisaltilabilir.
    const concurrency = optionalEnv('REMOTION_CONCURRENCY');
    const result = await run(
      'npx',
      [
        'remotion',
        'render',
        'remotion/index.ts',
        compositionId,
        outputPath,
        `--props=${propsPath}`,
        ...(concurrency ? [`--concurrency=${concurrency}`] : []),
      ],
      TIMEOUTS.RENDER_MS,
      undefined,
      process.platform === 'win32',
    );

    const durationMs = Date.now() - startMs;
    Logger.success(`[job ${jobId}] Render tamamlandı (${(durationMs / 1000).toFixed(1)}s)`);

    return { outputPath, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    Logger.error(`[job ${jobId}] Render başarısız (${(durationMs / 1000).toFixed(1)}s)`, err);
    throw err;
  } finally {
    await rm(propsPath, { force: true }).catch(() => undefined);
    await assetServer?.close();
  }
}

/**
 * Composition'ın render süresi tahmini (frame sayısı / FPS).
 * Gerçek render süresi buna bağlı olacak (+ encoder overhead).
 * @param durationInFrames Frames cinsinden süre
 * @param fps Frame rate
 * @returns Tahmini render süresi (ms)
 */
export function estimateRenderTime(durationInFrames: number, fps: number): number {
  const durationSec = durationInFrames / fps;
  // Tahmini: video süresi + %50 encoder overhead
  return Math.round((durationSec * 1.5) * 1000);
}
