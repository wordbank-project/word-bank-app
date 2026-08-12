import { router } from "expo-router";

// The info the book detail screen needs to open. All strings, since they go
// through navigation params.
export type BookNavParams = {
    key: string;
    title: string;
    author: string;
    year: string;
    cover_i: string;
    // Optional: a word to scroll to and highlight once the book screen lays out
    // (sent by the Words List, where you tap a specific word).
    focusWord?: string;
};

// Ignore re-taps while a push is still transitioning — rapid taps on a list
// item would otherwise stack the book screen once per tap.
let lastOpenAt = 0;
const OPEN_COOLDOWN_MS = 800;

export function openBook(book: BookNavParams): void {
    const now = Date.now();
    if (now - lastOpenAt < OPEN_COOLDOWN_MS) {
        return;
    }
    lastOpenAt = now;
    router.push({
        pathname: '/book' as any,
        params: book,
    });
}
