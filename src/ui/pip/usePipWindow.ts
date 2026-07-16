import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  useWindowDimensions,
  type PanResponderInstance,
} from 'react-native';
import {
  PIP_ASPECT,
  PIP_MARGIN,
  PIP_MAX_WIDTH,
  PIP_MIN_WIDTH,
  PIP_MORPH_MS,
  PIP_RADIUS,
  PIP_SWIPE_SHRINK_DY,
  PIP_TAP_SLOP,
  PIP_WIDTH_FRACTION,
} from '../theme';
import {
  clampToScreen,
  cornerRect,
  nearestCorner,
  pipSize,
  type PipCorner,
  type PipFrameConfig,
  type PipInsets,
} from './pipGeometry';

export interface PipInsetsProp {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface PipWindow {
  /** True while collapsed to the corner card. */
  isPip: boolean;
  /** Animated geometry for the morphing frame — spread into the frame's style. */
  frameStyle: {
    left: Animated.Value;
    top: Animated.Value;
    width: Animated.Value;
    height: Animated.Value;
    borderRadius: Animated.Value;
    transform: { translateY: Animated.Value }[];
  };
  /**
   * Attach to the morphing frame. In fullscreen it recognises a downward swipe (→ shrink) but
   * leaves taps for the call controls; in PiP it owns the drag + tap-to-expand.
   */
  panHandlers: PanResponderInstance['panHandlers'];
  /** Collapse fullscreen → corner card. */
  shrink: () => void;
  /** Expand corner card → fullscreen. */
  expand: () => void;
}

const DEFAULT_CORNER: PipCorner = 'tr'; // lands top-right on first shrink

/**
 * Owns the floating-window interaction: fullscreen ⇄ corner morph, drag, and snap-to-nearest-
 * corner. Pure RN — `Animated` for the tween, `PanResponder` for the gesture. The geometry math
 * lives in ./pipGeometry so it can be reasoned about on its own.
 *
 * All values are JS-driven (`useNativeDriver: false`): the drag feeds `Animated.Value`s from the
 * gesture (which is JS-side anyway), and layout props like width/height can't use the native
 * driver. It animates a single small view, so this is smooth in practice.
 */
export function usePipWindow(
  insetsProp?: PipInsetsProp,
  opts?: { swipeToShrink?: boolean },
): PipWindow {
  const { width: screenW, height: screenH } = useWindowDimensions();

  const insets: PipInsets = {
    top: insetsProp?.top ?? 0,
    bottom: insetsProp?.bottom ?? 0,
    left: insetsProp?.left ?? 0,
    right: insetsProp?.right ?? 0,
  };

  // Card size scales with the screen (clamped), so it's proportionate on any device.
  const { w: pipW, h: pipH } = pipSize({
    screenW,
    fraction: PIP_WIDTH_FRACTION,
    minW: PIP_MIN_WIDTH,
    maxW: PIP_MAX_WIDTH,
    aspect: PIP_ASPECT,
  });

  const cfg: PipFrameConfig = {
    screenW,
    screenH,
    pipW,
    pipH,
    margin: PIP_MARGIN,
    insets,
  };

  const [isPip, setIsPip] = useState(false);

  // Animated geometry — fullscreen at rest.
  const left = useRef(new Animated.Value(0)).current;
  const top = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(screenW)).current;
  const height = useRef(new Animated.Value(screenH)).current;
  const radius = useRef(new Animated.Value(0)).current;
  // Vertical follow for the fullscreen swipe-down-to-shrink gesture (0 = fully open).
  const dragY = useRef(new Animated.Value(0)).current;

  // Live geometry mirrors (Animated.Value has no synchronous getter) + latest config, read by the
  // long-lived PanResponder and the resize effect without going stale.
  const pos = useRef({ x: 0, y: 0 });
  const corner = useRef<PipCorner>(DEFAULT_CORNER);
  const pipRef = useRef(false);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  // Whether a fullscreen downward swipe is allowed to shrink (host disables e.g. once ended).
  const swipeRef = useRef(true);
  swipeRef.current = opts?.swipeToShrink ?? true;

  useEffect(() => {
    const lx = left.addListener(({ value }) => (pos.current.x = value));
    const ty = top.addListener(({ value }) => (pos.current.y = value));
    return () => {
      left.removeListener(lx);
      top.removeListener(ty);
    };
  }, [left, top]);

