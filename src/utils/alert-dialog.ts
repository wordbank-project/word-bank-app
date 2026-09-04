import { Alert, Platform } from "react-native";

import { dismissAlert, isAlertDismissed } from "@/storage/dismissed-alerts-storage";

// Platform-safe alert. `Alert.alert` can't offer a Cancel button plus reliable
// tap-outside-to-dismiss on both platforms (iOS's native alert has no backdrop to
// tap at all) and has no room for custom UI like a checkbox — so every native
// alert renders through a dedicated centered Modal instead (AlertDialogBridge,
// mounted at the app root) — mirrors how show-action-sheet.ts backs its
// imperative API with a root bridge. Web uses `window.confirm` instead of
// `window.alert` so it gets a real Cancel too (still no room for a checkbox —
// `dontShowAgain` is native-only either way).

export type DontShowAgainOptions = {
    id: string; // stable identifier persisted via dismissed-alerts-storage
    checkboxLabel: string;
};

type AlertDialogOptions = {
    dontShowAgain?: DontShowAgainOptions;
    onAcknowledge?: () => void; // fires when OK is tapped (incl. when the alert was skipped as already-dismissed)
    onCancel?: () => void; // fires when Cancel, the backdrop, or the Android back button closes it instead
};

// The subset of AlertDialogBridge's opener this module calls into.
type ShowDialogFn = (options: {
    title: string;
    message?: string;
    checkboxLabel?: string;
    onDismiss: (result: { confirmed: boolean; checked: boolean }) => void;
}) => void;

// The root <AlertDialogBridge> registers its opener here so this module can stay
// a plain function, callable from anywhere, incl. non-component code.
let showDialog: ShowDialogFn | null = null;

/**
 * Registers the component-backed opener. Called once by the root-mounted
 * AlertDialogBridge.
 *
 * @param {ShowDialogFn} fn Opens the dialog for a single alert.
 *
 * @returns {() => void} Unregisters `fn` (only if it's still the active one).
 *
 */
export function registerAlertDialog(fn: ShowDialogFn): () => void {
    showDialog = fn;
    return () => {
        if (showDialog === fn) {
            showDialog = null;
        }
    };
}

/**
 * Shows a Cancel + OK dialog on every platform — `window.confirm` on web, a
 * native alert (dismissable by tapping outside it or the Android back button
 * too) on iOS/Android. Optionally adds a "don't show again" checkbox (native
 * only) whose choice is persisted — once checked, future calls with the same
 * `dontShowAgain.id` skip the alert entirely.
 *
 * @param {string} title The alert's title.
 * @param {string} [message] The alert's body text.
 * @param {AlertDialogOptions} [options] `dontShowAgain` adds the checkbox (native only) and keys its persisted state; `onAcknowledge` fires when OK is tapped, including when the alert was skipped for being already-dismissed; `onCancel` fires when Cancel (or, native-only, the backdrop/back button) closes it instead — the caller's follow-up action belongs in one of these, not after this call.
 *
 * @returns {Promise<void>} Resolves once the alert has been shown (or skipped) and, on web, dismissed.
 *
 */
export async function alertDialog(title: string, message?: string, options?: AlertDialogOptions): Promise<void> {
    if (options?.dontShowAgain && (await isAlertDismissed(options.dontShowAgain.id))) {
        options.onAcknowledge?.();
        return;
    }
    if (Platform.OS === "web") {
        const confirmed = window.confirm(message ? `${title}\n\n${message}` : title);
        if (confirmed) {
            options?.onAcknowledge?.();
        } else {
            options?.onCancel?.();
        }
        return;
    }
    if (showDialog) {
        showDialog({
            title,
            message,
            checkboxLabel: options?.dontShowAgain?.checkboxLabel,
            onDismiss: ({ confirmed, checked }) => {
                if (checked && options?.dontShowAgain) {
                    void dismissAlert(options.dontShowAgain.id);
                }
                if (confirmed) {
                    options?.onAcknowledge?.();
                } else {
                    options?.onCancel?.();
                }
            },
        });
        return;
    }
    // Fallback if the bridge isn't mounted yet — no tap-outside-to-dismiss here
    // (a real limitation of Alert.alert on iOS), but Cancel/OK still both work.
    Alert.alert(title, message, [
        { text: "Cancel", style: "cancel", onPress: options?.onCancel },
        { text: "OK", onPress: options?.onAcknowledge },
    ]);
}
