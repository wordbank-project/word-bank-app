import { useColorScheme } from "@/context/theme-context";
import { Book } from "@/models/book";
import { ACCENT, Colors } from "@/styles/global";
import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import BookItem from "./BookItem";

type BooksListProps = {
    books: Book[];
    loading?: boolean;
    header?: React.ReactElement;
};

export default function BooksList({ books, loading, header }: BooksListProps) {
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
            ListEmptyComponent={loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={ACCENT} />
                </View>
            ) : null}
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
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
