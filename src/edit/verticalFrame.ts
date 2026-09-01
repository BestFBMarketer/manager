// =====================================
// MODULE: Vertical Frame
// Purpose: Kaynagi 9:16 dikey cerceveye oturtan FFmpeg filtre zincirini kurar
// Dependencies: config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-25
// =====================================

import { VIDEO } from '../config/constants.js';

export type FramingMode = 'crop' | 'blurPad';

/**
 * Referans kanal/videodan kesilen klipler icin watermark-guvenli kirpma filtresi:
 * normalden fazla yakinlastirip kenar/kose logo-watermark'i kare disina iter, sonra
 * ust/alt seritte kalabilecek kalici handle/logo barlarini bulaniklastirir. Orta
 * bolge (Remotion'in ustune bindirecegi kendi altyazisi) dokunulmadan kalir.
 */
function watermarkSafeCropFilter(w: number, h: number): string {
  const zoomW = Math.round(w * VIDEO.WATERMARK_ZOOM);
  const zoomH = Math.round(h * VIDEO.WATERMARK_ZOOM);
  const topBand = Math.round(h * VIDEO.WATERMARK_BLUR_TOP_RATIO);
  const bottomBand = Math.round(h * VIDEO.WATERMARK_BLUR_BOTTOM_RATIO);
  const bottomY = h - bottomBand;

  return [
    `scale=${zoomW}:${zoomH}:force_original_aspect_ratio=increase,crop=${w}:${h},split=3[core][topsrc][botsrc]`,
    `[topsrc]crop=${w}:${topBand}:0:0,boxblur=23:3[topblur]`,
    `[botsrc]crop=${w}:${bottomBand}:0:${bottomY},boxblur=23:3[botblur]`,
    `[core][topblur]overlay=0:0[stripped1]`,
    `[stripped1][botblur]overlay=0:${bottomY},fps=${VIDEO.FPS},format=${VIDEO.PIXEL_FORMAT}`,
  ].join(';');
}

/**
 * Kaynak en-boy oranina gore dikey cerceve filtresi uretir.
 * - crop: goruntuyu doldurup kenarlardan kirpar (hareket merkezde ise en iyisi)
 * - blurPad: goruntuyu sigdirip arkaya bulanik dolgu koyar (kirpma kaybi istenmiyorsa)
 * @param mode Cerceveleme yontemi
 * @param stripWatermarks Referans kaynaktan geliyorsa true - baska kanalin logo/watermark/handle'i goruntude kalmasin
 * @returns FFmpeg -vf / -filter_complex degeri
 */
export function verticalFilter(mode: FramingMode, stripWatermarks = false): string {
  const w = VIDEO.VERTICAL_WIDTH;
  const h = VIDEO.VERTICAL_HEIGHT;

  if (mode === 'crop') {
    if (stripWatermarks) {
      return watermarkSafeCropFilter(w, h);
    }
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
