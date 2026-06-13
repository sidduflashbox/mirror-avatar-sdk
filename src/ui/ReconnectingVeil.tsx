import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { VEIL_BG, VEIL_CARD_BG, VEIL_CARD_WIDTH } from './theme';

/**
 * The reconnecting veil — a dark scrim over the whole stage with a centered card: a spinning
 * ring + "Reconnecting…". Shown while the socket is down and the SDK is re-minting a token to
 * resume the session.
 *
 * RN has no backdrop-blur, so the scrim is a flat dark wash (VEIL_BG) rather than a translucent
 * blurred panel.
 */
export function ReconnectingVeil() {
  // `animate-spin`: a continuous linear rotation.
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.scrim} pointerEvents="auto">
      <View style={styles.card}>
        {/* A ring with one transparent edge, spinning — the `border-t-transparent` trick. */}
        <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
        <Text style={styles.label}>Reconnecting…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: VEIL_BG,
  },
  card: {
    width: VEIL_CARD_WIDTH,
    maxWidth: '100%',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16, // rounded-2xl
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)', // border-white/10
    backgroundColor: VEIL_CARD_BG,
    padding: 24, // p-6
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.70)', // border-white/70
    borderTopColor: 'transparent', // border-t-transparent
  },
  label: {
    fontSize: 14,
    fontWeight: '500', // font-medium
    color: '#FFFFFF',
  },
});
