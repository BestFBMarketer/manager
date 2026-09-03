// =====================================
// MODULE: CaptionLine
// Purpose: Karaoke-tarzi altyazi - metin kucuk kelime-parcalarina (~4 kelime)
//          bolunup sirayla gosterilir, aktif kelime vurgulanir. Tum cumleyi
//          aynı anda göstermez (bu "paragraf" gibi durup tier tahtasina
//          taşıyordu, bkz. 2026-09-03 TierList örnek render bulgusu) - diğer
//          kanallardaki .ass karaoke altyazılarıyla aynı davraniş (max ~4
//          kelime/parça).
// Dependencies: remotion, theme
// Author: BestMarketer Team
// Last Modified: 2026-09-03
// =====================================

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME, TEXT_SHADOW } from '../theme';

export interface CaptionLineProps {
  text: string;
  /** Cumlenin okunma suresi - kelimeler buna gore dagitilir */
  durationInFrames: number;
  /** Bir parcada gosterilecek en fazla kelime sayisi (varsayilan 4) */
  maxWordsPerChunk?: number;
}

export const CaptionLine: React.FC<CaptionLineProps> = ({ text, durationInFrames, maxWordsPerChunk = 4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(/\s+/).filter(Boolean);
  const framesPerWord = words.length > 0 ? durationInFrames / words.length : durationInFrames;
  const activeWordIndex = Math.floor(frame / Math.max(1, framesPerWord));

  // Kelimeleri sabit boyutlu kucuk parcalara bol (karaoke gibi sirayla gosterilir).
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += maxWordsPerChunk) {
    chunks.push(words.slice(i, i + maxWordsPerChunk));
  }
  const activeChunkIndex = Math.min(
    chunks.length - 1,
    Math.floor(activeWordIndex / maxWordsPerChunk)
  );
  const activeChunk = chunks[Math.max(0, activeChunkIndex)] ?? [];
  const chunkStartWordIndex = Math.max(0, activeChunkIndex) * maxWordsPerChunk;

  const chunkStartFrame = Math.round(chunkStartWordIndex * framesPerWord);
  const framesIntoChunk = frame - chunkStartFrame;
  const enter = interpolate(framesIntoChunk, [0, fps * 0.15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: THEME.layout.captionBottom,
        paddingLeft: THEME.layout.safePadding,
        paddingRight: THEME.layout.safePadding,
      }}
    >
      <div
        style={{
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '92%',
          fontFamily: THEME.font.family,
          fontSize: THEME.font.captionSize,
          fontWeight: 800,
          lineHeight: 1.22,
          textAlign: 'center',
          textShadow: TEXT_SHADOW,
        }}
      >
        {activeChunk.map((word, i) => {
          const globalIndex = chunkStartWordIndex + i;
          return (
            <span
              key={`${word}-${globalIndex}`}
              style={{
                color: globalIndex <= activeWordIndex ? THEME.colors.accent : THEME.colors.ink,
                transform: globalIndex === activeWordIndex ? 'scale(1.08)' : 'scale(1)',
                display: 'inline-block',
                transition: 'none',
                marginRight: '0.4em',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
