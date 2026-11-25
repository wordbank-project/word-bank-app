import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
    ReduceMotion,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

// The rippling "..." shown after a loading label ("Searching...", "Analyzing...").
// Shared by SearchButton and the book screen's notes analysis so every loading
// label animates the same way.

type LoadingDotsProps = {
    // Text classes for the dots — match the label they follow (size, weight, color).
    className?: string;
};

/**
 * One dot that fades in and out forever. Staggering the `delay` across three of
 * them makes the "..." ripple.
 *
 * @param {{ delay: number; className: string }} props How long to wait before this dot starts, and its text classes.
 * @returns {React.JSX.Element} The animated dot.
 *
 */
function LoadingDot({ delay, className }: { delay: number; className: string }) {
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
            <Text className={className}>.</Text>
        </Animated.View>
    );
}

/**
 * Three staggered fading dots, placed right after a loading label in a row.
 *
 * @param {LoadingDotsProps} props The dots' text classes.
 * @returns {React.JSX.Element} The three animated dots.
 *
 */
export default function LoadingDots({ className = "text-base font-semibold text-white" }: LoadingDotsProps) {
    return (
        <>
            <LoadingDot delay={0} className={className} />
            <LoadingDot delay={150} className={className} />
            <LoadingDot delay={300} className={className} />
        </>
    );
}
