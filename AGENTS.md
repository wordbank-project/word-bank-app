# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

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
Manually open the dev client app on the emulator, then enter the URL shown in the terminal (e.g. `http://192.168.0.177:8081`). Or force open via ADB:
```bash
adb shell am start -a android.intent.action.VIEW -d "exp+word-bank://expo-development-client/?url=http%3A%2F%2F192.168.0.177%3A8081"
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
| production (future) | Word Bank | `com.jensrot.wordbank` |

The variant is controlled by the `APP_VARIANT` environment variable, set automatically per profile in `eas.json`.

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

# Keyboard Handling

This project uses `react-native-keyboard-controller` to keep inputs visible above the keyboard. This library requires the dev client — it does **not** work with Expo Go.

## Setup

Already installed. `KeyboardProvider` wraps the entire app in `src/app/_layout.tsx` — this is required for all keyboard controller APIs to work.

## Pattern: screens with regular inputs

Use `KeyboardAwareScrollView` — it automatically scrolls to the focused input:

```tsx
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

<>
    <KeyboardAwareScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={80}
        contentContainerStyle={{ paddingBottom: 400 }}
    >
        <TextInput ... />
        <TextInput ... />
    </KeyboardAwareScrollView>
    <KeyboardToolbar />
</>
```

Key notes:
- `bottomOffset` — extra space between the keyboard and the focused input (increase to show more context)
- `paddingBottom: 400` on `contentContainerStyle` — ensures the scroll view can always scroll even with few items
- `KeyboardToolbar` — shows a Done/Prev/Next toolbar above the keyboard. Conditionally render it if you only want it for specific inputs (e.g. `{editingWord ? <KeyboardToolbar /> : null}`)

## Pattern: excluding inputs from KeyboardToolbar navigation

If a screen has inputs that should not be reachable via the toolbar arrows (e.g. an "Add word" field separate from edit fields), unmount them while other inputs are active:

```tsx
{!editingWord && (
    <View>
        <TextInput placeholder="Add a word..." />
    </View>
)}
```

## Pattern: autoFocus with KeyboardToolbar

Do not use `autoFocus` on the first input of an edit form — the toolbar won't show arrows because the second input hasn't registered yet. Instead, use a ref and focus after a short delay so all inputs are mounted first:

```tsx
const sentenceRef = useRef<TextInput>(null);

useEffect(() => {
    if (editingWord) {
        setTimeout(() => sentenceRef.current?.focus(), 50);
    }
}, [editingWord]);

<TextInput ref={sentenceRef} ... />
```

# OTA Updates (EAS Update)

JS/UI changes can be pushed over-the-air without a full rebuild using EAS Update. Native changes (adding/removing packages) always require a new build.

## Push an update to preview testers
```bash
npm run update:preview
```

`--auto` uses the current git commit message as the update description.

## How testers receive updates
The app checks for updates on every launch (`checkAutomatically: "ON_LOAD"` in `app.json`). If an update is available it downloads in the background and applies on the next launch.

## When a full rebuild is needed
- Adding or removing a native package (e.g. `react-native-keyboard-controller`)
- Changing `app.json` native config (icons, permissions, scheme)
- Bumping `version` in `package.json` — this changes the `runtimeVersion` and requires a new build before updates can be pushed to that version

## Channels
| Profile | Channel | Use for |
|---|---|---|
| `development` | `development` | Dev client builds |
| `preview` | `preview` | Internal testers |

# Dictionary API (wiktapi.dev)

Word definitions come from a **self-hosted [wiktapi.dev](https://github.com/TheAlexLichter/wiktapi.dev) instance** — a multilingual REST API built on kaikki.org's pre-processed Wiktionary data, backed by a local SQLite database. The app no longer calls Wikimedia/dictionaryapi.dev directly.

**Why self-hosted:** Wikimedia's API enforces a [User-Agent policy](https://meta.wikimedia.org/wiki/User-Agent_policy) and rejects Android's default `okhttp` UA with a 403 — so Dutch lookups failed only on Android. Self-hosting removes the runtime dependency on Wikimedia entirely, gives structured JSON (definitions + part of speech + IPA) instead of fragile text scraping, and supports 100+ languages from one endpoint.

## Repo location

The API lives in a sibling repo (not part of this app):
```
~/programming/word-bank/word-bank-app/wiktapi.dev
```
Toolchain: Node ≥ 24.13.1, pnpm 10.30.0 (via corepack). The README uses a `vp` (vite-plus) CLI; the `pnpm --filter` commands below are the equivalents and need no extra install.

## Run the API locally

```bash
cd ~/programming/word-bank/word-bank-app/wiktapi.dev

# 1. Install deps (compiles the native better-sqlite3 module)
pnpm install

