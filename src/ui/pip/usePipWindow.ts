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
  PIP_FOCUS_FRAC,
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
  pipInnerTransform,
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
  /**
   * The clip window (a plain View — safe to resize): position + size + rounded corners of the
   * visible card, plus the swipe-down offset. Spread onto the outer `overflow: hidden` frame.
   */
  windowStyle: {
    left: Animated.Value;
    top: Animated.Value;
    width: Animated.Value;
    height: Animated.Value;
    borderRadius: Animated.Value;
    transform: { translateY: Animated.Value }[];
  };
  /**
   * The avatar surface: kept at a FIXED full-screen size and only transform-scaled/offset into the
   * card, so the native render surface is never resized (Android's Filament view is a TextureView,
   * which is unreliable across live resizes).
   */
  innerStyle: {
    left: Animated.Value;
    top: Animated.Value;
    width: number;
    height: number;
    transform: { scale: Animated.Value }[];
  };
  /** Attach to the clip window. Recognises a downward swipe in fullscreen; owns drag + tap-to-expand in PiP. */
  panHandlers: PanResponderInstance['panHandlers'];
  /** Collapse fullscreen → corner card. */
  shrink: () => void;
  /** Expand corner card → fullscreen. */
  expand: () => void;
}

const DEFAULT_CORNER: PipCorner = 'tr'; // lands top-right on first shrink

/**
 * Owns the floating-window interaction: fullscreen ⇄ corner morph, drag, and snap-to-nearest-
 * corner. The avatar surface is NEVER resized — it stays full-screen and is transform-scaled into
 * a clipping card, so we don't depend on Android's Filament TextureView tracking a live surface
 * resize. The geometry math lives in ./pipGeometry so it can be reasoned about alone.
 *
 * All values are JS-driven (`useNativeDriver: false`): the drag feeds `Animated.Value`s from the
 * gesture, and the width/height on the clip window are layout props that can't use the native
 * driver. It animates one small view, so this is smooth in practice.
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

  // Clip window (a plain View) — full-screen at rest.
  const winLeft = useRef(new Animated.Value(0)).current;
  const winTop = useRef(new Animated.Value(0)).current;
  const winWidth = useRef(new Animated.Value(screenW)).current;
  const winHeight = useRef(new Animated.Value(screenH)).current;
  const winRadius = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current; // fullscreen swipe-down follow

  // Fixed-size avatar surface — only its position + scale animate (never its width/height).
  const inLeft = useRef(new Animated.Value(0)).current;
  const inTop = useRef(new Animated.Value(0)).current;
  const inScale = useRef(new Animated.Value(1)).current;

  // Live mirrors + latest config, read by the long-lived PanResponder without going stale.
  const pos = useRef({ x: 0, y: 0 });
  const corner = useRef<PipCorner>(DEFAULT_CORNER);
  const pipRef = useRef(false);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const swipeRef = useRef(true);
  swipeRef.current = opts?.swipeToShrink ?? true;

  useEffect(() => {
    const lx = winLeft.addListener(({ value }) => (pos.current.x = value));
    const ty = winTop.addListener(({ value }) => (pos.current.y = value));
    return () => {
      winLeft.removeListener(lx);
      winTop.removeListener(ty);
    };
  }, [winLeft, winTop]);

  const morph = (
    win: { x: number; y: number; w: number; h: number; r: number },
    inner: { left: number; top: number; scale: number },
    onDone?: () => void,
  ) => {
    const ease = Easing.out(Easing.cubic);
    const t = (v: Animated.Value, toValue: number) =>
      Animated.timing(v, { toValue, duration: PIP_MORPH_MS, easing: ease, useNativeDriver: false });
    Animated.parallel([
      t(winLeft, win.x),
      t(winTop, win.y),
      t(winWidth, win.w),
      t(winHeight, win.h),
      t(winRadius, win.r),
      t(inLeft, inner.left),
      t(inTop, inner.top),
      t(inScale, inner.scale),
    ]).start(onDone);
  };

  // Kept in refs so the PanResponder (built once) always calls the current versions.
  const shrink = () => {
    if (pipRef.current) return;
    pipRef.current = true;
    setIsPip(true);
    const c = cfgRef.current;
    const rect = cornerRect(corner.current, c);
    const inner = pipInnerTransform(c.screenW, c.screenH, c.pipW, c.pipH, PIP_FOCUS_FRAC);
    morph({ x: rect.x, y: rect.y, w: c.pipW, h: c.pipH, r: PIP_RADIUS }, inner);
  };
  const expand = () => {
    if (!pipRef.current) return;
    pipRef.current = false;
    setIsPip(false);
    const c = cfgRef.current;
    morph({ x: 0, y: 0, w: c.screenW, h: c.screenH, r: 0 }, { left: 0, top: 0, scale: 1 });
  };
  const api = useRef({ shrink, expand });
  api.current = { shrink, expand };
  // Stable public callbacks — always invoke the latest impl via the ref.
  const stable = useRef({
    shrink: () => api.current.shrink(),
    expand: () => api.current.expand(),
  }).current;

  // Reflow on rotation / container resize: refit fullscreen, or re-anchor the current corner.
  useEffect(() => {
    const c = cfgRef.current;
    if (pipRef.current) {
      const rect = cornerRect(corner.current, c);
      const inner = pipInnerTransform(c.screenW, c.screenH, c.pipW, c.pipH, PIP_FOCUS_FRAC);
      winLeft.setValue(rect.x);
      winTop.setValue(rect.y);
      winWidth.setValue(c.pipW);
      winHeight.setValue(c.pipH);
      inLeft.setValue(inner.left);
      inTop.setValue(inner.top);
      inScale.setValue(inner.scale);
    } else {
      winLeft.setValue(0);
      winTop.setValue(0);
      winWidth.setValue(screenW);
      winHeight.setValue(screenH);
      inLeft.setValue(0);
      inTop.setValue(0);
      inScale.setValue(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenW, screenH]);

  const dragStart = useRef({ x: 0, y: 0 });
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Bubbling: child Pressables are asked first, so buttons keep their taps. The clip window
        // only claims the touch in PiP (drag), or in fullscreen for a downward swipe (to shrink).
        onStartShouldSetPanResponder: () => pipRef.current,
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
            winLeft.setValue(c.x);
            winTop.setValue(c.y);
          } else {
            dragY.setValue(Math.max(0, g.dy)); // fullscreen: surface follows the finger downward
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
              Animated.spring(winLeft, { toValue: rect.x, useNativeDriver: false, bounciness: 6, speed: 14 }),
              Animated.spring(winTop, { toValue: rect.y, useNativeDriver: false, bounciness: 6, speed: 14 }),
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
    [winLeft, winTop, dragY],
  );

  return {
    isPip,
    windowStyle: {
      left: winLeft,
      top: winTop,
      width: winWidth,
      height: winHeight,
      borderRadius: winRadius,
      transform: [{ translateY: dragY }],
    },
    innerStyle: {
      left: inLeft,
      top: inTop,
      width: screenW,
      height: screenH,
      transform: [{ scale: inScale }],
    },
    panHandlers: pan.panHandlers,
    shrink: stable.shrink,
    expand: stable.expand,
  };
}
