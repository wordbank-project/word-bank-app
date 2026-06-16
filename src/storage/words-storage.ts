import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WordEntry } from "@/models/word-entry";
import { getJSON, setJSON } from "@/storage/storage";

export type { WordEntry, EditDraft } from "@/models/word-entry";

function wordKey(bookKey: string): string {
    return `words_${bookKey}`;
}

export async function getWords(bookKey: string): Promise<WordEntry[]> {
    return getJSON<WordEntry[]>(wordKey(bookKey), []);
}

export async function setWords(bookKey: string, words: WordEntry[]): Promise<void> {
    await setJSON(wordKey(bookKey), words);
}

// Removes the word collections for the given books in a single storage call.
export async function removeWords(bookKeys: string[]): Promise<void> {
    if (bookKeys.length === 0) {
        return;
    }
    await AsyncStorage.multiRemove(bookKeys.map(wordKey));
}

// Counts words for many books at once. Uses multiGet so it's a single storage
// read instead of one per book — keeps the Read List fast as it grows.
export async function getWordCounts(bookKeys: string[]): Promise<Record<string, number>> {
    if (bookKeys.length === 0) {
        return {};
    }
    const pairs = await AsyncStorage.multiGet(bookKeys.map(wordKey));
    const counts: Record<string, number> = {};
    pairs.forEach(([, raw], i) => {
        try {
            counts[bookKeys[i]] = raw ? (JSON.parse(raw) as unknown[]).length : 0;
        } catch {
            counts[bookKeys[i]] = 0;
        }
    });
    return counts;
}
