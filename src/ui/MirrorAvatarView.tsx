import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-worklets-core';
import { filamentAvatarEngine } from '../engine/filament';
import type { BakedClip } from '../engine/AvatarEngine';
import { ZOOM_ENDED, ZOOM_LIVE, ZOOM_NEUTRAL } from '../engine/camera';
import type { MirrorSession } from '../live/MirrorSession';
import type { MirrorSessionState } from '../types';
import { AvatarStage } from './AvatarStage';
import { AmbientGlow } from './AmbientGlow';
import { BottomFade } from './BottomFade';
import { AgentBadge, CallTimer, Captions, ErrorWhisper } from './Chrome';
import { CallControls } from './CallControls';
import { EndCallSummary } from './EndCallSummary';
import { MicWaveform } from './MicWaveform';
import { ReconnectingVeil } from './ReconnectingVeil';
import {
  AVATAR_BAND_HEIGHT,
  AVATAR_BAND_TOP,
  AVATAR_ENDED_OPACITY,
  ENTER_CONTROLS_DELAY_MS,
  ENTER_CONTROLS_MS,
  ENTER_MS,
  STAGE_BG,
} from './theme';

export interface MirrorAvatarViewProps {
  /** The call to render. Create it with MirrorSDK.createSession(). */
  session: MirrorSession;
  /** Shown in the top-left badge. */
  agentName?: string;
  /** Safe-area offsets. The SDK takes no safe-area dependency of its own. */
  insets?: { top?: number; bottom?: number; left?: number; right?: number };
  /** Fired after the user hangs up, with the final banked duration. */
  onEnded?: (info: { durationMs: number }) => void;
  /**
   * End-of-call summary buttons. Each renders only if its handler is given — the SDK owns no
   * navigation, so the host wires these to its own routes (e.g. a session-detail page and the
   * agent list). Omit both for a duration-only summary.
   */
  onViewSessionDetails?: () => void;
  onBackToAgents?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Fires once the avatar model has loaded and the first frame is on screen. */
  onReady?: () => void;
}

/**
 * The avatar surface, memoised. The chrome above re-renders every second (the timer) and on
 * every caption; this must not, because re-rendering the engine view releases the scene's
 * GPU buffers. Its props are a session, three shared values and a stable callback, so a
 * shallow compare is sufficient.
 */
const MemoAvatarStage = memo(AvatarStage);

const LIVE_STATES: MirrorSessionState[] = [
  'connecting',
  'reconnecting',
  'listening',
  'speaking',
];

/**
 * The full call experience: avatar + ambient glow + captions + controls, driven by one
 * session.
 */
