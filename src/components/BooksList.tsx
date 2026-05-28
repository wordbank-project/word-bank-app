import { useColorScheme } from "@/context/theme-context";
import { Book } from "@/models/book";
import { ACCENT, Colors } from "@/styles/global";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import BookItem from "./BookItem";

const SCROLL_THRESHOLD = 300;

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

    // Scroll-to-top button logic
    const flatListRef = useRef<FlatList | null>(null);
    const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
    const opacity = useRef<Animated.Value>(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: showScrollTop ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [showScrollTop]);

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
                scrollEventThrottle={16}
                onScroll={(e) => {
                    setShowScrollTop(e.nativeEvent.contentOffset.y > SCROLL_THRESHOLD);
                }}
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

            <Animated.View
                style={[styles.scrollTopButton, { opacity }]}
                pointerEvents={showScrollTop ? 'auto' : 'none'}
            >
                <Pressable
                    style={styles.scrollTopPressable}
                    onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                >
                    <Text style={styles.scrollTopIcon}>↑</Text>
                </Pressable>
            </Animated.View>
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
        scrollTopButton: {
            position: 'absolute',
            bottom: 24,
            right: 16,
        },
        scrollTopPressable: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: ACCENT,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
        },
        scrollTopIcon: {
            color: '#fff',
            fontSize: 20,
            fontWeight: '700',
            lineHeight: 24,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
