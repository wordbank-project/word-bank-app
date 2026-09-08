/** Public dictionary metadata sent alongside a word to "Words users have currently saved" on marketing site
 * (utils/words-feed-api.ts), none of it user-authored. */
export type FeedWordMeta = {
    definition?: string;
    partOfSpeech?: string;
    phonetic?: string;
};
