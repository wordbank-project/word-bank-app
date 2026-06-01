export type WordEntry = {
    word: string;
    phonetic?: string;
    partOfSpeech: string;
    definition: string;
    sentence?: string;        // the user's own example sentence
    exampleSentence?: string; // a sample sentence from the dictionary, used as a placeholder text
    notes?: string;
};

export type EditDraft = {
    sentence: string;
    notes: string;
};
