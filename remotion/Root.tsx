// =====================================
// MODULE: Remotion Root
// Purpose: Kompozisyon kaydi - render ve studio girisi
// Dependencies: remotion, compositions/*
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { Composition, Still } from 'remotion';
import { fontFaceCss } from './theme';
import { FunnyClip, funnyClipDurationInFrames, type FunnyClipProps } from './compositions/FunnyClip';
import { FunnyRanking, rankingDurationInFrames, type FunnyRankingProps } from './compositions/FunnyRanking';
import { HotelTour, hotelTourDurationInFrames, type HotelTourProps } from './compositions/HotelTour';
import { StoryNarrative, storyNarrativeDurationInFrames, type StoryNarrativeProps } from './compositions/StoryNarrative';
import { Thumbnail, type ThumbnailProps } from './compositions/Thumbnail';
import { ShortsDerivative, shortsDerivativeDurationInFrames, type ShortsDerivativeProps } from './compositions/ShortsDerivative';
import { TierList, tierListDurationInFrames, type TierListProps } from './compositions/TierList';
import { BimbleTV, bimbleTvDurationInFrames, type BimbleTVProps } from './compositions/BimbleTV';
import { BimbleTV3D, bimbleTv3DDurationInFrames, type BimbleTV3DProps } from './compositions/BimbleTV3D';

const FPS = 30;
const VERTICAL = { width: 1080, height: 1920 };
const LANDSCAPE = { width: 1920, height: 1080 };

/** Studio'da onizleme icin ornek veriler - gercek render'da inputProps ezer. */
const FUNNY_CLIP_DEFAULTS: FunnyClipProps = {
  videoSrc: '',
  durationSec: 25,
  hookText: 'Bunu izlerken gülmemek imkansız',
  hookDurationSec: 2,
  commentaryScript: 'Yine aynı figür, yine aynı özgüven - efsane.',
  channelHandle: '@bestmarketer',
};

const RANKING_DEFAULTS: FunnyRankingProps = {
  hookLine: 'Bu 5 an gerçekten inanılmaz',
  titleLabel: 'TOP 5 EN INANILMAZ ANLAR',
  items: [
    { rank: 5, videoSrc: '', voiceLine: 'Beşinci sırada klasik bir an', durationSec: 6 },
    { rank: 4, videoSrc: '', voiceLine: 'Dördüncü sırada işler çığırından çıkıyor', durationSec: 6 },
    { rank: 3, videoSrc: '', voiceLine: 'Üçüncü sırada tam bir felaket', durationSec: 6 },
    { rank: 2, videoSrc: '', voiceLine: 'İkinci sırada nefesler tutuluyor', durationSec: 6 },
    { rank: 1, videoSrc: '', voiceLine: 'Ve birinci sıra: yorum bile gereksiz', durationSec: 6 },
  ],
  outroLine: 'Devamı her gün burada',
  channelHandle: '@bestmarketer',
  hookDurationSec: 2,
  outroDurationSec: 2,
};

const TIER_LIST_DEFAULTS: TierListProps = {
  hookLine: 'Bugün en çılgın reklamları sıralıyoruz',
  hookVideoSrc: '',
  items: [
    { tier: 'D', brandLabel: 'Marka A', clipSrc: '', dummyVideoSrc: '', voiceLine: 'Buna bütçe mi onayladınız cidden?', durationSec: 3 },
    { tier: 'B', brandLabel: 'Marka B', clipSrc: '', dummyVideoSrc: '', voiceLine: 'Fena değil ama unutulur', durationSec: 3 },
    { tier: 'S', brandLabel: 'Marka C', clipSrc: '', dummyVideoSrc: '', voiceLine: 'İşte vizyon bu!', durationSec: 3 },
  ],
  outroLine: 'Yarın yeni reklamlar',
  outroVideoSrc: '',
  channelHandle: '@bestmarketer',
  hookDurationSec: 2,
  outroDurationSec: 2,
};

const STORY_DEFAULTS: StoryNarrativeProps = {
  title: 'Bilinmeyen Bir Hikaye',
  scenes: [
    { visualKind: 'none', text: 'Her şey sıradan bir günde başladı.', durationSec: 5 },
    { visualKind: 'none', text: 'Ama kimse olacakları tahmin edemezdi.', durationSec: 5 },
  ],
  channelHandle: '@bestmarketer',
  titleDurationSec: 3,
};

const SHORTS_DERIVATIVE_DEFAULTS: ShortsDerivativeProps = {
  videoSrc: '',
  durationSec: 30,
  hookText: 'Bunu kaçırmayın',
  hookDurationSec: 2,
  channelHandle: '@bestmarketer',
  ctaText: 'Tamamı kanalda',
};

const BIMBLE_DEFAULTS: BimbleTVProps = {
  title: 'I Wanted The Toy But Mom Said No',
  beats: [
    { emotion: 'calm', text: "Hi friends! Today I wanted something SO badly...", durationSec: 4 },
    { emotion: 'happy', text: 'A big red dinosaur toy. I HAD to have it.', durationSec: 4 },
    { emotion: 'sad', text: "Mom said not today. My chest got tight.", durationSec: 4, sfx: 'pop_sparkle' },
    { emotion: 'bigfeeling', text: 'The feeling got bigger and bigger...', durationSec: 4 },
    { emotion: 'calm', text: 'So I took three big breaths. In... and out.', durationSec: 5, sfx: 'chime_breath' },
    { emotion: 'proud', text: "I didn't get the toy. But I got through my big feeling.", durationSec: 4, sfx: 'tada' },
  ],
  chorus: ['Hearing no is hard to do', 'But I can breathe it through', 'Through and through, through and through', "That's what Bimble knows"],
  chorusDurationSec: 8,
  channelHandle: '@Bimble-TV',
  titleDurationSec: 3,
};

