# Integrating the Mirror Avatar SDK into a React Native app

`mirror-avatar-sdk` adds a **real-time talking 3D avatar** to a React Native app: the
user speaks, the avatar listens, replies with voice, and lip-syncs — over a live
WebSocket to the Mirror platform. It runs on **iOS and Android** from one JS API.
Render it full-screen, or as a draggable **floating (picture-in-picture) window** that
stays live while the user moves around the rest of your app (see §D-7).

You add a session and a view (~15 lines) and supply one thing the SDK deliberately does
**not** ship: a `getToken` function that fetches a short-lived session token from *your*
backend. This guide matches the SDK as shipped in the tarball; it was validated end-to-end
on **RN 0.86 / React 19** (iOS + Android), on both a **React Native CLI** app and an
**Expo** app (SDK 57, prebuild).

---

## A. What the SDK provides

| Item | Form |
|---|---|
| The package `mirror-avatar-sdk` | install from the GitHub tarball URL, a local `.tgz`, or a registry |
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
   you need an **org API key**, and the **agent(s)** you name in `agentSlug` must exist for your org.
   This is arranged with Mirror, out of band; it is not a code step.
4. **Safe-area insets** — `MirrorAvatarView` takes an `insets` prop rather than depending on a
   safe-area library itself. Use `react-native-safe-area-context` (or pass constants).
5. **An app that builds native code** — either a React Native **CLI** app, or an **Expo** app using
   `expo prebuild` / a custom dev client / EAS Build. Plus a Mac + Xcode for iOS builds.
   **Expo Go cannot run this SDK** (see §C).

## C. Compatibility

- **iOS and Android** (both shipping).
- **React Native >= 0.73** (peer dependency). Validated on **RN 0.86 / React 19.2**.
- CocoaPods (iOS); iOS deployment target **>= 15.0** (the podspec declares it, so a lower target
  fails at `pod install`); Android `minSdkVersion` **>= 24**.
- **Expo:** supported via `expo prebuild` / dev client / EAS Build. Validated on **Expo SDK 57**
  (which ships RN 0.86 / React 19.2.3). **Expo Go is not supported** — it runs a fixed native
  binary and cannot load the SDK's iOS xcframework or Android Kotlin module. No Expo config plugin
  is needed; autolinking handles it.

---

## D. Step-by-step

> ### Choose your path first
>
> Steps **2**, **3**, **4** and **8** differ between React Native CLI and Expo, and the two are
> **not interchangeable** — using the CLI Babel preset in an Expo app breaks the build. Each of
> those steps is split into a **React Native CLI** block and an **Expo** block. Follow one
> consistently. Steps 1, 5, 6 and 7 are identical for both.

### 1. Install the package + peer dependencies

Install the SDK **and** its native peer deps **first — before the native steps** — because
CocoaPods (and Gradle) only link the native modules that are present at pod/build time.

```bash
# the SDK — prebuilt tarball from Mirror's CDN
npm install https://mirrorr.blr1.cdn.digitaloceanspaces.com/sdk/mirror-avatar/1.0.1/mirror-avatar-sdk-1.0.1.tgz
```

The URL is version-pinned, so upgrading means changing `1.0.1` in the path — an existing
install is never silently replaced.

**React Native CLI**
```bash
npm install react-native-filament react-native-worklets-core react-native-safe-area-context
```

**Expo** — use `expo install` so the versions are pinned to your Expo SDK:
```bash
npx expo install react-native-filament react-native-worklets-core react-native-safe-area-context
```

(`react` / `react-native` come from your app. You can also install from a local `.tgz` path or a
private registry instead of the URL.)

> npm may warn `mirror-avatar-sdk (prepare: bob build) has install scripts` — ignore it; the tarball
> is prebuilt, so nothing runs.

### 2. Configure Babel for worklets

The face is driven by `react-native-worklets-core`, whose Babel plugin must be enabled.

That plugin requires five Babel transforms at build time but **does not declare them as its own
dependencies**, so they must be installed explicitly. Omitting them produces a
`Cannot find module '@babel/plugin-transform-...'` error that points at a file **inside the SDK**
(e.g. `lib/module/engine/camera.js`) — it looks like an SDK fault, but it is this missing plugin.

> **Pin every Babel package to `@^7`.** Babel 8 has been released; an unpinned install resolves to
> 8.x and fails with `ERESOLVE — Conflicting peer dependency: @babel/core@8.x` against the
> `@babel/core@7` that React Native and Expo use.

---

**React Native CLI**

`babel.config.js`:
```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets-core/plugin'],   // required
};
```

