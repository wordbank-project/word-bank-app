import React, { useState } from "react";

import { Book } from "@/models/book";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type SearchBarProps = {
    onResults: (books: Book[]) => void;
    onLoadingChange?: (loading: boolean) => void;
};

export default function SearchBar({ onResults, onLoadingChange }: SearchBarProps) {
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
            const res = await fetch(
                `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`
            );
            const data = await res.json();
            onResults(data.docs ?? []);
        } catch {
            onResults([]);
        } finally {
            updateLoading(false);
        }
    };

    return (
        <View>
            <TextInput
                placeholder="Search books..."
                style={styles.input}
                placeholderTextColor={styles.input.color}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
            />
            <Pressable style={styles.button} onPress={handleSearch} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? "Searching..." : "Search"}</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    input: {
        height: 40,
        borderColor: "#ccc",
        color: "#fff",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    button: {
        backgroundColor: "#007AFF",
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
        marginBottom: 30,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
});