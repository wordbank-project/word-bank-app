import { useCallback, useState, useEffect } from "react";

import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { useFocusEffect, usePathname } from "expo-router";

import { useFlatListScroll } from "@/hooks/use-scroll-registration";

import type { ReadListBook, ReadListFilter, ReadStatus } from "@/models/read-list-book";
import { READ_LIST_FILTERS, READ_STATUS_FILTER_LABELS, READ_STATUS_LABELS, READ_STATUS_ORDER } from "@/models/read-list-book";

import { getReadList, getReadListFilter, removeReadListBook, setReadBookStatus, setReadListFilter } from "@/storage/read-list-storage";
import { getWordCounts } from "@/storage/words-storage";
import { consumePendingReadFilter } from "@/utils/pending-read-filter";
import { showActionSheet } from "@/utils/show-action-sheet";

import { ACCENT } from "@/styles/global";

import { openBook } from "@/utils/open-book";
import { openAddBookMenu } from "@/utils/open-add-book-menu";

import ReadListItem from "@/components/ReadListItem";

// The filter buttons shown at the top: "All" plus one per reading status.
const FILTERS: { value: ReadListFilter; label: string }[] = READ_LIST_FILTERS.map((value) => ({
    value,
    label: READ_STATUS_FILTER_LABELS[value],
}));

export default function ReadListScreen() {
    const [readList, setReadList] = useState<ReadListBook[]>([]); // all saved books
    const [readListLoading, setReadListLoading] = useState<boolean>(true); // true until the first load finishes
    const [filter, setFilter] = useState<ReadListFilter>('all'); // Initial value is: "All"
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

    const pathname = usePathname();

    // Restore the previously chosen filter of the read list on launch. Sets
    // state directly (not selectFilter) — no need to write back the value we
    // just read.
    useEffect(() => {
        getReadListFilter().then((filter) => {
            if (filter) {
                setFilter(filter);
            }
        });
    }, []);

    /**
     * Updates the shown filter and persists it so it's restored next launch.
     *
     * @param {ReadListFilter} next The filter to switch to.
     * @returns {void} Returns nothing.
     *
     */
    function selectFilter(next: ReadListFilter): void {
        setFilter(next);
        setReadListFilter(next);
    }

    // Reload the books every time the tab comes into focus, so changes made
    // elsewhere (e.g. adding a book or words) show up here.
    useFocusEffect(
        useCallback(() => {
            // If a status was just chosen on the book screen, switch to its filter
            // (covers back-button returns, not only the "Update read list" button).
            const pending = consumePendingReadFilter();
            if (pending) {
                selectFilter(pending);
            }

            getReadList().then((books) => {
                // Show the list immediately; word counts are secondary, so fill them in after.
                setReadList(books);
                setReadListLoading(false);

                // Get word counts for all books in one go, then update. Keeps the list responsive as it grows.
                getWordCounts(books.map((book) => book.key)).then(setWordCounts);
            });
        }, [])
    );

    /**
     * Opens a menu to pick a new reading status for a book, saves the choice,
     * and switches the shown filter to match it.
     *
     * @param {ReadListBook} item The book whose status is being changed.
     * @returns {void} Returns nothing.
     *
     */
    function handleChangeStatus(item: ReadListBook): void {
        showActionSheet(
            'Reading status:',
            item.title,
            [
                ...READ_STATUS_ORDER.map((status) => ({
                    text: `${item.status === status ? '✓ ' : ''}${READ_STATUS_LABELS[status]}`,
                    onPress: async () => {
                        const updated = await setReadBookStatus(item.key, status);
                        setReadList(updated);
                        selectFilter(status);
                    },
                })),
                { text: 'Cancel', style: 'cancel' as const },
            ]
        );
    }

    /**
     * Asks for confirmation, then removes the book from the read list.
     *
     * @param {ReadListBook} item The book to remove.
     * @returns {void} Returns nothing.
     *
     */
    function handleRemove(item: ReadListBook): void {
        showActionSheet(
            'Remove from read list?',
            `Remove "${item.title}"?`,
            [
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = await removeReadListBook(item.key);
                        setReadList(updated);
                    },
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    }

    // While the first load is happening, show a spinner instead of an empty screen.
    if (readListLoading) {
        return (
            <View className="flex-1 bg-background">
                <ActivityIndicator className="mt-12" color={ACCENT} />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            {/* Row of filter pills: tap one to show only books with that status. */}
            <View className="flex-row gap-2 px-4 pb-2 pt-3">
                {FILTERS.map(({ value, label }) => {
                    const selected = filter === value;
                    return (
                        <Pressable
                            key={value}
                            onPress={() => selectFilter(value)}
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
                contentContainerClassName="px-4 pb-8"
                scrollEventThrottle={scrollEventThrottle}
                onScroll={onScroll}
                // Shown when there's nothing to display: either no books at all,
                // or none matching the current filter.
                ListEmptyComponent={
                    readList.length === 0 ? (
                        <View className="mt-16 items-center gap-2.5 px-8">
                            <Text className="text-lg font-semibold text-fg">No books yet</Text>
                            <Pressable onPress={() => openAddBookMenu(pathname)}>
                                <Text className="text-center text-sm text-accent">
                                    Search for a book, or add one yourself, to get started.
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View className="mt-16 items-center gap-2.5 px-8">
                            <Text className="text-lg font-semibold text-fg">
                                {filter === 'all' ? 'No books yet' : `Nothing under "${READ_STATUS_LABELS[filter as ReadStatus]}"`}
                            </Text>
                            <Text className="text-center text-sm text-muted">
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
