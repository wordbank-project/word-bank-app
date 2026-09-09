import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { Language } from "@/models/language";
import { LANGUAGES } from "@/models/language";
import { getLanguageCode, setLanguageCode } from "@/storage/language-storage";

export type SavedLanguage = {
    language: Language;
    languageReady: boolean;
    setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<SavedLanguage>({
    language: LANGUAGES[0],
    languageReady: false,
    setLanguage: () => { },
});

// Restores the saved dictionary language from AsyncStorage once, app-wide, and
// persists it back whenever it's changed via the returned setter — shared through
// context (rather than each screen's own useState) so a change made on one screen
// (e.g. book.tsx's LanguageModal) is reflected immediately everywhere else that
// reads it too (e.g. SearchBar.tsx), with no reload/remount needed.
export function AppLanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(LANGUAGES[0]);
    const [languageReady, setLanguageReady] = useState<boolean>(false);

    useEffect(() => {
        getLanguageCode().then((code) => {
            const savedLanguage = code ? LANGUAGES.find((l) => l.code === code) : undefined;
            if (savedLanguage) {
                setLanguageState(savedLanguage);
            }
            setLanguageReady(true);
        });
    }, []);

    /**
     * Updates the app-wide saved dictionary language, and persists it to AsyncStorage.
     *
     * @param {Language} language The new language to save.
     * @returns {void} Returns nothing. Setting the language state will trigger a re-render of all components that consume this context.
     *
     */
    function setLanguage(language: Language): void {
        setLanguageState(language);
        setLanguageCode(language.code);
    }

    return (
        <LanguageContext.Provider value={{ language, languageReady, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
}

/**
 * Reads (and can update) the app-wide saved dictionary language.
 *
 * @returns {SavedLanguage} `language` (LANGUAGES[0] until restored), `languageReady`
 * (true once the app-launch restore has resolved), and `setLanguage` (updates it
 * everywhere and persists the choice).
 *
 */
export function useSavedLanguage(): SavedLanguage {
    return useContext(LanguageContext);
}
