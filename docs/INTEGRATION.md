# Integrating the Mirror Avatar SDK into a React Native app

`mirror-avatar-sdk` adds a **real-time talking 3D avatar** to a React Native app: the
user speaks, the avatar listens, replies with voice, and lip-syncs — over a live
WebSocket to the Mirror platform. It runs on **iOS and Android** from one JS API.

You add a session and a view (~15 lines) and supply one thing the SDK deliberately does
**not** ship: a `getToken` function that fetches a short-lived session token from *your*
backend. This guide matches the SDK as shipped in the tarball; it was validated end-to-end
on **RN 0.86 / React 19** (iOS + Android).

---

## A. What the SDK provides

| Item | Form |
|---|---|
| The package `mirror-avatar-sdk` | a packed `.tgz` (or a private registry / Git tag) |
| Compiled JS + TypeScript types | `lib/` — no Metro/Babel config for the SDK itself |
| iOS native (audio) — prebuilt `MirrorCore.xcframework` + Swift sources + podspec | inside the package; linked by CocoaPods autolinking |
| Android native (audio) — Kotlin sources + `build.gradle.kts` | inside the package; linked by Gradle autolinking |
| The 3D avatar model | **downloaded at runtime** from Mirror's CDN — you bundle nothing |
| The live backend URL | **baked in (production), internal** — you do not configure it |

The public API is exactly two things plus their types:

```ts
import { MirrorSDK, MirrorAvatarView } from 'mirror-avatar-sdk';
```

## B. What your app must provide

1. **The four peer dependencies** (install them yourself — the SDK does not bundle them):
   `react`, `react-native`, `react-native-filament` (>=1.11), `react-native-worklets-core` (>=1.6).
2. **A `getToken` function** that returns a short-lived session token. It must call **your own
   backend**, which holds your **Mirror org API key**. The key must **never** live in the app.
   See §D-5.
3. **Provisioning on the Mirror platform** — the SDK connects to Mirror's production backend, so
   you need an **org API key**, and the **agent(s)** you name in `agentId` must exist for your org.
   This is arranged with Mirror, out of band; it is not a code step.
4. **Safe-area insets** — `MirrorAvatarView` takes an `insets` prop rather than depending on a
   safe-area library itself. Use `react-native-safe-area-context` (or pass constants).
5. A React Native **CLI** app (or Expo with a dev client / `expo prebuild` — not Expo Go), plus a
   Mac + Xcode for iOS builds.

## C. Compatibility

- **iOS and Android** (both shipping).
- **React Native >= 0.73** (peer dependency). Validated on **RN 0.86 / React 19.2**.
- CocoaPods (iOS); Android `minSdkVersion` **>= 24**.

---

## D. Step-by-step

### 1. Install the package + peer dependencies

```bash
npm install /path/to/mirror-avatar-sdk-0.1.1.tgz
npm install react-native-filament react-native-worklets-core react-native-safe-area-context
```
(`react` / `react-native` come from your app.)

### 2. Configure Babel for worklets

The face is driven by `react-native-worklets-core`, whose Babel plugin must be enabled. Add it to
`babel.config.js`:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets-core/plugin'],   // required
};
```

That plugin also needs a few Babel transforms present as devDependencies (they are not always
hoisted into a fresh app — installing them explicitly avoids a `Cannot find module '@babel/...'`
build error):

```bash
npm install -D @babel/plugin-proposal-optional-chaining \
               @babel/plugin-proposal-nullish-coalescing-operator \
               @babel/preset-typescript
```

After changing Babel config, restart Metro with a reset cache: `npm start -- --reset-cache`.

### 3. iOS native

```bash
LANG=en_US.UTF-8 npx pod-install ios
```
Autolinking finds the SDK pod + `MirrorCore.xcframework` — no manual Podfile/Xcode edits. The
`LANG=` prefix avoids a CocoaPods `Encoding::CompatibilityError` on non-UTF-8 locales.

The avatar needs the **microphone**; add to the app's `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Talk to the avatar.</string>
```

### 4. Android native

Autolinking picks up the SDK's Gradle module — no manual edits. Ensure `minSdkVersion >= 24`, and
add the mic permission to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### 5. Provide `getToken` (your backend holds the org key)

The SDK is **token-agnostic**: it calls your `getToken` on start, on every reconnect, and
proactively before expiry. `getToken` must reach **your** server, which holds the org API key and
mints a session token by calling the Mirror platform. **Never put the org key in the app** — anyone
can extract it from a release build.

```ts
// getToken.ts — YOUR code. TOKEN_SERVER_URL points at YOUR backend, not Mirror's.
const TOKEN_SERVER_URL = 'https://tokens.your-domain.com';

export async function getToken(): Promise<string> {
  const r = await fetch(`${TOKEN_SERVER_URL}/token`);
  if (!r.ok) throw new Error(`token ${r.status}`);
  const { token } = await r.json();
  return token; // a plain string is accepted; see the richer return below
}
```

Your token server does, roughly: `POST https://platform.mirrorr.ai/api/v1/sessions/init` with
`Authorization: Bearer <your-org-key>` and body `{ agent_slug, subject_external_id }`, then returns
the session token to the app. A reference implementation is available from Mirror.

