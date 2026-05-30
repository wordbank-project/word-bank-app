import { useCallback, useState } from "react";

import { useColorScheme } from "@/context/theme-context";
import { useFlatListScroll } from "@/hooks/use-scroll-registration";

import type { SavedBook } from "@/models/saved-book";

import { ACCENT, Colors } from "@/styles/global";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";

import { Link, router, useFocusEffect } from 'expo-router';

import SavedBookItem from "@/components/SavedBookItem";
import { getSavedBooks, removeBook } from "@/storage/books-storage";
import { removeWords } from '@/storage/words-storage';

export default function SavedBooksScreen() {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;

    const [books, setBooks] = useState<SavedBook[]>([]);
    const [booksLoading, setBooksLoading] = useState<boolean>(true);
    const { ref: flatListRef, onScroll, scrollEventThrottle } = useFlatListScroll<SavedBook>();

    useFocusEffect(
        useCallback(() => {
            getSavedBooks().then((books) => {
                setBooks(books);
                setBooksLoading(false);
            });
        }, [])
    );

    function handleRemove(bookKey: string): void {
        const book = books.find(b => b.key === bookKey);
        Alert.alert(
            'Remove book',
            `Remove "${book?.title ?? 'this book'}" and all its words?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = await removeBook(bookKey);
                        await removeWords(bookKey);
                        setBooks(updated);
                    },
                },
            ]
        );
    }

    return (
        <View style={styles.container}>

            {booksLoading ? (
                <ActivityIndicator style={styles.loader} color={ACCENT} />
            ) : null}

            <FlatList
                ref={flatListRef}
                data={books}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.list}
                scrollEventThrottle={scrollEventThrottle}
                onScroll={onScroll}
                ListEmptyComponent={
                    booksLoading ? null : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>No books yet</Text>
                            <Link href="/" style={styles.emptySubtitle}>
                                Search for a book on the Home tab, open it, and add words to start building your word bank.
                            </Link>
                        </View>
                    )
                }
                renderItem={({ item }) => (
                    <SavedBookItem
                        item={item}
                        onPress={() =>
                            router.push({
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                pathname: '/book' as any,
                                params: {
                                    key: item.key,
                                    title: item.title,
                                    author: item.author,
                                    year: item.year,
                                    cover_i: item.cover_i,
                                },
                            })
                        }
                        onRemove={() => handleRemove(item.key)}
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
        emptySubtitle: {
            fontSize: 14,
            color: ACCENT,
            textAlign: 'center',
            lineHeight: 21,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
