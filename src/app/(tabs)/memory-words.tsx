import { useCallback, useEffect, useState } from "react";

import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

import { Link, useFocusEffect } from "expo-router";

import { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { getAllWords, type WordWithBook } from "@/storage/read-list-storage";
import { recordRating } from "@/storage/memory-stats-storage";
import {
    areNotificationsEnabled,
    getReminderTime,
    getReminderWordCount,
    setNotificationsEnabled as persistNotificationsEnabled,
    setReminderTime as persistReminderTime,
    setReminderWordCount as persistReminderWordCount,
    type ReminderTime,
    type RoundSize,
} from "@/storage/notifications-storage";

import { ACCENT } from "@/styles/global";

import { buildDeck } from "@/utils/build-deck";
import {
    cancelDailyReminder,
    defaultReminderBody,
    requestReminderPermission,
    rescheduleDailyReminder,
    scheduleDailyReminder,
} from "@/utils/daily-reminder";
import { dateFromTime } from "@/utils/date";

import DailyReminderCard from "@/components/DailyReminderCard";
import FlashCard from "@/components/FlashCard";
import SizeChipRow from "@/components/SizeChipRow";

// Round phases
type RoundPhase = "start" | "playing" | "summary";

export default function MemoryWordsScreen() {

    // Notification reminder toggle
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
    const [reminderHour, setReminderHour] = useState<number>(9); // 9:00 AM
    const [reminderMinute, setReminderMinute] = useState<number>(0);
    const [reminderWordCount, setReminderWordCount] = useState<RoundSize>(10); // 10 words
    const [showIosTimePicker, setShowIosTimePicker] = useState<boolean>(false);

    // Memory game
    // Word pool are all saved words in total
    const [wordPool, setWordPool] = useState<WordWithBook[]>([]);
    const [poolLoading, setPoolLoading] = useState<boolean>(true);
    const [roundSize, setRoundSize] = useState<RoundSize>(10); // 10 words
    const [phase, setPhase] = useState<RoundPhase>("start");
    const [deck, setDeck] = useState<WordWithBook[]>([]);

    // index and knewCount are the two pieces of state that track where you are in the current round.
    const [index, setIndex] = useState<number>(0);
    const [knewCount, setKnewCount] = useState<number>(0);

    // Object e.g {'tenacious', 'melancholy'}
    // With session in memory we mean when the native app gets killed and restarted on the phone,
    // Or the browser window gets reloaded
    const [wordsKnownThisSession, setWordsKnownThisSession] = useState<Set<string>>(new Set());

    // Load the notification toggle and reminder settings once on mount with useEffect()
    useEffect(() => {
        areNotificationsEnabled().then(setNotificationsEnabled);
        getReminderTime().then((savedTime: ReminderTime | null) => {
            if (savedTime) {
                setReminderHour(savedTime.hour);
                setReminderMinute(savedTime.minute);
            }
        });
        getReminderWordCount().then((savedRoundSize: RoundSize | null) => {
            if (savedRoundSize) {
                setReminderWordCount(savedRoundSize);
            }
        });
    }, []);

    // useFocusEffect (unlike a plain useEffect()) 
    // re-runs its function every time this screen regains focus, not just on mount.
    // useCallBack only gets a new version if `phase` changes.
    // when phase is playing we dont get and set the words again
    useFocusEffect(
        useCallback(() => {
            if (phase === "playing") {
                return;
            }
            getAllWords().then((words: WordWithBook[]) => {
                setWordPool(words);
                setPoolLoading(false);
            });
        }, [phase])
    );

    /**
     * Starts a fresh round: re-reads and sets the current word pool,
     * Checks if all words are known this session.
     * If it is we get a new Set otherwise save them in memory.
     * We create a new deck with unique words and restart all the values
     * 
     * @returns {Promise<void>} Resolves once the new round is ready to play.
     *
     */
    async function startRound(): Promise<void> {
        const allWords: WordWithBook[] = await getAllWords();
        setWordPool(allWords);

        const areAllWordsKnownThisSession: boolean = allWords.length > 0 && allWords.every((eachWord: WordWithBook) => {
            return wordsKnownThisSession.has(eachWord.word.trim().toLowerCase())
        })

        // If all words are know this session we set a `new Set()`
        // otherwise save the known words in memory
        const activeKnownWords = areAllWordsKnownThisSession ? new Set<string>() : wordsKnownThisSession;
        setWordsKnownThisSession(activeKnownWords);

        // New deck and restarting the values
        setDeck(buildDeck(allWords, roundSize, activeKnownWords));
        setIndex(0);
        setKnewCount(0);
        setPhase("playing");
    }

    /**
     * Leaves the round in progress and returns to the start screen.
     * Sets round phase to start
     * @returns {void} Returns nothing.
     *
     */
    function exitRound(): void {
        setPhase("start");
    }

    /**
     * Ends the current round: shows the summary screen and, if the daily
     * reminder is enabled, re-schedules it with this round's result.
     *
     * @param {number} finalKnewCount The number of words marked "Knew it" this round.
     * @returns {void} Returns nothing.
     *
     */
    function finishRound(finalKnewCount: number): void {
        setKnewCount(finalKnewCount);
        setPhase("summary");
        rescheduleDailyReminder(notificationsEnabled, finalKnewCount, deck.length, reminderHour, reminderMinute).catch(() => { });
    }

    /**
     * Record the answer (locally in memory and in AsyncStorage), 
     * and either advance to the next card or end the round if that was the last one.
     * @param {boolean} knew Whether the user marked the card "Knew it".
     * @returns {void} Returns nothing.
     *
     */
    function handleRate(knew: boolean): void {
        const nextKnewCount: number = knew ? knewCount + 1 : knewCount;

        if (knew) {
            // Save locally to memory
            setWordsKnownThisSession((prev: Set<string>) => {
                return new Set(prev).add(deck[index].word.trim().toLowerCase());
            })
        }
        // Save to AsyncStorage, shown in stats.tsx page
        recordRating(deck[index].word, knew)
            .catch((error) => (console.error(error)))

        const nextIndex = index + 1;
        // If we are at the end of the deck array
        if (nextIndex >= deck.length) {
            // Shows the summary screen and stop here
            finishRound(nextKnewCount);
            return;
        }
        // Otherwise, save the updated tally and move on to the next card
        setKnewCount(nextKnewCount);
        setIndex(nextIndex);
    }

    /**
     * Turns the daily reminder on or off: on requests permission and schedules
     * the word-count-target default reminder; off cancels it. Either way the
     * choice is saved in AsyncStorage.
     *
     * @param {boolean} next Whether the reminder should be enabled.
     * @returns {Promise<void>} Resolves once the toggle has been applied.
     *
     */
    async function handleToggleNotifications(next: boolean): Promise<void> {
        if (!next) {
            setNotificationsEnabled(false);
            await persistNotificationsEnabled(false);
            await cancelDailyReminder();
            return;
        }

        const accessGranted = await requestReminderPermission();
        if (!accessGranted) {
            return; // requestReminderPermission already showed the denial notice
        }
        setNotificationsEnabled(true);
        await persistNotificationsEnabled(true);
        await scheduleDailyReminder(defaultReminderBody(reminderWordCount), reminderHour, reminderMinute);
    }

    /**
     * Applies a time picked from the native time picker: updates state,
     * saves it, and — if the reminder is on — re-schedules it for the new
     * time.
     *
     * @param {DateTimePickerEvent} event The picker's change event.
     * @param {Date} [selectedDate] The picked time, present when the user confirmed a choice.
     * @returns {void} Returns nothing.
     *
     */
    function handleTimeChange(event: DateTimePickerEvent, selectedDate?: Date): void {
        // iOS has no native dialog to auto-dismiss, 
        // so hide our own inline picker here
        if (Platform.OS === "ios") {
            setShowIosTimePicker(false);
        }

        // If the user cancelled the picker or no valid date is usable
        if (event.type !== "set" || !selectedDate) {
            return;
        }

        const hour: number = selectedDate.getHours();
        const minute: number = selectedDate.getMinutes();
        setReminderHour(hour);
        setReminderMinute(minute);
        persistReminderTime(hour, minute);
        if (notificationsEnabled) {
            scheduleDailyReminder(defaultReminderBody(reminderWordCount), hour, minute)
                .catch((err) => (console.error(err)));
        }
    }

    /**
     * Opens the native time picker for choosing the reminder's fire time —
     * Android's imperative dialog, or iOS's inline spinner (toggled via state;
     * iOS has no equivalent standalone dialog API).
     *
     * @returns {void} Returns nothing.
     *
     */
    function openTimePicker(): void {
        const dateValue = dateFromTime(reminderHour, reminderMinute);
        // Android
        if (Platform.OS === "android") {
            DateTimePickerAndroid.open({ value: dateValue, mode: "time", onChange: handleTimeChange });
            return;
        }
        // iOS
        setShowIosTimePicker(true);
    }

    /**
     * Applies a new reminder word-count target: updates state, saves it,
     * and — if the reminder is on — re-schedules it with the updated default body.
     *
     * @param {RoundSize} value The new word-count target ("all" for the whole pool).
     * @returns {Promise<void>} Resolves once the change has been applied.
     *
     */
    async function handleReminderWordCountChange(value: RoundSize): Promise<void> {
        setReminderWordCount(value);
        await persistReminderWordCount(value);
        if (notificationsEnabled) {
            await scheduleDailyReminder(defaultReminderBody(value), reminderHour, reminderMinute);
        }
    }

    if (poolLoading) {
        return (
            <View className="flex-1 bg-background">
                <ActivityIndicator className="mt-12" color={ACCENT} />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background p-4">
            {/* `start` or `summary` phase. */}
            {/* Not supported on web for now */}
            {phase !== "playing" && Platform.OS !== "web" ? (
                <DailyReminderCard
                    enabled={notificationsEnabled}
                    onToggleEnabled={handleToggleNotifications}
                    hour={reminderHour}
                    minute={reminderMinute}
                    onOpenTimePicker={openTimePicker}
                    wordCountTarget={reminderWordCount}
                    onWordCountChange={handleReminderWordCountChange}
                    maxAllowedInputValue={wordPool.length}
                    showIosTimePicker={showIosTimePicker}
                    onIosTimeChange={handleTimeChange}
                    onCloseIosTimePicker={() => setShowIosTimePicker(false)}
                />
            ) : null}

            {phase !== "playing" && wordPool.length > 0 ? (
                <View className="mb-4 gap-2">
                    <Text className="ml-0.5 text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                        Round size
                    </Text>
                    <SizeChipRow value={roundSize} onChange={setRoundSize} maxAllowedInputValue={wordPool.length} />
                </View>
            ) : null}

            {(phase === "start" || phase === "summary") && wordPool.length > 0 ? (
                <Link href={{ pathname: "/stats", params: { from: "memory" } }} className="mb-2 self-center text-sm text-accent">
                    View your stats ›
                </Link>
            ) : null}

            {wordPool.length === 0 ? (
                <View className="mt-16 items-center gap-2.5 px-8">
                    <Text className="text-lg font-semibold text-fg">No words to practice yet</Text>
                    <Link href="/(tabs)/read-list" className="text-center text-sm text-accent">
                        Open a book and add words to build your word bank.
                    </Link>
                </View>
            ) : phase === "start" ? (
                <View className="mt-8 items-center gap-4 px-8">
                    <Text className="text-lg font-semibold text-fg">
                        {roundSize === "all"
                            ? `${wordPool.length} ${wordPool.length === 1 ? "word" : "words"} ready to practice`
                            : `${Math.min(roundSize, wordPool.length)} of ${wordPool.length} ${wordPool.length === 1 ? "word" : "words"} this round`}
                    </Text>
                    <Pressable onPress={startRound} className="items-center rounded-xl bg-accent px-6 py-3.5">
                        <Text className="font-semibold text-white">Practice</Text>
                    </Pressable>
                </View>
            ) : phase === "playing" ? (
                <View className="mt-6 gap-3">
                    <View className="mb-4 flex-row items-center justify-between">
                        <Pressable onPress={exitRound} hitSlop={8}>
                            <Text className="text-[16px] font-medium text-accent">‹ Exit</Text>
                        </Pressable>
                        <Text className="text-xs font-semibold uppercase tracking-[0.5px] text-muted">
                            Card {index + 1} of {deck.length}
                        </Text>
                    </View>
                    <FlashCard word={deck[index]} onRate={handleRate} />
                </View>
                // Finish summary
            ) : (
                <View className="mt-8 items-center gap-4 px-8">
                    <Text className="text-2xl font-bold text-fg">Round complete!</Text>
                    <Text className="text-lg text-body">
                        You knew {knewCount}/{deck.length} words
                    </Text>
                    <Pressable onPress={startRound} className="mt-2 items-center rounded-xl bg-accent px-6 py-3.5">
                        <Text className="font-semibold text-white">Practice again</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}
