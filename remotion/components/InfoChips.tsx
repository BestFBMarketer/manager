// =====================================
// MODULE: InfoChips
// Purpose: Otel bilgi kartlari (oda sayisi, kapasite, mesafe, puan) - sirayla girer
// Dependencies: remotion, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME, TEXT_SHADOW } from '../theme';

export interface InfoChip {
  icon: string;
  label: string;
  /** Kaynak atfi - HotelFacts.source'tan gelir, uydurma deger basilmasin diye zorunlu */
  source: string;
}

export interface InfoChipsProps {
  chips: InfoChip[];
  /** Her kartin girisi arasindaki gecikme (kare) */
  staggerFrames?: number;
}

/**
 * Bilinen otel gerceklerini sirayla giren kucuk kartlar olarak gosterir.
 * Bir alan bilinmiyorsa (HotelFacts'te yoksa) burada da gorunmez - caller
 * eksik alanlari zaten filtrelemis olarak `chips`'e verir.
 */
export const InfoChips: React.FC<InfoChipsProps> = ({ chips, staggerFrames = 12 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (chips.length === 0) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        padding: THEME.layout.safePadding,
        paddingBottom: THEME.layout.safePadding * 6,
        gap: 10,
      }}
    >
      {chips.map((chip, index) => {
        const localFrame = frame - index * staggerFrames;
        const entry = spring({ frame: localFrame, fps, config: { damping: 16, stiffness: 120, mass: 0.6 } });
        if (localFrame < 0) return null;

        return (
          <div
            key={`${chip.icon}-${chip.label}`}
            style={{
              transform: `translateX(${interpolate(entry, [0, 1], [-120, 0])}px)`,
              opacity: entry,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: THEME.colors.cardBg,
              borderRadius: 999,
              padding: '10px 22px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span style={{ fontSize: THEME.font.poiBodySize * 1.2 }}>{chip.icon}</span>
            <span
              style={{
                fontFamily: THEME.font.family,
                fontSize: THEME.font.poiBodySize,
                fontWeight: 700,
                color: THEME.colors.ink,
                textShadow: TEXT_SHADOW,
              }}
            >
              {chip.label}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
