import AsyncStorage from "@react-native-async-storage/async-storage";

import { getJSON, setJSON } from "@/storage/storage";

// Saves and restores the Memory tab's daily practice reminder settings

export type ReminderTime = { hour: number, minute: number }

// How many words a Memory round can be — any positive count, or "all" for
// every word in the pool. 
export type RoundSize = number | "all";
export const ROUND_SIZE_OPTIONS: { value: RoundSize; label: string }[] = [
    { value: 5, label: "5" },
    { value: 10, label: "10" },
    { value: 20, label: "20" },
    { value: "all", label: "All" },
];

const NOTIFICATIONS_ENABLED_KEY = "daily_reminder_enabled";
const REMINDER_TIME_KEY = "daily_reminder_time";
const REMINDER_WORD_COUNT_KEY = "daily_reminder_word_count";

/**
 * Reads back whether the daily reminder is turned on.
 *
 * @returns {Promise<boolean>} `true` if enabled, `false` otherwise (including if
 * nothing has been saved yet, or the value is unreadable).
 *
 */
export async function areNotificationsEnabled(): Promise<boolean> {
    try {
        return (await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY)) === "true";
    } catch {
        return false;
    }
}

/**
 * Saves whether the daily reminder should be turned on.
 *
 * @param {boolean} enabled Whether the reminder is enabled.
 * @returns {Promise<void>} Resolves once the value has been written.
 *
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? "true" : "false");
}

/**
 * Reads back the saved reminder time.
 *
 * @returns {Promise<ReminderTime | null>} The saved time, or
 * `null` if none is set yet (the caller falls back to a default of its own).
 *
 */
export async function getReminderTime(): Promise<ReminderTime | null> {
    return getJSON<ReminderTime | null>(REMINDER_TIME_KEY, null);
}

/**
 * Saves the time the daily reminder should fire.
 *
 * @param {number} hour The hour (0–23, local device time) the reminder fires.
 * @param {number} minute The minute (0–59) the reminder fires.
 * @returns {Promise<void>} Resolves once the value has been written.
 *
 */
export async function setReminderTime(hour: number, minute: number): Promise<void> {
    await setJSON(REMINDER_TIME_KEY, { hour, minute });
}

/**
 * Reads back the saved reminder word-count target.
 *
 * @returns {Promise<RoundSize | null>} The saved target, or `null` if none is
 * set yet (the caller falls back to a default of its own).
 *
 */
export async function getReminderWordCount(): Promise<RoundSize | null> {
    return getJSON<RoundSize | null>(REMINDER_WORD_COUNT_KEY, null);
}

/**
 * Saves the word-count target shown in the reminder's default (pre-first-round) text.
 *
 * @param {RoundSize} count The word-count target ("all" for the whole pool).
 * @returns {Promise<void>} Resolves once the value has been written.
 *
 */
export async function setReminderWordCount(count: RoundSize): Promise<void> {
    await setJSON(REMINDER_WORD_COUNT_KEY, count);
}
