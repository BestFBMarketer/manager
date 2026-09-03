// =====================================
// MODULE: TierList
// Purpose: Crash Dummy karakterinin marka reklamlarini S/A/B/C/D tier listesine
//          yerlestirdigi Shorts kompozisyonu (hook -> siralar -> kapanis)
// Dependencies: remotion, components/*, theme
// Author: BestMarketer Team
// Last Modified: 2026-09-03
// =====================================

import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionLine } from '../components/CaptionLine';
import { HookTitle } from '../components/HookTitle';
import { THEME, TEXT_SHADOW } from '../theme';

/** Prop olarak gelen video/gorsel yollari ya http(s) URL'i ya da public/ klasorune
 * gore relatif bir yoldur - ikincisi staticFile() ile Remotion'un kendi
 * dev-server'indan servis edilmeli, aksi halde 404 olusuyor. */
function resolveSrc(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//.test(src)) return src;
  return staticFile(src);
}

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D'];

export type TierListItemProps = {
  tier: Tier;
  brandLabel: string;
  /** Kisa reklam ani - kesilmis klibin yolu (staticFile veya mutlak URL) */
  clipSrc: string;
  /** Bu repligin lip-sync'li Dummy videosu (SadTalker + banner-composite, bkz composite_dummy_panel.sh) */
  dummyVideoSrc: string;
  voiceLine: string;
  durationSec: number;
};

export type TierListProps = {
  hookLine: string;
  /** Hook repliginin lip-sync'li Dummy videosu */
  hookVideoSrc: string;
  items: TierListItemProps[];
  outroLine: string;
  /** Outro repliginin lip-sync'li Dummy videosu */
  outroVideoSrc: string;
  channelHandle: string;
  hookDurationSec: number;
  outroDurationSec: number;
};

/** DummyPanel'in kapladigi yukseklik yuzdesi - tierboard_template.jpg'nin TV
 * kismi 1024px'in ilk 335px'i (%32.71). Bu kesin oran; degistirilirse
 * composite_dummy_panel.sh'deki 1080:628 scale de guncellenmeli. */
const DUMMY_PANEL_HEIGHT_PCT = 335 / 1024;

/** tier-board sablonundaki 15 slot kutusunun (5 satir x 3 sutun) 1080x1920
 * kanvasindaki MERKEZ koordinatlari - public/tierlist/tierboard_template.jpg
 * uzerinde olculdu (bkz 2026-09-03 yeniden tasarim notu). */
const SLOT_ROW_Y: Record<Tier, number> = { S: 894, A: 1091, B: 1291, C: 1493, D: 1727 };
const SLOT_COL_X = [393, 604, 831];
const SLOT_W = 175;
const SLOT_H = 140;

/** Karakter alani - TV-cerceve arkaplani (banner ile doldurulmus) ffmpeg ile
 * ONCEDEN icine gomulmus, duz (alpha'siz) video. Chroma-key/overlay ffmpeg
 * tarafinda yapiliyor (bkz tierlist/composite_dummy_panel.sh) - Remotion'un
 * OffthreadVideo transparent+ProRes4444 alpha compositing'i bu ortamda
 * guvenilmez ciktigi icin (bkz 2026-09-03 render bulgusu) bu yola gecildi. */
