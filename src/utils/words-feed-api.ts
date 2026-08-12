import { FEED_API_BASE_URL, FEED_REQUEST_TIMEOUT_MS } from '@/utils/feed-api-base';

/**
 * Contributes words users add to the external "floating words" feed, which powers
 * the live floating-words background on the marketing site and currently saved words 
 * (word-bank-site). Only the word and its *public dictionary* values (definition / part of speech / IPA)
 * are ever sent — no book, language, sentence, notes, or any other user content —
 * The server host and its per-platform localhost caveats live in feed-api-base.ts.
 */

/** Public dictionary metadata sent alongside the word (none of it user-authored). */
export type FeedWordMeta = {
    definition?: string;
    partOfSpeech?: string;
    phonetic?: string;
};

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
    } catch {
        // Swallow everything (e.g. a synchronous fetch/JSON failure) — must never throw.
    }
}
