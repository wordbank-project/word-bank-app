// Small date/time helpers shared by anything that needs to build or display a
// time-of-day value, or a year relative to today — currently the Memory tab's
// daily reminder (picking and showing its fire time) and custom-book's example books.

/**
 * Builds today's date stamped at the given hour/minute, with seconds and
 * milliseconds zeroed out. Used wherever a `Date` object is needed just to
 * carry a time-of-day (e.g. handing a value to a native time picker), not an
 * actual calendar date.
 *
 * @param {number} hour The hour (0–23, local device time).
 * @param {number} minute The minute (0–59).
 * @returns {Date} Today's date, set to that hour/minute/0/0.
 *
 */
export function dateFromTime(hour: number, minute: number): Date {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
}

/**
 * Formats an hour/minute as a short local time string, e.g. "9:00 AM".
 *
 * @param {number} hour The hour (0–23).
 * @param {number} minute The minute (0–59).
 * @returns {string} The formatted time.
 *
 */
export function formatTime(hour: number, minute: number): string {
    return dateFromTime(hour, minute).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Formats a year relative to the current one, 
 * e.g. for example data that shouldn't go stale.
 *
 * @param {number} years How many years before the current year (0 = this year).
 * @returns {string} The year as a string, e.g. "2024".
 *
 */
export function yearsAgo(years: number): string {
    return String(new Date().getFullYear() - years);
}
