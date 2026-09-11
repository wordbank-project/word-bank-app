import React, { useEffect, useRef, useState } from "react";

import { useIsFocused, usePreventRemove } from "@react-navigation/native";

import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardToolbar } from "react-native-keyboard-controller";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Stack, router, useLocalSearchParams } from "expo-router";

import { useColorScheme } from "@/context/theme-context";

import type { Language } from "@/models/language";
import { LANGUAGES } from "@/models/language";
import type { ReadListBook, ReadStatus } from "@/models/read-list-book";
import type { EditDraft, WordEntry } from "@/models/word-entry";

import {
    getTranslationLanguageCode,
    setTranslationLanguageCode,
} from "@/storage/language-storage";
import { getReadList, removeReadListBook, setReadBookStatus as persistReadStatus, upsertReadListBook } from "@/storage/read-list-storage";
import { getWords, removeWords, setWords } from "@/storage/words-storage";

import { coverUri as coverImageUri } from "@/utils/cover-uri";
import { pickCoverImage } from "@/utils/pick-cover-image";
import { setPendingReadFilter } from "@/utils/pending-read-filter";
import { showActionSheet } from "@/utils/show-action-sheet";
import { fetchSuggestions } from "@/utils/api/suggestions-api";
import { translateWord } from "@/utils/api/translate-api";
import { fetchDefinition } from "@/utils/api/words-api";
import { postWordToFeed } from "@/utils/api/words-feed-api";

import { useResolvedSuggestions } from "@/hooks/use-resolved-suggestions";
import { useSavedLanguage } from "@/context/language-context";
import { useTypewriterPlaceholder } from "@/hooks/use-typewriter-placeholder";
import { useWordSuggestions } from "@/hooks/use-word-suggestions";

import { ACCENT, Colors, Fonts } from "@/styles/global";

import { LanguageModalSkeleton, NoteCardSkeleton, ReadStatusSkeleton, SaveButtonSkeleton, WordCardSkeletons, WordCountSkeleton } from "@/components/skeletons/BookDetailSkeletons";
import ClearableTextInput from "@/components/ClearableTextInput";
import CoverImage from "@/components/CoverImage";
import CoverPlaceholder from "@/components/CoverPlaceholder";
import DefinitionModal from "@/components/modal/DefinitionModal";
import LanguageModal from "@/components/modal/LanguageModal";
import ReadStatusSelector from "@/components/ReadStatusSelector";
import StarRating from "@/components/StarRating";
import { alertDialog } from "@/utils/alert-dialog";

