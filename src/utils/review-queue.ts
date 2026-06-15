import type { SrsState } from "@/models/srs";
import type { WordEntry } from "@/models/word-entry";
import { getReadList } from "@/storage/read-list-storage";
import { getSrsMaps } from "@/storage/srs-storage";
import { getWords } from "@/storage/words-storage";

// A word selected for review, tagged with the book it belongs to (word identity is
// per-book) and its current SRS state (undefined for a word never reviewed yet).
export type ReviewWord = WordEntry & {
    bookKey: string;
    bookTitle: string;
    srs?: SrsState;
};

// Builds today's review session: every word that's due (dueAt <= now), plus brand-new
// words (no SRS yet) until the total reaches `wordsPerDay`. Due words always come first
// (oldest-due first) so overdue reviews aren't starved by the new-word cap.
export async function getReviewQueue(wordsPerDay: number, now: number = Date.now()): Promise<ReviewWord[]> {
    const books = await getReadList();
    if (books.length === 0) {
        return [];
    }

    const bookKeys = books.map((b) => b.key);
    const [perBook, srsMaps] = await Promise.all([
        Promise.all(bookKeys.map((key) => getWords(key))),
        getSrsMaps(bookKeys),
    ]);

    const due: ReviewWord[] = [];
    const fresh: ReviewWord[] = [];

    books.forEach((book, i) => {
        const map = srsMaps[book.key] ?? {};
        perBook[i].forEach((word) => {
            const srs = map[word.word];
            const tagged: ReviewWord = { ...word, bookKey: book.key, bookTitle: book.title, srs };
            if (!srs) {
                fresh.push(tagged);
            } else if (srs.dueAt <= now) {
                due.push(tagged);
            }
        });
    });

    due.sort((a, b) => (a.srs!.dueAt - b.srs!.dueAt)); // most overdue first

    // All due reviews, then fill the remaining daily quota with new words.
    const remaining = Math.max(0, wordsPerDay - due.length);
    return [...due, ...fresh.slice(0, remaining)];
}

// Pulls additional new (never-reviewed) words beyond the daily cap — used by the
// "Get more words" action once the day's queue is cleared. Excludes words already shown.
export async function getMoreNewWords(count: number, excludeKeys: Set<string>, now: number = Date.now()): Promise<ReviewWord[]> {
    const queue = await getReviewQueue(Number.MAX_SAFE_INTEGER, now);
    const more = queue.filter((w) => !w.srs && !excludeKeys.has(`${w.bookKey}_${w.word}`));
    return more.slice(0, count);
}
