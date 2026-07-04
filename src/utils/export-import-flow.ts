import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { router } from "expo-router";
import { Platform } from "react-native";

import {
    applyImport,
    buildExport,
    ExportFileError,
    parseExport,
    type ImportMode,
    type WordBankExport,
} from "@/storage/export-import";
import { alertDialog } from "@/utils/alert-dialog";
import { dateStamp, deliverTextFile } from "@/utils/deliver-text-file";
import { showActionSheet } from "@/utils/show-action-sheet";

// The imperative flows behind More → "Your data" → Export/Import Books.
// Data handling lives in storage/export-import.ts; this file only does file
// I/O and the dialogs around it.

function count(n: number, singular: string): string {
    return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

// Snapshots the library to a JSON file and hands it to the OS share sheet
// (save to Files/Drive, mail it, etc.).
export async function exportBooks(): Promise<void> {
    try {
        const data = await buildExport();
        if (data.books.length === 0) {
            alertDialog("Nothing to export yet", "Save a book first — then you can back it up here.");
            return;
        }

        await deliverTextFile(
            `word-bank-export-${dateStamp()}.json`,
            JSON.stringify(data, null, 2),
            "application/json",
            "Export Word Bank books",
        );
    } catch {
        alertDialog("Export failed", "Something went wrong while creating the backup. Please try again.");
    }
}

async function runImport(data: WordBankExport, mode: ImportMode, skipped: number): Promise<void> {
    try {
        const result = await applyImport(data, mode);
        const summary =
            mode === "replace"
                ? `Restored ${count(result.booksAdded, "book")} and ${count(result.wordsAdded, "word")}.`
                : `Added ${count(result.booksAdded, "new book")} and ${count(result.wordsAdded, "new word")}.`;
        const skippedNote =
            skipped > 0
                ? skipped === 1
                    ? " 1 unreadable entry was skipped."
                    : ` ${skipped} unreadable entries were skipped.`
                : "";
        alertDialog("Import complete", summary + skippedNote);
        router.navigate("/(tabs)/read-list");
    } catch {
        alertDialog("Import failed", "Something went wrong while importing. Your data may be incomplete — try importing again.");
    }
}

// Picks an export file, validates it, and asks how to apply it (merge/replace).
export async function importBooks(): Promise<void> {
    try {
        const picked = await DocumentPicker.getDocumentAsync({
            // Android file managers often report .json as octet-stream or text.
            type: ["application/json", "application/octet-stream", "text/plain"],
            copyToCacheDirectory: true,
            multiple: false,
        });
        if (picked.canceled || !picked.assets?.[0]) {
            return;
        }

        const uri = picked.assets[0].uri;
        const json = Platform.OS === "web" ? await (await fetch(uri)).text() : await new File(uri).text();
        const { data, skipped } = parseExport(json);
        if (data.books.length === 0) {
            alertDialog("Nothing to import", "That backup doesn't contain any books.");
            return;
        }

        const wordCount = data.books.reduce((total, entry) => total + entry.words.length, 0);
        showActionSheet(
            "Import books",
            `Found ${count(data.books.length, "book")} and ${count(wordCount, "word")}. How do you want to import them?`,
            [
                { text: "Merge with existing", onPress: () => void runImport(data, "merge", skipped) },
                {
                    text: "Replace everything",
                    style: "destructive",
                    onPress: () => void runImport(data, "replace", skipped),
                },
                { text: "Cancel", style: "cancel" },
            ],
        );
    } catch (error) {
        alertDialog(
            "Import failed",
            error instanceof ExportFileError
                ? error.message
                : "Something went wrong while reading that file. Nothing was changed.",
        );
    }
}
