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

/**
 * Sanitizes a typed book-year candidate: digits only, plus an optional
 * leading "-" for a BC year (e.g. "-400"), capped at 4 digits regardless of
 * sign (the "-" doesn't count against that limit) — shared by every year
 * field that accepts a BC year (custom-book.tsx's Year field, book.tsx's
 * "Edit details" year field).
 *
 * @param {string} inputCandidate The text typed in the input field.
 * @returns {string | null} The sanitized year — `""` to clear the field, a bare `"-"` to allow a BC year to be typed digit by digit, or a valid year — or `null` if the candidate is neither of those and should be rejected (the caller should keep the field's previous value).
 *
 */
export function sanitizeYearInput(inputCandidate: string): string | null {
    const digitsAndSign = digitsOnly(inputCandidate, true);
    const isNegative = digitsAndSign.startsWith("-");
    const digits = (isNegative ? digitsAndSign.slice(1) : digitsAndSign).slice(0, 4);
    const sanitized = isNegative ? `-${digits}` : digits;
    if (sanitized === "" || sanitized === "-" || parseInt(sanitized)) {
        return sanitized;
    }
    return null;
}
