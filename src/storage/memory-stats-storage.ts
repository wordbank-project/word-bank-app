import { getJSON, setJSON } from "@/storage/storage";

// Saves and restores the Memory tab's per-word practice counters: how many
// times a word has been marked "Still learning" vs. "Knew it", across every
// session (unlike memory-words.tsx's own knownThisSession, which is
// in-memory-only and resets on app restart). Lightweight counters only — no
// interval/ease-factor/due-date scheduling, no spaced repetition.

export type WordStat = {
    stillLearning: number;
    knewIt: number;
    lastReviewedAt: number;
};

const MEMORY_STATS_KEY = "memory_word_stats";

/**
 * Reads back every word's saved practice counters.
 *
 * @returns {Promise<Record<string, WordStat>>} A map of lowercased word text to its
 * counters, or `{}` if nothing has been recorded yet or the value is unreadable.
 *
 */
export async function getMemoryStats(): Promise<Record<string, WordStat>> {
    return getJSON<Record<string, WordStat>>(MEMORY_STATS_KEY, {});
}

/**
 * Overwrites every saved practice counter at once. Used by seed-test-data.ts
 * to generate realistic stats in bulk; `recordRating` is the incremental,
 * one-word-at-a-time counterpart used during real practice.
 *
 * @param {Record<string, WordStat>} stats The full map of lowercased word text to its counters.
 * @returns {Promise<void>} Resolves once the value has been written.
 *
 */
export async function setMemoryStats(stats: Record<string, WordStat>): Promise<void> {
    await setJSON(MEMORY_STATS_KEY, stats);
}

/**
 * Records one rating for a word: increments its "Still learning" or "Knew it"
 * counter (creating an entry if this is the word's first rating) and stamps
 * `lastReviewedAt`. used in memory-words.tsx when rating a card
 *
 * @param {string} word The rated word, as shown on the flashcard (any casing/whitespace).
 * @param {boolean} knew Whether the word was marked "Knew it" means `true` and "Still learning" means `false`.
 * @returns {Promise<void>} Resolves once the updated counters have been written.
 *
 */
export async function recordRating(word: string, knew: boolean): Promise<void> {
    const key = word.trim().toLowerCase();
    const memoryStats = await getMemoryStats();

    // existing word stat object, we check if it exists already otherwise start at 0 everything
    const existingWordStat: WordStat = memoryStats[key] ?? { stillLearning: 0, knewIt: 0, lastReviewedAt: 0 };

    // We create a new memory stats object and save it.
    // Logic:
    // Exactly one counter goes up by 1 per call, based on which answer was given —
    // the other counter gets +0, i.e. is left exactly as it was. 
    // Neither counter is ever decreased; both only ever climb or hold steady over time.
    //   knew = true  -> knewIt +1,        stillLearning +0 (unchanged)
    //   knew = false -> knewIt +0 (unchanged), stillLearning +1
    memoryStats[key] = {
        stillLearning: existingWordStat.stillLearning + (knew ? 0 : 1),
        knewIt: existingWordStat.knewIt + (knew ? 1 : 0),
        lastReviewedAt: Date.now(),
    };
    await setJSON(MEMORY_STATS_KEY, memoryStats);
}

/**
 * Clears every saved practice counter. Used by "Delete all data" — stats for
 * words no longer saved anywhere aren't meaningful to keep around.
 *
 * @returns {Promise<void>} Resolves once the stored counters have been removed.
 *
 */
export async function clearMemoryStats(): Promise<void> {
    await setJSON(MEMORY_STATS_KEY, {});
}
