import { FEED_API_BASE_URL } from '@/utils/feed-api-base';

// The server fires two live LLM completions in parallel (Promise.all, no caching, no rate
// limit) to build this response, so a cold call costs one round trip, not two — but each list
// is verbose to generate (up to 80 words / 40 books), so keep it close to ANALYZE_TIMEOUT_MS
// rather than the usual 5s.
const SUGGESTIONS_TIMEOUT_MS = 20_000;

const MAX_WORDS = 80;
const MAX_BOOKS = 40;
const MAX_SENTENCES = 3;

/** One well-known book, structured — the server sends title/author/year apart
 * so clients never have to parse them back out of a formatted string. */
export type SuggestedBook = { title: string; author: string; year: string };

export type Suggestions = { words: string[]; books: SuggestedBook[], sentences: string[] };

const EMPTY: Suggestions = { words: [], books: [], sentences: [] };

// In-memory only: resets on app restart, no TTL. Never caches an empty/failed result, so a
// transiently-down (or cold-started) server gets retried on the next screen mount instead of
// being stuck empty for the rest of the session.
const cache = new Map<string, Suggestions>();

/**
 * Cleans a plain string list (words or sentences) out of the model's reply: keeps
 * only non-empty string entries, trimmed, capped at `max`.
 *
 * @param {unknown} value The raw `words`/`sentences` field from the server response.
 * @param {number} max The maximum number of entries to keep.
 * @returns {string[]} The cleaned, trimmed strings, capped at `max`.
 *
 */
function cleanList(value: unknown, max: number): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const cleaned: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string') {
            continue;
        }
        const trimmed = item.trim();
        if (trimmed) {
            cleaned.push(trimmed);
        }
        if (cleaned.length >= max) {
            break;
        }
    }
    return cleaned;
}

/**
 * Re-validates the server's structured book list client-side (never trust the
 * network) — the same "rebuild from known fields" convention `analyze-api.ts`'s
 * `parseAnalysis` follows. Drops any entry that isn't a well-shaped
 * `{ title, author, year }`, rather than including it half-filled.
 *
 * @param {unknown} value The raw `books` field from the server response.
 * @returns {SuggestedBook[]} The cleaned suggestions, capped at `MAX_BOOKS`.
 *
 */
function cleanBookList(value: unknown): SuggestedBook[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const cleaned: SuggestedBook[] = [];
    for (const item of value) {
        if (typeof item !== 'object' || item === null) {
            continue;
        }
        const { title, author, year } = item as Record<string, unknown>;
        if (typeof title !== 'string' || typeof author !== 'string') {
            continue;
        }
        const trimmedTitle = title.trim();
        const trimmedAuthor = author.trim();
        // The model sometimes gives the year as a number rather than a string.
        const trimmedYear = String(year ?? '').trim();
        if (!trimmedTitle || !trimmedAuthor || !trimmedYear) {
            continue;
        }
        cleaned.push({ title: trimmedTitle, author: trimmedAuthor, year: trimmedYear });
        if (cleaned.length >= MAX_BOOKS) {
            break;
        }
    }
    return cleaned;
}

/**
 * Rebuilds a `Suggestions` object from the server's raw JSON response, re-validating
 * every field client-side rather than trusting the network.
 *
 * @param {unknown} data The raw parsed JSON response body.
 * @returns {Suggestions} The cleaned `words`/`books`/`sentences` lists, each `[]` if
 * `data` isn't a well-shaped object.
 *
 */
function parseSuggestions(data: unknown): Suggestions {
    if (typeof data !== 'object' || data === null) {
        return EMPTY;
    }
    const record = data as Record<string, unknown>;
    return {
        words: cleanList(record.words, MAX_WORDS),
        books: cleanBookList(record.books),
        sentences: cleanList(record.sentences, MAX_SENTENCES),
    };
}

/**
 * AI-generated evocative vocabulary words and well-known books (structured as
 * `{ title, author, year }`, not a formatted string) for a language, via the server's
 * `GET /v1/suggestions` (see feed-api-base.ts). Resolves to `{ words: [], books: [], sentences: [] }`
 * on any failure — unset env, no server, no GROQ_API_KEY configured server-side, timeout, or a
 * bad response — and never throws. A `429` (this app's own limit, or Groq's upstream one, see
 * word-bank-server's llm-rate-limit-error middleware) is logged via `console.warn` — there's no
 * error UI to route it to here (unlike analyze-api.ts's `'rate-limited'` sentinel), but it's a
 * real signal worth seeing rather than routine offline/no-server noise, which stays silent.
 * Successful non-empty results are cached in memory per `lang` for the app session.
 * @param {string} lang chosen language
 * @returns {Promise<Suggestions>} Returns a promise which gives back the suggestions object
 * 
 */
export async function fetchSuggestions(lang = 'en'): Promise<Suggestions> {
    const cached = cache.get(lang);
    if (cached) {
        return cached;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SUGGESTIONS_TIMEOUT_MS);
        try {
            const res = await fetch(`${FEED_API_BASE_URL}/suggestions?lang=${encodeURIComponent(lang)}`, {
                signal: controller.signal,
            });
            if (res.status === 429) {
                console.warn(`[suggestions-api] rate limited (429) for lang="${lang}" — using the static fallback list`);
                return EMPTY;
            }
            if (!res.ok) {
                return EMPTY;
            }
            const data = (await res.json()) as unknown;
            const parsed = parseSuggestions(data);
            if (parsed.words.length > 0 || parsed.books.length > 0 || parsed.sentences.length > 0) {
                cache.set(lang, parsed);
            }
            return parsed;
        } finally {
            clearTimeout(timeout);
        }
    } catch {
        return EMPTY;
    }
}
