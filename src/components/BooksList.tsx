import React from "react";
import { globalStyles } from "@/styles/global";
import { ActivityIndicator, FlatList, StyleProp, ViewStyle } from "react-native";
import { Book } from "@/models/book";
import BookItem from "./BookItem";

type BooksListProps = {
    books: Book[];
    loading?: boolean;
    header?: React.ReactElement;
    style?: StyleProp<ViewStyle>;
};

export default function BooksList({ books, loading, header, style }: BooksListProps) {
    return (
        <FlatList
            style={style}
            data={books}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => <BookItem book={item} />}
            ListHeaderComponent={header}
            ListEmptyComponent={loading ? <ActivityIndicator size="large" style={globalStyles.loadingContainer} /> : null}
        />
    );
}