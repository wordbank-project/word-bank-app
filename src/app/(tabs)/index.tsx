import { Text, View } from "react-native";

import { useBookSearch } from "@/hooks/use-book-search";
import BooksList from "@/components/BooksList";
import SearchBar from "@/components/SearchBar";
import WordOfTheDayCard from "@/components/WordOfTheDayCard";

export default function HomeScreen() {
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
            {/* Daily surprise word — only on the pre-search home state. */}
            {!searched && <WordOfTheDayCard />}
        </View>
    );

    return (
        <View className="flex-1 bg-background">
            <BooksList
                books={books}
                loading={loading}
                searched={searched}
                loadingMore={loadingMore}
                loadMoreError={loadMoreError}
                onLoadMore={loadMore}
                onRetryLoadMore={retryLoadMore}
                header={header}
                listEmptyComponent={
                    <View className="mt-16 items-center gap-2.5 px-8">
                        <Text className="text-center text-sm leading-5 text-muted">
                            Search for a book and add a word to your <Text className="italic text-muted">word bank</Text> per book!
                            Want to add a custom book? Press the + button.
                        </Text>
                    </View>
                }
            />
        </View>
    );
}
