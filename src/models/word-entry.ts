/* One candidate meaning returned by the dictionary, as shown in the definition picker. */
export type WordDefinition = {
    partOfSpeech: string;
    definition: string;
    exampleSentence?: string; // a sample sentence from the dictionary, used as a placeholder text
};

export type WordEntry = {
    word: string;
    phonetic?: string;
    // The currently selected definition, denormalized for cheap display and so words
    // saved before this feature (no `definitions` array) still render.
    partOfSpeech: string;
    definition: string;
    exampleSentence?: string; // a sample sentence from the dictionary, used as a placeholder text
    definitions?: WordDefinition[]; // every meaning the dictionary returned
    selectedDefinition?: number;    // index into `definitions` that's currently shown
    sentence?: string;        // the user's own example sentence
    notes?: string;
    addedAt?: number;         // ms epoch when the word was added; drives the "Recently added" sort
    // The dictionary language code active when this word was added — lets a
    // later "translate to" lookup use the right source language even if the
    // user has since switched the book's dictionary language. Older words
    // saved before this field existed fall back to the current dictionary
    // language at read time.
    sourceLanguage?: string;
};

export type EditDraft = {
    sentence: string;
    notes: string;
};
