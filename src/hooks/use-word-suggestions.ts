import { useEffect, useState } from 'react';

import { fetchWordSuggestions } from '@/utils/words-api';

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 6;

/**
 * Debounced as-you-type dictionary suggestions for the add-word input.
 * Aborts the in-flight request on every keystroke / language change / unmount
 * (the use-book-search AbortController idiom), and clears when the input is
 * too short or `enabled` is false. Failures are silent — suggestions resolve
 * to [] and the UI simply shows no chips.
 *
 * @param {string} input The current add-word field value.
 * @param {string} languageCode The dictionary language to search in.
 * @param {boolean} enabled Whether suggestions should be fetched at all — pass
 * `false` to force an empty result without touching `input`/`languageCode`
 * (e.g. while the field is blurred or a word is being edited).
 * @returns {string[]} Up to `MAX_SUGGESTIONS` matching words, or `[]` if disabled,
 * too short, or the request failed.
 *
 */
export function useWordSuggestions(input: string, languageCode: string, enabled: boolean): string[] {
    const [suggestions, setSuggestions] = useState<string[]>([]);

    useEffect(() => {
        const query = input.trim().toLowerCase();
        if (!enabled || query.length < MIN_CHARS) {
            setSuggestions([]);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            fetchWordSuggestions(query, languageCode, MAX_SUGGESTIONS, controller.signal).then((words) => {
                if (!controller.signal.aborted) {
                    setSuggestions(words.slice(0, MAX_SUGGESTIONS));
                }
            });
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [input, languageCode, enabled]);

    return suggestions;
}
