import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { getDailyGoal } from '@/storage/engagement-storage';
import { computeStreak, countToday } from '@/utils/streak';

type StreakBarProps = {
    /** addedAt timestamps of every saved word (across all books). */
    timestamps: number[];
};

/**
 * Compact habit strip for the Words List: 🔥 N-day streak, today's progress
 * toward the daily goal, and a thin progress bar. Everything is derived
 * locally from the words' addedAt timestamps — hidden entirely while the
 * user has no words yet, so day one shows no guilt UI.
 */
export default function StreakBar({ timestamps }: StreakBarProps) {
    const [goal, setGoal] = useState<number>(3);

    useEffect(() => {
        getDailyGoal().then(setGoal);
    }, []);

    if (timestamps.length === 0) {
        return null;
    }

    const streak = computeStreak(timestamps);
    const today = countToday(timestamps);
    const progress = Math.min(today / goal, 1);
    const goalReached = today >= goal;

    return (
        <View className="mx-4 mb-2 rounded-[10px] bg-card px-3.5 py-2.5">
            <View className="flex-row items-center justify-between">
                <Text className="text-[13px] font-semibold text-fg">
                    🔥 {streak === 1 ? '1-day streak' : `${streak}-day streak`}
                </Text>
                <Text className={`text-[13px] font-medium ${goalReached ? 'text-accent' : 'text-muted'}`}>
                    {goalReached ? `Goal reached · ${today} today` : `${today}/${goal} words today`}
                </Text>
            </View>
            <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-input">
                <View
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${progress * 100}%` }}
                />
            </View>
        </View>
    );
}
