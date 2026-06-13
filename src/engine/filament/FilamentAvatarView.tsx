import React, { useEffect, useState } from 'react';
import {
  EnvironmentalLight,
  FilamentScene,
  FilamentView,
  Light,
  ModelRenderer,
  RenderCallbackContext,
  useAnimator,
  useFilamentContext,
  useModel,
  type Entity,
  type Float3,
  type Mat4,
} from 'react-native-filament';
import type { AvatarEngine, AvatarViewProps } from '../AvatarEngine';
import { sampleClip } from '../clipSampler';
import { JOINTS, POSE_STRIDE } from '../bakeClip';
import {
  AMBIENT_IBL_INTENSITY,
  CAMERA_BASE_Z,
  CAMERA_EYE_Y,
  CAMERA_FAR,
  CAMERA_NEAR,
  CAMERA_TARGET_Y,
  CAMERA_VFOV_DEG,
  GLOW_LIGHT_FALLOFF_M,
  GLOW_LIGHT_KELVIN,
  GLOW_LIGHT_LUMEN,
  GLOW_LIGHT_POSITION,
  HAIR_BASE_COLOR_LINEAR,
  HAIR_MESH_NAME,
  KEY_LIGHT_DIRECTION,
  KEY_LIGHT_KELVIN,
  KEY_LIGHT_LUX,
  MODEL_POSITION,
  OUTFIT_MESH_NAME,
  OUTFIT_METALLIC,
  OUTFIT_ROUGHNESS,
  dollyZ,
} from '../camera';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import {
  DEFAULT_FACE_ANIM_CONFIG,
  initIdleState,
  prngNext,
  blinkEnvelope,
  breath,
  easeToward,
  resolveIdleMorphs,
  IDLE_LAST_PASSED,
  IDLE_BLINK_START,
  IDLE_NEXT_BLINK_AT,
  IDLE_NEXT_SHIFT_AT,
  IDLE_TGT_PITCH,
  IDLE_TGT_YAW,
  IDLE_TGT_ROLL,
  IDLE_CUR_PITCH,
  IDLE_CUR_YAW,
  IDLE_CUR_ROLL,
  IDLE_SEED,
  IDLE_LEN,
} from '../faceAnim';

// rnf's Mat4.rotate pre-multiplies (R × m, rotates about the PARENT origin); to
// rotate a joint about its OWN origin we rebuild the local transform, so we need the
// rest as translation + axis-angle.
function restToTR(m: Mat4): { t: Float3; axis: Float3; angle: number } {
  // Non-null assertions throughout this file: every index below is in range by
  // construction (a fixed 4x4, a loop bound, or a JOINT_STRIDE tuple). `!` erases at
  // compile time, so the render worklet gains no per-frame branch from strict mode.
  const d = m.data; // column-major 4x4: (row r, col c) = d[c*4 + r]
  const m00 = d[0]!, m10 = d[1]!, m20 = d[2]!;
  const m01 = d[4]!, m11 = d[5]!, m21 = d[6]!;
  const m02 = d[8]!, m12 = d[9]!, m22 = d[10]!;
  const trace = m00 + m11 + m22;
  let qx: number, qy: number, qz: number, qw: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    qw = 0.25 * s; qx = (m21 - m12) / s; qy = (m02 - m20) / s; qz = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    qw = (m21 - m12) / s; qx = 0.25 * s; qy = (m01 + m10) / s; qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    qw = (m02 - m20) / s; qx = (m01 + m10) / s; qy = 0.25 * s; qz = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    qw = (m10 - m01) / s; qx = (m02 + m20) / s; qy = (m12 + m21) / s; qz = 0.25 * s;
  }
  const w = Math.max(-1, Math.min(1, qw));
  const angle = 2 * Math.acos(w);
  const sinHalf = Math.sqrt(1 - w * w);
  const axis: Float3 =
    sinHalf < 1e-6 ? [1, 0, 0] : [qx / sinHalf, qy / sinHalf, qz / sinHalf];
  return { t: m.translation, axis, angle };
}

// 8 numbers per joint: [channelOffset, restAngle, axisX, axisY, axisZ, tX, tY, tZ].
const JOINT_STRIDE = 8;

// Hold a finished clip on its last frame this long before settling to neutral. Bridges
// the gap between streamed ~1s chunks so the face doesn't flash to rest at each boundary.
const HOLD_SEC = 0.6;

