// Internal barrel for the live-session module. Only MirrorSDK is re-exported
// from the package root (src/index.ts); everything else stays internal.
export { MirrorSDK, MirrorSession } from './MirrorSession';
export type { MirrorSessionEnv } from './MirrorSession';
