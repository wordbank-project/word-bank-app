import type { AnalysisHistoryEntry } from "@/models/sentence-analysis";
import type { ReadListBook } from "@/models/read-list-book";
import type { WordEntry } from "@/models/word-entry";
import type { WordStat } from "@/models/word-stat";

// The shapes behind the Word Bank backup export/import feature (More →
// "Your data" → Export/Import Data) — see storage/export-format.ts (the file
// format + validation logic that builds/consumes these), storage/export-import.ts
// (the AsyncStorage side), and utils/export-import-flow.ts (the user-facing flow).

/** One book plus its saved words, as stored in a backup file. */
export type ExportedBook = {
    book: ReadListBook;
    words: WordEntry[];
};

/** The full contents of a Word Bank backup `.json` file. */
export type WordBankExport = {
    formatName: "word-bank-backup";
    formatVersion: number;
    exportedAt: number;    // ms epoch, when the file was written
    appVersion: string;    // app's package.json version at export time — informational only, for support requests
    books: ExportedBook[];
    analyses: AnalysisHistoryEntry[];
    memoryStats: WordStat[];  // per-word practice counters, for the Memory tab (see memory-stats-storage.ts)
};

/** What parseImportFile hands back: the cleaned, storage-ready data plus counts
 * of anything dropped along the way (shown to the user, never silently lost). */
export type SanitizedImport = {
    data: WordBankExport;
    skippedBooks: number;
    skippedWords: number;
    skippedAnalyses: number;
    skippedMemoryStats: number;
};

/** What mergeWords produced. */
export type WordMergeResult = {
    merged: WordEntry[];
    added: number;
};

/** What mergeAnalyses produced. */
export type AnalysesMergeResult = {
    merged: AnalysisHistoryEntry[];
    added: number;
};

/** What mergeMemoryStats produced. */
export type MemoryStatsMergeResult = {
    merged: WordStat[];
    added: number;
};

export type ImportMode = "merge" | "replace";

/** How many books/words/analyses an import actually changed on-device. */
export type ImportResult = {
    booksAdded: number;
    booksMerged: number;
    wordsAdded: number;
    analysesAdded: number;
    memoryStatsAdded: number;
};
