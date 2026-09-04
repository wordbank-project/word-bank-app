import { getJSON, setJSON } from "@/storage/storage";
import type { RoundSize } from "@/storage/notifications-storage";

// Saves and restores the Memory tab's in-session practice round size.

const ROUND_SIZE_KEY = "memory_round_size";

/**
 * Reads back the saved practice round size.
 *
 * @returns {Promise<RoundSize | null>} The saved size, or `null` if none is
 * set yet (the caller falls back to a default of its own).
 *
 */
export async function getRoundSize(): Promise<RoundSize | null> {
    return getJSON<RoundSize | null>(ROUND_SIZE_KEY, null);
}

/**
 * Saves the chosen practice round size.
 *
 * @param {RoundSize} size The round size to save ("all" for the whole pool).
 * @returns {Promise<void>} Resolves once the value has been written.
 *
 */
export async function setRoundSize(size: RoundSize): Promise<void> {
    await setJSON(ROUND_SIZE_KEY, size);
}
