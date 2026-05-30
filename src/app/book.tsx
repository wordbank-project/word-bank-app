import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import CoverImage from "@/components/CoverImage";
import { KeyboardAwareScrollView, KeyboardToolbar } from "react-native-keyboard-controller";

import { Stack, useLocalSearchParams } from "expo-router";

import { useColorScheme } from "@/context/theme-context";

import type { EditDraft, WordEntry } from "@/models/word-entry";

import { removeBook, upsertBook } from "@/storage/books-storage";
import { getWords, setWords } from "@/storage/words-storage";

import { ACCENT, Colors, ERROR } from "@/styles/global";

const SENTENCE_MAX = 300;

export default function BookDetail() {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const placeholderColor = scheme === 'dark'
        ? Colors.dark.textPlaceholder
        : Colors.light.textPlaceholder;

    const { key, title, author, year, cover_i } = useLocalSearchParams<{
        key: string;
        title: string;
        author: string;
        year: string;
        cover_i: string;
    }>();

    const coverUri = cover_i
        ? `https://covers.openlibrary.org/b/id/${cover_i}-M.jpg`
        : null;

    const [words, setWordsState] = useState<WordEntry[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [editingWord, setEditingWord] = useState<string | null>(null);
    const [draft, setDraft] = useState<EditDraft>({ sentence: '', notes: '' });

    const notesRef = useRef<TextInput>(null);
    const sentenceRef = useRef<TextInput>(null);

    useEffect(() => {
        if (editingWord) {
            setTimeout(() => sentenceRef.current?.focus(), 50);
        }
    }, [editingWord]);

    useEffect(() => {
        if (key) getWords(key).then(setWordsState);
    }, [key]);

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
            if (!res.ok) throw new Error("Word not found in dictionary.");
            const data = await res.json();
            const entry = data[0];
            const meaning = entry.meanings[0];
            const newEntry: WordEntry = {
                word: entry.word,
                phonetic: entry.phonetic,
                partOfSpeech: meaning.partOfSpeech,
                definition: meaning.definitions[0].definition,
            };
            await persistWords([newEntry, ...words]);
            setInput("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to fetch definition.");
        } finally {
            setLoading(false);
        }
    }

    function handleDeleteWord(word: string) {
        Alert.alert(
            "Remove word",
            `Remove "${word}" from this book?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        await persistWords(words.filter((w) => w.word !== word));
                    },
                },
            ]
        );
    }

    async function handleSaveEdit(word: string) {
        const updated = words.map((w) =>
            w.word === word
                ? { ...w, sentence: draft.sentence.trim() || undefined, notes: draft.notes.trim() || undefined }
                : w
        );
        await persistWords(updated);
        setEditingWord(null);
    }

    async function persistWords(updated: WordEntry[]) {
        setWordsState(updated);
        await setWords(key!, updated);
        if (updated.length > 0) {
            await upsertBook({
                key: key!,
                title: title ?? '',
                author: author ?? '',
                year: year ?? '',
                cover_i: cover_i ?? '',
                wordCount: updated.length,
            });
        } else {
            await removeBook(key!);
        }
    }

    return (
        <React.Fragment>
            <Stack.Screen options={{ title: title ?? "Book Detail", headerShown: true, headerBackVisible: true }} />

            <View style={styles.container}>
                {!editingWord && (
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
                )}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <KeyboardAwareScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    // Adjust the space between the keyboard and the selected input to ensure the input is not covered by the keyboard.
                    bottomOffset={230}
                >
                    <View style={styles.header}>
                        <CoverImage uri={coverUri} style={styles.cover} />
                        <View style={styles.headerInfo}>
                            <Text style={styles.bookTitle} numberOfLines={3}>{title}</Text>
                            {author ? <Text style={styles.bookAuthor}>{author}</Text> : null}
                            {year ? <Text style={styles.bookYear}>{year}</Text> : null}
                        </View>
                    </View>

                    <View style={styles.list}>
                    {words.length === 0 ? (
                        <Text style={styles.empty}>No words yet. Add one above.</Text>
                    ) : (
                        words.map((item) => {
                            const isEditing = editingWord === item.word;
                            return (
                                <View key={item.word} style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.word}>{item.word}</Text>
                                        {item.phonetic ? (
                                            <Text style={styles.phonetic}>{item.phonetic}</Text>
                                        ) : null}
                                        <Pressable
                                            style={styles.editButton}
                                            hitSlop={8}
                                            onPress={() => {
                                                if (isEditing) {
                                                    setEditingWord(null);
                                                } else {
                                                    setEditingWord(item.word);
                                                    setDraft({ sentence: item.sentence ?? '', notes: item.notes ?? '' });
                                                }
                                            }}
                                        >
                                            <Text style={styles.editText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
                                        </Pressable>
                                        {!isEditing && (
                                            <Pressable
                                                hitSlop={8}
                                                onPress={() => handleDeleteWord(item.word)}
                                            >
                                                <Text style={styles.deleteText}>Remove</Text>
                                            </Pressable>
                                        )}
                                    </View>

                                    <Text style={styles.partOfSpeech}>{item.partOfSpeech}</Text>
                                    <Text style={styles.definition}>{item.definition}</Text>

                                    {!isEditing && item.sentence ? (
                                        <View style={styles.metaBlock}>
                                            <Text style={styles.metaLabel}>Sentence</Text>
                                            <Text style={styles.metaValue}>{item.sentence}</Text>
                                        </View>
                                    ) : null}

                                    {!isEditing && item.notes ? (
                                        <View style={styles.metaBlock}>
                                            <Text style={styles.metaLabel}>Notes</Text>
                                            <Text style={styles.metaValue}>{item.notes}</Text>
                                        </View>
                                    ) : null}

                                    {isEditing ? (
                                        <View style={styles.editForm}>
                                            <View style={styles.labelRow}>
                                                <Text style={styles.metaLabel}>Sentence</Text>
                                                <Text style={styles.charCount}>{draft.sentence.length} / {SENTENCE_MAX}</Text>
                                            </View>
                                            <TextInput
                                                style={styles.editInput}
                                                placeholder={`e.g. 'I encountered "${item.word}" while reading...'`}
                                                placeholderTextColor={placeholderColor}
                                                value={draft.sentence}
                                                onChangeText={(t) => setDraft({ ...draft, sentence: t })}
                                                multiline
                                                autoCorrect
                                                ref={sentenceRef}
                                                maxLength={SENTENCE_MAX}
                                                returnKeyType="next"
                                                submitBehavior="submit"
                                                onSubmitEditing={() => {
                                                    Keyboard.dismiss();
                                                    setTimeout(() => notesRef.current?.focus(), 100);
                                                }}
                                            />
                                            <Text style={styles.metaLabel}>Notes</Text>
                                            <TextInput
                                                ref={notesRef}
                                                style={styles.editInput}
                                                placeholder="e.g. Similar to 'optimistic', used in formal writing"
                                                placeholderTextColor={placeholderColor}
                                                value={draft.notes}
                                                onChangeText={(t) => setDraft({ ...draft, notes: t })}
                                                multiline
                                                autoCorrect
                                                returnKeyType="done"
                                                onSubmitEditing={Keyboard.dismiss}
                                            />
                                            <Pressable
                                                style={styles.saveButton}
                                                onPress={() => { Keyboard.dismiss(); handleSaveEdit(item.word); }}
                                            >
                                                <Text style={styles.saveButtonText}>Save</Text>
                                            </Pressable>
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })
                    )}
                    </View>
                </KeyboardAwareScrollView>
            </View>

            {editingWord ? <KeyboardToolbar /> : null}
        </React.Fragment>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: C.background,
        },
        scrollContent: {
            paddingBottom: 400,
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
        list: {
            padding: 12,
            gap: 10,
        },
        empty: {
            marginTop: 32,
            textAlign: "center",
            fontSize: 15,
            color: C.textMuted,
        },
        card: {
            backgroundColor: C.backgroundCard,
            borderRadius: 10,
            padding: 14,
            gap: 4,
        },
        cardHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        word: {
            fontSize: 17,
            fontWeight: "700",
            color: C.text,
        },
        phonetic: {
            fontSize: 13,
            color: C.textMuted,
            flex: 1,
        },
        editButton: {
            marginLeft: 'auto',
        },
        editText: {
            fontSize: 13,
            color: ACCENT,
            fontWeight: '500',
        },
        deleteText: {
            fontSize: 13,
            color: ERROR,
            fontWeight: '500',
        },
        partOfSpeech: {
            fontSize: 12,
            fontStyle: "italic",
            color: ACCENT,
            textTransform: "capitalize",
        },
        definition: {
            fontSize: 14,
            color: C.textBody,
            lineHeight: 20,
        },
        metaBlock: {
            marginTop: 6,
            gap: 2,
        },
        metaLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: C.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        metaValue: {
            fontSize: 14,
            color: C.textMeta,
            lineHeight: 20,
        },
        editForm: {
            marginTop: 10,
            gap: 6,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: C.borderEdit,
            paddingTop: 10,
        },
        labelRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        charCount: {
            fontSize: 11,
            color: C.textFaded,
        },
        editInput: {
            borderWidth: 1,
            borderColor: C.borderInput,
            borderRadius: 8,
            padding: 10,
            fontSize: 14,
            color: C.text,
            backgroundColor: C.backgroundInput,
            minHeight: 64,
            textAlignVertical: 'top',
        },
        saveButton: {
            backgroundColor: ACCENT,
            borderRadius: 8,
            paddingVertical: 10,
            alignItems: 'center',
            marginTop: 4,
        },
        saveButtonText: {
            color: '#fff',
            fontWeight: '600',
            fontSize: 15,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
