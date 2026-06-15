import type { SrsGrade, SrsState } from "@/models/srs";

const DAY_MS = 24 * 60 * 60 * 1000;

// Leitner ladder: a correct recall promotes the word to the next box (a longer
// interval); a miss drops it back to the first box. Days until next review per box.
export const INTERVALS_DAYS = [1, 3, 7, 16, 35];

// Pure transition: given the current state (or undefined for a brand-new word) and a
// grade, return the next state. `now` is injected so it's deterministic to test.
export function gradeWord(state: SrsState | undefined, grade: SrsGrade, now: number = Date.now()): SrsState {
    const currentBox = state?.box ?? 0;
    const nextBox = grade === 'got'
        ? Math.min(currentBox + 1, INTERVALS_DAYS.length - 1)
        : 0;
    return {
        box: nextBox,
        dueAt: now + INTERVALS_DAYS[nextBox] * DAY_MS,
        reps: (state?.reps ?? 0) + 1,
        lastReviewedAt: now,
    };
}
