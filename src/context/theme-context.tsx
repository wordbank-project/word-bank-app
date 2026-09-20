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

/**
 * Picks the color scheme to render with on the very first client render.
 *
 * On native this is just the live OS appearance. On web it prefers
 * `<html data-theme>`, which `src/app/+html.tsx`'s inline script already set
 * — synchronously, before this component ever ran — over `system`
 * (`useSystemColorScheme()`). Both usually agree once hydration is actually
 * running in a real browser, but seeding straight from the pre-set attribute
 * means `colorScheme` is correct on the very first render, with no later
 * correction needed — which matters for header/tab-bar text and tint colors
 * (see (tabs)/_layout.tsx): those are plain JS values, not CSS, so a late
 * correction doesn't just repaint quietly, it visibly collides with React
 * Navigation's own header-title transition animation (confirmed: forcing a
 * remount to pick up a late correction caused overlapping/garbled title text
 * during a tab switch — reverted in favor of this, which avoids needing a
 * correction in the first place).
 *
 * @param {ColorScheme} system The live OS appearance (`useSystemColorScheme()`).
 * @returns {ColorScheme} The color scheme to seed `useState` with.
 *
 */
function getInitialColorScheme(system: ColorScheme): ColorScheme {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
        return system;
    }
    const fromHtml = document.documentElement.dataset.theme;
    return fromHtml === 'light' || fromHtml === 'dark' ? fromHtml : system;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
    const system: ColorScheme = useSystemColorScheme() === 'dark' ? 'dark' : 'light';
    const [colorScheme, setColorScheme] = useState<ColorScheme>(() => getInitialColorScheme(system));
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
        // persist the choice to device storage
        setTheme(next)
            .catch((error) => (console.error(error)));
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
