// =====================================
// MODULE: CaptionLine
// Purpose: Seslendirme altyazisi - kelime kelime vurgulanir
// Dependencies: remotion, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME, TEXT_SHADOW } from '../theme';

export interface CaptionLineProps {
  text: string;
  /** Cumlenin okunma suresi - kelimeler buna gore dagitilir */
  durationInFrames: number;
}

export const CaptionLine: React.FC<CaptionLineProps> = ({ text, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(/\s+/).filter(Boolean);
  const framesPerWord = words.length > 0 ? durationInFrames / words.length : durationInFrames;
  const activeIndex = Math.floor(frame / Math.max(1, framesPerWord));

  const enter = interpolate(frame, [0, fps * 0.25], [0, 1], {
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
          transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0 18px',
          fontFamily: THEME.font.family,
          fontSize: THEME.font.captionSize,
          fontWeight: 800,
          lineHeight: 1.22,
          textAlign: 'center',
          textShadow: TEXT_SHADOW,
        }}
      >
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            style={{
              color: index <= activeIndex ? THEME.colors.accent : THEME.colors.ink,
              transform: index === activeIndex ? 'scale(1.08)' : 'scale(1)',
              display: 'inline-block',
              transition: 'none',
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
