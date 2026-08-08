import type { SentenceAnalysis } from '@/models/sentence-analysis';

import { FEED_API_BASE_URL } from '@/utils/feed-api-base';

// Asks the Word Bank server to analyze a sentence, returning the AI's explanation of it.

// Waits up to 25 seconds for a response, then aborts. The server itself has a 20-second timeout, 
// so this is just a bit longer to allow for network latency.
const ANALYZE_TIMEOUT_MS = 25_000;

// Longest sentence the server accepts — mirrors MAX_SENTENCE_LENGTH there.
export const MAX_SENTENCE_LENGTH = 300;

/**
 * Cleans a string to a known-safe value: trims, collapses whitespace, and
 * truncates to a max length. Returns `''` for non-strings.
 * @param {unknown} value the value to clean
 * @param {number} max the maximum length of the returned string
 * @returns {string} the cleaned string, or `''` if the input was not a string
 * 
 */
function cleanString(value: unknown, max: number): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/**
 * Parses a server response into a `SentenceAnalysis`, or returns `null` if the
 * response is malformed or missing the expected fields.
 * @param {unknown} data the server response to parse
 * @returns {SentenceAnalysis | null} the parsed analysis, or `null` if the response was malformed
 * 
 */
function parseAnalysis(data: unknown): SentenceAnalysis | null {
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const meaning = cleanString((data as Record<string, unknown>).meaning, 600);
    if (!meaning) {
        return null;
    }
    return { meaning };
}

/**
 * Returns the analysis, `null` when it couldn't be produced (offline, feature disabled
 * server-side, or an unusable reply), or `'rate-limited'` when either this app's own rate
 * limit or Groq's own upstream limit was hit — distinguished from a plain `null` so the screen
 * can show "try again shortly" instead of a generic connection error.
 * @param {string} text the sentence to analyze
 * @param {string} lang the language code of the sentence
 * @param {AbortSignal} [signal] optional signal to abort the request (e.g. screen unmount)
 * @returns {Promise<SentenceAnalysis | null | 'rate-limited'>} a promise that resolves to the analysis, `null`, or `'rate-limited'`
 * 
 */
export async function analyzeSentence(
    text: string,
    lang: string,
    signal?: AbortSignal,
): Promise<SentenceAnalysis | null | 'rate-limited'> {
    const sentence = text.replace(/\s+/g, ' ').trim();
    if (!sentence || sentence.length > MAX_SENTENCE_LENGTH) {
        return null;
    }

    try {
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        signal?.addEventListener('abort', onAbort);
        const timeout = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
        try {
            const res = await fetch(
                `${FEED_API_BASE_URL}/analyze?lang=${encodeURIComponent(lang)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: sentence }),
                    signal: controller.signal,
                },
            );
            if (res.status === 429) {
                return 'rate-limited';
            }
            if (!res.ok) {
                return null;
            }
            const data = (await res.json()) as unknown;
            return parseAnalysis(data);
        } finally {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', onAbort);
        }
    } catch {
        return null;
    }
}
