import { useColorScheme } from "@/context/theme-context";
import { Book } from "@/models/book";
import { ACCENT, Colors } from "@/styles/global";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type SearchBarProps = {
    onResults: (books: Book[]) => void;
    onLoadingChange?: (loading: boolean) => void;
};

export default function SearchBar({ onResults, onLoadingChange }: SearchBarProps) {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const placeholderColor = scheme === 'dark'
        ? Colors.dark.textPlaceholder
        : Colors.light.textPlaceholder;

    const [query, setQuery] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    function updateLoading(value: boolean): void {
        setLoading(value);
        onLoadingChange?.(value);
    }

    async function handleSearch(): Promise<void> {
        if (!query.trim()) return;
        updateLoading(true);
        try {
            const BOOKS_API_URL = "https://openlibrary.org/search.json";

            const res = await fetch(`${BOOKS_API_URL}?q=${encodeURIComponent(query)}&limit=20`);
            const data = await res.json();

            onResults(data.docs ?? []);
        } catch {
            onResults([]);
        } finally {
            updateLoading(false);
        }
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
            <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSearch} disabled={loading}>
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
