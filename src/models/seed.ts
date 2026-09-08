// Which preset size utils/seed-test-data.ts's seedTestData() generates.
export type SeedSize = "small" | "medium" | "large";

// How many books/words/analyses/stat-carrying words a seed run wrote —
// what seedTestData() resolves to, shown as a summary in more.tsx.
export type SeedResult = {
    books: number;
    words: number;
    analyses: number;
    wordsWithStats: number;
};
