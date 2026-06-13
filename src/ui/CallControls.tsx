import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { MirrorSession } from '../live/MirrorSession';
import { MIC_ICON, MIC_OFF_ICON, PHONE_OFF_ICON } from './icons';
import {
  CONTROL_GAP,
  CONTROL_LABEL_COLOR,
  CONTROL_LABEL_SIZE,
  CONTROL_SIZE,
  END_BG,
  END_PADDING_H,
  ICON_SIZE,
  MUTE_ACTIVE_BG,
  MUTE_BG,
  MUTE_BORDER,
} from './theme';

/** The lucide glyph, tinted. See icons.ts for why these are data URIs. */
function Glyph({ source }: { source: string }) {
  return (
    <Image
      source={{ uri: source }}
      style={{ width: ICON_SIZE, height: ICON_SIZE, tintColor: '#FFFFFF' }}
      resizeMode="contain"
    />
  );
}

function ControlLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: CONTROL_LABEL_COLOR,
        fontSize: CONTROL_LABEL_SIZE,
        fontWeight: '500',
        marginTop: 8,
      }}
    >
      {children}
    </Text>
  );
}

/** Video-call style: round mic toggle (red while muted) + a red end-call pill. */
export function CallControls({
  session,
  onEnd,
}: {
  session: MirrorSession;
  onEnd: () => void;
}) {
  const [muted, setMuted] = useState(session.muted);
  useEffect(() => setMuted(session.muted), [session]);

  const toggleMute = () => {
    const next = !session.muted;
    session.mute(next);
    setMuted(next);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: CONTROL_GAP }}>
      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={toggleMute}
          accessibilityRole="button"
          accessibilityState={{ selected: muted }}
          accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
          style={({ pressed }) => ({
            width: CONTROL_SIZE,
            height: CONTROL_SIZE,
            borderRadius: CONTROL_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: muted ? MUTE_ACTIVE_BG : MUTE_BORDER,
            backgroundColor: muted ? MUTE_ACTIVE_BG : MUTE_BG,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <Glyph source={muted ? MIC_OFF_ICON : MIC_ICON} />
        </Pressable>
        <ControlLabel>{muted ? 'Muted' : 'Mute'}</ControlLabel>
      </View>

      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={onEnd}
          accessibilityRole="button"
          accessibilityLabel="End call"
          style={({ pressed }) => ({
            height: CONTROL_SIZE,
            borderRadius: CONTROL_SIZE / 2,
            paddingHorizontal: END_PADDING_H,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: END_BG,
            shadowColor: END_BG,
            shadowOpacity: 0.3,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <Glyph source={PHONE_OFF_ICON} />
        </Pressable>
        <ControlLabel>End</ControlLabel>
      </View>
    </View>
  );
}
