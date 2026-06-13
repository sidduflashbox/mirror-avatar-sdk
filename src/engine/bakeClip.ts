import type { BakedClip, JointDrive } from './AvatarEngine';

export type StoryFrame = { timestamp: number; blendshapes: Record<string, number> };

// 9 pose channels: [yaw,pitch,roll] for head, left eye, right eye.
// Exported because the engine resolves its joint handles from these at model load —
// before any clip exists. The avatar idles (blink/breath/sway) until the first chunk.
export const JOINTS: JointDrive[] = [
  { name: 'Head', channelOffset: 0 },
  { name: 'LeftEye', channelOffset: 3 },
  { name: 'RightEye', channelOffset: 6 },
];
export const POSE_STRIDE = 9;

// ARKit blendshape names never end in a digit; RPM suffixes morph names per mesh
// (e.g. "jawOpen3"), so strip trailing digits to recover the base ARKit name.
export const baseName = (raw: string): string => raw.replace(/\d+$/, '');

// base ARKit name -> first morph index. Shared by bakeClip + faceAnim.resolveIdleMorphs.
export function buildBaseNameIndex(morphTargetNames: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  for (let i = 0; i < morphTargetNames.length; i++) {
    const b = baseName(morphTargetNames[i]!);
    if (!(b in idx)) idx[b] = i;
  }
  return idx;
}

export function bakeClip(
  morphTargetNames: string[],
  frames: StoryFrame[],
  mouthGain: Record<string, number> = {},
): BakedClip {
  const morphCount = morphTargetNames.length;
  const nameToIndex = buildBaseNameIndex(morphTargetNames);

  const frameCount = frames.length;
  const morphFrames = new Float32Array(frameCount * morphCount);
  const poseFrames = new Float32Array(frameCount * POSE_STRIDE);
  for (let f = 0; f < frameCount; f++) {
    const b = frames[f]!.blendshapes;
    const mo = f * morphCount;
    for (const name in b) {
      const idx = nameToIndex[name];
      if (idx !== undefined) {
        const v = b[name]! * (mouthGain[name] ?? 1);
        morphFrames[mo + idx] = v < 0 ? 0 : v > 1 ? 1 : v;
      }
    }
    const po = f * POSE_STRIDE;
    poseFrames[po + 0] = b.headYaw ?? 0;
    poseFrames[po + 1] = b.headPitch ?? 0;
    poseFrames[po + 2] = b.headRoll ?? 0;
    poseFrames[po + 3] = b.leftEyeYaw ?? 0;
    poseFrames[po + 4] = b.leftEyePitch ?? 0;
    poseFrames[po + 5] = b.leftEyeRoll ?? 0;
    poseFrames[po + 6] = b.rightEyeYaw ?? 0;
    poseFrames[po + 7] = b.rightEyePitch ?? 0;
    poseFrames[po + 8] = b.rightEyeRoll ?? 0;
  }

  const duration = frameCount > 1 ? frames[frameCount - 1]!.timestamp : 0;
  const fps = duration > 0 ? (frameCount - 1) / duration : 0;
  return { morphFrames, morphCount, poseFrames, poseStride: POSE_STRIDE, joints: JOINTS, frameCount, fps };
}
