import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/context/theme-context';

import { HIGHLIGHT_BORDER_STYLE, useHighlightFlash } from '@/hooks/use-highlight-flash';

import type { WordEntry } from '@/models/word-entry';
import { getWordOfTheDay, setWordOfTheDay } from '@/storage/engagement-storage';
import { ACCENT, Colors, Fonts } from '@/styles/global';

import { alertDialog } from '@/utils/alert-dialog';
import { capitalizePosLabel } from '@/utils/part-of-speech';
import { dayKey } from '@/utils/streak';
import { fetchDefinition } from '@/utils/api/words-api';
import { fetchMostSavedWords } from '@/utils/api/words-feed-api';

/**
 * Explains the feature via the app's standard one-time-notice pattern (same
 * as more.tsx's export/import notices) — shown regardless of reveal state,
 * since it's also useful before revealing to explain what "Tap to reveal"
 * even is.
 *
 * @returns {void} Returns nothing — shows the dialog (or skips it silently if
 * already dismissed, per alertDialog's own contract).
 *
 */
function handleInfoPress(): void {
    alertDialog(
        "Word of the day",
        "A new word, picked for you every day from the words other users save most — resets at midnight, your local time. It's not saved to your word bank automatically; look it up in a book to save it.",
        { dontShowAgain: { id: "word-of-the-day-info", checkboxLabel: "Don't show this again" } },
    );
}

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
 * The daily surprise: a face-down card on the Words List that reveals one
 * most-saved word (from the anonymous community feed, curated fallback offline).
 * The reveal is the reward beat — persisted per day so it stays revealed.
 */
export default function WordOfTheDayCard() {
    // Ionicons takes a color value, not a className, so keep it themed here.
    const iconColor: string = Colors[useColorScheme()].textMuted;

    const [word, setWord] = useState<string | null>(null);
    const [revealed, setRevealed] = useState<boolean>(false);
    const [entry, setEntry] = useState<WordEntry | null>(null);
    const [loadingDef, setLoadingDef] = useState<boolean>(false);

    // Reveal glow: a brief accent-border flash around the card, shared with
    // book.tsx's scroll-to-focused-word highlight and analyze.tsx's result
    // highlight (see use-highlight-flash.ts).
    const glow = useHighlightFlash();

    // Resolve today's word once: reuse the stored pick for today, otherwise
    // choose deterministically from the most-saved-words feed (or the fallback pool).
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
            const mostSaved = await fetchMostSavedWords(50);
            const pool = mostSaved.length > 0 ? mostSaved : FALLBACK_WORDS;
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
            .catch((error) => {
                // offline / not found — the word alone is still the revealed.
                // error is logged for uniformity.
                console.error(error);
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
        glow.trigger();
    }

    return (
        <View className="relative mb-2 rounded-[10px] bg-card p-3.5">
            <View className="flex-row items-center justify-between">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                    Word of the day
                </Text>
                <Pressable
                    onPress={handleInfoPress}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="About the word of the day"
                >
                    <Ionicons name="information-circle-outline" size={16} color={iconColor} />
                </Pressable>
            </View>
            {glow.activeKey ? (
                <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, HIGHLIGHT_BORDER_STYLE, glow.style]}
                />
            ) : null}
            {revealed ? (
                <Animated.View entering={FadeIn.duration(250)} className="mt-1.5 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="text-[17px] font-bold text-fg">{word}</Text>
                        {entry?.phonetic ? (
                            <Text className="text-xs text-muted" style={{ fontFamily: Fonts.mono }}>
                                {entry.phonetic}
                            </Text>
                        ) : null}
                        {loadingDef ? <ActivityIndicator size="small" color={ACCENT} /> : null}
                    </View>
                    {entry?.partOfSpeech ? (
                        <Text className="text-xs italic text-accent">{capitalizePosLabel(entry.partOfSpeech)}</Text>
                    ) : null}
                    {entry ? (
                        <Text className="text-sm leading-5 text-body">{entry.definition}</Text>
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
