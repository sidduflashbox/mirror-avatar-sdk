import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { fmtClock } from './fmtClock';
import type { MirrorSession } from '../live/MirrorSession';
import {
  BADGE_COLOR,
  BADGE_FONT_SIZE,
  BADGE_LETTER_SPACING,
  CAPTION_COLOR,
  CAPTION_FONT_SIZE,
  CAPTION_MAX_WIDTH,
  ERROR_BOTTOM,
  ERROR_COLOR,
  ERROR_FONT_SIZE,
  PILL_BG,
  PILL_BORDER,
  TIMER_COLOR,
  TIMER_FONT_SIZE,
  TIMER_ICON_COLOR,
} from './theme';

const pill = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PILL_BORDER,
    backgroundColor: PILL_BG,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});

/** Top-left agent name. Hidden once the call ends. */
export function AgentBadge({ name }: { name: string }) {
  if (!name) return null;
  return (
    <View style={pill.base}>
      <Text
        numberOfLines={1}
        style={{
          color: BADGE_COLOR,
          fontSize: BADGE_FONT_SIZE,
          fontWeight: '500',
          letterSpacing: BADGE_LETTER_SPACING,
        }}
      >
        {name.toUpperCase()}
      </Text>
    </View>
  );
}

/** A clock face drawn from two views (in place of a lucide <Clock/>). The stroke scales
 *  with size so it reads at the summary panel's 20px as well as the timer's 12px (at 12px the
 *  max clamps to 1.2, so the timer is unchanged). */
export function ClockGlyph({ size = 12, color = TIMER_ICON_COLOR }) {
  const stroke = Math.max(1.2, size * 0.09);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: stroke,
          height: size * 0.28,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ translateY: -size * 0.08 }],
        }}
      />
    </View>
  );
}

/**
 * Top-right elapsed time. Ticks once a second **while live only** — `getUsageMs()` banks
 * connected time, so the clock stops the moment the socket drops and resumes without
 * resetting. Owns its own state so the engine view never re-renders.
 */
export function CallTimer({ session }: { session: MirrorSession }) {
  const [, tick] = useState(0);
  const [live, setLive] = useState(
    session.state === 'listening' || session.state === 'speaking',
  );

  useEffect(
    () =>
      session.subscribe({
        onState: (s) => setLive(s === 'listening' || s === 'speaking'),
      }),
    [session],
  );

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  if (session.startedAt === null) return null;

  return (
    <View style={pill.base}>
      <ClockGlyph />
      <Text
        style={{
          color: TIMER_COLOR,
          fontSize: TIMER_FONT_SIZE,
          fontWeight: '500',
          fontVariant: ['tabular-nums'],
        }}
      >
        {fmtClock(session.getUsageMs())}
      </Text>
    </View>
  );
}

/** Cinematic subtitle — soft text over the scene, no chat bubble. Fades on change. */
export function Captions({ session }: { session: MirrorSession }) {
  const [text, setText] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(
    () => session.subscribe({ onCaption: (c) => setText(c.text) }),
    [session],
  );

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: text ? 1 : 0,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [text, opacity]);

  return (
    <Animated.View pointerEvents="none" style={{ opacity, alignItems: 'center' }}>
      <Text
        style={{
          maxWidth: CAPTION_MAX_WIDTH,
          textAlign: 'center',
          color: CAPTION_COLOR,
          fontSize: CAPTION_FONT_SIZE,
          fontWeight: '300',
          lineHeight: CAPTION_FONT_SIZE * 1.6,
          letterSpacing: 0.3,
          textShadowColor: 'rgba(0,0,0,0.8)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 20,
        }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

/** A quiet red line, not a dialog. */
export function ErrorWhisper({ session }: { session: MirrorSession }) {
  const [message, setMessage] = useState('');
  useEffect(
    () =>
      session.subscribe({
        // Last-resort fallbacks: an error must never render as a blank line. `message` is the
        // human copy, `code` is at least identifiable, and the literal covers a malformed error
        // arriving from a consumer-supplied callback.
        onError: (e) =>
          setMessage(e?.message?.trim() || e?.code || 'Something went wrong.'),
        // A live call clears whatever failed before it — a recovered reconnect must not leave
        // "Connection lost" sitting under a working conversation.
        onState: (s) => {
          if (s === 'listening' || s === 'speaking' || s === 'thinking') setMessage('');
        },
      }),
    [session],
  );
  if (!message) return null;
  return (
    <Text
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: ERROR_BOTTOM,
        textAlign: 'center',
        color: ERROR_COLOR,
        fontSize: ERROR_FONT_SIZE,
      }}
    >
      {message}
    </Text>
  );
}
