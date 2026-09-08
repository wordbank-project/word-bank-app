/** The result of analyzing a sentence, as returned by the server. */

export type SentenceAnalysis = {
    meaning: string;
};

/** One past analysis, as kept by storage/analysis-storage.ts. */
export type AnalysisHistoryEntry = {
    text: string;
    lang: string;
    analysis: SentenceAnalysis;
    createdAt: number;
};

/** How many past analyses storage/analysis-storage.ts keeps (newest first). Lives
 * here (not analysis-storage.ts) so storage/export-format.ts can re-cap a merged
 * import without importing an AsyncStorage-touching module. */
export const MAX_ANALYSES_ENTRIES = 20;
