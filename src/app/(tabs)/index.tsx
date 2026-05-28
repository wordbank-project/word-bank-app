import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useColorScheme } from "@/context/theme-context";
import { type Book } from "@/models/book";
import { Colors } from "@/styles/global";
import BooksList from "@/components/BooksList";
import SearchBar from "@/components/SearchBar";

export default function HomeScreen() {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;

    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    const header = (
        <View>
            <SearchBar onResults={setBooks} onLoadingChange={setLoading} />
        </View>
    );

    return (
        <View style={styles.container}>
            <BooksList books={books} loading={loading} header={header} />
        </View>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: C.background,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
