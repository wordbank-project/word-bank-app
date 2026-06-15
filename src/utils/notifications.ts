import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { NotificationSettings } from "@/storage/notifications-storage";

const CHANNEL_ID = "daily-review";

// Call once at app startup so notifications surface while the app is foregrounded.
export function setupNotificationHandler(): void {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

// Android requires a channel before notifications display.
async function ensureAndroidChannel(): Promise<void> {
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: "Daily review",
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }
}

// Requests OS permission if not already granted. Returns whether it's granted.
export async function ensureNotificationPermission(): Promise<boolean> {
    await ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
        return true;
    }
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
}

// Reconciles the OS schedule with the saved settings: clears any existing daily
// reminder, then (re)schedules one repeating notification if enabled.
export async function syncNotifications(settings: NotificationSettings): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.enabled) {
        return;
    }
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
        content: {
            title: "Word Bank",
            body: "Time to review your words 📚 — tap to start",
            data: { screen: "review" },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: Math.floor(settings.timeMinutes / 60),
            minute: settings.timeMinutes % 60,
            channelId: CHANNEL_ID,
        },
    });
}
