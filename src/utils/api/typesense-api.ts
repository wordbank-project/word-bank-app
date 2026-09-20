import { isAbortError } from '@/utils/is-abort-error';

// Typesense-backed as-you-type word suggestions (https://typesense.org) — the
// typo-tolerant search engine behind the add-word suggestion chips on book.tsx,
// when configured. See docs/typesense.md for the full rationale, the collection
// schema, and how to seed one.
//
// Why raw fetch instead of the official `typesense` npm client: that client
// ships axios as its transport, and this app uses plain fetch in every other API
// client (words-api.ts, translate-api.ts, analyze-api.ts, suggestions-api.ts,
// words-feed-api.ts) with no HTTP library anywhere. Search is a single GET with
// one header — not worth a dependency, its bundle weight, or the risk of an
// axios adapter misbehaving on Hermes.
//
// Opt-in: both env vars must be set, otherwise isTypesenseConfigured() is false
// and fetchWordSuggestions keeps using its Datamuse/wiktapi.dev path unchanged.
// There's deliberately no default host — unlike wiktapi.dev there's no public
// shared instance to fall back to, so "unset" can only mean "feature off".
//
// The search key is embedded in the app bundle on purpose: it must be a
// SEARCH-ONLY scoped key, which Typesense designs for exactly this (the same
// trust model Algolia/InstantSearch use, and no different from this app already
// calling OpenLibrary/Datamuse directly). Never ship an admin key — that one
// belongs only in scripts/seed-typesense-words.mjs, run locally.

const TYPESENSE_HOST = process.env.EXPO_PUBLIC_TYPESENSE_HOST;
const TYPESENSE_SEARCH_KEY = process.env.EXPO_PUBLIC_TYPESENSE_SEARCH_KEY;

/** Matches the collection-per-language naming that seed-typesense-words.mjs creates. */
const collectionName = (language: string) => `words_${language}`;

// Same budget as the Datamuse/wiktapi suggestion path in words-api.ts — this
// races the user's next keystroke, so it has to give up fast.
const SEARCH_TIMEOUT_MS = 3000;

// Typesense's typo budget: 2 covers the realistic misspellings this is here to
// fix ("ambigous" -> "ambiguous") without drifting into unrelated words.
const NUM_TYPOS = 2;

// The subset of Typesense's /documents/search response this relies on.
type TypesenseSearchResponse = {
    hits?: { document?: { word?: string } }[];
};

/**
 * Whether a Typesense instance is configured for this build.
 *
 * @returns {boolean} `true` when both the host and the search-only key are set.
 *
 */
export function isTypesenseConfigured(): boolean {
    return Boolean(TYPESENSE_HOST && TYPESENSE_SEARCH_KEY);
}

/**
 * Prefix-searches a language's word collection for as-you-type suggestions,
 * with Typesense's built-in typo tolerance doing the correcting. Resolves to
 * `[]` on ANY failure — not configured, timeout, network, non-200, bad JSON —
 * and never throws, so the caller can simply fall back.
 *
 * @param {string} prefix The characters typed so far.
 * @param {string} language The dictionary language code, naming the collection (`words_<language>`).
 * @param {number} [limit] The maximum number of suggestions to return. Defaults to `8`.
 * @param {AbortSignal} [signal] Lets the caller cancel a superseded request while the user keeps typing.
 * @returns {Promise<string[]>} The matching words (deduped, lowercased), or `[]` on any failure.
 *
 */
export async function fetchTypesenseWordSuggestions(
    prefix: string,
    language: string,
    limit = 8,
    signal?: AbortSignal,
): Promise<string[]> {
    if (!isTypesenseConfigured()) {
        return [];
    }

    // Own timeout + external signal, same idiom as fetchWordSuggestions
    // (AbortSignal.any isn't reliably available on Hermes).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener('abort', onOuterAbort);
    try {
        const query = new URLSearchParams({
            q: prefix,
            query_by: 'word',
            prefix: 'true',
            num_typos: String(NUM_TYPOS),
            per_page: String(limit),
            // Closest match first, then the more common word. Without the rank
            // tiebreak a big index buries the word you actually meant: measured
            // on a 235k-word list, "ephem" didn't surface "ephemeral" in the top
            // 6 and "recieve" put "reliever" above "receive". `rank` is the
            // word's position in a frequency-ordered list — see
            // scripts/seed-typesense-words.mjs and docs/typesense.md.
            sort_by: '_text_match:desc,rank:asc',
        });
        const url = `${TYPESENSE_HOST}/collections/${collectionName(language)}/documents/search?${query}`;

        const res = await fetch(url, {
            headers: { 'X-TYPESENSE-API-KEY': TYPESENSE_SEARCH_KEY as string },
            signal: controller.signal,
        });
        if (!res.ok) {
            return [];
        }

        const data: TypesenseSearchResponse = await res.json();
        const seen = new Set<string>();
        const words: string[] = [];
        for (const hit of data.hits ?? []) {
            const word = hit.document?.word?.trim().toLowerCase(); // the app stores words lowercased
            if (word && !seen.has(word)) {
                seen.add(word);
                words.push(word);
            }
        }
        return words;
    } catch (error) {
        if (!isAbortError(error)) {
            console.error(error);
        }
        return []; // includes AbortError — callers check their own signal before applying
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onOuterAbort);
    }
}
