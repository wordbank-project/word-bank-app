import { useColorScheme } from "@/context/theme-context";
import { BookWord } from "@/models/book-word";
import { ACCENT, Colors, ERROR } from "@/styles/global";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function BookDetail() {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const placeholderColor = scheme === 'dark'
        ? Colors.dark.textPlaceholder
        : Colors.light.textPlaceholder;

    const { title, author, year, cover_i } = useLocalSearchParams<{
        title: string;
        author: string;
        year: string;
        cover_i: string;
    }>();

    const coverUri = cover_i
        ? `https://covers.openlibrary.org/b/id/${cover_i}-M.jpg`
        : null;

    const [words, setWordsState] = useState<BookWord[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleAddWord() {
        const word = input.trim().toLowerCase();
        if (!word) return;
        if (words.some((w) => w.word === word)) {
            setError("Word already added.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await fetch(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
            );
            if (!res.ok) {
                setError("Word not found in dictionary.");
                return;
            }
            const data = await res.json();
            const entry = data[0];
            const meaning = entry.meanings[0];
            const newEntry: BookWord = {
                word: entry.word,
                definition: meaning.definitions[0].definition,
            };
            await persistWords([newEntry, ...words]);
            setInput("");
        } catch {
            setError("Failed to fetch definition.");
        } finally {
            setLoading(false);
        }
    }

    async function persistWords(updated: BookWord[]) {
        setWordsState(updated);
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <Stack.Screen options={{ title: title ?? "Book Detail", headerShown: true, headerBackVisible: true }} />

            <View style={styles.header}>
                {coverUri ? (
                    <Image source={{ uri: coverUri }} style={styles.cover} />
                ) : (
                    <View style={[styles.cover, styles.coverPlaceholder]} />
                )}
                <View style={styles.headerInfo}>
                    <Text style={styles.bookTitle} numberOfLines={3}>{title}</Text>
                    {author ? <Text style={styles.bookAuthor}>{author}</Text> : null}
                    {year ? <Text style={styles.bookYear}>{year}</Text> : null}
                </View>
            </View>

            <View style={styles.addRow}>
                <TextInput
                    style={styles.input}
                    placeholder="Add a word..."
                    placeholderTextColor={placeholderColor}
                    value={input}
                    onChangeText={(t) => { setInput(t); setError(""); }}
                    onSubmitEditing={handleAddWord}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <Pressable
                    style={[styles.addButton, loading && styles.addButtonDisabled]}
                    onPress={handleAddWord}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.addButtonText}>Add</Text>
                    )}
                </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
        </KeyboardAvoidingView>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: C.background,
        },
        header: {
            flexDirection: "row",
            gap: 14,
            padding: 16,
            alignItems: "center",
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: C.border,
        },
        cover: {
            width: 120,
            height: 160,
            borderRadius: 8,
        },
        coverPlaceholder: {
            backgroundColor: C.coverPlaceholder,
        },
        headerInfo: {
            flex: 1,
            justifyContent: "center",
            gap: 6,
        },
        bookTitle: {
            fontSize: 20,
            fontWeight: "700",
            color: C.text,
        },
        bookAuthor: {
            fontSize: 16,
            color: C.textSecondary,
        },
        bookYear: {
            fontSize: 14,
            color: C.textMuted,
        },
        addRow: {
            flexDirection: "row",
            gap: 8,
            padding: 12,
            paddingBottom: 4,
        },
        input: {
            flex: 1,
            height: 44,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: C.borderInput,
            paddingHorizontal: 12,
            paddingVertical: 0,
            fontSize: 16,
            color: C.text,
            backgroundColor: C.backgroundInput,
            textAlignVertical: 'center',
            includeFontPadding: false,
        },
        addButton: {
            backgroundColor: ACCENT,
            borderRadius: 8,
            paddingHorizontal: 16,
            justifyContent: "center",
            minWidth: 56,
            alignItems: "center",
        },
        addButtonDisabled: {
            opacity: 0.6,
        },
        addButtonText: {
            color: "#fff",
            fontWeight: "600",
            fontSize: 16,
        },
        error: {
            color: ERROR,
            fontSize: 13,
            paddingHorizontal: 12,
            paddingBottom: 4,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
