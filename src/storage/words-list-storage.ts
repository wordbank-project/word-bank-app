import AsyncStorage from "@react-native-async-storage/async-storage";

// Saves and restores the Words List's persisted sort choice.

export type SortMode = 'az' | 'za' | 'book' | 'recent';
export const SORT_MODES: SortMode[] = ['az', 'za', 'book', 'recent'];

const SORT_MODE_KEY = "words_list_sort";

/**
 * Reads back the saved sort mode.
 *
 * @returns {Promise<SortMode | null>} The saved sort mode, or `null` if none is set
 * (or the value is unreadable/invalid) so the caller can fall back to the default.
 *
 */
export async function getSortMode(): Promise<SortMode | null> {
    try {
        const saved = await AsyncStorage.getItem(SORT_MODE_KEY);
        return SORT_MODES.includes(saved as SortMode) ? (saved as SortMode) : null;
    } catch {
        return null;
    }
}

/**
 * Saves the chosen sort mode.
 *
 * @param {SortMode} mode The sort mode to save.
 * @returns {Promise<void>} Resolves once the value has been written.
 *
 */
export async function setSortMode(mode: SortMode): Promise<void> {
    await AsyncStorage.setItem(SORT_MODE_KEY, mode);
}
