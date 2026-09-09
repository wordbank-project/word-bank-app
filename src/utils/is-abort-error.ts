// True when `error` is the AbortError thrown by a cancelled fetch/AbortController —
// an expected, routine cancellation (a superseded request, a screen unmounting), not
// a real failure worth logging. Shared by every fetch helper that takes an external
// `signal` (translate-api.ts, words-api.ts's fetchWordSuggestions, analyze-api.ts).
export function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}
