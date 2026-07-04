import { Platform } from 'react-native';

/**
 * Fetches AI-generated placeholder suggestions (vocabulary words + book
 * titles, per language) from the words feed server's /suggestions endpoint.
 * Reuses the same server and base-URL convention as words-feed-api.ts /
 * trending-words.ts.
 *
 * Privacy: only the dictionary language code is sent — no user data.
 * Offline-first: any failure (unset env, network error, timeout, bad
 * response, server without an API key) resolves to empty arrays, and callers
 * fall back to trending words / the built-in lists. Never throws.
 */
const DEFAULT_LOCAL_URL = Platform.select({
    android: 'http://10.0.2.2:4000',
    default: 'http://localhost:4000',
});

const API_BASE_URL = process.env.EXPO_PUBLIC_WORDS_FEED_API_URL ?? DEFAULT_LOCAL_URL;

const REQUEST_TIMEOUT_MS = 5000;

export type SuggestionPair = { words: string[]; titles: string[] };

const EMPTY: SuggestionPair = { words: [], titles: [] };

function stringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
}

export async function fetchSuggestions(lang: string): Promise<SuggestionPair> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(
                `${API_BASE_URL}/suggestions?lang=${encodeURIComponent(lang)}`,
                { signal: controller.signal },
            );
            if (!res.ok) {
                return EMPTY;
            }
            const data = (await res.json()) as Partial<SuggestionPair> | null;
            return { words: stringArray(data?.words), titles: stringArray(data?.titles) };
        } finally {
            clearTimeout(timeout);
        }
    } catch {
        // Network error, abort, or bad JSON — caller keeps its fallback list.
        return EMPTY;
    }
}
