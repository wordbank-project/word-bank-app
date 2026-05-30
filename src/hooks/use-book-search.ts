import type { Book } from '@/models/book';
import { useRef, useState } from 'react';

const PAGE_SIZE = 20;
const API_URL = 'https://openlibrary.org/search.json';

export type BookSearchState = {
    books: Book[];
    loading: boolean;
    loadingMore: boolean;
    searched: boolean;
    loadMoreError: boolean;
    search: (query: string) => void;
    loadMore: () => void;
    retryLoadMore: () => void;
};

export function useBookSearch(): BookSearchState {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searched, setSearched] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(false);

    // Refs hold pagination state so onEndReached closures always read current values
    const offsetRef = useRef(0);
    const totalRef = useRef(0);
    const activeQueryRef = useRef('');
    const abortRef = useRef<AbortController | null>(null);

    async function search(query: string): Promise<void> {
        const trimmed = query.trim();
        if (!trimmed) {
            return;
        }

        abortRef.current?.abort();
        abortRef.current = new AbortController();

        activeQueryRef.current = trimmed;
        offsetRef.current = 0;
        totalRef.current = 0;

        setLoading(true);
        setSearched(true);
        setBooks([]);
        setLoadMoreError(false);

        try {
            const res = await fetch(
                `${API_URL}?q=${encodeURIComponent(trimmed)}&limit=${PAGE_SIZE}&offset=0`,
                { signal: abortRef.current.signal }
            );
            const data = await res.json();
            const results: Book[] = data.docs ?? [];
            setBooks(results);
            totalRef.current = data.numFound ?? 0;
            offsetRef.current = results.length;
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') {
                return;
            }
            setBooks([]);
        } finally {
            setLoading(false);
        }
    }

    async function fetchNextPage(): Promise<void> {
        setLoadingMore(true);
        setLoadMoreError(false);
        try {
            const res = await fetch(
                `${API_URL}?q=${encodeURIComponent(activeQueryRef.current)}&limit=${PAGE_SIZE}&offset=${offsetRef.current}`,
                { signal: abortRef.current?.signal }
            );
            const data = await res.json();
            const results: Book[] = data.docs ?? [];
            setBooks((prev) => [...prev, ...results]);
            offsetRef.current += results.length;
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') {
                return;
            }
            setLoadMoreError(true);
        } finally {
            setLoadingMore(false);
        }
    }

    function loadMore(): void {
        if (loadingMore || loading || loadMoreError || offsetRef.current >= totalRef.current) {
            return;
        }
        fetchNextPage();
    }

    function retryLoadMore(): void {
        if (loadingMore || loading || offsetRef.current >= totalRef.current) {
            return;
        }
        fetchNextPage();
    }

    return { books, loading, loadingMore, searched, loadMoreError, search, loadMore, retryLoadMore };
}
