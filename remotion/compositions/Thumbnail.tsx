// =====================================
// MODULE: Thumbnail
// Purpose: YouTube kapak resmi - video karesi + vurucu metin, tek kare (still)
// Dependencies: remotion, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { AbsoluteFill, Img } from 'remotion';
import { THEME, TEXT_SHADOW } from '../theme';

export type ThumbnailProps = {
  /** ffmpeg ile videodan çıkarılmış kare - kaynak yoksa düz zemine düşülür */
  imageSrc?: string;
  /** channelWriter.ts'in ürettiği thumbnailText (en fazla 4 kelime) */
  text: string;
};

export const Thumbnail: React.FC<ThumbnailProps> = ({ imageSrc, text }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#12141c' }}>
      {imageSrc && <Img src={imageSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}

      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)' }} />

      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-start', padding: 64 }}>
        <div
          style={{
            fontFamily: THEME.font.family,
            fontSize: 110,
            fontWeight: 900,
            color: THEME.colors.ink,
            lineHeight: 1.05,
            textShadow: TEXT_SHADOW,
            maxWidth: '90%',
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
