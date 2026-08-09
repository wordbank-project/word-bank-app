import { useState } from "react";

import { useIsFocused } from "@react-navigation/native";

import { useColorScheme } from "@/context/theme-context";

import { useSavedLanguage } from "@/hooks/use-saved-language";
import { useTypewriterPlaceholder } from "@/hooks/use-typewriter-placeholder";

import { Colors } from "@/styles/global";

import { fetchSuggestions } from "@/utils/suggestions-api";

import { Keyboard, View } from "react-native";

import ClearableTextInput from "@/components/ClearableTextInput";
import SearchButton from "@/components/SearchButton";

const RANDOM_TITLES = [
    "The Great Gatsby",
    "To Kill a Mockingbird",
    "1984",
    "Pride and Prejudice",
    "The Catcher in the Rye",
    "Brave New World",
    "The Hobbit",
    "Crime and Punishment",
    "Jane Eyre",
    "Don Quixote",
    "Anna Karenina",
    "Moby Dick",
    "War and Peace",
    "The Odyssey",
    "Hamlet",
];

type SearchBarProps = {
    onSearch: (query: string) => void;
    loading: boolean;
};

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
    // placeholderTextColor needs a color value (not a class), so keep it themed here.
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

    const [query, setQuery] = useState<string>("");

    // Restores the saved dictionary language from AsyncStorage on mount.
    const { language, languageReady } = useSavedLanguage();

    // Live AI-generated book-title suggestions replace the static list once available.
    const [suggestionTitles, setSuggestionTitles] = useState<string[]>(RANDOM_TITLES);
    useEffect(() => {
        if (!languageReady) {
            return;
        }
        fetchSuggestions(language.code).then(({ titles }) => {
            if (titles.length > 0) {
                setSuggestionTitles(titles);
            }
        });
    }, [languageReady, language.code]);

    // Types out one example title while the field is empty and the tab is focused.
    // `word` is the full suggestion, accepted on Enter when the field is empty.
    const isFocused = useIsFocused();
    const { text: typedPlaceholder, word } = useTypewriterPlaceholder(RANDOM_TITLES, isFocused && !query);

    function handleSearch(): void {
        Keyboard.dismiss();
        // if placeholder is shown use that as the search query instead of showing empty results for empty query
        const searchedWord = query.trim() || word;
        if (!searchedWord) {
            return;
        }
        setQuery(searchedWord);
        onSearch(searchedWord);
    }

    return (
        <View className="py-3">
            <ClearableTextInput
                placeholder={typedPlaceholder || "Search a book, author..."}
                containerClassName="mb-2"
                className="rounded-lg border border-border-input bg-input px-3 py-3 text-base text-fg"
                placeholderTextColor={placeholderColor}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
            />
            <SearchButton onPress={handleSearch} loading={loading} suggestion={word} style={{ marginBottom: 16 }} />
        </View>
    );
}
