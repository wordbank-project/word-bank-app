import { useEffect, useState } from "react";

import { FALLBACK_SEARCH_TITLES, FALLBACK_WORDS } from "@/models/suggestions";
import { getLanguageCode } from "@/storage/language-storage";
import { fetchSuggestions } from "@/utils/suggestions-api";
import { fetchTrendingWords } from "@/utils/trending-words";

// Suggestion lists for the typewriter placeholders, upgraded from the network
// when available. Fallback chain (offline-first — every rung silently resolves
// to empty on failure, so the lists are never empty):
//   words:  AI suggestions (per dictionary language) → trending feed → built-in
//   titles: AI suggestions (per dictionary language) → built-in

export function useSuggestedWords(): string[] {
    const [words, setWords] = useState<string[]>(FALLBACK_WORDS);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const lang = (await getLanguageCode()) ?? "en";
            const ai = await fetchSuggestions(lang);
            if (cancelled) return;
            if (ai.words.length > 0) {
                setWords(ai.words);
                return;
            }
            const trending = await fetchTrendingWords();
            if (!cancelled && trending.length > 0) {
                setWords(trending);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return words;
}

export function useSuggestedTitles(): string[] {
    const [titles, setTitles] = useState<string[]>(FALLBACK_SEARCH_TITLES);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const lang = (await getLanguageCode()) ?? "en";
            const ai = await fetchSuggestions(lang);
            if (!cancelled && ai.titles.length > 0) {
                setTitles(ai.titles);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return titles;
}
