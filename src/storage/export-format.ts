import type { AnalysisHistoryEntry, SentenceAnalysis } from "@/models/sentence-analysis";
import { MAX_ANALYSES_ENTRIES } from "@/models/sentence-analysis";
import type { ReadListBook, ReadStatus } from "@/models/read-list-book";
import { READ_STATUS_ORDER } from "@/models/read-list-book";
import type { WordDefinition, WordEntry } from "@/models/word-entry";
import type {
    AnalysesMergeResult,
    ExportedBook,
    MemoryStatsMergeResult,
    SanitizedImport,
    WordMergeResult,
} from "@/models/export-import";
import type { WordStat } from "@/models/word-stat";

/**
 * Thrown by parseImportFile for a file-level problem (not valid JSON, wrong
 * format marker, or a formatVersion this app build doesn't understand). Its
 * message is written to be shown to the user as-is, not logged.
 */
export class ImportFormatError extends Error {
    /**
     * @param {string} message A user-safe explanation of why the file was rejected.
     * @returns {void} no return value; this is a constructor.
     * 
     */
    constructor(message: string) {
        super(message);
        this.name = "ImportFormatError";
    }
}

// The Word Bank backup file format (More → "Your data" → Export/Import Data) and
// the pure logic around it: the format contract, field-by-field sanitization of
// untrusted imported JSON, and the merge helpers used by a "merge" import.
// Deliberately free of AsyncStorage and React Native imports so it stays a plain,
// unit-testable module — the storage-touching side lives in export-import.ts.
//
// The exported shape is a contract with future app versions: bump
// CURRENT_FORMAT_VERSION on breaking changes, and keep parseImportFile able to
// read every version up to the current one.

/** The literal string every real backup file's `formatName` field must equal. */
export const EXPORT_FORMAT_NAME = "word-bank-backup" as const;

/** Bump this whenever a change to WordBankExport's shape would break older-app imports. */
export const CURRENT_FORMAT_VERSION = 1;

/**
 * Blanks out a cover value that only makes sense on the device that created it
 * (a picked photo's file://, content://, or ph:// URI — see pick-cover-image.ts),
 * so it isn't written into an export that might be restored on a different
 * device or after a reinstall. OpenLibrary numeric ids and http(s):// cover
 * URLs are left untouched — see cover-uri.ts, which treats "contains ://" as
 * its only signal for "this is a URI, not a bare id".
 *
 * @param {string} coverI The book's cover_i value, as stored.
 * @returns {string} The same value if it's portable, otherwise an empty string.
 * 
 */
