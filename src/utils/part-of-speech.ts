import { ACCENT } from "@/styles/global";

// Part-of-speech helpers shared by the Words List filter and the definition
// picker, so colours and labels stay consistent across the app.
//
// Dictionary sources disagree on spelling: dictionaryapi.dev says "adjective",
// wiktapi/kaikki says "adj". `normalizePos` folds those variants to one canonical
// key so a word filters/groups correctly regardless of source.

// Distinct colours per part of speech. Mid-tone hues that read on both light and
// dark surfaces; anything not listed falls back to ACCENT via `posColor`.
export const POS_COLORS: Record<string, string> = {
    noun: '#3b82f6',       // blue
    verb: '#10b981',       // green
    adjective: '#f59e0b',  // amber
    adverb: '#8b5cf6',     // purple
};

// Abbreviations / variants → canonical key.
const POS_ALIASES: Record<string, string> = {
    adj: 'adjective',
    adv: 'adverb',
    intj: 'interjection',
    prep: 'preposition',
    conj: 'conjunction',
    pron: 'pronoun',
    num: 'numeral',
    art: 'article',
};

// The four main parts of speech, in the order chips/headers should appear;
// anything else sorts after these (alphabetically).
export const POS_ORDER = ['noun', 'verb', 'adjective', 'adverb'];

/**
 * Lowercase, trim, and fold known abbreviations to a single canonical key.
 *
 * @param {string} raw The raw part-of-speech string, in any dictionary source's spelling.
 * @returns {string} The canonical, lowercase part-of-speech key.
 *
 */
export function normalizePos(raw: string): string {
    const pos = (raw ?? '').trim().toLowerCase();
    return POS_ALIASES[pos] ?? pos;
}

/**
 * Colour for a part of speech.
 *
 * @param {string} pos The part of speech, in any dictionary source's spelling.
 * @returns {string} The matching hex colour, or `ACCENT` if this part of speech has none.
 *
 */
export function posColor(pos: string): string {
    return POS_COLORS[normalizePos(pos)] ?? ACCENT;
}

/**
 * Capitalised display label for a part of speech, e.g. "noun" → "Noun".
 *
 * @param {string} pos The part of speech, in any dictionary source's spelling.
 * @returns {string} The capitalised label, or `''` if `pos` normalizes to an empty string.
 *
 */
export function posLabel(pos: string): string {
    const p = normalizePos(pos);
    return p ? p.charAt(0).toUpperCase() + p.slice(1) : p;
}
