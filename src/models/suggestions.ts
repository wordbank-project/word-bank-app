// Built-in fallback lists for the typewriter placeholder suggestions.
// These render at startup and stay whenever the network upgrades fail
// (AI suggestions endpoint, trending-words feed) — the app must work fully
// offline. See hooks/use-suggestions.ts for the fallback chain.

// Shown in the add-word field on the book screen (was RANDOM_WORDS there).
export const FALLBACK_WORDS = [
    "serendipity",
    "ephemeral",
    "melancholy",
    "resilience",
    "eloquent",
    "ambiguous",
    "tenacious",
    "vivid",
    "profound",
    "meticulous",
    "candid",
    "eloquence",
    "perseverance",
    "whimsical",
    "diligent",
];

// Shown in the book-search field (was RANDOM_TITLES in SearchBar). Famous,
// searchable books — distinct from custom-book.tsx's notebook-style name
// suggestions, which stay local to that screen on purpose.
export const FALLBACK_SEARCH_TITLES = [
    "The Great Gatsby",
    "To Kill a Mockingbird",
    "1984",
    "Pride and Prejudice",
    "The Catcher in the Rye",
    "Brave New World",
    "The Hobbit",
    "Crime and Punishment",
    "Jane Eyre",
    "Don Quixote",
    "Anna Karenina",
    "Moby Dick",
    "War and Peace",
    "The Odyssey",
    "Hamlet",
];
