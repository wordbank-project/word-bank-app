import type { WordDefinition, WordEntry } from '@/models/word-entry';
import { timedFetch } from '@/utils/dict-utils';
import { isAbortError } from '@/utils/is-abort-error';

/**
 * Base URL of the wiktapi.dev instance used for every word lookup, including
 * English (https://github.com/TheAlexLichter/wiktapi.dev).
 *
 * Defaults to the public, upstream-hosted instance at wiktapi.dev — no setup
 * required, works out of the box for the 19+ languages it currently covers (see
 * docs/dictionary-api.md's "Endpoint shape" section for the full edition list).
 * Set EXPO_PUBLIC_DICT_API_URL to override per environment (.env.local for local
 * dev against your own server, eas.json `env` for preview/production builds) —
 * useful for full 100+ language coverage beyond the public instance's editions,
 * for your own reliability control, or because `fetchWordSuggestions` still
 * requires a self-hosted override for non-English as-you-type suggestions
 * regardless of the public instance's `/search` route's current health — see
 * docs/dictionary-api.md for the known-limitations detail and reliability
 * history (the public instance has had at least one confirmed multi-hour
 * outage affecting every route, since resolved on its own).
 *
 * Running your own server for local dev (simulator, emulator, or physical
 * device) always requires this env var explicitly now — there's no more
 * automatic localhost fallback.
 */
const PUBLIC_API_BASE_URL = 'https://api.wiktapi.dev';

const API_BASE_URL = process.env.EXPO_PUBLIC_DICT_API_URL ?? PUBLIC_API_BASE_URL;

// Minimal shape we rely on from wiktapi.dev's /definitions endpoint, built on
// kaikki.org's wiktextract data. We use /definitions (not the bare /word route)
// because only it includes the part of speech (`pos`) in its response.
// Validate the full schema against <API_BASE_URL>/_openapi.json (or /_scalar).
//
// The data nests like this:
//   definition (one part of speech, e.g. "noun")
//     └─ senses[]  (the distinct meanings of that word)
//          └─ glosses[]  (the human-readable definition text)

// A sense = one specific meaning: its gloss is the definition text, and
// `examples` holds sentences that use the word in context.
type WiktExample = { text?: string };
type WiktSense = { glosses?: string[]; raw_glosses?: string[]; examples?: WiktExample[] };
// A definition = one part-of-speech entry (`pos`), holding all its senses.
type WiktDefinition = { pos?: string; lang_code?: string; senses?: WiktSense[] };
// The endpoint returns one definition per part of speech the word has.
type DefinitionsResponse = { word?: string; edition?: string; definitions?: WiktDefinition[] };

/**
 * Picks the gloss text out of a wiktapi.dev sense.
 *
 * @param {WiktSense} sense One sense (specific meaning) of a word.
 * @returns {string | undefined} The sense's first gloss, or `undefined` if it has none.
 *
 */
function firstGloss(sense: WiktSense): string | undefined {
    return (sense.glosses ?? sense.raw_glosses ?? [])[0];
}

// Caps how many definitions we keep/store per word — some words return dozens.
const MAX_DEFINITIONS = 50;

/**
 * Builds a `WordEntry` from the flattened list of candidate definitions: dedupes
 * exact duplicates, caps the count, and denormalizes the first one as the
 * selected definition so existing display code and old saved words keep working.
 *
 * @param {string} word The word being looked up.
 * @param {WordDefinition[]} definitions Every candidate definition found, in order.
 * @param {string} [phonetic] The word's phonetic transcription, if the source provided one.
 * @returns {WordEntry} The built entry, with `definitions[0]` denormalized onto the top-level fields.
 *
 */
function buildEntry(word: string, definitions: WordDefinition[], phonetic?: string): WordEntry {
    const seen = new Set<string>();
    const unique = definitions.filter((d) => {
        if (!d.definition) {
            return false;
        }
        const id = `${d.partOfSpeech}|${d.definition}`;
        if (seen.has(id)) {
            return false;
        }
        seen.add(id);
        return true;
    }).slice(0, MAX_DEFINITIONS);

    if (unique.length === 0) {
        throw new Error(`No definition found for: ${word}`);
    }

    const first = unique[0];
    return {
        word,
        phonetic,
        partOfSpeech: first.partOfSpeech,
        definition: first.definition,
        exampleSentence: first.exampleSentence,
        definitions: unique,
        selectedDefinition: 0,
    };
}

