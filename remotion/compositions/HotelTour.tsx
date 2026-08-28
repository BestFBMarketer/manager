// =====================================
// MODULE: HotelTour
// Purpose: Drone/GoPro gezi kompozisyonu - POI yazi kartlari ucusa senkron cikar
// Dependencies: remotion, components/PoiCard, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig } from 'remotion';
import { PoiCard } from '../components/PoiCard';
import { InfoChips, type InfoChip } from '../components/InfoChips';
import { THEME, TEXT_SHADOW } from '../theme';

export type PoiCueProps = {
  name: string;
  description?: string;
  source?: string;
  atSec: number;
  durationSec: number;
}

export type HotelTourProps = {
  videoSrc: string;
  title: string;
  cues: PoiCueProps[];
  channelHandle: string;
  titleDurationSec: number;
  /** Otel gercekleri - hotelData zincirinden gelen, kaynagi olan alanlar (bkz. src/hotelData) */
  infoChips?: InfoChip[];
  /** InfoChips'in ekranda kalacagi sure - genelde intro'dan hemen sonra */
  infoChipsAtSec?: number;
  infoChipsDurationSec?: number;
}

export const HotelTour: React.FC<HotelTourProps> = ({
  videoSrc,
  title,
  cues,
  channelHandle,
  titleDurationSec,
  infoChips,
  infoChipsAtSec = 4,
  infoChipsDurationSec = 6,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill>
        {/* Kaynak eksikse render'in tamami cokmemeli - duz zemine dusulur. */}
        {videoSrc ? (
          <OffthreadVideo src={videoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <AbsoluteFill style={{ backgroundColor: '#12141c' }} />
        )}
      </AbsoluteFill>

      <Sequence durationInFrames={Math.round(titleDurationSec * fps)}>
        <AbsoluteFill style={{ justifyContent: 'flex-start', padding: THEME.layout.safePadding }}>
          <div
            style={{
              fontFamily: THEME.font.family,
              fontSize: THEME.font.poiTitleSize * 1.25,
              fontWeight: 900,
              color: THEME.colors.ink,
              textShadow: TEXT_SHADOW,
            }}
          >
            {title}
          </div>
        </AbsoluteFill>
      </Sequence>

      {infoChips && infoChips.length > 0 && (
        <Sequence from={Math.round(infoChipsAtSec * fps)} durationInFrames={Math.round(infoChipsDurationSec * fps)}>
          <InfoChips chips={infoChips} />
        </Sequence>
      )}

      {cues.map((cue, index) => (
        <Sequence
          key={`${cue.name}-${cue.atSec}`}
          from={Math.round(cue.atSec * fps)}
          durationInFrames={Math.round(cue.durationSec * fps)}
        >
          {/* Kartlar donusumlu olarak sag/sol kenara yaslanir - ekran tek tarafa yigilmasin */}
          <PoiCard
            name={cue.name}
            description={cue.description}
            source={cue.source}
            align={index % 2 === 0 ? 'left' : 'right'}
          />
        </Sequence>
      ))}

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
          padding: THEME.layout.safePadding,
        }}
      >
        <div
          style={{
            fontFamily: THEME.font.family,
            fontSize: THEME.font.sourceSize * 1.4,
            fontWeight: 700,
            color: THEME.colors.inkMuted,
            textShadow: TEXT_SHADOW,
          }}
        >
          {channelHandle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
