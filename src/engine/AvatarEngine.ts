import type * as React from 'react';
import type { ISharedValue } from 'react-native-worklets-core';
import type { FaceAnimConfig } from './faceAnim';

export type Vec3 = [number, number, number];

/** What the consumer learns about a loaded model, to bake against. */
export interface LoadedModel {
  morphTargetNames: string[]; // raw names of the primary face mesh
}

/** One skeleton joint to drive, by name, reading [yaw,pitch,roll] (radians)
 *  from poseFrames starting at `channelOffset`. */
export interface JointDrive {
  name: string;
  channelOffset: number;
}

/** Engine-neutral baked animation. Numbers only — no engine types. */
export interface BakedClip {
  morphFrames: Float32Array; // frameCount * morphCount, row-major
  morphCount: number;
  poseFrames: Float32Array; // frameCount * poseStride, radians
  poseStride: number; // pose channels per frame — a plain number; never derive from .length
  joints: JointDrive[];
  frameCount: number;
  fps: number;
}

export interface AvatarViewProps {
  modelUrl: string;
  /**
   * Camera dolly, eased on the render thread: 0 neutral, 0.05 live, -0.08 ended.
   * Framing itself is fixed by the engine, so the consumer only chooses how far in or
   * out the shot sits.
   */
  zoom: ISharedValue<number>;
  /** playStart sentinel clock: 0 idle, -1 start(latch), -2 stop+neutralize, >0 latched. */
  clock: ISharedValue<number>;
  /** Consumer writes this synchronously inside onLoaded (via bakeClip); null = idle. */
  clip: ISharedValue<BakedClip | null>;
  onLoaded: (model: LoadedModel) => void;
  onReady?: () => void;
  onError?: (code: string) => void;
  /** Idle animation + mouth-gain tunables. Defaults to DEFAULT_FACE_ANIM_CONFIG. */
  faceAnim?: FaceAnimConfig;
}

export interface AvatarEngine {
  name: string;
  /** App-root host for any engine-level context (Filament: FilamentScene). */
  Provider: React.ComponentType<{ children: React.ReactNode }>;
  AvatarView: React.ComponentType<AvatarViewProps>;
}
