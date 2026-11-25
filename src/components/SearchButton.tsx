import { useEffect } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import LoadingDots from "@/components/LoadingDots";

type SearchButtonProps = {
    onPress: () => void;
    loading?: boolean;
    label?: string;
    // Shown in place of `label` while `loading` is true (before the animated dots).
    loadingLabel?: string;
    // The live typewriter suggestion, when the field is empty. The button then
    // announces what pressing it will actually search — which is how the user
    // discovers that an empty field falls back to the suggestion. Pass the hook's
    // `word` directly: it's already "" whenever there's no live suggestion.
    suggestion?: string;
    style?: StyleProp<ViewStyle>;
};

// The accent "Search" button shared by the search screens. `style` lets callers
// add layout (e.g. spacing); the button look stays in one place.
export default function SearchButton({
    onPress,
    loading = false,
    label = "Search",
    loadingLabel = "Searching",
    suggestion,
    style,
}: SearchButtonProps) {
    const text = suggestion ? `${label} “${suggestion}”` : label;

    return (
        <Pressable
            className={`items-center rounded-[10px] bg-accent py-2.5 active:bg-accent-strong ${loading ? "opacity-60" : ""}`}
            style={style}
            onPress={onPress}
            disabled={loading}
        >
            {loading ? (
                <View className="flex-row items-center">
                    <Text className="text-base font-semibold text-white">{loadingLabel}</Text>
                    <LoadingDots />
                </View>
            ) : (
                // numberOfLines so a long suggestion ellipsizes instead of wrapping the CTA.
                <Text className="text-base font-semibold text-white" numberOfLines={1}>{text}</Text>
            )}
        </Pressable>
    );
}
