import { useScrollContext } from "@/context/scroll-context";
import { openAddBookMenu } from "@/utils/open-add-book-menu";
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text } from "react-native";

const SCROLL_THRESHOLD = 20;
const TAB_BAR_HEIGHT = 105;

export default function FloatingActionButton() {
    const { scrollY, scrollToTop } = useScrollContext();
    const showScrollTop = scrollY > SCROLL_THRESHOLD;

    const pathname = usePathname();

    const opacity = useRef(new Animated.Value(1)).current;
    const prevShowScrollTop = useRef(showScrollTop);

    useEffect(() => {
        if (prevShowScrollTop.current === showScrollTop) {
            return;
        }
        prevShowScrollTop.current = showScrollTop;
        Animated.sequence([
            Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
    }, [showScrollTop, opacity]);

    function handlePress(): void {
        if (showScrollTop && scrollToTop) {
            scrollToTop();
            return;
        }
        openAddBookMenu(pathname);
    }

    return (
        // Animated opacity + computed bottom stay inline; FAB sits 16dp above the tab bar.
        <Animated.View style={{ position: 'absolute', right: 16, zIndex: 100, opacity, bottom: TAB_BAR_HEIGHT + 16 }}>
            <Pressable
                className="h-14 w-14 items-center justify-center rounded-full bg-accent"
                // Native shadow/elevation kept inline (not expressible as classes reliably).
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 6 }}
                onPress={handlePress}
                hitSlop={8}
            >
                <Text className="text-2xl font-bold leading-7 text-white">{showScrollTop ? '↑' : '+'}</Text>
            </Pressable>
        </Animated.View>
    );
}
