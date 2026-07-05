import { getJSON, setJSON } from '@/storage/storage';

// Engagement state: the daily word goal and the word-of-the-day reveal.
// Both are small, local-only values (AsyncStorage), in line with the app's
// no-account, no-tracking design.

const GOAL_KEY = 'daily_word_goal';
const WOTD_KEY = 'word_of_the_day';

const DEFAULT_GOAL = 3;

export async function getDailyGoal(): Promise<number> {
    const goal = await getJSON<number>(GOAL_KEY, DEFAULT_GOAL);
    return Number.isFinite(goal) && goal > 0 ? goal : DEFAULT_GOAL;
}

export async function setDailyGoal(goal: number): Promise<void> {
    await setJSON(GOAL_KEY, goal);
}

// The day's word and whether the user has revealed it — persisted so the card
// stays revealed for the rest of the day (a new day picks a new word).
export type WordOfTheDay = {
    date: string; // local YYYY-MM-DD
    word: string;
    revealed: boolean;
};

export async function getWordOfTheDay(): Promise<WordOfTheDay | null> {
    return getJSON<WordOfTheDay | null>(WOTD_KEY, null);
}

export async function setWordOfTheDay(state: WordOfTheDay): Promise<void> {
    await setJSON(WOTD_KEY, state);
}
