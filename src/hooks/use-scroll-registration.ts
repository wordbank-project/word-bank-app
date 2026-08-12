import { useScrollContext } from "@/context/scroll-context";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

// Shared logic: registers a scroll-to-top callback while the screen is focused and
// reports the scroll position to the shared scroll context (used by the FAB).
// `scrollToTop` is how to scroll the specific list type back to the top.
function useScrollRegistration<R extends FlatList<any> | ScrollView>(scrollToTop: (instance: R) => void) {
    const ref = useRef<R>(null);
    const { setScrollY, setScrollToTop } = useScrollContext();

    useFocusEffect(useCallback(() => {
        setScrollToTop(() => {
            if (ref.current) {
                scrollToTop(ref.current);
            }
        });
        return () => {
            setScrollToTop(null);
            setScrollY(0);
        };
    }, [setScrollToTop, setScrollY, scrollToTop]));

    function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>): void {
        setScrollY(e.nativeEvent.contentOffset.y);
    }

    return { ref, onScroll, scrollEventThrottle: 16 };
}

// Defined at module level so their identity is stable across renders (safe in the effect deps above).
const flatListToTop = (list: FlatList<any>) => list.scrollToOffset({ offset: 0, animated: true });
const scrollViewToTop = (view: ScrollView) => view.scrollTo({ y: 0, animated: true });

export function useFlatListScroll<T = any>() {
    return useScrollRegistration<FlatList<T>>(flatListToTop);
}

// Generic so callers whose scroll view is a superset of `ScrollView` (e.g.
// `KeyboardAwareScrollViewRef`, which adds `assureFocusedInputVisible`) can
// type their own ref precisely — `scrollViewToTop` only touches `.scrollTo`,
// a plain `ScrollView` member, so it stays valid for any such R.
export function useScrollViewScroll<R extends ScrollView = ScrollView>() {
    return useScrollRegistration<R>(scrollViewToTop);
}
