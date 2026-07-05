import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { WordEntry } from '@/models/word-entry';
import { getWordOfTheDay, setWordOfTheDay } from '@/storage/engagement-storage';
import { ACCENT, Fonts } from '@/styles/global';
import { dayKey } from '@/utils/streak';
import { fetchTrendingWords } from '@/utils/trending-words';
import { fetchDefinition } from '@/utils/words-api';

// Offline fallback pool — the deterministic daily pick works even without the
// feed server (mirrors the curated suggestion list used elsewhere).
const FALLBACK_WORDS = [
    'serendipity', 'ephemeral', 'melancholy', 'resilience', 'eloquent',
    'ambiguous', 'tenacious', 'vivid', 'profound', 'meticulous',
    'candid', 'perseverance', 'whimsical', 'diligent', 'luminous',
];

// Deterministic index for the day, so every visit shows the same word.
function hashDay(key: string): number {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
        h = (h * 31 + key.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

/**
 * The daily surprise: a face-down card on the Search tab that reveals one
 * trending word (from the anonymous community feed, curated fallback offline).
 * The reveal is the reward beat — persisted per day so it stays revealed.
 */
export default function WordOfTheDayCard() {
    const [word, setWord] = useState<string | null>(null);
    const [revealed, setRevealed] = useState<boolean>(false);
    const [entry, setEntry] = useState<WordEntry | null>(null);
    const [loadingDef, setLoadingDef] = useState<boolean>(false);

    // Resolve today's word once: reuse the stored pick for today, otherwise
    // choose deterministically from the trending feed (or the fallback pool).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const today = dayKey(Date.now());
            const stored = await getWordOfTheDay();
            if (stored && stored.date === today) {
                if (!cancelled) {
                    setWord(stored.word);
                    setRevealed(stored.revealed);
                }
                return;
            }
            const trending = await fetchTrendingWords(50);
            const pool = trending.length > 0 ? trending : FALLBACK_WORDS;
            const pick = pool[hashDay(today) % pool.length];
            if (!cancelled) {
                setWord(pick);
                setRevealed(false);
            }
            await setWordOfTheDay({ date: today, word: pick, revealed: false });
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // After a reveal, look the word up (English feed words → dictionaryapi.dev).
    useEffect(() => {
        if (!revealed || !word || entry) {
            return;
        }
        let cancelled = false;
        setLoadingDef(true);
        fetchDefinition(word, 'en')
            .then((e) => {
                if (!cancelled) {
                    setEntry(e);
                }
            })
            .catch(() => {
                /* offline / not found — the word alone is still the reveal */
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingDef(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [revealed, word, entry]);

    if (!word) {
        return null;
    }

    function handleReveal(): void {
        if (revealed || !word) {
            return;
        }
        setRevealed(true);
        void setWordOfTheDay({ date: dayKey(Date.now()), word, revealed: true });
    }

    return (
        <View className="mb-2 rounded-[10px] border border-border bg-card p-3.5">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                Word of the day
            </Text>
            {revealed ? (
                <Animated.View entering={FadeIn.duration(250)} className="mt-1.5 gap-0.5">
                    <View className="flex-row flex-wrap items-baseline gap-2">
                        <Text className="text-lg font-bold text-fg">{word}</Text>
                        {entry?.phonetic ? (
                            <Text className="text-xs text-muted" style={{ fontFamily: Fonts.mono }}>
                                {entry.phonetic}
                            </Text>
                        ) : null}
                        {loadingDef ? <ActivityIndicator size="small" color={ACCENT} /> : null}
                    </View>
                    {entry ? (
                        <Text className="text-sm leading-5 text-body">
                            {entry.partOfSpeech ? <Text className="italic text-muted">{entry.partOfSpeech} · </Text> : null}
                            {entry.definition}
                        </Text>
                    ) : !loadingDef ? (
                        <Text className="text-sm text-muted">Look it up in one of your books to save it.</Text>
                    ) : null}
                </Animated.View>
            ) : (
                <Pressable
                    className="mt-1.5 items-center rounded-lg border border-dashed border-border-input bg-input py-4"
                    onPress={handleReveal}
                    accessibilityRole="button"
                    accessibilityLabel="Reveal the word of the day"
                >
                    <Text className="text-sm font-semibold text-accent">Tap to reveal ✨</Text>
                </Pressable>
            )}
        </View>
    );
}
