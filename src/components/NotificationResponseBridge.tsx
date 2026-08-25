import { useEffect } from "react";
import { Platform } from "react-native";

import { router } from "expo-router";
import * as Notifications from "expo-notifications";

// Root-mounted (in _layout.tsx) bridge with no UI: routes to the screen a
// tapped local notification's payload points at, covering both a live tap
// while the app is running/backgrounded and a cold start launched by the tap.
// Native-only — expo-notifications' response listener and last-response APIs
// have no web implementation, mirroring the guard in daily-reminder.ts.

/**
 * Routes to the screen a tapped notification's payload identifies, based on
 * the `type` tag set when the notification was scheduled (see
 * scheduleDailyReminder in daily-reminder.ts). Unknown/missing types are
 * ignored so an untagged or future notification kind never navigates blindly.
 *
 * @param {Notifications.NotificationResponse} response The tapped notification's response.
 * @returns {void} nothing
 *
 */
function handleResponse(response: Notifications.NotificationResponse): void {
    const type = response.notification.request.content.data?.type;
    if (type === "daily-reminder") {
        router.push("/memory-words");
    }
}

/**
 * Wires up notification-tap navigation for the whole app. Renders nothing.
 *
 * @returns {null} always — this component has no UI, only side effects.
 *
 */
export default function NotificationResponseBridge() {
    useEffect(() => {
        // Not on web
        if (Platform.OS === "web") {
            return;
        }

        // Cold start: the app was launched by tapping a notification.
        const lastResponse = Notifications.getLastNotificationResponse();
        if (lastResponse) {
            handleResponse(lastResponse);
            Notifications.clearLastNotificationResponse();
        }

        // Taps while the app is already foregrounded or backgrounded.
        const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
        return () => subscription.remove();
    }, []);

    return null;
}
