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
