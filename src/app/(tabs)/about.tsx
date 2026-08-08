import { useBackTo } from "@/hooks/use-back-to";
import { useScrollViewScroll } from "@/hooks/use-scroll-registration";
import { Fonts } from "@/styles/global";
import { ScrollView, Text, View } from "react-native";

import { version } from "../../../package.json";

export default function AboutScreen() {
    const { ref: scrollRef, onScroll, scrollEventThrottle } = useScrollViewScroll();

    // Opened from the More tab — back should go there, not to the first tab.
    useBackTo("/more");

    return (
        <ScrollView
            ref={scrollRef}
            className="flex-1 bg-background"
            contentContainerClassName="p-4 pb-8 gap-6"
            scrollEventThrottle={scrollEventThrottle}
            onScroll={onScroll}
        >
            <View className="items-center gap-1 pt-2">
                <Text className="text-2xl font-bold text-fg" style={{ fontFamily: Fonts.serif }}>Word Bank</Text>
                <Text className="text-[13px] text-muted">Version {version}</Text>
            </View>

            <View className="bg-card rounded-[10px] p-4 gap-3">
                <Text className="text-[15px] leading-6 text-body">
                    Word Bank is a personal vocabulary manager designed to help you build your word collection while reading books. It allows you to save words, their definitions, and example sentences, all organized in one place.
                </Text>
                <Text className="text-[15px] leading-6 text-body">
                    The app is built using React Native and Expo Router, with a focus on simplicity and ease of use. It features a clean interface that lets you quickly add new words and review your existing collection.
                </Text>
                <Text className="text-[15px] leading-6 text-body">
                    Word Bank is an open-source project, and contributions are welcome! If you&apos;re interested in improving the app or adding new features, please check out the GitHub repository linked in the More tab.
                </Text>
                <Text className="text-[15px] leading-6 text-body">
                    Supporting Word Bank helps keep the app fully free and allows us to continue improving it. If you find the app useful, please consider supporting us through the provided link in the More tab. Your support is greatly appreciated!
                </Text>
            </View>
        </ScrollView>
    );
}
