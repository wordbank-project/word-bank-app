import React from "react";

import { Text, View } from "react-native";
import Reanimated from "react-native-reanimated";

import { usePulse } from "@/hooks/use-pulse";

// Varied widths per card so the skeletons read as real (differently sized) content.
const SKELETON_WORD_WIDTHS = ['35%', '28%', '42%'] as const;
const SKELETON_POS_WIDTHS = ['18%', '14%', '20%'] as const;
const SKELETON_LINE_WIDTHS = ['92%', '85%', '95%'] as const;
const SKELETON_LAST_LINE_WIDTHS = ['60%', '74%', '48%'] as const;

// Placeholder word cards shown in the Words section while the book's words load.
export function WordCardSkeletons() {
    const animStyle = usePulse();

    return (
        <React.Fragment>
            {SKELETON_WORD_WIDTHS.map((wordW, i) => (
                // Reanimated view carries only the pulsing opacity; layout/colors are classes.
                <Reanimated.View key={i} style={animStyle}>
                    <View className="gap-2 rounded-[10px] bg-card p-3.5">
                        <View className="rounded bg-cover-placeholder" style={{ width: wordW, height: 16 }} />
                        <View className="rounded bg-cover-placeholder" style={{ width: SKELETON_POS_WIDTHS[i], height: 11 }} />
                        <View className="rounded bg-cover-placeholder" style={{ width: SKELETON_LINE_WIDTHS[i], height: 13 }} />
                        <View className="rounded bg-cover-placeholder" style={{ width: SKELETON_LAST_LINE_WIDTHS[i], height: 13 }} />
                    </View>
                </Reanimated.View>
            ))}
        </React.Fragment>
    );
}

// Placeholder for the footer's read-status pills while the read-list entry
// loads — three equal blocks mirroring ReadStatusSelector's layout, so the
// status doesn't flash the default "Want to read" before the real one loads.
export function ReadStatusSkeleton() {
    const animStyle = usePulse();

    return (
        <Reanimated.View style={animStyle} className="flex-row gap-2">
            {[0, 1, 2].map((i) => (
                <View key={i} className="flex-1 rounded-lg bg-cover-placeholder" style={{ height: 36 }} />
            ))}
        </Reanimated.View>
    );
}

// Placeholder for the footer's "Save/Update read list" button while the
// read-list entry loads (its label depends on inReadList, from the same load).
export function SaveButtonSkeleton() {
    const animStyle = usePulse();

    return (
        <Reanimated.View style={animStyle} className="mt-1">
            <View className="rounded-lg bg-cover-placeholder" style={{ height: 44 }} />
        </Reanimated.View>
    );
}

// Placeholder for the header's "N words" count line.
export function WordCountSkeleton() {
    const animStyle = usePulse();

    return (
        <Reanimated.View style={animStyle} className="my-0.5">
            <View className="rounded bg-cover-placeholder" style={{ width: 64, height: 13 }} />
        </Reanimated.View>
    );
}

// Placeholder for a LanguageModal trigger row while its saved language hasn't
// loaded yet (see useSavedLanguage's languageReady / book.tsx's own
// translateToLanguageReady) — keeps the row's chrome (border, label) and only
// skeletonizes the value/chevron side, so it doesn't flash the default
// language before the real saved one loads.
export function LanguageModalSkeleton({ label = "Dictionary language" }: { label?: string }) {
    const animStyle = usePulse();

    return (
        <View className="flex-row items-center justify-between border-b border-border px-3 py-2">
            <Text className="text-[13px] text-muted">{label}</Text>
            <Reanimated.View style={animStyle}>
                <View className="rounded bg-cover-placeholder" style={{ width: 70, height: 14 }} />
            </Reanimated.View>
        </View>
    );
}

// Placeholder text lines shown inside the Book Notes / My Review cards while the
// read-list entry loads. Content-only: the card chrome (label, Edit link) stays.
export function NoteCardSkeleton() {
    const animStyle = usePulse();

    return (
        <Reanimated.View style={animStyle} className="gap-2 py-0.5">
            <View className="rounded bg-cover-placeholder" style={{ width: '90%', height: 13 }} />
            <View className="rounded bg-cover-placeholder" style={{ width: '66%', height: 13 }} />
        </Reanimated.View>
    );
}
