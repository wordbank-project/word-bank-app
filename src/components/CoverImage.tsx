import { useColorScheme } from "@/context/theme-context";
import { usePulse } from "@/hooks/use-pulse";
import { ACCENT, Colors } from "@/styles/global";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

type Props = {
    uri: string | null | undefined;
    // Size + rounding for the cover box (e.g. "w-12 h-16 rounded").
    className?: string;
    // Static node (e.g. an icon) shown when there's no uri, instead of the pulsing skeleton.
    placeholder?: ReactNode;
};

export default function CoverImage({ uri, className, placeholder }: Props) {
    const placeholderColor = Colors[useColorScheme()].coverPlaceholder;
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    const showPlaceholder = !uri && !!placeholder;

    // Pulse while an image is loading; for the empty state only pulse when there's no static placeholder.
    const skeletonStyle = usePulse(uri ? !loaded : !placeholder);

    // Spin only while an actual image is still in flight (not for missing/failed covers).
    const isLoading = !!uri && !loaded && !error;

    return (
        <View className={`overflow-hidden ${className ?? ""}`}>
            {uri ? (
                <Image
                    source={{ uri }}
                    style={StyleSheet.absoluteFill}
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                />
            ) : null}
            {/* No borderRadius of their own: the overlays fill the box edge-to-edge and the
                container's overflow-hidden rounding clips them — rounding them separately
                leaves corner notches where the un-dimmed image shows through. */}
            <Animated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: placeholderColor }, skeletonStyle]}
                pointerEvents="none"
            />
            {showPlaceholder ? (
                <View
                    className="items-center justify-center"
                    style={[StyleSheet.absoluteFill, { backgroundColor: placeholderColor }]}
                    pointerEvents="none"
                >
                    {placeholder}
                </View>
            ) : null}
            {isLoading ? (
                <View className="items-center justify-center" style={StyleSheet.absoluteFill} pointerEvents="none">
                    <ActivityIndicator size="small" color={ACCENT} />
                </View>
            ) : null}
        </View>
    );
}
