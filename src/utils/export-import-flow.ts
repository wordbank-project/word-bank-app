import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { Platform } from "react-native";

import { ImportFormatError, parseImportFile } from "@/storage/export-format";
import { applyImport, buildExport, hasExistingData } from "@/storage/export-import";

import { alertDialog } from "@/utils/alert-dialog";
import { showActionSheet } from "@/utils/show-action-sheet";

import type { ExportedBook, ImportMode, ImportResult, SanitizedImport, WordBankExport } from "@/models/export-import";

// The imperative flows behind More → "Your data" → Export/Import Data: picking
// and writing the backup file, and the dialogs around it. Data handling lives
// in storage/export-import.ts (AsyncStorage) and storage/export-format.ts (the
// file format + validation) — this file only does file I/O and user prompts,
// so it's the one place that branches on web vs. native file access.

/**
 * Pluralizes a count for a summary line, e.g. count(1, "book") → "1 book".
 *
 * @param {number} n The count.
 * @param {string} singular The singular form of the noun.
 * @returns {string} The count and noun, pluralized if n isn't 1.
 *
 */
function count(n: number, singular: string): string {
    return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

/**
 * Pluralizes an analysis count — "analysis" doesn't take a plain "s"
 * ("analyses"), so it needs its own helper rather than count().
 *
 * @param {number} n The count.
 * @param {string} [prefix] An optional word before "analysis"/"analyses", e.g. "new ".
 * @returns {string} The count and noun, e.g. "1 analysis" or "2 new analyses".
 *
 */
function analysesCount(n: number, prefix: string = ""): string {
    return `${n} ${prefix}${n === 1 ? "analysis" : "analyses"}`;
}

/**
 * Builds today's backup filename.
 *
 * @returns {string} A date-stamped filename, e.g. "word-bank-backup-2026-08-12.json".
 *
 */
function exportFileName(): string {
    return `word-bank-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

/**
 * Web has no share sheet — trigger a plain browser download instead.
 *
 * @param {string} json The serialized backup.
 * @returns {void}
 *
 */
function downloadOnWeb(json: string): void {
    const url: string = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor: HTMLAnchorElement = document.createElement("a");
    anchor.href = url;
    anchor.download = exportFileName();
    anchor.click();
    URL.revokeObjectURL(url);
}

/**
 * Writes the export JSON to a cache file and hands it to the OS share sheet
 * (save to Files/Drive, mail it, etc.).
 *
 * @param {string} json The serialized backup.
 * @returns {Promise<void>} Resolves once the share sheet has been presented, or a "sharing unavailable" notice shown.
 *
 */
async function shareOnNative(json: string): Promise<void> {
    const file: File = new File(Paths.cache, exportFileName());
    file.create({ overwrite: true });
    file.write(json);

    if (!(await Sharing.isAvailableAsync())) {
        alertDialog("Sharing unavailable", `Your export was saved to:\n${file.uri}`);
        return;
    }
    await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Export Word Bank data",
        UTI: "public.json",
    });
}

/**
 * Snapshots the whole library — books, words, and sentence-analysis history —
 * to a JSON file and offers it for sharing (native) or downloads it (web).
 *
 * @returns {Promise<void>} Resolves once the share sheet/download has been triggered, or an empty-state/failure notice shown.
 *
 */
export async function exportData(): Promise<void> {
    try {
        const data: WordBankExport = await buildExport();
        if (data.books.length === 0 && data.analyses.length === 0 && data.memoryStats.length === 0) {
            alertDialog("Nothing to export yet", "Save a book, a word, analyze a sentence, or practice with Memory mode first — then you can back it up here.");
            return;
        }

        const json: string = JSON.stringify(data, null, 2);
        if (Platform.OS === "web") {
            downloadOnWeb(json);
            return;
        }
        await shareOnNative(json);
    } catch (error) {
        console.error(error);
        alertDialog("Export failed", "Something went wrong while creating the backup. Please try again.");
    }
}

/**
 * Reads the text of a picked document, on whichever platform picked it.
 *
 * @param {DocumentPicker.DocumentPickerAsset} asset The picked file.
 * @returns {Promise<string>} The file's contents as text.
 *
 */
async function readPickedFile(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
    if (Platform.OS === "web") {
        if (asset.file) {
            return asset.file.text();
        }
        return (await fetch(asset.uri)).text();
    }
    return new File(asset.uri).text();
}

/**
 * Applies a parsed import and shows a result summary, including any entries
 * skipped for being unreadable.
 *
 * @param {SanitizedImport} parsed The sanitized import data and skip counts.
 * @param {ImportMode} mode Which import mode the user chose.
 * @returns {Promise<void>} Resolves once the result alert has been shown.
 *
 */
async function runImport(parsed: SanitizedImport, mode: ImportMode): Promise<void> {
    try {
        const result: ImportResult = await applyImport(parsed.data, mode);
        const parts: string[] =
            mode === "replace"
                ? [
                    count(result.booksAdded, "book"),
                    count(result.wordsAdded, "word"),
                    analysesCount(result.analysesAdded),
                    count(result.memoryStatsAdded, "practice stat"),
                ]
                : [
                    count(result.booksAdded, "new book"),
                    count(result.wordsAdded, "new word"),
                    analysesCount(result.analysesAdded, "new "),
                    count(result.memoryStatsAdded, "new practice stat"),
                ];
        const skippedAmount: number = parsed.skippedBooks + parsed.skippedWords + parsed.skippedAnalyses + parsed.skippedMemoryStats;
        const skippedNote: string = skippedAmount > 0 ? ` ${count(skippedAmount, "unreadable entry")} skipped.` : "";
        alertDialog("Import complete", `${parts.join(", ")}.${skippedNote}`);
    } catch (error) {
        console.error(error);
        alertDialog("Import failed", "Something went wrong while importing. Your data may be incomplete — try importing again.");
    }
}

/**
 * Picks a Word Bank backup file, validates it, and asks how to apply it
 * (merge on top of existing data, or replace everything).
 *
 * @returns {Promise<void>} Resolves once the import has been applied, cancelled, or a failure notice shown.
 *
 */
export async function importData(): Promise<void> {
    try {
        const picked: DocumentPicker.DocumentPickerResult = await DocumentPicker.getDocumentAsync({
            // This just narrows what the OS file picker shows/allows selecting 
            // — three MIME types are accepted (not just application/json) because the comment
            // notes Android file managers often mis-report a .json file's type as application/octet-stream or text/plain. 
            // It's a UX filter, not a real validation — nothing stops the user from picking a non-JSON file with one of those three reported types.
            type: ["application/json", "application/octet-stream", "text/plain"],
            copyToCacheDirectory: true,
            multiple: false,
        });
        if (picked.canceled || !picked.assets?.[0]) {
            return;
        }

        const raw: string = await readPickedFile(picked.assets[0]);
        const parsed: SanitizedImport = parseImportFile(raw);
        const memoryStatsCount: number = parsed.data.memoryStats.length;
        if (parsed.data.books.length === 0 && parsed.data.analyses.length === 0 && memoryStatsCount === 0) {
            alertDialog("Nothing to import", "That backup doesn't contain any books, words, analyses, or practice stats.");
            return;
        }

        if (!(await hasExistingData())) {
            // Nothing on the device yet so just apply replace without asking
            await runImport(parsed, "replace");
            return;
        }

        const wordCount: number = parsed.data.books.reduce((total: number, entry: ExportedBook) => total + entry.words.length, 0);
        showActionSheet(
            "Import data",
            `Found ${count(parsed.data.books.length, "book")}, ${count(wordCount, "word")}, ${analysesCount(parsed.data.analyses.length, "sentence ")}, and ${count(memoryStatsCount, "practice stat")}. How do you want to import them?`,
            [
                { text: "Merge with existing", onPress: () => void runImport(parsed, "merge") },
                {
                    text: "Replace everything",
                    style: "destructive",
                    onPress: () => void runImport(parsed, "replace"),
                },
                { text: "Cancel", style: "cancel" },
            ],
        );
    } catch (error) {
        console.error(error);
        alertDialog(
            "Import failed",
            error instanceof ImportFormatError
                ? error.message
                : "Something went wrong while reading that file. Nothing was changed.",
        );
    }
}
