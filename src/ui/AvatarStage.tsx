import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ISharedValue } from 'react-native-worklets-core';
import type { AvatarEngine, BakedClip } from '../engine/AvatarEngine';
import { bakeClip, type StoryFrame } from '../engine/bakeClip';
import { DEFAULT_FACE_ANIM_CONFIG } from '../engine/faceAnim';
import { MIRROR_MODEL_GLB_URL } from '../engine/model';
import type { MirrorSession } from '../live/MirrorSession';

export interface AvatarStageProps {
  /** The 3D engine port (Filament). */
  engine: AvatarEngine;
  session: MirrorSession;
  /** playStart sentinel clock: 0 idle, -1 start (latch), -2 stop + neutralize. */
  clock: ISharedValue<number>;
  clip: ISharedValue<BakedClip | null>;
  /** Camera dolly, eased on the render thread. See engine/camera.ts. */
  zoom: ISharedValue<number>;
  style?: StyleProp<ViewStyle>;
  onReady?: () => void;
}

/**
 * The avatar surface: renders the engine and drives lip-sync from the session.
 *
 * Holds NO React state. Re-rendering this subtree releases the engine's GPU buffers
 * out from under it, so every dynamic value flows through shared values or refs.
 */
export function AvatarStage({
  engine,
  session,
  clock,
  clip,
  zoom,
  style,
  onReady,
}: AvatarStageProps) {
  const morphNames = useRef<string[]>([]);

  useEffect(
    () =>
      session.bindView({
        setBlendshapes: (frames) => {
          const names = morphNames.current;
          if (names.length === 0) return; // model not loaded yet — drop the chunk
          clip.value = bakeClip(
            names,
            frames as StoryFrame[],
            DEFAULT_FACE_ANIM_CONFIG.mouthGain,
          );
          clock.value = -1;
        },
        stopFace: () => {
          clock.value = -2;
        },
      }),
    [session, clip, clock],
  );

  return (
    <engine.Provider>
      <View style={[styles.root, style]}>
        <engine.AvatarView
          modelUrl={MIRROR_MODEL_GLB_URL}
          zoom={zoom}
          clock={clock}
          clip={clip}
          faceAnim={DEFAULT_FACE_ANIM_CONFIG}
          onLoaded={(model) => {
            morphNames.current = model.morphTargetNames;
          }}
          onReady={onReady}
        />
      </View>
    </engine.Provider>
  );
}

const styles = StyleSheet.create({
  // Transparent: MirrorAvatarView owns the backdrop and the
  // ambient glow, and both must show through behind the avatar.
  root: { flex: 1, backgroundColor: 'transparent' },
});
