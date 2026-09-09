import AsyncStorage from "@react-native-async-storage/async-storage";

// Small helpers for reading/writing JSON in AsyncStorage, so each storage module
// doesn't repeat the parse + try/catch dance.

// Reads and parses a value, returning `fallback` if it's missing or unreadable.
export async function getJSON<T>(key: string, fallback: T): Promise<T> {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch (error) {
        console.error(`[storage] Failed to read "${key}":`, error);
        return fallback;
    }
}

// Serializes and stores a value.
export async function setJSON<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
}
