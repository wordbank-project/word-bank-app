import React, { useCallback, useEffect, useRef, useState } from "react";

import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { useIsFocused } from "expo-router";

import { useColorScheme } from "@/context/theme-context";

import { useBackTo } from "@/hooks/use-back-to";
import { useSavedLanguage } from "@/hooks/use-saved-language";
import { useScrollViewScroll } from "@/hooks/use-scroll-registration";
import { useTypewriterPlaceholder } from "@/hooks/use-typewriter-placeholder";

import type { AnalysisHistoryEntry, SentenceAnalysis } from "@/models/sentence-analysis";

import { addAnalysis, getAnalysisHistory, removeAnalysis } from "@/storage/analysis-storage";

import { MAX_SENTENCE_LENGTH, analyzeSentence } from "@/utils/analyze-api";
import { showActionSheet } from "@/utils/show-action-sheet";
import { fetchSuggestions } from "@/utils/suggestions-api";

import { ACCENT, Colors } from "@/styles/global";

import AnalysisResult from "@/components/AnalysisResult";
import ClearableTextInput from "@/components/ClearableTextInput";
import LanguageModal from "@/components/LanguageModal";
import SearchButton from "@/components/SearchButton";

const RANDOM_EXAMPLE_SENTENCES = [
    "He was drowning in time, and the shore kept moving.",
    "She had a habit of speaking in half-finished thoughts.",
    "The city wore its history like a threadbare coat.",
];

