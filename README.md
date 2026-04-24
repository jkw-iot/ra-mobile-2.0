# RoomAlyzer Mobile

Native mobile companion to the RoomAlyzer 2.0 web app (`../roomalyzer20`).
Expo + React Native + TypeScript. Talks to the same Hono API and uses the
same Firebase Auth — no server duplication.

MVP scope: **Indeklima**. Module picker is present from day one with
other modules shown as "coming soon".

---

## Prerequisites

| Tool | Install | Why |
|------|---------|-----|
| Node 20.19+ | same as web repo | Metro bundler runtime |
| Xcode (App Store) | `xcode-select --install` afterwards | iOS Simulator + CLT |
| Android Studio | [developer.android.com](https://developer.android.com/studio) | Emulator + SDK |
| Watchman | `brew install watchman` | RN file watching |
| CocoaPods | `sudo gem install cocoapods` | Only needed for dev builds |
| EAS CLI | `npm install -g eas-cli` | TestFlight / Play Store builds |
| **Expo Go** on phone | App Store / Play Store | Scan QR during dev |

---

## First run

```bash
# 1. Install deps
npm install --legacy-peer-deps

# 2. Copy env file and fill in Firebase/Google OAuth values
cp .env.example .env

# 3. Make sure the web repo's API server is running on :3001
#    (cd ../roomalyzer20 && npm run dev)

# 4. Generate API types from the local OpenAPI spec
npm run gen:api:local

# 5. Start Metro
npm start          # dev client (required for MMKV + some native modules)
npm run start:go   # Expo Go (AsyncStorage fallback; no MMKV)
```

Press `i` to open iOS Simulator, `a` for Android, or scan the QR with
Expo Go on your physical phone.

---

## Project structure

```
app/                   Expo Router routes (file-based)
  _layout.tsx          Providers, fonts, auth-gated routing
  (auth)/login.tsx     Login screen
  select-tenant.tsx    Tenant picker (shown when user has > 1)
  (tabs)/              Bottom-tab layout (Home, Sensors, Alerts, Profile)
  sensor/[id].tsx      Sensor detail + history chart
src/
  components/          Design-system primitives (PageHeading, Button, ...)
  features/indeklima/  Module-specific hooks + graph
  hooks/               Cross-cutting hooks (useLocationFilter)
  i18n/                i18next setup + da/en/de/sv
  lib/                 storage, env, queryClient, QueryProvider, requestId
  services/api/        Generated schema + typed client
  services/auth/       Firebase + Google + AuthProvider
  stores/              Zustand (tenant, module)
  theme/               colors, fonts, typography, spacing
assets/                icon, splash, adaptive-icon
scripts/gen-api.mjs    OpenAPI → TypeScript pipeline (tolerant of broken refs)
```

---

## Daily workflow

### Keeping the API contract in sync

The web repo owns the API. Whenever it changes:

```bash
# Against production:
npm run gen:api

# Against local dev server:
npm run gen:api:local
```

This regenerates `src/services/api/schema.ts`. Commit the diff so API
changes surface in code review. The script tolerates endpoints with
unresolved `$ref`s in the OpenAPI output (see `scripts/gen-api.mjs`) —
those belong fixed in `../roomalyzer20/server/api-spec/*.js`.

### Type checks

```bash
npm run typecheck
```

Runs `tsc --noEmit` with strict + `noUncheckedIndexedAccess`.

### Running on a device

1. Install **Expo Go** on your phone (iOS or Android).
2. Start the dev server: `npm run start:go`.
3. Scan the QR with the Camera app (iOS) or Expo Go app (Android).
4. Phone and computer must be on the same Wi-Fi.

### Building with EAS

```bash
eas login            # once
eas build:configure  # bootstraps; already done — eas.json present
eas build --profile development --platform ios
eas build --profile preview     --platform all
eas build --profile production  --platform all
```

`eas.json` defines three profiles:
- **development** — dev client, points at `localhost:3001`
- **preview** — internal distribution, production API
- **production** — TestFlight / Play Store, auto version bump

---

## Configuration notes

### Firebase Auth
- Uses the **Firebase Web SDK** (package `firebase`). No native Firebase
  config files (`GoogleService-Info.plist` / `google-services.json`)
  required — keeps Expo Go compatibility.
- Refresh tokens are persisted in `AsyncStorage` via Firebase's built-in
  React Native persistence, which wraps iOS Keychain / Android
  EncryptedSharedPreferences for encryption at rest.
- Google sign-in uses `expo-auth-session` (no native SDK). Configure
  OAuth client IDs in Google Cloud Console and set
  `EXPO_PUBLIC_GOOGLE_OAUTH_*` env vars; the button stays hidden until
  they're set.

### Offline cache tiers
Defined in `src/lib/queryClient.ts`:

| Tier | staleTime | gcTime | Usage |
|------|-----------|--------|-------|
| snapshot | 1 h | 1 day | Sensor list, alerts — default |
| raw | 2 h | 7 days | Sensor history day-view |
| downsampled | 6 h | 30 days | Sensor history week/month/year |
| onDemand | 0 | 5 min | Ad-hoc live queries |

Override per-query with `meta: { cacheTier: 'raw' }`.

### Storage
`src/lib/storage.ts` uses **MMKV** when available, falling back to
**AsyncStorage** in Expo Go (where MMKV's native module isn't bundled).
Graduate to a dev build to unlock MMKV automatically — no code change
needed.

### Multi-tenant
Active tenant lives in Zustand (`src/stores/tenantStore.ts`) and is
persisted to storage. Switching tenants clears the query cache to
prevent cross-tenant data bleed.

---

## Known issues / open questions

- **`/api/admin/sensor-map`** and **`/api/preservation/heating/config-tree`**
  currently contain unresolved `$ref`s in the OpenAPI output and are
  stripped by `scripts/gen-api.mjs`. Fix those Zod schemas in the web
  repo's `server/api-spec/*.js` to recover typed access.
- **Dev build required for MMKV**: Expo Go gives AsyncStorage fallback
  performance. First EAS dev build unlocks native MMKV.
- **iOS bundle ID** is `com.roomalyzer.mobile`. Match the certificate /
  profile when submitting to TestFlight.

---

## Cursor rules

See `.cursorrules` at the repo root for coding conventions, i18n
rules, design-system expectations, legacy-API discipline, and the
testing safety policy. Keep it open while you work.
