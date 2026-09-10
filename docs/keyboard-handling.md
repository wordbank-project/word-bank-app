# Keyboard Handling

This project uses `react-native-keyboard-controller` to keep inputs visible above the keyboard. This library requires the dev client — it does **not** work with Expo Go.

## Setup

Already installed. `KeyboardProvider` wraps the entire app in `src/app/_layout.tsx` — this is required for all keyboard controller APIs to work.

> **Web:** native-only keyboard APIs must be guarded. `book.tsx`'s `keepInputAboveKeyboard`
> checks `typeof Keyboard.metrics === "function"` and no-ops on web (`react-native-web` has no
> `Keyboard.metrics` and no floating keyboard to avoid) — otherwise editing Book Notes crashes
> on web. See `web.md` for the broader web-readiness story.

## Pattern: screens with regular inputs

Use `KeyboardAwareScrollView` — it automatically scrolls to the focused input:

```tsx
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

<>
    <KeyboardAwareScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={80}
        contentContainerStyle={{ paddingBottom: 24 }}
    >
        <TextInput ... />
        <TextInput ... />
    </KeyboardAwareScrollView>
    <KeyboardToolbar />
</>
```

Key notes:
- `bottomOffset` — extra space between the keyboard and the focused input (increase to show more context)
- `contentContainerStyle` bottom padding — keep it **modest** (e.g. `24`). `KeyboardAwareScrollView` adds a dynamic bottom inset (keyboard height) when an input focuses, so it already lifts bottom fields above the keyboard. A large static `paddingBottom` (e.g. 400) is **not** needed and causes dead over-scroll into empty space — avoid it.
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

