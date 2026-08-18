// =====================================
// MODULE: FunnyRanking
// Purpose: Geri sayimli Top-5 Shorts kompozisyonu (hook -> siralar -> kapanis)
// Dependencies: remotion, components/*, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig } from 'remotion';
import { CaptionLine } from '../components/CaptionLine';
import { HookTitle } from '../components/HookTitle';
import { RankBadge } from '../components/RankBadge';
import { THEME, TEXT_SHADOW } from '../theme';

export type RankingItemProps = {
  rank: number;
  /** Kesilmis klibin yolu (staticFile veya mutlak URL) */
  videoSrc: string;
  voiceLine: string;
  durationSec: number;
}

export type FunnyRankingProps = {
  hookLine: string;
  items: RankingItemProps[];
  outroLine: string;
  channelHandle: string;
  hookDurationSec: number;
  outroDurationSec: number;
}

export const FunnyRanking: React.FC<FunnyRankingProps> = ({
  hookLine,
  items,
  outroLine,
  channelHandle,
  hookDurationSec,
  outroDurationSec,
}) => {
  const { fps } = useVideoConfig();
  const hookFrames = Math.round(hookDurationSec * fps);

  // Siralar hook'tan sonra pes pese dizilir.
  let cursor = hookFrames;
  const placed = items.map((item) => {
    const frames = Math.round(item.durationSec * fps);
    const entry = { item, from: cursor, frames };
    cursor += frames;
    return entry;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {placed.map(({ item, from, frames }) => (
        <Sequence key={item.rank} from={from} durationInFrames={frames}>
          <AbsoluteFill>
            {/* Klip eksikse render'in tamami cokmemeli - duz zemine dusulur. */}
            {item.videoSrc ? (
              <OffthreadVideo
                src={item.videoSrc}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <AbsoluteFill style={{ backgroundColor: '#12141c' }} />
            )}
          </AbsoluteFill>
          <RankBadge rank={item.rank} isFinal={item.rank === 1} />
          <CaptionLine text={item.voiceLine} durationInFrames={frames} />
        </Sequence>
      ))}

      {/* Hook en uste cizilir ki ilk klibin uzerinde dursun */}
      <Sequence durationInFrames={hookFrames}>
        <HookTitle text={hookLine} />
      </Sequence>

      <Sequence from={cursor} durationInFrames={Math.round(outroDurationSec * fps)}>
        <AbsoluteFill
          style={{
            backgroundColor: THEME.colors.scrim,
            justifyContent: 'center',
            alignItems: 'center',
            padding: THEME.layout.safePadding,
          }}
        >
          <div
            style={{
              fontFamily: THEME.font.family,
              fontSize: THEME.font.hookSize,
              fontWeight: 900,
              color: THEME.colors.ink,
              textAlign: 'center',
              textShadow: TEXT_SHADOW,
            }}
          >
            {outroLine}
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: THEME.font.family,
              fontSize: THEME.font.poiTitleSize,
              fontWeight: 800,
              color: THEME.colors.accent,
              textShadow: TEXT_SHADOW,
            }}
          >
            {channelHandle}
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

/** Kompozisyonun toplam suresini props'tan hesaplar. */
export function rankingDurationInFrames(props: FunnyRankingProps, fps: number): number {
  const items = props.items.reduce((sum, item) => sum + Math.round(item.durationSec * fps), 0);
  return Math.round(props.hookDurationSec * fps) + items + Math.round(props.outroDurationSec * fps);
}
