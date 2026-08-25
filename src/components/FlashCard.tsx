import { useEffect, useState } from "react";

import { Pressable, Text, View } from "react-native";
import Animated, { interpolate, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import type { WordWithBook } from "@/storage/read-list-storage";

import { openBook } from "@/utils/open-book";

import { Fonts } from "@/styles/global";

// The Memory tab's tap-to-flip practice card

type FlashCardProps = {
    word: WordWithBook;
    onRate: (knew: boolean) => void;
};

/**
 * A single flip-to-reveal flashcard for one saved word.
 *
 * @param {FlashCardProps} props The word to show and the rating callback.
 * @returns {JSX.Element} The rendered flashcard.
 *
 */
export default function FlashCard({ word, onRate }: FlashCardProps) {
    const [flipped, setFlipped] = useState<boolean>(false);
    const rotation = useSharedValue(0);

    // Reset to front-up (without animating backwards) whenever a new word is
    // shown, so the next card in a round never starts pre-flipped.
    useEffect(() => {
        setFlipped(false);
        rotation.value = 0;
    }, [word.word, rotation]);

    /**
     * Flips the card, 
     * animating the rotation and revealing (or hiding) the back.
     *
     * @returns {void} Returns nothing.
     *
     */
    function handleFlip(): void {
        const next = !flipped;
        setFlipped(next);
        rotation.value = withTiming(next ? 180 : 0, { duration: 350, reduceMotion: ReduceMotion.Never });
    }

    /**
     * Opens the word's source book, 
     * scrolled to and highlighting that word.
     *
     * @returns {void} Returns nothing.
     *
     */
    function handleVisitBook(): void {
        openBook({
            key: word.bookKey,
            title: word.bookTitle,
            author: word.bookAuthor,
            year: word.bookYear,
            cover_i: word.bookCover,
            focusWord: word.word,
        });
    }

    // If a word sentence exist that the user added. Use that, otherwise the example sentence
    const backSentence = word.sentence || word.exampleSentence;

    const frontStyle = useAnimatedStyle(() => ({
        transform: [{ rotateY: `${interpolate(rotation.value, [0, 180], [0, 180])}deg` }],
        opacity: rotation.value > 90 ? 0 : 1,
        backfaceVisibility: "hidden",
    }));
    const backStyle = useAnimatedStyle(() => ({
        transform: [{ rotateY: `${interpolate(rotation.value, [0, 180], [180, 360])}deg` }],
        opacity: rotation.value > 90 ? 1 : 0,
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        backfaceVisibility: "hidden",
    }));

    return (
        <View className="gap-4">
            <Pressable onPress={handleFlip} className="min-h-56 justify-center rounded-2xl border border-accent bg-card p-6">
                <Animated.View style={frontStyle} className="px-2">
                    <Text className="text-center text-3xl font-bold text-fg">{word.word}</Text>
                    {word.phonetic ? (
                        <Text className="mt-2 text-center text-sm text-muted" style={{ fontFamily: Fonts.mono }}>
                            {word.phonetic}
                        </Text>
                    ) : null}
                    <Text className="mt-6 text-center text-xs text-faded">Tap to reveal</Text>
                </Animated.View>
                <Animated.View style={backStyle} className="px-2">
                    {word.phonetic ? (
                        <Text className="text-center text-sm text-muted" style={{ fontFamily: Fonts.mono }}>
                            {word.phonetic}
                        </Text>
                    ) : null}
                    <Text className="mt-2 text-center text-xs italic capitalize text-accent">{word.partOfSpeech}</Text>
                    <Text className="mt-2 text-center text-base leading-6 text-body">{word.definition}</Text>
                    {backSentence ? (
                        <Text className="mt-4 text-center text-sm italic leading-5 text-muted">“{backSentence}”</Text>
                    ) : null}
                </Animated.View>
            </Pressable>

            <Text className="mt-4 text-center text-xs text-accent" numberOfLines={1} onPress={handleVisitBook}>
                From: {word.bookTitle} ›
            </Text>
            <Text className="mb-4 text-center text-[11px] text-faded">
                Your round stays paused — come back anytime.
            </Text>

            {flipped ? (
                <View className="flex-row gap-3">
                    <Pressable
                        onPress={() => onRate(false)}
                        className="flex-1 items-center rounded-xl border border-border-input bg-input p-3.5"
                    >
                        <Text className="font-semibold text-fg">Still learning</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => onRate(true)}
                        className="flex-1 items-center rounded-xl bg-accent p-3.5"
                    >
                        <Text className="font-semibold text-white">Knew it</Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}
