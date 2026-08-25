import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { RoundSize } from "@/storage/notifications-storage";

import { alertDialog } from "@/utils/alert-dialog";

// Schedules/cancels the Memory tab's single daily practice-reminder notification —
// one fixed identifier, user-chosen time (persisted in notifications-storage.ts,
// passed in by the caller — this file has no default of its own). A round
// finishing re-schedules this same notification with fresh text (see
// rescheduleDailyReminder); there's no date-keyed daily-stats storage — just the
// latest round's numbers.
//
// Native-only: expo-notifications has no web implementation for local scheduling
// (only badge/push-token have .web shims) — every exported function here no-ops on
// web rather than throwing "not available on web". memory-words.tsx additionally
// hides the reminder toggle entirely on web, so these guards are defense-in-depth.

const DAILY_REMINDER_IDENTIFIER = "daily-reminder";
const ANDROID_CHANNEL_ID = "daily-reminder";

// Controls how a notification is presented while the app is foregrounded. Without
// this, a foreground reschedule (see rescheduleDailyReminder, called right when a
// round finishes) could otherwise pop a banner using platform defaults mid-summary.
// Skipped on web — the underlying native module isn't available there.
if (Platform.OS !== "web") {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
        }),
    });
}

/**
 * Creates the Android notification channel the daily reminder posts to. A no-op
 * on iOS/web. Must run before scheduling on Android, or the OS silently drops it.
 *
 * @returns {Promise<void>} Resolves once the channel exists (or immediately on non-Android).
 *
 */
async function ensureAndroidChannel(): Promise<void> {
    // Not on web and ios version
    if (Platform.OS !== "android") {
        return;
    }
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: "Daily practice reminder",
        importance: Notifications.AndroidImportance.DEFAULT,
    });
}

/**
 * The reminder's default (pre-first-round) body text for a given word-count
 * target. Overwritten with a real "knew X/Y" result once a round finishes
 * (see rescheduleDailyReminder below) — this is only what shows before the
 * first round of the day, or right after changing the time/target.
 *
 * @param {RoundSize} count The word-count target ("all" for the whole pool).
 * @returns {string} The notification body text.
 *
 */
export function defaultReminderBody(count: RoundSize): string {
    return count === "all" ? "Practice all your words today! 📚" : `Practice ${count} words today! 📚`;
}

/**
 * Requests notification permission if not already granted, showing a plain
 * alert (not a crash) if the user denies it or has previously denied it.
 * Always `false` on web — see the file header.
 *
 * @returns {Promise<boolean>} `true` if permission is granted, `false` otherwise.
 *
 */
export async function requestReminderPermission(): Promise<boolean> {
    // Not used on web version
    if (Platform.OS === "web") {
        return false;
    }
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) {
        return true;
    }
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.granted) {
        return true;
    }
    alertDialog(
        "Notifications permission needed",
        "Enable notifications in Settings to get a daily practice reminder.",
    );
    return false;
}

/**
 * Schedules (or replaces) the single daily reminder notification with the given
 * body text, firing every day at the given time. Cancels any previous instance
 * first so repeated calls never stack duplicate notifications.
 *
 * @param {string} body The notification body text to show.
 * @param {number} hour The hour (0–23, local device time) the reminder fires.
 * @param {number} minute The minute (0–59) the reminder fires.
 * @returns {Promise<void>} Resolves once the notification is scheduled, or immediately on web.
 *
 */
export async function scheduleDailyReminder(body: string, hour: number, minute: number): Promise<void> {
    // Not used on web version
    if (Platform.OS === "web") {
        return;
    }
    await ensureAndroidChannel();
    await cancelDailyReminder();
    await Notifications.scheduleNotificationAsync({
        identifier: DAILY_REMINDER_IDENTIFIER,
        content: {
            title: "Word Bank",
            body,
            // Lets NotificationResponseBridge route a tap to the right screen.
            data: { type: "daily-reminder" },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId: ANDROID_CHANNEL_ID,
        },
    });
}

/**
 * Re-schedules the daily reminder with fresh body text reflecting the
 * just-finished round's result, at the given time. Call this once, right when
 * a flashcard round ends. A no-op if the reminder isn't currently enabled.
 *
 * @param {boolean} enabled Whether the daily reminder is currently turned on.
 * @param {number} knewCount How many words the user marked "Knew it" this round.
 * @param {number} total How many words were in this round.
 * @param {number} hour The hour (0–23, local device time) the reminder fires.
 * @param {number} minute The minute (0–59) the reminder fires.
 * @returns {Promise<void>} Resolves once the reschedule completes (or immediately if disabled).
 *
 */
export async function rescheduleDailyReminder(
    enabled: boolean,
    knewCount: number,
    total: number,
    hour: number,
    minute: number,
): Promise<void> {
    if (!enabled) {
        return;
    }
    await scheduleDailyReminder(`You knew ${knewCount}/${total} words in your last practice — keep it up! 📚`, hour, minute);
}

/**
 * Cancels the daily reminder notification.
 *
 * @returns {Promise<void>} Resolves once cancellation completes, or immediately on web.
 *
 */
export async function cancelDailyReminder(): Promise<void> {
    // Not used on web version
    if (Platform.OS === "web") {
        return;
    }
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_IDENTIFIER).catch(() => { });
}
