import React from 'react';
import { Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { CLOSE_ICON, SHRINK_ICON } from '../icons';
import {
  PIP_BTN_BG,
  PIP_BTN_BORDER,
  PIP_CLOSE_BTN,
  PIP_SHRINK_BTN,
} from '../theme';

function RoundGlyphButton({
  size,
  glyph,
  iconSize,
  label,
  onPress,
  style,
}: {
  size: number;
  glyph: string;
  iconSize: number;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: PIP_BTN_BG,
          borderWidth: 1,
          borderColor: PIP_BTN_BORDER,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
        style,
      ]}
    >
      <Image
        source={{ uri: glyph }}
        style={{ width: iconSize, height: iconSize, tintColor: 'rgba(255,255,255,0.9)' }}
        resizeMode="contain"
      />
    </Pressable>
  );
}

/** The shrink-to-corner (⤡) control shown on the fullscreen surface. */
export function ShrinkButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <RoundGlyphButton
      size={PIP_SHRINK_BTN}
      glyph={SHRINK_ICON}
      iconSize={20}
      label="Minimize to corner"
      onPress={onPress}
      style={style}
    />
  );
}

/** The close/remove (✕) control shown on the corner card. */
export function CloseButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <RoundGlyphButton
      size={PIP_CLOSE_BTN}
      glyph={CLOSE_ICON}
      iconSize={14}
      label="End and close"
      onPress={onPress}
      style={[styles.close, style]}
    />
  );
}

const styles = StyleSheet.create({
  close: { position: 'absolute', top: 6, right: 6, zIndex: 10 },
});
