import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { alertDialog } from "@/utils/alert-dialog";

// Hands a generated text file to the user: OS share sheet on iOS/Android
// (save to Files/Drive, mail it, …), plain browser download on web (no share
// sheet there). Shared by the JSON backup and the Goodreads/Anki exports.

// Today's date for export filenames, e.g. word-bank-export-2026-07-04.json.
export function dateStamp(): string {
    return new Date().toISOString().slice(0, 10);
}

function downloadOnWeb(contents: string, filename: string, mimeType: string): void {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export async function deliverTextFile(
    filename: string,
    contents: string,
    mimeType: string,
    dialogTitle: string,
): Promise<void> {
    if (Platform.OS === "web") {
        downloadOnWeb(contents, filename, mimeType);
        return;
    }

    const file = new File(Paths.cache, filename);
    file.write(contents);
    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
    } else {
        alertDialog("Sharing unavailable", `Your export was saved to:\n${file.uri}`);
    }
}
