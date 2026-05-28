import { useColorScheme } from "@/context/theme-context";
import { Colors } from "@/styles/global";
import { ScrollView, StyleSheet, Text } from "react-native";

export default function SavedBooksScreen() {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Saved books</Text>
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
        title: {
            fontSize: 22,
            fontWeight: '700',
            color: C.text,
            marginBottom: 12,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
