import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";

type ColorScheme = "light" | "dark";

type ThemeContextType = {
    colorScheme: ColorScheme;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
    colorScheme: "light",
    toggleTheme: () => { },
});

const THEME_STORAGE_KEY = "app_theme";

export function AppThemeProvider({ children }: { children: ReactNode }) {
    const system = useSystemColorScheme() ?? "light";
    const [colorScheme, setColorScheme] = useState<ColorScheme>(system);
    useEffect(() => {
        AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
            if (saved === "light" || saved === "dark") setColorScheme(saved);
        });
    }, []);

    function toggleTheme() {
        const next: ColorScheme = colorScheme === "light" ? "dark" : "light";
        setColorScheme(next);
        AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    }

    return (
        <ThemeContext.Provider value={{ colorScheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

export function useColorScheme(): ColorScheme {
    return useContext(ThemeContext).colorScheme;
}
