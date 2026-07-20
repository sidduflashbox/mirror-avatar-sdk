import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ClockGlyph } from './Chrome';
import { fmtClock } from './fmtClock';
import {
  SUMMARY_ACCENT_GLOW,
  SUMMARY_ACCENT_GRADIENT,
  SUMMARY_AGENT_COLOR,
  SUMMARY_BG,
  SUMMARY_BORDER,
  SUMMARY_CLOCK_COLOR,
  SUMMARY_LABEL_COLOR,
  SUMMARY_SECONDARY_BG,
  SUMMARY_SECONDARY_BORDER,
  SUMMARY_SECONDARY_TEXT,
  SUMMARY_TIME_COLOR,
  SUMMARY_TITLE_COLOR,
} from './theme';

/**
 * The end-of-call summary. Not a full-screen backdrop: a semi-transparent frosted card raised
 * over the still-animating (dimmed) avatar, carrying the session duration.
 *
 * The two buttons drive navigation the SDK does not own (e.g. a session-detail page and the
 * agent list), so each is exposed as an optional callback and rendered only when provided —
 * the same navigation-agnostic stance the SDK takes with tokens.
 */
export function EndCallSummary({
  durationMs,
  agentName,
  onViewSessionDetails,
  onBackToAgents,
}: {
  durationMs: number;
  agentName?: string;
  onViewSessionDetails?: () => void;
  onBackToAgents?: () => void;
}) {
  // `animate-fade-in`.
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityRole="summary"
      accessibilityLabel="Session ended"
      style={[styles.card, { opacity }]}
    >
      <Text style={styles.title}>Session ended</Text>

      <View style={styles.timeRow}>
        <ClockGlyph size={20} color={SUMMARY_CLOCK_COLOR} />
        <Text style={styles.time}>{fmtClock(durationMs)}</Text>
      </View>
      <Text style={styles.label}>TIME ON CALL</Text>
      {agentName ? <Text style={styles.agent}>{agentName}</Text> : null}

      {(onViewSessionDetails || onBackToAgents) && (
        <View style={styles.buttons}>
          {onViewSessionDetails && (
            <Pressable
              onPress={onViewSessionDetails}
              accessibilityRole="button"
              accessibilityLabel="View session details"
              style={({ pressed }) => [
                styles.pill,
                styles.pillPrimary,
                pressed && styles.pressed,
              ]}
            >
              <FileTextGlyph />
              <Text style={styles.pillPrimaryText}>View session details</Text>
            </Pressable>
          )}
          {onBackToAgents && (
            <Pressable
              onPress={onBackToAgents}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [
                styles.pill,
                styles.pillSecondary,
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeftGlyph />
              <Text style={styles.pillSecondaryText}>Back</Text>
            </Pressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

/** lucide FileText at 16px (`h-4 w-4`): a page with three text lines. */
function FileTextGlyph({ color = '#FFFFFF' }: { color?: string }) {
  const line = { height: 1.3, backgroundColor: color, borderRadius: 1 } as const;
  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 11,
          height: 13,
          borderRadius: 2,
          borderWidth: 1.6,
          borderColor: color,
          paddingHorizontal: 2,
          justifyContent: 'center',
          gap: 1.8,
        }}
      >
        <View style={line} />
        <View style={line} />
        <View style={[line, { width: '65%' }]} />
      </View>
    </View>
  );
}

/** lucide ArrowLeft at 16px (`h-4 w-4`): a shaft with a left chevron head. */
function ArrowLeftGlyph({ color = SUMMARY_SECONDARY_TEXT }: { color?: string }) {
  return (
    <View style={{ width: 16, height: 16, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          left: 2,
          right: 1.5,
          top: 7.1,
          height: 1.75,
          borderRadius: 1,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 1.5,
          top: 5,
          width: 6,
          height: 6,
          borderLeftWidth: 1.75,
          borderBottomWidth: 1.75,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    maxWidth: '100%',
    alignItems: 'center',
    borderRadius: 24, // rounded-3xl
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SUMMARY_BORDER,
    backgroundColor: SUMMARY_BG,
    paddingHorizontal: 36, // px-9
    paddingVertical: 28, // py-7
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '300', // font-light
    letterSpacing: 0.4, // tracking-wide
    color: SUMMARY_TITLE_COLOR,
  },
  timeRow: {
    marginTop: 12, // mt-3
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // gap-2
  },
  time: {
    fontSize: 34,
    fontWeight: '600', // font-semibold
    lineHeight: 34,
    color: SUMMARY_TIME_COLOR,
    fontVariant: ['tabular-nums'],
  },
  label: {
    marginTop: 8, // mt-2
    fontSize: 11,
    letterSpacing: 2, // tracking-[0.18em]
    color: SUMMARY_LABEL_COLOR,
  },
  agent: {
    marginTop: 4, // mt-1
    fontSize: 12,
    color: SUMMARY_AGENT_COLOR,
  },
  buttons: {
    marginTop: 28, // mt-7
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12, // gap-3
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999, // rounded-full
    paddingHorizontal: 24, // px-6
    paddingVertical: 10, // py-2.5
  },
  pillPrimary: {
    experimental_backgroundImage: SUMMARY_ACCENT_GRADIENT,
    shadowColor: SUMMARY_ACCENT_GLOW,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  pillPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pillSecondary: {
    backgroundColor: SUMMARY_SECONDARY_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SUMMARY_SECONDARY_BORDER,
  },
  pillSecondaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: SUMMARY_SECONDARY_TEXT,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
