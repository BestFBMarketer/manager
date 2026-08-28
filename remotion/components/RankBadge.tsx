// =====================================
// MODULE: RankBadge
// Purpose: Geri sayim sira numarasi (#5 ... #1) - yaylanarak girer
// Dependencies: remotion, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME, TEXT_SHADOW } from '../theme';

export interface RankBadgeProps {
  rank: number;
  /** En yuksek sira (#1) vurgulanir */
  isFinal: boolean;
}

export const RankBadge: React.FC<RankBadgeProps> = ({ rank, isFinal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({ frame, fps, config: { damping: 12, stiffness: 140, mass: 0.6 } });
  const scale = interpolate(entry, [0, 1], [0.45, 1]);
  // Rozet girisin ardindan hafifce kucululup ekranin kosesine cekilir.
  const settle = interpolate(frame, [fps * 0.9, fps * 1.5], [1, 0.42], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const driftY = interpolate(frame, [fps * 0.9, fps * 1.5], [0, -520], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          transform: `translateY(${driftY}px) scale(${scale * settle})`,
          fontFamily: THEME.font.family,
          fontSize: THEME.font.rankSize,
          fontWeight: 900,
          letterSpacing: -8,
          color: isFinal ? THEME.colors.accent : THEME.colors.ink,
          textShadow: TEXT_SHADOW,
          WebkitTextStroke: isFinal ? `6px ${THEME.colors.accentDeep}` : 'none',
        }}
      >
        #{rank}
      </div>
    </AbsoluteFill>
  );
};
