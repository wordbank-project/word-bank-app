import { useState } from "react";

import { useIsFocused } from "@react-navigation/native";

import { useColorScheme } from "@/context/theme-context";

import { useSuggestedTitles } from "@/hooks/use-suggestions";
import { useTypewriterPlaceholder } from "@/hooks/use-typewriter-placeholder";

import { Colors } from "@/styles/global";

import { Keyboard, View } from "react-native";

import ClearableTextInput from "@/components/ClearableTextInput";
import SearchButton from "@/components/SearchButton";

type SearchBarProps = {
    onSearch: (query: string) => void;
    loading: boolean;
};

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
    // placeholderTextColor needs a color value (not a class), so keep it themed here.
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

    const [query, setQuery] = useState<string>("");

    // Types out one example title while the field is empty and the tab is focused.
    // `word` is the full suggestion, accepted on Enter when the field is empty.
    // Titles come from the AI suggestions endpoint when reachable (per the
    // dictionary language), with the built-in list as offline fallback.
    const suggestedTitles = useSuggestedTitles();
    const isFocused = useIsFocused();
    const { text: typedPlaceholder, word } = useTypewriterPlaceholder(suggestedTitles, isFocused && !query);

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
            <SearchButton onPress={handleSearch} loading={loading} style={{ marginBottom: 16 }} />
        </View>
    );
}
