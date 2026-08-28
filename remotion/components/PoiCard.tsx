// =====================================
// MODULE: PoiCard
// Purpose: Gezi videolarinda ilgi noktasi bilgi karti (yazi tercihli sunum)
// Dependencies: remotion, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME, TEXT_SHADOW } from '../theme';

export interface PoiCardProps {
  name: string;
  /** Kisa not - yoksa sadece baslik gosterilir, metin uydurulmaz */
  description?: string;
  /** Aciklamanin kaynagi - ekranda atif olarak basilir */
  source?: string;
  /** Kartin ekranin hangi kenarinda duracagi */
  align?: 'left' | 'right';
}

export const PoiCard: React.FC<PoiCardProps> = ({ name, description, source, align = 'left' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entry = spring({ frame, fps, config: { damping: 16, stiffness: 110, mass: 0.7 } });
  const exit = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const slide = interpolate(entry, [0, 1], [align === 'left' ? -160 : 160, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: align === 'left' ? 'flex-start' : 'flex-end',
        padding: THEME.layout.safePadding,
        paddingBottom: THEME.layout.safePadding * 2.4,
      }}
    >
      <div
        style={{
          transform: `translateX(${slide}px)`,
          opacity: Math.min(entry, exit),
          maxWidth: '76%',
          backgroundColor: THEME.colors.cardBg,
          borderLeft: align === 'left' ? `8px solid ${THEME.colors.accent}` : undefined,
          borderRight: align === 'right' ? `8px solid ${THEME.colors.accent}` : undefined,
          borderRadius: 18,
          padding: '28px 34px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            fontFamily: THEME.font.family,
            fontSize: THEME.font.poiTitleSize,
            fontWeight: 800,
            color: THEME.colors.ink,
            textShadow: TEXT_SHADOW,
            marginBottom: description ? 12 : 0,
          }}
        >
          {name}
        </div>

        {description ? (
          <div
            style={{
              fontFamily: THEME.font.family,
              fontSize: THEME.font.poiBodySize,
              fontWeight: 500,
              lineHeight: 1.4,
              color: THEME.colors.inkMuted,
            }}
          >
            {description}
          </div>
        ) : null}

        {source ? (
          <div
            style={{
              marginTop: 14,
              fontFamily: THEME.font.family,
              fontSize: THEME.font.sourceSize,
              fontWeight: 500,
              color: THEME.colors.inkMuted,
              opacity: 0.75,
            }}
          >
            Kaynak: {source}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