  const morph = (to: { x: number; y: number; w: number; h: number; r: number }) => {
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(left, { toValue: to.x, duration: PIP_MORPH_MS, easing: ease, useNativeDriver: false }),
      Animated.timing(top, { toValue: to.y, duration: PIP_MORPH_MS, easing: ease, useNativeDriver: false }),
      Animated.timing(width, { toValue: to.w, duration: PIP_MORPH_MS, easing: ease, useNativeDriver: false }),
      Animated.timing(height, { toValue: to.h, duration: PIP_MORPH_MS, easing: ease, useNativeDriver: false }),
      Animated.timing(radius, { toValue: to.r, duration: PIP_MORPH_MS, easing: ease, useNativeDriver: false }),
    ]).start();
  };

  // Kept in refs so the PanResponder (built once) always calls the current versions.
  const shrink = () => {
    if (pipRef.current) return;
    pipRef.current = true;
    setIsPip(true);
    const c = cfgRef.current;
    const rect = cornerRect(corner.current, c);
    morph({ x: rect.x, y: rect.y, w: c.pipW, h: c.pipH, r: PIP_RADIUS });
  };
  const expand = () => {
    if (!pipRef.current) return;
    pipRef.current = false;
    setIsPip(false);
    const c = cfgRef.current;
    morph({ x: 0, y: 0, w: c.screenW, h: c.screenH, r: 0 });
  };
  const api = useRef({ shrink, expand });
  api.current = { shrink, expand };
  // Stable public callbacks — they always invoke the latest impl via the ref, so consumers can
  // depend on them without re-running effects every render.
  const stable = useRef({
    shrink: () => api.current.shrink(),
    expand: () => api.current.expand(),
  }).current;

  // Reflow on rotation / container resize: refit fullscreen, or re-anchor the current corner.
  useEffect(() => {
    if (pipRef.current) {
      const rect = cornerRect(corner.current, cfgRef.current);
      left.setValue(rect.x);
      top.setValue(rect.y);
    } else {
      left.setValue(0);
      top.setValue(0);
      width.setValue(screenW);
      height.setValue(screenH);
    }
  }, [screenW, screenH, left, top, width, height]);

  const dragStart = useRef({ x: 0, y: 0 });
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Bubbling: child Pressables (the ✕) are asked first, so they keep their taps. The frame
        // only claims the touch in PiP mode — inert in fullscreen so the call controls work.
        onStartShouldSetPanResponder: () => pipRef.current,
        // PiP: any drag past a few px. Fullscreen: only a downward-dominant swipe — so taps still
        // reach the call controls, and only a deliberate pull-down claims the gesture.
        onMoveShouldSetPanResponder: (_e, g) => {
          if (pipRef.current) return Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2;
          return swipeRef.current && g.dy > 8 && g.dy > Math.abs(g.dx);
        },
        onPanResponderGrant: () => {
          dragStart.current = { x: pos.current.x, y: pos.current.y };
        },
        onPanResponderMove: (_e, g) => {
          if (pipRef.current) {
            const c = clampToScreen(dragStart.current.x + g.dx, dragStart.current.y + g.dy, cfgRef.current);
            left.setValue(c.x);
            top.setValue(c.y);
          } else {
            // Fullscreen: the surface follows the finger downward as a shrink affordance.
            dragY.setValue(Math.max(0, g.dy));
          }
        },
        onPanResponderRelease: (_e, g) => {
          if (pipRef.current) {
            const moved = Math.abs(g.dx) > PIP_TAP_SLOP || Math.abs(g.dy) > PIP_TAP_SLOP;
            if (!moved) {
              api.current.expand(); // a tap on the card expands it
              return;
            }
            const c = cfgRef.current;
            const cx = pos.current.x + c.pipW / 2;
            const cy = pos.current.y + c.pipH / 2;
            const next = nearestCorner(cx, cy, c.screenW, c.screenH);
            corner.current = next;
            const rect = cornerRect(next, c);
            Animated.parallel([
              Animated.spring(left, { toValue: rect.x, useNativeDriver: false, bounciness: 6, speed: 14 }),
              Animated.spring(top, { toValue: rect.y, useNativeDriver: false, bounciness: 6, speed: 14 }),
            ]).start();
            return;
          }
          // Fullscreen release: a far-enough or fast-enough downward swipe collapses to the corner;
          // anything short springs the surface back open.
          const far = g.dy > PIP_SWIPE_SHRINK_DY || (g.dy > 30 && g.vy > 0.6);
          if (far) {
            api.current.shrink();
            Animated.timing(dragY, {
              toValue: 0,
              duration: PIP_MORPH_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }).start();
          } else {
            Animated.spring(dragY, { toValue: 0, useNativeDriver: false, bounciness: 4, speed: 16 }).start();
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [left, top],
  );

  return {
    isPip,
    frameStyle: { left, top, width, height, borderRadius: radius, transform: [{ translateY: dragY }] },
    panHandlers: pan.panHandlers,
    shrink: stable.shrink,
    expand: stable.expand,
  };
}
