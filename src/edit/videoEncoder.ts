// =====================================
// MODULE: Video Encoder
// Purpose: ffmpeg video kodlayici bayraklarini secer - CPU (libx264) varsayilan,
//          VIDEO_HW_ENCODER=h264_nvenc ile NVIDIA GPU'ya (NVENC) gecilebilir
// Dependencies: config/env
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { optionalEnv } from '../config/env.js';

/**
 * Video kodlama bayraklarini dondurur. VIDEO_HW_ENCODER .env'de tanimliysa
 * o GPU kodlayiciya gecilir (orn. h264_nvenc) - VPS'lerde genelde GPU
 * olmadigindan varsayilan CPU (libx264) kalir, sadece GPU'lu makinelerde
 * (bu is istasyonundaki RTX 3060 gibi) acikca etkinlestirilir.
 * @param crf CPU kodlamada kalite hedefi (dusuk = yuksek kalite); NVENC'te esdegeri cq'ya eslenir
 */
export function videoEncoderArgs(crf: number): string[] {
  const hwEncoder = optionalEnv('VIDEO_HW_ENCODER');

  if (hwEncoder === 'h264_nvenc') {
    return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', String(crf), '-b:v', '0'];
  }

  return ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf)];
}
