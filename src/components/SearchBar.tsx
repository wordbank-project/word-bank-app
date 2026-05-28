import { useColorScheme } from "@/context/theme-context";
import { ACCENT, Colors } from "@/styles/global";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type SearchBarProps = {
    onSearch: (query: string) => void;
    loading: boolean;
};

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const placeholderColor = scheme === 'dark'
        ? Colors.dark.textPlaceholder
        : Colors.light.textPlaceholder;

    const [query, setQuery] = useState<string>("");

    function handleSearch(): void {
        Keyboard.dismiss();
        onSearch(query);
    }

    return (
        <View style={styles.container}>
            <TextInput
                placeholder="Search books..."
                style={styles.input}
                placeholderTextColor={placeholderColor}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
            />
            <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSearch}
                disabled={loading}
            >
                <Text style={styles.buttonText}>{loading ? "Searching..." : "Search"}</Text>
            </Pressable>
        </View>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            paddingVertical: 12,
        },
        input: {
            height: 44,
            borderColor: C.borderInput,
            color: C.text,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 0,
            marginBottom: 8,
            fontSize: 16,
            backgroundColor: C.backgroundInput,
            textAlignVertical: 'center',
            includeFontPadding: false,
        },
        button: {
            backgroundColor: ACCENT,
            paddingVertical: 10,
            borderRadius: 8,
            alignItems: "center",
            marginBottom: 16,
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            color: "#fff",
            fontSize: 16,
            fontWeight: "600",
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
