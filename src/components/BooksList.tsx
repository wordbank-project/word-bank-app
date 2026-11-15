import React from "react";

import { useFlatListScroll } from "@/hooks/use-scroll-registration";

import { ACCENT } from "@/styles/global";

import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import Reanimated from "react-native-reanimated";

import { usePulse } from "@/hooks/use-pulse";

import { Link } from "expo-router";

import { Book } from "@/models/book";

import BookItem from "./BookItem";

const SKELETON_TITLE_WIDTHS = ['72%', '58%', '80%', '65%', '75%', '50%', '68%', '78%'] as const;
const SKELETON_AUTHOR_WIDTHS = ['45%', '38%', '52%', '42%', '48%', '35%', '44%', '50%'] as const;

function BookSkeletons() {
    const animStyle = usePulse();

    return (
        <React.Fragment>
            {SKELETON_TITLE_WIDTHS.map((titleW, i) => (
                // Reanimated view carries only the pulsing opacity; layout/colors are classes.
                <Reanimated.View key={i} style={animStyle}>
                    <View className="flex-row gap-3 border-b border-border py-2.5">
                        <View className="h-16 w-12 rounded bg-cover-placeholder" />
                        <View className="flex-1 justify-center gap-1">
                            <View className="rounded bg-cover-placeholder" style={{ width: titleW, height: 14 }} />
                            <View className="rounded bg-cover-placeholder" style={{ width: SKELETON_AUTHOR_WIDTHS[i], height: 12 }} />
                            <View className="rounded bg-cover-placeholder" style={{ width: '22%', height: 11 }} />
                        </View>
                    </View>
                </Reanimated.View>
            ))}
        </React.Fragment>
    );
}

type BooksListProps = {
    books: Book[];
    loading?: boolean;
    searched?: boolean;
    loadingMore?: boolean;
    loadMoreError?: boolean;
    query?: string;
    onLoadMore?: () => void;
    onRetryLoadMore?: () => void;
    header?: React.ReactElement;
    /** Shown when the list is empty and not loading (e.g. an initial "search for a book" prompt). */
    listEmptyComponent?: React.ReactElement;
};

export default function BooksList({
    books,
    loading,
    searched,
    loadingMore,
    loadMoreError,
    query,
    onLoadMore,
    onRetryLoadMore,
    header,
    listEmptyComponent,
}: BooksListProps) {
    const { ref: flatListRef, onScroll, scrollEventThrottle } = useFlatListScroll();

    return (
        <View className="flex-1">
            <FlatList
                ref={flatListRef}
                className="flex-1 bg-background px-3"
                keyboardShouldPersistTaps="handled"
                data={books}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => <BookItem book={item} />}
                ListHeaderComponent={header}
                onEndReached={onLoadMore}
                onEndReachedThreshold={0.4}
                scrollEventThrottle={scrollEventThrottle}
                onScroll={onScroll}
                ListEmptyComponent={
                    loading ? (
                        <BookSkeletons />
                    ) : searched && books.length === 0 ? (
                        // If a search has been performed and no books were found, send the query as a param to the custom-book screen.
                        <Link href={{ pathname: '/custom-book', params: { title: query } }} className="text-center text-sm text-accent">
                            Book not found. Add it?
                        </Link>
                    ) : (
                        listEmptyComponent ?? null
                    )
                }
                ListFooterComponent={
                    loadingMore ? (
                        <ActivityIndicator className="py-4" color={ACCENT} />
                    ) : loadMoreError ? (
                        <View className="items-center gap-2 py-4">
                            <Text className="text-[13px] text-muted">Failed to load more results.</Text>
                            <Pressable className="rounded-md bg-accent px-5 py-2" onPress={onRetryLoadMore}>
                                <Text className="text-sm font-semibold text-white">Retry</Text>
                            </Pressable>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}
