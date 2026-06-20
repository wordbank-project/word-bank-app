import { useActionSheet } from "@expo/react-native-action-sheet";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/context/theme-context";
import { Colors } from "@/styles/global";
import { registerActionSheet } from "@/utils/show-action-sheet";

// Wires the imperative showActionSheet() util to @expo/react-native-action-sheet,
// and themes the Android sheet for light/dark (iOS uses the native sheet and ignores
// these styles). Mounted once at the app root.
export default function ActionSheetBridge() {
    const { showActionSheetWithOptions } = useActionSheet();
    const scheme = useColorScheme();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        return registerActionSheet((options, cb) =>
            showActionSheetWithOptions(
                {
                    ...options,
                    // paddingBottom keeps the Android sheet (incl. the last/Cancel row)
                    // above the system navigation/gesture bar.
                    containerStyle: { backgroundColor: Colors[scheme].background, paddingBottom: insets.bottom },
                    textStyle: { color: Colors[scheme].text },
                    titleTextStyle: { color: Colors[scheme].textMuted },
                    messageTextStyle: { color: Colors[scheme].textMuted },
                },
                cb,
            ),
        );
    }, [showActionSheetWithOptions, scheme, insets.bottom]);

    return null;
}
