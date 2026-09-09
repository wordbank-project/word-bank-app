// True when `error` is the AbortError thrown by a cancelled fetch/AbortController —
// an expected, routine cancellation (a superseded request, a screen unmounting), not
// a real failure worth logging. Shared by every fetch helper that takes an external
// `signal` (translate-api.ts, words-api.ts's fetchWordSuggestions, analyze-api.ts).

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
