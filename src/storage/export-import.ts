import {
    CURRENT_FORMAT_VERSION,
    EXPORT_FORMAT_NAME,
    mergeAnalyses,
    mergeMemoryStats,
    mergeWords,
    stripLocalCoverUri,
} from "@/storage/export-format";
import { getAnalysisHistory, setAnalysisHistory } from "@/storage/analysis-storage";
import { clearAllBookData, getReadList, ReadListBook, setReadList } from "@/storage/read-list-storage";
import { getMemoryStats, setMemoryStats } from "@/storage/memory-stats-storage";
import { getWords, setWords } from "@/storage/words-storage";

import type { ExportedBook, ImportMode, ImportResult, WordBankExport } from "@/models/export-import";

import { version as appVersion } from "../../package.json";
import { WordStat } from "@/models/word-stat";
import { AnalysisHistoryEntry } from "@/models/sentence-analysis";

// The AsyncStorage side of the backup export/import feature: snapshotting the
// current library into a WordBankExport, and applying a parsed one back onto
// storage (merge or replace). The file format itself, and all the pure
// validation/merge logic, live in export-format.ts — this is the only module
// that touches read-list-storage.ts/words-storage.ts/analysis-storage.ts for
// import/export.

/**
 * Checks whether there's any book, analysis, or memory stat already saved on
 * this device. Used to skip the merge-vs-replace prompt on import — with
 * nothing on-device yet, both modes behave identically (everything in the
 * file is simply new), so asking is pointless.
 *
 * @returns {Promise<boolean>} `true` if at least one book, analysis, or memory stat is saved.
 *
 */
export async function hasExistingData(): Promise<boolean> {
    const [books, analyses, memoryStats] = await Promise.all([getReadList(), getAnalysisHistory(), getMemoryStats()]);
    return books.length > 0 || analyses.length > 0 || memoryStats.length > 0;
}

/**
 * Snapshots every book, its words, the sentence-analysis history, and the
 * Memory tab's per-word practice stats into an exportable backup, stripping
 * any cover image that's local to this device (see stripLocalCoverUri).
 *
 * @returns {Promise<WordBankExport>} The full backup, ready to be written to a file.
 *
 */
export async function buildExport(): Promise<WordBankExport> {
    const books: ReadListBook[] = await getReadList();
    const exportedBooks: ExportedBook[] = await Promise.all(
        books.map(async (book: ReadListBook) => ({
            book: { ...book, cover_i: stripLocalCoverUri(book.cover_i) },
            words: await getWords(book.key),
        })),
    );
    const analyses: AnalysisHistoryEntry[] = await getAnalysisHistory();
    const memoryStats: WordStat[] = await getMemoryStats();

    return {
        formatName: EXPORT_FORMAT_NAME,
        formatVersion: CURRENT_FORMAT_VERSION,
        exportedAt: Date.now(),
        appVersion,
        books: exportedBooks,
        analyses,
        memoryStats,
    };
}

/**
 * Applies a parsed backup to on-device storage, either merging it on top of
 * the existing books/words/analyses or replacing everything with the file's
 * contents.
 *
 * @param {WordBankExport} data The sanitized backup data to apply (see parseImportFile).
 * @param {ImportMode} mode "merge" to add on top of existing data (existing data always wins on conflicts), "replace" to wipe first and restore exactly.
 * @returns {Promise<ImportResult>} How many books/words/analyses/memory stats were added or merged.
 *
 */
export async function applyImport(data: WordBankExport, mode: ImportMode): Promise<ImportResult> {
    if (mode === "replace") {
        // Wipes the read list, every book's words, the analysis history, and
        // the memory stats — all four are restored from the file right after,
        // so this is correct (not just "book data" being cleared, everything
        // the backup carries is).
        await clearAllBookData();
        await Promise.all(data.books.map((entry: ExportedBook) => setWords(entry.book.key, entry.words)));
        await setReadList(data.books.map((entry: ExportedBook) => entry.book));
        await setAnalysisHistory(data.analyses);
        await setMemoryStats(data.memoryStats);

        const wordsAdded = data.books.reduce((sum, entry) => sum + entry.words.length, 0);
        return {
            booksAdded: data.books.length,
            booksMerged: 0,
            wordsAdded,
            analysesAdded: data.analyses.length,
            memoryStatsAdded: data.memoryStats.length,
        };
    }

    // merge mode: add new books/words/analyses/memory stats on top of existing ones, 
    // but never overwrite anything already on-device. Existing data always wins on conflicts.

    const existingBooks: ReadListBook[] = await getReadList();
    const existingKeys: Set<string> = new Set(existingBooks.map((b) => b.key));
    const nextBooks: ReadListBook[] = [...existingBooks];
    let booksAdded: number = 0;
    let booksMerged: number = 0;
    let wordsAdded: number = 0;

    for (const entry of data.books) {
        if (!existingKeys.has(entry.book.key)) {
            // New book: add it (and its words) as-is from the file.
            nextBooks.push(entry.book);
            await setWords(entry.book.key, entry.words);
            booksAdded++;
            wordsAdded += entry.words.length;
            continue;
        }
        // Already on-device: its review/bookNotes/rating/status are left
        // untouched — only its words are merged, and the existing word always
        // wins over an incoming copy (see mergeWords).
        const existingWords = await getWords(entry.book.key);
        const { merged, added } = mergeWords(existingWords, entry.words);
        if (added > 0) {
            await setWords(entry.book.key, merged);
        }
        booksMerged++;
        wordsAdded += added;
    }
    await setReadList(nextBooks);

    const existingAnalyses: AnalysisHistoryEntry[] = await getAnalysisHistory();

    const { merged: mergedAnalyses, added: analysesAdded } = mergeAnalyses(existingAnalyses, data.analyses);
    if (analysesAdded > 0) {
        await setAnalysisHistory(mergedAnalyses);
    }

    const existingMemoryStats: WordStat[] = await getMemoryStats();
    const { merged: mergedMemoryStats, added: memoryStatsAdded } = mergeMemoryStats(existingMemoryStats, data.memoryStats);
    if (memoryStatsAdded > 0) {
        await setMemoryStats(mergedMemoryStats);
    }

    return { booksAdded, booksMerged, wordsAdded, analysesAdded, memoryStatsAdded };
}
