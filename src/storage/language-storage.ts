/* Saves and stores the selected dictionary language */

import AsyncStorage from "@react-native-async-storage/async-storage";

// Saves and restores the selected dictionary language, and the separate
// "translate to" language preference for the book screen's translation feature.

const LANGUAGE_KEY = "dictionary_language";

/**
 * Persists the chosen dictionary language.
 *
 * @param {string} code The language code to save, e.g. "en" for English or "es" for Spanish.
 * @returns {Promise<void>} Resolves once the value has been written.
 *
 */
export async function setLanguageCode(code: string): Promise<void> {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
}

/**
 * Reads back the saved dictionary language code, used to pick the matching
 * `Language` from `models/language.ts` when looking up word definitions.
 *
 * @returns {Promise<string | null>} The saved language code, or `null` if none is set or unreadable.
 *
 */
export async function getLanguageCode(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(LANGUAGE_KEY);
    } catch {
        return null;
    }
}
