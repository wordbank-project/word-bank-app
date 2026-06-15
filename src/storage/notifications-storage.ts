/* Saves and restores the daily word-review notification settings. */

import { getJSON, setJSON } from "@/storage/storage";

export type NotificationSettings = {
    enabled: boolean;
    wordsPerDay: number;
    timeMinutes: number; // minutes past midnight, local time (e.g. 9*60 = 09:00)
};

const NOTIFICATION_SETTINGS_KEY = "notification_settings";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    enabled: false,
    wordsPerDay: 10,
    timeMinutes: 9 * 60,
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
    // Merge over defaults so older saved blobs missing a field still resolve cleanly.
    const saved = await getJSON<Partial<NotificationSettings>>(NOTIFICATION_SETTINGS_KEY, {});
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...saved };
}

export async function setNotificationSettings(settings: NotificationSettings): Promise<void> {
    await setJSON(NOTIFICATION_SETTINGS_KEY, settings);
}
