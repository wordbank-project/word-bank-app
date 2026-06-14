import React, { useEffect, useRef, useState } from "react";

import { useIsFocused, usePreventRemove } from "@react-navigation/native";

import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardToolbar } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Stack, router, useLocalSearchParams } from "expo-router";

import { useColorScheme } from "@/context/theme-context";

import type { Language } from "@/models/language";
import { LANGUAGES } from "@/models/language";
import type { ReadListBook, ReadStatus } from "@/models/read-list-book";
import type { EditDraft, WordEntry } from "@/models/word-entry";

import { getLanguageCode, setLanguageCode } from "@/storage/language-storage";
import { getReadList, setReadBookStatus as persistReadStatus, upsertReadListBook } from "@/storage/read-list-storage";
import { getWords, setWords } from "@/storage/words-storage";

import { coverUri as coverImageUri } from "@/utils/cover-uri";
import { pickCoverImage } from "@/utils/pick-cover-image";
import { showActionSheet } from "@/utils/show-action-sheet";
import { fetchDefinition } from "@/utils/words-api";

import { useRandomSuggestion } from "@/hooks/use-random-suggestion";
import { useTypewriterPlaceholder } from "@/hooks/use-typewriter-placeholder";

import { ACCENT, Colors, ERROR } from "@/styles/global";

import CoverImage from "@/components/CoverImage";
import LanguageModal from "@/components/LanguageModal";
import ReadStatusSelector from "@/components/ReadStatusSelector";

// Extend with AI suggestions later
const RANDOM_WORDS = [
    "serendipity",
    "ephemeral",
    "melancholy",
    "resilience",
    "eloquent",
    "ambiguous",
    "tenacious",
    "vivid",
    "profound",
    "meticulous",
    "candid",
    "eloquence",
    "perseverance",
    "whimsical",
    "diligent",
];