export function MirrorAvatarView({
  session,
  agentName = '',
  insets,
  onEnded,
  onViewSessionDetails,
  onBackToAgents,
  style,
  onReady,
}: MirrorAvatarViewProps) {
  const clock = useSharedValue(0);
  const clip = useSharedValue<BakedClip | null>(null);
  // A shared value, not a prop, so the dolly never re-renders the engine view.
  const zoom = useSharedValue<number>(ZOOM_NEUTRAL);

  const [state, setState] = useState<MirrorSessionState>(session.state);
  const [ended, setEnded] = useState(false);
  // Snapshotted at the moment of ending so the panel shows a stable value — the live clock
  // stops the instant the socket drops.
  const [finalMs, setFinalMs] = useState<number | null>(null);

  useEffect(() => session.subscribe({ onState: setState }), [session]);

  // The session ended on its own (idle timeout / server close / fatal error): snapshot the
  // duration once and raise the summary. `endCall` handles the explicit-hangup path; this
  // covers everything else. Gated on `startedAt` so a pre-connect failure never flashes a
  // "0:00" panel. Raised identically on status `ended | error`.
  useEffect(() => {
    if (ended) return;
    if ((state === 'stopped' || state === 'error') && session.startedAt !== null) {
      const durationMs = session.getUsageMs();
      setFinalMs(durationMs);
      setEnded(true);
      onEnded?.({ durationMs });
    }
  }, [state, ended, session, onEnded]);

  // Camera dolly: neutral while connecting, eases in once live, pulls back once ended.
  useEffect(() => {
    zoom.value = ended
      ? ZOOM_ENDED
      : state === 'listening' || state === 'speaking'
        ? ZOOM_LIVE
        : ZOOM_NEUTRAL;
  }, [state, ended, zoom]);

  // The stage fades in for a calm entrance.
  const entered = useRef(new Animated.Value(0)).current;
  const enteredControls = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entered, {
      toValue: 1,
      duration: ENTER_MS,
      useNativeDriver: true,
    }).start();
    Animated.timing(enteredControls, {
      toValue: 1,
      duration: ENTER_CONTROLS_MS,
      delay: ENTER_CONTROLS_DELAY_MS,
      useNativeDriver: true,
    }).start();
  }, [entered, enteredControls]);

  const avatarOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(avatarOpacity, {
      toValue: ended ? AVATAR_ENDED_OPACITY : 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [ended, avatarOpacity]);

  const endCall = () => {
    const durationMs = session.getUsageMs();
    session.stop();
    setFinalMs(durationMs);
    setEnded(true);
    onEnded?.({ durationMs });
  };

  const live = LIVE_STATES.includes(state) && !ended;
  const top = Math.max(16, insets?.top ?? 0);
  // `max(1.5rem, safe-area-inset-bottom)` plus +20 for breathing room on a native screen with
  // no browser nav-bar below.
  const bottom = Math.max(24, insets?.bottom ?? 0) + 20;
  const side = Math.max(20, insets?.left ?? 0);

  return (
    <View style={[styles.stage, style]}>
      <AmbientGlow state={ended ? 'stopped' : state} />

      {/* The avatar lives in a band, not the full screen — this is what sets the shot.
          A 28° vertical FOV over a full-height viewport would fill the frame with a face. */}
      <Animated.View style={[styles.band, { opacity: avatarOpacity }]}>
        <MemoAvatarStage
          engine={filamentAvatarEngine}
          session={session}
          clock={clock}
          clip={clip}
          zoom={zoom}
          onReady={onReady}
        />
        <BottomFade />
      </Animated.View>

      <Animated.View style={[styles.badge, { top, left: side, opacity: entered }]}>
        {!ended && <AgentBadge name={agentName} />}
      </Animated.View>

      <Animated.View style={[styles.timer, { top, right: side, opacity: entered }]}>
        {!ended && <CallTimer session={session} />}
      </Animated.View>

      {!ended && (
        <View style={styles.captions} pointerEvents="none">
          <Captions session={session} />
        </View>
      )}

      {!ended && <ErrorWhisper session={session} />}

      {live && (
        <Animated.View
          style={[styles.waveform, { bottom: bottom + 100, opacity: enteredControls }]}
        >
          <MicWaveform levelRef={session.micLevel} active={!session.muted} />
        </Animated.View>
      )}

      {live && (
        <Animated.View
          style={[styles.controls, { bottom, opacity: enteredControls }]}
        >
          <CallControls session={session} onEnd={endCall} />
        </Animated.View>
      )}

      {/* Reconnecting veil — dark scrim + spinner over the whole stage while the socket is
          down and the SDK re-mints a token to resume. Above the chrome, below the end summary. */}
      {state === 'reconnecting' && !ended && <ReconnectingVeil />}

      {/* Post-call summary — raised at the vertical midpoint over the dimmed, still-animating
          avatar. */}
      {ended && (
        <View style={styles.summary} pointerEvents="box-none">
          <EndCallSummary
            durationMs={finalMs ?? session.getUsageMs()}
            agentName={agentName || undefined}
            onViewSessionDetails={onViewSessionDetails}
            onBackToAgents={onBackToAgents}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: STAGE_BG, overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: AVATAR_BAND_TOP,
    height: AVATAR_BAND_HEIGHT,
  },
  badge: { position: 'absolute', maxWidth: '60%' },
  timer: { position: 'absolute' },
  captions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '27%',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  waveform: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  controls: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  summary: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
});
