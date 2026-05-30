import { useColorScheme } from "@/context/theme-context";
import { useScrollViewScroll } from "@/hooks/use-scroll-registration";
import { Colors } from "@/styles/global";
import { ScrollView, StyleSheet, Text } from "react-native";

export default function ExportBooksScreen() {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const { ref: scrollRef, onScroll, scrollEventThrottle } = useScrollViewScroll();

    return (
        <ScrollView
            ref={scrollRef}
            style={styles.container}
            scrollEventThrottle={scrollEventThrottle}
            onScroll={onScroll}
        >
            <Text style={styles.body}>This is where you can export your books.</Text>
        </ScrollView>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: C.background,
            padding: 16,
        },
        body: {
            fontSize: 15,
            color: C.textBody,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
