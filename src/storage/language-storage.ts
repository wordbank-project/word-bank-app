/* Saves and stores the selected dictionary language */

import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGUAGE_KEY = "dictionary_language";

/** The language code is a short identifier like "en" for English or "es" for Spanish.
 * We store it in AsyncStorage so the app remembers the user's choice across sessions.
 */
export async function setLanguageCode(code: string): Promise<void> {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
}

/* Returns the stored language code, or null if none is set or if there's an error accessing storage. 
* Based on that we pick the language from language.ts when looking up word definitions.
*/
export async function getLanguageCode(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(LANGUAGE_KEY);
    } catch {
        return null;
    }
}
