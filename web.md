# Running & deploying Word Bank on the web (React Native Web + Expo)

How to ship this Expo app as a website using **react-native-web**, plus a full
analysis of what already works, which native pieces need handling, and how to
deploy.

> Related: [AGENTS.md](AGENTS.md) (architecture) and [api.md](api.md) (deploying the
> dictionary API the web build needs over HTTPS).

## TL;DR

The project is already ~80% web-ready: `react-native-web` + `react-dom` are
installed, there's a `web` script, and `app.config.js` sets `web.output: "static"`.
You can run `npm run web` today. Before a real deployment, handle a few native
touchpoints (camera, `Alert`) and the **networking rules of the browser**
(CORS + no mixed content). Then `npx expo export -p web` → deploy the static `dist/`.

---

## 1. What "React Native Web" gives you

`react-native-web` maps RN primitives (`View`, `Text`, `Pressable`, `FlatList`,
`Modal`, `ActivityIndicator`, `StyleSheet`, …) to DOM elements, and `expo-router`
generates real URLs. So the same components render in a browser — you don't rewrite
the UI, you just handle the platform-specific bits below.

Already in place (no setup needed):
- `react-native-web ~0.21`, `react-dom 19` — in `package.json`.
- `"web": "expo start --web"` script.
- `app.config.js` → `web: { output: "static", favicon }` (pre-renders each route to
  HTML, so deep links work on static hosts).

## 2. Run it locally

```bash
npm run web
# or: npx expo start --web   (press 'w' from the dev server)
```
Opens at `http://localhost:8081`. Hot reload works like native.

---

## 3. Codebase web-compatibility map

| Area / dependency | Web status | Notes |
|---|---|---|
| `View/Text/Pressable/FlatList/Modal/ActivityIndicator/StyleSheet` | ✅ | via react-native-web |
| `expo-router` | ✅ | URLs per route; `(tabs)` becomes a bottom tab bar in the browser |
| `@react-native-async-storage/async-storage` | ✅ | backed by `localStorage` (~5 MB, sync) |
| `react-native-reanimated` 4 | ✅ | skeleton pulse, etc. |
| `react-native-safe-area-context` | ✅ | insets are `0` on web (harmless) |
| `react-native-gesture-handler`, `react-native-screens` | ✅ | no-op/supported on web |
| `expo-image` | ✅ | covers render fine |
| `@expo/vector-icons` / `IconSymbol` | ✅ | web uses [IconSymbol.tsx](src/components/ui/IconSymbol.tsx) MaterialIcons fallback; the SF-Symbols `IconSymbol.ios.tsx` is iOS-only |
| `@expo/react-native-action-sheet` (via [ActionSheetBridge](src/components/ActionSheetBridge.tsx)) | ✅ | renders a web sheet; all our menus work |
| `react-native-keyboard-controller` 1.20.7 | ⚠️ verify | has web fallbacks (Aware scroll ≈ ScrollView, toolbar ≈ nothing); no soft keyboard on web so avoidance is moot. Smoke-test it. |
| `expo-image-picker` camera | ⚠️ guard | "Take Photo" is unreliable on web; library pick works via a file input |
| `Alert.alert` | ⚠️ replace | react-native-web does **not** implement `Alert` (no-op) |
| Network fetches (OpenLibrary / dictionary) | ⚠️ CORS+HTTPS | browser rules apply — see §5 |
| `expo-updates`, `expo-dev-client` | n/a | native-only; irrelevant to a web build |

---

## 4. Native elements on web — and the small tweaks

### 4a. Keyboard controller (smoke-test first)
`KeyboardProvider` / `KeyboardAwareScrollView` / `KeyboardToolbar` (in
[_layout.tsx](src/app/_layout.tsx), [book.tsx](src/app/book.tsx),
[custom-book.tsx](src/app/(tabs)/custom-book.tsx),
[LanguageModal.tsx](src/components/LanguageModal.tsx),
[DefinitionModal.tsx](src/components/DefinitionModal.tsx)) have web fallbacks in
v1.20 — the aware scroll view behaves like a `ScrollView` and the toolbar renders
nothing. Run `npm run web` and exercise the add-word / edit forms. If anything throws
on web, create platform shims (e.g. `KeyboardAware.tsx` + `KeyboardAware.web.tsx`
that re-exports a plain `ScrollView`) and import that instead.

