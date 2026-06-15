import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useThemedStyles } from "@/hooks/use-themed-styles";
import {
    DEFAULT_NOTIFICATION_SETTINGS,
    getNotificationSettings,
    setNotificationSettings,
    type NotificationSettings,
} from "@/storage/notifications-storage";
import { ACCENT, Colors } from "@/styles/global";
import { ensureNotificationPermission, syncNotifications } from "@/utils/notifications";

const WORDS_MIN = 1;
const WORDS_MAX = 50;
const TIME_STEP = 30; // minutes per tap on the time stepper
const DAY_MINUTES = 24 * 60;

function formatTime(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function NotificationsSettingsScreen() {
    const styles = useThemedStyles(lightStyles, darkStyles);

    const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
    const [loading, setLoading] = useState<boolean>(true);
    const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

    useEffect(() => {
        let active = true;
        getNotificationSettings().then((saved) => {
            if (!active) {
                return;
            }
            setSettings(saved);
            setLoading(false);
        });
        return () => { active = false; };
    }, []);

    // Persist + reconcile the OS schedule whenever a setting changes.
    async function persist(next: NotificationSettings): Promise<void> {
        setSettings(next);
        await setNotificationSettings(next);
        await syncNotifications(next);
    }

    async function handleToggle(value: boolean): Promise<void> {
        if (value) {
            const granted = await ensureNotificationPermission();
            if (!granted) {
                setPermissionDenied(true);
                return;
            }
            setPermissionDenied(false);
        }
        await persist({ ...settings, enabled: value });
    }

    function changeWordsPerDay(delta: number): void {
        const wordsPerDay = Math.min(WORDS_MAX, Math.max(WORDS_MIN, settings.wordsPerDay + delta));
        persist({ ...settings, wordsPerDay });
    }

    function changeTime(delta: number): void {
        const timeMinutes = (settings.timeMinutes + delta + DAY_MINUTES) % DAY_MINUTES;
        persist({ ...settings, timeMinutes });
    }

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Daily reminders</Text>
                    <Switch
                        value={settings.enabled}
                        onValueChange={handleToggle}
                        disabled={loading}
                        trackColor={{ true: ACCENT }}
                    />
                </View>

                <View style={[styles.row, styles.rowBorder]}>
                    <Text style={styles.rowLabel}>Words per day</Text>
                    <View style={styles.stepper}>
                        <Pressable style={styles.stepButton} onPress={() => changeWordsPerDay(-1)} hitSlop={8}>
                            <Text style={styles.stepButtonText}>−</Text>
                        </Pressable>
                        <Text style={styles.stepValue}>{settings.wordsPerDay}</Text>
                        <Pressable style={styles.stepButton} onPress={() => changeWordsPerDay(1)} hitSlop={8}>
                            <Text style={styles.stepButtonText}>+</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={[styles.row, styles.rowBorder]}>
                    <Text style={styles.rowLabel}>Reminder time</Text>
                    <View style={styles.stepper}>
                        <Pressable style={styles.stepButton} onPress={() => changeTime(-TIME_STEP)} hitSlop={8}>
                            <Text style={styles.stepButtonText}>−</Text>
                        </Pressable>
                        <Text style={styles.stepValue}>{formatTime(settings.timeMinutes)}</Text>
                        <Pressable style={styles.stepButton} onPress={() => changeTime(TIME_STEP)} hitSlop={8}>
                            <Text style={styles.stepButtonText}>+</Text>
                        </Pressable>
                    </View>
                </View>
            </View>

            {permissionDenied ? (
                <Text style={styles.warning}>
                    Notifications are turned off for Word Bank in your system settings. Enable them there to receive daily reminders.
                </Text>
            ) : null}

            <Text style={styles.description}>
                When enabled, you&apos;ll get one reminder a day at the time above. Tap it to review the words that are
                due — mark each as <Text style={styles.emphasis}>Got it</Text> or <Text style={styles.emphasis}>Again</Text>.
                Words you know come back less often; ones you miss come back sooner.
            </Text>
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
        card: {
            backgroundColor: C.backgroundCard,
            borderRadius: 10,
            overflow: 'hidden',
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 12,
            minHeight: 52,
        },
        rowBorder: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: C.border,
        },
        rowLabel: {
            fontSize: 15,
            color: C.text,
        },
        stepper: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
        },
        stepButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: ACCENT,
            alignItems: 'center',
            justifyContent: 'center',
        },
        stepButtonText: {
            color: ACCENT,
            fontSize: 18,
            fontWeight: '700',
            lineHeight: 20,
        },
        stepValue: {
            fontSize: 15,
            fontWeight: '600',
            color: C.text,
            minWidth: 48,
            textAlign: 'center',
        },
        warning: {
            fontSize: 13,
            color: C.textSecondary,
            backgroundColor: C.backgroundCard,
            borderRadius: 8,
            padding: 12,
            lineHeight: 19,
        },
        description: {
            fontSize: 14,
            color: C.textMuted,
            lineHeight: 21,
        },
        emphasis: {
            fontWeight: '600',
            color: C.textSecondary,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
