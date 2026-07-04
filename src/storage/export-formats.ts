import type { ReadListBook, ReadStatus } from "@/models/read-list-book";
import type { ExportedBook } from "@/storage/export-format";

// Interchange exports for other platforms (More → "Your data"):
//  - buildGoodreadsCsv: the Goodreads CSV export format — the de-facto book
//    interchange standard, importable at goodreads.com/review/import and by
//    StoryGraph, Hardcover, BookWyrm, LibraryThing, Openreads, …
//  - buildAnkiTsv: the saved words as an Anki-importable text file, turning
//    the vault into a spaced-repetition deck.
// Pure string builders (no storage/UI imports) — the flows in
// utils/export-formats-flow.ts feed them from buildExport().

// ---------------------------------------------------------------------------
// Goodreads CSV
// ---------------------------------------------------------------------------

// Goodreads' own export header — imports match this shape most reliably, and
// the other platforms all accept it. Columns we can't fill stay blank.
const GOODREADS_HEADER = [
    "Book Id",
    "Title",
    "Author",
    "Author l-f",
    "Additional Authors",
    "ISBN",
    "ISBN13",
    "My Rating",
    "Average Rating",
    "Publisher",
    "Binding",
    "Number of Pages",
    "Year Published",
    "Original Publication Year",
    "Date Read",
    "Date Added",
    "Bookshelves",
    "Bookshelves with positions",
    "Exclusive Shelf",
    "My Review",
    "Spoiler",
    "Private Notes",
    "Read Count",
    "Owned Copies",
];

// Word Bank statuses → Goodreads' three built-in (exclusive) shelves.
const SHELF_BY_STATUS: Record<ReadStatus, string> = {
    want: "to-read",
    currently_reading: "currently-reading",
    read: "read",
};

function csvField(value: string): string {
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Goodreads uses YYYY/MM/DD.
function goodreadsDate(msEpoch: number): string {
    const date = new Date(msEpoch);
    if (Number.isNaN(date.getTime())) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}/${month}/${day}`;
}

export function buildGoodreadsCsv(books: ReadListBook[]): string {
    const lines = [GOODREADS_HEADER.join(",")];
    for (const book of books) {
        const shelf = SHELF_BY_STATUS[book.status];
        const row = [
            "", // Book Id — assigned by Goodreads on import
            book.title,
            book.author,
            "", // Author l-f
            "", // Additional Authors
            "", // ISBN — not stored (OpenLibrary keys instead); matching falls back to title/author
            "", // ISBN13
            "0", // My Rating — 0 = unrated
            "", // Average Rating
            "", // Publisher
            "", // Binding
            "", // Number of Pages
            book.year ?? "",
            "", // Original Publication Year
            "", // Date Read — not tracked
            goodreadsDate(book.addedAt),
            shelf === "read" ? "" : shelf, // Bookshelves (mirrors Goodreads exports)
            "", // Bookshelves with positions
            shelf,
            book.review ?? "",
            "", // Spoiler
            book.bookNotes ?? "",
            shelf === "read" ? "1" : "0", // Read Count
            "0", // Owned Copies
        ];
        lines.push(row.map(csvField).join(","));
    }
    return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Anki deck (tab-separated text with Anki file-header directives)
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Fields are HTML (html:true) inside a tab-separated file: escape markup,
// turn newlines into <br>, and keep tabs out of the field entirely.
function ankiField(value: string): string {
    return escapeHtml(value).replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
}

// Anki tags are space-separated, so the book tag must not contain spaces.
function bookTag(title: string): string {
    const slug = title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "untitled";
}

export function buildAnkiTsv(books: ExportedBook[]): string {
    // File-header directives (Anki 2.1.54+): tab-separated, HTML fields, and
    // the third column holds the tags.
    const lines = ["#separator:tab", "#html:true", "#tags column:3"];

    for (const { book, words } of books) {
        const tag = `word-bank ${bookTag(book.title)}`;
        for (const word of words) {
            const front = word.phonetic
                ? `${ankiField(word.word)}<br><i>${ankiField(word.phonetic)}</i>`
                : ankiField(word.word);

            const backParts = [
                word.partOfSpeech
                    ? `<i>${ankiField(word.partOfSpeech)}</i> — ${ankiField(word.definition)}`
                    : ankiField(word.definition),
            ];
            if (word.sentence) {
                backParts.push(`<i>“${ankiField(word.sentence)}”</i>`);
            }
            if (word.notes) {
                backParts.push(ankiField(word.notes));
            }

            lines.push([front, backParts.join("<br><br>"), tag].join("\t"));
        }
    }
    return lines.join("\n") + "\n";
}

// How many cards buildAnkiTsv would produce — for the flow's empty-state check.
export function countWords(books: ExportedBook[]): number {
    return books.reduce((total, entry) => total + entry.words.length, 0);
}
