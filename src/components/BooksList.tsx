import React, { useEffect } from "react";

import { useColorScheme } from "@/context/theme-context";
import { useFlatListScroll } from "@/hooks/use-scroll-registration";

import { ACCENT, Colors } from "@/styles/global";

import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Link } from "expo-router";

import { Book } from "@/models/book";

import BookItem from "./BookItem";

const SKELETON_TITLE_WIDTHS = ['72%', '58%', '80%', '65%', '75%', '50%', '68%', '78%'] as const;
const SKELETON_AUTHOR_WIDTHS = ['45%', '38%', '52%', '42%', '48%', '35%', '44%', '50%'] as const;

function BookSkeletons({ styles }: { styles: ReturnType<typeof buildStyles> }) {
    const opacity = useSharedValue(1);
    useEffect(() => {
        opacity.value = withRepeat(withTiming(0.35, { duration: 750 }), -1, true);
    }, [opacity]);
    const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <>
            {SKELETON_TITLE_WIDTHS.map((titleW, i) => (
                <Reanimated.View key={i} style={[styles.bookRow, animStyle]}>
                    <View style={[styles.cover, styles.skeletonBox]} />
                    <View style={styles.bookInfo}>
                        <View style={[styles.skeletonBox, styles.skeletonLine, { width: titleW, height: 14 }]} />
                        <View style={[styles.skeletonBox, styles.skeletonLine, { width: SKELETON_AUTHOR_WIDTHS[i], height: 12 }]} />
                        <View style={[styles.skeletonBox, styles.skeletonLine, { width: '22%', height: 11 }]} />
                    </View>
                </Reanimated.View>
            ))}
        </>
    );
}

type BooksListProps = {
    books: Book[];
    loading?: boolean;
    searched?: boolean;
    loadingMore?: boolean;
    loadMoreError?: boolean;
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
    onLoadMore,
    onRetryLoadMore,
    header,
    listEmptyComponent,
}: BooksListProps) {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const { ref: flatListRef, onScroll, scrollEventThrottle } = useFlatListScroll();

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                style={styles.list}
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
                        <BookSkeletons styles={styles} />
                    ) : searched && books.length === 0 ? (
                        <Link href="/custom-book" style={styles.emptySubtitle}>
                            Book not found. Add it?
                        </Link>
                    ) : (
                        listEmptyComponent ?? null
                    )
                }
                ListFooterComponent={
                    loadingMore ? (
                        <ActivityIndicator style={styles.footerLoader} color={ACCENT} />
                    ) : loadMoreError ? (
                        <View style={styles.retryContainer}>
                            <Text style={styles.retryText}>Failed to load more results.</Text>
                            <Pressable style={styles.retryButton} onPress={onRetryLoadMore}>
                                <Text style={styles.retryButtonText}>Retry</Text>
                            </Pressable>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
        list: {
            flex: 1,
            backgroundColor: C.background,
            paddingHorizontal: 12,
        },
        bookRow: {
            flexDirection: 'row',
            gap: 12,
            paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: C.border,
        },
        cover: {
            width: 48,
            height: 64,
            borderRadius: 4,
        },
        bookInfo: {
            flex: 1,
            justifyContent: 'center',
            gap: 4,
        },
        skeletonBox: {
            backgroundColor: C.coverPlaceholder,
            borderRadius: 4,
        },
        skeletonLine: {
            borderRadius: 4,
        },
        empty: {
            marginTop: 24,
            textAlign: 'center',
            color: C.textMuted,
            fontSize: 15,
        },
        emptySubtitle: {
            fontSize: 14,
            color: ACCENT,
            textAlign: 'center',
            lineHeight: 21,
        },
        footerLoader: {
            paddingVertical: 16,
        },
        retryContainer: {
            paddingVertical: 16,
            alignItems: 'center',
            gap: 8,
        },
        retryText: {
            fontSize: 13,
            color: C.textMuted,
        },
        retryButton: {
            backgroundColor: ACCENT,
            borderRadius: 6,
            paddingHorizontal: 20,
            paddingVertical: 8,
        },
        retryButtonText: {
            color: '#fff',
            fontWeight: '600',
            fontSize: 14,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
