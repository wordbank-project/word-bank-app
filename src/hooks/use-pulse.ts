import { useEffect } from "react";
import { ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

// Returns an animated style that gently pulses opacity, used for loading skeletons.
// `active` lets a caller fade it out (e.g. once an image has loaded).
export function usePulse(active: boolean = true) {
    const opacity = useSharedValue(1);

    useEffect(() => {
        // ReduceMotion.Never so skeletons keep pulsing when the device has
        // "Remove animations" / Power saving on — Reanimated otherwise snaps to the
        // end value and every skeleton sits frozen at 0.35 opacity. Same reason
        // SearchButton's loading dots opt out.
        opacity.value = withRepeat(
            withTiming(0.35, { duration: 750, reduceMotion: ReduceMotion.Never }),
            -1,
            true,
            undefined,
            ReduceMotion.Never,
        );
    }, [opacity]);

    return useAnimatedStyle(() => ({
        opacity: active ? opacity.value : 0,
    }));
}
