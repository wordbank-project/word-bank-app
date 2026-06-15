import { useCallback, useEffect, useRef, useState } from "react";

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Stack, router } from "expo-router";

import { useThemedStyles } from "@/hooks/use-themed-styles";
import { getNotificationSettings } from "@/storage/notifications-storage";
import { gradeAndPersist } from "@/storage/srs-storage";
import { ACCENT, Colors, ERROR, Fonts } from "@/styles/global";
import { getMoreNewWords, getReviewQueue, type ReviewWord } from "@/utils/review-queue";
import type { SrsGrade } from "@/models/srs";

function wordId(w: ReviewWord): string {
    return `${w.bookKey}_${w.word}`;
}

export default function ReviewScreen() {
    const styles = useThemedStyles(lightStyles, darkStyles);
    const insets = useSafeAreaInsets();

    const [queue, setQueue] = useState<ReviewWord[]>([]);
    const [index, setIndex] = useState<number>(0);
    const [revealed, setRevealed] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [reviewedCount, setReviewedCount] = useState<number>(0);

    // Words already pulled this session, so "Get more words" never repeats one.
    const shownKeys = useRef<Set<string>>(new Set());
    const wordsPerDay = useRef<number>(10);

    useEffect(() => {
        let active = true;
        getNotificationSettings()
            .then((settings) => {
                wordsPerDay.current = settings.wordsPerDay;
                return getReviewQueue(settings.wordsPerDay);
            })
            .then((words) => {
                if (!active) {
                    return;
                }
                words.forEach((w) => shownKeys.current.add(wordId(w)));
                setQueue(words);
                setLoading(false);
            });
        return () => { active = false; };
    }, []);

    const current = queue[index];

    const handleGrade = useCallback(async (grade: SrsGrade): Promise<void> => {
        if (!current) {
            return;
        }
        await gradeAndPersist(current.bookKey, current.word, grade);
        setReviewedCount((n) => n + 1);
        setRevealed(false);
        setIndex((i) => i + 1);
    }, [current]);

    async function handleGetMore(): Promise<void> {
        setLoading(true);
        const more = await getMoreNewWords(wordsPerDay.current, shownKeys.current);
        more.forEach((w) => shownKeys.current.add(wordId(w)));
        setQueue((q) => [...q, ...more]);
        setLoading(false);
    }

    const header = (
        <Stack.Screen options={{ title: 'Review', headerShown: true, headerBackVisible: true }} />
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                {header}
                <ActivityIndicator color={ACCENT} size="large" />
            </View>
        );
    }

    // Session finished (or nothing was due to begin with).
    if (!current) {
        return (
            <View style={[styles.container, styles.centered]}>
                {header}
                <Text style={styles.doneTitle}>
                    {reviewedCount > 0 ? 'All done 🎉' : 'Nothing due right now'}
                </Text>
                <Text style={styles.doneSubtitle}>
                    {reviewedCount > 0
                        ? `You reviewed ${reviewedCount} ${reviewedCount === 1 ? 'word' : 'words'}.`
                        : 'Add more words or come back later.'}
                </Text>
                <View style={styles.doneActions}>
                    <Pressable style={styles.primaryButton} onPress={handleGetMore}>
                        <Text style={styles.primaryButtonText}>Get more words</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
                        <Text style={styles.secondaryButtonText}>Done</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    const example = current.sentence || current.exampleSentence;

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            {header}

            <Text style={styles.progress}>
                {index + 1} / {queue.length}
            </Text>

            <View style={styles.card}>
                <Text style={styles.word}>{current.word}</Text>
                {current.phonetic ? <Text style={styles.phonetic}>{current.phonetic}</Text> : null}
                <Text style={styles.partOfSpeech}>{current.partOfSpeech}</Text>
                <Text style={styles.bookLabel}>from {current.bookTitle}</Text>

                {revealed ? (
                    <View style={styles.revealBlock}>
                        <Text style={styles.definition}>{current.definition}</Text>
                        {example ? (
                            <View style={styles.metaBlock}>
                                <Text style={styles.metaLabel}>Example</Text>
                                <Text style={styles.metaValue}>{example}</Text>
                            </View>
                        ) : null}
                        {current.notes ? (
                            <View style={styles.metaBlock}>
                                <Text style={styles.metaLabel}>Notes</Text>
                                <Text style={styles.metaValue}>{current.notes}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}
            </View>

            <View style={styles.footer}>
                {revealed ? (
                    <View style={styles.gradeRow}>
                        <Pressable style={[styles.gradeButton, styles.againButton]} onPress={() => handleGrade('again')}>
                            <Text style={styles.againText}>Again</Text>
                        </Pressable>
                        <Pressable style={[styles.gradeButton, styles.gotButton]} onPress={() => handleGrade('got')}>
                            <Text style={styles.gotText}>Got it</Text>
                        </Pressable>
                    </View>
                ) : (
                    <Pressable style={styles.primaryButton} onPress={() => setRevealed(true)}>
                        <Text style={styles.primaryButtonText}>Reveal</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: C.background,
            padding: 16,
            gap: 16,
        },
        centered: {
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        progress: {
            fontSize: 13,
            fontWeight: '600',
            color: C.textMuted,
            textAlign: 'center',
        },
        card: {
            flex: 1,
            backgroundColor: C.backgroundCard,
            borderRadius: 12,
            padding: 20,
            gap: 6,
        },
        word: {
            fontSize: 28,
            fontWeight: '700',
            color: C.text,
        },
        phonetic: {
            fontSize: 15,
            color: C.textMuted,
            fontFamily: Fonts.mono,
        },
        partOfSpeech: {
            fontSize: 13,
            fontStyle: 'italic',
            color: ACCENT,
            textTransform: 'capitalize',
        },
        bookLabel: {
            fontSize: 12,
            color: C.textFaded,
        },
        revealBlock: {
            marginTop: 10,
            gap: 12,
        },
        definition: {
            fontSize: 16,
            color: C.textBody,
            lineHeight: 23,
        },
        metaBlock: {
            gap: 2,
        },
        metaLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: C.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        metaValue: {
            fontSize: 14,
            color: C.textMeta,
            lineHeight: 20,
        },
        footer: {
            gap: 12,
        },
        gradeRow: {
            flexDirection: 'row',
            gap: 12,
        },
        gradeButton: {
            flex: 1,
            borderRadius: 10,
            paddingVertical: 16,
            alignItems: 'center',
        },
        againButton: {
            borderWidth: 1,
            borderColor: ERROR,
            backgroundColor: 'transparent',
        },
        againText: {
            color: ERROR,
            fontSize: 16,
            fontWeight: '700',
        },
        gotButton: {
            backgroundColor: ACCENT,
        },
        gotText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
        },
        primaryButton: {
            backgroundColor: ACCENT,
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: 'center',
        },
        primaryButtonText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
        },
        secondaryButton: {
            paddingVertical: 14,
            alignItems: 'center',
        },
        secondaryButtonText: {
            color: C.textMuted,
            fontSize: 15,
            fontWeight: '600',
        },
        doneTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: C.text,
        },
        doneSubtitle: {
            fontSize: 15,
            color: C.textMuted,
            textAlign: 'center',
        },
        doneActions: {
            alignSelf: 'stretch',
            gap: 8,
            marginTop: 12,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
