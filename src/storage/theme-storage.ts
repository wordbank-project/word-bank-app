/* Saves and restores the user's light/dark theme choice across sessions. */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ColorScheme } from "@/models/theme";

const THEME_KEY = "app_theme";

// Returns the saved theme, or null if none is set (so the caller can fall back to the system theme).
export async function getTheme(): Promise<ColorScheme | null> {
    try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        return saved === "light" || saved === "dark" ? saved : null;
    } catch {
        return null;
    }
}

export async function setTheme(scheme: ColorScheme): Promise<void> {
    await AsyncStorage.setItem(THEME_KEY, scheme);
}