```bash
npm install -D @babel/preset-typescript@^7 \
               @babel/plugin-proposal-optional-chaining@^7 \
               @babel/plugin-proposal-nullish-coalescing-operator@^7 \
               @babel/plugin-transform-arrow-functions@^7 \
               @babel/plugin-transform-shorthand-properties@^7 \
               @babel/plugin-transform-template-literals@^7
```

Restart Metro with a reset cache afterwards: `npm start -- --reset-cache`.

---

**Expo**

Expo ships **no `babel.config.js`** by default — create one. Note the preset is
`babel-preset-expo`, **not** the React Native CLI preset above:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets-core/plugin'],   // required
  };
};
```

`babel-preset-expo` is installed **nested** under `expo/node_modules` and is not resolvable from
the project root, so install it explicitly as well:

```bash
npx expo install babel-preset-expo

npm install -D @babel/plugin-proposal-optional-chaining@^7 \
               @babel/plugin-proposal-nullish-coalescing-operator@^7 \
               @babel/plugin-transform-arrow-functions@^7 \
               @babel/plugin-transform-shorthand-properties@^7 \
               @babel/plugin-transform-template-literals@^7
```

Restart Metro with a reset cache afterwards: `npx expo start --clear`.

No `metro.config.js` is required — Expo's default Metro config already handles the SDK.

> If `babel-preset-expo` is missing, Metro fails with a **misleading** error —
> `Cannot read properties of undefined (reading 'transformFile')` at `metro/src/Bundler.js` — which
> hides the real `Cannot find module 'babel-preset-expo'`. See Troubleshooting.

### 3. iOS native

**React Native CLI**

Run this **after Step 1**, so pods pick up `react-native-worklets-core`, `react-native-filament`,
and the SDK. From the app's `ios/` directory:

```bash
cd ios
LANG=en_US.UTF-8 pod install     # global CocoaPods
cd ..
```
Autolinking finds the SDK pod + `MirrorCore.xcframework` — no manual Podfile/Xcode edits. The
`LANG=` prefix avoids a CocoaPods `Encoding::CompatibilityError` on non-UTF-8 locales. (Alternatives:
`npx pod-install` from the app root, or `bundle exec pod install` if you use the Gemfile/bundler —
but that needs the bundler gems installed and a recent Ruby.)

The avatar needs the **microphone**; add to the app's `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Talk to the avatar.</string>
```

---

**Expo**

Do **not** edit `ios/…/Info.plist` directly — `expo prebuild` regenerates it and your edit is lost,
after which iOS **hard-crashes** on first mic access. Declare the permission in `app.json`, merging
into the **existing** `expo.ios` object:

```json
{
  "expo": {
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Talk to the avatar."
      }
    }
  }
}
```

Pods are installed for you by `expo prebuild` in Step 8 — there is no separate `pod install` step,
and no config plugin is required.

---

> **Re-run `pod install` (CLI) or `expo prebuild` (Expo) and do a full native rebuild whenever you
> add or change a native dependency.** Reloading Metro (pressing `r`) does **not** compile a new
> native module into the app binary — that is what produces `'Worklets' could not be found` at
> runtime (see Troubleshooting).

Confirm the native modules linked (both paths, after the native project exists):
```bash
grep -iE "worklet|filament|MirrorAvatar" ios/Podfile.lock   # should list all three
```

### 4. Android native

Autolinking picks up the SDK's Gradle module — no manual edits on either path.

`minSdkVersion` must be **>= 24**. On **React Native CLI** it is set in `android/build.gradle`
(`buildscript.ext.minSdkVersion`). On **Expo** the SDK 57 default already satisfies this and there
is nothing to do; if you need to raise it, use the `expo-build-properties` config plugin rather
than editing the generated Gradle files, which `expo prebuild` overwrites.

**React Native CLI** — add the mic permission to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

**Expo** — do **not** edit `AndroidManifest.xml` directly (`expo prebuild` regenerates it). Declare
it in `app.json`, merging into the **existing** `expo.android` object:
```json
{
  "expo": {
    "android": {
      "permissions": ["RECORD_AUDIO"]
    }
  }
}
```

### 5. Provide `getToken` (your backend holds the org key)

*(Identical for CLI and Expo.)*

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
`getToken` receives `{ reason, agentSlug?, sessionId? }` so your backend can select the agent
and resume the same session on reconnect. Language is chosen by your backend at session init,
not by the app.

> **Dev vs prod transport:** a token server on a **LAN IP over `http://`** works during local
> testing (iOS local-networking + Android debug cleartext). A **release** build blocks cleartext
> to a public host — your production token server must be **`https://`**.

### 6. Add the session + view

*(Identical for CLI and Expo.)*

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
      agentSlug: 'intake',                 // must exist for your org
      getToken,
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

**`createSession(options)`** — `agentSlug?`, `getToken`,
`onStateChange?`, `onError?`, `onCaption?`. One agent per session; change it by creating a new one.

