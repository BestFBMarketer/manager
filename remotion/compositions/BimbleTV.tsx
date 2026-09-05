// =====================================
// MODULE: BimbleTV
// Purpose: Bimble TV kompozisyonu - beat basina sabit-seed duygu gorseli + altyazi + tek-seferlik SFX
// Dependencies: remotion, theme
// Author: BestMarketer Team
// Last Modified: 2026-09-04
// =====================================

import { AbsoluteFill, Audio, Img, Sequence, staticFile, useVideoConfig, useCurrentFrame, interpolate } from 'remotion';
import { THEME } from '../theme';

/** Toddler icin canli/eglenceli karaoke renk paleti - kelime bazinda donguleniyor. */
const KARAOKE_COLORS = ['#FF6B6B', '#FFB84D', '#4DC8E8', '#7ED957', '#FF8FCB', '#FFD84D'];

/**
 * Karaoke tarzi kelime-kelime altyazi - toddler icin buyuk/zipla-yan/renkli.
 * Gercek kelime zaman damgasi yok (bkz AUDIT.md P1, tum pipeline'in bilinen
 * sinirlamasi - Voicebox da word-timing donmuyor), esit-bolme yaklasimi
 * kullanilir (CaptionLine.tsx ile ayni teknik) - senkron mukemmel degil ama
 * gorsel enerji/renk cok daha guclu, statik metin kutusundan cok daha iyi.
 */
