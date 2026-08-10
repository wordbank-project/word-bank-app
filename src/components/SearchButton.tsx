import { useEffect } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
    ReduceMotion,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

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

// One dot that fades in and out forever. Staggering the `delay` across three of
// them makes the "..." ripple while results load.
function LoadingDot({ delay }: { delay: number }) {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        // ReduceMotion.Never so the dots still animate when the device has
        // "Remove animations" / Power saving on (Reanimated otherwise snaps to the
        // end value and the "..." looks frozen — common on Samsung One UI).
        opacity.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(1, { duration: 350, reduceMotion: ReduceMotion.Never }),
                    withTiming(0.3, { duration: 350, reduceMotion: ReduceMotion.Never }),
                ),
                -1,
                false,
                undefined,
                ReduceMotion.Never,
            ),
        );
    }, [delay, opacity]);

    const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View style={animStyle}>
            <Text className="text-base font-semibold text-white">.</Text>
        </Animated.View>
    );
}

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
                    <LoadingDot delay={0} />
                    <LoadingDot delay={150} />
                    <LoadingDot delay={300} />
                </View>
            ) : (
                // numberOfLines so a long suggestion ellipsizes instead of wrapping the CTA.
                <Text className="text-base font-semibold text-white" numberOfLines={1}>{text}</Text>
            )}
        </Pressable>
    );
}
