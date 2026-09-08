// The info the book detail screen needs to open. All strings, since they go
// through navigation params.
export type BookNavParams = {
    key: string;
    title: string;
    author: string;
    year: string;
    cover_i: string;
    // Optional: a word to scroll to and highlight once the book screen lays out
    // (sent by the Words List, where you tap a specific word).
    focusWord?: string;
};
