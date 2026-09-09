// Strips a typed candidate down to digits only — shared by every text
// input that only accepts digits, typed progressively.

/**
 * Strips a typed candidate down to digits only.
 *
 * @param {string} inputCandidate The text typed in the input field.
 * @returns {string} The candidate with every non-digit character removed using a regular expression.
 *
 */
export function digitsOnly(inputCandidate: string): string {
    return inputCandidate.replace(/[^0-9]/g, "");
}