# 2. Download a Wiktionary edition's data from kaikki.org.
#    Start with nl (small). English is ~2.3 GB compressed — add it later.
pnpm --filter @wiktapi/api run download -- --editions nl

# 3. Import into SQLite → packages/api/data/wiktionary.db
pnpm --filter @wiktapi/api run import -- --edition nl --fresh

# 4. Start the dev server (http://localhost:3000)
pnpm --filter @wiktapi/api run dev
```

Add more languages by repeating steps 2–3 with `--editions <code>` / `--edition <code>` (e.g. `en`).

**Verify + inspect the schema:**
```bash
curl "http://localhost:3000/v1/nl/word/hond?lang=nl"
```
Interactive explorer at `/_scalar`, raw OpenAPI at `/_openapi.json`.

## Endpoint shape

```
GET /v1/{edition}/word/{word}?lang={code}
```

| Axis | Meaning |
|---|---|
| `{edition}` | Which Wiktionary the data comes from → **the language definitions are written in** |
| `?lang=` | Filters to entries for a specific language |

The app uses matching edition + lang (e.g. `/v1/nl/word/hond?lang=nl`) so Dutch words get **Dutch-language** definitions. Using the `en` edition instead would return English glosses of the Dutch word.

## App integration

All lookups go through a single entry point — see [src/utils/words-api.ts](src/utils/words-api.ts):

```ts
fetchDefinition(word, lang)  // → { word, phonetic?, partOfSpeech, definition }
```

It routes by language:
- **English** (`lang === 'en'`) → the free public **`api.dictionaryapi.dev`** (`fetchEnglish`). No key or User-Agent needed, and it means the self-hosted server never has to import the ~2.3 GB English edition.
- **Everything else** → the self-hosted wiktapi.dev instance (`fetchSelfHosted`).

For the self-hosted path:
- `EDITION_BY_LANG` maps a language code to its edition (currently `nl`; English is intentionally absent). Add an entry here when you import a new edition into the DB. Unmapped codes use the language code itself as the edition (and 404 gracefully if that edition isn't imported).
- The base URL is `process.env.EXPO_PUBLIC_DICT_API_URL`, with a platform-aware local fallback when unset.

## Pointing the app at the server

The URL the app must hit depends on where it runs (the fallbacks handle simulators/emulators automatically):

| App runs on | URL | Setup needed |
|---|---|---|
| iOS simulator / web | `http://localhost:3000` | none (default) |
| Android emulator | `http://10.0.2.2:3000` | none (default) |
| **Physical phone** | `http://<your-Mac-LAN-IP>:3000` | set env var (below) |
| Preview / production | deployed HTTPS URL | set in `eas.json` per profile |

**Physical device:** create `.env.local` (gitignored) in this app's root:
```
EXPO_PUBLIC_DICT_API_URL=http://192.168.0.177:3000
```
`EXPO_PUBLIC_*` vars are inlined at bundle time, so **restart Metro with `--clear`** after changing it (`npm run dev-client:physical` already includes `--clear`). Update the IP if your Mac's LAN address changes.

⚠️ **Gotcha:** the Nitro dev server binds to `localhost` by default, so a physical device can't reach it. Start it bound to all interfaces, and keep both devices on the same Wi-Fi:
```bash
HOST=0.0.0.0 pnpm --filter @wiktapi/api run dev
```
Cleartext HTTP is fine for dev-client (debug) builds; production must use HTTPS (iOS ATS / Android block cleartext in release).

## Production hosting

The published app can't reach a `localhost`/LAN URL, so the API must be deployed to a public **HTTPS** URL and set via `EXPO_PUBLIC_DICT_API_URL` in `eas.json` (`env` per profile). The repo ships a `Dockerfile` + `docker-compose.yml` (`restart: unless-stopped`), and the runtime image expects the DB mounted at `/data/wiktionary.db`. Build the `wiktionary.db` on a fast machine and copy it to the host rather than downloading/importing on constrained hardware (e.g. a Raspberry Pi). For a home host behind NAT, Cloudflare Tunnel gives free HTTPS without port-forwarding.

## Hosting on a Raspberry Pi (Still TODO)

The Dockerfile targets `node:22` (arm64 is published) and compiles `better-sqlite3`, so it builds natively on a Pi. **Golden rule:** build `wiktionary.db` on your Mac and copy the file over — never run the multi-GB download/import on the Pi.

**0. Prerequisites** — 64-bit Raspberry Pi OS, Pi 4/5, DB ideally on a **USB SSD** (not the SD card). Install Docker:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER     # then log out/in
```

**1. Copy the database from the Mac** (run on the Mac):
```bash
ssh pi@raspberrypi.local 'mkdir -p ~/wiktapi-data'
scp ~/programming/word-bank/word-bank-app/wiktapi.dev/packages/api/data/wiktionary.db \
    pi@raspberrypi.local:~/wiktapi-data/
