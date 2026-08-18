import React from "react";

import { Pressable, Text, View } from "react-native";

import type { WordStat } from "@/storage/memory-stats-storage";
import type { WordWithBook } from "@/storage/read-list-storage";

type WordStatRowProps = {
    word: WordWithBook;
    stat: WordStat;
    onPress: () => void;
};

// One row on the Stats screen's "Still struggling with" list: the word, its
// source book, and how many times it's been rated each way. Mirrors
// WordListItem's layout/tone, with counts in place of the definition.
function WordStatRow({ word, stat, onPress }: WordStatRowProps) {
    return (
        <Pressable className="gap-1 rounded-[10px] bg-card p-3.5 mb-1" onPress={onPress}>
            <View className="flex-row items-center justify-between">
                <Text className="text-[17px] font-bold text-fg">{word.word}</Text>
                <Text className="text-xs text-muted">
                    <Text className="font-semibold text-fg">{stat.stillLearning}</Text> still learning ·{" "}
                    <Text className="font-semibold text-fg">{stat.knewIt}</Text> knew it
                </Text>
            </View>
            <Text className="text-xs text-muted" numberOfLines={1}>
                From “{word.bookTitle}”
            </Text>
        </Pressable>
    );
}

export default React.memo(WordStatRow);
