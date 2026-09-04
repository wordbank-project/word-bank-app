import { getJSON, setJSON } from "@/storage/storage";

// Tracks which "don't show again" alerts (see utils/alert-dialog.ts's
// DontShowAgainOptions) the user has permanently dismissed, keyed by a
// caller-supplied stable id. A UI preference, not book data — left intact by
// clearAllBookData, same as theme/language.

const DISMISSED_ALERTS_KEY = "dismissed_alert_ids";

/**
 * Checks whether the user previously checked "don't show again" for a given alert.
 *
 * @param {string} id Stable identifier for the alert (e.g. "export-data").
 *
 * @returns {Promise<boolean>} `true` if the alert should stay suppressed.
 *
 */
export async function isAlertDismissed(id: string): Promise<boolean> {
    const dismissed = await getJSON<string[]>(DISMISSED_ALERTS_KEY, []);
    return dismissed.includes(id);
}

/**
 * Records that the user checked "don't show again" for a given alert.
 *
 * @param {string} id Stable identifier for the alert.
 *
 * @returns {Promise<void>} Resolves once persisted.
 *
 */
export async function dismissAlert(id: string): Promise<void> {
    const dismissed = await getJSON<string[]>(DISMISSED_ALERTS_KEY, []);
    if (!dismissed.includes(id)) {
        await setJSON(DISMISSED_ALERTS_KEY, [...dismissed, id]);
    }
}
