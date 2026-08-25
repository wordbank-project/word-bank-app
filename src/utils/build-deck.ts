import type { RoundSize } from "@/storage/notifications-storage";
import type { WordWithBook } from "@/storage/read-list-storage";

import { shuffle } from "@/utils/random";

// Builds the Memory tab's practice-round deck from the saved-word pool (all words in the app).

/**
 * Builds a fresh round from the current word pool, capped at the chosen round
 * size (or the whole pool for "all"). Words not yet marked "Knew it" this
 * session are shuffled in first; already-known words only fill in the
 * remaining slots, so repeated rounds naturally surface different words
 * before circling back to ones you've already got.
 *
 * @param {WordWithBook[]} words The full saved-word pool to draw from.
 * @param {RoundSize} size How many words this round should have ("all" = every word).
 * @param {Set<string>} knownThisSession Lowercased word text marked "Knew it" so far this session.
 * @returns {WordWithBook[]} This round's deck, not-yet-known words first.
 *
 */
export function buildDeck(words: WordWithBook[], size: RoundSize, knownThisSession: Set<string>): WordWithBook[] {
    const isKnown = (word: WordWithBook) => knownThisSession.has(word.word.trim().toLowerCase());
    const combined = [...shuffle(words.filter((w) => !isKnown(w))), ...shuffle(words.filter(isKnown))];
    return size === "all" ? combined : combined.slice(0, size);
}