const RANDOM_DICTIONARY_WORDS = [
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

    const { key, title, author, year, cover_i, focusWord } = useLocalSearchParams<{
        key: string;
        title: string;
        author: string;
        year: string;
        cover_i: string;
        focusWord?: string;
    }>();

    const isCustomBook = key?.startsWith('custom_');

    const [coverUri, setCoverUri] = useState<string | null>(coverImageUri(cover_i, 'M'));

    const [words, setWordsState] = useState<WordEntry[]>([]);

    // True until the initial AsyncStorage reads resolve — gates the skeletons so the
    // empty states ("No words added yet", "Add book notes…") never flash for books
    // that do have content.
    const [loadingWords, setLoadingWords] = useState<boolean>(true);
    const [loadingEntry, setLoadingEntry] = useState<boolean>(true);

    // Whether this screen's own AsyncStorage reads (words + read-list entry)
    // have resolved — used to keep the language rows' skeletons visually in
    // sync with the rest of the screen, since languageReady/translateToLanguageReady
    // can resolve much earlier (languageReady in particular comes from the
    // app-root language context, not a book.tsx-local read) and would
    // otherwise pop in before everything else finishes loading.
    const screenDataReady = !loadingWords && !loadingEntry;

    const [input, setInput] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [editingWord, setEditingWord] = useState<string | null>(null);
    const [draft, setDraft] = useState<EditDraft>({ sentence: '', notes: '' });
    // Which word's definition picker is open (null = none).
    const [definitionPickerWord, setDefinitionPickerWord] = useState<string | null>(null);

    // The book's current, authoritative title/author/year — seeded from the route
    // params for an instant first paint, then corrected from the persisted
    // read-list entry once that loads (see the getReadList effect below), and
    // kept in sync by handleSaveMeta on every save. Never touched by Cancel —
    // that's what draftTitle/draftAuthor/draftYear are for.
    const [editingMeta, setEditingMeta] = useState<boolean>(false);
    const [metaTitle, setMetaTitle] = useState<string>(title ?? '');
    const [metaAuthor, setMetaAuthor] = useState<string>(author ?? '');
    const [metaYear, setMetaYear] = useState<string>(year ?? '');

    // The live edit-form buffer, only meaningful while editingMeta is true —
    // seeded from metaTitle/metaAuthor/metaYear each time the editor opens (see
    // the "Edit details" press handler) and discarded on Cancel/Save. Kept
    // separate from metaTitle/etc. so a deliberately cleared Author/Year (an
    // empty string) can't be confused with "not yet loaded" — a plain `||`
    // fallback to the last-known value can't tell those two apart.
    const [draftTitle, setDraftTitle] = useState<string>('');
    const [draftAuthor, setDraftAuthor] = useState<string>('');
    const [draftYear, setDraftYear] = useState<string>('');

    const [wordAdded, setWordAdded] = useState<boolean>(false);

    // Book-level review and general notes (saved on the read-list entry).
    const [review, setReview] = useState<string>('');
    const [bookNotes, setBookNotes] = useState<string>('');
    const [editingReview, setEditingReview] = useState<boolean>(false);
    const [editingBookNotes, setEditingBookNotes] = useState<boolean>(false);
    const [reviewDraft, setReviewDraft] = useState<string>('');
    const [bookNotesDraft, setBookNotesDraft] = useState<string>('');
    const [rating, setRating] = useState<number>(0);

    const [inReadList, setInReadList] = useState<boolean>(false);
    const [readStatus, setReadStatus] = useState<ReadStatus>('want'); // Initial value is: "Want to read"

    // Restores the saved dictionary language from AsyncStorage on mount; setLanguage persists too.
    const { language, languageReady, setLanguage } = useSavedLanguage();

    // Optional "translate to" language for the per-word
    // independent of the dictionary language above.
    const [translateToLanguage, setTranslateToLanguage] = useState<Language>(LANGUAGES[0]); // Initial language is "nl"
    // Mirrors useSavedLanguage's languageReady, but for this independent
    // preference — true once the mount-time restore below has resolved, so its
    // LanguageModal row can show a skeleton instead of flashing LANGUAGES[0].
    const [translateToLanguageReady, setTranslateToLanguageReady] = useState<boolean>(false);

    // Cached translations, keyed `${word}:${toLangCode}` so switching the target
    // language never shows a stale result. null = fetched but no translation found.
    const [translations, setTranslations] = useState<Record<string, string | null>>({});
    const [translatingWord, setTranslatingWord] = useState<string | null>(null);

    // Waits for AI-generated example words for the current dictionary language to
    // settle, then commits to them (or the static fallback list, if they fail/time
    // out/come back empty) once and for all — see useResolvedSuggestions. `null`
    // while still waiting.
    const suggestionWords = useResolvedSuggestions(
        () => fetchSuggestions(language.code).then((s) => s.words),
        RANDOM_DICTIONARY_WORDS,
        language.code,
        languageReady,
    );

    // Types out one example word while the add-word field is empty, the screen is
    // focused, we're not editing, and a suggestion source has been resolved.
    // `suggestedWord` is added on Enter when empty.
    const isFocused = useIsFocused();
    const { text: typedWordPlaceholder, word: suggestedWord } = useTypewriterPlaceholder(
        suggestionWords ?? [],
        isFocused && !input && !editingWord && suggestionWords !== null,
    );

    // As-you-type dictionary suggestions (debounced): real words from Datamuse
    // (English) or the self-hosted wiktapi /search (other languages). Empty on
    // any failure — the chip row simply doesn't render.
    const suggestions = useWordSuggestions(input, language.code, isFocused && !editingWord && !loading);

    const notesRef = useRef<TextInput>(null);
    const sentenceRef = useRef<TextInput>(null);
    const reviewInputRef = useRef<TextInput>(null);
    // Which field to focus when a word's edit form opens — set by openWordEdit so
    // tapping the Sentence vs Notes text focuses the matching input.
    const focusFieldRef = useRef<'sentence' | 'notes'>('sentence');
    // Scroll-to-notes: the scroll view ref + the Book Notes section's y offset
    // (captured on layout), so the "Jump to notes" link can scroll straight there.
    const scrollRef = useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null);
    const bookNotesInputRef = useRef<TextInput>(null);
    // Current scroll position, tracked via onScroll so keepInputAboveKeyboard can
    // scroll by a precise delta as a multiline input grows.
    const scrollOffset = useRef<number>(0);
    const bookNotesY = useRef<number>(0);
    // Offsets (captured on layout) so opening an editor can scroll that card's input
    // up above the keyboard immediately. onLayout is parent-relative, so a card's
    // scroll-content y = its container's y + the card's local y. `bookNotesY` (the
    // Notes section) is already a direct child of the scroll view → content coords.
    const wordsContainerY = useRef<number>(0);   // words list container, in content coords
    const cardYs = useRef<Record<string, number>>({}); // each word card, relative to the list
    const reviewY = useRef<number>(0);           // review card, relative to the Notes section
    // Ensures the "Have Read" → rate-and/or-review nudge only fires once per visit.
    const hasPromptedReviewOrRating = useRef<boolean>(false);

    // A word tapped on the Words List: scroll to its card once layout is known, then
    // flash it. Held in a ref so it only ever fires once per visit.
    const pendingFocusWord = useRef<string | null>(focusWord ?? null);
    const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
    const highlightOpacity = useSharedValue(0);
    const highlightStyle = useAnimatedStyle(() => ({ opacity: highlightOpacity.value }));
    const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (highlightTimer.current) {
            clearTimeout(highlightTimer.current);
        }
    }, []);

    // On mount, restore the "translate to" language the user picked last time.
    useEffect(() => {
        getTranslationLanguageCode().then((code) => {
            const saved = code ? LANGUAGES.find(language => language.code === code) : undefined;
            if (saved) {
                setTranslateToLanguage(saved);
            }
            setTranslateToLanguageReady(true);
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
            getWords(key).then(setWordsState).finally(() => setLoadingWords(false));
        } else {
            setLoadingWords(false);
        }
    }, [key]);

    // Reflect whether this book is already on the read list (and its status) so the toggle shows current state.
    useEffect(() => {
        if (!key) {
            setLoadingEntry(false);
            return;
        }
        getReadList().then((list) => {
            const entry = list.find((b) => b.key === key);
            setInReadList(!!entry);
            if (entry) {
                setReadStatus(entry.status);
                setReview(entry.review ?? '');
                setBookNotes(entry.bookNotes ?? '');
                setRating(entry.rating ?? 0);
                // The persisted entry is the authoritative title/author/year —
                // corrects the route-params snapshot metaTitle/metaAuthor/metaYear
                // started from, e.g. a just-created custom book whose
                // placeholder-accepted author/year settled into storage a render
                // after the title did.
                setMetaTitle(entry.title);
                setMetaAuthor(entry.author);
                setMetaYear(entry.year);
            }
        }).finally(() => setLoadingEntry(false));
    }, [key]);

    // Builds a read-list entry from the current book metadata. `addedAt` is owned by
    // storage (see upsertReadListBook), so it's intentionally not part of this shape.
    function buildReadListEntry(overrides?: Partial<Omit<ReadListBook, 'addedAt'>>): Omit<ReadListBook, 'addedAt'> {
        return {
            key: key!,
            title: metaTitle,
            author: metaAuthor,
            year: metaYear,
            cover_i: coverUri ?? '',
            status: readStatus,
            review: review || undefined,
            bookNotes: bookNotes || undefined,
            rating: rating || undefined,
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

    // When a user marks a book "Have Read", nudge them to rate and/or review it.
    // The star row sits at the top of the review card, so scrolling it into view
    // surfaces the rating; the editor only auto-opens when no review exists yet.
    function maybePromptForReviewOrRating(status: ReadStatus): void {
        if (status !== 'read' || (review && rating) || hasPromptedReviewOrRating.current) {
            return;
        }
        // Only once per visit
        hasPromptedReviewOrRating.current = true;

        scrollCardIntoView(bookNotesY.current + reviewY.current);

        if (!review) {
            setReviewDraft('');
            setEditingReview(true);
            setTimeout(() => reviewInputRef.current?.focus(), 100);
        }
    }

    // Selecting a status saves immediately — the footer button is just an optional shortcut that also navigates to the read list.
    async function handleChangeReadStatus(status: ReadStatus): Promise<void> {
        setReadStatus(status);
        await persistToReadList(status);
        // Remember the chosen status so the Read List shows the matching filter on
        // return — including via the back button, which can't carry a route param.
        setPendingReadFilter(status);
        maybePromptForReviewOrRating(status);
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

    /**
     * Deletes the book from the read list and removes all words associated with it.
     * @param key
     * @returns {Promise<void>} Nothing. Resolves when the book and its words have been removed.
     * 
     */
    async function handleDeleteReadListBook(key: string): Promise<void> {
        await removeReadListBook(key);
        await removeWords([key]); // Clear all words associated with the book
    }

    /**
     * Saves the book metadata (title, author, year) to the read list. If all three fields are cleared, it prompts the user to delete the book instead.
     * @returns {Promise<void>} Nothing. Resolves when the metadata has been saved or the book has been deleted.
     * 
     */
    async function handleSaveMeta(): Promise<void> {
        const trimmedTitle = draftTitle.trim();
        const trimmedAuthor = draftAuthor.trim();
        const trimmedYear = draftYear.trim();
        if (!trimmedTitle && !trimmedAuthor && !trimmedYear) {
            // A book can't be saved simultaneously without a title, author and a year, 
            // so if the user clears all three fields, delete the book instead of saving it. 
            // Title is not required anymore so optional (placeholder title is used for new books if nothing is entered)
            // Delete and go back to the read list after confirmation from the user
            showActionSheet(
                "Delete this book?",
                "This permanently deletes this book and all words associated with it. This cannot be undone!",
                [
                    {
                        text: "Delete book and its words",
                        style: "destructive",
                        onPress: async () => {
                            try {
                                await handleDeleteReadListBook(key!);
                                router.navigate('/(tabs)/read-list');
                            } catch (error) {
                                console.error(error);
                                alertDialog("Something went wrong", "Could not delete your book. Please try again.");
                            }
                        },
                    },
                    { text: "Cancel", style: "cancel" },
                ],
            );
            return;
        }
        await upsertReadListBook(buildReadListEntry({
            title: trimmedTitle,
            author: trimmedAuthor,
            year: trimmedYear,
        }));
        // Commit the draft as the new current value immediately — a cleared
        // Author/Year needs to actually read as cleared (an empty string), not
        // fall back to whatever the old value was.
        setMetaTitle(trimmedTitle);
        setMetaAuthor(trimmedAuthor);
        setMetaYear(trimmedYear);
        setEditingMeta(false);
    }

    // A star tap saves immediately (like selecting a read status). Tapping the
    // current top star again clears the rating back to 0.
    async function handleSetRating(next: number): Promise<void> {
        setRating(next);
        await upsertReadListBook(buildReadListEntry({ rating: next || undefined }));
        setInReadList(true);
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
        setLanguage(language); // saved too — see useSavedLanguage
    }

    function handleSelectTranslateToLanguage(language: Language): void {
        setTranslateToLanguage(language);
        setTranslationLanguageCode(language.code)
            .catch((error) => (console.error(error)));
    }

    // Fetches (or re-fetches) a word's translation and caches it, keyed by the
    // current "translate to" language so switching targets never shows a stale
    // result. `fromLang` is the word's own sourceLanguage — see WordEntry.
    async function handleTranslate(word: string, fromLang: string): Promise<void> {
        setTranslatingWord(word);
        const result = await translateWord(word, fromLang, translateToLanguage.code);
        setTranslations((prev) => ({ ...prev, [`${word}:${translateToLanguage.code}`]: result }));
        setTranslatingWord(null);
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

    // Core add flow with the word passed explicitly — shared by the submit
    // button and the as-you-type suggestion chips (passing the word avoids
    // racing a just-set `input` state).
    async function addWord(word: string): Promise<void> {
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

            // Added timestamp for sorting by "Recently added" in the Words List
            await persistWords([{ ...newEntry, addedAt: Date.now(), sourceLanguage: language.code }, ...words]);
            // Fire-and-forget: contribute the word + its public dictionary definition
            // to the floating-words feed (no user-authored sentence/notes).
            postWordToFeed(newEntry.word, {
                definition: newEntry.definition,
                partOfSpeech: newEntry.partOfSpeech,
                phonetic: newEntry.phonetic,
            });
            setWordAdded(true);
            setInput("");

            // Goes to the edit screen of the newly added word to encourage users to add sentence and notes.
            // Pre-fills the dictionary's own example sentence when there is one, same fallback as openWordEdit.
            setDraft({ sentence: newEntry.exampleSentence ?? '', notes: '' });

            // Set the editing word to the newly added word to open the edit form
            setEditingWord(newEntry.word);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to fetch definition.");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddWord(): Promise<void> {
        // toLowerCase() was not correct here, since words with uppercase should also be searchable.
        let word = input.trim();
        if (!word) {
            // If a suggested word is available from the placeholder use that.
            word = suggestedWord;
            if (!word) {
                return;
            }
            setInput(word);
        }
        await addWord(word);
    }

    function handleDeleteWord(word: string): void {
        showActionSheet(
            "Remove word?",
            `Remove "${word}" from this book?`,
            [
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        await persistWords(words.filter((w) => w.word !== word));
                    },
                },
                { text: "Cancel", style: "cancel" },
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

    // Scroll to the word the user tapped on the Words List and flash an accent
    // outline around it. Both the words container's y and the target card's y
    // (relative to it) are needed; each arrives from its own onLayout, in no
    // guaranteed order — so this is called from both handlers and whichever lands
    // last does the work. No timers, no guessing.
    function maybeScrollToFocusWord(): void {
        const word = pendingFocusWord.current;
        if (!word || wordsContainerY.current === 0 || cardYs.current[word] === undefined) {
            return;
        }
        pendingFocusWord.current = null; // consume: only once per visit

        scrollCardIntoView(wordsContainerY.current + cardYs.current[word]);

        setHighlightedWord(word);
        // Show at full strength immediately — a plain assignment, so no accessibility
        // setting can skip it — then fade out. ReduceMotion.Never throughout: with the
        // default (System) a device with "Remove animations" / battery saver snaps
        // animations to their end value, which left the outline invisible on Android.
        // Same reason SearchButton's loading dots opt out.
        highlightOpacity.value = 1;
        highlightOpacity.value = withDelay(
            1200,
            withTiming(0, { duration: 500, reduceMotion: ReduceMotion.Never }),
            ReduceMotion.Never,
        );
        // Unmount the overlay once the fade has finished.
        highlightTimer.current = setTimeout(() => setHighlightedWord(null), 1800);
    }

    // Keep a growing multiline input's bottom above the keyboard while editing.
    // The focus handler positions the card once; as the user keeps typing the
    // field grows downward and the caret can slip under the keyboard, so re-scroll
    // by just the overlap on each content-size change. Shrinking (backspace) yields
    // a non-positive overlap → no-op, so it never jumps back.
    function keepInputAboveKeyboard(ref: React.RefObject<TextInput | null>): void {
        // Native-only: react-native-web has no Keyboard.metrics (and no floating
        // keyboard to avoid), so this whole helper is a no-op on web.
        if (typeof Keyboard.metrics !== "function") {
            return;
        }
        const kb = Keyboard.metrics();
        if (!kb) {
            return; // keyboard not shown yet — focus handler already positioned it
        }
        const MARGIN = 24; // breathing room below the caret
        ref.current?.measureInWindow((_x, y, _w, h) => {
            const overlap = y + h + MARGIN - kb.screenY; // kb.screenY = keyboard top
            if (overlap > 0) {
                scrollRef.current?.scrollTo({ y: scrollOffset.current + overlap, animated: true });
            }
        });
    }

    // Open a word's inline edit form, seeding the draft from its current values.
    // `field` decides which input gets focus (tapping the Sentence vs Notes text).
    // Falls back to the dictionary's own example sentence when there's no saved
    // one yet, so accepting it is a tap away instead of retyping it from the placeholder.
    function openWordEdit(item: WordEntry, field: 'sentence' | 'notes' = 'sentence'): void {
        focusFieldRef.current = field;
        setEditingWord(item.word);
        setDraft({ sentence: item.sentence ?? item.exampleSentence ?? '', notes: item.notes ?? '' });
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
                    title: metaTitle || "Book Detail",
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
                            className="rounded-lg border border-border-input bg-input p-3 text-[14px] android:leading-[21px] text-fg"
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

                {/* As-you-type dictionary suggestions — tap a chip to add that word. */}
                {!editingWord && !error && suggestions.length > 0 ? (
                    <ScrollView
                        horizontal
                        keyboardShouldPersistTaps="handled"
                        showsHorizontalScrollIndicator={false}
                        className="max-h-10 grow-0 px-3 mx-0 my-1"
                        contentContainerStyle={{ gap: 8, alignItems: 'center' }}
                    >
                        {suggestions.map((suggestion) => (
                            <Pressable
                                key={suggestion}
                                onPress={() => {
                                    setInput(suggestion);
                                    addWord(suggestion);
                                }}
                                className="rounded-2xl border border-border bg-card px-3 py-1.5"
                            >
                                <Text className="text-[13px] font-medium text-accent">{suggestion}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                ) : null}

                {error ? <Text className="mx-3 my-1 text-[13px] text-error">{error}</Text> : null}

                {languageReady && screenDataReady ? (
                    <LanguageModal selected={language} onSelect={handleSelectLanguage} />
                ) : (
                    <LanguageModalSkeleton />
                )}
                {translateToLanguageReady && screenDataReady ? (
                    <LanguageModal selected={translateToLanguage} onSelect={handleSelectTranslateToLanguage} label="Translate to" />
                ) : (
                    <LanguageModalSkeleton label="Translate to" />
                )}

                <KeyboardAwareScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled"
                    onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
                    scrollEventThrottle={16}
                    // Adjust the space between the keyboard and the selected input to ensure the input is not covered by the keyboard.
                    bottomOffset={230}
                >
                    <View className="flex-row items-center gap-3.5 border-b border-border p-4">
                        {isCustomBook ? (
                            <Pressable onPress={handlePickCover}>
                                <CoverImage uri={coverUri} className="h-40 w-30 rounded-lg" placeholder={<CoverPlaceholder size={40} />} />
                            </Pressable>
                        ) : (
                            <CoverImage uri={coverUri} className="h-40 w-30 rounded-lg" placeholder={<CoverPlaceholder size={40} />} />
                        )}
                        <View className="flex-1 justify-center gap-1.5">
                            {editingMeta ? (
                                <React.Fragment>
                                    <ClearableTextInput
                                        className="rounded-md border border-border-input bg-input px-2 py-1.5 text-sm text-fg"
                                        value={draftTitle}
                                        onChangeText={setDraftTitle}
                                        placeholder="Title (optional)" // Title is optional now, so users can create a book without a title. Placeholder title will be used for new books if nothing is entered.
                                        placeholderTextColor={placeholderColor}
                                        returnKeyType="next"
                                    />
                                    <ClearableTextInput
                                        className="rounded-md border border-border-input bg-input px-2 py-1.5 text-sm text-fg"
                                        value={draftAuthor}
                                        onChangeText={setDraftAuthor}
                                        placeholder="Author (optional)"
                                        placeholderTextColor={placeholderColor}
                                        returnKeyType="next"
                                    />
                                    <ClearableTextInput
                                        className="rounded-md border border-border-input bg-input px-2 py-1.5 text-sm text-fg"
                                        value={draftYear}
                                        onChangeText={setDraftYear}
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
                                        <Pressable onPress={() => setEditingMeta(false)}>
                                            <Text className="text-[13px] font-medium text-muted">Cancel</Text>
                                        </Pressable>
                                    </View>
                                </React.Fragment>
                            ) : (
                                <React.Fragment>
                                    <Text className="text-xl font-bold text-fg" numberOfLines={3}>{metaTitle}</Text>
                                    {metaAuthor ? <Text className="text-base text-secondary">{metaAuthor}</Text> : null}
                                    {metaYear ? <Text className="text-sm text-muted">{metaYear}</Text> : null}
                                    {loadingWords ? (
                                        <WordCountSkeleton />
                                    ) : (
                                        <Text className="text-[13px] font-semibold text-accent">
                                            {words.length} {words.length === 1 ? 'word' : 'words'}
                                        </Text>
                                    )}
                                    {isCustomBook && (
                                        <Pressable
                                            onPress={() => {
                                                // Seed the edit form from the current, authoritative values
                                                // every time it opens — a plain copy, not a `||` fallback, so
                                                // a deliberately empty Author/Year (cleared on a previous
                                                // save) opens the form empty instead of resurrecting the old
                                                // value.
                                                setDraftTitle(metaTitle);
                                                setDraftAuthor(metaAuthor);
                                                setDraftYear(metaYear);
                                                setEditingMeta(true);
                                            }}
                                            hitSlop={8}
                                            className="mt-0.5 self-start"
                                        >
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
                        onLayout={(e) => { wordsContainerY.current = e.nativeEvent.layout.y; maybeScrollToFocusWord(); }}
                    >
                        <Text className="ml-0.5 text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">Words</Text>
                        {loadingWords ? (
                            <WordCardSkeletons />
                        ) : words.length === 0 ? (
                            <Text className="my-8 text-center text-[15px] text-muted">No words added yet. Add one above. It will be saved to your <Text className="italic text-muted">word bank</Text> per book.</Text>
                        ) : (
                            words.map((item) => {
                                const isEditing = editingWord === item.word;
                                return (
                                    <View
                                        key={item.word}
                                        className="gap-1 rounded-[10px] bg-card p-3.5"
                                        onLayout={(e) => { cardYs.current[item.word] = e.nativeEvent.layout.y; maybeScrollToFocusWord(); }}
                                    >
                                        {/* Brief accent outline marking the word we scrolled to.
                                            Absolutely positioned so it can't shift the card's layout
                                            (a real border would nudge every card by 2px). */}
                                        {highlightedWord === item.word ? (
                                            <Animated.View
                                                pointerEvents="none"
                                                style={[
                                                    StyleSheet.absoluteFill,
                                                    { borderWidth: 2, borderColor: ACCENT, borderRadius: 10 },
                                                    highlightStyle,
                                                ]}
                                            />
                                        ) : null}

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

                                        {!isEditing && (item.sourceLanguage ?? language.code) !== translateToLanguage.code ? (() => {
                                            const cacheKey = `${item.word}:${translateToLanguage.code}`;
                                            const cached = translations[cacheKey];
                                            if (cached !== undefined) {
                                                return cached ? (
                                                    <Text className="mt-1 text-[13px] leading-5 text-muted">
                                                        <Text className="font-semibold text-accent">{translateToLanguage.label}: </Text>
                                                        {cached}
                                                    </Text>
                                                ) : (
                                                    <Text className="mt-1 text-[13px] text-muted">
                                                        No {translateToLanguage.label} translation found.
                                                    </Text>
                                                );
                                            }
                                            const isTranslating = translatingWord === item.word;
                                            return (
                                                <Pressable
                                                    hitSlop={8}
                                                    className="mt-1 self-start"
                                                    disabled={isTranslating}
                                                    onPress={() => handleTranslate(item.word, item.sourceLanguage ?? language.code)}
                                                >
                                                    <Text className="text-[13px] font-medium text-accent">
                                                        {isTranslating ? 'Translating…' : `Translate to ${translateToLanguage.label} ›`}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })() : null}

                                        {!isEditing && (item.sentence || item.exampleSentence) ? (
                                            <Pressable className="mt-1.5 gap-0.5" onPress={() => openWordEdit(item, 'sentence')}>
                                                <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                                                    {item.sentence ? 'Sentence' : 'Example sentence'}
                                                </Text>
                                                {item.sentence ? (
                                                    <Text className="text-sm leading-5 text-meta">{item.sentence}</Text>
                                                ) : (
                                                    <Text className="text-sm italic leading-5 text-muted">“{item.exampleSentence}”</Text>
                                                )}
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
                                {!loadingEntry && (
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
                                )}
                            </View>
                            {loadingEntry ? (
                                <NoteCardSkeleton />
                            ) : editingBookNotes ? (
                                <React.Fragment>
                                    <TextInput
                                        ref={bookNotesInputRef}
                                        className="min-h-16 rounded-lg border border-border-input bg-input p-2.5 text-sm text-fg"
                                        style={{ textAlignVertical: 'top' }}
                                        placeholder="General notes about this book…"
                                        placeholderTextColor={placeholderColor}
                                        value={bookNotesDraft}
                                        onChangeText={setBookNotesDraft}
                                        onContentSizeChange={() => {
                                            if (editingBookNotes) {
                                                keepInputAboveKeyboard(bookNotesInputRef);
                                            }
                                        }}
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
                                {!loadingEntry && (
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
                                )}
                            </View>
                            <View className="flex-row items-center gap-2 pb-1">
                                <StarRating value={rating} onChange={handleSetRating} size={28} />
                                {rating === 0 && !loadingEntry && (
                                    <Text className="text-[12px] text-muted">Tap to rate</Text>
                                )}
                            </View>
                            {loadingEntry ? (
                                <NoteCardSkeleton />
                            ) : editingReview ? (
                                <React.Fragment>
                                    <TextInput
                                        ref={reviewInputRef}
                                        className="min-h-16 rounded-lg border border-border-input bg-input p-2.5 text-sm text-fg"
                                        style={{ textAlignVertical: 'top' }}
                                        placeholder="What did you think of this book?"
                                        placeholderTextColor={placeholderColor}
                                        value={reviewDraft}
                                        onChangeText={setReviewDraft}
                                        onContentSizeChange={() => {
                                            if (editingReview) {
                                                keepInputAboveKeyboard(reviewInputRef);
                                            }
                                        }}
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
                        {loadingEntry ? (
                            <ReadStatusSkeleton />
                        ) : (
                            <ReadStatusSelector value={readStatus} onChange={handleChangeReadStatus} />
                        )}
                        {loadingEntry ? (
                            <SaveButtonSkeleton />
                        ) : (
                            <Pressable className="mt-1 items-center rounded-lg bg-accent py-2.5" onPress={saveToReadList}>
                                <Text className="text-[15px] font-semibold text-white">
                                    {inReadList ? 'Update read list' : 'Save to read list'}
                                </Text>
                            </Pressable>
                        )}
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
