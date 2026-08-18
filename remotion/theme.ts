// =====================================
// MODULE: Remotion Theme
// Purpose: Tum kompozisyonlarin paylastigi renk, tipografi ve olcu sabitleri
// Dependencies: remotion (staticFile)
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { staticFile } from 'remotion';

/**
 * Font YERELDEN yuklenir, CDN'den degil.
 *
 * @remotion/google-fonts fontu render aninda fonts.gstatic.com'dan ceker;
 * ag kesintisinde veya kisitli agda render tamamen coker. Bunun yerine
 * font dosyasi public/fonts/ altina konur ve staticFile ile paketlenir.
 *
 * Font dosyasi yoksa asagidaki yigin devreye girer: DejaVu Sans ve
 * Liberation Sans Linux sunucularda standarttir ve Turkce karakterleri
 * (ıİğĞüÜşŞöÖçÇ) tam destekler - tasarim bozulmaz, sadece harf sekli degisir.
 */
export const FONT_STACK =
  '"InterLocal", "Inter", "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Arial, sans-serif';

/** public/fonts/ altindaki dosyalari @font-face olarak tanimlar. */
export function fontFaceCss(): string {
  const face = (file: string, weight: number) => `
@font-face {
  font-family: 'InterLocal';
  src: url('${staticFile(`fonts/${file}`)}') format('woff2');
  font-weight: ${weight};
  font-style: normal;
  font-display: block;
}`;

  return [
    face('Inter-Medium.woff2', 500),
    face('Inter-ExtraBold.woff2', 800),
    face('Inter-Black.woff2', 900),
  ].join('\n');
}

export const THEME = {
  colors: {
    accent: '#FFD84D',
    accentDeep: '#FF8A3D',
    ink: '#FFFFFF',
    inkMuted: 'rgba(255,255,255,0.72)',
    shadow: 'rgba(0,0,0,0.85)',
    scrim: 'rgba(0,0,0,0.45)',
    cardBg: 'rgba(12,14,20,0.82)',
  },
  font: {
    family: FONT_STACK,
    captionSize: 62,
    rankSize: 260,
    hookSize: 84,
    poiTitleSize: 52,
    poiBodySize: 32,
    sourceSize: 22,
  },
  layout: {
    safePadding: 72,
    captionBottom: 300,
  },
} as const;

/** Video uzerindeki metinlerin her arka planda okunabilmesi icin gereken golge. */
export const TEXT_SHADOW =
  '0 4px 18px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.95)';
