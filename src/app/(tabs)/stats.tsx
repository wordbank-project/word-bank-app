import { useCallback, useMemo, useState } from "react";

import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { useFocusEffect, useLocalSearchParams, router, Link } from "expo-router";

import { useBackTo } from "@/hooks/use-back-to";
import { useScrollViewScroll } from "@/hooks/use-scroll-registration";

import { getMemoryStats, type WordStat } from "@/storage/memory-stats-storage";
import { getAllWords, type WordWithBook } from "@/storage/read-list-storage";

import { ACCENT } from "@/styles/global";

import { openBook } from "@/utils/open-book";

import WordStatRow from "@/components/WordStatRow";

// The Memory tab's practice-history screen: overall "Knew it" vs "Still
// Shows stats about the words

type StruggleRow = {
    word: WordWithBook;
    stat: WordStat;
};

export default function StatsScreen() {
    const [words, setWords] = useState<WordWithBook[]>([]);
    const [stats, setStats] = useState<Record<string, WordStat>>({});
    const [loading, setLoading] = useState<boolean>(true);

    // Opened from either the Memory tab or More,
    // We track the location with `from`
    // When from more we go back to "/more" otherwise "/memory-words"
    const { from } = useLocalSearchParams<{ from?: string }>();
    useBackTo(from === "more" ? "/more" : "/memory-words");

    const { ref: scrollRef, onScroll, scrollEventThrottle } = useScrollViewScroll();

    // Re-read on every focus (not just mount) so returning here after seeding
    // test data, practicing another round, or deleting all data shows current
    // numbers without needing a reload — see the same fix in memory-words.tsx.
    useFocusEffect(
        useCallback(() => {
            Promise.all([getAllWords(), getMemoryStats()]).then(([allWords, allStats]) => {
                setWords(allWords);
                setStats(allStats);
                setLoading(false);
            });
        }, [])
    );

    // An array of words with at least one rating (stillLearning or knewIt) (means it has been rated)
    // useMemo is used because we only redo the rated words count if it changes
    const allRatedWords: StruggleRow[] = useMemo((): StruggleRow[] => {
        return words
            // map() loops through the array and does the same action for each entry and returns a new array. 
            // Here it checks for each saved word if it has a stat
            .map((word: WordWithBook): StruggleRow | null => {
                const stat = stats[word.word.trim().toLowerCase()];
                // Word with stat exists? We return the object otherwise return null
                return stat ? { word, stat } : null;
            })
            // filter() runs a test on each entry and keeps only the ones where it returns true — here, "not null"
            .filter((row: StruggleRow | null): row is StruggleRow => row !== null);
    }, [words, stats]);

    // useMemo is used because we only redo the struggling count if it changes
    const strugglingWords: StruggleRow[] = useMemo(() => {
        return allRatedWords
            // filter() runs a test on each entry and keeps only the ones where it returns true — here, bigger than 0
            .filter((row: StruggleRow) => row.stat.stillLearning > 0)
            // sort() reorders the array() - here in descending order.
            // b - a = decending (biggest first)
            // a - b = ascending (smallest first)
            .sort((a: StruggleRow, b: StruggleRow) => b.stat.stillLearning - a.stat.stillLearning);
    }, [allRatedWords]);

    // useMemo is used because we only redo the total stats count if it changes
    const totalStats = useMemo(() => {
        // reduce() loops through the array and returns one value: sum starts at 0 (the
        // second argument), and each call adds that row's knewIt count to the running
        // total, e.g. [5, 2, 4] -> 0+5=5 -> 5+2=7 -> 7+4=11.
        // Same as: let sum = 0; for (const row of allRatedWords) { sum += row.stat.knewIt; }
        const knewItCount = allRatedWords.reduce((sum: number, row: StruggleRow) => sum + row.stat.knewIt, 0);
        // Same but for still learning
        const stillLearningCount = allRatedWords.reduce((sum: number, row: StruggleRow) => sum + row.stat.stillLearning, 0);
        const totalRatingsCount = knewItCount + stillLearningCount; // Just the total
        const knewItRatePercentage = totalRatingsCount > 0 ? Math.round((knewItCount / totalRatingsCount) * 100) : 0; // e.g. (5/10) * 100 = 50% 

        // Returns an object with everything
        return { wordsTracked: allRatedWords.length, knewItCount, stillLearningCount, knewItRatePercentage };
    }, [allRatedWords]);

    if (loading) {
        return (
            <View className="flex-1 bg-background">
                <ActivityIndicator className="mt-12" color={ACCENT} />
            </View>
        );
    }

    if (allRatedWords.length === 0) {
        return (
            <View className="flex-1 bg-background p-4">
                <View className="mt-16 items-center gap-2.5 px-8">
                    <Text className="text-lg font-semibold text-fg">No practice history yet</Text>
                    <Link href={"/(tabs)/memory-words"} className="text-center text-sm text-accent">
                        Practice a round on the Memory tab to see your stats here.
                    </Link>
                </View>
            </View>
        );
    }

    return (
        <ScrollView
            ref={scrollRef}
            className="flex-1 bg-background"
            contentContainerClassName="gap-6 p-4 pb-8"
            scrollEventThrottle={scrollEventThrottle}
            onScroll={onScroll}
        >
            <View className="flex-row gap-3">
                <Pressable
                    className="flex-1 items-center gap-1 rounded-[10px] bg-card p-3.5"
                    onPress={() => router.push("/words-list")}
                >
                    <Text className="text-2xl font-bold text-fg">{totalStats.wordsTracked}</Text>
                    <Text className="text-xs text-muted">Words practiced</Text>
                </Pressable>
                <View className="flex-1 items-center gap-1 rounded-[10px] bg-card p-3.5">
                    <Text className="text-2xl font-bold text-accent">{totalStats.knewItRatePercentage}%</Text>
                    <Text className="text-xs text-muted">Knew-it rate</Text>
                </View>
            </View>

            <View className="flex-row gap-3">
                <View className="flex-1 items-center gap-1 rounded-[10px] bg-card p-3.5">
                    <Text className="text-lg font-semibold text-fg">{totalStats.knewItCount}</Text>
                    <Text className="text-xs text-muted">Total &quot;Knew it&quot;</Text>
                </View>
                <View className="flex-1 items-center gap-1 rounded-[10px] bg-card p-3.5">
                    <Text className="text-lg font-semibold text-fg">{totalStats.stillLearningCount}</Text>
                    <Text className="text-xs text-muted">Total &quot;Still learning&quot;</Text>
                </View>
            </View>

            {strugglingWords.length > 0 ? (
                <View className="gap-2">
                    <Text className="mb-2 text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">
                        Still struggling with
                    </Text>
                    <View className="gap-2">
                        {/* Visits the word in the book when we tap on it */}
                        {strugglingWords.map((row: StruggleRow) => (
                            <WordStatRow
                                key={`${row.word.bookKey}-${row.word.word}`}
                                word={row.word}
                                stat={row.stat}
                                onPress={() =>
                                    openBook({
                                        key: row.word.bookKey,
                                        title: row.word.bookTitle,
                                        author: row.word.bookAuthor,
                                        year: row.word.bookYear,
                                        cover_i: row.word.bookCover,
                                        focusWord: row.word.word,
                                    })
                                }
                            />
                        ))}
                    </View>
                </View>
            ) : (
                <Text className="px-1 text-center text-sm text-muted">
                    No words currently marked &quot;Still learning&quot; — nice work!
                </Text>
            )}
        </ScrollView>
    );
}
