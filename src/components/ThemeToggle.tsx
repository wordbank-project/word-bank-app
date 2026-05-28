import { Colors } from "@/styles/global";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "../context/theme-context";

import IconSymbol from "./ui/IconSymbol";

export default function ThemeToggle() {
    const { colorScheme, toggleTheme } = useTheme();
    return (
        <Pressable
            onPress={toggleTheme}
            style={styles.button}
            hitSlop={10}
        >
            <IconSymbol
                name={colorScheme === "dark" ? "sun.max.fill" : "moon.fill"}
                size={22}
                color={Colors[colorScheme].icon}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        marginRight: 16,
        padding: 2,
    },
});