const DummyPanel: React.FC<{ videoSrc: string }> = ({ videoSrc }) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${DUMMY_PANEL_HEIGHT_PCT * 100}%`, overflow: 'hidden', backgroundColor: '#12141c' }}>
      {videoSrc ? <OffthreadVideo src={resolveSrc(videoSrc)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
    </div>
  );
};

type PlacedItem = { item: TierListItemProps; from: number; frames: number; slotCol: number };

/** Tam-ekrandan-slota-kuculme animasyonu icin dikdortgen. */
type Rect = { x: number; y: number; w: number; h: number };
const FULLSCREEN_RECT: Rect = { x: 0, y: 0, w: 1080, h: 1920 };

function slotRect(item: TierListItemProps, slotCol: number): Rect {
  const cx = SLOT_COL_X[slotCol] ?? SLOT_COL_X[2] ?? 831;
  const cy = SLOT_ROW_Y[item.tier];
  return { x: cx - SLOT_W / 2, y: cy - SLOT_H / 2, w: SLOT_W, h: SLOT_H };
}

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
}

/** Bir reklam klibinin tam ekran acilip sonra kendi tier-slotuna kuculerek
 * yerlesmesi. "sadece kucuk kose kutusu" onceki tasarimda kullanicinin
 * reddettigi asil sebeplerden biriydi (bkz 2026-09-03 yeniden tasarim notu):
 * video ilk FULLSCREEN_SEC saniye tam ekran oynar, sonra TRANSITION_SEC
 * icinde kendi slotuna kucularak oturur ve orada kalir. */
const AdSpot: React.FC<{ item: TierListItemProps; localFrame: number; fps: number; slotCol: number }> = ({ item, localFrame, fps, slotCol }) => {
  const fullscreenFrames = Math.round(2.4 * fps);
  const transitionFrames = Math.round(0.45 * fps);
  const target = slotRect(item, slotCol);

  let rect: Rect;
  if (localFrame < fullscreenFrames) {
    rect = FULLSCREEN_RECT;
  } else if (localFrame < fullscreenFrames + transitionFrames) {
    const t = interpolate(localFrame, [fullscreenFrames, fullscreenFrames + transitionFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const eased = t * t * (3 - 2 * t); // smoothstep
    rect = lerpRect(FULLSCREEN_RECT, target, eased);
  } else {
    rect = target;
  }

  const isFullscreen = rect.w === FULLSCREEN_RECT.w;

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: isFullscreen ? 0 : 12,
        overflow: 'hidden',
        boxShadow: isFullscreen ? 'none' : '0 4px 14px rgba(0,0,0,0.5)',
        zIndex: 20,
      }}
    >
      <OffthreadVideo src={resolveSrc(item.clipSrc)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

/** Zaten acilmis (aktif fazi biten) bir reklamin kendi slotunda sabit kalan
 * sessiz thumbnail'i. */
const PinnedThumb: React.FC<{ item: TierListItemProps; slotCol: number }> = ({ item, slotCol }) => {
  const rect = slotRect(item, slotCol);
  return (
    <div style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 12, overflow: 'hidden', zIndex: 5 }}>
      <OffthreadVideo src={resolveSrc(item.clipSrc)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

export const TierList: React.FC<TierListProps> = ({ hookLine, hookVideoSrc, items, outroLine, outroVideoSrc, channelHandle, hookDurationSec, outroDurationSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hookFrames = Math.round(hookDurationSec * fps);

  let cursor = hookFrames;
  const tierCounts: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  const placed: PlacedItem[] = items.map((item) => {
    const frames = Math.round(item.durationSec * fps);
    // Ayni tier'de en fazla 3 slot var (sablonda 3 sutun) - siradaki 4. item
    // olursa son sutuna denk gelir (mass production'da tier basina 3'u
    // gecmemeye dikkat edilmeli, bkz 2026-09-03 yeniden tasarim notu).
    const slotCol = Math.min(tierCounts[item.tier], 2);
    tierCounts[item.tier] += 1;
    const entry: PlacedItem = { item, from: cursor, frames, slotCol };
    cursor += frames;
    return entry;
  });

  const activeEntry = placed.find((p) => frame >= p.from && frame < p.from + p.frames);

  const currentDummyVideo = frame < hookFrames
    ? hookVideoSrc
    : activeEntry
      ? activeEntry.item.dummyVideoSrc
      : outroVideoSrc;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Persistent arka plan - kullanicinin verdigi gercek tier-board sablonu
          (clipboard kismi), custom-coded UI DEGIL (bkz 2026-09-03 red gerekcesi). */}
      <div style={{ position: 'absolute', top: `${DUMMY_PANEL_HEIGHT_PCT * 100}%`, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <Img src={staticFile('tierlist/tierboard_clipboard.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      <DummyPanel videoSrc={currentDummyVideo} />

      {/* Acilmis reklamlar - kendi slotlarinda sabit thumbnail olarak kalir. */}
      {placed.map((p, i) => (frame >= p.from + p.frames ? <PinnedThumb key={i} item={p.item} slotCol={p.slotCol} /> : null))}

      {/* Aktif reklam - tam ekran acilip slotuna kucularak oturur. */}
      {activeEntry ? <AdSpot item={activeEntry.item} localFrame={frame - activeEntry.from} fps={fps} slotCol={activeEntry.slotCol} /> : null}

      {placed.map(({ item, from, frames }, i) => (
        <Sequence key={i} from={from} durationInFrames={frames}>
          <CaptionLine text={item.voiceLine} durationInFrames={frames} />
        </Sequence>
      ))}

      <Sequence durationInFrames={hookFrames}>
        <HookTitle text={hookLine} />
      </Sequence>

      <Sequence from={cursor} durationInFrames={Math.round(outroDurationSec * fps)}>
        {/* Opak arka plan sart - scrim (yari saydam) kullanilirsa TV paneli ve
            tier board arkadan sizip metnin ustune bindigi bozuk gorunum
            olusuyor (bkz 2026-09-03 kullanici geri bildirimi: "kabul edilemez").
            zIndex:100 sart - PinnedThumb(5)/AdSpot(20) explicit z-index'e
            sahip, z-index:auto olsa DOM sirasi onemsiz bunlarin ALTINDA
            kalirdi (bkz 2026-09-03 v8 QA bulgusu: eski reklam thumbnail'leri
            outro'nun ustunde gorunuyordu). */}
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
export function tierListDurationInFrames(props: TierListProps, fps: number): number {
  const items = props.items.reduce((sum, item) => sum + Math.round(item.durationSec * fps), 0);
  return Math.round(props.hookDurationSec * fps) + items + Math.round(props.outroDurationSec * fps);
}