**Session methods.** `MirrorAvatarView` drives the call on its own, so most apps only need
`start()` and `stop()`. The rest are there for hosts that build their own chrome or need the
numbers:

| Method | What it does |
|---|---|
| `start()` | Opens the mic, then the socket. Awaiting it is optional. |
| `stop()` | Ends the call and releases the mic. |
| `mute(muted: boolean)` | Mutes the mic. Silence still goes up the wire, so the server's VAD can still close an open turn — muting mid-sentence does not strand it. |
| `dispose()` | Releases everything and drops all listeners. Call it if you abandon a session without `stop()`. |
| `subscribe(listener)` | State / caption / error callbacks for your own UI, in addition to the `createSession` options. Returns an unsubscribe function, and replays the current state immediately. |
| `getUsageMs()` | Connected time in ms. Banked — it freezes when the socket drops and resumes without resetting. |
| `setToken(token)` | A static token instead of `getToken`. No resume and no proactive refresh, so `getToken` is preferred. |

**`MirrorAvatarView` props** — `session` (required), `agentName?`, `insets?`, `floating?`
(in-app picture-in-picture overlay — see §D-7), `onEnded?`, `onBackToAgents?`,
`onViewSessionDetails?`, `onReady?`, `onDismiss?` (host-driven dismissal of a floating call;
only meaningful with `floating`), `style?`.

The SDK holds the **screen awake** for as long as `MirrorAvatarView` is mounted (a call is watched,
not touched) and releases it on unmount — your app needs no keep-awake dependency.

### 7. Floating (picture-in-picture) mode

*(Identical for CLI and Expo.)*

Pass the `floating` prop to mount the call as an **in-app overlay** instead of a plain full screen.
It opens fullscreen; the user can shrink it to a small **draggable corner card** that stays live —
the face keeps animating and the audio keeps playing — while they use the rest of your app. Every
gesture lives inside the SDK; your app writes none:

- the **⤡ button** (top-right) or a **downward swipe** collapses the fullscreen call to a corner card;
- **drag** the card around — it snaps to the nearest of the four corners;
- **tap** the card to expand it back to fullscreen.

Mount `MirrorAvatarView` at your **app root, above your navigator / tab bar**, so the call survives
navigation between your own screens. While it floats, the SDK's root is a full-screen `box-none`
layer: taps outside the little card fall straight through to your app, and only the card itself is
interactive.

```tsx
function Shell() {
  const insets = useSafeAreaInsets();
  const [inCall, setInCall] = useState(false);
  const sessionRef = useRef<ReturnType<typeof MirrorSDK.createSession> | null>(null);

  const startCall = () => {
    const s = MirrorSDK.createSession({ agentSlug: 'intake', getToken });
    s.start();
    sessionRef.current = s;
    setInCall(true);
  };
  const closeMirror = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setInCall(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* …your tabs / navigator / app screens… */}

      {inCall && sessionRef.current && (
        <MirrorAvatarView
          session={sessionRef.current}
          agentName="Intake Assistant"
          insets={insets}
          floating                      // ← in-app floating / picture-in-picture overlay
          onBackToAgents={closeMirror}   // end-of-call summary → back to your app
          onEnded={(info) => console.log('[mirror] ended, durationMs=', info.durationMs)}
        />
      )}
    </View>
  );
}
```

A floating call is ended exactly like a fullscreen one — the red **End** control, then **Back** on
the end-of-call summary (`onBackToAgents`). Omit `floating` and `MirrorAvatarView` fills its parent,
as in §D-6.

### 8. Build & run

Do a **full native rebuild** (not a Metro reload) — the native modules from Steps 1, 3 and 4 have to
be compiled into the app binary.

**React Native CLI**
```bash
npm start -- --reset-cache            # terminal 1 (after any Babel/config change)
npx react-native run-ios --device     # terminal 2 — a real native build (or run-android)
```

**Expo**
```bash
npx expo prebuild --clean             # generates ios/ + android/, applies app.json, installs pods
npx expo start --clear                # terminal 1 (after any Babel/config change)
npx expo run:ios --device <UDID>      # terminal 2 (or: npx expo run:android)
```
List device UDIDs with `xcrun xctrace list devices` — `run:ios` wants the classic UDID, not the
CoreDevice UUID. Omit `--device` to target a simulator. **`npx expo start` alone is not enough** —
that serves JS to an existing binary; the native modules only arrive via `run:ios` / `run:android`
(or an EAS dev-client build).

Grant the mic prompt, tap the button, speak — the avatar replies and lip-syncs.

---

## E. Responsibilities