// The adapter's resolved clip. IMPORTANT: only worklets-core-friendly shapes here —
// bare-handle arrays (like `entities`) + typed arrays + numbers. An array of objects
// that each wrap Filament HostObjects does NOT survive worklet capture (its fields
// come back undefined), so joints are flattened into a parallel handle array +
// number array, and the rest pose is rebuilt from numbers (no Mat4 is captured).
// Static per-model handles, built once at load. The per-chunk frames (morphFrames,
// poseFrames, frameCount, fps) live on the live `clip.value` SharedValue, which the
// worklet reads each render so swapping a chunk needs no React re-render.
type ResolvedClip = {
  entities: Entity[];
  count: number;
  poseStride: number;
  jointEntities: Entity[];
  jointData: Float32Array; // jointCount * JOINT_STRIDE
  jointCount: number;
  headJointIndex: number; // index into jointEntities of the "Head" joint, or -1
  headChannel: number; // the Head joint's channelOffset in poseFrames
  idleBlinkL: number; // morph indices (or -1) for the idle layer
  idleBlinkR: number;
  idleJawOpen: number;
  idleSmileL: number;
  idleSmileR: number;
};

function FilamentModelDriver(props: AvatarViewProps) {
  const { modelUrl, clock, clip, onLoaded, onReady } = props;
  const model = useModel({ uri: modelUrl }); // NB: the prop is `uri`, not `url`.
  const { renderableManager, transformManager } = useFilamentContext();
  const animator = useAnimator(model);
  const [resolved, setResolved] = useState<ResolvedClip | null>(null);
  const cfg = props.faceAnim ?? DEFAULT_FACE_ANIM_CONFIG;
  // Plain-number sub-config captured by the worklet (exclude the mouthGain Record).
  const c0 = cfg.blinkDurationSec, c1 = cfg.blinkMinIntervalSec, c2 = cfg.blinkMaxIntervalSec;
  const c3 = cfg.breathRate, c4 = cfg.breathAmp, c5 = cfg.restingSmile;
  const c6 = cfg.headPitchRange, c7 = cfg.headYawRange, c8 = cfg.headRollRange;
  const c9 = cfg.headSwayMinIntervalSec, c10 = cfg.headSwayMaxIntervalSec, c11 = cfg.headEaseBase;
  const c12 = cfg.lipsyncLeadSec; // start each chunk's clip this far ahead to meet the voice
  const idle = useSharedValue<number[]>(initIdleState((Date.now() & 0x7fffffff) || 1));

  useEffect(() => {
    // rnf's useModel exposes only "loading" | "loaded" (no error state); load
    // failures surface through rnf's own logging. onError stays in the port for
    // engines that can report it.
    if (model.state !== 'loaded') {
      return;
    }
    const asset = model.asset;
    const entities = asset
      .getRenderableEntities()
      .filter((e) => renderableManager.getMorphTargetCount(e) > 0);
    if (entities.length === 0) {
      return;
    }

    // Place the un-normalised model at its authored position, so the engine's absolute
    // camera coordinates frame it head-and-shoulders. (Replaces the
    // transformToUnitCube that ModelRenderer used to apply.)
    transformManager.setEntityPosition(asset.getRoot(), MODEL_POSITION, false);

    // Recolour the hair; see HAIR_BASE_COLOR_LINEAR.
    const hair = asset.getFirstEntityByName(HAIR_MESH_NAME);
    if (hair != null) {
      try {
        renderableManager
          .getMaterialInstanceAt(hair, 0)
          .setFloat4Parameter('baseColorFactor', HAIR_BASE_COLOR_LINEAR);
      } catch {
        // A model whose hair material lacks baseColorFactor keeps its own colour.
      }
    }

    // Matte the jacket so it doesn't throw glossy IBL reflections; see OUTFIT_* in camera.ts.
    const outfit = asset.getFirstEntityByName(OUTFIT_MESH_NAME);
    if (outfit != null) {
      try {
        const mat = renderableManager.getMaterialInstanceAt(outfit, 0);
        mat.setFloatParameter('roughnessFactor', OUTFIT_ROUGHNESS);
        mat.setFloatParameter('metallicFactor', OUTFIT_METALLIC);
      } catch {
        // A model whose outfit material lacks these params keeps its own finish.
      }
    }

    const count = renderableManager.getMorphTargetCount(entities[0]!);
    const morphTargetNames: string[] = [];
    for (let i = 0; i < count; i++) {
      morphTargetNames.push(asset.getMorphTargetNameAt(entities[0]!, i) ?? '');
    }

    // Let the consumer bake an initial clip if it has one. It usually does NOT: the
    // avatar idles until the first audio chunk arrives. So everything below resolves
    // from the STATIC rig description
    // (JOINTS / POSE_STRIDE / the model's own morph names) rather than from a clip.
    // Reading it from `clip.value` would leave `resolved` null forever with no clip,
    // and the render worklet bails on null — a silently frozen avatar.
    onLoaded({ morphTargetNames });

    // Flatten joints into a bare-handle array + a number array (worklet-safe).
    const jointEntities: Entity[] = [];
    const jointNums: number[] = [];
    for (const jd of JOINTS) {
      const entity = asset.getFirstEntityByName(jd.name);
      if (entity == null) {
        continue;
      }
      const { t, axis, angle } = restToTR(transformManager.getTransform(entity));
      jointEntities.push(entity);
      jointNums.push(jd.channelOffset, angle, axis[0], axis[1], axis[2], t[0], t[1], t[2]);
    }

    const idleMorphs = resolveIdleMorphs(morphTargetNames);
    let headChannel = 0;
    for (let n = 0; n < JOINTS.length; n++) {
      if (JOINTS[n]!.name === 'Head') headChannel = JOINTS[n]!.channelOffset;
    }
    // jointEntities was built in-order from the joints that resolved; field 0 of each
    // JOINT_STRIDE-tuple in jointNums is that joint's channelOffset — find the Head row.
    const headJointIndex = jointEntities.findIndex(
      (_, i) => jointNums[i * JOINT_STRIDE] === headChannel,
    );

    setResolved({
      entities,
      count: morphTargetNames.length,
      poseStride: POSE_STRIDE,
      jointEntities,
      jointData: new Float32Array(jointNums),
      jointCount: jointEntities.length,
      headJointIndex,
      headChannel,
      idleBlinkL: idleMorphs.blinkL,
      idleBlinkR: idleMorphs.blinkR,
      idleJawOpen: idleMorphs.jawOpen,
      idleSmileL: idleMorphs.smileL,
      idleSmileR: idleMorphs.smileR,
    });
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.state]);

  // Render-thread worklet — the ONLY safe place to set morph weights. Reads the
  // static per-model handles (resolved) + the LIVE per-chunk clip (clip.value) + the
  // clock, so swapping clip.value swaps the animation with no React re-render.
  RenderCallbackContext.useRenderCallback(
    (frameInfo) => {
      'worklet';
      const c = resolved; // static per-model handles
      if (c == null) return; // model not loaded yet

      const now = frameInfo.passedSeconds;
      const s = idle.value;
      let delta = s[IDLE_LAST_PASSED]! > 0 ? now - s[IDLE_LAST_PASSED]! : 0;
      if (delta < 0 || delta > 0.25) delta = 0; // guard first frame / stalls
      const ns = new Array(IDLE_LEN); // copy state (reassign at end = the persist path)
      for (let i = 0; i < IDLE_LEN; i++) ns[i] = s[i];
      ns[IDLE_LAST_PASSED] = now;

      // ---- Blink (always, even while speaking) ----
      let blinkVal = 0;
      if (ns[IDLE_BLINK_START] < 0 && now >= ns[IDLE_NEXT_BLINK_AT]) {
        ns[IDLE_BLINK_START] = now;
      }
      if (ns[IDLE_BLINK_START] >= 0) {
        const tSince = now - ns[IDLE_BLINK_START];
        if (tSince < c0) {
          blinkVal = blinkEnvelope(tSince, c0);
        } else {
          ns[IDLE_BLINK_START] = -1;
          const r = prngNext(ns[IDLE_SEED]);
          ns[IDLE_SEED] = r.seed;
          ns[IDLE_NEXT_BLINK_AT] = now + c1 + r.rand * (c2 - c1);
        }
      }

      // ---- Speaking? (viseme clip active) — idle replaces the old freeze ----
      // Latch: -2 stop → idle; -1 start → pin the clip clock. Pinning to (now - lipsyncLeadSec)
      // rather than `now` starts the clip a fraction ahead, cancelling the audio-start→latch
      // latency so the mouth meets the voice instead of trailing it.
      if (clock.value === -2) clock.value = 0;
      else if (clock.value === -1) clock.value = now - c12;
      const k = clip.value;
      let speaking = false;
      let f = 0;
      if (k != null && clock.value > 0) {
        const sample = sampleClip(k.frameCount, k.fps, now - clock.value, HOLD_SEC);
        if (sample.kind === 'frame') {
          speaking = true;
          f = sample.index;
        } else {
          clock.value = 0; // clip ended -> idle
        }
      }

      // ---- Head target: server pose while speaking, random sway while idle ----
      if (speaking && k != null) {
        const o = f * c.poseStride;
        ns[IDLE_TGT_YAW] = k.poseFrames[o + c.headChannel];
        ns[IDLE_TGT_PITCH] = k.poseFrames[o + c.headChannel + 1];
        ns[IDLE_TGT_ROLL] = k.poseFrames[o + c.headChannel + 2];
      } else if (now >= ns[IDLE_NEXT_SHIFT_AT]) {
        let r = prngNext(ns[IDLE_SEED]);
        ns[IDLE_TGT_PITCH] = (r.rand - 0.5) * c6 * 2;
        r = prngNext(r.seed);
        ns[IDLE_TGT_YAW] = (r.rand - 0.5) * c7 * 2;
        r = prngNext(r.seed);
        ns[IDLE_TGT_ROLL] = (r.rand - 0.5) * c8 * 2;
        r = prngNext(r.seed);
        ns[IDLE_SEED] = r.seed;
        ns[IDLE_NEXT_SHIFT_AT] = now + c9 + r.rand * (c10 - c9);
      }
      ns[IDLE_CUR_PITCH] = easeToward(ns[IDLE_CUR_PITCH], ns[IDLE_TGT_PITCH], c11, delta);
      ns[IDLE_CUR_YAW] = easeToward(ns[IDLE_CUR_YAW], ns[IDLE_TGT_YAW], c11, delta);
      ns[IDLE_CUR_ROLL] = easeToward(ns[IDLE_CUR_ROLL], ns[IDLE_TGT_ROLL], c11, delta);

      // ---- Morph weights: visemes while speaking, breath+smile while idle; blink overlaid ----
      const weights = new Array(c.count).fill(0);
      if (speaking && k != null) {
        const base = f * c.count;
        for (let i = 0; i < c.count; i++) weights[i] = k.morphFrames[base + i];
      } else {
        const jaw = Math.max(0, breath(now, c3, c4));
        if (c.idleJawOpen >= 0) weights[c.idleJawOpen] = jaw;
        if (c.idleSmileL >= 0) weights[c.idleSmileL] = c5;
        if (c.idleSmileR >= 0) weights[c.idleSmileR] = c5;
      }
      if (c.idleBlinkL >= 0) weights[c.idleBlinkL] = Math.max(weights[c.idleBlinkL], blinkVal);
      if (c.idleBlinkR >= 0) weights[c.idleBlinkR] = Math.max(weights[c.idleBlinkR], blinkVal);
      for (let e = 0; e < c.entities.length; e++) {
        renderableManager.setMorphWeights(c.entities[e]!, weights, 0);
      }

      // ---- Joints: Head = eased idle/pose sway; others = server pose (speaking) or rest.
      // Rebuild each joint about its OWN origin (rest × EulerXYZ) to dodge rnf's pre-multiply.
      for (let n = 0; n < c.jointCount; n++) {
        const d = n * JOINT_STRIDE;
        const co = c.jointData[d]!;
        let yaw = 0;
        let pitch = 0;
        let roll = 0;
        if (n === c.headJointIndex) {
          yaw = ns[IDLE_CUR_YAW];
          pitch = ns[IDLE_CUR_PITCH];
          roll = ns[IDLE_CUR_ROLL];
        } else if (speaking && k != null) {
          const o = f * c.poseStride;
          yaw = k.poseFrames[o + co]!;
          pitch = k.poseFrames[o + co + 1]!;
          roll = k.poseFrames[o + co + 2]!;
        }
        transformManager.setTransform(
          c.jointEntities[n]!,
          transformManager
            .createIdentityMatrix()
            .rotate(roll, [0, 0, 1])
            .rotate(yaw, [0, 1, 0])
            .rotate(pitch, [1, 0, 0])
            .rotate(c.jointData[d + 1]!, [c.jointData[d + 2]!, c.jointData[d + 3]!, c.jointData[d + 4]!])
            .translate([c.jointData[d + 5]!, c.jointData[d + 6]!, c.jointData[d + 7]!]),
        );
      }
      if (animator != null) animator.updateBoneMatrices();

      idle.value = ns; // persist state (reassign — same mechanism as clock.value)
    },
    [resolved, renderableManager, transformManager, animator, clock, clip, idle,
     c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12],
  );

  if (model.state !== 'loaded') {
    return null;
  }
  // NOT transformToUnitCube: the engine frames an un-normalised, metric RPM avatar,
  // so its camera coordinates only mean anything at scale 1. The root offset is applied
  // in the load effect above.
  return <ModelRenderer model={model} />;
}

