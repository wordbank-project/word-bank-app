import { useCallback, useState } from "react";

import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Link, useFocusEffect } from "expo-router";

import { useThemedStyles } from "@/hooks/use-themed-styles";
import { useFlatListScroll } from "@/hooks/use-scroll-registration";

import type { ReadListBook, ReadStatus } from "@/models/read-list-book";
import { READ_STATUS_LABELS, READ_STATUS_ORDER } from "@/models/read-list-book";

import { getReadList, removeReadListBook, setReadBookStatus } from "@/storage/read-list-storage";
import { getWordCounts } from "@/storage/words-storage";
import { showActionSheet } from "@/utils/show-action-sheet";

import { ACCENT, Colors } from "@/styles/global";

import { openBook } from "@/utils/open-book";

import ReadListItem from "@/components/ReadListItem";

// What the filter pills can be: a real reading status, or "all" to show everything.
type StatusFilter = ReadStatus | 'all';

// The filter buttons shown at the top: "All" plus one per reading status.
const FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...READ_STATUS_ORDER.map((status) => ({ value: status, label: READ_STATUS_LABELS[status] })),
];

export default function ReadListScreen() {
    const styles = useThemedStyles(lightStyles, darkStyles);

    const [readList, setReadList] = useState<ReadListBook[]>([]); // all saved books
    const [readListLoading, setReadListLoading] = useState<boolean>(true); // true until the first load finishes
    const [filter, setFilter] = useState<StatusFilter>('all'); // Initial value is: "All"
    const [wordCounts, setWordCounts] = useState<Record<string, number>>({}); // how many words each book has, by key

    // Connects this list to the scroll-to-top button shared across tabs.
    const { ref: flatListRef, onScroll, scrollEventThrottle } = useFlatListScroll<ReadListBook>();

    // The books actually shown: apply the status filter, then order by word count
    // (most words first). Copy before sorting so we don't mutate the readList state
    // array; the sort is stable, so books with the same count keep their existing
    // (newest-added) order.
    const filteredList = (filter === 'all'
        ? readList
        : readList.filter((book) => book.status === filter)
    )
        .slice()
        .sort((a, b) => (wordCounts[b.key] ?? 0) - (wordCounts[a.key] ?? 0));

    // Reload the books every time the tab comes into focus, so changes made
    // elsewhere (e.g. adding a book or words) show up here.
    useFocusEffect(
        useCallback(() => {
            getReadList().then((books) => {
                // Show the list immediately; word counts are secondary, so fill them in after.
                setReadList(books);
                setReadListLoading(false);

                // Get word counts for all books in one go, then update. Keeps the list responsive as it grows.
                getWordCounts(books.map((book) => book.key)).then(setWordCounts);
            });
        }, [])
    );

    // Tapping a book's status opens a menu to pick a new reading status, then saves it.
    function handleChangeStatus(item: ReadListBook): void {
        showActionSheet(
            'Reading status',
            item.title,
            [
                ...READ_STATUS_ORDER.map((status) => ({
                    text: `${item.status === status ? '✓ ' : ''}${READ_STATUS_LABELS[status]}`,
                    onPress: async () => {
                        const updated = await setReadBookStatus(item.key, status);
                        setReadList(updated);
                    },
                })),
                { text: 'Cancel', style: 'cancel' as const },
            ]
        );
    }

    // Asks for confirmation, then removes the book from the read list.
    function handleRemove(item: ReadListBook): void {
        showActionSheet(
            'Remove from read list',
            `Remove "${item.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = await removeReadListBook(item.key);
                        setReadList(updated);
                    },
                },
            ]
        );
    }

    // While the first load is happening, show a spinner instead of an empty screen.
    if (readListLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator style={styles.loader} color={ACCENT} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Row of filter pills: tap one to show only books with that status. */}
            <View style={styles.filterRow}>
                {FILTERS.map(({ value, label }) => {
                    const selected = filter === value;
                    return (
                        <Pressable
                            key={value}
                            onPress={() => setFilter(value)}
                            style={[styles.filterPill, selected && styles.filterPillSelected]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                        >
                            <Text
                                style={[styles.filterText, selected && styles.filterTextSelected]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.7}
                            >
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* The scrollable list of books. */}
            <FlatList
                ref={flatListRef}
                data={filteredList}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.list}
                scrollEventThrottle={scrollEventThrottle}
                onScroll={onScroll}
                // Shown when there's nothing to display: either no books at all,
                // or none matching the current filter.
                ListEmptyComponent={
                    readList.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>No books yet</Text>
                            <Link href="/" style={styles.emptyLink}>
                                Search for a book on the Search tab, open it, and save it to your read list.
                            </Link>
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>
                                {filter === 'all' ? 'No books yet' : `Nothing under "${READ_STATUS_LABELS[filter as ReadStatus]}"`}
                            </Text>
                            <Text style={styles.emptyHint}>
                                Tap a book&apos;s status badge to move it here.
                            </Text>
                        </View>
                    )
                }
                // One card per book, wired up to open / remove / change status.
                renderItem={({ item }) => (
                    <ReadListItem
                        item={item}
                        wordCount={wordCounts[item.key] ?? 0}
                        onPress={() => openBook(item)}
                        onRemove={() => handleRemove(item)}
                        onChangeStatus={() => handleChangeStatus(item)}
                    />
                )}
            />
        </View>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: C.background,
        },
        filterRow: {
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
        },
        filterPill: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 7,
            paddingHorizontal: 4,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: C.borderInput,
            backgroundColor: C.backgroundInput,
        },
        filterPillSelected: {
            borderColor: ACCENT,
            backgroundColor: ACCENT,
        },
        filterText: {
            fontSize: 12,
            fontWeight: '600',
            color: C.textMuted,
        },
        filterTextSelected: {
            color: '#fff',
        },
        list: {
            paddingHorizontal: 16,
            paddingBottom: 32,
        },
        loader: {
            marginTop: 48,
        },
        emptyContainer: {
            marginTop: 64,
            alignItems: 'center',
            paddingHorizontal: 32,
            gap: 10,
        },
        emptyTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: C.text,
        },
        emptyLink: {
            fontSize: 14,
            color: ACCENT,
            textAlign: 'center',
            lineHeight: 21,
        },
        emptyHint: {
            fontSize: 14,
            color: C.textMuted,
            textAlign: 'center',
            lineHeight: 21,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
