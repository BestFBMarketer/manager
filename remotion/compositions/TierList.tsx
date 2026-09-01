// =====================================
// MODULE: TierList
// Purpose: Crash Dummy karakterinin marka reklamlarini S/A/B/C/D tier listesine
//          yerlestirdigi Shorts kompozisyonu (hook -> siralar -> kapanis)
// Dependencies: remotion, components/*, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-31
// =====================================

import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionLine } from '../components/CaptionLine';
import { HookTitle } from '../components/HookTitle';
import { THEME, TEXT_SHADOW } from '../theme';

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

const TIER_COLORS: Record<Tier, string> = {
  S: '#FF6B6B',
  A: '#FFA94D',
  B: '#FFD43B',
  C: '#69DB7C',
  D: '#4DABF7',
};

const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D'];

export type TierListItemProps = {
  tier: Tier;
  brandLabel: string;
  /** Kisa reklam ani (2-4sn) - kesilmis klibin yolu (staticFile veya mutlak URL) */
  clipSrc: string;
  voiceLine: string;
  durationSec: number;
};

export type TierListProps = {
  hookLine: string;
  items: TierListItemProps[];
  outroLine: string;
  channelHandle: string;
  /** Karakterin statik gorseli - yesil ekran/arka plan zaten gorselde islenmis olmali */
  dummyImageSrc: string;
  hookDurationSec: number;
  outroDurationSec: number;
};

/** Karakter alani - hafif zoom/pan ile statik gorseli canlandirir. */
const DummyPanel: React.FC<{ imageSrc: string }> = ({ imageSrc }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.06], { extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '38%', overflow: 'hidden', backgroundColor: '#1a1c26' }}>
      {imageSrc ? (
        <Img
          src={imageSrc}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})` }}
        />
      ) : null}
    </div>
  );
};

/** Su ana kadar acilmis sirlarin biriktigi tier panosu - yeni giren slot yaylanarak buyur. */
const TierBoard: React.FC<{ items: TierListItemProps[]; revealedCount: number; fps: number; frame: number; lastRevealFrame: number }> = ({
  items,
  revealedCount,
  fps,
  frame,
  lastRevealFrame,
}) => {
  const byTier: Record<Tier, TierListItemProps[]> = { S: [], A: [], B: [], C: [], D: [] };
  items.slice(0, revealedCount).forEach((item) => byTier[item.tier].push(item));

  return (
    <div
      style={{
        position: 'absolute',
        top: '38%',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0c0d13',
        padding: '24px 28px',
        gap: 10,
      }}
    >
      {TIER_ORDER.map((tier) => (
        <div key={tier} style={{ display: 'flex', alignItems: 'stretch', flex: 1, gap: 12 }}>
          <div
            style={{
              width: 76,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: TIER_COLORS[tier],
              borderRadius: 12,
              fontFamily: THEME.font.family,
              fontWeight: 900,
              fontSize: 44,
              color: '#14151c',
            }}
          >
            {tier}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '0 12px' }}>
            {byTier[tier].map((item, i) => {
              const globalIndex = items.indexOf(item);
              const isNewest = globalIndex === revealedCount - 1;
              const entry = isNewest
                ? spring({ frame: frame - lastRevealFrame, fps, config: { damping: 11, stiffness: 160, mass: 0.5 } })
                : 1;
              return (
                <div
                  key={i}
                  style={{
                    transform: `scale(${interpolate(entry, [0, 1], [0.3, 1])})`,
                    width: 88,
                    height: 88,
                    borderRadius: 10,
                    overflow: 'hidden',
                    backgroundColor: '#222436',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: THEME.font.family,
                    fontWeight: 800,
                    fontSize: 15,
                    color: THEME.colors.ink,
                    textAlign: 'center',
                    flexShrink: 0,
                    border: `2px solid ${TIER_COLORS[tier]}`,
                  }}
                >
                  {item.brandLabel}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export const TierList: React.FC<TierListProps> = ({ hookLine, items, outroLine, channelHandle, dummyImageSrc, hookDurationSec, outroDurationSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hookFrames = Math.round(hookDurationSec * fps);

  let cursor = hookFrames;
  const placed = items.map((item) => {
    const frames = Math.round(item.durationSec * fps);
    const entry = { item, from: cursor, frames };
    cursor += frames;
    return entry;
  });

  const revealedCount = placed.filter((p) => frame >= p.from).length;
  const lastRevealFrame = revealedCount > 0 ? placed[revealedCount - 1]!.from : 0;
  const activeEntry = placed.find((p) => frame >= p.from && frame < p.from + p.frames);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <DummyPanel imageSrc={dummyImageSrc} />
      <TierBoard items={items} revealedCount={revealedCount} fps={fps} frame={frame} lastRevealFrame={lastRevealFrame} />

      {/* Aktif klip - karakter panelinin ustunde kucuk bir "spot" olarak oynar */}
      {activeEntry?.item.clipSrc ? (
        <div
          style={{
            position: 'absolute',
            top: '4%',
            right: '6%',
            width: '38%',
            aspectRatio: '9 / 16',
            borderRadius: 16,
            overflow: 'hidden',
            border: `4px solid ${TIER_COLORS[activeEntry.item.tier]}`,
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          }}
        >
          <OffthreadVideo src={activeEntry.item.clipSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : null}

      {placed.map(({ item, from, frames }, i) => (
        <Sequence key={i} from={from} durationInFrames={frames}>
          <CaptionLine text={item.voiceLine} durationInFrames={frames} />
        </Sequence>
      ))}

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
export function tierListDurationInFrames(props: TierListProps, fps: number): number {
  const items = props.items.reduce((sum, item) => sum + Math.round(item.durationSec * fps), 0);
  return Math.round(props.hookDurationSec * fps) + items + Math.round(props.outroDurationSec * fps);
}
