import { useColorScheme } from "@/context/theme-context";
import { ACCENT, Colors } from "@/styles/global";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

type Props = {
    uri: string | null | undefined;
    style: StyleProp<ViewStyle>;
};

export default function CoverImage({ uri, style }: Props) {
    const scheme = useColorScheme();
    const placeholderColor = Colors[scheme].coverPlaceholder;
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    const opacity = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(0.35, { duration: 750 }), -1, true);
    }, [opacity]);

    const skeletonStyle = useAnimatedStyle(() => ({
        opacity: loaded ? 0 : opacity.value,
    }));

    // Spin only while an actual image is still in flight (not for missing/failed covers).
    const isLoading = !!uri && !loaded && !error;

    return (
        <View style={[style, styles.container]}>
            {uri ? (
                <Image
                    source={{ uri }}
                    style={StyleSheet.absoluteFill}
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                />
            ) : null}
            <Animated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: placeholderColor, borderRadius: (style as any)?.borderRadius ?? 4 }, skeletonStyle]}
                pointerEvents="none"
            />
            {isLoading ? (
                <View style={[StyleSheet.absoluteFill, styles.spinner]} pointerEvents="none">
                    <ActivityIndicator size="small" color={ACCENT} />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: "hidden",
    },
    spinner: {
        alignItems: "center",
        justifyContent: "center",
    },
});