/**
 * Drives the camera every frame from the render thread.
 *
 * `<Camera>` is not used: it applies `setLensProjection` only when the aspect ratio
 * changes (Camera.tsx:82-102), so a runtime dolly via props is silently dropped — and its
 * own per-frame `lookAt` would fight this one.
 */
function CameraRig({ zoom }: { zoom: ISharedValue<number> }) {
  const { camera, view } = useFilamentContext();
  const z = useSharedValue(CAMERA_BASE_Z);
  const prevAspect = useSharedValue(0);

  RenderCallbackContext.useRenderCallback(
    (frameInfo) => {
      'worklet';
      const aspect = view.getAspectRatio();
      if (prevAspect.value !== aspect) {
        prevAspect.value = aspect;
        // The native binding takes FIVE params; the 4-param TS type is wrong and there is
        // no argc validation, so omitting 'vertical' reads args[4] out of bounds.
        (camera as unknown as {
          setProjection: (
            fov: number, aspect: number, near: number, far: number, dir: string,
          ) => void;
        }).setProjection(CAMERA_VFOV_DEG, aspect, CAMERA_NEAR, CAMERA_FAR, 'vertical');
      }

      let delta = frameInfo.timeSinceLastFrame;
      if (delta < 0 || delta > 0.25) delta = 0; // guard first frame / stalls
      z.value = dollyZ(z.value, zoom.value, delta);
      camera.lookAt([0, CAMERA_EYE_Y, z.value], [0, CAMERA_TARGET_Y, 0], [0, 1, 0]);
    },
    // The framing constants are in the deps so the render callback RE-REGISTERS when they
    // change — otherwise the worklet keeps the value it captured on first mount and every
    // BASE_Z / EYE_Y / TARGET_Y edit is silently ignored until a full remount (lighting, being
    // props, updates regardless — which masked this).
    [camera, view, zoom, z, prevAspect, CAMERA_BASE_Z, CAMERA_EYE_Y, CAMERA_TARGET_Y],
  );

  return null;
}