// Minimal shape we rely on from wiktapi.dev's /pronunciations endpoint.
type PronunciationSound = { ipa?: string };
type PronunciationEntry = { sounds?: PronunciationSound[] };
type PronunciationsResponse = { pronunciations?: PronunciationEntry[] };

/**
 * Fetches just the phonetic (IPA) transcription for a word from wiktapi.dev's
 * dedicated pronunciations route — `fetchFromWiktapi`'s own `/definitions`
 * call never includes it. Run concurrently alongside `fetchFromWiktapi` in
 * `fetchDefinition` (via `Promise.allSettled`) so it adds no latency and its
 * failure never fails the main word lookup, it just means no phonetic gets
 * attached. Works for every language, not just English.
 *
 * @param {string} word The word to look up.
 * @param {string} language The dictionary language code (e.g. "nl"), used as
 * both the wiktapi.dev "edition" and the ?lang= filter.
 * @returns {Promise<string | undefined>} The first IPA transcription found across every part-of-speech entry, or `undefined` on any failure or if none was found.
 *
 */
async function fetchPhonetic(word: string, language: string): Promise<string | undefined> {
    try {
        // Hosted on the pi for other languages, 
        // but for English we use the public wiktapi.dev instance since the pi's English edition is incomplete.
        // TODO: still replace later after everything is hosted on digital ocean
        let url = `${API_BASE_URL}/v1/${language}/word/${encodeURIComponent(word)}/pronunciations?lang=${encodeURIComponent(language)}`;

        if (language === 'en') {
            url = `https://api.wiktapi.dev/v1/${language}/word/${encodeURIComponent(word)}/pronunciations?lang=${encodeURIComponent(language)}`;
        }

        const res = await timedFetch(url);
        if (!res.ok) {
            return undefined;
        }
        const data: PronunciationsResponse = await res.json();
        for (const entry of data.pronunciations ?? []) {
            const ipa = entry.sounds?.find((s) => s.ipa)?.ipa;
            if (ipa) {
                return ipa;
            }
        }
        return undefined;
    } catch (error) {
        console.error(error);
        return undefined;
    }
}

/**
 * Looks up a word via wiktapi.dev — the public instance by default, or a
 * self-hosted one if EXPO_PUBLIC_DICT_API_URL is set. Used for every
 * language, including English. See the `API_BASE_URL` doc comment above for
 * how the host resolves.
 *
 * @param {string} word The word to look up.
 * @param {string} language The dictionary language code (e.g. "nl"), used as
 * both the wiktapi.dev "edition" and the ?lang= filter.
 * @returns {Promise<WordEntry>} The built entry.
 * @throws {Error} If the word isn't found, or has no usable definitions.
 *
 */
async function fetchFromWiktapi(word: string, language: string): Promise<WordEntry> {
    // e.g. GET https://api.wiktapi.dev/v1/nl/word/hond/definitions?lang=nl

    // Hosted on the pi for other languages, 
    // but for English we use the public wiktapi.dev instance since the pi's English edition is incomplete.
    // TODO: still replace later after everything is hosted on digital ocean
    let url = `${API_BASE_URL}/v1/${language}/word/${encodeURIComponent(word)}/definitions?lang=${encodeURIComponent(language)}`;
    // const url = `${API_BASE_URL}/v1/${language}/word/${encodeURIComponent(word)}/definitions?lang=${encodeURIComponent(language)}`;
    if (language === 'en') {
        url = `https://api.wiktapi.dev/v1/${language}/word/${encodeURIComponent(word)}/definitions?lang=${encodeURIComponent(language)}`;
    }

    const res = await timedFetch(url);
    if (!res.ok) {
        throw new Error(`No definition found for: ${word}`);
    }

    const data: DefinitionsResponse = await res.json();

    // Flatten every definition (part of speech) → sense into one list. Each sense's
    // gloss is the definition text; its first example becomes the placeholder hint.
    const definitions: WordDefinition[] = [];
    for (const definition of data.definitions ?? []) {
        for (const sense of definition.senses ?? []) {
            const gloss = firstGloss(sense);
            if (!gloss) {
                continue;
            }
            definitions.push({
                partOfSpeech: (definition.pos ?? '').toLowerCase(),
                definition: gloss.trim(),
                exampleSentence: sense.examples?.find((e) => e.text)?.text?.trim(),
            });
        }
    }

    return buildEntry(word, definitions);
}

