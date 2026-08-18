// =====================================
// MODULE: HookTitle
// Purpose: Ilk saniyelerde izleyiciyi durduran acilis basligi
// Dependencies: remotion, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME, TEXT_SHADOW } from '../theme';

export interface HookTitleProps {
  text: string;
}

export const HookTitle: React.FC<HookTitleProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entry = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const exit = interpolate(
    frame,
    [durationInFrames - fps * 0.4, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: THEME.layout.safePadding,
        backgroundColor: THEME.colors.scrim,
        opacity: exit,
      }}
    >
      <div
        style={{
          transform: `scale(${interpolate(entry, [0, 1], [0.8, 1])})`,
          fontFamily: THEME.font.family,
          fontSize: THEME.font.hookSize,
          fontWeight: 900,
          color: THEME.colors.ink,
          textAlign: 'center',
          lineHeight: 1.15,
          textShadow: TEXT_SHADOW,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
