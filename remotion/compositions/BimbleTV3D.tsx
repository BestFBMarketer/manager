// =====================================
// MODULE: BimbleTV3D (test)
// Purpose: Asama 0 dogrulamasi - riglenmis Bimble GLB'sini Remotion+Three.js
//          icinde oynatip render kalitesini gozle kontrol etmek icin minimal
//          composition. Sahne kompozisyonu / story-beat entegrasyonu YOK -
//          bu sadece "rig calisiyor mu" testi (plan: Asama 0 adim 3).
// Dependencies: @remotion/three, @react-three/fiber, @react-three/drei, three
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { useEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useGLTF, useAnimations, Environment } from '@react-three/drei';
import type { Group } from 'three';

export type BimbleTV3DProps = {
  /** Oynatilacak klip adi, Cinevva'dan gelen isimlerle birebir esler (orn. "Idle", "Walk"). */
  animationName: string;
  durationSec: number;
  /** Klip oynatma hizi carpani. Kutuphane klipleri yetiskin insan temposunda -
   * toddler karakter icin cok hizli/asabi durur. 1 = orijinal hiz. */
  speed?: number;
};

export const bimbleTv3DDurationInFrames = (props: BimbleTV3DProps, fps: number): number =>
  Math.max(1, Math.round(props.durationSec * fps));

const MODEL_SRC = staticFile('bimble/models/bimble_rigged.glb');

const BimbleModel: React.FC<{ animationName: string; speed: number }> = ({ animationName, speed }) => {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(MODEL_SRC);
  const { actions, mixer } = useAnimations(animations, group);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  useEffect(() => {
    const action = actions[animationName] ?? Object.values(actions)[0];
    action?.reset().play();
    return () => {
      action?.stop();
    };
  }, [actions, animationName]);

  // Remotion frame-driven zaman: gercek saat yerine mixer'i doğrudan frame'e kilitliyoruz
  // (her frame ayni sonucu uretmesi lazim, requestAnimationFrame delta'siyla degil).
  // speed<1 klibi yavaslatir (kutuphane klipleri yetiskin temposunda geliyor).
  mixer.setTime((frame / fps) * speed);

  return <primitive ref={group} object={scene} />;
};

export const BimbleTV3D: React.FC<BimbleTV3DProps> = ({ animationName, speed = 1 }) => {
  const { width, height } = useVideoConfig();
  const cameraProps = useMemo(
    () => ({ fov: 35, position: [0, 1.1, 4.2] as [number, number, number] }),
    [],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#bfe3ff' }}>
      <ThreeCanvas width={width} height={height} camera={cameraProps}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} castShadow />
        <Environment preset="park" />
        <group position={[0, -1.1, 0]}>
          <BimbleModel animationName={animationName} speed={speed} />
        </group>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

useGLTF.preload(MODEL_SRC);
