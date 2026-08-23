// =====================================
// MODULE: Remotion Root
// Purpose: Kompozisyon kaydi - render ve studio girisi
// Dependencies: remotion, compositions/*
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { Composition } from 'remotion';
import { fontFaceCss } from './theme';
import { FunnyRanking, rankingDurationInFrames, type FunnyRankingProps } from './compositions/FunnyRanking';
import { HotelTour, type HotelTourProps } from './compositions/HotelTour';
import { StoryNarrative, storyNarrativeDurationInFrames, type StoryNarrativeProps } from './compositions/StoryNarrative';

const FPS = 30;
const VERTICAL = { width: 1080, height: 1920 };
const LANDSCAPE = { width: 1920, height: 1080 };

/** Studio'da onizleme icin ornek veriler - gercek render'da inputProps ezer. */
const RANKING_DEFAULTS: FunnyRankingProps = {
  hookLine: 'Bu 5 kişi bugün gerçekten şanssızdı',
  items: [
    { rank: 5, videoSrc: '', voiceLine: 'Beşinci sırada klasik bir merdiven şaheseri', durationSec: 6 },
    { rank: 4, videoSrc: '', voiceLine: 'Dördüncü: kedi haklıydı, sen değildin', durationSec: 6 },
    { rank: 3, videoSrc: '', voiceLine: 'Üçüncü sırada fizik yasaları devrede', durationSec: 6 },
    { rank: 2, videoSrc: '', voiceLine: 'İkinci: plan mükemmeldi, uygulama değil', durationSec: 6 },
    { rank: 1, videoSrc: '', voiceLine: 'Ve birinci sıra: yorum bile gereksiz', durationSec: 6 },
  ],
  outroLine: 'Devamı her gün, ıĞÜŞÖÇ',
  channelHandle: '@funandrank',
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

const TOUR_DEFAULTS: HotelTourProps = {
  videoSrc: '',
  title: 'Antalya sahili · şelaleler',
  cues: [
    { name: 'Uçansu Şelalesi', description: 'Toroslardan dökülen şelale.', source: 'Vikipedi', atSec: 3, durationSec: 4 },
    { name: 'Antik Tiyatro', description: 'Roma dönemi tiyatrosu, ıİğĞüÜşŞöÖçÇ.', source: 'Vikipedi', atSec: 12, durationSec: 4 },
  ],
  channelHandle: '@bestmarketer',
  titleDurationSec: 3,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Yerel font tanimlari - dosya yoksa yigindaki sistem fontuna dusulur */}
      <style>{fontFaceCss()}</style>
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
        id="HotelTourVertical"
        component={HotelTour}
        defaultProps={TOUR_DEFAULTS}
        fps={FPS}
        {...VERTICAL}
        durationInFrames={FPS * 30}
      />

      <Composition
        id="HotelTourLandscape"
        component={HotelTour}
        defaultProps={TOUR_DEFAULTS}
        fps={FPS}
        {...LANDSCAPE}
        durationInFrames={FPS * 60}
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
    </>
  );
};
