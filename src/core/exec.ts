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
 * @returns stdout ve stderr
 */
export async function run(command: string, args: string[], timeoutMs: number): Promise<ExecResult> {
  Logger.debug(`exec: ${command} ${args.join(' ')}`);

  return new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', (error) => finish(() => reject(error)));
    child.on('close', (code) => {
      finish(() => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`${command} cikis kodu ${code}: ${stderr.slice(-2000)}`));
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
