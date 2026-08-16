// Small randomization helpers shared by anything that needs a shuffled/random

/**
 * Picks a random integer in [min, max], inclusive.
 *
 * @param {number} min The lowest possible value.
 * @param {number} max The highest possible value.
 * @returns {number} A random integer between min and max.
 *
 */
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Picks a random element from a non-empty array.
 *
 * @param {T[]} items The array to pick from.
 * @returns {T} A random element.
 *
 */
export function pick<T>(items: T[]): T {
    return items[randomInt(0, items.length - 1)];
}

/**
 * Shuffles a list into a new array (Fisher-Yates) — doesn't mutate the input.
 *
 * @param {T[]} items The list to shuffle.
 * @returns {T[]} A new, randomly-ordered copy.
 *
 */
export function shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
