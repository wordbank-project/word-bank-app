import React from "react";

import { View } from "react-native";
import Animated from "react-native-reanimated";

import { usePulse } from "@/hooks/use-pulse";

// Varied widths per skeleton card so they read as real (differently sized)
// sentences rather than three identical bars. Matches suggestions-api.ts's
// MAX_SENTENCES (3).
const SENTENCE_SKELETON_WIDTHS: readonly [`${number}%`, `${number}%`][] = [
    ['92%', '58%'],
    ['85%', '70%'],
    ['95%', '40%'],
];

/**
 * One pulsing skeleton card, mirroring one "Try one sentence" card's shape
 * (rounded border, two lines of text).
 *
 * @param {{ firstLineWidth: `${number}%`, secondLineWidth: `${number}%` }} props The two lines' widths.
 * @returns {JSX.Element} The pulsing card.
 *
 */
function ExampleSentenceSkeletonCard({ firstLineWidth, secondLineWidth }: { firstLineWidth: `${number}%`; secondLineWidth: `${number}%` }) {
    const animStyle = usePulse();

    return (
        <Animated.View style={animStyle}>
            <View className="gap-1.5 rounded-lg border border-border bg-card p-3">
                <View className="rounded bg-cover-placeholder" style={{ width: firstLineWidth, height: 12 }} />
                <View className="rounded bg-cover-placeholder" style={{ width: secondLineWidth, height: 12 }} />
            </View>
        </Animated.View>
    );
}

/**
 * Placeholder cards shown in analyze.tsx's "Try one sentence" list while the
 * AI-generated example sentences are still loading — mirrors the real cards'
 * shape instead of the section just being absent.
 *
 * @returns {JSX.Element} The pulsing skeleton cards.
 *
 */
export default function ExampleSentenceSkeletons() {
    return (
        <React.Fragment>
            {SENTENCE_SKELETON_WIDTHS.map(([firstLineWidth, secondLineWidth], i) => (
                <ExampleSentenceSkeletonCard key={i} firstLineWidth={firstLineWidth} secondLineWidth={secondLineWidth} />
            ))}
        </React.Fragment>
    );
}
