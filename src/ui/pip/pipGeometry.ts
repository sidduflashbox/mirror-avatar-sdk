// Pure geometry for the floating (picture-in-picture) window: where each corner sits, which
// corner a dragged window should snap to, and how to keep it on screen. No React, no Animated —
// just numbers, so the snapping behaviour can be reasoned about and unit-tested in isolation.

export type PipCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface PipInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PipFrameConfig {
  /** Screen (or host container) size in px. */
  screenW: number;
  screenH: number;
  /** The floating window's size in px. */
  pipW: number;
  pipH: number;
  /** Gap kept between the window and the screen/safe-area edge. */
  margin: number;
  insets: PipInsets;
}

export interface Point {
  x: number;
  y: number;
}

export interface PipSizeConfig {
  /** Screen (or host container) width in px. */
  screenW: number;
  /** Card width as a fraction of screenW. */
  fraction: number;
  /** Clamp for the resulting width. */
  minW: number;
  maxW: number;
  /** width : height (e.g. 0.75 = 3:4 portrait). */
  aspect: number;
}

/**
 * The corner card's size, derived from the screen so it looks proportional everywhere: width is a
 * clamped fraction of the screen width; height follows the aspect. Rounded to whole px.
 */
export function pipSize(cfg: PipSizeConfig): { w: number; h: number } {
  const w = Math.round(Math.min(Math.max(cfg.screenW * cfg.fraction, cfg.minW), cfg.maxW));
  const h = Math.round(w / cfg.aspect);
  return { w, h };
}

export interface PipInner {
  scale: number;
  left: number;
  top: number;
}

/**
 * How to place the fixed, full-screen avatar surface inside the small corner card *without
 * resizing it* — the surface stays screenW×screenH and is only transform-scaled, so the native
 * render swapchain never changes size (Android's Filament TextureView is unreliable across live
 * resizes).
 *
 * The surface is scaled uniformly to the card width and offset vertically so the avatar's focus
 * point (`focusFrac` of screen height — roughly the head-and-shoulders centre) lands at the card's
 * middle. The card clips the rest. `scale` is applied about the view centre (React Native's
 * default), which the left/top offsets already account for.
 */
export function pipInnerTransform(
  screenW: number,
  screenH: number,
  pipW: number,
  pipH: number,
  focusFrac: number,
): PipInner {
  const scale = pipW / screenW;
  const left = (pipW - screenW) / 2;
  const top = pipH / 2 - screenH / 2 - scale * (focusFrac * screenH - screenH / 2);
  return { scale, left, top };
}

/** The window's top-left corner, in screen px, for a given resting corner. */
export function cornerRect(corner: PipCorner, cfg: PipFrameConfig): Point {
  const { screenW, screenH, pipW, pipH, margin, insets } = cfg;
  const left = margin + insets.left;
  const right = screenW - pipW - margin - insets.right;
  const top = margin + insets.top;
  const bottom = screenH - pipH - margin - insets.bottom;
  switch (corner) {
    case 'tl':
      return { x: left, y: top };
    case 'tr':
      return { x: right, y: top };
    case 'bl':
      return { x: left, y: bottom };
    case 'br':
      return { x: right, y: bottom };
  }
}

/**
 * The corner nearest a window whose CENTRE is at (centerX, centerY). Split by the screen's
 * mid-lines — the quadrant the centre lands in is the corner it snaps home to.
 */
export function nearestCorner(
  centerX: number,
  centerY: number,
  screenW: number,
  screenH: number,
): PipCorner {
  const left = centerX < screenW / 2;
  const top = centerY < screenH / 2;
  if (top) return left ? 'tl' : 'tr';
  return left ? 'bl' : 'br';
}

/**
 * Clamp a proposed top-left so the window stays fully on screen, inside the margin and safe
 * area. If the screen is too small to honour both edges, the min edge wins (the window never
 * drifts off the top-left).
 */
export function clampToScreen(x: number, y: number, cfg: PipFrameConfig): Point {
  const { screenW, screenH, pipW, pipH, margin, insets } = cfg;
  const minX = margin + insets.left;
  const maxX = screenW - pipW - margin - insets.right;
  const minY = margin + insets.top;
  const maxY = screenH - pipH - margin - insets.bottom;
  return {
    x: Math.min(Math.max(x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(y, minY), Math.max(minY, maxY)),
  };
}
