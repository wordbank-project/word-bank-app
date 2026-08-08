import React from "react";

import { Text, View } from "react-native";

import type { SentenceAnalysis } from "@/models/sentence-analysis";

type AnalysisResultProps = {
    sentence: string;
    analysis: SentenceAnalysis;
};

/**
 * A label for a section of the analysis result, e.g. "Meaning".
 * @param {object} props the component props
 * @param {React.ReactNode} props.children the label text
 * @returns {JSX.Element} the rendered label
 * 
 */
function Label({ children }: { children: React.ReactNode }) {
    return (
        <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">{children}</Text>
    );
}

export default function AnalysisResult({ sentence, analysis }: AnalysisResultProps) {
    return (
        <View className="gap-3.5 rounded-[10px] bg-card p-3.5">
            <Text className="text-[15px] italic leading-5.5 text-secondary">“{sentence}”</Text>

            <View className="gap-1 border-t border-border pt-3">
                <Label>Meaning</Label>
                <Text className="text-[15px] leading-5.5 text-fg">{analysis.meaning}</Text>
            </View>
        </View>
    );
}
