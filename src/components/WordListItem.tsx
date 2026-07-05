import React from "react";

import { Pressable, Text, View } from "react-native";

import type { WordEntry } from "@/models/word-entry";

import { Fonts } from "@/styles/global";

// A word plus the book it was added to, so the list can label and navigate to its source.
export type WordWithBook = WordEntry & {
    bookKey: string;
    bookTitle: string;
    bookAuthor: string;
    bookYear: string;
    bookCover: string;
};

type WordListItemProps = {
    item: WordWithBook;
    onPress: () => void;
};

// Mirrors the word card from book.tsx (dictionary fields only) and adds the source book label.
function WordListItem({ item, onPress }: WordListItemProps) {
    return (
        <Pressable className="gap-1 rounded-[10px] bg-card p-3.5" onPress={onPress}>
            <View className="flex-row items-center gap-2">
                <Text className="text-[17px] font-bold text-fg">{item.word}</Text>
                {item.phonetic ? (
                    <Text className="flex-1 text-[13px] text-muted" style={{ fontFamily: Fonts.mono }}>{item.phonetic}</Text>
                ) : null}
            </View>

            <Text className="text-xs italic capitalize text-accent">{item.partOfSpeech}</Text>
            <Text className="text-sm leading-5 text-body">{item.definition}</Text>

            {item.sentence ? (
                <Text className="mt-0.5 text-[13px] italic leading-5 text-muted" numberOfLines={2}>
                    “{item.sentence}”
                </Text>
            ) : null}

            <Text className="mt-1.5 text-xs text-muted" numberOfLines={1}>
                From “{item.bookTitle}”
            </Text>
        </Pressable>
    );
}

// Memoized so rows don't re-render on every keystroke in the words-list search box —
// each card only re-renders when its own props change.
export default React.memo(WordListItem);
