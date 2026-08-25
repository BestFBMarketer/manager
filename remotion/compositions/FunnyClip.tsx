// =====================================
// MODULE: FunnyClip
// Purpose: Kaynak klipten kesilmiş, iğneleyici yorumlu Shorts - fasıl/army vb. içerik için
// Dependencies: remotion, components/CaptionLine, components/HookTitle, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig } from 'remotion';
import { CaptionLine } from '../components/CaptionLine';
import { HookTitle } from '../components/HookTitle';
import { THEME, TEXT_SHADOW } from '../theme';

export type FunnyClipProps = {
  /** Kesilmiş, dikeye çevrilmiş klip yolu - sesi zaten miksajlanmış (orijinal ses + yorum) */
  videoSrc: string;
  durationSec: number;
  hookText: string;
  hookDurationSec: number;
  /** Karaoke altyazı olarak gösterilecek yorum metni */
  commentaryScript: string;
  channelHandle: string;
};

export const FunnyClip: React.FC<FunnyClipProps> = ({
  videoSrc,
  durationSec,
  hookText,
  hookDurationSec,
  commentaryScript,
  channelHandle,
}) => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <OffthreadVideo src={videoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      <CaptionLine text={commentaryScript} durationInFrames={durationInFrames} />

      <Sequence durationInFrames={Math.round(hookDurationSec * fps)}>
        <HookTitle text={hookText} />
      </Sequence>

      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end', padding: THEME.layout.safePadding }}>
        <div style={{ fontFamily: THEME.font.family, fontSize: THEME.font.sourceSize * 1.3, fontWeight: 700, color: THEME.colors.inkMuted, textShadow: TEXT_SHADOW }}>
          {channelHandle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export function funnyClipDurationInFrames(props: FunnyClipProps, fps: number): number {
  return Math.round(props.durationSec * fps);
}