### 4b. Image picker — camera guarded (implemented)
Library selection works on web (file `<input>`); the camera path doesn't reliably, so
[pick-cover-image.ts](src/utils/pick-cover-image.ts) now only offers "Take Photo" off
web:
```ts
const buttons: ActionSheetButton[] = [
    ...(Platform.OS !== 'web' ? [{ text: 'Take Photo', onPress: () => resolve(takePhoto()) }] : []),
    { text: 'Choose from Library', onPress: () => resolve(pickFromLibrary()) },
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
];
showActionSheet(title, undefined, buttons);
```
Caveat: on web the picked image is a `blob:`/object URL that won't survive a page
reload, so custom-book covers are best-effort on web (fine for search-result covers,
which are normal OpenLibrary URLs).

### 4c. `Alert.alert` replaced with a web-aware `notify` (implemented)
react-native-web doesn't implement `Alert`, so there's a shared helper
[notify.ts](src/utils/notify.ts):
```ts
import { Alert, Platform } from 'react-native';
export function notify(title: string, message?: string): void {
    if (Platform.OS === 'web') { window.alert(message ? `${title}\n\n${message}` : title); return; }
    Alert.alert(title, message);
}
```
Used by the Pro upsell in [more.tsx](src/app/(tabs)/more.tsx) and the camera-permission
notice in [pick-cover-image.ts](src/utils/pick-cover-image.ts). (Swap for a themed
modal later if you want it on-brand; confirmations can use `window.confirm`.)

### 4d. Action sheets — already fine
`showActionSheet` ([show-action-sheet.ts](src/utils/show-action-sheet.ts)) routes
through the root `ActionSheetBridge` → `@expo/react-native-action-sheet`, which has a
web implementation. Sort / Reading-status / Add-a-book / Delete confirms all work on
web with no change.

### 4e. Storage
`AsyncStorage` → `localStorage` on web: ~5 MB and synchronous. The app stores small
JSON (read list, words, settings), so it's fine — just don't persist large image data
URLs there.

---

## 5. Networking on the web (the part that actually bites)

Browsers enforce two rules native apps don't:

1. **CORS** — the server must allow your web origin.
   - OpenLibrary `search.json` and `dictionaryapi.dev` send permissive CORS → fine.
   - The **self-hosted wiktapi.dev must send `Access-Control-Allow-Origin`** for your
     web origin (enable CORS on the API, or serve it behind a same-origin reverse
     proxy / path like `/api`). Without it, non-English lookups fail only on web.
2. **No mixed content** — an HTTPS site **cannot** call `http://`. Local web dev
   (`http://localhost`) can hit `http://localhost:3000`, but a deployed (HTTPS) site
   needs the dictionary API over **HTTPS** — deploy it per [api.md](api.md) and set:
   ```bash
   EXPO_PUBLIC_DICT_API_URL=https://dict.yourdomain.com
   ```
   (read in [words-api.ts](src/utils/words-api.ts)). Cover images themselves render
   fine (plain `<img>`, no CORS needed).

---

## 6. Build & deploy

Produce a static site:
```bash
EXPO_PUBLIC_DICT_API_URL=https://dict.yourdomain.com \
  npx expo export --platform web      # outputs ./dist (pre-rendered routes)
```

Deploy `dist/` to any static host:
- **EAS Hosting (recommended, first-party):**
  ```bash
  npx expo deploy            # uploads dist/ to Expo hosting, gives you a URL
  ```
- **Netlify / Vercel / Cloudflare Pages:** point the project at build command
  `npx expo export -p web` and publish directory `dist`. Set `EXPO_PUBLIC_DICT_API_URL`
  in the host's env vars.
- **GitHub Pages / any static server:** serve the `dist/` folder. (Because
  `output: "static"` pre-renders each route, deep links resolve without extra SPA
  rewrites.)

---

## 7. Known limitations / optional polish

- **Camera** capture isn't supported on web (library/file pick only) — see §4b.
- **Custom-book covers** picked on web use ephemeral blob URLs (don't persist across
  reload) — see §4b.
- **Layout** — the mobile bottom tab bar works in the browser but isn't desktop-optimal;
  a responsive/max-width layout or side nav for wide screens is a nice future polish
  (not required to ship).
- **expo-updates / dev-client** don't apply on web; web "updates" are just redeploys.

---

## 8. Pre-deploy checklist

- [ ] `npm run web` runs; search, read list, words list, book detail, sort/filter,
      action sheets all work in the browser.
- [x] "Take Photo" hidden on web; "Choose from Library" works (§4b).
- [x] `Alert.alert` spots replaced with `notify` for web (§4c).
- [ ] Dictionary API deployed over **HTTPS** with **CORS** for your web origin (§5,
      [api.md](api.md)).
- [ ] `EXPO_PUBLIC_DICT_API_URL` set for the web build/host.
- [ ] `npx expo export -p web` produces `dist/`; deep links work after deploy.
