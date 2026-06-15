// Per-word spaced-repetition state (Leitner system). Stored separately from the
// word itself (see storage/srs-storage.ts) and keyed by the word string within a book.
export type SrsState = {
    box: number;            // Leitner box index into INTERVALS_DAYS (0 = newest/shortest)
    dueAt: number;          // epoch ms when the word is next due for review
    reps: number;           // total times the word has been graded
    lastReviewedAt: number; // epoch ms of the most recent grade
};

// The two grades a user can give a word during review.
export type SrsGrade = 'got' | 'again';
