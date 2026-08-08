import type { ReadListBook, ReadStatus } from "@/models/read-list-book";
import { clearAnalysisHistory } from "@/storage/analysis-storage";
import { getJSON, setJSON } from "@/storage/storage";
import { removeWords } from "@/storage/words-storage";

export type { ReadListBook, ReadStatus } from "@/models/read-list-book";

const READ_LIST_KEY = "read_list";

export async function getReadList(): Promise<ReadListBook[]> {
    const books = await getJSON<ReadListBook[]>(READ_LIST_KEY, []);

    // One-time migrations for books saved by older versions:
    //  - the "reading" status was renamed to "currently_reading"
    //  - the book-level "notes" field was renamed to "bookNotes"
    let changed = false;
    const migrated = books.map((book) => {
        const legacy = book as ReadListBook & { notes?: string };

        let status = book.status;
        if ((status as string) === 'reading') {
            status = 'currently_reading' as ReadStatus;
        }

        const hasLegacyNotes = legacy.notes !== undefined && book.bookNotes === undefined;
        if (status === book.status && !hasLegacyNotes) {
            return book;
        }

        changed = true;
        const next: ReadListBook & { notes?: string } = { ...book, status };
        if (hasLegacyNotes) {
            next.bookNotes = legacy.notes;
            delete next.notes;
        }
        return next;
    });

    if (changed) {
        await setReadList(migrated);
    }
    return migrated;
}

export async function setReadList(books: ReadListBook[]): Promise<void> {
    await setJSON(READ_LIST_KEY, books);
}

// Adds a book, or updates it if it's already saved.
// Omit<ReadListBook, 'addedAt'> = a ReadListBook without the addedAt field, so callers
// can't pass it — this function sets addedAt itself. See https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys
export async function upsertReadListBook(book: Omit<ReadListBook, 'addedAt'>): Promise<ReadListBook[]> {
    const books = await getReadList();
    const idx = books.findIndex((b) => b.key === book.key);

    if (idx >= 0) {
        // Already saved: update it but keep the original "added" date.
        books[idx] = { ...books[idx], ...book };
    } else {
        // New book: add it to the top and stamp the "added" date now.
        books.unshift({ ...book, addedAt: Date.now() });
    }

    await setReadList(books);
    return books;
}

export async function removeReadListBook(bookKey: string): Promise<ReadListBook[]> {
    const books = await getReadList();
    const updated = books.filter((b) => b.key !== bookKey);
    await setReadList(updated);
    return updated;
}

export async function setReadBookStatus(bookKey: string, status: ReadStatus): Promise<ReadListBook[]> {
    const books = await getReadList();
    const updatedReadBookStatus = books.map((book) => (book.key === bookKey ? { ...book, status } : book));
    await setReadList(updatedReadBookStatus);
    return updatedReadBookStatus;
}

/** Delete all book data, including the read list, words, and analysis history. 
* @returns {Promise<void>} test A promise that resolves when all data has been cleared.
* 
*/
export async function clearAllBookData(): Promise<void> {
    const books = await getReadList();
    await removeWords(books.map((b) => b.key));
    await setReadList([]);
    await clearAnalysisHistory();
}
