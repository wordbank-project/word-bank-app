import { useColorScheme } from "@/context/theme-context";
import { Book } from "@/models/book";
import { ACCENT, Colors } from "@/styles/global";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import BookItem from "./BookItem";

type BooksListProps = {
    books: Book[];
    loading?: boolean;
    searched?: boolean;
    loadingMore?: boolean;
    loadMoreError?: boolean;
    onLoadMore?: () => void;
    onRetryLoadMore?: () => void;
    header?: React.ReactElement;
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
}: BooksListProps) {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;

    return (
        <FlatList
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            data={books}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => <BookItem book={item} />}
            ListHeaderComponent={header}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
                loading ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={ACCENT} />
                    </View>
                ) : searched && books.length === 0 ? (
                    <Text style={styles.empty}>No books found.</Text>
                ) : null
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
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        list: {
            flex: 1,
            backgroundColor: C.background,
            paddingHorizontal: 12,
        },
        loaderContainer: {
            marginTop: 48,
            alignItems: 'center',
        },
        empty: {
            marginTop: 24,
            textAlign: 'center',
            color: C.textMuted,
            fontSize: 15,
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
