# Mirror Avatar SDK

A drop-in **real-time talking 3D avatar** for React Native. The user speaks, the
avatar listens over a live WebSocket, replies with voice, and lip-syncs — all
from one small JS API. Runs on **iOS and Android**.

```tsx
import { MirrorSDK, MirrorAvatarView } from 'mirror-avatar-sdk';

const session = MirrorSDK.createSession({ agentSlug: 'intake', getToken });
session.start();

<MirrorAvatarView session={session} insets={insets} onBackToAgents={() => session.stop()} />
```

## What's included

- **`MirrorSDK`** — session facade: connect, reconnect, resume, and tear down a
  live voice session.
- **`MirrorAvatarView`** — the avatar surface: 3D rendering, captions, call
  controls, and an end-of-call summary panel.
- Native modules for **iOS** (Swift, prebuilt `MirrorCore.xcframework`) and
  **Android** (Kotlin) handling mic capture, playback, and lip-sync timing.
- The 3D model streams from a CDN at runtime — nothing to bundle.

## Requirements

- React Native >= 0.73 (validated on RN 0.86 / React 19.2)
- iOS >= 15.0; Android `minSdkVersion` >= 24
- Peer dependencies: `react-native-filament` (>=1.11), `react-native-worklets-core` (>=1.6)
- A backend that mints short-lived session tokens (see below) — the SDK never
  holds your API key.

## Install

The SDK is not on a public registry — install the prebuilt tarball from GitHub.

```bash
npm install https://github.com/Mirrorr-AI/mirrorr-avatar-sdk-rn/raw/main/mirror-avatar-sdk-1.0.1.tgz
npm install react-native-filament react-native-worklets-core react-native-safe-area-context
npx pod-install ios
```

Worklets also needs Babel configuration, and Expo needs `expo prebuild` rather than
Expo Go. Both are covered in [`docs/INTEGRATION.md`](docs/INTEGRATION.md) — the
install above is not sufficient on its own.

## Your app provides one thing: `getToken`

The SDK is token-agnostic. You supply a function that fetches a short-lived
session token from **your own backend**, which holds your Mirror org API key —
the key must never live in the app itself.

```ts
async function getToken() {
  const r = await fetch('https://your-token-server.example.com/token');
  const { token } = await r.json();
  return token;
}
```

## Full guide

See [`docs/INTEGRATION.md`](docs/INTEGRATION.md) for step-by-step setup (Babel
config for worklets, iOS/Android native steps, the full `getToken` contract,
and troubleshooting).

## License

Copyright © 2026 Flashbox. All rights reserved. Proprietary — see [`LICENSE`](LICENSE).
