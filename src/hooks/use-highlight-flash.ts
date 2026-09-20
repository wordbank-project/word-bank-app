import { useEffect, useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming, type AnimatedStyle } from 'react-native-reanimated';

import { ACCENT } from '@/styles/global';

// The shared "flash a highlight" reward/attention beat: an accent-border
// overlay snaps to full opacity, holds briefly, then fades out. Originally
// duplicated three times (book.tsx's scroll-to-focused-word, analyze.tsx's
// reopened-result/tried-example highlight, WordOfTheDayCard.tsx's reveal
// glow) with identical timing and styling — consolidated here.

// Render this as `<Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, HIGHLIGHT_BORDER_STYLE, style]} />`,
// only while `activeKey` (or, for a single-target caller, a plain truthiness
// check) says it should be visible.
export const HIGHLIGHT_BORDER_STYLE: ViewStyle = { borderWidth: 2, borderColor: ACCENT, borderRadius: 10 };

// Sentinel key for callers with only one possible highlight target (no need
// to track *which* one, just whether it's currently flashing).
const DEFAULT_KEY = 'default';

export type HighlightFlash = {
    /** The key currently flashing, or `null` if none — compare against your own key for a multi-target caller (e.g. `activeKey === item.word`), or just check for non-`null` otherwise. */
    activeKey: string | null;
    /** The animated opacity style to spread onto the highlight overlay. */
    style: AnimatedStyle<ViewStyle>;
    /** Starts the flash, optionally for a specific `key` (multi-target callers). */
    trigger: (key?: string) => void;
};

/**
 * Shared "flash a highlight" effect — fires an accent-border overlay at full
 * opacity, holds for 1200ms, then fades out over 500ms and unmounts.
 *
 * @returns {HighlightFlash} `activeKey`/`style` to render the overlay with, and `trigger` to start the flash.
 *
 */
export function useHighlightFlash(): HighlightFlash {
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const opacity = useSharedValue(0);
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        };
    }, []);

    function trigger(key: string = DEFAULT_KEY): void {
        setActiveKey(key);
        // Show at full strength immediately — a plain assignment, so no
        // accessibility setting can skip it — then fade out. ReduceMotion.Never
        // throughout: with the default (System) a device with "Remove
        // animations"/battery saver snaps animations to their end value, which
        // left the outline invisible on Android. Same reason SearchButton's
        // loading dots opt out.
        opacity.value = 1;
        opacity.value = withDelay(
            1200,
            withTiming(0, { duration: 500, reduceMotion: ReduceMotion.Never }),
            ReduceMotion.Never,
        );
        // Unmount the overlay once the fade has finished.
        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => setActiveKey(null), 1800);
    }

    return { activeKey, style, trigger };
}
