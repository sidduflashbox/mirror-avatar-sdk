import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import {
  GLOW_BLUR_PX,
  GLOW_ERROR,
  GLOW_FADE_MS,
  GLOW_IDLE,
  GLOW_LIVE,
  GLOW_SPEAKING,
} from './theme';
import type { MirrorSessionState } from '../types';

/** Glow hue per session state. */
export function glowColor(state: MirrorSessionState): string {
  if (state === 'error') return GLOW_ERROR;
  if (state === 'speaking') return GLOW_SPEAKING;
  if (state === 'listening') return GLOW_LIVE;
  return GLOW_IDLE;
}

/** An ellipse wash + 80px blur, for one hue. */
function gradient(color: string) {
  return {
    experimental_backgroundImage: `radial-gradient(ellipse 80% 70% at 50% 35%, ${color} 0%, transparent 100%)`,
    filter: `blur(${GLOW_BLUR_PX}px)`,
  };
}

/**
 * A soft wash whose hue tracks the conversation: blue while listening, warm while the
 * agent speaks, red on error.
 *
 * The hue morphs over one second — a smooth colour interpolation where the glow never
 * disappears. React Native can't tween a gradient string, so we CROSS-FADE two stacked
 * layers: the outgoing hue fades out as the incoming hue fades in over the same second, so
 * the centre brightness stays roughly constant.
 *
 * (The previous single-layer version reset opacity to 0 and back on every change, which
 * blinked the whole glow out and in each time the agent started or stopped talking — the
 * "animation behind the model" that read as a pulse.)
 */
export function AmbientGlow({ state }: { state: MirrorSessionState }) {
  const color = glowColor(state);
  const [outgoing, setOutgoing] = useState(color);
  const [incoming, setIncoming] = useState(color);
  // 1 = fully settled on `incoming`; a hue change resets to 0 and eases back to 1.
  const p = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (color === incoming) return;
    setOutgoing(incoming);
    setIncoming(color);
    p.setValue(0);
    const anim = Animated.timing(p, {
      toValue: 1,
      duration: GLOW_FADE_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [color, incoming, p]);

  const outgoingOpacity = p.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, gradient(outgoing), { opacity: outgoingOpacity }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, gradient(incoming), { opacity: p }]}
      />
    </>
  );
}
