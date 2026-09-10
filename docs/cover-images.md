# Cover Images (camera + photo library)

Custom books can **take a photo** or **pick from the library** for their cover. Both screens route through one helper so behaviour stays consistent.

## Helpers (reusable)

- [src/utils/pick-cover-image.ts](../src/utils/pick-cover-image.ts) — `pickCoverImage(hasExisting?) → Promise<string | null>`. Prompts take-photo vs. choose-from-library, requests camera permission, launches the camera or library, and resolves with the image URI (or `null` if cancelled/denied). Used by both [custom-book.tsx](../src/app/(tabs)/custom-book.tsx) and [book.tsx](../src/app/book.tsx).
- [src/utils/show-action-sheet.ts](../src/utils/show-action-sheet.ts) — `showActionSheet(title, message, buttons)`. See its full description under Utils in [AGENTS.md](../AGENTS.md) — backed by the root `ActionSheetBridge`, supporting any number of options on both platforms; falls back to native `ActionSheetIOS`/`Alert` only if the bridge isn't mounted. Buttons use the same shape as `Alert`'s (`{ text, onPress?, style? }`) — mark dismiss with `style: 'cancel'` and dangerous actions with `style: 'destructive'`, and the helper wires `cancelButtonIndex`/`destructiveButtonIndex` automatically. On Android, tapping outside the dialog maps to the cancel button.

**Convention:** use `showActionSheet` for any new multi-choice or confirm dialog so iOS gets a native sheet (already used for the cover picker and the remove-word / remove-book confirmations). Keep pure single-message notifications (e.g. the camera-permission-denied notice) as `alertDialog` — an action sheet is the wrong control for a plain message.

## Camera permission requires a rebuild

Camera access is declared in [app.config.js](../app.config.js):
- iOS: `NSCameraUsageDescription` (infoPlist) + the `expo-image-picker` plugin's `cameraPermission`.
- Android: the `expo-image-picker` plugin adds the `CAMERA` permission.

This is a **native config change**, so it ships only via a new build — **not** OTA. Rebuild before "Take Photo" works:
```bash
npm run build:dev    # or build:apk:local:dev
npm run build:apk    # or build:apk:local:preview
```

