import React, { useEffect, useRef, useState } from "react";

import { useIsFocused, usePreventRemove } from "@react-navigation/native";

import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from "react-native";
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
import { setPendingReadFilter } from "@/utils/pending-read-filter";
import { fetchTrendingWords } from "@/utils/trending-words";
import { showActionSheet } from "@/utils/show-action-sheet";
import { fetchDefinition } from "@/utils/words-api";
import { postWordToFeed } from "@/utils/words-feed-api";

import { useTypewriterPlaceholder } from "@/hooks/use-typewriter-placeholder";

import { Colors, Fonts } from "@/styles/global";

import ClearableTextInput from "@/components/ClearableTextInput";
import CoverImage from "@/components/CoverImage";
import CoverPlaceholder from "@/components/CoverPlaceholder";
import DefinitionModal from "@/components/DefinitionModal";
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
    const insets = useSafeAreaInsets();
    // placeholderTextColor needs a color value (not a class), so keep it themed here.
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

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
    // Which word's definition picker is open (null = none).
    const [definitionPickerWord, setDefinitionPickerWord] = useState<string | null>(null);

    const [editingMeta, setEditingMeta] = useState<boolean>(false);
    const [metaTitle, setMetaTitle] = useState<string>(title ?? '');
    const [metaAuthor, setMetaAuthor] = useState<string>(author ?? '');
    const [metaYear, setMetaYear] = useState<string>(year ?? '');

    const [wordAdded, setWordAdded] = useState<boolean>(false);

    // Book-level review and general notes (saved on the read-list entry).
    const [review, setReview] = useState<string>('');
    const [bookNotes, setBookNotes] = useState<string>('');
    const [editingReview, setEditingReview] = useState<boolean>(false);
    const [editingBookNotes, setEditingBookNotes] = useState<boolean>(false);
    const [reviewDraft, setReviewDraft] = useState<string>('');
    const [bookNotesDraft, setBookNotesDraft] = useState<string>('');

    const [inReadList, setInReadList] = useState<boolean>(false);
    const [readStatus, setReadStatus] = useState<ReadStatus>('want'); // Initial value is: "Want to read"

    const [language, setLanguage] = useState<Language>(LANGUAGES[0]); // defaults to the first language in array

    // Placeholder word suggestions: start with the curated list, then replace with
    // live trending words from the feed server when available (falls back to the
    // curated list on any failure, so the field is never empty / works offline).
    const [suggestionWords, setSuggestionWords] = useState<string[]>(RANDOM_WORDS);
    useEffect(() => {
        fetchTrendingWords().then((words) => {
            if (words.length > 0) {
                setSuggestionWords(words);
            }
        });
    }, []);

    // Types out one example word while the add-word field is empty, the screen is
    // focused, and we're not editing. `suggestedWord` is added on Enter when empty.
    const isFocused = useIsFocused();
    const { text: typedWordPlaceholder, word: suggestedWord } = useTypewriterPlaceholder(
        suggestionWords,
        isFocused && !input && !editingWord,
    );

    const notesRef = useRef<TextInput>(null);
    const sentenceRef = useRef<TextInput>(null);
    const reviewInputRef = useRef<TextInput>(null);
    // Which field to focus when a word's edit form opens — set by openWordEdit so
    // tapping the Sentence vs Notes text focuses the matching input.
    const focusFieldRef = useRef<'sentence' | 'notes'>('sentence');
    // Scroll-to-notes: the scroll view ref + the Book Notes section's y offset
    // (captured on layout), so the "Jump to notes" link can scroll straight there.
    const scrollRef = useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null);
    const bookNotesY = useRef<number>(0);
    // Offsets (captured on layout) so opening an editor can scroll that card's input
    // up above the keyboard immediately. onLayout is parent-relative, so a card's
    // scroll-content y = its container's y + the card's local y. `bookNotesY` (the
    // Notes section) is already a direct child of the scroll view → content coords.
    const wordsContainerY = useRef<number>(0);   // words list container, in content coords
    const cardYs = useRef<Record<string, number>>({}); // each word card, relative to the list
    const reviewY = useRef<number>(0);           // review card, relative to the Notes section
    // Ensures the "Have Read" → write-a-review nudge only fires once per visit.
    const hasPromptedReview = useRef<boolean>(false);

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
            const ref = focusFieldRef.current === 'notes' ? notesRef : sentenceRef;
            setTimeout(() => ref.current?.focus(), 50);
            focusFieldRef.current = 'sentence'; // reset default for the next open
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
                setReview(entry.review ?? '');
                setBookNotes(entry.bookNotes ?? '');
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
            review: review || undefined,
            bookNotes: bookNotes || undefined,
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

    // When a user marks a book as "Have Read" and they haven't written a review yet, 
    // we prompt them to do so.
    // This means going to the edit review form
    function maybePromptForReviewCheck(status: ReadStatus): void {
        if (status !== 'read' || review || hasPromptedReview.current) {
            return;
        }
        // Only once per visit
        hasPromptedReview.current = true;

        setReviewDraft('');
        setEditingReview(true);
        scrollCardIntoView(bookNotesY.current + reviewY.current);

        setTimeout(() => reviewInputRef.current?.focus(), 100);
    }

    // Selecting a status saves immediately — the footer button is just an optional shortcut that also navigates to the read list.
    async function handleChangeReadStatus(status: ReadStatus): Promise<void> {
        setReadStatus(status);
        await persistToReadList(status);
        // Remember the chosen status so the Read List shows the matching filter on
        // return — including via the back button, which can't carry a route param.
        setPendingReadFilter(status);
        maybePromptForReviewCheck(status);
    }

    async function saveToReadList(): Promise<void> {
        await persistToReadList(readStatus);
        setPendingReadFilter(readStatus);
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

    async function handleSaveReview(): Promise<void> {
        Keyboard.dismiss();

        const trimmedReview = reviewDraft.trim();
        setReview(trimmedReview);
        await upsertReadListBook(buildReadListEntry({ review: trimmedReview || undefined }));
        setInReadList(true);
        setEditingReview(false);
    }

    async function handleSaveBookNotes(): Promise<void> {
        Keyboard.dismiss();

        const trimmedNotes = bookNotesDraft.trim();
        setBookNotes(trimmedNotes);
        await upsertReadListBook(buildReadListEntry({ bookNotes: trimmedNotes || undefined }));
        setInReadList(true);
        setEditingBookNotes(false);
    }

    function handleSelectLanguage(language: Language): void {
        setLanguage(language);
        setLanguageCode(language.code);
    }

    // Switches which of a word's definitions is shown, denormalizing the chosen one
    // onto the entry's display fields so the card and Words List reflect it.
    async function handleSelectDefinition(word: string, index: number): Promise<void> {
        const updated = words.map((w) => {
            const def = w.definitions?.[index];
            if (w.word !== word || !def) {
                return w;
            }
            return {
                ...w,
                selectedDefinition: index,
                partOfSpeech: def.partOfSpeech,
                definition: def.definition,
                exampleSentence: def.exampleSentence,
            };
        });
        await persistWords(updated);
    }

    function handleChangeInput(text: string): void {
        setInput(text);
    }

    async function handleAddWord(): Promise<void> {
        let word = input.trim().toLowerCase();
        if (!word) {
            // If a suggested word is available from the placeholder use that.
            word = suggestedWord.toLowerCase();
            if (!word) {
                return;
            }
            setInput(word);
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

            // Added timestamp for sorting by "Recently added" in the Words List. 
            // This is not part of the dictionary data, so it's added here.
            await persistWords([{ ...newEntry, addedAt: Date.now() }, ...words]);
            // Fire-and-forget: contribute the word to the public floating-words feed (word only).
            postWordToFeed(newEntry.word);
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

    // Scroll a card near the top of the viewport so its inputs sit above the
    // keyboard immediately on select (the card's own top y is stable as its form
    // expands below it; KeyboardAwareScrollView's bottomOffset fine-tunes the gap).
    function scrollCardIntoView(y: number): void {
        const top = Math.max(y - 16, 0);
        // Immediate: mid-list cards (word sentence/notes) snap to the top right away.
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: top, animated: true }));
        // Follow-up: bottom-anchored cards (Book Notes / Review) can't reach `top`
        // until the keyboard's dynamic inset extends the scroll range — re-scroll
        // once it's shown. Idempotent (no-op) for cards already at `top`.
        setTimeout(() => scrollRef.current?.scrollTo({ y: top, animated: true }), 350);
    }

    // Open a word's inline edit form, seeding the draft from its current values.
    // `field` decides which input gets focus (tapping the Sentence vs Notes text).
    function openWordEdit(item: WordEntry, field: 'sentence' | 'notes' = 'sentence'): void {
        focusFieldRef.current = field;
        setEditingWord(item.word);
        setDraft({ sentence: item.sentence ?? '', notes: item.notes ?? '' });
        scrollCardIntoView(wordsContainerY.current + (cardYs.current[item.word] ?? 0));
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

    // The word whose definition picker is currently open, if any.
    const definitionPickerEntry = words.find((w) => w.word === definitionPickerWord);

    return (
        <React.Fragment>
            <Stack.Screen
                options={{
                    title: metaTitle || (title ?? "Book Detail"),
                    headerShown: true,
                    headerBackVisible: true,
                    // iOS: disable the long-press back menu so it can't bypass the read-list redirect. Related to the usePreventRemove hook
                    // that redirects to the read list once a word has been added.
                    // This ensures users don't accidentally lose their changes by navigating back to the search screen.
                    headerBackButtonMenuEnabled: false
                }}
            />

            <View className="flex-1 bg-background">
                {!editingWord && (
                    <View className="flex-row gap-2 p-3 pb-1">
                        <ClearableTextInput
                            containerClassName="flex-1"
                            className="rounded-lg border border-border-input bg-input px-3 py-3 text-base text-fg"
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
                            className={`min-w-14 items-center justify-center rounded-lg bg-accent px-4 ${loading ? "opacity-60" : ""}`}
                            onPress={handleAddWord}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text className="text-base font-semibold text-white">Add</Text>
                            )}
                        </Pressable>
                    </View>
                )}

                {error ? <Text className="px-3 pb-1 text-[13px] text-error">{error}</Text> : null}

                <LanguageModal selected={language} onSelect={handleSelectLanguage} />

                <KeyboardAwareScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled"
                    // Adjust the space between the keyboard and the selected input to ensure the input is not covered by the keyboard.
                    bottomOffset={230}
                >
                    <View className="flex-row items-center gap-3.5 border-b border-border p-4">
                        {isCustomBook ? (
                            <Pressable onPress={handlePickCover}>
                                <CoverImage uri={coverUri} className="h-40 w-30 rounded-lg" radius={8} placeholder={<CoverPlaceholder size={40} />} />
                            </Pressable>
                        ) : (
                            <CoverImage uri={coverUri} className="h-40 w-30 rounded-lg" radius={8} placeholder={<CoverPlaceholder size={40} />} />
                        )}
                        <View className="flex-1 justify-center gap-1.5">
                            {editingMeta ? (
                                <React.Fragment>
                                    <TextInput
                                        className="rounded-md border border-border-input bg-input px-2 py-1.5 text-sm text-fg"
                                        value={metaTitle}
                                        onChangeText={setMetaTitle}
                                        placeholder="Title"
                                        placeholderTextColor={placeholderColor}
                                        returnKeyType="next"
                                    />
                                    <TextInput
                                        className="rounded-md border border-border-input bg-input px-2 py-1.5 text-sm text-fg"
                                        value={metaAuthor}
                                        onChangeText={setMetaAuthor}
                                        placeholder="Author (optional)"
                                        placeholderTextColor={placeholderColor}
                                        returnKeyType="next"
                                    />
                                    <TextInput
                                        className="rounded-md border border-border-input bg-input px-2 py-1.5 text-sm text-fg"
                                        value={metaYear}
                                        onChangeText={setMetaYear}
                                        placeholder="Year (optional)"
                                        placeholderTextColor={placeholderColor}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        returnKeyType="done"
                                        onSubmitEditing={handleSaveMeta}
                                    />
                                    <View className="mt-0.5 flex-row items-center gap-3">
                                        <Pressable className="rounded-md bg-accent px-3.5 py-1.5" onPress={handleSaveMeta}>
                                            <Text className="text-[13px] font-semibold text-white">Save</Text>
                                        </Pressable>
                                        <Pressable onPress={() => {
                                            setMetaTitle(title ?? '');
                                            setMetaAuthor(author ?? '');
                                            setMetaYear(year ?? '');
                                            setEditingMeta(false);
                                        }}>
                                            <Text className="text-[13px] font-medium text-muted">Cancel</Text>
                                        </Pressable>
                                    </View>
                                </React.Fragment>
                            ) : (
                                <React.Fragment>
                                    <Text className="text-xl font-bold text-fg" numberOfLines={3}>{metaTitle || title}</Text>
                                    {(metaAuthor || author) ? <Text className="text-base text-secondary">{metaAuthor || author}</Text> : null}
                                    {(metaYear || year) ? <Text className="text-sm text-muted">{metaYear || year}</Text> : null}
                                    <Text className="text-[13px] font-semibold text-accent">
                                        {words.length} {words.length === 1 ? 'word' : 'words'}
                                    </Text>
                                    {isCustomBook && (
                                        <Pressable onPress={() => setEditingMeta(true)} hitSlop={8} className="mt-0.5 self-start">
                                            <Text className="text-[13px] font-medium text-accent">Edit details</Text>
                                        </Pressable>
                                    )}
                                    {words.length > 0 && (
                                        <Pressable
                                            onPress={() => scrollRef.current?.scrollTo({ y: bookNotesY.current, animated: true })}
                                            hitSlop={8}
                                            className="mt-2 self-start rounded-2xl border border-accent bg-card px-3 py-1.5"
                                        >
                                            <Text className="text-xs font-semibold text-accent">Jump to notes ↓</Text>
                                        </Pressable>
                                    )}
                                </React.Fragment>
                            )}
                        </View>
                    </View>

                    <View
                        className="gap-2.5 p-3"
                        onLayout={(e) => { wordsContainerY.current = e.nativeEvent.layout.y; }}
                    >
                        <Text className="ml-0.5 text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">Words</Text>
                        {words.length === 0 ? (
                            <Text className="my-8 text-center text-[15px] text-muted">No words added yet. Add one above. It will be saved to your <Text className="italic text-muted">word bank</Text> per book.</Text>
                        ) : (
                            words.map((item) => {
                                const isEditing = editingWord === item.word;
                                return (
                                    <View
                                        key={item.word}
                                        className="gap-1 rounded-[10px] bg-card p-3.5"
                                        onLayout={(e) => { cardYs.current[item.word] = e.nativeEvent.layout.y; }}
                                    >
                                        <View className="flex-row items-center gap-2">
                                            <Text className="text-[17px] font-bold text-fg">{item.word}</Text>
                                            {item.phonetic ? (
                                                <Text className="flex-1 text-[13px] text-muted" style={{ fontFamily: Fonts.mono }}>{item.phonetic}</Text>
                                            ) : null}
                                            <Pressable
                                                className="ml-auto"
                                                hitSlop={8}
                                                onPress={() => {
                                                    if (isEditing) {
                                                        setEditingWord(null);
                                                    } else {
                                                        openWordEdit(item);
                                                    }
                                                }}
                                            >
                                                <Text className="text-[13px] font-medium text-accent">{isEditing ? 'Cancel' : 'Edit'}</Text>
                                            </Pressable>
                                            {!isEditing && (
                                                <Pressable hitSlop={8} onPress={() => handleDeleteWord(item.word)}>
                                                    <Text className="text-[13px] font-medium text-error">Remove</Text>
                                                </Pressable>
                                            )}
                                        </View>

                                        <Text className="text-xs italic capitalize text-accent">{item.partOfSpeech}</Text>
                                        <Text className="text-sm leading-5 text-body">{item.definition}</Text>

                                        {item.definitions && item.definitions.length > 1 ? (
                                            <Pressable hitSlop={8} className="mt-1 self-start" onPress={() => setDefinitionPickerWord(item.word)}>
                                                <Text className="text-[13px] font-medium text-accent">
                                                    Choose other definition ({item.definitions.length}) ›
                                                </Text>
                                            </Pressable>
                                        ) : null}

                                        {!isEditing && item.sentence ? (
                                            <Pressable className="mt-1.5 gap-0.5" onPress={() => openWordEdit(item, 'sentence')}>
                                                <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Sentence</Text>
                                                <Text className="text-sm leading-5 text-meta">{item.sentence}</Text>
                                            </Pressable>
                                        ) : null}

                                        {!isEditing && item.notes ? (
                                            <Pressable className="mt-1.5 gap-0.5" onPress={() => openWordEdit(item, 'notes')}>
                                                <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Notes</Text>
                                                <Text className="text-sm leading-5 text-meta">{item.notes}</Text>
                                            </Pressable>
                                        ) : null}

                                        {isEditing ? (
                                            <View className="mt-2.5 gap-1.5 border-t border-border-edit pt-2.5">
                                                <View className="flex-row items-center justify-between">
                                                    <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Sentence</Text>
                                                    <Text className="text-[11px] text-faded">{draft.sentence.length}</Text>
                                                </View>
                                                <TextInput
                                                    className="min-h-16 rounded-lg border border-border-input bg-input p-2.5 text-sm text-fg"
                                                    style={{ textAlignVertical: 'top' }}
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
                                                <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Notes</Text>
                                                <TextInput
                                                    ref={notesRef}
                                                    className="min-h-16 rounded-lg border border-border-input bg-input p-2.5 text-sm text-fg"
                                                    style={{ textAlignVertical: 'top' }}
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
                                                    className="mt-1 items-center rounded-lg bg-accent py-2.5"
                                                    onPress={() => { Keyboard.dismiss(); handleSaveEdit(item.word); }}
                                                >
                                                    <Text className="text-[15px] font-semibold text-white">Save</Text>
                                                </Pressable>
                                            </View>
                                        ) : null}
                                    </View>
                                );
                            })
                        )}
                    </View>

                    <View
                        className="gap-2.5 p-3"
                        onLayout={(e) => { bookNotesY.current = e.nativeEvent.layout.y; }}
                    >
                        <Text className="ml-0.5 text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">Notes</Text>
                        <View className="gap-1 rounded-[10px] bg-card p-3.5">
                            <View className="flex-row items-center justify-between">
                                <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Book Notes</Text>
                                <Pressable
                                    className="ml-auto"
                                    hitSlop={8}
                                    onPress={() => {
                                        if (editingBookNotes) {
                                            setEditingBookNotes(false);
                                        } else {
                                            setBookNotesDraft(bookNotes);
                                            setEditingBookNotes(true);
                                            scrollCardIntoView(bookNotesY.current);
                                        }
                                    }}
                                >
                                    <Text className="text-[13px] font-medium text-accent">{editingBookNotes ? 'Cancel' : 'Edit'}</Text>
                                </Pressable>
                            </View>
                            {editingBookNotes ? (
                                <React.Fragment>
                                    <TextInput
                                        className="min-h-16 rounded-lg border border-border-input bg-input p-2.5 text-sm text-fg"
                                        style={{ textAlignVertical: 'top' }}
                                        placeholder="General notes about this book…"
                                        placeholderTextColor={placeholderColor}
                                        value={bookNotesDraft}
                                        onChangeText={setBookNotesDraft}
                                        multiline
                                        autoCorrect
                                        autoFocus
                                    />
                                    <Pressable
                                        className="mt-1 items-center rounded-lg bg-accent py-2.5"
                                        onPress={handleSaveBookNotes}
                                    >
                                        <Text className="text-[15px] font-semibold text-white">Save</Text>
                                    </Pressable>
                                </React.Fragment>
                            ) : bookNotes ? (
                                <Pressable onPress={() => { setBookNotesDraft(bookNotes); setEditingBookNotes(true); scrollCardIntoView(bookNotesY.current); }}>
                                    <Text className="text-sm leading-5 text-meta">{bookNotes}</Text>
                                </Pressable>
                            ) : (
                                <Pressable onPress={() => { setBookNotesDraft(''); setEditingBookNotes(true); scrollCardIntoView(bookNotesY.current); }}>
                                    <Text className="text-sm text-muted">Add book notes…</Text>
                                </Pressable>
                            )}
                        </View>

                        <View
                            className="gap-1 rounded-[10px] bg-card p-3.5"
                            onLayout={(e) => { reviewY.current = e.nativeEvent.layout.y; }}
                        >
                            <View className="flex-row items-center justify-between">
                                <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">My Review</Text>
                                <Pressable
                                    className="ml-auto"
                                    hitSlop={8}
                                    onPress={() => {
                                        if (editingReview) {
                                            setEditingReview(false);
                                        } else {
                                            setReviewDraft(review);
                                            setEditingReview(true);
                                            scrollCardIntoView(bookNotesY.current + reviewY.current);
                                        }
                                    }}
                                >
                                    <Text className="text-[13px] font-medium text-accent">{editingReview ? 'Cancel' : 'Edit'}</Text>
                                </Pressable>
                            </View>
                            {editingReview ? (
                                <React.Fragment>
                                    <TextInput
                                        ref={reviewInputRef}
                                        className="min-h-16 rounded-lg border border-border-input bg-input p-2.5 text-sm text-fg"
                                        style={{ textAlignVertical: 'top' }}
                                        placeholder="What did you think of this book?"
                                        placeholderTextColor={placeholderColor}
                                        value={reviewDraft}
                                        onChangeText={setReviewDraft}
                                        multiline
                                        autoCorrect
                                        autoFocus
                                    />
                                    <Pressable
                                        className="mt-1 items-center rounded-lg bg-accent py-2.5"
                                        onPress={handleSaveReview}
                                    >
                                        <Text className="text-[15px] font-semibold text-white">Save</Text>
                                    </Pressable>
                                </React.Fragment>
                            ) : review ? (
                                <Pressable onPress={() => { setReviewDraft(review); setEditingReview(true); scrollCardIntoView(bookNotesY.current + reviewY.current); }}>
                                    <Text className="text-sm leading-5 text-meta">{review}</Text>
                                </Pressable>
                            ) : (
                                <Pressable onPress={() => { setReviewDraft(''); setEditingReview(true); scrollCardIntoView(bookNotesY.current + reviewY.current); }}>
                                    <Text className="text-sm text-muted">Add a review of the book…</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </KeyboardAwareScrollView>

                {!(editingWord || editingReview || editingBookNotes) && (
                    // paddingBottom comes from the safe-area inset so the footer clears the OS bar.
                    <View className="gap-3 border-t border-border bg-background px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
                        <ReadStatusSelector value={readStatus} onChange={handleChangeReadStatus} />
                        <Pressable className="mt-1 items-center rounded-lg bg-accent py-2.5" onPress={saveToReadList}>
                            <Text className="text-[15px] font-semibold text-white">
                                {inReadList ? 'Update read list' : 'Save to read list'}
                            </Text>
                        </Pressable>
                    </View>
                )}
            </View>

            {definitionPickerEntry ? (
                <DefinitionModal
                    visible={!!definitionPickerWord}
                    onClose={() => setDefinitionPickerWord(null)}
                    word={definitionPickerEntry.word}
                    definitions={definitionPickerEntry.definitions ?? []}
                    selectedIndex={definitionPickerEntry.selectedDefinition ?? 0}
                    onSelect={(index) => handleSelectDefinition(definitionPickerEntry.word, index)}
                />
            ) : null}

            {editingWord ? <KeyboardToolbar /> : null}
        </React.Fragment>
    );
}
