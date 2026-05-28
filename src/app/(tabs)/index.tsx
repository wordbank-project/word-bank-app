import { StyleSheet, View } from "react-native";

import { useColorScheme } from "@/context/theme-context";
import { Colors } from "@/styles/global";
import { useBookSearch } from "@/hooks/use-book-search";
import BooksList from "@/components/BooksList";
import SearchBar from "@/components/SearchBar";

export default function HomeScreen() {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;

    const {
        books,
        loading,
        loadingMore,
        searched,
        loadMoreError,
        search,
        loadMore,
        retryLoadMore,
    } = useBookSearch();

    const header = (
        <View>
            <SearchBar onSearch={search} loading={loading} />
        </View>
    );

    return (
        <View style={styles.container}>
            <BooksList
                books={books}
                loading={loading}
                searched={searched}
                loadingMore={loadingMore}
                loadMoreError={loadMoreError}
                onLoadMore={loadMore}
                onRetryLoadMore={retryLoadMore}
                header={header}
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
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
