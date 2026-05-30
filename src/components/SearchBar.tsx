import { useState } from "react";

import { useColorScheme } from "@/context/theme-context";

import { useRandomSuggestion } from "@/hooks/use-random-suggestion";

import { ACCENT, Colors } from "@/styles/global";

import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const RANDOM_TITLES = [
    "The Great Gatsby",
    "To Kill a Mockingbird",
    "1984",
    "Pride and Prejudice",
    "The Catcher in the Rye",
    "Brave New World",
    "The Hobbit",
    "Crime and Punishment",
    "Jane Eyre",
    "Don Quixote",
    "Anna Karenina",
    "Moby Dick",
    "War and Peace",
    "The Odyssey",
    "Hamlet",
];

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
    const { isRandom, pickNextWord, onManualChange } = useRandomSuggestion(RANDOM_TITLES);

    function handleSearch(): void {
        Keyboard.dismiss();
        if (!query.trim() || isRandom.current) {
            const nextWord = pickNextWord(query);
            isRandom.current = true;
            setQuery(nextWord);
            onSearch(nextWord);
        } else {
            onSearch(query.trim());
        }
    }

    function handleChangeText(text: string): void {
        onManualChange();
        setQuery(text);
    }

    return (
        <View style={styles.container}>
            <TextInput
                placeholder="Search books..."
                style={styles.input}
                placeholderTextColor={placeholderColor}
                value={query}
                onChangeText={handleChangeText}
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