function KaraokeCaption({ text, durationInFrames }: { text: string; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/).filter(Boolean);
  const framesPerWord = words.length > 0 ? durationInFrames / words.length : durationInFrames;
  const activeWordIndex = Math.floor(frame / Math.max(1, framesPerWord));

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: THEME.layout.safePadding, paddingBottom: 90 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '86%',
          rowGap: 14,
        }}
      >
        {words.map((word, i) => {
          const isActive = i === activeWordIndex;
          const isPast = i < activeWordIndex;
          const framesIntoWord = frame - Math.round(i * framesPerWord);
          const pop = isActive
            ? interpolate(framesIntoWord, [0, 4, 10], [1, 1.35, 1.12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            : 1;
          return (
            <span
              key={`${word}-${i}`}
              style={{
                fontFamily: THEME.font.family,
                fontSize: 78,
                fontWeight: 900,
                marginRight: 18,
                display: 'inline-block',
                transform: `scale(${pop}) rotate(${isActive ? -2 : 0}deg)`,
                color: isPast || isActive ? KARAOKE_COLORS[i % KARAOKE_COLORS.length] : '#FFFFFF',
                WebkitTextStroke: '5px #4A1B0C',
                paintOrder: 'stroke fill',
                opacity: isPast || isActive ? 1 : 0.55,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

export type BimbleEmotion = 'calm' | 'happy' | 'sad' | 'bigfeeling' | 'proud';

export type BimbleBeat = {
  emotion: BimbleEmotion;
  text: string;
  durationSec: number;
  sfx?: 'chime_breath' | 'pop_sparkle' | 'giggle' | 'tada';
};

export type BimbleTVProps = {
  title: string;
  beats: BimbleBeat[];
  channelHandle: string;
  titleDurationSec: number;
  /** Kapanis nakarati - son beat'in ustune eklenen ekstra sabit-sureli sahne */
  chorus: string[];
  chorusDurationSec: number;
};

const EMOTION_IMAGE: Record<BimbleEmotion, string> = {
  calm: staticFile('bimble/calm.png'),
  happy: staticFile('bimble/happy.png'),
  sad: staticFile('bimble/sad.png'),
  bigfeeling: staticFile('bimble/bigfeeling.png'),
  proud: staticFile('bimble/proud.png'),
};

const SFX_FILE: Record<NonNullable<BimbleBeat['sfx']>, string> = {
  chime_breath: staticFile('bimble/sfx/chime_breath.mp3'),
  pop_sparkle: staticFile('bimble/sfx/pop_sparkle.mp3'),
  giggle: staticFile('bimble/sfx/giggle.mp3'),
  tada: staticFile('bimble/sfx/tada.mp3'),
};

/** Kisa/hizli crossfade - beat degisiminde sert kesme yerine ~6 karelik yumusak gecis (bkz DEVAM_NOTU animasyon karari). */
const CROSSFADE_FRAMES = 6;

/**
 * Her duygu FARKLI bir hareket dili tasir - toddler dikkatini canli tutmak
 * icin ayni "zippla" hepsinde tekrarlanmiyor (bkz 2026-09-04 kullanici geri
 * bildirimi). freqHz = saniyede dongu, bounceY/scale/rotate = genlik,
 * driftY = net dusey kayma (uzgun asagi sarkiyor, gururlu yukari yuzuyor).
 */
const MOTION_PROFILE: Record<BimbleEmotion, { freqHz: number; bounceY: number; scaleAmp: number; rotateDeg: number; driftY: number }> = {
  calm: { freqHz: 0.5, bounceY: 8, scaleAmp: 0.015, rotateDeg: 1.5, driftY: 0 },
  happy: { freqHz: 2.2, bounceY: 26, scaleAmp: 0.06, rotateDeg: 4, driftY: -6 },
  sad: { freqHz: 0.35, bounceY: 5, scaleAmp: 0.01, rotateDeg: 1, driftY: 22 },
  bigfeeling: { freqHz: 4.5, bounceY: 7, scaleAmp: 0.02, rotateDeg: 3.5, driftY: 0 },
  proud: { freqHz: 0.8, bounceY: 12, scaleAmp: 0.04, rotateDeg: 2, driftY: -14 },
};

/**
 * Kaynak PNG'lerdeki (1024x576, sabit-seed) agiz konumu - goz-kontrolu ile
 * olculdu. Konusma sirasinda bu noktaya kod-cizimi bir agiz-acikligi bindirilir
 * (gercek AI parca-ayirma denendi, FLUX izole parca vermek yerine hep tam
 * karakter cizdi - 2026-09-04 bulgusu - bu yuzden kod-tabanli overlay yolu
 * secildi, harici rig aracina bagli degil).
 */
const MOUTH_POSITION: Record<BimbleEmotion, { xPct: number; yPct: number }> = {
  calm: { xPct: 50, yPct: 46 },
  happy: { xPct: 50, yPct: 54 },
  sad: { xPct: 50, yPct: 46 },
  bigfeeling: { xPct: 50, yPct: 47 },
  proud: { xPct: 50, yPct: 45 },
};

const SOURCE_ASPECT = 1024 / 576;

/**
 * Konusma sirasinda ritmik acilip-kapanan agiz overlay'i - gercek ses genligi
 * degil (bkz not), sabit ~5Hz hece hizinda flap. Kapaliyken tamamen gorunmez
 * (orijinal cizili agiz aynen kalir), aciliyken kucuk koyu oval belirir.
 */
function MouthFlap({ emotion, seedIndex }: { emotion: BimbleEmotion; seedIndex: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pos = MOUTH_POSITION[emotion];
  const flapHz = 5; // ortalama toddler-anlatim hece hizina yakin
  const phase = (seedIndex * 1.3) % (Math.PI * 2);
  const openness = Math.max(0, Math.sin((frame / fps) * flapHz * Math.PI * 2 + phase));

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.xPct}%`,
        top: `${pos.yPct}%`,
        width: 34,
        height: 14 + openness * 22,
        marginLeft: -17,
        marginTop: -7,
        borderRadius: '50%',
        backgroundColor: '#4A1B0C',
        opacity: openness > 0.12 ? 1 : 0,
      }}
    />
  );
}

/**
 * Sequence'in kendi lokal zaman cizelgesinde ilk CROSSFADE_FRAMES kare boyunca
 * 0->1 opacity - onceki beat'in ustune yumusak gecis. Karakter ayrica sabit
 * durmuyor - hafif "nefes alma" bounce (dikey sin dalgasi + kucuk olcek
 * pulsu) statik resmi canli hissettiriyor (bkz 2026-09-04 kullanici geri
 * bildirimi: statik resim toddler'i baglamaz, tam kare animasyonu ayri/daha
 * buyuk bir yatirim, bu ucuz "idle animation" ara cozum).
 */
function EmotionVisual({ emotion, seedIndex = 0, talking = false }: { emotion: BimbleEmotion; seedIndex?: number; talking?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], { extrapolateRight: 'clamp' });

  const m = MOTION_PROFILE[emotion];
  // Beat index'e gore faz kaymasi - ayni duygu tekrar etse bile ("her farkli
  // sahne" - 2026-09-04 kullanici geri bildirimi) hareket birebir aynı tekrar etmesin.
  const phase = (seedIndex * 0.9) % (Math.PI * 2);
  const t = (frame / fps) * m.freqHz * Math.PI * 2 + phase;
  const bounceY = Math.sin(t) * m.bounceY + m.driftY;
  const scale = 1 + Math.sin(t + Math.PI / 4) * m.scaleAmp;
  const rotate = Math.sin(t * 0.7) * m.rotateDeg;

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF7EC' }}>
        <div
          style={{
            position: 'relative',
            width: '70%',
            aspectRatio: `${SOURCE_ASPECT}`,
            transform: `translateY(${bounceY}px) scale(${scale}) rotate(${rotate}deg)`,
          }}
        >
          <Img src={EMOTION_IMAGE[emotion]} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          {talking && <MouthFlap emotion={emotion} seedIndex={seedIndex} />}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const BimbleTV: React.FC<BimbleTVProps> = ({ title, beats, channelHandle, titleDurationSec, chorus, chorusDurationSec }) => {
  const { fps } = useVideoConfig();

  let cursorFrames = Math.round(titleDurationSec * fps);
  const beatSequences = beats.map((beat) => {
    const from = cursorFrames;
    const durationInFrames = Math.round(beat.durationSec * fps);
    cursorFrames += durationInFrames;
    return { beat, from, durationInFrames };
  });
  const chorusFrom = cursorFrames;
  const chorusDurationInFrames = Math.round(chorusDurationSec * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#FFF7EC' }}>
      {/* Baslik karti */}
      <Sequence durationInFrames={Math.round(titleDurationSec * fps)}>
        <AbsoluteFill style={{ backgroundColor: '#FFE3C2', justifyContent: 'center', alignItems: 'center', padding: 100 }}>
          <div
            style={{
              fontFamily: THEME.font.family,
              fontSize: THEME.font.poiTitleSize * 1.4,
              fontWeight: 900,
              color: '#4A1B0C',
              textAlign: 'center',
            }}
          >
            {title}
          </div>
        </AbsoluteFill>
      </Sequence>

      {beatSequences.map(({ beat, from, durationInFrames }, index) => (
        <Sequence key={index} from={Math.max(0, from - CROSSFADE_FRAMES)} durationInFrames={durationInFrames + CROSSFADE_FRAMES}>
          <EmotionVisual emotion={beat.emotion} seedIndex={index} talking />

          <Sequence from={CROSSFADE_FRAMES} durationInFrames={durationInFrames}>
            <KaraokeCaption text={beat.text} durationInFrames={durationInFrames} />
          </Sequence>

          {beat.sfx && (
            <Sequence from={CROSSFADE_FRAMES} durationInFrames={durationInFrames}>
              <Audio src={SFX_FILE[beat.sfx]} volume={0.7} />
            </Sequence>
          )}
        </Sequence>
      ))}

      {/* Kapanis nakarat sahnesi - proud gorseli + sarki sozleri altyazi olarak */}
      <Sequence from={chorusFrom} durationInFrames={chorusDurationInFrames}>
        <EmotionVisual emotion="proud" seedIndex={beats.length} />
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 60 }}>
          <div
            style={{
              fontFamily: THEME.font.family,
              fontSize: THEME.font.poiBodySize * 1.3,
              fontWeight: 900,
              textAlign: 'center',
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius: 20,
              padding: '24px 36px',
              lineHeight: 1.6,
            }}
          >
            {chorus.map((line, i) => (
              <div key={i} style={{ color: KARAOKE_COLORS[i % KARAOKE_COLORS.length], WebkitTextStroke: '4px #4A1B0C', paintOrder: 'stroke fill' }}>
                {line}
              </div>
            ))}
          </div>
        </AbsoluteFill>
      </Sequence>

      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: THEME.layout.safePadding }}>
        <div
          style={{
            fontFamily: THEME.font.family,
            fontSize: THEME.font.sourceSize * 1.3,
            fontWeight: 700,
            color: '#4A1B0C',
            opacity: 0.6,
          }}
        >
          {channelHandle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export function bimbleTvDurationInFrames(props: BimbleTVProps, fps: number): number {
  const beatsFrames = props.beats.reduce((sum, beat) => sum + Math.round(beat.durationSec * fps), 0);
  return Math.round(props.titleDurationSec * fps) + beatsFrames + Math.round(props.chorusDurationSec * fps);
}