For **session resume + proactive refresh**, return an object instead of a bare string:
```ts
return { token, sessionId, expiresInMs };  // MirrorTokenResult
```
`getToken` receives `{ reason, agentId?, language?, sessionId? }` so your backend can select the
agent and resume the same session on reconnect.

> **Dev vs prod transport:** a token server on a **LAN IP over `http://`** works during local
> testing (iOS local-networking + Android debug cleartext). A **release** build blocks cleartext
> to a public host — your production token server must be **`https://`**.

### 6. Add the session + view

Create a session with `MirrorSDK.createSession`, then render `MirrorAvatarView`. Wrap the app in a
`SafeAreaProvider` so you can pass real insets.

```tsx
import { useRef, useState } from 'react';
import { View, Button } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MirrorSDK, MirrorAvatarView } from 'mirror-avatar-sdk';
import { getToken } from './getToken';

export default function App() {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  );
}

function Screen() {
  const insets = useSafeAreaInsets();
  const [inCall, setInCall] = useState(false);
  const sessionRef = useRef<ReturnType<typeof MirrorSDK.createSession> | null>(null);

  const startCall = () => {
    const s = MirrorSDK.createSession({
      agentId: 'intake',                 // must exist for your org
      getToken,
      language: 'en',                    // optional; defaults to 'en'
      onStateChange: (state) => console.log('[mirror] state:', state),
      onError: (err) => console.warn('[mirror] error:', err.code, err.message),
    });
    s.start();
    sessionRef.current = s;
    setInCall(true);
  };

  // Return to your UI. Driven by the summary's Back button — NOT by onEnded.
  const closeMirror = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setInCall(false);
  };

  if (inCall && sessionRef.current) {
    return (
      <MirrorAvatarView
        session={sessionRef.current}
        agentName="Intake Assistant"
        insets={insets}
        // onEnded is a NOTIFICATION (call ended, here's the duration) — do NOT unmount here,
        // or the SDK's end-of-call summary panel never shows. Close from onBackToAgents.
        onEnded={(info) => console.log('[mirror] ended, durationMs=', info.durationMs)}
        onBackToAgents={closeMirror}
      />
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Button title="Talk to the avatar" onPress={startCall} />
    </View>
  );
}
```

**`createSession(options)`** — `agentId?`, `language?` (default `'en'`), `getToken`,
`onStateChange?`, `onError?`, `onCaption?`. One agent per session; change it by creating a new one.

**`MirrorAvatarView` props** — `session` (required), `agentName?`, `insets?`, `onEnded?`,
`onBackToAgents?`, `onViewSessionDetails?`, `onReady?`, `style?`.

### 7. Build & run

```bash
npm start -- --reset-cache            # if you changed Babel/config
npx react-native run-ios --device     # or run-android
```
Grant the mic prompt, tap the button, speak — the avatar replies and lip-syncs.

---

## E. Responsibilities

| Your app does | The SDK does |
|---|---|
| Decide when to start/close a session | Mic capture, streaming, playback, lip-sync, reconnect |
| Supply `getToken` (your backend holds the org key) | Opens the WS with the token; re-mints on reconnect |
| Provide `insets`, render `MirrorAvatarView` | Avatar, captions, call controls, end-of-call summary |
| Close from `onBackToAgents` | Downloads + caches the model; owns the backend URL |

## F. Troubleshooting

- **`Cannot find module '@babel/plugin-proposal-optional-chaining'`** (or nullish / preset-typescript)
  → install the three Babel devDeps in §D-2, then `npm start -- --reset-cache`.
- **Avatar screen opens then immediately closes** → you are (a) unmounting on `onEnded` — use
  `onBackToAgents` to close; and/or (b) hitting a token/backend mismatch. Wire `onError` /
  `onStateChange` (as above) to see the reason. A close code `4001` means the token was rejected —
  usually the token was minted for a different environment or the org/agent isn't provisioned.
- **`token <status>` thrown from `getToken`** → your token server returned non-2xx (bad org key =
  401/403, quota exhausted = 429). Check the server logs.
- **`TypeError: Network request failed`** → the device can't reach `TOKEN_SERVER_URL`. On a physical
  device use the Mac's **LAN IP** (not `localhost`); on a **release** build a public token server
  must be **`https://`** (cleartext `http://` to a public host is blocked).
- **Changes to the SDK/app don't reach the device** → Metro caches; `npm start -- --reset-cache`
  and relaunch.
- **No `console.log` in the Metro terminal** (RN 0.76+ on a physical device) → logs go to React
  Native DevTools / device syslog (`adb logcat` on Android), not the terminal.
- **`pod install` crashes (`Encoding::CompatibilityError`)** → prefix `LANG=en_US.UTF-8`.

## G. Notes & current scope

- The SDK connects to Mirror's **production** backend (baked in, internal); there is no
  consumer-facing environment/URL switch by design.
- The avatar model auto-downloads from Mirror's CDN on first load; no asset bundling.
- The org API key lives **only** on your token server, never in the app.
- A non-Ready-Player-Me model may need a per-model profile (joint/orientation config); talk to
  Mirror if you need a custom model.
