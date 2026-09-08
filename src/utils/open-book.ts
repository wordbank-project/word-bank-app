import { router } from "expo-router";

import type { BookNavParams } from "@/models/book-nav";

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
