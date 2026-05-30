import { useScrollContext } from "@/context/scroll-context";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";

export default function ReadListScreen() {
    const { setScrollY, setScrollToTop } = useScrollContext();

    useFocusEffect(useCallback(() => {
        setScrollToTop(null);
        setScrollY(0);
    }, []));

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>Read List coming soon!</Text>
        </View>
    );
}