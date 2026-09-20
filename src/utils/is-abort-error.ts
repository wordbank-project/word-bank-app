// True when `error` is the AbortError thrown by a cancelled fetch/AbortController —
// an expected, routine cancellation (a superseded request, a screen unmounting), not
// a real failure worth logging. Shared by every fetch helper that takes an external
// `signal` or times out its own request (translate-api.ts, words-api.ts's
// fetchWordSuggestions, analyze-api.ts, dict-utils.ts's timedFetch,
// hooks/use-book-search.ts) — deliberately kept here at the utils/ root rather than
// under utils/api/, since it's just as legitimately used outside the API-client
// layer (use-book-search.ts is a plain hook).

/**
 * Checks if the provided error is an AbortError, which indicates that a fetch request was cancelled.
 *
 * @param {unknown} error The error to check.
 * @returns {boolean} Returns true if the error is an AbortError; otherwise, returns false.
 * 
 */
export function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}
