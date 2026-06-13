import React from 'react';
import { View } from 'react-native';
import { FADE_HEIGHT, FADE_OFFSET, STAGE_BG } from './theme';

/**
 * Dissolves the avatar's lower edge into the backdrop.
 *
 * A real CSS gradient — React Native 0.76+ parses these, so this
 * needs no dependency and no slice-stack approximation (which banded visibly against the
 * bright skin and shirt).
 */
export function BottomFade() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: FADE_OFFSET,
        height: FADE_HEIGHT,
        experimental_backgroundImage: `linear-gradient(to bottom, transparent, ${STAGE_BG} 80%)`,
      }}
    />
  );
}
