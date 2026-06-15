import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SrsGrade, SrsState } from "@/models/srs";
import { getJSON, setJSON } from "@/storage/storage";
import { gradeWord } from "@/utils/srs";

export type { SrsState, SrsGrade } from "@/models/srs";

// One map per book — { word: SrsState } — parallel to words_<bookKey>. Keyed by the
// word string (unique within a book) so it survives reordering/removal of words.
export type SrsMap = Record<string, SrsState>;

function srsKey(bookKey: string): string {
    return `srs_${bookKey}`;
}

export async function getSrs(bookKey: string): Promise<SrsMap> {
    return getJSON<SrsMap>(srsKey(bookKey), {});
}

export async function setSrs(bookKey: string, map: SrsMap): Promise<void> {
    await setJSON(srsKey(bookKey), map);
}

// Loads the SRS maps for many books at once (single multiGet), mirroring getWordCounts.
export async function getSrsMaps(bookKeys: string[]): Promise<Record<string, SrsMap>> {
    if (bookKeys.length === 0) {
        return {};
    }
    const pairs = await AsyncStorage.multiGet(bookKeys.map(srsKey));
    const maps: Record<string, SrsMap> = {};
    pairs.forEach(([, raw], i) => {
        try {
            maps[bookKeys[i]] = raw ? (JSON.parse(raw) as SrsMap) : {};
        } catch {
            maps[bookKeys[i]] = {};
        }
    });
    return maps;
}

// Grades one word and persists the updated map. Returns the new state.
export async function gradeAndPersist(bookKey: string, word: string, grade: SrsGrade): Promise<SrsState> {
    const map = await getSrs(bookKey);
    const next = gradeWord(map[word], grade);
    map[word] = next;
    await setSrs(bookKey, map);
    return next;
}

// Clears all review progress for a book.
export async function resetSrs(bookKey: string): Promise<void> {
    await AsyncStorage.removeItem(srsKey(bookKey));
}
