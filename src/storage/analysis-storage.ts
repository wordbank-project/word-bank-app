import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AnalysisHistoryEntry, SentenceAnalysis } from "@/models/sentence-analysis";

import { getJSON, setJSON } from "@/storage/storage";

// Saves and restores the user's sentence analyses history across sessions.

const ANALYSES_KEY = "sentence_analyses";

const MAX_ANALYSES_ENTRIES = 20;

/**
 * Reads back the past analyses, newest first.
 *
 * @returns {Promise<AnalysisHistoryEntry[]>} The list of entries (newest first, capped), or `[]` if none or unreadable.
 *
 */
export async function getAnalysisHistory(): Promise<AnalysisHistoryEntry[]> {
    return getJSON<AnalysisHistoryEntry[]>(ANALYSES_KEY, []);
}

/**
 * Prepends an analysis and returns the new list (newest first, capped).
 * Re-analyzing the same sentence in the same language moves the existing entry
 * to the top instead of duplicating it.
 *
 * @param {string} text The analyzed sentence.
 * @param {string} lang The language code of the sentence.
 * @param {SentenceAnalysis} analysis The AI's analysis of the sentence.
 * @returns {Promise<AnalysisHistoryEntry[]>} The new list of entries (newest first, capped).
 *
 */
export async function addAnalysis(text: string, lang: string, analysis: SentenceAnalysis): Promise<AnalysisHistoryEntry[]> {
    const existing = await getAnalysisHistory();
    const entry: AnalysisHistoryEntry = { text, lang, analysis, createdAt: Date.now() };
    const deduped = existing.filter(
        (item) => !(item.lang === lang && item.text.toLowerCase() === text.toLowerCase()),
    );
    const next = [entry, ...deduped].slice(0, MAX_ANALYSES_ENTRIES);
    await setJSON(ANALYSES_KEY, next);
    return next;
}

/**
 * Removes one entry by its createdAt timestamp and returns the new list.
 *
 * @param {number} createdAt The timestamp of the entry to remove.
 * @returns {Promise<AnalysisHistoryEntry[]>} The new list of entries (newest first, capped).
 *
 */
export async function removeAnalysis(createdAt: number): Promise<AnalysisHistoryEntry[]> {
    const next = (await getAnalysisHistory()).filter((item) => item.createdAt !== createdAt);
    await setJSON(ANALYSES_KEY, next);
    return next;
}

/**
 * Wipes the whole analysis history.
 * Only used in the "Clear history" button in the More tab, so the user can start fresh.
 * @returns {Promise<AnalysisHistoryEntry[]>} The cleared list (always `[]`).
 *
 */
export async function clearAnalysisHistory(): Promise<AnalysisHistoryEntry[]> {
    await AsyncStorage.removeItem(ANALYSES_KEY);
    return [];
}
