// Pure helpers for the words-added streak and daily goal. Everything is
// computed locally from the words' `addedAt` timestamps — no network, no new
// stored state — so the streak works offline and costs nothing in privacy.

/** Local-timezone calendar key for a timestamp, e.g. "2026-07-05". */
export function dayKey(ts: number): string {
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Consecutive days with at least one word added, counting back from today —
 * or from yesterday when today has no words yet, so an unbroken streak isn't
 * shown as 0 at breakfast before the user adds anything.
 */
export function computeStreak(timestamps: number[], now: number = Date.now()): number {
    const days = new Set(timestamps.map(dayKey));
    if (days.size === 0) {
        return 0;
    }
    // Anchor on today if it has words, otherwise on yesterday.
    let cursor = now;
    if (!days.has(dayKey(cursor))) {
        cursor -= DAY_MS;
        if (!days.has(dayKey(cursor))) {
            return 0;
        }
    }
    let streak = 0;
    while (days.has(dayKey(cursor))) {
        streak += 1;
        cursor -= DAY_MS;
    }
    return streak;
}

/** How many words were added today (local time). */
export function countToday(timestamps: number[], now: number = Date.now()): number {
    const today = dayKey(now);
    return timestamps.filter((ts) => dayKey(ts) === today).length;
}