| Your app does | The SDK does |
|---|---|
| Decide when to start/close a session | Mic capture, streaming, playback, lip-sync, reconnect |
| Supply `getToken` (your backend holds the org key) | Opens the WS with the token; re-mints on reconnect |
| Provide `insets`, render `MirrorAvatarView` | Avatar, captions, call controls, end-of-call summary |
| Mount at root for `floating` mode | Floating/PiP window + its shrink · drag · expand gestures |
| Close from `onBackToAgents` | Downloads + caches the model; owns the backend URL |
| — | Holds the screen awake while the view is mounted |

## F. Troubleshooting

**Both paths**

- **`'Worklets'` (or `'Filament'` / `'MirrorAvatar'`) `could not be found. Verify that a module by this
  name is registered in the native binary`** → the native module isn't in your built app. Almost always
  because `pod install` / `expo prebuild` ran **before** the peer deps were installed, or you reloaded
  Metro instead of rebuilding. Fix: finish Step 1, redo the native step, then do a **full native
  rebuild** — not a Metro reload.
- **`Cannot find module '@babel/plugin-transform-shorthand-properties'`** (or `-arrow-functions`,
  `-template-literals`, `-optional-chaining`, `-nullish-coalescing-operator`) → the worklets Babel
  plugin's undeclared dependencies are missing. Install the full list in §D-2. The error names a file
  **inside the SDK**; that is the file being transformed, not the fault.
- **`ERESOLVE` / `Conflicting peer dependency: @babel/core@8.x`** → a Babel package resolved to 8.x.
  Pin every one to `@^7` as shown in §D-2.
- **Avatar screen opens then immediately closes** → you are (a) unmounting on `onEnded` — use
  `onBackToAgents` to close; and/or (b) hitting a token/backend mismatch. Wire `onError` /
  `onStateChange` (as above) to see the reason. A close code `4001` means the token was rejected —
  usually the token was minted for a different environment or the org/agent isn't provisioned.
- **`token <status>` thrown from `getToken`** → your token server returned non-2xx (bad org key =
  401/403, quota exhausted = 429). Check the server logs.
- **`TypeError: Network request failed`** → the device can't reach `TOKEN_SERVER_URL`. On a physical
  device use the Mac's **LAN IP** (not `localhost`); on a **release** build a public token server
  must be **`https://`** (cleartext `http://` to a public host is blocked).
- **Changes to the SDK/app don't reach the device** → Metro caches. Reset it
  (`npm start -- --reset-cache` / `npx expo start --clear`) and relaunch. If you reinstalled the SDK
  tarball at the same version, also `rm -rf node_modules/mirror-avatar-sdk` first — npm reuses a
  cached copy for an unchanged version.
- **No `console.log` in the Metro terminal** (RN 0.76+ on a physical device) → logs go to React
  Native DevTools / device syslog (`adb logcat` on Android), not the terminal.
- **`pod install` crashes with `Unicode Normalization not appropriate for ASCII-8BIT`
  (`Encoding::CompatibilityError`)** → Ruby has no UTF-8 locale. Export it before building:
  `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (or add both to your shell profile). This hits
  **Expo too** — `expo run:ios` shells out to `pod install` and inherits the same environment, so
  running `pod install` by hand in a shell that has the locale set is not enough.

**Expo only**

- **`Cannot read properties of undefined (reading 'transformFile')` at `metro/src/Bundler.js`** →
  this is **not** a Metro version problem. Babel failed to load and Metro reports the downstream
  symptom instead of the cause — almost always `Cannot find module 'babel-preset-expo'`, which is
  nested under `expo/node_modules` and unresolvable from the project root. Fix:
  `npx expo install babel-preset-expo`, then `npx expo start --clear`.
- **The app runs in Expo Go but the avatar never appears / native module missing** → Expo Go cannot
  load this SDK. Build a dev client: `npx expo prebuild` + `npx expo run:ios` / `run:android`, or an
  EAS development build.
- **Mic permission missing after a rebuild / iOS crashes on first mic access** → the permission was
  edited into `Info.plist` or `AndroidManifest.xml` directly and `expo prebuild` regenerated the
  file. Move it to `app.json` (§D-3, §D-4) and re-run `npx expo prebuild --clean`.

## G. Notes & current scope

- The SDK connects to Mirror's **production** backend (baked in, internal); there is no
  consumer-facing environment/URL switch by design.
- The avatar model auto-downloads from Mirror's CDN on first load; no asset bundling.
- The org API key lives **only** on your token server, never in the app.
- A non-Ready-Player-Me model may need a per-model profile (joint/orientation config); talk to
  Mirror if you need a custom model.
- **Mic contention:** only one app can hold the microphone. If another app is already in a call
  (a VoIP/meeting app, or a phone call), starting a session raises an audio error and no mic audio
  is captured — this is an OS constraint on both platforms, not a configuration issue.
