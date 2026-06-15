import { useEffect } from "react";

import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import { setupNotificationHandler } from "@/utils/notifications";

function isReviewResponse(response: Notifications.NotificationResponse | null): boolean {
    return response?.notification.request.content.data?.screen === "review";
}

// Configures the foreground handler and routes a tapped daily-review notification to the
// Review screen — both when the app is already running and when a tap cold-starts it.
export function useNotificationObserver(): void {
    useEffect(() => {
        setupNotificationHandler();
        let mounted = true;

        // Cold start: the tap that launched the app isn't delivered to the listener below.
        Notifications.getLastNotificationResponseAsync().then((response) => {
            if (mounted && isReviewResponse(response)) {
                router.push("/review");
            }
        });

        // Warm: tapped while the app was foregrounded or backgrounded.
        const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
            if (isReviewResponse(response)) {
                router.push("/review");
            }
        });

        return () => {
            mounted = false;
            subscription.remove();
        };
    }, []);
}
