/** One well-known book, structured — the server sends title/author/year apart
 * so clients never have to parse them back out of a formatted string. */
export type SuggestedBook = { title: string; author: string; year: string };

export type Suggestions = { words: string[]; books: SuggestedBook[], sentences: string[] };