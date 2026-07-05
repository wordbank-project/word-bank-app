import { useCallback, useMemo, useState } from "react";

import { ActivityIndicator, FlatList, Keyboard, Pressable, Text, View } from "react-native";

import { Link, router, useFocusEffect, useIsFocused } from "expo-router";

import { useColorScheme } from "@/context/theme-context";
import { useFlatListScroll } from "@/hooks/use-scroll-registration";

import { getReadList } from "@/storage/read-list-storage";
import { getWords } from "@/storage/words-storage";

import { ACCENT, Colors } from "@/styles/global";
import { openBook } from "@/utils/open-book";
import { showActionSheet } from "@/utils/show-action-sheet";

import StreakBar from "@/components/StreakBar";
import WordListItem, { type WordWithBook } from "@/components/WordListItem";
import ClearableTextInput from "@/components/ClearableTextInput";
import SearchButton from "@/components/SearchButton";

import { useTypewriterPlaceholder } from "@/hooks/use-typewriter-placeholder";

// The part-of-speech filter pills: everything, or only nouns / adjectives.
type PosFilter = 'all' | 'noun' | 'adjective';

const POS_FILTERS: { value: PosFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'noun', label: 'Nouns' },
    { value: 'adjective', label: 'Adjectives' },
];

// How the list is ordered: alphabetical (both directions), grouped by the book each
// word came from, or newest-added first.
type SortMode = 'az' | 'za' | 'book' | 'recent';
const SORT_MODES: SortMode[] = ['az', 'za', 'book', 'recent'];
const SORT_LABELS: Record<SortMode, string> = {
    az: 'A–Z',
    za: 'Z–A',
    book: 'By book',
    recent: 'Recently added',
};

// Whether a word's part of speech matches the selected filter. Matches across both
// dictionaries (dictionaryapi.dev says "adjective"; wiktapi/kaikki says "adj").
function matchesPos(partOfSpeech: string, filter: PosFilter): boolean {
    const pos = partOfSpeech.toLowerCase();
    if (filter === 'noun') {
        return pos === 'noun';
    }
    if (filter === 'adjective') {
        return pos === 'adjective' || pos === 'adj';
    }
    return true;
}

