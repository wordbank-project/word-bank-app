import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import type { WordEntry } from '@/models/word-entry';
import { getReadList } from '@/storage/read-list-storage';
import { getWords } from '@/storage/words-storage';
import { ACCENT, Fonts } from '@/styles/global';

// Swipe distance (px) that commits an answer; anything less springs back.
const SWIPE_THRESHOLD = 120;
// Mirrors the definition picker's POS greens/ambers — raw values because they
// tint reanimated overlays.
const GOT_IT_COLOR = '#10b981';
const FORGOT_COLOR = '#ef4444';

const MAX_SESSION_WORDS = 10;
const MIN_WORDS = 3;

function shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Review session: a short tinder-style run through the user's saved words.
 * The word shows first (recall beat); tap reveals the definition; swipe right
 * = still know it, left = forgot. Session-only stats — nothing is written to
 * the words, so a bad run costs nothing.
 */
export default function ReviewScreen() {
    const insets = useSafeAreaInsets();

    const [allWords, setAllWords] = useState<WordEntry[] | null>(null);
    const [session, setSession] = useState<WordEntry[]>([]);
    const [index, setIndex] = useState<number>(0);
    const [revealed, setRevealed] = useState<boolean>(false);
    const [remembered, setRemembered] = useState<number>(0);
    const [done, setDone] = useState<boolean>(false);

    const tx = useSharedValue(0);

    // Flatten every book's words once; the session is a shuffled sample.
    useEffect(() => {
        getReadList().then(async (books) => {
            const perBook = await Promise.all(books.map((book) => getWords(book.key)));
            const flat = perBook.flat();
            setAllWords(flat);
            setSession(shuffle(flat).slice(0, MAX_SESSION_WORDS));
        });
    }, []);

    const commit = useCallback(
        (gotIt: boolean) => {
            tx.value = 0;
            setRevealed(false);
            if (gotIt) {
                setRemembered((n) => n + 1);
            }
            setIndex((i) => {
                if (i + 1 >= session.length) {
                    setDone(true);
                    return i;
                }
                return i + 1;
            });
        },
        [session.length, tx],
    );

    // Swipe: right = got it, left = forgot. A generous horizontal activation
    // offset keeps taps (reveal) working inside the card.
    const pan = Gesture.Pan()
        .activeOffsetX([-12, 12])
        .onChange((e) => {
            tx.value += e.changeX;
        })
        .onEnd(() => {
            if (Math.abs(tx.value) > SWIPE_THRESHOLD) {
                const gotIt = tx.value > 0;
                tx.value = withTiming(Math.sign(tx.value) * 500, { duration: 180 }, () => {
                    runOnJS(commit)(gotIt);
                });
            } else {
                tx.value = withSpring(0);
            }
        });

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tx.value }, { rotateZ: `${tx.value / 20}deg` }],
    }));
    const gotItStyle = useAnimatedStyle(() => ({
        opacity: interpolate(tx.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp'),
    }));
    const forgotStyle = useAnimatedStyle(() => ({
        opacity: interpolate(tx.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp'),
    }));

    function restart(): void {
        if (!allWords) {
            return;
        }
        setSession(shuffle(allWords).slice(0, MAX_SESSION_WORDS));
        setIndex(0);
        setRemembered(0);
        setRevealed(false);
        setDone(false);
    }

    const current = session[index];

    return (
        <GestureHandlerRootView className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
            {/* Header: close + progress (root stack hides native headers). */}
            <View className="flex-row items-center justify-between px-4 py-3">
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close review">
                    <Text className="text-base text-muted">✕</Text>
                </Pressable>
                <Text className="text-[15px] font-bold text-fg">Review</Text>
                <Text className="text-[13px] font-medium text-muted">
                    {session.length > 0 && !done ? `${index + 1}/${session.length}` : ''}
                </Text>
            </View>

            {allWords === null ? (
                <ActivityIndicator className="mt-12" color={ACCENT} />
            ) : session.length < MIN_WORDS ? (
                <View className="mt-16 items-center gap-2.5 px-8">
                    <Text className="text-lg font-semibold text-fg">Not enough words yet</Text>
                    <Text className="text-center text-sm leading-5 text-muted">
                        Save at least {MIN_WORDS} words, then come back to review them.
                    </Text>
                </View>
            ) : done ? (
                <Animated.View entering={FadeIn.duration(250)} className="mt-16 items-center gap-3 px-8">
                    <Text className="text-4xl">{remembered === session.length ? '🎉' : remembered >= session.length / 2 ? '💪' : '🌱'}</Text>
                    <Text className="text-xl font-bold text-fg">
                        You remembered {remembered} of {session.length}
                    </Text>
                    <Text className="text-center text-sm leading-5 text-muted">
                        {remembered === session.length
                            ? 'Perfect run — these words are yours now.'
                            : remembered >= session.length / 2
                              ? 'Solid! The forgotten ones will stick next time.'
                              : 'Forgetting is part of learning — that’s exactly why reviewing works.'}
                    </Text>
                    <Pressable className="mt-3 items-center self-stretch rounded-lg bg-accent py-2.5" onPress={restart}>
                        <Text className="text-[15px] font-semibold text-white">Review again</Text>
                    </Pressable>
                    <Pressable className="items-center self-stretch rounded-lg border border-border-input py-2.5" onPress={() => router.back()}>
                        <Text className="text-[15px] font-semibold text-fg">Done</Text>
                    </Pressable>
                </Animated.View>
            ) : current ? (
                <View className="flex-1 px-6 pt-6">
                    <GestureDetector gesture={pan}>
                        <Animated.View
                            key={index}
                            style={cardStyle}
                            className="min-h-64 justify-center rounded-2xl border border-border bg-card p-6"
                        >
                            {/* Swipe verdict badges */}
                            <Animated.View style={gotItStyle} className="absolute left-4 top-4 rounded-lg border-2 px-2 py-1" pointerEvents="none">
                                <Text className="text-sm font-bold" style={{ color: GOT_IT_COLOR }}>✓ Got it</Text>
                            </Animated.View>
                            <Animated.View style={forgotStyle} className="absolute right-4 top-4 rounded-lg border-2 px-2 py-1" pointerEvents="none">
                                <Text className="text-sm font-bold" style={{ color: FORGOT_COLOR }}>✗ Forgot</Text>
                            </Animated.View>

                            <Text className="text-center text-3xl font-bold text-fg">{current.word}</Text>
                            {current.phonetic ? (
                                <Text className="mt-1 text-center text-sm text-muted" style={{ fontFamily: Fonts.mono }}>
                                    {current.phonetic}
                                </Text>
                            ) : null}

                            {revealed ? (
                                <Animated.View entering={FadeIn.duration(200)} className="mt-5">
                                    {current.partOfSpeech ? (
                                        <Text className="text-center text-xs italic text-muted">{current.partOfSpeech}</Text>
                                    ) : null}
                                    <Text className="mt-1 text-center text-[15px] leading-6 text-body">{current.definition}</Text>
                                </Animated.View>
                            ) : (
                                <Pressable
                                    className="mt-5 items-center rounded-lg border border-dashed border-border-input py-3"
                                    onPress={() => setRevealed(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Reveal the definition"
                                >
                                    <Text className="text-sm font-semibold text-accent">Tap to reveal the definition</Text>
                                </Pressable>
                            )}
                        </Animated.View>
                    </GestureDetector>

                    <Text className="mt-4 text-center text-xs text-muted">
                        Swipe right if you still know it · left if you forgot
                    </Text>

                    {/* Button fallback (accessibility / reduced motion) */}
                    <View className="mt-3 flex-row gap-3">
                        <Pressable
                            className="flex-1 items-center rounded-lg border border-border-input py-3"
                            onPress={() => commit(false)}
                            accessibilityRole="button"
                            accessibilityLabel="I forgot this word"
                        >
                            <Text className="text-[15px] font-semibold" style={{ color: FORGOT_COLOR }}>✗ Forgot</Text>
                        </Pressable>
                        <Pressable
                            className="flex-1 items-center rounded-lg border border-border-input py-3"
                            onPress={() => commit(true)}
                            accessibilityRole="button"
                            accessibilityLabel="I still know this word"
                        >
                            <Text className="text-[15px] font-semibold" style={{ color: GOT_IT_COLOR }}>✓ Got it</Text>
                        </Pressable>
                    </View>
                </View>
            ) : null}
        </GestureHandlerRootView>
    );
}
