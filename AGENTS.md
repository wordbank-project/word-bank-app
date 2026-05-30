# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# NPM Scripts

## Development
| Script | Description |
|---|---|
| `npm start` | Start Metro bundler (web only, no device) |
| `npm run android` | Start with Expo Go on Android emulator (SDK 54 only) |
| `npm run ios` | Start with Expo Go on iOS simulator (SDK 54 only) |
| `npm run web` | Start in browser |
| `npm run dev-client` | Start dev server for the installed dev client app |
| `npm run dev-client:android` | Start dev server and open on Android emulator |
| `npm run lint` | Run ESLint |

## Builds (EAS — takes 10–20 min)
| Script | Description |
|---|---|
| `npm run build:dev` | Build dev client APK for local development (install once per native change) |
| `npm run build:apk` | Build preview APK for internal tester distribution |
| `npm run build:android` | Build Android with default profile |
| `npm run build:ios` | Build iOS with default profile |
| `npm run build:all` | Build all platforms |

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
npm run dev-client
```

**3. Open the dev client app on your phone** — it looks similar to Expo Go but is your own custom build. On its home screen there is a QR scanner.

**4. Scan the QR code** shown in your terminal. Your app loads with full hot reload.

## Daily development

Just run `npm run dev-client`, open the dev client app on your phone and scan the QR code. No rebuild needed unless you add a new native package.

## Troubleshooting

**"No development build installed" error:**
The dev client APK is not installed on the emulator/device. Install it, after wiping the data in Android Studio fron the emulator:
```bash
npx eas build:run --platform android --profile development
```

**Changes not appearing on device:**
Metro is serving a cached bundle. The `--clear` flag is already included in `npm run dev-client` and `npm run dev-client:android` to prevent this.

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

## Push an update to production
```bash
npm run update:production
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
| `preview` | `preview` | Internal testers |
| `production` | `production` | Play Store / App Store users |
| `development` | `development` | Dev client builds |
