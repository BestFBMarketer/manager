// =====================================
// MODULE: Vertical Frame
// Purpose: Kaynagi 9:16 dikey cerceveye oturtan FFmpeg filtre zincirini kurar
// Dependencies: config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { VIDEO } from '../config/constants.js';

export type FramingMode = 'crop' | 'blurPad';

/**
 * Kaynak en-boy oranina gore dikey cerceve filtresi uretir.
 * - crop: goruntuyu doldurup kenarlardan kirpar (hareket merkezde ise en iyisi)
 * - blurPad: goruntuyu sigdirip arkaya bulanik dolgu koyar (kirpma kaybi istenmiyorsa)
 * @param mode Cerceveleme yontemi
 * @returns FFmpeg -vf degeri
 */
export function verticalFilter(mode: FramingMode): string {
  const w = VIDEO.VERTICAL_WIDTH;
  const h = VIDEO.VERTICAL_HEIGHT;

  if (mode === 'crop') {
    return [
      `scale=${w}:${h}:force_original_aspect_ratio=increase`,
      `crop=${w}:${h}`,
      `fps=${VIDEO.FPS}`,
      `format=${VIDEO.PIXEL_FORMAT}`,
    ].join(',');
  }

  return [
    `split=2[bg][fg]`,
    `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=luma_radius=40:luma_power=2[bgblur]`,
    `[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[fgs]`,
    `[bgblur][fgs]overlay=(W-w)/2:(H-h)/2,fps=${VIDEO.FPS},format=${VIDEO.PIXEL_FORMAT}`,
  ].join(';');
}

/** Yatay (uzun video) cerceve filtresi. */
export function landscapeFilter(): string {
  return [
    `scale=${VIDEO.LANDSCAPE_WIDTH}:${VIDEO.LANDSCAPE_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${VIDEO.LANDSCAPE_WIDTH}:${VIDEO.LANDSCAPE_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
    `fps=${VIDEO.FPS}`,
    `format=${VIDEO.PIXEL_FORMAT}`,
  ].join(',');
}
