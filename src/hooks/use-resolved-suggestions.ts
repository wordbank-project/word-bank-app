import { useEffect, useState } from "react";

// Fetches the suggestions list for a given `key` (e.g. a language) once,
// falling back to `fallback` if the fetch comes back empty. Returns `null`
// until it's done, so callers can wait instead of showing a placeholder
// that might change right after.
export function useResolvedSuggestions<T>(
    fetch: () => Promise<T[]>,
    fallback: T[],
    key: string,
    ready: boolean,
): T[] | null {
    const [resolved, setResolved] = useState<T[] | null>(null);

    useEffect(() => {
        if (!ready) {
            return;
        }
        let cancelled = false;
        setResolved(null); // a new key (e.g. language change) starts a fresh wait
        fetch().then((items) => {
            if (!cancelled) {
                setResolved(items.length > 0 ? items : fallback);
            }
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, key]);

    return resolved;
}