```

**2. Build the image on the Pi:**
```bash
git clone <your-wiktapi-repo> ~/wiktapi.dev && cd ~/wiktapi.dev
docker build --target runtime -t wiktapi-api .
```
If the Pi is RAM-constrained, build on the Mac for arm64 and transfer instead:
```bash
docker buildx build --platform linux/arm64 --target runtime -t wiktapi-api . --load
docker save wiktapi-api | ssh pi@raspberrypi.local docker load
```

**3. Run it, mounting the DB** (image expects it at `/data/wiktionary.db`):
```bash
docker run -d --name wiktapi --restart unless-stopped \
  -p 3000:3000 -v ~/wiktapi-data:/data wiktapi-api

curl "http://localhost:3000/v1/nl/word/hond?lang=nl"   # verify
```
Now reachable on the LAN at `http://<pi-ip>:3000`.

**4. Expose over HTTPS (Cloudflare Tunnel)** — no port-forwarding, hides the home IP, and the app requires HTTPS in production:
```bash
# install cloudflared (arm64), then:
cloudflared tunnel login
cloudflared tunnel create wiktapi
cloudflared tunnel route dns wiktapi dict.yourdomain.com
# point ingress at http://localhost:3000 in ~/.cloudflared/config.yml
cloudflared service install      # run as a service, survives reboot
```
Then set `EXPO_PUBLIC_DICT_API_URL=https://dict.yourdomain.com` in `eas.json` for the preview/production profiles.

**Keeping it fresh:** monthly (or quarterly — definitions change rarely), rebuild `wiktionary.db` on the Mac, `scp` it over, then `docker restart wiktapi`.

**Caveat:** fine for yourself + preview testers; home power/internet is the uptime weak link for a real launch. The same image moves to a $4–6/mo VPS with zero code changes — just keep the env URL pointed at wherever it lives.

## Alternative dictionary APIs considered

Kept for reference if we ever move off the self-hosted wiktapi.dev. The key distinction is **dictionary** (definition + part of speech + IPA, matching our `WordEntry` model) vs **translation** (word → word only, no POS/phonetic — would require reshaping the model).

### Free
| Option | Type | Languages | Notes |
|---|---|---|---|
| **wiktapi.dev (self-host)** — current | Dictionary | 100+ | Free to use, you pay infra. Structured JSON: definitions + POS + IPA. |
| **Wiktionary REST API** | Dictionary | 100+ | `en.wiktionary.org/api/rest_v1`. Closest zero-infra equivalent, but Wikimedia-hosted (needs `User-Agent` header, rate limits, glosses in English). |
| **dictionaryapi.dev** | Dictionary | ~13 only | Free, no key, but **no Dutch** (en, es, fr, de, it, ru, ja, ko, ar, tr, hi, pt-BR). Was the original English source. |
| **MyMemory** | Translation | All pairs | Free ~50k chars/day (more with email). No POS/IPA. |
| **LibreTranslate** | Translation | ~30 | Open-source, self-hostable or public instances. |
| **Merriam-Webster API** | Dictionary | en + es | Free with key, limited daily calls. Not multilingual. |

### Paid (most have a free tier)
| Option | Type | Languages | Notes |
|---|---|---|---|
| **Lexicala API** (K Dictionaries) | Dictionary | 25+ incl. Dutch | Product-grade multilingual dictionary (definitions, POS, IPA, examples). Free trial, cleanest commercial licensing. |
| **Oxford Dictionaries API** | Dictionary | ~10 incl. Dutch | Monolingual definitions + phonetics. Had a free prototype tier; since restructured/limited. |
| **DeepL API** | Translation | ~30 incl. Dutch | Free 500k chars/mo then paid. Highest-quality translations, needs key. |
| **Google Cloud Translation** | Translation | 100+ | Paid ($300 free credit). Broadest coverage, translations only. |

The dictionary options (wiktapi.dev / Wiktionary REST / Lexicala) drop in without reshaping `WordEntry`; the translation options would mean dropping or repurposing `definition` / `partOfSpeech` / `phonetic`.

# Git Commit Conventions

This project uses **Conventional Commits**. Always prefix commit messages with a type:

| Prefix | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, tooling, config (no production code change) |
| `refactor` | Code restructure without changing behavior |
| `style` | Formatting, whitespace, no logic change |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |
| `revert` | Reverting a previous commit |

**Format:**
```
feat: add custom book creation screen
fix: FAB crash when outside tab navigator
chore: update AGENTS.md with dev flow
```

Optionally scope to the affected area:
```
feat(book): add edit details button for custom books
fix(nav): back from book now returns to saved-books
```
