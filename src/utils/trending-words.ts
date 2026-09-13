import { Platform } from 'react-native';

/**
 * Fetches the most-saved words from the external words feed server, to use as
 * live placeholder suggestions in the app. Reuses the same server as the
 * floating-words feed (see words-feed-api.ts) and the same base-URL convention.
 *
 * Privacy: this only READS the public, aggregate top-words list — no user data
 * is involved. It is offline-first: any failure (unset env, network error,
 * timeout, bad response) silently resolves to `[]`, and callers fall back to
 * their own hardcoded word list, so the UI is never affected.
 */
const DEFAULT_LOCAL_URL = Platform.select({
    android: 'http://10.0.2.2:4000',
    default: 'http://localhost:4000',
});

const API_BASE_URL = process.env.EXPO_PUBLIC_WORDS_FEED_API_URL ?? DEFAULT_LOCAL_URL;

const REQUEST_TIMEOUT_MS = 5000;

type WordRow = { word: string; count: number };

/**
 * Returns the top saved words (most-frequent first), or `[]` on any failure.
 * Never throws.
 */
export async function fetchTrendingWords(limit = 50): Promise<string[]> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(
                `${API_BASE_URL}/words?order=top&limit=${limit}`,
                { signal: controller.signal },
            );
            if (!res.ok) {
                return [];
            }
            const data = (await res.json()) as WordRow[];
            return Array.isArray(data) ? data.map((row) => row.word).filter(Boolean) : [];
        } finally {
            clearTimeout(timeout);
        }
    } catch {
        // Network error, abort, or bad JSON — caller keeps its fallback list.
        return [];
    }
}
