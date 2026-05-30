import { useScrollContext } from "@/context/scroll-context";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

export function useFlatListScroll<T = any>() {
    const ref = useRef<FlatList<T>>(null);
    const { setScrollY, setScrollToTop } = useScrollContext();

    useFocusEffect(useCallback(() => {
        setScrollToTop(() => ref.current?.scrollToOffset({ offset: 0, animated: true }));
        return () => {
            setScrollToTop(null);
            setScrollY(0);
        };
    }, []));

    function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>): void {
        setScrollY(e.nativeEvent.contentOffset.y);
    }

    return { ref, onScroll, scrollEventThrottle: 16 };
}

export function useScrollViewScroll() {
    const ref = useRef<ScrollView>(null);
    const { setScrollY, setScrollToTop } = useScrollContext();

    useFocusEffect(useCallback(() => {
        setScrollToTop(() => ref.current?.scrollTo({ y: 0, animated: true }));
        return () => {
            setScrollToTop(null);
            setScrollY(0);
        };
    }, []));

    function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>): void {
        setScrollY(e.nativeEvent.contentOffset.y);
    }

    return { ref, onScroll, scrollEventThrottle: 16 };
}
