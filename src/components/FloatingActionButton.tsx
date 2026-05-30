import { useScrollContext } from "@/context/scroll-context";
import { ACCENT } from "@/styles/global";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";

const SCROLL_THRESHOLD = 20;
const TAB_BAR_HEIGHT = 105;

export default function FloatingActionButton() {
    const { scrollY, scrollToTop } = useScrollContext();
    const showScrollTop = scrollY > SCROLL_THRESHOLD;

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
    }, [showScrollTop]);

    function handlePress(): void {
        if (showScrollTop && scrollToTop) {
            scrollToTop();
        } else {
            router.push('/(tabs)/custom-book' as any);
        }
    }

    return (
        <Animated.View style={[styles.button, { opacity, bottom: TAB_BAR_HEIGHT + 15 }]}>
            <Pressable style={styles.pressable} onPress={handlePress} hitSlop={8}>
                <Text style={styles.icon}>{showScrollTop ? '↑' : '+'}</Text>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    button: {
        position: 'absolute',
        bottom: 90,
        right: 30,
        zIndex: 100,
    },
    pressable: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: ACCENT,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    icon: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 24,
    },
});
