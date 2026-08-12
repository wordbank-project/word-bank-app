// Word translation — a comparison aid on the book screen ("show this word in
// another language"), not a second dictionary source. Uses the unofficial
// Google Translate endpoint (same one many open-source translate tools call):
// free, no key, and verified more accurate for single words than the free
// keyed alternatives. It's undocumented, so treat every response as best
// effort — never throw, resolve to null on any failure.

const TRANSLATE_TIMEOUT_MS = 4000;

type TranslateSegment = [translated: string, original: string, ...rest: unknown[]];
type TranslateResponse = [TranslateSegment[], ...unknown[]];

/** Translates a single word from `from` to `to` (ISO 639 codes). 
 * Resolves to `null` on any failure (network, non-200, bad JSON, timeout) — including the
 * endpoint's quirk of echoing back untranslatable input as its own
 * "translation" (e.g. a nonsense word), which is treated the same as "not
 * found" rather than shown to the user. `signal` lets the caller cancel a
 * superseded request.
 * @param {string} word the word to translate
 * @param {string} from the source language code (ISO 639)
 * @param {string} to the target language code (ISO 639)
 * @param {AbortSignal | undefined} signal an optional abort signal to cancel the request
 * @returns {Promise<string | null>} a promise that resolves to the translated word, or `null` on failure
 * 
*/
export async function translateWord(
    word: string,
    from: string,
    to: string,
    signal?: AbortSignal,
): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener('abort', onOuterAbort);
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(word)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
            return null;
        }
        const data = (await res.json()) as TranslateResponse;
        const segments = data?.[0] ?? [];
        const translated = segments.map((seg) => seg[0]).join('').trim();

        if (!translated || translated.toLowerCase() === word.trim().toLowerCase()) {
            return null; // empty or just echoed the input back — no real translation
        }
        return translated;
    } catch {
        return null; // includes AbortError
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onOuterAbort);
    }
}
