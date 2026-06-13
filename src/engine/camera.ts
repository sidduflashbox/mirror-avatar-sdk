// Camera framing + lighting for the avatar.
//
// The RPM avatar is rendered at scale 1, offset to MODEL_POSITION, and framed with a 28°
// vertical FOV. Those numbers only mean anything against an un-normalised model, which is
// why the engine does NOT use ModelRenderer's `transformToUnitCube`.

/** Vertical field of view, degrees. */
export const CAMERA_VFOV_DEG = 28;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 1000;

/** Eye sits at (0, EYE_Y, BASE_Z − zoom); target at (0, TARGET_Y, 0).
 *  A native full-screen app renders the framing large, so BASE_Z is pulled back and calibrated
 *  against device screenshots (2.2 read slightly big, 2.35 slightly small, 2.25 still a hair
 *  small → 2.22, keeping the dress above the bottom fade). The camera sits ~1 m from the head,
 *  so a small Δz moves apparent size a lot — a tenth here is a few percent on screen. */
export const CAMERA_BASE_Z = 2.0;
// Aiming the lens a touch higher on the model drops it lower in the frame, so it isn't floating
// high with empty space below (the native full-screen aspect otherwise sits it higher than a
// narrower viewport would).
export const CAMERA_EYE_Y = 0.5;
export const CAMERA_TARGET_Y = 0.45;

/** Same exponential-decay constant the head bone uses. τ ≈ 0.2556 s; 98 % settled in 1.0 s. */
export const CAMERA_EASE_BASE = 0.02;

/** Model root offset. Puts the head at y ≈ 0.407, z ≈ 1.025 — head-and-shoulders. */
export const MODEL_POSITION: [number, number, number] = [0, -1.15, 1];

/** Dolly targets: `ended ? -0.08 : live ? 0.05 : 0`. */
export const ZOOM_NEUTRAL = 0;
export const ZOOM_LIVE = 0.05;
export const ZOOM_ENDED = -0.08;

/**
 * Ease the camera's z toward `BASE_Z − zoom`. Frame-rate independent: the residual error
 * after t seconds is error₀ · 0.02^t, regardless of how many frames elapsed.
 */
export function dollyZ(
  currentZ: number,
  zoom: number,
  deltaSeconds: number,
): number {
  'worklet';
  const target = CAMERA_BASE_Z - zoom;
  const lerp = 1 - Math.pow(CAMERA_EASE_BASE, deltaSeconds);
  return currentZ + (target - currentZ) * lerp;
}

// ── Lighting ────────────────────────────────────────────────────────────────
//
// Not a numeric match to a three.js setup, and cannot be: react-native-filament exposes no
// ambient-light component (ambient must come from an IBL), no RGB light colour (only
// colorKelvin), no camera exposure, and no tone-mapping binding. Filament also works in
// photometric units (lux for directional, lumen for point) which do not convert from three.js
// intensities. So these reproduce the target *ratios* — key : ambient ≈ 2 : 1, with a cool rim
// glow from the camera's position — calibrated by eye against a screenshot.

/** Key light: a directional light at (1,2,3) aimed at the origin.
 *  Held at 9 000 lux: it comes from ABOVE, so raising it lights the hair / top of head, not just
 *  the face. Face brightness therefore comes from the frontal point light (below), which hits
 *  the face head-on but barely touches the top of the head. */
export const KEY_LIGHT_DIRECTION: [number, number, number] = [
  -0.2673, -0.5345, -0.8018,
];
export const KEY_LIGHT_LUX = 9_000;
export const KEY_LIGHT_KELVIN = 6_500;

/** Stands in for a flat `ambientLight intensity={0.6}` — a constant colour with no directionality
 *  or reflections. An IBL environment map is the only ambient Filament offers, but it also adds
 *  warm, glossy specular (the shiny jacket + hot face highlights) that flat ambient never
 *  produces. Tuned 22 000 → 14 000 → 10 000 → 6 000 → 8 000: the glossy jacket reflects the IBL
 *  env (its low-roughness texture can't be overridden by roughnessFactor), so a high IBL
 *  re-glosses it, but too low reads dull. 8 000 is the balance — enough ambient fill, without the
 *  mirror-jacket. */
export const AMBIENT_IBL_INTENSITY = 8_000;

/** A point light at the camera, hsl(220,60%,70%) — a cool fill on the face. A very dim source
 *  (intensity 0.25) tuned up to 16 000 lumen. It sits dead-front at the camera, so it lifts the
 *  FACE (which faces forward) far more than the hair / top of head, and fills the lower-face
 *  shadow the key light (from above) leaves — the lever for an even, bright face without lighting
 *  the head. */
export const GLOW_LIGHT_POSITION: [number, number, number] = [0, 0, 2];
export const GLOW_LIGHT_LUMEN = 40_000;
export const GLOW_LIGHT_KELVIN = 9_000;
// Widened 5 → 12 m so this frontal light covers the whole face more evenly (less nose-bright /
// edge-dim) now that it's carrying the face brightness.
export const GLOW_LIGHT_FALLOFF_M = 12;

/**
 * Recolour the hair:
 *   mat.color.setRGB(0.1, 0.05, 0.02)
 * three.js interprets that in its LINEAR working space, not sRGB — so the hair reads as a dark
 * brown (≈ #593F27 in sRGB), not the near-black #1A0D05 a naive reading gives. It multiplies
 * against the hair's baseColor texture. Filament's `baseColorFactor` is also linear and also
 * multiplies the baseColor map, so the triple transfers unchanged. Without this the RPM model's
 * own lavender hair shows through.
 */
export const HAIR_MESH_NAME = 'Wolf3D_Hair';
// The linear factor [0.1, 0.05, 0.02] reads as a warm medium brown under three.js. Filament
// tone-maps it darker + cooler, so to match the intended LOOK (not the number) the factor is
// lifted + warmed. Device-calibrated against a screenshot.
export const HAIR_BASE_COLOR_LINEAR: [number, number, number, number] = [
  0.13, 0.065, 0.025, 1,
];

/**
 * The RPM outfit (jacket) is authored as glossy patent leather. Under an IBL it throws bright
 * environment reflections; a flat ambient gives it none, so it reads matte black. Force the
 * material fully rough + non-metallic to kill the specular and match that matte look, without
 * darkening the rest of the scene the way lowering the IBL would.
 */
export const OUTFIT_MESH_NAME = 'Wolf3D_Outfit_Top';
export const OUTFIT_ROUGHNESS = 1.0;
export const OUTFIT_METALLIC = 0.0;

/** The stage backdrop, `bg-[#07070f]`. */
export const STAGE_BACKGROUND = '#07070f';