export default function WordsListScreen() {
    // placeholderTextColor needs a color value (not a class), so keep it themed here.
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

    const [allWords, setAllWords] = useState<WordWithBook[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [search, setSearch] = useState<string>('');
    const [posFilter, setPosFilter] = useState<PosFilter>('all');
    const [sortMode, setSortMode] = useState<SortMode>('az');

    const isFocused = useIsFocused();

    const { ref: flatListRef, onScroll, scrollEventThrottle } = useFlatListScroll<WordWithBook>();

    // Load every word from every book into one list. Each word keeps its book's
    // info so we can show it and open it. Runs each time the tab is opened.
    useFocusEffect(
        useCallback(() => {
            getReadList().then(async (books) => {
                const perBook = await Promise.all(books.map((book) => getWords(book.key)));
                const flat = books.flatMap((book, i) =>
                    perBook[i].map((word) => ({
                        ...word,
                        bookKey: book.key,
                        bookTitle: book.title,
                        bookAuthor: book.author,
                        bookYear: book.year,
                        bookCover: book.cover_i,
                    }))
                );
                // Ordering is handled by the `filtered` memo (depends on the sort mode).
                setAllWords(flat);
                setLoading(false);
            });
        }, [])
    );

    // Unique saved words; the typewriter picks a random one to show as a hint.
    // Build the deduped word list, but only rebuild it when allWords changes.
    // Is why we use useMemo here
    const wordSuggestions = useMemo(
        () => Array.from(new Set(allWords.map((w) => w.word))),
        [allWords],
    );

    // Types out one of your saved words while the search box is empty; Enter accepts it.
    const { text: typedPlaceholder, word } = useTypewriterPlaceholder(wordSuggestions, isFocused && !search);

    // Keep the words matching the POS filter + search box, then order them by the
    // chosen sort mode. `.filter` returns a fresh array, so sorting it doesn't mutate allWords.
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const result = allWords.filter((w) =>
            matchesPos(w.partOfSpeech, posFilter)
            && (!query || w.word.toLowerCase().includes(query))
        );
        result.sort((a, b) => {
            switch (sortMode) {
                case 'za': return b.word.localeCompare(a.word);
                case 'book': return a.bookTitle.localeCompare(b.bookTitle) || a.word.localeCompare(b.word);
                case 'recent': return (b.addedAt ?? 0) - (a.addedAt ?? 0) || a.word.localeCompare(b.word);
                default: return a.word.localeCompare(b.word); // 'az'
            }
        });
        return result;
    }, [allWords, search, posFilter, sortMode]);

    // How many saved words fall under each filter, shown on the pills themselves.
    const posCounts = useMemo<Record<PosFilter, number>>(() => ({
        all: allWords.length,
        noun: allWords.filter((w) => matchesPos(w.partOfSpeech, 'noun')).length,
        adjective: allWords.filter((w) => matchesPos(w.partOfSpeech, 'adjective')).length,
    }), [allWords]);

    // Filter to the typed word, or accept the placeholder suggestion when empty.
    function handleSearch(): void {
        Keyboard.dismiss();
        // if placeholder is shown use that as the search query instead of showing empty results for empty query
        setSearch(search.trim() || word);
    }

    // Pick how the list is ordered (alphabetical or grouped by book).
    function handleChooseSort(): void {
        showActionSheet('Sort words:', undefined, [
            ...SORT_MODES.map((mode) => ({
                text: `${sortMode === mode ? '✓ ' : ''}${SORT_LABELS[mode]}`,
                onPress: () => setSortMode(mode),
            })),
            { text: 'Cancel', style: 'cancel' as const },
        ]);
    }

    // Open the book this word belongs to.
    const openWord = useCallback((item: WordWithBook): void => {
        openBook({
            key: item.bookKey,
            title: item.bookTitle,
            author: item.bookAuthor,
            year: item.bookYear,
            cover_i: item.bookCover,
        });
    }, []);

    if (loading) {
        return (
            <View className="flex-1 bg-background">
                <ActivityIndicator className="mt-12" color={ACCENT} />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            <View className="pt-3">
                <StreakBar timestamps={allWords.map((w) => w.addedAt).filter((ts): ts is number => typeof ts === 'number')} />
            </View>
            <View className="px-4 pb-2">
                <ClearableTextInput
                    containerClassName="mb-2"
                    className="rounded-lg border border-border-input bg-input px-3 py-3 text-[15px] text-fg"
                    placeholder={typedPlaceholder || "Search your word bank..."}
                    placeholderTextColor={placeholderColor}
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={handleSearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                <SearchButton onPress={handleSearch} />
            </View>

            {/* Part-of-speech filter pills: All / Nouns / Adjectives. */}
            <View className="flex-row gap-2 px-4 pb-2">
                {POS_FILTERS.map(({ value, label }) => {
                    const selected = posFilter === value;
                    return (
                        <Pressable
                            key={value}
                            onPress={() => setPosFilter(value)}
                            className={`flex-1 items-center justify-center rounded-lg border px-1 py-1.75 ${selected ? "border-accent bg-accent" : "border-border-input bg-input"}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                        >
                            <Text
                                className={`text-xs font-semibold ${selected ? "text-white" : "text-muted"}`}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.7}
                            >
                                {label} {posCounts[value]}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Review entry + sort control */}
            <View className="flex-row items-center justify-between px-4 pb-2">
                {allWords.length >= 3 ? (
                    <Pressable onPress={() => router.push('/review')} hitSlop={8} className="py-0.5" accessibilityRole="button">
                        <Text className="text-[13px] font-semibold text-accent">🃏 Review your words</Text>
                    </Pressable>
                ) : (
                    <View />
                )}
                <Pressable onPress={handleChooseSort} hitSlop={8} className="py-0.5">
                    <Text className="text-[13px] font-semibold text-accent">Sort words: {SORT_LABELS[sortMode]} ▾</Text>
                </Pressable>
            </View>

            <FlatList
                ref={flatListRef}
                data={filtered}
                keyExtractor={(item) => `${item.bookKey}_${item.word}`}
                contentContainerClassName="gap-2.5 px-4 pb-8"
                scrollEventThrottle={scrollEventThrottle}
                onScroll={onScroll}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    allWords.length === 0 ? (
                        <View className="mt-16 items-center gap-2.5 px-8">
                            <Text className="text-lg font-semibold text-fg">No words yet</Text>
                            <Link href="/read-list" className="text-center text-sm text-accent">
                                Open a book and add words to build your word bank.
                            </Link>
                        </View>
                    ) : (
                        <View className="mt-16 items-center gap-2.5 px-8">
                            <Text className="text-lg font-semibold text-fg">No words are matched</Text>
                        </View>
                    )
                }
                renderItem={({ item }) => (
                    <WordListItem item={item} onPress={() => openWord(item)} />
                )}
            />
        </View>
    );
}
