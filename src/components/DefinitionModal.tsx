import React, { useEffect, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/context/theme-context";

import type { WordDefinition } from "@/models/word-entry";

import { Colors } from "@/styles/global";
import { posColor } from "@/utils/part-of-speech";

type DefinitionModalProps = {
    visible: boolean;
    onClose: () => void;
    word: string;
    definitions: WordDefinition[];
    selectedIndex: number;
    onSelect: (index: number) => void;
};

// A row in the list is either a part-of-speech header or a definition (with its
// original index, so selecting still maps back to the unfiltered `definitions`).
type Row =
    | { type: 'header'; pos: string }
    | { type: 'item'; def: WordDefinition; index: number };

export default function DefinitionModal({ visible, onClose, word, definitions, selectedIndex, onSelect }: DefinitionModalProps) {
    const insets = useSafeAreaInsets();
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

    const [search, setSearch] = useState<string>('');

    // Clear the search whenever the modal closes so it reopens fresh.
    useEffect(() => {
        if (!visible) {
            setSearch('');
        }
    }, [visible]);

    // Filter by definition text and part of speech, then group under POS headers.
    // useMemo so it only recomputes when the search or the definitions change.
    const rows = useMemo<Row[]>(() => {
        const query = search.trim().toLowerCase();
        const result: Row[] = [];
        let lastPos: string | null = null;
        definitions.forEach((def, index) => {
            const matches = !query
                || def.definition.toLowerCase().includes(query)
                || def.partOfSpeech.toLowerCase().includes(query);
            if (!matches) {
                return;
            }
            if (def.partOfSpeech !== lastPos) {
                lastPos = def.partOfSpeech;
                result.push({ type: 'header', pos: def.partOfSpeech });
            }
            result.push({ type: 'item', def, index });
        });
        return result;
    }, [search, definitions]);

    function handleSelect(index: number): void {
        onSelect(index);
        onClose();
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView behavior="padding" className="flex-1">
                <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
                    <Pressable className="max-h-[50%] rounded-t-2xl bg-background" style={{ paddingBottom: insets.bottom + 16 }}>
                        <FlatList
                            data={rows}
                            keyExtractor={(row, index) => (row.type === 'header' ? `h_${index}` : `d_${row.index}`)}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item: row }) => {
                                if (row.type === 'header') {
                                    return (
                                        <Text
                                            className="px-4 pb-1 pt-3.5 text-xs font-bold uppercase tracking-[0.5px]"
                                            style={{ color: posColor(row.pos) }}
                                        >
                                            {row.pos}
                                        </Text>
                                    );
                                }
                                const active = row.index === selectedIndex;
                                return (
                                    <Pressable
                                        className={`flex-row items-start gap-2 border-b border-border px-4 py-3 ${active ? "bg-card" : ""}`}
                                        onPress={() => handleSelect(row.index)}
                                    >
                                        <View className="flex-1 gap-0.5">
                                            <Text className={`text-[15px] leading-5 ${active ? "font-semibold text-accent" : "text-fg"}`}>
                                                {row.def.definition}
                                            </Text>
                                            {row.def.exampleSentence ? (
                                                <Text className="text-[13px] italic leading-5 text-muted">“{row.def.exampleSentence}”</Text>
                                            ) : null}
                                        </View>
                                        {active && <Text className="mt-0.5 text-sm font-bold text-accent">✓</Text>}
                                    </Pressable>
                                );
                            }}
                            ListEmptyComponent={
                                <Text className="p-6 text-center text-sm text-muted">No definitions match &quot;{search}&quot;</Text>
                            }
                        />
                        <View className="flex-row items-center justify-between gap-3 px-4 pb-2 pt-4">
                            <Text className="flex-1 text-base font-bold text-fg" numberOfLines={1}>Definitions for: {word}</Text>
                            <Pressable onPress={onClose} hitSlop={12}>
                                <Text className="text-base text-muted">✕</Text>
                            </Pressable>
                        </View>

                        <TextInput
                            className="mx-4 rounded-lg border border-border-input bg-input px-3 py-3 text-[15px] text-fg"
                            placeholder="Search definitions..."
                            placeholderTextColor={placeholderColor}
                            value={search}
                            onChangeText={setSearch}
                            autoCorrect={false}
                        />
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}
