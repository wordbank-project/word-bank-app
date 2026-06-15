# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# Codebase Architecture

Word Bank is an Expo (SDK 55) / React Native app using **expo-router** (file-based routing, typed routes), TypeScript, and AsyncStorage for all persistence. There is no backend in this repo — the only network calls are book search (OpenLibrary) and word definitions (the self-hosted [wiktapi.dev](#dictionary-api-wiktapidev) instance + dictionaryapi.dev for English).

## Mental model

A **book** the user is tracking lives on the **read list** (`ReadListBook`, keyed by `key`) and carries a reading status (Want to read / Reading / Have Read). Each book has a separate **word collection** stored under `words_<key>`. The two are linked by the book `key`: adding words to a book automatically ensures the book is on the read list, and the read list shows each book's word count. The **Words List** tab flattens every book's words into one searchable view.

## Source layout (`src/`)

```
app/                         # expo-router routes (file = route)
  _layout.tsx                # Root: SafeAreaProvider > AppThemeProvider > KeyboardProvider > Stack; runs useNotificationObserver (deep-links notification taps to /review)
  book.tsx                   # /book — book detail (add/edit words, status, cover, meta). NOT a tab
  review.tsx                 # /review — daily SRS review session (Got it / Again). Stack route, opened by tapping the notification. NOT a tab
  (tabs)/
    _layout.tsx              # Tab bar (ScrollProvider + FloatingActionButton); hides custom-book, about & notifications-settings
    index.tsx                # "Search" tab — search OpenLibrary, browse results
    read-list.tsx            # "Read List" tab — saved books, filter by status
    words-list.tsx           # "Words List" tab — all words across books, searchable
    more.tsx                 # "More" tab — settings/about menu (card rows)
    about.tsx                # /about — reached from More (href: null, not a visible tab)
    custom-book.tsx          # /custom-book — create a manual book (href: null; opened via the FAB)
    notifications-settings.tsx # /notifications-settings — daily-review toggle, words/day, time (href: null; reached from More → Settings)
components/                  # presentational + small stateful UI
hooks/                       # reusable hooks
context/                     # React context providers
storage/                    # AsyncStorage wrappers (the data layer)
models/                     # TypeScript types + constant data
utils/                       # pure helpers + API clients
styles/global.ts             # Colors (light/dark), ACCENT, ERROR, Fonts (serif/mono/etc.)
```

## Routing

- `app/_layout.tsx` wraps everything in theme, keyboard, and safe-area providers; the root Stack hides headers and renders the `(tabs)` group.
- `app/(tabs)/_layout.tsx` defines the four visible tabs (Search / Read List / Words List / More) plus the per-tab header (with `ThemeToggle`). `custom-book`, `about`, and `notifications-settings` are registered with `href: null` so they're routable but not shown as tabs. The whole tab area is wrapped in `ScrollProvider` and overlaid with one shared `FloatingActionButton`.
- `book.tsx` is a stack route opened via `openBook(...)` ([utils/open-book.ts](src/utils/open-book.ts)), passing `key/title/author/year/cover_i` as params.
- `review.tsx` is a stack route reached by `router.push('/review')` — fired from `useNotificationObserver` when a daily-review notification is tapped (or via any manual link). See [Daily word review](#daily-word-review-srs--notifications).

## Screens (`app/`)

| Screen | What it does | Key collaborators |
|---|---|---|
| `index.tsx` | Search books; renders results with infinite scroll | `useBookSearch`, `SearchBar`, `BooksList` |
| `book.tsx` | Add words (with dictionary lookup), edit sentence/notes, set reading status, pick cover, edit title/author/year | `ReadStatusSelector`, `LanguageModal`, `CoverImage`, `words-storage`, `read-list-storage`, `words-api` |
| `read-list.tsx` | List saved books, filter by status, change status / remove / open | `ReadListItem`, `read-list-storage`, `getWordCounts` |
| `words-list.tsx` | Flatten all words across books, live word-text search, tap to open the book | `WordListItem`, `getReadList` + `getWords` |
| `custom-book.tsx` | Create a manual book (title/author/year/cover/status) then open it | `CoverImage`, `ReadStatusSelector`, `upsertReadListBook` |
| `more.tsx` / `about.tsx` | Settings-style card menu + app info (version/license from package.json) | `useScrollViewScroll` |
| `review.tsx` | Daily SRS session: shows due words one card at a time (reveal → Got it / Again), persists each grade, then offers "Get more words" | `getReviewQueue`, `gradeAndPersist`, `getNotificationSettings` |
| `notifications-settings.tsx` | Toggle daily reminders (requests OS permission), set words/day + reminder time; persists + re-syncs the OS schedule | `notifications-storage`, `ensureNotificationPermission`, `syncNotifications` |

## Components (`src/components/`)

| Component | Purpose |
|---|---|
| `BooksList` | `FlatList` of search results: pulsing skeletons while loading, infinite scroll, empty/retry states |
| `BookItem` | One search-result row (cover + title/author/year); opens the book |
| `CoverImage` | Cover with a pulsing skeleton, loading spinner, and graceful fallback on error |
| `ReadListItem` | `React.memo` card for a saved book: cover, status badge, word count, remove |
| `ReadStatusSelector` | Three-pill selector for Want / Reading / Have Read |
| `WordListItem` | `React.memo` card on the Words List: word + definition + source-book label |
| `ClearableTextInput` | `TextInput` wrapper with a ✕ button that appears while there's text and clears the field; reused by all search/add inputs |
| `SearchButton` | The accent "Search" button shared by the Search and Words List screens |
| `SearchBar` | Book search field with a random-title suggestion |
| `LanguageModal` | Bottom-sheet dictionary-language picker with search |
| `FloatingActionButton` | Context-aware: scrolls to top when scrolled, otherwise opens `custom-book` |
| `ThemeToggle` | Header light/dark switch |
| `ui/IconSymbol(.ios)` | SF Symbols on iOS, Material-icon fallback elsewhere |

## Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useBookSearch` | OpenLibrary search: paginated `loadMore`, abortable, `searched`/`loadingMore`/error flags |
| `useFlatListScroll` / `useScrollViewScroll` | Register a scroll-to-top callback + report scroll position to `ScrollProvider` (drives the FAB). Both share one internal `useScrollRegistration` |
| `usePulse` | Reanimated opacity-pulse style for loading skeletons |
| `useThemedStyles(light, dark)` | Picks the light/dark `StyleSheet` for the current theme |
| `useTypewriterPlaceholder(words, active)` | Types out one example word/title then stops; returns `{ text, word }` so a screen can show `text` as the placeholder and accept `word` on Enter. Pauses when `active` is false (field non-empty or screen blurred) |
| `useNotificationObserver()` | Runs once in the root layout: sets the foreground notification handler and routes a tapped daily-review notification to `/review` (handles both warm taps and cold start). Requires `expo-notifications` |

## Context (`src/context/`)

- `theme-context.tsx` — `AppThemeProvider`, `useTheme()`, `useColorScheme()`. Restores the saved theme via `theme-storage` on launch (defaulting to the system scheme) and persists every toggle.
- `scroll-context.tsx` — `ScrollProvider`, `useScrollContext()`. Holds `scrollY` + a `scrollToTop` callback that screens register and the FAB consumes.

## Data layer (`src/storage/`, all AsyncStorage)

| Module | Keys | Exports |
|---|---|---|
| `storage.ts` | — | `getJSON(key, fallback)` / `setJSON(key, value)` — shared parse/stringify helpers |
| `read-list-storage.ts` | `read_list` | `getReadList`, `setReadList`, `upsertReadListBook`, `removeReadListBook`, `setReadBookStatus` |
| `words-storage.ts` | `words_<bookKey>` | `getWords`, `setWords`, `removeWords`, `getWordCounts` (batched `multiGet`) |
| `language-storage.ts` | `dictionary_language` | `getLanguageCode`, `setLanguageCode` |
| `theme-storage.ts` | `app_theme` | `getTheme`, `setTheme` (light/dark choice) |
| `srs-storage.ts` | `srs_<bookKey>` | `getSrs`, `setSrs`, `getSrsMaps` (batched `multiGet`), `gradeAndPersist`, `resetSrs`. One `{ word: SrsState }` map per book, parallel to `words_<bookKey>`, keyed by the word string |
| `notifications-storage.ts` | `notification_settings` | `getNotificationSettings`, `setNotificationSettings`, `DEFAULT_NOTIFICATION_SETTINGS` (`{ enabled, wordsPerDay, timeMinutes }`) |

`upsertReadListBook` takes `Omit<ReadListBook, 'addedAt'>` — `addedAt` is owned by storage (stamped on insert, preserved on update).

## Models (`src/models/`)

- `book.ts` — `Book` (OpenLibrary search result shape).
- `read-list-book.ts` — `ReadListBook`, `ReadStatus` (`'want' | 'reading' | 'read'`), plus `READ_STATUS_LABELS` / `READ_STATUS_ORDER`.
- `word-entry.ts` — `WordEntry` (word, phonetic, partOfSpeech, definition, sentence, exampleSentence, notes) and `EditDraft`.
- `language.ts` — `Language` + the full `LANGUAGES` list used by the dictionary picker.
- `srs.ts` — `SrsState` (`box`, `dueAt`, `reps`, `lastReviewedAt`) and `SrsGrade` (`'got' | 'again'`) for the spaced-repetition scheduler.

## Utils (`src/utils/`)

- `words-api.ts` — `fetchDefinition(word, lang)`: routes English to dictionaryapi.dev, everything else to the self-hosted wiktapi.dev instance (see [Dictionary API](#dictionary-api-wiktapidev)).
- `dict-utils.ts` — `timedFetch` (8s timeout with friendly errors).
- `cover-uri.ts` — `coverUri(coverI, size)`: local image as-is, otherwise an OpenLibrary cover URL.
- `open-book.ts` — `openBook(params)`: the single place that navigates to `/book`.
- `pick-cover-image.ts` — `pickCoverImage()`: camera-or-library prompt (uses `expo-image-picker`).
- `show-action-sheet.ts` — `showActionSheet()`: native sheet on iOS, `Alert` on Android.
- `srs.ts` — pure Leitner engine. `gradeWord(state, grade, now)` → next `SrsState`; `INTERVALS_DAYS = [1, 3, 7, 16, 35]` (a box's interval). `now` is injected so it's deterministic to test.
- `review-queue.ts` — `getReviewQueue(wordsPerDay)`: flattens all words across books (reuses the `words-list` loader) joined with each book's SRS map (batched `multiGet`); returns all due words (oldest-due first) + new words up to the daily cap. `getMoreNewWords(count, excludeKeys)` backs the review screen's "Get more words".
- `notifications.ts` — wraps `expo-notifications`: `setupNotificationHandler()` (foreground behavior), `ensureNotificationPermission()` (perm + Android channel), `syncNotifications(settings)` (cancel-all then schedule one `DAILY` trigger if enabled). See [Daily word review](#daily-word-review-srs--notifications).

## Styling / theming convention

Every component defines `buildStyles(C)` and exports `const lightStyles = buildStyles(Colors.light)` / `darkStyles = buildStyles(Colors.dark)`, then selects with `const styles = useThemedStyles(lightStyles, darkStyles)`. A component that **also** needs a raw color value (e.g. a `placeholderColor` from `Colors[scheme]`) keeps `const scheme = useColorScheme()` and indexes `Colors[scheme]` directly. Colors, `ACCENT`, `ERROR`, and `Fonts` live in [styles/global.ts](src/styles/global.ts). `Fonts` maps semantic roles (`serif`, `mono`, `sans`, `rounded`) to platform font families — currently `Fonts.serif` for book titles and `Fonts.mono` for phonetics/IPA and the language code.

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

[eas.json](eas.json) defines three cloud build profiles. Each sets its own `env` — `APP_VARIANT` (→ the name/package above) and `EXPO_PUBLIC_DICT_API_URL` (→ the dictionary backend, needed because **cloud builds ignore `.env.local`**).

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

# Cover Images (camera + photo library)

Custom books can **take a photo** or **pick from the library** for their cover. Both screens route through one helper so behaviour stays consistent.

## Helpers (reusable)

- [src/utils/pick-cover-image.ts](src/utils/pick-cover-image.ts) — `pickCoverImage(hasExisting?) → Promise<string | null>`. Prompts take-photo vs. choose-from-library, requests camera permission, launches the camera or library, and resolves with the image URI (or `null` if cancelled/denied). Used by both [custom-book.tsx](src/app/(tabs)/custom-book.tsx) and [book.tsx](src/app/book.tsx).
- [src/utils/show-action-sheet.ts](src/utils/show-action-sheet.ts) — `showActionSheet(title, message, buttons)`. Platform-aware prompt: native `ActionSheetIOS` on iOS, `Alert.alert` on Android. Buttons use the same shape as `Alert`'s (`{ text, onPress?, style? }`) — mark dismiss with `style: 'cancel'` and dangerous actions with `style: 'destructive'`, and the helper wires `cancelButtonIndex`/`destructiveButtonIndex` automatically. On Android, tapping outside the dialog maps to the cancel button.

**Convention:** use `showActionSheet` for any new multi-choice or confirm dialog so iOS gets a native sheet (already used for the cover picker and the remove-word / remove-book confirmations). Keep pure single-message notifications (e.g. the camera-permission-denied notice) as `Alert.alert` — an action sheet is the wrong control for a plain message.

## Camera permission requires a rebuild

Camera access is declared in [app.config.js](app.config.js):
- iOS: `NSCameraUsageDescription` (infoPlist) + the `expo-image-picker` plugin's `cameraPermission`.
- Android: the `expo-image-picker` plugin adds the `CAMERA` permission.

This is a **native config change**, so it ships only via a new build — **not** OTA. Rebuild before "Take Photo" works:
```bash
npm run build:dev    # or build:apk:local:dev
npm run build:apk    # or build:apk:local:preview
```

# Daily word review (SRS + notifications)

An Anki-style spaced-repetition loop. The user opts in from **More → Settings →
Notifications**; once a day at a chosen time a local notification nudges them; tapping it
opens an in-app **Review** screen that picks the words due that day. Each word is graded
**Got it / Again** and rescheduled.

## The flow end-to-end

1. **Settings** ([notifications-settings.tsx](src/app/(tabs)/notifications-settings.tsx)) —
   toggle reminders (requests OS permission on enable), set **words per day** and
   **reminder time**. Every change persists via `notifications-storage` and calls
   `syncNotifications(settings)` to reconcile the OS schedule.
2. **Schedule** ([utils/notifications.ts](src/utils/notifications.ts)) — `syncNotifications`
   cancels all scheduled notifications, then (if enabled) schedules **one repeating
   `DAILY` trigger** at `hour:minute` (derived from `timeMinutes`). The body is a generic
   nudge ("Time to review your words 📚") — it carries `data.screen = 'review'`.
3. **Tap → deep link** ([use-notification-observer.ts](src/hooks/use-notification-observer.ts),
   run once in `app/_layout.tsx`) — routes a tapped review notification to `/review`,
   handling both warm taps (`addNotificationResponseReceivedListener`) and cold start
   (`getLastNotificationResponseAsync`).
4. **Review** ([review.tsx](src/app/review.tsx)) — `getReviewQueue(wordsPerDay)` builds the
   session at open time (so the nudge never goes stale): **all due words first**
   (oldest-due), then new words up to the daily cap. Reveal → **Got it / Again** →
   `gradeAndPersist` → next. When the queue empties, "Get more words" pulls more new words.

## Why a generic nudge (not the word in the notification)

A local notification can't recompute "today's words" at fire time (no reliable background
execution, esp. iOS), and the app has no backend for push. So the notification is just a
nudge and the **word selection happens in-app on tap** — fully local, never stale. (The
alternative — pre-scheduling N days with the word baked into each body — was rejected as
stale-prone and more complex.)

## SRS model (Leitner)

State lives in `srs_<bookKey>` (a `{ word: SrsState }` map, parallel to `words_<bookKey>`,
keyed by the word string so it survives reorder/removal — see
[srs-storage.ts](src/storage/srs-storage.ts)). The engine is pure
([utils/srs.ts](src/utils/srs.ts)): `INTERVALS_DAYS = [1, 3, 7, 16, 35]`; **Got it**
promotes a word to the next box (longer interval), **Again** resets it to box 0. Word
identity is `{ bookKey, word }` (the same `word` can exist in multiple books). To extend to
full SM-2 later, swap `gradeWord` and widen `SrsState` — storage/queue/UI stay the same.

## expo-notifications requires install + a rebuild

`expo-notifications` is a **native** dependency, so it can't hot-reload or ship via OTA —
install it and rebuild the dev client once:
```bash
npx expo install expo-notifications   # adds the JS dep + types
npm run android                        # or: npm run ios — rebuilds & installs the .dev client
```
[app.config.js](app.config.js) registers the `["expo-notifications", { color }]` plugin
(adds Android `POST_NOTIFICATIONS` + the iOS permission). The API is pinned to **SDK 55**
shapes: `setNotificationHandler` returns `shouldShowBanner`/`shouldShowList` (not the
deprecated `shouldShowAlert`); the trigger is `SchedulableTriggerInputTypes.DAILY` with
`{ hour, minute }`. Until installed, `utils/notifications.ts` and
`use-notification-observer.ts` won't typecheck (missing module) — everything else does.

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
EXPO_PUBLIC_DICT_API_URL=http://192.168.0.205:3000
```
`EXPO_PUBLIC_*` vars are inlined at bundle time, so **restart Metro with `--clear`** after changing it (`npm run dev-client:physical` already includes `--clear`). The IP is DHCP-assigned — update it whenever your Mac's LAN address changes. Note this only affects the **dev client** (JS comes from Metro at runtime); a Metro restart is enough, no APK rebuild needed.

⚠️ **Gotcha:** the Nitro dev server binds to `localhost` by default, so a physical device can't reach it. Start it bound to all interfaces, and keep both devices on the same Wi-Fi:
```bash
HOST=0.0.0.0 pnpm --filter @wiktapi/api run dev
```
Cleartext HTTP is fine for dev-client (debug) builds; production must use HTTPS (iOS ATS / Android block cleartext in release).

## Production hosting

The published app can't reach a `localhost`/LAN URL, so the API must be deployed to a public **HTTPS** URL and set via `EXPO_PUBLIC_DICT_API_URL` in `eas.json` (`env` per profile). The repo ships a `Dockerfile` + `docker-compose.yml` (`restart: unless-stopped`), and the runtime image expects the DB mounted at `/data/wiktionary.db`. Build the `wiktionary.db` on a fast machine and copy it to the host rather than downloading/importing on constrained hardware (e.g. a Raspberry Pi). For a home host behind NAT, Cloudflare Tunnel gives free HTTPS without port-forwarding.

**eas.json status:** the `preview` and `production` profiles already carry `EXPO_PUBLIC_DICT_API_URL` set to a **placeholder** (`https://your-api.example.com`) — replace it with the real deployed URL before a cloud/preview build is useful. **Cloud (EAS) builds ignore `.env.local`** (it's gitignored and never uploaded); they read the URL only from `eas.json` `env` (or EAS dashboard environment variables). `.env.local` applies only to `npm run dev` and the local `build:apk:local:*` scripts.

**Free hosting option (recommended): Oracle Cloud Always Free.** The Ampere A1 (Arm) Always-Free shape (up to 4 OCPU / 24 GB RAM, 200 GB storage, public IPv4) is arm64 — the same arch the Docker image already targets — so it runs unchanged. Deploy mirrors the Raspberry Pi steps below minus the home-network pain; put HTTPS in front with Caddy (auto Let's Encrypt) or a Cloudflare Tunnel. Watch the two gotchas: open the port in **both** the OCI security list **and** the instance's iptables, and A1 capacity can be scarce in popular regions. The same image also drops onto a $4–6/mo VPS with zero code changes.

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
feat(searchbar-cross): updated colors
```

Optionally scope to the affected area:
```
feat(book): add edit details button for custom books
fix(nav): back from book now returns to read-list
```