export default function AnalyzeScreen() {
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

    // Back button goes to the More tab, not the previous screen (which could be anywhere).
    useBackTo("/more");

    const [sentence, setSentence] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");

    const [analysis, setAnalysis] = useState<SentenceAnalysis | null>(null);
    const [analyzed, setAnalyzed] = useState<string>("");

    const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);

    const requestRef = useRef<AbortController | null>(null);

    // Highlight effect when a past result is selected from the history list.
    const [showHighlight, setShowHighlight] = useState<boolean>(false);
    const highlightOpacity = useSharedValue(0);
    const highlightStyle = useAnimatedStyle(() => ({ opacity: highlightOpacity.value }));
    const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get the stored analysis history
    useEffect(() => {
        getAnalysisHistory().then((entries: AnalysisHistoryEntry[]) => setHistory(entries));
        return () => {
            requestRef.current?.abort();
            if (highlightTimer.current) {
                clearTimeout(highlightTimer.current);
            }
        };
    }, []);

    // Restores the saved dictionary language from AsyncStorage on mount.
    const { language, languageReady, setLanguage } = useSavedLanguage();

    // Get from the api the live AI-generated example sentences, which replace the static list once available.
    const [suggestionSentences, setSuggestionSentences] = useState<string[]>(RANDOM_EXAMPLE_SENTENCES);
    useEffect(() => {
        if (!languageReady) {
            return;
        }
        fetchSuggestions(language.code).then(({ sentences }: { sentences: string[] }) => {
            if (sentences.length > 0) {
                setSuggestionSentences(sentences);
            }
        });
    }, [languageReady, language.code]);

    // Placeholder typewriter effect — shows one of the example sentences while the field is empty and the tab is focused.
    const isFocused = useIsFocused();
    const { text: typedPlaceholder, word } = useTypewriterPlaceholder(suggestionSentences, isFocused && !sentence);

    // Scroll to top button
    const { ref: scrollRef, onScroll, scrollEventThrottle } = useScrollViewScroll<KeyboardAwareScrollViewRef>();


    /** Scroll to top and highlight 
    * @returns {void} nothing — the highlight is a visual effect
    */
    function triggerHighlight(): void {
        scrollRef.current?.scrollTo({ y: 0, animated: true });

        setShowHighlight(true);

        highlightOpacity.value = 1;
        highlightOpacity.value = withDelay(
            1200,
            withTiming(0, { duration: 500, reduceMotion: ReduceMotion.Never }),
            ReduceMotion.Never,
        );
        // Unmount the overlay once the fade has finished.
        if (highlightTimer.current) {
            clearTimeout(highlightTimer.current);
        }
        highlightTimer.current = setTimeout(() => setShowHighlight(false), 1800);
    }

    /** Analyzes a sentence, updates the state, and saves it to history.
     * @param {string | undefined} input the sentence to analyze, or `undefined` to use the current field value
     * @returns {Promise<boolean>} a promise that resolves to `true` if a result was produced, or `false` if not (e.g. empty field, too long, network error)
     * 
     */
    const handleAnalyze = useCallback(async (input?: string): Promise<boolean> => {
        const text = (input ?? sentence).replace(/\s+/g, " ").trim();
        if (!text) {
            setError("Type or select a sentence first.");
            return false;
        }
        if (text.length > MAX_SENTENCE_LENGTH) {
            setError(`That's a bit long — keep it under ${MAX_SENTENCE_LENGTH} characters.`);
            return false;
        }

        Keyboard.dismiss();
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;

        setLoading(true);
        setError("");
        setAnalysis(null);

        const lang = language.code;
        const result = await analyzeSentence(text, lang, controller.signal);

        // A newer submission (or unmount) superseded this one — drop the result.
        if (controller.signal.aborted) {
            return false;
        }

        setLoading(false);
        if (result === 'rate-limited') {
            console.warn("Analyze rate-limited — either this app's own limit or Groq's upstream limit.");
            setError("The AI is currently unavailable. Please wait some time and try again.");
            return false;
        }
        if (!result) {
            console.warn("Analyze failed — no result returned.");
            setError("Couldn't analyze that sentence. Check your connection and try again.");
            return false;
        }

        setAnalysis(result);
        setAnalyzed(text);
        setHistory(await addAnalysis(text, lang, result));
        return true;
    }, [sentence, language.code]);

    /** Shows a past result again — no network call, it's already stored.
     * @param {AnalysisHistoryEntry} entry the history entry to display
     * @returns nothing
     * 
     */
    function handleOpenHistory(entry: AnalysisHistoryEntry): void {
        setSentence(entry.text);
        setAnalysis(entry.analysis);
        setAnalyzed(entry.text);
        setError("");
        triggerHighlight();
    }

    /** Prompts the user to remove a past result, and removes it if confirmed.
     * @param {AnalysisHistoryEntry} entry the history entry to remove
     * @returns nothing
     * 
     */
    function handleRemoveHistory(entry: AnalysisHistoryEntry): void {
        showActionSheet("Remove analysis", entry.text, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove",
                style: "destructive",
                onPress: async () => setHistory(await removeAnalysis(entry.createdAt)),
            },
        ]);
    }

    return (
        <View className="flex-1 bg-background">
            <KeyboardAwareScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
                keyboardShouldPersistTaps="handled"
                bottomOffset={80}
                onScroll={onScroll}
                scrollEventThrottle={scrollEventThrottle}
            >
                {/* Added it so we can change the dictionary that the analysis uses */}
                <LanguageModal selected={language} onSelect={setLanguage} />

                <View className="gap-1.5">
                    <Text className="text-[13px] mb-2 font-semibold uppercase tracking-[0.5px] text-muted">
                        Sentence (In any language)
                    </Text>
                    <ClearableTextInput
                        // p-3 (not px-3 py-3) so Android doesn't discard the padding — see AGENTS.md.
                        className="min-h-24 rounded-lg border border-border-input bg-input p-3 text-sm text-fg"
                        style={{ textAlignVertical: "top" }}
                        placeholder={typedPlaceholder || "Type a sentence to analyze..."}
                        placeholderTextColor={placeholderColor}
                        value={sentence}
                        onChangeText={(t) => {
                            setSentence(t);
                            setError("");
                        }}
                        multiline
                        maxLength={MAX_SENTENCE_LENGTH}
                        autoCapitalize="sentences"
                    />
                    <View className="flex-row items-center justify-between">
                        <Text className="flex-1 text-[11px] leading-3.75 text-faded">
                            The language you type in is the one analyzed; definitions come back in the dictionary language.
                            Analyzed on the Word Bank server — not stored, not tied to you.
                        </Text>
                        <Text className="text-[11px] text-faded">
                            {sentence.length}/{MAX_SENTENCE_LENGTH}
                        </Text>
                    </View>
                </View>

                {/* Falls back to the shown placeholder sentence when the field is
                    empty — same click-to-accept pattern as SearchBar/words-list. */}
                <SearchButton
                    onPress={async () => {
                        const text = sentence.trim() || word;
                        setSentence(text);
                        setError("");
                        if (await handleAnalyze(text)) {
                            triggerHighlight();
                        }
                    }}
                    loading={loading}
                    label="Analyze"
                    loadingLabel="Analyzing"
                />

                {error ? <Text className="text-[13px] text-error">{error}</Text> : null}

                {analysis ? (
                    <View className="relative">
                        <AnalysisResult sentence={analyzed} analysis={analysis} />
                        {/* Shows a highlight around the analyzed sentence when it's selected */}
                        {showHighlight ? (
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    StyleSheet.absoluteFill,
                                    { borderWidth: 2, borderColor: ACCENT, borderRadius: 10 },
                                    highlightStyle,
                                ]}
                            />
                        ) : null}
                    </View>
                ) : null}

                {!analysis && !loading ? (
                    <View className="gap-2">
                        <Text className="text-[11px] mt-7 mb-2 font-semibold uppercase tracking-[0.5px] text-muted">
                            Try one
                        </Text>
                        {suggestionSentences.map((exampleSentence: string) => (
                            <Pressable
                                key={exampleSentence}
                                className="rounded-lg border border-border bg-card p-3"
                                // Tapping an example fills the field and analyzes it straight
                                // away — no second tap on the button. This section is below
                                // the fold, so once the result lands, scroll to it and flash it.
                                onPress={async () => {
                                    setSentence(exampleSentence);
                                    setError("");
                                    if (await handleAnalyze(exampleSentence)) {
                                        triggerHighlight();
                                    }
                                }}
                            >
                                <Text className="text-[13px] italic leading-4.5 text-secondary">{exampleSentence}</Text>
                            </Pressable>
                        ))}
                    </View>
                ) : null}

                {history.length > 0 ? (
                    <View className="gap-2">
                        <Text className="text-[11px] mt-7 mb-2 font-semibold uppercase tracking-[0.5px] text-muted">
                            Recent ({history.length})
                        </Text>
                        {history.map((entry) => (
                            <Pressable
                                key={entry.createdAt}
                                className="flex-row items-center gap-2 rounded-lg bg-card p-3"
                                onPress={() => handleOpenHistory(entry)}
                                onLongPress={() => handleRemoveHistory(entry)}
                            >
                                <Text className="flex-1 text-[13px] leading-4.5 text-body" numberOfLines={2}>
                                    {entry.text}
                                </Text>
                                <Text className="text-lg text-faded">›</Text>
                            </Pressable>
                        ))}
                        <Text className="ml-1 text-[11px] text-faded">Long-press an entry to remove it.</Text>
                    </View>
                ) : null}
            </KeyboardAwareScrollView>
        </View>
    );
}
