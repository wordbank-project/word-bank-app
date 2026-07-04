import type { ReadListBook, ReadStatus } from "@/models/read-list-book";
import { READ_STATUS_ORDER } from "@/models/read-list-book";
import type { WordDefinition, WordEntry } from "@/models/word-entry";

// The Word Bank backup file format (More → "Your data" → Export/Import Books)
// and the pure logic around it: validation/sanitizing of untrusted files and
// the word-merge used by imports. Deliberately free of AsyncStorage and React
// Native imports so it can run (and one day be tested) in plain Node — the
// storage side lives in export-import.ts.
//
// The exported shape is a contract with future app versions: bump
// EXPORT_FORMAT_VERSION on breaking changes, and keep parseExport able to read
// every version <= the current one.

export const EXPORT_FORMAT = "word-bank-export";
export const EXPORT_FORMAT_VERSION = 1;

export type ExportedBook = { book: ReadListBook; words: WordEntry[] };

export type WordBankExport = {
    format: typeof EXPORT_FORMAT;      // magic marker identifying our files
    formatVersion: number;             // see note above
    exportedAt: number;                // ms epoch
    appVersion: string;                // informational only
    books: ExportedBook[];
};

export type ImportMode = "merge" | "replace";
export type ImportResult = { booksAdded: number; wordsAdded: number };
export type ParsedExport = { data: WordBankExport; skipped: number };

// Thrown by parseExport with a message that is safe to show the user directly.
export class ExportFileError extends Error {}

// A cover_i is either an OpenLibrary cover id or a direct URI (see coverUri).
// Local URIs (file://, content://, ph://) point at files that don't exist on
// another device, so they're dropped from the export; imported custom books
// show the placeholder until the user re-picks a photo.
export function exportableCover(coverI: string): string {
    const value = String(coverI ?? "");
    return value.includes("://") && !value.startsWith("http") ? "" : value;
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

// Rebuilds a WordEntry from untrusted JSON, keeping only the fields the app
// knows. Returns null when the entry is missing its essentials.
function sanitizeWord(raw: unknown): WordEntry | null {
    if (!isRecord(raw) || typeof raw.word !== "string" || raw.word.trim() === "" || typeof raw.definition !== "string") {
        return null;
    }
    const definitions = Array.isArray(raw.definitions)
        ? raw.definitions
              .filter(
                  (d): d is Record<string, unknown> =>
                      isRecord(d) && typeof d.definition === "string",
              )
              .map(
                  (d): WordDefinition => ({
                      partOfSpeech: optionalString(d.partOfSpeech) ?? "",
                      definition: d.definition as string,
                      exampleSentence: optionalString(d.exampleSentence),
                  }),
              )
        : undefined;

    return {
        word: raw.word,
        phonetic: optionalString(raw.phonetic),
        partOfSpeech: optionalString(raw.partOfSpeech) ?? "",
        definition: raw.definition,
        exampleSentence: optionalString(raw.exampleSentence),
        definitions,
        selectedDefinition: optionalNumber(raw.selectedDefinition),
        sentence: optionalString(raw.sentence),
        notes: optionalString(raw.notes),
        addedAt: optionalNumber(raw.addedAt),
    };
}

// Rebuilds one book + its words. Returns the sanitized entry plus how many of
// its words were dropped; null when the book itself is unusable.
function sanitizeBook(raw: unknown): { entry: ExportedBook; skippedWords: number } | null {
    if (!isRecord(raw) || !isRecord(raw.book)) {
        return null;
    }
    const book = raw.book;
    if (
        typeof book.key !== "string" ||
        book.key.trim() === "" ||
        typeof book.title !== "string" ||
        !READ_STATUS_ORDER.includes(book.status as ReadStatus)
    ) {
        return null;
    }

    const rawWords = Array.isArray(raw.words) ? raw.words : [];
    const words: WordEntry[] = [];
    let skippedWords = 0;
    for (const rawWord of rawWords) {
        const word = sanitizeWord(rawWord);
        if (word) {
            words.push(word);
        } else {
            skippedWords++;
        }
    }

    return {
        entry: {
            book: {
                key: book.key,
                title: book.title,
                author: optionalString(book.author) ?? "",
                year: optionalString(book.year) ?? "",
                cover_i: exportableCover(optionalString(book.cover_i) ?? ""),
                status: book.status as ReadStatus,
                addedAt: optionalNumber(book.addedAt) ?? Date.now(),
                review: optionalString(book.review),
                bookNotes: optionalString(book.bookNotes),
            },
            words,
        },
        skippedWords,
    };
}

// Parses an export file. Throws ExportFileError (user-presentable message) when
// the file as a whole is unusable; individual broken books/words are skipped
// and counted instead, so one bad entry never blocks a restore.
export function parseExport(json: string): ParsedExport {
    let root: unknown;
    try {
        root = JSON.parse(json);
    } catch {
        throw new ExportFileError("That file isn't readable JSON.");
    }
    if (!isRecord(root) || root.format !== EXPORT_FORMAT) {
        throw new ExportFileError("That file doesn't look like a Word Bank export.");
    }
    if (typeof root.formatVersion !== "number" || root.formatVersion > EXPORT_FORMAT_VERSION) {
        throw new ExportFileError(
            "This backup was made by a newer version of Word Bank — update the app to import it.",
        );
    }
    if (!Array.isArray(root.books)) {
        throw new ExportFileError("That file doesn't look like a Word Bank export.");
    }

    const books: ExportedBook[] = [];
    const seenKeys = new Set<string>();
    let skipped = 0;
    for (const rawBook of root.books) {
        const result = sanitizeBook(rawBook);
        if (!result || seenKeys.has(result.entry.book.key)) {
            skipped++;
            continue;
        }
        seenKeys.add(result.entry.book.key);
        skipped += result.skippedWords;
        books.push(result.entry);
    }

    return {
        data: {
            format: EXPORT_FORMAT,
            formatVersion: root.formatVersion,
            exportedAt: optionalNumber(root.exportedAt) ?? 0,
            appVersion: optionalString(root.appVersion) ?? "",
            books,
        },
        skipped,
    };
}

// Merges imported words into a book's existing collection. Words are matched
// by their text (case-insensitive); the existing entry always wins.
export function mergeWords(
    existing: WordEntry[],
    incoming: WordEntry[],
): { merged: WordEntry[]; added: number } {
    const seen = new Set(existing.map((w) => w.word.trim().toLowerCase()));
    const merged = [...existing];
    let added = 0;
    for (const word of incoming) {
        const id = word.word.trim().toLowerCase();
        if (seen.has(id)) {
            continue;
        }
        seen.add(id);
        merged.push(word);
        added++;
    }
    return { merged, added };
}