const BIMBLE_3D_DEFAULTS: BimbleTV3DProps = {
  animationName: 'Idle',
  durationSec: 4,
};

const TOUR_DEFAULTS: HotelTourProps = {
  videoSrc: '',
  title: 'Antalya sahili · şelaleler',
  cues: [
    { name: 'Uçansu Şelalesi', description: 'Toroslardan dökülen şelale.', source: 'Vikipedi', atSec: 3, durationSec: 4 },
    { name: 'Antik Tiyatro', description: 'Roma dönemi tiyatrosu, ıİğĞüÜşŞöÖçÇ.', source: 'Vikipedi', atSec: 12, durationSec: 4 },
  ],
  channelHandle: '@bestmarketer',
  titleDurationSec: 3,
  totalDurationSec: 30,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Yerel font tanimlari - dosya yoksa yigindaki sistem fontuna dusulur */}
      <style>{fontFaceCss()}</style>
      <Composition
        id="FunnyClip"
        component={FunnyClip}
        defaultProps={FUNNY_CLIP_DEFAULTS}
        fps={FPS}
        {...VERTICAL}
        durationInFrames={funnyClipDurationInFrames(FUNNY_CLIP_DEFAULTS, FPS)}
        calculateMetadata={({ props }) => ({
          durationInFrames: funnyClipDurationInFrames(props, FPS),
        })}
      />

      <Composition
        id="FunnyRanking"
        component={FunnyRanking}
        defaultProps={RANKING_DEFAULTS}
        fps={FPS}
        {...VERTICAL}
        durationInFrames={rankingDurationInFrames(RANKING_DEFAULTS, FPS)}
        calculateMetadata={({ props }) => ({
          durationInFrames: rankingDurationInFrames(props, FPS),
        })}
      />

      <Composition
        id="TierList"
        component={TierList}
        defaultProps={TIER_LIST_DEFAULTS}
        fps={FPS}
        {...VERTICAL}
        durationInFrames={tierListDurationInFrames(TIER_LIST_DEFAULTS, FPS)}
        calculateMetadata={({ props }) => ({
          durationInFrames: tierListDurationInFrames(props, FPS),
        })}
      />

      <Composition
        id="HotelTourVertical"
        component={HotelTour}
        defaultProps={TOUR_DEFAULTS}
        fps={FPS}
        {...VERTICAL}
        durationInFrames={hotelTourDurationInFrames(TOUR_DEFAULTS, FPS)}
        calculateMetadata={({ props }) => ({
          durationInFrames: hotelTourDurationInFrames(props, FPS),
        })}
      />

      <Composition
        id="HotelTourLandscape"
        component={HotelTour}
        defaultProps={TOUR_DEFAULTS}
        fps={FPS}
        {...LANDSCAPE}
        durationInFrames={hotelTourDurationInFrames(TOUR_DEFAULTS, FPS)}
        calculateMetadata={({ props }) => ({
          durationInFrames: hotelTourDurationInFrames(props, FPS),
        })}
      />

      <Composition
        id="StoryNarrative"
        component={StoryNarrative}
        defaultProps={STORY_DEFAULTS}
        fps={FPS}
        {...LANDSCAPE}
        durationInFrames={storyNarrativeDurationInFrames(STORY_DEFAULTS, FPS)}
        calculateMetadata={({ props }) => ({
          durationInFrames: storyNarrativeDurationInFrames(props, FPS),
        })}
      />

      <Composition
        id="ShortsDerivative"
        component={ShortsDerivative}
        defaultProps={SHORTS_DERIVATIVE_DEFAULTS}
        fps={FPS}
        {...VERTICAL}
        durationInFrames={shortsDerivativeDurationInFrames(SHORTS_DERIVATIVE_DEFAULTS, FPS)}
        calculateMetadata={({ props }) => ({
          durationInFrames: shortsDerivativeDurationInFrames(props, FPS),
        })}
      />

      <Composition
        id="BimbleTV"
        component={BimbleTV}
        defaultProps={BIMBLE_DEFAULTS}
        fps={FPS}
        {...LANDSCAPE}
        durationInFrames={bimbleTvDurationInFrames(BIMBLE_DEFAULTS, FPS)}
        calculateMetadata={({ props }) => ({
          durationInFrames: bimbleTvDurationInFrames(props, FPS),
        })}
      />

      <Composition
        id="BimbleTV3D"
        component={BimbleTV3D}
        defaultProps={BIMBLE_3D_DEFAULTS}
        fps={FPS}
        {...LANDSCAPE}
        durationInFrames={bimbleTv3DDurationInFrames(BIMBLE_3D_DEFAULTS, FPS)}
        calculateMetadata={({ props }) => ({
          durationInFrames: bimbleTv3DDurationInFrames(props, FPS),
        })}
      />

      <Still
        id="Thumbnail"
        component={Thumbnail}
        defaultProps={{ text: 'Başlık buraya' } as ThumbnailProps}
        width={1280}
        height={720}
      />
    </>
  );
};
