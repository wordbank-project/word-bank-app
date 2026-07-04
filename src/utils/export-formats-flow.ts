import { buildAnkiTsv, buildGoodreadsCsv, countWords } from "@/storage/export-formats";
import { buildExport } from "@/storage/export-import";
import { alertDialog } from "@/utils/alert-dialog";
import { dateStamp, deliverTextFile } from "@/utils/deliver-text-file";

// The flows behind More → "Your data" → the interchange exports. Format
// building lives in storage/export-formats.ts; this file only gathers the
// data and does the dialogs/file-delivery around it.

// Goodreads-format CSV of the read list — importable at
// goodreads.com/review/import and by StoryGraph, Hardcover, BookWyrm, & co.
export async function exportGoodreadsCsv(): Promise<void> {
    try {
        const data = await buildExport();
        if (data.books.length === 0) {
            alertDialog("Nothing to export yet", "Save a book first — then you can export your shelf here.");
            return;
        }

        await deliverTextFile(
            `word-bank-goodreads-${dateStamp()}.csv`,
            buildGoodreadsCsv(data.books.map((entry) => entry.book)),
            "text/csv",
            "Export shelf (Goodreads CSV)",
        );
    } catch {
        alertDialog("Export failed", "Something went wrong while creating the CSV. Please try again.");
    }
}

// All saved words as an Anki-importable deck file (File → Import in Anki).
export async function exportAnkiDeck(): Promise<void> {
    try {
        const data = await buildExport();
        if (countWords(data.books) === 0) {
            alertDialog("Nothing to export yet", "Save a word first — then you can turn your words into Anki cards here.");
            return;
        }

        await deliverTextFile(
            `word-bank-anki-${dateStamp()}.txt`,
            buildAnkiTsv(data.books),
            "text/plain",
            "Export words (Anki deck)",
        );
    } catch {
        alertDialog("Export failed", "Something went wrong while creating the deck. Please try again.");
    }
}
