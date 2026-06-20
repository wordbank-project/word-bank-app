import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type ActionSheetButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

// The subset of @expo/react-native-action-sheet's showActionSheetWithOptions we use.
type ShowFn = (
    options: {
        options: string[];
        title?: string;
        message?: string;
        cancelButtonIndex?: number;
        destructiveButtonIndex?: number;
    },
    callback: (index?: number) => void,
) => void;

// The root <ActionSheetBridge> registers the library's imperative function here so
// this module can stay a plain function (callable from anywhere, incl. non-components).
let impl: ShowFn | null = null;

export function registerActionSheet(fn: ShowFn): () => void {
    impl = fn;
    return () => {
        if (impl === fn) {
            impl = null;
        }
    };
}

/**
 * Platform-aware prompt. Buttons use the same shape as Alert's — mark the dismiss
 * action with style 'cancel' and any dangerous action with style 'destructive'.
 *
 * Backed by @expo/react-native-action-sheet (via the root bridge), so it supports
 * any number of options on both platforms — unlike Android's Alert, which caps at 3.
 */
export function showActionSheet(
    title: string | undefined,
    message: string | undefined,
    buttons: ActionSheetButton[],
): void {
    const cancelButtonIndex = buttons.findIndex((b) => b.style === 'cancel');
    const destructiveButtonIndex = buttons.findIndex((b) => b.style === 'destructive');
    const config = {
        title,
        message,
        options: buttons.map((b) => b.text),
        cancelButtonIndex: cancelButtonIndex === -1 ? undefined : cancelButtonIndex,
        destructiveButtonIndex: destructiveButtonIndex === -1 ? undefined : destructiveButtonIndex,
    };
    const onSelect = (index?: number): void => {
        if (index != null) {
            buttons[index]?.onPress?.();
        }
    };

    if (impl) {
        impl(config, onSelect);
        return;
    }

    // Fallback if the bridge isn't mounted yet (Android Alert is still capped at 3 buttons).
    if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(config, onSelect);
    } else {
        const cancelButton = buttons.find((b) => b.style === 'cancel');
        Alert.alert(title ?? '', message, buttons, {
            cancelable: true,
            onDismiss: cancelButton?.onPress,
        });
    }
}