function FilamentAvatarView(props: AvatarViewProps) {
  return (
    // Transparent: composites over the stage backdrop + glow.
    <FilamentView style={{ flex: 1, backgroundColor: 'transparent' }}>
      <CameraRig zoom={props.zoom} />

      {/* Ambient term. Filament has no <AmbientLight>; an IBL is the only way. */}
      <EnvironmentalLight
        source={{ uri: 'RNF_default_env_ibl.ktx' }}
        intensity={AMBIENT_IBL_INTENSITY}
      />
      {/* Key: a directional light at (1,2,3) aimed at the origin. */}
      <Light
        type="directional"
        direction={KEY_LIGHT_DIRECTION}
        intensity={KEY_LIGHT_LUX}
        colorKelvin={KEY_LIGHT_KELVIN}
      />
      {/* Cool fill from the camera's position — a brand-blue point light. */}
      <Light
        type="point"
        position={GLOW_LIGHT_POSITION}
        intensity={GLOW_LIGHT_LUMEN}
        colorKelvin={GLOW_LIGHT_KELVIN}
        falloffRadius={GLOW_LIGHT_FALLOFF_M}
      />

      <FilamentModelDriver {...props} />
    </FilamentView>
  );
}

function FilamentProvider({ children }: { children: React.ReactNode }) {
  return <FilamentScene>{children}</FilamentScene>;
}

export const filamentAvatarEngine: AvatarEngine = {
  name: 'filament',
  Provider: FilamentProvider,
  AvatarView: FilamentAvatarView,
};
