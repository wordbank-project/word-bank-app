import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { Appearance, Platform, useColorScheme as useSystemColorScheme } from "react-native";

import { getTheme, setTheme } from "@/storage/theme-storage";

import type { ColorScheme } from "@/models/theme";

type ThemeContextType = {
    colorScheme: ColorScheme;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
    colorScheme: "light",
    toggleTheme: () => { },
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
    const system: ColorScheme = useSystemColorScheme() === 'dark' ? 'dark' : 'light';
    const [colorScheme, setColorScheme] = useState<ColorScheme>(system);
    useEffect(() => {
        // Restore the saved theme on launch; keep the system default if none saved.
        getTheme().then((saved) => {
            if (saved) {
                setColorScheme(saved);
            }
        });
    }, []);

    // Drive the color scheme from the app's (persisted) choice so the theme tokens
    // follow the manual toggle, not the OS.
    // - Native: `Appearance.setColorScheme` (missing on react-native-web, so `?.`).
    // - Web: that call no-ops, so also reflect the choice onto `<html data-theme>`,
    //   which global.css honors to override the prefers-color-scheme media query.
    useEffect(() => {
        Appearance.setColorScheme?.(colorScheme);
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            document.documentElement.dataset.theme = colorScheme;
        }
    }, [colorScheme]);

    function toggleTheme(): void {
        const next: ColorScheme = colorScheme === "light" ? "dark" : "light";
        setColorScheme(next);
        setTheme(next); // persist the choice to device storage
    }

    return (
        <ThemeContext.Provider value={{ colorScheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextType {
    return useContext(ThemeContext);
}

export function useColorScheme(): ColorScheme {
    return useContext(ThemeContext).colorScheme;
}
