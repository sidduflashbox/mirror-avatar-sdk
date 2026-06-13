import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';
import {
  WAVE_BAR_GLOW,
  WAVE_BAR_GRADIENT,
  WAVE_BAR_MAX_W,
  WAVE_BAR_SLOT,
  WAVE_H,
  WAVE_MAX_WIDTH,
  WAVE_MUTED_OPACITY,
} from './theme';
import { barHeight, edgeAt, normalizeLevel, smoothLevel } from './waveform';

/**
 * Live mic-level equalizer. Bottom-anchored rounded bars whose heights track the mic RMS,
 * both ends tapering out. Dims to 0.1 while muted.
 *
 * Each bar is a View scaled about its bottom edge, driven from an animation frame loop — no
 * React state, so nothing above re-renders (which would release the engine's GPU buffers).
 *
 * `levelRef` is the session's `micLevel`, sampled rather than subscribed to.
 */
export function MicWaveform({
  levelRef,
  active,
}: {
  levelRef: { current: number };
  active: boolean;
}) {
  const barCount = Math.max(6, Math.floor(WAVE_MAX_WIDTH / WAVE_BAR_SLOT));
  const slot = WAVE_MAX_WIDTH / barCount;
  const barWidth = Math.min(WAVE_BAR_MAX_W, slot * 0.55);

  // One shared scale per bar. `useMemo` so identities survive re-renders of the parent.
  const scales = useMemo(
    () => Array.from({ length: barCount }, () => new Animated.Value(0)),
    [barCount],
  );
  const edges = useMemo(
    () =>
      Array.from({ length: barCount }, (_, i) =>
        edgeAt(barCount > 1 ? i / (barCount - 1) : 0.5),
      ),
    [barCount],
  );

  const smoothed = useRef(0);
  const phase = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const target = activeRef.current ? normalizeLevel(levelRef.current) : 0;
      smoothed.current = smoothLevel(smoothed.current, target);
      phase.current += 0.045;

      for (let i = 0; i < barCount; i++) {
        const nx = barCount > 1 ? i / (barCount - 1) : 0.5;
        const h = barHeight(nx, smoothed.current, phase.current, WAVE_H);
        scales[i]!.setValue(h / WAVE_H);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [barCount, levelRef, scales]);

  const opacity = useRef(new Animated.Value(active ? 1 : WAVE_MUTED_OPACITY)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: active ? 1 : WAVE_MUTED_OPACITY,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [active, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: WAVE_MAX_WIDTH,
        height: WAVE_H,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        opacity,
      }}
    >
      {scales.map((scale, i) => (
        <Animated.View
          key={i}
          style={{
            width: barWidth,
            height: WAVE_H,
            borderRadius: barWidth / 2,
            opacity: edges[i],
            transformOrigin: 'bottom',
            transform: [{ scaleY: scale }],
            // Real gradient + soft glow, drawn per bar.
            experimental_backgroundImage: WAVE_BAR_GRADIENT,
            boxShadow: WAVE_BAR_GLOW,
          }}
        />
      ))}
    </Animated.View>
  );
}
