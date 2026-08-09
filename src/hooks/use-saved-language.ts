import { useEffect, useState } from 'react';

import { Language, LANGUAGES } from '@/models/language';
import { getLanguageCode, setLanguageCode } from '@/storage/language-storage';

export type SavedLanguage = {
    language: Language;
    languageReady: boolean;
    setLanguage: (language: Language) => void;
};

/**
 * Restores the saved dictionary language from AsyncStorage on mount, and persists it back
 * whenever it's changed via the returned setter.
 *
 * @returns {SavedLanguage} `language` (LANGUAGES[0] until restored), `languageReady` (true once
 * the mount-time restore has resolved), and `setLanguage` (updates state and persists the choice).
 *
 */
export function useSavedLanguage(): SavedLanguage {
    const [language, setLanguageState] = useState<Language>(LANGUAGES[0]); // defaults to the first language in array
    const [languageReady, setLanguageReady] = useState<boolean>(false);

    useEffect(() => {
        getLanguageCode().then((code) => {
            const savedLanguage = code ? LANGUAGES.find(language => language.code === code) : undefined;
            if (savedLanguage) {
                setLanguageState(savedLanguage);
            }
            setLanguageReady(true);
        });
    }, []);

    function setLanguage(language: Language): void {
        setLanguageState(language);
        setLanguageCode(language.code);
    }

    return { language, languageReady, setLanguage };
}
