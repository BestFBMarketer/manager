// =====================================
// MODULE: FunnyRanking
// Purpose: Geri sayimli Top-5 Shorts kompozisyonu (hook -> siralar -> kapanis)
// Dependencies: remotion, components/*, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { CaptionLine } from '../components/CaptionLine';
import { HookTitle } from '../components/HookTitle';
import { RankBadge } from '../components/RankBadge';
import { THEME, TEXT_SHADOW } from '../theme';

/** Prop olarak gelen yol http(s) URL'i ya da public/ klasorune gore relatif bir
 * yol olabilir - ikincisi staticFile() ile servis edilmeli. */
function resolveSrc(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//.test(src)) return src;
  return staticFile(src);
}

export type RankingItemProps = {
  rank: number;
  /** Kesilmis klibin yolu (staticFile veya mutlak URL) */
  videoSrc: string;
  voiceLine: string;
  durationSec: number;
}

export type FunnyRankingProps = {
  hookLine: string;
  /** Hook repliginin TTS ses dosyasi - hook'ta arkada video olmadigi icin
   * sesi tasiyacak baska katman yok, burada ayrica calinmali. */
  hookAudioSrc?: string;
  items: RankingItemProps[];
  outroLine: string;
  /** Outro repliginin TTS ses dosyasi - ayni sebepten burada calinmali. */
  outroAudioSrc?: string;
  channelHandle: string;
  hookDurationSec: number;
  outroDurationSec: number;
}

export const FunnyRanking: React.FC<FunnyRankingProps> = ({
  hookLine,
  hookAudioSrc,
  items,
  outroLine,
  outroAudioSrc,
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
            {/* Klip eksikse render'in tamami cokmemeli - duz zemine dusulur.
                Ses ayri bir muzik/altyazi katmani degil - item.videoSrc render
                oncesinde zaten seslendirme ile miksajlanmis geliyor (bkz.
                worker/stages/funnyRanking.ts), bu yuzden burada mute EDILMEZ. */}
            {item.videoSrc ? (
              <OffthreadVideo
                src={resolveSrc(item.videoSrc)}
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
        {hookAudioSrc ? <Audio src={resolveSrc(hookAudioSrc)} /> : null}
      </Sequence>

      <Sequence from={cursor} durationInFrames={Math.round(outroDurationSec * fps)}>
        {outroAudioSrc ? <Audio src={resolveSrc(outroAudioSrc)} /> : null}
        {/* Opak arka plan sart - scrim (yari saydam) kullanilirsa arkadaki
            son klip karesi sizip metnin ustune bindigi bozuk gorunum
            olusuyor (bkz 2026-09-03 kullanici geri bildirimi, TierList'in
            ayni hatasi - bkz TierList.tsx). */}
        <AbsoluteFill
          style={{
            backgroundColor: '#0c0d13',
            justifyContent: 'center',
            alignItems: 'center',
            padding: THEME.layout.safePadding,
          }}
        >
          <div
            style={{
              fontFamily: THEME.font.family,
              fontSize: THEME.font.poiTitleSize + 8,
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
