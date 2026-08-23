// =====================================
// MODULE: StoryNarrative
// Purpose: Hikaye/anlatım kompozisyonu - sahne başına video/görsel/başlık kartı + altyazı
// Dependencies: remotion, theme
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { AbsoluteFill, OffthreadVideo, Img, Sequence, useVideoConfig } from 'remotion';
import { THEME, TEXT_SHADOW } from '../theme';

export type SceneVisualKind = 'video' | 'image' | 'none';

export type StoryScene = {
  visualSrc?: string;
  visualKind: SceneVisualKind;
  /** Bu sahnede seslendirilen metin - alt yazı olarak gösterilir */
  text: string;
  durationSec: number;
  attribution?: string;
}

export type StoryNarrativeProps = {
  title: string;
  scenes: StoryScene[];
  channelHandle: string;
  titleDurationSec: number;
}

function SceneVisual({ scene }: { scene: StoryScene }) {
  if (scene.visualKind === 'video' && scene.visualSrc) {
    return <OffthreadVideo src={scene.visualSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />;
  }
  if (scene.visualKind === 'image' && scene.visualSrc) {
    return <Img src={scene.visualSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  // Görsel bulunamadıysa uydurma görsel yerine düz zemin + metin kartı gösterilir.
  return (
    <AbsoluteFill style={{ backgroundColor: THEME.colors.cardBg, justifyContent: 'center', alignItems: 'center', padding: 80 }}>
      <div
        style={{
          fontFamily: THEME.font.family,
          fontSize: THEME.font.poiTitleSize * 1.4,
          fontWeight: 800,
          color: THEME.colors.ink,
          textAlign: 'center',
          textShadow: TEXT_SHADOW,
        }}
      >
        {scene.text}
      </div>
    </AbsoluteFill>
  );
}

export const StoryNarrative: React.FC<StoryNarrativeProps> = ({ title, scenes, channelHandle, titleDurationSec }) => {
  const { fps } = useVideoConfig();

  let cursorFrames = Math.round(titleDurationSec * fps);
  const sceneSequences = scenes.map((scene) => {
    const from = cursorFrames;
    const durationInFrames = Math.round(scene.durationSec * fps);
    cursorFrames += durationInFrames;
    return { scene, from, durationInFrames };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Sequence durationInFrames={Math.round(titleDurationSec * fps)}>
        <AbsoluteFill style={{ backgroundColor: THEME.colors.cardBg, justifyContent: 'center', alignItems: 'center', padding: 100 }}>
          <div
            style={{
              fontFamily: THEME.font.family,
              fontSize: THEME.font.poiTitleSize * 1.6,
              fontWeight: 900,
              color: THEME.colors.ink,
              textAlign: 'center',
              textShadow: TEXT_SHADOW,
            }}
          >
            {title}
          </div>
        </AbsoluteFill>
      </Sequence>

      {sceneSequences.map(({ scene, from, durationInFrames }, index) => (
        <Sequence key={index} from={from} durationInFrames={durationInFrames}>
          <AbsoluteFill>
            <SceneVisual scene={scene} />
          </AbsoluteFill>

          <AbsoluteFill style={{ justifyContent: 'flex-end', padding: THEME.layout.safePadding, paddingBottom: THEME.layout.safePadding * 1.6 }}>
            <div
              style={{
                fontFamily: THEME.font.family,
                fontSize: THEME.font.poiBodySize * 1.15,
                fontWeight: 700,
                color: THEME.colors.ink,
                textShadow: TEXT_SHADOW,
                backgroundColor: THEME.colors.cardBg,
                borderRadius: 14,
                padding: '18px 26px',
                maxWidth: '82%',
              }}
            >
              {scene.text}
            </div>
          </AbsoluteFill>

          {scene.attribution && (
            <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end', padding: 20 }}>
              <div style={{ fontFamily: THEME.font.family, fontSize: THEME.font.sourceSize, color: THEME.colors.inkMuted, opacity: 0.7 }}>
                {scene.attribution}
              </div>
            </AbsoluteFill>
          )}
        </Sequence>
      ))}

      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-end', padding: THEME.layout.safePadding }}>
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

export function storyNarrativeDurationInFrames(props: StoryNarrativeProps, fps: number): number {
  const scenesFrames = props.scenes.reduce((sum, scene) => sum + Math.round(scene.durationSec * fps), 0);
  return Math.round(props.titleDurationSec * fps) + scenesFrames;
}
