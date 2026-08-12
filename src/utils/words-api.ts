import { Platform } from 'react-native';

import type { WordDefinition, WordEntry } from '@/models/word-entry';
import { timedFetch } from '@/utils/dict-utils';

/**
 * Base URL of the self-hosted wiktapi.dev instance (https://github.com/TheAlexLichter/wiktapi.dev).
 *
 * Set EXPO_PUBLIC_DICT_API_URL to override per environment (.env.local for a
 * physical device, eas.json `env` for preview/production builds). When unset we
 * fall back to a local dev server — note that "localhost" resolves differently
 * per platform:
 *   - iOS simulator & web:  http://localhost:3000   (shares the host network)
 *   - Android emulator:     http://10.0.2.2:3000    (emulator alias for the host machine)
 *   - Physical device:      http://<your-LAN-IP>:3000  (e.g. http://192.168.0.177:3000)
 *                           — must be provided via EXPO_PUBLIC_DICT_API_URL
 *
 * The published app cannot reach your machine, so preview/production builds must
 * point at a deployed instance via EXPO_PUBLIC_DICT_API_URL.
 */
const DEFAULT_LOCAL_URL = Platform.select({
    android: 'http://10.0.2.2:3000',
    default: 'http://localhost:3000',
});

const API_BASE_URL = process.env.EXPO_PUBLIC_DICT_API_URL ?? DEFAULT_LOCAL_URL;

/* Maps a dictionary language code to the wiktapi.dev "edition" — which Wiktionary
 * the data comes from, and therefore the language the definitions are written in.
 * Add an entry here as you load more editions into the server's database.
 * English is not listed: it is served by the public dictionaryapi.dev instead
 * (see fetchEnglish) so the server never has to host the huge English edition.
 */
const EDITION_BY_LANG: Record<string, string> = {
    nl: 'nl',
};

/* Minimal shape we rely on from wiktapi.dev's /definitions endpoint, built on
 * kaikki.org's wiktextract data. We use /definitions (not the bare /word route)
 * because only it includes the part of speech (`pos`) in its response.
 * Validate the full schema against <API_BASE_URL>/_openapi.json (or /_scalar).
 *
 * The data nests like this:
 *   definition (one part of speech, e.g. "noun")
 *     └─ senses[]  (the distinct meanings of that word)
 *          └─ glosses[]  (the human-readable definition text)
 */

/* A sense = one specific meaning: its gloss is the definition text, and
 * `examples` holds sentences that use the word in context.
 */
type WiktExample = { text?: string };
type WiktSense = { glosses?: string[]; raw_glosses?: string[]; examples?: WiktExample[] };
/* A definition = one part-of-speech entry (`pos`), holding all its senses. */
type WiktDefinition = { pos?: string; lang_code?: string; senses?: WiktSense[] };
/* The endpoint returns one definition per part of speech the word has. */
type DefinitionsResponse = { word?: string; edition?: string; definitions?: WiktDefinition[] };

function firstGloss(sense: WiktSense): string | undefined {
    return (sense.glosses ?? sense.raw_glosses ?? [])[0];
}

// Caps how many definitions we keep/store per word — some words return dozens.
const MAX_DEFINITIONS = 50;

/* Builds a WordEntry from the flattened list of candidate definitions: dedupes
 * exact duplicates, caps the count, and denormalizes the first one as the
 * selected definition so existing display code and old saved words keep working.
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

/* English is served by the free public Free Dictionary API (no key)
 * User-Agent required), so the self-hosted server never has to import the ~2.3 GB English edition.
 */
async function fetchEnglish(word: string): Promise<WordEntry> {

    /* e.g. GET https://api.dictionaryapi.dev/api/v2/entries/en/dog */
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

    const res = await timedFetch(url);
    if (!res.ok) {
        throw new Error('Word not found in dictionary.');
    }
    const data = await res.json();

    // Flatten every entry → meaning (part of speech) → definition into one list.
    const definitions: WordDefinition[] = [];
    for (const entry of data) {
        for (const meaning of entry.meanings ?? []) {
            for (const def of meaning.definitions ?? []) {
                definitions.push({
                    partOfSpeech: meaning.partOfSpeech ?? '',
                    definition: def.definition ?? '',
                    exampleSentence: def.example, // optional; used as a placeholder text in the edit form
                });
            }
        }
    }

    // The first entry that carries a phonetic transcription.
    const phonetic = data.find((e: { phonetic?: string }) => e.phonetic)?.phonetic;

    return buildEntry(data[0]?.word ?? word, definitions, phonetic);
}

// All non-English languages are served by the self-hosted wiktapi.dev: https://github.com/TheAlexLichter/wiktapi.dev instance.
// Later we can put the server code on a hosting service and point the app at it via EXPO_PUBLIC_DICT_API_URL, 
// but for now you can run it locally and point the app at http://localhost:3000 (iOS/web) or http://10.0.2.2:3000 (Android)
async function fetchSelfHosted(word: string, language: string): Promise<WordEntry> {
    const edition = EDITION_BY_LANG[language] ?? language;

    // e.g. GET http://localhost:3000/v1/nl/word/hond/definitions?lang=nl
    const url = `${API_BASE_URL}/v1/${edition}/word/${encodeURIComponent(word)}/definitions?lang=${encodeURIComponent(language)}`;

    const res = await timedFetch(url);
    if (!res.ok) {
        throw new Error(`"No definition found for: ${word}"`);
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
 * Looks up a word's definition. English uses the public dictionaryapi.dev; https://dictionaryapi.dev
 * every other language uses the self-hosted https://wiktapi.dev instance (for now until it is hosted on a reliable hosting service).
 */
export async function fetchDefinition(word: string, language = 'en'): Promise<WordEntry> {
    if (language === 'en') {
        return fetchEnglish(word);
    }
    return fetchSelfHosted(word, language);
}

/* --- As-you-type suggestions + "did you mean" corrections ------------------
 *
 * Both are best-effort helpers around the add-word input: every failure path
 * resolves to [] so a missing or unreachable server never breaks the UI (the
 * same contract as the community feed clients).
 */

const SUGGESTIONS_TIMEOUT_MS = 3000;

/**
 * Prefix-search the dictionary for autocomplete. English uses the free
 * Datamuse suggest API: https://www.datamuse.com/api/
 * (dictionaryapi.dev has no prefix endpoint); everything
 * else uses the self-hosted wiktapi.dev /search route. Resolves to [] on ANY
 * failure — timeout, network, non-200, bad JSON — and never throws. `signal`
 * lets the caller cancel superseded requests while the user keeps typing.
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
            : `${API_BASE_URL}/v1/${EDITION_BY_LANG[language] ?? language}/search?q=${encodeURIComponent(prefix)}&lang=${encodeURIComponent(language)}&limit=${limit}`;

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
    } catch {
        return []; // includes AbortError — callers check their own signal before applying
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onOuterAbort);
    }
}
