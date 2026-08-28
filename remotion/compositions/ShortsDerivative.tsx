// =====================================
// MODULE: ShortsDerivative
// Purpose: Uzun videodan kesilmis Shorts - hook + klip + "tamami kanalda" CTA
// Dependencies: remotion, components/HookTitle, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig } from 'remotion';
import { HookTitle } from '../components/HookTitle';
import { THEME, TEXT_SHADOW } from '../theme';

export type ShortsDerivativeProps = {
  videoSrc: string;
  /** Kesitin süresi - Remotion video uzunluğunu otomatik algılamaz, dışarıdan verilmeli */
  durationSec: number;
  hookText: string;
  hookDurationSec: number;
  channelHandle: string;
  /** Uzun videoya link cagrisi - onaylanmadan once bilinmeyebilir, o zaman gosterilmez */
  ctaText?: string;
};

export function shortsDerivativeDurationInFrames(props: ShortsDerivativeProps, fps: number): number {
  return Math.round(props.durationSec * fps);
}

export const ShortsDerivative: React.FC<ShortsDerivativeProps> = ({
  videoSrc,
  hookText,
  hookDurationSec,
  channelHandle,
  ctaText,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const ctaFromFrame = Math.max(0, durationInFrames - Math.round(2.5 * fps));

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <OffthreadVideo src={videoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      <Sequence durationInFrames={Math.round(hookDurationSec * fps)}>
        <HookTitle text={hookText} />
      </Sequence>

      {ctaText && (
        <Sequence from={ctaFromFrame} durationInFrames={durationInFrames - ctaFromFrame}>
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: THEME.layout.safePadding, paddingBottom: THEME.layout.safePadding * 2 }}>
            <div
              style={{
                fontFamily: THEME.font.family,
                fontSize: THEME.font.poiBodySize * 1.1,
                fontWeight: 800,
                color: THEME.colors.ink,
                textShadow: TEXT_SHADOW,
                backgroundColor: THEME.colors.cardBg,
                borderRadius: 999,
                padding: '14px 28px',
                textAlign: 'center',
              }}
            >
              {ctaText}
            </div>
          </AbsoluteFill>
        </Sequence>
      )}

      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end', padding: THEME.layout.safePadding }}>
        <div style={{ fontFamily: THEME.font.family, fontSize: THEME.font.sourceSize * 1.3, fontWeight: 700, color: THEME.colors.inkMuted, textShadow: TEXT_SHADOW }}>
          {channelHandle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