export default function BookDetail() {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const insets = useSafeAreaInsets();
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

    const isCustomBook = key?.startsWith('custom_');

    const [coverUri, setCoverUri] = useState<string | null>(coverImageUri(cover_i, 'M'));

    const [words, setWordsState] = useState<WordEntry[]>([]);
    const [input, setInput] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [editingWord, setEditingWord] = useState<string | null>(null);
    const [draft, setDraft] = useState<EditDraft>({ sentence: '', notes: '' });

    const [editingMeta, setEditingMeta] = useState<boolean>(false);
    const [metaTitle, setMetaTitle] = useState<string>(title ?? '');
    const [metaAuthor, setMetaAuthor] = useState<string>(author ?? '');
    const [metaYear, setMetaYear] = useState<string>(year ?? '');

    const [wordAdded, setWordAdded] = useState<boolean>(false);

    const [inReadList, setInReadList] = useState<boolean>(false);
    const [readStatus, setReadStatus] = useState<ReadStatus>('want'); // Initial value is: "Want to read"

    const [language, setLanguage] = useState<Language>(LANGUAGES[0]); // defaults to the first language in array

    const { isRandom: isRandomWord, pickNextWord, onManualChange: onManualWordChange } = useRandomSuggestion(RANDOM_WORDS);

    // Animated placeholder that types out example words while the add-word field is
    // empty, the screen is focused, and we're not editing an existing word.
    const isFocused = useIsFocused();
    const typedWordPlaceholder = useTypewriterPlaceholder(RANDOM_WORDS, isFocused && !input && !editingWord);

    const notesRef = useRef<TextInput>(null);
    const sentenceRef = useRef<TextInput>(null);

    // On mount, restore the dictionary language the user picked last time (saved in AsyncStorage).
    useEffect(() => {
        // If there is a saved language in AsyncStorage, use it. Otherwise, keep the default language.
        getLanguageCode().then((code) => {
            if (!code) {
                return;
            }
            const saved = LANGUAGES.find(language => language.code === code);
            if (saved) {
                setLanguage(saved);
            }
        });
    }, []);

    // Once a word has been added, intercept "back" (button, swipe, header) and send the
    // user to the read list instead of back to the search screen. No-op until wordAdded is true.
    usePreventRemove(wordAdded, () => {
        router.navigate('/(tabs)/read-list');
    });

    useEffect(() => {
        if (editingWord) {
            setTimeout(() => sentenceRef.current?.focus(), 50);
        }
    }, [editingWord]);

    useEffect(() => {
        // If words are added to a book, show them
        if (key) {
            getWords(key).then(setWordsState);
        }
    }, [key]);

    // Reflect whether this book is already on the read list (and its status) so the toggle shows current state.
    useEffect(() => {
        if (!key) {
            return;
        }
        getReadList().then((list) => {
            const entry = list.find((b) => b.key === key);
            setInReadList(!!entry);
            if (entry) {
                setReadStatus(entry.status);
            }
        });
    }, [key]);

    // Builds a read-list entry from the current book metadata. `addedAt` is owned by
    // storage (see upsertReadListBook), so it's intentionally not part of this shape.
    function buildReadListEntry(overrides?: Partial<Omit<ReadListBook, 'addedAt'>>): Omit<ReadListBook, 'addedAt'> {
        return {
            key: key!,
            title: metaTitle || (title ?? ''),
            author: metaAuthor || (author ?? ''),
            year: metaYear || (year ?? ''),
            cover_i: coverUri ?? '',
            status: readStatus,
            ...overrides,
        };
    }

    // Adds the book to the read list with the given status, or just updates the
    // status if it's already on the list.
    async function persistToReadList(status: ReadStatus): Promise<void> {
        if (inReadList) {
            await persistReadStatus(key!, status);
        } else {
            await upsertReadListBook(buildReadListEntry({ status }));
            setInReadList(true);
        }
    }

    // Selecting a status saves immediately — the footer button is just an optional shortcut that also navigates to the read list.
    async function handleChangeReadStatus(status: ReadStatus): Promise<void> {
        setReadStatus(status);
        await persistToReadList(status);
    }

    async function saveToReadList(): Promise<void> {
        await persistToReadList(readStatus);
        router.navigate('/(tabs)/read-list');
    }

    async function handlePickCover(): Promise<void> {
        const uri = await pickCoverImage(coverUri !== null);
        if (!uri) {
            return;
        }
        setCoverUri(uri);
        await upsertReadListBook(buildReadListEntry({ cover_i: uri }));
    }

    async function handleSaveMeta(): Promise<void> {
        const trimmedTitle = metaTitle.trim();
        if (!trimmedTitle) {
            return;
        }
        await upsertReadListBook(buildReadListEntry({
            title: trimmedTitle,
            author: metaAuthor.trim(),
            year: metaYear.trim(),
        }));
        setEditingMeta(false);
    }

    function handleSelectLanguage(language: Language): void {
        setLanguage(language);
        setLanguageCode(language.code);
    }

    function handleChangeInput(text: string): void {
        onManualWordChange();
        setInput(text);
    }

    async function handleAddWord(): Promise<void> {
        const wasRandom = isRandomWord.current;
        let word = input.trim().toLowerCase();
        if (!word || wasRandom) {
            const nextWord = pickNextWord(input);
            isRandomWord.current = true;
            setInput(nextWord);
            word = nextWord;
        }
        if (words.some((w) => w.word === word)) {
            setError("Word already added.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const newEntry = await fetchDefinition(word, language.code);

            // Only close the keyboard on pressing add button when a word is found
            // When it shows an error the keyboard stays open so the user can easily edit the input and try again
            Keyboard.dismiss();
            await persistWords([newEntry, ...words]);
            setWordAdded(true);
            setInput("");

            // Goes to the edit screen of the newly added word to encourage users to add sentence and notes 
            setDraft({ sentence: '', notes: '' });

            // Set the editing word to the newly added word to open the edit form
            setEditingWord(newEntry.word);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to fetch definition.");
        } finally {
            setLoading(false);
        }
    }

    function handleDeleteWord(word: string): void {
        showActionSheet(
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

    async function handleSaveEdit(word: string): Promise<void> {
        const updated = words.map((w) =>
            w.word === word
                ? { ...w, sentence: draft.sentence.trim() || undefined, notes: draft.notes.trim() || undefined }
                : w
        );
        await persistWords(updated);
        setEditingWord(null);
    }

    async function persistWords(updated: WordEntry[]): Promise<void> {
        setWordsState(updated);
        await setWords(key!, updated);
        // Single collection: ensure the book is on the read list so its words aren't orphaned.
        if (!inReadList) {
            await upsertReadListBook(buildReadListEntry());
            setInReadList(true);
        }
    }

    return (
        <React.Fragment>
            <Stack.Screen
                options={{
                    title: metaTitle || (title ?? "Book Detail"),
                    headerShown: true,
                    headerBackVisible: true,
                    // iOS: disable the long-press back menu so it can't bypass the saved-books redirect Is related to the usePreventRemove hook 
                    // that redirects back to saved-books once a word has been added.
                    // This ensures users don't accidentally lose their changes by navigating back to the search screen.
                    headerBackButtonMenuEnabled: false
                }}
            />

            <View style={styles.container}>
                {!editingWord && (
                    <View style={styles.addRow}>
                        <TextInput
                            style={styles.input}
                            placeholder={typedWordPlaceholder || "Add a word..."}
                            placeholderTextColor={placeholderColor}
                            value={input}
                            onChangeText={(t) => { handleChangeInput(t); setError(""); }}
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

                <LanguageModal selected={language} onSelect={handleSelectLanguage} />

                <KeyboardAwareScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    // Adjust the space between the keyboard and the selected input to ensure the input is not covered by the keyboard.
                    bottomOffset={230}
                >
                    <View style={styles.header}>
                        {isCustomBook ? (
                            <Pressable onPress={handlePickCover}>
                                <CoverImage uri={coverUri} style={styles.cover} />
                            </Pressable>
                        ) : (
                            <CoverImage uri={coverUri} style={styles.cover} />
                        )}
                        <View style={styles.headerInfo}>
                            {editingMeta ? (
                                <>
                                    <TextInput
                                        style={styles.metaInput}
                                        value={metaTitle}
                                        onChangeText={setMetaTitle}
                                        placeholder="Title"
                                        placeholderTextColor={placeholderColor}
                                        returnKeyType="next"
                                    />
                                    <TextInput
                                        style={styles.metaInput}
                                        value={metaAuthor}
                                        onChangeText={setMetaAuthor}
                                        placeholder="Author (optional)"
                                        placeholderTextColor={placeholderColor}
                                        returnKeyType="next"
                                    />
                                    <TextInput
                                        style={styles.metaInput}
                                        value={metaYear}
                                        onChangeText={setMetaYear}
                                        placeholder="Year (optional)"
                                        placeholderTextColor={placeholderColor}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        returnKeyType="done"
                                        onSubmitEditing={handleSaveMeta}
                                    />
                                    <View style={styles.metaActions}>
                                        <Pressable style={styles.metaSave} onPress={handleSaveMeta}>
                                            <Text style={styles.metaSaveText}>Save</Text>
                                        </Pressable>
                                        <Pressable onPress={() => {
                                            setMetaTitle(title ?? '');
                                            setMetaAuthor(author ?? '');
                                            setMetaYear(year ?? '');
                                            setEditingMeta(false);
                                        }}>
                                            <Text style={styles.metaCancelText}>Cancel</Text>
                                        </Pressable>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.bookTitle} numberOfLines={3}>{metaTitle || title}</Text>
                                    {(metaAuthor || author) ? <Text style={styles.bookAuthor}>{metaAuthor || author}</Text> : null}
                                    {(metaYear || year) ? <Text style={styles.bookYear}>{metaYear || year}</Text> : null}
                                    <Text style={styles.wordCount}>
                                        {words.length} {words.length === 1 ? 'word' : 'words'}
                                    </Text>
                                    {isCustomBook && (
                                        <Pressable onPress={() => setEditingMeta(true)} hitSlop={8} style={styles.editMetaButton}>
                                            <Text style={styles.editMetaText}>Edit details</Text>
                                        </Pressable>
                                    )}
                                </>
                            )}
                        </View>
                    </View>

                    <View style={styles.list}>
                        {words.length === 0 ? (
                            <Text style={styles.empty}>No words added yet. Add one above. It will be saved to your <Text style={styles.wordBankText}>word bank</Text> per book.</Text>
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
                                                    <Text style={styles.charCount}>{draft.sentence.length}</Text>
                                                </View>
                                                <TextInput
                                                    style={styles.editInput}
                                                    placeholder={item.exampleSentence ?? `e.g. 'I encountered "${item.word}" while reading...'`}
                                                    placeholderTextColor={placeholderColor}
                                                    value={draft.sentence}
                                                    onChangeText={(t) => setDraft({ ...draft, sentence: t })}
                                                    multiline
                                                    autoCorrect
                                                    ref={sentenceRef}
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

                {!editingWord && (
                    // It always goes above the native keyboard on the devices using insets
                    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
                        <ReadStatusSelector value={readStatus} onChange={handleChangeReadStatus} />
                        <Pressable style={styles.saveButton} onPress={saveToReadList}>
                            <Text style={styles.saveButtonText}>
                                {inReadList ? 'Update read list' : 'Save to read list'}
                            </Text>
                        </Pressable>
                    </View>
                )}
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
        // paddingBottom is set inline from the device's safe-area inset so the footer
        // clears the iOS home indicator / Android gesture bar.
        footer: {
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: C.border,
            backgroundColor: C.background,
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
        wordCount: {
            fontSize: 13,
            fontWeight: '600',
            color: ACCENT,
        },
        wordBankText: {
            fontStyle: "italic",
            color: C.textMuted,
        },
        editMetaButton: {
            alignSelf: 'flex-start',
            marginTop: 2,
        },
        editMetaText: {
            fontSize: 13,
            color: ACCENT,
            fontWeight: '500',
        },
        metaInput: {
            borderWidth: 1,
            borderColor: C.borderInput,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 6,
            fontSize: 14,
            color: C.text,
            backgroundColor: C.backgroundInput,
        },
        metaActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 2,
        },
        metaSave: {
            backgroundColor: ACCENT,
            borderRadius: 6,
            paddingHorizontal: 14,
            paddingVertical: 6,
        },
        metaSaveText: {
            color: '#fff',
            fontSize: 13,
            fontWeight: '600',
        },
        metaCancelText: {
            fontSize: 13,
            color: C.textMuted,
            fontWeight: '500',
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
