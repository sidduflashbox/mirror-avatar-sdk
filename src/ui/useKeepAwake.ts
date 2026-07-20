import { useEffect } from 'react';
import { NativeModules } from 'react-native';

/**
 * The native screen-sleep surface. Declared here rather than reached for inline so the JS side
 * of the contract sits in one place; it must stay in lockstep with `setKeepAwake` on both
 * `ios/Sources/MirrorAvatar/MirrorAvatarModuleBridge.m` and
 * `android/src/main/java/com/mirror/avatar/MirrorAvatarModule.kt`.
 */
interface KeepAwakeNative {
  setKeepAwake?: (enabled: boolean) => void;
}

/**
 * Hold the display awake for as long as the caller is mounted.
 *
 * A call is watched, not touched, so the device's display timeout would otherwise sleep the
 * screen mid-conversation. Releasing on unmount is the point of tying this to a hook: the
 * screen must go back to the user's own timeout the moment the avatar leaves.
 *
 * Optional-chained rather than asserted so a host running an older native build — JS updated,
 * binary not yet shipped — degrades to the normal timeout instead of crashing.
 */
export function useKeepAwake(enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    const native: KeepAwakeNative | undefined = NativeModules.MirrorAvatarModule;
    native?.setKeepAwake?.(true);
    return () => native?.setKeepAwake?.(false);
  }, [enabled]);
}
