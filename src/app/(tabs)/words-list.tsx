import { useCallback, useEffect, useMemo, useState } from "react";

import { ActivityIndicator, FlatList, Keyboard, Pressable, Text, View } from "react-native";

import { Link, useFocusEffect, useIsFocused } from "expo-router";

import { useColorScheme } from "@/context/theme-context";
import { useFlatListScroll } from "@/hooks/use-scroll-registration";

import { getReadList } from "@/storage/read-list-storage";
import { getSortMode, setSortMode as saveSortMode, SORT_MODES, type SortMode } from "@/storage/words-list-storage";
import { getWords } from "@/storage/words-storage";

import { ACCENT, Colors } from "@/styles/global";

import { openBook } from "@/utils/open-book";
import { normalizePos, POS_ORDER, posColor, posLabel } from "@/utils/part-of-speech";
import { showActionSheet } from "@/utils/show-action-sheet";

import WordListItem, { type WordWithBook } from "@/components/WordListItem";
import ClearableTextInput from "@/components/ClearableTextInput";
import SearchButton from "@/components/SearchButton";

import { useTypewriterPlaceholder } from "@/hooks/use-typewriter-placeholder";

// Labels for the sort modes (saved choice lives in @/storage/words-list-storage).
const SORT_LABELS: Record<SortMode, string> = {
    az: 'A–Z',
    za: 'Z–A',
    book: 'By book',
    recent: 'Recently added',
};

export default function WordsListScreen() {
    // placeholderTextColor needs a color value (not a class), so keep it themed here.
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

    const [allWords, setAllWords] = useState<WordWithBook[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [search, setSearch] = useState<string>('');

    // Selected parts of speech (canonical keys)
    const [posSelected, setPosSelected] = useState<Set<string>>(new Set());
    const [sortMode, setSortMode] = useState<SortMode>('az'); // default sort mode is A-Z

    // Restore the previously chosen sort order on launch.
    useEffect(() => {
        getSortMode().then((saved) => {
            if (saved) {
                setSortMode(saved);
            }
        });
    }, []);

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
            (posSelected.size === 0 || posSelected.has(normalizePos(w.partOfSpeech)))
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
    }, [allWords, search, posSelected, sortMode]);

    // Count how many saved words have each part of speech (noun, verb, etc.),
    // and only list the ones that actually show up — so we never show a filter
    // chip for a part of speech with zero words. Noun/verb/adjective/adverb
    // come first if present; anything else after, in alphabetical order.
    const presentPos = useMemo<{ pos: string; count: number }[]>(() => {
        const counts = new Map<string, number>();
        for (const w of allWords) {
            const key = normalizePos(w.partOfSpeech);
            if (!key) {
                continue;
            }
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return [...counts.entries()]
            .map(([pos, count]) => ({ pos, count }))
            .sort((a, b) => {
                const ai = POS_ORDER.indexOf(a.pos);
                const bi = POS_ORDER.indexOf(b.pos);
                if (ai !== -1 || bi !== -1) {
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                }
                return a.pos.localeCompare(b.pos);
            });
    }, [allWords]);

    // Select or deselect one part-of-speech filter chip. We build a brand new
    // Set rather than editing the old one, because React only re-renders when
    // it sees a new object — changing the existing Set in place wouldn't work.
    function togglePos(pos: string): void {
        setPosSelected((prev) => {
            const next = new Set(prev);
            if (next.has(pos)) {
                next.delete(pos);
            } else {
                next.add(pos);
            }
            return next;
        });
    }

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
                onPress: () => {
                    setSortMode(mode);
                    saveSortMode(mode);
                },
            })),
            { text: 'Cancel', style: 'cancel' as const },
        ]);
    }

    // Open the book this word belongs to, scrolled straight to this word's card.
    const openWord = useCallback((item: WordWithBook): void => {
        openBook({
            key: item.bookKey,
            title: item.bookTitle,
            author: item.bookAuthor,
            year: item.bookYear,
            cover_i: item.bookCover,
            focusWord: item.word,
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
            <View className="px-4 pb-2 pt-3">
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

            {/* Part-of-speech filter chips — one per POS present, colour-coded,
                multi-select (empty = All). Hidden when there's nothing to filter. */}
            {presentPos.length > 1 && (
                <View className="flex-row flex-wrap gap-2 px-4 pb-2">
                    <Pressable
                        onPress={() => setPosSelected(new Set())}
                        className={`flex-row items-center rounded-full border px-3 py-1.5 ${posSelected.size === 0 ? "border-accent bg-accent" : "border-border-input bg-input"}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: posSelected.size === 0 }}
                    >
                        <Text className={`text-xs font-semibold ${posSelected.size === 0 ? "text-white" : "text-muted"}`}>
                            All {allWords.length}
                        </Text>
                    </Pressable>
                    {presentPos.map(({ pos, count }) => {
                        const selected = posSelected.has(pos);
                        const color = posColor(pos);
                        return (
                            <Pressable
                                key={pos}
                                onPress={() => togglePos(pos)}
                                style={selected ? { backgroundColor: color, borderColor: color } : undefined}
                                className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${selected ? "" : "border-border-input bg-input"}`}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                            >
                                {!selected && (
                                    <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                )}
                                <Text className={`text-xs font-semibold ${selected ? "text-white" : "text-fg"}`}>
                                    {posLabel(pos)}
                                </Text>
                                <Text className={`text-xs ${selected ? "text-white" : "text-muted"}`}>
                                    {count}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            )}

            {/* Sort control */}
            <View className="items-end px-4 pb-2">
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
