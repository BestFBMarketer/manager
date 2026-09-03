// =====================================
// MODULE: FunnyRanking
// Purpose: Geri sayimli Top-5 Shorts kompozisyonu - kanalin gercek yayinlanmis
//          sablonuna gore (banner + sabit baslik cubugu + cerceveli klip +
//          rozet + karaoke altyazi), hook -> siralar -> kapanis
// Dependencies: remotion, components/*, theme
// Author: BestMarketer Team
// Last Modified: 2026-09-04
// =====================================

import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { CaptionLine } from '../components/CaptionLine';
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
  /** Hook repliginin TTS ses dosyasi - hook'ta arkada gorunen klip zaten
   * kendi seslendirmesiyle geliyor, hook sesi ayri katman olarak calinmali. */
  hookAudioSrc?: string;
  /** Sabit ust baslik cubugunda goruntulenen kisa, tum video boyunca sabit
   * kalan metin (orn "TOP 5 POOL FAILS OF THE WEEK") - kanalin gercek
   * yayinlanmis videolarindaki sablonla eslesir (bkz 2026-09-04, 10k izlenmeli
   * referans video incelemesi). */
  titleLabel: string;
  items: RankingItemProps[];
  outroLine: string;
  /** Outro repliginin TTS ses dosyasi - ayni sebepten burada calinmali. */
  outroAudioSrc?: string;
  channelHandle: string;
  hookDurationSec: number;
  outroDurationSec: number;
}

/** Banner + sabit baslik cubugu - tum video boyunca degismeden durur (kanalin
 * gercek sablonu, bkz referans video). */
const TopChrome: React.FC<{ titleLabel: string }> = ({ titleLabel }) => (
  <>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BANNER_H, overflow: 'hidden' }}>
      <Img src={staticFile('tierlist/channel_banner.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
    <div
      style={{
        position: 'absolute',
        top: BANNER_H,
        left: 0,
        right: 0,
        height: TITLE_BAR_H,
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <div
        style={{
          fontFamily: THEME.font.family,
          fontSize: 40,
          fontWeight: 900,
          color: THEME.colors.ink,
          textAlign: 'center',
          textTransform: 'uppercase',
          padding: '0 24px',
        }}
      >
        {titleLabel}
      </div>
    </div>
  </>
);

/** Klip alani - arkada bulanik/buyutulmus ayni video (kenar bosluklarini
 * doldurur), onde net video contain ile ortalanir. Kanalin gercek
 * sablonundaki "cerceveli klip" gorunumu. */
const FramedClip: React.FC<{ src: string; muted?: boolean }> = ({ src, muted }) => {
  if (!src) return <AbsoluteFill style={{ backgroundColor: '#12141c' }} />;
  const resolved = resolveSrc(src);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <OffthreadVideo src={resolved} muted style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(30px) brightness(0.55)', transform: 'scale(1.15)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <OffthreadVideo src={resolved} muted={muted} style={{ width: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BANNER_H = 220;
const TITLE_BAR_H = 76;
const CLIP_TOP = BANNER_H + TITLE_BAR_H;
const CAPTION_BAR_H = 260;

export const FunnyRanking: React.FC<FunnyRankingProps> = ({
  hookLine: _hookLine,
  hookAudioSrc,
  titleLabel,
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

  const firstVideo = placed[0]?.item.videoSrc ?? '';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Hook fazi - ilk itemin klibi sessiz onizleme olarak arkada oynar,
          kanalin gercek sablonunda ayri siyah "hook" ekrani yok. Kendi
          Sequence'i icinde olmasi SART - Sequence disinda OffthreadVideo
          global frame'i klip-ici zaman sanip klibin suresini asinca donuk/
          sessiz kaliyordu (bkz 2026-09-04 kullanici bulgusu: "ses yok donuk
          ekran"). Her klip artik kendi Sequence'inde 0'dan baslar. */}
      {hookFrames > 0 ? (
        <Sequence durationInFrames={hookFrames}>
          <div style={{ position: 'absolute', top: CLIP_TOP, left: 0, right: 0, bottom: CAPTION_BAR_H }}>
            <FramedClip src={firstVideo} muted />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: CAPTION_BAR_H, overflow: 'hidden' }}>
            {firstVideo ? (
              <OffthreadVideo
                src={resolveSrc(firstVideo)}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(30px) brightness(0.5)', transform: 'scale(1.3) translateY(-20%)' }}
              />
            ) : (
              <AbsoluteFill style={{ backgroundColor: '#0c0d13' }} />
            )}
          </div>
          {hookAudioSrc ? <Audio src={resolveSrc(hookAudioSrc)} /> : null}
        </Sequence>
      ) : null}

      {placed.map(({ item, from, frames }) => (
        <Sequence key={item.rank} from={from} durationInFrames={frames}>
          <div style={{ position: 'absolute', top: CLIP_TOP, left: 0, right: 0, bottom: CAPTION_BAR_H }}>
            <FramedClip src={item.videoSrc} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: CAPTION_BAR_H, overflow: 'hidden' }}>
            {item.videoSrc ? (
              <OffthreadVideo
                src={resolveSrc(item.videoSrc)}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(30px) brightness(0.5)', transform: 'scale(1.3) translateY(-20%)' }}
              />
            ) : (
              <AbsoluteFill style={{ backgroundColor: '#0c0d13' }} />
            )}
          </div>
          <RankBadge rank={item.rank} isFinal={item.rank === 1} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: CAPTION_BAR_H, display: 'flex', alignItems: 'center' }}>
            <CaptionLine text={item.voiceLine} durationInFrames={frames} />
          </div>
        </Sequence>
      ))}

      <TopChrome titleLabel={titleLabel} />

      <Sequence from={cursor} durationInFrames={Math.round(outroDurationSec * fps)}>
        {outroAudioSrc ? <Audio src={resolveSrc(outroAudioSrc)} /> : null}
        {/* Opak arka plan sart - scrim (yari saydam) kullanilirsa arkadaki
            son klip karesi sizip metnin ustune bindigi bozuk gorunum
            olusuyor (bkz 2026-09-03 kullanici geri bildirimi, TierList'in
            ayni hatasi - bkz TierList.tsx). zIndex:100 sart, ust chrome
            (TopChrome) ve rozet gibi elemanlarin ustunde kalmali. */}
        <AbsoluteFill
          style={{
            backgroundColor: '#0c0d13',
            justifyContent: 'center',
            alignItems: 'center',
            padding: THEME.layout.safePadding,
            zIndex: 100,
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
