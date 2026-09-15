import { FEED_API_BASE_URL, FEED_REQUEST_TIMEOUT_MS } from '@/utils/api/feed-api-base';
import type { FeedWordMeta } from '@/models/feed-word-meta';

/**
 * The two operations on the external "floating words" feed resource
 * (word-bank-server's `/v1/words`, via feed-api-base.ts): contributing a word
 * (postWordToFeed) and reading back the most-saved words (fetchMostSavedWords,
 * for WordOfTheDayCard.tsx to pick from). Contributing powers the live
 * floating-words background on the marketing site and currently saved words
 * (word-bank-site). Only the word and its *public dictionary* values
 * (definition / part of speech / IPA) are ever sent — no book, language,
 * sentence, notes, or any other user content. The server host and its
 * per-platform localhost caveats live in feed-api-base.ts.
 */

/**
 * Fire-and-forget POST that contributes a single word to the external words feed,
 * with its public dictionary definition / part of speech / IPA so the marketing
 * site can show the word's meaning.
 *
 * Privacy: only the word (trimmed + lowercased) and those public dictionary values
 * are sent — no book, language, sentence, notes, or user identity.
 *
 * This is fire-and-forget: it kicks off the request and returns `void`
 * synchronously without awaiting. It can NEVER throw and any failure (network
 * error, timeout, bad response) is intentionally swallowed so contributing to
 * the feed can never affect the caller's flow (e.g. adding a word).
 * @param {string} word The dictionary word that is send to the server
 * @param {FeedWordMeta} meta The meta data
 * @return {void} nothing
 * 
 */
export function postWordToFeed(word: string, meta: FeedWordMeta = {}): void {
    try {
        if (!word?.trim()) {
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FEED_REQUEST_TIMEOUT_MS);

        fetch(`${FEED_API_BASE_URL}/words`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                word: word.trim().toLowerCase(),
                definition: meta.definition?.trim() || undefined,
                partOfSpeech: meta.partOfSpeech?.trim() || undefined,
                phonetic: meta.phonetic?.trim() || undefined,
            }),
            signal: controller.signal,
        })
            .catch(() => { })
            .finally(() => clearTimeout(timeout));
    } catch (error) {
        // Swallow everything (e.g. a synchronous fetch/JSON failure) — must never throw.
        console.error(error);
    }
}

type WordRow = { word: string; count: number };

/**
 * Returns the most-saved words (an all-time cumulative count, most-frequent
 * first — not a recency-weighted "trending" signal), or `[]` on any failure.
 *
 * Privacy: this only READS the public, aggregate top-words list — no user data
 * is involved. It is offline-first: any failure (unset env, network error,
 * timeout, bad response) silently resolves to `[]`, and callers fall back to
 * their own hardcoded word list, so the UI is never affected. Never throws.
 *
 * @param {number} [limit] How many words to return, most-saved first. Defaults to 50.
 * @returns {Promise<string[]>} The most-saved words, or `[]` on any failure.
 *
 */
export async function fetchMostSavedWords(limit = 50): Promise<string[]> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FEED_REQUEST_TIMEOUT_MS);
        try {
            const res: Response = await fetch(
                `${FEED_API_BASE_URL}/words?order=top&limit=${limit}`,
                { signal: controller.signal },
            );
            if (!res.ok) {
                return [];
            }
            const data: WordRow[] = (await res.json()) as WordRow[];
            return Array.isArray(data) ? data.map((row: WordRow) => row.word).filter(Boolean) : [];
        } finally {
            clearTimeout(timeout);
        }
    } catch (error) {
        // Network error, abort, or bad JSON — caller keeps its fallback list.
        console.error(error)
        return [];
    }
}