/**
 * Looks up a word's definition via wiktapi.dev (the public instance by
 * default; see the `API_BASE_URL` doc comment above). Also fetches a
 * concurrent, best-effort phonetic transcription via `fetchPhonetic`, since
 * the main lookup's `/definitions` call never includes one — the two calls
 * run together via `Promise.allSettled` so the phonetic supplement adds no
 * latency and can't fail the lookup on its own.
 *
 * @param {string} word The word to look up.
 * @param {string} [language] The dictionary language code. Defaults to `'en'`.
 * @returns {Promise<WordEntry>} The looked-up word, with all its definitions.
 * @throws {Error} If the word isn't found, or has no usable definitions.
 *
 */
export async function fetchDefinition(word: string, language = 'en'): Promise<WordEntry> {
    const [entryResult, phoneticResult] = await Promise.allSettled([
        fetchFromWiktapi(word, language),
        fetchPhonetic(word, language),
    ]);
    if (entryResult.status === 'rejected') {
        throw entryResult.reason;
    }
    const phonetic = phoneticResult.status === 'fulfilled' ? phoneticResult.value : undefined;
    const entry = entryResult.value;
    if (!phonetic) {
        return entry;
    }

    return { ...entry, phonetic };
}

/* --- As-you-type suggestions -------------------------------------------------
 *
 * A best-effort helper around the add-word input: every failure path resolves
 * to [] so a missing or unreachable server never breaks the UI (the same
 * contract as the community feed clients).
 */

const SUGGESTIONS_TIMEOUT_MS = 3000;

/**
 * Prefix-searches the dictionary for autocomplete. English uses the free
 * Datamuse suggest API (https://www.datamuse.com/api/) since dictionaryapi.dev
 * has no prefix endpoint; every other language uses wiktapi.dev's `/search`
 * route. Resolves to `[]` on ANY failure — timeout, network, non-200, bad
 * JSON — and never throws.
 *
 * Non-English suggestions only actually work with EXPO_PUBLIC_DICT_API_URL set
 * to a self-hosted instance — the public instance's `/search` route is
 * currently confirmed non-functional (see docs/dictionary-api.md), so against
 * the public default this always resolves to `[]` after the timeout below.
 *
 * @param {string} prefix The characters typed so far.
 * @param {string} language The dictionary language code.
 * @param {number} [limit] The maximum number of suggestions to return. Defaults to `8`.
 * @param {AbortSignal} [signal] Lets the caller cancel a superseded request while the user keeps typing.
 * @returns {Promise<string[]>} The matching words (deduped, lowercased), or `[]` on any failure.
 *
 */
export async function fetchWordSuggestions(
    prefix: string,
    language: string,
    limit = 8,
    signal?: AbortSignal,
): Promise<string[]> {
    // Own timeout + external signal (timedFetch throws and takes no signal;
    // AbortSignal.any isn't reliably available on Hermes).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUGGESTIONS_TIMEOUT_MS);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener('abort', onOuterAbort);
    try {
        const url = language === 'en'
            ? `https://api.datamuse.com/sug?s=${encodeURIComponent(prefix)}&max=${limit}`
            : `${API_BASE_URL}/v1/${language}/search?q=${encodeURIComponent(prefix)}&lang=${encodeURIComponent(language)}&limit=${limit}`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
            return [];
        }
        // Datamuse: [{ word, score }] — wiktapi: { results: [{ word, ... }] }.
        const data = await res.json();
        const rows: { word?: string }[] = Array.isArray(data) ? data : (data?.results ?? []);

        const seen = new Set<string>();
        const words: string[] = [];
        for (const row of rows) {
            const word = row.word?.trim().toLowerCase(); // the app stores words lowercased
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
