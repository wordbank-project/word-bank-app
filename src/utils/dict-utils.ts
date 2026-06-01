/* Utility functions for working with dictionaries and APIs. */

/**
 * Fetches a URL with a timeout.
 * If the request takes longer than 8 seconds, it will be aborted and an error will be thrown.
 * If the fetch fails for any other reason (e.g. no internet connection), a different error will be thrown.
 */
export async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 8000);
    try {
        return await fetch(url, { ...init, signal: abort.signal });
    } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
            throw new Error('Dictionary request timed out. Try again.');
        }
        throw new Error('Could not reach dictionary. Check your connection.');
    } finally {
        clearTimeout(timer);
    }
}
