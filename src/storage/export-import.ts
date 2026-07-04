import {
    EXPORT_FORMAT,
    EXPORT_FORMAT_VERSION,
    exportableCover,
    mergeWords,
    type ExportedBook,
    type ImportMode,
    type ImportResult,
    type WordBankExport,
} from "@/storage/export-format";
import { clearAllBookData, getReadList, setReadList } from "@/storage/read-list-storage";
import { getWords, setWords } from "@/storage/words-storage";

import { version as appVersion } from "../../package.json";

// The storage side of backup export/import. The file format itself and all the
// pure validation/merge logic live in export-format.ts; this module is the only
// part that touches AsyncStorage.

export {
    ExportFileError,
    parseExport,
    type ExportedBook,
    type ImportMode,
    type ImportResult,
    type ParsedExport,
    type WordBankExport,
} from "@/storage/export-format";

// Snapshot of the whole library. Goes through getReadList so the legacy
// migrations have run — an export always carries current-schema data.
export async function buildExport(): Promise<WordBankExport> {
    const books = await getReadList();
    const exported = await Promise.all(
        books.map(async (book): Promise<ExportedBook> => ({
            book: { ...book, cover_i: exportableCover(book.cover_i) },
            words: await getWords(book.key),
        })),
    );
    return {
        format: EXPORT_FORMAT,
        formatVersion: EXPORT_FORMAT_VERSION,
        exportedAt: Date.now(),
        appVersion,
        books: exported,
    };
}

// Writes an import into storage.
//  - replace: wipe everything, then restore the file exactly.
//  - merge:   add books that aren't saved yet and merge each book's words;
//             anything already on the device wins over the file.
export async function applyImport(data: WordBankExport, mode: ImportMode): Promise<ImportResult> {
    if (mode === "replace") {
        await clearAllBookData();
        await setReadList(data.books.map(({ book }) => book));
        let wordsAdded = 0;
        for (const { book, words } of data.books) {
            if (words.length > 0) {
                await setWords(book.key, words);
                wordsAdded += words.length;
            }
        }
        return { booksAdded: data.books.length, wordsAdded };
    }

    const existingBooks = await getReadList();
    const existingKeys = new Set(existingBooks.map((b) => b.key));
    const updatedList = [...existingBooks];
    let booksAdded = 0;
    let wordsAdded = 0;

    for (const { book, words } of data.books) {
        if (existingKeys.has(book.key)) {
            const { merged, added } = mergeWords(await getWords(book.key), words);
            if (added > 0) {
                await setWords(book.key, merged);
                wordsAdded += added;
            }
        } else {
            updatedList.push(book);
            booksAdded++;
            if (words.length > 0) {
                await setWords(book.key, words);
                wordsAdded += words.length;
            }
        }
    }

    if (booksAdded > 0) {
        await setReadList(updatedList);
    }
    return { booksAdded, wordsAdded };
}