export function stripLocalCoverUri(coverI: string): string {
    if (!coverI) {
        return coverI;
    }
    const isPortable: boolean = !coverI.includes("://") || coverI.startsWith("http://") || coverI.startsWith("https://");
    if (isPortable) {
        return coverI;
    }
    return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Validates and defaults one definitions[] entry from an import file.
 *
 * @param {unknown} raw One definitions[] entry.
 * @returns {WordDefinition | null} The sanitized definition, or null if unusable.
 */
function sanitizeWordDefinition(raw: unknown): WordDefinition | null {
    if (!isRecord(raw) || typeof raw.definition !== "string") {
        return null;
    }
    return {
        partOfSpeech: optionalString(raw.partOfSpeech) ?? "",
        definition: raw.definition,
        exampleSentence: optionalString(raw.exampleSentence),
    };
}

/**
 * Rebuilds a WordEntry from untrusted JSON, keeping only the fields the app
 * knows and dropping anything else. Returns null only when the entry is
 * missing its one essential field — the word itself.
 *
 * @param {unknown} raw One words[] entry from the import file.
 * @returns {WordEntry | null} The sanitized word, or null if unusable.
 * 
 */
function sanitizeWordEntry(raw: unknown): WordEntry | null {
    if (!isRecord(raw) || typeof raw.word !== "string" || raw.word.trim() === "") {
        return null;
    }

    const definitions: WordDefinition[] = Array.isArray(raw.definitions)
        ? raw.definitions.map(sanitizeWordDefinition).filter((d): d is WordDefinition => d !== null)
        : [];
    const selectedDefinition: number | undefined = optionalNumber(raw.selectedDefinition);

    return {
        word: raw.word,
        phonetic: optionalString(raw.phonetic),
        partOfSpeech: optionalString(raw.partOfSpeech) ?? "",
        definition: optionalString(raw.definition) ?? "",
        exampleSentence: optionalString(raw.exampleSentence),
        definitions: definitions.length > 0 ? definitions : undefined,
        selectedDefinition: selectedDefinition !== undefined && definitions[selectedDefinition] ? selectedDefinition : undefined,
        sentence: optionalString(raw.sentence),
        notes: optionalString(raw.notes),
        addedAt: optionalNumber(raw.addedAt),
        sourceLanguage: optionalString(raw.sourceLanguage),
    };
}

/**
 * Rebuilds a ReadListBook from untrusted JSON. Returns null only when the book
 * is missing a field nothing else can substitute for — key or title; every
 * other field is tolerantly defaulted.
 *
 * @param {unknown} raw One book object from the import file.
 * @returns {ReadListBook | null} The sanitized book, or null if unusable.
 * 
 */
function sanitizeReadListBook(raw: unknown): ReadListBook | null {
    if (!isRecord(raw) || typeof raw.key !== "string" || raw.key.trim() === "" || typeof raw.title !== "string" || raw.title.trim() === "") {
        return null;
    }

    const status: ReadStatus = typeof raw.status === "string" && READ_STATUS_ORDER.includes(raw.status as ReadStatus)
        ? (raw.status as ReadStatus)
        : "want";
    const rating: number | undefined = optionalNumber(raw.rating);

    return {
        key: raw.key,
        title: raw.title,
        author: optionalString(raw.author) ?? "",
        year: optionalString(raw.year) ?? "",
        cover_i: stripLocalCoverUri(optionalString(raw.cover_i) ?? ""),
        status,
        addedAt: optionalNumber(raw.addedAt) ?? Date.now(),
        review: optionalString(raw.review),
        bookNotes: optionalString(raw.bookNotes),
        rating: rating !== undefined && rating >= 0 && rating <= 5 ? rating : undefined,
    };
}

/**
 * Validates and defaults one analyses[] entry from an import file.
 *
 * @param {unknown} raw One analyses[] entry.
 * @returns {AnalysisHistoryEntry | null} The sanitized entry, or null if unusable.
 */
function sanitizeAnalysisEntry(raw: unknown): AnalysisHistoryEntry | null {
    if (!isRecord(raw) || typeof raw.text !== "string" || raw.text.trim() === "" || typeof raw.lang !== "string" || raw.lang.trim() === "") {
        return null;
    }
    const analysis: unknown = raw.analysis;
    if (!isRecord(analysis) || typeof analysis.meaning !== "string") {
        return null;
    }

    return {
        text: raw.text,
        lang: raw.lang,
        analysis: { meaning: analysis.meaning } satisfies SentenceAnalysis,
        createdAt: optionalNumber(raw.createdAt) ?? Date.now(),
    };
}

/**
 * Validates and defaults one memoryStats[] entry from an import file. Returns
 * null only when the entry is missing its one essential field — the word
 * itself (mirrors sanitizeWordEntry) — every counter field defaults to 0.
 *
 * @param {unknown} raw One memoryStats[] entry.
 * @returns {WordStat | null} The sanitized entry, or null if unusable.
 *
 */
function sanitizeMemoryStat(raw: unknown): WordStat | null {
    if (!isRecord(raw) || typeof raw.word !== "string" || raw.word.trim() === "") {
        return null;
    }
    return {
        word: raw.word.trim().toLowerCase(),
        stillLearning: Math.max(0, optionalNumber(raw.stillLearning) ?? 0),
        knewIt: Math.max(0, optionalNumber(raw.knewIt) ?? 0),
        lastReviewedAt: Math.max(0, optionalNumber(raw.lastReviewedAt) ?? 0),
    };
}

/**
 * Parses and validates raw backup file text. Rejects the whole file (throwing
 * ImportFormatError) only for a file-level problem — bad JSON, a missing or
 * wrong format marker, or a formatVersion newer than this app understands. A
 * malformed individual book, word, analysis, or memory stat entry inside an
 * otherwise-valid file is dropped and counted instead of failing the whole import.
 *
 * @param {string} raw The full text read from the picked file.
 * @returns {SanitizedImport} The sanitized export data, plus how many books/words/analyses/memory stats were dropped.
 *
 */
export function parseImportFile(raw: string): SanitizedImport {
    let parsed: unknown;
    try {
        // Checks if its a valid JSON file with JSON syntax
        parsed = JSON.parse(raw);
    } catch (error) {
        console.error(error);
        throw new ImportFormatError("This file isn't a Word Bank backup — it doesn't look like valid JSON.");
    }

    // Checks format of the file
    if (!isRecord(parsed) || parsed.formatName !== EXPORT_FORMAT_NAME) {
        throw new ImportFormatError("This file doesn't look like a Word Bank backup.");
    }
    const formatVersion = parsed.formatVersion;
    if (typeof formatVersion !== "number" || formatVersion < 1) {
        throw new ImportFormatError("This file doesn't look like a Word Bank backup.");
    }
    if (formatVersion > CURRENT_FORMAT_VERSION) {
        throw new ImportFormatError("This backup was made by a newer version of Word Bank — update the app to import it.");
    }

    // We sanitize each part of the file
    const rawBooks: unknown[] = Array.isArray(parsed.books) ? parsed.books : [];
    let skippedBooks: number = 0;
    let skippedWords: number = 0;
    const books: ExportedBook[] = [];
    for (const rawEntry of rawBooks) {
        const book = isRecord(rawEntry) ? sanitizeReadListBook(rawEntry.book) : null;
        if (!book) {
            skippedBooks++;
            continue;
        }
        const rawWords = isRecord(rawEntry) && Array.isArray(rawEntry.words) ? rawEntry.words : [];
        const words: WordEntry[] = [];
        for (const rawWord of rawWords) {
            const word = sanitizeWordEntry(rawWord);
            if (word) {
                words.push(word);
            } else {
                skippedWords++;
            }
        }
        books.push({ book, words });
    }

    const rawAnalyses = Array.isArray(parsed.analyses) ? parsed.analyses : [];
    let skippedAnalyses: number = 0;
    const analyses: AnalysisHistoryEntry[] = [];
    for (const rawAnalysis of rawAnalyses) {
        const analysis = sanitizeAnalysisEntry(rawAnalysis);
        if (analysis) {
            analyses.push(analysis);
        } else {
            skippedAnalyses++;
        }
    }

    const rawMemoryStats: unknown[] = Array.isArray(parsed.memoryStats) ? parsed.memoryStats : [];
    let skippedMemoryStats: number = 0;
    const memoryStats: WordStat[] = [];
    for (const rawStat of rawMemoryStats) {
        const stat: WordStat | null = sanitizeMemoryStat(rawStat);
        if (stat) {
            memoryStats.push(stat);
        } else {
            skippedMemoryStats++;
        }
    }

    // Return the sanitized data object plus how many entries were dropped from each array. 
    return {
        data: {
            formatName: EXPORT_FORMAT_NAME,
            formatVersion,
            exportedAt: optionalNumber(parsed.exportedAt) ?? 0,
            appVersion: optionalString(parsed.appVersion) ?? "",
            books,
            analyses,
            memoryStats,
        },
        skippedBooks,
        skippedWords,
        skippedAnalyses,
        skippedMemoryStats,
    };
}

/**
 * Merges incoming[] onto existing[] by a caller-supplied key, keeping the
 * existing entry whenever a key collides. Shared by mergeWords/mergeAnalyses/
 * mergeMemoryStats, which differ only in how they key an entry (and, for
 * mergeAnalyses, an extra sort+cap applied on top of this result).
 *
 * @param {T[]} existing The device's current entries.
 * @param {T[]} incoming The entries from the import file.
 * @param {(item: T) => string} keyFn Extracts the matching key from an entry.
 * @returns {{ merged: T[]; added: number }} The merged list (existing entries first, unchanged) and how many were newly added.
 *
 */
function mergeByKey<T>(existing: T[], incoming: T[], keyFn: (item: T) => string): { merged: T[]; added: number } {
    const seen: Set<string> = new Set(existing.map(keyFn));
    const additions: T[] = incoming.filter((item) => !seen.has(keyFn(item)));
    return { merged: existing.concat(additions), added: additions.length };
}

/**
 * Merges imported words into a book's existing collection for the "merge"
 * import mode. Words are matched by their text (case-insensitive); a word
 * already on the device always wins over an incoming copy.
 *
 * @param {WordEntry[]} existing The device's current words for a book.
 * @param {WordEntry[]} incoming The words for that same book from the import file.
 * @returns {WordMergeResult} The merged list (existing words first, unchanged) and how many were newly added.
 *
 */
export function mergeWords(existing: WordEntry[], incoming: WordEntry[]): WordMergeResult {
    return mergeByKey(existing, incoming, (w: WordEntry) => w.word.trim().toLowerCase());
}

/**
 * Merges imported sentence analyses into the device's history for the "merge"
 * import mode. Entries are matched by language + sentence text (case-insensitive,
 * the same key addAnalysis already uses); an entry already on the device always
 * wins over an incoming copy. The merged list is re-capped to the newest
 * MAX_ANALYSES_ENTRIES entries afterward, same as a normal analysis save.
 *
 * @param {AnalysisHistoryEntry[]} existing The device's current analysis history.
 * @param {AnalysisHistoryEntry[]} incoming The analyses from the import file.
 * @returns {AnalysesMergeResult} The merged, re-capped list (newest first) and how many were newly added.
 *
 */
export function mergeAnalyses(existing: AnalysisHistoryEntry[], incoming: AnalysisHistoryEntry[]): AnalysesMergeResult {
    const { merged, added } = mergeByKey(existing, incoming, (e: AnalysisHistoryEntry) => `${e.lang}:${e.text.trim().toLowerCase()}`);
    // sort decending by createdAt, then slice to the max number of entries allowed
    return { merged: merged.sort((a: AnalysisHistoryEntry, b: AnalysisHistoryEntry) => b.createdAt - a.createdAt).slice(0, MAX_ANALYSES_ENTRIES), added };
}

/**
 * Merges imported memory stats into the device's existing stats for the "merge"
 * import mode. Entries are matched by word text (already normalized by
 * recordRating/sanitizeMemoryStat); a word's stats already on the device
 * always win over an incoming copy.
 *
 * @param {WordStat[]} existing The device's current memory stats.
 * @param {WordStat[]} incoming The memory stats from the import file.
 * @returns {MemoryStatsMergeResult} The merged list (existing entries first, unchanged) and how many were newly added.
 *
 */
export function mergeMemoryStats(existing: WordStat[], incoming: WordStat[]): MemoryStatsMergeResult {
    return mergeByKey(existing, incoming, (stat: WordStat) => stat.word);
}