import { Platform } from 'react-native';

import type { WordEntry } from '@/models/word-entry';
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
    const entry = data[0];
    const meaning = entry.meanings[0];
    return {
        word: entry.word,
        phonetic: entry.phonetic,
        partOfSpeech: meaning.partOfSpeech,
        definition: meaning.definitions[0].definition,
        exampleSentence: meaning.definitions[0].example, // optional; used as a placeholder text in the edit form
    };
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
        throw new Error(`"${word}" not found in dictionary.`);
    }

    const data: DefinitionsResponse = await res.json();

    // One definition per part of speech / etymology; pick the first with a gloss.
    const definition = (data.definitions ?? []).find((d) => (d.senses ?? []).some(firstGloss));
    if (!definition) {
        throw new Error(`No definition found for "${word}".`);
    }

    // the sense is where the human-readable gloss lives, so find the first one with a gloss
    const sense = (definition.senses ?? []).find(firstGloss)!;

    // The sense's first example sentence, shown as a placeholder hint in the edit form.
    const example = sense.examples?.find((e) => e.text)?.text;

    return {
        word,
        partOfSpeech: (definition.pos ?? '').toLowerCase(),
        definition: (firstGloss(sense) ?? '').trim(),
        exampleSentence: example?.trim(),
    };
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
