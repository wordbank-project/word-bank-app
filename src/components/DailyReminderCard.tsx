import { Platform, Pressable, Switch, Text, View } from "react-native";

import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { useColorScheme } from "@/context/theme-context";

import type { RoundSize } from "@/storage/notifications-storage";

import { ACCENT, Colors } from "@/styles/global";

import { dateFromTime, formatTime } from "@/utils/date";

import SizeChipRow from "@/components/SizeChipRow";

type DailyReminderCardProps = {
    enabled: boolean;
    onToggleEnabled: (next: boolean) => void;
    hour: number;
    minute: number;
    onOpenTimePicker: () => void;
    wordCountTarget: RoundSize;
    onWordCountChange: (value: RoundSize) => void;
    // Caps the word-count target's custom input at the actual pool size —
    // passed straight through to this card's own SizeChipRow.
    maxAllowedInputValue: number;
    showIosTimePicker: boolean;
    onIosTimeChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
    onCloseIosTimePicker: () => void;
};

/**
 * The Memory tab's "Daily practice reminder" card: an on/off toggle, and —
 * once enabled — the fire time (opens the native picker) and a word-count
 * target. Purely presentational and fully controlled: all the actual state
 * and persistence logic lives in memory-words.tsx (which also needs
 * `enabled`/`hour`/`minute` itself, to reschedule the reminder when a round
 * finishes) — this component just renders from props and calls callbacks.
 *
 * @param {DailyReminderCardProps} props The current settings and their change handlers.
 * @returns {JSX.Element} The rendered card.
 *
 */
export default function DailyReminderCard({
    enabled,
    onToggleEnabled,
    hour,
    minute,
    onOpenTimePicker,
    wordCountTarget,
    onWordCountChange,
    maxAllowedInputValue,
    showIosTimePicker,
    onIosTimeChange,
    onCloseIosTimePicker,
}: DailyReminderCardProps) {
    const colors = Colors[useColorScheme()];

    return (
        <View className="mb-4 gap-3 rounded-xl bg-card p-3.5">
            <View className="flex-row items-center justify-between">
                <Text className="text-fg">Daily practice reminder</Text>
                <Switch
                    value={enabled}
                    onValueChange={onToggleEnabled}
                    trackColor={{ false: colors.borderInput, true: ACCENT }}
                    thumbColor={Platform.OS === "android" ? colors.background : undefined}
                />
            </View>

            {enabled ? (
                <View className="gap-3 border-t border-border pt-3">
                    <Pressable onPress={onOpenTimePicker} className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Remind me at:</Text>
                        <Text className="text-sm font-semibold text-accent">
                            {formatTime(hour, minute)} ›
                        </Text>
                    </Pressable>

                    <View className="gap-2">
                        <Text className="text-sm text-muted">Words to practice</Text>
                        <SizeChipRow value={wordCountTarget} onChange={onWordCountChange} maxAllowedInputValue={maxAllowedInputValue} />
                    </View>

                    {Platform.OS === "ios" && showIosTimePicker ? (
                        <View className="items-end gap-1">
                            <DateTimePicker
                                value={dateFromTime(hour, minute)}
                                mode="time"
                                display="spinner"
                                onChange={onIosTimeChange}
                            />
                            <Pressable onPress={onCloseIosTimePicker} hitSlop={8}>
                                <Text className="text-[13px] font-medium text-accent">Done</Text>
                            </Pressable>
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}
