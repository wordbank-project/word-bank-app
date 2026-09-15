// Strips a typed candidate down to digits only — shared by every text
// input that only accepts digits, typed progressively.

/**
 * Strips a typed candidate down to digits only, optionally keeping a single
 * leading minus sign (e.g. a book's Year field, where a negative value
 * represents a BC year like "-400").
 *
 * @param {string} inputCandidate The text typed in the input field.
 * @param {boolean} [isNegativeAllowed] Whether a leading "-" should be kept instead of stripped. Defaults to `false`.
 * @returns {string} The candidate with every non-digit character removed (a leading "-" kept when `isNegativeAllowed` is `true`) — a stray "-" elsewhere in the input is still stripped, same as any other non-digit.
 *
 */
export function digitsOnly(inputCandidate: string, isNegativeAllowed: boolean = false): string {
    const digits = inputCandidate.replace(/[^0-9]/g, "");
    if (!isNegativeAllowed) {
        return digits;
    }
    const isNegative = inputCandidate.trim().startsWith("-");
    return isNegative ? `-${digits}` : digits;
}
