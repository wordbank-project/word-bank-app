import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/context/theme-context";

import type { Language } from "@/models/language";
import { LANGUAGES } from "@/models/language";

import { Colors, Fonts } from "@/styles/global";

type LanguageModalProps = {
    selected: Language;
    onSelect: (language: Language) => void;
    label?: string;
};

export default function LanguageModal({ selected, onSelect, label = "Dictionary language" }: LanguageModalProps) {
    const insets = useSafeAreaInsets();
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

    const [visible, setVisible] = useState<boolean>(false);
    const [search, setSearch] = useState<string>('');
    const listRef = useRef<FlatList<Language>>(null);
    const searchInputRef = useRef<TextInput>(null);

    function handleSelect(language: Language): void {
        onSelect(language);
        setVisible(false);
    }

    // Filter the languages based on the search query, matching against both label and code.
    // useMemo caches the result so it only re-filters when `search` changes, not on every re-render.
    const filteredLanguages = useMemo(() => {
        const searchQuery = search.trim().toLowerCase();
        return LANGUAGES.filter(language =>
            language.label.toLowerCase().includes(searchQuery) || language.code.toLowerCase().includes(searchQuery)
        );
    }, [search]);

    // Clear the search whenever the modal closes so it reopens fresh.
    useEffect(() => {
        if (!visible) {
            setSearch('');
        }
    }, [visible]);

    // Scroll the selected language into view when opening with no active search.
    useEffect(() => {
        if (!visible || search) {
            return;
        }
        const index = LANGUAGES.findIndex(language => language.code === selected.code);
        if (index > 0) {
            setTimeout(() => {
                listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.4 });
            }, 150);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when the modal opens, not on every keystroke/selection
    }, [visible]);

    return (
        <React.Fragment>
            <Pressable className="flex-row items-center justify-between border-b border-border px-3 py-2" onPress={() => setVisible(true)}>
                <Text className="text-[13px] text-muted">{label}</Text>
                <View className="flex-row items-center gap-1">
                    <Text className="text-[13px] font-semibold text-accent">{selected.label}</Text>
                    <Text className="text-lg text-accent">›</Text>
                </View>
            </Pressable>

            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={() => setVisible(false)}
                onShow={() => searchInputRef.current?.focus()}
            >
                <KeyboardAvoidingView behavior="padding" className="flex-1">
                    <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setVisible(false)}>
                        {/* On web we use 50% max height. We open the keyboard on native devices so we
                            pick 90% height to cover the screen for better UX. */}
                        <Pressable
                            className={`${Platform.OS === "web" ? "max-h-[50%]" : "max-h-[90%]"} rounded-t-2xl bg-background`}
                            style={{ paddingBottom: insets.bottom + 16 }}
                        >
                            <FlatList
                                ref={listRef}
                                data={filteredLanguages}
                                keyExtractor={(item) => item.code}
                                keyboardShouldPersistTaps="handled"
                                onScrollToIndexFailed={() => { }}
                                renderItem={({ item }) => {
                                    const active = item.code === selected.code;
                                    return (
                                        <Pressable
                                            className={`flex-row items-center gap-2 border-b border-border px-4 py-3 ${active ? "bg-card" : ""}`}
                                            onPress={() => handleSelect(item)}
                                        >
                                            <Text className={`flex-1 text-[15px] ${active ? "font-semibold text-accent" : "text-fg"}`}>
                                                {item.label}
                                            </Text>
                                            <Text className="text-xs text-muted" style={{ fontFamily: Fonts.mono }}>{item.code}</Text>
                                            {active && <Text className="text-sm font-bold text-accent">✓</Text>}
                                        </Pressable>
                                    );
                                }}
                                ListEmptyComponent={
                                    <Text className="p-6 text-center text-sm text-muted">No languages match &quot;{search}&quot;</Text>
                                }
                            />
                            <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
                                <Text className="text-base font-bold text-fg">{label}</Text>
                                <Pressable onPress={() => setVisible(false)} hitSlop={12}>
                                    <Text className="text-base text-muted">✕</Text>
                                </Pressable>
                            </View>

                            <TextInput
                                ref={searchInputRef}
                                className="mx-4 rounded-lg border border-border-input bg-input p-3 text-[15px] text-fg"
                                placeholder="Search languages..."
                                placeholderTextColor={placeholderColor}
                                value={search}
                                onChangeText={setSearch}
                                autoCorrect={false}
                                autoCapitalize="none"
                            />
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>
        </React.Fragment>
    );
}
