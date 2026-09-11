# Development & Build Flow (start here)

Two tracks: **local** for fast personal iteration, **EAS cloud** for anything you distribute. The short version of the normal loop: `npm run dev` every day → `npm run android`/`ios` only when you touch native → `build:apk:local:preview` to sideload a real build → EAS (`build:apk`) only when handing it to someone else.

## 1. Daily development (99% of the time)
Dev client + Metro; JS/UI changes hot-reload, no rebuild.
```bash
npm run dev                 # both emulator + iOS simulator
npm run dev-client:android  # Android only
npm run dev-client:ios      # iOS only
npm run dev-client:physical # your phone (scan QR)
```
All pinned to `APP_VARIANT=development` → the `.dev` client. API comes from `.env.local` (your LAN IP) via Metro — edit it, relaunch (`--clear` is already included).

## 2. After adding/removing a native package or changing `app.config.js`
Native changes can't hot-reload — rebuild & install the dev client once, then go back to step 1:
```bash
npm run android   # builds + installs .dev client on emulator, starts dev server
npm run ios        # same for iOS simulator
# EAS equivalents: npm run build:dev / build:dev:ios
```
(Example: the camera permission needs this — "Take Photo" won't work until a rebuild.)

## 3. A standalone build to sideload to yourself → local (fast, free, no account)
```bash
npm run build:apk:local:preview   # → builds/preview/app-release.apk  (standalone, "just works")
npm run build:apk:local:dev       # → builds/dev/app-debug.apk         (dev client, needs Metro)
npm run build:apk:local:all       # both
```
Pass an HTTPS API URL: `EXPO_PUBLIC_DICT_API_URL=https://… npm run build:apk:local:preview`. These restore the dev variant when done, so `npm run dev` keeps working after.

## 4. Distribute to testers or the store → EAS cloud
```bash
npm run build:apk        # preview APK for internal testers (managed keystore, downloadable)
npm run build:all        # dev client, both platforms
eas build --profile production --platform android   # store build
```
Cloud builds **ignore `.env.local`** — the URL comes from `eas.json` `env` (replace the `https://your-api.example.com` placeholder). Required for **iOS** distribution (signing/TestFlight) and OTA channels.

## 5. Push a JS-only fix to existing tester builds → OTA
```bash
npm run update:preview   # eas update, no rebuild
```
Only for JS/UI changes on builds already made for that channel. Native changes (step 2) need a new build.

## 6. Web build → Netlify
```bash
npm run export:web   # → dist/ (static export, one HTML file per route)
```
`netlify.toml` pins the build for Netlify: command (`npm run export:web`), publish directory (`dist`), the Node version, and the `EXPO_PUBLIC_*` API URLs for the web bundle (same vars as `eas.json`'s `env`, since they're inlined at build time either way — update the placeholders once the API has a real domain). `web.output: "static"` in `app.config.js` means this is a real static site, not a single-page app, so no catch-all/SPA redirect rule is needed.

The `netlify.toml` file only controls *how* Netlify builds once it's already watching this repo — the initial link between the Netlify site and this GitHub repo/branch is a one-time dashboard step (Site settings → Build & deploy → Continuous deployment), not something a repo file can set up.

## Quick decision: local vs cloud
| Goal | Use |
|---|---|
| Daily coding | `npm run dev` (step 1) |
| After a native/config change | `npm run android` / `ios` (step 2) |
| Quick APK for *yourself* | **Local** `build:apk:local:preview` |
| APK for *other people* / Play Store | **EAS** `build:apk` / production |
| iOS build for a real device | **EAS** (signing) |
| Patch JS on existing testers | OTA `update:preview` |

## The API URL, per context
- **Dev** → `.env.local` LAN IP (run the server with `HOST=0.0.0.0`, same Wi-Fi).
- **Local preview APK** → pass HTTPS inline at build time.
- **EAS builds** → `eas.json` `env` (deployed HTTPS URL).
- **Web build (Netlify)** → `netlify.toml` `build.environment` (deployed HTTPS URL).
- Release/standalone builds **block cleartext HTTP** — anything non-dev must be HTTPS.

# NPM Scripts

## Development
| Script | Description |
|---|---|
| `npm start` | Start Metro bundler (web only, no device) |
| `npm run android` | Local build and run on Android emulator (no EAS) |
| `npm run ios` | Local build and run on iOS simulator via Xcode (no EAS, no Apple account needed) |
| `npm run web` | Start in browser |
| `npm run dev` | Start dev server and open on both Android emulator and iOS simulator |
| `npm run dev-client:physical` | Start dev server for the installed dev client app (Can be tested on physical device, own phone) |
| `npm run dev-client:android` | Start dev server and open on Android emulator |
| `npm run dev-client:ios` | Start dev server and open on iOS simulator |
| `npm run lint` | Run ESLint |

## Builds (EAS — takes 10–20 min)
| Script | Description |
|---|---|
| `npm run build:dev` | Build Android dev client (install once per native change) |
| `npm run build:dev:ios` | Build iOS dev client (install once per native change) |
| `npm run build:android` | Build Android dev client |
| `npm run build:ios` | Build iOS dev client |
| `npm run build:all` | Build dev client for both platforms |
| `npm run build:apk` | Build preview APK for internal tester distribution |

## Local APK builds (no EAS, no cloud, no device)

Build an installable Android APK entirely on your Mac via `expo prebuild` + Gradle — no Expo cloud, no EAS account, and **no connected device/emulator required**. Each script regenerates the native `android/` project with its own `APP_VARIANT`, runs Gradle, then copies the APK into a per-script folder under `builds/` (gitignored).

| Script | Output | Notes |
|---|---|---|
| `npm run build:apk:local:dev` | `builds/dev/app-debug.apk` | Debug **dev client** — does *not* bundle JS; needs Metro running on the same Wi-Fi to load the app. Package `com.jensrot.wordbank.dev`. |
| `npm run build:apk:local:preview` | `builds/preview/app-release.apk` | **Standalone** release APK — JS bundled in, runs offline. Copy to a phone and it just works. Package `com.jensrot.wordbank.preview`. |
| `npm run build:apk:local:all` | both of the above | Runs dev then preview back-to-back. They can't run in parallel — both wipe/regenerate the shared `android/` folder, so they must be sequential. |

> The `preview` script (and therefore `:all`) ends by running `APP_VARIANT=development expo prebuild --platform android --clean --no-install` to **restore the dev variant** of the native folder. Without this, the folder would be left stamped `.preview` and `npm run dev` would fail (see Build Variants → native-folder drift).

**Prerequisites:** JDK 17, Android SDK (`ANDROID_HOME` set), and the NDK the project pins (`27.1.12297006`). If a build fails with `[CXX1101] NDK ... did not have a source.properties file`, an NDK auto-download was still in progress — just re-run once it finishes.

**Install the result:**
```bash
adb install -r builds/preview/app-release.apk          # onto a running emulator/device
```
Or copy the `.apk` to a phone and tap it (enable "install from unknown sources").

**Signing:** the Expo/RN template signs release with the debug keystore by default, so `app-release.apk` installs on any device for personal/tester use. A real keystore is only needed for the Play Store.

⚠️ **API URL gotcha:** `EXPO_PUBLIC_DICT_API_URL` is inlined into the JS bundle at Gradle build time (read from `.env`/env). A **release** APK blocks cleartext HTTP, so a `localhost`/LAN URL won't work — pass an HTTPS URL for the preview build:
```bash
EXPO_PUBLIC_DICT_API_URL=https://your-api npm run build:apk:local:preview
```

**vs. EAS:** `npm run build:apk` (cloud, 10–20 min, managed keystore, downloadable artifact) is still the path for distributing to testers. The local scripts are for fast, offline, throwaway builds. `eas build --local --platform android --profile preview` is a middle ground — runs on your machine but honours `eas.json` profiles/env.

## OTA Updates
| Script | Description |
|---|---|
| `npm run update:preview` | Push JS/UI changes to preview testers without a full rebuild |

# Development Workflow (without Expo Go app)

## Why not Expo Go app?

This project uses **SDK 55**. Expo Go on the Play Store only supported SDK 54 at the time of development — it did not update in time for Android 16 devices. Additionally, `react-native-keyboard-controller` is a native library that requires a custom build and cannot run inside Expo Go regardless of SDK version.

For these reasons the project uses a **development client** — a custom APK built via EAS that includes the exact SDK and native libraries this project needs.

## First-time setup (only needed once, or when adding new native packages)

**1. Build the dev client APK:**
```bash
npm run build:dev
```
When the build finishes, install the APK on your Android device from the EAS build page at expo.dev.

**2. Start the dev server:**
```bash
npm run dev-client:physical
```

**3. Open the dev client app on your phone** — it looks similar to Expo Go but is your own custom build. On its home screen there is a QR scanner.

**4. Scan the QR code** shown in your terminal. Your app loads with full hot reload.

## Dev client: cloud vs local build give the same result

Once installed, scanning the QR behaves **identically no matter how the dev client was built** — the build source doesn't change runtime behavior. All of these produce the same `.dev` dev client that loads JS from Metro at scan time:

| Build method | Notes |
|---|---|
| EAS `npm run build:dev` | Cloud, EAS-managed keystore, downloadable artifact (easy to share with someone who can't build it) |
| `npm run android` / `ios` | Built locally + auto-installed on the connected device/simulator |
| `npm run build:apk:local:dev` | Local `.dev` APK file — install manually, then scan the QR |

Because a dev client pulls **all JS (and the API URL) from Metro** at runtime, the running app is the same; only the build *environment*, signing keystore, and convenience differ.

**Caveats — "same" only holds when:**
- **Native parity:** both built from the same Expo SDK, native packages, and `app.config.js`. Add a native package (e.g. the camera permission) and an older dev client is missing that native code → JS crashes when it reaches it. Rebuild after any native change (step 2 of the flow at the top).
- **Same variant:** the `npm run dev` QR is `.dev`; the installed client must also be `.dev` (all the above are). A `.preview`/production client won't connect.
- **API URL comes from Metro**, not the APK — read from `.env.local` at bundle time. (Opposite of a standalone/preview APK, where it's baked in.)
- **Physical-device basics:** phone + Mac on the same Wi-Fi, and the API server on `HOST=0.0.0.0` if you're hitting it.

**Rule of thumb:** for your *own* device, build locally (`npm run android` or `build:apk:local:dev`) — faster and free. Use EAS `build:dev` only to hand the dev client to someone who can't build it themselves.

## Daily development

Run `npm run dev-client:physical` (or `npm run dev` for both platforms at once), open the dev client app and scan the QR code. No rebuild needed unless you add a new native package.

## Troubleshooting

**"No development build installed" error:**
The dev client APK is not installed on the emulator/device. Install it, after wiping the data in Android Studio fron the emulator:
```bash
npx eas build:run --platform android --profile development
```

**Changes not appearing on device:**
Metro is serving a cached bundle. The `--clear` flag is already included in `npm run dev-client:physical` and `npm run dev-client:android` to prevent this.

**"Port 8081 is already in use":**
A previous Metro server is still running. Kill it:
```bash
kill $(lsof -t -i:8081)
```

**App not connecting after opening emulator:**
Manually open the dev client app on the emulator, then enter the URL shown in the terminal (e.g. `http://192.168.0.205:8081`). Or force open via ADB:
```bash
adb shell am start -a android.intent.action.VIEW -d "exp+word-bank://expo-development-client/?url=http%3A%2F%2F192.168.0.205%3A8081"
```

## Build times

EAS builds typically take **10–20 minutes** for Android. The first build is slower as EAS sets up the environment fresh — subsequent builds are faster due to caching.

# Development & Preview Flow

## Android

### Development
1. Build the dev client once (or after every native package change):
   ```bash
   npm run build:dev
   ```
2. Install the APK from expo.dev on your device or emulator.
3. Daily: `npm run dev-client:android` — no rebuild needed for JS/UI changes.

### Preview (sharing with testers)
1. Build a preview APK:
   ```bash
   npm run build:apk
   ```
2. Share the download link from expo.dev — testers install it directly, no Play Store needed.
3. For JS/UI-only updates push OTA instead of rebuilding:
   ```bash
   npm run update:preview
   ```

## iOS

### Development (no Apple account needed)
1. Build and run locally on the simulator via Xcode:
   ```bash
   npm run ios
   ```
   Re-run this after any native package change.
2. Daily: `npm run dev-client:ios` — no rebuild needed for JS/UI changes.

### Preview (requires paid Apple Developer account — $99/year)
- TestFlight distribution requires a paid account. Without one, iOS distribution to others is not possible.
- For your own device: free Apple account allows sideloading via Xcode, but the certificate expires every 7 days.

## Decision: when to rebuild vs. OTA (Over-the-air) update

| Change type | Action |
|---|---|
| JS/UI only | `npm run update:preview` (OTA, instant) |
| Added/removed a native package | Full rebuild required |
| Changed `app.config.js` native config | Full rebuild required |
| Bumped `version` in `package.json` | Full rebuild required |

# Build Variants

The project uses `app.config.js` (not `app.json`) to set a different app name and package ID per build profile. This allows the development and preview builds to coexist on the same device.

| Profile | App name | Android package |
|---|---|---|
| `development` | Word Bank (Dev) | `com.jensrot.wordbank.dev` |
| `preview` | Word Bank (Preview) | `com.jensrot.wordbank.preview` |
| `production` | Word Bank | `com.jensrot.wordbank` |

The variant is controlled by the `APP_VARIANT` environment variable. `app.config.js` only special-cases `development`/`preview`; any other value (including `production`) yields the base name/package.

- **EAS cloud builds** set it per profile via `eas.json` → `env` (`development` / `preview` / `production`).
- **Local dev scripts** (`dev`, `dev-client:*`, `android`, `ios`) pin `APP_VARIANT=development` inline in `package.json`, so they always target the `.dev` client regardless of your shell.
- **Local APK scripts** set it inline too (`build:apk:local:dev` → development, `build:apk:local:preview` → preview).

## EAS build profiles (`eas.json`)

[eas.json](../eas.json) defines three cloud build profiles. Each sets its own `env` — `APP_VARIANT` (→ the name/package above) and `EXPO_PUBLIC_DICT_API_URL` (→ the dictionary backend, needed because **cloud builds ignore `.env.local`**).

| Profile | `distribution` | Android type | `channel` | Extra |
|---|---|---|---|---|
| `development` | internal | (default) | development | `developmentClient: true` — dev client that loads JS from Metro |
| `preview` | internal | `apk` | preview | Standalone APK for internal testers (`npm run build:apk`) |
| `production` | store (default) | app bundle (default) | production | `autoIncrement: true` bumps the build number each build |

What the keys do:
- **`env.APP_VARIANT`** — picks the app name/package (see variant table above).
- **`env.EXPO_PUBLIC_DICT_API_URL`** — the API URL baked into the JS bundle at build time. `preview`/`production` currently hold a **placeholder** (`https://your-api.example.com`); replace with the deployed HTTPS URL before a cloud build is useful.
- **`channel`** — ties the build to an EAS Update channel so `eas update` can OTA-patch it later.
- **`distribution: internal`** — installable via a direct link, no store; `production` omits it to target the store.
- **`autoIncrement` + `appVersionSource: "remote"`** (top-level `cli`) — EAS tracks and increments the production build number server-side.

> The `production` profile was added this round — your earlier Play Store builds used a "production" profile that wasn't in this file, so they relied on defaults. It's now explicit.

⚠️ Cloud builds read these from `eas.json` (or EAS dashboard env vars), **never `.env.local`** — that file applies only to `npm run dev` and the local `build:apk:local:*` scripts.

⚠️ **Shell-leak gotcha:** a leftover `export APP_VARIANT=preview` (e.g. from a manual build) hijacks any command that doesn't pin its own variant. Symptom: `npm run dev` fails with `No development build (com.jensrot.wordbank.preview) installed`. Fix: `unset APP_VARIANT` or open a new terminal. The pinned scripts above are immune — an inline value overrides the inherited one.

⚠️ **Native-folder drift gotcha:** the generated `ios/`/`android/` folders carry a *baked-in* package ID, and `expo start --dev-client` reads **that**, not the freshly-resolved `app.config.js`. The local APK scripts run `prebuild --clean`, so a `build:apk:local:preview`/`:all` would otherwise leave the native folder stamped `.preview` — after which `npm run dev`/`dev-client:android`/`dev-client:ios` would look for the `.preview` dev client and fail. **Fix at the source:** `build:apk:local:preview` (and thus `:all`) ends by restoring the dev variant (`APP_VARIANT=development expo prebuild --platform android --clean --no-install`), so the dev scripts stay fast and never see drift. Note incremental prebuild (`npm run android`/`ios`) does **not** restamp an existing folder — only `--clean` does, which is why the restore uses `--clean`.

## One-time: install the dev client after native drift

If the dev client isn't installed for the current variant (or the folders drifted to `.preview`), regenerate as `.dev` and install once. Do the clean prebuild **first** — `run:android`/`run:ios` use incremental prebuild and won't restamp a `.preview` folder on their own:

```bash
APP_VARIANT=development npx expo prebuild --clean   # regen native as .dev (full, with pods)
npm run android     # builds + installs .dev on the Android emulator
npm run ios         # builds + installs .dev on the iOS simulator
```

After the dev client is installed, daily `npm run dev` resets the variant and connects — no rebuild.

## Verify the config locally (no build needed)

```bash
APP_VARIANT=development npx expo config 2>/dev/null | head -5
APP_VARIANT=preview npx expo config 2>/dev/null | head -5
```

Check that `name` and `package` match the expected values above.

## After changing variants

Since the package name changed from the original `com.jensrot.wordbank`, **all existing APKs must be rebuilt** before the new names take effect:

```bash
npm run build:dev   # new dev client: Word Bank (Dev)
npm run build:apk   # new preview APK: Word Bank (Preview)
```

Uninstall the old APKs from your device first, then install the new ones.


# OTA Updates (EAS Update)

JS/UI changes can be pushed over-the-air without a full rebuild using EAS Update. Native changes (adding/removing packages) always require a new build.

## Push an update to preview testers
```bash
npm run update:preview
```

`--auto` uses the current git commit message as the update description.

## How testers receive updates
The app checks for updates on every launch (`checkAutomatically: "ON_LOAD"` in `app.config.js`). If an update is available it downloads in the background and applies on the next launch.

## When a full rebuild is needed
- Adding or removing a native package (e.g. `react-native-keyboard-controller`)
- Changing `app.config.js` native config (icons, permissions, scheme)
- Bumping `version` in `package.json` — this changes the `runtimeVersion` and requires a new build before updates can be pushed to that version

## Channels
| Profile | Channel | Use for |
|---|---|---|
| `development` | `development` | Dev client builds |
| `preview` | `preview` | Internal testers |

