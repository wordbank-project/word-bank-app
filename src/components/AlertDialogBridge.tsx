import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import IconSymbol from "@/components/ui/IconSymbol";
import { useColorScheme } from "@/context/theme-context";
import { Colors } from "@/styles/global";
import { registerAlertDialog } from "@/utils/alert-dialog";

// Backs every native alertDialog() call with a centered Modal instead of
// Alert.alert — a Cancel button plus tap-outside/back-button dismissal isn't
// something Alert.alert can offer consistently on both platforms (iOS's native
// alert has no backdrop to tap at all), and an optional "don't show again"
// checkbox needs custom UI Alert.alert has no room for either way. Mirrors
// ActionSheetBridge's registration pattern. Mounted once at the app root.

type PendingAlert = {
    title: string;
    message?: string;
    checkboxLabel?: string; // omitted → no checkbox row
    onDismiss: (result: { confirmed: boolean; checked: boolean }) => void;
};

/**
 * Root-mounted bridge rendering alertDialog()'s native dialog.
 *
 * @returns {JSX.Element | null} The centered dialog Modal while an alert is pending, else `null`.
 *
 */
export default function AlertDialogBridge() {
    const colors = Colors[useColorScheme()];
    const [pending, setPending] = useState<PendingAlert | null>(null);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        return registerAlertDialog((options) => {
            setChecked(false);
            setPending(options);
        });
    }, []);

    /**
     * Dismisses the pending alert, reporting whether OK (confirmed) or
     * Cancel/the backdrop/the Android back button (not confirmed) closed it,
     * plus the checkbox's final state.
     *
     * @param {boolean} confirmed Whether OK was tapped, as opposed to Cancel/the backdrop/the back button.
     *
     * @returns {void} Returns nothing.
     *
     */
    function close(confirmed: boolean): void {
        pending?.onDismiss({ confirmed, checked });
        setPending(null);
    }

    if (!pending) {
        return null;
    }

    return (
        <Modal transparent animationType="fade" visible onRequestClose={() => close(false)}>
            <Pressable className="flex-1 items-center justify-center bg-black/40 p-6" onPress={() => close(false)}>
                {/* No onPress here — an interactive child absorbing the touch is what keeps
                    taps inside the card from bubbling up to the backdrop's onPress above
                    (same trick LanguageModal.tsx's bottom sheet uses). */}
                <Pressable className="w-full max-w-sm gap-4 rounded-2xl bg-card p-5">
                    <View className="gap-1.5">
                        <Text className="text-center text-[17px] font-semibold text-fg">{pending.title}</Text>
                        {pending.message ? (
                            <Text className="text-center text-[13px] text-body">{pending.message}</Text>
                        ) : null}
                    </View>
                    {pending.checkboxLabel ? (
                        <Pressable
                            className="flex-row items-center gap-2 self-start"
                            onPress={() => setChecked((c) => !c)}
                            hitSlop={8}
                        >
                            <IconSymbol
                                name={checked ? "checkmark.square.fill" : "square"}
                                size={20}
                                color={checked ? colors.tint : colors.icon}
                            />
                            <Text className="flex-1 text-[13px] text-body">{pending.checkboxLabel}</Text>
                        </Pressable>
                    ) : null}
                    <View className="flex-row justify-end gap-2">
                        <Pressable className="px-3 py-1.5" onPress={() => close(false)} hitSlop={8}>
                            <Text className="text-[15px] text-muted">Cancel</Text>
                        </Pressable>
                        <Pressable className="px-3 py-1.5" onPress={() => close(true)} hitSlop={8}>
                            <Text className="text-[15px] font-semibold text-accent">OK</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
