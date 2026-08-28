// =====================================
// MODULE: Exec
// Purpose: Harici komut (ffmpeg, yt-dlp) calistirma - zaman asimi ve temizlik ile (Rule 5)
// Dependencies: core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { spawn } from 'node:child_process';
import { Logger } from './logger.js';

export interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Komutu calistirir; zaman asiminda sureci sonlandirir.
 * @param command Calistirilacak ikili (orn. 'ffmpeg')
 * @param args Argumanlar
 * @param timeoutMs Zaman asimi
 * @param stdinText Verilirse surece stdin olarak yazilir (shell pipe kullanmadan - Windows'ta
 *                  ters slash'li yollarin POSIX shell'de kacis karakteri sayilip bozulmasini onler)
 * @param useShell Windows'ta .cmd/.bat betiklerini (orn. npx) calistirmak icin gerekir -
 *                 gercek .exe ikili dosyalari (ffmpeg, yt-dlp, piper) buna ihtiyac duymaz,
 *                 sadece gerektiginde acilmali (path/apostrof gibi ozel karakterlerin
 *                 shell tarafindan farkli yorumlanma riskini sadece gereken cagriyla sinirlar).
 * @returns stdout ve stderr
 */
export async function run(
  command: string,
  args: string[],
  timeoutMs: number,
  stdinText?: string,
  useShell = false,
): Promise<ExecResult> {
  Logger.debug(`exec: ${command} ${args.join(' ')}`);

  return new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: [stdinText !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      shell: useShell,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`${command}: ${timeoutMs}ms zaman asimi`));
    }, timeoutMs);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    if (stdinText !== undefined) {
      child.stdin?.end(stdinText, 'utf8');
    }

    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', (error) => finish(() => reject(error)));
    child.on('close', (code) => {
      finish(() => {
        if (code === 0) resolve({ stdout, stderr });
        else {
          // Bazi CLI'lar (npx/remotion) gercek hatayi stdout'a yazar, stderr'i bos birakir -
          // ikisi de dahil edilmezse hata mesaji sessizce yanlis yonlendirir.
          const combined = [stdout, stderr].filter(Boolean).join('\n---stderr---\n');
          reject(new Error(`${command} cikis kodu ${code}: ${combined.slice(-4000)}`));
        }
      });
    });
  });
}

/** Komutun sistemde kurulu olup olmadigini soyler. */
export async function isAvailable(command: string): Promise<boolean> {
  try {
    await run(command, ['--version'], 10_000);
    return true;
  } catch (error) {
    // Bazi Windows derlemeleri (orn. ffmpeg) surum bayragiyla tek basina cagrildiginda
    // gecerli surum metnini basip yine de sifir olmayan cikis kodu donduruyor - gercek
    // is (kesim/kodlama) sorunsuz calisiyor, sadece bu kontrol yaniliyor. stderr'de
    // "version" geciyorsa binary gercekte kurulu demektir.
    const message = error instanceof Error ? error.message : '';
    return /version/i.test(message);
  }
}
